import { useState } from 'react';
import { SOLSCAN_TX } from '../lib/constants';
import { formatAmount, formatDate } from '../lib/format';
import type { Receipt } from '../lib/scan';

const PAGE = 25;

export function PayoutList({ receipt, symbols }: { receipt: Receipt; symbols: Map<string, string> }) {
  const [shown, setShown] = useState(PAGE);

  return (
    <section className="payouts">
      <h2>
        Every payout <span>{receipt.payouts.length.toLocaleString()} total</span>
      </h2>

      <div className="totals">
        {receipt.byToken.map((t) => (
          <div key={t.mint} className="total">
            <span className="amount">{formatAmount(t.total)}</span>
            <span className="sym">{symbols.get(t.mint) ?? '—'}</span>
            <small>{t.count} payouts</small>
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
              <td data-label="Token">{symbols.get(p.mint) ?? '—'}</td>
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
