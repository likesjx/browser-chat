/**
 * Contract Tests: Worker Message Interface
 *
 * These tests define the contract between main thread and worker.
 * All tests should FAIL initially (no implementation yet).
 * Tests verify message structure, not implementation logic.
 */

describe('Worker Message Interface Contract', () => {
  let worker;

  beforeEach(() => {
    // These tests will fail until model-worker.js is implemented
    worker = new Worker('./src/model-worker.js', { type: 'module' });
  });

  afterEach(() => {
    worker.terminate();
  });

  describe('Load LLM Model', () => {
    test('accepts valid load-llm message', (done) => {
      const message = {
        type: 'load-llm',
        data: {
          modelUrl: 'onnx-community/gemma-3-270m-it-ONNX',
          config: {
            systemPrompt: 'You are a helpful assistant.',
            temperature: 0.7,
            maxTokens: 512,
            inferenceTimeout: 30000
          }
        }
      };

      worker.onmessage = (e) => {
        expect(e.data.type).toMatch(/load-progress|load-complete|load-error/);
        if (e.data.type === 'load-progress') {
          expect(e.data.data.progress).toBeGreaterThanOrEqual(0);
          expect(e.data.data.progress).toBeLessThanOrEqual(100);
        }
        done();
      };

      worker.postMessage(message);
    });

    test('sends load-progress updates', (done) => {
      const progressUpdates = [];

      worker.onmessage = (e) => {
        if (e.data.type === 'load-progress') {
          progressUpdates.push(e.data.data.progress);
          expect(e.data.data.modelType).toBe('llm');
        }

        if (e.data.type === 'load-complete') {
          expect(progressUpdates.length).toBeGreaterThan(0);
          expect(progressUpdates[0]).toBeLessThan(progressUpdates[progressUpdates.length - 1]);
          done();
        }
      };

      worker.postMessage({
        type: 'load-llm',
        data: { modelUrl: 'mock-model-url' }
      });
    });

    test('sends load-complete on success', (done) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'load-complete') {
          expect(e.data.data.modelType).toBe('llm');
          expect(e.data.data.loadTime).toBeGreaterThan(0);
          done();
        }
      };

      worker.postMessage({
        type: 'load-llm',
        data: { modelUrl: 'mock-model-url' }
      });
    });

    test('sends load-error on invalid model URL', (done) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'load-error') {
          expect(e.data.data.error).toBeTruthy();
          expect(e.data.data.modelType).toBe('llm');
          expect(e.data.data.errorCategory).toMatch(/network|oom|format|unknown/);
          done();
        }
      };

      worker.postMessage({
        type: 'load-llm',
        data: { modelUrl: 'invalid-url-404' }
      });
    });
  });

  describe('Load Embedding Model', () => {
    test('accepts valid load-embedding message', (done) => {
      worker.onmessage = (e) => {
        expect(e.data.type).toMatch(/load-progress|load-complete|load-error/);
        if (e.data.type === 'load-complete') {
          expect(e.data.data.modelType).toBe('embedding');
          done();
        }
      };

      worker.postMessage({
        type: 'load-embedding',
        data: { modelUrl: 'onnx-community/embeddinggemma-300m-ONNX' }
      });
    });
  });

  describe('Generate Text', () => {
    beforeEach((done) => {
      // Load model before testing generation
      worker.onmessage = (e) => {
        if (e.data.type === 'load-complete') done();
      };
      worker.postMessage({
        type: 'load-llm',
        data: { modelUrl: 'mock-model-url' }
      });
    });

    test('accepts valid generate message', (done) => {
      worker.onmessage = (e) => {
        expect(e.data.type).toMatch(/token|generation-complete|generation-error/);
        if (e.data.type === 'generation-complete') done();
      };

      worker.postMessage({
        type: 'generate',
        data: {
          prompt: 'Hello, world!',
          config: {
            temperature: 0.7,
            maxTokens: 50,
            systemPrompt: 'You are helpful.',
            inferenceTimeout: 30000
          }
        }
      });
    });

    test('streams tokens sequentially', (done) => {
      const tokens = [];

      worker.onmessage = (e) => {
        if (e.data.type === 'token') {
          tokens.push(e.data.data);
          expect(e.data.data.tokenIndex).toBe(tokens.length - 1);
          expect(typeof e.data.data.token).toBe('string');
        }

        if (e.data.type === 'generation-complete') {
          expect(tokens.length).toBeGreaterThan(0);
          // Verify sequential indices
          tokens.forEach((t, i) => expect(t.tokenIndex).toBe(i));
          done();
        }
      };

      worker.postMessage({
        type: 'generate',
        data: { prompt: 'Test prompt', config: {} }
      });
    });

    test('sends generation-complete with metadata', (done) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'generation-complete') {
          expect(e.data.data.fullResponse).toBeTruthy();
          expect(e.data.data.tokenCount).toBeGreaterThan(0);
          expect(e.data.data.duration).toBeGreaterThan(0);
          done();
        }
      };

      worker.postMessage({
        type: 'generate',
        data: { prompt: 'Test', config: {} }
      });
    });

    test('rejects generate when model not loaded', (done) => {
      const freshWorker = new Worker('./src/model-worker.js', { type: 'module' });

      freshWorker.onmessage = (e) => {
        expect(e.data.type).toBe('generation-error');
        expect(e.data.data.error).toContain('not loaded');
        freshWorker.terminate();
        done();
      };

      freshWorker.postMessage({
        type: 'generate',
        data: { prompt: 'Test', config: {} }
      });
    });
  });

  describe('Cancel Generation', () => {
    beforeEach((done) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'load-complete') done();
      };
      worker.postMessage({
        type: 'load-llm',
        data: { modelUrl: 'mock-model-url' }
      });
    });

    test('cancels ongoing generation', (done) => {
      let tokenReceived = false;
      let cancelled = false;

      worker.onmessage = (e) => {
        if (e.data.type === 'token') {
          tokenReceived = true;
          if (!cancelled) {
            cancelled = true;
            worker.postMessage({ type: 'cancel', data: null });
          }
        }

        if (e.data.type === 'generation-complete') {
          expect(tokenReceived).toBe(true);
          // Should complete quickly after cancel
          done();
        }
      };

      worker.postMessage({
        type: 'generate',
        data: { prompt: 'Long generation...', config: { maxTokens: 1000 } }
      });
    });
  });

  describe('Generate Embedding', () => {
    beforeEach((done) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'load-complete') done();
      };
      worker.postMessage({
        type: 'load-embedding',
        data: { modelUrl: 'mock-embedding-url' }
      });
    });

    test('returns embedding as Float32Array', (done) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'embedding-result') {
          expect(e.data.data.embedding).toBeInstanceOf(Float32Array);
          expect(e.data.data.embedding.length).toBeGreaterThan(0);
          done();
        }
      };

      worker.postMessage({
        type: 'embed',
        data: { text: 'Test text for embedding' }
      });
    });
  });

  describe('Dispose', () => {
    test('accepts dispose message', (done) => {
      // Worker should clean up resources
      worker.onmessage = (e) => {
        // Optional: worker may send acknowledgment
        if (e.data.type === 'disposed') {
          done();
        }
      };

      worker.postMessage({ type: 'dispose', data: null });

      // Terminate after short delay (worker may not respond)
      setTimeout(() => {
        worker.terminate();
        done();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    test('ignores unknown message types', (done) => {
      worker.onerror = (error) => {
        // Worker should not crash on unknown type
        fail('Worker crashed on unknown message type');
      };

      worker.postMessage({ type: 'unknown-type', data: null });

      // If no error after 100ms, worker handled it gracefully
      setTimeout(done, 100);
    });

    test('validates message structure', (done) => {
      worker.onerror = (error) => {
        fail('Worker crashed on invalid message');
      };

      // Invalid message (no type field)
      worker.postMessage({ data: 'invalid' });

      setTimeout(done, 100);
    });
  });
});
