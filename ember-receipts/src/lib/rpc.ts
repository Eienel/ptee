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

/**
 * An earlier version seeded the settings box with whatever endpoint was active
 * and stored it, so browsers that used the site then are holding the site's own
 * endpoint in localStorage. Read back today that looks like a user override and
 * gets displayed. A stored value identical to the configured one is therefore
 * not an override at all, and is discarded.
 */
export function userOverride(stored: unknown, configured: unknown): string {
  const value = normalizeEndpoint(stored);
  if (!value) return '';
  const built = normalizeEndpoint(configured);
  return built && value === built ? '' : value;
}

/**
 * A display form that never reveals an API key. Endpoints carry the key in the
 * path or query, so only the host is ever shown — the value is already in the
 * bundle, but there is no reason to print it on the page as well.
 */
export function describeEndpoint(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid endpoint';
  }
}
