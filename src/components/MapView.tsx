import { useEffect, useRef } from 'react';
import maplibregl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MlMap,
  type MapGeoJSONFeature,
} from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { CATEGORY_COLORS, INK, MAP_STYLE, PAPER, localizeBasemap, tuneBasemap } from '@/lib/theme';
import { itemBounds, type ArcProps, type ItemFeatureProps } from '@/lib/geo';
import type { AtlasItem } from '@/lib/types';
import { pick, t, type Lang, type MessageKey, formatYear } from '@/lib/i18n';

type Props = {
  lang: Lang;
  geojson: FeatureCollection<Point, ItemFeatureProps>;
  arcs: FeatureCollection<LineString, ArcProps>;
  selectedItem: AtlasItem | null;
  onSelect: (id: string) => void;
};

const categoryColor: ExpressionSpecification = [
  'match',
  ['get', 'category'],
  'stationery',
  CATEGORY_COLORS.stationery,
  'apparel_accessory',
  CATEGORY_COLORS.apparel_accessory,
  'hand_tool',
  CATEGORY_COLORS.hand_tool,
  'home',
  CATEGORY_COLORS.home,
  'personal_care',
  CATEGORY_COLORS.personal_care,
  'digital',
  CATEGORY_COLORS.digital,
  CATEGORY_COLORS.kitchen,
];

const isContested: ExpressionSpecification = ['==', ['get', 'kind'], 'contested'];
const isHover: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];

function isMobile() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function mapPadding(drawerOpen: boolean) {
  if (isMobile()) {
    return { top: 140, left: 40, right: 40, bottom: drawerOpen ? window.innerHeight * 0.62 : 210 };
  }
  return { top: 170, left: 80, right: drawerOpen ? 560 : 80, bottom: 230 };
}

function applySelection(map: MlMap, selectedId: string | null) {
  const sel = selectedId ?? '';
  const has = selectedId != null;
  const isSel: ExpressionSpecification = ['==', ['get', 'id'], sel];
  const dim = (on: number, off: number, base: number): ExpressionSpecification =>
    has ? ['case', isSel, on, off] : ['literal', base];

  map.setPaintProperty('items-halo', 'circle-opacity', dim(0.32, 0.06, 0.22));
  map.setPaintProperty('items-halo', 'circle-radius', [
    'interpolate', ['linear'], ['zoom'],
    1, has ? ['case', isSel, 20, 11] : 13,
    6, has ? ['case', isSel, 30, 16] : 20,
  ]);
  map.setPaintProperty('items-ring', 'circle-stroke-opacity', has ? ['case', isSel, 0.9, 0] : 0);
  map.setPaintProperty('items-dot', 'circle-opacity', dim(1, 0.35, 1));
  map.setPaintProperty('items-dot', 'circle-stroke-opacity', dim(1, 0.4, 1));
  map.setPaintProperty('items-dot', 'circle-radius', [
    'case',
    isHover, 8,
    has ? ['case', isSel, 7, 4.5] : 5.5,
  ]);
  for (const id of ['arcs-solid', 'arcs-dashed']) {
    map.setPaintProperty(id, 'line-opacity', dim(0.85, 0.08, 0.32));
    map.setPaintProperty(id, 'line-width', has ? ['case', isSel, 1.6, 0.8] : 1);
  }
}

function tooltipHtml(p: ItemFeatureProps, lang: Lang) {
  const name = pick(lang, p.name_zh, p.name_en);
  const alt = pick(lang === 'zh' ? 'en' : 'zh', p.name_zh, p.name_en);
  const place = pick(lang, p.place_label_zh, p.place_label_en);
  const kind = t(lang, `kind_${p.kind}` as MessageKey);
  const year = p.year_override ?? p.primary_year;
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return `
    <div class="tip-kicker"><span class="tip-dot" style="--c:${
      CATEGORY_COLORS[p.category as keyof typeof CATEGORY_COLORS] ?? INK
    }"></span>${esc(kind)} · <span class="num">${esc(formatYear(lang, year))}</span></div>
    <div class="tip-title">${esc(name)} <span class="tip-alt">${esc(alt)}</span></div>
    <div class="tip-place">${esc(place)}</div>`;
}

