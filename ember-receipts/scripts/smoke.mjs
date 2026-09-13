/**
 * Renders the app against a stubbed RPC so layout, the card and the mobile
 * breakpoints can be checked without a live endpoint.
 *
 *   npm run build && npm run smoke
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { PublicKey } from '@solana/web3.js';

const PORT = 4182;
const KEEPER = 'GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp';
const WALLET = '2TnrgMN6JgKu91L7eC3ewtDY1a57rjduLjNVtNMGoQmb';
const DBC = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';
const POOL = 'oJiZ19wCJd22G4Bo5bE4EUyFVewJ4jYGuZ91wddouJZ';
const CONFIG = 'B76NiZrQhD21yMuU9xBsAGEdHsRND3h5Ki6gc3yW57tq';
const TOKEN_MINT = 'Hh2waXY7qfq5GUyQuzr3AJo29g9hTVThdjfHRB1jHNRC';
const MINTS = {
  EMBER: '5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6',
  MET: 'METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL',
  NVDAx: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
};

/** The signatures the stubbed cluster returns, so Ember's ledger can join them. */
const SIGS = Array.from({ length: 9 }, (_, i) =>
  new PublicKey(Buffer.alloc(32, (i + 1) * 7)).toBase58() + new PublicKey(Buffer.alloc(32, i + 3)).toBase58());

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], { stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let i = 0; i < 80; i++) {
  try { await fetch(`http://localhost:${PORT}/`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
  ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}),
});

const errors = [];

