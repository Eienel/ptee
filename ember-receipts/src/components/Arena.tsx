import { useEffect, useState } from 'react';
import { formatUsd } from '../lib/format';
import { fetchArena, fetchMarkets, type Arena as ArenaData, type Markets } from '../lib/conviction';

const KIND_MARK: Record<string, string> = {
  crypto: '₿',
  stock: '📈',
  commodity: '🥇',
  meme: '🐸',
};

const alive = (seconds: number) =>
  seconds >= 86400 ? `${Math.floor(seconds / 86400)}d` : `${Math.max(1, Math.floor(seconds / 3600))}h`;

function streak(coin: ArenaData['coins'][number]): string {
  if (coin.harvests) return `${'🔥'.repeat(Math.min(3, coin.harvests))} ${coin.harvests} harvests`;
  if (coin.underwater) return 'underwater · topping up';
  if (coin.liquidations) return 'rebuilding after liquidation';
  return 'opened recently';
}

/**
 * Every coin currently running a Conviction position, worst case included.
 * Ember's module is shipped but no coin has switched it on yet, so the honest
 * default is to say that plainly rather than render an empty table.
 */
export function Arena() {
  const [arena, setArena] = useState<ArenaData | null>(null);
  const [markets, setMarkets] = useState<Markets | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      Promise.all([fetchArena(), fetchMarkets()]).then(([a, m]) => {
        if (!live) return;
        setArena(a);
        setMarkets(m);
        setLoaded(true);
      });
    load();
    const timer = setInterval(load, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  if (!loaded) return null;

  const coins = arena?.coins ?? [];
  const paperOnly = arena ? !arena.live : true;

  return (
    <section className="arena">
      <header className="arena-head">
        <h2>
          <span aria-hidden="true">🎯</span> Conviction
        </h2>
        {paperOnly && <span className="badge warn">paper mode</span>}
      </header>

      <p className="arena-lede">
        A coin can point part of its fees at a leveraged position. Profit is harvested in steps and
        split between holders, a buy-back burn of the coin, and an $EMBER burn — and a position on
        the wrong side of a big move is liquidated.
      </p>

      {coins.length === 0 ? (
        <div className="arena-empty">
          <p>
            No coin has a Conviction position open yet.
            {markets && (
              <>
                {' '}
                The module is live on Ember with {markets.markets.length} markets and{' '}
                {markets.tiers.join('×, ')}× leverage tiers
                {markets.live ? '' : `, and the ${arena?.venue ?? markets.venue} venue is not deployed yet`}.
              </>
            )}
          </p>
          {markets && (
            <ul className="market-chips">
              {markets.markets.map((m) => (
                <li key={m.symbol} title={`${m.name} · up to ${m.maxLev}×`}>
                  <span aria-hidden="true">{KIND_MARK[m.kind] ?? ''}</span> {m.symbol}
                </li>
              ))}
            </ul>
          )}
          <p className="fine">
            This updates on its own. When a coin opens one, it shows up here.
          </p>
        </div>
      ) : (
        <div className="arena-table" role="table">
          <div className="arena-row head" role="row">
            <span>Coin</span>
            <span>Position</span>
            <span>Alive</span>
            <span>Paid to holders</span>
            <span>Unrealized</span>
            <span>Streak</span>
          </div>
          {coins.map((coin) => (
            <a
              key={coin.pool}
              className="arena-row"
              role="row"
              href={`https://embercurve.fun${coin.route}`}
              target="_blank"
              rel="noreferrer"
            >
              <span data-label="Coin" className="arena-coin">
                {coin.image && <img className="coin" src={coin.image} alt="" />}
                <b>{coin.symbol}</b>
                <small className="muted">{coin.quoteTicker}</small>
              </span>
              <span data-label="Position" className={coin.side === 'long' ? 'up' : 'down'}>
                {coin.side === 'long' ? 'Long' : 'Short'} {coin.market} · {coin.lev}&times;
                {coin.paper && <small className="muted"> · paper</small>}
              </span>
              <span data-label="Alive">{alive(coin.aliveS)}</span>
              <span data-label="Paid to holders" className={coin.paper ? 'muted' : 'up'}>
                {coin.paidHoldersUsd ? formatUsd(coin.paidHoldersUsd) : '—'}
                {coin.paper && coin.paidHoldersUsd ? <small> (simulated)</small> : null}
              </span>
              <span
                data-label="Unrealized"
                className={coin.open ? (coin.pnl >= 0 ? 'up' : 'down') : 'muted'}
              >
                {coin.open
                  ? `${coin.pnl >= 0 ? '+' : ''}${formatUsd(coin.pnl)} · ${coin.pnlPct >= 0 ? '+' : ''}${coin.pnlPct.toFixed(0)}%`
                  : `opens later · ${formatUsd(coin.reserveUsd)} accrued`}
              </span>
              <span data-label="Streak">{streak(coin)}</span>
            </a>
          ))}
        </div>
      )}

      {paperOnly && coins.length > 0 && (
        <p className="fine">
          Positions are simulated at live prices until the venue is deployed. A simulated profit has
          not been paid to anyone.
        </p>
      )}
    </section>
  );
}
