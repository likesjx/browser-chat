# Component API Contract: Chat Component

**Feature**: 001-create-a-web
**Date**: 2025-10-01
**Phase**: 1 - API Contract Definition

## Overview
This contract defines the public API surface of the `<chat-component>` Custom Element, including attributes, properties, methods, events, and CSS custom properties.

---

## 1. Custom Element Registration

### Element Name
```javascript
customElements.define('chat-component', ChatComponent);
```

**Tag Name**: `<chat-component>`
**Class Name**: `ChatComponent`
**Extends**: `HTMLElement`

---

## 2. HTML Attributes

### Required Attributes
```html
<chat-component
  model-url="/models/tinyllama-q8.onnx"
></chat-component>
```

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model-url` | string | Yes | null | URL or path to ONNX model file |

### Optional Attributes
```html
<chat-component
  model-url="/models/tinyllama-q8.onnx"
  embedding-url="/models/minilm-l6-q8.onnx"
  system-prompt="You are a helpful assistant."
  temperature="0.7"
  max-tokens="512"
  inference-timeout="30000"
></chat-component>
```

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `embedding-url` | string | No | null | URL to embedding model (optional for vector storage) |
| `system-prompt` | string | No | "You are a helpful AI assistant." | System message prepended to prompts |
| `temperature` | number | No | 0.7 | Sampling temperature (0.0-2.0, creativity) |
| `max-tokens` | number | No | 512 | Maximum generation length (1-2048 tokens) |
| `inference-timeout` | number | No | 30000 | Generation timeout in ms (1000-120000) |

### Attribute Change Behavior
- **`model-url` change**: Disposes current session, loads new model, shows loading indicator
- **`embedding-url` change**: Loads embedding model, enables/disables vector storage
- **`system-prompt` change**: Applied to next inference immediately
- **`temperature`, `max-tokens`, `inference-timeout` change**: Applied to next inference

---

## 3. JavaScript Properties

### Read/Write Properties
```javascript
const chat = document.querySelector('chat-component');

// Set configuration
chat.modelUrl = '/models/custom.onnx';
chat.embeddingUrl = '/models/embedding.onnx';
chat.systemPrompt = 'You are a code reviewer.';
chat.temperature = 0.8;
chat.maxTokens = 1024;
chat.inferenceTimeout = 45000;

// Read configuration
console.log(chat.modelUrl);  // "/models/custom.onnx"
console.log(chat.temperature); // 0.8
```

**Property Names**: Camel-cased versions of kebab-case attributes
**Type Coercion**: Strings converted to numbers for numeric properties
**Validation**: Out-of-range values clamped to valid range

### Read-Only Properties
```javascript
// State inspection
console.log(chat.isVisible);     // boolean - component currently visible
console.log(chat.isGenerating);  // boolean - inference in progress
console.log(chat.isModelLoaded); // boolean - model ready for inference
console.log(chat.conversationCount); // number - saved pairs in IndexedDB
```

| Property | Type | Description |
|----------|------|-------------|
| `isVisible` | boolean | Whether component is currently shown |
| `isGenerating` | boolean | Whether inference is actively running |
| `isModelLoaded` | boolean | Whether model is loaded and ready |
| `conversationCount` | number | Number of stored conversation pairs |

---

## 4. Public Methods

### `activate()`
**Purpose**: Programmatically show the component (equivalent to Cmd-K)

```javascript
chat.activate();
```

**Returns**: `void`
**Side Effects**:
- Sets component visible
- Focuses input element
- Dispatches `chat-activated` event

**Contract**:
- MUST make component visible
- MUST focus input element
- MUST NOT trigger if already visible (idempotent)

---

### `hide()`
**Purpose**: Programmatically hide the component (equivalent to Esc)

```javascript
chat.hide();
```

**Returns**: `void`
**Side Effects**:
- Hides component
- Clears current prompt and response
- Cancels active generation
- Dispatches `chat-hidden` event

**Contract**:
- MUST hide component
- MUST clear ephemeral state (ChatSession)
- MUST cancel any active generation
- MUST NOT clear persistent history (IndexedDB)

---

### `clearHistory()`
**Purpose**: Delete all stored conversation pairs from IndexedDB

```javascript
await chat.clearHistory();
```

**Returns**: `Promise<void>`
**Side Effects**:
- Deletes all records from IndexedDB
- Resets `conversationCount` to 0
- Dispatches `history-cleared` event

**Contract**:
- MUST delete all ConversationPair records
- MUST be async (returns Promise)
- MUST handle concurrent calls gracefully (queue)
- MUST dispatch event after completion

---

### `getHistory(limit = 10)`
**Purpose**: Retrieve recent conversation pairs

```javascript
const recent = await chat.getHistory(10);
// Returns: ConversationPair[]
```

**Parameters**:
- `limit` (number, optional): Maximum number of pairs to retrieve (default 10)

**Returns**: `Promise<ConversationPair[]>` - Array of conversation objects

**Contract**:
- MUST return in reverse chronological order (newest first)
- MUST limit results to specified count
- MUST return empty array if no history
- MUST NOT include embeddings (large, not useful for display)

**Return Type**:
```typescript
interface ConversationPair {
  id: number;
  prompt: string;
  response: string;
  modelVersion: string;
  timestamp: Date;
  // embedding excluded for size
}
```

---

### `retry()`
**Purpose**: Retry last failed inference

```javascript
chat.retry();
```

**Returns**: `void`
**Side Effects**:
- Clears error message
- Resubmits last prompt for inference
- Dispatches `generation-started` event

**Contract**:
- MUST only work when error is displayed
- MUST reuse last prompt (preserved in input)
- MUST show loading indicator during retry
- MUST replace error with response or new error

---

## 5. Custom Events

### `chat-activated`
**Dispatched**: When component becomes visible
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('chat-activated', (event) => {
  console.log('Chat component activated');
});
```

