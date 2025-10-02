# Research: Interactive Chat Web Component

**Feature**: 001-create-a-web
**Date**: 2025-10-01
**Phase**: 0 - Technology Research & Decision Documentation

## Overview
This document captures research findings and technology decisions for implementing a keyboard-activated Web Component with in-browser LLM inference, streaming responses, and vector storage capabilities.

---

## 1. Web Component Architecture

### Decision: Custom Elements v1 with Shadow DOM
Use native Custom Elements v1 API for component definition and Shadow DOM for style/behavior encapsulation.

### Rationale
- **Native browser API**: No framework dependency, aligns with Vanilla-First principle
- **Wide support**: Chrome 54+, Firefox 63+, Safari 10.1+, Edge 79+ (exceeds our Chrome 90+ minimum)
- **True encapsulation**: Shadow DOM prevents style leaks and global scope pollution
- **Lifecycle hooks**: `connectedCallback`, `disconnectedCallback` for setup/teardown
- **Attribute observation**: `attributeChangedCallback` for configuration changes

### Alternatives Considered
- **Framework-based components** (React, Vue, Svelte): Rejected - violates Vanilla-First principle, adds build complexity
- **Plain JavaScript classes without Custom Elements**: Rejected - lacks encapsulation, requires manual lifecycle management, no standard element registration

### Implementation Notes
- Use `customElements.define('chat-component', ChatComponent)` for registration
- Shadow DOM mode: `'open'` for debugging, but encapsulated styles
- Template element for HTML structure to avoid string concatenation
- Use CSS custom properties (`--chat-*`) for themability while maintaining encapsulation

---

## 2. In-Browser LLM Inference

### Decision: ONNX Runtime Web with Quantized Models
Use `onnxruntime-web` package for WebAssembly-based model inference with int8/int4 quantized models.

### Rationale
- **Official Microsoft library**: Production-ready, actively maintained
- **WebAssembly backend**: Near-native performance without blocking main thread
- **Quantization support**: int8 models reduce size by ~4x, int4 by ~8x (500MB → 125MB or 62MB)
- **Browser compatibility**: Works in all target browsers with WASM support
- **No external dependencies**: Runs entirely client-side after model download

### Alternatives Considered
- **WebGPU-based inference** (web-llm, transformers.js WebGPU): Rejected - limited browser support (Chrome only), not stable for Safari/Firefox
- **WebGL-based inference**: Rejected - lower performance than WASM for language models, compatibility issues
- **Server-side inference**: Rejected - violates In-Browser Execution principle

### Model Selection
- **Primary candidate**: TinyLlama-1.1B quantized to int8 (~550MB) or int4 (~275MB)
- **Backup option**: Phi-2 (2.7B) quantized to int4 (~1.3GB) if performance acceptable
- **Embedding model**: all-MiniLM-L6-v2 quantized (~23MB) for vector embeddings

### Implementation Notes
- Load model via CDN or local file (no npm required for runtime)
- Use Web Workers to prevent UI blocking during inference
- Implement token streaming via async generator pattern
- Cache loaded model in memory for subsequent queries
- Handle model loading state with progress indicator

---

## 3. Keyboard Shortcut Handling

### Decision: Global `keydown` event listener with `preventDefault()`
Attach event listener to `document` with meta key detection and event cancellation.

### Rationale
- **Global activation**: Works regardless of current focus element
- **Standard pattern**: Matches behavior of developer tools, command palettes (VS Code, Slack)
- **Precedence control**: `preventDefault()` + `stopPropagation()` blocks conflicting page shortcuts per FR-016
- **Cross-platform**: `event.metaKey` (Mac) vs `event.ctrlKey` (Windows/Linux) detection

### Alternatives Considered
- **Component-level listener**: Rejected - only works when component has focus
- **Browser extension API**: Rejected - requires extension installation, not a pure web component
- **Service Worker**: Rejected - cannot access DOM or dispatch keyboard events

### Implementation Notes
```javascript
document.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const triggerKey = isMac ? e.metaKey && e.key === 'k' : e.ctrlKey && e.key === 'k';

  if (triggerKey) {
    e.preventDefault();
    e.stopPropagation();
    // Activate component
  }
});
```
- Clean up listener in `disconnectedCallback`
- Handle rapid repeated presses with debounce (~200ms)
- Store listener reference for proper cleanup

---

## 4. Streaming Text Display

### Decision: Progressive DOM updates with async generator
Stream tokens from ONNX inference and append to response container as they arrive.

### Rationale
- **Perceived performance**: Users see first token within ~1s even if full generation takes longer
- **UX feedback**: Visible progress indicates system is working (addresses FR-013)
- **Browser-friendly**: Small, frequent DOM updates don't block UI
- **Cancellable**: Async generators support early termination via Esc key

### Alternatives Considered
- **Batch updates**: Rejected - no streaming feedback, poor UX for slow generation
- **WebSocket streaming**: Rejected - violates In-Browser Execution principle
- **requestAnimationFrame batching**: Rejected - adds unnecessary complexity for text updates

