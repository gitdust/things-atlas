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
  const zh = lang === 'zh';
  const { name, summary, ogSummary, source, milestones, dispute } = content;

  if (format === 'og') {
    return (
      <main id="card" className={image ? 'og with-image' : 'og'} style={{ width, height }}>
        <section className="og-copy">
          <div className="brand">{zh ? SITE_NAME_ZH : SITE_NAME}</div>
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
        <div className="brand">{zh ? SITE_NAME_ZH : SITE_NAME}</div>
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
                  <b>{index + 1}</b> {location[`place_label_${lang}`]}
                </li>
              ))}
            </ul>
            {map.arcs.length > 0 && (
              <div className="map-legend">
                {zh ? '连线表示历史地点关联' : 'Lines connect locations in the entry’s history'}
                {map.arcs.some(({ contested }) => contested) &&
                  (zh ? ' · 虚线表示关联有争议' : ' · Dashed lines indicate disputed links')}
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
            {zh ? '主要来源' : 'Source'} · {source}
          </div>
          <div>
            {zh ? '完整来源见条目' : 'Full sources in the entry'}
            {map && ' · Natural Earth'}
          </div>
          {image && (
            <div>
              {zh ? '图片' : 'Photo'} · {image.credit} · {image.license}
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
