# Phantom

<div align="center">

**Voice-controlled AI agent that can see and interact with any website**

**Real-time conversation · Screen vision · Browser automation**

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Gemini Live](https://img.shields.io/badge/Gemini-Live_API-4285F4)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-Run-4285F4?logo=googlecloud&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌──────────────┐
│   Chrome     │◄──────────────────►│  Cloud Run   │◄──────────────────►│  Gemini Live │
│  Extension   │   audio + tools    │    Proxy     │     relay          │     API      │
│  (Plasmo)    │                    │   (Hono)     │                    │  2.0-flash   │
└──────────────┘                    └──────────────┘                    └──────────────┘
       │                                    │
       ▼                                    ▼
  Any Website                         Landing Page
  (DOM control)
```

## Packages

| Package | Description |
|---------|-------------|
| [`extension/`](./extension/) | Chrome extension — voice UI, browser tools, vision system |
| [`server/`](./server/) | Cloud Run proxy — WebSocket relay + landing page |

## Quick Start

### Extension

```bash
cd extension
pnpm install
pnpm dev
# Load build/chrome-mv3-dev in Chrome
```

### Server

```bash
cd server
npm install
GEMINI_API_KEY=AIza... npm run dev
```

See each package's README for full setup instructions.

## License

MIT — See [LICENSE](./extension/LICENSE)