/** Minimal JSON-RPC stand-in covering only what the scan calls. */
function handle(req) {
  const { method, params, id } = req;
  const ok = (result) => ({ jsonrpc: '2.0', id, result });

  if (method === 'getTokenAccountsByOwner') {
    const owner = params[0];
    const classic = params[1].programId?.startsWith('Tokenkeg');
    if (!classic) return ok({ context: { slot: 1 }, value: [] });
    const mints = owner === KEEPER ? Object.values(MINTS) : [MINTS.EMBER, MINTS.MET, MINTS.NVDAx];
    return ok({
      context: { slot: 1 },
      value: mints.map((mint, i) => ({
        pubkey: new PublicKey(Buffer.alloc(32, i + 1)).toBase58(),
        account: { data: [Buffer.concat([bs58ToBuf(mint), Buffer.alloc(133)]).toString('base64'), 'base64'],
          executable: false, lamports: 2039280, owner: params[1].programId, rentEpoch: 0, space: 165 },
      })),
    });
  }
  if (method === 'getSignaturesForAddress') {
    return ok(SIGS.map((signature, i) => ({
      signature, slot: 446000000 + i, err: null, blockTime: 1789200000 + i * 3600, memo: null,
    })));
  }
  if (method === 'getParsedTransaction' || method === 'getTransaction') {
    return ok(buildTx(params[0]));
  }
  if (method === 'getMultipleAccounts') {
    // Attribution batches config reads to pull each pool's quote mint.
    return ok({ context: { slot: 1 }, value: params[0].map((address) => {
      if (address !== CONFIG) return null;
      const cfg = Buffer.alloc(1048);
      new PublicKey(MINTS.NVDAx).toBuffer().copy(cfg, 8);
      new PublicKey(KEEPER).toBuffer().copy(cfg, 40);
      cfg.writeBigUInt64LE(26041600n, 264);
      return { data: [cfg.toString('base64'), 'base64'], executable: false, lamports: 1, owner: DBC, rentEpoch: 0, space: 1048 };
    }) });
  }

  if (method === 'getProgramAccounts') {
    // Attribution asks for a pool per held mint with a dataSlice; the token
    // view asks for the whole account.
    const sliced = params[1]?.dataSlice;
    if (sliced) {
      const config = Buffer.alloc(32);
      new PublicKey(CONFIG).toBuffer().copy(config, 0);
      return ok([{ pubkey: POOL, account: { data: [config.toString('base64'), 'base64'], executable: false, lamports: 1, owner: DBC, rentEpoch: 0, space: 32 } }]);
    }
    // The token view looks up a DBC pool by base mint.
    const pool = Buffer.alloc(424);
    new PublicKey(CONFIG).toBuffer().copy(pool, 72);
    new PublicKey(KEEPER).toBuffer().copy(pool, 104);
    new PublicKey(TOKEN_MINT).toBuffer().copy(pool, 136);
    pool.writeBigUInt64LE(26041600n, 240); // quote reserve
    pool.writeUInt8(1, 305); // is_migrated
    pool.writeUInt8(3, 308); // migration_progress
    return ok([{ pubkey: POOL, account: { data: [pool.toString('base64'), 'base64'], executable: false, lamports: 1, owner: DBC, rentEpoch: 0, space: 424 } }]);
  }

  if (method === 'getAccountInfo') {
    const address = params[0];
    const account = (data, owner) => ok({ context: { slot: 1 },
      value: { data: [data.toString('base64'), 'base64'], executable: false, lamports: 1, owner, rentEpoch: 0, space: data.length } });

    if (address === TOKEN_MINT) return account(Buffer.alloc(82), 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    if (address === CONFIG) {
      const cfg = Buffer.alloc(1048);
      new PublicKey(MINTS.NVDAx).toBuffer().copy(cfg, 8);
      new PublicKey(KEEPER).toBuffer().copy(cfg, 40);
      cfg.writeBigUInt64LE(26041600n, 264);
      return account(cfg, DBC);
    }
    if (address === MINTS.NVDAx) {
      const mint = Buffer.alloc(82);
      mint.writeUInt8(6, 44);
      return account(mint, 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    }
    return ok({ context: { slot: 1 }, value: null }); // wallets classify here
  }
  return ok(null);
}

/** Real base58 decode: the app reads the mint from the first 32 bytes. */
function bs58ToBuf(s) { return Buffer.from(new PublicKey(s).toBuffer()); }

let n = 0;
function buildTx(signature) {
  n += 1;
  const mint = [MINTS.EMBER, MINTS.MET, MINTS.NVDAx][n % 3];
  const amount = [196241614, 4769232626, 4644][n % 3];
  const decimals = [6, 6, 8][n % 3];
  return {
    slot: 446000000 + n,
    blockTime: 1789100000 + n * 5400,
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [{ pubkey: KEEPER, signer: true, writable: true, source: 'transaction' }],
        instructions: [],
        recentBlockhash: new PublicKey(Buffer.alloc(32, 9)).toBase58(),
      },
    },
    meta: {
      err: null, fee: 25300,
      preTokenBalances: [{ accountIndex: 3, mint, owner: WALLET, uiTokenAmount: { amount: '0', decimals, uiAmount: 0 } }],
      postTokenBalances: [{ accountIndex: 3, mint, owner: WALLET,
        uiTokenAmount: { amount: String(amount), decimals, uiAmount: amount / 10 ** decimals } }],
      innerInstructions: [], logMessages: [], postBalances: [1000000], preBalances: [1025300], rewards: [],
    },
  };
}

/**
 * Ember's API, served on the same-origin `/ember/*` path the app now uses.
 * The arena and a Conviction position are given real-looking values, because
 * no coin has ever opened one and the populated layouts are otherwise never
 * exercised.
 */
const ARENA = {
  computedAt: 1789334406, live: false, venue: 'phoenix',
  coins: [
    { pool: POOL, route: '/t/x', symbol: 'FLYWHEEL', name: 'flywheel', image: null, quoteTicker: 'NVDAx',
      market: 'NVDA', side: 'long', lev: 3, paper: true, open: true, pnl: 412.55, pnlPct: 18.4,
      reserveUsd: 0, paidHoldersUsd: 1240.5, harvests: 2, liquidations: 0, underwater: false, aliveS: 190000 },
    { pool: 'Pool2', route: '/t/y', symbol: 'ZECBALL', name: 'Zecball', image: null, quoteTicker: 'ZEC',
      market: 'GOLD', side: 'short', lev: 5, paper: true, open: false, pnl: 0, pnlPct: 0,
      reserveUsd: 8.2, paidHoldersUsd: 0, harvests: 0, liquidations: 1, underwater: true, aliveS: 4000 },
  ],
};

