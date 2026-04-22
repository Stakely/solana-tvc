#!/usr/bin/env bash
set -euo pipefail

solana-updater &
UPDATER_PID="$!"

node server.js &
NEXT_PID="$!"

terminate() {
  kill -TERM "$UPDATER_PID" "$NEXT_PID" 2>/dev/null || true
  wait || true
}
trap terminate TERM INT

wait -n "$UPDATER_PID" "$NEXT_PID"
terminate
