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
<svg viewBox="0 0 800 340" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:800px;margin:24px auto;display:block;font-family:'Google Sans',system-ui,sans-serif">
  <defs>
    <filter id="s1"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.1"/></filter>
    <marker id="ah" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#5F6368"/></marker>
  </defs>
  <!-- Background -->
  <rect width="800" height="340" rx="16" fill="#f8f9fa" stroke="#e8eaed" stroke-width="1"/>
  <!-- Chrome Extension zone -->
  <rect x="20" y="20" width="240" height="300" rx="12" fill="none" stroke="#c4c7c5" stroke-width="1" stroke-dasharray="6 4"/>
  <text x="140" y="44" text-anchor="middle" fill="#5F6368" font-size="11" font-weight="500">CHROME EXTENSION</text>
  <!-- Extension boxes -->
  <rect x="40" y="60" width="200" height="44" rx="8" fill="#fff" stroke="#e8eaed" filter="url(#s1)"/>
  <circle cx="62" cy="82" r="10" fill="#e8f0fe"/><text x="62" y="86" text-anchor="middle" fill="#4285F4" font-size="10">🎙</text>
  <text x="82" y="86" fill="#1f1f1f" font-size="13" font-weight="500">Voice Input (16kHz PCM)</text>
  <rect x="40" y="116" width="200" height="44" rx="8" fill="#fff" stroke="#e8eaed" filter="url(#s1)"/>
  <circle cx="62" cy="138" r="10" fill="#e6f4ea"/><text x="62" y="142" text-anchor="middle" fill="#34A853" font-size="10">👁</text>
  <text x="82" y="142" fill="#1f1f1f" font-size="13" font-weight="500">Vision (1fps JPEG)</text>
  <rect x="40" y="172" width="200" height="44" rx="8" fill="#fff" stroke="#e8eaed" filter="url(#s1)"/>
  <circle cx="62" cy="194" r="10" fill="#fef7e0"/><text x="62" y="198" text-anchor="middle" fill="#e37400" font-size="10">🔧</text>
  <text x="82" y="198" fill="#1f1f1f" font-size="13" font-weight="500">20 Browser Tools</text>
  <rect x="40" y="228" width="200" height="44" rx="8" fill="#fff" stroke="#e8eaed" filter="url(#s1)"/>
  <circle cx="62" cy="250" r="10" fill="#fce8e6"/><text x="62" y="254" text-anchor="middle" fill="#EA4335" font-size="10">🛡</text>
  <text x="82" y="254" fill="#1f1f1f" font-size="13" font-weight="500">Privacy Shield</text>
  <!-- Cloud Run Proxy -->
  <rect x="310" y="100" width="180" height="140" rx="12" fill="#fff" stroke="#4285F4" stroke-width="1.5" filter="url(#s1)"/>
  <rect x="310" y="100" width="180" height="32" rx="12" fill="#4285F4"/>
  <text x="400" y="120" text-anchor="middle" fill="#fff" font-size="12" font-weight="500">Cloud Run Proxy</text>
  <text x="400" y="152" text-anchor="middle" fill="#5F6368" font-size="11">WebSocket Relay</text>
  <text x="400" y="170" text-anchor="middle" fill="#5F6368" font-size="11">API Key Rotation</text>
  <text x="400" y="188" text-anchor="middle" fill="#5F6368" font-size="11">Session Resumption</text>
  <text x="400" y="206" text-anchor="middle" fill="#5F6368" font-size="11">Context Compression</text>
  <!-- Gemini -->
  <rect x="540" y="100" width="240" height="140" rx="12" fill="#fff" stroke="#34A853" stroke-width="1.5" filter="url(#s1)"/>
  <rect x="540" y="100" width="240" height="32" rx="12" fill="#34A853"/>
  <text x="660" y="120" text-anchor="middle" fill="#fff" font-size="12" font-weight="500">Gemini Live API</text>
  <text x="660" y="152" text-anchor="middle" fill="#5F6368" font-size="11">Native Audio (2.5 Flash)</text>
  <text x="660" y="170" text-anchor="middle" fill="#5F6368" font-size="11">Affective Dialog</text>
  <text x="660" y="188" text-anchor="middle" fill="#5F6368" font-size="11">Function Calling</text>
  <text x="660" y="206" text-anchor="middle" fill="#5F6368" font-size="11">Proactive Audio</text>
  <!-- Arrows -->
  <line x1="240" y1="140" x2="308" y2="160" stroke="#5F6368" stroke-width="1.5" marker-end="url(#ah)"/>
  <line x1="240" y1="194" x2="308" y2="180" stroke="#5F6368" stroke-width="1.5" marker-end="url(#ah)"/>
  <line x1="490" y1="165" x2="538" y2="165" stroke="#5F6368" stroke-width="1.5" marker-end="url(#ah)"/>
  <line x1="538" y1="175" x2="490" y2="175" stroke="#4285F4" stroke-width="1.5" marker-end="url(#ah)"/>
  <text x="514" y="158" text-anchor="middle" fill="#5F6368" font-size="9">WS</text>
  <!-- Memory box -->
  <rect x="310" y="270" width="180" height="50" rx="8" fill="#fff" stroke="#FBBC05" stroke-width="1.5" filter="url(#s1)"/>
  <text x="400" y="292" text-anchor="middle" fill="#1f1f1f" font-size="12" font-weight="500">Local Memory</text>
  <text x="400" y="308" text-anchor="middle" fill="#5F6368" font-size="10">IndexedDB + Embeddings</text>
  <line x1="200" y1="272" x2="308" y2="290" stroke="#FBBC05" stroke-width="1" stroke-dasharray="4 3"/>
