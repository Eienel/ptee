import { SOLSCAN_ACCOUNT, SOLSCAN_TX } from '../lib/constants';
import { formatAmount, formatDate, shortAddress } from '../lib/format';
import type { TokenView } from '../lib/token';

const timeOnly = (unix: number) =>
  new Date(unix * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

export function TokenPanel({ token }: { token: TokenView }) {
  const progress = Math.min(100, token.progressPct);

  return (
    <section className="token">
      <div className="token-head">
        <div className="token-id">
          {token.image && <img className="coin lg" src={token.image} alt="" />}
          <div>
          <h2>
            {token.symbol ?? 'Unknown token'}
            {token.name && token.name !== token.symbol && <small>{token.name}</small>}
          </h2>
          <a className="addr" href={SOLSCAN_ACCOUNT(token.mint)} target="_blank" rel="noreferrer">
            {shortAddress(token.mint, 6)}
          </a>
          </div>
        </div>
        <span className={token.launchedOnEmber ? 'badge ok' : 'badge warn'}>
          {token.launchedOnEmber ? 'Launched on Ember' : 'Not an Ember launch'}
        </span>
      </div>

      {!token.launchedOnEmber && (
        <p className="alert">
          This token has a Meteora bonding curve, but its fees are claimed by{' '}
          <a href={SOLSCAN_ACCOUNT(token.feeClaimer)} target="_blank" rel="noreferrer">
            {shortAddress(token.feeClaimer, 6)}
          </a>
          , not Ember&rsquo;s keeper. Ember&rsquo;s payout modules do not apply to it.
        </p>
      )}

      <div className="curve">
        <div className="curve-top">
          <span>
            {formatAmount(token.quoteReserve)} / {formatAmount(token.migrationThreshold)}{' '}
            {token.quoteSymbol ?? ''}
          </span>
          <strong>{token.progressPct.toFixed(1)}%</strong>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className="fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="curve-foot">
          {token.isMigrated
            ? 'Graduated to DAMM v2'
            : `On the bonding curve · migrates at ${formatAmount(token.migrationThreshold)} ${token.quoteSymbol ?? ''}`}
        </div>
      </div>

      <div className="token-stats">
        <div><span>Paired with</span><strong>{token.quoteSymbol ?? shortAddress(token.quoteMint)}</strong></div>
        <div><span>Launched</span><strong>{token.createdAt ? formatDate(token.createdAt) : 'unknown'}</strong></div>
        <div><span>Migration flag</span><strong>{token.migrationProgress}</strong></div>
      </div>

      <h3>
        Fee activity
        <small>from Ember&rsquo;s ledger</small>
      </h3>

      {token.feeActivity.length === 0 ? (
        <p className="empty">
          No activity in Ember&rsquo;s published window
          {token.feeActivityWindow &&
            ` (${timeOnly(token.feeActivityWindow.from)}–${timeOnly(token.feeActivityWindow.to)})`}
          . That window is about an hour, so this does not mean the pool has never paid out.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th className="num">Amount</th>
              <th>Token</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {token.feeActivity.map((e, i) => (
              <tr key={`${e.signature ?? 'none'}-${i}`}>
                <td data-label="Event">{e.kind}</td>
                <td className="num gain" data-label="Amount">{e.amount > 0 ? formatAmount(e.amount, 6) : '—'}</td>
                <td data-label="Token">{e.ticker}</td>
                <td data-label="Proof">
                  {e.signature ? (
                    <a href={SOLSCAN_TX(e.signature)} target="_blank" rel="noreferrer">
                      {e.signature.slice(0, 8)}…
                    </a>
                  ) : (
                    <span className="muted">no signature</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="fine">
        Curve read on-chain. Fee activity is Ember&rsquo;s published ledger, each row linked.
      </p>
    </section>
  );
}
