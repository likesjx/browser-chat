/**
 * Worker Manager - Main thread wrapper for model worker communication
 *
 * Provides a Promise/AsyncGenerator-based API that mirrors the original
 * ModelManager, but runs all model operations in a Web Worker.
 */

export class WorkerManager {
  constructor() {
    this._worker = null;
    this._isLlmLoaded = false;
    this._isEmbeddingLoaded = false;
    this._messageId = 0;
    this._pendingRequests = new Map(); // message ID → { resolve, reject }
    this._generationCallbacks = null; // { onToken, onComplete, onError }
    this._requestQueue = []; // FIFO queue for generation requests
    this._isGenerating = false;

    this._initWorker();
  }

  /**
   * Initialize worker and set up message listeners
   */
  _initWorker() {
    try {
      this._worker = new Worker('./src/model-worker.js', { type: 'module' });

      this._worker.onmessage = (event) => {
        this._handleMessage(event.data);
      };

      this._worker.onerror = (error) => {
        console.error('Worker error:', error);
        // Auto-restart worker on crash (once)
        if (this._worker) {
          this._worker.terminate();
          this._initWorker();
        }
      };

    } catch (error) {
      console.error('Failed to create worker:', error);
      throw new Error(`Worker initialization failed: ${error.message}`);
    }
  }

  /**
   * Handle messages from worker
   */
  _handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'load-progress':
        // Trigger progress callback if registered
        if (this._pendingRequests.has('load-progress-callback')) {
          const { resolve } = this._pendingRequests.get('load-progress-callback');
          resolve(data);
        }
        break;

      case 'load-complete':
        if (data.modelType === 'llm') {
          this._isLlmLoaded = true;
        } else if (data.modelType === 'embedding') {
          this._isEmbeddingLoaded = true;
        }

        // Resolve load promise
        if (this._pendingRequests.has('load')) {
          const { resolve } = this._pendingRequests.get('load');
          this._pendingRequests.delete('load');
          this._pendingRequests.delete('load-progress-callback');
          resolve(data);
        }
        break;

      case 'load-error':
        if (this._pendingRequests.has('load')) {
          const { reject } = this._pendingRequests.get('load');
          this._pendingRequests.delete('load');
          this._pendingRequests.delete('load-progress-callback');
          reject(new Error(data.error));
        }
        break;

      case 'token':
        // Stream token to generator
        if (this._generationCallbacks && this._generationCallbacks.onToken) {
          this._generationCallbacks.onToken(data.token);
        }
        break;

      case 'generation-complete':
        this._isGenerating = false;

        // Complete generation
        if (this._generationCallbacks && this._generationCallbacks.onComplete) {
          this._generationCallbacks.onComplete(data);
        }

        // Process next request in queue
        this._processQueue();
        break;

      case 'generation-error':
        this._isGenerating = false;

        // Propagate error
        if (this._generationCallbacks && this._generationCallbacks.onError) {
          this._generationCallbacks.onError(new Error(data.error));
        }

        // Process next request in queue
        this._processQueue();
        break;

      case 'embedding-result':
        // Resolve embedding promise
        if (this._pendingRequests.has('embed')) {
          const { resolve } = this._pendingRequests.get('embed');
          this._pendingRequests.delete('embed');
          resolve(data.embedding);
        }
        break;

