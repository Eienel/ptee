import { Connection, PublicKey } from '@solana/web3.js';
import { imageUrlFromMetadataUri } from './images';
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

export interface TokenMeta {
  symbol: string;
  name: string | null;
  /** Off-chain metadata document, if the mint points at one. */
  uri: string | null;
  /** Resolved artwork, filled in later by loadImages. */
  image?: string | null;
}

function parseMetaplex(data: Uint8Array): { symbol: string; name: string; uri: string } | null {
  try {
    // key(1) + updateAuthority(32) + mint(32), then name, symbol, uri
    const [name, afterName] = readString(data, 65);
    const [symbol, afterSymbol] = readString(data, afterName);
    const [uri] = readString(data, afterSymbol);
    return { symbol, name, uri };
  } catch {
    return null;
  }
}

/** Token-2022 TokenMetadata extension (type 19) sits after the base mint layout. */
function parseToken2022Meta(data: Uint8Array): { symbol: string; name: string; uri: string } | null {
  if (data.length <= 165) return null;
  let offset = 166;
  while (offset + 4 <= data.length) {
    const type = u16(data, offset);
    const len = u16(data, offset + 2);
    if (type === 0 && len === 0) break;
    if (type === 19) {
      try {
        const value = data.subarray(offset + 4, offset + 4 + len);
        const [name, afterName] = readString(value, 64); // updateAuthority + mint
        const [symbol, afterSymbol] = readString(value, afterName);
        const [uri] = readString(value, afterSymbol);
        return { symbol, name, uri };
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
 * Resolves tickers, names and metadata URIs for a set of mints in two batched
 * calls. Falls back to a shortened mint address so a token with no metadata
 * still renders.
 */
export async function resolveTokens(
  connection: Connection,
  mints: string[],
): Promise<Map<string, TokenMeta>> {
  const out = new Map<string, TokenMeta>();
  if (mints.length === 0) return out;

  const keys = mints.map((m) => new PublicKey(m));
  const [metadataAccounts, mintAccounts] = await Promise.all([
    connection.getMultipleAccountsInfo(keys.map(metadataPda)),
    connection.getMultipleAccountsInfo(keys),
  ]);

  keys.forEach((key, i) => {
    const mint = key.toBase58();
    const meta = metadataAccounts[i];
    let parsed = meta ? parseMetaplex(meta.data) : null;

    if (!parsed?.symbol) {
      const acct = mintAccounts[i];
      if (acct?.owner.equals(TOKEN_2022_PROGRAM_ID)) parsed = parseToken2022Meta(acct.data) ?? parsed;
    }
    out.set(mint, {
      symbol: parsed?.symbol || `${mint.slice(0, 4)}…`,
      name: parsed?.name || null,
      uri: parsed?.uri || null,
      image: null,
    });
  });

  return out;
}

/**
 * Fills in artwork for tokens that declare a metadata document. Runs after the
 * receipt is already on screen, so a slow or dead gateway costs nothing.
 */
export async function loadImages(
  tokens: Map<string, TokenMeta>,
): Promise<Map<string, TokenMeta>> {
  const entries = [...tokens.entries()];
  const images = await Promise.all(
    entries.map(([, meta]) => (meta.uri ? imageUrlFromMetadataUri(meta.uri) : Promise.resolve(null))),
  );
  const next = new Map(tokens);
  entries.forEach(([mint, meta], i) => next.set(mint, { ...meta, image: images[i] }));
  return next;
}
