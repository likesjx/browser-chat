# Data Model: Interactive Chat Web Component

**Feature**: 001-create-a-web
**Date**: 2025-10-01
**Phase**: 1 - Data Model Design

## Overview
This document defines the data structures for storing conversation history, managing component state, and handling model configuration.

---

## Entity 1: ConversationPair

**Purpose**: Persistent storage unit representing a single user-assistant interaction with searchable embedding.

### Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | number | Yes | Unique identifier (timestamp in ms) | > 0, unique |
| `prompt` | string | Yes | User's input text | 1-10000 chars |
| `response` | string | Yes | Model-generated response | 1-100000 chars |
| `embedding` | Float32Array | No | Vector representation for semantic search | 384 dimensions |
| `modelVersion` | string | Yes | Model identifier for traceability | non-empty |
| `timestamp` | Date | Yes | Creation time | valid Date object |

### Relationships
- No direct relationships (flat structure)
- Chronologically ordered by `id` (timestamp)
- Optional embedding enables future vector similarity search

### Storage
- **Location**: IndexedDB database `chat-component-db`, object store `conversations`
- **Key**: `id` (auto-incrementing timestamp)
- **Indexes**: `timestamp` for chronological queries
- **Lifecycle**: Persists until manual clear or quota exceeded

### State Transitions
```
[Created] → prompt submitted, response generated
[Stored] → written to IndexedDB after response complete
[Retrieved] → loaded for history display or vector search (future)
[Deleted] → user clears history or quota management
```

### Validation Rules
1. `prompt` must be non-empty after trim
2. `response` must be non-empty after trim
3. `embedding` if present must have exactly 384 elements (all-MiniLM-L6-v2 dimensionality)
4. `modelVersion` format: `{modelName}-{quantization}` (e.g., "tinyllama-q8")
5. `timestamp` must not be in the future

### Example
```javascript
{
  id: 1696118400000,
  prompt: "What is a Web Component?",
  response: "A Web Component is a set of web platform APIs that allow you to create custom, reusable, encapsulated HTML tags...",
  embedding: Float32Array(384) [0.023, -0.145, 0.089, ...],
  modelVersion: "tinyllama-q8",
  timestamp: new Date("2025-10-01T12:00:00Z")
}
```

---

## Entity 2: ChatSession

**Purpose**: Temporary runtime state tracking current user interaction within the component.

### Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `state` | enum | Yes | Current component visibility/interaction state | One of: hidden, input-visible, generating, response-visible |
| `currentPrompt` | string | No | Text in input box (may be unsaved) | 0-10000 chars |
| `currentResponse` | string | No | Partial or complete response | 0-100000 chars |
| `isGenerating` | boolean | Yes | Whether inference is active | boolean |
| `generationAborted` | boolean | Yes | Whether user cancelled generation | boolean |
| `errorMessage` | string | No | Current error to display | 0-1000 chars |
| `focusedElement` | enum | Yes | Which element should have focus | One of: input, response, none |

### Relationships
- Ephemeral state, not persisted
- Drives UI rendering and behavior
- Resets on component hide/show cycle

### Lifecycle
```
[Created] → Component connected to DOM
[Active] → User interactions update state
[Reset] → Component hidden or generation complete
[Destroyed] → Component disconnected from DOM
```

### State Machine Transitions
```
hidden
  ↓ (Cmd-K pressed)
input-visible (focus: input, currentPrompt may exist)
  ↓ (prompt submitted)
generating (isGenerating: true, streaming to currentResponse)
  ↓ (Esc pressed)
  → input-visible (generationAborted: true, currentPrompt preserved)
  ↓ (generation complete)
response-visible (focus: response, isGenerating: false)
  ↓ (click input)
input-visible (currentResponse cleared)
  ↓ (Esc pressed)
hidden (all state cleared)
```

### Validation Rules
1. `state` must be one of valid enum values
2. If `isGenerating` is true, `state` must be "generating"
3. If `state` is "generating", `currentPrompt` must be non-empty
4. If `state` is "response-visible", `currentResponse` must be non-empty
5. `errorMessage` if set, `state` should be "response-visible" to display error

