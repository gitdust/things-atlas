import { useEffect, useRef } from 'react';
import type { AtlasItem, CategoryMeta, YearKey, YearMark } from '@/lib/types';
import { YEAR_KEYS } from '@/lib/primaryYear';
import { CATEGORY_COLORS } from '@/lib/theme';
import { t, type Lang, type MessageKey } from '@/lib/i18n';

type Props = {
  lang: Lang;
  item: AtlasItem | null;
  entryNo: number | null;
  category: CategoryMeta | null;
  onClose: () => void;
};

function primaryKeyOf(item: AtlasItem): YearKey | null {
  if (item.primary && item.years[item.primary]) return item.primary;
  return YEAR_KEYS.find((k) => item.years[k] != null) ?? null;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function fmtCoord(lat: number, lng: number) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lng).toFixed(2)}°${ew}`;
}

export function ItemDrawer({ lang, item, entryNo, category, onClose }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  const color = CATEGORY_COLORS[item.category];
  const pKey = primaryKeyOf(item);
  const milestones = YEAR_KEYS.map((key) => ({ key, mark: item.years[key] as YearMark }))
    .sort((a, b) => {
      if (!a.mark) return 1;
      if (!b.mark) return -1;
      return a.mark.year - b.mark.year;
    });
  const title = lang === 'zh' ? item.name_zh : item.name_en;
  const alt = lang === 'zh' ? item.name_en : item.name_zh;

  return (
    <aside
      className="drawer"
      aria-label={title}
      style={{ ['--item-color' as string]: color }}
    >
      <div className="drawer-scroll" ref={bodyRef}>
        <header className="drawer-head">
          <div className="drawer-kicker">
            <span className="kicker-no num">
              {t(lang, 'entry')} {entryNo != null ? String(entryNo).padStart(3, '0') : ''}
            </span>
            <span className="kicker-sep" />
            <span className="kicker-cat">
              <span className="chip-dot" />
              {category ? (lang === 'zh' ? category.name_zh : category.name_en) : item.category}
            </span>
            {item.disputed ? <span className="badge-disputed">{t(lang, 'disputed')}</span> : null}
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label={t(lang, 'close')}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <h2 className={`drawer-title lang-${lang}`}>{title}</h2>
        <p className="drawer-alt">{alt}</p>

        <div className="drawer-primary">
          <span className="num">{item.primary_year}</span>
          <small>
            {t(lang, 'primaryYear')}
            {pKey ? ` · ${t(lang, pKey as MessageKey)}` : ''}
          </small>
        </div>

        
        {item.image ? (
          <figure className="drawer-figure">
            <img
              src={item.image.src}
              alt={lang === 'zh' ? item.image.alt_zh : item.image.alt_en}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <span>{t(lang, 'photoCredit')}</span>
              {item.image.credit || item.image.license || item.image.source_url ? (
                <span className="fig-credit">
                  {item.image.source_url ? (
                    <a href={item.image.source_url} target="_blank" rel="noreferrer">
                      {[item.image.credit, item.image.license].filter(Boolean).join(' · ') ||
                        (lang === 'zh' ? '来源' : 'Source')}
                    </a>
                  ) : (
                    [item.image.credit, item.image.license].filter(Boolean).join(' · ')
                  )}
                </span>
              ) : null}
            </figcaption>
          </figure>
        ) : null}

        <p className="drawer-lede">{lang === 'zh' ? item.summary_zh : item.summary_en}</p>

        <section className="drawer-section">
          <h3>{t(lang, 'milestones')}</h3>
          <ol className="milestones">
            {milestones.map(({ key, mark }) => (
              <li
                key={key}
                className={`${mark ? '' : 'is-null'}${key === pKey ? ' is-primary' : ''}`}
              >
                <span className="ms-year num">{mark ? mark.year : '—'}</span>
                <span className="ms-node" aria-hidden="true" />
                <div className="ms-body">
                  <div className="ms-label">
                    {t(lang, key as MessageKey)}
                    {mark && mark.precision !== 'year' ? (
                      <span className="ms-precision">
                        {t(lang, `precision_${mark.precision}` as MessageKey)}
                      </span>
                    ) : null}
                    {key === pKey ? <span className="ms-primary">{t(lang, 'primaryYear')}</span> : null}
                  </div>
                  {mark?.ref ? <div className="ms-ref">{mark.ref}</div> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="drawer-section">
          <h3>{t(lang, 'locations')}</h3>
          <ul className="places">
            {item.locations.map((loc, i) => (
              <li key={i} className={`kind-${loc.kind}`}>
                <span className="place-mark" aria-hidden="true" />
                <div className="place-body">
                  <div className="place-name">
                    {lang === 'zh' ? loc.place_label_zh : loc.place_label_en}
                  </div>
                  <div className="place-meta">
                    <span className="place-kind">{t(lang, `kind_${loc.kind}` as MessageKey)}</span>
                    {loc.year_override != null ? (
                      <span className="num"> · {loc.year_override}</span>
                    ) : null}
                    <span className="place-coord num"> · {fmtCoord(loc.lat, loc.lng)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {item.notes ? (
          <section className="drawer-section">
            <h3>{t(lang, 'notes')}</h3>
            <blockquote className="notes">{item.notes}</blockquote>
          </section>
        ) : null}

        <section className="drawer-section">
          <h3>{t(lang, 'sources')}</h3>
          <ol className="sources">
            {item.sources.map((s, i) => (
              <li key={i}>
                <span className="src-no num">{i + 1}</span>
                <div>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                  <div className="src-meta">
                    {hostOf(s.url)} · {s.type} · <span className="num">{s.accessed}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="drawer-foot num">
          {lang === 'zh' ? '更新于' : 'Updated'} {item.updated}
        </footer>
      </div>
    </aside>
  );
}