</svg>

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

<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:800px;margin:24px auto;display:block;font-family:'Google Sans',system-ui,sans-serif">
  <defs>
    <filter id="s3"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.1"/></filter>
    <marker id="ah3" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#4285F4"/></marker>
    <marker id="ah3g" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#34A853"/></marker>
  </defs>
  <rect width="800" height="220" rx="16" fill="#f8f9fa" stroke="#e8eaed"/>
  <!-- User -->
  <rect x="30" y="70" width="120" height="80" rx="12" fill="#4285F4" filter="url(#s3)"/>
  <text x="90" y="108" text-anchor="middle" fill="#fff" font-size="13" font-weight="500">User</text>
  <text x="90" y="126" text-anchor="middle" fill="#d2e3fc" font-size="10">Voice + Screen</text>
  <!-- Gemini -->
  <rect x="340" y="30" width="140" height="70" rx="12" fill="#34A853" filter="url(#s3)"/>
  <text x="410" y="62" text-anchor="middle" fill="#fff" font-size="13" font-weight="500">Gemini Live</text>
  <text x="410" y="80" text-anchor="middle" fill="#e6f4ea" font-size="10">Think + Respond</text>
  <!-- Tools -->
  <rect x="340" y="120" width="140" height="70" rx="12" fill="#FBBC05" filter="url(#s3)"/>
  <text x="410" y="152" text-anchor="middle" fill="#1f1f1f" font-size="13" font-weight="500">Browser Tools</text>
  <text x="410" y="170" text-anchor="middle" fill="#5F6368" font-size="10">Click · Type · Scroll</text>
  <!-- Page -->
  <rect x="650" y="70" width="120" height="80" rx="12" fill="#fff" stroke="#e8eaed" stroke-width="1.5" filter="url(#s3)"/>
  <text x="710" y="108" text-anchor="middle" fill="#1f1f1f" font-size="13" font-weight="500">Web Page</text>
  <text x="710" y="126" text-anchor="middle" fill="#5F6368" font-size="10">DOM + Canvas</text>
  <!-- Arrows: User → Gemini (audio) -->
  <path d="M150,90 Q245,30 338,60" fill="none" stroke="#4285F4" stroke-width="1.5" marker-end="url(#ah3)"/>
  <text x="230" y="46" fill="#4285F4" font-size="10" font-weight="500">16kHz PCM Audio</text>
  <!-- Gemini → User (voice response) -->
  <path d="M338,75 Q245,130 152,110" fill="none" stroke="#34A853" stroke-width="1.5" marker-end="url(#ah3g)"/>
  <text x="220" y="118" fill="#34A853" font-size="10" font-weight="500">24kHz Voice Response</text>
  <!-- Gemini → Tools (function call) -->
  <line x1="410" y1="100" x2="410" y2="118" stroke="#5F6368" stroke-width="1.5" marker-end="url(#ah3)"/>
  <text x="440" y="112" fill="#5F6368" font-size="9">fn call</text>
  <!-- Tools → Page -->
  <line x1="480" y1="155" x2="648" y2="110" stroke="#FBBC05" stroke-width="1.5" marker-end="url(#ah3)"/>
  <text x="570" y="122" fill="#e37400" font-size="10" font-weight="500">Execute Action</text>
  <!-- Vision: Page → Gemini -->
  <path d="M710,70 Q710,10 480,45" fill="none" stroke="#5F6368" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#ah3)"/>
  <text x="610" y="22" fill="#5F6368" font-size="9">Screen frames (1fps)</text>
</svg>

