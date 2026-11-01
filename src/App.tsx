import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapView } from '@/components/MapView';
import { Timeline } from '@/components/Timeline';
import { FilterBar } from '@/components/FilterBar';
import { ItemDrawer } from '@/components/ItemDrawer';
import { YearModeToggle } from '@/components/YearModeToggle';
import { findItem, loadCategories, loadItemsIndex } from '@/lib/loadItems';
import { filterItems } from '@/lib/yearFilter';
import { itemsToArcs, itemsToGeoJSON } from '@/lib/geo';
import { Segmented } from '@/components/Segmented';
import type { CategoryId, YearMode } from '@/lib/types';
import { t, type Lang } from '@/lib/i18n';

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const y = params.get('y');
  const mode = params.get('mode');
  const cat = params.get('cat');
  const id = params.get('id');
  return {
    year: y ? Number(y) : null,
    mode: mode === 'snapshot' ? ('snapshot' as const) : ('cumulative' as const),
    categories: cat
      ? (cat.split(',').filter(Boolean) as CategoryId[])
      : ([] as CategoryId[]),
    id,
  };
}

export default function App() {
  const index = useMemo(() => loadItemsIndex(), []);
  const categories = useMemo(() => loadCategories(), []);
  const initial = useMemo(() => readUrlState(), []);

  const [lang, setLang] = useState<Lang>('zh');
  const [mode, setMode] = useState<YearMode>(initial.mode);
  const [year, setYear] = useState(
    initial.year ?? index.year_range.data_max,
  );
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>(
    initial.categories,
  );
  const [showDisputed, setShowDisputed] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initial.id);

  const visible = useMemo(
    () =>
      filterItems(index.items, {
        selectedYear: year,
        mode,
        categories: selectedCategories,
        showDisputed,
      }),
    [index.items, year, mode, selectedCategories, showDisputed],
  );

  const geojson = useMemo(() => itemsToGeoJSON(visible), [visible]);
  const selectedItem = useMemo(
    () => findItem(index.items, selectedId),
    [index.items, selectedId],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('y', String(year));
    params.set('mode', mode);
    if (selectedCategories.length)
      params.set('cat', selectedCategories.join(','));
    if (selectedId) params.set('id', selectedId);
    const next = `?${params.toString()}`;
    if (next !== window.location.search) {
      window.history.replaceState(null, '', next);
    }
  }, [year, mode, selectedCategories, selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setYear((y) =>
          Math.max(index.year_range.min, y - (e.shiftKey ? 10 : 1)),
        );
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setYear((y) =>
          Math.min(index.year_range.max, y + (e.shiftKey ? 10 : 1)),
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index.year_range.min, index.year_range.max]);

  const toggleCategory = useCallback((id: CategoryId) => {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      return [...prev, id];
    });
  }, []);

  const clearCategories = useCallback(() => setSelectedCategories([]), []);
  const closeDrawer = useCallback(() => setSelectedId(null), []);

  const arcs = useMemo(() => itemsToArcs(visible), [visible]);
  const visibleIds = useMemo(() => new Set(visible.map((i) => i.id)), [visible]);

  /** Per-category counts at the current year (ignoring the category filter). */
  const counts = useMemo(() => {
    const pool = filterItems(index.items, {
      selectedYear: year,
      mode,
      categories: [],
      showDisputed,
    });
    const out: Partial<Record<CategoryId, number>> = {};
    for (const i of pool) out[i.category] = (out[i.category] ?? 0) + 1;
    return out;
  }, [index.items, year, mode, showDisputed]);

  const entryNo = useMemo(() => {
    if (!selectedId) return null;
    const i = index.items.findIndex((it) => it.id === selectedId);
    return i >= 0 ? i + 1 : null;
  }, [index.items, selectedId]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedItem?.category) ?? null,
    [categories, selectedItem],
  );

  return (
    <div className={`app${selectedItem ? ' has-drawer' : ''}`} lang={lang === 'zh' ? 'zh-Hans' : 'en'}>
      <main className="stage">
        <MapView
          lang={lang}
          geojson={geojson}
          arcs={arcs}
          selectedItem={selectedItem}
          onSelect={setSelectedId}
        />
        <div className="scrim scrim-top" aria-hidden="true" />
        <div className="scrim scrim-bottom" aria-hidden="true" />
      </main>

      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="17.5" />
            <ellipse cx="20" cy="20" rx="7.5" ry="17.5" />
            <path d="M2.5 20h35M5 11.5h30M5 28.5h30" />
            <circle className="brand-pin" cx="26.5" cy="14" r="3.2" />
          </svg>
          <div className="brand-text">
            <h1>
              <span className="brand-en">Things Atlas</span>
              <span className="brand-dot">·</span>
              <span className="brand-zh">日常之物图志</span>
            </h1>
            <p className="brand-tagline">{t(lang, 'tagline')}</p>
          </div>
        </div>

        <div className="top-controls">
          <YearModeToggle lang={lang} mode={mode} onChange={setMode} />
          <Segmented<Lang>
            size="sm"
            ariaLabel="Language"
            value={lang}
            onChange={setLang}
            options={[
              { value: 'zh', label: '中' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>
      </header>

      <FilterBar
        lang={lang}
        categories={categories}
        selected={selectedCategories}
        counts={counts}
        showDisputed={showDisputed}
        visibleCount={visible.length}
        totalCount={index.count}
        onToggleCategory={(id) => {
          if (selectedCategories.length === 0 && id) {
            // from "all" → single category
            setSelectedCategories([id]);
            return;
          }
          toggleCategory(id);
        }}
        onClearCategories={clearCategories}
        onShowDisputed={setShowDisputed}
      />

      {visible.length === 0 ? (
        <div className="empty-hint" role="status">
          {t(lang, 'empty')}
        </div>
      ) : null}

      <ItemDrawer
        lang={lang}
        item={selectedItem}
        entryNo={entryNo}
        category={selectedCategory}
        onClose={closeDrawer}
      />

      <footer className="bottombar">
        <Timeline
          lang={lang}
          year={year}
          min={index.year_range.min}
          max={index.year_range.max}
          mode={mode}
          items={index.items}
          visibleIds={visibleIds}
          selectedId={selectedId}
          onChange={setYear}
          onSelect={setSelectedId}
        />
        <div className="footer-row">
          <ul className="legend" aria-label="Legend">
            <li>
              <span className="lg-dot" />
              {t(lang, 'legendPlace')}
            </li>
            <li>
              <span className="lg-dot hollow" />
              {t(lang, 'legendContested')}
            </li>
            <li>
              <span className="lg-arc" />
              {lang === 'zh' ? '同一条目的地点连线' : 'Places of one entry'}
            </li>
          </ul>
          <p className="footer-note">{t(lang, 'footer')}</p>
        </div>
      </footer>
    </div>
  );
}
