// src/lib/prices.ts
var PRICE_API = "https://lite-api.jup.ag/price/v3?ids=";
var BATCH = 50;
var THIN_LIQUIDITY_USD = 25e3;
async function fetchPrices(mints) {
  const out = /* @__PURE__ */ new Map();
  const unique = [...new Set(mints)];
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    try {
      const res = await fetch(PRICE_API + batch.join(","), { signal: AbortSignal.timeout(9e3) });
      if (!res.ok) continue;
      const body = await res.json();
      for (const [mint, value] of Object.entries(body)) {
        if (!value || typeof value.usdPrice !== "number" || !Number.isFinite(value.usdPrice)) continue;
        const liquidity = typeof value.liquidity === "number" ? value.liquidity : 0;
        out.set(mint, {
          usd: value.usdPrice,
          liquidity,
          change24h: typeof value.priceChange24h === "number" ? value.priceChange24h : 0,
          thin: liquidity < THIN_LIQUIDITY_USD
        });
      }
    } catch {
    }
  }
  return out;
}
function valueOf(totals, prices) {
  let usd = 0;
  let priced = 0;
  let thin = false;
  const unpriced = [];
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
export {
  THIN_LIQUIDITY_USD,
  fetchPrices,
  valueOf
};
