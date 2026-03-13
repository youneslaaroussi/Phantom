## How it actually works

Phantom is a Chrome extension (built with Plasmo) that opens a side panel. When you tap the mic button, it:

1. Opens a WebSocket to the Gemini Live API (either directly with your key, or through our Cloud Run proxy)
2. Streams your microphone audio as PCM at 16kHz
3. Receives spoken responses AND function calls in the same stream
4. Executes browser tools — clicking, typing, scrolling, navigating tabs
5. Optionally streams your screen at 1 FPS so the model can see what you see

The key insight: Gemini Live's `realtimeInput` lets you send audio and video frames simultaneously. The model processes them together. So when you say "click the blue button," it can actually see the blue button in the video stream and figure out which element you mean.

### The proxy problem

Free API keys have rate limits. We rotate through multiple keys on the server side, and the Cloud Run proxy handles the WebSocket relay. The client never sees the API key.

One painful discovery: when proxying WebSocket frames through Node.js, the `ws` library's default `maxPayload` silently drops large messages. Our 100KB JPEG frames were vanishing. A one-line fix (`maxPayload: 10 * 1024 * 1024`) solved hours of "why is the model hallucinating what's on screen."

### The tool system

The model has access to 14 browser tools via Gemini's function calling:

- **Navigation**: openTab, getTabs, switchTab, getPageTitle
- **Interaction**: clickOn, typeInto, pressKey, highlightElement
- **Inspection**: getAccessibilitySnapshot, findElements
- **Movement**: scrollDown, scrollUp, scrollToElement

Each tool plays its own sound effect (generated via ElevenLabs' SFX API) — a soft whoosh for navigation, crystal clicks for typing, gentle chimes for success.
