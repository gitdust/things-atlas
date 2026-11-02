import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react';
import type { MapViewProps } from '@/components/MapView';
import { Timeline } from '@/components/Timeline';
import { FilterBar } from '@/components/FilterBar';
import { ItemDrawer } from '@/components/ItemDrawer';
import { MapShell } from '@/components/MapShell';
import { findItem, loadCategories, loadItemsIndex } from '@/lib/loadItems';
import { filterItems } from '@/lib/yearFilter';
import { itemsToArcs, itemsToGeoJSON } from '@/lib/geo';
import { Segmented } from '@/components/Segmented';
import type { CategoryId } from '@/lib/types';
import { t, type Lang } from '@/lib/i18n';
import { HTML_LANG, applyDocumentMeta, itemPath } from '@/lib/seo';
import { readUrlState, type UrlLike } from '@/lib/urlState';

/**
 * MapLibre (~800 kB) is code-split: the shell paints immediately with an
 * empty paper-coloured map area and the map chunk streams in after. During
 * build-time prerendering (no window) the shell is rendered directly.
 */
const MapView: ComponentType<MapViewProps> =
  typeof window === 'undefined'
    ? ({ lang }) => <MapShell lang={lang} />
    : lazy(() => import('@/components/MapView').then((m) => ({ default: m.MapView })));

export default function App({ url }: { url?: UrlLike }) {
  const index = useMemo(() => loadItemsIndex(), []);
  const categories = useMemo(() => loadCategories(), []);
  const initial = useMemo(() => readUrlState(url ?? window.location), [url]);

  const [lang, setLang] = useState<Lang>(initial.lang);
  const [year, setYear] = useState(() => {
    const y = initial.year ?? index.year_range.data_max;
    if (!initial.id) return y;
    const item = findItem(index.items, initial.id);
    // Deep link / ?id= must land with the entry visible on the cumulative timeline.
    if (item && item.primary_year > y) return Math.min(index.year_range.max, item.primary_year);
    return y;
  });
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>(initial.categories);
  const [showDisputed, setShowDisputed] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initial.id);

  const visible = useMemo(
    () =>
      filterItems(index.items, {
        selectedYear: year,
        categories: selectedCategories,
        showDisputed,
      }),
    [index.items, year, selectedCategories, showDisputed],
  );

  const geojson = useMemo(() => itemsToGeoJSON(visible), [visible]);
  const selectedItem = useMemo(() => findItem(index.items, selectedId), [index.items, selectedId]);

  // URL sync: the selected entry lives in the path (a prerendered, shareable
  // page per entry); year / categories / language in the query.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('y', String(year));
    if (selectedCategories.length) params.set('cat', selectedCategories.join(','));
    if (lang === 'en') params.set('lang', 'en');
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const next = `${base}${itemPath(selectedId && selectedItem ? selectedId : null)}?${params}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', next);
    }
  }, [year, selectedCategories, selectedId, selectedItem, lang]);

  // <html lang>, <title>, description, canonical and social tags follow the UI.
  useEffect(() => {
    applyDocumentMeta(lang, selectedItem, index.count);
  }, [lang, selectedItem, index.count]);

  // Prerendered markup is hidden when the URL asks for a different state
  // than the one baked into the HTML (see index.html); reveal once rendered.
  useEffect(() => {
    document.documentElement.classList.remove('ssr-stale');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setYear((y) => Math.max(index.year_range.min, y - (e.shiftKey ? 10 : 1)));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setYear((y) => Math.min(index.year_range.max, y + (e.shiftKey ? 10 : 1)));
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

  /** Open an entry and scrub the timeline forward so cumulative filter includes it. */
  const selectItem = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      const item = findItem(index.items, id);
      if (!item) return;
      setYear((y) =>
        item.primary_year > y ? Math.min(index.year_range.max, item.primary_year) : y,
      );
    },
    [index.items, index.year_range.max],
  );

  const arcs = useMemo(() => itemsToArcs(visible), [visible]);
  const visibleIds = useMemo(() => new Set(visible.map((i) => i.id)), [visible]);

  /** Per-category counts at the current year (ignoring the category filter). */
  const counts = useMemo(() => {
    const pool = filterItems(index.items, {
      selectedYear: year,
      categories: [],
      showDisputed,
    });
    const out: Partial<Record<CategoryId, number>> = {};
    for (const i of pool) out[i.category] = (out[i.category] ?? 0) + 1;
    return out;
  }, [index.items, year, showDisputed]);

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
    <div className={`app${selectedItem ? ' has-drawer' : ''}`} lang={HTML_LANG[lang]}>
      <main className="stage">
        <Suspense fallback={<MapShell lang={lang} />}>
          <MapView
            lang={lang}
            geojson={geojson}
            arcs={arcs}
            selectedItem={selectedItem}
            onSelect={selectItem}
          />
        </Suspense>
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
          <a
            className="github-link"
            href="https://github.com/gitdust/things-atlas"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.922c.563.104.768-.244.768-.543 0-.267-.01-.975-.015-1.913-3.13.68-3.79-1.508-3.79-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.078-.685.078-.685 1.13.08 1.725 1.16 1.725 1.16 1.005 1.723 2.637 1.225 3.28.937.102-.728.393-1.225.715-1.507-2.5-.285-5.128-1.25-5.128-5.565 0-1.23.44-2.233 1.16-3.02-.117-.285-.503-1.43.11-2.98 0 0 .945-.302 3.095 1.154a10.8 10.8 0 0 1 5.625 0c2.15-1.456 3.093-1.154 3.093-1.154.615 1.55.229 2.695.112 2.98.722.787 1.158 1.79 1.158 3.02 0 4.326-2.632 5.277-5.14 5.556.404.35.765 1.043.765 2.1 0 1.516-.014 2.739-.014 3.11 0 .302.203.652.774.542A11.25 11.25 0 0 0 12 .75Z" />
            </svg>
          </a>
          <Segmented<Lang>
            size="sm"
            ariaLabel={t(lang, 'language')}
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
            setSelectedCategories([id]);
            return;
          }
          toggleCategory(id);
        }}
        onClearCategories={clearCategories}
        onShowDisputed={setShowDisputed}
      />

      <ItemDrawer
        lang={lang}
        item={selectedItem}
        entryNo={entryNo}
        category={selectedCategory}
        eagerImage={selectedId === initial.id}
        onClose={closeDrawer}
      />

      <footer className="bottombar">
        <Timeline
          lang={lang}
          year={year}
          min={index.year_range.min}
          max={index.year_range.max}
          items={index.items}
          visibleIds={visibleIds}
          selectedId={selectedId}
          onChange={setYear}
          onSelect={selectItem}
        />
        <div className="footer-row">
          <ul className="legend" aria-label={t(lang, 'legend')}>
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
              {t(lang, 'legendArc')}
            </li>
          </ul>
          <p className="footer-note">{t(lang, 'footer')}</p>
        </div>
      </footer>
    </div>
  );
}
