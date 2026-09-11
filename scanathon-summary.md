# MET TRENCHES SCANATHON — full on-chain summary

**Compiled:** 11 Sep 2026 · **Leaderboard:** Sun 13 Sep, 12PM ET
**Chains verified directly:** Solana (mainnet), Robinhood Chain (id 4663), Base (id 8453)

Everything in sections 1–5 was read from the chains themselves. Discovery used DexScreener
as an index, but every token was then verified by RPC. Section 7 lists what I could not
verify. Raw data: `raw/*.json`.

---

## 0. TL;DR — what to scan

| Track | Pick | Why |
|---|---|---|
| **Meteora RWA ($500)** | **$SV151** | The only genuine RWA verified to have launched on DBC and graduated. Both authorities revoked. |
| **Multichain — Solana** | GPUCAT or ASSTEROID | The real graduates of the new RWA-quoted DBC feature |
| **Multichain — Robinhood** | GOOGL / NVDA / SPCX | $40–58M/24h each, genuine issuer bytecode |
| **Multichain — Base** | *nothing credible* | Top "RWA" volume is memecoins wearing stock tickers |
| **FOMO thesis ($250)** | The freeze-key asymmetry | Section 6 |

---

## 1. Solana / Meteora — $SV151 (the $500 pick)

| Field | Value |
|---|---|
| Mint | `SV151D5pjygAKA8aJJcKzm4wFnRX5G92Fye94jQJk7g` |
| Name | Scarlet & Violet 151 |
| DBC pool | `6do8aPfAaN5sPTz1aWSmdB2ekMBoYBfPQgtP81LheCRx` |
| `is_migrated` / `migration_progress` | **1 / 3 — graduated** |
| Quote | USDC |
| Threshold hit | **160,756.977475 USDC** (reserve 160,756.977494 — cleared by 19 lamports) |
| Supply / decimals | 999,694.508416 / 6 |
| **Mint authority** | **revoked** |
| **Freeze authority** | **revoked** |
| Token-2022 extensions | none (82-byte mint) |
| Creator | `HLriJojgRSe6vJPLuJ6f3eUoERiCLKDtgSzaeZe154fR` (exactly 1 DBC pool ever) |
| X / site | **@dAssetSOL** · dassetsol.xyz (from token metadata) |

## 2. Solana — the RWA-quoted DBC launches (166 pools)

Meteora's token-badge feature is real and verified: **1,233 badges, 225 configs, 166 live
pools across 38 RWA quote mints**. But **none of the launches are RWAs** — all 166 base mints
are memecoins or tests, and all 11 Token-2022 base mints are literally named TEST1–TEST4.

### The six that graduated

| Token | Name | Quote | Reserve | Base mint |
|---|---|---|---|---|
| GPUCAT | GPU Cat | NVDAx | 39.5712 | `7XmaUUj2PQw2sQvPKkomKUQXFNtqzMo2DURHhrk7rnN2` |
| TSLAINU | TESLA INU | TSLAx | 26.2264 | `FWxzTKdFW1gmdEEP64KJHobaVmFKQP9UuWPh8zAbbAud` |
| TICKER | Tickeryard | SPYx | 13.6203 | `HE9ThcQVt5yDq6xNW74DHnu1PpX8GdzW3S7sXQXfiaic` |
| PAIRS | PAIRS | SPYx | 8.6373 | `EpbYRMoSPYHF77QtcdWunBGHuzHFK1CHbrd9xaNGpair` |
| TEST3 | TEST3 *(dev test)* | SPCX | 7.0000 | `Ax77wvovw4xbLNbsoWbDacwyFHygQRbfdnsTskax22un` |
| TEST4 | TEST4 *(dev test)* | MU | 1.0000 | `B6v5eQshgUJaEJYVj3MfdFqpkMhq2D7r1Knjc7vwxkcf` |

TICKER's metadata website field is `http://localhost:3000/...` — shipped straight from a dev
machine. X: **@Tickeryardfun**.

### Furthest along, still on the curve

