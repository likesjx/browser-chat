# Quickstart: Interactive Chat Web Component

**Feature**: 001-create-a-web
**Date**: 2025-10-01
**Phase**: 1 - Integration & Testing Guide

## Overview
This quickstart guide provides step-by-step instructions for integrating and testing the `<chat-component>` Web Component. It validates all functional requirements from the specification through manual browser testing.

---

## Prerequisites

Before starting, ensure you have:

1. **Modern browser**: Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+
2. **ONNX models downloaded**:
   - TinyLlama 1.1B quantized (int8, ~550MB)
   - all-MiniLM-L6-v2 quantized (~23MB) [optional]
3. **Local web server** (required for ES6 modules):
   - Python: `python3 -m http.server 8000`
   - Node.js: `npx http-server -p 8000`
   - VS Code: Live Server extension

---

## Quick Start (5 Minutes)

### Step 1: Create Test Page

Create `index.html` in your project root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Component Test</title>
</head>
<body>
  <h1>Browser Chat POC</h1>
  <p>Press <kbd>Cmd-K</kbd> (Mac) or <kbd>Ctrl-K</kbd> (Windows/Linux) to activate chat.</p>

  <!-- Web Component -->
  <chat-component
    model-url="./models/tinyllama-q8.onnx"
    embedding-url="./models/minilm-l6-q8.onnx"
    system-prompt="You are a helpful AI assistant."
    temperature="0.7"
    max-tokens="512"
  ></chat-component>

  <!-- Component Script (ES6 Module) -->
  <script type="module" src="./src/chat-component.js"></script>
</body>
</html>
```

### Step 2: Start Local Server

```bash
# Navigate to project root
cd browser-chat

