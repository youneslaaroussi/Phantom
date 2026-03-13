#!/bin/bash
# Combine individual frame images into a horizontal sprite strip.
#
# Usage:
#   ./make-spritestrip.sh <output.png> <frame-size> <frame1.png> <frame2.png> ...
#
# Examples:
#   ./make-spritestrip.sh idle_sheet.png 128 frames/frame_*.png
#   ./make-spritestrip.sh talk_sheet.png 64 f1.png f2.png f3.png f4.png

set -euo pipefail

OUTPUT="${1:?Usage: make-spritestrip.sh <output.png> <frame-size> <frames...>}"
SIZE="${2:?Provide frame size (e.g. 128)}"
shift 2

if [ $# -eq 0 ]; then
  echo "No frame files provided"
  exit 1
fi

magick "$@" -resize "${SIZE}x${SIZE}" \
  -background none -gravity center -extent "${SIZE}x${SIZE}" \
  +append "$OUTPUT"

W=$(magick identify -format "%w" "$OUTPUT")
H=$(magick identify -format "%h" "$OUTPUT")
echo "Created: $OUTPUT (${W}x${H}, $# frames)"
