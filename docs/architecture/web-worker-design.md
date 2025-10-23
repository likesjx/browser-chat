# Web Worker Architecture Design

## Overview

This document outlines the design for moving ONNX Runtime model inference from the main thread to a dedicated Web Worker, ensuring the UI remains responsive during model loading and inference operations.

## Current Architecture (Before)

```
┌─────────────────────────────────────────────────────────────┐
│                       Main Thread                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ chat-component.js│────────▶│ model-manager.js │          │
│  │  (UI Logic)      │         │  (Transformers.js)│          │
│  │                  │◀────────│  (ONNX Runtime)  │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
│  ⚠️  BLOCKS UI during model loading and inference            │
└─────────────────────────────────────────────────────────────┘
```

**Problems:**
- Model loading (570MB download) blocks the UI thread
- Inference operations freeze the browser
- Poor user experience during generation

## New Architecture (After)

```
┌─────────────────────────────────────────────────────────────┐
│                       Main Thread                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ chat-component.js│────────▶│ worker-manager.js│          │
│  │  (UI Logic)      │         │  (Communication) │          │
│  │                  │◀────────│                  │          │
│  └──────────────────┘         └─────────┬────────┘          │
│                                          │                   │
│                                          │ postMessage       │
│                                          │                   │
└──────────────────────────────────────────┼───────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Web Worker Thread                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ model-worker.js  │────────▶│ Transformers.js  │          │
│  │  (Message Handler)│        │  ONNX Runtime    │          │
│  │                  │◀────────│  Pipeline API    │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
│  ✅  Non-blocking, dedicated inference thread                │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- UI remains responsive during all operations
- Model loading happens in background
- Streaming token generation doesn't block UI
- Better separation of concerns

## Component Responsibilities

### 1. `model-worker.js` (New - Web Worker)

**Purpose:** Execute model operations in a separate thread

**Responsibilities:**
- Load Transformers.js library
- Initialize ONNX Runtime pipelines (LLM + embedding)
- Handle inference requests
- Stream tokens back to main thread
- Manage model lifecycle (load, dispose)

**Message Types (Incoming):**
```javascript
{
  type: 'load-llm',
  data: { modelUrl, config }
}

{
  type: 'load-embedding',
  data: { modelUrl }
}

{
  type: 'generate',
  data: { prompt, config }
}

{
  type: 'embed',
  data: { text }
}

{
  type: 'cancel'
}

{
  type: 'dispose'
}
```

**Message Types (Outgoing):**
```javascript
// Loading progress
{
  type: 'load-progress',
  data: { progress, modelType }
}

// Model loaded successfully
{
  type: 'load-complete',
  data: { modelType, loadTime }
}

// Loading error
{
  type: 'load-error',
  data: { error, modelType }
}

// Token streaming
{
  type: 'token',
  data: { token, tokenIndex }
}

// Generation complete
{
  type: 'generation-complete',
  data: { fullResponse, tokenCount, duration }
}

// Generation error
{
  type: 'generation-error',
  data: { error }
}

// Embedding result
{
  type: 'embedding-result',
  data: { embedding }
}
```

### 2. `worker-manager.js` (New - Main Thread)

**Purpose:** Provide clean API for main thread to communicate with worker

**Responsibilities:**
- Initialize and manage Web Worker instance
- Provide promise-based API wrapping postMessage
- Handle message routing and callbacks
- Implement async generator for token streaming
- Manage worker lifecycle

**Public API:**
```javascript
class WorkerManager {
  constructor()

  // Load models
  async loadLlmModel(modelUrl, config, onProgress)
  async loadEmbeddingModel(modelUrl)

  // Inference
  async* generateTokens(prompt, config)
  async generateEmbedding(text)

  // Control
  cancelGeneration()
  dispose()

  // State
  get isLlmLoaded()
  get isEmbeddingLoaded()
}
```

### 3. `chat-component.js` (Update)

**Changes Required:**
- Replace `import { modelManager }` with `import { workerManager }`
- Update all `modelManager.*` calls to `workerManager.*`
- No API changes needed (worker-manager mirrors model-manager API)

### 4. `model-manager.js` (Deprecate or Keep)

**Options:**
- **Option A:** Delete entirely (worker replaces all functionality)
- **Option B:** Keep as fallback for browsers without Worker support
- **Option C:** Rename to `model-manager.legacy.js` for reference

**Recommendation:** Option A - Delete (all modern browsers support Workers)

## Message Flow Examples

### Loading Model

```
Main Thread                Worker Thread
    │                           │
    ├─ load-llm ───────────────▶│
    │   { modelUrl, config }    │
    │                           ├─ Import Transformers.js
    │                           ├─ Create pipeline
    │◀── load-progress ─────────┤
    │   { progress: 25% }       │
    │◀── load-progress ─────────┤
    │   { progress: 50% }       │
    │◀── load-progress ─────────┤
    │   { progress: 100% }      │
    │◀── load-complete ─────────┤
    │   { modelType, loadTime } │
