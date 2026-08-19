const WIDTHS = [180, 360, 540, 720, 900, 1080, 1440];

/** Append a width transform to a Shopify CDN image URL. */
export function resize(url, width) {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set('width', String(width));
    return parsed.toString();
  } catch (error) {
    return url;
  }
}

export function srcSet(url, maxWidth) {
  if (!url) return undefined;
  const widths = WIDTHS.filter((width) => width <= (maxWidth || 1440));
  if (!widths.length) return undefined;
  return widths.map((width) => `${resize(url, width)} ${width}w`).join(', ');
}
