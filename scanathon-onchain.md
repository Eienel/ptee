# MET TRENCHES SCANATHON — on-chain verification

**Compiled:** 11 Sep 2026 · **Leaderboard check:** Sun 13 Sep, 12PM ET
**Scope:** everything below was read from Solana mainnet directly. No screenshots, no
third-party dashboards, except where explicitly marked as unverified.

Reproducible from this repo: `raw/dbc-rwa-launches.json`, `raw/pools-decoded.json`,
`raw/mints-analyzed.json`, `findings.md`. Account field offsets were derived from the
program IDL (`idloffsets.mjs`) and independently confirmed against live accounts.

---

## 1. Meteora RWA Track ($500) — $SV151 holds up

The draft named SV151 on the strength of blog/X posts. It survives on-chain checking.

| Fact | On-chain value |
|---|---|
| Mint | `SV151D5pjygAKA8aJJcKzm4wFnRX5G92Fye94jQJk7g` |
| Name / symbol | "Scarlet & Violet 151" / SV151 (Metaplex metadata) |
| **DBC virtual pool** | `6do8aPfAaN5sPTz1aWSmdB2ekMBoYBfPQgtP81LheCRx` |
| **`is_migrated`** | **1** |
| **`migration_progress`** | **3** (fully graduated off the curve) |
| Quote asset | USDC (`EPjFW…Dt1v`) |
| `migration_quote_threshold` | **160,756.977475 USDC** |
| `quote_reserve` at migration | **160,756.977494 USDC** |
| Token program | SPL Token (no Token-2022 extensions, 82-byte mint) |
| Decimals / supply | 6 / 999,694.508416 |
| **Mint authority** | **revoked (null)** |
| **Freeze authority** | **revoked (null)** |
| Creator | `HLriJojgRSe6vJPLuJ6f3eUoERiCLKDtgSzaeZe154fR` |

Three things worth putting in a scan:

1. **It launched on DBC and graduated — proven, not claimed.** The virtual pool exists under
   the DBC program with `is_migrated = 1`, `migration_progress = 3`.
2. **It hit its threshold almost to the lamport.** Reserve exceeded the migration threshold
   by 19 lamports — 0.000019 USDC. The draft's "~$160k USDC" is right; the exact figure is
   **160,756.98**.
3. **Both authorities are revoked.** No mint authority, no freeze authority, no Token-2022
   extensions at all. Section 3 explains why that is the whole thesis.

The creator wallet has launched **exactly one** DBC pool — no sibling assets, so this is not
a series to farm.

---

## 2. What is actually launching on DBC against RWA quote assets

The draft's claim that "Meteora DBC now supports any token pair… stock tokens and RWAs as
quote tokens" is **confirmed on-chain**, and it is the token-badge mechanism:

- **1,233 token badges** exist on the DBC program (operator-issued, permissioned).
- **225 pool configs** use a badged RWA mint as `quote_mint`, across 61 distinct mints.
- **166 live virtual pools** sit under those configs, across 38 quote mints.
- 115 have traded; **6 have graduated**.

**But here is the finding nobody else will have: none of them are RWA projects.**

Every one of the 166 launches is a memecoin — or a test. Base mints break down as 155 plain
SPL Token and 11 Token-2022, and **all 11 Token-2022 base mints are literally named TEST1
through TEST4**. Two of the six "graduated" pools are dev tests.

### All six graduated RWA-quoted pools

| Token | Name | Quote | Reserve at migration | Base mint |
|---|---|---|---|---|
| GPUCAT | GPU Cat | NVDAx | 39.5712 | `7XmaUUj2PQw2sQvPKkomKUQXFNtqzMo2DURHhrk7rnN2` |
| TSLAINU | TESLA INU | TSLAx | 26.2264 | `FWxzTKdFW1gmdEEP64KJHobaVmFKQP9UuWPh8zAbbAud` |
| TICKER | Tickeryard | SPYx | 13.6203 | `HE9ThcQVt5yDq6xNW74DHnu1PpX8GdzW3S7sXQXfiaic` |
| PAIRS | PAIRS | SPYx | 8.6373 | `EpbYRMoSPYHF77QtcdWunBGHuzHFK1CHbrd9xaNGpair` |
| TEST3 | TEST3 | SPCX | 7.0000 | `Ax77wvovw4xbLNbsoWbDacwyFHygQRbfdnsTskax22un` |
| TEST4 | TEST4 | MU | 1.0000 | `B6v5eQshgUJaEJYVj3MfdFqpkMhq2D7r1Knjc7vwxkcf` |

