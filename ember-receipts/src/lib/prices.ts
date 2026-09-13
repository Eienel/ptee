/**
 * Current USD prices from Jupiter's public price API.
 *
 * This values earnings at TODAY's price, which is not what they were worth when
 * they landed. For these tokens that gap is not academic — $EMBER moved 75% in
 * a single day while this was being written — so anywhere a dollar figure is
 * shown it has to say which one it is.
 */

const PRICE_API = 'https://lite-api.jup.ag/price/v3?ids=';
const BATCH = 50;

/** Below this, a quoted price is too thin to mean much. */
export const THIN_LIQUIDITY_USD = 25_000;

export interface TokenPrice {
  usd: number;
  /** Pool liquidity behind the quote, in USD. */
  liquidity: number;
  change24h: number;
  /** True when liquidity is too thin for the price to be trusted. */
  thin: boolean;
}

export async function fetchPrices(mints: string[]): Promise<Map<string, TokenPrice>> {
  const out = new Map<string, TokenPrice>();
  const unique = [...new Set(mints)];

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    try {
      const res = await fetch(PRICE_API + batch.join(','), { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      const body = (await res.json()) as Record<
        string,
        { usdPrice?: number; liquidity?: number; priceChange24h?: number } | null
      >;
      for (const [mint, value] of Object.entries(body)) {
        if (!value || typeof value.usdPrice !== 'number' || !Number.isFinite(value.usdPrice)) continue;
        const liquidity = typeof value.liquidity === 'number' ? value.liquidity : 0;
        out.set(mint, {
          usd: value.usdPrice,
          liquidity,
          change24h: typeof value.priceChange24h === 'number' ? value.priceChange24h : 0,
          thin: liquidity < THIN_LIQUIDITY_USD,
        });
      }
    } catch {
      // Prices are a nice-to-have; the receipt stands without them.
    }
  }
  return out;
}

/** Total current value of a set of token holdings, plus what could not be priced. */
export function valueOf(
  totals: Array<{ mint: string; total: number }>,
  prices: Map<string, TokenPrice>,
): { usd: number; priced: number; unpriced: string[]; thin: boolean } {
  let usd = 0;
  let priced = 0;
  let thin = false;
  const unpriced: string[] = [];

  for (const t of totals) {
    const price = prices.get(t.mint);
    if (!price) {
      unpriced.push(t.mint);
      continue;
    }
    usd += t.total * price.usd;
    priced += 1;
    if (price.thin) thin = true;
  }
  return { usd, priced, unpriced, thin };
}
