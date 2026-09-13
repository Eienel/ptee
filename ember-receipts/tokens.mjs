// src/lib/tokens.ts
import { PublicKey as PublicKey2 } from "@solana/web3.js";

// src/lib/images.ts
var GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/"
];
function gatewayUrls(uri) {
  const trimmed = uri.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("ipfs://")) {
    const path = trimmed.slice("ipfs://".length).replace(/^ipfs\//, "");
    return GATEWAYS.map((g) => g + path);
  }
  if (/^(ar|arweave):\/\//.test(trimmed)) {
    return ["https://arweave.net/" + trimmed.replace(/^(ar|arweave):\/\//, "")];
  }
  if (/^https?:\/\//.test(trimmed)) return [trimmed];
  if (/^[A-Za-z0-9]{46,}$/.test(trimmed)) return GATEWAYS.map((g) => g + trimmed);
  return [];
}
async function firstOk(urls, timeoutMs) {
  if (urls.length === 0) return null;
  const attempts = urls.map(
    (url) => new Promise((resolve, reject) => {
      fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).then((res) => res.ok ? resolve(res) : reject(new Error(String(res.status)))).catch(reject);
    })
  );
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}
async function imageUrlFromMetadataUri(uri) {
  const res = await firstOk(gatewayUrls(uri), 7e3);
  if (!res) return null;
  try {
    const json = await res.json();
    if (typeof json.image !== "string") return null;
    return gatewayUrls(json.image)[0] ?? null;
  } catch {
    return null;
  }
}

// src/lib/constants.ts
import { PublicKey } from "@solana/web3.js";
var EMBER_KEEPER = new PublicKey("GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp");
var EMBER_MINT = new PublicKey("5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6");
var MET_MINT = new PublicKey("METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL");
var TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
var METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// src/lib/tokens.ts
var decoder = new TextDecoder();
var u32 = (d, o) => new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(o, true);
var u16 = (d, o) => new DataView(d.buffer, d.byteOffset, d.byteLength).getUint16(o, true);
function readString(data, offset) {
  const len = u32(data, offset);
  const raw = decoder.decode(data.subarray(offset + 4, offset + 4 + len));
  return [raw.replace(/\0+$/, "").trim(), offset + 4 + len];
}
function parseMetaplex(data) {
  try {
    const [name, afterName] = readString(data, 65);
    const [symbol, afterSymbol] = readString(data, afterName);
    const [uri] = readString(data, afterSymbol);
    return { symbol, name, uri };
  } catch {
    return null;
  }
}
function parseToken2022Meta(data) {
  if (data.length <= 165) return null;
  let offset = 166;
  while (offset + 4 <= data.length) {
    const type = u16(data, offset);
    const len = u16(data, offset + 2);
    if (type === 0 && len === 0) break;
    if (type === 19) {
      try {
        const value = data.subarray(offset + 4, offset + 4 + len);
        const [name, afterName] = readString(value, 64);
        const [symbol, afterSymbol] = readString(value, afterName);
        const [uri] = readString(value, afterSymbol);
        return { symbol, name, uri };
      } catch {
        return null;
      }
    }
    offset += 4 + len;
  }
  return null;
}
var metadataPda = (mint) => PublicKey2.findProgramAddressSync(
  [new TextEncoder().encode("metadata"), METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()],
  METAPLEX_PROGRAM_ID
)[0];
async function resolveTokens(connection, mints) {
  const out = /* @__PURE__ */ new Map();
  if (mints.length === 0) return out;
  const keys = mints.map((m) => new PublicKey2(m));
  const [metadataAccounts, mintAccounts] = await Promise.all([
    connection.getMultipleAccountsInfo(keys.map(metadataPda)),
    connection.getMultipleAccountsInfo(keys)
  ]);
  keys.forEach((key, i) => {
    const mint = key.toBase58();
    const meta = metadataAccounts[i];
    let parsed = meta ? parseMetaplex(meta.data) : null;
    if (!parsed?.symbol) {
      const acct = mintAccounts[i];
      if (acct?.owner.equals(TOKEN_2022_PROGRAM_ID)) parsed = parseToken2022Meta(acct.data) ?? parsed;
    }
    out.set(mint, {
      symbol: parsed?.symbol || `${mint.slice(0, 4)}\u2026`,
      name: parsed?.name || null,
      uri: parsed?.uri || null,
      image: null
    });
  });
  return out;
}
async function loadImages(tokens) {
  const entries = [...tokens.entries()];
  const images = await Promise.all(
    entries.map(([, meta]) => meta.uri ? imageUrlFromMetadataUri(meta.uri) : Promise.resolve(null))
  );
  const next = new Map(tokens);
  entries.forEach(([mint, meta], i) => next.set(mint, { ...meta, image: images[i] }));
  return next;
}
export {
  loadImages,
  resolveTokens
};
