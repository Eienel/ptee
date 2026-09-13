import { Connection, PublicKey } from '@solana/web3.js';
import { METAPLEX_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from './constants';

const decoder = new TextDecoder();
const u32 = (d: Uint8Array, o: number) => new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(o, true);
const u16 = (d: Uint8Array, o: number) => new DataView(d.buffer, d.byteOffset, d.byteLength).getUint16(o, true);

/** Borsh string: u32 length prefix then bytes, NUL-padded by Metaplex. */
function readString(data: Uint8Array, offset: number): [string, number] {
  const len = u32(data, offset);
  const raw = decoder.decode(data.subarray(offset + 4, offset + 4 + len));
  return [raw.replace(/\0+$/, '').trim(), offset + 4 + len];
}

function parseMetaplex(data: Uint8Array): string | null {
  try {
    // key(1) + updateAuthority(32) + mint(32), then name, then symbol
    const [, afterName] = readString(data, 65);
    const [symbol] = readString(data, afterName);
    return symbol || null;
  } catch {
    return null;
  }
}

/** Token-2022 TokenMetadata extension (type 19) sits after the base mint layout. */
function parseToken2022Symbol(data: Uint8Array): string | null {
  if (data.length <= 165) return null;
  let offset = 166;
  while (offset + 4 <= data.length) {
    const type = u16(data, offset);
    const len = u16(data, offset + 2);
    if (type === 0 && len === 0) break;
    if (type === 19) {
      try {
        const value = data.subarray(offset + 4, offset + 4 + len);
        const [, afterName] = readString(value, 64); // updateAuthority + mint
        const [symbol] = readString(value, afterName);
        return symbol || null;
      } catch {
        return null;
      }
    }
    offset += 4 + len;
  }
  return null;
}

const metadataPda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('metadata'), METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METAPLEX_PROGRAM_ID,
  )[0];

/**
 * Resolves ticker symbols for the mints a wallet was paid in. Falls back to a
 * shortened mint address so a token with no metadata still renders.
 */
export async function resolveSymbols(
  connection: Connection,
  mints: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (mints.length === 0) return out;

  const keys = mints.map((m) => new PublicKey(m));
  const [metadataAccounts, mintAccounts] = await Promise.all([
    connection.getMultipleAccountsInfo(keys.map(metadataPda)),
    connection.getMultipleAccountsInfo(keys),
  ]);

  keys.forEach((key, i) => {
    const mint = key.toBase58();
    const meta = metadataAccounts[i];
    let symbol = meta ? parseMetaplex(meta.data) : null;

    if (!symbol) {
      const acct = mintAccounts[i];
      if (acct?.owner.equals(TOKEN_2022_PROGRAM_ID)) symbol = parseToken2022Symbol(acct.data);
    }
    out.set(mint, symbol || `${mint.slice(0, 4)}…`);
  });

  return out;
}