Reserves are in each quote asset's own units (a share of NVDAx, not dollars).

### Most advanced pools still on the curve

| Token | Name | Quote | Reserve | % of its own threshold |
|---|---|---|---|---|
| GOLDEN | Golden Ticket | GLDx | 0.2853 | 17.59% |
| DIP | Buy the dip | BRK.Bx | 2.2855 | 16.20% |
| ASSTEROID | ASSTEROID | SPCXx | 10.2239 | 15.62% |
| SOJU | Soju | TSLAx | 1.2298 | 5.09% |
| MSTRBALL | MSTRball | MSTRx | 2.8952 | 4.37% |
| DFDV | Deep F\*cking DeFi Value | DFDVx | 53.2042 | 3.62% |

**Nothing else is close.** Outside the six that graduated, no pool is past 18% of its own
migration threshold. The feature is live but barely used — which is the scan, if you want a
"early to a new primitive" angle rather than a "this is pumping" angle.

---

## 3. FOMO thesis material — the asymmetry nobody is pricing

This is the part that separates a scan from a chart screenshot. Every one of those 166 pools
is quoted in an asset whose **issuer can freeze or pause it**, while the pool itself has no
say. From the mint accounts of all 1,233 badged mints:

- **38 of 38** quote mints with live pools have a **live pausable authority**.
- **37 of 38** have a **live freeze authority**.
- **34 of 38** have a **live permanent delegate** — transfer/burn authority over the pool's
  quote vault balance.
- **One key** (`JDq14BW…xJNs`) is **both** the freeze authority **and** the pause authority
  for **24 of the 38**. One signature could halt the quote side of 24 mints' pools.
- Transfer hooks are inert today (program ID is the zero address on all 1,231 carrying the
  extension) — **but the hook authority is unrevoked on every single one**, so a hook can be
  installed after a pool is already live.

Meteora's DBC re-checks transfer fees at runtime, but the badge **suspends all other
extension checking**. That is by design — operator review replaces the on-chain check.

**The contrast is the thesis:** SV151 launched on the same curve with **mint and freeze
authority revoked and zero extensions**. Same venue, opposite trust model. An RWA that is
actually immutable versus 166 pools whose quote asset is pausable by a single key.

---

## 4. Claims in the draft I could NOT verify

Flagging these so you don't put an unverifiable number in a scan:

- **Dates.** SV151's "4 June 2026 launch" needs transaction history; I confirmed the pool's
  state, not when it was created.
- **All volume, AUM and holder figures** — $19.8M SV151 volume, $684M tokenized equity
  supply, $800M xStocks AUM, 400k+ holders, Wendy's "$7.3M in 3 hours", GPRO launch-day
  numbers. None are on-chain reads; all come from dashboards or posts.
- **Issuer identities.** "Backed Finance", "Ondo", "Backpack Securities", "Sunrise",
  "Bedrock" are all inference from ticker conventions and shared keys. On-chain data proves
  keys cluster; it does not prove which company holds a key. Don't state these as fact.
- **Robinhood Chain and Base sections** — entirely outside what I scanned. Solana only here.

---

## 5. Verify the contract address — SPCX especially

A DexScreener search for "SPCX" returns **at least six different Solana mints** using that
symbol, several showing hundreds of millions in reported liquidity. The SPCX that appears as
a badged DBC quote asset is `SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb`, which is **none of
the top DexScreener results**. Symbol collision is total in this category.

Post the mint address in your scan, not the ticker.

---

*Not financial advice. Every figure in sections 1–3 is reproducible from the raw JSON in this
repo; everything in section 4 is explicitly unverified.*