**Detail**: `null`

---

### `chat-hidden`
**Dispatched**: When component is hidden
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('chat-hidden', (event) => {
  console.log('Chat component hidden');
});
```

**Detail**: `null`

---

### `generation-started`
**Dispatched**: When inference begins (after prompt submission)
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('generation-started', (event) => {
  console.log('Prompt:', event.detail.prompt);
});
```

**Detail**:
```typescript
{
  prompt: string; // User's prompt text
  timestamp: Date; // When generation started
}
```

---

### `generation-progress`
**Dispatched**: Periodically during streaming (every N tokens)
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('generation-progress', (event) => {
  console.log('Tokens:', event.detail.tokenCount);
});
```

**Detail**:
```typescript
{
  tokenCount: number;  // Tokens generated so far
  partialResponse: string; // Current response text
}
```

---

### `generation-complete`
**Dispatched**: When inference finishes successfully
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('generation-complete', (event) => {
  console.log('Response:', event.detail.response);
});
```

**Detail**:
```typescript
{
  prompt: string;
  response: string;
  tokenCount: number;
  duration: number; // Generation time in ms
  saved: boolean;   // Whether pair was saved to IndexedDB
}
```

---

### `generation-cancelled`
**Dispatched**: When user cancels generation (Esc)
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('generation-cancelled', (event) => {
  console.log('Cancelled after', event.detail.tokenCount, 'tokens');
});
```

**Detail**:
```typescript
{
  prompt: string;
  partialResponse: string;
  tokenCount: number;
}
```

---

### `generation-error`
**Dispatched**: When inference fails
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('generation-error', (event) => {
  console.error('Error:', event.detail.error.message);
});
```

**Detail**:
```typescript
{
  prompt: string;
  error: Error;  // Error object with message
  errorType: 'model-load' | 'inference-timeout' | 'inference-error' | 'storage-error';
}
```

---

### `model-loading`
**Dispatched**: When model download/parsing begins
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('model-loading', (event) => {
  console.log('Loading model:', event.detail.modelUrl);
});
```

**Detail**:
```typescript
{
  modelUrl: string;
  modelType: 'llm' | 'embedding';
}
```

---

### `model-progress`
**Dispatched**: Periodically during model loading
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('model-progress', (event) => {
  console.log('Load progress:', event.detail.progress + '%');
});
```

**Detail**:
```typescript
{
  progress: number;  // 0-100 percentage
  modelType: 'llm' | 'embedding';
}
```

---

### `model-loaded`
**Dispatched**: When model is ready for inference
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('model-loaded', (event) => {
  console.log('Model ready');
});
```

**Detail**:
```typescript
{
  modelUrl: string;
  modelType: 'llm' | 'embedding';
  loadTime: number; // Load duration in ms
}
```

---

### `model-error`
**Dispatched**: When model loading fails
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('model-error', (event) => {
  console.error('Model load failed:', event.detail.error.message);
});
```

**Detail**:
```typescript
{
  modelUrl: string;
  modelType: 'llm' | 'embedding';
  error: Error;
}
```

