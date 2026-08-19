/**
 * Money helpers.
 *
 * The Storefront API already returns the amount in the market's currency (the
 * `@inContext` directive applies market price overrides), so formatting is a
 * pure presentation concern — never a conversion.
 */

const formatters = new Map();

function formatterFor(locale, currencyCode) {
  const key = `${locale}:${currencyCode}`;
  let formatter = formatters.get(key);
  if (formatter) return formatter;

  try {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    });
  } catch (error) {
    // `narrowSymbol` is unsupported on older Safari, and an unknown locale
    // throws — fall back to the runtime default rather than dropping the price.
    try {
      formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
    } catch (innerError) {
      formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode });
    }
  }

  formatters.set(key, formatter);
  return formatter;
}

/** @param {{amount: string, currencyCode: string}} money */
export function formatMoney(money, locale) {
  if (!money || money.amount == null) return '';
  const amount = Number(money.amount);
  if (Number.isNaN(amount)) return '';
  return formatterFor(locale, money.currencyCode).format(amount);
}

export function toNumber(money) {
  if (!money || money.amount == null) return null;
  const amount = Number(money.amount);
  return Number.isNaN(amount) ? null : amount;
}

/**
 * Pick the price pair to show on a card.
 *
 * Single-variant products expose the variant price directly; multi-variant
 * products fall back to the "from" price range. Compare-at is only honoured
 * when it is genuinely higher than the selling price, which is what a market
 * compare-at override may or may not leave true.
 */
export function resolvePricing(product) {
  const variant = product?.variants?.nodes?.[0] || null;
  const rangeMin = product?.priceRange?.minVariantPrice || null;
  const rangeMax = product?.priceRange?.maxVariantPrice || null;
  const compareRangeMax = product?.compareAtPriceRange?.maxVariantPrice || null;

  const hasPriceRange = toNumber(rangeMin) !== null && toNumber(rangeMax) !== null && toNumber(rangeMin) !== toNumber(rangeMax);

  const price = hasPriceRange ? rangeMin : variant?.price || rangeMin;
  const compareAt = hasPriceRange ? compareRangeMax : variant?.compareAtPrice || compareRangeMax;

  const priceValue = toNumber(price);
  const compareValue = toNumber(compareAt);
  const onSale = priceValue !== null && compareValue !== null && compareValue > priceValue;

  return {
    price,
    compareAt: onSale ? compareAt : null,
    onSale,
    fromPrice: hasPriceRange,
    percentOff: onSale ? Math.round(((compareValue - priceValue) / compareValue) * 100) : 0,
  };
}
