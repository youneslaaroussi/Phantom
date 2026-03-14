---
title: I Built a Voice-Controlled Browser Agent in One Session — Here's What Happened
published: true
tags: ai, gemini, hackathon, webdev
cover_image: https://raw.githubusercontent.com/youneslaaroussi/Phantom/main/extension/assets/icon.png
---

What if your browser had a friend? Not another chatbot in a sidebar. A companion that actually sees your screen, hears your voice, and acts on your behalf.

That's Phantom. And the weirdest part isn't what it does — it's how it got built.

For anyone who's ever wished they could just tell their browser what to do — whether their hands are full, their eyes are tired, or they just don't want to click through 15 menus — this is for you.

## The premise was simple

I wanted to talk to my browser. Not type commands into a terminal. Not click through menus. Just say "open YouTube and search for lo-fi music" and have it happen.

The Gemini Live API made this possible — real-time bidirectional audio over WebSockets, with function calling baked in. The model can listen, talk back, AND execute tools, all in the same stream. No polling. No turn-based nonsense. Just a live conversation where the AI can actually do things.

## The part nobody talks about: building speed

Here's where it gets meta. I used AI-assisted development throughout the entire build. Not just for boilerplate — for architecture decisions, debugging WebSocket frame formats, generating deployment scripts, even creating the mascot art.

The whole project — Chrome extension, Cloud Run proxy, landing page, 8 persona system, sound design, animated sprites, onboarding flow, trace debugger — was built in a single extended session. Rapid-fire iteration with AI-assisted development, where I directed every creative and architectural decision while the AI removed the friction between thinking and doing.

