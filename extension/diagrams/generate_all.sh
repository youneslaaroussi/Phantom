#!/bin/bash
# Generate all Phantom diagrams

echo "Generating Phantom diagrams..."

for diagram in *.py; do
    echo "  $diagram..."
    python3 "$diagram"
done

echo ""
echo "Generated:"
ls -lh *.png 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
