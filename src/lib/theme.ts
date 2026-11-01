import type { Map as MlMap } from 'maplibre-gl';
import type { CategoryId } from './types';

/**
 * Editorial palette — pigment-inspired category inks that sit well on a warm
 * paper basemap. (UI-only; data/categories.json keeps its own legacy colors.)
 */
export const CATEGORY_COLORS: Record<CategoryId, string> = {
  stationery: '#2f5d8a', // prussian blue
  apparel_accessory: '#b5462e', // cinnabar
  hand_tool: '#b8862b', // ochre
  home: '#4f7d5c', // verdigris
  personal_care: '#85587f', // madder mauve
  digital: '#2a7b80', // teal ink
  kitchen: '#7a7266', // umber grey (reserved)
};

export const INK = '#1f1b16';
export const PAPER = '#f4efe6';

/** OpenFreeMap Positron — free vector tiles, no API key. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

const BASEMAP = {
  background: '#efe9dd',
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
  halo: 'rgba(244,239,230,0.85)',
};

function setPaint(map: MlMap, id: string, prop: string, value: unknown) {
  if (!map.getLayer(id)) return;
  try {
    map.setPaintProperty(id, prop, value);
  } catch {
    /* layer may not support this prop */
  }
}

function setLayout(map: MlMap, id: string, prop: string, value: unknown) {
  if (!map.getLayer(id)) return;
  try {
    map.setLayoutProperty(id, prop, value);
  } catch {
    /* ignore */
  }
}

/** Re-ink the Positron style into a warm, quiet "atlas paper" basemap. */
export function tuneBasemap(map: MlMap) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    const id = layer.id;
    if (layer.type === 'background') setPaint(map, id, 'background-color', BASEMAP.background);
    if (id === 'water') setPaint(map, id, 'fill-color', BASEMAP.water);
    if (id === 'waterway') setPaint(map, id, 'line-color', BASEMAP.waterway);
    if (id === 'park' || id === 'landcover_wood') setPaint(map, id, 'fill-color', BASEMAP.park);
    if (id === 'landuse_residential') setPaint(map, id, 'fill-color', BASEMAP.residential);
    if (id.startsWith('landcover_ice') || id === 'landcover_glacier')
      setPaint(map, id, 'fill-color', BASEMAP.ice);
    if (id === 'building') {
      setPaint(map, id, 'fill-color', BASEMAP.building);
      setPaint(map, id, 'fill-outline-color', BASEMAP.roadCasing);
    }
    if (layer.type === 'line' && /highway|tunnel|railway|road|aeroway/.test(id)) {
      setPaint(map, id, 'line-color', /casing/.test(id) ? BASEMAP.roadCasing : BASEMAP.road);
    }
    if (id.startsWith('boundary')) {
      setPaint(map, id, 'line-color', BASEMAP.boundary);
      if (id === 'boundary_2') setPaint(map, id, 'line-opacity', 0.55);
    }
    if (layer.type === 'symbol') {
      const isWater = id.startsWith('water');
      const isCountry = id.startsWith('label_country');
      setPaint(map, id, 'text-color', isWater ? BASEMAP.waterLabel : isCountry ? BASEMAP.labelStrong : BASEMAP.label);
      setPaint(map, id, 'text-halo-color', BASEMAP.halo);
      setPaint(map, id, 'text-halo-width', 1.2);
      setPaint(map, id, 'text-halo-blur', 0.4);
      if (isCountry) {
        setLayout(map, id, 'text-transform', 'uppercase');
        setLayout(map, id, 'text-letter-spacing', 0.18);
        setLayout(map, id, 'text-font', ['Noto Sans Regular']);
        setPaint(map, id, 'text-opacity', 0.72);
      }
      if (id === 'label_state') setPaint(map, id, 'text-opacity', 0.6);
      if (id === 'label_country_3') map.setLayerZoomRange(id, 3, 24);
      if (/highway-shield|road_shield|airport/.test(id)) setLayout(map, id, 'visibility', 'none');
    }
  }
}

/** Show place labels in the UI language only (no dual-script clutter). */
export function localizeBasemap(map: MlMap, lang: 'zh' | 'en') {
  const raw =
    lang === 'zh'
      ? ['coalesce', ['get', 'name:zh'], ['get', 'name:latin'], ['get', 'name']]
      : ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
  // OSM name:zh may hold several variants ("美国;美國", "德国 / 德國") — keep the first.
  const firstPart = (sep: string, inner: unknown) => [
    'let',
    'n',
    ['to-string', inner],
    [
      'case',
      ['>', ['index-of', sep, ['var', 'n']], 0],
      ['slice', ['var', 'n'], 0, ['index-of', sep, ['var', 'n']]],
      ['var', 'n'],
    ],
  ];
  const field = firstPart(' /', firstPart('/', firstPart(';', raw)));
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    if (!/^label_|^water_name/.test(layer.id)) continue;
    setLayout(map, layer.id, 'text-field', field);
    setLayout(map, layer.id, 'text-max-width', lang === 'zh' ? 30 : 9);
    if (layer.id.startsWith('label_country')) {
      setLayout(map, layer.id, 'text-transform', lang === 'zh' ? 'none' : 'uppercase');
      setLayout(map, layer.id, 'text-letter-spacing', lang === 'zh' ? 0.12 : 0.18);
    }
  }
}
