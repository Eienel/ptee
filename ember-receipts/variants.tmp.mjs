import { readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { scanWallet } from './scan.mjs';
import { resolveTokens, loadImages } from './tokens.mjs';
import { fetchPrices } from './prices.mjs';
import { VARIANTS } from './variants.mjs';
import { ReceiptCard } from './card.mjs';

const RPC = readFileSync('.env', 'utf8').match(/https:\/\/\S+/)[0];
const c = new Connection(RPC, { commitment: 'confirmed', httpHeaders: { Origin: 'https://ember-receipts.vercel.app' } });
const receipt = await scanWallet(c, new PublicKey(process.argv[2]), { signatureCap: 3000 });
const tokens = await loadImages(await resolveTokens(c, receipt.byToken.map((t) => t.mint)));
const prices = await fetchPrices(receipt.byToken.map((t) => t.mint));

const hero = receipt.byToken[0];
const image = hero && tokens.get(hero.mint)?.image;
let logo = null;
for (const url of image ? [image, image.replace('https://ipfs.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/')] : []) {
  const res = await fetch(url).catch(() => null);
  if (res?.ok) { const b = Buffer.from(await res.arrayBuffer()); logo = `data:${res.headers.get('content-type')};base64,${b.toString('base64')}`; break; }
}
for (const v of VARIANTS) {
  writeFileSync(`card-${v.id}.svg`, renderToStaticMarkup(createElement(ReceiptCard, { receipt, tokens, logo, prices, variant: v })));
  console.log('rendered', v.label);
}
