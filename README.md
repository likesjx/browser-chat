# Browser Chat - In-Browser AI Chat Component

A proof-of-concept Web Component that provides keyboard-activated (Cmd-K/Ctrl-K) access to in-browser AI chat using ONNX Runtime Web (via transformers.js) for client-side LLM inference.

## Features

- ⌨️ **Keyboard-First**: Activate with Cmd-K (Mac) or Ctrl-K (Windows/Linux)
- 🧠 **In-Browser AI**: Client-side LLM inference using ONNX Runtime Web (no external API calls)
- 📊 **Streaming Responses**: Tokens appear word-by-word as they're generated
- 💾 **Persistent History**: Conversation pairs stored in IndexedDB with embeddings for vector search
- 🎨 **Web Component**: Encapsulated Custom Element with Shadow DOM
- 🔒 **Privacy-First**: All data stays local, fully functional offline after initial load

## Quick Start

### Prerequisites

- Modern browser: Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+
- Local web server (required for ES6 modules)

### 1. Start Local Server

```bash
# Navigate to project root
cd browser-chat

# Start server (choose one):
python3 -m http.server 8000
# OR
npx http-server -p 8000
# OR (if using uv)
uv run python -m http.server 8000
```

### 2. Open in Browser

Navigate to: `http://localhost:8000/index.html`

**Note**: Models are loaded automatically from HuggingFace on first use and cached locally:
- **Gemma 3 270M** (~270MB) - Text generation model
  `onnx-community/gemma-3-270m-it-ONNX`
- **Gemma Embedding 300M** (~300MB) - Embedding model for vector storage (768 dimensions)
  `onnx-community/embeddinggemma-300m-ONNX`

The first load will take a few minutes to download (~570MB total). Subsequent loads are instant thanks to browser caching.

### 4. Use the Chat

1. Press **Cmd-K** (Mac) or **Ctrl-K** (Windows/Linux) to activate
2. Type your prompt
3. Press **Enter** to submit
4. Watch tokens stream in real-time!

Press **Esc** to:
- Cancel generation (preserves your prompt)
- Hide the component (when idle)

## Configuration

### HTML Attributes

```html
<chat-component
  model-url="./models/tinyllama-q8.onnx"
  embedding-url="./models/minilm-l6-q8.onnx"
  system-prompt="You are a helpful AI assistant."
  temperature="0.7"
  max-tokens="512"
  inference-timeout="30000"
></chat-component>
```

### Attribute Reference

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `model-url` | string | **required** | Path to ONNX model file |
| `embedding-url` | string | null | Path to embedding model (optional) |
| `system-prompt` | string | "You are a helpful AI assistant." | System message prepended to prompts |
| `temperature` | number | 0.7 | Sampling temperature (0.0-2.0, higher = more creative) |
| `max-tokens` | number | 512 | Maximum generation length (1-2048 tokens) |
| `inference-timeout` | number | 30000 | Generation timeout in milliseconds (1000-120000) |

### JavaScript API

```javascript
const chat = document.querySelector('chat-component');

// Programmatic control
chat.activate();  // Show component
chat.hide();      // Hide component

// Configuration
chat.temperature = 0.9;
chat.maxTokens = 1024;

// History management
const recent = await chat.getHistory(10);  // Get last 10 conversations
await chat.clearHistory();  // Clear all stored conversations

// State inspection
console.log(chat.isVisible);      // boolean
console.log(chat.isGenerating);   // boolean
console.log(chat.isModelLoaded);  // boolean
console.log(chat.conversationCount);  // number
```

## Browser Compatibility

### Minimum Versions
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Required Browser APIs
- Custom Elements v1
- Shadow DOM
- ES6 Modules (`<script type="module">`)
- WebAssembly
- IndexedDB
- Async/await

## Architecture

### File Structure
```
/
├── index.html              # Test page
├── src/
│   ├── chat-component.js   # Main Web Component
│   ├── model-manager.js    # ONNX model loading & inference
│   ├── storage-manager.js  # IndexedDB operations
│   └── styles.css          # Component styles
├── models/
│   ├── tinyllama-q8.onnx   # LLM model (user downloads)
│   └── minilm-l6-q8.onnx   # Embedding model (user downloads)
└── README.md
```