### The tool system

The model has access to 14 browser tools via Gemini's function calling:

- **Navigation**: openTab, getTabs, switchTab, getPageTitle
- **Interaction**: clickOn, typeInto, pressKey, highlightElement
- **Inspection**: getAccessibilitySnapshot, findElements
- **Movement**: scrollDown, scrollUp, scrollToElement

Each tool plays its own sound effect (generated via ElevenLabs' SFX API) — a soft whoosh for navigation, crystal clicks for typing, gentle chimes for success.
## Privacy Shield: What the AI Never Sees

Here's the uncomfortable truth about screen-sharing AI agents: they see everything. Your passwords. Your credit cards. Your API keys. Every token, every secret, every SSN on screen — all of it gets sent as JPEG frames to a remote model.

We built **Privacy Shield** to fix this.

<svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:800px;margin:24px auto;display:block;font-family:'Google Sans',system-ui,sans-serif">
  <defs>
    <filter id="s2"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.1"/></filter>
    <marker id="ah2" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#5F6368"/></marker>
  </defs>
  <rect width="800" height="200" rx="16" fill="#f8f9fa" stroke="#e8eaed"/>
  <text x="400" y="28" text-anchor="middle" fill="#5F6368" font-size="11" font-weight="500">PRIVACY SHIELD PIPELINE (~30ms per frame)</text>
  <!-- Steps -->
  <rect x="20" y="50" width="130" height="60" rx="8" fill="#fff" stroke="#e8eaed" filter="url(#s2)"/>
  <text x="85" y="76" text-anchor="middle" fill="#1f1f1f" font-size="11" font-weight="500">DOM Scan</text>
  <text x="85" y="94" text-anchor="middle" fill="#5F6368" font-size="10">Inputs + Text</text>
  <rect x="180" y="50" width="130" height="60" rx="8" fill="#fff" stroke="#EA4335" filter="url(#s2)"/>
  <text x="245" y="76" text-anchor="middle" fill="#EA4335" font-size="11" font-weight="500">Apply Blur</text>
  <text x="245" y="94" text-anchor="middle" fill="#5F6368" font-size="10">CSS filter:blur(8px)</text>
  <rect x="340" y="50" width="130" height="60" rx="8" fill="#fff" stroke="#4285F4" filter="url(#s2)"/>
  <text x="405" y="76" text-anchor="middle" fill="#4285F4" font-size="11" font-weight="500">Capture Tab</text>
  <text x="405" y="94" text-anchor="middle" fill="#5F6368" font-size="10">JPEG Quality 50</text>
  <rect x="500" y="50" width="130" height="60" rx="8" fill="#fff" stroke="#34A853" filter="url(#s2)"/>
  <text x="565" y="76" text-anchor="middle" fill="#34A853" font-size="11" font-weight="500">Remove Blur</text>
  <text x="565" y="94" text-anchor="middle" fill="#5F6368" font-size="10">Restore styles</text>
  <rect x="660" y="50" width="120" height="60" rx="8" fill="#fff" stroke="#e8eaed" filter="url(#s2)"/>
  <text x="720" y="76" text-anchor="middle" fill="#1f1f1f" font-size="11" font-weight="500">Send to AI</text>
  <text x="720" y="94" text-anchor="middle" fill="#5F6368" font-size="10">Secrets blurred ✓</text>
  <!-- Arrows -->
  <line x1="150" y1="80" x2="178" y2="80" stroke="#5F6368" stroke-width="1.5" marker-end="url(#ah2)"/>
  <line x1="310" y1="80" x2="338" y2="80" stroke="#5F6368" stroke-width="1.5" marker-end="url(#ah2)"/>
  <line x1="470" y1="80" x2="498" y2="80" stroke="#5F6368" stroke-width="1.5" marker-end="url(#ah2)"/>
  <line x1="630" y1="80" x2="658" y2="80" stroke="#5F6368" stroke-width="1.5" marker-end="url(#ah2)"/>
  <!-- PII patterns -->
  <rect x="20" y="130" width="760" height="50" rx="8" fill="#fce8e6" stroke="#EA4335" stroke-width="0.5"/>
  <text x="400" y="152" text-anchor="middle" fill="#EA4335" font-size="11" font-weight="500">9 PII Categories Detected: Passwords · Credit Cards · SSNs · Google/OpenAI/AWS Keys · Bearer Tokens · Private Keys</text>
  <text x="400" y="170" text-anchor="middle" fill="#5F6368" font-size="10">Regex + DOM selectors + aria-label + login form detection · 47 tests passing · &lt;5ms per frame</text>
</svg>

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
