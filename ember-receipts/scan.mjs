// src/lib/scan.ts
import {
  PublicKey as PublicKey2
} from "@solana/web3.js";

// src/lib/constants.ts
import { PublicKey } from "@solana/web3.js";
var EMBER_KEEPER = new PublicKey("GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp");
var EMBER_MINT = new PublicKey("5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6");
var MET_MINT = new PublicKey("METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL");
var TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
var METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// src/lib/scan.ts
var SIGNATURE_PAGE = 1e3;
var TX_BATCH = 25;
var MAX_RETRIES = 5;
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var isRateLimit = (err) => /429|too many requests|rate/i.test(err instanceof Error ? err.message : String(err));
async function withBackoff(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimit(err) || attempt >= MAX_RETRIES) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}
async function tokenAccountsOf(connection, owner) {
  const results = await Promise.all(
    [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map(
      (programId) => connection.getTokenAccountsByOwner(owner, { programId })
    )
  );
  return results.flatMap(
    (r) => r.value.map((v) => ({
      pubkey: v.pubkey,
      mint: new PublicKey2(v.account.data.subarray(0, 32)).toBase58()
    }))
  );
}
var keeperMintCache = null;
async function keeperMints(connection) {
  if (keeperMintCache) return keeperMintCache;
  const accounts = await tokenAccountsOf(connection, EMBER_KEEPER);
  const mints = new Set(accounts.map((a) => a.mint));
  mints.add(MET_MINT.toBase58());
  mints.add(EMBER_MINT.toBase58());
  keeperMintCache = mints;
  return mints;
}
async function allSignatures(connection, address, cap) {
  const out = [];
  let before;
  while (out.length < cap) {
    const page = await withBackoff(
      () => connection.getSignaturesForAddress(address, {
        before,
        limit: Math.min(SIGNATURE_PAGE, cap - out.length)
      })
    );
    if (page.length === 0) break;
    out.push(...page);
    before = page[page.length - 1].signature;
    if (page.length < SIGNATURE_PAGE) break;
  }
  return out;
}
function creditsToWallet(tx, wallet) {
  const meta = tx.meta;
  if (!meta || meta.err) return [];
  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey?.toBase58();
  if (feePayer !== EMBER_KEEPER.toBase58()) return [];
  const before = new Map((meta.preTokenBalances ?? []).map((b) => [b.accountIndex, b]));
  const credits = [];
  for (const post of meta.postTokenBalances ?? []) {
    if (post.owner !== wallet) continue;
    const pre = before.get(post.accountIndex);
    const decimals = post.uiTokenAmount.decimals;
    const delta = (Number(post.uiTokenAmount.amount) - Number(pre?.uiTokenAmount.amount ?? 0)) / 10 ** decimals;
    if (delta > 0) {
      credits.push({ slot: tx.slot, at: tx.blockTime ?? 0, mint: post.mint, decimals, amount: delta });
    }
  }
  return credits;
}
async function scanWallet(connection, wallet, options = {}) {
  const { signatureCap = 2e3, onProgress, signal } = options;
  const walletStr = wallet.toBase58();
  const abort = () => {
    if (signal?.aborted) throw new Error("Scan cancelled");
  };
  onProgress?.({ phase: "accounts", done: 0, total: 2 });
  const [owned, payable] = await Promise.all([
    tokenAccountsOf(connection, wallet),
    keeperMints(connection)
  ]);
  abort();
  const accounts = owned.filter((a) => payable.has(a.mint));
  onProgress?.({ phase: "accounts", done: 2, total: 2 });
  const signatures = /* @__PURE__ */ new Map();
  for (let i = 0; i < accounts.length; i++) {
    abort();
    for (const sig of await allSignatures(connection, accounts[i].pubkey, signatureCap)) {
      if (!sig.err) signatures.set(sig.signature, sig);
    }
    onProgress?.({ phase: "signatures", done: i + 1, total: accounts.length });
  }
  const list = [...signatures.keys()];
  const payouts = [];
  const collect = (signature, tx) => {
    if (!tx) return;
    for (const credit of creditsToWallet(tx, walletStr)) payouts.push({ signature, ...credit });
  };
  let sequential = false;
  let cursor = 0;
  while (cursor < list.length) {
    abort();
    if (!sequential) {
      const batch = list.slice(cursor, cursor + TX_BATCH);
      try {
        const txs = await withBackoff(
          () => connection.getParsedTransactions(batch, { maxSupportedTransactionVersion: 0 })
        );
        txs.forEach((tx, j) => collect(batch[j], tx));
        cursor += batch.length;
      } catch (err) {
        if (!isRateLimit(err)) throw err;
        sequential = true;
        continue;
      }
    } else {
      const signature = list[cursor];
      const tx = await withBackoff(
        () => connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 })
      );
      collect(signature, tx);
      cursor += 1;
      await sleep(260);
    }
    onProgress?.({ phase: "transactions", done: cursor, total: list.length });
    if (!sequential && cursor < list.length) await sleep(120);
  }
  payouts.sort((a, b) => b.at - a.at);
  const totals = /* @__PURE__ */ new Map();
  for (const p of payouts) {
    const t = totals.get(p.mint) ?? {
      mint: p.mint,
      symbol: "",
      decimals: p.decimals,
      total: 0,
      count: 0
    };
    t.total += p.amount;
    t.count += 1;
    totals.set(p.mint, t);
  }
  const dated = payouts.filter((p) => p.at > 0);
  return {
    wallet: walletStr,
    payouts,
    byToken: [...totals.values()].sort((a, b) => b.count - a.count),
    firstAt: dated.length ? dated[dated.length - 1].at : null,
    lastAt: dated.length ? dated[0].at : null,
    biggest: payouts.reduce((a, b) => !a || b.amount > a.amount ? b : a, null),
    scanned: list.length,
    accountsOwned: owned.length,
    accountsScanned: accounts.length,
    heldMints: [...new Set(accounts.map((a) => a.mint))]
  };
}
export {
  keeperMints,
  scanWallet
};
