/**
 * Site-wide constants for SEO (canonical URLs, Open Graph, sitemap, robots).
 *
 * ⚠️ SITE_URL is a PLACEHOLDER — set it to the real public origin before
 * deploying (no trailing slash). The prerender step also accepts an override:
 *   SITE_URL=https://atlas.example.org npm run build
 */
export const SITE_URL = 'https://things-atlas.example.com';

export const SITE_NAME = 'Things Atlas';
export const SITE_NAME_ZH = '日常之物图志';

/** 1200×630 social preview (public/og-image.jpg). */
export const OG_IMAGE = { path: '/og-image.jpg', width: 1200, height: 630 } as const;

/** Optional X/Twitter @handle for twitter:site (leave empty to omit). */
export const TWITTER_SITE = '';
