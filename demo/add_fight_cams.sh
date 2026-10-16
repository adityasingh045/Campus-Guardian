#!/usr/bin/env bash
# LIVE DEMO SCRIPT — run from the repo root DURING the presentation.
#
# Instantly adds the two fight-replay cameras to the running system with
# NO restart (this is the backend's runtime source-add API — a genuine
# "we scale from 2 to 10 cameras with zero downtime" talking point).
#
# Both cameras share zone "Main Corridor", so the platform raises ONE
# incident and attaches the second camera as an "additional angle"
# (one Telegram alert + an angle follow-up, no duplicate siren).
#
# Usage:
#   bash demo/add_fight_cams.sh /abs/path/to/fight.mp4 /abs/path/to/fight_angle2.mp4

set -euo pipefail

VIDEO_A="${1:?usage: bash demo/add_fight_cams.sh /abs/path/fight.mp4 /abs/path/fight_angle2.mp4}"
VIDEO_B="${2:?usage: bash demo/add_fight_cams.sh /abs/path/fight.mp4 /abs/path/fight_angle2.mp4}"

[ -f "$VIDEO_A" ] || { echo "ERROR: $VIDEO_A not found (use an ABSOLUTE path)" >&2; exit 1; }
[ -f "$VIDEO_B" ] || { echo "ERROR: $VIDEO_B not found (use an ABSOLUTE path)" >&2; exit 1; }
[ -f backend/.env ] || { echo "ERROR: run from the repo root (backend/.env not found)" >&2; exit 1; }

API="http://localhost:8000/api/sources"
KEY="$(grep -E '^API_KEY=' backend/.env | head -1 | cut -d= -f2- | tr -d '\r\n"')"
[ -n "$KEY" ] || { echo "ERROR: API_KEY not found in backend/.env" >&2; exit 1; }

echo "==> Adding CAM-FIGHT-A (Main Corridor - West) ..."
curl -sf -X POST "$API" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d "{\"source_id\":\"CAM-FIGHT-A\",\"source_type\":\"uploaded_video\",\"uri\":\"$VIDEO_A\",\"location\":\"Main Corridor - West\",\"zone\":\"Main Corridor\",\"enabled\":true}"
echo

sleep 3

echo "==> Adding CAM-FIGHT-B (Main Corridor - East, same zone) ..."
curl -sf -X POST "$API" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d "{\"source_id\":\"CAM-FIGHT-B\",\"source_type\":\"uploaded_video\",\"uri\":\"$VIDEO_B\",\"location\":\"Main Corridor - East\",\"zone\":\"Main Corridor\",\"enabled\":true}"
echo

echo
echo "Done. Watch the dashboard:"
echo "  - two new tiles appear instantly (no restart)"
echo "  - ONE alert fires; the second camera attaches as 'additional angle'"
echo "  - open the incident -> 'Other angles' section shows both cameras"