# Start server (choose one)
python3 -m http.server 8000
# OR
npx http-server -p 8000
```

### Step 3: Open in Browser

```
http://localhost:8000/index.html
```

### Step 4: Activate Component

Press **Cmd-K** (Mac) or **Ctrl-K** (Windows/Linux)

✅ **Expected**: Chat input box appears with focus

### Step 5: Submit Prompt

Type: `What is a Web Component?`
Press **Enter**

✅ **Expected**:
- Loading indicator appears
- Tokens stream word-by-word
- Response displayed below input
- Focus moves to response area

### Step 6: Verify Storage

Open **Browser DevTools** → **Application** → **IndexedDB** → **chat-component-db** → **conversations**

✅ **Expected**: One record with prompt, response, embedding, timestamp

---

## Detailed Testing Scenarios

### Scenario 1: Component Activation (FR-001)

**Objective**: Verify keyboard shortcut activates component

**Steps**:
1. Open test page in browser
2. Ensure component is initially hidden
3. Press **Cmd-K** (Mac) or **Ctrl-K** (Windows/Linux)

**Expected Results**:
- ✅ Component becomes visible
- ✅ Input box receives focus
- ✅ Cursor in input ready for typing
- ✅ No page scroll or layout shift

**Success Criteria**: Component visible with focused input

---

### Scenario 2: Prompt Submission & Streaming (FR-002, FR-013)

**Objective**: Verify text input and streaming response display

**Steps**:
1. Activate component (Cmd-K)
2. Type prompt: `Explain async/await in JavaScript in one sentence.`
3. Press **Enter**

**Expected Results**:
- ✅ Input remains visible with submitted text
- ✅ Loading indicator appears in response area (if model still loading)
- ✅ Tokens appear word-by-word (streaming)
- ✅ Response completes within 5 seconds (for short prompt)
- ✅ No UI freezing during generation

**Success Criteria**: Streaming tokens visible, UI responsive

---

### Scenario 3: Focus Management (FR-006)

**Objective**: Verify focus moves to response after generation

**Steps**:
1. Submit prompt (see Scenario 2)
2. Wait for generation to complete
3. Observe focus indicator (blue outline)

**Expected Results**:
- ✅ Focus moves from input to response area
- ✅ Response area has visible focus ring/outline
- ✅ Tab key cycles focus within component

**Success Criteria**: Response area has focus after generation

---

### Scenario 4: Response Clearing (FR-007)

**Objective**: Verify clicking input clears response

**Steps**:
1. Complete Scenario 2 (response visible)
2. Click inside the input box

**Expected Results**:
- ✅ Response text disappears
- ✅ Input text remains (not cleared)
- ✅ Focus returns to input
- ✅ Component still visible

**Success Criteria**: Response cleared, input preserved

---

### Scenario 5: Component Dismissal (FR-008, FR-009)

**Objective**: Verify Esc and outside-click hide component

**Test 5a: Esc Key (No Active Generation)**
1. Activate component, DO NOT submit prompt
2. Press **Esc**

**Expected**: Component hides, input cleared

**Test 5b: Click Outside**
1. Activate component
2. Click anywhere outside component boundaries

**Expected**: Component hides, input cleared

**Test 5c: Esc During Generation (FR-014a)**
1. Submit long prompt (e.g., "Write a 200-word essay...")
2. Press **Esc** while tokens streaming

**Expected**:
- ✅ Generation stops immediately
- ✅ Partial response disappears
- ✅ Prompt text PRESERVED in input
- ✅ Component remains visible

**Success Criteria**: Esc behavior differs based on generation state

---

### Scenario 6: Generation Cancellation (FR-014a)

**Objective**: Verify Esc cancels generation but preserves prompt

**Steps**:
1. Activate component
2. Submit prompt: `Write a 500-word story about space exploration.`
3. Wait for 5-10 tokens to stream
4. Press **Esc**

**Expected Results**:
- ✅ Streaming stops immediately
- ✅ Partial response cleared
- ✅ Input box shows original prompt
- ✅ Component still visible
- ✅ Can resubmit same prompt (Enter)

**Success Criteria**: Prompt preserved, generation cancelled

---

### Scenario 7: Model Loading with Queue (FR-014)

**Objective**: Verify prompt queuing when model still loading

**Steps**:
1. Refresh page (model unloaded)
2. Immediately press Cmd-K and submit prompt BEFORE model loads
3. Observe loading indicator

**Expected Results**:
- ✅ Loading indicator appears in response area
- ✅ Prompt is queued (not rejected)
- ✅ Generation starts automatically when model ready
- ✅ No error message shown

**Success Criteria**: Prompt queued, generation deferred until model ready

---

### Scenario 8: Error Handling & Retry (FR-015)

**Objective**: Verify error display and manual retry mechanism

**Test 8a: Simulate Model Failure**
1. Set `model-url` to invalid path: `model-url="./invalid.onnx"`
2. Refresh page, activate component
3. Submit prompt

**Expected**:
- ✅ Error message in response area: "Failed to load model: 404 Not Found"
- ✅ Retry button visible
- ✅ Prompt preserved in input

**Test 8b: Manual Retry**
1. Update `model-url` to correct path (via DevTools or page reload)
2. Click **Retry** button

**Expected**:
- ✅ Error clears
- ✅ Generation starts with preserved prompt
- ✅ Response streams successfully

**Success Criteria**: Error message with working retry button

---

### Scenario 9: Keyboard Shortcut Precedence (FR-016)

**Objective**: Verify component intercepts Cmd-K/Ctrl-K

**Steps**:
1. Add a page-level Cmd-K listener (via browser extension or test script):
   ```javascript
   document.addEventListener('keydown', (e) => {
     if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
       console.log('Page received Cmd-K');
     }
   });
   ```
2. Press **Cmd-K**

**Expected Results**:
- ✅ Component activates
- ✅ Console DOES NOT log "Page received Cmd-K" (event prevented)
- ✅ No browser search bar opens (default Cmd-K behavior blocked)

**Success Criteria**: Component takes precedence over page shortcuts

---

### Scenario 10: Storage Persistence (FR-010, FR-011)

**Objective**: Verify conversation pairs saved to IndexedDB

**Steps**:
1. Submit prompt and receive response (see Scenario 2)
2. Open DevTools → Application → IndexedDB → `chat-component-db`
3. Inspect `conversations` object store

**Expected Results**:
- ✅ One record present with:
  - `id` (timestamp)
  - `prompt` (exact user input)
  - `response` (full model output)
  - `embedding` (Float32Array with 384 elements)
  - `modelVersion` (e.g., "tinyllama-q8")
  - `timestamp` (Date object)

**Success Criteria**: Complete ConversationPair stored with embedding

---

### Scenario 11: Storage Quota Exceeded (FR-017)

**Objective**: Verify error message when storage quota reached

**Steps** (Requires DevTools Storage Emulation):
1. Open DevTools → Application → Storage
2. Enable "Simulate custom storage quota"
3. Set quota to 5MB
4. Submit 100+ prompts to fill quota
5. Submit one more prompt

**Expected Results**:
- ✅ Generation completes normally
- ✅ Error message: "Storage quota exceeded. Clear history to continue saving conversations."
- ✅ Response still displayed (not blocked)
- ✅ Console warning logged

**Success Criteria**: Error message shown, generation not blocked

---

### Scenario 12: Multi-line Prompt (FR-003)

**Objective**: Verify multi-line text input support

**Steps**:
1. Activate component
2. Type:
   ```
   Explain these concepts:
   1. Closures
   2. Promises
   3. Async/await
   ```
3. Use **Shift-Enter** for new lines
4. Press **Enter** to submit

**Expected Results**:
- ✅ Multi-line text accepted in input
- ✅ Shift-Enter creates new line (doesn't submit)
- ✅ Enter submits prompt
- ✅ Full multi-line prompt sent to model

**Success Criteria**: Multi-line input supported

---

### Scenario 13: Configuration Changes (Principle V)

**Objective**: Verify configuration parameters work

**Steps**:
1. Open DevTools Console
2. Run:
   ```javascript
   const chat = document.querySelector('chat-component');
   chat.temperature = 1.5;  // High creativity
   chat.maxTokens = 256;    // Shorter responses
   ```
3. Submit prompt: `Tell me a creative story.`

**Expected Results**:
- ✅ Response reflects high temperature (more varied)
- ✅ Response length ≤256 tokens (truncated if needed)
- ✅ Console logs confirm config applied

**Success Criteria**: Configuration parameters affect generation

---

### Scenario 14: History Retrieval

**Objective**: Verify getHistory() method

**Steps**:
1. Submit 3 different prompts
2. Open DevTools Console
3. Run:
   ```javascript
   const chat = document.querySelector('chat-component');
   const history = await chat.getHistory(10);
   console.log(history);
   ```

**Expected Results**:
- ✅ Array of 3 ConversationPair objects returned
- ✅ Objects in reverse chronological order (newest first)
- ✅ Each object has prompt, response, timestamp, modelVersion
- ✅ No embedding field (excluded for size)

**Success Criteria**: getHistory() returns recent conversations

---

### Scenario 15: History Clearing

**Objective**: Verify clearHistory() method

**Steps**:
1. Submit several prompts (see Scenario 14)
2. Open DevTools Console
3. Run:
   ```javascript
   const chat = document.querySelector('chat-component');
   await chat.clearHistory();
   console.log(chat.conversationCount); // Should be 0
   ```
4. Verify IndexedDB in DevTools (conversations store should be empty)

**Expected Results**:
- ✅ All records deleted from IndexedDB
- ✅ `conversationCount` property = 0
- ✅ `history-cleared` event dispatched
- ✅ No errors in console

**Success Criteria**: History cleared successfully

---

### Scenario 16: Cross-Browser Testing

**Objective**: Verify component works in multiple browsers

**Steps**:
1. Test Scenarios 1-15 in:
   - ✅ Chrome 90+
   - ✅ Firefox 88+
   - ✅ Safari 14+ (if available)

**Expected Results**:
- ✅ All scenarios pass in each browser
- ✅ No browser-specific errors
- ✅ Consistent UI appearance (within reason)

**Success Criteria**: Component functional in all target browsers

---

### Scenario 17: Offline Functionality (FR-012)

**Objective**: Verify offline operation after initial load

**Steps**:
1. Load page with model downloaded
2. Wait for model to load (check console logs)
3. Open DevTools → Network → Enable "Offline" mode
4. Submit prompt

**Expected Results**:
- ✅ Generation works offline
- ✅ No network requests during inference
- ✅ Storage writes succeed
- ✅ No errors related to network

**Success Criteria**: Full functionality without network

---

## Performance Validation

### First Token Latency
**Target**: <2 seconds (goal: <1 second)

**Test**:
1. Submit short prompt: `Hello!`
2. Measure time from Enter press to first token appearance

**Pass Criteria**: First token within 2 seconds

---

### UI Responsiveness
**Target**: UI remains responsive during generation

**Test**:
1. Submit long prompt (generates 500+ tokens)
2. Try to:
   - Press Esc (should cancel)
   - Click input (should work)
   - Scroll page (should be smooth)

**Pass Criteria**: No UI freezing, all interactions work

---

### Memory Usage
**Target**: <600MB total for loaded models

**Test**:
1. Open DevTools → Performance/Memory tab
2. Take heap snapshot after model load
3. Check memory usage

**Pass Criteria**: Total <700MB (includes browser overhead)

---

## Troubleshooting

### Issue: Component Doesn't Appear
**Symptoms**: Cmd-K does nothing
**Checks**:
1. Check console for errors
2. Verify script loaded: `console.log(customElements.get('chat-component'))`
3. Verify Shadow DOM rendered: Inspect element in DevTools

**Fix**: Ensure ES6 module loaded, no syntax errors

---

### Issue: Model Load Fails
**Symptoms**: Error message "Failed to load model"
**Checks**:
1. Verify model file exists at specified URL
2. Check browser console for CORS errors
3. Confirm model format is ONNX (not PyTorch/TensorFlow)

**Fix**: Download correct model, serve from same origin

---

### Issue: No Streaming, Full Response Appears
**Symptoms**: Response appears all at once
**Checks**:
1. Check if model supports streaming (some don't)
2. Verify ONNX Runtime Web version (needs recent version)

**Fix**: Use streaming-compatible model

---

### Issue: Storage Quota Errors
**Symptoms**: "QuotaExceededError" in console
**Checks**:
1. Check IndexedDB size in DevTools
2. Browser quota limits vary (check browser settings)

**Fix**: Call `clearHistory()` or browser "Clear Site Data"

---

## Success Checklist

### Core Functionality
- [ ] Cmd-K/Ctrl-K activates component
- [ ] Prompt submission triggers generation
- [ ] Tokens stream progressively
- [ ] Focus moves to response after generation
- [ ] Click input clears response
- [ ] Esc/outside-click hides component

### Advanced Features
- [ ] Esc during generation cancels but preserves prompt
- [ ] Model loading queues prompts with indicator
- [ ] Error messages displayed with retry button
- [ ] Component blocks page Cmd-K shortcuts

### Data Persistence
- [ ] Conversation pairs saved to IndexedDB
- [ ] Embeddings stored (Float32Array)
- [ ] History retrieval works
- [ ] History clearing works
- [ ] Quota exceeded error handled

### Performance
- [ ] First token <2 seconds
- [ ] UI responsive during generation
- [ ] Offline functionality works
- [ ] Memory usage acceptable

### Cross-Browser
- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] (Optional) Tested in Safari

---

## Next Steps

After successful quickstart validation:

1. **Run /tasks command**: Generate detailed implementation task list
2. **Implement component**: Follow task order (TDD approach)
3. **Iterate on test page**: Add more test scenarios as needed
4. **Optimize performance**: Profile and tune if needed
5. **Document learnings**: Update README with model recommendations

---

**Phase 1 Quickstart Complete**: Manual testing guide ready for implementation validation.
