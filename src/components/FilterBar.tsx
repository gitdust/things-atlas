import type { CategoryId, CategoryMeta } from '@/lib/types';
import { t, type Lang } from '@/lib/i18n';

type Props = {
  lang: Lang;
  categories: CategoryMeta[];
  selected: CategoryId[];
  showDisputed: boolean;
  onToggleCategory: (id: CategoryId) => void;
  onShowDisputed: (v: boolean) => void;
  onLang: (lang: Lang) => void;
};

export function FilterBar({
  lang,
  categories,
  selected,
  showDisputed,
  onToggleCategory,
  onShowDisputed,
  onLang,
}: Props) {
  const allSelected = selected.length === 0;

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <span className="filter-label">{t(lang, 'categories')}</span>
        <button
          type="button"
          className={allSelected ? 'chip active' : 'chip'}
          onClick={() => {
            // empty = all
            if (!allSelected) {
              // clear selection → all
              selected.forEach((id) => onToggleCategory(id));
            }
          }}
        >
          {t(lang, 'allCategories')}
        </button>
        {categories
          .filter((c) => c.id !== 'kitchen')
          .map((c) => {
            const active = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={active ? 'chip active' : 'chip'}
                style={{ ['--chip-color' as string]: c.color }}
                onClick={() => onToggleCategory(c.id)}
              >
                {lang === 'zh' ? c.name_zh : c.name_en}
              </button>
            );
          })}
      </div>
      <div className="filter-row">
        <label className="check">
          <input
            type="checkbox"
            checked={showDisputed}
            onChange={(e) => onShowDisputed(e.target.checked)}
          />
          {t(lang, 'showDisputed')}
        </label>
        <div className="segmented compact">
          <button
            type="button"
            className={lang === 'zh' ? 'active' : ''}
            onClick={() => onLang('zh')}
          >
            中文
          </button>
          <button
            type="button"
            className={lang === 'en' ? 'active' : ''}
            onClick={() => onLang('en')}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}