      default:
        console.warn(`Unknown message type from worker: ${type}`);
    }
  }

  /**
   * Process next request in queue
   */
  _processQueue() {
    if (this._requestQueue.length > 0 && !this._isGenerating) {
      const request = this._requestQueue.shift();
      this._executeGeneration(request.prompt, request.config, request.callbacks);
    }
  }

  /**
   * Execute generation request
   */
  _executeGeneration(prompt, config, callbacks) {
    this._isGenerating = true;
    this._generationCallbacks = callbacks;

    this._worker.postMessage({
      type: 'generate',
      data: {
        prompt,
        config
      }
    });
  }

  /**
   * Load LLM model
   */
  async loadLlmModel(modelUrl, config = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      // Register progress callback
      if (onProgress) {
        this._pendingRequests.set('load-progress-callback', {
          resolve: onProgress
        });
      }

      // Register load promise
      this._pendingRequests.set('load', { resolve, reject });

      // Send load message
      this._worker.postMessage({
        type: 'load-llm',
        data: {
          modelUrl,
          config
        }
      });
    });
  }

  /**
   * Load embedding model
   */
  async loadEmbeddingModel(modelUrl) {
    return new Promise((resolve, reject) => {
      // Register load promise
      this._pendingRequests.set('load', { resolve, reject });

      // Send load message
      this._worker.postMessage({
        type: 'load-embedding',
        data: {
          modelUrl
        }
      });
    });
  }

  /**
   * Generate tokens (AsyncGenerator)
   */
  async* generateTokens(prompt, config = {}) {
    if (!this._isLlmLoaded) {
      throw new Error('LLM model not loaded. Load model before generating.');
    }

    // Queue request if busy
    if (this._isGenerating) {
      // Create promise that resolves when this generation starts
      await new Promise((resolve) => {
        this._requestQueue.push({
          prompt,
          config,
          callbacks: {
            onToken: null, // Will be set below
            onComplete: null,
            onError: null
          }
        });
        resolve();
      });
    }

    // Create token stream
    const tokens = [];
    let completed = false;
    let error = null;

    const callbacks = {
      onToken: (token) => {
        tokens.push(token);
      },
      onComplete: () => {
        completed = true;
      },
      onError: (err) => {
        error = err;
        completed = true;
      }
    };

    // Start generation
    if (!this._isGenerating) {
      this._executeGeneration(prompt, config, callbacks);
    } else {
      // Update queued request with callbacks
      const queuedRequest = this._requestQueue[this._requestQueue.length - 1];
      if (queuedRequest) {
        queuedRequest.callbacks = callbacks;
      }
    }

    // Yield tokens as they arrive
    let lastIndex = 0;
    while (!completed) {
      // Yield any new tokens
      while (lastIndex < tokens.length) {
        yield tokens[lastIndex];
        lastIndex++;
      }

      // Small delay to avoid busy waiting
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check for errors
      if (error) {
        throw error;
      }
    }

    // Yield any remaining tokens
    while (lastIndex < tokens.length) {
      yield tokens[lastIndex];
      lastIndex++;
    }
  }

  /**
   * Generate embedding
   */
  async generateEmbedding(text) {
    if (!this._isEmbeddingLoaded) {
      console.warn('Embedding model not loaded. Returning mock embedding.');
      // Return mock embedding (384 dimensions)
      const embedding = new Float32Array(384).map(() => Math.random() * 2 - 1);
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
      return embedding;
    }

    return new Promise((resolve, reject) => {
      this._pendingRequests.set('embed', { resolve, reject });

      this._worker.postMessage({
        type: 'embed',
        data: {
          text
        }
      });
    });
  }

  /**
   * Cancel ongoing generation
   */
  cancelGeneration() {
    if (this._isGenerating) {
      this._worker.postMessage({
        type: 'cancel',
        data: null
      });

      // Clear callbacks to stop streaming
      if (this._generationCallbacks) {
        this._generationCallbacks.onComplete();
      }

      this._isGenerating = false;
    }
  }

  /**
   * Dispose resources
   */
  dispose() {
    if (this._worker) {
      this._worker.postMessage({
        type: 'dispose',
        data: null
      });

      // Terminate worker after short delay
      setTimeout(() => {
        if (this._worker) {
          this._worker.terminate();
          this._worker = null;
        }
      }, 100);
    }

    this._isLlmLoaded = false;
    this._isEmbeddingLoaded = false;
    this._pendingRequests.clear();
    this._generationCallbacks = null;
    this._requestQueue = [];
    this._isGenerating = false;
  }

  /**
   * State properties
   */
  get isLlmLoaded() {
    return this._isLlmLoaded;
  }

  get isEmbeddingLoaded() {
    return this._isEmbeddingLoaded;
  }
}

// Export singleton instance
export const workerManager = new WorkerManager();
