import { emberJson } from './ember';

/**
 * What holding a coin has actually been paying.
 *
 * This is deliberately **not** a forecast. Two things ruled that out.
 *
 * First, Ember's `volumeUsd` is not measured volume — for every coin it is
 * exactly `feesUsd / feeRate`, to four decimal places, across all 2,532 of
 * them. Volume is presented, not observed, so any model expressed as a
 * percentage of volume would be a restatement of fees wearing a disguise.
 *
 * Second, the share of fees that reaches holders is not stable over time. The
 * trailing-24h rate runs between 0.09x and 0.89x of the all-time rate (median
 * 0.38x) because fees are claimed and distributed in batched rounds, and
 * because a coin's rate changes when it graduates onto DAMM v2. Projecting the
 * all-time rate onto tomorrow would overstate earnings by up to eleven times.
 *
 * So this reports what was paid, over windows that actually happened, scaled by
 * a holder's share of supply. The arithmetic is one multiplication and every
 * input is a figure Ember published.
 */

/** Payout kinds that reach holders, as opposed to the creator or a burn. */
const TO_HOLDERS = ['holders', 'lotto', 'jackpot', 'bounty', 'wheel', 'airdrop'] as const;

export interface ByKind {
  [kind: string]: number | undefined;
}

interface Window {
  feesUsd?: number;
  claimedUsd?: number;
  paidUsd?: number;
  byKindUsd?: ByKind;
  volumeUsd?: number;
  rounds?: number;
}

export interface Market {
  pool: string;
  mint: string;
  symbol: string;
  name: string;
  image: string | null;
  route: string;
  quoteTicker: string;
  creator: string;
  config: string;
  dammPool: string | null;
  /** Trade tax in basis points while on the bonding curve. */
  feeBps: number;
  /** Fee in basis points once graduated onto DAMM v2. */
  dammFeeBps: number;
  /** Share of the creator side routed to holders, in basis points. */
  holdersBps: number;
  /** Which payout module this coin runs. */
  mode: string;
  graduated: boolean;
  holders: number;
  priceUsd: number;
  marketCapUsd: number;
  fees24hUsd: number;
  trades24h: number;
  change24h: number;
  createdAt: number;
  allTime?: Window;
  ledger24h?: Window;
}

export interface Markets {
  markets: Market[];
  economics?: { totalSupply?: number; feeSplit?: { creatorShareBps?: number } };
}

export const fetchMarkets = () => emberJson<Markets>('/markets', 20000);

export const toHolders = (byKind: ByKind | undefined): number =>
  byKind ? TO_HOLDERS.reduce((sum, k) => sum + (byKind[k] ?? 0), 0) : 0;

export interface Yield {
  market: Market;
  /** Paid to holders in the last 24h, in USD, as Ember reported it. */
  holders24hUsd: number;
  /** Paid to holders over the coin's whole life. */
  holdersAllUsd: number;
  /** Share of all fees the coin has ever claimed that reached holders. */
  shareOfFees: number | null;
  /** Days of payout history behind `holdersAllUsd`. */
  days: number | null;
}

const DAY = 86_400;

export function summarise(market: Market, now: number): Yield {
  const all = market.allTime;
  const fees = all?.feesUsd ?? 0;
  const holdersAllUsd = toHolders(all?.byKindUsd);
  return {
    market,
    holders24hUsd: toHolders(market.ledger24h?.byKindUsd),
    holdersAllUsd,
    shareOfFees: fees > 0 ? holdersAllUsd / fees : null,
    days: market.createdAt ? Math.max(1, (now - market.createdAt) / DAY) : null,
  };
}

/**
 * A flat share of the pot, for reference only.
 *
 * Checked against the one wallet whose real earnings we can read: a 0.7278%
 * holder of EMBER is modelled at $39.92/day and actually received $73.69/day,
 * so the flat share was out by 1.85x. Two mechanisms guarantee a gap in either
 * direction, and neither is computable from public data: Diamond Hands weights
 * a holder 1x to 3x by how long they have held, and rounds pay at most 300
 * wallets at a time, so a holder collects on a rotation rather than every
 * round. This is exposed as a reference figure with that stated, never as an
 * expected payout, and it is never annualised.
 */
export const FLAT_SHARE_ERROR = 1.85;

export function earnedOn(y: Yield, share: number): { last24h: number; allTime: number } {
  return { last24h: y.holders24hUsd * share, allTime: y.holdersAllUsd * share };
}

/**
 * Per $1,000 held, so coins of different sizes can be compared. Uses market cap
 * as the denominator because that is what a dollar of stake buys a share of.
 */
export function per1000(y: Yield): number | null {
  const cap = y.market.marketCapUsd;
  if (!(cap > 0)) return null;
  return (y.holders24hUsd / cap) * 1000;
}

/**
 * Ranking by yield alone surfaces junk: of the 67 coins that paid holders in a
 * sampled 24h, 39% had fewer than 50 holders, and the top of the unfiltered
 * list was $3k-cap coins with three holders showing "$261/day per $1,000" —
 * the shape of wash trading, not of income. A ranking that promotes those is
 * worse than no ranking, so credibility is a precondition for being listed
 * rather than a column to sort by afterwards.
 */
export const FLOOR = { holders: 250, marketCapUsd: 50_000, trades24h: 100 };

export const credible = (m: Market): boolean =>
  m.holders >= FLOOR.holders &&
  m.marketCapUsd >= FLOOR.marketCapUsd &&
  m.trades24h >= FLOOR.trades24h;

export function leaderboard(markets: Market[], now: number, limit = 25): Yield[] {
  return markets
    .filter((m) => credible(m) && m.marketCapUsd > 0)
    .map((m) => summarise(m, now))
    .filter((y) => y.holders24hUsd > 0)
    .sort((a, b) => (per1000(b) ?? 0) - (per1000(a) ?? 0))
    .slice(0, limit);
}

export interface Jackpot {
  kind: string;
  /** Rounds of this kind observed platform-wide. */
  rounds: number;
  totalUsd: number;
  /** Mean prize per round. Not a typical prize — the spread is unknown. */
  meanUsd: number;
}

/** Platform-wide prize history, for coins running a draw of some kind. */
export function jackpots(totals: {
  byKindUsd?: ByKind;
  rounds?: Record<string, number>;
}): Jackpot[] {
  const rounds = totals.rounds ?? {};
  const by = totals.byKindUsd ?? {};
  return (['jackpot', 'lotto', 'wheel', 'bounty'] as const)
    .map((kind) => ({
      kind,
      rounds: rounds[kind] ?? 0,
      totalUsd: by[kind] ?? 0,
      meanUsd: rounds[kind] ? (by[kind] ?? 0) / rounds[kind] : 0,
    }))
    .filter((j) => j.rounds > 0);
}
