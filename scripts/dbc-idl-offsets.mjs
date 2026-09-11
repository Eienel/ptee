import { readFileSync } from 'node:fs';
const idl = JSON.parse(readFileSync('raw/dbc-idl.json', 'utf8'));
const types = new Map((idl.types || []).map((t) => [t.name, t]));
const PRIM = { u8:1,i8:1,bool:1,u16:2,i16:2,u32:4,i32:4,u64:8,i64:8,u128:16,i128:16,pubkey:32,publicKey:32,f64:8 };

function sizeOf(t) {
  if (typeof t === 'string') {
    if (PRIM[t] !== undefined) return PRIM[t];
    const d = types.get(t); if (d) return sizeOfType(d); throw new Error('unknown ' + t);
  }
  if (t.array) return sizeOf(t.array[0]) * t.array[1];
  if (t.defined) return sizeOfType(types.get(t.defined.name ?? t.defined));
  throw new Error('unhandled ' + JSON.stringify(t));
}
function sizeOfType(def) {
  if (!def) throw new Error('missing type');
  if (def.type.kind === 'struct') return def.type.fields.reduce((a, f) => a + sizeOf(f.type), 0);
  if (def.type.kind === 'enum') return 1;
  throw new Error('unhandled kind ' + def.type.kind);
}
function offsets(name, base = 8, prefix = '') {
  const def = types.get(name);
  let o = base; const out = [];
  for (const f of def.type.fields) {
    const s = sizeOf(f.type);
    const nested = typeof f.type === 'object' && f.type.defined && types.get(f.type.defined.name ?? f.type.defined)?.type.kind === 'struct';
    out.push({ path: prefix + f.name, offset: o, size: s });
    if (nested) out.push(...offsets(f.type.defined.name ?? f.type.defined, o, prefix + f.name + '.'));
    o += s;
  }
  return out;
}

const want = ['base_mint','quote_mint','config','quote_reserve','base_reserve','is_migrated','migration_progress','pool_type','creator','migration_quote_threshold'];
for (const acct of ['VirtualPool','PoolConfig']) {
  console.log(`\n=== ${acct} (total ${8 + sizeOfType(types.get(acct))} bytes) ===`);
  for (const f of offsets(acct)) {
    const leaf = f.path.split('.').pop();
    if (want.includes(leaf)) console.log(String(f.offset).padStart(5), f.path, `(${f.size}B)`);
  }
}
