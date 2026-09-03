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
function tokenAccount(mintB58, amount) {
  const data = Buffer.alloc(165);
  new PublicKey(mintB58).toBuffer().copy(data, 0);
  new PublicKey(owner).toBuffer().copy(data, 32);
  data.writeBigUInt64LE(BigInt(amount), 64);
  return data.toString('base64');
}
const accounts = [
  { pubkey: 'A1jrfooEUZTbFbGKPFXCWuBvf9Ss623VQ5DAtokenAA', lamports: 2039280 },
  { pubkey: 'B2jrfooEUZTbFbGKPFXCWuBvf9Ss623VQ5DAtokenBB', lamports: 1148120 },
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
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.addInitScript(({ owner, accounts, data }) => {
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
        account: { data: [data, 'base64'], executable: false, lamports: a.lamports, owner: req.params[1].programId, rentEpoch: 0, space: 165 },
      })) : [] });
    }
    if (req.method === 'getMinimumBalanceForRentExemption') return reply(1148120);
    if (req.method === 'getProgramAccounts') return reply([]);
    return reply(null);
  };
}, { owner, accounts, data: tokenAccount(mint, 1250000) });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.click('text=Connect Phantom');
await page.click('text=Scan wallet');
await page.waitForSelector('table tbody tr');
console.log('ROWS:', await page.locator('table tbody tr').count());
console.log('SUMMARY:', (await page.textContent('.summary')).replace(/\s+/g, ' '));
await page.screenshot({ path: 'smoke.png', fullPage: true });
console.log('ERRORS:', errors);
await browser.close();
server.kill();
if (errors.length) process.exitCode = 1;
