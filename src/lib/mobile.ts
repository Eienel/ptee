/**
 * Mobile browsers have no wallet extension to inject a provider. The reliable
 * path is a "browse" deeplink that reopens this page inside the wallet's own
 * in-app browser, where a provider IS injected and the normal connect flow
 * works unchanged.
 */

export interface WalletDeepLink {
  name: string;
  url: string;
}

/** Coarse pointer + touch is a better mobile signal than parsing user agents. */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(max-width: 900px)').matches
  );
}

/**
 * Deeplinks that reopen `target` inside each wallet's in-app browser.
 *
 * Phantom:  https://docs.phantom.com/phantom-deeplinks/other-methods/browse
 * Solflare: https://docs.solflare.com/solflare/technical/deeplinks/other-methods/browse
 *
 * Both take the destination and the referring app URL, each URL-encoded.
 */
export function browseDeepLinks(target?: string): WalletDeepLink[] {
  if (typeof window === 'undefined') return [];
  const url = encodeURIComponent(target ?? window.location.href);
  const ref = encodeURIComponent(window.location.origin);

  return [
    { name: 'Phantom', url: `https://phantom.app/ul/browse/${url}?ref=${ref}` },
    { name: 'Solflare', url: `https://solflare.com/ul/v1/browse/${url}?ref=${ref}` },
  ];
}
