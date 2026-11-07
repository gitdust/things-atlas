import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AtlasItem } from '@/lib/types';
import { categoryColor, mq } from '@/lib/tokens';
import { YEAR_KEYS } from '@/lib/primaryYear';
import { formatYear, pick, t, type Lang } from '@/lib/i18n';
import { makeTimeScale } from '@/lib/timeScale';

type Props = {
  lang: Lang;
  year: number;
  min: number;
  max: number;
  items: AtlasItem[];
  visibleIds: Set<string>;
  selectedId: string | null;
  onChange: (year: number) => void;
  onSelect: (id: string) => void;
};

const RULER_WIDTH_DESKTOP = 3600;
const RULER_WIDTH_MOBILE = 2200;

/** Approximate px width of a tick label at --fs-xs (no layout needed). */
function estimateLabelWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ch.codePointAt(0)! > 0x7f ? 10 : 6.2;
  return w + 8;
}

/** Short tick copy: round BCE millennia as 「前3千」/ 「−3k」; else formatYear short. */
function tickLabel(lang: Lang, y: number): string {
  if (y < 0 && y % 1000 === 0) {
    const n = -y / 1000;
    if (lang === 'zh') return `前${n}千`;
    return `−${n}k`;
  }
  if (y < 1800) return formatYear(lang, y, true);
  return y % 50 === 0 ? String(y) : `’${String(y).slice(2)}`;
}

