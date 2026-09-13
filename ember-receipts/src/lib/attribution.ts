import { Connection, PublicKey } from '@solana/web3.js';
import { DBC_PROGRAM_ID } from './token';

/**
 * Which coin paid you.
 *
 * Ember pays holders in whatever their coin is paired against — verified across
 * 156 pools in Ember's ledger, none of which pay in more than one token, and
 * against the chain, where the payout token is the pool config's `quote_mint`.
 *
 * So a payout can be traced back by inverting the pairing: a credit in GOOGLx
 * came from a GOOGLx-paired coin, and the candidates are the GOOGLx-paired
 * coins this wallet actually holds.
 *
 * This is INFERENCE, not proof. Everything else in a receipt links to a
 * signature; this does not. It also cannot see a coin that has since been sold,
 * because there is no holding left to match against.
 */

const VIRTUAL_POOL_LEN = 424;
const POOL_CONFIG_OFFSET = 72;
const POOL_BASE_MINT_OFFSET = 136;
const CONFIG_QUOTE_MINT_OFFSET = 8;

export interface PairedCoin {
  mint: string;
  pool: string;
  quoteMint: string;
}

/** Resolves the bonding-curve pairing for each mint the wallet holds. */
export async function pairedCoins(
  connection: Connection,
  mints: string[],
): Promise<PairedCoin[]> {
  // One filtered lookup per held mint, fetching only the config pubkey.
  const pools = await Promise.all(
    mints.map(async (mint) => {
      try {
        const found = await connection.getProgramAccounts(DBC_PROGRAM_ID, {
          dataSlice: { offset: POOL_CONFIG_OFFSET, length: 32 },
          filters: [
            { dataSize: VIRTUAL_POOL_LEN },
            { memcmp: { offset: POOL_BASE_MINT_OFFSET, bytes: mint } },
          ],
        });
        if (found.length === 0) return null;
        return {
          mint,
          pool: found[0].pubkey.toBase58(),
          config: new PublicKey(found[0].account.data).toBase58(),
        };
      } catch {
        return null;
      }
    }),
  );

  const present = pools.filter((p): p is NonNullable<typeof p> => p !== null);
  if (present.length === 0) return [];

  // One batched read for every config, to pull each pool's quote mint.
  const configs = await connection.getMultipleAccountsInfo(
    present.map((p) => new PublicKey(p.config)),
  );

  return present.flatMap((p, i) => {
    const data = configs[i]?.data;
    if (!data) return [];
    const quoteMint = new PublicKey(
      data.subarray(CONFIG_QUOTE_MINT_OFFSET, CONFIG_QUOTE_MINT_OFFSET + 32),
    ).toBase58();
    return [{ mint: p.mint, pool: p.pool, quoteMint }];
  });
}

/**
 * Candidate source coins per payout token: the held coins paired against it.
 * One candidate means the attribution is unambiguous; several means a shortlist.
 */
export function attributeByQuote(paired: PairedCoin[]): Map<string, string[]> {
  const byQuote = new Map<string, string[]>();
  for (const coin of paired) {
    byQuote.set(coin.quoteMint, [...(byQuote.get(coin.quoteMint) ?? []), coin.mint]);
  }
  return byQuote;
}
