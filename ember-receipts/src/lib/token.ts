import { Connection, PublicKey } from '@solana/web3.js';
import { EMBER_KEEPER, EMBER_PAYOUTS_API } from './constants';
import { loadImages, resolveTokens } from './tokens';

/** Meteora's Dynamic Bonding Curve program. */
export const DBC_PROGRAM_ID = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');

/**
 * Offsets derived from the DBC IDL by recursively sizing the nested types, and
 * confirmed against live accounts (base_mint at 136, VirtualPool 424 bytes).
 */
const VIRTUAL_POOL_LEN = 424;
const POOL = { config: 72, creator: 104, baseMint: 136, baseReserve: 232, quoteReserve: 240, poolType: 304, isMigrated: 305, migrationProgress: 308 };
const CONFIG = { quoteMint: 8, feeClaimer: 40, migrationThreshold: 264 };

/** Meteora's DBC index. Undocumented, so every field is treated as optional. */
const METEORA_DBC_POOL = (address: string) => `https://dbc.datapi.meteora.ag/pools/${address}`;

export interface FeeEvent {
  kind: string;
  amount: number;
  ticker: string;
  signature: string | null;
  at: number;
}

export interface TokenView {
  mint: string;
  pool: string;
  config: string;
  creator: string;
  symbol: string | null;
  name: string | null;
  image: string | null;
  createdAt: number | null;
  quoteMint: string;
  quoteSymbol: string | null;
  quoteReserve: number;
  migrationThreshold: number;
  progressPct: number;
  isMigrated: boolean;
  migrationProgress: number;
  feeClaimer: string;
  /** True when this launch's fees are claimed by Ember's keeper. */
  launchedOnEmber: boolean;
  /** Recent fee activity for this pool, from Ember's own ledger. */
  feeActivity: FeeEvent[];
  /** Ember's ledger only reaches back about an hour, so absence proves nothing. */
  feeActivityWindow: { from: number; to: number } | null;
}

const pk = (data: Uint8Array, offset: number) =>
  new PublicKey(data.subarray(offset, offset + 32)).toBase58();

const u64 = (data: Uint8Array, offset: number) =>
  new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);

/** Is this address a token mint, a wallet, or something else? */
export async function classifyAddress(
  connection: Connection,
  address: PublicKey,
): Promise<'mint' | 'wallet' | 'unknown'> {
  const info = await connection.getAccountInfo(address);
  if (!info) return 'wallet'; // an unfunded wallet has no account yet
  const owner = info.owner.toBase58();
  if (owner === '11111111111111111111111111111111') return 'wallet';
  if (owner.startsWith('Token') && (info.data.length === 82 || info.data.length > 165)) return 'mint';
  return 'unknown';
}

/** The DBC pool a token launched on, if it has one. */
async function findPool(connection: Connection, mint: PublicKey) {
  const accounts = await connection.getProgramAccounts(DBC_PROGRAM_ID, {
    filters: [{ dataSize: VIRTUAL_POOL_LEN }, { memcmp: { offset: POOL.baseMint, bytes: mint.toBase58() } }],
  });
  return accounts[0] ?? null;
}

async function meteoraPool(address: string) {
  try {
    const res = await fetch(METEORA_DBC_POOL(address), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as {
      created_at?: number;
      token_x?: { symbol?: string; name?: string; decimals?: number };
      token_y?: { symbol?: string; decimals?: number };
    };
  } catch {
    return null;
  }
}

/** Fee and payout activity Ember has published for this pool. */
async function emberActivity(pool: string): Promise<{ events: FeeEvent[]; window: { from: number; to: number } | null }> {
  try {
    const res = await fetch(`${EMBER_PAYOUTS_API}?limit=500`, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return { events: [], window: null };
    const body = (await res.json()) as { payouts?: Array<Record<string, unknown>> };
    const all = body.payouts ?? [];
    if (all.length === 0) return { events: [], window: null };

    const times = all.map((p) => Number(p.at)).filter((t) => Number.isFinite(t));
    const events = all
      .filter((p) => p.pool === pool)
      .map((p) => ({
        kind: String(p.kind ?? '—'),
        amount: Number(p.amount ?? 0),
        ticker: String(p.quoteTicker ?? ''),
        signature: (p.signature as string | null) ?? null,
        at: Number(p.at ?? 0),
      }));
    return { events, window: { from: Math.min(...times), to: Math.max(...times) } };
  } catch {
    return { events: [], window: null };
  }
}

export async function loadToken(connection: Connection, mint: PublicKey): Promise<TokenView | null> {
  const account = await findPool(connection, mint);
  if (!account) return null;

  const data = account.account.data;
  const configAddress = pk(data, POOL.config);
  const configInfo = await connection.getAccountInfo(new PublicKey(configAddress));
  if (!configInfo) return null;

  const quoteMint = pk(configInfo.data, CONFIG.quoteMint);
  const feeClaimer = pk(configInfo.data, CONFIG.feeClaimer);
  const thresholdRaw = u64(configInfo.data, CONFIG.migrationThreshold);
  const reserveRaw = u64(data, POOL.quoteReserve);

  const quoteInfo = await connection.getAccountInfo(new PublicKey(quoteMint));
  const quoteDecimals = quoteInfo ? quoteInfo.data[44] : 0;
  const scale = 10 ** quoteDecimals;

  const pool = account.pubkey.toBase58();
  const [meta, activity, onChainMeta] = await Promise.all([
    meteoraPool(pool),
    emberActivity(pool),
    resolveTokens(connection, [mint.toBase58()]).then(loadImages),
  ]);
  const local = onChainMeta.get(mint.toBase58());

  return {
    mint: mint.toBase58(),
    pool,
    config: configAddress,
    creator: pk(data, POOL.creator),
    symbol: meta?.token_x?.symbol ?? local?.symbol ?? null,
    name: meta?.token_x?.name ?? local?.name ?? null,
    image: local?.image ?? null,
    createdAt: meta?.created_at ? Math.floor(meta.created_at / 1000) : null,
    quoteMint,
    quoteSymbol: meta?.token_y?.symbol ?? null,
    quoteReserve: Number(reserveRaw) / scale,
    migrationThreshold: Number(thresholdRaw) / scale,
    progressPct: thresholdRaw > 0n ? Number((reserveRaw * 10000n) / thresholdRaw) / 100 : 0,
    isMigrated: data[POOL.isMigrated] === 1,
    migrationProgress: data[POOL.migrationProgress],
    feeClaimer,
    launchedOnEmber: feeClaimer === EMBER_KEEPER.toBase58(),
    feeActivity: activity.events,
    feeActivityWindow: activity.window,
  };
}
