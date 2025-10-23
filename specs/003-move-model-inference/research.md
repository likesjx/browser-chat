# Research: Web Worker Architecture for ONNX Runtime

**Feature**: Move Model Inference to Web Worker
**Date**: 2025-10-23
**Status**: Complete

## Research Questions

### 1. Web Worker Best Practices for Transformers.js (2025)

**Decision**: Use Singleton pattern with message-based communication

**Rationale**:
- Transformers.js doesn't support simultaneous sessions (documented limitation)
- Singleton ensures single pipeline instance per worker
- Message-based protocol provides clean separation between UI and inference
- Industry standard pattern from HuggingFace examples

**Alternatives Considered**:
- **Multiple worker instances**: Rejected - unnecessary overhead, ONNX can't run concurrent sessions
- **Inline worker (Blob)**: Rejected - harder to debug, prefer external file per user requirements
- **SharedWorker**: Rejected - overkill for single-component use case

**Source**:
- HuggingFace transformers.js examples (2025)
- ONNX Runtime Web documentation
- Web search research on transformers.js + workers

### 2. ONNX Runtime Threading Configuration

**Decision**: Set `env.backends.onnx.wasm.numThreads = 1` if multithreading issues occur

**Rationale**:
- Known bug in onnxruntime-web with internal multithreading
- Web Worker provides process-level parallelism (sufficient)
- Setting numThreads=1 prevents Worker-internal thread conflicts
- Performance impact minimal when Worker already isolates inference

**Alternatives Considered**:
- **Leave default threading**: May work in 2025 builds, test first
- **WebGPU execution provider**: Future enhancement, requires Chrome 113+

**Source**:
- onnxruntime-web GitHub issues
- Transformers.js documentation on backend configuration

### 3. Streaming Token Simulation

**Decision**: Generate full text in worker, stream via postMessage with delays

**Rationale**:
- Transformers.js doesn't support true streaming (returns complete text)
- Current implementation already simulates streaming (word-by-word)
- Move simulation logic to worker to unblock main thread during "streaming"
- 30ms delay per token maintains natural feel (current implementation value)

**Alternatives Considered**:
- **True streaming via callback_function**: Not supported by transformers.js
- **Chunked generation**: Not possible with current ONNX models
- **No delays**: Would appear instant, unrealistic for LLM

**Source**:
- Current model-manager.js implementation (lines 196-216)
- Transformers.js API documentation

### 4. Message Protocol Design

**Decision**: Type-based message protocol with structured payloads

**Rationale**:
- Clear separation of concerns (load, generate, embed, cancel, dispose)
- Type field enables switch-based routing in worker
- Structured payloads match existing ModelManager API
- Error messages include type categorization (network, OOM, timeout)

**Message Types**:
```javascript
// Incoming (Main → Worker)
{ type: 'load-llm', data: { modelUrl, config } }
{ type: 'load-embedding', data: { modelUrl } }
{ type: 'generate', data: { prompt, config } }
{ type: 'embed', data: { text } }
{ type: 'cancel' }
{ type: 'dispose' }

// Outgoing (Worker → Main)
{ type: 'load-progress', data: { progress, modelType } }
{ type: 'load-complete', data: { modelType, loadTime } }
{ type: 'load-error', data: { error, modelType } }
{ type: 'token', data: { token, tokenIndex } }
{ type: 'generation-complete', data: { fullResponse, tokenCount, duration } }
{ type: 'generation-error', data: { error } }
{ type: 'embedding-result', data: { embedding } }
```

**Alternatives Considered**:
- **RPC-style with IDs**: Overkill for sequential operations
- **Channel-based (MessageChannel)**: Unnecessary complexity
- **Promise-based (Comlink)**: Adds dependency, violates vanilla-first

### 5. Request Queue Management

**Decision**: Implement FIFO queue in worker-manager, reject concurrent generations

**Rationale**:
- User requirement: queue prompts sequentially
- ONNX limitation: no concurrent sessions
- Simple queue ensures predictable behavior
- Worker-manager handles queueing (keeps worker simple)

**Queue Behavior**:
- New request while idle: Send immediately
- New request while busy: Queue in worker-manager
- Process queue on generation-complete
- Cancel clears current only (not queue)

**Alternatives Considered**:
- **Queue in worker**: Violates separation of concerns
- **Reject new requests**: Poor UX, user specified queueing

### 6. Error Handling Strategy

**Decision**: Categorize errors, maintain worker stability, propagate to main thread

