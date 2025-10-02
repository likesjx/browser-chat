/**
 * Chat Component - Interactive browser-based AI chat Web Component
 *
 * Custom Element that provides keyboard-activated chat interface with
 * in-browser LLM inference, streaming responses, and persistent storage.
 */

import { modelManager } from './model-manager.js';
import * as storage from './storage-manager.js';

/**
 * ChatComponent Custom Element
 */
class ChatComponent extends HTMLElement {
  constructor() {
    super();

    // Initialize Shadow DOM
    this.attachShadow({ mode: 'open' });

    // Component state
    this.state = {
      visibility: 'hidden', // 'hidden' | 'input-visible' | 'generating' | 'response-visible'
      currentPrompt: '',
      currentResponse: '',
      isGenerating: false,
      generationAborted: false,
      errorMessage: null,
      focusedElement: 'none' // 'input' | 'response' | 'none'
    };

    // Model loading state
    this._modelLoading = false;
    this._embeddingLoading = false;
    this._lastModelUrl = null;
    this._lastEmbeddingUrl = null;

    // Configuration (defaults)
    this._config = {
      modelUrl: null,
      embeddingUrl: null,
      systemPrompt: 'You are a helpful AI assistant.',
      temperature: 0.7,
      maxTokens: 512,
      inferenceTimeout: 30000
    };

    // Bindings
    this._handleKeyboard = this._handleKeyboard.bind(this);
    this._handleClickOutside = this._handleClickOutside.bind(this);
    this._handleInputKeydown = this._handleInputKeydown.bind(this);

    // Render initial UI
    this._render();
  }

  /**
   * Observed attributes for change detection
   */
  static get observedAttributes() {
    return [
      'model-url',
      'embedding-url',
      'system-prompt',
      'temperature',
      'max-tokens',
      'inference-timeout'
    ];
  }

  /**
   * Property accessors with validation
   */

  get modelUrl() { return this._config.modelUrl; }
  set modelUrl(value) {
    this._config.modelUrl = value;
    this.setAttribute('model-url', value);
  }

  get embeddingUrl() { return this._config.embeddingUrl; }
  set embeddingUrl(value) {
    this._config.embeddingUrl = value;
    if (value) this.setAttribute('embedding-url', value);
  }

  get systemPrompt() { return this._config.systemPrompt; }
  set systemPrompt(value) {
    this._config.systemPrompt = value;
    this.setAttribute('system-prompt', value);
  }

  get temperature() { return this._config.temperature; }
  set temperature(value) {
    const temp = parseFloat(value);
    this._config.temperature = Math.max(0, Math.min(2, temp)); // Clamp 0-2
    this.setAttribute('temperature', this._config.temperature);
  }

  get maxTokens() { return this._config.maxTokens; }
  set maxTokens(value) {
    const tokens = parseInt(value);
    this._config.maxTokens = Math.max(1, Math.min(2048, tokens)); // Clamp 1-2048
    this.setAttribute('max-tokens', this._config.maxTokens);
  }

  get inferenceTimeout() { return this._config.inferenceTimeout; }
  set inferenceTimeout(value) {
    const timeout = parseInt(value);
    this._config.inferenceTimeout = Math.max(1000, Math.min(120000, timeout)); // Clamp 1s-2min
    this.setAttribute('inference-timeout', this._config.inferenceTimeout);
  }

  /**
   * Read-only properties for state inspection
   */

  get isVisible() {
    return this.state.visibility !== 'hidden';
  }

  get isGenerating() {
    return this.state.isGenerating;
  }

  get isModelLoaded() {
    return modelManager.isLlmLoaded;
  }

  get conversationCount() {
    return this._conversationCount || 0;
  }

  /**
   * Lifecycle: Component connected to DOM
   */
  async connectedCallback() {
    console.log('Chat component connected');

    // Attach global keyboard listener for Cmd-K/Ctrl-K
    document.addEventListener('keydown', this._handleKeyboard);

    // Load model if modelUrl is set
    if (this._config.modelUrl) {
      await this._loadModels();
    }

    // Initialize storage and get conversation count
    try {
      this._conversationCount = await storage.getConversationCount();
    } catch (error) {
      console.error('Failed to get conversation count:', error);
      this._conversationCount = 0;
    }

    // Dispatch connected event
    this.dispatchEvent(new CustomEvent('chat-connected', {
      bubbles: true,
      detail: { timestamp: new Date() }
    }));
  }

