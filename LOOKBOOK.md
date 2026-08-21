# JC Lookbook

A React-rendered lookbook for Dawn, built entirely on native Shopify primitives:
**metaobjects** for the merchandising data and the **Storefront API** for product
data at runtime. No third-party apps.

---

## How it fits together

```
Metaobject "lookbook"          Liquid section              React bundle
─────────────────────          ──────────────              ────────────
title                          picks the entry(s)          reads the JSON payload
description             ──▶    emits handles + market ──▶  queries the Storefront API
image                          context as JSON             with @inContext(country:, language:)
product_handles                                            renders cards + market prices
priority
```

The metaobject stores **product handles only**. Nothing about a product — title,
media, price, compare-at price, availability — is rendered from Liquid. That is
all fetched at request time from the Storefront API so market pricing is always
correct and never cached into the HTML.

---

## 1. Create the metaobject definition

Either run `scripts/lookbook-metaobject-definition.graphql` against the Admin
GraphQL API, or build it by hand in **Settings → Custom data → Metaobjects → Add
definition**:

| Field key     | Name            | Type                          | Notes                                              |
| ------------- | --------------- | ----------------------------- | -------------------------------------------------- |
| `title`       | Title           | Single line text (required)   | Used as the display name and the section heading    |
| `description` | Description     | Multi line text               | Intro copy under the heading                        |
| `image`       | Hero image      | File → Image                  | Optional editorial image above the products         |
| `product_handles` | Product handles | List of single line text (required) | **One product handle per entry**                |
| `priority`    | Priority        | Integer (0–8999)              | Lower shows first. Defaults to 100 when left empty  |

Then, still on the definition:

- Set **Display name** to `title`.
- Enable the **Publishable** capability (so drafts stay off the storefront).
- Under **Storefront access**, tick **Storefront** — without it
  `shop.metaobjects.lookbook` is empty in Liquid and nothing renders.

### Adding entries

**Content → Metaobjects → Lookbook → Add entry.** In *Product handles*, add one
handle per entry, e.g. `silk-slip-dress`. The order you list them in is the order
they render.

A pasted product URL also works — the section trims, lowercases and reduces
`https://shop.com/en-au/products/silk-slip-dress?variant=1` down to
`silk-slip-dress` for you.

Handles that no longer resolve — unpublished, deleted, or unavailable in the
buyer's market — are dropped from the grid rather than rendering a broken card.

---

## 2. Add the Storefront API token

The theme needs a public Storefront API token to query products.

1. **Settings → Apps and sales channels → Develop apps → Create an app** (or add
   the **Headless** channel).
2. Configure **Storefront API** scopes: `unauthenticated_read_product_listings`.
3. Install the app and copy the **Storefront API access token** (public token,
   not the Admin token).
4. Paste it into **Online Store → Themes → Customize → Theme settings →
   Lookbook → Storefront API access token**.

The API version is set in the same panel and defaults to `2025-01`. Anything
`2024-04` or newer works.

---

## 3. Add the sections

**Home page** — Customize the home page → **Add section → JC Lookbook** → pick
one or more lookbooks in the section settings. They render stacked, in the order
you select them. The section can also be added to pages, collections, blogs and
search.

**Product page** — Customize a product template → **Add section → JC Lookbook
(product)**. There is deliberately **no lookbook picker**: adding the section is
the entire configuration.

- It renders every lookbook that lists the current product's handle.
- It renders **at most two**, even when the product is in three or more. Which
  two is decided by the metaobject's `priority` field, lowest first.
- If the product is in no lookbook the section renders nothing at all — no empty
  heading, no padding.

`jc-lookbook-product` is already wired into `templates/product.json`, so it is
live as soon as a lookbook lists a product.

Every other setting — title override, heading size, hero image, description,
grid vs. horizontal scroll, image ratio, hover image, quick add, vendor, price,
columns, colour scheme, padding — is identical on both sections. Both render
through the same `snippets/jc-lookbook.liquid`, so the two can never drift.

---

## Title override

**Title override** is a single text field on both sections.

- **Left blank** (the default) each lookbook is headed by its own `title` from
  its metaobject, exactly as before.
- **Filled in** that text is rendered once, as the heading for the entire
  section, and the individual lookbook titles are not shown. With two or more
  lookbooks selected this is what makes them read as one group rather than as
  separate blocks — "Autumn Edit" over the lot, instead of "Resort 25" and
  "City Edit" stacked.

Lookbook **descriptions** are unaffected either way: a description belongs to
its own lookbook, not to the section, so it stays under the products it
introduces. The override is rendered at the section's **Heading size**, and it
is rendered by the React app rather than by Liquid, so it disappears along with
the rest of the section when no products resolve.

---

## Quick add

**Product cards → Enable quick add to cart** (on by default, on both sections)
puts a round `+` button over the bottom-right of each product image. It is
invisible until the card is hovered — or until something inside the card takes
keyboard focus — and it is always visible on touch devices, which have no hover.

What the button does depends on the product:

| Product                | Button        | Behaviour                                                       |
| ---------------------- | ------------- | --------------------------------------------------------------- |
| One variant            | `+` button    | Adds that variant to the cart over ajax, without leaving the page |
| More than one variant  | `+` link      | Goes to the product page so the shopper can choose options        |
| Sold out               | none          | No button renders                                                 |

