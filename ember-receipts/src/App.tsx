import type React from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PayoutList } from './components/PayoutList';
import { ReceiptCard } from './components/ReceiptCard';
import { TokenPanel } from './components/TokenPanel';
import { Arena } from './components/Arena';
import { ConvictionPanel } from './components/ConvictionPanel';
import { EMBER_KEEPER, SOLSCAN_ACCOUNT } from './lib/constants';
import { toDataUrl } from './lib/images';
import { downloadBlob, svgToPngBlob } from './lib/png';
import { formatAmount, formatUsd } from './lib/format';
import { attributeByQuote, pairedCoins } from './lib/attribution';
import { fetchPrices, valueOf, type TokenPrice } from './lib/prices';
import { variantById, VARIANTS } from './lib/variants';
import { describeEndpoint, normalizeEndpoint, PUBLIC_RPC, userOverride } from './lib/rpc';
import { scanWallet, type Receipt, type ScanProgress } from './lib/scan';
import { buildLedger, fetchEmberWallet, type Ledger } from './lib/ledger';
import { Breakdown } from './components/Breakdown';
import { YieldBoard } from './components/YieldBoard';
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
  // Only a user's own override is kept in state and storage. The configured
  // endpoint is never put in an input, so its key is never rendered.
  const [override, setOverride] = useState(() =>
    userOverride(localStorage.getItem(RPC_KEY), import.meta.env.VITE_RPC_URL),
  );
  const [input, setInput] = useState(() => new URLSearchParams(location.search).get('w') ?? '');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [token, setToken] = useState<TokenView | null>(null);
  const [tokens, setTokens] = useState<Map<string, TokenMeta>>(new Map());
  const [heroLogo, setHeroLogo] = useState<string | null>(null);
  /** Payout token mint -> held coins paired against it. Inferred, not proven. */
  const [attribution, setAttribution] = useState<Map<string, string[]>>(new Map());
  const [prices, setPrices] = useState<Map<string, TokenPrice>>(new Map());
  /** Ember's own labels for our payouts, joined by signature. Never the ledger. */
  const [ledger, setLedger] = useState<Ledger | null>(null);
  // Card style rides in the URL so a shared link keeps the look it was made in.
  const [variantId, setVariantId] = useState(
    () => new URLSearchParams(location.search).get('v') ?? VARIANTS[0].id,
  );
  const variant = variantById(variantId);

  useEffect(() => {
    const url = new URL(location.href);
    if (variantId === VARIANTS[0].id) url.searchParams.delete('v');
    else url.searchParams.set('v', variantId);
    history.replaceState(null, '', url);
  }, [variantId]);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<SVGSVGElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (override.trim()) localStorage.setItem(RPC_KEY, override);
    else localStorage.removeItem(RPC_KEY);
  }, [override]);

  const configured = normalizeEndpoint(import.meta.env.VITE_RPC_URL);
  const custom = normalizeEndpoint(override);
  // A malformed endpoint must never throw during render: fall back and say so.
  const endpoint = custom ?? configured ?? PUBLIC_RPC;
  const overrideRejected = override.trim().length > 0 && custom === null;
  const connection = useMemo(() => new Connection(endpoint, 'confirmed'), [endpoint]);

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
      setPrices(new Map());
      setLedger(null);
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

        // Dollar values are a separate, slower concern than the token amounts.
        void fetchPrices(result.byToken.map((t) => t.mint)).then(setPrices);

        // Ember's ledger names the module behind each payout and the coin it
        // came from — neither is recoverable from the chain. It is joined onto
        // our scan by signature, so a failure here costs labels, never figures.
        void fetchEmberWallet(wallet.toBase58()).then((ember) => {
          if (ember) setLedger(buildLedger(result, ember, (m) => meta.get(m)?.symbol ?? null));
        });

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
      downloadBlob(blob, `ember-receipt-${receipt.wallet.slice(0, 6)}-${variantId}.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [receipt, variantId]);

  const copyLink = useCallback(() => {
    navigator.clipboard?.writeText(location.href);
  }, []);

  /** Pre-fills a post with the headline numbers; the PNG is attached by hand. */
  const shareUrl = useMemo(() => {
    if (!receipt) return '';
    const top = receipt.byToken[0];
    const value = valueOf(receipt.byToken, prices);
    const worth = value.priced > 0 ? ` — worth ${formatUsd(value.usd)} today` : '';
    const line = top
      ? `${formatAmount(top.total)} ${tokens.get(top.mint)?.symbol ?? ''} across ${receipt.payouts.length} payouts${worth}`
      : `${receipt.payouts.length} payouts`;
    const text = `My @embercurve receipt: ${line}.\n\nEvery number verified on-chain, not from a dashboard.`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
  }, [receipt, tokens, prices]);

  const usingPublicRpc = endpoint === PUBLIC_RPC;

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
          <summary>
            Network: {describeEndpoint(endpoint)}
            {usingPublicRpc && <span className="warn-dot">rate limited</span>}
          </summary>
          <input
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            spellCheck={false}
            placeholder="Use your own RPC endpoint (optional)"
            aria-label="Custom RPC endpoint"
          />
          {overrideRejected && (
            <p className="hint warn-text">
              That is not a valid http(s) URL, so it is being ignored.
            </p>
          )}
          {override.trim() && !overrideRejected && (
            <p className="hint">
              Using your endpoint instead of the built-in one.{' '}
              <button className="linkish" onClick={() => setOverride('')}>
                Reset
              </button>
            </p>
          )}
          {usingPublicRpc && !override.trim() && (
            <p className="hint">
              No endpoint is configured for this site, so the public one is in use. It rate-limits
              hard and will usually fail a scan — paste your own above.
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
        {token && token.launchedOnEmber && (
          <ConvictionPanel pool={token.pool} symbol={token.symbol} />
        )}

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
              <ReceiptCard
                ref={cardRef}
                receipt={receipt}
                tokens={tokens}
                logo={heroLogo}
                prices={prices}
                variant={variant}
              />
            </section>
            <div className="variants" role="group" aria-label="Card style">
              {VARIANTS.map((v) => (
                <button
                  key={v.id}
                  className={v.id === variantId ? 'chip on' : 'chip'}
                  onClick={() => setVariantId(v.id)}
                  style={{ '--chip': v.accent2 } as React.CSSProperties}
                >
                  {v.label}
                </button>
              ))}
            </div>

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
            <Breakdown ledger={ledger} tokens={tokens} prices={prices} />
            <PayoutList
              receipt={receipt}
              tokens={tokens}
              attribution={attribution}
              prices={prices}
              ledger={ledger}
            />
          </>
        )}

        {!receipt && !token && !busy && (
          <section className="explain">
            <p>
              A wallet gets a receipt of every Ember payout it has received. A token gets its
              curve and what its fees have paid out.{' '}
              <a href="https://github.com/Eienel/ptee/tree/HEAD/ember-receipts" target="_blank" rel="noreferrer">
                How it works
              </a>
            </p>
            <p className="fine">Read-only. No wallet connection, nothing to sign.</p>
          </section>
        )}

        {!receipt && !token && !busy && <YieldBoard />}
        {!receipt && !token && !busy && <Arena />}

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
