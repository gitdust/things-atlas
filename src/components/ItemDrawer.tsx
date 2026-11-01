import type { AtlasItem, YearMark } from '@/lib/types';
import { t, type Lang, type MessageKey } from '@/lib/i18n';

type Props = {
  lang: Lang;
  item: AtlasItem | null;
  onClose: () => void;
};

function formatMark(mark: YearMark): string {
  if (!mark) return '—';
  const base = String(mark.year);
  return mark.ref ? `${base} (${mark.precision})` : `${base} · ${mark.precision}`;
}

const YEAR_KEYS = [
  'invention',
  'patent',
  'mass_production',
  'popularization',
] as const;

export function ItemDrawer({ lang, item, onClose }: Props) {
  if (!item) return null;

  return (
    <aside className="drawer" aria-live="polite">
      <header className="drawer-header">
        <div>
          <h2>{lang === 'zh' ? item.name_zh : item.name_en}</h2>
          <p className="muted">
            {lang === 'zh' ? item.name_en : item.name_zh} · {item.category}
            {item.disputed ? ` · ${t(lang, 'disputed')}` : ''}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose}>
          {t(lang, 'close')}
        </button>
      </header>

      <p>{lang === 'zh' ? item.summary_zh : item.summary_en}</p>

      <section>
        <h3>{t(lang, 'years')}</h3>
        <ul className="year-list">
          {YEAR_KEYS.map((key) => (
            <li key={key}>
              <span>{t(lang, key as MessageKey)}</span>
              <strong>{formatMark(item.years[key])}</strong>
            </li>
          ))}
          <li>
            <span>primary_year</span>
            <strong>{item.primary_year}</strong>
          </li>
        </ul>
      </section>

      <section>
        <h3>{t(lang, 'locations')}</h3>
        <ul>
          {item.locations.map((loc, i) => (
            <li key={i}>
              <strong>
                {lang === 'zh' ? loc.place_label_zh : loc.place_label_en}
              </strong>
              <span className="muted">
                {' '}
                · {loc.kind}
                {loc.year_override != null ? ` · ${loc.year_override}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {item.notes ? (
        <section>
          <h3>{t(lang, 'notes')}</h3>
          <p className="notes">{item.notes}</p>
        </section>
      ) : null}

      <section>
        <h3>{t(lang, 'sources')}</h3>
        <ul>
          {item.sources.map((s, i) => (
            <li key={i}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
              <span className="muted"> · {s.type}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
