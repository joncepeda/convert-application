/**
 * Headless smoke test for assets/jc-lookbook.js.
 *
 * Boots the built bundle inside jsdom against a stubbed Storefront API and
 * asserts the rendered markup, for both the AUD and the JPY market.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = fs.readFileSync(path.join(root, 'assets/jc-lookbook.js'), 'utf8');

const SHOP_DEFAULT_MARKET = 'AU';

const CATALOG = {
  AU: {
    'silk-slip-dress': { price: '289.00', compareAt: '389.00', currency: 'AUD' },
    'wool-overcoat': { price: '749.00', compareAt: null, currency: 'AUD' },
    'leather-tote': { price: '399.00', compareAt: null, currency: 'AUD' },
  },
  JP: {
    // Deliberately not a conversion of the AUD values: these stand in for
    // market-level price and compare-at price overrides.
    'silk-slip-dress': { price: '32000', compareAt: '45000', currency: 'JPY' },
    'wool-overcoat': { price: '84000', compareAt: null, currency: 'JPY' },
    'leather-tote': { price: '44000', compareAt: null, currency: 'JPY' },
  },
};

function stubProduct(handle, country) {
  // Mirrors Shopify: when @inContext gets no resolvable country it silently
  // falls back to the shop's default market rather than erroring.
  const market = CATALOG[country] ? country : SHOP_DEFAULT_MARKET;
  const entry = CATALOG[market][handle];
  if (!entry) return null;

  const money = (amount) => (amount ? { amount, currencyCode: entry.currency } : null);
  const image = { url: 'https://cdn.shopify.com/s/files/1/img.jpg', altText: null, width: 800, height: 1000 };

  return {
    id: 'gid://shopify/Product/' + handle,
    handle,
    title: handle.replace(/-/g, ' '),
    vendor: 'Atelier',
    availableForSale: true,
    featuredImage: image,
    images: { nodes: [image] },
    priceRange: { minVariantPrice: money(entry.price), maxVariantPrice: money(entry.price) },
    compareAtPriceRange: { minVariantPrice: money(entry.compareAt), maxVariantPrice: money(entry.compareAt) },
    variants: {
      nodes: [
        {
          id: 'gid://shopify/ProductVariant/1',
          availableForSale: true,
          price: money(entry.price),
          compareAtPrice: money(entry.compareAt),
        },
      ],
    },
  };
}

const LOOKBOOKS = [
  {
    id: 'gid://shopify/Metaobject/1',
    handle: 'resort-25',
    title: 'Resort 25',
    description: 'Warm-weather tailoring.',
    image: null,
    handles: ['silk-slip-dress', 'wool-overcoat', 'ghost-handle'],
  },
  {
    id: 'gid://shopify/Metaobject/2',
    handle: 'city-edit',
    title: 'City Edit',
    description: 'After dark.',
    image: null,
    // Overlaps with the first lookbook — must not be requested twice.
    handles: ['leather-tote', 'silk-slip-dress'],
  },
];

function config({ country, language, currency, locale, rootUrl, designMode = false }) {
  return {
    designMode,
    shop: {
      endpoint: 'https://jc-fashion.myshopify.com/api/2025-01/graphql.json',
      token: 'stub-token',
      country,
      language,
      currency,
      locale,
      rootUrl,
    },
    settings: {
      headingSize: 'h1',
      showDescription: true,
      showLookbookImage: false,
      layout: 'grid',
      columnsDesktop: 4,
      columnsMobile: 2,
      imageRatio: 'portrait',
      showSecondaryImage: true,
      showVendor: true,
      showPrice: true,
    },
    strings: {
      from: 'From',
      save: 'Save {{ percent }}%',
      soldOut: 'Sold out',
      salePrice: 'Sale price',
      regularPrice: 'Regular price',
    },
    lookbooks: LOOKBOOKS,
  };
}

const AU_MARKET = { country: 'AU', language: 'EN', currency: 'AUD', locale: 'en-AU', rootUrl: '/' };
const JP_MARKET = { country: 'JP', language: 'JA', currency: 'JPY', locale: 'ja-JP', rootUrl: '/ja' };

const HANDLE_RE = /product\(handle: "([^"]+)"\)/g;

/**
 * Mount one or more sections in a single window, so they share the module-level
 * cache, the sessionStorage cache and the in-flight request map — which is what
 * a real page with two lookbook sections does.
 */
async function renderRoots(cfgs, deferredCfg) {
  const requests = [];
  const warnings = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => console.error('[jsdom]', error.message));
  virtualConsole.on('warn', (message) => warnings.push(String(message)));

  const roots = cfgs
    .map(
      (cfg, index) =>
        '<div data-jc-lookbook id="root' +
        index +
        '"><div data-jc-lookbook-app></div>' +
        '<script type="application/json" data-jc-lookbook-config>' +
        JSON.stringify(cfg) +
        '</scr' +
        'ipt></div>'
    )
    .join('');

  const dom = new JSDOM('<!doctype html><html><body>' + roots + '</body></html>', {
    runScripts: 'outside-only',
    url: 'https://jc-fashion.com/',
    pretendToBeVisual: true,
    virtualConsole,
  });

  dom.window.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    const handles = [...body.query.matchAll(HANDLE_RE)].map((match) => match[1]);
    const data = {};
    handles.forEach((handle, index) => {
      data['p' + index] = stubProduct(handle, body.variables.country);
    });
    return { ok: true, status: 200, json: async () => ({ data }) };
  };

  dom.window.eval(bundle);
  // Let React flush its effects and the stubbed requests resolve.
  await new Promise((resolve) => setTimeout(resolve, 150));

  const all = [...cfgs];
  const requestsBeforeDeferred = requests.length;

  if (deferredCfg) {
    // Mount a further section against an already-warm cache, exactly as the
    // theme editor does when a section is added or re-rendered.
    const index = all.length;
    const host = dom.window.document.createElement('div');
    host.innerHTML =
      '<div data-jc-lookbook id="root' + index + '"><div data-jc-lookbook-app></div>' +
      '<script type="application/json" data-jc-lookbook-config>' +
      JSON.stringify(deferredCfg) + '</scr' + 'ipt></div>';
    dom.window.document.body.appendChild(host);
    const event = new dom.window.Event('shopify:section:load');
    Object.defineProperty(event, 'target', { value: host });
    dom.window.document.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 150));
    all.push(deferredCfg);
  }

  const html = all.map(
    (_, index) => dom.window.document.querySelector('#root' + index + ' [data-jc-lookbook-app]').innerHTML
  );

  return { requests, requestsBeforeDeferred, warnings, html, html0: html[0] };
}

