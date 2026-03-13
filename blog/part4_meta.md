## The meta layer: AI building AI

The most honest thing I can say about this project is that it was a collaboration between a human with ideas and an AI with execution speed.

Here's what Gemini specifically helped build:

- **Architecture**: The WebSocket proxy, tool system, and session management were pair-programmed with a coding agent
- **Mascot art**: All 9 character variations generated via `gemini-2.5-flash-image` with img2img — I provided the base wisp and asked for costume variations
- **Sprite animations**: 4 spritesheets (idle, listening, talking, thinking) generated from the same base character
- **Debugging**: When the vision proxy wasn't working, the agent wrote a direct-vs-proxy comparison test that isolated the `maxPayload` bug
- **Deployment**: The Cloud Run setup, Artifact Registry config, Secret Manager integration, and service account creation were all scripted live

The sound effects came from ElevenLabs' SFX API — text descriptions like "soft magical chime, fairy-like sparkle, UI connect sound" turned into actual audio files that now play when you connect, toggle vision, or execute a tool.

What took days in previous projects took hours here. Not because the code was simpler, but because the iteration loop was: idea → implement → test → fix → next, with no context-switching overhead.

## What I learned

1. **Character sells**. A pixel art wisp with a detective hat is more memorable than any feature list.
2. **Sound matters**. A tiny chime when you connect makes the whole experience feel 10x more polished.
3. **The Live API is undersold**. Bidirectional audio + function calling + video input in one WebSocket is genuinely new. Most demos treat it as a voice chatbot. It's actually an agent runtime.
4. **AI-assisted development isn't cheating** — it's the new normal. The human still makes every creative and architectural decision. The AI just removes the friction between thinking and doing.

## Try it

Phantom is open source. Install the Chrome extension, pick a persona, and start talking to your browser.

**GitHub**: [github.com/youneslaaroussi/Phantom](https://github.com/youneslaaroussi/Phantom)
**Live site**: [phantom-server-175557989181.us-central1.run.app](https://phantom-server-175557989181.us-central1.run.app)

---

*Built for the Gemini Live Agent Challenge. #GeminiLiveAgentChallenge*
