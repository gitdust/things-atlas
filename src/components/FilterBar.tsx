import type { CategoryId, CategoryMeta } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/theme';
import { t, type Lang } from '@/lib/i18n';

type Props = {
  lang: Lang;
  categories: CategoryMeta[];
  selected: CategoryId[];
  counts: Partial<Record<CategoryId, number>>;
  showDisputed: boolean;
  visibleCount: number;
  totalCount: number;
  onToggleCategory: (id: CategoryId) => void;
  onClearCategories: () => void;
  onShowDisputed: (v: boolean) => void;
};

export function FilterBar({
  lang,
  categories,
  selected,
  counts,
  showDisputed,
  visibleCount,
  totalCount,
  onToggleCategory,
  onClearCategories,
  onShowDisputed,
}: Props) {
  const allSelected = selected.length === 0;

  return (
    <div className="filter-bar" role="toolbar" aria-label={t(lang, 'categories')}>
      <div className="chips">
        <button
          type="button"
          className={allSelected ? 'chip active' : 'chip'}
          aria-pressed={allSelected}
          onClick={onClearCategories}
        >
          {t(lang, 'allCategories')}
        </button>
        {categories
          .filter((c) => c.id !== 'kitchen')
          .map((c) => {
            const active = selected.includes(c.id);
            const n = counts[c.id] ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                className={`chip${active ? ' active' : ''}${n === 0 ? ' empty' : ''}`}
                aria-pressed={active}
                style={{ ['--chip-color' as string]: CATEGORY_COLORS[c.id] }}
                onClick={() => onToggleCategory(c.id)}
              >
                <span className="chip-dot" aria-hidden="true" />
                {lang === 'zh' ? c.name_zh : c.name_en}
                {n > 0 ? <span className="chip-count num">{n}</span> : null}
              </button>
            );
          })}
      </div>

      <div className="filter-tail">
        <label className="switch">
          <input
            type="checkbox"
            checked={showDisputed}
            onChange={(e) => onShowDisputed(e.target.checked)}
          />
          <span className="switch-track" aria-hidden="true">
            <span className="switch-knob" />
          </span>
          <span>{t(lang, 'showDisputed')}</span>
        </label>
        <span className="count num" aria-live="polite">
          <strong>{visibleCount}</strong>
          <span className="count-sep">/</span>
          {totalCount}
          <span className="count-label"> {t(lang, 'shown')}</span>
        </span>
      </div>
    </div>
  );
}
