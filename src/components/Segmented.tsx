type Option<T extends string> = { value: T; label: string; lang?: string };

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
      onKeyDown={(event) => {
        let next: number;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
          next = (idx + 1) % options.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
          next = (idx - 1 + options.length) % options.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = options.length - 1;
        else return;
        if (!options[next]) return;
        event.preventDefault();
        event.stopPropagation();
        onChange(options[next].value);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
      }}
      style={{
        ['--seg-n' as string]: options.length,
        ['--seg-i' as string]: idx,
      }}
    >
      <span className="seg-indicator" aria-hidden="true" />
      {options.map((o, i) => (
        <button
          key={o.value}
          lang={o.lang}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === idx ? 0 : -1}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
