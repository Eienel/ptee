import { Connection, PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PayoutList } from './components/PayoutList';
import { ReceiptCard } from './components/ReceiptCard';
import { TokenPanel } from './components/TokenPanel';
import { EMBER_KEEPER, SOLSCAN_ACCOUNT } from './lib/constants';
import { toDataUrl } from './lib/images';
import { downloadBlob, svgToPngBlob } from './lib/png';
import { formatAmount } from './lib/format';
import { attributeByQuote, pairedCoins } from './lib/attribution';
import { initialEndpoint, normalizeEndpoint, PUBLIC_RPC } from './lib/rpc';
import { scanWallet, type Receipt, type ScanProgress } from './lib/scan';
import { classifyAddress, loadToken, type TokenView } from './lib/token';
import { loadImages, resolveTokens, type TokenMeta } from './lib/tokens';

const RPC_KEY = 'ember.rpc';

const PHASE_LABEL: Record<ScanProgress['phase'], string> = {
  accounts: 'Finding token accounts',
  signatures: 'Reading transaction history',
  transactions: 'Checking payouts',
  metadata: 'Resolving tokens',
  done: 'Done',
};

export default function App() {
  const [rpc, setRpc] = useState(() =>
    initialEndpoint(localStorage.getItem(RPC_KEY), import.meta.env.VITE_RPC_URL),
  );
  const [input, setInput] = useState(() => new URLSearchParams(location.search).get('w') ?? '');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [token, setToken] = useState<TokenView | null>(null);
  const [tokens, setTokens] = useState<Map<string, TokenMeta>>(new Map());
  const [heroLogo, setHeroLogo] = useState<string | null>(null);
  /** Payout token mint -> held coins paired against it. Inferred, not proven. */
  const [attribution, setAttribution] = useState<Map<string, string[]>>(new Map());
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<SVGSVGElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => localStorage.setItem(RPC_KEY, rpc), [rpc]);

  // A malformed endpoint must never throw during render: fall back and say so.
  const endpoint = normalizeEndpoint(rpc);
  const connection = useMemo(
    () => new Connection(endpoint ?? PUBLIC_RPC, 'confirmed'),
    [endpoint],
  );

  const scan = useCallback(
    async (address: string) => {
      let wallet: PublicKey;
      try {
        wallet = new PublicKey(address.trim());
      } catch {
        setError('That is not a valid Solana address.');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setBusy(true);
      setError(null);
      setReceipt(null);
      setToken(null);
      setHeroLogo(null);
      setAttribution(new Map());
      setProgress({ phase: 'accounts', done: 0, total: 1 });

      try {
        // One input, two answers: a mint gets the token view, a wallet gets a receipt.
        const kind = await classifyAddress(connection, wallet);
        if (kind === 'mint') {
          const view = await loadToken(connection, wallet);
          if (!view) {
            setError('That token has no Meteora bonding curve pool, so it was not launched on a DBC.');
          } else {
            setToken(view);
            const url = new URL(location.href);
            url.searchParams.set('w', view.mint);
            history.replaceState(null, '', url);
          }
          setProgress(null);
          return;
        }

        const result = await scanWallet(connection, wallet, {
          onProgress: setProgress,
          signal: controller.signal,
        });
        setProgress({ phase: 'metadata', done: 0, total: 1 });
        const meta = await resolveTokens(connection, result.byToken.map((t) => t.mint));
        setTokens(meta);
        setReceipt(result);
        setProgress({ phase: 'done', done: 1, total: 1 });

        // Work out which held coin each payout token came from. Runs after the
        // receipt is on screen because it is supporting detail, not the figures.
        void pairedCoins(connection, result.heldMints).then(async (paired) => {
          setAttribution(attributeByQuote(paired));
          const extra = paired.map((p) => p.mint).filter((m) => !meta.has(m));
          if (extra.length > 0) {
            const names = await resolveTokens(connection, extra);
            setTokens((current) => new Map([...current, ...names]));
          }
        });

        // Artwork resolves after the receipt is already on screen, so a slow
        // IPFS gateway never delays the numbers.
        void loadImages(meta).then(async (withImages) => {
          setTokens((current) => new Map([...current, ...withImages]));
          const hero = result.byToken[0];
          const image = hero ? withImages.get(hero.mint)?.image : null;
          if (image) setHeroLogo(await toDataUrl(image));
        });

        const url = new URL(location.href);
        url.searchParams.set('w', result.wallet);
        history.replaceState(null, '', url);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setProgress(null);
      } finally {
        setBusy(false);
      }
    },
    [connection],
  );

  const savePng = useCallback(async () => {
    if (!cardRef.current || !receipt) return;
    try {
      const blob = await svgToPngBlob(cardRef.current);
      downloadBlob(blob, `ember-receipt-${receipt.wallet.slice(0, 6)}.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [receipt]);

  const copyLink = useCallback(() => {
    navigator.clipboard?.writeText(location.href);
  }, []);

  /** Pre-fills a post with the headline numbers; the PNG is attached by hand. */
  const shareUrl = useMemo(() => {
    if (!receipt) return '';
    const top = receipt.byToken[0];
    const line = top
      ? `${formatAmount(top.total)} ${tokens.get(top.mint)?.symbol ?? ''} across ${receipt.payouts.length} payouts`
      : `${receipt.payouts.length} payouts`;
    const text = `My @embercurve receipt: ${line}.\n\nEvery number verified on-chain, not from a dashboard.`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
  }, [receipt, tokens]);

  const usingPublicRpc = (endpoint ?? PUBLIC_RPC).includes('api.mainnet-beta.solana.com');

  return (
    <div className="page">
      <header>
        <div className="brand">
          <span className="flame" aria-hidden="true">🔥</span>
          <div>
            <strong>Ember Receipts</strong>
            <small>wallets and Ember launches, read from the chain</small>
          </div>
        </div>
      </header>

      <main>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            scan(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a wallet or an Ember token address"
            spellCheck={false}
            aria-label="Wallet or token address"
          />
          <button className="primary" disabled={busy || input.trim().length === 0}>
            {busy ? 'Reading the chain…' : 'Look it up'}
          </button>
        </form>

        <details className="rpc">
          <summary>RPC endpoint {usingPublicRpc && <span className="warn-dot">needs attention</span>}</summary>
          <input value={rpc} onChange={(e) => setRpc(e.target.value)} spellCheck={false} />
          {endpoint === null && (
            <p className="hint warn-text">
              That endpoint is not a valid http(s) URL, so the public one is being used instead.
            </p>
          )}
          {usingPublicRpc && (
            <p className="hint">
              The public endpoint rate-limits hard and will usually fail this scan — it reads a
              wallet&rsquo;s full transaction history. Paste a Helius or Triton URL.
            </p>
          )}
        </details>

        {progress && busy && (
          <div className="progress">
            <span>{PHASE_LABEL[progress.phase]}</span>
            {progress.total > 1 && (
              <span className="count">
                {progress.done} / {progress.total}
              </span>
            )}
          </div>
        )}

        {error && <p className="alert">{error}</p>}

        {token && <TokenPanel token={token} />}

        {receipt && receipt.payouts.length === 0 && (
          <p className="empty">
            No Ember payouts found for this wallet. Payouts are only counted when they come from
            the keeper{' '}
            <a href={SOLSCAN_ACCOUNT(EMBER_KEEPER.toBase58())} target="_blank" rel="noreferrer">
              {EMBER_KEEPER.toBase58().slice(0, 8)}…
            </a>
            .
          </p>
        )}

        {receipt && receipt.payouts.length > 0 && (
          <>
            <section className="card-wrap">
              <ReceiptCard ref={cardRef} receipt={receipt} tokens={tokens} logo={heroLogo} />
            </section>
            <div className="card-actions">
              <button className="primary" onClick={savePng}>
                Download PNG
              </button>
              <a className="btn-link" href={shareUrl} target="_blank" rel="noreferrer">
                Share on X
              </a>
              <button onClick={copyLink}>Copy link</button>
              <span className="scanned">{receipt.scanned.toLocaleString()} signatures checked</span>
            </div>
            <PayoutList receipt={receipt} tokens={tokens} attribution={attribution} />
          </>
        )}

        {!receipt && !token && !busy && (
          <section className="explain">
            <h1>Every number here is a transaction you can open.</h1>
            <p>
              Paste a <strong>wallet</strong> and it finds every transaction signed and funded by
              Ember&rsquo;s keeper that increased your token balance, and adds them up. Paste a{' '}
              <strong>token</strong> and it reads that coin&rsquo;s bonding curve straight from its
              pool account — how far along it is, what it is paired with, and what Ember has paid
              out of its fees. Nothing is taken from a dashboard; the amounts come from the balance
              changes in the transactions themselves, which is not always the same as the figure
              reported for a round.
            </p>
            <p className="fine">
              Read-only. No wallet connection, no signing, nothing to approve — paste an address and
              it reads public data.
            </p>
          </section>
        )}
      </main>

      <footer>
        <a href={SOLSCAN_ACCOUNT(EMBER_KEEPER.toBase58())} target="_blank" rel="noreferrer">
          Ember keeper wallet
        </a>
        <a href="https://embercurve.fun/meteora" target="_blank" rel="noreferrer">
          Ember&rsquo;s own ledger
        </a>
        <span>Unofficial. Not affiliated with Embercurve. Not financial advice.</span>
      </footer>
    </div>
  );
}
