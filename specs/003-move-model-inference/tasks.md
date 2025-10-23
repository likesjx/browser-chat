# Tasks: Move Model Inference to Web Worker

**Input**: Design documents from `/specs/003-move-model-inference/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Tech stack: JavaScript ES6+, Web Workers, Transformers.js
   → Structure: Single project (src/ directory)
2. Load design documents ✅
   → data-model.md: 13 message types, state machines
   → contracts/: 2 contract files (worker, manager)
   → research.md: Singleton pattern, message protocol
   → quickstart.md: 10 test scenarios
3. Generate tasks by category ✅
   → Setup: No new dependencies (native APIs)
   → Tests: 2 contract test files
   → Core: model-worker.js, worker-manager.js
   → Integration: chat-component.js update
   → Polish: Manual tests, performance validation
4. Apply task rules ✅
   → worker-manager.js + model-worker.js = [P] (different files)
   → chat-component.js = sequential (depends on both)
5. Number tasks sequentially (T001, T002...) ✅
6. Validate completeness ✅
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All file paths are absolute from repository root

---

## Phase 3.1: Setup

No setup tasks required - using native browser APIs (Web Workers, ES6 modules).
Constitution requirement: No build step, no new dependencies.

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests

- [ ] **T001** [P] **Contract test: Worker message interface** in `specs/003-move-model-inference/contracts/worker-interface.contract.js`
  - **Purpose**: Verify worker accepts and responds to all message types correctly
  - **What to test**:
    - Load LLM model (load-llm message → load-progress + load-complete)
    - Load embedding model (load-embedding message → load-complete)
    - Generate text (generate message → token stream + generation-complete)
    - Generate embedding (embed message → embedding-result)
    - Cancel generation (cancel message → immediate stop)
    - Dispose resources (dispose message → cleanup)
    - Error handling (invalid messages, model not loaded, unknown types)
  - **Expected**: ALL tests FAIL (model-worker.js doesn't exist yet)
  - **File to create**: Worker will be at `src/model-worker.js`
  - **Dependencies**: None
  - **Reference**: data-model.md (message structures), research.md (singleton pattern)

- [ ] **T002** [P] **Contract test: WorkerManager API** in `specs/003-move-model-inference/contracts/manager-api.contract.js`
  - **Purpose**: Verify WorkerManager provides same API as ModelManager
  - **What to test**:
    - Constructor creates worker instance
    - loadLlmModel() returns Promise, calls onProgress callback
    - loadEmbeddingModel() returns Promise
    - generateTokens() returns AsyncGenerator, yields tokens
    - generateEmbedding() returns Promise<Float32Array>
    - cancelGeneration() stops ongoing generation
    - dispose() cleans up resources
    - Request queueing (sequential FIFO processing)
    - Error recovery (retry after failures, worker crash recovery)
    - API compatibility with ModelManager (same signatures)
  - **Expected**: ALL tests FAIL (worker-manager.js doesn't exist yet)
  - **File to create**: Manager will be at `src/worker-manager.js`
  - **Dependencies**: None
  - **Reference**: data-model.md (API contracts), current src/model-manager.js (API to match)

**TDD Gate**: ✋ DO NOT proceed to Phase 3.3 until T001-T002 are complete and ALL tests are FAILING

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Worker Implementation

- [x] **T003** [P] **Implement Web Worker: model-worker.js** at `src/model-worker.js`
  - **Purpose**: Create Web Worker that handles ONNX model operations
  - **What to implement**:
    - Import Transformers.js from CDN: `@huggingface/transformers@3.7.3`
    - Singleton pipeline pattern (one instance per model type)
    - Message handler with switch statement for message types:
      - `load-llm`: Load text-generation pipeline, send progress updates
      - `load-embedding`: Load feature-extraction pipeline
      - `generate`: Run inference, simulate streaming (30ms delay per token)
      - `embed`: Generate embedding, return Float32Array
      - `cancel`: Abort current generation via AbortController
      - `dispose`: Clean up pipelines, free memory
    - Error categorization: network, oom, format, unknown
    - State management: idle, loading, generating
    - Progress callbacks via postMessage
  - **Configuration**:
    - Set `env.backends.onnx.wasm.numThreads = 1` if threading issues occur
    - Use `dtype: 'fp16'`, `device: 'wasm'` for browser compatibility
  - **Dependencies**: None (can run parallel with T004)
  - **Reference**: research.md (singleton pattern, message protocol), data-model.md (message types)
  - **Pass criteria**: Contract tests in T001 now PASS

- [x] **T004** [P] **Implement WorkerManager: worker-manager.js** at `src/worker-manager.js`
  - **Purpose**: Create main-thread wrapper for worker communication
  - **What to implement**:
    - Constructor: Create worker instance from `./model-worker.js`
    - Promise-based API methods:
      - `loadLlmModel(modelUrl, config, onProgress)`: Send load-llm, wait for complete
      - `loadEmbeddingModel(modelUrl)`: Send load-embedding, wait for complete
      - `generateEmbedding(text)`: Send embed, return Float32Array
      - `cancelGeneration()`: Send cancel message
      - `dispose()`: Send dispose, terminate worker
    - AsyncGenerator for `generateTokens(prompt, config)`:
      - Send generate message
      - Yield tokens as they arrive via postMessage
      - Complete when generation-complete received
    - Request queue (FIFO):
      - Queue prompts if worker busy
      - Process sequentially (ONNX doesn't support concurrent sessions)
    - Error handling:
      - Propagate load errors with categories
      - Handle generation errors
      - Auto-restart worker on crash (once)
    - State properties:
      - `isLlmLoaded`: boolean
      - `isEmbeddingLoaded`: boolean
  - **API Compatibility**: Must match existing ModelManager exactly
  - **Dependencies**: None (can run parallel with T003)
  - **Reference**: research.md (queue management), data-model.md (API contracts), src/model-manager.js (API to match)
  - **Pass criteria**: Contract tests in T002 now PASS

### Integration

- [x] **T005** **Update chat component: chat-component.js** at `src/chat-component.js`
  - **Purpose**: Switch from ModelManager to WorkerManager
  - **What to change**:
    - Line 8: Replace `import { modelManager } from './model-manager.js'`
      with `import { workerManager } from './worker-manager.js'`
    - Replace all `modelManager.*` calls with `workerManager.*`:
      - Lines 127, 421, 562, 619, 677-687, 748 (7 locations total)
    - No other changes needed (API is identical)
  - **Dependencies**: BLOCKED by T003 and T004 (needs both files to exist)
  - **Reference**: src/chat-component.js (current implementation)
  - **Pass criteria**:
    - Component imports workerManager successfully
    - All method calls work (same API)
    - No TypeErrors or missing methods

### Cleanup

- [x] **T006** **Delete old implementation: model-manager.js** at `src/model-manager.js`
  - **Purpose**: Remove replaced implementation
  - **What to do**:
    - Delete `src/model-manager.js` (324 lines)
    - Verify no other files import it (grep for `model-manager`)
  - **Dependencies**: BLOCKED by T005 (chat-component must switch first)
  - **Reference**: User decision: delete, no fallback needed
  - **Pass criteria**:
    - File deleted
    - No broken imports remain
    - Git history preserves old implementation

---

## Phase 3.4: Integration Tests

No separate integration phase - contract tests cover integration (worker ↔ manager ↔ component).

---

## Phase 3.5: Manual Testing & Validation

### Manual Testing (from quickstart.md)

- [ ] **T007** [P] **Manual test: Non-blocking model load** (Scenario 1)
  - **Purpose**: Verify UI remains responsive during 570MB model download
  - **How to test**:
    1. Start local server: `python3 -m http.server 8000`
    2. Open `http://localhost:8000/index.html` in fresh tab
    3. Immediately scroll page, click buttons, type in inputs
  - **Pass criteria**:
    - ✅ Scrolling smooth throughout load
    - ✅ Buttons respond immediately
    - ✅ Input accepts keystrokes without delay
    - ✅ No "Page Unresponsive" warnings
  - **Dependencies**: BLOCKED by T005 (integration complete)
  - **Reference**: quickstart.md Scenario 1, spec.md FR-001

