type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: 'md' | 'sm';
};

/** Segmented control with a sliding indicator (equal-width segments). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
}: Props<T>) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      className={`segmented seg-${size}`}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        ['--seg-n' as string]: options.length,
        ['--seg-i' as string]: idx,
      }}
    >
      <span className="seg-indicator" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
