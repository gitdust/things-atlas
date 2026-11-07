import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapStatus } from './MapShell';
import maplibregl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MlMap,
  type MapGeoJSONFeature,
} from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { MAP_STYLE, localizeBasemap, tuneBasemap } from '@/lib/theme';
import { categoryColor, color, mq } from '@/lib/tokens';
import '@/styles/map.css';
import { itemBounds, type ArcProps, type ItemFeatureProps } from '@/lib/geo';
import type { AtlasItem } from '@/lib/types';
import { pick, t, type Lang, type MessageKey, formatYear } from '@/lib/i18n';

export type MapViewProps = {
  lang: Lang;
  panelOpen: boolean;
  geojson: FeatureCollection<Point, ItemFeatureProps>;
  arcs: FeatureCollection<LineString, ArcProps>;
  selectedItem: AtlasItem | null;
  visibleIds: Set<string>;
  onSelect: (id: string) => void;
};

/** ['match', category, 'stationery', '#…', …, fallback] built from the design tokens. */
const categoryColorExpr = [
  'match',
  ['get', 'category'],
  ...Object.entries(categoryColor)
    .filter(([id]) => id !== 'kitchen')
    .flat(),
  categoryColor.kitchen,
] as unknown as ExpressionSpecification;

const isContested: ExpressionSpecification = ['==', ['get', 'kind'], 'contested'];
const isHover: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];

function isMobile() {
  return window.matchMedia(mq.mobile).matches;
}

function motionDuration(duration: number) {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration;
}

function mapPadding(drawerOpen: boolean) {
  if (isMobile()) {
    return {
      top: 100,
      left: 24,
      right: 24,
      bottom: drawerOpen
        ? (document.querySelector('.entry-panel')?.getBoundingClientRect().height ??
            window.innerHeight * 0.48) +
          (document.getElementById('map-attribution')?.getBoundingClientRect().height ?? 0) +
          32
        : 60,
    };
  }
  const panelWidth =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drawer-w')) || 360;
  const timelineHeight =
    document.querySelector('.bottombar')?.getBoundingClientRect().height ?? 180;
  return {
    top: 100,
    left: 48,
    right: drawerOpen ? panelWidth + 48 : 48,
    bottom: timelineHeight + 50,
  };
}

