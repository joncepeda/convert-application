import { useState } from 'react';
import Price from './Price.jsx';
import { resize, srcSet } from '../lib/image.js';
import { productUrl } from '../lib/product-url.js';

export default function ProductCard({ product, settings, shop, strings }) {
  const [hovered, setHovered] = useState(false);

  const images = product.images?.nodes || [];
  const primary = product.featuredImage || images[0] || null;
  const secondary = images.find((image) => image.url !== primary?.url) || null;
  const showSecondary = settings.showSecondaryImage && secondary && hovered;
  const image = showSecondary ? secondary : primary;
  const soldOut = product.availableForSale === false;

  return (
    <li className="jc-lookbook__item">
      <a
        className="jc-lookbook__card"
        href={productUrl(shop.rootUrl, product.handle)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <div className={`jc-lookbook__media jc-lookbook__media--${settings.imageRatio}`}>
          {image ? (
            <img
              className="jc-lookbook__image"
              src={resize(image.url, 720)}
              srcSet={srcSet(image.url, image.width || 1440)}
              sizes="(min-width: 990px) 25vw, (min-width: 750px) 33vw, 50vw"
              alt={image.altText || product.title}
              loading="lazy"
              width={image.width || undefined}
              height={image.height || undefined}
            />
          ) : (
            <div className="jc-lookbook__image jc-lookbook__image--placeholder" aria-hidden="true" />
          )}
          {soldOut && <span className="jc-lookbook__badge jc-lookbook__badge--sold-out">{strings.soldOut}</span>}
        </div>

        <div className="jc-lookbook__info">
          {settings.showVendor && product.vendor && <p className="jc-lookbook__vendor">{product.vendor}</p>}
          <h3 className="jc-lookbook__product-title">{product.title}</h3>
          {settings.showPrice && <Price product={product} locale={shop.locale} strings={strings} />}
        </div>
      </a>
    </li>
  );
}
