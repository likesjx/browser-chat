# Quickstart: Testing Web Worker Implementation

**Feature**: Move Model Inference to Web Worker
**Date**: 2025-10-23

## Overview

This quickstart provides step-by-step manual testing scenarios to verify the Web Worker implementation meets all functional requirements from spec.md. Each test maps to acceptance scenarios from the feature specification.

## Prerequisites

1. **Local web server running**:
   ```bash
   cd /Users/jaredlikes/code/browser-chat
   python3 -m http.server 8000
   ```

2. **Browser open**:
   - Navigate to `http://localhost:8000/index.html`
   - Open DevTools Console (Cmd+Option+J / Ctrl+Shift+J)

3. **Test preparation**:
   - Clear IndexedDB: DevTools → Application → IndexedDB → Delete
   - Clear cache: DevTools → Network → Disable cache checkbox
   - Ensure no other tabs are using the model (fresh browser session)

## Test Scenarios

### Scenario 1: Non-Blocking Model Load (FR-001)

**Requirement**: System MUST keep the browser UI responsive during model downloads (570MB)

**Steps**:
1. Open `http://localhost:8000/index.html` in fresh tab
2. Immediately after page load, try to:
   - Scroll the page
   - Click buttons
   - Type in input fields (if any)
   - Switch browser tabs

**Expected**:
- Page remains responsive during entire model download
- Console shows loading progress updates
- No browser "Page Unresponsive" warnings
- Can interact with other tabs without lag

