/**
 * Model Worker - Web Worker for ONNX Runtime inference
 *
 * Handles model loading and inference in a separate thread to prevent
 * blocking the main UI thread during compute-intensive operations.
 */

// Import @huggingface/transformers (built on ONNX Runtime Web)
let TransformersLib = null;

// Lazy load transformers.js
async function loadTransformers() {
  if (!TransformersLib) {
    TransformersLib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.3/+esm');
  }
  return TransformersLib;
}

/**
 * Singleton pipeline manager - one instance per model type
 */
class PipelineManager {
  constructor() {
    this.llmPipeline = null;
    this.embeddingPipeline = null;
    this.isLlmLoaded = false;
    this.isEmbeddingLoaded = false;
    this.abortController = null;
    this.state = 'idle'; // idle | loading | generating
  }

  /**
   * Load LLM model
   */
  async loadLlm(modelUrl, config) {
    this.state = 'loading';

    try {
      const { pipeline, env } = await loadTransformers();

      // Configure transformers.js
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;

      // Set threading (disable if issues occur)
      // env.backends.onnx.wasm.numThreads = 1;

      // Progress callback
      const progressCallback = (progress) => {
        if (progress.status === 'progress' && progress.progress) {
          self.postMessage({
            type: 'load-progress',
            data: {
              progress: Math.round(progress.progress),
              modelType: 'llm'
            }
          });
        }
      };

      const startTime = Date.now();

      // Load text-generation pipeline
      this.llmPipeline = await pipeline('text-generation', modelUrl, {
        progress_callback: progressCallback,
        dtype: 'fp16',
        device: 'wasm',
      });

      this.isLlmLoaded = true;
      this.state = 'idle';

      const loadTime = Date.now() - startTime;

      self.postMessage({
        type: 'load-complete',
        data: {
          modelType: 'llm',
          loadTime
        }
      });

    } catch (error) {
      this.state = 'idle';
      this.isLlmLoaded = false;

      // Categorize error
      let errorCategory = 'unknown';
      const errorMsg = error.message || error.toString();

      if (errorMsg.includes('404') || errorMsg.includes('Failed to fetch')) {
        errorCategory = 'network';
      } else if (errorMsg.includes('CORS')) {
        errorCategory = 'network';
      } else if (errorMsg.includes('memory') || errorMsg.includes('Memory')) {
        errorCategory = 'oom';
      } else if (errorMsg.includes('format') || errorMsg.includes('invalid')) {
        errorCategory = 'format';
      }

      self.postMessage({
        type: 'load-error',
        data: {
          error: errorMsg,
          modelType: 'llm',
          errorCategory
        }
      });
    }
  }

  /**
   * Load embedding model
   */
  async loadEmbedding(modelUrl) {
    this.state = 'loading';

    try {
      const { pipeline, env } = await loadTransformers();

      // Configure transformers.js
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;

      // Progress callback
      const progressCallback = (progress) => {
        if (progress.status === 'progress' && progress.progress) {
          self.postMessage({
            type: 'load-progress',
            data: {
              progress: Math.round(progress.progress),
              modelType: 'embedding'
            }
          });
        }
      };

      const startTime = Date.now();

      // Load feature-extraction pipeline
      this.embeddingPipeline = await pipeline('feature-extraction', modelUrl, {
        progress_callback: progressCallback,
        dtype: 'fp16',
        device: 'wasm',
      });

      this.isEmbeddingLoaded = true;
      this.state = 'idle';

      const loadTime = Date.now() - startTime;

      self.postMessage({
        type: 'load-complete',
        data: {
          modelType: 'embedding',
          loadTime
        }
      });

    } catch (error) {
      this.state = 'idle';
      this.isEmbeddingLoaded = false;

      // Categorize error
      let errorCategory = 'unknown';
      const errorMsg = error.message || error.toString();

      if (errorMsg.includes('404') || errorMsg.includes('Failed to fetch')) {
        errorCategory = 'network';
      } else if (errorMsg.includes('CORS')) {
        errorCategory = 'network';
      } else if (errorMsg.includes('memory') || errorMsg.includes('Memory')) {
        errorCategory = 'oom';
      } else if (errorMsg.includes('format') || errorMsg.includes('invalid')) {
        errorCategory = 'format';
      }

      self.postMessage({
        type: 'load-error',
        data: {
          error: errorMsg,
          modelType: 'embedding',
          errorCategory
        }
      });
    }
  }

