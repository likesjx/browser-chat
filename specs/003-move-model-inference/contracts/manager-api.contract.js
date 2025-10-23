/**
 * Contract Tests: WorkerManager API
 *
 * These tests define the contract for the WorkerManager class API.
 * API must match existing ModelManager for drop-in replacement.
 * All tests should FAIL initially (no implementation yet).
 */

describe('WorkerManager API Contract', () => {
  let workerManager;

  beforeEach(() => {
    // Import will fail until worker-manager.js exists
    const { WorkerManager } = require('../../../src/worker-manager.js');
    workerManager = new WorkerManager();
  });

  afterEach(() => {
    workerManager.dispose();
  });

  describe('Constructor', () => {
    test('initializes with default state', () => {
      expect(workerManager.isLlmLoaded).toBe(false);
      expect(workerManager.isEmbeddingLoaded).toBe(false);
    });

    test('creates worker instance', () => {
      expect(workerManager._worker).toBeTruthy();
    });
  });

  describe('loadLlmModel()', () => {
    test('accepts modelUrl and config parameters', async () => {
      const onProgress = jest.fn();

      const promise = workerManager.loadLlmModel(
        'onnx-community/gemma-3-270m-it-ONNX',
        {
          systemPrompt: 'Test',
          temperature: 0.7,
          maxTokens: 512,
          inferenceTimeout: 30000
        },
        onProgress
      );

      expect(promise).toBeInstanceOf(Promise);
    });

    test('calls onProgress callback during loading', async () => {
      const onProgress = jest.fn();

      await workerManager.loadLlmModel(
        'mock-model-url',
        {},
        onProgress
      );

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress.mock.calls[0][0]).toHaveProperty('progress');
      expect(onProgress.mock.calls[0][0]).toHaveProperty('modelType', 'llm');
    });

    test('sets isLlmLoaded on success', async () => {
      await workerManager.loadLlmModel('mock-model-url', {});
      expect(workerManager.isLlmLoaded).toBe(true);
    });

    test('throws on load failure', async () => {
      await expect(
        workerManager.loadLlmModel('invalid-url', {})
      ).rejects.toThrow();
    });
  });

  describe('loadEmbeddingModel()', () => {
    test('accepts modelUrl parameter', async () => {
      const promise = workerManager.loadEmbeddingModel(
        'onnx-community/embeddinggemma-300m-ONNX'
      );

      expect(promise).toBeInstanceOf(Promise);
    });

    test('sets isEmbeddingLoaded on success', async () => {
      await workerManager.loadEmbeddingModel('mock-embedding-url');
      expect(workerManager.isEmbeddingLoaded).toBe(true);
    });
  });

  describe('generateTokens()', () => {
    beforeEach(async () => {
      await workerManager.loadLlmModel('mock-model-url', {});
    });

    test('returns AsyncGenerator', () => {
      const generator = workerManager.generateTokens('Hello');
      expect(generator).toHaveProperty('next');
      expect(generator).toHaveProperty(Symbol.asyncIterator);
    });

    test('yields tokens sequentially', async () => {
      const tokens = [];

      for await (const token of workerManager.generateTokens('Test prompt')) {
        tokens.push(token);
        expect(typeof token).toBe('string');
      }

      expect(tokens.length).toBeGreaterThan(0);
    });

    test('throws if model not loaded', async () => {
      const freshManager = new WorkerManager();

      await expect(async () => {
        for await (const token of freshManager.generateTokens('Test')) {
          // Should throw before yielding
        }
      }).rejects.toThrow('not loaded');

      freshManager.dispose();
    });

    test('supports cancellation', async () => {
      const generator = workerManager.generateTokens('Long prompt...');
      const firstToken = await generator.next();

      workerManager.cancelGeneration();

      // Generator should stop yielding after cancel
      const result = await generator.next();
      expect(result.done).toBe(true);
    });
  });

  describe('generateEmbedding()', () => {
    beforeEach(async () => {
      await workerManager.loadEmbeddingModel('mock-embedding-url');
    });

    test('returns Promise<Float32Array>', async () => {
      const embedding = await workerManager.generateEmbedding('Test text');
      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBeGreaterThan(0);
    });

    test('throws if embedding model not loaded', async () => {
      const freshManager = new WorkerManager();

      await expect(
        freshManager.generateEmbedding('Test')
      ).rejects.toThrow();

      freshManager.dispose();
    });
  });

  describe('cancelGeneration()', () => {
    beforeEach(async () => {
      await workerManager.loadLlmModel('mock-model-url', {});
    });

    test('cancels ongoing generation', async () => {
      const tokens = [];

      try {
        for await (const token of workerManager.generateTokens('Long prompt', { maxTokens: 1000 })) {
          tokens.push(token);
          if (tokens.length === 5) {
            workerManager.cancelGeneration();
          }
        }
      } catch (error) {
        // Cancellation may throw or gracefully end generator
      }

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.length).toBeLessThan(1000); // Didn't complete full generation
    });

    test('is safe to call when not generating', () => {
      expect(() => workerManager.cancelGeneration()).not.toThrow();
    });
  });

  describe('dispose()', () => {
    test('cleans up worker resources', () => {
      const worker = workerManager._worker;
      workerManager.dispose();

      // Worker should be terminated
      expect(workerManager._worker).toBeNull();
    });

    test('is safe to call multiple times', () => {
      workerManager.dispose();
      expect(() => workerManager.dispose()).not.toThrow();
    });

    test('prevents further operations after dispose', async () => {
      workerManager.dispose();

      await expect(
        workerManager.loadLlmModel('mock-url', {})
      ).rejects.toThrow();
    });
  });

  describe('Request Queueing', () => {
    beforeEach(async () => {
      await workerManager.loadLlmModel('mock-model-url', {});
    });

    test('queues requests when worker is busy', async () => {
      const results = [];

      // Start two generations concurrently
      const gen1 = workerManager.generateTokens('First prompt');
      const gen2 = workerManager.generateTokens('Second prompt');

      // Collect both results
      for await (const token of gen1) {
        results.push({ prompt: 'first', token });
      }
      for await (const token of gen2) {
        results.push({ prompt: 'second', token });
      }

      expect(results.length).toBeGreaterThan(0);
      // Verify second generation didn't overlap with first
    });

    test('processes queue in FIFO order', async () => {
      const completionOrder = [];

      // Start multiple generations
      const gen1Promise = (async () => {
        for await (const _ of workerManager.generateTokens('First')) {}
        completionOrder.push(1);
      })();

      const gen2Promise = (async () => {
        for await (const _ of workerManager.generateTokens('Second')) {}
        completionOrder.push(2);
      })();

      const gen3Promise = (async () => {
        for await (const _ of workerManager.generateTokens('Third')) {}
        completionOrder.push(3);
      })();

      await Promise.all([gen1Promise, gen2Promise, gen3Promise]);

      expect(completionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('Error Recovery', () => {
    test('allows retry after load failure', async () => {
      await expect(
        workerManager.loadLlmModel('invalid-url', {})
      ).rejects.toThrow();

      // Retry with valid URL should succeed
      await expect(
        workerManager.loadLlmModel('mock-model-url', {})
      ).resolves.not.toThrow();
    });

    test('allows retry after generation failure', async () => {
      await workerManager.loadLlmModel('mock-model-url', {});

      // Simulate error (very long prompt)
      await expect(async () => {
        for await (const _ of workerManager.generateTokens('x'.repeat(20000))) {}
      }).rejects.toThrow();

      // Retry with valid prompt should succeed
      await expect(async () => {
        for await (const _ of workerManager.generateTokens('Valid prompt')) {}
      }).resolves.not.toThrow();
    });

    test('recovers from worker crash', async () => {
      await workerManager.loadLlmModel('mock-model-url', {});

      // Simulate worker crash
      workerManager._worker.terminate();

      // Next operation should auto-restart worker
      await expect(
        workerManager.generateTokens('Test')
      ).resolves.not.toThrow();
    });
  });

  describe('API Compatibility with ModelManager', () => {
    test('has same method signatures', () => {
      // Verify API matches existing ModelManager
      expect(typeof workerManager.loadLlmModel).toBe('function');
      expect(typeof workerManager.loadEmbeddingModel).toBe('function');
      expect(typeof workerManager.generateTokens).toBe('function');
      expect(typeof workerManager.generateEmbedding).toBe('function');
      expect(typeof workerManager.cancelGeneration).toBe('function');
      expect(typeof workerManager.dispose).toBe('function');
    });

    test('has same property accessors', () => {
      expect(workerManager).toHaveProperty('isLlmLoaded');
      expect(workerManager).toHaveProperty('isEmbeddingLoaded');
    });
  });
});
