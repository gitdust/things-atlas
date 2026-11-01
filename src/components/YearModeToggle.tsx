import type { YearMode } from '@/lib/types';
import { t, type Lang } from '@/lib/i18n';
import { Segmented } from './Segmented';

type Props = {
  lang: Lang;
  mode: YearMode;
  onChange: (mode: YearMode) => void;
};

export function YearModeToggle({ lang, mode, onChange }: Props) {
  return (
    <Segmented<YearMode>
      ariaLabel={t(lang, 'yearMode')}
      value={mode}
      onChange={onChange}
      options={[
        { value: 'cumulative', label: t(lang, 'cumulative') },
        { value: 'snapshot', label: t(lang, 'snapshot') },
      ]}
    />
  );
}