const PERP = {
  market: 'NVDA', side: 'long', lev: 3, mark: 189.42, paper: true, convictionBps: 6500,
  position: { pnl: 412.55, pnlPct: 18.4, collateral: 2240, notional: 6720, entry: 178.1, liq: 126.9, nextHarvestAt: 560 },
  reserveUsd: 0, paidHoldersUsd: 1240.5, burnUsd: 744.3, emberUsd: 496.2, harvests: 2, liquidations: 1,
  history: [
    { type: 'harvest', at: 1789200000, usd: 620, split: { holders: 310, burn: 186, ember: 124 }, sig: 'SigC'.padEnd(64, 'z') },
    { type: 'topup', at: 1789100000, usd: 180, underwater: true },
    { type: 'open', at: 1789000000, usd: 1200, notional: 3600 },
  ],
  explorer: null,
  policy: { openUsd: 20, harvestStepPct: 25, harvestClosePct: 40, profitSplit: { holders: 0.5, burn: 0.3, ember: 0.2 } },
};

function emberStub(url) {
  if (url.includes('/ember/arena')) return JSON.stringify(ARENA);
  if (url.includes('/ember/perp/markets')) {
    return JSON.stringify({
      markets: [
        { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', maxLev: 40 },
        { symbol: 'NVDA', name: 'Nvidia', kind: 'stock', maxLev: 10 },
        { symbol: 'GOLD', name: 'Gold', kind: 'commodity', maxLev: 20 },
      ],
      tiers: [2, 3, 5], enabled: false, live: false, venue: 'phoenix',
      profitSplit: { holders: 0.5, burn: 0.3, ember: 0.2 },
    });
  }
  if (url.includes('/ember/perp/')) return JSON.stringify(PERP);
  if (url.includes('/ember/markets')) {
    const coin = (symbol, holders, cap, trades, pot, mode, feeBps = 200, dammFeeBps = 100) => ({
      pool: 'Pool' + symbol, mint: MINTS.EMBER, symbol, name: symbol, image: null,
      route: '/t/' + symbol, quoteTicker: 'MET', creator: KEEPER, config: CONFIG, dammPool: null,
      feeBps, dammFeeBps, holdersBps: 10000, mode, graduated: true,
      holders, priceUsd: 0.01, marketCapUsd: cap, fees24hUsd: pot * 2, trades24h: trades,
      change24h: 0, createdAt: 1788985224,
      allTime: { feesUsd: pot * 40, byKindUsd: { holders: pot * 10 }, volumeUsd: pot * 4000 },
      ledger24h: { byKindUsd: { holders: pot }, paidUsd: pot, claimedUsd: pot },
    });
    return JSON.stringify({ markets: [
      // pre-1.23: graduated, so its fee was cut to 1%
      coin('REBME', 665, 133000, 3004, 4619, 'holders', 300, 100),
      // post-1.23: keeps its 3% through graduation
      coin('LOTTO', 1141, 308000, 6438, 5134, 'lotto', 300, 300),
      // must be excluded: 3 holders, $3k cap — the wash-trading shape
      coin('HEATBLAST', 3, 3000, 12, 813, 'holders'),
    ] });
  }
  if (url.includes('/ember/wallet/')) {
    // Ember's per-wallet ledger, joined onto the scan by signature. Two of the
    // three stubbed payouts are labelled; the third is deliberately absent so
    // the unmatched path is exercised.
    const pay = (kind, signature, amount, usd, at) => ({
      kind, pool: POOL, mint: MINTS.EMBER, symbol: 'FLYWHEEL', quoteTicker: 'EMBER',
      amount, usd, unit: 'quote', signature, at, usdAtPayout: true,
    });
    return JSON.stringify({
      wallet: WALLET, totalUsd: 12.5, count: 2, at: 1789334732,
      byCoin: [{ pool: POOL, mint: MINTS.EMBER, symbol: 'FLYWHEEL', quoteTicker: 'EMBER',
                 count: 2, amount: 3, usd: 12.5, lastAt: 1789200600, kinds: { holders: 1, lotto: 1 } }],
      payouts: [
        pay('holders', SIGS[0], 2, 8.5, 1789200000),
        pay('lotto', SIGS[1], 1, 4, 1789200300),
      ],
    });
  }
  if (url.includes('/ember/payouts')) {
    return JSON.stringify({ payouts: [
      { pool: POOL, kind: 'payout', amount: 0.076033, quoteTicker: 'NVDAx', signature: 'SigA'.padEnd(64, 'x'), at: 1789200000 },
      { pool: POOL, kind: 'claim', amount: 0, quoteTicker: 'NVDAx', signature: null, at: 1789200300 },
      { pool: 'other', kind: 'payout', amount: 5, quoteTicker: 'MET', signature: 'SigB'.padEnd(64, 'y'), at: 1789200600 },
    ] });
  }
  return JSON.stringify({});
}

async function run(page, label, width, height) {
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    // Webfonts come from a CDN in production; the layout must not depend on them.
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (url.includes('/ember/')) return route.fulfill({ status: 200, contentType: 'application/json', body: emberStub(url) });
    if (url.includes('localhost')) return route.continue();

    if (url.includes('lite-api.jup.ag')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        [MINTS.EMBER]: { usdPrice: 0.0379, liquidity: 3_382_012, priceChange24h: 75.7 },
        [MINTS.MET]: { usdPrice: 0.2312, liquidity: 3_806_372, priceChange24h: -2.8 },
        [MINTS.NVDAx]: { usdPrice: 215.55, liquidity: 8_000, priceChange24h: -1.7 },
      }) });
    }
    if (url.includes('dbc.datapi.meteora.ag')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        created_at: 1789000000000,
        token_x: { symbol: 'FLYWHEEL', name: 'flywheel', decimals: 6 },
        token_y: { symbol: 'NVDAx', decimals: 6 },
      }) });
    }
    if (route.request().method() !== 'POST') return route.abort();
    const body = JSON.parse(route.request().postData() ?? '{}');
    const result = Array.isArray(body) ? body.map(handle) : handle(body);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[aria-label="Wallet or token address"]', WALLET);
  await page.click('button:has-text("Look it up")');
  await page.waitForSelector('.card-svg, .empty, .alert');
  const failed = await page.locator('.empty, .alert').count();
  if (failed) console.log(`${label}: ${await page.textContent('.empty, .alert')}`);
  await page.waitForSelector('.card-svg');
  await page.waitForTimeout(600);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const sources = await page.locator('.total .source').count();
  const worth = await page.textContent('.worth strong').catch(() => 'none');
  const thin = await page.locator('.thin-flag').count();
  await page.waitForSelector('.breakdown', { timeout: 15000 });
  const kinds = await page.locator('.kinds li').count();
  const thenNow = await page.locator('.then-now').count();
  const labelledRows = await page.locator(`td[data-label="For"]`).count();
  console.log(`${label.padEnd(8)} ${width}x${height}  overflow=${overflow}  tokens=${await page.locator('.total').count()}  rows=${await page.locator('.payouts tbody tr').count()}  attributed=${sources}  worth=${worth}  thinFlags=${thin}  kinds=${kinds}  thenNow=${thenNow}  forCells=${labelledRows}`);
  if (overflow !== 0) errors.push(`${label}: page scrolls sideways by ${overflow}px`);
  // Two kinds are stubbed and labelled; the rest of the scan stays unlabelled.
  if (kinds !== 2) errors.push(`${label}: expected 2 payout kinds, got ${kinds}`);
  if (thenNow !== 1) errors.push(`${label}: payout-time value did not render`);
  await page.screenshot({ path: `smoke-${label}.png`, fullPage: true });
}

