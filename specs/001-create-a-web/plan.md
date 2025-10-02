# Implementation Plan: Interactive Chat Web Component

**Branch**: `001-create-a-web` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/jaredlikes/code/browser-chat/specs/001-create-a-web/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Build a keyboard-activated (Cmd-K/Ctrl-K) Web Component that provides instant access to in-browser AI chat. The component uses ONNX Runtime Web for client-side LLM inference with streaming token display, stores conversation history with embeddings in IndexedDB for vector search, and handles all interactions (focus management, cancellation, error retry) without external API calls.

## Technical Context
**Language/Version**: Vanilla JavaScript (ES6+), no transpilation or build step required
**Primary Dependencies**: ONNX Runtime Web (onnxruntime-web) for in-browser model inference, transformers.js for embedding generation
**Storage**: IndexedDB for conversation pairs and embeddings (vector search capability)
**Testing**: Manual browser testing with simple HTML test page (Chrome 90+, Firefox 88+)
**Target Platform**: Modern evergreen browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+) with WebAssembly support
**Project Type**: single (Web Component POC - flat file structure, no backend)
**Performance Goals**: First token display <2s (target <1s), UI remains responsive during inference, handle 10+ message history
**Constraints**: Offline-capable after initial load, no external API calls for inference, model size <500MB (quantized preferred), strict CSP compatibility
**Scale/Scope**: POC scope with <5 source files, single Custom Element, quantized LLM model <200MB for fast iteration

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Vanilla-First
✅ **PASS** - Implementation uses vanilla JavaScript ES6+ modules with no frameworks, no build step, no transpilation. ONNX Runtime Web and transformers.js are specialized libraries for functionality that cannot be reasonably implemented from scratch (model inference and embeddings).

### Principle II: In-Browser Execution (NON-NEGOTIABLE)
✅ **PASS** - All inference executes client-side via ONNX Runtime Web. No network requests for inference. System fully functional offline after initial model download. IndexedDB for local storage only.

### Principle III: Component Isolation
✅ **PASS** - Implemented as Custom Element (Web Component) with Shadow DOM encapsulation. No global scope pollution. No specific DOM structure requirements from host page.

### Principle IV: Progressive Enhancement
✅ **PASS** - Cmd-K/Ctrl-K keyboard shortcut is primary activation method per FR-001. Component handles edge cases: focus conflicts (FR-016), cancellation (FR-014a), error states (FR-015), loading states (FR-014).

### Principle V: Configuration Management
✅ **PASS** - System prompts and inference parameters (temperature) will be configurable via JavaScript API per constitutional requirement. Default values will be provided for reasonable out-of-box behavior.

### Technical Constraints Check
✅ **Browser Compatibility**: Targets Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ with Custom Elements v1, Shadow DOM, ES6 modules, WebAssembly - matches constitution requirements

✅ **Performance Standards**: First token <2s (target <1s) meets constitution's <2s requirement. UI responsiveness addressed via streaming display. 10-message history exceeds constitutional minimum of 10 messages. Model size <500MB (using <200MB for fast iteration) meets constitution's <500MB guideline.

✅ **Security & Privacy**: No telemetry (no external API calls). IndexedDB storage is clearable. Strict CSP compatible (ES6 modules, no inline scripts). XSS protection required for user input and model output sanitization.

✅ **Testing Requirements**: Manual HTML test page planned. Chrome and Firefox testing minimum. Error scenario testing (model load failures, inference errors, quota exceeded) per FR-014, FR-015, FR-017.

