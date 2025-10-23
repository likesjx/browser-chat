# Data Model: Web Worker Communication

**Feature**: Move Model Inference to Web Worker
**Date**: 2025-10-23

## Overview

This feature introduces message-based communication between the main thread and a Web Worker. The data model defines the structure of messages passed via `postMessage` and the state machines governing worker and request lifecycles.

## Entities

### 1. WorkerMessage (Base)

All messages exchanged between threads follow this structure:

```javascript
{
  type: string,        // Message type identifier
  data: object | null  // Message payload (type-specific)
}
```

**Validation Rules**:
- `type` must be non-empty string
- `data` may be null for control messages (e.g., 'cancel', 'dispose')
- Unknown `type` values should be logged and ignored (forward compatibility)

### 2. LoadModelRequest (Main → Worker)

Request to load and initialize an AI model.

```javascript
{
  type: 'load-llm' | 'load-embedding',
  data: {
    modelUrl: string,  // HuggingFace model ID or local path
    config: {           // Optional: LLM inference config (for load-llm only)
      systemPrompt: string,
      temperature: number,      // 0.0-2.0
      maxTokens: number,         // 1-2048
      inferenceTimeout: number  // milliseconds
    }
  }
}
```

**Validation Rules**:
- `modelUrl` must be non-empty string
- `config` fields validated per existing ModelManager rules
- Only `load-llm` includes `config` (embedding model ignores it)

**State Transitions**:
- `idle` → `loading` (on receipt)
- `loading` → `loaded` (on success)
- `loading` → `error` (on failure)

### 3. LoadProgressUpdate (Worker → Main)

Progress notification during model download.

```javascript
{
  type: 'load-progress',
  data: {
    progress: number,      // 0-100 (percentage)
    modelType: 'llm' | 'embedding'
  }
}
```

**Validation Rules**:
- `progress` must be 0-100 inclusive
- Sent periodically during download (transformers.js progress callback)

### 4. LoadComplete (Worker → Main)

Notification that model loading completed successfully.

```javascript
{
  type: 'load-complete',
  data: {
    modelType: 'llm' | 'embedding',
    loadTime: number  // milliseconds
  }
}
```

**State Transitions**:
- Worker: `loading` → `loaded`
- Manager: Mark model as ready, process queued requests

### 5. LoadError (Worker → Main)

Notification that model loading failed.

```javascript
{
  type: 'load-error',
  data: {
    error: string,               // Error message
    modelType: 'llm' | 'embedding',
    errorCategory: 'network' | 'oom' | 'format' | 'unknown'
  }
}
```

**Error Categories** (from research.md):
- `network`: 404, fetch failures, CORS errors
- `oom`: Out of memory errors
- `format`: Invalid ONNX format
- `unknown`: Other errors

**State Transitions**:
- Worker: `loading` → `error`
- Manager: Show error to user, allow retry

### 6. GenerateRequest (Main → Worker)

Request to generate text from a prompt.

```javascript
{
  type: 'generate',
  data: {
    prompt: string,
    config: {
      temperature: number,
      maxTokens: number,
      systemPrompt: string,
      inferenceTimeout: number
    }
  }
}
```

**Validation Rules**:
- `prompt` must be non-empty, max 10,000 characters
- `config` validated per existing ModelManager rules
- Rejected if model not loaded (`load-error` sent)

**State Transitions**:
- Worker: `idle` → `generating`
- Manager: Queue if busy, otherwise send immediately

### 7. TokenResponse (Worker → Main)

Streaming token during generation.

```javascript
{
  type: 'token',
  data: {
    token: string,      // Word or token text
    tokenIndex: number  // 0-based index
  }
}
```

**Validation Rules**:
- Sent sequentially (tokenIndex increments)
- `token` may include trailing space for word-level streaming
- Sent after 30ms delay per token (streaming simulation)

### 8. GenerationComplete (Worker → Main)

Notification that generation finished.

```javascript
{
  type: 'generation-complete',
  data: {
    fullResponse: string,  // Complete generated text
    tokenCount: number,
    duration: number       // milliseconds
  }
}
```

**State Transitions**:
- Worker: `generating` → `idle`
- Manager: Process next queued request if any

### 9. GenerationError (Worker → Main)

Notification that generation failed.

```javascript
{
  type: 'generation-error',
  data: {
    error: string,
    errorType: 'inference-timeout' | 'inference-error' | 'cancelled'
  }
}
```

**State Transitions**:
- Worker: `generating` → `idle`
- Manager: Show error, allow retry

### 10. CancelRequest (Main → Worker)

Request to cancel ongoing generation.

```javascript
{
  type: 'cancel',
  data: null
}
```

**Behavior**:
- Worker aborts current generation via AbortController
- Sends `generation-complete` with partial response
- `tokenCount` reflects tokens generated before cancellation

