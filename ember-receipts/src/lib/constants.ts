import { PublicKey } from '@solana/web3.js';

/**
 * Every Embercurve payout observed on mainnet — holder rewards, wheel, lotto,
 * jackpots, creator payouts and burns — is both signed and funded by this one
 * wallet. It is also the `fee_claimer` on the $EMBER pool config, which is how
 * it was identified rather than taken on trust.
 *
 * Verified across a sample of 26 payout transactions published by
 * embercurve.fun/api/solana/payouts: fee payer and debited token owner were
 * this address in all 26.
 */
export const EMBER_KEEPER = new PublicKey('GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp');

/** The $EMBER mint itself (mint + freeze authority both revoked). */
export const EMBER_MINT = new PublicKey('5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6');

/** $MET — the quote asset $EMBER is paired with, and what holder rewards arrive in. */
export const MET_MINT = new PublicKey('METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL');

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/**
 * Ember's own published ledger, used only to cross-check — never as the source
 * of truth. Fetched through this origin because embercurve.fun sends no CORS
 * headers; see `lib/ember.ts`.
 */
export const EMBER_PAYOUTS_API = '/ember/payouts';

export const SOLSCAN_TX = (signature: string) => `https://solscan.io/tx/${signature}`;
export const SOLSCAN_ACCOUNT = (address: string) => `https://solscan.io/account/${address}`;
