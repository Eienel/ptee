import { useState } from 'react';
import { SOLSCAN_TX } from '../lib/constants';
import { formatAmount, formatDate } from '../lib/format';
import type { Receipt } from '../lib/scan';
import { formatUsd } from '../lib/format';
import { valueOf, type TokenPrice } from '../lib/prices';
import type { TokenMeta } from '../lib/tokens';

const PAGE = 25;

interface Props {
  receipt: Receipt;
  tokens: Map<string, TokenMeta>;
  /** Payout token mint -> held coins paired against it. */
  attribution: Map<string, string[]>;
  prices: Map<string, TokenPrice>;
}

export function PayoutList({ receipt, tokens, attribution, prices }: Props) {
  const value = valueOf(receipt.byToken, prices);
  const [shown, setShown] = useState(PAGE);
  const symbolOf = (mint: string) => tokens.get(mint)?.symbol ?? `${mint.slice(0, 4)}…`;

  /** Ember pays in the coin's pair, so the source is the held coin quoted in it. */
  function sourceLabel(payoutMint: string): string | null {
    const candidates = attribution.get(payoutMint);
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return `likely from ${symbolOf(candidates[0])}`;
    return `likely from ${candidates.slice(0, 3).map(symbolOf).join(', ')}${candidates.length > 3 ? '…' : ''}`;
  }

  return (
    <section className="payouts">
      <h2>
        Every payout <span>{receipt.payouts.length.toLocaleString()} total</span>
      </h2>

      {value.priced > 0 && (
        <p className="worth">
          <strong>{formatUsd(value.usd)}</strong> at today&rsquo;s prices
          {value.unpriced.length > 0 && ` · ${value.unpriced.length} token${value.unpriced.length === 1 ? '' : 's'} had no price`}
          {value.thin && ' · some prices sit on thin liquidity'}
          <small>
            This is what the tokens are worth <em>now</em>, not what they were worth when they
            landed. Ember&rsquo;s own price moved more than 70% in a day while this was built, so
            the two can differ a lot. The token amounts above are the exact, verifiable figures.
          </small>
        </p>
      )}

      {attribution.size > 0 && (
        <p className="inferred">
          Ember pays holders in whatever their coin is paired against, so a payout can be traced
          back to the coins you hold that are quoted in it. Those source coins are{' '}
          <strong>inferred</strong> — unlike the amounts, they are not proven by a signature, and
          a coin you have since sold cannot be matched at all.
        </p>
      )}

      <div className="totals">
        {receipt.byToken.map((t) => (
          <div key={t.mint} className="total">
            <span className="amount">{formatAmount(t.total)}</span>
            <span className="sym">
              {tokens.get(t.mint)?.image && (
                <img className="coin" src={tokens.get(t.mint)!.image!} alt="" loading="lazy" />
              )}
              {tokens.get(t.mint)?.symbol ?? '—'}
            </span>
            {prices.get(t.mint) && (
              <span className="usd">
                {formatUsd(t.total * prices.get(t.mint)!.usd)}
                {prices.get(t.mint)!.thin && <span className="thin-flag" title="Thin liquidity behind this price">thin</span>}
              </span>
            )}
            <small>{t.count} payouts</small>
            {sourceLabel(t.mint) && <small className="source">{sourceLabel(t.mint)}</small>}
          </div>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="num">Amount</th>
            <th>Token</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {receipt.payouts.slice(0, shown).map((p) => (
            <tr key={`${p.signature}-${p.mint}`}>
              <td data-label="Date">{p.at ? formatDate(p.at) : '—'}</td>
              <td className="num gain" data-label="Amount">{formatAmount(p.amount, 6)}</td>
              <td data-label="Token">{tokens.get(p.mint)?.symbol ?? '—'}</td>
              <td data-label="Proof">
                <a href={SOLSCAN_TX(p.signature)} target="_blank" rel="noreferrer">
                  {p.signature.slice(0, 8)}…
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {shown < receipt.payouts.length && (
        <button onClick={() => setShown((s) => s + PAGE * 4)}>
          Show more ({receipt.payouts.length - shown} left)
        </button>
      )}
    </section>
  );
}
