import { Star } from 'lucide-react';

/**
 * Star rating, used both for read-only display and as a keyboard-accessible
 * radio-style input.
 *
 * Display:  <StarRating value={4.5} count={23} />
 * Input:    <StarRating value={rating} onChange={setRating} label="..." />
 */
export default function StarRating({
  value = 0,
  count,
  onChange,
  size = 'md',
  className = '',
  label
}) {
  const interactive = typeof onChange === 'function';
  const dims = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  const rounded = Math.round(Number(value) * 2) / 2;

  if (interactive) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={Number(value) === star}
            aria-label={String(star)}
            onClick={() => onChange(star)}
            className="rounded-md p-0.5 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <Star
              className={`${dims} transition ${
                star <= Number(value)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-sand-300 dark:text-white/25'
              }`}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${dims} ${
              star <= rounded
                ? 'fill-amber-400 text-amber-400'
                : star - 0.5 === rounded
                  ? 'fill-amber-400/50 text-amber-400'
                  : 'text-sand-300 dark:text-white/25'
            }`}
          />
        ))}
      </span>
      <span className="text-xs font-semibold text-ink-soft">
        {Number(value || 0).toFixed(1)}
        {typeof count === 'number' && (
          <span className="font-normal text-ink-muted"> ({count})</span>
        )}
      </span>
      <span className="sr-only">
        {Number(value || 0).toFixed(1)} / 5
      </span>
    </span>
  );
}
