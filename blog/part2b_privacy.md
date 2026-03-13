## Privacy Shield: What the AI Never Sees

Here's the uncomfortable truth about screen-sharing AI agents: they see everything. Your passwords. Your credit cards. Your API keys. Every token, every secret, every SSN on screen — all of it gets sent as JPEG frames to a remote model.

We built **Privacy Shield** to fix this.

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
