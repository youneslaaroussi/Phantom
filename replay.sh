#!/bin/bash
set -e

PHANTOM="/root/.openclaw/workspace-mrclaude2/phantom"
SERVER="/root/.openclaw/workspace-mrclaude2/phantom-server"
MONO="/root/.openclaw/workspace-mrclaude2/phantom-monorepo"

cd "$MONO"

# Get phantom commit info
PHANTOM_LOG=$(cd "$PHANTOM" && git log --reverse --format='%H|%aI|%s')
SERVER_LOG=$(cd "$SERVER" && git log --reverse --format='%H|%aI|%s')

# Process each phantom commit
while IFS='|' read -r hash date msg; do
  # Clear and repopulate extension/ from this commit
  rm -rf extension/
  mkdir -p extension
  (cd "$PHANTOM" && git archive "$hash") | tar x -C extension/
  
  git add -A
  GIT_COMMITTER_DATE="$date" GIT_AUTHOR_DATE="$date" \
    git commit -m "extension: $msg" --date="$date" --allow-empty 2>/dev/null || true
  
  echo "✓ $date  extension: $msg"
done <<< "$PHANTOM_LOG"

# Now add server commits
while IFS='|' read -r hash date msg; do
  rm -rf server/
  mkdir -p server
  (cd "$SERVER" && git archive "$hash") | tar x -C server/
  
  git add -A
  GIT_COMMITTER_DATE="$date" GIT_AUTHOR_DATE="$date" \
    git commit -m "server: $msg" --date="$date" --allow-empty 2>/dev/null || true
  
  echo "✓ $date  server: $msg"
done <<< "$SERVER_LOG"

# Add root README as final commit
cat > README.md << 'ROOTREADME'
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
ROOTREADME

git add README.md
D="2026-03-12T18:30:00"
GIT_COMMITTER_DATE="$D" GIT_AUTHOR_DATE="$D" \
  git commit -m "docs: root README with monorepo structure" --date="$D"

echo ""
echo "=== Done ==="
git log --oneline --format='%ad  %s' --date=format:'%b %d %H:%M'