---

### `history-cleared`
**Dispatched**: After conversation history is deleted
**Bubbles**: Yes
**Cancelable**: No

```javascript
chat.addEventListener('history-cleared', (event) => {
  console.log('Cleared', event.detail.count, 'conversations');
});
```

**Detail**:
```typescript
{
  count: number; // Number of pairs deleted
}
```

---

## 6. CSS Custom Properties (Theming)

### Colors
```css
chat-component {
  --chat-bg-color: #ffffff;
  --chat-text-color: #333333;
  --chat-border-color: #cccccc;
  --chat-accent-color: #007bff;
  --chat-error-color: #dc3545;
  --chat-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

### Sizing
```css
chat-component {
  --chat-width: 600px;
  --chat-max-height: 80vh;
  --chat-border-radius: 8px;
  --chat-padding: 16px;
}
```

### Typography
```css
chat-component {
  --chat-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --chat-font-size: 14px;
  --chat-line-height: 1.5;
}
```

### Animation
```css
chat-component {
  --chat-transition-speed: 0.2s;
  --chat-fade-in: fadeIn 0.2s ease-in-out;
}
```

**Contract**:
- MUST support overriding all custom properties from host page
- MUST provide sensible defaults for all properties
- MUST encapsulate styles via Shadow DOM (no global leakage)

---

## 7. Keyboard Shortcuts

### Global Shortcuts (Document-level)
| Shortcut | Action | Cancelable |
|----------|--------|------------|
| Cmd-K (Mac) | Activate component | No (preventDefault) |
| Ctrl-K (Windows/Linux) | Activate component | No (preventDefault) |

### Component-level Shortcuts (When visible)
| Shortcut | Action | Context |
|----------|--------|---------|
| Esc | Cancel generation (preserve prompt) | During generation |
| Esc | Hide component (clear all) | When idle |
| Enter | Submit prompt | Input has focus |
| Shift-Enter | New line in prompt | Input (multi-line) |

**Contract**:
- MUST intercept Cmd-K/Ctrl-K globally per FR-016
- MUST distinguish Esc behavior based on generation state per FR-014a, FR-009
- MUST clean up global listeners on `disconnectedCallback`

---

## 8. Shadow DOM Structure

### Expected Shadow DOM Tree
```html
#shadow-root (mode: open)
  <style>
    /* Scoped component styles */
  </style>
  <div class="chat-container" part="container">
    <div class="chat-input-wrapper" part="input-wrapper">
      <textarea class="chat-input" part="input" placeholder="Type your message..."></textarea>
    </div>
    <div class="chat-response" part="response">
      <!-- Streaming response or error message -->
    </div>
    <div class="chat-actions" part="actions">
      <button class="retry-button" part="retry-button">Retry</button>
    </div>
  </div>
```

### CSS Parts (Host Page Styling)
```css
chat-component::part(container) {
  border: 2px solid blue;
}

chat-component::part(input) {
  font-size: 16px;
}

chat-component::part(response) {
  background: #f5f5f5;
}
```

**Contract**:
- MUST expose `part` attributes for external styling hooks
- MUST maintain Shadow DOM encapsulation (no global selector leakage)
- MUST use semantic class names

---

## 9. Accessibility (ARIA)

### ARIA Attributes
```html
<chat-component
  role="dialog"
  aria-label="AI Chat Assistant"
  aria-modal="true"