**Error Categories**:
- Network errors (model download failures)
- OOM errors (insufficient memory)
- Timeout errors (inference exceeds limit)
- Format errors (invalid model)
- Cancellation (user-initiated)

**Rationale**:
- Existing model-manager.js has error categorization (lines 123-133)
- Worker must not crash on errors (affects all future requests)
- Main thread displays errors to user (worker just reports)
- Structured error messages enable smart retry logic

**Alternatives Considered**:
- **Generic error messages**: Harder to debug and handle
- **Worker restart on error**: Loses loaded model, poor UX

### 7. Memory Management

**Decision**: Explicit dispose() call, worker persists until component unmounts

**Rationale**:
- Worker memory separate from main thread (expected)
- Models persist in worker (avoid reload on each request)
- Dispose when component disconnects (lifecycle hook)
- Browser garbage collects worker on page unload

**Alternatives Considered**:
- **Dispose after each request**: Wasteful, requires reload
- **Shared worker across pages**: Overkill for POC scope

### 8. Worker Lifecycle

**Decision**: Create worker on component mount, reuse for all requests, dispose on unmount

**Lifecycle**:
1. **connectedCallback**: Create worker, attach listeners
2. **First load**: Send load-llm message, wait for complete
3. **Requests**: Send generate messages, stream tokens back
4. **disconnectedCallback**: Send dispose message, terminate worker

**Error Recovery**:
- Worker unexpected termination: Auto-restart once, show error if fails again
- Model load failure: Show error, allow retry
- Generation failure: Show error, preserve prompt for retry

**Rationale**:
- Mirrors existing ModelManager lifecycle
- Single worker instance reduces overhead
- Auto-restart handles rare worker crashes
- Aligns with Web Component lifecycle

**Alternatives Considered**:
- **Lazy worker creation**: Delays first interaction
- **Worker pool**: Unnecessary (sequential operations only)

## Technical Specifications Derived from Research

### Worker Interface (model-worker.js)
- Import transformers.js via ESM CDN
- Singleton pipeline pattern (one instance per model type)
- Message handler with type-based switch
- Progress callbacks via postMessage
- AbortController for cancellation support

### Manager Interface (worker-manager.js)
- Promise-based API matching current ModelManager
- AsyncGenerator for token streaming
- Request queue (FIFO)
- Worker lifecycle management
- Error categorization and propagation

### Integration Points (chat-component.js)
- Replace: `import { modelManager }` → `import { workerManager }`
- API unchanged: All method signatures identical
- Events unchanged: Same CustomEvents dispatched
- State unchanged: Same component state machine

## Performance Expectations

### Measured (from research):
- postMessage latency: <1ms for strings, <5ms for TypedArrays
- Worker creation overhead: ~10ms one-time cost
- First token latency: +<5ms (worker message overhead)

### Targets (from spec):
- UI responsiveness: <100ms (guaranteed by worker isolation)
- Keyboard shortcuts: <50ms (main thread never blocked)
- Message passing: <5ms (measured above)

## Implementation Dependencies

### No New Dependencies Required:
- Web Workers: Native browser API
- Transformers.js: Already imported (v3.7.3)
- ONNX Runtime Web: Via transformers.js (no direct import)

### Browser Support Verified:
- All target browsers support Web Workers and ES6 module workers
- No polyfills needed
- No feature detection required (fail early if unsupported)

## Migration Risk Assessment

### Low Risk:
- API-compatible replacement (drop-in for chat-component.js)
- Existing error handling patterns preserved
- No data model changes
- No storage changes

### Medium Risk:
- Message serialization overhead (mitigated by small payloads)
- Debugging complexity (mitigated by external worker file)
- Worker crash handling (mitigated by auto-restart)

### Mitigations:
- Comprehensive error messages with context
- Logging in both worker and main thread
- Manual testing in all target browsers
- Preserve old model-manager.js in git history

## Open Questions: RESOLVED

~~1. Keep model-manager.js as fallback?~~ → NO (user decision)
~~2. Queue prompts or reject?~~ → QUEUE (user decision)
~~3. External worker file?~~ → YES (user decision)
~~4. Streaming delay between tokens?~~ → 30ms (current value)
~~5. Worker crash recovery?~~ → Auto-restart once

## References

- [Transformers.js Web Worker Example](https://github.com/huggingface/transformers.js/blob/main/examples/code-completion/src/worker.js)
- [ONNX Runtime Web Best Practices](https://onnxruntime.ai/docs/tutorials/web/)
- [Web Workers MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- Current codebase: `src/model-manager.js`, `src/chat-component.js`
- Existing design doc: `docs/architecture/web-worker-design.md`