export function Timeline({
  lang,
  year,
  min,
  max,
  items,
  visibleIds,
  selectedId,
  onChange,
  onSelect,
}: Props) {
  const scale = useMemo(() => makeTimeScale(min, max), [min, max]);
  const pct = scale.pct;
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);

  const yearRef = useRef(year);
  yearRef.current = year;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(mq.mobile);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const rulerWidth = isMobile ? RULER_WIDTH_MOBILE : RULER_WIDTH_DESKTOP;

  useEffect(() => {
    const el = scrubRef.current;
    if (!el) return;
    const measure = () => setViewportWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Density of every year mark (all four kinds) per year. */
  const density = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of items) {
      for (const key of YEAR_KEYS) {
        const m = item.years[key];
        if (m) counts.set(m.year, (counts.get(m.year) ?? 0) + 1);
      }
      for (const loc of item.locations) {
        if (loc.year_override != null)
          counts.set(loc.year_override, (counts.get(loc.year_override) ?? 0) + 0.5);
      }
    }
    const peak = Math.max(1, ...counts.values());
    return { counts, peak };
  }, [items]);

  /** Beeswarm: stack items whose dots would overlap on the axis. */
  const swarm = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.primary_year - b.primary_year);
    const placed: { item: AtlasItem; level: number; x: number }[] = [];
    for (const item of sorted) {
      const x = scale.pct(item.primary_year);
      let level = 0;
      while (placed.some((p) => p.level === level && Math.abs(p.x - x) < 0.7)) level++;
      placed.push({ item, level, x });
    }
    return placed;
  }, [items, scale]);

  const trackY = Math.max(96, ...swarm.map(({ level }) => level * 15 + 44));
  const ticks = scale.ticks;

  /** Visible major labels along the full ruler width. */
  const labeledYears = useMemo(() => {
    const width = rulerWidth;
    type Cand = { y: number; text: string; half: number; px: number; row: 0 | 1 };
    const majors = ticks.filter((tick) => tick.major);
    const toCand = (y: number, row: 0 | 1 = 0): Cand => {
      const text = tickLabel(lang, y);
      const x = pct(y);
      const half = estimateLabelWidth(text) / 2;
      return { y, text, half, px: (x / 100) * width, row };
    };
    const fitsRow = (kept: Cand[], c: Cand) =>
      !kept.some((k) => k.row === c.row && Math.abs(c.px - k.px) < c.half + k.half + 6);

    const firstY = majors[0]?.y;
    const lastY = majors[majors.length - 1]?.y;
    const anchorYs = [firstY, 0, lastY].filter(
      (y): y is number => y != null && majors.some((m) => m.y === y),
    );
    const kept: Cand[] = [];
    for (const y of anchorYs) {
      let c = toCand(y, 0);
      if (!fitsRow(kept, c) && y === 0) c = toCand(y, 1);
      if (fitsRow(kept, c)) kept.push(c);
    }
    for (const tick of majors) {
      if (kept.some((k) => k.y === tick.y)) continue;
      const c = toCand(tick.y, 0);
      if (fitsRow(kept, c)) kept.push(c);
    }
    kept.sort((a, b) => a.y - b.y);
    return new Map(kept.map((k) => [k.y, { text: k.text, row: k.row }]));
  }, [ticks, lang, pct, rulerWidth]);

  // Center position of the viewport
  const center = (viewportWidth || 800) / 2;
  // Boundaries for ruler translateX:
  // When year = min, ruler start is at center (maxOffset = center)
  // When year = max, ruler end is at center (minOffset = center - rulerWidth)
  const maxOffset = center;
  const minOffset = center - rulerWidth;

  const standardOffset = center - (pct(year) / 100) * rulerWidth;
  const currentOffset = dragOffset ?? standardOffset;

  // Pointer drag handling
  const dragStart = useRef({ startX: 0, startOffset: 0 });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      !e.isPrimary ||
      e.button !== 0 ||
      (e.target as HTMLElement).closest('.tl-dot') ||
      (e.target as HTMLElement).closest('.tl-reset-btn')
    )
      return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { startX: e.clientX, startOffset: currentOffset };
    setDragging(true);
    setDragOffset(currentOffset);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const delta = e.clientX - dragStart.current.startX;
    const rawOffset = dragStart.current.startOffset + delta;

    // Boundary damping
    let nextOffset = rawOffset;
    if (rawOffset > maxOffset) {
      nextOffset = maxOffset + (rawOffset - maxOffset) * 0.22;
    } else if (rawOffset < minOffset) {
      nextOffset = minOffset + (rawOffset - minOffset) * 0.22;
    }

    setDragOffset(nextOffset);

    // Map offset to year
    const clampedOffset = Math.max(minOffset, Math.min(maxOffset, nextOffset));
    const fraction = (maxOffset - clampedOffset) / rulerWidth;
    const nextYear = scale.yearAt(fraction);
    if (nextYear !== yearRef.current) {
      onChange(nextYear);
    }
  };

  const endDrag = () => {
    setDragging(false);
    setDragOffset(null);
  };

  // Wheel horizontal scrubbing
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const delta =
        e.deltaMode === 1
          ? (e.deltaY || e.deltaX) * 16
          : Math.abs(e.deltaX) > Math.abs(e.deltaY)
            ? e.deltaX
            : e.deltaY;
      if (Math.abs(delta) < 0.5) return;

      const currentFraction = pct(yearRef.current) / 100;
      const nextFraction = Math.max(0, Math.min(1, currentFraction + delta / rulerWidth));
      const nextYear = scale.yearAt(nextFraction);
      if (nextYear !== yearRef.current) {
        onChange(nextYear);
      }
    },
    [pct, rulerWidth, scale, onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const set = (y: number) => {
      e.preventDefault();
      onChange(Math.min(max, Math.max(min, y)));
    };
    if (e.key === 'Home') set(min);
    else if (e.key === 'End') set(max);
    else if (e.key === 'PageUp') set(year + 10 * scale.stepAt(year));
    else if (e.key === 'PageDown') set(year - 10 * scale.stepAt(year - 1));
    else if (e.key === 'ArrowLeft') set(year - scale.stepAt(year - 1));
    else if (e.key === 'ArrowRight') set(year + scale.stepAt(year));
  };

  return (
    <div className={`timeline${dragging ? ' is-dragging' : ''}`}>
      <div
        ref={scrubRef}
        className="tl-scrub"
        style={{
          ['--track-y' as string]: `${trackY}px`,
          height: trackY + 70,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
      >
        <div
          className="tl-slider-accessible"
          role="slider"
          tabIndex={0}
          aria-label={t(lang, 'year')}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={year}
          aria-valuetext={formatYear(lang, year)}
          onKeyDown={onKeyDown}
        />

        {/* Fixed Center Cursor Indicator */}
        <div className="tl-center-indicator">
          <div className="tl-center-badge" aria-hidden="true">
            <span className="tl-center-flag num">{formatYear(lang, year, true)}</span>
          </div>
          <div className={`tl-center-line${year < max ? ' with-reset' : ''}`} aria-hidden="true" />
          <div className="tl-center-knob" aria-hidden="true" />
          {year < max && (
            <button
              type="button"
              className="tl-reset-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange(max);
              }}
              title={lang === 'zh' ? '滑至现代（全部激活）' : 'Jump to present (all active)'}
            >
              ↺ {lang === 'zh' ? '回到现代' : 'Present'}
            </button>
          )}
        </div>

        {/* Scrollable / Draggable Ruler Track */}
        <div
          className="tl-rail"
          style={{
            width: `${rulerWidth}px`,
            transform: `translate3d(${currentOffset}px, 0, 0)`,
          }}
        >
          {/* Density Histogram */}
          <div className="tl-hist" aria-hidden="true">
            {[...density.counts.entries()].map(([y, c]) => {
              if (y < min || y > max) return null;
              const lit = y <= year;
              return (
                <span
                  key={y}
                  className={lit ? 'bar lit' : 'bar'}
                  style={{ left: `${pct(y)}%`, height: `${14 + (c / density.peak) * 56}%` }}
                />
              );
            })}
          </div>

          {/* Beeswarm item dots */}
          <div className="tl-swarm">
            {swarm.map(({ item, level }) => {
              const active = visibleIds.has(item.id);
              const sel = item.id === selectedId;
              const x = pct(item.primary_year);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`tl-dot${active ? ' on' : ' muted'}${sel ? ' sel' : ''}${
                    item.disputed ? ' disputed' : ''
                  }`}
                  style={{
                    left: `${x}%`,
                    bottom: `${level * 15}px`,
                    ['--c' as string]: categoryColor[item.category],
                  }}
                  title={`${pick(lang, item.name_zh, item.name_en)} · ${formatYear(lang, item.primary_year)}`}
                  onClick={() => {
                    onSelect(item.id);
                    onChange(item.primary_year);
                  }}
                >
                  <span className="tl-dot-label">
                    {pick(lang, item.name_zh, item.name_en)} · {formatYear(lang, item.primary_year)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Baseline track and fill up to current year */}
          <div className="tl-track" aria-hidden="true">
            <div className="tl-fill" style={{ width: `${pct(year)}%` }} />
          </div>

          {/* Ticks and Year Numbers */}
          <div className="tl-ticks" aria-hidden="true">
            {ticks.map(({ y, major, mid }) => {
              const label = major ? labeledYears.get(y) : undefined;
              return (
                <span
                  key={y}
                  className={major ? 'tick major' : mid ? 'tick mid' : 'tick'}
                  style={{ left: `${pct(y)}%` }}
                >
                  {label ? <em className={label.row ? 'num alt' : 'num'}>{label.text}</em> : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
