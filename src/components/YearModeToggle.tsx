import type { YearMode } from '@/lib/types';
import { t, type Lang } from '@/lib/i18n';

type Props = {
  lang: Lang;
  mode: YearMode;
  onChange: (mode: YearMode) => void;
};

export function YearModeToggle({ lang, mode, onChange }: Props) {
  return (
    <div className="segmented" role="group" aria-label="Year mode">
      <button
        type="button"
        className={mode === 'cumulative' ? 'active' : ''}
        onClick={() => onChange('cumulative')}
      >
        {t(lang, 'cumulative')}
      </button>
      <button
        type="button"
        className={mode === 'snapshot' ? 'active' : ''}
        onClick={() => onChange('snapshot')}
      >
        {t(lang, 'snapshot')}
      </button>
    </div>
  );
}
