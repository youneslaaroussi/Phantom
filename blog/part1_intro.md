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
