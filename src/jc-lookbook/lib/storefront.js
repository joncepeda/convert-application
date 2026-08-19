/**
 * Minimal Storefront API client.
 *
 * Everything is requested through `@inContext(country:, language:)` so that the
 * response already carries the buyer's market currency plus any market-level
 * price / compare-at price overrides. We never convert currency client side.
 */

const PRODUCT_FRAGMENT = `
  fragment LookbookProduct on Product {
    id
    handle
    title
    vendor
    availableForSale
    featuredImage { url altText width height }
    images(first: 2) { nodes { url altText width height } }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    variants(first: 1) {
      nodes {
        id
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
      }
    }
  }
`;

/** Storefront API query cost is capped, so handles are requested in batches. */
const BATCH_SIZE = 40;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_PREFIX = 'jc-lookbook:v2';

/** Shared across every section instance on the page. */
const memoryCache = new Map();
const inFlight = new Map();
const warned = new Set();

function warnOnce(message) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/**
 * Cached money is only ever valid for the market it was fetched in, so the key
 * carries the whole market context — currency included. Keying on country alone
 * lets a blank or stale country collapse every market onto one sessionStorage
 * entry, which shows the first market's currency to everyone afterwards.
 */
function cacheKey(handle, shop) {
  return [CACHE_PREFIX, shop.country || '-', shop.language || '-', shop.currency || '-', handle].join(':');
}

/** The currency the Storefront API actually resolved for a product. */
export function currencyOf(product) {
  return (
    product?.variants?.nodes?.[0]?.price?.currencyCode ||
    product?.priceRange?.minVariantPrice?.currencyCode ||
    null
  );
}

function readCache(key) {
  const hit = memoryCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expires <= Date.now()) {
      window.sessionStorage.removeItem(key);
      return undefined;
    }
    memoryCache.set(key, parsed);
    return parsed.value;
  } catch (error) {
    return undefined;
  }
}

function writeCache(key, value) {
  const entry = { value, expires: Date.now() + CACHE_TTL_MS };
  memoryCache.set(key, entry);
  try {
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    // Private mode / quota exceeded — the in-memory cache still applies.
  }
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildQuery(handles) {
  const aliases = handles
    .map((handle, index) => `    p${index}: product(handle: ${JSON.stringify(handle)}) { ...LookbookProduct }`)
    .join('\n');

  return `
  query JcLookbookProducts($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
${aliases}
  }
  ${PRODUCT_FRAGMENT}`;
}

async function fetchBatch(handles, shop) {
  if (!shop.country) {
    warnOnce(
      '[jc-lookbook] No country in the section payload, so @inContext cannot resolve a ' +
        'market and the Storefront API will fall back to the shop default currency.'
    );
  }

  const response = await fetch(shop.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Shopify-Storefront-Access-Token': shop.token,
    },
    body: JSON.stringify({
      query: buildQuery(handles),
      variables: { country: shop.country || null, language: shop.language || null },
    }),
  });

  if (!response.ok) {
    throw new Error(`Storefront API responded with ${response.status}`);
  }

  const payload = await response.json();

  // Partial data is normal when a single handle no longer resolves, so only
  // throw when nothing at all came back.
  if (!payload.data) {
    const message = (payload.errors || []).map((error) => error.message).join('; ');
    throw new Error(message || 'Storefront API returned no data');
  }

  return handles.reduce((acc, handle, index) => {
    acc[handle] = payload.data[`p${index}`] || null;
    return acc;
  }, {});
}

/**
 * Resolve product handles to Storefront API products, deduped and cached across
 * every lookbook rendered on the page.
 *
 * @returns {Promise<Record<string, object|null>>} handle -> product (null when unresolved)
 */
export async function fetchProductsByHandle(handles, shop) {
  const unique = Array.from(new Set(handles.filter(Boolean)));
  const results = {};
  const missing = [];

  unique.forEach((handle) => {
    const cached = readCache(cacheKey(handle, shop));
    if (cached !== undefined) {
      results[handle] = cached;
    } else {
      missing.push(handle);
    }
  });

  const pending = [];
  const toRequest = [];

  missing.forEach((handle) => {
    const key = cacheKey(handle, shop);
    const active = inFlight.get(key);
    if (active) {
      pending.push(active.then((product) => ({ handle, product })));
    } else {
      toRequest.push(handle);
    }
  });

  const batches = chunk(toRequest, BATCH_SIZE).map((batch) => {
    const request = fetchBatch(batch, shop);

    batch.forEach((handle) => {
      const key = cacheKey(handle, shop);
      const scoped = request.then((map) => {
        writeCache(key, map[handle] || null);
        return map[handle] || null;
      });
      // Swallow here only to avoid unhandled rejections; the batch promise below
      // still surfaces the failure to the caller.
      scoped.catch(() => {});
      inFlight.set(key, scoped);
      scoped.finally(() => {
        if (inFlight.get(key) === scoped) inFlight.delete(key);
      });
    });

    return request;
  });

  const [batchMaps, resolvedPending] = await Promise.all([Promise.all(batches), Promise.all(pending)]);

  batchMaps.forEach((map) => Object.assign(results, map));
  resolvedPending.forEach(({ handle, product }) => {
    results[handle] = product;
  });

  return results;
}
