# Meteora DBC Token Badges on Solana mainnet

**Date of scan:** 2026-09-10 · **Epoch at scan time:** 1032 (`getEpochInfo`, `raw/epoch-info.json`)
**Program:** `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
**RPC used:** `https://api.mainnet-beta.solana.com` (public endpoint; `getProgramAccounts` succeeded, so no indexer fallback was needed)

All raw RPC responses and decoded intermediates are in `raw/`; the decode scripts are in `analysis/`.

---

## Headline

The feature has a **large live surface**: **1,233 Token Badges** exist on mainnet. They are not a dormant capability — **61 badged mints are referenced as `quote_mint` by 225 pool configs**, and **38 of them carry 166 live virtual pools**, 115 of which have traded.

The badged set is essentially the tokenized-equity universe: Backed Finance **xStocks** (`NVDAx`, `TSLAx`, `SPYx`, …) and **Ondo** Global Markets (`AAPLon`, `JPMon`, …), plus a handful of other issuers.

The material risk is **not** transfer fees, which the program still checks at runtime. It is that **the badge suspends all extension checking**, and near-universally these mints ship with a **live freeze authority (1,232/1,233)**, a **live pausable authority (1,230/1,233)** and, for 791 of them, a **live permanent delegate**. Every one of those levers sits with the token issuer, not the pool launcher.

---

## 1. Badge enumeration

```bash
curl -s "$RPC_URL" -X POST -H 'Content-Type: application/json' -d '{
  "jsonrpc":"2.0","id":1,"method":"getProgramAccounts",
  "params":["dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",{
    "encoding":"base64",
    "filters":[{"dataSize":168},{"memcmp":{"offset":0,"bytes":"LYg8tBNVsV7"}}]
  }]
}'
```

| Metric | Value |
|---|---|
| Badge accounts returned | **1,233** |
| Discriminator mismatches | 0 |
| PDA re-derivation failures | 0 — all 1,233 re-derive to `["token_badge", mint]` |
| Non-zero `_padding` | 0 |
| Distinct mints | 1,233 (no duplicates) |

Independently verified before use, rather than taken from the brief:
- `sha256("account:TokenBadge")[..8]` = `74dbcce5f974ff96`, base58 `LYg8tBNVsV7` — matches, and matches the IDL's `[116,219,204,229,249,116,255,150]`.
- `TokenBadge.token_mint` at offset 8 and `PoolConfig.quote_mint` at offset 8 — both confirmed against the published IDL (`raw/dbc-idl.json`, `dynamic_bonding_curve` v0.2.1) rather than assumed.

Full list: `raw/badges-decoded.json`.

## 2. Risk profile of the badged mints

All 1,233 are owned by Token-2022. Extension prevalence:

| Extension | Count |
|---|---|
| MetadataPointer | 1233 |
| TokenMetadata | 1233 |
| DefaultAccountState | 1231 |
| ScaledUiAmountConfig | 1231 |
| TransferHook | 1231 |
| PausableConfig | 1230 |
| ConfidentialTransferMint | 1230 |
| PermanentDelegate | 791 |
| MintCloseAuthority | 1 |
| TransferFeeConfig | 1 |

**This is exactly why the badges exist.** MetadataPointer + TokenMetadata alone would be permissionlessly supported; it is `ScaledUiAmountConfig`, `PausableConfig`, `DefaultAccountState` and `ConfidentialTransferMint` that push these mints outside permissionless support and require an operator-issued badge.

### Live control levers

| Lever | Mints | Consequence for a DBC pool |
|---|---|---|
| Freeze authority live | **1,232** | Can freeze the pool's quote vault mid-curve |
| Pausable authority live | **1,230** | Can halt all transfers of the quote asset outright |
| Permanent delegate live | **791** | Holds transfer/burn authority over the quote vault balance |
| Transfer hook **active** | **0** | Extension present on 1,231 mints but `programId` is the zero address on every one — no hook code runs |
| Non-zero transfer fee (now) | **0** | — |
| Transfer fee scheduled ahead | **0** | — |
| `DefaultAccountState = Frozen` | 1 (`GLXY`, no pools) | New token accounts frozen on creation |
| Already paused | 0 | — |