**Initial Constitution Check**: ✅ PASS - No violations detected. All constitutional principles align with planned architecture.

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
/
├── index.html              # Test page (manual testing entry point)
├── src/
│   ├── chat-component.js   # Main Web Component (Custom Element definition)
│   ├── model-manager.js    # ONNX model loading & inference logic
│   ├── storage-manager.js  # IndexedDB operations & embedding storage
│   └── styles.css          # Component styles (imported as template)
├── models/
│   ├── tinyllama-q8.onnx   # Quantized LLM model (user downloads)
│   └── minilm-l6-q8.onnx   # Embedding model (user downloads)
└── README.md               # Setup & model download instructions
```

**Structure Decision**: Single project (Option 1) with flat file structure. This is a POC Web Component with no backend, following constitutional guideline of <5 files (4 source files: chat-component.js, model-manager.js, storage-manager.js, styles.css). All code at repository root for simplicity. No build step required - runs directly in browser via ES6 module imports.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
The /tasks command will generate implementation tasks based on Phase 1 design artifacts:

1. **From data-model.md**:
   - Create storage-manager.js with IndexedDB schema (ConversationPair)
   - Implement embedding storage with Float32Array support
   - Add validation rules for entities

2. **From contracts/component-api.md**:
   - Define Custom Element class with observed attributes
   - Implement attribute change handlers and property accessors
   - Add lifecycle hooks (connectedCallback, disconnectedCallback)
   - Implement public methods (activate, hide, clearHistory, getHistory, retry)
   - Dispatch all custom events per contract
   - Add CSS parts for external styling

3. **From quickstart.md test scenarios**:
   - Implement keyboard shortcut handling (global Cmd-K/Ctrl-K)
   - Add state machine for visibility/focus management
   - Implement streaming token display with progressive DOM updates
   - Add cancellation logic (Esc during generation)
   - Implement error handling with retry UI
   - Add model loading queue with indicator

4. **From research.md technology decisions**:
   - Integrate ONNX Runtime Web for model inference
   - Implement async generator for token streaming
   - Add Web Worker support (if needed for non-blocking inference)
   - Implement XSS sanitization for user input and model output

**File-Level Task Organization**:
```
src/chat-component.js  (12-15 tasks)
  - Custom Element definition
  - Shadow DOM setup
  - Keyboard event handling
  - State management
  - Event dispatching
  - UI updates

src/model-manager.js  (8-10 tasks)
  - ONNX Runtime integration
  - Model loading with progress
  - Inference with streaming
  - Prompt queuing
  - Error handling
  - Configuration application

src/storage-manager.js  (6-8 tasks)
  - IndexedDB initialization
  - ConversationPair CRUD
  - Embedding storage
  - Quota error handling
  - History queries

src/styles.css  (2-3 tasks)
  - Component layout
  - CSS custom properties
  - Animations/transitions

index.html  (1-2 tasks)
  - Test page setup
  - Multiple test scenarios
```

**Ordering Strategy**:
1. **Setup Phase** (T001-T003): Project structure, dependencies, test page skeleton
2. **Storage Layer** [P] (T004-T010): storage-manager.js implementation (parallel to model work)
3. **Model Layer** [P] (T011-T018): model-manager.js implementation (parallel to storage)
4. **Component Core** (T019-T025): chat-component.js basic structure (depends on storage + model)
5. **Integration** (T026-T032): Wire up keyboard, streaming, focus, events
6. **Error Handling** (T033-T036): Retry logic, quota handling, model errors
7. **Styling & Polish** [P] (T037-T040): CSS, animations, accessibility
8. **Testing** (T041-T045): Manual test scenarios, cross-browser validation

**Estimated Output**: 40-45 numbered tasks in dependency order

**Parallelization**:
- Mark [P] for tasks operating on different files with no shared state
- Storage and model managers can be built in parallel (independent modules)
- Styling can be done in parallel with integration work
- Test scenarios can run in parallel after core features complete

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan. Tasks.md will NOT be created during /plan execution.

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - 40-45 task estimate
- [ ] Phase 3: Tasks generated (/tasks command) - NOT DONE YET
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (no violations)
- [x] Post-Design Constitution Check: PASS (no new violations after Phase 1)
- [x] All NEEDS CLARIFICATION resolved (clarified in /clarify phase)
- [x] Complexity deviations documented (none - no violations)

**Artifacts Generated**:
- `/specs/001-create-a-web/plan.md` (this file)
- `/specs/001-create-a-web/research.md` (10 technology decisions documented)
- `/specs/001-create-a-web/data-model.md` (4 entities defined)
- `/specs/001-create-a-web/contracts/component-api.md` (full API contract)
- `/specs/001-create-a-web/quickstart.md` (17 test scenarios)
- `/CLAUDE.md` (updated with tech stack context)

**Next Command**: Run `/tasks` to generate tasks.md with 40-45 implementation tasks

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