export function MapView({ lang, geojson, arcs, selectedItem, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const langRef = useRef(lang);
  langRef.current = lang;
  const latest = useRef({ geojson, arcs, selectedId: selectedItem?.id ?? null });
  latest.current = { geojson, arcs, selectedId: selectedItem?.id ?? null };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-30, 32],
      zoom: isMobile() ? 0.6 : 1.7,
      minZoom: 0.5,
      maxZoom: 9,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
      fadeDuration: 200,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: 'atlas-tip',
      maxWidth: '280px',
    });

    let hoverId: string | number | undefined;

    map.on('load', () => {
      tuneBasemap(map);
      localizeBasemap(map, langRef.current);
      const { geojson: g, arcs: a, selectedId } = latest.current;

      map.addSource('arcs', { type: 'geojson', data: a });
      map.addSource('items', { type: 'geojson', data: g, generateId: true });

      map.addLayer({
        id: 'arcs-solid',
        type: 'line',
        source: 'arcs',
        filter: ['!', ['get', 'contested']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': categoryColor, 'line-width': 1, 'line-opacity': 0.32 },
      });
      map.addLayer({
        id: 'arcs-dashed',
        type: 'line',
        source: 'arcs',
        filter: ['get', 'contested'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': categoryColor,
          'line-width': 1,
          'line-opacity': 0.32,
          'line-dasharray': [1.5, 2.5],
        },
      });
      map.addLayer({
        id: 'items-halo',
        type: 'circle',
        source: 'items',
        paint: {
          'circle-color': categoryColor,
          'circle-radius': 13,
          'circle-blur': 0.9,
          'circle-opacity': 0.16,
        },
      });
      map.addLayer({
        id: 'items-ring',
        type: 'circle',
        source: 'items',
        paint: {
          'circle-radius': 12,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 1,
          'circle-stroke-color': INK,
          'circle-stroke-opacity': 0,
        },
      });
      map.addLayer({
        id: 'items-dot',
        type: 'circle',
        source: 'items',
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['case', isContested, PAPER, categoryColor],
          'circle-stroke-color': ['case', isContested, categoryColor, PAPER],
          'circle-stroke-width': ['case', isContested, 1.8, 1.6],
        },
      });

      readyRef.current = true;
      applySelection(map, selectedId);
      if (!selectedId && g.features.length > 0) {
        const lngs = g.features.map((f) => f.geometry.coordinates[0]);
        const lats = g.features.map((f) => f.geometry.coordinates[1]);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: mapPadding(false), maxZoom: 3.2, duration: 0 },
        );
      }
    });

    map.on('click', 'items-dot', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') onSelectRef.current(id);
    });

    map.on('mousemove', 'items-dot', (e) => {
      const f = e.features?.[0] as MapGeoJSONFeature | undefined;
      if (!f) return;
      map.getCanvas().style.cursor = 'pointer';
      if (hoverId !== undefined && hoverId !== f.id) {
        map.setFeatureState({ source: 'items', id: hoverId }, { hover: false });
      }
      hoverId = f.id;
      if (hoverId !== undefined) map.setFeatureState({ source: 'items', id: hoverId }, { hover: true });
      const coords = (f.geometry as Point).coordinates as [number, number];
      popup
        .setLngLat(coords)
        .setHTML(tooltipHtml(f.properties as unknown as ItemFeatureProps, langRef.current))
        .addTo(map);
    });
    map.on('mouseleave', 'items-dot', () => {
      map.getCanvas().style.cursor = '';
      if (hoverId !== undefined) map.setFeatureState({ source: 'items', id: hoverId }, { hover: false });
      hoverId = undefined;
      popup.remove();
    });

    mapRef.current = map;
    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource('items') as GeoJSONSource | undefined)?.setData(geojson);
    (map.getSource('arcs') as GeoJSONSource | undefined)?.setData(arcs);
  }, [geojson, arcs]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) localizeBasemap(map, lang);
  }, [lang]);

  const selectedId = selectedItem?.id ?? null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      applySelection(map, selectedId);
      if (selectedItem) {
        const b = itemBounds(selectedItem);
        map.fitBounds(b, {
          padding: mapPadding(true),
          maxZoom: 4.2,
          duration: 1600,
          essential: true,
        });
      }
    };
    if (readyRef.current) run();
    else map.once('load', run);
  }, [selectedId, selectedItem]);

  return <div ref={containerRef} className="map-root" aria-label={t(lang, 'map')} />;
}
