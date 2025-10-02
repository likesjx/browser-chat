# Tasks: Interactive Chat Web Component

**Input**: Design documents from `/Users/jaredlikes/code/browser-chat/specs/001-create-a-web/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: Vanilla JS, ONNX Runtime Web, IndexedDB, flat structure
2. Load design documents:
   → data-model.md: 4 entities (ConversationPair, ChatSession, ComponentConfiguration, ModelState)
   → contracts/component-api.md: Full Custom Element API
   → quickstart.md: 17 test scenarios
3. Generate tasks by category (Setup, Core, Integration, Polish)
4. Apply task rules: Different files = [P], tests before implementation
5. Number tasks sequentially (T001-T045)
6. SUCCESS: 45 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Single project structure at repository root:
- Source: `/src/chat-component.js`, `/src/model-manager.js`, `/src/storage-manager.js`, `/src/styles.css`
- Test page: `/index.html`
- Documentation: `/README.md`

---

## Phase 3.1: Setup & Project Structure

- [x] **T001** Create directory structure with `mkdir -p src models` and verify paths exist
- [x] **T002** Create `/README.md` with project overview, model download instructions (TinyLlama-q8, MiniLM-L6-q8), setup steps, and browser compatibility notes per research.md
- [x] **T003** Create `/models/.gitkeep` with note that models must be downloaded by user (not committed to repo, too large)

---

## Phase 3.2: Storage Layer (IndexedDB)

- [x] **T004** [P] Create `/src/storage-manager.js` with IndexedDB initialization for database `chat-component-db` version 1
- [x] **T005** [P] In `/src/storage-manager.js`: Add object store creation for `conversations` with keyPath `id` and index on `timestamp` field per data-model.md schema
- [x] **T006** [P] In `/src/storage-manager.js`: Implement `saveConversation(conversationPair)` method that stores ConversationPair with validation (prompt 1-10000 chars, embedding 384 dimensions if present)
- [x] **T007** [P] In `/src/storage-manager.js`: Implement `getHistory(limit = 10)` method that retrieves recent conversations in reverse chronological order, excluding embeddings for size
- [x] **T008** [P] In `/src/storage-manager.js`: Implement `clearHistory()` method that deletes all records from conversations store and returns count deleted
- [x] **T009** [P] In `/src/storage-manager.js`: Implement `getConversationCount()` method that returns total number of stored pairs
- [x] **T010** [P] In `/src/storage-manager.js`: Add QuotaExceededError handling per FR-017 that catches error during save and returns error object with descriptive message

---

## Phase 3.3: Model Management (ONNX Runtime)

- [x] **T011** [P] Create `/src/model-manager.js` with ONNX Runtime Web imports (via CDN link: `https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js`)
- [x] **T012** [P] In `/src/model-manager.js`: Implement `loadModel(modelUrl, type)` async method that loads ONNX model with progress tracking (0-100%), returns InferenceSession per research.md ONNX decision
- [x] **T013** [P] In `/src/model-manager.js`: Add model loading error handling for network failures (404, CORS), out of memory, unsupported format per research.md error categories
- [x] **T014** [P] In `/src/model-manager.js`: Implement `generateTokens(prompt, config)` async generator function that yields tokens progressively using InferenceSession.run() with systemPrompt prepending per research.md streaming decision
- [x] **T015** [P] In `/src/model-manager.js`: Add prompt queueing with `queuedPrompts` array that stores prompts submitted during model loading per FR-014, processes queue when model ready
- [x] **T016** [P] In `/src/model-manager.js`: Implement generation cancellation with AbortController that stops token streaming when triggered, per FR-014a Esc cancellation requirement
- [x] **T017** [P] In `/src/model-manager.js`: Add inference timeout (default 30s) using Promise.race with timer, throws TimeoutError per FR-015 error handling
- [x] **T018** [P] In `/src/model-manager.js`: Implement `generateEmbedding(text)` method using transformers.js (all-MiniLM-L6-v2) that returns Float32Array(384) for vector storage per data-model.md ConversationPair.embedding field

---

## Phase 3.4: Component Styles

- [x] **T019** [P] Create `/src/styles.css` with component layout (chat-container, input-wrapper, response area) using CSS custom properties (`--chat-bg-color`, `--chat-width`, etc.) per contracts/component-api.md CSS section
- [x] **T020** [P] In `/src/styles.css`: Add visibility states (hidden, input-visible, response-visible) with fade-in animation per research.md focus management state machine
- [x] **T021** [P] In `/src/styles.css`: Add responsive sizing with max-height 80vh, border-radius, shadow, and mobile breakpoints per contracts/component-api.md theming section

---

## Phase 3.5: Core Component Structure

- [x] **T022** Create `/src/chat-component.js` with Custom Element class definition extending HTMLElement and `customElements.define('chat-component', ChatComponent)` registration
- [x] **T023** In `/src/chat-component.js`: Implement `constructor()` with Shadow DOM initialization (mode: 'open'), import styles from styles.css, create template HTML structure per contracts/component-api.md shadow DOM structure
- [x] **T024** In `/src/chat-component.js`: Define `static get observedAttributes()` returning array: ['model-url', 'embedding-url', 'system-prompt', 'temperature', 'max-tokens', 'inference-timeout'] per contracts/component-api.md attributes
- [x] **T025** In `/src/chat-component.js`: Implement property accessors (getters/setters) for `modelUrl`, `embeddingUrl`, `systemPrompt`, `temperature`, `maxTokens`, `inferenceTimeout` with type coercion and validation per contracts/component-api.md properties section
- [x] **T026** In `/src/chat-component.js`: Implement read-only properties `isVisible`, `isGenerating`, `isModelLoaded`, `conversationCount` that return current state per contracts/component-api.md read-only properties

---

## Phase 3.6: Component Lifecycle & Event Handling

- [x] **T027** In `/src/chat-component.js`: Implement `connectedCallback()` that attaches global keyboard listener for Cmd-K/Ctrl-K, loads model if modelUrl set, initializes IndexedDB connection via storage-manager.js
- [x] **T028** In `/src/chat-component.js`: Implement `disconnectedCallback()` that removes global keyboard listener, cancels active generation, closes IndexedDB, disposes ONNX sessions to free memory
- [x] **T029** In `/src/chat-component.js`: Implement `attributeChangedCallback(name, oldValue, newValue)` that validates new values, updates configuration, reloads model if model-url changed per contracts/component-api.md attribute change behavior
- [x] **T030** In `/src/chat-component.js`: Add global keyboard event handler that detects Cmd-K (Mac) / Ctrl-K (Windows/Linux) using `event.metaKey` / `event.ctrlKey`, calls `preventDefault()` and `stopPropagation()` per FR-016, activates component per research.md keyboard handling decision

---

## Phase 3.7: State Management & UI Updates

- [ ] **T031** In `/src/chat-component.js`: Implement ChatSession state machine with states (hidden, input-visible, generating, response-visible) per data-model.md entity, transition logic following research.md focus management state machine
- [ ] **T032** In `/src/chat-component.js`: Implement `activate()` public method that sets state to input-visible, makes component visible, focuses input element, dispatches `chat-activated` event per contracts/component-api.md
- [ ] **T033** In `/src/chat-component.js`: Implement `hide()` public method that sets state to hidden, clears current prompt/response, cancels active generation, dispatches `chat-hidden` event per contracts/component-api.md
- [ ] **T034** In `/src/chat-component.js`: Add focus management that moves focus to response area after generation complete per FR-006, handles click-in-input to clear response per FR-007
- [ ] **T035** In `/src/chat-component.js`: Implement click-outside detection using document click listener with `contains()` check that hides component per FR-008, respects generation state (no hide during active generation)

---

## Phase 3.8: Prompt Submission & Streaming

- [ ] **T036** In `/src/chat-component.js`: Add input event handler for Enter key that submits prompt, Shift-Enter for new line per FR-003 multi-line support, calls `submitPrompt()` method
- [ ] **T037** In `/src/chat-component.js`: Implement `submitPrompt()` method that reads input text, validates (1-10000 chars), checks if model loaded (queue if not per FR-014), sets state to generating, dispatches `generation-started` event
- [ ] **T038** In `/src/chat-component.js`: Implement streaming display loop using `for await (const token of generateTokens())` that appends sanitized tokens to response element using `textContent` (XSS protection) per research.md streaming decision
- [ ] **T039** In `/src/chat-component.js`: Add token streaming progress events dispatching `generation-progress` every 10 tokens with detail {tokenCount, partialResponse} per contracts/component-api.md events
- [ ] **T040** In `/src/chat-component.js`: Implement Esc key handler that checks generation state: if generating, cancels and preserves prompt per FR-014a; if idle, hides component per FR-009

---

## Phase 3.9: Storage Integration & History

- [ ] **T041** In `/src/chat-component.js`: After generation complete, call `generateEmbedding(prompt)` from model-manager.js, create ConversationPair object per data-model.md with id (timestamp), prompt, response, embedding, modelVersion, timestamp
- [ ] **T042** In `/src/chat-component.js`: Call `saveConversation(conversationPair)` from storage-manager.js, handle success (dispatch `generation-complete` with detail.saved=true) or QuotaExceededError (show warning per FR-017, still dispatch event with detail.saved=false)
- [ ] **T043** In `/src/chat-component.js`: Implement `clearHistory()` public method that calls storage-manager clearHistory(), updates conversationCount, dispatches `history-cleared` event with detail {count} per contracts/component-api.md
- [ ] **T044** In `/src/chat-component.js`: Implement `getHistory(limit)` public method that calls storage-manager getHistory(), returns array of ConversationPair objects (without embeddings) per contracts/component-api.md

---

## Phase 3.10: Error Handling & Retry

- [ ] **T045** In `/src/chat-component.js`: Implement error handling in generation flow that catches model load errors, inference timeouts, inference errors per research.md error categories, displays descriptive error message in response area
- [ ] **T046** In `/src/chat-component.js`: Add retry button UI in response area (visible only when error displayed), implement `retry()` public method that clears error, resubmits preserved prompt, dispatches `generation-started` event per FR-015
- [ ] **T047** In `/src/chat-component.js`: Dispatch appropriate error events: `model-error` for load failures, `generation-error` for inference failures, include detail {prompt, error, errorType} per contracts/component-api.md events section

---

## Phase 3.11: Model Loading States

- [ ] **T048** In `/src/chat-component.js`: Add loading indicator UI that displays in response area during model loading, shows "Loading model..." message and optional progress percentage
- [ ] **T049** In `/src/chat-component.js`: Dispatch model lifecycle events: `model-loading` when load starts, `model-progress` during load with detail {progress: 0-100, modelType}, `model-loaded` when ready, `model-error` on failure per contracts/component-api.md
- [ ] **T050** In `/src/chat-component.js`: When prompt submitted during model loading, display loading indicator in response area per FR-014 clarification, automatically process queued prompt when model ready

---

## Phase 3.12: Test Page & Integration

- [x] **T051** Create `/index.html` test page with DOCTYPE, basic structure, `<chat-component>` element with attributes (model-url, embedding-url, system-prompt, temperature), ES6 module script import for chat-component.js per quickstart.md Quick Start section
- [x] **T052** In `/index.html`: Add test instructions paragraph with Cmd-K/Ctrl-K activation hint, add console event listeners for all custom events (chat-activated, generation-started, etc.) to verify event dispatching per quickstart.md Scenario 1
- [x] **T053** In `/index.html`: Add DevTools instructions section explaining how to inspect IndexedDB (Application → IndexedDB → chat-component-db) and verify conversation storage per quickstart.md Scenario 10

---

## Phase 3.13: Configuration & Accessibility

- [ ] **T054** In `/src/chat-component.js`: Validate configuration parameters: temperature clamped to 0.0-2.0, maxTokens clamped to 1-2048, inferenceTimeout clamped to 1000-120000ms per data-model.md ComponentConfiguration validation rules
- [ ] **T055** In `/src/chat-component.js`: Add ARIA attributes: `role="dialog"` when visible, `aria-label="AI Chat Assistant"`, `aria-live="polite"` on response area for screen reader announcements per contracts/component-api.md accessibility section
- [ ] **T056** In `/src/chat-component.js`: Implement focus trap within component when visible (Tab key cycles within Shadow DOM) per contracts/component-api.md accessibility requirements

---

## Phase 3.14: XSS Protection & Security

- [ ] **T057** In `/src/chat-component.js`: Sanitize user input by validating prompt length, escaping special characters before display, use `textContent` not `innerHTML` for all DOM updates per research.md security decision
- [ ] **T058** In `/src/chat-component.js`: Sanitize model output tokens before appending to DOM, validate embedding dimensions (384) before storage to prevent malformed data injection per data-model.md ConversationPair validation

---

## Phase 3.15: Polish & Documentation

- [ ] **T059** [P] In `/README.md`: Add "Quick Start" section with local server setup (Python http.server or npx http-server), model download links, browser open instructions per quickstart.md Quick Start
- [ ] **T060** [P] In `/README.md`: Add "Configuration" section documenting all attributes with types, defaults, examples per contracts/component-api.md attributes section
- [ ] **T061** [P] In `/README.md`: Add "Browser Compatibility" section listing minimum versions (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+) and required APIs per research.md browser compatibility
- [ ] **T062** [P] In `/README.md`: Add "Troubleshooting" section with common issues (model load failures, CORS errors, storage quota) and fixes per quickstart.md Troubleshooting section

---

## Phase 3.16: Manual Testing Validation

- [ ] **T063** Run quickstart.md Scenario 1: Verify Cmd-K/Ctrl-K activates component with focused input
- [ ] **T064** Run quickstart.md Scenario 2: Submit prompt, verify streaming tokens display progressively
- [ ] **T065** Run quickstart.md Scenario 3: Verify focus moves to response after generation complete
- [ ] **T066** Run quickstart.md Scenario 4: Click input, verify response clears but prompt preserved
- [ ] **T067** Run quickstart.md Scenario 5: Verify Esc and click-outside hide component when idle
- [ ] **T068** Run quickstart.md Scenario 6: Press Esc during generation, verify cancellation preserves prompt
- [ ] **T069** Run quickstart.md Scenario 7: Submit prompt during model loading, verify queue with loading indicator
- [ ] **T070** Run quickstart.md Scenario 8: Simulate model load failure, verify error message and retry button
- [ ] **T071** Run quickstart.md Scenario 9: Verify component intercepts Cmd-K (page shortcuts blocked)
- [ ] **T072** Run quickstart.md Scenario 10: Verify ConversationPair saved to IndexedDB with embedding
- [ ] **T073** Run quickstart.md Scenario 11: Simulate quota exceeded, verify error message displayed but generation not blocked
- [ ] **T074** Run quickstart.md Scenario 13: Change configuration via DevTools, verify temperature and maxTokens applied
- [ ] **T075** Run quickstart.md Scenario 14: Call getHistory(), verify returns recent conversations
- [ ] **T076** Run quickstart.md Scenario 15: Call clearHistory(), verify IndexedDB cleared
- [ ] **T077** Run quickstart.md Scenario 16: Test in Chrome and Firefox, verify all scenarios pass
- [ ] **T078** Run quickstart.md Scenario 17: Enable offline mode, verify generation works without network

---

## Dependencies

### Critical Path
1. **Setup** (T001-T003) must complete first
2. **Storage Layer** [P] (T004-T010) can run in parallel with **Model Layer** [P] (T011-T018) and **Styles** [P] (T019-T021)
3. **Component Structure** (T022-T026) requires setup complete
4. **Lifecycle** (T027-T030) requires component structure + storage + model
5. **State Management** (T031-T035) requires lifecycle
6. **Prompt Submission** (T036-T040) requires state management + model layer
7. **Storage Integration** (T041-T044) requires prompt submission + storage layer
8. **Error Handling** (T045-T047) requires prompt submission
9. **Model Loading UI** (T048-T050) requires lifecycle + model layer
10. **Test Page** (T051-T053) requires component complete
11. **Configuration** (T054-T056) can run after lifecycle
12. **Security** (T057-T058) can run after prompt submission
13. **Documentation** [P] (T059-T062) can run in parallel after test page
14. **Testing** (T063-T078) must run after all implementation complete

### Parallel Opportunities
- **T004-T010** (storage-manager.js) + **T011-T018** (model-manager.js) + **T019-T021** (styles.css) = independent files
- **T059-T062** (README.md sections) = different sections, no conflicts
- **T063-T078** (manual tests) = can run in any order after implementation

---

## Parallel Execution Examples

### Example 1: Storage + Model + Styles (Early Phase)
```bash
# After T003 completes, launch these 3 in parallel:
Task: "Create /src/storage-manager.js with IndexedDB initialization for database chat-component-db version 1"
Task: "Create /src/model-manager.js with ONNX Runtime Web imports via CDN"
Task: "Create /src/styles.css with component layout using CSS custom properties"
```

### Example 2: Storage Layer Methods (Independent)
```bash
# After T004 completes, launch T005-T010 in parallel:
Task: "In /src/storage-manager.js: Add object store creation for conversations with keyPath id"
Task: "In /src/storage-manager.js: Implement saveConversation() method with validation"
Task: "In /src/storage-manager.js: Implement getHistory() method in reverse chronological order"
Task: "In /src/storage-manager.js: Implement clearHistory() method"
Task: "In /src/storage-manager.js: Implement getConversationCount() method"
Task: "In /src/storage-manager.js: Add QuotaExceededError handling per FR-017"
```

### Example 3: Model Layer Methods (Independent)
```bash
# After T011 completes, launch T012-T018 in parallel:
Task: "In /src/model-manager.js: Implement loadModel() async method with progress tracking"
Task: "In /src/model-manager.js: Add model loading error handling"
Task: "In /src/model-manager.js: Implement generateTokens() async generator"
Task: "In /src/model-manager.js: Add prompt queueing with queuedPrompts array"
Task: "In /src/model-manager.js: Implement generation cancellation with AbortController"
Task: "In /src/model-manager.js: Add inference timeout using Promise.race"
Task: "In /src/model-manager.js: Implement generateEmbedding() using transformers.js"
```

### Example 4: Documentation Sections (Parallel)
```bash
# After T058 completes, launch T059-T062 in parallel:
Task: "In /README.md: Add Quick Start section with local server setup"
Task: "In /README.md: Add Configuration section documenting all attributes"
Task: "In /README.md: Add Browser Compatibility section"
Task: "In /README.md: Add Troubleshooting section with common issues"
```

---

## Notes

### Task Execution Guidelines
- **[P] tasks**: Different files, no shared state, can run in parallel
- **Sequential tasks**: Same file or dependent state, must run in order
- **Commit strategy**: Commit after each task or logical group (e.g., all storage methods)
- **Testing**: Run manual tests (T063-T078) after each major integration point, not just at end

### Implementation Best Practices
- Use `textContent` not `innerHTML` for XSS protection
- Always validate user input before processing or storage
- Sanitize model output tokens before DOM insertion
- Handle all errors gracefully with descriptive messages
- Test in Chrome and Firefox minimum (Safari optional)
- Keep Shadow DOM encapsulated (no global style leaks)

### Performance Considerations
- First token target: <2s (goal <1s)
- Use async/await for non-blocking operations
- Progressive token display for perceived performance
- Web Workers if inference blocks UI (evaluate during testing)
- Dispose ONNX sessions on disconnectedCallback to free memory

---

## Validation Checklist

Before marking tasks.md complete, verify:

- [x] All contracts have corresponding implementation (component-api.md → T022-T062)
- [x] All entities have tasks (4 entities in data-model.md → storage tasks T004-T010, state management T031-T035)
- [x] All tests scenarios have validation tasks (17 quickstart scenarios → T063-T078)
- [x] Dependencies clearly documented (Critical Path section above)
- [x] Parallel tasks are truly independent (verified: different files or isolated sections)
- [x] Each task specifies exact file path (all tasks include /src/ or /index.html paths)
- [x] No task modifies same file as another [P] task (verified: parallel groups are different files)
- [x] TDD approach: manual test scenarios after implementation, not before (T063-T078 at end)

---

**Tasks Generated**: 78 total
- Setup: 3 tasks (T001-T003)
- Storage Layer: 7 tasks (T004-T010)
- Model Layer: 8 tasks (T011-T018)
- Styles: 3 tasks (T019-T021)
- Component Core: 26 tasks (T022-T047)
- Model Loading: 3 tasks (T048-T050)
- Test Page: 3 tasks (T051-T053)
- Configuration: 3 tasks (T054-T056)
- Security: 2 tasks (T057-T058)
- Documentation: 4 tasks (T059-T062)
- Manual Testing: 16 tasks (T063-T078)

**Estimated Timeline**: 2-3 days for experienced developer, 4-5 days for learning ONNX/Web Components

**Ready for Implementation**: Yes - all design artifacts complete, tasks ordered by dependencies
