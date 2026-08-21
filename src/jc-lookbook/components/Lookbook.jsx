import ProductCard from './ProductCard.jsx';
import Skeleton from './Skeleton.jsx';
import { resize, srcSet } from '../lib/image.js';

/**
 * One lookbook: optional hero image, heading/description, then the products
 * resolved from the metaobject's handle list.
 *
 * Handles that no longer resolve (unpublished, deleted, or outside the current
 * market) are dropped silently rather than rendering a broken card.
 */
export default function Lookbook({ lookbook, products, status, settings, shop, strings, showTitle = true }) {
  const resolved = lookbook.handles.map((handle) => products[handle]).filter(Boolean);
  const isLoading = status === 'loading';

  if (!isLoading && !resolved.length) return null;

  const heading = showTitle && lookbook.title;
  const description = settings.showDescription && lookbook.description;

  const gridStyle = {
    '--jc-lookbook-columns-desktop': settings.columnsDesktop,
    '--jc-lookbook-columns-mobile': settings.columnsMobile,
  };

  return (
    <article className="jc-lookbook__entry">
      {lookbook.hero_image && (
        <div className="jc-lookbook__hero">
          <img
            src={resize(lookbook.hero_image.url, 1440)}
            srcSet={srcSet(lookbook.hero_image.url, lookbook.hero_image.width || 1440)}
            sizes="(min-width: 990px) 1200px, 100vw"
            alt={lookbook.hero_image.alt || lookbook.title}
            width={lookbook.hero_image.width || undefined}
            height={lookbook.hero_image.height || undefined}
            loading="lazy"
          />
        </div>
      )}

      {/*
        `showTitle` is false when the section carries a title override: the
        heading has already been rendered once, above every lookbook. The
        description stays either way — it belongs to this lookbook, not to the
        section — so the header is only dropped when it would be empty.
      */}
      {(heading || description) && (
        <header className="jc-lookbook__header">
          {heading && <h2 className={`jc-lookbook__title ${settings.headingSize}`}>{lookbook.title}</h2>}
          {description && <p className="jc-lookbook__description">{lookbook.description}</p>}
        </header>
      )}

      {isLoading ? (
        <Skeleton count={Math.min(lookbook.handles.length, settings.columnsDesktop)} settings={settings} />
      ) : (
        <ul
          className={`jc-lookbook__grid jc-lookbook__grid--${settings.layout}`}
          style={gridStyle}
        >
          {resolved.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              settings={settings}
              shop={shop}
              strings={strings}
            />
          ))}
        </ul>
      )}
    </article>
  );
}
