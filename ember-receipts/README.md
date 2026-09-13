# Ember Receipts

Per-wallet earnings receipts for [Embercurve](https://embercurve.fun), read from the Solana chain.

Ember publishes platform-wide totals on `/meteora` and a public payouts API — but both are
aggregate. There is no recipient field anywhere in their data, so nobody can see what a
*single wallet* earned. This fills that gap.

**Unofficial. Not affiliated with Embercurve.** Built by ANL.

## How it decides what counts

1. Ember's payout keeper is `GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp`. That was not
   assumed — it is the `fee_claimer` on the $EMBER pool config, and it was the fee payer and
   the debited token owner in all 26 sampled payout transactions from Ember's own API.
2. A transaction counts as a payout when the keeper **signed and funded it** and the wallet's
   **token balance went up**.
3. The credited amount is read from the transaction's own balance deltas, not from Ember's
   reported figure for the round. Those are not always the same number — one observed
   `holders` round reported 153.011418 MET while the transaction moved 237.798726.

Verified against sample transactions: payouts are plain SPL transfers (ComputeBudget + Token
program only), with no DEX program involved and nothing debited from the recipient — so
swaps where Ember may sponsor gas are not miscounted as earnings.

## Why it is fast

A wallet can hold hundreds of token accounts while only a handful could ever have received an
Ember payout. The scan intersects the wallet's mints with the mints the keeper holds an
account for, then only walks those accounts.

Measured on real wallets:

| Wallet | Token accounts | Scanned | Signatures | Payouts | Time |
|---|---|---|---|---|---|
| `2heJbC32…` | 510 | 22 | 3,399 | 264 | 66s |
| `7xDbVZyJ…` | 20 | 4 | 203 | 146 | 3.4s |
| `2TnrgMN6…` | 7 | 2 | 60 | 51 | 1.1s |

Caveat: if the keeper ever closed its account for a mint it once paid in, payouts in that
mint are not discoverable this way. $MET and $EMBER are always included regardless.

## Running it

```bash
npm install
cp .env.example .env     # add your RPC endpoint
npm run dev
npm run build
```

An RPC endpoint is required — this reads full transaction histories and public endpoints
cannot complete a scan. `VITE_RPC_URL` is compiled into the client bundle and is therefore
**public**: restrict the key to your domain in your provider's dashboard, or proxy it.

## Deploying to Vercel (from a phone)

The app lives in a subdirectory, so the one setting that matters is the root directory.

1. vercel.com → **Add New → Project** → import `Eienel/ptee`
2. **Root Directory → `ember-receipts`** (this is the step people miss)
3. Framework preset: Vite. Build and output are already set by `vercel.json`.
4. **Environment Variables → `VITE_RPC_URL`** = your RPC endpoint
5. Deploy

`VITE_RPC_URL` is compiled into the client bundle and is readable by anyone who opens the
site. Restrict the key to your deployed domain in your provider's dashboard before sharing
the link.

## Status

- The scan engine is validated end to end against three real wallets on a live endpoint.
- The layout, card and mobile breakpoints are covered by `npm run smoke`, which drives the
  real UI at 1100px and 390px against a stubbed RPC and fails on any console error or
  horizontal overflow.
- The browser's **live** RPC path could not be exercised in the development sandbox (its
  proxy drops the headless browser's TLS tunnels). The scan engine itself is validated
  against a live endpoint from Node, and the cards shown were rendered from real scans.
  First deploy is the real test of the in-browser fetch path.

## Known limits

- **Per-coin attribution is not available.** A receipt shows what you earned and in which
  token, but not which launched coin generated each payout. That mapping only exists in
  Ember's `/api/solana/payouts`, which has no recipient field and exposes roughly the last
  50 minutes with no pagination — so historical attribution would need a continuous indexer
  snapshotting that endpoint.
- **No USD values and no PnL.** Both need a historical price source; payout amounts here are
  in each token's own units.

## Layout

```
src/lib/constants.ts   keeper, mints, explorer links
src/lib/scan.ts        the scan engine: accounts -> signatures -> transactions -> credits
src/lib/tokens.ts      ticker resolution (Metaplex + Token-2022 metadata)
src/lib/png.ts         SVG -> PNG export, no dependencies
src/components/        the receipt card (SVG) and payout table
```
