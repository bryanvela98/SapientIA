#!/usr/bin/env bash
set -euo pipefail
BASE=${BASE:-http://localhost:8000}

echo "=== 1. create learner ==="
LID=$(curl -s -X POST "$BASE/learner" \
    -H 'content-type: application/json' \
    -d '{"accessibility_profile":{}}' | jq -r '.id')
echo "learner: $LID"

echo "=== 2. create session ==="
SID=$(curl -s -X POST "$BASE/session" \
    -H "X-Learner-ID: $LID" \
    -H 'content-type: application/json' \
    -d '{"topic":"Photosynthesis"}' | jq -r '.id')
echo "session: $SID"

echo "=== 3. turn 1 (SSE stream) ==="
curl -N -X POST "$BASE/session/$SID/turn" \
    -H 'content-type: application/json' \
    -d '{"message":"What is photosynthesis?"}'
echo

echo "=== 4. turn 2 ==="
curl -N -X POST "$BASE/session/$SID/turn" \
    -H 'content-type: application/json' \
    -d '{"message":"I think plants use sunlight somehow."}'
echo

echo "=== 5. final state ==="
curl -s "$BASE/session/$SID/state" | jq