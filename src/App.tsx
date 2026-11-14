import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Guide } from '@/components/Guide';
import { Timeline } from '@/components/Timeline';
import { ItemCatalog } from '@/components/ItemCatalog';
import { SiteHeader } from '@/components/SiteHeader';
import { PanelToggle } from '@/components/PanelToggle';
import { ItemDrawer } from '@/components/ItemDrawer';
import { MapBoundary } from '@/components/MapBoundary';
import { findItem, loadCategories, loadItemsIndex } from '@/lib/loadItems';
import { filterItems } from '@/lib/yearFilter';
import { itemsToArcs, itemsToGeoJSON } from '@/lib/geo';
import { t, type Lang } from '@/lib/i18n';
import { HTML_LANG, applyDocumentMeta } from '@/lib/seo';
import { rememberLang } from '@/lib/locale-pref';
import { itemPath, localizedPath } from '@/lib/page-url';
import { readUrlState, type UrlLike } from '@/lib/urlState';
import { mq } from '@/lib/tokens';
import { getQuizLifecycle, type QuizSnapshot } from '@/lib/quizLifecycle';
import type QuizDialogComponent from '@/components/QuizDialog';

type LoadedQuizDialog = typeof QuizDialogComponent;
let quizDialogPromise: Promise<{ default: LoadedQuizDialog }> | undefined;
function loadQuizDialog() {
  quizDialogPromise ??= import('@/components/QuizDialog');
  return quizDialogPromise;
}

