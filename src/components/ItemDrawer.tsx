import { itemPath } from '@/lib/seo';
import { DisputeIcon } from './DisputeIcon';
import { useEffect, useRef, useState } from 'react';
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
  prevItem?: AtlasItem | null;
  nextItem?: AtlasItem | null;
  /** The entry opened by the landing URL: its photo is likely the LCP element, so don't lazy-load it. */
  eagerImage?: boolean;
  active?: boolean;
  onClose: () => void;
  onNavigate?: (id: string) => void;
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
  prevItem,
  nextItem,
  eagerImage = false,
  active = true,
  onClose,
  onNavigate,
}: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const itemId = item?.id;
  const [shareStatus, setShareStatus] = useState('');
  useEffect(() => setShareStatus(''), [itemId, lang]);

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
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest('input, textarea, select') || e.target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '[' || (e.key === 'ArrowLeft' && e.altKey)) {
        if (prevItem) onNavigate?.(prevItem.id);
      } else if (e.key === ']' || (e.key === 'ArrowRight' && e.altKey)) {
        if (nextItem) onNavigate?.(nextItem.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, active, onClose, prevItem, nextItem, onNavigate]);

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
          <div className="drawer-head-left">
            <button
              id="close-btn"
              type="button"
              className="close-btn back-btn"
              onClick={onClose}
              aria-label={t(lang, 'back')}
              title={t(lang, 'back')}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M12.5 8H3.5M7 4.5 3.5 8 7 11.5" />
              </svg>
            </button>
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
                <span className="badge-disputed" title={t(lang, 'disputed')}>
                  <DisputeIcon label={t(lang, 'disputed')} />
                </span>
              ) : null}
            </div>
          </div>
          <div className="drawer-actions">
            <button
              type="button"
              className="close-btn share-btn"
              aria-label={lang === 'zh' ? '分享条目' : 'Share entry'}
              title={lang === 'zh' ? '分享条目' : 'Share entry'}
              onClick={async () => {
                const url = new URL(
                  `${import.meta.env.BASE_URL.replace(/\/$/, '')}${itemPath(item.id)}`,
                  window.location.origin,
                );
                if (lang === 'en') url.searchParams.set('lang', 'en');
                setShareStatus('');
                try {
                  if (navigator.share) {
                    await navigator.share({ title, url: url.href });
                  } else {
                    await navigator.clipboard.writeText(url.href);
                    setShareStatus(lang === 'zh' ? '链接已复制' : 'Link copied');
                  }
                } catch (error) {
                  if (error instanceof Error && error.name === 'AbortError') return;
                  setShareStatus(
                    lang === 'zh'
                      ? '分享失败，请复制地址栏链接'
                      : 'Unable to share. Copy the address bar link.',
                  );
                }
              }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="12" cy="4" r="2" />
                <circle cx="4" cy="8" r="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="M5.8 7.1l4.4-2.2M5.8 8.9l4.4 2.2" />
              </svg>
            </button>
          </div>
        </header>

        <h1 ref={titleRef} tabIndex={-1} className={`drawer-title lang-${lang}`}>
          {title}
        </h1>
        <p className="drawer-alt">{alt}</p>
        <span className="share-status" role="status">
          {shareStatus}
        </span>

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

        <nav
          className="drawer-footer-nav"
          aria-label={lang === 'zh' ? '相邻条目' : 'Adjacent entries'}
        >
          {prevItem ? (
            <button
              type="button"
              className="drawer-nav-card prev"
              onClick={() => onNavigate?.(prevItem.id)}
            >
              <span className="nav-card-dir">← {lang === 'zh' ? '上一条' : 'Previous'}</span>
              <strong className="nav-card-title">
                {pick(lang, prevItem.name_zh, prevItem.name_en)}
              </strong>
              <span className="nav-card-year num">{formatYear(lang, prevItem.primary_year)}</span>
            </button>
          ) : (
            <div className="drawer-nav-card-placeholder" />
          )}

          {nextItem ? (
            <button
              type="button"
              className="drawer-nav-card next"
              onClick={() => onNavigate?.(nextItem.id)}
            >
              <span className="nav-card-dir">{lang === 'zh' ? '下一条' : 'Next'} →</span>
              <strong className="nav-card-title">
                {pick(lang, nextItem.name_zh, nextItem.name_en)}
              </strong>
              <span className="nav-card-year num">{formatYear(lang, nextItem.primary_year)}</span>
            </button>
          ) : (
            <div className="drawer-nav-card-placeholder" />
          )}
        </nav>
      </div>
    </aside>
  );
}
