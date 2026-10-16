#!/usr/bin/env bash
# Remove the two fight-replay cameras after a rehearsal/demo run.
# (Runtime-added cameras disappear on backend restart anyway; this just
#  cleans up without restarting.)
#
# Usage (from repo root):  bash demo/remove_fight_cams.sh

set -euo pipefail

[ -f backend/.env ] || { echo "ERROR: run from the repo root (backend/.env not found)" >&2; exit 1; }
API="http://localhost:8000/api/sources"
KEY="$(grep -E '^API_KEY=' backend/.env | head -1 | cut -d= -f2- | tr -d '\r\n"')"

for ID in CAM-FIGHT-A CAM-FIGHT-B; do
  echo "==> Removing $ID ..."
  curl -s -X DELETE "$API/$ID" -H "X-API-Key: $KEY"
  echo
done
echo "Done."
