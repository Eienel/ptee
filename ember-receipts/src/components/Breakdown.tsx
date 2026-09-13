import { formatAmount, formatUsd } from '../lib/format';
import { kindEmoji, kindLabel, type Ledger } from '../lib/ledger';
import { valueOf, type TokenPrice } from '../lib/prices';
import type { TokenMeta } from '../lib/tokens';

interface Props {
  ledger: Ledger | null;
  tokens: Map<string, TokenMeta>;
  prices: Map<string, TokenPrice>;
}

/**
 * What each payout was for, and what it was worth when it landed.
 *
 * Both answers come from Ember's per-wallet ledger. The chain shows a keeper
 * transfer and nothing about which module sent it, and pricing a payout at the
 * moment it happened needs historical data this app does not carry. Amounts
 * stay ours throughout; only the labels and the payout-time price are Ember's.
 */
export function Breakdown({ ledger, tokens, prices }: Props) {
  if (!ledger || ledger.byKind.length === 0) return null;

  const symbolOf = (mint: string) => tokens.get(mint)?.symbol ?? `${mint.slice(0, 4)}…`;
  // Both sides must cover the same payouts. Ember labels a subset of what the
  // scan found, so "worth today" here prices only the labelled ones — putting
  // the receipt's full total against a partial payout-time total would invent
  // a gain out of the difference in coverage.
  const matched = [...ledger.matchedByMint].map(([mint, total]) => ({ mint, total }));
  const value = valueOf(matched, prices);
  const today = value.priced > 0 && value.unpriced.length === 0 ? value.usd : null;
  const then = ledger.usdAtPayoutComplete ? ledger.usdAtPayout : null;
  const change = then != null && then > 0 && today != null ? (today / then - 1) * 100 : null;
  const partial = ledger.unmatched > 0;

  return (
    <section className="breakdown">
      <h2>
        What it was for <span>{ledger.matched.toLocaleString()} labelled</span>
      </h2>

      {then != null && (
        <div className="then-now">
          {partial && (
            <p className="then-now-scope">
              Across the {ledger.matched} labelled payout{ledger.matched === 1 ? '' : 's'}, not the
              full receipt.
            </p>
          )}
          <div>
            <span className="label">Worth when paid</span>
            <strong>{formatUsd(then)}</strong>
          </div>
          <div>
            <span className="label">Worth today</span>
            <strong>{today != null ? formatUsd(today) : '—'}</strong>
          </div>
          {change != null && (
            <div>
              <span className="label">Since</span>
              <strong className={change >= 0 ? 'up' : 'down'}>
                {change >= 0 ? '+' : ''}
                {change.toFixed(1)}%
              </strong>
            </div>
          )}
        </div>
      )}

      <ul className="kinds">
        {ledger.byKind.map((kind) => (
          <li key={kind.kind}>
            <span className="kind-name">
              <span aria-hidden="true">{kindEmoji(kind.kind)}</span> {kindLabel(kind.kind)}
            </span>
            <span className="kind-amount">
              {[...kind.byMint]
                .sort((a, b) => b[1] - a[1])
                .map(([mint, amount]) => `${formatAmount(amount)} ${symbolOf(mint)}`)
                .join(' · ')}
            </span>
            <span className="kind-count">
              {kind.count} payout{kind.count === 1 ? '' : 's'}
              {kind.usdAtPayout > 0 && (
                <small className="muted"> · {formatUsd(kind.usdAtPayout)} when paid</small>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="fine">
        Labels from Ember&rsquo;s ledger, joined by signature. Amounts counted from the chain.
        {ledger.unmatched > 0 && (
          <> {ledger.unmatched} not in their ledger, counted but unlabelled.</>
        )}
        {ledger.missedByScan > 0 && (
          <> They list {ledger.missedByScan} this scan did not see.</>
        )}
      </p>
    </section>
  );
}
