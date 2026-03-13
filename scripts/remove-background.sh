#!/bin/bash
# Remove black background from images and make transparent.
#
# Usage:
#   ./remove-background.sh <image.png> [--fuzz 25%] [--color black]
#
# Examples:
#   ./remove-background.sh mascot.png
#   ./remove-background.sh mascot.png --fuzz 30%
#   ./remove-background.sh mascot.png --color white
#   ./remove-background.sh *.png

set -euo pipefail

FUZZ="25%"
COLOR="black"

files=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fuzz) FUZZ="$2"; shift 2 ;;
    --color) COLOR="$2"; shift 2 ;;
    *) files+=("$1"); shift ;;
  esac
done

if [ ${#files[@]} -eq 0 ]; then
  echo "Usage: remove-background.sh <image.png> [--fuzz 25%] [--color black]"
  exit 1
fi

for f in "${files[@]}"; do
  magick "$f" -fuzz "$FUZZ" -transparent "$COLOR" "$f"
  echo "Fixed: $f"
done
