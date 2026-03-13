#!/bin/bash
# Extract individual sprites from a spritesheet using connected-components detection.
#
# Usage:
#   ./extract-sprites.sh <spritesheet.png> <output-dir> [--threshold 5000] [--fuzz 25%]
#
# Examples:
#   ./extract-sprites.sh spritesheet.png ./frames/
#   ./extract-sprites.sh idle_sheet.png ./idle_frames/ --threshold 3000

set -euo pipefail

THRESHOLD=5000
FUZZ="10%"
MORPH_SIZE=5

files=()
OUTDIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --threshold) THRESHOLD="$2"; shift 2 ;;
    --fuzz) FUZZ="$2"; shift 2 ;;
    *) 
      if [ -z "$OUTDIR" ] && [ ${#files[@]} -gt 0 ]; then
        OUTDIR="$1"
      else
        files+=("$1")
      fi
      shift ;;
  esac
done

INPUT="${files[0]:-}"
if [ -z "$INPUT" ] || [ -z "$OUTDIR" ]; then
  echo "Usage: extract-sprites.sh <spritesheet.png> <output-dir> [--threshold 5000]"
  exit 1
fi

mkdir -p "$OUTDIR"

echo "Detecting sprites in $INPUT..."
magick "$INPUT" -alpha extract -threshold "$FUZZ" \
  -morphology Close "Disk:${MORPH_SIZE}" \
  -define "connected-components:area-threshold=${THRESHOLD}" \
  -define "connected-components:verbose=true" \
  -connected-components 8 null: 2>&1 | \
  grep -v "srgb(0,0,0)" | tail -n +2 | \
  while read line; do
    bbox=$(echo "$line" | awk '{print $2}')
    id=$(echo "$line" | awk -F: '{print $1}' | tr -d ' ')
    magick "$INPUT" -crop "$bbox" +repage "${OUTDIR}/frame_${id}.png"
    echo "  frame_${id}.png ($bbox)"
  done

echo "Done. Sprites saved to $OUTDIR"
