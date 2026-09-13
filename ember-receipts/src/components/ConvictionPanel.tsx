import { useEffect, useState } from 'react';
import { SOLSCAN_TX } from '../lib/constants';
import { formatUsd, humanSpan } from '../lib/format';
import {
  fetchPerp,
  harvestProgress,
  hasConviction,
  liqDistancePct,
  type Perp,
  type PerpEvent,
} from '../lib/conviction';

const EVENT_LABEL: Record<string, string> = {
  open: 'Opened',
  harvest: 'Take-profit',
  topup: 'Top-up',
  liquidated: 'Liquidated',
};

function eventLabel(event: PerpEvent): string {
  if (event.type === 'topup' && event.underwater) return 'Collateral only';
  return EVENT_LABEL[event.type] ?? event.type;
}

/**
 * What a coin's Conviction position is doing right now. Rendered only for coins
 * that have the module configured; everything shown is Ember's published state.
 */
export function ConvictionPanel({ pool, symbol }: { pool: string; symbol: string | null }) {
  const [perp, setPerp] = useState<Perp | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    setPerp(null);
    const load = () =>
      fetchPerp(pool).then((next) => {
        if (!live) return;
        setPerp(next);
        setLoaded(true);
      });
    load();
    // Ember's own client polls this every 15s; a position moves with the mark.
    const timer = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [pool]);

  if (!loaded || !hasConviction(perp)) return null;

  const ticker = symbol ?? 'this coin';
  const position = perp.position;
  const now = Math.floor(Date.now() / 1000);

  return (
    <section className="conviction">
      <header className="conv-head">
        <h3>
          <span aria-hidden="true">🎯</span> Conviction
        </h3>
        <span className={perp.side === 'long' ? 'conv-side up' : 'conv-side down'}>
          {perp.side === 'long' ? 'Long' : 'Short'} {perp.market} · {perp.lev}&times;
        </span>
        {perp.paper && <span className="badge warn">paper</span>}
      </header>

      <p className="conv-lede">
        {perp.convictionBps / 100}% of the creator side of every {ticker} fee becomes collateral on
        an isolated {perp.side} on {perp.market} at {perp.lev}&times;. Profit is harvested every
        +{perp.policy.harvestStepPct}% and split{' '}
        {Math.round(perp.policy.profitSplit.holders * 100)}% to holders ·{' '}
        {Math.round(perp.policy.profitSplit.burn * 100)}% {ticker} burn ·{' '}
        {Math.round(perp.policy.profitSplit.ember * 100)}% $EMBER burn.
      </p>

      {position ? (
        <>
          <div className="conv-figures">
            <div>
              <span className="label">Unrealized</span>
              <strong className={position.pnl >= 0 ? 'up big' : 'down big'}>
                {position.pnl >= 0 ? '+' : ''}
                {formatUsd(position.pnl)}
                <small>
                  {position.pnlPct >= 0 ? '+' : ''}
                  {position.pnlPct.toFixed(1)}%
                </small>
              </strong>
            </div>
            <div>
              <span className="label">Collateral</span>
              <strong>{formatUsd(position.collateral)}</strong>
            </div>
            <div>
              <span className="label">Notional</span>
              <strong>{formatUsd(position.notional)}</strong>
            </div>
          </div>

          <dl className="conv-rows">
            <div>
              <dt>Entry &rarr; mark</dt>
              <dd>
                {formatUsd(position.entry)} &rarr; {formatUsd(perp.mark)}
              </dd>
            </div>
            <div>
              <dt>Liquidation</dt>
              <dd>
                {formatUsd(position.liq)}{' '}
                <small className="muted">
                  · {liqDistancePct(position, perp.mark).toFixed(0)}% away
                </small>
              </dd>
            </div>
            <div>
              <dt>Next take-profit</dt>
              <dd>
                at {formatUsd(position.nextHarvestAt)} unrealized{' '}
                <small className="muted">
                  · closes {perp.policy.harvestClosePct}%, pays holders
                </small>
              </dd>
            </div>
          </dl>

          <div
            className="conv-bar"
            role="img"
            aria-label={`${Math.round(harvestProgress(position) * 100)}% of the way to the next take-profit`}
          >
            <span style={{ width: `${harvestProgress(position) * 100}%` }} />
          </div>
        </>
      ) : (
        <p className="conv-waiting">
          No position open yet — {formatUsd(perp.reserveUsd)} of collateral accrued, and it opens at{' '}
          {formatUsd(perp.policy.openUsd)}.
        </p>
      )}

      <dl className="conv-rows">
        <div>
          <dt>{perp.paper ? 'Simulated profit to holders' : 'Paid to holders from profit'}</dt>
          <dd className={perp.paper ? 'muted' : 'up'}>
            {formatUsd(perp.paidHoldersUsd)}{' '}
            <small className="muted">
              · {perp.harvests} harvest{perp.harvests === 1 ? '' : 's'}
            </small>
          </dd>
        </div>
        <div>
          <dt>Bought back &amp; burned</dt>
          <dd>
            🔥 {formatUsd(perp.burnUsd)} {ticker} · {formatUsd(perp.emberUsd)} EMBER
          </dd>
        </div>
        {perp.liquidations > 0 && (
          <div>
            <dt>Liquidations</dt>
            <dd className="down">{perp.liquidations}</dd>
          </div>
        )}
      </dl>

      {perp.history.length > 0 && (
        <ul className="conv-history">
          {perp.history.slice(0, 6).map((event, i) => (
            <li key={`${event.at}-${i}`}>
              <span>
                {eventLabel(event)} · {humanSpan(event.at, now)} ago
              </span>
              <b>
                {event.type === 'harvest' && event.split
                  ? `+${formatUsd(event.usd)} → holders ${formatUsd(event.split.holders)} · burn ${formatUsd(event.split.burn)} · EMBER ${formatUsd(event.split.ember)}`
                  : `${event.type === 'open' ? '' : '+'}${formatUsd(event.usd)}`}
                {event.sig && (
                  <>
                    {' '}
                    <a href={SOLSCAN_TX(event.sig)} target="_blank" rel="noreferrer">
                      ↗
                    </a>
                  </>
                )}
              </b>
            </li>
          ))}
        </ul>
      )}

      {perp.paper ? (
        <p className="fine">
          Paper mode: the venue is not deployed, so this position is simulated at live prices. The
          collateral is real and is being kept for the coin, but a simulated profit has not been
          paid to anyone.
        </p>
      ) : perp.explorer ? (
        <a className="btn-link" href={perp.explorer} target="_blank" rel="noreferrer">
          View the sub-account ↗
        </a>
      ) : null}

      <p className="fine">Ember&rsquo;s published state, not read from the chain here.</p>
    </section>
  );
}
