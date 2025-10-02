<!--
Sync Impact Report:
- Version: 0.0.0 → 1.0.0
- Initial constitution creation for browser-chat project
- Principles established: Vanilla-First, In-Browser Execution, Component Isolation, Progressive Enhancement, Configuration Management
- Templates status:
  ✅ plan-template.md reviewed (Constitution Check section aligns)
  ✅ spec-template.md reviewed (requirements align with principles)
  ✅ tasks-template.md reviewed (task categories support principles)
  ✅ agent-file-template.md reviewed (no updates needed)
- No deferred placeholders
- Ratification date set to project creation (2025-10-01)
-->

# Browser-Chat Constitution

## Core Principles

### I. Vanilla-First
All implementation MUST use vanilla JavaScript - no frameworks, no build steps, no transpilation required. Libraries are permitted only for specialized functionality that cannot be reasonably implemented from scratch (e.g., ONNX Runtime for model inference, complex mathematical operations).

**Rationale**: This is a proof-of-concept focused on demonstrating in-browser LLM capabilities without adding framework complexity. Vanilla JS ensures maximum portability, minimal dependencies, and straightforward debugging.

### II. In-Browser Execution (NON-NEGOTIABLE)
The entire inference pipeline MUST execute client-side using ONNX Runtime Web. NO network requests to external model APIs are permitted for inference. The system MUST be fully functional offline after initial page load and model download.

**Rationale**: Core value proposition is demonstrating on-device AI without server dependencies. This ensures privacy, eliminates latency from API calls, and proves feasibility of client-side LLM inference.

### III. Component Isolation
The chat interface MUST be implemented as a Web Component (Custom Element) with encapsulated styles and behavior. The component MUST NOT pollute global scope or require specific DOM structure from the host page.

**Rationale**: Web Components provide native browser APIs for building reusable, encapsulated UI elements. This ensures the chat interface can be dropped into any page without conflicts.

### IV. Progressive Enhancement
The keyboard shortcut (Cmd-K/Ctrl-K) MUST be the primary activation method. The component MUST provide visual feedback when activated and handle edge cases (input focus conflicts, multiple instances, disabled states).

**Rationale**: Keyboard-first interaction aligns with developer tool UX patterns. Progressive enhancement ensures the component remains accessible and functional across different contexts.

### V. Configuration Management
System prompts, temperature, and other inference parameters MUST be configurable through a clean JavaScript API. Configuration MUST be documented and validated at runtime. Default values MUST produce reasonable chat behavior out of the box.

**Rationale**: A POC must demonstrate flexibility for experimentation. Exposing inference parameters allows users to test different model behaviors without code modifications.

## Technical Constraints

### Browser Compatibility
- **Target**: Modern evergreen browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- **Required APIs**: Custom Elements v1, Shadow DOM, ES6 modules, WebAssembly
- **ONNX Runtime**: Use official `onnxruntime-web` package via CDN or npm

### Performance Standards
- **Inference latency**: Display first token within 2 seconds (target: <1s for small models)
- **UI responsiveness**: Chat input must remain responsive during inference (use Web Workers if blocking)
- **Memory**: Must handle at least 10-message conversation history without browser hang
- **Model size**: Initial POC targets models <500MB (quantized versions preferred)

### Security & Privacy
- **No telemetry**: No analytics, no error reporting to external services
- **Data persistence**: Chat history may use localStorage but MUST be clearable
- **Content Security Policy**: Component must work with strict CSP (no inline scripts in production)
- **XSS protection**: All user input and model output MUST be sanitized before DOM insertion

## Development Workflow

### Testing Requirements
- **Manual testing**: Provide a simple HTML test page in repository root
- **Browser testing**: Must verify in Chrome and Firefox minimum
- **Model loading**: Test with at least one quantized model <200MB for fast iteration
- **Error scenarios**: Test model load failures, inference errors, quota exceeded

### Documentation Standards
- **README.md**: Must include quick start (how to run test page), architecture overview, model setup
- **Code comments**: Explain ONNX-specific code and Web Component lifecycle hooks
- **Configuration API**: Document all configurable parameters with types and defaults
- **Browser compatibility**: List required APIs and tested browser versions

### Code Quality
- **No build required**: Code must run directly in browser via `<script type="module">`
- **Linting**: Optional ESLint for consistency, but not required for POC
- **File structure**: Keep flat - no deep nesting (POC scope: <5 files)
- **Naming**: Use descriptive names for component attributes and API methods

## Governance

### Amendment Process
1. Identify conflict between principle and implementation need
2. Document specific use case and why existing principles insufficient
3. Propose principle modification with rationale
4. Update version (MAJOR for principle removals, MINOR for additions, PATCH for clarifications)
5. Propagate changes to plan/spec/tasks templates

### Compliance Review
- Constitution applies to all code in repository root and src/ directory
- Templates checked during /plan command execution (Constitution Check gate)
- Violations must be documented in plan.md Complexity Tracking with justification
- Unjustifiable violations require architecture simplification

### Runtime Guidance
For Claude Code and other AI assistants: use `CLAUDE.md` at repository root for context about recent changes, implementation conventions, and active development notes. The constitution defines non-negotiable principles; `CLAUDE.md` provides practical working context.

**Version**: 1.0.0 | **Ratified**: 2025-10-01 | **Last Amended**: 2025-10-01