async function render(cfg) {
  const result = await renderRoots([cfg]);
  return { ...result, html: result.html0 };
}

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
  } catch (error) {
    failures += 1;
    console.log('  FAIL  ' + name + '\n        ' + error.message);
  }
}

function requestedHandles(request) {
  return [...request.query.matchAll(HANDLE_RE)].map((match) => match[1]);
}

// --- AUD market -------------------------------------------------------------
const au = await render(config(AU_MARKET));
console.log('\nAUD market (country: AU)');
check('renders both lookbooks', () => {
  assert.match(au.html, /Resort 25/);
  assert.match(au.html, /City Edit/);
});
check('renders AUD prices', () => assert.match(au.html, /\$289\.00/));
check('renders the compare-at price on the discounted product', () => assert.match(au.html, /\$389\.00/));
check('renders a percent-off badge', () => assert.match(au.html, /Save 26%/));
check('drops handles that do not resolve', () =>
  assert.equal((au.html.match(/jc-lookbook__card/g) || []).length, 4));
check('product links use the theme root url', () =>
  assert.match(au.html, /href="\/products\/silk-slip-dress"/));
check('batches every handle into a single request', () => assert.equal(au.requests.length, 1));
check('dedupes the handle shared by both lookbooks', () => {
  const handles = requestedHandles(au.requests[0]);
  assert.equal(handles.length, new Set(handles).size);
  assert.equal(handles.length, 4);
});
check('sends the AU market context', () =>
  assert.deepEqual(au.requests[0].variables, { country: 'AU', language: 'EN' }));
check('warns about nothing', () => assert.deepEqual(au.warnings, []));

// --- JPY market -------------------------------------------------------------
const jp = await render(config(JP_MARKET));
console.log('\nJPY market (country: JP)');
check('renders JPY prices with no decimal places', () => assert.match(jp.html, /[¥￥]32,000/));
check('renders the JPY compare-at override', () => assert.match(jp.html, /[¥￥]45,000/));
check('recalculates the discount from the market prices', () => assert.match(jp.html, /Save 29%/));
check('never leaks AUD amounts into the JP market', () => assert.doesNotMatch(jp.html, /289\.00/));
check('product links keep the locale subfolder', () =>
  assert.match(jp.html, /href="\/ja\/products\/leather-tote"/));
check('sends the JP market context', () =>
  assert.deepEqual(jp.requests[0].variables, { country: 'JP', language: 'JA' }));

// --- Both markets in one window (shared caches) -----------------------------
const shared = await renderRoots([config(AU_MARKET), config(JP_MARKET)]);
console.log('\nTwo markets sharing one page cache');
check('each market issues its own request', () => assert.equal(shared.requests.length, 2));
check('the AU section renders AUD', () => {
  assert.match(shared.html[0], /\$289\.00/);
  assert.doesNotMatch(shared.html[0], /[¥￥]32,000/);
});
check('the JP section renders JPY', () => {
  assert.match(shared.html[1], /[¥￥]32,000/);
  assert.doesNotMatch(shared.html[1], /\$289\.00/);
});

// --- The reported failure: no country reaches @inContext ---------------------
// Shopify then resolves the shop's default market, so JPY shoppers are shown
// AUD amounts. The section must not present that as if it were correct.
// Both sections here are served in English with no country resolved, so the
// currency is the *only* thing separating the two markets — which is exactly
// the case a country-keyed cache collapses into one entry.
const blank = await renderRoots(
  [config({ ...AU_MARKET, country: '', designMode: true })],
  config({ ...JP_MARKET, country: '', language: 'EN', locale: 'en-JP', designMode: true })
);
console.log('\nMissing market context (regression)');
check('warns that no country was supplied', () =>
  assert.ok(blank.warnings.some((w) => /No country in the section payload/.test(w))));
check('a second market does not reuse the first market cache entry', () =>
  assert.equal(blank.requests.length, blank.requestsBeforeDeferred + 1));
check('flags the currency mismatch on the JPY market', () => {
  assert.match(blank.html[1], /Wrong currency/);
  assert.match(blank.html[1], /trades in JPY/);
  assert.match(blank.html[1], /returned AUD/);
});
check('warns about the mismatch on the console', () =>
  assert.ok(blank.warnings.some((w) => /Expected JPY .* returned AUD/.test(w))));
check('does not flag the market that really is AUD', () =>
  assert.doesNotMatch(blank.html[0], /Wrong currency/));

console.log('\n' + (failures ? failures + ' failing check(s)' : 'All checks passed'));
process.exit(failures ? 1 : 0);