function applySelection(map: MlMap, selectedId: string | null, visibleIds: Set<string>) {
  const sel = selectedId ?? '';
  const has = selectedId != null;
  const isSel: ExpressionSpecification = ['==', ['get', 'id'], sel];
  const inEra: ExpressionSpecification = ['in', ['get', 'id'], ['literal', [...visibleIds]]];
  const dim = (on: number, off: number, base: number): ExpressionSpecification => [
    'case',
    isSel,
    on,
    inEra,
    has ? off : base,
    base * 0.22,
  ];

  if (map.getLayer('items-halo-active')) {
    map.setFilter('items-halo-active', ['==', ['get', 'id'], sel]);
  }

  map.setPaintProperty('items-halo', 'circle-opacity', dim(0.18, 0.025, 0.06));
  map.setPaintProperty('items-halo', 'circle-radius', [
    'interpolate',
    ['linear'],
    ['zoom'],
    1,
    has ? ['case', isSel, 20, 10] : 11,
    6,
    has ? ['case', isSel, 30, 15] : 17,
  ]);
  map.setPaintProperty('items-ring', 'circle-stroke-opacity', has ? ['case', isSel, 0.9, 0] : 0);
  map.setPaintProperty('items-dot', 'circle-opacity', dim(1, 0.35, 1));
  map.setPaintProperty('items-dot', 'circle-stroke-opacity', dim(1, 0.4, 1));
  map.setPaintProperty('items-dot', 'circle-radius', [
    'case',
    isHover,
    8,
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
      categoryColor[p.category as keyof typeof categoryColor] ?? color.ink
    }"></span>${esc(kind)} · <span class="num">${esc(formatYear(lang, year))}</span></div>
    <div class="tip-title">${esc(name)} <span class="tip-alt">${esc(alt)}</span></div>
    <div class="tip-place">${esc(place)}</div>`;
}

export function MapView({
  lang,
  geojson,
  arcs,
  selectedItem,
  onSelect,
  panelOpen,
  visibleIds,
}: MapViewProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [firstPaint, setFirstPaint] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const langRef = useRef(lang);
  langRef.current = lang;
  const latest = useRef({
    geojson,
    arcs,
    selectedId: selectedItem?.id ?? null,
    panelOpen,
    visibleIds,
  });
  latest.current = { geojson, arcs, selectedId: selectedItem?.id ?? null, panelOpen, visibleIds };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    setStatus('loading');
    setFirstPaint(false);
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [-30, 32],
        zoom: isMobile() ? 0.6 : 1.7,
        minZoom: 0.5,
        maxZoom: 9,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        fadeDuration: motionDuration(200),
      });
    } catch {
      setStatus('error');
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    const markLoading = () => {
      setStatus((current) => (current === 'error' ? current : 'loading'));
      clearTimeout(timeout);
      timeout = setTimeout(() => setStatus('error'), 20000);
    };
    map.on('dataloading', markLoading);
    map.on('idle', () => {
      clearTimeout(timeout);
      setFirstPaint(true);
      setStatus((current) => (current === 'error' ? current : 'ready'));
    });
    map.on('error', () => {
      clearTimeout(timeout);
      setStatus('error');
    });
    markLoading();
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: false }));
    const attribution = containerRef.current.querySelector('.maplibregl-ctrl-attrib');
    const attributionSlot = document.getElementById('map-attribution');
    if (attribution && attributionSlot) {
      attributionSlot.appendChild(attribution);
    }

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
        paint: { 'line-color': categoryColorExpr, 'line-width': 1, 'line-opacity': 0.32 },
      });
      map.addLayer({
        id: 'arcs-dashed',
        type: 'line',
        source: 'arcs',
        filter: ['get', 'contested'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': categoryColorExpr,
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
          'circle-color': categoryColorExpr,
          'circle-radius': 11,
          'circle-blur': 0.9,
          'circle-opacity': 0.08,
        },
      });
      map.addLayer({
        id: 'items-halo-active',
        type: 'circle',
        source: 'items',
        filter: ['==', ['get', 'id'], latest.current.selectedId ?? ''],
        paint: {
          'circle-color': categoryColorExpr,
          'circle-radius': 13,
          'circle-blur': 0.85,
          'circle-opacity': 0.12,
        },
      });
      map.addLayer({
        id: 'items-halo-new',
        type: 'circle',
        source: 'items',
        paint: {
          'circle-color': categoryColorExpr,
          'circle-radius': 12,
          'circle-blur': 0.85,
          'circle-opacity': 0,
          ...({
            'circle-opacity-transition': { duration: 0 },
          } as Record<string, unknown>),
        },
      });
      map.addLayer({
        id: 'items-ring',
        type: 'circle',
        source: 'items',
        paint: {
          'circle-radius': 12,
          'circle-color': 'transparent',
          'circle-stroke-width': 1,
          'circle-stroke-color': color.ink,
          'circle-stroke-opacity': 0,
        },
      });
      map.addLayer({
        id: 'items-dot',
        type: 'circle',
        source: 'items',
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['case', isContested, color.paper, categoryColorExpr],
          'circle-stroke-color': ['case', isContested, categoryColorExpr, color.paper],
          'circle-stroke-width': ['case', isContested, 1.8, 1.6],
        },
      });

      readyRef.current = true;
      applySelection(map, selectedId, latest.current.visibleIds);
      if (!selectedId)
        map.easeTo({
          padding: mapPadding(latest.current.panelOpen),
          duration: motionDuration(280),
        });
      if (!selectedId && g.features.length > 0) {
        const lngs = g.features.map((f) => f.geometry.coordinates[0]);
        const lats = g.features.map((f) => f.geometry.coordinates[1]);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: mapPadding(latest.current.panelOpen), maxZoom: 3.2, duration: 0 },
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
      if (hoverId !== undefined)
        map.setFeatureState({ source: 'items', id: hoverId }, { hover: true });
      const coords = (f.geometry as Point).coordinates as [number, number];
      popup
        .setLngLat(coords)
        .setHTML(tooltipHtml(f.properties as unknown as ItemFeatureProps, langRef.current))
        .addTo(map);
    });
    map.on('mouseleave', 'items-dot', () => {
      map.getCanvas().style.cursor = '';
      if (hoverId !== undefined)
        map.setFeatureState({ source: 'items', id: hoverId }, { hover: false });
      hoverId = undefined;
      popup.remove();
    });

    mapRef.current = map;
    return () => {
      clearTimeout(timeout);
      attribution?.remove();
      popup.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, [attempt]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applySelection(map, latest.current.selectedId, visibleIds);
  }, [visibleIds]);

  const selectedId = selectedItem?.id ?? null;
  const previousPanelOpen = useRef(panelOpen);
  useEffect(() => {
    // A selection may also open the panel; its fitBounds already includes that space.
    previousPanelOpen.current = latest.current.panelOpen;
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      applySelection(map, selectedId, latest.current.visibleIds);
      map.stop();
      const padding = mapPadding(latest.current.panelOpen);
      if (selectedItem) {
        map.fitBounds(itemBounds(selectedItem), {
          padding,
          maxZoom: 4.2,
          duration: motionDuration(1600),
        });
      } else {
        map.easeTo({ padding, duration: motionDuration(280) });
      }
    };
    if (readyRef.current) run();
    else map.once('load', run);
    // Selection can change several times while the map style is loading.
    // Remove superseded callbacks so only the current selection is framed.
    return () => {
      map.off('load', run);
    };
  }, [selectedId, selectedItem, attempt]);

  useEffect(() => {
    const changed = previousPanelOpen.current !== panelOpen;
    previousPanelOpen.current = panelOpen;
    const map = mapRef.current;
    if (!changed || !map || !readyRef.current) return;
    // Preserve the current zoom and framing when only panel space changes.
    map.easeTo({ padding: mapPadding(panelOpen), duration: motionDuration(280) });
  }, [panelOpen]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (preference.matches) mapRef.current?.stop();
    };
    preference.addEventListener('change', onChange);
    return () => preference.removeEventListener('change', onChange);
  }, []);

  // Retain activation times across rapid scrubbing without flashing on first load.
  const previousVisibleIds = useRef(visibleIds);
  const activatedAt = useRef(new Map<string, number>());
  useEffect(() => {
    const now = performance.now();
    for (const id of visibleIds) {
      if (!previousVisibleIds.current.has(id)) activatedAt.current.set(id, now);
    }
    for (const id of activatedAt.current.keys()) {
      if (!visibleIds.has(id)) activatedAt.current.delete(id);
    }
    previousVisibleIds.current = visibleIds;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const tick = (time: number) => {
      if (!map.getLayer('items-halo-new')) return;
      const reduced = preference.matches;
      const pulses: (string | number | unknown[])[] = ['match', ['get', 'id']];
      for (const [id, start] of activatedAt.current) {
        const progress = (time - start) / 650;
        if (progress >= 1 || reduced) activatedAt.current.delete(id);
        else pulses.push(id, Math.sin(Math.PI * progress) * (selectedId ? 0.1 : 0.22));
      }
      const opacity = pulses.length > 2 ? [...pulses, 0] : 0;
      map.setPaintProperty('items-halo-new', 'circle-opacity', opacity);
      const phase = reduced ? 0 : (Math.sin((time * Math.PI * 2) / 3600) + 1) / 2;
      map.setPaintProperty('items-halo-active', 'circle-opacity', 0.09 + phase * 0.05);
      map.setPaintProperty('items-halo-active', 'circle-radius', [
        'interpolate',
        ['linear'],
        ['zoom'],
        1,
        12 + phase,
        6,
        18 + phase * 2,
      ]);
      if (!reduced && (selectedId || activatedAt.current.size)) frame = requestAnimationFrame(tick);
    };
    const updateMotion = () => {
      cancelAnimationFrame(frame);
      tick(performance.now());
    };
    updateMotion();
    preference.addEventListener('change', updateMotion);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', updateMotion);
    };
  }, [status, visibleIds, selectedId]);

  return (
    <>
      <div ref={containerRef} className="map-root" aria-label={t(lang, 'map')} />
      {status !== 'ready' && (
        <MapStatus
          lang={lang}
          failed={status === 'error'}
          compact={firstPaint}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
    </>
  );
}
