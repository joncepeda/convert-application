export default function Skeleton({ count, settings }) {
  return (
    <ul className="jc-lookbook__grid" role="status" aria-live="polite" aria-busy="true">
      <li className="visually-hidden">Loading products…</li>
      {Array.from({ length: count }).map((_, index) => (
        <li className="jc-lookbook__item jc-lookbook__item--skeleton" key={index} aria-hidden="true">
          <div className={`jc-lookbook__media jc-lookbook__media--${settings.imageRatio} jc-lookbook__shimmer`} />
          <div className="jc-lookbook__info">
            <div className="jc-lookbook__shimmer jc-lookbook__shimmer--line" />
            <div className="jc-lookbook__shimmer jc-lookbook__shimmer--line jc-lookbook__shimmer--short" />
          </div>
        </li>
      ))}
    </ul>
  );
}
