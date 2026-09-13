import { emberJson } from './ember';
import type { Payout, Receipt } from './scan';

/**
 * Ember publishes a per-wallet ledger at `/api/solana/wallet/{address}` that
 * carries three things our own scan cannot recover from the chain:
 *
 *   - `kind`        which module paid — holder rewards, lotto, jackpot, burn…
 *   - `pool`/`mint` which coin the payout came from, as fact rather than the
 *                   quote-pairing inference this app falls back on
 *   - `usd` at the moment of payout, which needs historical pricing
 *
 * It is Ember's word, so it is never allowed to become the ledger. Our scan
 * stays the source of truth for what was received; these labels are attached to
 * it by **transaction signature**, an exact join with nothing inferred. A
 * payout we saw that Ember does not list stays in the receipt, unlabelled.
 */

/** Payout kinds, taken from Ember's own client rather than guessed. */
export const KINDS: Record<string, { label: string; emoji: string }> = {
  holders: { label: 'Holder rewards', emoji: '🪙' },
  lotto: { label: 'SuperLotto', emoji: '🎟️' },
  jackpot: { label: 'Jackpot', emoji: '🎰' },
  wheel: { label: 'Wheel', emoji: '🎡' },
  burn: { label: 'Buyback & burn', emoji: '🔥' },
  booster: { label: 'EMBER Booster', emoji: '🚀' },
  perp: { label: 'Conviction', emoji: '🎯' },
  vault: { label: 'Milestone Vault', emoji: '🏔️' },
  dip: { label: 'Dip Defender', emoji: '🛡️' },
  bounty: { label: 'Top Buyer Bounty', emoji: '🏆' },
  lp: { label: 'LP Farm', emoji: '🌾' },
  airdrop: { label: 'Airdrop', emoji: '🎓' },
  council: { label: 'Council', emoji: '🏛️' },
  payout: { label: 'Creator payout', emoji: '👤' },
};

export const kindLabel = (kind: string) => KINDS[kind]?.label ?? kind;
export const kindEmoji = (kind: string) => KINDS[kind]?.emoji ?? '•';

export interface EmberPayout {
  kind: string;
  pool: string;
  /** The coin that paid — not the token the payout arrived in. */
  mint: string;
  symbol: string;
  /** The token the payout arrived in. */
  quoteTicker: string;
  amount: number;
  usd: number;
  /** True when `usd` is priced at the time of payout rather than now. */
  usdAtPayout?: boolean;
  signature: string | null;
  at: number;
  image?: string | null;
  route?: string;
}

export interface EmberCoin {
  pool: string;
  mint: string;
  symbol: string;
  quoteTicker: string;
  image?: string | null;
  count: number;
  amount: number;
  usd: number;
  lastAt: number;
  kinds: Record<string, number>;
}

export interface EmberWallet {
  wallet: string;
  totalUsd: number;
  count: number;
  byCoin: EmberCoin[];
  payouts: EmberPayout[];
  at: number;
}

export const fetchEmberWallet = (wallet: string) =>
  emberJson<EmberWallet>(`/wallet/${wallet}`, 12000);

/** A payout of ours, with Ember's label attached when one matched. */
export interface Labelled {
  payout: Payout;
  kind: string | null;
  /** Ticker of the coin that paid, per Ember. */
  source: string | null;
  sourceMint: string | null;
  /** USD at the time of payout. Only Ember can supply this. */
  usdAtPayout: number | null;
}

export interface KindTotal {
  kind: string;
  count: number;
  /** Our amounts, summed per token the payout arrived in. */
  byMint: Map<string, number>;
  usdAtPayout: number;
}

export interface Ledger {
  labelled: Labelled[];
  byKind: KindTotal[];
  /** Our payouts, in count, that Ember also lists. */
  matched: number;
  /** Ours that Ember does not list — kept, and reported. */
  unmatched: number;
  /** Ember's, in count, that our scan did not see. */
  missedByScan: number;
  /** Summed `usd` at payout over matched payouts only. */
  usdAtPayout: number;
  /**
   * Our amounts for the matched payouts alone, per token. Pricing these gives a
   * "worth today" covering exactly the same payouts as `usdAtPayout`, so the
   * two can be compared; the receipt total cannot, because it includes payouts
   * Ember never labelled.
   */
  matchedByMint: Map<string, number>;
  /** True when every matched payout carried a payout-time price. */
  usdAtPayoutComplete: boolean;
  emberTotalUsd: number;
  emberCount: number;
  at: number;
}

/**
 * Attaches Ember's labels to our scan by signature. Amounts are always ours;
 * only the label and the payout-time price come from Ember, and a mint
 * mismatch on a shared signature drops the label rather than guessing.
 */
export function buildLedger(
  receipt: Receipt,
  ember: EmberWallet,
  /** Resolves the token a payout arrived in, used only to disambiguate. */
  symbolOf: (mint: string) => string | null = () => null,
): Ledger {
  // A signature can pay one wallet more than once, so rows are grouped rather
  // than overwritten and disambiguated by the token that actually arrived.
  const index = new Map<string, EmberPayout[]>();
  for (const p of ember.payouts) {
    if (!p.signature) continue;
    const group = index.get(p.signature);
    if (group) group.push(p);
    else index.set(p.signature, [p]);
  }

  const used = new Set<EmberPayout>();
  const labelled: Labelled[] = receipt.payouts.map((payout) => {
    const group = index.get(payout.signature) ?? [];
    const free = group.filter((p) => !used.has(p));
    let hit: EmberPayout | undefined;
    if (free.length === 1) {
      hit = free[0];
    } else if (free.length > 1) {
      // Ember names the coin that paid in `symbol` and the token it paid in
      // as `quoteTicker`; ours is the token that arrived.
      const ticker = symbolOf(payout.mint);
      hit = free.find((p) => ticker != null && p.quoteTicker === ticker);
    }
    if (hit) used.add(hit);
    return {
      payout,
      kind: hit ? hit.kind : null,
      source: hit ? hit.symbol : null,
      sourceMint: hit ? hit.mint : null,
      usdAtPayout: hit && hit.usdAtPayout ? hit.usd : null,
    };
  });

  const kinds = new Map<string, KindTotal>();
  const matchedByMint = new Map<string, number>();
  let usdAtPayout = 0;
  let priced = 0;
  let matched = 0;

  for (const row of labelled) {
    if (row.kind == null) continue;
    matched += 1;
    if (row.usdAtPayout != null) {
      usdAtPayout += row.usdAtPayout;
      priced += 1;
    }
    let total = kinds.get(row.kind);
    if (!total) {
      total = { kind: row.kind, count: 0, byMint: new Map(), usdAtPayout: 0 };
      kinds.set(row.kind, total);
    }
    total.count += 1;
    total.byMint.set(row.payout.mint, (total.byMint.get(row.payout.mint) ?? 0) + row.payout.amount);
    matchedByMint.set(row.payout.mint, (matchedByMint.get(row.payout.mint) ?? 0) + row.payout.amount);
    total.usdAtPayout += row.usdAtPayout ?? 0;
  }

  return {
    labelled,
    byKind: [...kinds.values()].sort((a, b) => b.count - a.count),
    matched,
    unmatched: labelled.length - matched,
    missedByScan: ember.payouts.filter((p) => p.signature && !used.has(p)).length,
    usdAtPayout,
    matchedByMint,
    usdAtPayoutComplete: priced === matched && matched > 0,
    emberTotalUsd: ember.totalUsd,
    emberCount: ember.count,
    at: ember.at,
  };
}
