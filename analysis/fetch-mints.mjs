import fs from 'node:fs';
const badges = JSON.parse(fs.readFileSync('raw/badges-decoded.json'));
const mints = badges.map((b) => b.mint);
const out = [];
for (let i = 0; i < mints.length; i += 100) {
  const batch = mints.slice(i, i + 100);
  let j, attempt = 0;
  while (true) {
    const res = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getMultipleAccounts', params: [batch, { encoding: 'base64' }] }),
    });
    j = await res.json();
    if (!j.error) break;
    if (++attempt > 5) throw new Error('RPC error: ' + JSON.stringify(j.error));
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  out.push({ keys: batch, value: j.result.value });
  process.stdout.write(`\rfetched ${Math.min(i + 100, mints.length)}/${mints.length}`);
  await new Promise((r) => setTimeout(r, 1400));
}
fs.writeFileSync('raw/mints-full.json', JSON.stringify(out));
console.log('\nsaved raw/mints-full.json');
