import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AtlasItem } from '@/lib/types';
import { categoryColor } from '@/lib/tokens';
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

/** Approximate px width of a tick label at --fs-xs (no layout needed). */
function estimateLabelWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ch.codePointAt(0)! > 0x7f ? 10 : 6.2;
  return w + 8; // letter-spacing + gap to neighbour
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
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const yearRef = useRef(year);
  yearRef.current = year;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackWidth(el.getBoundingClientRect().width);
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

  /** Beeswarm: stack items whose dots would overlap on the (non-linear) axis. */
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

  const ticks = scale.ticks;

  /**
   * Major ticks that get a visible label. The BCE band is only ~8% of the
   * track, so a greedy left-to-right pass drops any label whose estimated
   * bbox would overlap one already kept (works at 390px and 1440px).
   */
  /** Visible major labels + optional stagger row when anchors collide. */
  const labeledYears = useMemo(() => {
    const width = trackWidth || 800;
    type Cand = { y: number; x: number; text: string; half: number; px: number; row: 0 | 1 };
    const majors = ticks.filter((tick) => tick.major);
    const toCand = (y: number, row: 0 | 1 = 0): Cand => {
      const text = tickLabel(lang, y);
      const x = pct(y);
      const half = estimateLabelWidth(text) / 2;
      return { y, x, text, half, px: (x / 100) * width, row };
    };
    // Same-row collision only — staggered labels may share an x-neighbour.
    const fitsRow = (kept: Cand[], c: Cand) =>
      !kept.some((k) => k.row === c.row && Math.abs(c.px - k.px) < c.half + k.half + 6);

    // Anchors first (band start, year 0, last major). If year 0 collides on
    // row 0 with the BCE start in a narrow track, drop it to row 1 instead
    // of hiding it.
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
  }, [ticks, lang, pct, trackWidth]);

  const yearFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return yearRef.current;
      const r = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      return scale.yearAt(f);
    },
    [scale],
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

  const yearPct = pct(year);
  const thumbEdge = yearPct < 8 ? ' edge-l' : yearPct > 92 ? ' edge-r' : '';

  return (
    <div className={`timeline${dragging ? ' is-dragging' : ''}`}>
      <div
        className="tl-scrub"
        style={{
          ['--track-y' as string]: `${Math.max(96, ...swarm.map(({ level }) => level * 15 + 32))}px`,
          height: Math.max(96, ...swarm.map(({ level }) => level * 15 + 32)) + 48,
        }}
        role="slider"
        tabIndex={0}
        aria-label={t(lang, 'year')}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={year}
        aria-valuetext={formatYear(lang, year)}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('.tl-dot')) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          onChange(yearFromClientX(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging) onChange(yearFromClientX(e.clientX));
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {/*
          Inset rail: min/max sit inset from the scrub edges so dots, ticks,
          labels, and pills at the ends are not clipped. trackRef lives here so
          drag mapping uses the same inset range as left%.
        */}
        <div className="tl-rail" ref={trackRef}>
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

          <div className="tl-swarm">
            {swarm.map(({ item, level }) => {
              const visible = visibleIds.has(item.id);
              const sel = item.id === selectedId;
              const x = pct(item.primary_year);
              const edge = x < 8 ? ' edge-l' : x > 92 ? ' edge-r' : '';
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`tl-dot${visible ? ' on' : ''}${sel ? ' sel' : ''}${
                    item.disputed ? ' disputed' : ''
                  }${edge}`}
                  style={{
                    left: `${x}%`,
                    bottom: `${level * 15}px`,
                    ['--c' as string]: categoryColor[item.category],
                  }}
                  title={`${pick(lang, item.name_zh, item.name_en)} · ${formatYear(lang, item.primary_year)}`}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="tl-dot-label">{pick(lang, item.name_zh, item.name_en)}</span>
                </button>
              );
            })}
          </div>

          <div className="tl-track" aria-hidden="true">
            <div className="tl-fill" style={{ width: `${yearPct}%` }} />
          </div>

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

          <div
            className={`tl-thumb${thumbEdge}`}
            style={{ left: `${yearPct}%` }}
            aria-hidden="true"
          >
            <span className="tl-thumb-flag num">{formatYear(lang, year, true)}</span>
            <span className="tl-thumb-line" />
            <span className="tl-thumb-knob" />
          </div>
        </div>
      </div>
    </div>
  );
}
