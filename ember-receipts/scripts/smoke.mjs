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
    return ok(Array.from({ length: 9 }, (_, i) => ({
      signature: new PublicKey(Buffer.alloc(32, (i + 1) * 7)).toBase58() + new PublicKey(Buffer.alloc(32, i + 3)).toBase58(),
      slot: 446000000 + i, err: null, blockTime: 1789200000 + i * 3600, memo: null,
    })));
  }
  if (method === 'getParsedTransaction' || method === 'getTransaction') {
    return ok(buildTx(params[0]));
  }
  if (method === 'getMultipleAccounts') return ok({ context: { slot: 1 }, value: params[0].map(() => null) });

  if (method === 'getProgramAccounts') {
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

async function run(page, label, width, height) {
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('localhost')) return route.continue();

    if (url.includes('dbc.datapi.meteora.ag')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        created_at: 1789000000000,
        token_x: { symbol: 'FLYWHEEL', name: 'flywheel', decimals: 6 },
        token_y: { symbol: 'NVDAx', decimals: 6 },
      }) });
    }
    if (url.includes('embercurve.fun')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        payouts: [
          { pool: POOL, kind: 'payout', amount: 0.076033, quoteTicker: 'NVDAx', signature: 'SigA'.padEnd(64, 'x'), at: 1789200000 },
          { pool: POOL, kind: 'claim', amount: 0, quoteTicker: 'NVDAx', signature: null, at: 1789200300 },
          { pool: 'other', kind: 'payout', amount: 5, quoteTicker: 'MET', signature: 'SigB'.padEnd(64, 'y'), at: 1789200600 },
        ],
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
  console.log(`${label.padEnd(8)} ${width}x${height}  overflow=${overflow}  tokens=${await page.locator('.total').count()}  rows=${await page.locator('.payouts tbody tr').count()}`);
  if (overflow !== 0) errors.push(`${label}: page scrolls sideways by ${overflow}px`);
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
    if (url.includes('localhost')) return route.continue();
    if (url.includes('dbc.datapi.meteora.ag')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        created_at: 1789000000000,
        token_x: { symbol: 'FLYWHEEL', name: 'flywheel', decimals: 6 },
        token_y: { symbol: 'NVDAx', decimals: 6 },
      }) });
    }
    if (url.includes('embercurve.fun')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        payouts: [
          { pool: POOL, kind: 'payout', amount: 0.076033, quoteTicker: 'NVDAx', signature: 'SigA'.padEnd(64, 'x'), at: 1789200000 },
          { pool: POOL, kind: 'claim', amount: 0, quoteTicker: 'NVDAx', signature: null, at: 1789200300 },
        ],
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
  console.log(`${label.padEnd(8)} overflow=${overflow}  badge="${badge}"  progress=${pct}  feeRows=${await page.locator('.token tbody tr').count()}`);
  if (overflow !== 0) errors.push(`${label}: scrolls sideways by ${overflow}px`);
  await page.screenshot({ path: `smoke-${label}.png`, fullPage: true });
}

await runToken(await browser.newPage({ viewport: { width: 1100, height: 1300 } }), 'token');
await runToken(
  await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }),
  'tokenphone',
);

console.log('ERRORS:', errors);
await browser.close();
server.kill();
if (errors.length) process.exitCode = 1;
