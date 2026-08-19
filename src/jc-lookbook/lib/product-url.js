/**
 * Build an on-store product URL that stays inside the shopper's market.
 *
 * `onlineStoreUrl` from the Storefront API drops the locale/market subfolder,
 * so the link is composed from the theme's own `routes.root_url` instead.
 */
export function productUrl(rootUrl, handle) {
  const root = (rootUrl || '/').replace(/\/+$/, '');
  return `${root}/products/${handle}`;
}
