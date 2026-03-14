# Phantom

<div align="center">

**Talk to your browser. It listens.**

Voice-powered AI agent for Chrome — clicks, scrolls, reads, and navigates for you.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Gemini Live](https://img.shields.io/badge/Gemini-Live_API-34A853)
![Google Cloud](https://img.shields.io/badge/Cloud_Run-4285F4?logo=googlecloud&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

[Website](https://phantom-server-pio3n3nsna-uc.a.run.app) · [Blog](https://phantom-server-pio3n3nsna-uc.a.run.app/blog) · [Download](https://github.com/youneslaaroussi/Phantom/releases/latest)

</div>

---

## Architecture

<div align="center">
<img src="docs/system-architecture.svg" alt="System Architecture" />
</div>

## Voice Interaction Loop

<div align="center">
<img src="docs/voice-loop.svg" alt="Voice Interaction Loop" />
</div>

## Privacy Shield

Sensitive content is automatically blurred before any screenshot reaches the AI.

<div align="center">
<img src="docs/privacy-pipeline.svg" alt="Privacy Shield Pipeline" />
</div>

## Features

| Feature | Description |
|---------|-------------|
| **Voice chat** | Real-time bidirectional audio via Gemini Live API (WebSocket) |
| **Screen vision** | 1fps JPEG streaming — Phantom sees what you see |
| **20 browser tools** | Click, type, scroll, highlight, accessibility snapshot, computer use |
| **Memory** | User profile + session memories with local vector embeddings (all-MiniLM-L6-v2) |
| **Content actions** | Highlight text on page for AI summary, rewrite, explain, translate |
| **Privacy shield** | Auto-blurs passwords, credit cards, API keys, SSNs before screenshots |
| **9 personas** | Each with unique voice, sprite animations, and personality |
| **Computer use** | AI vision coordinate clicking for canvas, iframes, complex UIs |
| **Tab audio** | Stream page audio to the model — it can hear what you hear |
| **Session resumption** | Seamless reconnect after WebSocket resets |
| **Context compression** | Sliding window for longer sessions |
| **Affective dialog** | Model reads tone and emotion from your voice |

## 🧩 Google Technology Stack

| Technology | Usage | Where |
|---|---|---|
| **Gemini 2.5 Flash Native Audio** | Real-time voice conversations via Live API (WebSocket) | Extension ↔ Server |
| **Gemini Live API** | Bidirectional audio streaming, function calling, session resumption | Extension ↔ Server |
| **Native Audio Output** | HD voice synthesis with 30 voices, 24 languages | Server (Gemini SDK) |
| **Affective Dialog** | Model reads tone and emotion from user's voice | Server (`v1alpha`) |
| **Proactive Audio** | Model decides when to respond vs. stay silent | Server (`v1alpha`) |
| **Context Window Compression** | Sliding window for extended sessions beyond 15min | Server config |
| **Audio Transcription** | Real-time input/output speech-to-text | Server config |
| **Google Search Grounding** | Model can search the web for current information | Server (tool) |
| **@google/genai SDK** | Server-side Gemini Live session management | Server |
| **Google Cloud Run** | Hosts WebSocket proxy server, auto-scaling | Server deployment |
| **Google Fonts** | Google Sans / Google Sans Text typography | Extension + Website |

### 🔌 Chrome Extension APIs

| API | Usage |
|---|---|
| `chrome.sidePanel` | Main UI lives in the Chrome side panel |
| `chrome.scripting` | Inject scripts for clicks, scrolling, typing, DOM reading, page effects |
| `chrome.tabs` | Tab management, navigation, switching, querying |
| `chrome.tabCapture` | Stream tab audio to the AI model |
| `chrome.storage` | Persist settings, personas, traces, memories locally |
| `chrome.runtime` | Background messaging, asset URLs, extension lifecycle |
| `chrome.commands` | Global keyboard shortcut (Alt+P) for voice toggle |
| `host_permissions` | `<all_urls>` for script injection on any page |
| `Manifest V3` | Modern extension platform with service worker |

### 🌐 Chrome Web Platform APIs

| API | Usage |
|---|---|
| `WebSocket` | Persistent connection to Gemini Live API via proxy |
| `MediaDevices.getUserMedia` | Microphone capture for voice input |
| `AudioContext / ScriptProcessor` | PCM audio processing for Gemini-compatible format |
| `navigator.permissions` | Check/request microphone permission state |
| `WebGL` | GPU-accelerated page launch effects (ripple, vortex, shatter) and wave visualizer |
| `CSS Animations` | Page-injected effects (iris, EQ bars, sparkles, shatter fragments) |
| `WASM` | Local embedding model (all-MiniLM-L6-v2) via Transformers.js |

## Quick Start

### 1. Install the extension

Download from [Releases](https://github.com/youneslaaroussi/Phantom/releases/latest), unzip, load unpacked in `chrome://extensions`.

### 2. Get a Gemini API key

Free from [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Talk

Open the side panel, pick a persona, tap the mic.

## Development

```bash
# Extension
cd extension && pnpm install && pnpm dev
# Load build/chrome-mv3-dev in Chrome

# Server
cd server && npm install && GEMINI_API_KEY=AIza... npm run dev
```

## Packages

| Package | Description |
|---------|-------------|
| [`extension/`](./extension/) | Chrome extension — voice UI, browser tools, vision, memory |
| [`server/`](./server/) | Cloud Run proxy — WebSocket relay, content actions, computer use |
| [`blog/`](./blog/) | Building story article |
| [`docs/`](./docs/) | Architecture diagrams (SVG) |
| [`scripts/`](./scripts/) | Asset generation (mascots, sprites, SFX) |

## License

MIT
