import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t, type Lang } from '@/lib/i18n';
import { mq } from '@/lib/tokens';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const STORAGE_KEY = 'things-atlas.guide.v1';
type Rect = { left: number; top: number; width: number; height: number };
type Props = {
  lang: Lang;
  autoInvite: boolean;
  request: number;
  selectedId: string | null;
  panelOpen: boolean;
  onOpenPanel: () => void;
};

export function Guide({ lang, autoInvite, request, selectedId, panelOpen, onOpenPanel }: Props) {
  const [phase, setPhase] = useState(-2); // hidden, invitation, then numbered steps
  const [mobile, setMobile] = useState(false);
  const [target, setTarget] = useState<Rect | null>(null);
  const [position, setPosition] = useState({ left: 16, top: 112 });
  const cardRef = useRef<HTMLDivElement>(null);
  const previousSelection = useRef(selectedId);
  const total = mobile ? 2 : 3;

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'done');
    } catch {
      /* Storage can be unavailable. */
    }
    if (cardRef.current?.contains(document.activeElement)) {
      document.querySelector<HTMLButtonElement>('.guide-help')?.focus({ preventScroll: true });
    }
    setPhase(-2);
  }, []);

  const next = useCallback(() => {
    if (phase >= total - 1) dismiss();
    else {
      if (phase === 0) onOpenPanel();
      setPhase((current) => current + 1);
    }
  }, [phase, total, dismiss, onOpenPanel]);

  useEffect(() => {
    const media = window.matchMedia(mq.mobile);
    const update = () => {
      setMobile(media.matches);
      if (media.matches) setPhase((current) => (current > 1 ? 1 : current));
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!autoInvite) {
      setPhase((current) => (current === -1 ? -2 : current));
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* Show once this visit. */
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      clearTimeout(timer);
      try {
        if (localStorage.getItem(STORAGE_KEY)) {
          observer.disconnect();
          return;
        }
      } catch {
        /* Continue without persistence. */
      }
      if (
        !document.querySelector('.maplibregl-canvas') ||
        document.querySelector('.map-status, dialog[open]')
      )
        return;
      timer = setTimeout(() => {
        try {
          if (localStorage.getItem(STORAGE_KEY)) return;
        } catch {
          /* Continue without persistence. */
        }
        setPhase((current) => (current === -2 ? -1 : current));
        observer.disconnect();
      }, 1200);
    };
    const observer = new MutationObserver(check);
    observer.observe(document.querySelector('.app')!, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    check();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [autoInvite]);

  useEffect(() => {
    if (request > 0) setPhase(0);
  }, [request]);

  useEffect(() => {
    if (phase < -1) return;
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase, dismiss]);

  useEffect(() => {
    const changed = previousSelection.current !== selectedId;
    previousSelection.current = selectedId;
    if (phase === 0 && changed && selectedId) next();
  }, [selectedId, phase, next]);

  useEffect(() => {
    if (phase !== 1) return;
    const onInput = (event: Event) => {
      if ((event.target as HTMLElement).matches('.catalog-view input[type=search]')) next();
    };
    document.addEventListener('input', onInput);
    return () => document.removeEventListener('input', onInput);
  }, [phase, next]);

  useEffect(() => {
    if (phase < 0) return;
    const focused = document.activeElement;
    if (focused === document.body || focused?.closest('.guide-card, .guide-invite, .guide-help')) {
      cardRef.current
        ?.querySelector<HTMLButtonElement>('.guide-primary')
        ?.focus({ preventScroll: true });
    }
  }, [phase]);

  useBrowserLayoutEffect(() => {
    if (phase < -1) return;
    const measure = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const panel = document.querySelector('.entry-panel')?.getBoundingClientRect();
      const bar = document.querySelector('.bottombar')?.getBoundingClientRect();
      let rect: Rect;
      if (phase <= 0) {
        const right = !mobile && panelOpen && panel ? panel.left - 16 : width - 16;
        const bottom =
          mobile && panelOpen && panel
            ? panel.top - 32
            : !mobile && bar?.height
              ? bar.top - 16
              : height - 72;
        rect = {
          left: 16,
          top: 100,
          width: Math.max(1, right - 16),
          height: Math.max(1, bottom - 100),
        };
      } else {
        const selector = phase === 1 ? (panelOpen ? '.entry-panel' : '.panel-toggle') : '.timeline';
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        rect = bounds
          ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
          : { left: 16, top: 100, width: width - 32, height: 80 };
      }
      setTarget(rect);
      const cardWidth = Math.min(300, width - 32);
      const cardHeight = cardRef.current?.getBoundingClientRect().height ?? 190;
      let left = rect.left + 12;
      let top = rect.top + 12;
      if (phase === 1) {
        left = mobile ? 16 : rect.left - cardWidth - 16;
        top = mobile ? rect.top - cardHeight - 16 : rect.top + 24;
      } else if (phase === 2) top = rect.top - cardHeight - 16;
      setPosition({
        left: Math.max(16, Math.min(width - cardWidth - 16, left)),
        top: Math.max(96, Math.min(height - cardHeight - 16, top)),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener('resize', measure);
    const timer = setTimeout(measure, 400); // Follow the panel's layout transition.
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, [phase, mobile, panelOpen, lang, selectedId]);

  if (phase < -1) return null;
  const titles = [t(lang, 'guideTitle0'), t(lang, 'guideTitle1'), t(lang, 'guideTitle2')];
  const descriptions = [
    t(lang, 'guideBody0'),
    selectedId ? t(lang, 'guideBody1Back') : t(lang, 'guideBody1'),
    t(lang, 'guideBody2'),
  ];
  return (
    <div className="guide-layer">
      {phase >= 0 && target && (
        <div className="guide-spotlight" style={target} aria-hidden="true" />
      )}
      <div
        ref={cardRef}
        className={phase === -1 ? 'guide-invite' : 'guide-card'}
        style={position}
        role="dialog"
        aria-modal="false"
        aria-labelledby="guide-title"
        aria-describedby="guide-copy"
      >
        <div className="guide-kicker">
          {t(lang, 'guideKicker')}
          {phase >= 0 && (
            <span className="guide-progress">
              {phase + 1} / {total}
            </span>
          )}
        </div>
        <h2 className="guide-title" id="guide-title">
          {phase === -1 ? t(lang, 'guideStartTitle') : titles[Math.min(phase, 2)]}
        </h2>
        <p className="guide-copy" id="guide-copy">
          {phase === -1 ? t(lang, 'guideStartBody') : descriptions[Math.min(phase, 2)]}
        </p>
        <div className="guide-actions">
          <button type="button" className="guide-skip" onClick={dismiss}>
            {t(lang, 'guideSkip')}
          </button>
          <button type="button" className="guide-primary" onClick={next}>
            {phase === -1
              ? t(lang, 'guideShow')
              : phase >= total - 1
                ? t(lang, 'guideBegin')
                : t(lang, 'guideNext')}
          </button>
        </div>
      </div>
    </div>
  );
}
