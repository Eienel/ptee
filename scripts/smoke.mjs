/**
 * End-to-end smoke test: boots the production build, injects a fake injected
 * wallet and a stubbed RPC, then walks connect -> scan -> table.
 *
 *   npm run build && npm run smoke
 *
 * Requires a local Chromium; set CHROMIUM_PATH if it is not at /opt/pw-browsers/chromium.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { PublicKey } from '@solana/web3.js';

const owner = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// One token account with 0.00089 SOL of surplus, one already at the floor.
const WSOL = 'So11111111111111111111111111111111111111112';

function tokenAccount(mintB58, amount, { isNative = false } = {}) {
  const data = Buffer.alloc(165);
  new PublicKey(mintB58).toBuffer().copy(data, 0);
  new PublicKey(owner).toBuffer().copy(data, 32);
  data.writeBigUInt64LE(BigInt(amount), 64);
  data.writeUInt8(1, 108);
  if (isNative) data.writeUInt32LE(1, 109);
  return data.toString('base64');
}
const accounts = [
  // over-funded at the old rate — the normal case
  { pubkey: 'A1jrfooEUZTbFbGKPFXCWuBvf9Ss623VQ5DAtokenAA', lamports: 2039280, data: tokenAccount(mint, 1250000) },
  { pubkey: 'C3jrfooEUZTbFbGKPFXCWuBvf9Ss623VQ5DAtokenCC', lamports: 2039280, data: tokenAccount(mint, 40000000) },
  // wrapped SOL: looks over-funded, but the program rejects native accounts
  { pubkey: 'W4jrfooEUZTbFbGKPFXCWuBvf9Ss623VQ5DAtokenWW', lamports: 501148120, data: tokenAccount(WSOL, 500000000, { isNative: true }) },
  // surplus smaller than its share of the fee
  { pubkey: 'D5jrfooEUZTbFbGKPFXCWuBvf9Ss623VQ5DAtokenDD', lamports: 1148300, data: tokenAccount(mint, 900) },
  // already at the current floor
  { pubkey: 'B2jrfooEUZTbFbGKPFXCWuBvf9Ss623VQ5DAtokenBB', lamports: 1148120, data: tokenAccount(mint, 7000) },
];

const PORT = 4173;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], { stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let i = 0; i < 50; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const initScript = ({ owner, accounts }) => {
  const pk = { toString: () => owner, toBase58: () => owner };
  window.phantom = { solana: {
    publicKey: pk,
    connect: async () => ({ publicKey: pk }),
    disconnect: async () => {},
    signTransaction: async (t) => t,
    signAllTransactions: async (t) => t,
  } };
  const real = window.fetch;
  window.fetch = async (url, init) => {
    if (!init || !init.body || !String(url).includes('solana.com')) return real(url, init);
    const req = JSON.parse(init.body);
    const reply = (result) => new Response(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }), { headers: { 'content-type': 'application/json' } });
    if (req.method === 'getTokenAccountsByOwner') {
      const isClassic = req.params[1].programId.startsWith('Tokenkeg');
      return reply({ context: { slot: 1 }, value: isClassic ? accounts.map((a) => ({
        pubkey: a.pubkey,
        account: { data: [a.data, 'base64'], executable: false, lamports: a.lamports, owner: req.params[1].programId, rentEpoch: 0, space: 165 },
      })) : [] });
    }
    if (req.method === 'getMinimumBalanceForRentExemption') return reply(1148120);
    if (req.method === 'getRecentPrioritizationFees')
      return reply([{ slot: 1, prioritizationFee: 12000 }, { slot: 2, prioritizationFee: 8000 }]);
    if (req.method === 'getProgramAccounts') return reply([]);
    return reply(null);
  };
};
await page.addInitScript(initScript, { owner, accounts });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.click('text=Connect Phantom');
await page.click('text=Scan wallet');
await page.waitForSelector('table tbody tr');
console.log('ROWS:', await page.locator('table tbody tr').count());
console.log('SUMMARY:', (await page.textContent('.summary')).replace(/\s+/g, ' '));
await page.screenshot({ path: 'smoke.png', fullPage: true });

// --- phone viewport: card layout, and the deeplink hand-off with no wallet ---
const phone = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
phone.setDefaultTimeout(15000);
phone.setDefaultNavigationTimeout(15000);
phone.on('pageerror', (e) => errors.push(String(e)));
await phone.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
const deeplinks = await phone.locator('a.wallet').evaluateAll((els) =>
  els.map((e) => ({ text: e.textContent, href: e.getAttribute('href') })),
);
console.log('PHONE DEEPLINKS:', JSON.stringify(deeplinks, null, 0));
console.log('PHONE EMPTY:', await phone.textContent('.empty'));
await phone.screenshot({ path: 'smoke-phone-connect.png', fullPage: true });
await phone.close();

// same fixtures as desktop, but at phone width, to check the card layout
const phone2 = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
phone2.setDefaultTimeout(15000);
phone2.setDefaultNavigationTimeout(15000);
phone2.on('pageerror', (e) => errors.push(String(e)));
await phone2.addInitScript(initScript, { owner, accounts });
await phone2.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await phone2.click('text=Connect Phantom');
await phone2.click('text=Scan wallet');
await phone2.waitForSelector('table tbody tr');
const overflow = await phone2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('PHONE HORIZONTAL OVERFLOW:', overflow, overflow === 0 ? '(none)' : '(PAGE SCROLLS SIDEWAYS)');
await phone2.screenshot({ path: 'smoke-phone.png', fullPage: true });
await phone2.close();

console.log('ERRORS:', errors);
await browser.close();
server.kill();
if (errors.length) process.exitCode = 1;
