# ptee

Tools and on-chain research around [Embercurve](https://embercurve.fun) and Solana rent.

---

## Ember Receipts &nbsp;·&nbsp; [ember-receipts.vercel.app](https://ember-receipts.vercel.app)

What a wallet has actually earned from Embercurve, read from the chain and rendered as a card
worth posting. Paste a wallet for a receipt of every payout; paste a coin for its curve and what
its fees have paid out.

| | |
|---|---|
| **Receipt** | Every payout to a wallet, counted from the chain — not from anyone's API. Exported as a 1200×630 PNG in five styles. |
| **What it was for** | Holder rewards, lotto, jackpot, burn and the rest, labelled per payout, plus what each was worth **when it landed** against today. |
| **What holding pays** | What each coin paid its holders in the last 24 hours, per $1,000 held. [Open it &rarr;](https://ember-receipts.vercel.app/?board=1) |
| **Conviction** | Ember's leverage module — position, liquidation distance, harvest progress. Live when a coin opens one. |

Read-only. No wallet connection, nothing to sign.

**[Full documentation &rarr;](ember-receipts/README.md)** — how the scan works, why the numbers
are what they are, and what this cannot tell you.

### Three things worth knowing

Each of these came out of checking a claim rather than accepting it, and each is documented with
the test that produced it.

- **Ember's published ledger is incomplete.** On one wallet the scan finds 84 keeper payouts and
  Ember lists 81. The three it omits are inside its own window and keeper-signed. Our total is
  the superset; the missing ones are counted and shown as unlabelled rather than dropped.
- **Ember's `volumeUsd` is not measured volume.** All 17 graduated coins that launched at a 3%
  tax report an all-time fee rate of exactly 1.000000%, which no real blend can produce. Volume
  is back-computed from fees, so nothing here is expressed as a percentage of volume.
- **Yield is not forecastable from it.** A coin's trailing-24h share of fees to holders runs
  0.09×–0.89× of its own all-time share. Every figure shown is a window that already happened,
  and nothing is annualised.

---

## Rent Reclaim

A dashboard for the excess SOL sitting in over-funded token accounts, using the Token Program's
`WithdrawExcessLamports` instruction. Built and proven against the real mainnet binary on a local
validator; it goes live when Solana's rent reduction ships.

**[Documentation &rarr;](docs/rent-reclaim.md)**

## Research

- **[findings.md](findings.md)** — Meteora DBC token badges on mainnet, with the raw JSON audit
  trail in [`raw/`](raw/).
- **[scanathon-onchain.md](scanathon-onchain.md)**, **[scanathon-summary.md](scanathon-summary.md)**
  — MET Trenches scan across Solana, Robinhood Chain and Base.

Contract addresses, mints and figures in these documents are stated with their source, and
anything inferred is labelled as inference rather than fact.
