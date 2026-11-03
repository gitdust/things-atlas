import { DisputeIcon } from './DisputeIcon';
import { useEffect, useRef } from 'react';
import type { AtlasItem, CategoryMeta, ItemImage, YearKey, YearMark } from '@/lib/types';
import { YEAR_KEYS } from '@/lib/primaryYear';
import { categoryColor } from '@/lib/tokens';
import { IMAGE_SIZES, variantSrcSet } from '@/lib/images';
import { pick, t, type Lang, type MessageKey, formatYear } from '@/lib/i18n';

type Props = {
  lang: Lang;
  item: AtlasItem | null;
  entryNo: number | null;
  category: CategoryMeta | null;
  /** The entry opened by the landing URL: its photo is likely the LCP element, so don't lazy-load it. */
  eagerImage?: boolean;
  active?: boolean;
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

/** <picture> with AVIF/WebP variants from scripts/build-images.ts, JPEG fallback. */
function ResponsiveImage({ image, alt, eager }: { image: ItemImage; alt: string; eager: boolean }) {
  const widths = image.widths?.length ? image.widths : null;
  return (
    <picture>
      {widths ? (
        <source
          type="image/avif"
          srcSet={variantSrcSet(image.src, widths, 'avif')}
          sizes={IMAGE_SIZES}
        />
      ) : null}
      {widths ? (
        <source
          type="image/webp"
          srcSet={variantSrcSet(image.src, widths, 'webp')}
          sizes={IMAGE_SIZES}
        />
      ) : null}
      <img
        src={image.src}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </picture>
  );
}

export function ItemDrawer({
  lang,
  item,
  entryNo,
  category,
  eagerImage = false,
  active = true,
  onClose,
}: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const itemId = item?.id;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [item?.id]);

  useEffect(() => {
    if (active && itemId) titleRef.current?.focus({ preventScroll: true });
  }, [active, itemId]);

  useEffect(() => {
    if (!item || !active) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, active, onClose]);

  if (!item) return null;

  const color = categoryColor[item.category];
  const pKey = primaryKeyOf(item);
  const milestones = YEAR_KEYS.map((key) => ({ key, mark: item.years[key] as YearMark })).sort(
    (a, b) => {
      if (!a.mark) return 1;
      if (!b.mark) return -1;
      return a.mark.year - b.mark.year;
    },
  );
  const title = pick(lang, item.name_zh, item.name_en);
  const alt = pick(lang === 'zh' ? 'en' : 'zh', item.name_zh, item.name_en);

  return (
    <aside className="drawer" aria-label={title} style={{ ['--item-color' as string]: color }}>
      <div className="drawer-scroll" ref={bodyRef}>
        <header className="drawer-head">
          <div className="drawer-kicker">
            <span className="kicker-no num">
              {t(lang, 'entry')} {entryNo != null ? String(entryNo).padStart(3, '0') : ''}
            </span>
            <span className="kicker-sep" />
            <span className="kicker-cat">
              <span className="chip-dot" />
              {category ? pick(lang, category.name_zh, category.name_en) : item.category}
            </span>
            {item.disputed ? (
              <span className="badge-disputed">
                <DisputeIcon label={t(lang, 'disputed')} />
                {t(lang, 'disputed')}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label={t(lang, 'close')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <h2 ref={titleRef} tabIndex={-1} className={`drawer-title lang-${lang}`}>
          {title}
        </h2>
        <p className="drawer-alt">{alt}</p>

        <div className="drawer-primary">
          <span className="num">{formatYear(lang, item.primary_year)}</span>
          <small>
            {t(lang, 'primaryYear')}
            {pKey ? ` · ${t(lang, pKey as MessageKey)}` : ''}
          </small>
        </div>

        {item.image ? (
          <figure className="drawer-figure">
            <ResponsiveImage
              image={item.image}
              alt={pick(lang, item.image.alt_zh, item.image.alt_en)}
              eager={eagerImage}
            />
            <figcaption>
              <span>{t(lang, 'photoCredit')}</span>
              {item.image.credit || item.image.license || item.image.source_url ? (
                <span className="fig-credit">
                  {item.image.source_url ? (
                    <a href={item.image.source_url} target="_blank" rel="noreferrer">
                      {[item.image.credit, item.image.license].filter(Boolean).join(' · ') ||
                        t(lang, 'photoSource')}
                    </a>
                  ) : (
                    [item.image.credit, item.image.license].filter(Boolean).join(' · ')
                  )}
                </span>
              ) : null}
            </figcaption>
          </figure>
        ) : null}

        <p className="drawer-lede">{pick(lang, item.summary_zh, item.summary_en)}</p>

        <section className="drawer-section">
          <h3>{t(lang, 'milestones')}</h3>
          <ol className="milestones">
            {milestones.map(({ key, mark }) => (
              <li
                key={key}
                className={`${mark ? '' : 'is-null'}${key === pKey ? ' is-primary' : ''}`}
              >
                <span className="ms-year num">
                  {mark ? formatYear(lang, mark.year, true) : '—'}
                </span>
                <span className="ms-node" aria-hidden="true" />
                <div className="ms-body">
                  <div className="ms-label">
                    {t(lang, key as MessageKey)}
                    {mark && mark.precision !== 'year' ? (
                      <span className="ms-precision">
                        {t(lang, `precision_${mark.precision}` as MessageKey)}
                      </span>
                    ) : null}
                    {key === pKey ? (
                      <span className="ms-primary">{t(lang, 'primaryYear')}</span>
                    ) : null}
                  </div>
                  {mark && pick(lang, mark.ref_zh, mark.ref) ? (
                    <div className="ms-ref">{pick(lang, mark.ref_zh, mark.ref)}</div>
                  ) : null}
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
                    {pick(lang, loc.place_label_zh, loc.place_label_en)}
                  </div>
                  <div className="place-meta">
                    <span className="place-kind">{t(lang, `kind_${loc.kind}` as MessageKey)}</span>
                    {loc.year_override != null ? (
                      <span className="num"> · {formatYear(lang, loc.year_override)}</span>
                    ) : null}
                    <span className="place-coord num"> · {fmtCoord(loc.lat, loc.lng)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {item.disputed && pick(lang, item.notes, item.notes_en) ? (
          <section className="drawer-section">
            <h3>{t(lang, 'notes')}</h3>
            <blockquote className="notes">{pick(lang, item.notes, item.notes_en)}</blockquote>
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
      </div>
    </aside>
  );
}