await run(await browser.newPage({ viewport: { width: 1100, height: 1400 } }), 'desktop', 1100, 1400);
await run(
  await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }),
  'phone', 390, 844,
);

// token view: the same input box, given a mint instead of a wallet
async function runToken(page, label) {
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    // Webfonts come from a CDN in production; the layout must not depend on them.
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (url.includes('/ember/')) return route.fulfill({ status: 200, contentType: 'application/json', body: emberStub(url) });
    if (url.includes('localhost')) return route.continue();
    if (url.includes('lite-api.jup.ag')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        [MINTS.EMBER]: { usdPrice: 0.0379, liquidity: 3_382_012, priceChange24h: 75.7 },
        [MINTS.MET]: { usdPrice: 0.2312, liquidity: 3_806_372, priceChange24h: -2.8 },
        [MINTS.NVDAx]: { usdPrice: 215.55, liquidity: 8_000, priceChange24h: -1.7 },
      }) });
    }
    if (url.includes('dbc.datapi.meteora.ag')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        created_at: 1789000000000,
        token_x: { symbol: 'FLYWHEEL', name: 'flywheel', decimals: 6 },
        token_y: { symbol: 'NVDAx', decimals: 6 },
      }) });
    }
    if (route.request().method() !== 'POST') return route.abort();
    const body = JSON.parse(route.request().postData() ?? '{}');
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(Array.isArray(body) ? body.map(handle) : handle(body)) });
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[aria-label="Wallet or token address"]', TOKEN_MINT);
  await page.click('button:has-text("Look it up")');
  await page.waitForSelector('.token, .alert');
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const badge = await page.textContent('.badge').catch(() => 'none');
  const pct = await page.textContent('.curve-top strong').catch(() => 'none');
  const conviction = await page.locator('.conviction').count();
  console.log(`${label.padEnd(8)} overflow=${overflow}  badge="${badge}"  progress=${pct}  feeRows=${await page.locator('.token tbody tr').count()}  conviction=${conviction}`);
  if (overflow !== 0) errors.push(`${label}: scrolls sideways by ${overflow}px`);
  if (conviction !== 1) errors.push(`${label}: Conviction panel did not render`);
  await page.screenshot({ path: `smoke-${label}.png`, fullPage: true });
}

