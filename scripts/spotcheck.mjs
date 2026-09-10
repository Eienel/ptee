import { writeFileSync } from 'node:fs';
import { Connection, PublicKey } from '@solana/web3.js';
import { ExtensionType, unpackMint, getTransferHook, getPermanentDelegate,
         getPausableConfig, getExtensionTypes, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

const RPC = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC, 'confirmed');
const ZERO = '11111111111111111111111111111111';

const TARGETS = [
  ['NVDAx',  'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh'],
  ['AAPLon', '123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo'],
  ['ETNon',  'BpYiU1dBXU1fdB64jbR93wHEw3Y47QeRLZvUyLQondo'],
];

/** All-zero 32-byte pubkey encodes None for OptionalNonZeroPubkey. */
function optPubkey(buf) {
  return buf.every((b) => b === 0) ? null : new PublicKey(buf).toBase58();
}

/** Walk the Token-2022 TLV region straight out of the account bytes. */
function parseRaw(data) {
  const base = {
    mintAuthority: data.readUInt32LE(0) === 1 ? new PublicKey(data.subarray(4, 36)).toBase58() : null,
    supply: data.readBigUInt64LE(36).toString(),
    decimals: data.readUInt8(44),
    isInitialized: data.readUInt8(45) === 1,
    freezeAuthority: data.readUInt32LE(46) === 1 ? new PublicKey(data.subarray(50, 82)).toBase58() : null,
  };
  const exts = [];
  const fields = {};
  if (data.length > 165) {
    const accountType = data.readUInt8(165);
    base.accountType = accountType; // 1 == Mint
    let o = 166;
    while (o + 4 <= data.length) {
      const type = data.readUInt16LE(o);
      const len = data.readUInt16LE(o + 2);
      if (type === 0 && len === 0) break;
      const value = data.subarray(o + 4, o + 4 + len);
      exts.push({ type, name: ExtensionType[type] ?? `Unknown(${type})`, length: len, offset: o });
      if (type === 12) fields.permanentDelegate = optPubkey(value);
      if (type === 26) fields.pausableAuthority = optPubkey(value);
      if (type === 14) {
        // TransferHook { authority, program_id }
        fields.transferHookAuthority = optPubkey(value.subarray(0, 32));
        fields.transferHookProgramId = optPubkey(value.subarray(32, 64));
      }
      if (type === 1) {
        // TransferFeeConfig: authority(32) withdrawAuthority(32) withheld(8)
        // then older{epoch u64, maxFee u64, bps u16} newer{...}
        fields.transferFeeConfigAuthority = optPubkey(value.subarray(0, 32));
        fields.olderFeeBps = value.readUInt16LE(72 + 16);
        fields.newerFeeBps = value.readUInt16LE(72 + 24 + 16);
      }
      o += 4 + len;
    }
  }
  return { base, exts, fields };
}

const out = [];
for (const [symbol, mintStr] of TARGETS) {
  const pubkey = new PublicKey(mintStr);
  const info = await connection.getAccountInfo(pubkey, 'confirmed');
  const raw = parseRaw(info.data);

  // Independent cross-check via the library's own unpacker.
  const unpacked = unpackMint(pubkey, info, info.owner);
  const libHook = getTransferHook(unpacked);
  const libDelegate = getPermanentDelegate(unpacked);
  const libPausable = getPausableConfig(unpacked);

  const rec = {
    symbol,
    mint: mintStr,
    owningProgram: info.owner.toBase58(),
    isToken2022: info.owner.equals(TOKEN_2022_PROGRAM_ID),
    dataLength: info.data.length,
    lamports: info.lamports,
    extensions: raw.exts.map((e) => e.name),
    extensionsRawTypes: raw.exts.map((e) => e.type),
    libExtensions: getExtensionTypes(info.data.subarray(166)).map((t) => ExtensionType[t]),
    mintAuthority: raw.base.mintAuthority,
    decimals: raw.base.decimals,
    freezeAuthority: raw.base.freezeAuthority,
    pausableAuthority: raw.fields.pausableAuthority ?? null,
    permanentDelegate: raw.fields.permanentDelegate ?? null,
    transferHookProgramId: raw.fields.transferHookProgramId ?? null,
    transferHookAuthority: raw.fields.transferHookAuthority ?? null,
    transferFee: raw.fields.olderFeeBps === undefined ? null
      : { authority: raw.fields.transferFeeConfigAuthority, olderBps: raw.fields.olderFeeBps, newerBps: raw.fields.newerFeeBps },
    crossCheck: {
      libDecimals: unpacked.decimals,
      libFreeze: unpacked.freezeAuthority ? unpacked.freezeAuthority.toBase58() : null,
      libMintAuthority: unpacked.mintAuthority ? unpacked.mintAuthority.toBase58() : null,
      libHookProgram: libHook ? libHook.programId.toBase58() : null,
      libHookAuthority: libHook ? libHook.authority.toBase58() : null,
      libDelegate: libDelegate ? libDelegate.delegate.toBase58() : null,
      libPausableAuthority: libPausable ? libPausable.authority.toBase58() : null,
    },
    rawBase64: info.data.toString('base64'),
  };
  out.push(rec);

  console.log(`\n=== ${symbol}  ${mintStr} ===`);
  console.log('1. owning program   :', rec.owningProgram, rec.isToken2022 ? '(Token-2022 ✓)' : '(NOT Token-2022 ✗)');
  console.log('2. extensions       :', rec.extensions.join(', '));
  console.log('   (lib agrees?)    :', JSON.stringify(rec.libExtensions) === JSON.stringify(rec.extensions) ? 'yes' : 'NO — lib says ' + rec.libExtensions.join(', '));
  console.log('3. freezeAuthority  :', rec.freezeAuthority ?? 'null');
  console.log('4. pausable auth    :', rec.pausableAuthority ?? 'null');
  console.log('5. permanentDelegate:', rec.permanentDelegate ?? 'null');
  console.log('6. transferHook prog:', rec.transferHookProgramId ?? 'null',
    rec.transferHookProgramId === ZERO ? '(ZERO ADDRESS)' : rec.transferHookProgramId ? '(non-zero)' : '(None / all-zero => no hook set)');
  console.log('   transferHook auth:', rec.transferHookAuthority ?? 'null');
  console.log('7. mintAuthority    :', rec.mintAuthority ?? 'null');
  console.log('8. decimals         :', rec.decimals);
  const cc = rec.crossCheck;
  const agree = cc.libDecimals === rec.decimals && cc.libFreeze === rec.freezeAuthority
    && cc.libMintAuthority === rec.mintAuthority && cc.libDelegate === rec.permanentDelegate
    && cc.libPausableAuthority === rec.pausableAuthority && cc.libHookProgram === rec.transferHookProgramId;
  console.log('   raw-parse vs spl-token unpackMint:', agree ? 'AGREE on all fields' : 'DISAGREE ' + JSON.stringify(cc));
}

writeFileSync('raw/spotcheck-mints.json', JSON.stringify({ rpc: RPC.includes('helius') ? 'helius' : RPC, fetchedAt: new Date().toISOString(), mints: out }, null, 2));
console.log('\nwrote raw/spotcheck-mints.json');
