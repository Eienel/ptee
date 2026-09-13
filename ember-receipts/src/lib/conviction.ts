import { emberJson } from './ember';

/**
 * Conviction is Ember's leverage module ("perp" in their API and config). A
 * coin routes part of the creator side of its fees into collateral on an
 * isolated venue sub-account, holds a fixed-leverage position, and harvests
 * profit in steps — paying holders, buying back and burning the coin, and
 * burning $EMBER.
 *
 * Everything here comes from Ember's published endpoints. The shapes below are
 * the ones their own client reads, so they are the real contract; the values
 * are Ember's word. While `live` is false the venue is not deployed and every
 * position is simulated at live prices ("paper mode") — a paper PnL is a
 * quote, not money, and must never be shown as earnings.
 */

export type Side = 'long' | 'short';

export interface Market {
  symbol: string;
  name: string;
  kind: 'crypto' | 'stock' | 'commodity' | 'meme';
  maxLev: number;
}

export interface Markets {
  markets: Market[];
  /** Leverage tiers open to everyone. Higher tiers are locked for now. */
  tiers: number[];
  enabled: boolean;
  /** False while the venue is not deployed — positions are simulated. */
  live: boolean;
  venue: string;
  profitSplit: { holders: number; burn: number; ember: number };
}

export interface Position {
  pnl: number;
  pnlPct: number;
  collateral: number;
  notional: number;
  entry: number;
  liq: number;
  /** Unrealized PnL at which the next take-profit fires. */
  nextHarvestAt: number;
}

export interface PerpEvent {
  type: 'open' | 'harvest' | 'topup' | 'liquidated' | string;
  at: number;
  usd: number;
  notional?: number;
  underwater?: boolean;
  split?: { holders: number; burn: number; ember: number };
  sig?: string | null;
}

export interface Perp {
  empty?: boolean;
  market: string;
  side: Side;
  lev: number;
  mark: number;
  paper: boolean;
  /** Basis points of the creator fee share that becomes collateral. */
  convictionBps: number;
  position: Position | null;
  /** Collateral accrued but not yet deployed, while under `policy.openUsd`. */
  reserveUsd: number;
  paidHoldersUsd: number;
  burnUsd: number;
  emberUsd: number;
  harvests: number;
  liquidations: number;
  history: PerpEvent[];
  explorer?: string | null;
  policy: {
    openUsd: number;
    harvestStepPct: number;
    harvestClosePct: number;
    profitSplit: { holders: number; burn: number; ember: number };
  };
}

export interface ArenaCoin {
  pool: string;
  route: string;
  symbol: string;
  name: string;
  image: string | null;
  quoteTicker: string;
  market: string;
  side: Side;
  lev: number;
  paper: boolean;
  open: boolean;
  pnl: number;
  pnlPct: number;
  reserveUsd: number;
  paidHoldersUsd: number;
  harvests: number;
  liquidations: number;
  underwater: boolean;
  aliveS: number;
  spark?: number[];
}

export interface Arena {
  computedAt: number;
  coins: ArenaCoin[];
  live: boolean;
  venue: string;
}

export const fetchMarkets = () => emberJson<Markets>('/perp/markets');
export const fetchArena = () => emberJson<Arena>('/arena', 12000);

/** Keyed by pool address, not mint — that is what Ember's own client passes. */
export const fetchPerp = (pool: string) => emberJson<Perp>(`/perp/${pool}`);

/** An `empty` response means the coin has never configured Conviction. */
export const hasConviction = (perp: Perp | null): perp is Perp =>
  perp != null && perp.empty !== true;

/** Distance from mark to liquidation, as a percentage of mark. */
export const liqDistancePct = (position: Position, mark: number): number =>
  mark === 0 ? 0 : Math.abs(((position.liq - mark) / mark) * 100);

/** How far along the position is toward its next take-profit. */
export const harvestProgress = (position: Position): number => {
  if (!(position.nextHarvestAt > 0)) return 0;
  return Math.max(0, Math.min(1, position.pnl / position.nextHarvestAt));
};