### Technology Stack
- **Language**: Vanilla JavaScript ES6+ (no build step)
- **LLM Inference**: ONNX Runtime Web
- **Embeddings**: Transformers.js
- **Storage**: IndexedDB
- **UI**: Custom Elements v1 + Shadow DOM

## Troubleshooting

### Component doesn't activate with Cmd-K

**Problem**: Pressing Cmd-K does nothing

**Solutions**:
1. Check browser console for errors
2. Verify script loaded: `console.log(customElements.get('chat-component'))`
3. Ensure you're using `<script type="module">`
4. Check that you're not in an input/textarea on the page

### Model fails to load

**Problem**: Error message "Failed to load model"

**Solutions**:
1. **Verify model file exists**: Check that model file is in `/models` directory
2. **Check file path**: Ensure `model-url` attribute matches actual file location
3. **CORS issues**: Must serve from local web server (not `file://` protocol)
4. **File format**: Confirm model is ONNX format (`.onnx` extension)
5. **Model compatibility**: Use ONNX opset 11+ for best browser support

Example error messages:
- `404 Not Found`: Model file doesn't exist at specified path
- `Failed to fetch`: CORS issue or network error
- `Invalid model format`: File is not ONNX or corrupted

### No streaming, response appears all at once

**Problem**: Full response displays immediately instead of word-by-word

**Solutions**:
1. Check model compatibility (some models don't support streaming)
2. Verify ONNX Runtime Web version is recent
3. Check browser console for streaming errors

### Storage quota exceeded

**Problem**: `QuotaExceededError` in console

**Solutions**:
1. **Clear history**: `await chat.clearHistory()` in DevTools console
2. **Browser settings**: Check browser storage limits (usually 50-100MB+)
3. **Manual clear**: DevTools → Application → IndexedDB → Clear storage

### UI freezes during generation

**Problem**: Browser becomes unresponsive during inference

**Solutions**:
1. Use smaller model (TinyLlama 1.1B recommended for POC)
2. Reduce `max-tokens` configuration
3. Check browser Task Manager for memory usage
4. Consider quantized models (int8 or int4) for better performance

### Embedding generation fails

**Problem**: Conversations save without embeddings

**Solutions**:
1. Verify `embedding-url` is set correctly
2. Check embedding model downloaded and accessible
3. Embedding failure doesn't block main chat (warning logged)
4. Can proceed without embeddings (vector search won't work)

## Performance

### Targets
- **First token**: <2 seconds (goal: <1 second)
- **UI responsiveness**: No freezing during generation
- **Memory**: <600MB total (models + runtime)
- **Offline**: Fully functional after initial load

### Optimization Tips
1. Use quantized models (int8 reduces size by ~4x, int4 by ~8x)
2. Smaller max-tokens for faster generation
3. Lower temperature for more deterministic (faster) generation
4. Test with different models to find best performance/quality balance

## Privacy & Security

- **No telemetry**: No analytics, no external API calls
- **Local storage**: All data in IndexedDB (user-clearable)
- **Offline-capable**: Works without network after initial load
- **XSS protection**: All user input and model output sanitized
- **CSP compatible**: No inline scripts, ES6 modules only

## Development

### No Build Step Required
All code runs directly in the browser via ES6 module imports. No transpilation, bundling, or build tools needed.

### Manual Testing
Open `/index.html` in your browser and follow the test scenarios in `specs/001-create-a-web/quickstart.md`.

### Browser DevTools
- **Console**: View event logs, errors, and debug output
- **Application → IndexedDB**: Inspect stored conversations
- **Network**: Monitor model downloads
- **Performance**: Profile inference latency

## License

MIT

## Contributing

This is a proof-of-concept project. Contributions welcome!

## Resources

- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/tutorials/web/)
- [Web Components MDN](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
