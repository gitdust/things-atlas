import { useEffect, useRef } from 'react';
import maplibregl, { type Map, type GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { MAP_STYLE, CATEGORY_COLORS } from '@/lib/theme';
import type { ItemFeatureProps } from '@/lib/geo';
import type { Lang } from '@/lib/i18n';

type Props = {
  lang: Lang;
  geojson: FeatureCollection<Point, ItemFeatureProps>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function MapView({ lang, geojson, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [10, 30],
      zoom: 1.4,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      map.addSource('items', {
        type: 'geojson',
        data: geojson,
      });

      map.addLayer({
        id: 'items-circle',
        type: 'circle',
        source: 'items',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedId ?? ''],
            10,
            7,
          ],
          'circle-color': [
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
          ],
          'circle-stroke-width': [
            'case',
            ['==', ['get', 'disputed'], true],
            2,
            1,
          ],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'disputed'], true],
            '#b45309',
            '#ffffff',
          ],
          'circle-opacity': 0.9,
        },
      });

      map.on('click', 'items-circle', (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id;
        if (typeof id === 'string') onSelectRef.current(id);
      });

      map.on('mouseenter', 'items-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'items-circle', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // intentionally mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('items') as GeoJSONSource | undefined;
    if (src) src.setData(geojson);
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('items-circle')) return;
    map.setPaintProperty('items-circle', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      10,
      7,
    ]);
  }, [selectedId]);

  // hover title via title attribute on canvas is limited; skip for shell
  void lang;

  return <div ref={containerRef} className="map-root" />;
}
