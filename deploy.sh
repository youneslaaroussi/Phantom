#!/bin/bash
set -euo pipefail

PROJECT_ID="mr-claude-prod"
REGION="us-central1"
SERVICE_NAME="phantom-server"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/phantom/${SERVICE_NAME}:latest"
REPO="youneslaaroussi/Phantom"

echo "=== Phantom Automated Deployment ==="
echo ""

# 1. Build and deploy server to Cloud Run
echo "[1/4] Building server Docker image..."
docker build --platform linux/amd64 -t "${IMAGE}" ./server

echo "[1/4] Pushing to Artifact Registry..."
docker push "${IMAGE}"

echo "[1/4] Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets "GOOGLE_GENERATIVE_AI_API_KEYS=gemini-api-keys:latest" \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 3600 \
  --session-affinity

SERVER_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')
echo "[1/4] Server live at: ${SERVER_URL}"
echo ""

# 2. Build extension
echo "[2/4] Building Chrome extension..."
cd extension
npm ci --silent
npm run build
cd ..

# 3. Package extension as zip
echo "[3/4] Packaging extension..."
EXTENSION_DIR="extension/build/chrome-mv3-prod"
VERSION=$(node -e "console.log(require('./extension/package.json').version)")
ZIP_NAME="phantom-chrome-v${VERSION}.zip"

cd "${EXTENSION_DIR}"
zip -r "../../../${ZIP_NAME}" . -x "*.DS_Store"
cd ../../..
echo "[3/4] Packaged: ${ZIP_NAME}"
echo ""

# 4. Create GitHub release
echo "[4/4] Creating GitHub release..."
TAG="v${VERSION}"

if gh release view "${TAG}" --repo "${REPO}" &>/dev/null; then
  echo "[4/4] Release ${TAG} exists, uploading asset..."
  gh release upload "${TAG}" "${ZIP_NAME}" --repo "${REPO}" --clobber
else
  gh release create "${TAG}" "${ZIP_NAME}" \
    --repo "${REPO}" \
    --title "Phantom ${TAG}" \
    --notes "$(cat <<'EOF'
## Phantom ${TAG}

AI voice agent for Chrome — talk to your browser, it does the rest.

### Install
1. Download `phantom-chrome-v${VERSION}.zip`
2. Unzip it
3. Go to `chrome://extensions`, enable Developer Mode
4. Click "Load unpacked" and select the unzipped folder
5. Click the Phantom icon in the toolbar

### What's new
- Wisp mascot with 8 personality personas
- Sound effects for all actions
- Vision mode with live screen streaming
- Trace viewer for debugging
- Animated onboarding flow
EOF
)"
fi

echo "[4/4] Release: https://github.com/${REPO}/releases/tag/${TAG}"
echo ""
echo "=== Deployment complete ==="
echo "Server:    ${SERVER_URL}"
echo "Release:   https://github.com/${REPO}/releases/tag/${TAG}"
echo "Extension: ${ZIP_NAME}"