**State Transitions**:
- Worker: `generating` → `idle`

### 11. EmbedRequest (Main → Worker)

Request to generate text embedding.

```javascript
{
  type: 'embed',
  data: {
    text: string  // Text to embed
  }
}
```

**Validation Rules**:
- `text` must be non-empty
- Rejected if embedding model not loaded

### 12. EmbeddingResult (Worker → Main)

Embedding vector result.

```javascript
{
  type: 'embedding-result',
  data: {
    embedding: Float32Array  // 384 or 768 dimensions (model-dependent)
  }
}
```

**Serialization**:
- Float32Array transferred via Transferable objects (zero-copy)
- Reduces message passing overhead for large arrays

### 13. DisposeRequest (Main → Worker)

Request to clean up resources and prepare for termination.

```javascript
{
  type: 'dispose',
  data: null
}
```

**Behavior**:
- Worker calls `pipeline.dispose()` for all loaded models
- Frees WASM memory
- Worker terminates after sending acknowledgment (optional)

**State Transitions**:
- Worker: (any state) → `disposed`
- Manager: Terminates worker after dispose completes

## State Machines

### Worker State Machine

```
┌──────────────────────────────────────────────┐
│               WORKER STATES                  │
├──────────────────────────────────────────────┤
│                                              │
│  idle ──load-llm──▶ loading-llm             │
│    │                    │                    │
│    │                    ▼                    │
│    │                loaded-llm               │
│    │                    │                    │
│    ├──load-embedding──▶ loading-embedding   │
│    │                    │                    │
│    │                    ▼                    │
│    │                loaded-embedding         │
│    │                    │                    │
│    └──generate──▶ generating                │
│         ▲              │                     │
│         └──complete────┘                     │
│                                              │
│  (any) ──dispose──▶ disposed                │
│                                              │
└──────────────────────────────────────────────┘
```

**Allowed Transitions**:
- `idle` → `loading-llm`, `loading-embedding`, `generating` (if model loaded)
- `loading-*` → `loaded-*`, `error`
- `generating` → `idle` (complete or cancel)
- (any) → `disposed`

**Concurrent State**:
- LLM and embedding can be loading/loaded independently
- Generation requires LLM loaded
- Only one generation at a time (ONNX limitation)

### Manager Request Queue State

```
┌──────────────────────────────────────────────┐
│            REQUEST QUEUE STATES              │
├──────────────────────────────────────────────┤
│                                              │
│  empty ──submit──▶ processing                │
│    ▲                  │                      │
│    └──complete────────┘                      │
│                                              │
│  empty ──submit──▶ queued ──process──▶ empty│
│    │                 │                       │
│    └──(concurrent)───┘                       │
│                                              │
└──────────────────────────────────────────────┘
```

**Queue Behavior**:
- New request + idle worker → send immediately
- New request + busy worker → append to queue
- Generation complete → process next in queue
- Cancel → only affects current request (queue preserved)

## Relationships

### Main Thread ← postMessage → Worker

```
WorkerManager (Main Thread)
    ↓ LoadModelRequest
Worker (model-worker.js)
    ↓ LoadProgressUpdate (multiple)
    ↓ LoadComplete
Main Thread
    ↓ GenerateRequest
Worker
    ↓ TokenResponse (multiple)
    ↓ GenerationComplete
```

### Integration with Existing Entities

**No Changes to Existing Data Models**:
- `ConversationPair` (storage-manager.js): Unchanged
- Component state (chat-component.js): Unchanged
- IndexedDB schema: Unchanged

**WorkerManager mirrors ModelManager API**:
- Same method signatures
- Same return types (Promises, AsyncGenerators)
- Same error types
- Same configuration structure

## Validation Summary

All message validation occurs at:
1. **Worker entry point**: Validate incoming message structure
2. **Manager API**: Validate arguments before sending to worker
3. **Type checking**: Runtime checks for message.type
4. **Serialization**: Float32Array via Transferable, strings auto-serialized

## Performance Characteristics

**Message Overhead**:
- Small messages (<1KB): <1ms serialization
- TypedArrays: Zero-copy via Transferables
- Strings: Structured clone (fast for typical prompt lengths)

**Queue Memory**:
- Each queued request: ~1KB (prompt + config)
- Max expected queue depth: 5-10 requests (user typing speed)
- Total memory: <10KB (negligible)

## Error Recovery

**Load Errors**:
- Retry allowed (send new LoadModelRequest)
- Error state cleared on successful load

**Generation Errors**:
- Retry preserves prompt (user can re-submit)
- Timeout errors allow config adjustment

**Worker Crash**:
- Manager detects termination (onerror event)
- Auto-restart worker once
- Show error if restart fails
- Queued requests lost (acceptable for POC)

---

**Dependencies**: research.md (message protocol design)
**Referenced By**: contracts/*.contract.js
