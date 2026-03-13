# I Built a Browser AI Agent in One Session — Here's What Happened

*This article was created for the Gemini Live Agent Challenge hackathon. #GeminiLiveAgentChallenge*

---

What if your browser had a friend? Not a chatbot. Not an assistant. A little spirit that floats next to your cursor, listens to your voice, watches your screen, and just... does things for you.

That's Phantom. And the weirdest part isn't what it does — it's how it got built.

## The premise was simple

I wanted to talk to my browser. Not type commands into a terminal. Not click through menus. Just say "open YouTube and search for lo-fi music" and have it happen.

The Gemini Live API made this possible — real-time bidirectional audio over WebSockets, with function calling baked in. The model can listen, talk back, AND execute tools, all in the same stream. No polling. No turn-based nonsense. Just a live conversation where the AI can actually do things.

## The part nobody talks about: building speed

Here's where it gets meta. I used Gemini as my coding agent throughout the entire build. Not just for boilerplate — for architecture decisions, debugging WebSocket frame formats, generating deployment scripts, even creating the mascot art.

The whole project — Chrome extension, Cloud Run proxy, landing page, 8 persona system, sound design, animated sprites, onboarding flow, trace debugger — was built in a single extended session. One human, one AI, rapid-fire iteration.
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
## The mascot changed everything

Halfway through the build, I had a working agent. It could hear, see, and act. But it felt like a tool. Functional. Sterile. The kind of thing you demo once and forget.

So I asked Gemini to generate pixel art mascots.

I fed it a prompt for a "one-eyed spirit wisp, ethereal blue-purple glow, 64x64 pixel art" and got back something with genuine character. A little floating creature with a single curious eye. It looked like it belonged in a SNES game.

Then I went further. I asked for variations: the same wisp wearing a detective hat, a crown, nerdy glasses, a pirate hat, headphones, a wizard hat, and tiny devil horns. Same style, same palette, all consistent. Gemini's image generation (via `gemini-2.5-flash-image`) kept the character recognizable across every variation.

These became **personas** — not just cosmetic skins, but full personality packages:

| Persona | Voice | Vibe |
|---------|-------|------|
| Phantom | Kore | Friendly, curious spirit |
| Sleuth | Charon | Noir detective, dramatic |
| Regent | Orus | Regal, dignified |
| Byte | Puck | Nerdy, excitable |
| Captain | Fenrir | Pirate, adventurous |
| Vibe | Aoede | Chill, laid back |
| Arcane | Zephyr | Mystical wizard |
| Gremlin | Leda | Chaotic, mischievous |

Each persona has its own Gemini voice, mascot image, and system prompt that shapes how the agent talks. When you pick "Captain," the agent calls websites "islands" and says "aye aye!" When you pick "Gremlin," it's gleefully chaotic but still gets the job done.

Users pick their persona during onboarding. It's the second screen they see, right after "Hey, I'm Phantom." Judges remember characters. They forget features.
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
