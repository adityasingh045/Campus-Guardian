#!/usr/bin/env bash
# Create a simulated "second camera angle" from your existing fight video.
#
#   BEST option: re-shoot the staged fight with TWO phones recording at once
#   from different corners — that gives you two genuinely different angles.
#
#   This script is the fallback when you only have one video: it mirrors the
#   footage, reframes it (crop + zoom) and slightly shifts color/timing, so
#   on a dashboard tile it reads as a camera on the opposite side of the
#   corridor. The detector still detects the fight in it.
#
# Requires ffmpeg:  brew install ffmpeg
#
# Usage:
#   bash demo/make_angle2.sh /path/to/fight.mp4
#   -> creates /path/to/fight_angle2.mp4

set -euo pipefail

IN="${1:?usage: bash demo/make_angle2.sh /path/to/fight.mp4}"
OUT="${2:-${IN%.*}_angle2.mp4}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it with:  brew install ffmpeg" >&2
  exit 1
fi

# hflip       = mirror (opposite side of the corridor)
# crop+scale  = different framing / zoom level
# eq          = slightly different exposure, like a different camera unit
# -ss 0.6     = starts ~half a second later, like a second camera would
ffmpeg -y -ss 0.6 -i "$IN" \
  -vf "hflip,crop=in_w*0.88:in_h*0.88,scale=-2:720,eq=brightness=0.02:saturation=0.93" \
  -an "$OUT"

echo
echo "Created: $OUT"
echo "Preview it with:  open \"$OUT\""
