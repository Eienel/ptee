import {
  Connection,
  PublicKey,
  type ConfirmedSignatureInfo,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { EMBER_KEEPER, EMBER_MINT, MET_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from './constants';

export interface Payout {
  signature: string;
  slot: number;
  /** Block time in unix seconds; 0 when the cluster did not return one. */
  at: number;
  mint: string;
  decimals: number;
  /** UI amount credited to this wallet by this transaction. */
  amount: number;
}

export interface TokenTotal {
  mint: string;
  symbol: string;
  decimals: number;
  total: number;
  count: number;
}

export interface Receipt {
  wallet: string;
  payouts: Payout[];
  byToken: TokenTotal[];
  firstAt: number | null;
  lastAt: number | null;
  biggest: Payout | null;
  /** How many signatures were examined to produce this receipt. */
  scanned: number;
  /** Token accounts the wallet owns, and how many were worth scanning. */
  accountsOwned: number;
  accountsScanned: number;
  /** Mints the wallet holds that Ember could have paid in — the scanned set. */
  heldMints: string[];
}

export interface ScanProgress {
  phase: 'accounts' | 'signatures' | 'transactions' | 'metadata' | 'done';
  done: number;
  total: number;
}

const SIGNATURE_PAGE = 1000;
/** Small enough that a rate-limited public endpoint can still complete a scan. */
const TX_BATCH = 25;
const MAX_RETRIES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isRateLimit = (err: unknown) =>
  /429|too many requests|rate/i.test(err instanceof Error ? err.message : String(err));

/** Retries a rate-limited call with exponential backoff; other errors propagate. */
async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimit(err) || attempt >= MAX_RETRIES) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}

interface OwnedAccount {
  pubkey: PublicKey;
  mint: string;
}

/** Every token account the wallet owns, across both token programs. */
async function tokenAccountsOf(connection: Connection, owner: PublicKey): Promise<OwnedAccount[]> {
  const results = await Promise.all(
    [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) =>
      connection.getTokenAccountsByOwner(owner, { programId }),
    ),
  );
  return results.flatMap((r) =>
    r.value.map((v) => ({
      pubkey: v.pubkey,
      mint: new PublicKey(v.account.data.subarray(0, 32)).toBase58(),
    })),
  );
}

let keeperMintCache: Set<string> | null = null;

/**
 * The mints Ember can possibly have paid in — every mint its keeper holds a
 * token account for. Intersecting this with the wallet's own mints is what
 * keeps the scan cheap: an active trader can hold 500+ token accounts while
 * only a couple of dozen could ever have come from Ember.
 *
 * Caveat: if the keeper ever closed an account for a mint it once paid in,
 * payouts in that mint are not discoverable this way.
 */
export async function keeperMints(connection: Connection): Promise<Set<string>> {
  if (keeperMintCache) return keeperMintCache;
  const accounts = await tokenAccountsOf(connection, EMBER_KEEPER);
  const mints = new Set(accounts.map((a) => a.mint));
  // The two that must always be considered, even if the keeper is holding none
  // right now: holder rewards arrive in MET, and prizes often in EMBER itself.
  mints.add(MET_MINT.toBase58());
  mints.add(EMBER_MINT.toBase58());
  keeperMintCache = mints;
  return mints;
}

async function allSignatures(
  connection: Connection,
  address: PublicKey,
  cap: number,
): Promise<ConfirmedSignatureInfo[]> {
  const out: ConfirmedSignatureInfo[] = [];
  let before: string | undefined;
  while (out.length < cap) {
    const page = await withBackoff(() =>
      connection.getSignaturesForAddress(address, {
        before,
        limit: Math.min(SIGNATURE_PAGE, cap - out.length),
      }),
    );
    if (page.length === 0) break;
    out.push(...page);
    before = page[page.length - 1].signature;
    if (page.length < SIGNATURE_PAGE) break;
  }
  return out;
}

/**
 * A transaction counts as an Ember payout when the keeper signed and paid for
 * it AND this wallet's token balance went up. Reading the credit from the
 * balance deltas rather than from Ember's reported figure means the receipt
 * reflects what actually landed, which is not always the same number.
 */
