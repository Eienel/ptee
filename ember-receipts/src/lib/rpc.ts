/** Public fallback. It cannot complete a scan, but it keeps the app usable. */
export const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';

/**
 * An endpoint is only usable if it is a real http(s) URL. This matters because
 * `??` does not catch an empty string: a build-time variable that is *set but
 * blank* — which is what an empty field in a hosting dashboard produces —
 * would otherwise reach `new Connection('')`, which throws during render and
 * leaves a blank page.
 */
export function normalizeEndpoint(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

/** The endpoint to start with: stored choice, then build-time value, then public. */
export function initialEndpoint(stored: unknown, configured: unknown): string {
  return normalizeEndpoint(stored) ?? normalizeEndpoint(configured) ?? PUBLIC_RPC;
}
