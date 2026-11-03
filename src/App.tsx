import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import type { MapViewProps } from '@/components/MapView';
import { Timeline } from '@/components/Timeline';
import { ItemCatalog } from '@/components/ItemCatalog';
import { SiteHeader } from '@/components/SiteHeader';
import { PanelToggle } from '@/components/PanelToggle';
import { ItemDrawer } from '@/components/ItemDrawer';
import { MapShell } from '@/components/MapShell';
import { findItem, loadCategories, loadItemsIndex } from '@/lib/loadItems';
import { filterItems } from '@/lib/yearFilter';
import { itemsToArcs, itemsToGeoJSON } from '@/lib/geo';
import { t, type Lang } from '@/lib/i18n';
import { HTML_LANG, applyDocumentMeta, itemPath } from '@/lib/seo';
import { readUrlState, type UrlLike } from '@/lib/urlState';
import { mq } from '@/lib/tokens';

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
  const [panelOpen, setPanelOpen] = useState(true);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const catalogViewRef = useRef<HTMLDivElement>(null);
  const catalogFocusRef = useRef<HTMLElement | null>(null);
  const previousSelectionRef = useRef<string | null>(initial.id);
  const [showDisputed, setShowDisputed] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initial.id);
  // Keep the last detail mounted so its exit can fade without timers or losing
  // the catalogue's search and scroll state underneath it.
  const [detailId, setDetailId] = useState<string | null>(initial.id);

  const visible = useMemo(
    () =>
      filterItems(index.items, {
        selectedYear: year,
        categories: [],
        showDisputed,
      }),
    [index.items, year, showDisputed],
  );

  const geojson = useMemo(() => itemsToGeoJSON(visible), [visible]);
  const selectedItem = useMemo(() => findItem(index.items, selectedId), [index.items, selectedId]);
  const detailItem = useMemo(() => findItem(index.items, detailId), [index.items, detailId]);

  // URL sync: the selected entry lives in the path (a prerendered, shareable
  // page per entry); year and language live in the query.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('y', String(year));
    if (lang === 'en') params.set('lang', 'en');
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const next = `${base}${itemPath(selectedId && selectedItem ? selectedId : null)}?${params}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', next);
    }
  }, [year, selectedId, selectedItem, lang]);

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
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelector('dialog[open]')) return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest(
          'a, button, input, textarea, select, [role=slider], [role=radio], [role=radiogroup]',
        ) ||
          e.target.isContentEditable)
      ) {
        return;
      }
      if (window.matchMedia(mq.mobile).matches) return;
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

  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const changePanelOpen = useCallback((open: boolean) => {
    if (!open) panelToggleRef.current?.focus({ preventScroll: true });
    setPanelOpen(open);
  }, []);

  useEffect(() => {
    const previous = previousSelectionRef.current;
    previousSelectionRef.current = selectedId;
    if (!previous || selectedId || !panelOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const origin = catalogFocusRef.current;
      const matchingRow = catalogViewRef.current?.querySelector<HTMLButtonElement>(
        `button[data-item-id="${previous}"]`,
      );
      const fallback =
        matchingRow ??
        catalogViewRef.current?.querySelector<HTMLInputElement>('input[type=search]');
      (origin?.isConnected ? origin : fallback)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, panelOpen]);
  const selectItem = useCallback(
    (id: string | null) => {
      const focused = document.activeElement;
      catalogFocusRef.current =
        focused instanceof HTMLElement && catalogViewRef.current?.contains(focused)
          ? focused
          : null;
      setSelectedId(id);
      if (id) setDetailId(id);
      setPanelOpen(true);
      const item = findItem(index.items, id);
      if (item) {
        setYear(item.primary_year);
        if (item.disputed) setShowDisputed(true);
      }
    },
    [index.items],
  );

  const timelineItems = useMemo(
    () => (showDisputed ? index.items : index.items.filter((item) => !item.disputed)),
    [index.items, showDisputed],
  );

  const arcs = useMemo(() => itemsToArcs(visible), [visible]);
  const visibleIds = useMemo(() => new Set(visible.map((i) => i.id)), [visible]);

  const entryNo = useMemo(() => {
    if (!detailId) return null;
    const i = index.items.findIndex((it) => it.id === detailId);
    return i >= 0 ? i + 1 : null;
  }, [index.items, detailId]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === detailItem?.category) ?? null,
    [categories, detailItem],
  );

  return (
    <div className={`app${panelOpen ? ' has-drawer' : ' panel-collapsed'}`} lang={HTML_LANG[lang]}>
      <main className="stage">
        <Suspense fallback={<MapShell lang={lang} />}>
          <MapView
            lang={lang}
            geojson={geojson}
            arcs={arcs}
            panelOpen={panelOpen}
            selectedItem={selectedItem}
            onSelect={selectItem}
          />
        </Suspense>
        <div className="scrim scrim-top" aria-hidden="true" />
        <div className="scrim scrim-bottom" aria-hidden="true" />
      </main>

      <SiteHeader lang={lang} onLangChange={setLang} />

      <PanelToggle
        ref={panelToggleRef}
        lang={lang}
        open={panelOpen}
        onOpenChange={changePanelOpen}
      />
      <div
        className="entry-panel"
        id="entry-panel"
        aria-hidden={!panelOpen}
        {...(!panelOpen ? { inert: '' } : {})}
      >
        <div
          ref={catalogViewRef}
          className={`panel-view catalog-view${selectedItem ? '' : ' is-active'}`}
          aria-hidden={!!selectedItem}
          {...(selectedItem ? { inert: '' } : {})}
        >
          <ItemCatalog
            lang={lang}
            items={index.items}
            showDisputed={showDisputed}
            onShowDisputed={(value) => {
              setShowDisputed(value);
              if (!value && selectedItem?.disputed) setSelectedId(null);
            }}
            onSelect={selectItem}
          />
        </div>
        <div
          className={`panel-view detail-view${selectedItem ? ' is-active' : ''}`}
          aria-hidden={!selectedItem}
          {...(!selectedItem ? { inert: '' } : {})}
        >
          <ItemDrawer
            lang={lang}
            item={detailItem}
            active={panelOpen && !!selectedItem}
            entryNo={entryNo}
            category={selectedCategory}
            eagerImage={detailId === initial.id}
            onClose={closeDrawer}
          />
        </div>
      </div>

      <div className="map-attribution-slot" id="map-attribution" />

      <footer className="bottombar">
        <Timeline
          lang={lang}
          year={year}
          min={index.year_range.min}
          max={index.year_range.max}
          items={timelineItems}
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