**No badged mint currently violates `validate_transfer_fee_is_zero`.** Only one mint carries `TransferFeeConfig` at all (`CADG`), and both its older and newer fees are 0 bps at epoch 1009 ≤ current 1032. The runtime check the badge does *not* exempt is, today, satisfied everywhere.

### Who holds the levers

Authorities cluster tightly into two issuers:

| Mints | Mint authority | Freeze / pause authority | Permanent delegate | Example symbols |
|---|---|---|---|---|
| 740 | `7pt9tkctJPK7PPNQJ77GKg8ZffSF6QxoMiCFYHxrtaCj` | `JDq14BWvqCRFNu1krb12bcRpbGtJZ1FLEakMw6FdxJNs` | `5aMNNLQJwAEeoemTEMkv5NVjqKwvvefRYCQ5Z67HFvEq` | DHRx, FSLRx, JNJx (xStocks) |
| 383 | `9foMHsSDq7nMg4WPusSz9eY7tyxyukqborA8GyU5cUxD` | `51QVCuHfL1FeNjd8BDeffCKhCcAYoULnVB3yjNhShiuK` | *none* | NEEon, JPMon, XOMon (Ondo) |
| 59 | `9foMHsSDq7nMg4WPusSz9eY7tyxyukqborA8GyU5cUxD` | `Chm9dcASBc9C54FGxcSRGv9qC998TueQqr5XzGZkEVCc` | *none* | ETNon, FCXon, GEVon (Ondo) |

A single key (`JDq14BW…xJNs`) can freeze **or** pause the quote asset of every xStocks-quoted pool — 24 of the 38 mints that have live pools.

## 3. Usage: configs and live pools

- **491,160** `PoolConfig` accounts scanned (427 distinct quote mints). `So111…1112` (442,316) and USDC (45,006) dominate.
- **225 configs** use a badged mint as `quote_mint`, across **61 distinct badged mints**.
- **1,624,858** `VirtualPool` accounts scanned; **166** sit under those configs, across **38** badged mints.
- Of those 166: **115 have traded** (`has_swap = 1`, all with `quote_reserve > 0`), **6 have migrated** (`migration_progress = 3`, `is_migrated = 1`), 160 are at `migration_progress = 0`.

### Pools by badged quote mint

Reserve and threshold are in the quote mint's own UI units (its own share/token, not USD).