**Pass Criteria**:
- ✅ Scrolling is smooth throughout load
- ✅ Buttons respond to clicks immediately
- ✅ Input accepts keystrokes without delay
- ✅ Loading progress appears in UI

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 2: Activate Chat During Model Load (Acceptance #1)

**Requirement**: System MUST allow chat activation while model is loading

**Steps**:
1. Refresh page (Cmd+R / Ctrl+R)
2. Immediately press **Cmd-K** (Mac) or **Ctrl-K** (Windows/Linux)
3. Observe chat interface appearance
4. Type a prompt in the input field
5. Try to scroll the page while model loads

**Expected**:
- Chat interface appears instantly (<50ms)
- Input field is ready and accepts typing immediately
- Page scrolling works smoothly
- Model loading indicator visible in chat

**Pass Criteria**:
- ✅ Chat appears within 100ms of Cmd-K
- ✅ Input accepts characters immediately
- ✅ Loading indicator shows progress
- ✅ Page remains scrollable

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 3: Responsive UI During Generation (Acceptance #2)

**Requirement**: System MUST allow page interactions while AI is generating

**Steps**:
1. Wait for model to finish loading
2. Press **Cmd-K** and enter prompt: "Write a long story about a dragon"
3. Press **Enter** to start generation
4. While generation is in progress, try to:
   - Scroll the page up/down
   - Click outside the chat component
   - Switch to another browser tab and back
   - Type in the browser address bar

**Expected**:
- Tokens stream into chat response area
- Page scrolls smoothly during generation
- Clicks register immediately
- Tab switching is instant
- Address bar accepts input without delay

**Pass Criteria**:
- ✅ Scrolling has no lag or frame drops
- ✅ Clicks respond within 100ms
- ✅ Tab switching is smooth
- ✅ Tokens continue streaming during interactions

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 4: Immediate Cancellation (Acceptance #3, FR-004)

**Requirement**: System MUST support immediate cancellation without UI freeze

**Steps**:
1. Start generation with: "Write a very long story with many details"
2. Wait for ~5-10 tokens to appear
3. Press **Esc** key
4. Measure time from Esc to UI control return

**Expected**:
- Generation stops within 100ms of Esc
- Partial response remains visible
- Input field becomes active again
- No "Page Unresponsive" warning

**Pass Criteria**:
- ✅ Generation stops in <100ms
- ✅ Partial text preserved
- ✅ Input field regains focus
- ✅ No browser freeze

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 5: Typing During Generation (Acceptance #4)

**Requirement**: Keyboard input MUST appear without delay during AI operations

**Steps**:
1. Start generation: "Tell me about the ocean"
2. While tokens are streaming, press **Cmd-K** again
3. Immediately start typing a new prompt: "What is 2+2?"
4. Verify all characters appear in order

**Expected**:
- Input field activates immediately
- All typed characters appear in sequence
- No dropped keystrokes
- Response continues streaming in background

**Pass Criteria**:
- ✅ Input appears within 50ms of Cmd-K
- ✅ All characters typed appear correctly
- ✅ No missing or duplicated characters
- ✅ Original response still visible

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 6: Multiple Rapid Prompts (Edge Case - FR-005, FR-006)

**Requirement**: System MUST queue prompts and process sequentially without blocking UI

**Steps**:
1. Ensure model is loaded
2. Press **Cmd-K**, type "First prompt", press Enter
3. Immediately press **Cmd-K** again, type "Second prompt", press Enter
4. Repeat for "Third prompt"
5. Observe processing order

**Expected**:
- All prompts queued successfully
- Each processed in FIFO order
- UI remains responsive during queuing
- Console shows queue status (if logged)

**Pass Criteria**:
- ✅ All 3 prompts accepted
- ✅ Responses appear in order (1st, 2nd, 3rd)
- ✅ No UI freezing during rapid input
- ✅ Each generation completes before next starts

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 7: Model Load Failure (Edge Case - FR-008)

**Requirement**: System MUST handle load errors gracefully without browser freeze

**Steps**:
1. Close current tab
2. Edit `index.html` to use invalid model URL: `model-url="invalid-model-404"`
3. Reload page
4. Press **Cmd-K** and try to submit a prompt

**Expected**:
- Clear error message displayed in chat
- UI remains responsive
- Console shows categorized error (network/404)
- No browser crash or "Page Unresponsive" warning

**Pass Criteria**:
- ✅ Error message visible in UI
- ✅ Page remains interactive
- ✅ Error type identified in console
- ✅ Can retry with different model (if supported)

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 8: Tab Close During Load (Edge Case - FR-009)

**Requirement**: Background loading MUST terminate cleanly without memory leaks

**Steps**:
1. Open fresh tab to `http://localhost:8000/index.html`
2. Wait 5 seconds (model starts downloading)
3. Close tab immediately
4. Open browser Task Manager (Chrome: Shift+Esc)
5. Verify no orphaned processes

**Expected**:
- Tab closes immediately
- No "Page Unresponsive" warning
- Worker process terminates
- Memory released

**Pass Criteria**:
- ✅ Tab closes in <1 second
- ✅ No zombie processes in Task Manager
- ✅ Memory freed (check before/after)
- ✅ No console errors in remaining tabs

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 9: Response Quality (FR-010)

**Requirement**: System MUST maintain same response quality and streaming behavior

**Steps**:
1. Complete model load
2. Submit prompt: "Explain photosynthesis in simple terms"
3. Compare with previous implementation:
   - Streaming speed (visual perception)
   - Response coherence
   - Token-by-token appearance

**Expected**:
- Streaming feels natural (~30ms per token)
- Response quality unchanged
- No truncation or corruption
- Same token boundaries (word-level)

**Pass Criteria**:
- ✅ Streaming speed feels identical
- ✅ Response makes sense (coherent)
- ✅ Full response displayed (no truncation)
- ✅ Word boundaries preserved

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

### Scenario 10: Low Memory Device (Edge Case)

**Requirement**: System MUST degrade gracefully on low-memory devices

**Steps** (Chrome DevTools simulation):
1. Open DevTools → Performance Monitor
2. Memory tab → Enable memory pressure
3. Attempt model load
4. Monitor for crashes or hangs

**Expected**:
- Load may be slower but completes or fails gracefully
- Clear error message if out of memory
- No browser crash
- Page remains usable after error

**Pass Criteria**:
- ✅ Either loads successfully or shows OOM error
- ✅ No browser crash or hang
- ✅ UI remains responsive
- ✅ Error category: 'oom' in console

**Actual Result**: ___________
**Status**: [ ] PASS [ ] FAIL
**Notes**: ___________

---

## Performance Validation

### Performance Requirement PR-001: UI Response Time

**Test**: Measure UI responsiveness during generation

**Steps**:
1. Start generation: "Write a paragraph about trees"
2. While generating, use DevTools Performance tab
3. Record: Click a button, scroll page
4. Measure time to visual feedback

**Target**: <100ms for all interactions

**Results**:
- Click response time: _____ ms
- Scroll response time: _____ ms
- Status: [ ] PASS (<100ms) [ ] FAIL

---

### Performance Requirement PR-002: Keyboard Shortcuts

**Test**: Measure Cmd-K response time

**Steps**:
1. Press Cmd-K during idle, loading, and generating states
2. Measure time from keypress to chat appearance
3. Use high-speed screen recording if needed

**Target**: <50ms in all states

**Results**:
- Idle: _____ ms
- Loading: _____ ms
- Generating: _____ ms
- Status: [ ] PASS (<50ms) [ ] FAIL

---

### Performance Requirement PR-003: Message Passing

**Test**: Measure worker communication overhead

**Steps**:
1. Add console.time() around worker postMessage in code
2. Generate tokens and measure round-trip time
3. Calculate average latency

**Target**: <5ms for typical message

**Results**:
- Average latency: _____ ms
- Status: [ ] PASS (<5ms) [ ] FAIL

---

## Browser Compatibility (PR-004)

Test in each target browser:

### Chrome 90+
- Model load: [ ] PASS [ ] FAIL
- Token generation: [ ] PASS [ ] FAIL
- Cancellation: [ ] PASS [ ] FAIL
- Notes: ___________

### Firefox 88+
- Model load: [ ] PASS [ ] FAIL
- Token generation: [ ] PASS [ ] FAIL
- Cancellation: [ ] PASS [ ] FAIL
- Notes: ___________

### Safari 14+
- Model load: [ ] PASS [ ] FAIL
- Token generation: [ ] PASS [ ] FAIL
- Cancellation: [ ] PASS [ ] FAIL
- Notes: ___________

### Edge 90+
- Model load: [ ] PASS [ ] FAIL
- Token generation: [ ] PASS [ ] FAIL
- Cancellation: [ ] PASS [ ] FAIL
- Notes: ___________

---

## Summary

**Total Scenarios**: 10
**Scenarios Passed**: _____
**Scenarios Failed**: _____

**Performance Tests**: 3
**Performance Passed**: _____
**Performance Failed**: _____

**Browser Tests**: 4
**Browsers Passed**: _____
**Browsers Failed**: _____

**Overall Status**: [ ] READY FOR PRODUCTION [ ] NEEDS FIXES

**Critical Issues**:
1. ___________
2. ___________
3. ___________

**Notes**:
___________
___________
___________

---

## Troubleshooting

### Chat Doesn't Activate
- Check console for worker creation errors
- Verify `model-worker.js` path is correct
- Ensure browser supports ES6 module workers

### UI Still Freezes
- Verify worker is actually running (check Network tab)
- Check if worker-manager properly creates worker
- Confirm postMessage calls are non-blocking

### Tokens Don't Stream
- Check worker message handler processes 'generate'
- Verify token messages sent from worker
- Confirm main thread listener receives messages

### Memory Leaks
- Ensure dispose() called on component unmount
- Verify worker terminates on page close
- Check for orphaned message listeners

---

**Last Updated**: 2025-10-23
**Next Review**: After implementation complete
