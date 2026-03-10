# Phantom

Cloud-native AI voice agent for Chrome. Talk to Gemini, control any website by voice.

## What is this?

Phantom is a Chrome extension that connects you to Gemini Live for real-time voice conversations. It can see and interact with any website — clicking buttons, filling forms, navigating tabs — all through natural speech.

Unlike Marionette (which runs on-device via Gemini Nano), Phantom is cloud-first. One API key, zero local models, full Gemini capabilities.

## Features

- **Real-time voice chat** — bidirectional audio streaming via Gemini Live API
- **Browser control** — 12 tools: screenshots, accessibility tree, click, fill, scroll, tabs
- **WebGL visualizer** — GPU-accelerated wave that responds to speech
- **Voice selection** — 8 Gemini voices (Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr)
- **Text fallback** — type commands when you can't speak

## Setup

1. Get a [Gemini API key](https://aistudio.google.com/apikey) (free)
2. Load the extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked)
3. Click the extension icon, paste your key
4. Tap the mic and talk

## Development

```bash
pnpm install
pnpm dev
```

## Architecture

```
phantom/
├── lib/
│   ├── live/          # Gemini Live WebSocket client
│   │   ├── client.ts  # Connection, audio streaming, tool dispatch
│   │   ├── audio.ts   # PCM capture (16kHz) + playback (24kHz)
│   │   └── types.ts   # Protocol types
│   ├── api-key.ts     # chrome.storage API key management
│   ├── session.tsx     # React context for session lifecycle
│   └── tools.ts       # Browser tool declarations + execution
├── components/
│   ├── voice-screen.tsx    # Main UI
│   ├── settings-screen.tsx # Key management
│   ├── setup-screen.tsx    # First-run onboarding
│   └── wave-visualizer.tsx # WebGL simplex noise wave
├── sidepanel.tsx      # Side panel entry
├── popup.tsx          # Popup entry
└── background.ts      # Service worker
```

## License

MIT
