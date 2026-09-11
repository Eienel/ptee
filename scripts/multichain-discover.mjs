import { writeFileSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMS = ['AAPL','NVDA','TSLA','SPY','GME','MSTR','SPCX','META','AMZN','MSFT','GOOGL','COIN','HOOD','QQQ','AMD','PLTR'];
const CHAINS = ['robinhood','base'];
const tokens = new Map();

for (const term of TERMS) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${term}`);
  if (!res.ok) { console.error('search failed', term, res.status); await sleep(1500); continue; }
  const j = await res.json();
  for (const p of j.pairs ?? []) {
    if (!CHAINS.includes(p.chainId)) continue;
    const key = p.chainId + ':' + p.baseToken.address.toLowerCase();
    const prev = tokens.get(key) ?? {
      chain: p.chainId, address: p.baseToken.address, symbol: p.baseToken.symbol,
      name: p.baseToken.name, vol24: 0, liq: 0, pairs: 0, socials: null, dexes: new Set(),
    };
    prev.vol24 += p.volume?.h24 ?? 0;
    prev.liq += p.liquidity?.usd ?? 0;
    prev.pairs += 1;
    prev.dexes.add(p.dexId);
    if (!prev.socials && p.info?.socials?.length) prev.socials = p.info.socials;
    if (!prev.websites && p.info?.websites?.length) prev.websites = p.info.websites;
    tokens.set(key, prev);
  }
  await sleep(900);
}

const rows = [...tokens.values()]
  .map((t) => ({ ...t, dexes: [...t.dexes] }))
  .sort((a, b) => b.vol24 - a.vol24);

writeFileSync('raw/multichain-candidates.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'dexscreener search (index, not on-chain)', rows }, null, 2));

for (const chain of CHAINS) {
  const r = rows.filter((x) => x.chain === chain);
  console.log(`\n=== ${chain.toUpperCase()} — ${r.length} distinct tokens ===`);
  for (const t of r.slice(0, 14))
    console.log(`${(t.symbol||'?').padEnd(12)} vol24=$${Math.round(t.vol24).toLocaleString().padStart(12)} liq=$${Math.round(t.liq).toLocaleString().padStart(11)} ${t.pairs}p ${t.address}`);
}
