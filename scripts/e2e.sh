#!/usr/bin/env bash
# Runs the reclaim end to end against a local validator loaded with the real
# deployed Token Program binary.
#
# Requires the Agave CLI: sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
set -euo pipefail

LEDGER="$(mktemp -d)/ledger"
TOKEN_PROGRAM=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

[ -f tests/fixtures/token.so ] || node scripts/dump-program.mjs

# The test imports the app's own instruction builder, so the encoding under
# test is the one the browser ships.
npx esbuild src/lib/withdraw.ts --bundle --format=esm --platform=node \
  --external:@solana/web3.js --external:buffer --outfile=tests/.withdraw.mjs --log-level=warning

solana-test-validator --reset --quiet --ledger "$LEDGER" \
  --bpf-program "$TOKEN_PROGRAM" tests/fixtures/token.so &
VALIDATOR=$!
trap 'kill $VALIDATOR 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -s -X POST -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' http://127.0.0.1:8899 | grep -q ok; then
    break
  fi
  sleep 1
done

node tests/e2e.mjs
