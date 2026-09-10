import fs from 'node:fs';
const mints = JSON.parse(fs.readFileSync('raw/mints-analyzed.json'));
const pools = JSON.parse(fs.readFileSync('raw/pools-decoded.json'));
const withPools = new Set(pools.map((p) => p.quoteMint));
const inUse = new Set(JSON.parse(fs.readFileSync('raw/configs-with-badged-quote.json')).map((c) => c.quote));

const cluster = {};
for (const m of mints) {
  const k = [m.mintAuthority, m.freezeAuthority, m.permanentDelegate, m.pausable?.authority].join('|');
  (cluster[k] ??= []).push(m);
}
console.log('=== full authority addresses per cluster ===');
Object.entries(cluster).sort((a, b) => b[1].length - a[1].length).slice(0, 4).forEach(([k, v]) => {
  const [ma, fa, pd, pa] = k.split('|');
  console.log(`\ncount: ${v.length}   inUse: ${v.filter(x => inUse.has(x.mint)).length}   withPools: ${v.filter(x => withPools.has(x.mint)).length}`);
  console.log('  mintAuthority    :', ma);
  console.log('  freezeAuthority  :', fa);
  console.log('  permanentDelegate:', pd);
  console.log('  pausableAuthority:', pa);
  console.log('  sample symbols   :', v.slice(0, 6).map(x => x.metadata?.symbol).join(', '));
  console.log('  metadata updateAuthority (distinct):', [...new Set(v.map(x => x.metadata?.updateAuthority))].slice(0, 3).join(', '));
});

console.log('\n=== pausable: any already paused? ===');
console.log('paused=true count:', mints.filter((m) => m.pausable?.paused).length);

console.log('\n=== transfer hook programIds (distinct) ===');
console.log([...new Set(mints.filter(m => m.transferHook).map(m => m.transferHook.programId))].join(', '));

console.log('\n=== CADG detail (only TransferFeeConfig mint, has a live pool) ===');
const cadg = mints.find(m => m.metadata?.symbol === 'CADG');
console.log(JSON.stringify({ mint: cadg.mint, extensions: cadg.extensions, freezeAuthority: cadg.freezeAuthority, permanentDelegate: cadg.permanentDelegate, mintAuthority: cadg.mintAuthority, transferFee: cadg.transferFee }, null, 2));
const cadgPools = pools.filter(p => p.quoteMint === cadg.mint);
console.log('CADG pools:', cadgPools.map(p => ({ pool: p.pool, quoteReserve: p.quoteReserve, hasSwap: p.hasSwap, isMigrated: p.isMigrated })));

console.log('\n=== totals ===');
const tot = pools.reduce((a, p) => a + BigInt(p.quoteReserve), 0n);
console.log('total quote reserve across 166 pools (raw, mixed mints):', tot.toString());
console.log('pools with reserve>0:', pools.filter(p => BigInt(p.quoteReserve) > 0n).length);
console.log('migrated:', pools.filter(p => p.isMigrated === 1).length);
const mp = {}; pools.forEach(p => mp[p.migrationProgress] = (mp[p.migrationProgress] || 0) + 1);
console.log('migrationProgress distribution:', JSON.stringify(mp));