| Token | Quote | Reserve | % of own threshold | Base mint |
|---|---|---|---|---|
| GOLDEN | GLDx | 0.2853 | 17.59% | `6nkrqj1mYrRFYHb2oWNyJGN3GXRuNRuFYENq1difLm6q` |
| DIP | BRK.Bx | 2.2855 | 16.20% | `8G1R75NNHjvWuWbm8a17we4b1zuZVimcU8Y4vFAiRFeR` |
| ASSTEROID | SPCXx | 10.2239 | 15.62% | `4tvMaA9a66KBRgB9qi15E7o5wrzTeHp6ueKj5GvX1Lqv` |
| DFDV | DFDVx | 53.2042 | 3.62% | `4eh2efUach76Vq733RD3rxcpGRnpqfA5Xcbx7qKnrb54` |
| MSTRBALL | MSTRx | 2.8952 | 4.37% | `5UiUG16XXcxq5ukEwHHBa4ZjRgPNmmdHfyMgePoQuzvh` |

---

## 3. Robinhood Chain — the real volume

Chain id **4663**, RPC `https://rpc.mainnet.chain.robinhood.com`, block ~60.4M. This is where
tokenized equities actually trade.

**All 13 genuine equity tokens share byte-identical 283-byte bytecode** (sha256 prefix
`dd432f8669cd184f`) and all expose `paused()` (all currently `false`). That shared bytecode is
your authenticity test.

| Ticker | On-chain name | 24h vol | Contract |
|---|---|---|---|
| GOOGL | Alphabet Class A • Robinhood Token | $58.8M | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` |
| NVDA | NVIDIA • Robinhood Token | $50.4M | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` |
| SPY | SPDR S&P 500 ETF Trust • Robinhood Token | $43.9M | `0x117cc2133c37B721F49dE2A7a74833232B3B4C0C` |
| SPCX | Space Exploration Technologies Corp. Class A | $40.5M | `0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa` |
| GME | GameStop • Robinhood Token | $21.7M | `0x1b0E319c6A659F002271B69dB8A7df2F911c153E` |
| AAPL | Apple • Robinhood Token | $15.0M | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` |
| QQQ | Invesco QQQ • Robinhood Token | $11.7M | `0xD5f3879160bc7c32ebb4dC785F8a4F505888de68` |
| MSTR | Strategy Inc. • Robinhood Token | $6.3M | `0xec262a75e413fAfD0dF80480274532C79D42da09` |
| TSLA | Tesla • Robinhood Token | $4.8M | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` |
| META | Meta Platforms • Robinhood Token | $3.4M | `0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35` |
| COIN | Coinbase • Robinhood Token | $1.6M | `0x6330D8C3178a418788dF01a47479c0ce7CCF450b` |
| AMZN | Amazon • Robinhood Token | $1.5M | `0x12f190a9F9d7D37a250758b26824B97CE941bF54` |
| PLTR | Palantir Technologies • Robinhood Token | $1.2M | `0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A` |

### ⚠️ The $10.8M impostor

The **highest-volume token trading as "HOOD"** is `0xDAA8f3f54c66E9BE2c44C1B6b566cBD07229CED3`
— on-chain name **"TheGreenHood"**, 1.01 billion supply, 3,649-byte bytecode, no `paused()`.
It is **not** a Robinhood equity token. It does not match the issuer fingerprint. $10.8M in
24h volume is trading against it.

---

## 4. Base — no credible tokenized equities in the top volume

Base returned far less, and what it returned is not what your draft assumed.

**Eight separate "MSFT" tokens**, each ~$900k/24h on only ~$25k liquidity — a volume-to-
liquidity ratio around 36×, in near-identical clusters. On-chain names:

- `0xbF774523169168740761397B73099a4478603652` → **"Memes Sending Feline Tokens"**
- `0x3922973B25848A551052C660640eCED74A121e0E` → **"Memes Sending Feline Tokens"**
- `0x968b88FBf329669CDd1C6B5a6DDE4561EdA9eB24` → **"Meme Solana Feline Token"**
- `0x88c3616fC1DDAc0df878b0CA6A60544F4774b981` → **"Meme Solana Feline Token"**

