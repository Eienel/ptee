import { readFileSync } from 'node:fs';
import { Connection, PublicKey } from '@solana/web3.js';
import { loadToken, classifyAddress } from './token.bundle.mjs';
const RPC = readFileSync('.env', 'utf8').match(/https:\/\/\S+/)[0];
const c = new Connection(RPC, 'confirmed');

// Resolve a base mint from a known Ember pool, then run the loader on it.
const poolAddr = new PublicKey(process.argv[2]);
const poolData = (await c.getAccountInfo(poolAddr)).data;
const mint = new PublicKey(poolData.subarray(136, 168));
console.log('pool', poolAddr.toBase58(), '-> mint', mint.toBase58());
console.log('classify:', await classifyAddress(c, mint));

const t0 = Date.now();
const v = await loadToken(c, mint);
console.log(`loaded in ${((Date.now()-t0)/1000).toFixed(1)}s\n`);
if (!v) { console.log('no DBC pool'); process.exit(0); }
console.log('symbol / name     :', v.symbol, '/', v.name);
console.log('launched on Ember :', v.launchedOnEmber, '(fee claimer', v.feeClaimer.slice(0,8) + '…)');
console.log('created           :', v.createdAt ? new Date(v.createdAt*1000).toISOString() : 'unknown');
console.log('quote             :', v.quoteSymbol, v.quoteMint.slice(0,8)+'…');
console.log('reserve/threshold :', v.quoteReserve.toFixed(4), '/', v.migrationThreshold.toFixed(4), '=', v.progressPct.toFixed(2)+'%');
console.log('migrated          :', v.isMigrated, '| progress flag', v.migrationProgress);
console.log('fee activity      :', v.feeActivity.length, 'events in Ember window',
  v.feeActivityWindow ? new Date(v.feeActivityWindow.from*1000).toISOString().slice(11,19)+'→'+new Date(v.feeActivityWindow.to*1000).toISOString().slice(11,19) : '—');
for (const e of v.feeActivity.slice(0,6)) console.log('   ', e.kind.padEnd(9), String(e.amount).padStart(14), e.ticker);
