import { forwardRef } from 'react';
import { EMBER_KEEPER } from '../lib/constants';
import { formatAmount, formatDate, humanSpan, shortAddress } from '../lib/format';
import type { Receipt, TokenTotal } from '../lib/scan';

interface Props {
  receipt: Receipt;
  symbols: Map<string, string>;
}

const W = 1200;
const H = 630;

/**
 * The shareable card, drawn as SVG so it can be exported to PNG with no
 * dependency and stays crisp at any size.
 */
export const ReceiptCard = forwardRef<SVGSVGElement, Props>(function ReceiptCard(
  { receipt, symbols },
  ref,
) {
  const top: TokenTotal[] = receipt.byToken.slice(0, 3);
  const sym = (t: TokenTotal) => symbols.get(t.mint) ?? '?';
  const since = receipt.firstAt ? formatDate(receipt.firstAt) : '—';
  const span =
    receipt.firstAt && receipt.lastAt ? humanSpan(receipt.firstAt, receipt.lastAt) : '—';

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="card-svg"
      role="img"
      aria-label={`Ember receipt for ${receipt.wallet}`}
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#140b06" />
          <stop offset="1" stopColor="#0a0a0c" />
        </linearGradient>
        <linearGradient id="flame" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff4d00" />
          <stop offset="1" stopColor="#ffb300" />
        </linearGradient>
        <radialGradient id="glow" cx="0.12" cy="0.1" r="0.7">
          <stop offset="0" stopColor="#ff6a00" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="url(#bg)" />
      <rect width={W} height={H} fill="url(#glow)" />
      <rect x="0" y="0" width={W} height="6" fill="url(#flame)" />

      <text x="64" y="92" fill="#ff8a3d" fontSize="26" fontWeight="700" letterSpacing="3"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        EMBER RECEIPT
      </text>
      <text x="64" y="140" fill="#6f7683" fontSize="24"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
        {shortAddress(receipt.wallet, 6)}
      </text>

      {/* Headline: how many payouts actually landed */}
      <text x="64" y="258" fill="#ffffff" fontSize="118" fontWeight="800"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        {receipt.payouts.length.toLocaleString()}
      </text>
      <text x="64" y="300" fill="#9aa3b0" fontSize="26"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        payouts received · earning for {span}
      </text>

      {/* Per-token totals */}
      {top.map((t, i) => (
        <g key={t.mint} transform={`translate(64, ${360 + i * 74})`}>
          <rect x="0" y="-34" width="700" height="58" rx="12" fill="#ffffff" fillOpacity="0.04" />
          <text x="22" y="6" fill="#ffb300" fontSize="30" fontWeight="700"
            fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
            {formatAmount(t.total)}
          </text>
          <text x={22 + Math.max(120, String(formatAmount(t.total)).length * 19)} y="6"
            fill="#e8ecf1" fontSize="26"
            fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
            {sym(t)}
          </text>
          <text x="600" y="6" fill="#6f7683" fontSize="22" textAnchor="end"
            fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
            {t.count} payout{t.count === 1 ? '' : 's'}
          </text>
        </g>
      ))}

      {receipt.byToken.length > 3 && (
        <text x="64" y={360 + 3 * 74 + 4} fill="#6f7683" fontSize="22"
          fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
          +{receipt.byToken.length - 3} more token{receipt.byToken.length - 3 === 1 ? '' : 's'}
        </text>
      )}

      <g transform="translate(820, 330)">
        <text x="0" y="0" fill="#6f7683" fontSize="20" letterSpacing="2"
          fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
          FIRST PAYOUT
        </text>
        <text x="0" y="40" fill="#e8ecf1" fontSize="30"
          fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
          {since}
        </text>
        <text x="0" y="110" fill="#6f7683" fontSize="20" letterSpacing="2"
          fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
          BIGGEST SINGLE
        </text>
        <text x="0" y="150" fill="#e8ecf1" fontSize="30"
          fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
          {receipt.biggest
            ? `${formatAmount(receipt.biggest.amount)} ${symbols.get(receipt.biggest.mint) ?? ''}`
            : '—'}
        </text>
      </g>

      <line x1="64" y1={H - 86} x2={W - 64} y2={H - 86} stroke="#ffffff" strokeOpacity="0.08" />
      <text x="64" y={H - 46} fill="#6f7683" fontSize="20"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
        verified on-chain · keeper {shortAddress(EMBER_KEEPER.toBase58(), 4)}
      </text>
      <text x={W - 64} y={H - 46} fill="#ff8a3d" fontSize="20" textAnchor="end"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        embercurve.fun
      </text>
      <text x={W - 64} y={H - 18} fill="#4d454b" fontSize="16" textAnchor="end"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        built by ANL
      </text>
    </svg>
  );
});
