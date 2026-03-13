#!/bin/bash
# Deploy to Google Cloud Run
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#
# Usage:
#   ./deploy.sh
#
# The GOOGLE_GENERATIVE_AI_API_KEYS secret must exist in Secret Manager.
# Create it with:
#   echo -n "key1,key2,..." | gcloud secrets create gemini-api-keys --data-file=-

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project)
REGION="${REGION:-us-central1}"
SERVICE_NAME="phantom-server"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
SECRET_NAME="gemini-api-keys"

echo "Building image..."
gcloud builds submit --tag "${IMAGE}" .

echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets "GOOGLE_GENERATIVE_AI_API_KEYS=${SECRET_NAME}:latest" \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 3600 \
  --session-affinity

echo "Done."
gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)'
