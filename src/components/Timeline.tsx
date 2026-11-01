import { t, type Lang } from '@/lib/i18n';

type Props = {
  lang: Lang;
  year: number;
  min: number;
  max: number;
  onChange: (year: number) => void;
};

export function Timeline({ lang, year, min, max, onChange }: Props) {
  return (
    <div className="timeline">
      <label htmlFor="year-scrubber">
        {t(lang, 'year')}: <strong>{year}</strong>
      </label>
      <input
        id="year-scrubber"
        type="range"
        min={min}
        max={max}
        step={1}
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="timeline-ends">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
