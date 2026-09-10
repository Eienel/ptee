import fs from 'node:fs';
const EPOCH = JSON.parse(fs.readFileSync('raw/epoch-info.json')).result.epoch;
const mints = JSON.parse(fs.readFileSync('raw/mints-analyzed.json'));
const mi = new Map(mints.map((m) => [m.mint, m]));
const pools = JSON.parse(fs.readFileSync('raw/pools-decoded.json'));
const inUse = [...new Set(JSON.parse(fs.readFileSync('raw/configs-with-badged-quote.json')).map((c) => c.quote))];
const withPools = [...new Set(pools.map((p) => p.quoteMint))];
const Z = '11111111111111111111111111111111';
const live = (a) => a && a !== Z;
const short = (a) => (a ? a.slice(0, 4) + '…' + a.slice(-4) : '—');

console.log('badges total: 1233 | referenced by a config:', inUse.length, '| with >=1 live pool:', withPools.length);

// issuer clustering by the authorities that actually hold power
const cluster = {};
for (const m of mints) {
  const k = [m.mintAuthority, m.freezeAuthority, m.permanentDelegate, m.pausable?.authority].map((x) => x ?? '-').join('|');
  (cluster[k] ??= []).push(m);
}
console.log('\n=== authority clusters (mintAuth|freezeAuth|permDelegate|pauseAuth) ===');
Object.entries(cluster).sort((a, b) => b[1].length - a[1].length).slice(0, 8).forEach(([k, v]) => {
  const [ma, fa, pd, pa] = k.split('|');
  const syms = v.map((x) => x.metadata?.symbol).filter(Boolean).slice(0, 4).join(', ');
  console.log(`${String(v.length).padStart(5)} mints  mint=${short(ma === '-' ? null : ma)} freeze=${short(fa === '-' ? null : fa)} permDel=${short(pd === '-' ? null : pd)} pause=${short(pa === '-' ? null : pa)}  e.g. ${syms}`);
});

console.log('\n=== per-mint risk, mints with live pools ===');
console.log('symbol      | pools | freezeAuth | permDelegate | pauseAuth | defState | feeBps(old/new) | extensions');
const rows = withPools.map((m) => {
  const x = mi.get(m); const ps = pools.filter((p) => p.quoteMint === m);
  return { x, m, n: ps.length, res: ps.reduce((a, p) => a + BigInt(p.quoteReserve), 0n) };
}).sort((a, b) => b.n - a.n);
for (const { x, m, n } of rows) {
  console.log(
    String(x.metadata?.symbol ?? '?').padEnd(11), '|',
    String(n).padStart(5), '|',
    (live(x.freezeAuthority) ? 'LIVE' : 'none').padEnd(10), '|',
    (live(x.permanentDelegate) ? 'LIVE' : 'none').padEnd(12), '|',
    (live(x.pausable?.authority) ? 'LIVE' : 'none').padEnd(9), '|',
    String(x.defaultAccountState ?? '-').padEnd(8), '|',
    (x.transferFee ? `${x.transferFee.olderBps}/${x.transferFee.newerBps}` : 'none').padEnd(15), '|',
    x.extensions.length,
  );
}

console.log('\n=== the single TransferFeeConfig mint ===');
const fee = mints.filter((m) => m.transferFee);
fee.forEach((m) => console.log(JSON.stringify({ mint: m.mint, symbol: m.metadata?.symbol, fee: m.transferFee, inUse: inUse.includes(m.mint), hasPools: withPools.includes(m.mint) }, null, 2)));
console.log('current epoch:', EPOCH, '-> scheduled fee active?', fee.map((m) => m.transferFee.newerEpoch <= EPOCH));

console.log('\n=== DefaultAccountState=Frozen mint ===');
mints.filter((m) => m.defaultAccountState === 2).forEach((m) => console.log(JSON.stringify({ mint: m.mint, symbol: m.metadata?.symbol, inUse: inUse.includes(m.mint), hasPools: withPools.includes(m.mint) })));

console.log('\n=== mints with NO permanent delegate (of those with pools) ===');
console.log(rows.filter(({ x }) => !live(x.permanentDelegate)).map(({ x }) => x.metadata?.symbol).join(', ') || '(none)');

fs.writeFileSync('raw/summary-inuse.json', JSON.stringify({ epoch: EPOCH, badges: mints.length, inUse, withPools, rows: rows.map(r => ({ mint: r.m, symbol: r.x.metadata?.symbol, pools: r.n, reserveRaw: r.res.toString(), decimals: r.x.decimals, freezeAuthority: r.x.freezeAuthority, permanentDelegate: r.x.permanentDelegate, pausableAuthority: r.x.pausable?.authority ?? null, defaultAccountState: r.x.defaultAccountState, extensions: r.x.extensions })) }, null, 2));
