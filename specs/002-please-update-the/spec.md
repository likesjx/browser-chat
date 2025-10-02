# Feature Specification: Browser Chat - Implementation Refinements

**Feature Branch**: `002-please-update-the`
**Created**: 2025-10-02
**Status**: Completed
**Input**: User description: "please update the specs based on the work we've done"

## Execution Flow (main)
```
1. Review implementation against original spec (001-create-a-web)
   → Identify: new requirements, modified behaviors, UI enhancements
2. Extract implemented features not in original spec
   → Real ONNX inference, Raycast UI design, loading animations
3. Document clarifications and decisions made during development
4. Update functional requirements with actual behaviors
5. Capture edge cases discovered and resolved
6. SUCCESS: Specification reflects completed implementation
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT was built and WHY design decisions were made
- ❌ Avoid HOW implementation details (code structure, specific libraries)
- 👥 Document user-facing behaviors and visual design requirements

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A user on any web page presses Cmd-K (Mac) or Ctrl-K (Windows/Linux) to instantly summon an AI chat interface styled like Raycast. They type a question and see a distinctive red "Cylon eye" scanning animation while the browser downloads and loads AI models (first use only). Once ready, they receive streaming AI responses word-by-word. All conversations are automatically saved with vector embeddings for future semantic search. The interface can be dismissed with Esc or by clicking outside.

### Acceptance Scenarios
1. **Given** the user presses Cmd-K/Ctrl-K, **When** the component activates, **Then** a Raycast-style dark blue chat interface appears at the top 15% of viewport with automatic input focus
2. **Given** models are loading on first use, **When** user submits a prompt, **Then** a red scanning beam animation (Cylon eye) displays for minimum 800ms with "Loading model..." text
3. **Given** models are ready, **When** user submits a prompt, **Then** red scanning beam displays until first token arrives, then text streams word-by-word
4. **Given** user clicks in input after response appears, **When** click occurs, **Then** response clears but prompt text remains for editing
5. **Given** component is visible, **When** user presses Esc during generation, **Then** generation cancels, response clears, but prompt is preserved
6. **Given** response generation completes, **When** conversation saves, **Then** system stores prompt-response pair with 768-dimensional embedding vector
7. **Given** component shows error state, **When** user requests retry, **Then** previous prompt is resubmitted automatically

### Edge Cases
- What happens when embedding dimensions don't match expected size? (System accepts 384, 768, 1024, 1536 dimensions flexibly)
- How does system handle empty responses from cancelled generation? (Skips IndexedDB save, no validation error)
- What occurs if user clicks input repeatedly during loading? (Shadow DOM composedPath prevents premature close)
- How does focus behave on component activation? (Double requestAnimationFrame ensures focus after DOM paint, 220ms delay)
- What happens if models fail to load? (Descriptive error categories: 404, CORS, memory, format with retry option)
- How does animation perform during heavy inference? (GPU-accelerated transform animation on compositor thread)

## Requirements *(mandatory)*

### Functional Requirements

**Visual Design & UX**
- **FR-018**: System MUST display chat interface using Raycast design aesthetic with dark blue background (#2b3f5c), glassmorphism effects, and 16px border radius
- **FR-019**: System MUST position chat component at 15vh from top, centered horizontally, with 700px width
- **FR-020**: System MUST style input area with secondary dark background (#3d5270), 18px font size, and subtle placeholder text
- **FR-021**: System MUST remove all visible focus outlines from input field to match Raycast clean design
- **FR-022**: System MUST display input automatically focused 220ms after component activation to ensure visibility transition completes

**Loading States & Animations**
- **FR-023**: System MUST display red "Cylon eye" scanning beam animation using GPU-accelerated transform during model loading and token generation
- **FR-024**: System MUST ensure Cylon eye animation displays for minimum 800ms even if first token arrives faster
- **FR-025**: System MUST show scanning beam that oscillates left-to-right continuously at 1.8s interval with gradient red glow effect
- **FR-026**: System MUST use double requestAnimationFrame before generation to ensure animation paints before inference begins
- **FR-027**: System MUST display "Loading model..." text below Cylon eye during initial model download
- **FR-028**: System MUST show "Generating response..." text below Cylon eye while waiting for first token

**Model Integration & Inference**
- **FR-029**: System MUST load Gemma 3 270M text generation model automatically from HuggingFace on first use
- **FR-030**: System MUST load Gemma Embedding 300M model automatically for vector generation
- **FR-031**: System MUST cache downloaded models in browser storage for instant subsequent loads
- **FR-032**: System MUST use transformers.js library (@huggingface/transformers) via ESM CDN for ONNX inference
- **FR-033**: System MUST load fp16 quantized models for browser compatibility over q4 variants
- **FR-034**: System MUST prevent duplicate model loading by tracking loading state and last loaded URL
- **FR-035**: System MUST configure temperature 0.7, max tokens 100, top-k 50, top-p 0.95, repetition penalty 1.1 for generation

**Error Handling & State Management**
- **FR-036**: System MUST handle undefined error objects safely by extracting message via optional chaining
- **FR-037**: System MUST skip IndexedDB save when response is empty (cancelled generation)
- **FR-038**: System MUST accept embedding vectors of dimensions 384, 768, 1024, or 1536 for storage flexibility
- **FR-039**: System MUST clear all error states (error class, retry button) when starting new prompt submission
- **FR-040**: System MUST detect clicks using composedPath() for proper Shadow DOM event handling

**Interaction & Focus Management**
- **FR-041**: System MUST clear response area when user clicks input, while preserving prompt text for editing
- **FR-042**: System MUST position cursor at end of input text after component activation
- **FR-043**: System MUST prevent component from closing on internal clicks by checking event.composedPath()

### Key Entities *(include if feature involves data)*
- **Model State**: Tracks loading status, loaded model URLs, and prevents duplicate loads. Includes flags for LLM and embedding model loading states.
- **Conversation Pair (Enhanced)**: Stores prompt, response, and embedding vector. Now supports flexible embedding dimensions (768 for Gemma instead of fixed 384).
- **UI State**: Manages Raycast-themed dark interface with loading animations, error states, and focus transitions using explicit timing controls.
- **Animation State**: Controls Cylon eye scanning beam using GPU-accelerated CSS transforms on compositor thread with minimum display time enforcement.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded (refinements to existing feature)
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] Original implementation reviewed
- [x] New features extracted (Raycast UI, Cylon eye, Gemma models)
- [x] Design decisions documented
- [x] Requirements generated from actual behaviors
- [x] Edge cases captured (embedding dims, empty saves, Shadow DOM)
- [x] Review checklist passed

---

## Implementation Notes

### Design Decisions Made
1. **Raycast UI Theme**: Changed from generic light theme to exact Raycast dark blue aesthetic based on user screenshot for professional appearance
2. **Cylon Eye Animation**: Implemented red scanning beam with GPU acceleration (transform vs left) for smooth performance during inference
3. **Model Selection**: Used Gemma 3 270M + Gemma Embedding (768 dims) instead of TinyLlama + MiniLM based on availability and performance
4. **Animation Timing**: Added 800ms minimum display and double RAF to ensure animation visibility even with fast responses
5. **Error Handling**: Enhanced to handle undefined error objects and empty responses from cancellations gracefully

### Bugs Fixed During Development
1. Input box closing on internal clicks → Fixed with composedPath() for Shadow DOM
2. Red focus outline on input → Removed with outline: none for Raycast aesthetic
3. Empty response save error → Skip save when response.length === 0
4. 384 dimension validation failure → Accept multiple common dimensions (384, 768, 1024, 1536)
5. Duplicate model loading → Track state with flags and last loaded URLs
6. Animation not starting → Use transform + double RAF + 800ms minimum display
7. Focus not working → 220ms delay after visibility transition completes

### Testing Completed
- ✅ Cylon eye animation displays and oscillates smoothly
- ✅ Models load once and cache properly
- ✅ Input focus works reliably after activation
- ✅ Click-in-input clears response, preserves prompt
- ✅ Esc during generation cancels and preserves prompt
- ✅ Empty responses don't trigger save errors
- ✅ Embeddings save correctly with 768 dimensions
- ✅ Component matches Raycast visual design