await runToken(await browser.newPage({ viewport: { width: 1100, height: 1300 } }), 'token');
await runToken(
  await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }),
  'tokenphone',
);

/** The arena only shows on the landing page, before a lookup. */
async function runArena(page, label) {
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    // Webfonts come from a CDN in production; the layout must not depend on them.
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (url.includes('/ember/')) return route.fulfill({ status: 200, contentType: 'application/json', body: emberStub(url) });
    if (url.includes('localhost')) return route.continue();
    return route.abort();
  });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.arena-row:not(.head)');
  const rows = await page.locator('.arena-row:not(.head)').count();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${label.padEnd(8)} overflow=${overflow}  arenaRows=${rows}`);
  if (overflow !== 0) errors.push(`${label}: scrolls sideways by ${overflow}px`);
  if (rows !== ARENA.coins.length) errors.push(`${label}: expected ${ARENA.coins.length} arena rows, got ${rows}`);
  await page.screenshot({ path: `smoke-${label}.png`, fullPage: true });
}

/** The yield board: loads on request, and must exclude the junk coin. */
async function runYield(page, label) {
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (url.includes('/ember/')) return route.fulfill({ status: 200, contentType: 'application/json', body: emberStub(url) });
    if (url.includes('localhost')) return route.continue();
    return route.abort();
  });
  // ?board must populate the table with no click at all.
  await page.goto(`http://localhost:${PORT}/?board=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.yb-row:not(.head)');
  const rows = await page.locator('.yb-row:not(.head)').count();
  const text = await page.locator('.yb-table').innerText();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const links = await page.locator('.yb-links a').count();
  console.log(`${label.padEnd(8)} overflow=${overflow}  yieldRows=${rows}  solscanLinks=${links}`);
  if (overflow !== 0) errors.push(`${label}: scrolls sideways by ${overflow}px`);
  if (rows !== 2) errors.push(`${label}: expected 2 credible coins, got ${rows}`);
  if (text.includes('HEATBLAST')) errors.push(`${label}: a 3-holder $3k coin was not filtered out`);
  const kept = await page.locator('.keeps').count();
  if (kept !== 1) errors.push(`${label}: expected 1 coin flagged as keeping its fee, got ${kept}`);
  await page.screenshot({ path: `smoke-${label}.png`, fullPage: true });
}

await runYield(await browser.newPage({ viewport: { width: 1100, height: 1000 } }), 'yield');
await runYield(
  await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }),
  'yieldphone',
);

await runArena(await browser.newPage({ viewport: { width: 1100, height: 900 } }), 'arena');
await runArena(
  await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }),
  'arenaphone',
);

console.log('ERRORS:', errors);
await browser.close();
server.kill();
if (errors.length) process.exitCode = 1;