```

### Token Generation (Streaming)

```
Main Thread                Worker Thread
    │                           │
    ├─ generate ───────────────▶│
    │   { prompt, config }      │
    │                           ├─ Run inference
    │◀── token ─────────────────┤
    │   { token: "Hello" }      │
    │◀── token ─────────────────┤
    │   { token: " world" }     │
    │◀── token ─────────────────┤
    │   { token: "!" }          │
    │◀── generation-complete ───┤
    │   { fullResponse, ... }   │
```

### Cancellation

```
Main Thread                Worker Thread
    │                           │
    ├─ generate ───────────────▶│
    │   { prompt, config }      │
    │                           ├─ Run inference
    │◀── token ─────────────────┤
    │   { token: "Hello" }      │
    ├─ cancel ─────────────────▶│
    │                           ├─ AbortController.abort()
    │◀── generation-complete ───┤
    │   { partial response }    │
```

## Implementation Considerations

### 1. ONNX Runtime Threading

**Issue:** `onnxruntime-web` may have multithreading bugs

**Solution:**
```javascript
import { env } from '@xenova/transformers';

// Disable internal threading if needed
env.backends.onnx.wasm.numThreads = 1;
```

### 2. Session Management

**Issue:** Transformers.js doesn't support simultaneous sessions

**Solution:**
- Implement request queue in worker
- Process one inference at a time
- Return error if generation already in progress

### 3. Streaming Simulation

**Issue:** Transformers.js doesn't support true streaming (returns full text)

**Solution:**
- Generate full response in worker
- Split into words/tokens
- Send via postMessage with delays to simulate streaming
- Allow cancellation during "streaming" phase

### 4. Error Handling

**Strategy:**
- Catch all errors in worker
- Send structured error messages to main thread
- Include error type categorization (network, OOM, timeout, etc.)
- Maintain worker stability (don't crash on errors)

### 5. Memory Management

**Considerations:**
- Worker memory is separate from main thread
- Models stay loaded in worker memory
- Call `dispose()` to free memory when component unmounts
- Monitor total memory usage (models + runtime + cache)

### 6. CSP Compliance

**Worker Creation:**
```javascript
// Option 1: Inline worker (CSP-friendly)
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);
const worker = new Worker(workerUrl);

// Option 2: External file (requires script-src)
const worker = new Worker('./model-worker.js', { type: 'module' });
```

**Recommendation:** Option 2 for simplicity (ES modules already require CSP relaxation)

## Migration Plan

### Phase 1: Create Worker Infrastructure
1. Create `model-worker.js` with message handlers
2. Create `worker-manager.js` with Promise/Generator API
3. Add basic error handling and logging

### Phase 2: Update Chat Component
1. Update imports in `chat-component.js`
2. Replace `modelManager` calls with `workerManager`
3. Test all flows (load, generate, cancel, error)

### Phase 3: Testing & Refinement
1. Test in all target browsers
2. Verify UI remains responsive
3. Check memory usage
4. Optimize streaming delays

### Phase 4: Cleanup
1. Remove `model-manager.js`
2. Update documentation
3. Update README with worker architecture

## Performance Targets

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| UI Blocking (Load) | 5-10s | 0ms | Non-blocking load |
| UI Blocking (Inference) | 1-3s | 0ms | Non-blocking generation |
| First Token Latency | ~2s | ~2s | Same (worker overhead minimal) |
| Memory Overhead | 0MB | ~5-10MB | Worker thread overhead |
| Message Latency | 0ms | <5ms | postMessage is fast |

## Browser Compatibility

All target browsers support Web Workers:
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

ES6 module workers supported in:
- Chrome 80+
- Firefox 114+
- Safari 15+
- Edge 80+

**Note:** All our target browsers support module workers.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Worker overhead adds latency | Low | Measured <5ms for postMessage |
| Memory duplication | Medium | Worker memory is separate (expected) |
| Debugging complexity | Medium | Use DevTools worker debugging |
| ONNX threading issues | High | Disable internal threading if needed |
| Message serialization cost | Low | Only strings/typed arrays sent |

## Open Questions

1. **Keep model-manager.js as fallback?**
   - Recommendation: No - all browsers support workers

2. **Inline worker vs external file?**
   - Recommendation: External file (cleaner, easier to debug)

3. **Queue multiple prompts or reject?**
   - Recommendation: Queue (better UX)

4. **Streaming delay between tokens?**
   - Recommendation: 30ms (current value, feels natural)

5. **Handle worker crash/restart?**
   - Recommendation: Auto-restart worker on unexpected termination

## Next Steps

1. Review this design document
2. Get approval on architectural decisions
3. Proceed with implementation (Phase 1)

## References

- [Transformers.js Web Worker Example](https://github.com/huggingface/transformers.js/blob/main/examples/code-completion/src/worker.js)
- [Web Workers MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