></chat-component>
```

**Contract**:
- MUST set `role="dialog"` when visible
- MUST trap focus within component when visible
- MUST announce loading/error states via `aria-live="polite"`
- MUST support keyboard-only navigation

---

## 10. Error Handling Contract

### Model Loading Errors
**Trigger**: Network failure, 404, CORS, out of memory
**Response**:
- Dispatch `model-error` event
- Show error in component (not console only)
- Disable input until resolved

### Inference Errors
**Trigger**: Timeout, WASM crash, invalid input
**Response**:
- Dispatch `generation-error` event
- Display error message in response area
- Show retry button per FR-015
- Preserve prompt in input

### Storage Errors
**Trigger**: QuotaExceededError, IndexedDB unavailable
**Response**:
- Dispatch `generation-error` with `errorType: 'storage-error'`
- Still display response (don't block generation)
- Show warning message per FR-017
- Suggest clearing history

---

## 11. Component Lifecycle Hooks

### `constructor()`
**Contract**:
- Initialize Shadow DOM
- Set default configuration
- DO NOT attach event listeners (not in DOM yet)

### `connectedCallback()`
**Contract**:
- Attach global keyboard listener (Cmd-K/Ctrl-K)
- Load model if `modelUrl` attribute set
- Initialize IndexedDB connection
- Dispatch `connected` event

### `disconnectedCallback()`
**Contract**:
- Remove global keyboard listener
- Cancel any active generation
- Close IndexedDB connection
- Dispose ONNX sessions (free memory)

### `attributeChangedCallback(name, oldValue, newValue)`
**Contract**:
- Validate new value
- Update internal configuration
- Reload model if `model-url` changed
- Apply changes to next inference

---

## 12. Performance Contract

### Response Times
- **First token**: <2s (target <1s) per constitution
- **Input responsiveness**: <100ms from keystroke to display
- **Component activation**: <50ms from Cmd-K to visible
- **Component hide**: <50ms from Esc to hidden

### Memory
- **Loaded models**: <600MB total (550MB LLM + 23MB embedding)
- **Conversation history**: ~3.5KB per pair (reasonable for 100+ pairs)
- **Active generation**: No UI blocking, streaming updates

### Storage
- **IndexedDB**: No automatic cleanup, user-initiated clear only
- **Quota handling**: Display error when exceeded, don't crash

---

## 13. Browser Compatibility Contract

### Minimum Versions
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Required APIs
- Custom Elements v1
- Shadow DOM
- ES6 modules (`<script type="module">`)
- WebAssembly
- IndexedDB
- Async/await
- KeyboardEvent with `metaKey`/`ctrlKey`

**Contract**:
- MUST NOT use unstable/experimental APIs
- MUST provide fallback error if required API missing
- MUST test in Chrome and Firefox minimum

---

## 14. Security Contract

### XSS Prevention
**Contract**:
- MUST sanitize user input before DOM insertion
- MUST use `textContent` not `innerHTML` for response display
- MUST validate embedding dimensions before storage

### CSP Compliance
**Contract**:
- MUST work with `script-src 'self'` (no inline scripts)
- MUST load ES6 modules only (`<script type="module">`)
- MUST NOT use `eval()` or `Function()` constructor

### Privacy
**Contract**:
- MUST NOT send data to external servers
- MUST store all data in IndexedDB (user-clearable)
- MUST NOT include telemetry or analytics

---

## Test Scenarios (Contract Verification)

### Scenario 1: Component Registration
```javascript
// GIVEN: Web page with component script loaded
// WHEN: Script executes
// THEN: customElements.get('chat-component') !== undefined
```

### Scenario 2: Attribute Configuration
```javascript
// GIVEN: <chat-component model-url="..." temperature="0.9">
// WHEN: Component connected
// THEN: component.temperature === 0.9
```

### Scenario 3: Keyboard Activation
```javascript
// GIVEN: Component in DOM with model loaded
// WHEN: User presses Cmd-K
// THEN: component.isVisible === true AND input has focus
```

### Scenario 4: Prompt Submission
```javascript
// GIVEN: Component visible, prompt entered
// WHEN: User presses Enter
// THEN: 'generation-started' event fired AND isGenerating === true
```

### Scenario 5: Response Streaming
```javascript
// GIVEN: Generation started
// WHEN: Tokens are generated
// THEN: 'generation-progress' events fired AND response updates progressively
```

### Scenario 6: Cancellation
```javascript
// GIVEN: Generation in progress
// WHEN: User presses Esc
// THEN: 'generation-cancelled' event fired AND prompt preserved in input
```

### Scenario 7: Error Retry
```javascript
// GIVEN: Error displayed with retry button
// WHEN: User clicks retry button
// THEN: retry() called AND generation-started event fired
```

### Scenario 8: History Storage
```javascript
// GIVEN: Generation complete
// WHEN: ConversationPair saved to IndexedDB
// THEN: conversationCount incremented AND 'generation-complete' detail.saved === true
```

### Scenario 9: History Clear
```javascript
// GIVEN: Multiple stored conversations
// WHEN: clearHistory() called
// THEN: 'history-cleared' event fired AND conversationCount === 0
```

### Scenario 10: Model Loading with Queue
```javascript
// GIVEN: Model not loaded, prompt submitted
// WHEN: Prompt submitted
// THEN: 'model-loading' event fired AND prompt queued AND loading indicator shown
```

---

**Phase 1 Component API Contract Complete**: Public interface defined with events, methods, attributes, and behavioral contracts.
