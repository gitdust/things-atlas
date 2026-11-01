import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AtlasItem } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/theme';
import { YEAR_KEYS } from '@/lib/primaryYear';
import { pick, t, type Lang } from '@/lib/i18n';

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

const STEP_MS = 90;

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
  const span = Math.max(1, max - min);
  const pct = (y: number) => ((y - min) / span) * 100;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const yearRef = useRef(year);
  yearRef.current = year;

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

  /** Beeswarm: stack items that share a primary year (±1). */
  const swarm = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.primary_year - b.primary_year);
    const placed: { item: AtlasItem; level: number }[] = [];
    for (const item of sorted) {
      let level = 0;
      while (
        placed.some(
          (p) => p.level === level && Math.abs(p.item.primary_year - item.primary_year) < 2,
        )
      )
        level++;
      placed.push({ item, level });
    }
    return placed;
  }, [items]);

  const ticks = useMemo(() => {
    const out: { y: number; major: boolean; mid: boolean }[] = [];
    for (let y = Math.ceil(min); y <= max; y++) {
      out.push({ y, major: y % 10 === 0, mid: y % 5 === 0 });
    }
    return out;
  }, [min, max]);

  const yearFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return yearRef.current;
      const r = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      return Math.round(min + f * span);
    },
    [min, span],
  );

  // play / pause
  useEffect(() => {
    if (!playing) return;
    if (yearRef.current >= max) onChange(min);
    const timer = window.setInterval(() => {
      const next = yearRef.current + 1;
      if (next > max) {
        setPlaying(false);
        return;
      }
      onChange(next);
    }, STEP_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, min, max]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const set = (y: number) => {
      e.preventDefault();
      onChange(Math.min(max, Math.max(min, y)));
    };
    if (e.key === 'Home') set(min);
    else if (e.key === 'End') set(max);
    else if (e.key === 'PageUp') set(year + 10);
    else if (e.key === 'PageDown') set(year - 10);
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setPlaying((p) => !p);
    }
  };

  const decadeLabel = (y: number) => (y % 50 === 0 ? String(y) : `’${String(y).slice(2)}`);

  return (
    <div className={`timeline${dragging ? ' is-dragging' : ''}`}>
      <div className="tl-readout">
        <button
          type="button"
          className="play-btn"
          aria-label={playing ? t(lang, 'pause') : t(lang, 'play')}
          title={playing ? t(lang, 'pauseHint') : t(lang, 'playHint')}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="4" y="3" width="2.6" height="10" rx="0.6" />
              <rect x="9.4" y="3" width="2.6" height="10" rx="0.6" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" />
            </svg>
          )}
        </button>
        <div className="tl-year">
          <span className="tl-year-label">{t(lang, 'upTo')}</span>
          <span className="tl-year-num num">{year}</span>
        </div>
      </div>

      <div
        className="tl-scrub"
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={t(lang, 'year')}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={year}
        aria-valuetext={String(year)}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('.tl-dot')) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          setPlaying(false);
          onChange(yearFromClientX(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging) onChange(yearFromClientX(e.clientX));
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
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
            return (
              <button
                key={item.id}
                type="button"
                className={`tl-dot${visible ? ' on' : ''}${sel ? ' sel' : ''}${
                  item.disputed ? ' disputed' : ''
                }`}
                style={{
                  left: `${pct(item.primary_year)}%`,
                  bottom: `${level * 15}px`,
                  ['--c' as string]: CATEGORY_COLORS[item.category],
                }}
                title={`${pick(lang, item.name_zh, item.name_en)} · ${item.primary_year}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="tl-dot-label">
                  {pick(lang, item.name_zh, item.name_en)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="tl-track" aria-hidden="true">
          <div
            className="tl-fill"
            style={{ width: `${pct(year)}%` }}
          />
        </div>

        <div className="tl-ticks" aria-hidden="true">
          {ticks.map(({ y, major, mid }) => (
            <span
              key={y}
              className={major ? 'tick major' : mid ? 'tick mid' : 'tick'}
              style={{ left: `${pct(y)}%` }}
            >
              {major ? <em className="num">{decadeLabel(y)}</em> : null}
            </span>
          ))}
        </div>

        <div className="tl-thumb" style={{ left: `${pct(year)}%` }} aria-hidden="true">
          <span className="tl-thumb-flag num">{year}</span>
          <span className="tl-thumb-line" />
          <span className="tl-thumb-knob" />
        </div>
      </div>
    </div>
  );
}