### Implementation Notes
```javascript
async function* streamTokens(prompt) {
  for await (const token of onnxSession.generate(prompt)) {
    yield token;
  }
}

for await (const token of streamTokens(userPrompt)) {
  responseEl.textContent += token;
  // Handle cancellation
  if (cancelled) break;
}
```
- Sanitize each token before DOM insertion (XSS protection)
- Use `textContent` not `innerHTML` for safety
- Track generation state for Esc key cancellation (FR-014a)

---

## 5. IndexedDB Storage with Vector Embeddings

### Decision: IndexedDB for structured storage + embedding arrays
Store conversation pairs in IndexedDB with Float32Array embeddings for future vector search.

### Rationale
- **Native browser API**: No external database, works offline
- **Structured storage**: Better than localStorage for complex objects and large data
- **Binary support**: Efficiently stores Float32Array embeddings
- **Quota management**: Clear error reporting when quota exceeded (FR-017)
- **Async API**: Non-blocking storage operations

### Alternatives Considered
- **localStorage**: Rejected - 5-10MB limit too small, string-only storage inefficient for embeddings
- **Cache API**: Rejected - designed for HTTP caching, not structured data
- **File System Access API**: Rejected - requires user permission prompts, not supported in Firefox

### Schema Design
```javascript
// Store: "conversations"
{
  id: timestamp,
  prompt: string,
  response: string,
  embedding: Float32Array, // 384 dimensions for all-MiniLM-L6-v2
  modelVersion: string,
  timestamp: Date
}
```

### Implementation Notes
- Database name: `chat-component-db`
- Object store: `conversations` with `id` as keyPath
- Index on `timestamp` for chronological retrieval
- Generate embeddings using transformers.js ONNX runtime
- Handle QuotaExceededError with user-friendly message per FR-017
- Provide clear() method for manual history deletion

---

## 6. Error Handling & Retry Mechanism

### Decision: UI-based error display with retry button
Show error messages in response area with clickable retry action.

### Rationale
- **User control**: Manual retry aligns with FR-015 requirement
- **Transparency**: Descriptive error messages help debugging (model load failures, inference timeouts)
- **No auto-retry loops**: Prevents wasted resources on persistent failures
- **Component-level handling**: Errors contained within Web Component, don't affect host page

### Error Categories
1. **Model loading errors**: Network failure, unsupported format, out of memory
2. **Inference errors**: Generation timeout, WASM crash, invalid input
3. **Storage errors**: QuotaExceededError, IndexedDB unavailable
4. **Embedding errors**: Embedding model load failure, vector generation failure