export default function App({ url }: { url?: UrlLike }) {
  const index = useMemo(() => loadItemsIndex(), []);
  const categories = useMemo(() => loadCategories(), []);
  const initial = useMemo(() => readUrlState(url ?? window.location), [url]);

  const [guideRequest, setGuideRequest] = useState(0);
  const [quiz, setQuiz] = useState<QuizSnapshot | null>(null);
  const [QuizDialog, setQuizDialog] = useState<LoadedQuizDialog | null>(null);

  useEffect(() => {
    const controller = getQuizLifecycle(document);
    const unsubscribe = controller.subscribe(() => setQuiz(controller.getSnapshot()));
    setQuiz(controller.getSnapshot());
    return unsubscribe;
  }, []);

  const openQuiz = useCallback(() => {
    if (document.querySelector('dialog[open], .guide-card, .guide-invite')) return;
    void getQuizLifecycle(document).open(async () => {
      const [component, data, logic] = await Promise.all([
        loadQuizDialog(),
        import('@/generated/quiz.json'),
        import('@/lib/quiz'),
      ]);
      setQuizDialog(() => component.default);
      const dataset = data.default;
      return { question: logic.drawQuestion(dataset), dataset };
    });
  }, []);
  const [lang, setLang] = useState<Lang>(initial.lang);
  const [year, setYear] = useState(() =>
    Math.max(
      index.year_range.min,
      Math.min(index.year_range.max, initial.year ?? index.year_range.data_max),
    ),
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const openGuidePanel = useCallback(() => setPanelOpen(true), []);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const catalogViewRef = useRef<HTMLDivElement>(null);
  const catalogFocusRef = useRef<HTMLElement | null>(null);
  const previousSelectionRef = useRef<string | null>(initial.id);
  const [showDisputed, setShowDisputed] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initial.id);
  // Keep the last detail mounted so its exit can fade without timers or losing
  // the catalogue's search and scroll state underneath it. On entry landing
  // pages, defer mounting the catalogue until the user returns to it so SSR
  // HTML and initial DOM stay focused on the entry itself.
  const [detailId, setDetailId] = useState<string | null>(initial.id);
  const [catalogMounted, setCatalogMounted] = useState(() => !findItem(index.items, initial.id));

  const timelineItems = useMemo(
    () => (showDisputed ? index.items : index.items.filter((item) => !item.disputed)),
    [index.items, showDisputed],
  );

  const visible = useMemo(
    () =>
      filterItems(index.items, {
        selectedYear: year,
        showDisputed,
      }),
    [index.items, year, showDisputed],
  );

  const geojson = useMemo(() => itemsToGeoJSON(timelineItems), [timelineItems]);
  const selectedItem = useMemo(() => findItem(index.items, selectedId), [index.items, selectedId]);
  const detailItem = useMemo(() => findItem(index.items, detailId), [index.items, detailId]);

  // URL sync: the selected entry lives in the path (a prerendered, shareable
  // page per entry); year and language live in the query.
  useEffect(() => {
    const params = new URLSearchParams();
    if (year !== index.year_range.data_max) params.set('y', String(year));
    params.delete('lang');
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const query = params.toString();
    const next = `${base}${localizedPath(itemPath(selectedId && selectedItem ? selectedId : null), lang)}${query ? `?${query}` : ''}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', next);
    }
  }, [year, selectedId, selectedItem, lang, index.year_range.data_max]);

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
      if (document.querySelector('dialog[open], .guide-card')) return;
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

  const closeDrawer = useCallback(() => {
    setCatalogMounted(true);
    setSelectedId(null);
  }, []);
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
        if (item.disputed) setShowDisputed(true);
        setYear(item.primary_year);
      }
    },
    [index.items],
  );

  const arcs = useMemo(() => itemsToArcs(timelineItems), [timelineItems]);
  const visibleIds = useMemo(() => new Set(visible.map((i) => i.id)), [visible]);

  const { prevItem, nextItem, entryNo } = useMemo(() => {
    if (!detailId) return { prevItem: null, nextItem: null, entryNo: null };
    const i = timelineItems.findIndex((it) => it.id === detailId);
    if (i < 0) return { prevItem: null, nextItem: null, entryNo: null };
    return {
      prevItem: i > 0 ? timelineItems[i - 1] : null,
      nextItem: i < timelineItems.length - 1 ? timelineItems[i + 1] : null,
      entryNo: i + 1,
    };
  }, [timelineItems, detailId]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === detailItem?.category) ?? null,
    [categories, detailItem],
  );

  useEffect(() => {
    if (!selectedItem) setCatalogMounted(true);
  }, [selectedItem]);

  return (
    <div className={`app${panelOpen ? ' has-drawer' : ' panel-collapsed'}`} lang={HTML_LANG[lang]}>
      <main className="stage">
        <MapBoundary
          lang={lang}
          geojson={geojson}
          arcs={arcs}
          visibleIds={visibleIds}
          panelOpen={panelOpen}
          selectedItem={selectedItem}
          onSelect={selectItem}
        />
        <div className="scrim scrim-top" aria-hidden="true" />
        <div className="scrim scrim-bottom" aria-hidden="true" />
      </main>

      <SiteHeader
        hasSelectedItem={Boolean(selectedItem)}
        lang={lang}
        onLangChange={(next) => {
          rememberLang(next);
          setLang(next);
        }}
        onHelp={() => setGuideRequest((value) => value + 1)}
      />
      <Guide
        autoInvite={!quiz || quiz.phase === 'idle' || quiz.phase === 'dismissed'}
        lang={lang}
        request={guideRequest}
        selectedId={selectedId}
        panelOpen={panelOpen}
        onOpenPanel={openGuidePanel}
      />

      {QuizDialog && quiz && (quiz.phase === 'question' || quiz.phase === 'revealed') && (
        <QuizDialog
          lang={lang}
          question={quiz.question}
          items={quiz.dataset.items}
          selectedId={quiz.phase === 'revealed' ? quiz.selectedId : null}
          onAnswer={(id) => getQuizLifecycle(document).answer(quiz.question.id, id)}
          onDismiss={() => getQuizLifecycle(document).dismiss()}
          onViewItem={(id) => {
            getQuizLifecycle(document).dismiss();
            selectItem(id);
          }}
        />
      )}

      <PanelToggle
        ref={panelToggleRef}
        lang={lang}
        open={panelOpen}
        onOpenChange={changePanelOpen}
        count={index.items.length}
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
          {catalogMounted ? (
            <ItemCatalog
              lang={lang}
              items={index.items}
              showDisputed={showDisputed}
              onShowDisputed={(value) => {
                setShowDisputed(value);
                if (!value && selectedItem?.disputed) {
                  setCatalogMounted(true);
                  setSelectedId(null);
                }
              }}
              onSelect={selectItem}
            />
          ) : null}
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
            prevItem={prevItem}
            nextItem={nextItem}
            eagerImage={detailId === initial.id}
            onClose={closeDrawer}
            onNavigate={selectItem}
          />
        </div>
      </div>

      <div className="map-attribution-slot" id="map-attribution" />

      <footer className="bottombar">
        <button
          type="button"
          className="quiz-launch-button"
          onClick={openQuiz}
          aria-label={t(lang, 'quizPrompt')}
          title={t(lang, 'quizPrompt')}
          aria-haspopup="dialog"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18h6m-5 3h4M8.5 14.5a6 6 0 1 1 7 0c-.9.6-1.5 1.5-1.5 2.5h-4c0-1-.6-1.9-1.5-2.5Z" />
            <path d="M12 1V0M4.2 4.2l-1-1m16.6 1 1-1M2 11H.5M22 11h1.5" />
          </svg>
        </button>

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
