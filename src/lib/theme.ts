import type { Map as MlMap } from 'maplibre-gl';
import { basemap } from './tokens';

/** OpenFreeMap Positron — free vector tiles, no API key. */
export const MAP_STYLE = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}map/positron.json`
  : 'https://tiles.openfreemap.org/styles/positron';

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
    if (layer.type === 'background') setPaint(map, id, 'background-color', basemap.background);
    if (id === 'water') setPaint(map, id, 'fill-color', basemap.water);
    if (id === 'waterway') setPaint(map, id, 'line-color', basemap.waterway);
    if (id === 'park' || id === 'landcover_wood') setPaint(map, id, 'fill-color', basemap.park);
    if (id === 'landuse_residential') setPaint(map, id, 'fill-color', basemap.residential);
    if (id.startsWith('landcover_ice') || id === 'landcover_glacier')
      setPaint(map, id, 'fill-color', basemap.ice);
    if (id === 'building') {
      setPaint(map, id, 'fill-color', basemap.building);
      setPaint(map, id, 'fill-outline-color', basemap.roadCasing);
    }
    if (layer.type === 'line' && /highway|tunnel|railway|road|aeroway/.test(id)) {
      setPaint(map, id, 'line-color', /casing/.test(id) ? basemap.roadCasing : basemap.road);
    }
    if (id.startsWith('boundary')) {
      setPaint(map, id, 'line-color', basemap.boundary);
      if (id === 'boundary_2') setPaint(map, id, 'line-opacity', 0.55);
    }
    if (layer.type === 'symbol') {
      const isWater = id.startsWith('water');
      const isCountry = id.startsWith('label_country');
      setPaint(
        map,
        id,
        'text-color',
        isWater ? basemap.waterLabel : isCountry ? basemap.labelStrong : basemap.label,
      );
      setPaint(map, id, 'text-halo-color', basemap.halo);
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
export function localizeBasemap(map: MlMap, lang: 'zh' | 'en' | 'es' | 'ja') {
  const nameKey =
    lang === 'zh' ? 'name:zh' : lang === 'es' ? 'name:es' : lang === 'ja' ? 'name:ja' : 'name:en';
  const raw = ['coalesce', ['get', nameKey], ['get', 'name:latin'], ['get', 'name']];
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
    setLayout(map, layer.id, 'text-max-width', lang === 'zh' || lang === 'ja' ? 30 : 9);
    if (layer.id.startsWith('label_country')) {
      setLayout(
        map,
        layer.id,
        'text-transform',
        lang === 'en' || lang === 'es' ? 'uppercase' : 'none',
      );
      setLayout(map, layer.id, 'text-letter-spacing', lang === 'en' || lang === 'es' ? 0.18 : 0.12);
    }
  }
}
