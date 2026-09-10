import fs from 'node:fs';
import { PublicKey } from '@solana/web3.js';

const batches = JSON.parse(fs.readFileSync('raw/pools-full.json'));
const meta = new Map(JSON.parse(fs.readFileSync('raw/pools-with-badged-quote.json')).map((p) => [p.pool, p]));
const pk = (d, o) => new PublicKey(d.subarray(o, o + 32)).toBase58();

const pools = [];
for (const b of batches) {
  b.keys.forEach((key, i) => {
    const acc = b.value[i];
    if (!acc) return;
    const d = Buffer.from(acc.data[0], 'base64');
    pools.push({
      pool: key,
      config: pk(d, 72),
      creator: pk(d, 104),
      baseMint: pk(d, 136),
      quoteVault: pk(d, 200),
      quoteMint: meta.get(key).quoteMint,
      baseReserve: d.readBigUInt64LE(232).toString(),
      quoteReserve: d.readBigUInt64LE(240).toString(),
      poolType: d.readUInt8(304),
      isMigrated: d.readUInt8(305),
      migrationProgress: d.readUInt8(308),
      hasSwap: d.readUInt8(370),
    });
  });
}
fs.writeFileSync('raw/pools-decoded.json', JSON.stringify(pools, null, 2));

const configs = [...new Set(pools.map((p) => p.config))];
console.log('pools decoded:', pools.length, '| distinct configs:', configs.length);

// migration_quote_threshold lives at offset 264 of PoolConfig (confirmed from IDL)
const out = [];
for (let i = 0; i < configs.length; i += 100) {
  const batch = configs.slice(i, i + 100);
  const res = await fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getMultipleAccounts', params: [batch, { encoding: 'base64' }] }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  batch.forEach((key, k) => {
    const d = Buffer.from(j.result.value[k].data[0], 'base64');
    out.push({
      config: key,
      quoteMint: pk(d, 8),
      migrationQuoteThreshold: d.readBigUInt64LE(264).toString(),
      migrationOption: d.readUInt8(233),
      tokenType: d.readUInt8(237),
    });
  });
  await new Promise((r) => setTimeout(r, 1200));
}
fs.writeFileSync('raw/configs-decoded.json', JSON.stringify(out, null, 2));

const thr = new Map(out.map((c) => [c.config, c]));
const withSwaps = pools.filter((p) => p.hasSwap === 1);
const nonZero = pools.filter((p) => BigInt(p.quoteReserve) > 0n);
console.log('pools with hasSwap=1:', withSwaps.length);
console.log('pools with quoteReserve > 0:', nonZero.length);
console.log('pools migrated:', pools.filter((p) => p.isMigrated === 1).length);

const mints = JSON.parse(fs.readFileSync('raw/mints-analyzed.json'));
const mi = new Map(mints.map((m) => [m.mint, m]));
const byQuote = {};
for (const p of pools) {
  const q = byQuote[p.quoteMint] ??= { pools: 0, reserve: 0n, symbol: mi.get(p.quoteMint)?.metadata?.symbol, decimals: mi.get(p.quoteMint)?.decimals };
  q.pools++; q.reserve += BigInt(p.quoteReserve);
}
console.log('\n=== badged quote mints with live pools (reserve = raw units) ===');
Object.entries(byQuote).sort((a, b) => Number(b[1].reserve - a[1].reserve)).forEach(([m, v]) => {
  const ui = Number(v.reserve) / 10 ** (v.decimals ?? 0);
  console.log(String(v.pools).padStart(4), 'pools', String(v.symbol ?? '?').padEnd(12), m, 'reserve', ui.toFixed(4));
});
