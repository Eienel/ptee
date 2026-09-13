# Ember Receipts

Read what a wallet has actually earned from [Embercurve](https://embercurve.fun), and what any
Ember-launched coin has done with its fees — straight from the Solana chain.

**Unofficial. Not affiliated with Embercurve.** Built by [@eienel_eth](https://x.com/eienel_eth).

One input takes either kind of address and answers the right question:

- a **wallet** → a receipt of every Ember payout it has received, exportable as a card
- a **token** → that coin's bonding curve, what it is paired with, and what Ember has paid out
  of its fees

---

## Why this exists

Ember publishes platform-wide totals on `/meteora` and a public payouts API, and those numbers
hold up — I checked a sample of them against the chain and they matched. But both are
**aggregate**. There is no recipient field anywhere in Ember's data, so no holder can see what
*they* were paid. That is the gap this fills.

## The wallet receipt

### How it decides what counts

1. Ember's payout keeper is `GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp`. That was not
   assumed — it is the `fee_claimer` on the $EMBER pool config, and it was the fee payer and
   the debited token owner in all 26 sampled payout transactions from Ember's own API.
2. A transaction counts as a payout when the keeper **signed and funded it** and the wallet's
   **token balance went up**.
3. The credited amount is read from the transaction's own balance deltas, not from Ember's
   reported figure for the round. Those are not always the same: one observed `holders` round
   reported 153.011418 MET while the transaction moved 237.798726.

### The false positive this had to avoid

If Ember sponsored gas on user swaps, then buying a coin would look like a payout — keeper pays
the fee, your balance goes up — and every receipt would be inflated. Sampled payout
transactions contain only ComputeBudget and Token program instructions, no DEX program, and
debit nothing from the recipient. They are plain transfers, so trades are not miscounted.

### Why it is fast

A wallet can hold hundreds of token accounts while only a handful could ever have received an
Ember payout. The scan intersects the wallet's mints with the mints the keeper holds an account
for, then walks only those.

Measured against live wallets on a real endpoint:

| Wallet | Token accounts | Scanned | Signatures | Payouts | Time |
|---|---|---|---|---|---|
| `2heJbC32…` | 510 | 22 | 3,399 | 264 | 66s |
| `7xDbVZyJ…` | 20 | 4 | 203 | 146 | 3.4s |
| `2TnrgMN6…` | 7 | 2 | 60 | 51 | 1.1s |

Caveat: if the keeper ever closed its account for a mint it once paid in, payouts in that mint
are not discoverable this way. $MET and $EMBER are always included regardless.

### Telling the earnings apart

Ember runs several payout modules — holder share, wheel, lotto, jackpots, creator fees — and
**none of those labels are written on-chain.** Its API carries them, but only for roughly the
last hour, so a receipt covering days cannot be labelled from it.

Transaction shape recovers some of it. Fingerprints are clear for a few kinds: a burn is a
`burnChecked`, a fee claim invokes DAMM v2's `ClaimPositionFee`, a wheel payout creates
recipient token accounts before transferring. But a holder round and a lotto round are both
just N `transferChecked` instructions, and a jackpot, a creator payout and a treasury transfer
are all a single one. Those cannot be told apart once landed.

What a transaction *does* show is how many wallets it credited, so that is what is reported:

| Shape | Meaning |
|---|---|
| **shared** | you were one of several wallets paid by that transaction |
| **solo** | that transaction paid only you |

On real wallets the split is stark and matches what the wallets are: one holder shows 146 of
146 payouts as six-recipient batches; a coin creator shows 51 of 51 as solo. That is a genuine
distinction, and it is the honest limit of what the chain can tell you.

### Where each payout came from

Ember pays holders in whatever their coin is paired against. That is verified twice: across
156 distinct pools in Ember's ledger **not one pays in more than one token**, and on-chain the
payout token is exactly the pool config's `quote_mint` (8 of 8 sampled pools matched).

So a payout can be traced backwards. A credit in GOOGLx came from a GOOGLx-paired coin, and the
candidates are the GOOGLx-paired coins the wallet holds. One candidate is an unambiguous
attribution; several is a shortlist. It costs one filtered pool lookup per held mint plus one
batched config read — 22 held mints resolved in 0.3s.

**This is the one inferred thing in the app and it is labelled as such.** Every amount links to
a signature; a source coin does not. It also cannot see a coin that has since been sold — there
is no holding left to match against, which is why a wallet paid 68,817 EMBER can still show
"cannot attribute" for it.

### Dollar values

Prices come from Jupiter's public price API, which covers these tokens well — including the
launchpad coins, tagged `launchpad: "met-dbc"` — and returns the liquidity behind each quote.
A price standing on less than $25,000 of liquidity is marked **thin**, because a quote on a
near-empty pool is a number, not a valuation.

**These are current prices, not the price at payout.** That distinction is stated on the card
and beside the total, because the gap is not academic: $EMBER moved more than 70% in a single
day while this was being written. Valuing at receipt would need a historical price per payout
timestamp, which Jupiter does not serve and which would mean a paid OHLCV source plus a lookup
per payout.

The token amounts remain the exact, verifiable figures; the dollar figure is a convenience laid
over them.

### The card

Rendered as SVG, so it exports to PNG with no dependency and stays sharp at any size. Token
artwork is inlined as a data URI before export — a remote image would either taint the canvas
or fail to load in the detached SVG.

## The token view

Paste a mint and it resolves the coin's Meteora bonding curve pool by matching the base mint
on-chain (`getProgramAccounts` on the DBC program, `dataSize` 424, `memcmp` at offset 136),
then reads the pool and config accounts directly.

| Shown | Source |
|---|---|
| Curve progress, quote reserve, migration threshold | pool + config accounts, on-chain |
| Graduated to DAMM v2 | pool `is_migrated` / `migration_progress` |
| Ticker, name, launch date | `dbc.datapi.meteora.ag/pools/{pool}` |
| Coin artwork | mint metadata → off-chain JSON → `image` |
| Fee activity | Ember's published ledger, each row linked to its transaction |

It also answers a question worth asking before buying anything: **is this actually an Ember
launch?** The badge compares the pool config's `fee_claimer` against Ember's keeper. A coin with
a Meteora curve whose fees are claimed by someone else is not in Ember's payout modules, however
it is being marketed.

Verified end to end against FLYWHEEL (`Hh2waXY7qfq5GUyQuzr3AJo29g9hTVThdjfHRB1jHNRC`): launched
12 Sep, paired with **GOOGLx**, curve filled to 100% and graduated, payouts arriving in GOOGLx.
Loads in about a second.

## Coin artwork

Logos are two hops off-chain — the mint's metadata points at a JSON document, which points at
the image — and both are usually IPFS. Gateways are **raced in parallel** rather than tried in
turn, so one rate-limited gateway does not add its timeout to everyone else's wait. Artwork
resolves *after* the numbers are on screen, so a slow gateway never delays the receipt, and a
failure just means no logo.

For the card, artwork is redrawn at 128px before being inlined. Token art is routinely around
a megabyte — Ember's own logo is 977KB — which is wasteful to embed for a 48px circle, and an
earlier size cap silently dropped it. Downscaling needs a CORS-permitted response; when that is
refused the original bytes are embedded instead.

Verified against EMBER, MET, FLYWHEEL and NVDAx — covering IPFS, plain HTTPS, and a Token-2022
mint whose metadata lives in an extension rather than a Metaplex account.

## Running it

```bash
npm install
cp .env.example .env     # add your RPC endpoint
npm run dev
npm run build
npm run smoke            # drives both views at 1100px and 390px against a stubbed RPC
npm test                 # endpoint validation, guarding the blank-page regression
```

An RPC endpoint is required — this reads full transaction histories and public endpoints cannot
complete a scan.

`VITE_RPC_URL` is compiled into the client bundle and is therefore **public**. That is inherent
to a browser app with no backend, so the protection has to come from the provider: **restrict
the key to your domain** in your RPC provider's dashboard, or put a proxy in front of it.

The interface never displays it. Only the host is shown (`Network: solana-mainnet.g.alchemy.com`)
and the override field starts empty rather than pre-filled, so the key is not in the DOM whether
that panel is open or closed. This does not make it secret — it is still in the bundle — it just
avoids printing it on the page for anyone to copy.

Anyone can paste their own endpoint in that panel, which is stored and used in place of the
built-in one. Only a genuine override is kept: an earlier build seeded the box with whatever
endpoint was active and saved it, so browsers that visited then are holding the site's own
endpoint in `localStorage`. A stored value identical to the configured one is treated as that
legacy state and discarded rather than shown back as "your endpoint".

## Deploying to Vercel (from a phone)

The app lives in a subdirectory, so the one setting that matters is the root directory.

1. vercel.com → **Add New → Project** → import `Eienel/ptee`
2. **Root Directory → `ember-receipts`** (this is the step people miss)
3. Framework preset: Vite. Build and output are already set by `vercel.json`.
4. **Environment Variables → `VITE_RPC_URL`** = your RPC endpoint
5. Deploy

**Set `VITE_RPC_URL` to a real https URL, not an empty field.** The first deploy went out with
it blank, which is worth knowing about: `??` does not treat an empty string as missing, so the
blank value reached `new Connection('')`, that threw during render, and the page went
completely blank with no clue on screen. The endpoint is now validated and a render crash shows
a message with a reset button, but an unset endpoint still means no scans — public endpoints
cannot complete one.

## Status

- The scan engine is validated end to end against three real wallets on a live endpoint.
- The token view is validated end to end against a real Ember launch on a live endpoint.
- Artwork resolution is validated against four real mints.
- Layout, both views and the mobile breakpoints are covered by `npm run smoke`, which fails on
  any console error or horizontal overflow.
- The browser's **live** RPC path has not been exercised from here: the development sandbox's
  proxy drops the headless browser's TLS tunnels, so browser tests run against a stub and live
  tests run from Node. Production bundles can still be verified by downloading them and serving
  them through request interception, which is how the first deploy's blank page was diagnosed.

## Known limits

- **A few wallets cannot be scanned at all.** One tested wallet holds so many token accounts
  that the RPC response exceeds what the runtime can decode into a string, failing inside the
  client as `ERR_STRING_TOO_LONG` before any of our code runs. That is reported as a plain
  explanation rather than a crash; scanning such a wallet would need a paginated indexer.

- **Per-coin attribution is inferred, never proven.** Ember's `/api/solana/payouts` has no
  recipient field and exposes roughly the last hour with no pagination — `limit` caps at 500
  records; `offset`, `page` and `days` are ignored — so payouts cannot be matched to coins from
  their data. The pairing inversion described above recovers most of it, but it is inference,
  and it goes blind on any coin the wallet no longer holds. Proving it outright would need a
  continuous indexer snapshotting Ember's endpoint, which could only capture forward from the
  moment it started.
- **Dollar values are today's, and there is no PnL.** Earnings are valued at current prices, not
  at the price when each payout landed, and nothing here computes profit and loss — that needs
  cost basis for every buy and sell plus historical pricing.
- **Meteora's DBC index is undocumented.** `dbc.datapi.meteora.ag` is live and indexes 1.6M
  pools, but it is absent from Meteora's published API reference, so every field from it is
  treated as optional and the token view still works without it.
- **Ember's ledger is a short window.** An empty fee history is not evidence that a pool has
  never paid out, and the interface says so rather than implying a coin is dead.

## Layout

```
src/lib/constants.ts   keeper, mints, explorer links
src/lib/scan.ts        wallet scan: accounts -> signatures -> transactions -> credits
src/lib/token.ts       token view: pool lookup, curve state, Ember fee activity
src/lib/tokens.ts      ticker/name/uri resolution (Metaplex + Token-2022 metadata)
src/lib/images.ts      off-chain artwork, gateway racing, data-URI inlining
src/lib/png.ts         SVG -> PNG export, no dependencies
src/components/        receipt card (SVG), payout table, token panel
scripts/smoke.mjs      browser test of both views at two widths
```
