import { PublicKey } from '@solana/web3.js';

/** SPL Token program (now implemented as P-Token on mainnet). */
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/** Token-2022 program. Exposes the same WithdrawExcessLamports instruction. */
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

/**
 * Instruction discriminator for `WithdrawExcessLamports`.
 * See solana-program/token: pinocchio/program/src/processor/withdraw_excess_lamports.rs
 */
export const WITHDRAW_EXCESS_LAMPORTS_IX = 38;

/** Base byte length of a token account (Token-2022 accounts add extension bytes). */
export const TOKEN_ACCOUNT_LEN = 165;

/** Byte length of a classic SPL mint. */
export const MINT_LEN = 82;

export const LAMPORTS_PER_SOL = 1_000_000_000;
