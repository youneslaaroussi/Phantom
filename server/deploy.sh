#!/bin/bash
# Deploy to Google Cloud Run
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#
# Usage:
#   GEMINI_API_KEY=AIza... ./deploy.sh

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project)
REGION="${REGION:-us-central1}"
SERVICE_NAME="phantom-server"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "Error: GEMINI_API_KEY not set"
  echo "Usage: GEMINI_API_KEY=AIza... ./deploy.sh"
  exit 1
fi

echo "Building image..."
gcloud builds submit --tag "${IMAGE}" .

echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 3600 \
  --session-affinity

echo "Done."
gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)'