| Symbol | Quote mint | Pools | Quote reserve | Migration threshold | Freeze auth | Perm. delegate | Pause auth |
|---|---|---|---|---|---|---|---|
| NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | 39 | 41.0320 | 39.53 | **LIVE** | **LIVE** | **LIVE** |
| SPYx | `XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W` | 18 | 22.9495 | 11.52 | **LIVE** | **LIVE** | **LIVE** |
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | 13 | 28.5446 | 19.51 | **LIVE** | **LIVE** | **LIVE** |
| SPCXx | `Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8` | 8 | 10.2239 | 48.86 | **LIVE** | **LIVE** | **LIVE** |
| AAPLx | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | 7 | 0.1529 | 27.79 | **LIVE** | **LIVE** | **LIVE** |
| MCDx | `XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2` | 6 | 0.0000 | 40.96 | **LIVE** | **LIVE** | **LIVE** |
| MSTRx | `XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ` | 6 | 2.8952 | 85.00 | **LIVE** | **LIVE** | **LIVE** |
| MSFTx | `XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX` | 6 | 0.3556 | 17.81 | **LIVE** | **LIVE** | **LIVE** |
| SPCX | `SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb` | 5 | 9.3914 | 7.00 | **LIVE** | **LIVE** | **LIVE** |
| MU | `MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1` | 5 | 1.0000 | 8.66 | **LIVE** | **LIVE** | **LIVE** |
| METAx | `Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu` | 4 | 0.2354 | 13.61 | **LIVE** | **LIVE** | **LIVE** |
| PLTRx | `XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4` | 4 | 1.7227 | 42.67 | **LIVE** | **LIVE** | **LIVE** |
| QQQx | `Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ` | 4 | 0.3056 | 9.94 | **LIVE** | **LIVE** | **LIVE** |
| GLDx | `Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re` | 4 | 0.2908 | 1.62 | **LIVE** | **LIVE** | **LIVE** |
| AAPLon | `123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo` | 3 | 0.0141 | 4.00 | **LIVE** | none | **LIVE** |
| GOOGLx | `XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN` | 3 | 0.0000 | 26.68 | **LIVE** | **LIVE** | **LIVE** |
| KOx | `XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ` | 3 | 0.0000 | 98.82 | **LIVE** | **LIVE** | **LIVE** |
| INTC | `iNTCy1qTsUEZQe3DSocLz1ZXXai34Gdw8THQh5rxFaF` | 2 | 0.0000 | 84.09 | **LIVE** | **LIVE** | **LIVE** |
| CRCLx | `XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1` | 2 | 0.0530 | 103.40 | **LIVE** | **LIVE** | **LIVE** |
| GMEx | `Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc` | 2 | 0.0000 | 348.22 | **LIVE** | **LIVE** | **LIVE** |
| NKE | `NKEda5nHhNGgjrE9nDdMvaEmkmJ96qqxzBVZEcKmjSg` | 2 | 0.2669 | 191.55 | **LIVE** | **LIVE** | **LIVE** |
| APOon | `14VXAhoa1R74vi1ZuiQyGLJrnDMfoFBPJSCpGVz3ondo` | 2 | 0.0000 | 298.12 | **LIVE** | none | **LIVE** |
| BOT | `BoTx8y9ynfdxf5ZjWtCoBVkff52qKA82ysaLU8ZM6d8T` | 2 | 0.0000 | 6311749.32 | **LIVE** | **LIVE** | **LIVE** |
| MRVLx | `XsuxRGDzbLjnJ72v74b7p9VY6N66uYgTCyfwwRjVCJA` | 2 | 0.2264 | 29.96 | **LIVE** | **LIVE** | **LIVE** |
| AMC | `AMC1qwR9KhiyrQBRPrxnfo4JfMeMZqEBvt5tgTytNNoc` | 1 | 0.0000 | 3580.07 | **LIVE** | **LIVE** | **LIVE** |
| MUon | `Fz9edBpaURPPzpKVRR1A8PENYDEgHqwx5D5th28ondo` | 1 | 0.0000 | 58.83 | **LIVE** | none | **LIVE** |
| HOOD | `HooDYv5RewLRiMLnEVq3VJqdqxhuE6c5eYvqejMC3e9A` | 1 | 0.0000 | 77.49 | **LIVE** | **LIVE** | **LIVE** |
| USOon | `rpydAzWdCy85HEmoQkH5PVxYtDYQWjmLxgHHadxondo` | 1 | 0.0000 | 66.92 | **LIVE** | none | **LIVE** |
| NBIS | `NBiSF3UaVUFtRzHwAfxyHsBCAZWGEKnMpewAE4oh7BG` | 1 | 0.0000 | 43.21 | **LIVE** | **LIVE** | **LIVE** |
| DFDVx | `Xs2yquAgsHByNzx68WJC55WHjHBvG9JsMB7CWjTLyPy` | 1 | 53.2042 | 1467.77 | **LIVE** | **LIVE** | **LIVE** |
| CADG | `CADGKVBTfVqcTaTAFko4P6Vd5ZMMr7tXYs5Sn1GyLoyu` | 1 | 0.0000 | 87.88 | none | **LIVE** | none |
| MAx | `XsApJFV9MAktqnAc6jqzsHVujxkGm9xcSUffaBoYLKC` | 1 | 0.0000 | 85.00 | **LIVE** | **LIVE** | **LIVE** |
| TTWO | `TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo` | 1 | 0.0000 | 41.15 | **LIVE** | **LIVE** | **LIVE** |
| AMZNx | `Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg` | 1 | 0.0000 | 35.13 | **LIVE** | **LIVE** | **LIVE** |
| AMDx | `XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF` | 1 | 0.0002 | 17.10 | **LIVE** | **LIVE** | **LIVE** |
| LLYx | `Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH` | 1 | 0.0010 | 8.06 | **LIVE** | **LIVE** | **LIVE** |
| BRK.Bx | `Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x` | 1 | 2.2855 | 14.11 | **LIVE** | **LIVE** | **LIVE** |
| COINx | `Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu` | 1 | 0.0985 | 37.12 | **LIVE** | **LIVE** | **LIVE** |

