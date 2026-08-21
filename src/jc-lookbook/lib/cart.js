/**
 * Cart client for quick add.
 *
 * Deliberately mirrors Dawn's `product-form.js`: the same `/cart/add.js` call,
 * the same `sections` round trip, and the same handover to whichever cart UI
 * the theme is configured with. Doing it this way means the drawer, the cart
 * notification and the header bubble all update exactly as they do from a
 * product page, without this section owning any cart markup of its own.
 */

/** The theme's cart UI, whichever one the merchant has enabled. */
export function cartElement() {
  return document.querySelector('cart-notification') || document.querySelector('cart-drawer') || null;
}

/**
 * `/cart/add.js` takes the numeric variant id; the Storefront API hands back a
 * global id (`gid://shopify/ProductVariant/123`).
 */
export function variantIdToNumber(gid) {
  if (!gid) return null;
  const match = String(gid).match(/(\d+)\s*$/);
  return match ? match[1] : null;
}

function cartRoute(name, fallback, rootUrl) {
  const route = typeof window !== 'undefined' && window.routes ? window.routes[name] : null;
  if (route) return route;
  const root = (rootUrl || '/').replace(/\/+$/, '');
  return `${root}${fallback}`;
}

/**
 * Add one variant to the cart and let the theme re-render its cart sections.
 *
 * Resolves once every request the click started has settled — the add itself
 * and, when a cart UI is present, the section HTML it renders from — so the
 * caller can keep a spinner up for the whole operation rather than just the
 * POST.
 *
 * @returns {Promise<{ok: true}>} rejects with a message safe to show a shopper
 */
export async function addToCart({ variantId, quantity = 1, rootUrl, activeElement }) {
  const id = variantIdToNumber(variantId);
  if (!id) throw new Error('Missing variant');

  const cart = cartElement();
  const body = new FormData();
  body.append('id', id);
  body.append('quantity', String(quantity));

  if (cart) {
    // Ask Shopify to render the cart sections in the same response, so the
    // drawer/notification opens already populated instead of doing its own
    // follow-up fetch.
    body.append('sections', cart.getSectionsToRender().map((section) => section.id).join(','));
    body.append('sections_url', window.location.pathname);
    // Where focus goes when the drawer or notification is dismissed.
    if (typeof cart.setActiveElement === 'function') {
      cart.setActiveElement(activeElement || document.activeElement);
    }
  }

  const response = await fetch(cartRoute('cart_add_url', '/cart/add', rootUrl), {
    method: 'POST',
    headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
    body,
  });

  const payload = await response.json();

  // A rejected line item comes back as a 4xx with a description — out of stock,
  // a quantity rule, a required selling plan. Surface it rather than pretending
  // the add worked.
  if (payload.status || !response.ok) {
    throw new Error(payload.description || payload.message || 'Could not add to cart');
  }

  if (!cart) {
    // No drawer and no notification means the theme's cart is a page; Dawn
    // sends the shopper there, and so do we.
    window.location = cartRoute('cart_url', '/cart', rootUrl);
    return { ok: true };
  }

  // Other cart-aware components (the cart page, quantity inputs, upsells)
  // listen for this. `publish` returns a promise for its subscribers, which is
  // part of "all the ajax is done".
  if (typeof window.publish === 'function') {
    try {
      await window.publish('cart-update', {
        source: 'jc-lookbook',
        productVariantId: id,
        cartData: payload,
      });
    } catch (error) {
      // A misbehaving subscriber must not block the drawer from opening.
      console.error('[jc-lookbook] cart-update subscriber failed', error);
    }
  }

  if (cart.classList.contains('is-empty')) cart.classList.remove('is-empty');
  cart.renderContents(payload);

  return { ok: true };
}
