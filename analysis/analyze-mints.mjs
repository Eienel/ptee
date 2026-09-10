import fs from 'node:fs';
import { PublicKey } from '@solana/web3.js';
import {
  unpackMint, getExtensionTypes, ExtensionType, getTransferFeeConfig,
  getPermanentDelegate, getTransferHook, getDefaultAccountState,
  getMetadataPointerState, getPausableConfig, getExtensionData,
  TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { unpack as unpackMetadata } from '@solana/spl-token-metadata';

const EPOCH = JSON.parse(fs.readFileSync('raw/epoch-info.json')).result.epoch;
const batches = JSON.parse(fs.readFileSync('raw/mints-full.json'));
const extName = Object.fromEntries(Object.entries(ExtensionType).filter(([, v]) => typeof v === 'number').map(([k, v]) => [v, k]));
const nz = (pk) => (pk && pk.toBase58 ? pk.toBase58() : null);

const rows = [];
for (const b of batches) {
  b.keys.forEach((key, i) => {
    const acc = b.value[i];
    if (!acc) { rows.push({ mint: key, missing: true }); return; }
    const owner = acc.owner;
    const data = Buffer.from(acc.data[0], 'base64');
    const info = { data, owner: new PublicKey(owner), lamports: acc.lamports, executable: false };
    const programId = owner === TOKEN_2022_PROGRAM_ID.toBase58() ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    let m;
    try { m = unpackMint(new PublicKey(key), info, programId); }
    catch (e) { rows.push({ mint: key, unpackError: String(e.message) }); return; }

    const exts = programId.equals(TOKEN_2022_PROGRAM_ID) && m.tlvData.length
      ? getExtensionTypes(m.tlvData).map((t) => extName[t] ?? `Unknown(${t})`) : [];

    const fee = getTransferFeeConfig(m);
    const hook = getTransferHook(m);
    const das = getDefaultAccountState(m);
    const pause = (() => { try { return getPausableConfig(m); } catch { return null; } })();
    let meta = null;
    try {
      const d = getExtensionData(ExtensionType.TokenMetadata, m.tlvData);
      if (d) { const u = unpackMetadata(d); meta = { name: u.name, symbol: u.symbol, updateAuthority: u.updateAuthority?.toBase58() ?? null }; }
    } catch {}

    rows.push({
      mint: key,
      program: owner === TOKEN_2022_PROGRAM_ID.toBase58() ? 'Token-2022' : owner === TOKEN_PROGRAM_ID.toBase58() ? 'SPL-Token' : owner,
      decimals: m.decimals,
      supply: m.supply.toString(),
      mintAuthority: nz(m.mintAuthority),
      freezeAuthority: nz(m.freezeAuthority),
      extensions: exts,
      transferFee: fee ? {
        olderBps: fee.olderTransferFee.transferFeeBasisPoints,
        olderEpoch: Number(fee.olderTransferFee.epoch),
        newerBps: fee.newerTransferFee.transferFeeBasisPoints,
        newerEpoch: Number(fee.newerTransferFee.epoch),
        withdrawWithheldAuthority: nz(fee.withdrawWithheldAuthority),
        transferFeeConfigAuthority: nz(fee.transferFeeConfigAuthority),
      } : null,
      permanentDelegate: nz(getPermanentDelegate(m)?.delegate),
      transferHook: hook ? { programId: nz(hook.programId), authority: nz(hook.authority) } : null,
      defaultAccountState: das ? das.state : null,
      pausable: pause ? { paused: pause.paused, authority: nz(pause.authority) } : null,
      metadata: meta,
      metadataPointer: nz(getMetadataPointerState(m)?.metadataAddress),
    });
  });
}
fs.writeFileSync('raw/mints-analyzed.json', JSON.stringify(rows, null, 2));

const zeroAddr = '11111111111111111111111111111111';
const live = (a) => a && a !== zeroAddr;
const flagged = rows.filter((r) => !r.missing && !r.unpackError && (
  (r.transferFee && (r.transferFee.olderBps > 0 || r.transferFee.newerBps > 0)) ||
  live(r.permanentDelegate) || live(r.freezeAuthority) ||
  (r.transferHook && live(r.transferHook.programId)) ||
  (r.pausable && live(r.pausable.authority)) ||
  r.extensions.includes('NonTransferable')
));

console.log('current epoch:', EPOCH);
console.log('mints analyzed:', rows.length, '| missing:', rows.filter(r => r.missing).length, '| unpack errors:', rows.filter(r => r.unpackError).length);
const progs = {}; rows.forEach(r => progs[r.program] = (progs[r.program] || 0) + 1);
console.log('owner programs:', JSON.stringify(progs));

const extCount = {};
rows.forEach(r => (r.extensions || []).forEach(e => extCount[e] = (extCount[e] || 0) + 1));
console.log('\n=== extension prevalence across 1233 badged mints ===');
Object.entries(extCount).sort((a, b) => b[1] - a[1]).forEach(([e, c]) => console.log(String(c).padStart(6), e));

console.log('\n=== risk levers ===');
console.log('live freeze authority   :', rows.filter(r => live(r.freezeAuthority)).length);
console.log('live permanent delegate :', rows.filter(r => live(r.permanentDelegate)).length);
console.log('transfer hook program   :', rows.filter(r => r.transferHook && live(r.transferHook.programId)).length);
console.log('  of which hook authority still live:', rows.filter(r => r.transferHook && live(r.transferHook.programId) && live(r.transferHook.authority)).length);
console.log('pausable w/ authority   :', rows.filter(r => r.pausable && live(r.pausable.authority)).length);
console.log('has TransferFeeConfig   :', rows.filter(r => r.transferFee).length);
console.log('  non-zero older bps    :', rows.filter(r => r.transferFee && r.transferFee.olderBps > 0).length);
console.log('  non-zero newer bps    :', rows.filter(r => r.transferFee && r.transferFee.newerBps > 0).length);
console.log('  fee scheduled in future epoch:', rows.filter(r => r.transferFee && r.transferFee.newerEpoch > EPOCH).length);
console.log('DefaultAccountState=Frozen:', rows.filter(r => r.defaultAccountState === 2).length);
console.log('NonTransferable          :', rows.filter(r => (r.extensions || []).includes('NonTransferable')).length);
console.log('\nflagged (any live lever):', flagged.length, 'of', rows.length);
fs.writeFileSync('raw/mints-flagged.json', JSON.stringify(flagged, null, 2));
