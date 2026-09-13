// src/components/ReceiptCard.tsx
import { forwardRef } from "react";

// src/lib/constants.ts
import { PublicKey } from "@solana/web3.js";
var EMBER_KEEPER = new PublicKey("GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp");
var EMBER_MINT = new PublicKey("5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6");
var MET_MINT = new PublicKey("METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL");
var TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
var METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// src/lib/format.ts
function formatAmount(value, maxDecimals = 4) {
  if (value === 0) return "0";
  if (value < 1e-4) return value.toExponential(2);
  if (value >= 1e3) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return value.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}
function formatUsd(value) {
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  if (value >= 1e5)
    return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
var shortAddress = (a, n = 4) => `${a.slice(0, n)}\u2026${a.slice(-n)}`;
function formatDate(unixSeconds) {
  return new Date(unixSeconds * 1e3).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

// src/lib/prices.ts
function valueOf(totals, prices) {
  let usd = 0;
  let priced = 0;
  let thin = false;
  const unpriced = [];
  for (const t of totals) {
    const price = prices.get(t.mint);
    if (!price) {
      unpriced.push(t.mint);
      continue;
    }
    usd += t.total * price.usd;
    priced += 1;
    if (price.thin) thin = true;
  }
  return { usd, priced, unpriced, thin };
}

// src/lib/variants.ts
var VARIANTS = [
  {
    id: "ember",
    label: "Ember",
    bg: ["#1a0d04", "#0a0705", "#000000"],
    glow: "#ff7a1a",
    accent: "#ff6a00",
    accent2: "#ffb300",
    ink: "#ffffff",
    muted: "#6e6e73"
  },
  {
    id: "trench",
    label: "Trench",
    bg: ["#03140b", "#02100a", "#000000"],
    glow: "#00ff88",
    accent: "#00c853",
    accent2: "#69f0ae",
    ink: "#eafff2",
    muted: "#5f7a68",
    stamp: "GM",
    stampColor: "#00ff88"
  },
  {
    id: "gold",
    label: "Bullion",
    bg: ["#1c1505", "#100c04", "#000000"],
    glow: "#ffd54f",
    accent: "#d4a017",
    accent2: "#ffe082",
    ink: "#fffaf0",
    muted: "#8a7a52",
    stamp: "PAID",
    stampColor: "#ffd54f"
  },
  {
    id: "terminal",
    label: "Terminal",
    bg: ["#0a0a0a", "#050505", "#000000"],
    glow: "#9aa3b0",
    accent: "#e8ecf1",
    accent2: "#ffffff",
    ink: "#ffffff",
    muted: "#5a5f66"
  },
  {
    id: "candy",
    label: "Degen",
    bg: ["#1a041a", "#0c0410", "#000000"],
    glow: "#ff2bd1",
    accent: "#ff2bd1",
    accent2: "#7c4dff",
    ink: "#ffffff",
    muted: "#7a6180",
    stamp: "WAGMI",
    stampColor: "#ff2bd1"
  }
];
var DEFAULT_VARIANT = VARIANTS[0];

// src/components/ReceiptCard.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var W = 1200;
var H = 630;
var SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", "Segoe UI", Roboto, system-ui, sans-serif';
var MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';
var ReceiptCard = forwardRef(function ReceiptCard2({ receipt, tokens, logo, prices, variant = DEFAULT_VARIANT }, ref) {
  const v = variant;
  const value = prices ? valueOf(receipt.byToken, prices) : null;
  const worth = value && value.priced > 0 ? formatUsd(value.usd) : null;
  const sym = (t) => tokens.get(t.mint)?.symbol ?? "\u2014";
  const ranked = [...receipt.byToken].sort((a, b) => b.count - a.count);
  const hero = ranked[0];
  const rest = ranked.slice(1, 4);
  const since = receipt.firstAt ? formatDate(receipt.firstAt) : "\u2014";
  const heroText = hero ? formatAmount(hero.total) : "0";
  const heroSize = heroText.length > 11 ? 104 : heroText.length > 8 ? 118 : 132;
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      ref,
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${W} ${H}`,
      width: W,
      height: H,
      className: "card-svg",
      role: "img",
      "aria-label": `Ember receipt for ${receipt.wallet}`,
      children: [
        /* @__PURE__ */ jsxs("defs", { children: [
          /* @__PURE__ */ jsxs("linearGradient", { id: "bg", x1: "0", y1: "0", x2: "0.6", y2: "1", children: [
            /* @__PURE__ */ jsx("stop", { offset: "0", stopColor: v.bg[0] }),
            /* @__PURE__ */ jsx("stop", { offset: "0.55", stopColor: v.bg[1] }),
            /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: v.bg[2] })
          ] }),
          /* @__PURE__ */ jsxs("linearGradient", { id: "flame", x1: "0", y1: "0", x2: "1", y2: "0", children: [
            /* @__PURE__ */ jsx("stop", { offset: "0", stopColor: v.accent }),
            /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: v.accent2 })
          ] }),
          /* @__PURE__ */ jsxs("radialGradient", { id: "glow", cx: "0.16", cy: "0.06", r: "0.85", children: [
            /* @__PURE__ */ jsx("stop", { offset: "0", stopColor: v.glow, stopOpacity: "0.34" }),
            /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: v.glow, stopOpacity: "0" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("rect", { width: W, height: H, fill: "url(#bg)" }),
        /* @__PURE__ */ jsx("rect", { width: W, height: H, fill: "url(#glow)" }),
        /* @__PURE__ */ jsx("rect", { width: W, height: "5", fill: "url(#flame)" }),
        v.stamp && /* @__PURE__ */ jsx(
          "text",
          {
            x: "64",
            y: H - 112,
            fill: v.stampColor ?? v.accent,
            fillOpacity: "0.075",
            fontSize: "150",
            fontWeight: "800",
            letterSpacing: "-5",
            fontFamily: SANS,
            children: v.stamp
          }
        ),
        logo && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("clipPath", { id: "logoClip", children: /* @__PURE__ */ jsx("circle", { cx: "92", cy: "86", r: "24" }) }),
          /* @__PURE__ */ jsx("image", { href: logo, x: "68", y: "62", width: "48", height: "48", clipPath: "url(#logoClip)", preserveAspectRatio: "xMidYMid slice" }),
          /* @__PURE__ */ jsx("circle", { cx: "92", cy: "86", r: "24", fill: "none", stroke: "#ffffff", strokeOpacity: "0.18" })
        ] }),
        /* @__PURE__ */ jsx("text", { x: logo ? 132 : 68, y: "96", fill: v.accent2, fontSize: "23", fontWeight: "640", letterSpacing: "4.2", fontFamily: SANS, children: "EMBER RECEIPT" }),
        /* @__PURE__ */ jsx("text", { x: W - 68, y: "96", fill: v.muted, fontSize: "23", textAnchor: "end", fontFamily: MONO, children: shortAddress(receipt.wallet, 6) }),
        /* @__PURE__ */ jsx(
          "text",
          {
            x: "68",
            y: "252",
            fill: v.ink,
            fontSize: heroSize,
            fontWeight: "700",
            letterSpacing: "-5",
            fontFamily: SANS,
            textLength: heroText.length > 11 ? 660 : void 0,
            lengthAdjust: "spacingAndGlyphs",
            children: heroText
          }
        ),
        /* @__PURE__ */ jsxs("text", { x: "68", y: "306", fill: v.accent2, fontSize: "40", fontWeight: "620", letterSpacing: "-0.6", fontFamily: SANS, children: [
          hero ? sym(hero) : "",
          /* @__PURE__ */ jsxs("tspan", { fill: v.muted, fontSize: "25", fontWeight: "400", letterSpacing: "0", children: [
            "  ",
            "earned as a holder"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("text", { x: "68", y: "348", fill: v.muted, fontSize: "24", fontFamily: SANS, children: [
          receipt.payouts.length.toLocaleString(),
          " payouts since ",
          since
        ] }),
        worth && /* @__PURE__ */ jsxs("g", { transform: "translate(790, 150)", children: [
          /* @__PURE__ */ jsx("text", { x: "0", y: "0", fill: v.muted, fontSize: "19", letterSpacing: "2.4", fontFamily: SANS, children: "WORTH TODAY" }),
          /* @__PURE__ */ jsx("text", { x: "0", y: "66", fill: v.accent2, fontSize: "62", fontWeight: "700", letterSpacing: "-2", fontFamily: SANS, children: worth }),
          /* @__PURE__ */ jsx("text", { x: "0", y: "98", fill: v.muted, fontSize: "18", fontFamily: SANS, children: "at current prices, not at payout" })
        ] }),
        rest.map((t, i) => /* @__PURE__ */ jsxs("g", { transform: `translate(68, ${420 + i * 60})`, children: [
          /* @__PURE__ */ jsx("rect", { x: "0", y: "-32", width: "640", height: "50", rx: "14", fill: "#ffffff", fillOpacity: "0.05" }),
          /* @__PURE__ */ jsx("text", { x: "20", y: "3", fill: v.ink, fontSize: "26", fontWeight: "600", fontFamily: SANS, children: formatAmount(t.total) }),
          /* @__PURE__ */ jsx("text", { x: "200", y: "3", fill: v.muted, fontSize: "24", fontFamily: SANS, children: sym(t) }),
          /* @__PURE__ */ jsxs("text", { x: "620", y: "3", fill: v.muted, fontSize: "21", textAnchor: "end", fontFamily: SANS, children: [
            t.count,
            " payout",
            t.count === 1 ? "" : "s"
          ] })
        ] }, t.mint)),
        /* @__PURE__ */ jsxs("g", { transform: "translate(790, 372)", children: [
          /* @__PURE__ */ jsx("text", { x: "0", y: "0", fill: v.muted, fontSize: "19", letterSpacing: "2.4", fontFamily: SANS, children: "BIGGEST SINGLE" }),
          /* @__PURE__ */ jsx("text", { x: "0", y: "44", fill: v.ink, fontSize: "34", fontWeight: "600", letterSpacing: "-0.8", fontFamily: SANS, children: receipt.biggest ? `${formatAmount(receipt.biggest.amount)} ${tokens.get(receipt.biggest.mint)?.symbol ?? ""}` : "\u2014" }),
          /* @__PURE__ */ jsx("text", { x: "0", y: "104", fill: v.muted, fontSize: "19", letterSpacing: "2.4", fontFamily: SANS, children: "TOKENS PAID IN" }),
          /* @__PURE__ */ jsx("text", { x: "0", y: "148", fill: v.ink, fontSize: "34", fontWeight: "600", letterSpacing: "-0.8", fontFamily: SANS, children: receipt.byToken.length })
        ] }),
        /* @__PURE__ */ jsx("line", { x1: "68", y1: H - 88, x2: W - 68, y2: H - 88, stroke: "#ffffff", strokeOpacity: "0.11" }),
        /* @__PURE__ */ jsxs("text", { x: "68", y: H - 46, fill: v.muted, fontSize: "20", fontFamily: MONO, children: [
          "verified on-chain \xB7 keeper ",
          shortAddress(EMBER_KEEPER.toBase58(), 4)
        ] }),
        /* @__PURE__ */ jsxs("g", { transform: `translate(${W - 68}, ${H - 52})`, children: [
          /* @__PURE__ */ jsx("text", { x: "0", y: "6", fill: v.ink, fontSize: "20", textAnchor: "end", fontWeight: "600", fontFamily: SANS, children: "@eienel_eth" }),
          /* @__PURE__ */ jsx("text", { x: -166, y: "6", fill: v.muted, fontSize: "20", textAnchor: "end", fontFamily: SANS, children: "built by" }),
          /* @__PURE__ */ jsx("g", { transform: "translate(-156, -8) scale(0.0155)", children: /* @__PURE__ */ jsx(
            "path",
            {
              fill: v.ink,
              d: "M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z"
            }
          ) })
        ] })
      ]
    }
  );
});
export {
  ReceiptCard
};
