import { useEffect, useMemo, useState } from 'react';
import Lookbook from './components/Lookbook.jsx';
import { currencyOf, fetchProductsByHandle } from './lib/storefront.js';

export default function App({ config }) {
  const { lookbooks, settings, shop, strings, designMode } = config;

  const [products, setProducts] = useState({});
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [currencyMismatch, setCurrencyMismatch] = useState(null);

  // Every lookbook in this section is resolved in one deduped round trip.
  const handles = useMemo(
    () => Array.from(new Set(lookbooks.flatMap((lookbook) => lookbook.handles))),
    [lookbooks]
  );

  useEffect(() => {
    let cancelled = false;

    if (!handles.length) {
      setStatus('ready');
      return undefined;
    }

    if (!shop.token) {
      setError('Missing Storefront API access token (Theme settings → Lookbook).');
      setStatus('error');
      return undefined;
    }

    setStatus('loading');

    fetchProductsByHandle(handles, shop)
      .then((result) => {
        if (cancelled) return;

        // Shopify falls back to the shop's default currency when @inContext
        // cannot resolve a market for the country — silently, and with
        // plausible-looking numbers. Compare what came back against the
        // currency Liquid says this market trades in so the failure surfaces
        // instead of quietly showing the wrong money.
        const returned = Object.values(result).map(currencyOf).find(Boolean);
        if (returned && shop.currency && returned !== shop.currency) {
          const message =
            `[jc-lookbook] Expected ${shop.currency} for country ${shop.country} but the ` +
            `Storefront API returned ${returned}. Check that ${shop.country} belongs to an ` +
            'active market and that the Storefront API token can read it.';
          console.warn(message);
          setCurrencyMismatch({ expected: shop.currency, returned });
        } else {
          setCurrencyMismatch(null);
        }

        setProducts(result);
        setStatus('ready');
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [handles, shop]);

  if (status === 'error') {
    // Merchants need to see the cause in the theme editor; shoppers never
    // should, so the section simply collapses on the live storefront.
    if (!designMode) return null;
    return (
      <div className="jc-lookbook__notice" role="alert">
        <strong>Lookbook could not load.</strong> {error}
      </div>
    );
  }

  const visible = lookbooks.filter(
    (lookbook) => status === 'loading' || lookbook.handles.some((handle) => products[handle])
  );

  if (!visible.length) {
    if (!designMode) return null;
    return (
      <div className="jc-lookbook__notice" role="status">
        <strong>No products to show.</strong> Check that the product handles in this lookbook are
        published to the online store and available in this market.
      </div>
    );
  }

  // A title override speaks for the section as a whole, so it replaces the
  // per-lookbook headings rather than stacking a second heading on top of them.
  const sectionTitle = (settings.titleOverride || '').trim();

  return (
    <>
      {sectionTitle && (
        <header className="jc-lookbook__section-header">
          <h2 className={`jc-lookbook__section-title ${settings.headingSize}`}>{sectionTitle}</h2>
        </header>
      )}
      <div className="jc-lookbook__entries">
        {designMode && currencyMismatch && (
          <div className="jc-lookbook__notice" role="alert">
            <strong>Wrong currency.</strong> This market trades in {currencyMismatch.expected} but
            the Storefront API returned {currencyMismatch.returned} for country {shop.country}.
            Confirm that {shop.country} is in an active market and that the Storefront API token can
            read it.
          </div>
        )}
        {visible.map((lookbook) => (
          <Lookbook
            key={lookbook.id}
            lookbook={lookbook}
            products={products}
            status={status}
            settings={settings}
            shop={shop}
            strings={strings}
            showTitle={!sectionTitle}
          />
        ))}
      </div>
    </>
  );
}
