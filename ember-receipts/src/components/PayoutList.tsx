import { useState } from 'react';
import { SOLSCAN_ACCOUNT, SOLSCAN_TX } from '../lib/constants';
import { formatAmount, formatDate } from '../lib/format';
import type { Receipt } from '../lib/scan';
import { formatUsd } from '../lib/format';
import { valueOf, type TokenPrice } from '../lib/prices';
import type { TokenMeta } from '../lib/tokens';
import { kindEmoji, kindLabel, type Ledger } from '../lib/ledger';

const PAGE = 25;

interface Props {
  receipt: Receipt;
  tokens: Map<string, TokenMeta>;
  /** Payout token mint -> held coins paired against it. */
  attribution: Map<string, string[]>;
  prices: Map<string, TokenPrice>;
  /** Ember's labels, joined by signature. Absent until they load, or on failure. */
  ledger: Ledger | null;
}

export function PayoutList({ receipt, tokens, attribution, prices, ledger }: Props) {
  // Ember names the module and the coin outright; the pairing inference below
  // is only the fallback for payouts its ledger does not cover.
  const labels = new Map(
    (ledger?.labelled ?? [])
      .filter((row) => row.kind != null)
      .map((row) => [row.payout.signature, row] as const),
  );
  const value = valueOf(receipt.byToken, prices);
  const [shown, setShown] = useState(PAGE);
  const symbolOf = (mint: string) => tokens.get(mint)?.symbol ?? `${mint.slice(0, 4)}…`;

  /** Coins Ember names as the payer of this token, as fact rather than inference. */
  function knownSources(payoutMint: string): string[] {
    const names = new Set<string>();
    for (const row of labels.values()) {
      if (row.payout.mint === payoutMint && row.source) names.add(row.source);
    }
    return [...names];
  }

  /** Ember pays in the coin's pair, so the source is the held coin quoted in it. */
  function sourceLabel(payoutMint: string): string | null {
    const known = knownSources(payoutMint);
    if (known.length > 0) {
      return `from ${known.slice(0, 3).join(', ')}${known.length > 3 ? '…' : ''}`;
    }
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

      {(receipt.shapes.shared > 0 || receipt.shapes.solo > 0) && (
        <p className="shapes">
          <span>
            <strong>{receipt.shapes.shared}</strong> shared rounds
          </span>
          <span>
            <strong>{receipt.shapes.solo}</strong> sent only to you
          </span>
          <small>Ember&rsquo;s module labels are not written on-chain; recipient count is.</small>
        </p>
      )}

      {value.priced > 0 && (
        <p className="worth">
          <strong>{formatUsd(value.usd)}</strong> at today&rsquo;s prices
          {value.unpriced.length > 0 && ` · ${value.unpriced.length} token${value.unpriced.length === 1 ? '' : 's'} had no price`}
          {value.thin && ' · some prices sit on thin liquidity'}
          <small>Worth <em>now</em>, not at payout. The token amounts are the exact figures.</small>
        </p>
      )}

      {attribution.size > 0 && labels.size === 0 && (
        <p className="inferred">
          Source coins are <strong>inferred</strong> from what you hold, not proven by a
          signature. A coin you have sold cannot be matched.
        </p>
      )}

      <div className="totals">
        {receipt.byToken.map((t) => (
          <div key={t.mint} className="total">
            <span className="amount">{formatAmount(t.total)}</span>
            <a className="sym" href={SOLSCAN_ACCOUNT(t.mint)} target="_blank" rel="noreferrer">
              {tokens.get(t.mint)?.image && (
                <img className="coin" src={tokens.get(t.mint)!.image!} alt="" loading="lazy" />
              )}
              {tokens.get(t.mint)?.symbol ?? '—'}
            </a>
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
            <th>For</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {receipt.payouts.slice(0, shown).map((p) => (
            <tr key={`${p.signature}-${p.mint}`}>
              <td data-label="Date">{p.at ? formatDate(p.at) : '—'}</td>
              <td className="num gain" data-label="Amount">{formatAmount(p.amount, 6)}</td>
              <td data-label="Token">{tokens.get(p.mint)?.symbol ?? '—'}</td>
              <td data-label="For">
                {labels.get(p.signature)?.kind ? (
                  <>
                    <span aria-hidden="true">{kindEmoji(labels.get(p.signature)!.kind!)}</span>{' '}
                    {kindLabel(labels.get(p.signature)!.kind!)}
                    {labels.get(p.signature)!.source && (
                      <small className="muted"> · {labels.get(p.signature)!.source}</small>
                    )}
                  </>
                ) : (
                  <span className={p.shape === 'shared' ? 'pill shared' : 'pill solo'}>
                    {p.shape === 'shared' ? `1 of ${p.recipients}` : 'solo'}
                  </span>
                )}
              </td>
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
