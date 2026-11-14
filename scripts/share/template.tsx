/** @jsxRuntime classic */
/** @jsx React.createElement */
import React from 'react';
import { SITE_NAME, SITE_NAME_ZH } from '../../src/config/site';
import { SHARE_FORMATS, type ShareFormat, shareContent } from '../../src/lib/share';
import type { Lang } from '../../src/lib/i18n';
import { MAP_WIDTH, MAP_HEIGHT, type posterMap } from './map';

type Props = {
  format: ShareFormat;
  lang: Lang;
  content: ReturnType<typeof shareContent>;
  image?: { src: string; credit: string; license: string; source: string };
  map?: ReturnType<typeof posterMap>;
  qr?: { size: number; path: string };
};

export function ShareCard({ format, lang, content, image, map, qr }: Props) {
  const { width, height } = SHARE_FORMATS[format];
  // Keep every QR module aligned to a whole pixel and the quiet zone intact.
  const qrPixels = qr ? Math.floor(200 / qr.size) * qr.size : 0;
  const brand =
    lang === 'zh'
      ? SITE_NAME_ZH
      : lang === 'ja'
        ? '日常のもの図志'
        : lang === 'es'
          ? 'Atlas de objetos'
          : SITE_NAME;
  const lines =
    lang === 'zh'
      ? '连线表示历史地点关联'
      : lang === 'ja'
        ? '線は歴史上の場所のつながり'
        : lang === 'es'
          ? 'Las líneas unen lugares de la historia'
          : 'Lines connect locations in the entry’s history';
  const dashed =
    lang === 'zh'
      ? ' · 虚线表示关联有争议'
      : lang === 'ja'
        ? ' · 破線は異説のあるつながり'
        : lang === 'es'
          ? ' · La línea discontinua marca un vínculo en disputa'
          : ' · Dashed lines indicate disputed links';
  const sourceLabel =
    lang === 'zh'
      ? '主要来源'
      : lang === 'ja'
        ? '主な出典'
        : lang === 'es'
          ? 'Fuente principal'
          : 'Source';
  const more =
    lang === 'zh'
      ? '完整来源见条目'
      : lang === 'ja'
        ? '出典の全文は項目へ'
        : lang === 'es'
          ? 'Fuentes completas en la entrada'
          : 'Full sources in the entry';
  const photo = lang === 'zh' ? '图片' : lang === 'ja' ? '写真' : lang === 'es' ? 'Foto' : 'Photo';
  const { name, summary, ogSummary, source, milestones, dispute } = content;

  if (format === 'og') {
    return (
      <main id="card" className={image ? 'og with-image' : 'og'} style={{ width, height }}>
        <section className="og-copy">
          <div className="brand">{brand}</div>
          <h1 data-fit="name">{name}</h1>
          {dispute && <div className="dispute">{dispute}</div>}
          <p className="summary" data-fit="ogSummary">
            {ogSummary}
          </p>
        </section>
        {image && (
          <figure className="og-photo">
            <img src={image.src} alt="" />
            <figcaption data-fit="image credit">
              {image.credit} · {image.license}
            </figcaption>
          </figure>
        )}
      </main>
    );
  }

  return (
    <main id="card" className={image ? 'poster with-image' : 'poster'} style={{ width, height }}>
      <header>
        <div className="brand">{brand}</div>
        <h1 data-fit="name">{name}</h1>
        {dispute && <div className="dispute">{dispute}</div>}
      </header>
      {map && (
        <figure className="poster-map">
          <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-hidden="true">
            <g className="map-land">
              {map.landPaths.map((path, index) => (
                <path key={index} d={path} />
              ))}
            </g>
            <g className="map-arcs">
              {map.arcs.map(({ path, contested }, index) => (
                <path key={index} d={path} strokeDasharray={contested ? '9 7' : undefined} />
              ))}
            </g>
            {map.pins.map(({ x, y, labelX, labelY, location }, index) => (
              <g
                key={index}
                className={location.kind === 'contested' ? 'map-pin contested' : 'map-pin'}
              >
                <circle className="map-point" cx={x} cy={y} r={4} />
                <path className="map-leader" d={`M${x} ${y}L${labelX} ${labelY}`} />
                <circle className="map-label" cx={labelX} cy={labelY} r={13} />
                <text x={labelX} y={labelY}>
                  {index + 1}
                </text>
              </g>
            ))}
          </svg>
          <figcaption data-fit="map locations">
            <ul>
              {map.pins.map(({ location }, index) => (
                <li key={index}>
                  <b>{index + 1}</b> {location[lang === 'zh' ? 'place_label_zh' : 'place_label_en']}
                </li>
              ))}
            </ul>
            {map.arcs.length > 0 && (
              <div className="map-legend">
                {lines}
                {map.arcs.some(({ contested }) => contested) ? dashed : null}
              </div>
            )}
          </figcaption>
        </figure>
      )}
      <section className="history">
        <div className="history-lead">
          <p className="summary" data-fit="summary">
            {summary}
          </p>
          {image && (
            <figure className="poster-photo">
              <img src={image.src} alt="" />
            </figure>
          )}
        </div>
        {milestones.length > 0 && (
          <ol>
            {milestones.map(({ year, date, label, text }) => (
              <li key={year} data-fit="milestone">
                <strong>{date}</strong>
                <span>
                  {label ? `${label} · ` : ''}
                  {text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <footer>
        <section className="credits" data-fit="credit">
          <div>
            {sourceLabel} · {source}
          </div>
          <div>
            {more}
            {map && ' · Natural Earth'}
          </div>
          {image && (
            <div>
              {photo} · {image.credit} · {image.license}
              <br />
              {image.source}
            </div>
          )}
          <div>
            Things Atlas · CC BY 4.0
            <br />
            creativecommons.org/licenses/by/4.0
          </div>
        </section>
        {qr && (
          <div className="qr">
            <svg
              width={qrPixels}
              height={qrPixels}
              viewBox={`0 0 ${qr.size} ${qr.size}`}
              shapeRendering="crispEdges"
              aria-hidden="true"
            >
              <rect width={qr.size} height={qr.size} fill="#fff" />
              <path d={qr.path} />
            </svg>
          </div>
        )}
      </footer>
    </main>
  );
}
