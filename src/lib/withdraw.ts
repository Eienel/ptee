import { Buffer } from 'buffer';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { WITHDRAW_EXCESS_LAMPORTS_IX } from './constants';

export interface WithdrawExcessLamportsArgs {
  /** Token account, mint, or multisig holding the excess lamports. */
  source: PublicKey;
  /** Where the reclaimed lamports land. */
  destination: PublicKey;
  /** Token account owner, mint authority, or the mint itself. */
  authority: PublicKey;
  /** Extra signers when `authority` is a multisig account. */
  multiSigners?: PublicKey[];
  programId: PublicKey;
}

/**
 * Builds the Token / Token-2022 `WithdrawExcessLamports` instruction.
 *
 * The program moves everything above the source's rent-exempt minimum to the
 * destination. Token balances are untouched and the account stays open.
 */
export function createWithdrawExcessLamportsInstruction({
  source,
  destination,
  authority,
  multiSigners = [],
  programId,
}: WithdrawExcessLamportsArgs): TransactionInstruction {
  const keys = [
    { pubkey: source, isSigner: false, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: multiSigners.length === 0, isWritable: false },
    ...multiSigners.map((pubkey) => ({ pubkey, isSigner: true, isWritable: false })),
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from([WITHDRAW_EXCESS_LAMPORTS_IX]),
  });
}