- [ ] **T008** [P] **Manual test: Activate during load** (Scenario 2)
  - **Purpose**: Verify chat activates instantly while model loads
  - **How to test**:
    1. Refresh page
    2. Immediately press Cmd-K/Ctrl-K
    3. Type prompt
  - **Pass criteria**:
    - ✅ Chat appears within 100ms
    - ✅ Input accepts typing immediately
    - ✅ Loading indicator visible
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 2, spec.md Acceptance #1

- [ ] **T009** [P] **Manual test: Responsive during generation** (Scenario 3)
  - **Purpose**: Verify page interactions work while AI generates
  - **How to test**:
    1. Submit prompt: "Write a long story"
    2. While generating: scroll, click, switch tabs, type in address bar
  - **Pass criteria**:
    - ✅ No lag or frame drops
    - ✅ Clicks respond <100ms
    - ✅ Tab switching smooth
    - ✅ Tokens continue streaming
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 3, spec.md FR-002, Acceptance #2

- [ ] **T010** [P] **Manual test: Immediate cancellation** (Scenario 4)
  - **Purpose**: Verify Esc key stops generation instantly
  - **How to test**:
    1. Start generation: "Very long story..."
    2. Wait for ~5 tokens
    3. Press Esc
  - **Pass criteria**:
    - ✅ Stops in <100ms
    - ✅ Partial text preserved
    - ✅ Input regains focus
    - ✅ No freeze
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 4, spec.md FR-004, Acceptance #3

