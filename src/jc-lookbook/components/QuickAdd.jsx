import { useEffect, useRef, useState } from 'react';
import { addToCart } from '../lib/cart.js';
import { productUrl } from '../lib/product-url.js';

/**
 * The hover-revealed quick add control on a product card.
 *
 * Three shapes, decided by the product itself:
 * - sold out            -> nothing renders
 * - one variant         -> a button that adds it over ajax
 * - more than one       -> a link to the product page, because options have to
 *                          be picked and guessing a size is worse than a click
 *
 * The button keeps the `+` icon until it is pressed, swaps it for a spinner for
 * exactly as long as the requests are in flight, and returns to `+` afterwards.
 */
export default function QuickAdd({ product, shop, strings }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const variants = product.variants?.nodes || [];
  const soldOut = product.availableForSale === false;
  const singleVariant = variants.length === 1 ? variants[0] : null;

  if (soldOut) return null;

  const icon = (
    <span className="jc-lookbook__quick-add-icon" aria-hidden="true">
      <svg viewBox="0 0 12 12" focusable="false" role="presentation">
        <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );

  // Options to pick: no ajax to run, so this is a plain link to the product.
  if (!singleVariant) {
    const label = strings.chooseProductOptions
      ? strings.chooseProductOptions.replace('{{ product_name }}', product.title)
      : strings.chooseOptions;

    return (
      <a
        className="jc-lookbook__quick-add"
        href={productUrl(shop.rootUrl, product.handle)}
        aria-label={label}
        title={strings.chooseOptions}
      >
        {icon}
      </a>
    );
  }

  const loading = status === 'loading';

  const onClick = async (event) => {
    // The card is wrapped in a full-bleed link; adding to the cart must not
    // also navigate to the product page.
    event.preventDefault();
    event.stopPropagation();
    if (loading) return;

    setStatus('loading');
    setError(null);

    try {
      await addToCart({
        variantId: singleVariant.id,
        rootUrl: shop.rootUrl,
        activeElement: event.currentTarget,
      });
      if (mounted.current) setStatus('idle');
    } catch (requestError) {
      if (!mounted.current) return;
      setStatus('idle');
      setError(requestError.message);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`jc-lookbook__quick-add${loading ? ' jc-lookbook__quick-add--loading' : ''}`}
        onClick={onClick}
        aria-disabled={loading || undefined}
        aria-label={`${strings.addToCart}: ${product.title}`}
        title={strings.addToCart}
      >
        {loading ? (
          <span className="jc-lookbook__spinner" aria-hidden="true" />
        ) : (
          icon
        )}
        <span className="visually-hidden" aria-live="polite">
          {loading ? strings.addingToCart || strings.addToCart : ''}
        </span>
      </button>
      {error && (
        <p className="jc-lookbook__quick-add-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
