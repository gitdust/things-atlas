import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapView } from '@/components/MapView';
import { Timeline } from '@/components/Timeline';
import { FilterBar } from '@/components/FilterBar';
import { ItemDrawer } from '@/components/ItemDrawer';
import { YearModeToggle } from '@/components/YearModeToggle';
import { findItem, loadCategories, loadItemsIndex } from '@/lib/loadItems';
import { filterItems } from '@/lib/yearFilter';
import { itemsToGeoJSON } from '@/lib/geo';
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>{t(lang, 'title')}</h1>
          <p>{t(lang, 'subtitle')}</p>
        </div>
        <YearModeToggle lang={lang} mode={mode} onChange={setMode} />
      </header>

      <FilterBar
        lang={lang}
        categories={categories}
        selected={selectedCategories}
        showDisputed={showDisputed}
        onToggleCategory={(id) => {
          if (selectedCategories.length === 0 && id) {
            // from "all" → single category
            setSelectedCategories([id]);
            return;
          }
          toggleCategory(id);
        }}
        onShowDisputed={setShowDisputed}
        onLang={setLang}
      />

      {/* expose clear-all via clicking all when filtered — handled in FilterBar weakly; add explicit */}
      {selectedCategories.length > 0 ? (
        <div className="filter-hint">
          <button type="button" className="linkish" onClick={clearCategories}>
            {t(lang, 'allCategories')}
          </button>
          <span className="muted">
            {' '}
            · {visible.length}/{index.count}
          </span>
        </div>
      ) : (
        <div className="filter-hint muted">
          {visible.length}/{index.count}
        </div>
      )}

      <main className="stage">
        <MapView
          lang={lang}
          geojson={geojson}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ItemDrawer
          lang={lang}
          item={selectedItem}
          onClose={() => setSelectedId(null)}
        />
      </main>

      <footer className="bottombar">
        <Timeline
          lang={lang}
          year={year}
          min={index.year_range.min}
          max={index.year_range.max}
          onChange={setYear}
        />
        <p className="footer-note">{t(lang, 'footer')}</p>
      </footer>
    </div>
  );
}