  /**
   * Generate text with streaming simulation
   */
  async generate(prompt, config) {
    if (!this.isLlmLoaded || !this.llmPipeline) {
      self.postMessage({
        type: 'generation-error',
        data: {
          error: 'LLM model not loaded',
          errorType: 'inference-error'
        }
      });
      return;
    }

    this.state = 'generating';
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      const startTime = Date.now();

      // Prepend system prompt
      const fullPrompt = config.systemPrompt
        ? `${config.systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`
        : `User: ${prompt}\n\nAssistant:`;

      // Run inference
      const result = await this.llmPipeline(fullPrompt, {
        max_new_tokens: config.maxTokens || 512,
        temperature: config.temperature || 0.7,
        do_sample: (config.temperature || 0.7) > 0,
        top_k: 50,
        top_p: 0.95,
        repetition_penalty: 1.1,
      });

      // Check for cancellation
      if (signal.aborted) {
        self.postMessage({
          type: 'generation-complete',
          data: {
            fullResponse: '',
            tokenCount: 0,
            duration: Date.now() - startTime
          }
        });
        this.state = 'idle';
        return;
      }

      // Extract generated text
      const generatedText = result[0].generated_text;
      const responseText = generatedText.substring(fullPrompt.length);

      // Simulate streaming (word-by-word with 30ms delay)
      const words = responseText.split(' ');
      let tokenCount = 0;

      for (let i = 0; i < words.length; i++) {
        // Check for cancellation
        if (signal.aborted) {
          break;
        }

        // Small delay for streaming effect
        await new Promise(resolve => setTimeout(resolve, 30));

        // Send token
        const token = words[i] + (i < words.length - 1 ? ' ' : '');
        self.postMessage({
          type: 'token',
          data: {
            token,
            tokenIndex: i
          }
        });

        tokenCount++;
      }

      // Send completion
      const duration = Date.now() - startTime;
      self.postMessage({
        type: 'generation-complete',
        data: {
          fullResponse: responseText,
          tokenCount,
          duration
        }
      });

      this.state = 'idle';

    } catch (error) {
      this.state = 'idle';

      if (signal.aborted) {
        return; // Already handled above
      }

      const errorMsg = error.message || error.toString();
      const errorType = errorMsg.includes('timeout') ? 'inference-timeout' : 'inference-error';

      self.postMessage({
        type: 'generation-error',
        data: {
          error: errorMsg,
          errorType
        }
      });
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Generate embedding
   */
  async generateEmbedding(text) {
    if (!this.isEmbeddingLoaded || !this.embeddingPipeline) {
      self.postMessage({
        type: 'generation-error',
        data: {
          error: 'Embedding model not loaded',
          errorType: 'inference-error'
        }
      });
      return;
    }

    try {
      // Use transformers.js embedding pipeline
      const result = await this.embeddingPipeline(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Extract embedding tensor data
      const embeddingData = result.data;

      // Convert to Float32Array
      const embedding = new Float32Array(embeddingData);

      // Send result (transferable for efficiency)
      self.postMessage({
        type: 'embedding-result',
        data: {
          embedding
        }
      }, [embedding.buffer]);

    } catch (error) {
      const errorMsg = error.message || error.toString();

      self.postMessage({
        type: 'generation-error',
        data: {
          error: `Failed to generate embedding: ${errorMsg}`,
          errorType: 'inference-error'
        }
      });
    }
  }

  /**
   * Cancel ongoing generation
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Dispose resources
   */
  dispose() {
    if (this.llmPipeline) {
      if (typeof this.llmPipeline.dispose === 'function') {
        this.llmPipeline.dispose();
      }
      this.llmPipeline = null;
      this.isLlmLoaded = false;
    }

    if (this.embeddingPipeline) {
      if (typeof this.embeddingPipeline.dispose === 'function') {
        this.embeddingPipeline.dispose();
      }
      this.embeddingPipeline = null;
      this.isEmbeddingLoaded = false;
    }

    this.state = 'idle';
  }
}

// Create singleton instance
const pipelineManager = new PipelineManager();

/**
 * Message handler - routes messages to appropriate methods
 */
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'load-llm':
        await pipelineManager.loadLlm(data.modelUrl, data.config || {});
        break;

      case 'load-embedding':
        await pipelineManager.loadEmbedding(data.modelUrl);
        break;

      case 'generate':
        await pipelineManager.generate(data.prompt, data.config || {});
        break;

      case 'embed':
        await pipelineManager.generateEmbedding(data.text);
        break;

      case 'cancel':
        pipelineManager.cancel();
        break;

      case 'dispose':
        pipelineManager.dispose();
        break;

      default:
        // Unknown message type - log and ignore (forward compatibility)
        console.warn(`Unknown message type: ${type}`);
    }
  } catch (error) {
    // Catch-all error handler to prevent worker crashes
    console.error('Worker error:', error);
    self.postMessage({
      type: 'generation-error',
      data: {
        error: error.message || error.toString(),
        errorType: 'inference-error'
      }
    });
  }
});