Each 1,000,000,000 supply. None is Microsoft. That repeating pattern of near-identical
volume on thin liquidity is what wash trading looks like — treat with suspicion.

Two Base tokens *do* look like real tokenization infrastructure — both are EIP-1167 minimal
proxies pointing at the **same** implementation `0x5dbd43785954d43c1643a0caf2ecef9e0056ff13`:

- `0x5EF7a66DF9A5E5541664e2f1ff273853a8934da3` — "Apple (AAPL)", $249k liquidity, **$0 volume**
- `0x72F4C96Fc2488B8CCe485Aa91C60945c281c3B31` — "HOOD (Robinhood)", $188k liquidity, **$0 volume**

Curiosity: `0xb200000000000000000000955dE0C2D9A115c201` ("Apple Inc.") has exactly **one byte**
of code (`0xef`) — a reserved/stub address, not a working token.

**I found no Coinbase tokenized-stock program on Base with meaningful volume.** Caveat: I
searched by ticker, so this is "not in the top results for 16 tickers", not proof of absence.

## 5. X handles found

Every handle below comes from the token's own DexScreener profile or metadata JSON — **submitted by whoever deployed the token, verified by nobody.** Many are memecoins impersonating real companies. Treat as leads, not endorsements.

**Verified from Solana token metadata:** `@dAssetSOL` (SV151, dassetsol.xyz) · `@Tickeryardfun` (TICKER)

**From DexScreener profiles (45 total, top 25 by volume):**

| Chain | Ticker | Token name | 24h vol | X handle | Contract |
|---|---|---|---|---|---|
| robinhood | AMZN | A Magical Zesty Neko | $1,079,184 | @AmznCatRH | `0x6d685EBCc32D8182B0b3A01c28Af66bEfeaE6aFD` |
| robinhood | GME | Greatest Meme Ever | $864,823 | @gmehood | `0xEF67e3064bEf1a27e81925eC7132f23E533bd5f6` |
| robinhood | GME | GameStop | $635,308 | @GameStopOnChain | `0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3` |
| robinhood | AMD | Advanced Micro Dog | $85,025 | @AMDonRobinhood | `0x1C2a482970Ae6b6E5052A7A184c8aef19E0840Be` |
| robinhood | GME | GAMESTOP | $36,915 | @GMEhoodLONG | `0x76d73e77e4e6Ae03d46118dE48A931d7f05D1e18` |
| robinhood | GME | GameStop | $17,879 | @gamestoponrh | `0x7e86381A763F0Ecca2bDF27C54eAC403ddD48123` |
| robinhood | MSTR | Meme Stock Treasury Rese | $9,975 | @MSTRonRH | `0x99452D7519e103daF9bC9f02311DD164a073A7A2` |
| robinhood | GME | GameStop | $6,002 | @0xJackis | `0x205B9D3FeB2D34113081471FD57A0327d5521E18` |
| robinhood | HOOD | foreskin | $5,405 | @bigjapbitch | `0x8cAE1f1d7517331907c5d4d6bD74835c7B68c1a2` |
| robinhood | MEOW | AMD | $5,103 | @meow_robinhood | `0x7235Cf5eA4674FE09531706954B5f1aD6E0A1e18` |
| robinhood | TSLA | memestock | $1,503 | @teslamemestock | `0x4cE28870aDAAf4D99cD871A2f6B6A9c0D98A1e18` |
| robinhood | HOOD | SwapHood Token | $1,255 | @SwapHoodFi | `0x1FcBc77a759e502E36836b7787C9A8B4f5Da666c` |
| robinhood | HOOD | foreskin | $1,200 | @foreskinofrh | `0x3F5e952b29bE5D70846FC2bA472BeA05761A769E` |
| robinhood | NVDA | Neko Viral Digital Asset | $1,165 | @NVDA_ON_RH | `0xF533D09576023dBe499f466399cf08a36807410e` |
| base | MSTR | Moon Strategy | $920 | @moon8onbase | `0x5cB370837f7e282A6C2472709d0B486680ef26F8` |
| robinhood | HOOD | HOOD4663 | $834 | @hood4663_rh | `0x499dC58539BA6869EE15b6c2a3c3c07F1AC4995F` |
| robinhood | HOOD | RobinHood | $537 | @_robinhoodmeme | `0x45C83b37C5BAF4dad26f3845C28295e2DE010962` |
| robinhood | HOOD | Hood Inu | $477 | @hood_inu | `0x14F6B28B35c9afF060b066f917EBb8438436cd89` |
| robinhood | COIN | COIN | $449 | @BAGS_COINC | `0x9395116762721d13c246F6b0A5c41bBB31777a8d` |
| robinhood | GME | GameStop | $443 | @PonsGME | `0x00E29693aE6039cEe8e60c5A72D9d87864a0d625` |
| robinhood | HOOD | foreskin | $408 | @ForeskinRH | `0x0797e99EE536AC34446CdDE33e6FaB6B1388D075` |
| robinhood | GME | GREATEST MEME EVER | $129 | @gmemeever | `0x232eCBdb38040c93EEBf497121e1241067e937bF` |
| robinhood | AMD | A Mini Dog | $125 | @AMiniDogOnRH | `0xF01ab9476afCAa0e0058C83CEF2B4C30867abEEb` |
| robinhood | HOOD | HOOD | $113 | @0xtudd | `0x70A35BE73f4Bbc55F4967F84DAF988756B7b1E18` |
| robinhood | PLTR | Please Let This Rip | $72 | @stocksavvyshay | `0xf92FbDFaF906d172DC0ab24e4bBc1225a2341F4D` |

