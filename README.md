# Rent Reclaim

A dashboard that shows a Solana wallet exactly how much excess SOL it can reclaim, and reclaims it in one click.

[Rent on Solana is being reduced in phases](https://solana.com/upgrades/reduced-rent). Every account funded at an older, higher rate is now over-funded: it holds more lamports than the current rent-exempt minimum requires. The Token Program's `WithdrawExcessLamports` instruction moves that surplus out without touching token balances and without closing the account.

## What it does

- **Scans** every token account owned by the connected wallet, across both the Token Program and Token-2022.
- **Scans** mints whose mint authority is the connected wallet (needs an RPC that allows `getProgramAccounts`).
- **Computes the surplus** as `lamports - getMinimumBalanceForRentExemption(dataLength)`. Rent floors are read live from the cluster on every scan and cached per data size — nothing is hardcoded, so the numbers stay correct at every phase of the rollout.
- **Reclaims** the selected accounts by batching `WithdrawExcessLamports` instructions (10 per transaction) into as few wallet signatures as possible, with the connected wallet as the destination.

Accounts already at the floor are listed but greyed out and cannot be selected.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run smoke    # headless connect -> scan -> table check against a stubbed RPC
```

The public RPC endpoints are rate-limited and disable `getProgramAccounts`. Paste your own endpoint into the RPC field in the header for a full scan (including mints); it is remembered in `localStorage`.

Supported wallets: any injected provider that exposes `connect` / `signTransaction` — Phantom, Solflare, and Backpack are detected by name.

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
src/lib/scan.ts        token account + mint discovery and surplus math
src/lib/withdraw.ts    WithdrawExcessLamports instruction encoding
src/lib/reclaim.ts     batching, signing, sending, per-transaction results
src/lib/wallet.ts      injected wallet detection
src/components/        header, summary stats, account table
```
