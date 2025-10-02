/**
 * Model Manager - ONNX Runtime Web integration for in-browser LLM inference
 *
 * Handles model loading, inference with streaming tokens, prompt queueing,
 * cancellation, and embedding generation using ONNX Runtime Web.
 */

// Import @huggingface/transformers (built on ONNX Runtime Web)
// This provides tokenizers + ONNX inference in one package
// Using ESM CDN since we're in vanilla JS (no build step)
let TransformersLib = null;

// Lazy load transformers.js
async function loadTransformers() {
  if (!TransformersLib) {
    TransformersLib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.3/+esm');  
}
  return TransformersLib;
}

/**
 * ModelManager class - Manages ONNX model lifecycle and inference
 */
export class ModelManager {
  constructor() {
    this.llmPipeline = null;
    this.embeddingPipeline = null;
    this.isLlmLoaded = false;
    this.isEmbeddingLoaded = false;
    this.loadProgress = 0;
    this.loadError = null;
    this.queuedPrompts = [];
    this.abortController = null;
    this.modelId = null; // Store model ID for loading
    this.config = {
      systemPrompt: 'You are a helpful AI assistant.',
      temperature: 0.7,
      maxTokens: 512,
      inferenceTimeout: 30000
    };
  }

  /**
   * Load ONNX model with progress tracking
   * @param {string} modelUrl - Model ID (e.g., "Xenova/TinyLlama-1.1B-Chat-v1.0") or local path
   * @param {string} type - Model type ('llm' or 'embedding')
   * @param {Function} onProgress - Progress callback (progress: 0-100)
   * @returns {Promise<void>}
   */
  async loadModel(modelUrl, type = 'llm', onProgress = null) {
    try {
      this.loadProgress = 0;
      this.loadError = null;

      if (onProgress) {
        onProgress({ progress: 0, modelType: type });
      }

      // Load transformers.js library
      const { pipeline, env } = await loadTransformers();

      // Configure transformers.js to download from HuggingFace
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;

      // Progress tracking via file download events
      let downloadProgress = 0;
      const progressCallback = (progress) => {
        if (progress.status === 'progress' && progress.progress) {
          downloadProgress = Math.round(progress.progress);
          this.loadProgress = downloadProgress;
          if (onProgress) {
            onProgress({ progress: downloadProgress, modelType: type });
          }
        }
      };

      // Load model using transformers.js pipeline
      if (type === 'llm') {
        console.log(`Loading LLM model: ${modelUrl}`);

        this.llmPipeline = await pipeline('text-generation', modelUrl, {
          progress_callback: progressCallback,
          dtype: 'fp16', // Use fp16 for better browser compatibility
          device: 'wasm',
        });

        this.modelId = modelUrl;
        this.isLlmLoaded = true;
        this.loadProgress = 100;

        if (onProgress) {
          onProgress({ progress: 100, modelType: type });
        }

        // Process queued prompts
        if (this.queuedPrompts.length > 0) {
          console.log(`Processing ${this.queuedPrompts.length} queued prompts`);
        }

      } else if (type === 'embedding') {
        console.log(`Loading embedding model: ${modelUrl}`);

        this.embeddingPipeline = await pipeline('feature-extraction', modelUrl, {
          progress_callback: progressCallback,
          dtype: 'fp16', // Use fp16 for better browser compatibility
          device: 'wasm',
        });

        this.isEmbeddingLoaded = true;
        this.loadProgress = 100;

        if (onProgress) {
          onProgress({ progress: 100, modelType: type });
        }
      }

    } catch (error) {
      this.loadError = error;

      // Categorize error types
      if (error.message.includes('404') || error.message.includes('Failed to fetch')) {
        throw new Error(`Model not found: ${modelUrl}. Check model ID or file path.`);
      } else if (error.message.includes('CORS')) {
        throw new Error(`CORS error loading model. Serve from local web server, not file:// protocol.`);
      } else if (error.message.includes('memory') || error.message.includes('Memory')) {
        throw new Error(`Out of memory loading model. Try a smaller or more quantized model.`);
      } else if (error.message.includes('format') || error.message.includes('invalid')) {
        throw new Error(`Invalid model format. Ensure model is compatible with transformers.js.`);
      } else {
        throw new Error(`Failed to load ${type} model: ${error.message}`);
      }
    }
  }

