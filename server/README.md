# Phantom Server

Backend proxy and landing page for [Phantom](https://github.com/youneslaaroussi/phantom), the AI voice agent Chrome extension.

## What it does

1. **WebSocket proxy** (`/ws/live`) — Relays audio between the Phantom extension and Gemini Live API. API key stays server-side.
2. **Landing page** — Static site explaining what Phantom is and how to install it.
3. **Health check** (`/health`) — For Cloud Run readiness probes.

## Architecture

```
Browser Extension  ←→  Cloud Run (this server)  ←→  Gemini Live API
     audio/tools           WebSocket relay            WebSocket
```

The extension connects to `/ws/live`. The server opens a parallel WebSocket to Gemini's Live API using the server-side API key, and relays messages bidirectionally.

## Deploy to Cloud Run

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
GEMINI_API_KEY=AIza... ./deploy.sh
```

## Local development

```bash
cp .env.example .env  # add your GEMINI_API_KEY
npm install
npm run dev
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Gemini API key for Live API access |
| `PORT` | No | Server port (default: 8080) |
