import { formatMoney, resolvePricing } from '../lib/money.js';

export default function Price({ product, locale, strings }) {
  const { price, compareAt, onSale, fromPrice, percentOff } = resolvePricing(product);
  if (!price) return null;

  const formatted = formatMoney(price, locale);

  return (
    <div className={`jc-lookbook__price${onSale ? ' jc-lookbook__price--on-sale' : ''}`}>
      {fromPrice && <span className="jc-lookbook__price-prefix">{strings.from}</span>}
      <span className="jc-lookbook__price-current">
        <span className="visually-hidden">{onSale ? strings.salePrice : strings.regularPrice}</span>
        {formatted}
      </span>
      {compareAt && (
        <span className="jc-lookbook__price-compare">
          <span className="visually-hidden">{strings.regularPrice}</span>
          <s>{formatMoney(compareAt, locale)}</s>
        </span>
      )}
      {onSale && percentOff > 0 && (
        <span className="jc-lookbook__badge jc-lookbook__badge--sale">{strings.save.replace('{{ percent }}', percentOff)}</span>
      )}
    </div>
  );
}
