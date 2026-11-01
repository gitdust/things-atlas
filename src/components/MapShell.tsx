import { t, type Lang } from '@/lib/i18n';

/**
 * Placeholder for the lazily-loaded map: the same element MapView mounts on,
 * so it hydrates cleanly and the paper background shows until tiles arrive.
 */
export function MapShell({ lang }: { lang: Lang }) {
  return <div className="map-root" aria-label={t(lang, 'map')} />;
}