While the add is in flight the `+` is replaced by a spinner and the button is
marked `aria-disabled`. The spinner clears only once **every** request the click
started has settled: the `POST /cart/add.js`, the cart sections Shopify renders
in the same response, and any `cart-update` subscribers in the theme.

The add is deliberately the same round trip Dawn's own `product-form.js` makes —
`/cart/add.js` with a `sections` parameter, then `renderContents()` on whichever
cart UI the theme has. So the cart drawer or the cart notification opens exactly
as it does from a product page, and the header count updates with it. If the
theme's cart type is a full page instead, the shopper is taken to `/cart`.

If Shopify rejects the line — out of stock, a quantity rule — the message it
returns is shown in a small tooltip above the button and the `+` comes back.

Multi-variant detection is why the Storefront API query asks for `variants(first: 2)`:
the second node is only ever used as a "there is more than one" flag. The
`sessionStorage` cache prefix moved to `v3` with that change, so a cached v2
entry — which only ever held one variant — can never be mistaken for a
single-variant product.


## Markets and currency

The store trades in **AUD** and **JPY**. Prices are never converted in the
browser. The section reads the buyer's active market from Liquid:

```liquid
localization.country.iso_code            →  AU / JP     (decides the market)
localization.country.currency.iso_code   →  AUD / JPY   (expected currency)
localization.language.iso_code           →  en / ja     (sent as EN / JA)
```

and every Storefront API query is issued through the context directive:

```graphql
query JcLookbookProducts($country: CountryCode, $language: LanguageCode)
@inContext(country: $country, language: $language) { … }
```

Shopify therefore returns `price` and `compareAtPrice` already resolved for that
market, including **market-level price overrides and compare-at price
overrides**. The React layer only formats — `Intl.NumberFormat` with the
currency code that came back on the money object, so `A$289.00` on the AU market
and `￥32,000` (no decimals) on the JP market. Sale badges are calculated from
the market's own numbers, so a product can be on sale in one market and not the
other.

Product links are built from `routes.root_url`, which keeps shoppers inside
their market's locale subfolder (`/ja/products/…`).

### If the currency does not follow the localization selector

Shopify does **not** error when `@inContext` cannot resolve a market for the
country it is given — it quietly answers in the shop's default currency, with
amounts that look perfectly valid. The section therefore checks the currency
that came back against `localization.country.currency.iso_code` and, on a
mismatch, logs a console warning and shows a notice in the theme editor naming
the country and both currencies. If you see it:

1. Confirm the country is in an **active** market (Settings → Markets). A
   country that belongs to no active market falls back to the primary market.
2. Confirm the Storefront API token's app can read that market. Re-issue the
   token if the markets were added after the app was created.
3. Confirm the section payload carries a country at all — view source and look
   at `"country"` in the section's JSON script tag. A blank value means
   `localization.country` was unavailable, and the console will say so.

Cached prices are keyed by country, language **and** currency, so a market
switch can never serve another market's amounts out of `sessionStorage`.

---

## Development

```bash
npm install
npm run build     # bundle src/jc-lookbook -> assets/jc-lookbook.js
npm run dev       # same, in watch mode
```

### Source layout

| Path                                   | Purpose                                            |
| -------------------------------------- | -------------------------------------------------- |
| `sections/jc-lookbook.liquid`          | Home page / general section, with the lookbook picker |
| `sections/jc-lookbook-product.liquid`  | Product page section, no picker, capped at 2        |
| `snippets/jc-lookbook.liquid`          | Shared mount point + JSON payload                   |
| `snippets/jc-lookbook-matches.liquid`  | Product → lookbooks reverse lookup                  |
| `src/jc-lookbook/`                     | React source                                        |
| `src/jc-lookbook/components/QuickAdd.jsx` | The hover `+` button and its spinner             |
| `src/jc-lookbook/lib/cart.js`          | `/cart/add.js` + cart section rendering             |
| `assets/jc-lookbook.js`                | Built bundle — **generated, do not edit**           |
| `assets/jc-lookbook.css`               | Section styles                                      |
| `scripts/lookbook-metaobject-definition.graphql` | Admin API mutation for the definition     |

`assets/jc-lookbook.js` is committed because Shopify serves the theme's `assets`
folder directly; rebuild and commit it whenever `src/jc-lookbook` changes.

---

## Notes on the implementation

- **One request per page.** Handles from every lookbook in a section are deduped
  and batched into a single GraphQL document (aliased `product(handle:)` fields,
  chunked at 40 to stay inside the query cost limit).
- **Caching.** Results are cached per handle per market in memory and in
  `sessionStorage` for 10 minutes, and concurrent sections share in-flight
  requests rather than duplicating them.
- **Missing products fail soft.** A handle that no longer resolves — unpublished,
  deleted, or not available in that market — is dropped from the grid. If a
  lookbook ends up with no products it is not rendered.
- **Theme editor.** Sections re-mount on `shopify:section:load` and unmount on
  `shopify:section:unload`. Misconfiguration (no token, no lookbook selected,
  product in no lookbook) shows an explanatory notice in the editor only; the
  live storefront just collapses the section.
