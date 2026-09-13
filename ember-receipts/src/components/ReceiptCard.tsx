import { forwardRef } from 'react';
import { EMBER_KEEPER } from '../lib/constants';
import { formatAmount, formatDate, shortAddress } from '../lib/format';
import type { Receipt, TokenTotal } from '../lib/scan';
import type { TokenMeta } from '../lib/tokens';

interface Props {
  receipt: Receipt;
  tokens: Map<string, TokenMeta>;
  /** Hero token artwork, already inlined as a data URI so PNG export works. */
  logo?: string | null;
}

const W = 1200;
const H = 630;

/** SF Pro where available, matching the app shell. */
const SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", "Segoe UI", Roboto, system-ui, sans-serif';
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';

/**
 * The shareable card, drawn as SVG so it exports to PNG with no dependency.
 * The hero is the largest single token total — that is the number people post —
 * with the remaining tokens listed underneath.
 */
export const ReceiptCard = forwardRef<SVGSVGElement, Props>(function ReceiptCard(
  { receipt, tokens, logo },
  ref,
) {
  const sym = (t: TokenTotal) => tokens.get(t.mint)?.symbol ?? '—';
  const ranked = [...receipt.byToken].sort((a, b) => b.count - a.count);
  const hero = ranked[0];
  const rest = ranked.slice(1, 4);
  const since = receipt.firstAt ? formatDate(receipt.firstAt) : '—';
  const heroText = hero ? formatAmount(hero.total) : '0';
  // Long numbers get a smaller face as well as a width clamp, so the ticker
  // beneath never collides with them.
  const heroSize = heroText.length > 11 ? 104 : heroText.length > 8 ? 118 : 132;

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
        <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#1a0d04" />
          <stop offset="0.55" stopColor="#0a0705" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <linearGradient id="flame" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff6a00" />
          <stop offset="1" stopColor="#ffb300" />
        </linearGradient>
        <radialGradient id="glow" cx="0.16" cy="0.06" r="0.85">
          <stop offset="0" stopColor="#ff7a1a" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="url(#bg)" />
      <rect width={W} height={H} fill="url(#glow)" />
      <rect width={W} height="5" fill="url(#flame)" />

      {/* masthead */}
      {logo && (
        <>
          <clipPath id="logoClip">
            <circle cx="92" cy="86" r="24" />
          </clipPath>
          <image href={logo} x="68" y="62" width="48" height="48" clipPath="url(#logoClip)" preserveAspectRatio="xMidYMid slice" />
          <circle cx="92" cy="86" r="24" fill="none" stroke="#ffffff" strokeOpacity="0.18" />
        </>
      )}
      <text x={logo ? 132 : 68} y="96" fill="#ff8a3d" fontSize="23" fontWeight="640" letterSpacing="4.2" fontFamily={SANS}>
        EMBER RECEIPT
      </text>
      <text x={W - 68} y="96" fill="#6e6e73" fontSize="23" textAnchor="end" fontFamily={MONO}>
        {shortAddress(receipt.wallet, 6)}
      </text>

      {/* hero: the number people post */}
      <text
        x="68"
        y="252"
        fill="#ffffff"
        fontSize={heroSize}
        fontWeight="700"
        letterSpacing="-5"
        fontFamily={SANS}
        textLength={heroText.length > 11 ? 660 : undefined}
        lengthAdjust="spacingAndGlyphs"
      >
        {heroText}
      </text>
      <text x="68" y="306" fill="#ffb300" fontSize="40" fontWeight="620" letterSpacing="-0.6" fontFamily={SANS}>
        {hero ? sym(hero) : ''}
        <tspan fill="#a1a1a6" fontSize="25" fontWeight="400" letterSpacing="0">
          {'  '}earned as a holder
        </tspan>
      </text>
      <text x="68" y="348" fill="#6e6e73" fontSize="24" fontFamily={SANS}>
        {receipt.payouts.length.toLocaleString()} payouts since {since}
      </text>

      {/* other tokens */}
      {rest.map((t, i) => (
        <g key={t.mint} transform={`translate(68, ${420 + i * 60})`}>
          <rect x="0" y="-32" width="640" height="50" rx="14" fill="#ffffff" fillOpacity="0.05" />
          <text x="20" y="3" fill="#ffffff" fontSize="26" fontWeight="600" fontFamily={SANS}>
            {formatAmount(t.total)}
          </text>
          <text x="200" y="3" fill="#a1a1a6" fontSize="24" fontFamily={SANS}>
            {sym(t)}
          </text>
          <text x="620" y="3" fill="#6e6e73" fontSize="21" textAnchor="end" fontFamily={SANS}>
            {t.count} payout{t.count === 1 ? '' : 's'}
          </text>
        </g>
      ))}

      {/* right rail */}
      <g transform="translate(790, 372)">
        <text x="0" y="0" fill="#6e6e73" fontSize="19" letterSpacing="2.4" fontFamily={SANS}>
          BIGGEST SINGLE
        </text>
        <text x="0" y="44" fill="#f5f5f7" fontSize="34" fontWeight="600" letterSpacing="-0.8" fontFamily={SANS}>
          {receipt.biggest
            ? `${formatAmount(receipt.biggest.amount)} ${tokens.get(receipt.biggest.mint)?.symbol ?? ''}`
            : '—'}
        </text>
        <text x="0" y="104" fill="#6e6e73" fontSize="19" letterSpacing="2.4" fontFamily={SANS}>
          TOKENS PAID IN
        </text>
        <text x="0" y="148" fill="#f5f5f7" fontSize="34" fontWeight="600" letterSpacing="-0.8" fontFamily={SANS}>
          {receipt.byToken.length}
        </text>
      </g>

      <line x1="68" y1={H - 88} x2={W - 68} y2={H - 88} stroke="#ffffff" strokeOpacity="0.11" />
      <text x="68" y={H - 46} fill="#6e6e73" fontSize="20" fontFamily={MONO}>
        verified on-chain · keeper {shortAddress(EMBER_KEEPER.toBase58(), 4)}
      </text>
      {/* built by — X mark drawn as a path so the PNG export needs no font or image */}
      <g transform={`translate(${W - 68}, ${H - 52})`}>
        <text x="0" y="6" fill="#f5f5f7" fontSize="20" textAnchor="end" fontWeight="600" fontFamily={SANS}>
          @eienel_eth
        </text>
        <text x={-166} y="6" fill="#6e6e73" fontSize="20" textAnchor="end" fontFamily={SANS}>
          built by
        </text>
        <g transform="translate(-156, -8) scale(0.0155)">
          <path
            fill="#f5f5f7"
            d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z"
          />
        </g>
      </g>
    </svg>
  );
});