function creditsToWallet(tx: ParsedTransactionWithMeta, wallet: string): Omit<Payout, 'signature'>[] {
  const meta = tx.meta;
  if (!meta || meta.err) return [];

  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey?.toBase58();
  if (feePayer !== EMBER_KEEPER.toBase58()) return [];

  const before = new Map((meta.preTokenBalances ?? []).map((b) => [b.accountIndex, b]));
  const credits: Omit<Payout, 'signature'>[] = [];

  for (const post of meta.postTokenBalances ?? []) {
    if (post.owner !== wallet) continue;
    const pre = before.get(post.accountIndex);
    const decimals = post.uiTokenAmount.decimals;
    const delta =
      (Number(post.uiTokenAmount.amount) - Number(pre?.uiTokenAmount.amount ?? 0)) / 10 ** decimals;
    if (delta > 0) {
      credits.push({ slot: tx.slot, at: tx.blockTime ?? 0, mint: post.mint, decimals, amount: delta });
    }
  }
  return credits;
}

export interface ScanOptions {
  /** Upper bound on signatures pulled per token account. */
  signatureCap?: number;
  onProgress?: (p: ScanProgress) => void;
  signal?: AbortSignal;
}

export async function scanWallet(
  connection: Connection,
  wallet: PublicKey,
  options: ScanOptions = {},
): Promise<Receipt> {
  const { signatureCap = 2000, onProgress, signal } = options;
  const walletStr = wallet.toBase58();
  const abort = () => {
    if (signal?.aborted) throw new Error('Scan cancelled');
  };

  onProgress?.({ phase: 'accounts', done: 0, total: 2 });
  const [owned, payable] = await Promise.all([
    tokenAccountsOf(connection, wallet),
    keeperMints(connection),
  ]);
  abort();

  // Only accounts in a mint Ember actually pays can hold a payout.
  const accounts = owned.filter((a) => payable.has(a.mint));
  onProgress?.({ phase: 'accounts', done: 2, total: 2 });

  // Collect signatures across every token account, de-duplicated: one payout
  // transaction can credit several of the wallet's accounts at once.
  const signatures = new Map<string, ConfirmedSignatureInfo>();
  for (let i = 0; i < accounts.length; i++) {
    abort();
    for (const sig of await allSignatures(connection, accounts[i].pubkey, signatureCap)) {
      if (!sig.err) signatures.set(sig.signature, sig);
    }
    onProgress?.({ phase: 'signatures', done: i + 1, total: accounts.length });
  }

  const list = [...signatures.keys()];
  const payouts: Payout[] = [];
  const collect = (signature: string, tx: ParsedTransactionWithMeta | null) => {
    if (!tx) return;
    for (const credit of creditsToWallet(tx, walletStr)) payouts.push({ signature, ...credit });
  };

  // Batched fetches are far faster, but some endpoints cap them regardless of
  // backoff. Fall back to one-at-a-time rather than failing the whole scan.
  let sequential = false;
  let cursor = 0;
  while (cursor < list.length) {
    abort();
    if (!sequential) {
      const batch = list.slice(cursor, cursor + TX_BATCH);
      try {
        const txs = await withBackoff(() =>
          connection.getParsedTransactions(batch, { maxSupportedTransactionVersion: 0 }),
        );
        txs.forEach((tx, j) => collect(batch[j], tx));
        cursor += batch.length;
      } catch (err) {
        if (!isRateLimit(err)) throw err;
        sequential = true; // retry the same slice one signature at a time
        continue;
      }
    } else {
      const signature = list[cursor];
      const tx = await withBackoff(() =>
        connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 }),
      );
      collect(signature, tx);
      cursor += 1;
      await sleep(260);
    }
    onProgress?.({ phase: 'transactions', done: cursor, total: list.length });
    if (!sequential && cursor < list.length) await sleep(120);
  }

  payouts.sort((a, b) => b.at - a.at);

  const totals = new Map<string, TokenTotal>();
  for (const p of payouts) {
    const t = totals.get(p.mint) ?? {
      mint: p.mint, symbol: '', decimals: p.decimals, total: 0, count: 0,
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
    biggest: payouts.reduce<Payout | null>((a, b) => (!a || b.amount > a.amount ? b : a), null),
    scanned: list.length,
    accountsOwned: owned.length,
    accountsScanned: accounts.length,
    heldMints: [...new Set(accounts.map((a) => a.mint))],
  };
}
