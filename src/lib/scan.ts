import { Buffer } from 'buffer';
import { Connection, PublicKey } from '@solana/web3.js';
import { MINT_LEN, TOKEN_2022_PROGRAM_ID, TOKEN_ACCOUNT_LEN, TOKEN_PROGRAM_ID } from './constants';
import { RentCache } from './rent';

export type ReclaimKind = 'token-account' | 'mint';

export interface ReclaimItem {
  /** False when the program would reject a withdrawal from this account. */
  eligible: boolean;
  /** Why it is not eligible, shown in the UI. */
  reason?: string;
  /** The account holding excess lamports. */
  address: string;
  kind: ReclaimKind;
  /** Owning token program, which is also the program the withdrawal goes to. */
  programId: string;
  dataLength: number;
  lamports: number;
  rentExempt: number;
  /** lamports - rentExempt, always >= 0. */
  excess: number;
  /** Mint of a token account, or the mint's own address. */
  mint: string;
  /** Raw token amount for token accounts. */
  amount?: bigint;
  decimals?: number;
}

/** Little-endian u64, avoiding Buffer polyfill type differences. */
function readU64LE(data: Buffer, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(data[offset + i]);
  return value;
}

function programLabel(programId: PublicKey): string {
  return programId.toBase58();
}

/**
 * Wrapped SOL keeps its token balance in the account's lamports, so it looks
 * over-funded to a naive scan. The program rejects it outright
 * (`TokenError::NativeNotSupported`), which would fail the whole batch it lands
 * in, so these are marked ineligible rather than silently included.
 */
function isNativeAccount(data: Buffer): boolean {
  return data.readUInt32LE(109) === 1;
}

async function toItem(
  rent: RentCache,
  address: PublicKey,
  programId: PublicKey,
  kind: ReclaimKind,
  lamports: number,
  data: Buffer,
): Promise<ReclaimItem> {
  const rentExempt = await rent.minimumBalance(data.length);
  const base = {
    address: address.toBase58(),
    kind,
    programId: programLabel(programId),
    dataLength: data.length,
    lamports,
    rentExempt,
    excess: Math.max(0, lamports - rentExempt),
    eligible: true,
  };

  if (kind === 'token-account') {
    const native = isNativeAccount(data);
    return {
      ...base,
      eligible: !native,
      reason: native ? 'Wrapped SOL — the program rejects native accounts' : undefined,
      mint: new PublicKey(data.subarray(0, 32)).toBase58(),
      amount: readU64LE(data, 64),
    };
  }
  return { ...base, mint: address.toBase58(), decimals: data.readUInt8(44) };
}

/**
 * A memcmp on the mint-authority field alone can match bytes inside a token
 * account, and a false positive fails the entire batch it lands in. Classic
 * mints are exactly MINT_LEN; extended Token-2022 mints carry an account-type
 * discriminator of 1 at TOKEN_ACCOUNT_LEN.
 */
function isMint(data: Buffer): boolean {
  if (data.length === MINT_LEN) return true;
  return data.length > TOKEN_ACCOUNT_LEN && data.readUInt8(TOKEN_ACCOUNT_LEN) === 1;
}

/** Every token account owned by `owner`, across Token and Token-2022. */
export async function scanTokenAccounts(
  connection: Connection,
  rent: RentCache,
  owner: PublicKey,
): Promise<ReclaimItem[]> {
  const perProgram = await Promise.all(
    [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map(async (programId) => {
      const { value } = await connection.getTokenAccountsByOwner(owner, { programId });
      return Promise.all(
        value.map(({ pubkey, account }) =>
          toItem(rent, pubkey, programId, 'token-account', account.lamports, account.data),
        ),
      );
    }),
  );
  return perProgram.flat();
}

/**
 * Mints whose mint authority is `authority`. Uses getProgramAccounts, which
 * some public RPC endpoints disable — callers should surface the error rather
 * than failing the whole scan.
 */
export async function scanMints(
  connection: Connection,
  rent: RentCache,
  authority: PublicKey,
): Promise<ReclaimItem[]> {
  const perProgram = await Promise.all(
    [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map(async (programId) => {
      const isToken2022 = programId.equals(TOKEN_2022_PROGRAM_ID);
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          // A classic mint is exactly MINT_LEN. Token-2022 mints carry
          // extensions, so they are length-checked below instead.
          ...(isToken2022 ? [] : [{ dataSize: MINT_LEN }]),
          // mintAuthorityOption == Some(1)
          { memcmp: { offset: 0, bytes: '2UzHM' } }, // base58 of [1,0,0,0]
          // mintAuthority == authority
          { memcmp: { offset: 4, bytes: authority.toBase58() } },
        ],
      });
      return Promise.all(
        accounts
          .filter(({ account }) => isMint(account.data))
          .map(({ pubkey, account }) =>
            toItem(rent, pubkey, programId, 'mint', account.lamports, account.data),
          ),
      );
    }),
  );
  return perProgram.flat();
}
