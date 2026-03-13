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