  /**
   * Lifecycle: Component disconnected from DOM
   */
  disconnectedCallback() {
    console.log('Chat component disconnected');

    // Remove global keyboard listener
    document.removeEventListener('keydown', this._handleKeyboard);
    document.removeEventListener('click', this._handleClickOutside);

    // Cancel any active generation
    if (this.state.isGenerating) {
      modelManager.cancelGeneration();
    }

    // Dispose model sessions
    modelManager.dispose();
  }

  /**
   * Lifecycle: Attribute changed
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'model-url':
        this._config.modelUrl = newValue;
        // Only load if URL changed and not already loading/loaded
        if (newValue && this.isConnected && newValue !== this._lastModelUrl && !this._modelLoading) {
          this._loadModels();
        }
        break;

      case 'embedding-url':
        this._config.embeddingUrl = newValue;
        // Only load if URL changed and not already loading/loaded
        if (newValue && this.isConnected && newValue !== this._lastEmbeddingUrl && !this._embeddingLoading) {
          this._loadEmbeddingModel();
        }
        break;

      case 'system-prompt':
        this._config.systemPrompt = newValue || 'You are a helpful AI assistant.';
        modelManager.updateConfig({ systemPrompt: this._config.systemPrompt });
        break;

      case 'temperature':
        this.temperature = newValue;
        modelManager.updateConfig({ temperature: this._config.temperature });
        break;

      case 'max-tokens':
        this.maxTokens = newValue;
        modelManager.updateConfig({ maxTokens: this._config.maxTokens });
        break;

      case 'inference-timeout':
        this.inferenceTimeout = newValue;
        modelManager.updateConfig({ inferenceTimeout: this._config.inferenceTimeout });
        break;
    }
  }

  /**
   * Render Shadow DOM UI
   */
  _render() {
    // Load styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = new URL('./styles.css', import.meta.url).href;

    // Create template
    const template = document.createElement('template');
    template.innerHTML = `
      <div class="chat-container" part="container">
        <div class="chat-input-wrapper" part="input-wrapper">
          <label class="chat-label">Ask me anything...</label>
          <textarea
            class="chat-input"
            part="input"
            placeholder="Ask anything..."
            rows="1"
          ></textarea>
        </div>

        <div class="chat-response" part="response" tabindex="0"></div>

        <div class="chat-actions" part="actions">
          <button class="chat-button retry-button" part="retry-button">
            Retry
          </button>
        </div>

        <div class="chat-help">
          <kbd>Esc</kbd> to cancel or close
        </div>
      </div>
    `;

    // Append to shadow root
    this.shadowRoot.appendChild(styleLink);
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // Cache DOM elements
    this._container = this.shadowRoot.querySelector('.chat-container');
    this._input = this.shadowRoot.querySelector('.chat-input');
    this._response = this.shadowRoot.querySelector('.chat-response');
    this._actions = this.shadowRoot.querySelector('.chat-actions');
    this._retryButton = this.shadowRoot.querySelector('.retry-button');

    // Add event listeners
    this._input.addEventListener('keydown', this._handleInputKeydown);
    this._input.addEventListener('click', () => this._handleInputClick());
    this._retryButton.addEventListener('click', () => this.retry());
  }

  /**
   * Handle input click - clear response but preserve prompt
   */
  _handleInputClick() {
    // Only clear if there's a response visible
    if (this.state.visibility === 'response-visible') {
      this._response.classList.remove('visible');
      this._response.textContent = '';
      this._actions.classList.remove('visible');
      this.state.visibility = 'input-visible';
      this.state.currentResponse = '';
      this.state.errorMessage = null;
    }
  }