## 4. Flagged mints

The brief asks for mints where a launch could be halted by a party outside the launcher's control. On the evidence the condition is effectively universal rather than exceptional — every badged mint with a live pool carries at least one such lever:

- **38 of 38** mints with live pools have a **live pausable authority**.
- **37 of 38** have a **live freeze authority** (only `CADG` does not).
- **34 of 38** have a **live permanent delegate**. The four without are the Ondo mints: `AAPLon`, `APOon`, `MUon`, `USOon`.

Specific items worth separate attention:

1. **`CADG`** (`CADGKVBTfVqcTaTAFko4P6Vd5ZMMr7tXYs5Sn1GyLoyu`) — the only badged mint with `TransferFeeConfig`. The fee is 0/0 today, but `transferFeeConfigAuthority` is **live** (`DjEttUjqtTFS2kVsZtyac1FZCjKTekJ2tHSFua97sbXC`). That authority can schedule a non-zero fee at any epoch, which would then halt `process_swap`, every trading-fee claim, both surplus withdrawals and migration on its pool — the one runtime check the badge does not exempt. Its single pool (`84fN5AmKjdQGoiDX1EgaLrZDUsbC9k4MAVvFEiLTkuPV`) has `has_swap = 0` and zero reserve, so nothing is currently exposed. It also carries `MintCloseAuthority` and a permanent delegate (`H5BFAKChmjddYr7GpV2AE7cg4nGWcg2CoVVpecaLFXqc`).
2. **`GLXY`** (`2HehXG149TXuVptQhbiWAWDjbbuCsXSAtLTB5wc2aajK`) — the only mint with `DefaultAccountState = Frozen`. Any new token account for it is created frozen, which would affect vault creation. Not currently referenced by any config or pool.
3. **`ScaledUiAmountConfig` on 1,231 mints** — the DBC curve math operates on raw amounts, so a multiplier change does not alter program accounting, but it does change every displayed balance. Flagged as a disclosure issue rather than a solvency one.
4. **Transfer hooks are inert.** The extension is present on 1,231 mints, but every `programId` is the zero address. There is no unrevoked hook program in the badged set today. This is the one risk from the brief's list that the data rules out.

## 5. Conclusions

1. **Does the feature have live surface?** Yes, emphatically — 1,233 badges, not zero. It shipped alongside a real rollout, not ahead of one.
2. **What risk does each badged mint carry?** Uniformly high in terms of *capability*: freeze, pause and (usually) permanent-delegate authority all remain with the issuer. The badge's design intent — trusting operator review instead of extension checks — means the on-chain program offers no protection here. The saving grace is that the levers are held by regulated issuers (Backed, Ondo) with two keys covering ~99% of the set, which concentrates counterparty risk rather than eliminating it.
3. **Is anyone using them?** Yes, but at small scale. 166 pools, 115 traded, 6 migrated, and reserves in the tens of units per mint (e.g. NVDAx 41.03, TSLAx 28.54, SPYx 22.95). The economic exposure today is modest; the structural exposure is that a single issuer key can freeze or pause the quote side of every one of those pools.

### Limits of this analysis

- Reserves are reported in each quote mint's own UI units. No USD valuation was attempted — that would need a price source, which is outside what was fetched.
- Issuer identities (Backed / Ondo) are **inferred** from ticker conventions (`…x`, `…on`) and shared authority keys. The on-chain data proves the key clustering; it does not prove the corporate identity behind those keys.
- Badge *history* was not reconstructed. This is the live set as of epoch 1032; `EvtCreateTokenBadge` / `EvtCloseTokenBadge` history was not queried, since `getProgramAccounts` gave the current state directly.
- The two largest `getProgramAccounts` dumps (128 MB of configs, 422 MB of pools) were too large to retain in `raw/`. The exact commands that produced them are recorded above and in `analysis/`, and the derived outputs (`config-quotemint-histogram.json`, `pools-*.json`) are retained.