![Phantom Architecture](https://raw.githubusercontent.com/youneslaaroussi/Phantom/main/blog/architecture-diagram.svg)

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

![Voice Interaction Loop](https://raw.githubusercontent.com/youneslaaroussi/Phantom/main/blog/voice-loop-diagram.svg)

### The tool system

The model has access to 20 browser tools via Gemini's function calling:

- **Navigation**: openTab, getTabs, switchTab, getPageTitle
- **Interaction**: clickOn, typeInto, pressKey, highlightElement
- **Inspection**: getAccessibilitySnapshot, findElements
- **Movement**: scrollDown, scrollUp, scrollToElement
- **AI Vision**: computerAction, contentAction
- **Memory**: rememberThis, recallMemory, updateUserProfile

Each tool plays its own sound effect (generated via ElevenLabs' SFX API) — a soft whoosh for navigation, crystal clicks for typing, gentle chimes for success.

### The "dead zone" problem

Here's something nobody warns you about when building AI agents: the model goes silent after tool calls.

The agent calls `openTab` to search for pizza places. Chrome opens the tab, the page loads, Google shows results. But the agent? It got the tool result — `"Opened https://..."` — and just stopped. It had no idea a page loaded. It couldn't see that the search results appeared. It was sitting there, perfectly content, waiting for the user to say something.

The fix was a **Browser Events module** — a tiny system that listens to Chrome browser APIs (`chrome.tabs.onUpdated`, `chrome.tabs.onActivated`) and pushes world-state changes to Gemini as `[EVENT]` text messages. When a page finishes loading, the agent gets `[EVENT] Page loaded: "Google Search — nearest pizza places"`. When the user switches tabs, the agent gets `[EVENT] Switched to tab: "Gmail"`.

![Browser Events Loop](https://raw.githubusercontent.com/youneslaaroussi/Phantom/main/docs/browser-events.svg)

This creates a proactive loop: **tool → browser event → tool → browser event**. The agent calls `openTab`, the page loads, the Events module fires a page-loaded event, Gemini sees the new page and decides to click a result, that click triggers another page load, another event fires, and the agent keeps going until the task is done.

Without it, the agent acts once and stalls. With it, the agent chains actions autonomously.

## Privacy Shield: What the AI Never Sees

Here's the uncomfortable truth about screen-sharing AI agents: they see everything. Your passwords. Your credit cards. Your API keys. Every token, every secret, every SSN on screen — all of it gets sent as JPEG frames to a remote model.

We built **Privacy Shield** to fix this.

![Privacy Shield Pipeline](https://raw.githubusercontent.com/youneslaaroussi/Phantom/main/blog/privacy-pipeline-diagram.svg)

### How it works

Before every single frame capture (once per second), Phantom injects a script into the active page that:

1. **Scans the DOM** for sensitive inputs — password fields, credit card inputs, anything with `autocomplete="cc-number"`, inputs named `ssn`, `token`, `api_key`, etc.
2. **Scans visible text** for PII patterns — credit card numbers, Social Security numbers, API keys (Google, OpenAI, AWS, ElevenLabs), bearer tokens, private keys
3. **Applies a CSS blur** to every match
4. **Captures the screenshot** — the JPEG now has sensitive content blurred
5. **Removes the blur** instantly — the user never sees it (~30ms round trip)

The result: Gemini sees your screen, but never sees your secrets.

### What it catches

| Category | Pattern |
|----------|---------|
| Passwords | All `type="password"` inputs, login forms |
| Credit cards | `4111-1111-1111-1111` style numbers |
| SSNs | `123-45-6789` format |
| API keys | Google (`AIza...`), OpenAI (`sk-...`), AWS (`AKIA...`) |
| Tokens | Bearer tokens, private keys, generic secrets |
| Form context | Any input inside a `/login` or `/payment` form action |

### Zero latency, zero dependencies

No API calls. No cloud services. No model inference. Pure DOM analysis + regex, running in under 5ms per frame. For production, this could be augmented with Google Cloud DLP's 150+ infoType detectors — but for real-time 1 FPS streaming, the deterministic approach is faster and more reliable.

### Why this matters

Every screen-sharing AI tool should have this. Most don't. We tested Google Cloud DLP — it's thorough but takes ~2 seconds per request. At 1 FPS, that's unusable. Privacy Shield runs in 5ms and catches the patterns that matter most in a browser context.

This isn't a feature. It's a responsibility.

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

## The meta layer: building with what you're building on

I designed every feature, made every architectural decision, and directed the entire build. AI-assisted development handled the execution — pair-programming the WebSocket proxy, generating mascot variations via `gemini-2.5-flash-image`, writing deployment scripts, and isolating bugs like the `maxPayload` issue that was silently dropping vision frames.

The sound effects came from ElevenLabs' SFX API — text descriptions like "soft magical chime, fairy-like sparkle, UI connect sound" turned into actual audio files that now play when you connect, toggle vision, or execute a tool.

What took days in previous projects took hours here. Not because the code was simpler, but because the iteration loop was: idea → implement → test → fix → next, with no context-switching overhead.

## What I learned

1. **Character sells**. A pixel art wisp with a detective hat is more memorable than any feature list.
2. **Sound matters**. A tiny chime when you connect makes the whole experience feel 10x more polished.
3. **The Live API is undersold**. Bidirectional audio + function calling + video input in one WebSocket is genuinely new. Most demos treat it as a voice chatbot. It's actually an agent runtime.
4. **AI-assisted development is a multiplier**. The human still makes every creative and architectural decision. The AI removes the friction between thinking and doing.

## Try it

Phantom started as a question: what if your browser could hear you? 24 hours later, it can hear you, see your screen, protect your secrets, and talk back in 8 different voices. Built with Gemini, deployed on Cloud Run, available now as a Chrome extension.

Your browser has a new friend.

**GitHub**: [github.com/youneslaaroussi/Phantom](https://github.com/youneslaaroussi/Phantom)
**Live site**: [phantom-server-pio3n3nsna-uc.a.run.app](https://phantom-server-pio3n3nsna-uc.a.run.app)

---

*This article was created for the purposes of entering the Gemini Live Agent Challenge hackathon. #GeminiLiveAgentChallenge*