The 13 genuine Robinhood equity tokens carry **no social links at all** — consistent with
being issued by the venue rather than a community project.

---

## 6. FOMO thesis — the asymmetry

Every one of the 166 Solana RWA-quoted pools is denominated in an asset whose issuer can
freeze or pause it, with the pool having no say:

- **38 of 38** quote mints with live pools have a live **pausable** authority
- **37 of 38** have a live **freeze** authority
- **34 of 38** have a live **permanent delegate** (transfer/burn over the quote vault)
- **One key** (`JDq14BWvqCRFNu1krb12bcRpbGtJZ1FLEakMw6FdxJNs`) is **both** freeze **and**
  pause authority for **24 of the 38**
- Transfer hooks are inert (zero-address program) but the hook **authority is unrevoked on
  all 1,231** — one can be added *after* a pool is live

Meteora's badge suspends extension checking by design (operator review replaces it); only the
transfer-fee check still runs at runtime. Robinhood's equity tokens are `paused()`-capable
too. **SV151 is the outlier: mint and freeze revoked, zero extensions.** Same venue, opposite
trust model. That contrast is the thesis.

---

## 7. Not verified — do not put these in a scan

- **All volume/AUM/holder figures in the original draft** ($19.8M SV151 volume, $684M
  tokenized equity supply, $800M xStocks AUM, 400k holders, Wendy's $7.3M, GPRO).
- **Dates**, including SV151's "4 June 2026" launch. I verified pool *state*, not creation time.
- **Issuer identities** — Backed Finance, Ondo, Backpack Securities, Sunrise, Bedrock. These
  are inference from ticker conventions and shared keys. On-chain data proves keys cluster; it
  does not prove which company holds a key.
- **Dollar values above** come from DexScreener, not from the chain.

## 8. Verification rules for this category

1. **Post contract addresses, never tickers.** Six different Solana mints use "SPCX"; eight
   Base tokens use "MSFT"; the top-volume "HOOD" on Robinhood Chain is a memecoin.
2. **On Robinhood Chain**, a genuine equity token has 283-byte code hashing to
   `dd432f8669cd184f` and exposes `paused()`. Anything else is not Robinhood's.
3. **Check volume against liquidity.** 36× in a day on $25k of liquidity is not organic.
4. **Check authorities**, not the chart. Revoked mint + freeze is rare and worth more than a
   green candle.

*Not financial advice. Sections 1–5 are reproducible from `raw/` in this repo.*
