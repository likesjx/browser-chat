
# Implementation Plan: Move Model Inference to Web Worker

**Branch**: `003-move-model-inference` | **Date**: 2025-10-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-move-model-inference/spec.md`

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
Move AI model inference operations (loading, text generation, embeddings) from the main browser thread to a dedicated Web Worker thread to prevent UI freezing and maintain responsiveness during compute-intensive operations. This architectural refactoring ensures the chat interface remains interactive while handling 570MB model downloads and LLM inference.

## Technical Context
**Language/Version**: JavaScript ES6+ (vanilla, no build step)
**Primary Dependencies**:
- @huggingface/transformers v3.7.3 (ONNX Runtime Web wrapper)
- ONNX Runtime Web (via transformers.js)
- Web Workers API (native browser)
**Storage**: IndexedDB (existing, no changes required)
**Testing**: Manual browser testing (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
**Target Platform**: Modern evergreen browsers with Web Workers and ES6 module support
**Project Type**: Single (web component library, no separate frontend/backend)
**Performance Goals**:
- UI interactions respond within 100ms during AI operations
- Keyboard shortcuts trigger within 50ms
- Message passing latency <5ms
- First token latency maintained at ~2s (no regression)
**Constraints**:
- Must use vanilla JavaScript (no frameworks, no build step)
- Worker must use external file (not inline) for easier debugging
- Must queue prompts sequentially (ONNX doesn't support concurrent sessions)
- Must maintain current streaming behavior and response quality
**Scale/Scope**:
- Single Web Component with 3 new files (worker, manager, tests)
- Replace 1 file (model-manager.js → worker-manager.js)
- Update 1 file (chat-component.js imports and calls)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Vanilla-First ✅
**Status**: PASS
- Implementation uses vanilla JavaScript ES6+ modules
- Web Workers are native browser API (no framework)
- Transformers.js is specialized library for ONNX (constitutional exception applies)
- No build step, transpilation, or framework dependencies introduced

### II. In-Browser Execution ✅
**Status**: PASS (NON-NEGOTIABLE)
- All inference remains client-side using ONNX Runtime Web
- Web Worker is browser-native threading mechanism
- No external API calls introduced
- Offline functionality preserved (worker runs locally)

### III. Component Isolation ✅
**Status**: PASS
- Web Component encapsulation unchanged
- Worker is internal implementation detail
- No global scope pollution
- Shadow DOM and Custom Element structure preserved

### IV. Progressive Enhancement ✅
**Status**: PASS
- Keyboard shortcuts (Cmd-K/Ctrl-K) remain primary activation
- Worker improves responsiveness without changing UX
- Graceful degradation: error handling for worker failures
- Edge case handling maintained (cancellation, focus conflicts)

### V. Configuration Management ✅
**Status**: PASS
- Configuration API unchanged (temperature, maxTokens, systemPrompt)
- Worker receives configuration via postMessage
- Default values and validation unchanged
- JavaScript API surface preserved

### Browser Compatibility ✅
**Status**: PASS
- Web Workers supported in all target browsers:
  - Chrome 90+ ✅ (workers since Chrome 4)
  - Firefox 88+ ✅ (workers since Firefox 3.5)
  - Safari 14+ ✅ (workers since Safari 4)
  - Edge 90+ ✅ (workers since Edge 12)
- ES6 module workers supported in all targets
- No new API requirements beyond existing Custom Elements, Shadow DOM, WASM

### Performance Standards ✅
**Status**: PASS with IMPROVEMENT
- First token latency: Maintained at ~2s (worker overhead <5ms)
- UI responsiveness: IMPROVED - no blocking during inference
- Memory: Worker memory separate but within browser limits
- Model size: Unchanged (<570MB for current models)

### Security & Privacy ✅
**Status**: PASS
- No telemetry introduced
- Data persistence unchanged (IndexedDB)
- CSP compliant: External worker file (no inline scripts)
- XSS protection: Same sanitization in worker as main thread

**Initial Check**: ✅ PASS - No violations, ready for Phase 0

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
src/
├── chat-component.js      # (MODIFY) Update imports: modelManager → workerManager
├── model-worker.js         # (NEW) Web Worker: handles ONNX inference
├── worker-manager.js       # (NEW) Main thread: Worker communication wrapper
├── model-manager.js        # (DELETE) Replaced by worker-manager.js
├── storage-manager.js      # (NO CHANGE) IndexedDB operations
└── styles.css              # (NO CHANGE) Component styles

index.html                  # (NO CHANGE) Test page
```

**Structure Decision**: Single project structure (web component library). No backend/frontend split needed - this is a self-contained browser component. All new files in `src/` directory alongside existing component files.

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
1. Load `.specify/templates/tasks-template.md` as base
2. Generate contract test tasks from `/contracts/*.contract.js`:
   - worker-interface.contract.js → Task: Implement Worker Message Handler [P]
   - manager-api.contract.js → Task: Implement WorkerManager API [P]
3. Generate implementation tasks from data-model.md:
   - Task: Create model-worker.js with message handler
   - Task: Create worker-manager.js with Promise/Generator API
   - Task: Update chat-component.js imports and calls
   - Task: Delete model-manager.js
4. Generate validation tasks from quickstart.md:
   - Task: Manual testing - all 10 scenarios
   - Task: Performance validation - 3 metrics
   - Task: Browser compatibility - 4 browsers

**Ordering Strategy** (TDD + Dependency):
1. [P] Contract tests first (will fail - no implementation)
2. [P] Worker implementation (model-worker.js)
3. [P] Manager implementation (worker-manager.js)
4. Component integration (chat-component.js) - depends on #2, #3
5. Delete old implementation (model-manager.js)
6. Manual testing (quickstart.md)
7. Performance validation
8. Browser compatibility testing

**Estimated Output**: ~15-20 numbered, ordered tasks in tasks.md

**Dependencies**:
- Tasks 2-3 can run in parallel (independent files)
- Task 4 depends on 2 and 3 (needs both worker and manager)
- Tasks 6-8 depend on 1-5 (integration complete)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

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
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