  /**
   * Handle global keyboard events (Cmd-K/Ctrl-K)
   */
  _handleKeyboard(event) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const triggerKey = isMac ? event.metaKey && event.key === 'k' : event.ctrlKey && event.key === 'k';

    if (triggerKey) {
      event.preventDefault();
      event.stopPropagation();
      this.activate();
      return;
    }

    // Handle Esc key when component is visible
    if (event.key === 'Escape' && this.isVisible) {
      event.preventDefault();

      if (this.state.isGenerating) {
        // Cancel generation, preserve prompt
        this._cancelGeneration();
      } else {
        // Hide component
        this.hide();
      }
    }
  }

  /**
   * Handle click outside to close component
   */
  _handleClickOutside(event) {
    // Check if click is outside the component using composedPath for shadow DOM
    const path = event.composedPath();
    const clickedInside = path.includes(this._container);

    if (!clickedInside && !this.state.isGenerating) {
      this.hide();
    }
  }

  /**
   * Handle input keydown (Enter to submit, Shift+Enter for newline)
   */
  _handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this._submitPrompt();
    }
  }

  /**
   * Public API: Activate component (show)
   */
  activate() {
    this.state.visibility = 'input-visible';
    this._container.classList.add('visible');

    // Ensure focus happens after animation completes (200ms transition)
    setTimeout(() => {
      this._input.focus();
      // Move cursor to end of text if any exists
      const len = this._input.value.length;
      this._input.setSelectionRange(len, len);
    }, 220);

    // Add click-outside listener
    setTimeout(() => {
      document.addEventListener('click', this._handleClickOutside);
    }, 100);

    this.dispatchEvent(new CustomEvent('chat-activated', {
      bubbles: true
    }));
  }

  /**
   * Public API: Hide component
   */
  hide() {
    this.state.visibility = 'hidden';
    this._container.classList.remove('visible');
    this._response.classList.remove('visible');
    this._actions.classList.remove('visible');

    // Clear state
    this.state.currentPrompt = '';
    this.state.currentResponse = '';
    this.state.errorMessage = null;
    this._input.value = '';
    this._response.textContent = '';

    // Remove click-outside listener
    document.removeEventListener('click', this._handleClickOutside);

    this.dispatchEvent(new CustomEvent('chat-hidden', {
      bubbles: true
    }));
  }

  /**
   * Submit prompt for generation
   */
  async _submitPrompt() {
    const prompt = this._input.value.trim();

    if (!prompt) {
      return; // Empty prompt
    }

    // Validate prompt length
    if (prompt.length > 10000) {
      this._showError('Prompt too long (max 10,000 characters)');
      return;
    }

    // Clear any previous error state
    this.state.errorMessage = null;
    this._response.classList.remove('error');
    this._actions.classList.remove('visible');

    this.state.currentPrompt = prompt;
    this.state.currentResponse = '';

    // Check if model is loaded
    if (!modelManager.isLlmLoaded) {
      // Model not loaded yet - queue prompt and show loading message
      this.state.visibility = 'generating';
      this._response.classList.add('visible', 'loading');
      this._response.innerHTML = '<div style="display: flex; flex-direction: column; gap: 12px; align-items: center;"><span class="loading-spinner"></span><span style="font-size: 13px; color: var(--chat-text-secondary);">Loading model...</span></div>';

      modelManager.queuePrompt(prompt);

      // Dispatch event to indicate model loading is needed
      this.dispatchEvent(new CustomEvent('model-loading-needed', {
        bubbles: true,
        detail: { prompt, timestamp: new Date() }
      }));

      return;
    }

    // Model is loaded - start generation
    this.state.visibility = 'generating';
    this.state.isGenerating = true;

    // Show response area with loading state (cylon eye)
    this._response.classList.add('visible', 'loading');
    this._response.innerHTML = '<div style="display: flex; flex-direction: column; gap: 16px; align-items: center;"><span class="loading-spinner"></span><span style="font-size: 13px; color: var(--chat-text-secondary); font-weight: 500;">Generating response...</span></div>';

    // Force browser to paint before starting generation (ensures animation starts)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Dispatch generation started event
    this.dispatchEvent(new CustomEvent('generation-started', {
      bubbles: true,
      detail: { prompt, timestamp: new Date() }
    }));

    // Generate response
    await this._generateResponse(prompt);
  }

  /**
   * Generate AI response with streaming
   */
  async _generateResponse(prompt) {
    try {
      const loadingStartTime = Date.now();
      const minLoadingTime = 800; // Show Cylon eye for at least 800ms

      // Wait for minimum loading time OR first token (whichever is longer)
      let fullResponse = '';
      let tokenCount = 0;
      const startTime = Date.now();

      // Start streaming tokens
      const tokenGenerator = modelManager.generateTokensWithTimeout(prompt);
      const firstTokenPromise = tokenGenerator.next();

      // Wait at least minLoadingTime before showing first token
      const [firstToken] = await Promise.all([
        firstTokenPromise,
        new Promise(resolve => setTimeout(resolve, minLoadingTime))
      ]);

      // Clear loading state after minimum time has passed
      this._response.classList.remove('loading');
      this._response.textContent = '';

      // Process first token if we got one
      if (!firstToken.done && firstToken.value) {
        fullResponse += firstToken.value;
        tokenCount++;
        this._response.textContent = fullResponse;
      }

      // Stream remaining tokens
      for await (const token of tokenGenerator) {
        fullResponse += token;
        tokenCount++;

        // Update UI with sanitized text
        this._response.textContent = fullResponse;

        // Dispatch progress event every 10 tokens
        if (tokenCount % 10 === 0) {
          this.dispatchEvent(new CustomEvent('generation-progress', {
            bubbles: true,
            detail: { tokenCount, partialResponse: fullResponse }
          }));
        }
      }

      // Generation complete
      const duration = Date.now() - startTime;
      this.state.currentResponse = fullResponse;
      this.state.isGenerating = false;
      this.state.visibility = 'response-visible';

      // Focus response area
      this._response.focus();

      // Save to storage (only if we have a response)
      let saved = false;
      if (fullResponse.trim().length > 0) {
        saved = await this._saveConversation(prompt, fullResponse);
      } else {
        console.log('Skipping save - empty response (likely cancelled)');
      }

      // Dispatch completion event
      this.dispatchEvent(new CustomEvent('generation-complete', {
        bubbles: true,
        detail: { prompt, response: fullResponse, tokenCount, duration, saved }
      }));

    } catch (error) {
      this.state.isGenerating = false;

      // Handle error message safely
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';

      if (errorMessage.includes('cancelled')) {
        // Cancellation handled separately
        return;
      }

      // Show error
      this._showError(errorMessage);

      this.dispatchEvent(new CustomEvent('generation-error', {
        bubbles: true,
        detail: {
          prompt,
          error: errorMessage,
          errorType: errorMessage.includes('timeout') ? 'inference-timeout' : 'inference-error'
        }
      }));
    }
  }

  /**
   * Cancel active generation
   */
  _cancelGeneration() {
    modelManager.cancelGeneration();
    this.state.isGenerating = false;
    this.state.generationAborted = true;

    // Clear response but keep prompt
    this._response.classList.remove('visible');
    this._response.textContent = '';
    this.state.visibility = 'input-visible';

    this.dispatchEvent(new CustomEvent('generation-cancelled', {
      bubbles: true,
      detail: {
        prompt: this.state.currentPrompt,
        partialResponse: this.state.currentResponse,
        tokenCount: this.state.currentResponse.split(' ').length
      }
    }));
  }

  /**
   * Show error message
   */
  _showError(message) {
    this.state.errorMessage = message;
    this.state.visibility = 'response-visible';

    this._response.classList.add('visible', 'error');
    this._response.classList.remove('loading');
    this._response.textContent = `❌ Error: ${message}`;

    // Show retry button
    this._actions.classList.add('visible');
  }

  /**
   * Public API: Retry last failed generation
   */
  retry() {
    if (!this.state.currentPrompt) {
      return;
    }

    // Clear error state
    this.state.errorMessage = null;
    this._response.classList.remove('error');
    this._actions.classList.remove('visible');

    // Retry generation
    this._generateResponse(this.state.currentPrompt);
  }

  /**
   * Save conversation to storage
   */
  async _saveConversation(prompt, response) {
    try {
      // Generate embedding
      const embedding = await modelManager.generateEmbedding(prompt);

      // Create conversation pair
      const conversationPair = {
        id: Date.now(),
        prompt,
        response,
        embedding,
        modelVersion: 'mvp-mock',
        timestamp: new Date()
      };

      // Save to IndexedDB
      const result = await storage.saveConversation(conversationPair);

      if (result.success) {
        this._conversationCount++;
        return true;
      } else if (result.error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded:', result.error.message);
        // Don't block on storage error, just warn
        return false;
      } else {
        console.error('Failed to save conversation:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
      return false;
    }
  }

  /**
   * Load LLM model
   */
  async _loadModels() {
    if (!this._config.modelUrl) {
      console.warn('No model URL configured');
      return;
    }

    // Prevent duplicate loading
    if (this._modelLoading) {
      console.log('Model already loading, skipping...');
      return;
    }

    this._modelLoading = true;
    this._lastModelUrl = this._config.modelUrl;

    this.dispatchEvent(new CustomEvent('model-loading', {
      bubbles: true,
      detail: { modelUrl: this._config.modelUrl, modelType: 'llm' }
    }));

    try {
      const startTime = Date.now();

      await modelManager.loadModel(
        this._config.modelUrl,
        'llm',
        (progress) => {
          this.dispatchEvent(new CustomEvent('model-progress', {
            bubbles: true,
            detail: progress
          }));
        }
      );

      const loadTime = Date.now() - startTime;

      this.dispatchEvent(new CustomEvent('model-loaded', {
        bubbles: true,
        detail: { modelUrl: this._config.modelUrl, modelType: 'llm', loadTime }
      }));

      // Load embedding model if configured
      if (this._config.embeddingUrl) {
        await this._loadEmbeddingModel();
      }

      // Process queued prompts
      const queued = modelManager.getQueuedPrompts();
      if (queued.length > 0) {
        console.log(`Processing ${queued.length} queued prompts`);
        // For MVP, just process the first one
        if (queued[0]) {
          // Clear any loading state first
          this._response.classList.remove('loading');
          this.state.isGenerating = false;

          // Set the input value and submit
          this._input.value = queued[0];
          await this._submitPrompt();
        }
      }

    } catch (error) {
      console.error('Failed to load model:', error);

      this.dispatchEvent(new CustomEvent('model-error', {
        bubbles: true,
        detail: { modelUrl: this._config.modelUrl, modelType: 'llm', error }
      }));

      this._showError(error.message);
    } finally {
      this._modelLoading = false;
    }
  }

  /**
   * Load embedding model
   */
  async _loadEmbeddingModel() {
    if (!this._config.embeddingUrl) {
      return;
    }

    // Prevent duplicate loading
    if (this._embeddingLoading) {
      console.log('Embedding model already loading, skipping...');
      return;
    }

    this._embeddingLoading = true;
    this._lastEmbeddingUrl = this._config.embeddingUrl;

    try {
      await modelManager.loadModel(this._config.embeddingUrl, 'embedding');
      console.log('Embedding model loaded');
    } catch (error) {
      console.warn('Failed to load embedding model:', error.message);
      // Non-critical error, continue without embeddings
    } finally {
      this._embeddingLoading = false;
    }
  }

  /**
   * Public API: Get conversation history
   */
  async getHistory(limit = 10) {
    try {
      return await storage.getHistory(limit);
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  }

  /**
   * Public API: Clear conversation history
   */
  async clearHistory() {
    try {
      const result = await storage.clearHistory();
      this._conversationCount = 0;

      this.dispatchEvent(new CustomEvent('history-cleared', {
        bubbles: true,
        detail: { count: result.count }
      }));

      return result;
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  }
}

// Register Custom Element
customElements.define('chat-component', ChatComponent);

export default ChatComponent;
