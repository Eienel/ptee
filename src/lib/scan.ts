import { Buffer } from 'buffer';
import { Connection, PublicKey } from '@solana/web3.js';
import { MINT_LEN, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from './constants';
import { RentCache } from './rent';

export type ReclaimKind = 'token-account' | 'mint';

export interface ReclaimItem {
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
  };

  if (kind === 'token-account') {
    return {
      ...base,
      mint: new PublicKey(data.subarray(0, 32)).toBase58(),
      amount: readU64LE(data, 64),
    };
  }
  return { ...base, mint: address.toBase58(), decimals: data.readUInt8(44) };
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
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          // mintAuthorityOption == Some(1)
          { memcmp: { offset: 0, bytes: '2UzHM' } }, // base58 of [1,0,0,0]
          // mintAuthority == authority
          { memcmp: { offset: 4, bytes: authority.toBase58() } },
        ],
      });
      return Promise.all(
        accounts
          // Token-2022 mints carry extensions past the base layout; classic
          // mints are exactly MINT_LEN. Anything shorter is not a mint.
          .filter(({ account }) => account.data.length >= MINT_LEN)
          .map(({ pubkey, account }) =>
            toItem(rent, pubkey, programId, 'mint', account.lamports, account.data),
          ),
      );
    }),
  );
  return perProgram.flat();
}