- [ ] **T011** [P] **Manual test: Typing during generation** (Scenario 5)
  - **Purpose**: Verify keyboard input works during streaming
  - **How to test**:
    1. Start generation
    2. Press Cmd-K while streaming
    3. Type new prompt
  - **Pass criteria**:
    - ✅ Input appears <50ms
    - ✅ All characters appear
    - ✅ No dropped keys
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 5, spec.md FR-003, Acceptance #4

- [ ] **T012** [P] **Manual test: Multiple rapid prompts** (Scenario 6)
  - **Purpose**: Verify prompt queueing works
  - **How to test**:
    1. Submit "First prompt" → Enter
    2. Immediately submit "Second prompt" → Enter
    3. Submit "Third prompt" → Enter
  - **Pass criteria**:
    - ✅ All 3 accepted
    - ✅ Responses in order (1, 2, 3)
    - ✅ No UI freezing
    - ✅ Sequential processing
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 6, spec.md FR-005, FR-006

- [ ] **T013** [P] **Manual test: Model load failure** (Scenario 7)
  - **Purpose**: Verify graceful error handling
  - **How to test**:
    1. Edit index.html: `model-url="invalid-404"`
    2. Reload page
    3. Press Cmd-K, submit prompt
  - **Pass criteria**:
    - ✅ Clear error message
    - ✅ Page remains interactive
    - ✅ Error categorized (network)
    - ✅ No crash
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 7, spec.md FR-008

- [ ] **T014** [P] **Manual test: Tab close during load** (Scenario 8)
  - **Purpose**: Verify clean resource cleanup
  - **How to test**:
    1. Open fresh tab
    2. Wait 5 seconds (model loading)
    3. Close tab
    4. Check Task Manager
  - **Pass criteria**:
    - ✅ Tab closes <1 second
    - ✅ No zombie processes
    - ✅ Memory freed
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 8, spec.md FR-009

- [ ] **T015** [P] **Manual test: Response quality** (Scenario 9)
  - **Purpose**: Verify streaming behavior unchanged
  - **How to test**:
    1. Submit: "Explain photosynthesis"
    2. Compare with previous implementation
  - **Pass criteria**:
    - ✅ Streaming speed feels same (~30ms/token)
    - ✅ Response coherent
    - ✅ No truncation
    - ✅ Word boundaries preserved
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 9, spec.md FR-010

- [ ] **T016** [P] **Manual test: Low memory handling** (Scenario 10)
  - **Purpose**: Verify graceful degradation
  - **How to test**:
    1. DevTools → Performance Monitor
    2. Simulate memory pressure
    3. Attempt model load
  - **Pass criteria**:
    - ✅ Completes or shows OOM error
    - ✅ No crash
    - ✅ UI remains usable
    - ✅ Error category: 'oom'
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Scenario 10, spec.md edge cases

### Performance Validation

- [ ] **T017** [P] **Performance test: UI response time** (PR-001)
  - **Purpose**: Measure UI responsiveness during generation
  - **How to test**:
    1. Start generation
    2. Use DevTools Performance tab
    3. Measure click/scroll response time
  - **Target**: <100ms for all interactions
  - **Pass criteria**: All measurements <100ms
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Performance PR-001, spec.md PR-001

- [ ] **T018** [P] **Performance test: Keyboard shortcuts** (PR-002)
  - **Purpose**: Measure Cmd-K response time
  - **How to test**:
    1. Press Cmd-K in idle, loading, generating states
    2. Measure time to chat appearance
  - **Target**: <50ms in all states
  - **Pass criteria**: All measurements <50ms
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Performance PR-002, spec.md PR-002

- [ ] **T019** [P] **Performance test: Message passing latency** (PR-003)
  - **Purpose**: Measure worker communication overhead
  - **How to test**:
    1. Add console.time() around postMessage
    2. Calculate average latency
  - **Target**: <5ms for typical message
  - **Pass criteria**: Average <5ms
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Performance PR-003, spec.md PR-003

### Browser Compatibility

- [ ] **T020** [P] **Browser test: Chrome 90+**
  - **What to test**: Model load, generation, cancellation
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Browser Compatibility, spec.md PR-004

