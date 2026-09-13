/**
 * Embercurve's own API sends no `Access-Control-Allow-Origin`, so the browser
 * blocks a direct call to embercurve.fun from this origin. Every request goes
 * through a same-origin path instead, rewritten to the real host by
 * `vercel.json` in production and by the Vite dev proxy locally.
 *
 * This is Ember's published state, not something read off the chain. It is used
 * for what only Ember knows — module configuration and paper-mode positions —
 * and never as evidence for a figure the chain can settle.
 */
export const EMBER_API = '/ember';

export async function emberJson<T>(path: string, timeoutMs = 9000): Promise<T | null> {
  try {
    const res = await fetch(`${EMBER_API}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
