/**
 * Piecewise-linear time scale for the timeline.
 *
 * Items now span ~3000 BCE → today, but most marks cluster after 1800.
 * A single linear axis would crush the modern era into a sliver, so
 * earlier eras get compressed, progressively coarser segments.
 */

type Segment = {
  /** Year where this segment starts. */
  from: number;
  /** Share of the full track width (0–1) at `from`. */
  at: number;
  /** Minor tick spacing (years) inside the segment. */
  minor: number;
  /** Labelled tick spacing (years) inside the segment. */
  major: number;
  /** Years per keyboard/scrub step inside the segment. */
  step: number;
};

/** Breakpoints used when the data reaches back before 1800. */
const ERA_SEGMENTS: Segment[] = [
  { from: -Infinity, at: 0, minor: 250, major: 1000, step: 25 },
  { from: 0, at: 0.08, minor: 100, major: 500, step: 10 },
  { from: 1500, at: 0.2, minor: 10, major: 100, step: 3 },
  { from: 1800, at: 0.3, minor: 1, major: 10, step: 1 },
];

export type TimeScale = {
  min: number;
  max: number;
  /** Year → percent of track width (0–100). */
  pct: (y: number) => number;
  /** Fraction of track width (0–1) → year (integer). */
  yearAt: (f: number) => number;
  /** Tick marks: `major` ticks carry a label. */
  ticks: { y: number; major: boolean; mid: boolean }[];
  /** Years to advance per step at year `y`. */
  stepAt: (y: number) => number;
};

export function makeTimeScale(min: number, max: number): TimeScale {
  const span = Math.max(1, max - min);

  // Plain linear scale: the original behaviour when everything is modern.
  if (min >= 1800 - 5) {
    const ticks: TimeScale['ticks'] = [];
    for (let y = Math.ceil(min); y <= max; y++)
      ticks.push({ y, major: y % 10 === 0, mid: y % 5 === 0 });
    return {
      min,
      max,
      pct: (y) => ((y - min) / span) * 100,
      yearAt: (f) => Math.round(min + f * span),
      ticks,
      stepAt: () => 1,
    };
  }

  // Start from the segment that contains `min`, then keep later breakpoints below `max`.
  let k = 0;
  for (let i = 0; i < ERA_SEGMENTS.length; i++) if (ERA_SEGMENTS[i].from <= min) k = i;
  const segs: Segment[] = [
    { ...ERA_SEGMENTS[k], from: min, at: 0 },
    ...ERA_SEGMENTS.slice(k + 1).filter((s) => s.from < max),
  ];
  // Each segment runs from its share to the next segment's share (last ends at 1).
  const ends = segs.map((_, i) => (i + 1 < segs.length ? segs[i + 1].at : 1));
  const bounds = segs.map((s, i) => ({
    ...s,
    to: i + 1 < segs.length ? segs[i + 1].from : max,
    atEnd: ends[i],
  }));

  const segOf = (y: number) => {
    for (let i = bounds.length - 1; i >= 0; i--) if (y >= bounds[i].from) return bounds[i];
    return bounds[0];
  };

  const frac = (y: number) => {
    const c = Math.min(max, Math.max(min, y));
    const s = segOf(c);
    const w = Math.max(1, s.to - s.from);
    return s.at + ((c - s.from) / w) * (s.atEnd - s.at);
  };

  const yearAt = (f: number) => {
    const c = Math.min(1, Math.max(0, f));
    let s = bounds[0];
    for (const b of bounds) if (c >= b.at) s = b;
    const share = Math.max(1e-9, s.atEnd - s.at);
    const y = s.from + ((c - s.at) / share) * (s.to - s.from);
    // Snap to the segment step so ancient eras land on round years.
    const snapped = Math.round(y / s.step) * s.step;
    return Math.min(max, Math.max(min, snapped));
  };

  const ticks: TimeScale['ticks'] = [];
  for (const s of bounds) {
    const start = Math.ceil(s.from / s.minor) * s.minor;
    for (let y = start; y < s.to || (s === bounds[bounds.length - 1] && y <= s.to); y += s.minor) {
      ticks.push({ y, major: y % s.major === 0, mid: y % (s.major / 2) === 0 });
    }
  }

  return {
    min,
    max,
    pct: (y) => frac(y) * 100,
    yearAt,
    ticks,
    stepAt: (y) => segOf(y).step,
  };
}
