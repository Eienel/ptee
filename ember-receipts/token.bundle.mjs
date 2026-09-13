// src/lib/token.ts
import { PublicKey as PublicKey2 } from "@solana/web3.js";

// src/lib/constants.ts
import { PublicKey } from "@solana/web3.js";
var EMBER_KEEPER = new PublicKey("GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp");
var EMBER_MINT = new PublicKey("5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6");
var MET_MINT = new PublicKey("METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL");
var TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
var METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
var EMBER_PAYOUTS_API = "https://embercurve.fun/api/solana/payouts";

// src/lib/token.ts
var DBC_PROGRAM_ID = new PublicKey2("dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN");
var VIRTUAL_POOL_LEN = 424;
var POOL = { config: 72, creator: 104, baseMint: 136, baseReserve: 232, quoteReserve: 240, poolType: 304, isMigrated: 305, migrationProgress: 308 };
var CONFIG = { quoteMint: 8, feeClaimer: 40, migrationThreshold: 264 };
var METEORA_DBC_POOL = (address) => `https://dbc.datapi.meteora.ag/pools/${address}`;
var pk = (data, offset) => new PublicKey2(data.subarray(offset, offset + 32)).toBase58();
var u64 = (data, offset) => new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);
async function classifyAddress(connection, address) {
  const info = await connection.getAccountInfo(address);
  if (!info) return "wallet";
  const owner = info.owner.toBase58();
  if (owner === "11111111111111111111111111111111") return "wallet";
  if (owner.startsWith("Token") && (info.data.length === 82 || info.data.length > 165)) return "mint";
  return "unknown";
}
async function findPool(connection, mint) {
  const accounts = await connection.getProgramAccounts(DBC_PROGRAM_ID, {
    filters: [{ dataSize: VIRTUAL_POOL_LEN }, { memcmp: { offset: POOL.baseMint, bytes: mint.toBase58() } }]
  });
  return accounts[0] ?? null;
}
async function meteoraPool(address) {
  try {
    const res = await fetch(METEORA_DBC_POOL(address), { signal: AbortSignal.timeout(8e3) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function emberActivity(pool) {
  try {
    const res = await fetch(`${EMBER_PAYOUTS_API}?limit=500`, { signal: AbortSignal.timeout(9e3) });
    if (!res.ok) return { events: [], window: null };
    const body = await res.json();
    const all = body.payouts ?? [];
    if (all.length === 0) return { events: [], window: null };
    const times = all.map((p) => Number(p.at)).filter((t) => Number.isFinite(t));
    const events = all.filter((p) => p.pool === pool).map((p) => ({
      kind: String(p.kind ?? "\u2014"),
      amount: Number(p.amount ?? 0),
      ticker: String(p.quoteTicker ?? ""),
      signature: p.signature ?? null,
      at: Number(p.at ?? 0)
    }));
    return { events, window: { from: Math.min(...times), to: Math.max(...times) } };
  } catch {
    return { events: [], window: null };
  }
}
async function loadToken(connection, mint) {
  const account = await findPool(connection, mint);
  if (!account) return null;
  const data = account.account.data;
  const configAddress = pk(data, POOL.config);
  const configInfo = await connection.getAccountInfo(new PublicKey2(configAddress));
  if (!configInfo) return null;
  const quoteMint = pk(configInfo.data, CONFIG.quoteMint);
  const feeClaimer = pk(configInfo.data, CONFIG.feeClaimer);
  const thresholdRaw = u64(configInfo.data, CONFIG.migrationThreshold);
  const reserveRaw = u64(data, POOL.quoteReserve);
  const quoteInfo = await connection.getAccountInfo(new PublicKey2(quoteMint));
  const quoteDecimals = quoteInfo ? quoteInfo.data[44] : 0;
  const scale = 10 ** quoteDecimals;
  const pool = account.pubkey.toBase58();
  const [meta, activity] = await Promise.all([meteoraPool(pool), emberActivity(pool)]);
  return {
    mint: mint.toBase58(),
    pool,
    config: configAddress,
    creator: pk(data, POOL.creator),
    symbol: meta?.token_x?.symbol ?? null,
    name: meta?.token_x?.name ?? null,
    createdAt: meta?.created_at ? Math.floor(meta.created_at / 1e3) : null,
    quoteMint,
    quoteSymbol: meta?.token_y?.symbol ?? null,
    quoteReserve: Number(reserveRaw) / scale,
    migrationThreshold: Number(thresholdRaw) / scale,
    progressPct: thresholdRaw > 0n ? Number(reserveRaw * 10000n / thresholdRaw) / 100 : 0,
    isMigrated: data[POOL.isMigrated] === 1,
    migrationProgress: data[POOL.migrationProgress],
    feeClaimer,
    launchedOnEmber: feeClaimer === EMBER_KEEPER.toBase58(),
    feeActivity: activity.events,
    feeActivityWindow: activity.window
  };
}
export {
  DBC_PROGRAM_ID,
  classifyAddress,
  loadToken
};
