/**
 * Token artwork lives off-chain: the mint's metadata points at a JSON document,
 * which points at the image. Both hops are usually IPFS, so both need a gateway
 * and both are allowed to fail without breaking anything.
 */

const GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
];

/** ipfs://CID and bare CIDs become gateway URLs; https URIs pass through. */
export function gatewayUrls(uri: string): string[] {
  const trimmed = uri.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('ipfs://')) {
    const path = trimmed.slice('ipfs://'.length).replace(/^ipfs\//, '');
    return GATEWAYS.map((g) => g + path);
  }
  if (/^(ar|arweave):\/\//.test(trimmed)) {
    return ['https://arweave.net/' + trimmed.replace(/^(ar|arweave):\/\//, '')];
  }
  if (/^https?:\/\//.test(trimmed)) return [trimmed];
  if (/^[A-Za-z0-9]{46,}$/.test(trimmed)) return GATEWAYS.map((g) => g + trimmed);
  return [];
}

/**
 * Races the gateways rather than trying them in turn: one rate-limited gateway
 * should not add its timeout to everyone else's wait.
 */
async function firstOk(urls: string[], timeoutMs: number): Promise<Response | null> {
  if (urls.length === 0) return null;
  const attempts = urls.map(
    (url) =>
      new Promise<Response>((resolve, reject) => {
        fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
          .then((res) => (res.ok ? resolve(res) : reject(new Error(String(res.status)))))
          .catch(reject);
      }),
  );
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

/** The `image` field from a token's off-chain metadata document. */
export async function imageUrlFromMetadataUri(uri: string): Promise<string | null> {
  const res = await firstOk(gatewayUrls(uri), 7000);
  if (!res) return null;
  try {
    const json = (await res.json()) as { image?: unknown };
    if (typeof json.image !== 'string') return null;
    return gatewayUrls(json.image)[0] ?? null;
  } catch {
    return null;
  }
}

const LOGO_PX = 128;
/** Generous ceiling for the raw fallback: token art is routinely ~1MB. */
const MAX_RAW_BYTES = 2_000_000;

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Inlines an image as a data URI for the card. The card exports to PNG through
 * a canvas, where a remote image would either taint the canvas or fail to load
 * in the detached SVG — a data URI avoids both.
 *
 * Token art is commonly around a megabyte, which is wasteful to embed for a
 * 48px circle, so it is redrawn at LOGO_PX first. That needs a CORS-permitted
 * response; when it is not permitted the original bytes are embedded instead.
 */
export async function toDataUrl(url: string): Promise<string | null> {
  const downscaled = await downscale(url);
  if (downscaled) return downscaled;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > MAX_RAW_BYTES || !blob.type.startsWith('image/')) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

async function downscale(url: string): Promise<string | null> {
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const loaded = await new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
    if (!loaded) return null;

    const canvas = document.createElement('canvas');
    canvas.width = LOGO_PX;
    canvas.height = LOGO_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, LOGO_PX, LOGO_PX);
    return canvas.toDataURL('image/png'); // throws if the canvas was tainted
  } catch {
    return null;
  }
}