- [ ] **T021** [P] **Browser test: Firefox 88+**
  - **What to test**: Model load, generation, cancellation
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Browser Compatibility, spec.md PR-004

- [ ] **T022** [P] **Browser test: Safari 14+**
  - **What to test**: Model load, generation, cancellation
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Browser Compatibility, spec.md PR-004

- [ ] **T023** [P] **Browser test: Edge 90+**
  - **What to test**: Model load, generation, cancellation
  - **Dependencies**: BLOCKED by T005
  - **Reference**: quickstart.md Browser Compatibility, spec.md PR-004

---

## Dependencies

```
Phase 3.2 (Tests):
  T001 [P] ─┐
            ├─> MUST COMPLETE & FAIL before Phase 3.3
  T002 [P] ─┘

Phase 3.3 (Implementation):
  T003 [P] ─┬─> T005 (both needed for component integration)
  T004 [P] ─┘

  T005 ──> T006 (delete old code after switch complete)

  T006 ──> T007-T023 (all testing blocked until integration done)

Phase 3.5 (Testing):
  T007-T023 [P] (all can run in parallel - independent test scenarios)
```

## Parallel Execution Examples

### Phase 3.2: Write Contract Tests (Parallel)
```bash
# Launch both contract test tasks together
Task: "Contract test: Worker message interface in specs/003-move-model-inference/contracts/worker-interface.contract.js"
Task: "Contract test: WorkerManager API in specs/003-move-model-inference/contracts/manager-api.contract.js"
```

### Phase 3.3: Implement Worker & Manager (Parallel)
```bash
# After tests are failing, implement both files in parallel
Task: "Implement Web Worker: model-worker.js at src/model-worker.js"
Task: "Implement WorkerManager: worker-manager.js at src/worker-manager.js"
```

### Phase 3.5: Manual Testing (Parallel)
```bash
# After integration complete, run all tests in parallel
Task: "Manual test: Non-blocking model load (Scenario 1) from quickstart.md"
Task: "Manual test: Activate during load (Scenario 2) from quickstart.md"
Task: "Manual test: Responsive during generation (Scenario 3) from quickstart.md"
# ... (continue for T007-T023, all independent)
```

## Notes

- **[P] tasks**: Different files, no dependencies, can run concurrently
- **TDD Critical**: T001-T002 MUST complete and FAIL before T003-T004
- **Integration Blocked**: T005 needs both T003 and T004 complete
- **Testing Blocked**: T007-T023 need T005 complete (full integration)
- **Commit Strategy**: Commit after each task (T001, T002, T003, etc.)
- **Constitution Compliance**: No build step, no new dependencies, vanilla JS only

## Task Generation Rules Applied

1. **From Contracts** ✅:
   - worker-interface.contract.js → T001 contract test [P]
   - manager-api.contract.js → T002 contract test [P]
   - Message handlers → T003 worker implementation [P]
   - API methods → T004 manager implementation [P]

2. **From Data Model** ✅:
   - 13 message types → T003 message handler (switch cases)
   - State machines → T003 state management
   - Request queue → T004 queue implementation

3. **From User Stories** ✅:
   - 10 scenarios from quickstart.md → T007-T016 manual tests [P]
   - 5 acceptance scenarios from spec.md → covered in T007-T011
   - Edge cases → T012-T014, T016

4. **Ordering** ✅:
   - Tests (T001-T002) → Implementation (T003-T004) → Integration (T005) → Cleanup (T006) → Validation (T007-T023)

## Validation Checklist

- [x] All contracts have corresponding tests (T001: worker, T002: manager)
- [x] All entities have model tasks (message types in T003 data model)
- [x] All tests come before implementation (T001-T002 before T003-T004)
- [x] Parallel tasks truly independent (different files, no shared state)
- [x] Each task specifies exact file path (all tasks have `at path/to/file`)
- [x] No task modifies same file as another [P] task (verified: T003/T004 different files, T007-T023 read-only tests)

---

**Total Tasks**: 23
**Parallel Tasks**: 19 (T001-T002, T003-T004, T007-T023)
**Sequential Tasks**: 4 (T005, T006, blocked by dependencies)

**Estimated Time**:
- Phase 3.2 (Tests): 2-3 hours (T001-T002 parallel)
- Phase 3.3 (Implementation): 4-6 hours (T003-T004 parallel, T005 sequential)
- Phase 3.5 (Testing): 2-3 hours (T007-T023 parallel)
- **Total**: 8-12 hours

**Ready for execution**: ✅ All tasks are immediately actionable
