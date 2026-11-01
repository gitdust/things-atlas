/**
 * Design tokens for code that can't read CSS custom properties
 * (MapLibre paint properties, inline styles, matchMedia).
 *
 * Mirrors src/styles/tokens.css — `npm run lint` runs scripts/check-tokens.ts,
 * which fails if a value here drifts from its CSS custom property.
 */
import type { CategoryId } from './types';

export const color = {
  paper: '#f4efe6',
  paper2: '#ebe4d6',
  paper3: '#e2d9c7',
  paperMap: '#efe9dd',
  ink: '#1f1b16',
  ink2: '#3f382f',
  ink3: '#6b6254',
  muted: '#8a8070',
  accent: '#b5462e',
} as const;

/** Pigment-inspired category inks (UI + map). data/categories.json keeps legacy colours. */
export const categoryColor: Record<CategoryId, string> = {
  stationery: '#2f5d8a', // prussian blue
  apparel_accessory: '#b5462e', // cinnabar
  hand_tool: '#b8862b', // ochre
  home: '#4f7d5c', // verdigris
  personal_care: '#85587f', // madder mauve
  digital: '#2a7b80', // teal ink
  kitchen: '#7a7266', // umber grey
};

/** Warm "atlas paper" basemap palette (applied to Positron in theme.ts). */
export const basemap = {
  background: color.paperMap,
  water: '#d7dcd6',
  waterway: '#cdd3cc',
  park: '#e6e2d4',
  residential: '#ebe5d8',
  ice: '#f6f2ea',
  building: '#e7e0d2',
  road: '#e9e2d4',
  roadCasing: '#ddd5c5',
  boundary: '#b9ae9b',
  label: '#6f6656',
  labelStrong: '#4a4236',
  waterLabel: '#7d8a86',
  halo: 'rgba(244, 239, 230, 0.85)',
} as const;

/** Media-query breakpoints (max-width, px). */
export const breakpoint = {
  lg: 1100,
  md: 760,
} as const;

/** Motion durations (ms). */
export const duration = {
  base: 220,
  bar: 260,
  slide: 320,
  layout: 420,
  enter: 480,
} as const;

export const mq = {
  mobile: `(max-width: ${breakpoint.md}px)`,
  tablet: `(max-width: ${breakpoint.lg}px)`,
} as const;

/** Browser chrome colour (meta theme-color / web manifest). */
export const themeColor = color.paperMap;

const kebab = (s: string) =>
  s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/(\D)(\d)/g, '$1-$2');

/** CSS custom property → expected value, for scripts/check-tokens.ts. */
export function cssVarMirror(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(color)) out[`--${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(categoryColor)) out[`--cat-${k.replace(/_/g, '-')}`] = v;
  for (const [k, v] of Object.entries(basemap)) out[`--map-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(breakpoint)) out[`--bp-${k}`] = `${v}px`;
  out['--dur'] = `${duration.base}ms`;
  out['--dur-bar'] = `${duration.bar}ms`;
  out['--dur-slide'] = `${duration.slide}ms`;
  out['--dur-layout'] = `${duration.layout}ms`;
  out['--dur-enter'] = `${duration.enter}ms`;
  return out;
}
