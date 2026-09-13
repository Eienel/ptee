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
        Ember routes part of every trade&rsquo;s fee back to the people holding the coin. This is
        what each one actually paid out yesterday, per $1,000 of stake &mdash; measured, not
        projected.
      </p>
      <p className="yb-lede">
        Watch the trade fee. Until Ember 1.23 every coin graduated into a 1% pool whatever it
        launched with, so a 3% coin lost two thirds of the engine that pays holders the day it
        succeeded. Coins launched from 13 Sep keep their own rate through graduation; ones that
        graduated earlier are stuck at 1%, because the config cannot be changed.
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
              <span>Per $1,000 held</span>
              <span>Paid to holders</span>
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
                    {m.image && <img className="coin" src={`https://embercurve.fun${m.image}`} alt="" loading="lazy" />}
                    <b>{m.symbol}</b>
                    <small className="muted">{m.quoteTicker}</small>
                  </span>
                  <span data-label="Per $1,000 held" className="yb-rate">
                    {formatUsd(per1000(y) ?? 0)}
                    <small className="muted"> /day</small>
                  </span>
                  <span data-label="Paid to holders">{formatUsd(y.holders24hUsd)}</span>
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
            Listed only if a coin has at least {FLOOR.holders} holders, a{' '}
            {formatUsd(FLOOR.marketCapUsd)} market cap and {FLOOR.trades24h} trades in 24 hours.
            Without that bar the top of this list is three-holder coins with $3,000 market caps
            showing implausible rates &mdash; the shape of wash trading rather than income.
          </p>
          <p className="fine">
            <strong>Your own share will not match this.</strong> Diamond Hands weights a holder by
            how long they have held &mdash; 1&times; on day one, 1.5&times; after a day,
            2&times; after three, 3&times; after a week, and selling any amount or moving wallet
            resets it to 1&times;. A payout round also pays at most 300 wallets, so holders
            collect on a rotation. Checked against a real wallet, a flat share of the pot was out
            by 1.85&times;. Paste that wallet above for what it was actually paid.
          </p>
        </>
      )}
    </section>
  );
}