### Example
```javascript
// Active generation state
{
  state: 'generating',
  currentPrompt: 'Explain async/await in JavaScript',
  currentResponse: 'Async/await is syntactic sugar for working with Promises...',
  isGenerating: true,
  generationAborted: false,
  errorMessage: null,
  focusedElement: 'input'
}

// Error state
{
  state: 'response-visible',
  currentPrompt: 'What is the meaning of life?',
  currentResponse: '',
  isGenerating: false,
  generationAborted: false,
  errorMessage: 'Model inference timeout after 30s. Click retry.',
  focusedElement: 'response'
}
```

---

## Entity 3: ComponentConfiguration

**Purpose**: User-configurable settings controlling model behavior and component features.

### Fields

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `modelUrl` | string | Yes | null | URL/path to ONNX model file | Valid URL or path |
| `embeddingUrl` | string | No | null | URL/path to embedding model | Valid URL or path |
| `systemPrompt` | string | No | "You are a helpful AI assistant." | Prepended to all prompts | 0-1000 chars |
| `temperature` | number | No | 0.7 | Sampling temperature (creativity) | 0.0 - 2.0 |
| `maxTokens` | number | No | 512 | Maximum generation length | 1 - 2048 |
| `inferenceTimeout` | number | No | 30000 | Generation timeout in milliseconds | 1000 - 120000 |

### Relationships
- Read by model-manager during inference
- Set via Web Component attributes or JavaScript properties
- Changes trigger re-initialization if `modelUrl` modified

### Lifecycle
```
[Initialized] → Component created with defaults
[Updated] → User sets attributes or properties
[Applied] → Next inference uses new values
```

### Validation Rules
1. `modelUrl` must be provided before first inference (required)
2. `temperature` must be in range [0.0, 2.0]
3. `maxTokens` must be in range [1, 2048]
4. `inferenceTimeout` must be in range [1000, 120000] (1s - 2min)
5. `systemPrompt` if provided, must not contain control characters
6. URLs must use http://, https://, or relative paths (no file:// for security)

### Example
```javascript
{
  modelUrl: '/models/tinyllama-q8.onnx',
  embeddingUrl: '/models/minilm-l6-q8.onnx',
  systemPrompt: 'You are a helpful coding assistant specializing in JavaScript.',
  temperature: 0.8,
  maxTokens: 512,
  inferenceTimeout: 30000
}
```

---

## Entity 4: ModelState

**Purpose**: Runtime state of loaded ONNX models and inference session.

### Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `llmSession` | InferenceSession | No | ONNX Runtime session for main model | Valid session or null |
| `embeddingSession` | InferenceSession | No | ONNX Runtime session for embeddings | Valid session or null |
| `isLlmLoaded` | boolean | Yes | Whether main model is ready | boolean |
| `isEmbeddingLoaded` | boolean | Yes | Whether embedding model is ready | boolean |
| `loadProgress` | number | No | Loading progress percentage | 0 - 100 |
| `loadError` | Error | No | Model loading failure | Error object or null |
| `queuedPrompts` | Array<string> | Yes | Prompts waiting for model load | Array of strings |

### Relationships
- Initialized by model-manager
- Referenced by chat-component for state checks
- Drives loading indicator display

### Lifecycle
```
[Unloaded] → Component created, models not loaded
[Loading] → Model download/parsing in progress (loadProgress updates)
[Loaded] → Sessions ready (isLlmLoaded: true)
[Error] → Load failed (loadError set)
[Unloaded] → Model URL changed, sessions disposed
```

### State Transitions
```
Unloaded
  ↓ (modelUrl set)
Loading (loadProgress: 0-100)
  ↓ (load success)
Loaded (llmSession valid, queuedPrompts processed)
  ↓ (load failure)
Error (loadError set, queuedPrompts rejected)
```

### Validation Rules
1. `llmSession` and `embeddingSession` must be valid ONNX Runtime InferenceSession objects or null
2. `loadProgress` if set, must be 0-100
3. `queuedPrompts` must be array (empty or with strings)
4. If `isLlmLoaded` is false, `llmSession` must be null
5. If `loadError` is set, both `isLlmLoaded` and `isEmbeddingLoaded` should be false

