import { t, type Lang } from '@/lib/i18n';

export function MapStatus({
  lang,
  failed = false,
  compact = false,
  onRetry,
}: {
  lang: Lang;
  failed?: boolean;
  compact?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className={`map-status${compact ? ' is-compact' : ''}`}>
      <div className="map-status-content" role="status" aria-live="polite">
        {!failed && <span className="map-spinner" aria-hidden="true" />}
        <span>
          {failed
            ? lang === 'zh'
              ? '地图加载失败'
              : 'Map failed to load'
            : lang === 'zh'
              ? '地图加载中…'
              : 'Loading map…'}
        </span>
        {failed && onRetry && (
          <button type="button" onClick={onRetry}>
            {lang === 'zh' ? '重试' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  );
}

export function MapShell({
  lang,
  failed,
  onRetry,
}: {
  lang: Lang;
  failed?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="map-root" aria-label={t(lang, 'map')}>
      <MapStatus lang={lang} failed={failed} onRetry={onRetry} />
    </div>
  );
}
