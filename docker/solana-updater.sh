#!/usr/bin/env bash
set -euo pipefail

PUBLIC_DIR="${PUBLIC_DIR:-/app/public}"
SNAPSHOT="${PUBLIC_DIR}/snapshot.json"
EPOCH="${PUBLIC_DIR}/epoch.json"

INTERVAL_SECONDS="${INTERVAL_SECONDS:-1}"
RPC_URLS=(
  "${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
)

mkdir -p "$PUBLIC_DIR"

run_with_fallback() {
  local cmd="$1"
  local output_file="$2"
  local tmp_file="${output_file}.tmp"

  for rpc in "${RPC_URLS[@]}"; do
    if solana -u "$rpc" $cmd --output json > "$tmp_file"; then
      mv -f "$tmp_file" "$output_file"
      return 0
    fi
  done

  rm -f "$tmp_file"
  return 1
}

while true; do
  run_with_fallback "validators" "$SNAPSHOT" || true
  run_with_fallback "epoch-info" "$EPOCH" || true

  sleep "$INTERVAL_SECONDS"
done