### Example
```javascript
// Loading state
{
  llmSession: null,
  embeddingSession: null,
  isLlmLoaded: false,
  isEmbeddingLoaded: false,
  loadProgress: 67,
  loadError: null,
  queuedPrompts: ['Tell me a joke', 'Explain promises']
}

// Loaded state
{
  llmSession: InferenceSession {...},
  embeddingSession: InferenceSession {...},
  isLlmLoaded: true,
  isEmbeddingLoaded: true,
  loadProgress: 100,
  loadError: null,
  queuedPrompts: []
}

// Error state
{
  llmSession: null,
  embeddingSession: null,
  isLlmLoaded: false,
  isEmbeddingLoaded: false,
  loadProgress: 0,
  loadError: Error('Failed to fetch model: 404 Not Found'),
  queuedPrompts: []
}
```

---

## Storage Schema

### IndexedDB Structure
```javascript
Database: "chat-component-db"
Version: 1

ObjectStore: "conversations"
  - keyPath: "id"
  - autoIncrement: false (timestamp used as ID)
  - Indexes:
    * "timestamp" → timestamp field (for chronological queries)
    * No index on embedding (vector search done in-memory if needed)
```

### IndexedDB Operations
```javascript
// Create/Update (after response complete)
await db.conversations.add({
  id: Date.now(),
  prompt: userPrompt,
  response: modelResponse,
  embedding: embeddingVector,
  modelVersion: 'tinyllama-q8',
  timestamp: new Date()
});

// Read (chronological order)
const recent = await db.conversations
  .index('timestamp')
  .getAll(IDBKeyRange.upperBound(Date.now()), 10); // Last 10

// Delete (clear history)
await db.conversations.clear();

// Count (check storage usage)
const count = await db.conversations.count();
```

---

## Data Flow Diagram

```
User Input (keydown Cmd-K)
  ↓
ChatSession.state = 'input-visible'
  ↓
User types prompt → ChatSession.currentPrompt
  ↓
User submits (Enter)
  ↓
ChatSession.state = 'generating'
  ↓
ModelState check → isLlmLoaded?
  No → queue prompt, show loading indicator
  Yes → start inference
  ↓
Stream tokens → ChatSession.currentResponse (progressive update)
  ↓
Generation complete
  ↓
ChatSession.state = 'response-visible'
  ↓
Generate embedding (ModelState.embeddingSession)
  ↓
Save ConversationPair to IndexedDB
  ↓
User action:
  - Click input → clear response, state = 'input-visible'
  - Click outside / Esc → state = 'hidden'
  - Esc during generation → abort, preserve prompt
```

---

## Validation Summary

### Input Validation (User-facing)
- Prompt length: 1-10000 characters
- Response length: 1-100000 characters (truncate if exceeded)
- Temperature: 0.0-2.0 (clamp if outside range)
- Max tokens: 1-2048 (clamp if outside range)

### Internal Validation (Data integrity)
- Timestamp must be valid Date
- Embedding dimensions must be 384 (if present)
- Model version must be non-empty string
- State transitions follow defined state machine
- No null/undefined for required fields

### Storage Constraints
- IndexedDB quota: browser-dependent (usually 50-100MB+)
- Handle QuotaExceededError gracefully per FR-017
- No automatic cleanup (user-initiated clear only)

---

## Performance Considerations

### Memory
- Each ConversationPair: ~2KB + embedding (384 floats * 4 bytes = 1.5KB) ≈ 3.5KB
- 10 conversation history: ~35KB (well within limits)
- 100 conversation history: ~350KB (acceptable)
- Model in memory: 550MB (TinyLlama-q8) + 23MB (embedding) = 573MB

### IndexedDB Write Performance
- Async writes don't block UI
- Batch writes if generating multiple embeddings (future optimization)
- Index on timestamp is efficient for recency queries

### State Management
- ChatSession is in-memory only (fast access)
- No serialization overhead for ephemeral state
- ConversationPair only written after complete response

---

**Phase 1 Data Model Complete**: Entities defined with validation rules, relationships, and storage schema.