### Implementation Notes
- Display error type and description in response area
- Show retry button that preserves original prompt
- Log errors to console for developer debugging (no external telemetry per constitution)
- Implement timeout for inference (30s default, configurable)
- Graceful degradation: if embedding fails, store conversation without vector (warn but don't block)

---

## 7. Focus Management & Visibility

### Decision: Programmatic focus control with visibility state machine
Track component state (hidden, input-visible, response-visible) and manage focus accordingly.

### Rationale
- **Clear state transitions**: Prevents ambiguous UI states
- **Accessibility**: Proper focus management supports keyboard navigation
- **User expectations**: Focus follows content per FR-006
- **Predictable behavior**: State machine prevents race conditions

### State Machine
```
hidden → input-visible (Cmd-K pressed, focus input)
input-visible → response-visible (response starts, keep on input until complete)
response-visible → response-visible (response complete, focus response area)
response-visible → input-visible (click input, clear response)
any-state → hidden (Esc/outside-click when no generation, clear both)
generating → generating (Esc cancels, returns to input-visible)
```

### Implementation Notes
- Use `visibility` style property, not `display` (maintains layout)
- Focus management via `element.focus()` after DOM updates
- Click-outside detection: `document.addEventListener('click')` with `contains()` check
- Esc key handler respects generation state (cancel vs hide)
- Input remains focusable when response visible (for FR-007 behavior)

---

## 8. Configuration API

### Decision: Attribute-based configuration with JavaScript property accessors
Support HTML attributes and JavaScript property setters for configuration.

### Rationale
- **Web Component standards**: Attributes are the native configuration mechanism
- **Developer-friendly**: Both declarative (HTML) and imperative (JS) APIs
- **Reactive updates**: `attributeChangedCallback` for live configuration changes
- **Type safety**: Property setters validate values before applying

### Configuration Parameters
```javascript
<chat-component
  model-url="/models/tinyllama-q8.onnx"
  embedding-url="/models/minilm-l6-q8.onnx"
  system-prompt="You are a helpful assistant."
  temperature="0.7"
  max-tokens="512"
></chat-component>

// Or via JavaScript:
const chat = document.querySelector('chat-component');
chat.modelUrl = '/models/custom-model.onnx';
chat.temperature = 0.9;
```

### Default Values
- `modelUrl`: null (must be provided)
- `embeddingUrl`: null (optional, disables vector storage if not provided)
- `systemPrompt`: "You are a helpful AI assistant."
- `temperature`: 0.7
- `maxTokens`: 512
- `inferenceTimeout`: 30000 (30 seconds)

### Implementation Notes
- Document all parameters in README
- Validate ranges (temperature 0-2, maxTokens 1-2048)
- Use `observedAttributes` static getter for attribute observation
- Reload model if `modelUrl` changes (show loading indicator)
- Apply systemPrompt immediately to next inference

---

## 9. Testing Strategy

### Decision: Manual browser testing with comprehensive HTML test page
Create test.html with multiple scenarios and visual verification checklist.

### Rationale
- **POC scope**: Automated testing infrastructure would violate "no build step" principle
- **Visual validation**: UI interactions require human verification (focus, animations, streaming)
- **Cross-browser**: Manual testing in Chrome and Firefox per constitution
- **Fast iteration**: No test runner setup, just open file in browser

### Test Scenarios
1. **Basic activation**: Cmd-K/Ctrl-K shows component
2. **Prompt submission**: Text entry and generation flow
3. **Streaming display**: Tokens appear progressively
4. **Cancellation**: Esc during generation preserves prompt
5. **Error handling**: Retry button on simulated model failure
6. **Focus management**: Focus follows expected flow
7. **Storage**: Verify IndexedDB writes (browser DevTools)
8. **Keyboard conflicts**: Override page Cmd-K (if test page has one)
9. **Model loading**: Queue prompt during load with indicator
10. **Quota exceeded**: Simulate storage limit

### Test Page Structure
```html
<!DOCTYPE html>
<html>
<head>
  <title>Chat Component Test</title>
  <script type="module" src="./src/chat-component.js"></script>
</head>
<body>
  <h1>Chat Component Test Page</h1>

  <h2>Scenario 1: Basic Activation</h2>
  <p>Press Cmd-K (Mac) or Ctrl-K (Windows/Linux)</p>
  <chat-component
    model-url="./models/tinyllama-q8.onnx"
    embedding-url="./models/minilm-l6-q8.onnx">
  </chat-component>

  <!-- Additional scenarios... -->
</body>
</html>
```

### Manual Testing Checklist
- [ ] Component registers without errors
- [ ] Keyboard shortcut activates component
- [ ] Input receives focus on activation
- [ ] Model loads (check console for progress)
- [ ] Prompt submission triggers inference
- [ ] Tokens stream progressively
- [ ] Response is stored in IndexedDB
- [ ] Esc cancels generation
- [ ] Click outside hides component
- [ ] Error message displays on failure
- [ ] Retry button works

---

## 10. File Structure

### Decision: Flat structure with <5 files
Organize code into logical modules without deep nesting per constitutional guidelines.

### Rationale
- **POC simplicity**: Flat structure reduces cognitive overhead
- **No build step**: Direct ES6 module imports work without bundler
- **Easy navigation**: All code visible at root level
- **Constitutional compliance**: Meets <5 file guideline

### Proposed Structure
```
/
├── index.html              # Test page
├── src/
│   ├── chat-component.js   # Main Web Component definition
│   ├── model-manager.js    # ONNX model loading & inference
│   ├── storage-manager.js  # IndexedDB operations
│   └── styles.css          # Component styles (imported as template)
├── models/
│   ├── tinyllama-q8.onnx   # Quantized LLM (user downloads)
│   └── minilm-l6-q8.onnx   # Embedding model (user downloads)
└── README.md               # Setup instructions
```

**File Count**: 4 source files (within <5 limit)

### Module Dependencies
- `chat-component.js` imports `model-manager.js` and `storage-manager.js`
- `model-manager.js` depends on ONNX Runtime Web (CDN)
- `storage-manager.js` uses native IndexedDB API
- No circular dependencies

---

## Summary of Technology Decisions

| Area | Technology | Rationale |
|------|------------|-----------|
| Component Architecture | Custom Elements v1 + Shadow DOM | Native API, true encapsulation, wide support |
| LLM Inference | ONNX Runtime Web + WASM | Production-ready, client-side, quantization support |
| Model | TinyLlama 1.1B int8 (~550MB) | Fast iteration, meets <2s first token target |
| Embeddings | all-MiniLM-L6-v2 quantized (~23MB) | Small, fast, good semantic search performance |
| Keyboard Handling | Global keydown with preventDefault | Global activation, precedence control |
| Streaming | Async generator + progressive DOM | Perceived performance, cancellable |
| Storage | IndexedDB + Float32Array | Native, offline, binary support |
| Error Handling | UI display + manual retry | User control, transparency |
| Focus Management | State machine | Predictable, accessible |
| Configuration | Attributes + property accessors | Standards-compliant, developer-friendly |
| Testing | Manual HTML test page | POC-appropriate, cross-browser |
| File Structure | Flat with 4 source files | Simple, meets <5 file limit |

---

## Open Questions Resolved
All technical unknowns from the specification have been resolved through this research phase. No remaining NEEDS CLARIFICATION items exist.

**Phase 0 Complete**: Ready to proceed to Phase 1 (Design & Contracts).
