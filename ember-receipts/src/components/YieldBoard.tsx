import { useCallback, useState } from 'react';
import { SOLSCAN_ACCOUNT } from '../lib/constants';
import { formatUsd } from '../lib/format';
import {
  FLOOR,
  currentBps,
  fetchMarkets,
  keepsFee,
  leaderboard,
  per1000,
  type Yield,
} from '../lib/yield';

const MODE_LABEL: Record<string, string> = {
  holders: 'pays holders',
  lotto: 'draws a lotto',
  burn: 'buys back & burns',
  perp: 'runs Conviction',
  diamond: 'weights by hold time',
  vault: 'escrows to a vault',
  sister: 'pays a sister coin',
  booster: 'burns $EMBER',
  dip: 'defends the dip',
  bounty: 'rewards top buyers',
  split: 'splits the fees',
  keep: 'pays the creator',
};

/**
 * What holding a coin has paid, per $1,000 of stake, over the last day.
 *
 * The whole payload is Ember's `/markets`, which is several megabytes, so it
 * loads on request rather than on page load. Every coin listed links out to
 * Solscan and to its page on Ember.
 */
export function YieldBoard() {
  const [rows, setRows] = useState<Yield[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    const data = await fetchMarkets();
    setBusy(false);
    if (!data?.markets) {
      setFailed(true);
      return;
    }
    setRows(leaderboard(data.markets, Math.floor(Date.now() / 1000), 20));
  }, []);

  return (
    <section className="yieldboard">
      <header className="yb-head">
        <h2>What holding pays</h2>
        {rows && <span className="tag">last 24 hours</span>}
      </header>

      <p className="yb-lede">
        What each coin paid its holders yesterday, per $1,000 held. A fee marked
        &ldquo;&rarr; 1%&rdquo; drops when the coin graduates; &ldquo;kept&rdquo; means it
        survives.
      </p>

      {!rows && (
        <button className="primary" onClick={load} disabled={busy}>
          {busy ? 'Loading Ember’s markets…' : 'Show what coins are paying'}
        </button>
      )}

      {failed && (
        <p className="alert">
          Ember&rsquo;s markets API did not respond, so there is nothing to show. Everything else
          on this page is read from the chain and still works.
        </p>
      )}

      {rows && rows.length === 0 && (
        <p className="empty">No coin currently clears the bar below.</p>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="yb-table">
            <div className="yb-row head">
              <span>Coin</span>
              <span>Per $1,000</span>
              <span>24h pot</span>
              <span>Holders</span>
              <span>Trade fee</span>
              <span>Module</span>
              <span>Links</span>
            </div>
            {rows.map((y) => {
              const m = y.market;
              return (
                <div className="yb-row" key={m.pool}>
                  <span data-label="Coin" className="yb-coin">
                    {m.image && (
                      <img
                        className="coin"
                        src={`https://embercurve.fun${m.image}`}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <b>{m.symbol}</b>
                    <small className="muted">{m.quoteTicker}</small>
                  </span>
                  <span data-label="Per $1,000 / day" className="yb-rate">
                    {formatUsd(per1000(y) ?? 0)}
                  </span>
                  <span data-label="24h pot">{formatUsd(y.holders24hUsd)}</span>
                  <span data-label="Holders">{m.holders.toLocaleString()}</span>
                  <span data-label="Trade fee">
                    {(currentBps(m) / 100).toFixed(currentBps(m) % 100 ? 1 : 0)}%
                    {keepsFee(m) ? (
                      <small className="keeps" title="This fee survives graduation">
                        {' '}
                        kept
                      </small>
                    ) : m.graduated ? null : (
                      <small className="muted" title="Drops to 1% when the coin graduates">
                        {' '}
                        &rarr; 1%
                      </small>
                    )}
                  </span>
                  <span data-label="Module" className="muted">
                    {MODE_LABEL[m.mode] ?? m.mode}
                  </span>
                  <span data-label="Links" className="yb-links">
                    <a href={SOLSCAN_ACCOUNT(m.mint)} target="_blank" rel="noreferrer" title="Mint on Solscan">
                      mint
                    </a>
                    <a href={SOLSCAN_ACCOUNT(m.pool)} target="_blank" rel="noreferrer" title="Pool on Solscan">
                      pool
                    </a>
                    <a href={`https://embercurve.fun${m.route}`} target="_blank" rel="noreferrer" title="On Ember">
                      ember
                    </a>
                  </span>
                </div>
              );
            })}
          </div>

          <p className="fine">
            Needs {FLOOR.holders}+ holders, ${(FLOOR.marketCapUsd / 1000).toFixed(0)}k+ cap and{' '}
            {FLOOR.trades24h}+ trades to be listed. Your own share differs &mdash; Diamond Hands
            weights it 1&times;&ndash;3&times; by hold time. Paste a wallet for what it was
            actually paid.
          </p>
        </>
      )}
    </section>
  );
}