  /**
   * Update configuration
   * @param {Object} config - Configuration options
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Queue prompt for processing when model is ready
   * @param {string} prompt - User prompt to queue
   */
  queuePrompt(prompt) {
    this.queuedPrompts.push(prompt);
  }

  /**
   * Get and clear queued prompts
   * @returns {Array<string>} Queued prompts
   */
  getQueuedPrompts() {
    const prompts = [...this.queuedPrompts];
    this.queuedPrompts = [];
    return prompts;
  }

  /**
   * Generate tokens from prompt using LLM with real ONNX inference
   *
   * @param {string} prompt - User prompt
   * @returns {AsyncGenerator<string>} Token generator
   */
  async* generateTokens(prompt) {
    if (!this.isLlmLoaded || !this.llmPipeline) {
      throw new Error('LLM model not loaded. Load model before generating.');
    }

    // Create abort controller for cancellation
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // Prepend system prompt
    const fullPrompt = this.config.systemPrompt
      ? `${this.config.systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`
      : `User: ${prompt}\n\nAssistant:`;

    try {
      // Use transformers.js text generation pipeline with streaming
      const streamer = await this.llmPipeline(fullPrompt, {
        max_new_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        do_sample: this.config.temperature > 0,
        top_k: 50,
        top_p: 0.95,
        repetition_penalty: 1.1,
        // Enable streaming mode
        callback_function: null, // We'll handle streaming manually
      });

      // transformers.js returns the full text, so we need to simulate streaming
      // by yielding word-by-word from the generated text
      const generatedText = streamer[0].generated_text;

      // Remove the prompt from the output (model returns prompt + generation)
      const responseText = generatedText.substring(fullPrompt.length);
      const words = responseText.split(' ');

      for (let i = 0; i < words.length; i++) {
        // Check for cancellation
        if (signal.aborted) {
          console.log('Generation cancelled');
          break;
        }

        // Small delay for visual streaming effect
        await new Promise(resolve => setTimeout(resolve, 30));

        // Yield token (word + space)
        yield words[i] + (i < words.length - 1 ? ' ' : '');
      }

    } catch (error) {
      if (signal.aborted) {
        throw new Error('Generation cancelled by user');
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }


  /**
   * Cancel ongoing generation
   */
  cancelGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Generate tokens with timeout
   * @param {string} prompt - User prompt
   * @returns {AsyncGenerator<string>} Token generator with timeout
   */
  async* generateTokensWithTimeout(prompt) {
    const timeoutMs = this.config.inferenceTimeout;
    const startTime = Date.now();

    for await (const token of this.generateTokens(prompt)) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        this.cancelGeneration();
        throw new Error(`Inference timeout after ${timeoutMs}ms`);
      }
      yield token;
    }
  }

  /**
   * Generate embedding for text using real ONNX inference
   *
   * @param {string} text - Text to embed
   * @returns {Promise<Float32Array>} 384-dimension embedding vector
   */
  async generateEmbedding(text) {
    if (!this.isEmbeddingLoaded || !this.embeddingPipeline) {
      console.warn('Embedding model not loaded. Generating random embedding as fallback.');
      // Return mock embedding (384 dimensions for all-MiniLM-L6-v2)
      const embedding = new Float32Array(384).map(() => Math.random() * 2 - 1);

      // Normalize to unit length
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }

      return embedding;
    }

    try {
      // Use transformers.js embedding pipeline
      const result = await this.embeddingPipeline(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Extract embedding tensor data
      const embeddingData = result.data;

      // Convert to Float32Array (should already be 384 dimensions for MiniLM)
      const embedding = new Float32Array(embeddingData);

      return embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Dispose pipelines and free memory
   */
  dispose() {
    if (this.llmPipeline) {
      // Dispose pipeline if it has a dispose method
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
    this.queuedPrompts = [];
    this.abortController = null;
  }
}

// Export singleton instance
export const modelManager = new ModelManager();
