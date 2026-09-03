# Rent Reclaim

A dashboard that shows a Solana wallet exactly how much excess SOL it can reclaim, and reclaims it in one click.

[Rent on Solana is being reduced in phases](https://solana.com/upgrades/reduced-rent). Every account funded at an older, higher rate is now over-funded: it holds more lamports than the current rent-exempt minimum requires. The Token Program's `WithdrawExcessLamports` instruction moves that surplus out without touching token balances and without closing the account.

## What it does

- **Scans** every token account owned by the connected wallet, across both the Token Program and Token-2022.
- **Scans** mints whose mint authority is the connected wallet (needs an RPC that allows `getProgramAccounts`).
- **Computes the surplus** as `lamports - getMinimumBalanceForRentExemption(dataLength)`. Rent floors are read live from the cluster on every scan and cached per data size — nothing is hardcoded, so the numbers stay correct at every phase of the rollout.
- **Reclaims** the selected accounts by batching `WithdrawExcessLamports` instructions (10 per transaction) into as few wallet signatures as possible, with the connected wallet as the destination. Batches carry a priority fee, are simulated after signing and before broadcast, are re-sent until they confirm, and are rebuilt against a fresh blockhash if one expires while the user is signing.

Accounts already at the floor are listed but greyed out and cannot be selected.

## Verified against the deployed program

The reclaim path is not taken on trust. `tests/fixtures/token.so` is the **live Token Program binary dumped from mainnet**, and `npm run test:e2e` loads it into a local validator and performs real reclaims against it:

```
✓ token account: 1500000 lamports reclaimed, floor 2039280 kept, tokens intact
✓ mint: 1500000 lamports reclaimed, floor 1461600 kept
✓ wrapped SOL rejected on-chain: Simulation failed.
```

The instruction encoding was also confirmed against mainnet directly by simulation: discriminator `38` is parsed and executed by the program (269 compute units), while a control discriminator returns `Error: Invalid instruction`.

## Fees, and not lying about them

A reclaim costs a transaction fee, so a surplus smaller than that fee makes the user *poorer*. The dashboard prices each batch from `getRecentPrioritizationFees` and shows the gross surplus, the fee, and what actually lands in the wallet. Accounts whose surplus does not clear their share of the fee are labelled **"costs more in fees than it returns"** and cannot be selected.

## Accounts that are excluded, and why

| Case | Handling |
| --- | --- |
| **Wrapped SOL** | Excluded. A wSOL account keeps its balance *in* its lamports, so it looks over-funded, but the program returns `NativeNotSupported` — and one such account fails the whole batch it lands in. Detected via the `is_native` flag at offset 109, not the mint address. |
| **Non-mint accounts matching the mint scan** | Excluded. The `memcmp` on the mint-authority field can match bytes inside other accounts, so results are length-checked (`82`, or a Token-2022 account-type byte of `1`). |
| **Already at the floor** | Listed, greyed out. |
| **Dust** | Listed, blocked on the fee math above. |

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run smoke    # headless connect -> scan -> table check against a stubbed RPC
npm run test:e2e # real reclaims against the deployed program on a local validator
```

`npm run test:e2e` needs the Agave CLI:

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

It dumps the program binary, starts a validator, runs the reclaims, and shuts the validator down.

### RPC endpoint

The public endpoints rate-limit hard and reject `getProgramAccounts`, so the mint scan cannot run against them. Set a dedicated endpoint in `.env` (see `.env.example`):

```
VITE_RPC_URL=https://your-endpoint/?api-key=...
```

**This is compiled into the client bundle and is public.** Restrict the key to your domain in your provider's dashboard, or front it with a method-whitelisting proxy. Users can also paste their own endpoint into the header field, which is remembered in `localStorage`.

## Deploying

The build output is a static SPA in `dist/` — any static host works. Vercel, Netlify, and Cloudflare Pages all detect Vite with no config; set `VITE_RPC_URL` as a build environment variable in the dashboard. There is no server component and nothing to keep running.

### Wallets and phones

On desktop and inside a wallet's in-app browser, any injected provider that exposes `connect` / `signTransaction` works — Phantom, Solflare, and Backpack are detected by name.

A mobile browser has no extension to inject a provider, so when none is found on a phone the header offers **"Open in Phantom" / "Open in Solflare"** [browse deeplinks](https://docs.phantom.com/phantom-deeplinks/other-methods/browse), which reopen the page inside the wallet's own browser where the normal connect flow works. The account table collapses to one card per account below 720px; `npm run smoke` asserts the page never scrolls sideways at 390px.

Android users can also be served by Mobile Wallet Adapter (`@solana-mobile/wallet-adapter-mobile`), which is not wired up yet.

## How the withdrawal works

`src/lib/withdraw.ts` encodes the instruction directly — a single discriminator byte (`38`) with three accounts:

| Account | Role |
| --- | --- |
| `source` | the token account or mint holding the excess lamports (writable) |
| `destination` | where the reclaimed lamports land — here, the connected wallet (writable) |
| `authority` | token account owner or mint authority (signer) |

The program computes the source's rent-exempt floor at the *current* `lamports_per_byte`, credits the destination with everything above it, and leaves the source at exactly its floor. See the [on-chain processor](https://github.com/solana-program/token/blob/main/pinocchio/program/src/processor/withdraw_excess_lamports.rs) and the [client docs](https://solana.com/docs/tokens/advanced/withdraw-excess-lamports).

Cases this dashboard does not cover, because a browser wallet cannot sign for them:

- **Mints whose authority has been revoked.** Authorization has to come from the mint account itself signing.
- **Multisig authorities.** `createWithdrawExcessLamportsInstruction` accepts `multiSigners`, but the UI only builds single-signer instructions.
- **PDAs owned by your own program.** The Token Program can only help with accounts it owns; for your own program-owned accounts you need a reclaim instruction in that program that shrinks the account and moves lamports above `Rent::get()?.minimum_balance(len)` out directly. See [solana-foundation/program-examples · basics/realloc](https://github.com/solana-foundation/program-examples/tree/main/basics/realloc).

## Layout

```
src/lib/constants.ts   program ids, instruction discriminator, sizes
src/lib/rent.ts        live rent-exempt lookups, cached per data length
src/lib/fees.ts        priority fee + compute budget pricing, net-of-fee math
src/lib/scan.ts        token account + mint discovery and surplus math
src/lib/withdraw.ts    WithdrawExcessLamports instruction encoding
src/lib/reclaim.ts     batching, signing, sending, per-transaction results
src/lib/wallet.ts      injected wallet detection
src/components/        header, summary stats, account table
scripts/dump-program.mjs   pulls the deployed program binary from mainnet
tests/e2e.mjs              real reclaims against it on a local validator
```
