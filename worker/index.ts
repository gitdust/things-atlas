import { langFromCookie, negotiateLang } from '../src/lib/locale-pref';

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

const CANONICAL_HOST = 'things-atlas.com';
const PRODUCTION_HOSTS = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

function isManagedHost(hostname: string): boolean {
  return (
    PRODUCTION_HOSTS.has(hostname) ||
    hostname.endsWith('.workers.dev') ||
    hostname.endsWith('.pages.dev')
  );
}

const LOCALES = ['en', 'es', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

function localeOf(pathname: string): Locale | null {
  const code = pathname.split('/')[1];
  return (LOCALES as readonly string[]).includes(code) ? (code as Locale) : null;
}

function stripLocale(pathname: string): string {
  const locale = localeOf(pathname);
  if (!locale) return pathname;
  const rest = pathname.slice(locale.length + 1);
  return rest || '/';
}

function isNotFoundPath(pathname: string): boolean {
  return pathname === '/404' || pathname === '/404/' || pathname === '/404.html';
}

function stripIndexHtml(pathname: string): string {
  if (pathname === '/index.html') return '/';
  if (pathname.endsWith('/index.html')) return pathname.slice(0, -'index.html'.length);
  return pathname;
}

async function assetExists(env: Env, pathname: string, origin: string): Promise<boolean> {
  const probeUrl = new URL(pathname, origin);
  const response = await env.ASSETS.fetch(new Request(probeUrl.href, { method: 'HEAD' }));
  return response.status === 200;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const canonical = new URL(url);
    if (isManagedHost(url.hostname)) {
      canonical.protocol = 'https:';
      canonical.host = CANONICAL_HOST;
    }

    // Legacy ?lang= now lives in the path. Chinese has no prefix.
    const legacyLang = canonical.searchParams.get('lang');
    if (legacyLang === 'zh' || (LOCALES as readonly string[]).includes(legacyLang ?? '')) {
      canonical.searchParams.delete('lang');
      if (legacyLang && legacyLang !== 'zh' && !localeOf(canonical.pathname)) {
        canonical.pathname =
          canonical.pathname === '/' ? `/${legacyLang}/` : `/${legacyLang}${canonical.pathname}`;
      }
    }
    canonical.pathname = stripIndexHtml(canonical.pathname);

    if (isNotFoundPath(canonical.pathname)) {
      const method = request.method === 'HEAD' ? 'HEAD' : 'GET';
      let notFound = await env.ASSETS.fetch(new Request(new URL('/404', url), { method }));
      if (notFound.status >= 300 && notFound.status < 400) {
        notFound = await env.ASSETS.fetch(new Request(new URL('/__404__', url), { method }));
      }
      const headers = new Headers(notFound.headers);
      headers.delete('Location');
      return new Response(method === 'HEAD' ? null : notFound.body, {
        status: 404,
        headers,
      });
    }

    const barePath = stripLocale(canonical.pathname);
    const locale = localeOf(canonical.pathname);

    // Upgrade legacy /?id=<id> links to permanent /item/<id>/ redirects.
    if (barePath === '/' && canonical.searchParams.has('id')) {
      const legacyId = canonical.searchParams.get('id')?.trim();
      if (legacyId && !legacyId.includes('/')) {
        const itemPath = `/item/${encodeURIComponent(legacyId)}/`;
        const assetPath = locale ? `/${locale}${itemPath}` : itemPath;
        if (await assetExists(env, assetPath, url.origin)) {
          canonical.pathname = locale ? `/${locale}${itemPath}` : itemPath;
          canonical.searchParams.delete('id');
        }
      }
    }

    // Collapse missing trailing slash into a single 301 redirect when the entry exists.
    if (/^\/item\/[^/]+$/.test(barePath)) {
      const withSlash = `${barePath}/`;
      const assetPath = locale ? `/${locale}${withSlash}` : withSlash;
      if (await assetExists(env, assetPath, url.origin)) {
        canonical.pathname = assetPath;
      }
    }

    const chosen = langFromCookie(request.headers.get('cookie'));
    const automatic = chosen ?? negotiateLang(request.headers.get('accept-language'));
    const currentLocale = localeOf(canonical.pathname);
    const currentBare = stripLocale(canonical.pathname);
    const page = currentBare === '/' || currentBare.startsWith('/item/');
    let languageRedirect = false;
    if (!currentLocale && page && automatic && automatic !== 'zh' && request.method !== 'POST') {
      canonical.pathname = currentBare === '/' ? `/${automatic}/` : `/${automatic}${currentBare}`;
      languageRedirect = canonical.pathname !== url.pathname;
    }

    if (canonical.href !== url.href)
      return Response.redirect(canonical.href, languageRedirect ? 302 : 301);

    const assetUrl = new URL(url);
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const location = response.headers.get('Location');
    if (response.status >= 300 && response.status < 400 && location) {
      // Static assets emit 307 for directory/index normalization; promote to 301
      // and map internal /en paths back to public ?lang=en URLs.
      const target = new URL(location, assetUrl);
      target.pathname = stripIndexHtml(target.pathname);
      target.search = canonical.search;
      if (isManagedHost(target.hostname)) {
        target.protocol = 'https:';
        target.host = CANONICAL_HOST;
      }
      if (target.href !== url.href) {
        return Response.redirect(target.href, 301);
      }
    }
    return response;
  },
};
