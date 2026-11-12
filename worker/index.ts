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

function isPagePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/index.html' || pathname.startsWith('/item/');
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

    // /en is an internal asset directory. Public English URLs retain ?lang=en.
    if (canonical.pathname === '/en' || canonical.pathname.startsWith('/en/')) {
      canonical.pathname = canonical.pathname.slice(3) || '/';
      canonical.searchParams.set('lang', 'en');
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

    // Upgrade legacy /?id=<id> links to permanent /item/<id>/ redirects.
    if (canonical.pathname === '/' && canonical.searchParams.has('id')) {
      const legacyId = canonical.searchParams.get('id')?.trim();
      if (legacyId && !legacyId.includes('/')) {
        const itemPath = `/item/${encodeURIComponent(legacyId)}/`;
        const assetPath = canonical.searchParams.get('lang') === 'en' ? `/en${itemPath}` : itemPath;
        if (await assetExists(env, assetPath, url.origin)) {
          canonical.pathname = itemPath;
          canonical.searchParams.delete('id');
        }
      }
    }

    // Collapse missing trailing slash into a single 301 redirect when the entry exists.
    if (/^\/item\/[^/]+$/.test(canonical.pathname)) {
      const withSlash = `${canonical.pathname}/`;
      const assetPath = canonical.searchParams.get('lang') === 'en' ? `/en${withSlash}` : withSlash;
      if (await assetExists(env, assetPath, url.origin)) {
        canonical.pathname = withSlash;
      }
    }

    if (canonical.href !== url.href) return Response.redirect(canonical.href, 301);

    const english = isPagePath(url.pathname) && url.searchParams.get('lang') === 'en';
    const assetUrl = new URL(url);
    if (english) assetUrl.pathname = `/en${url.pathname}`;
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const location = response.headers.get('Location');
    if (response.status >= 300 && response.status < 400 && location) {
      // Static assets emit 307 for directory/index normalization; promote to 301
      // and map internal /en paths back to public ?lang=en URLs.
      const target = new URL(location, assetUrl);
      if (english) target.pathname = target.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
      target.pathname = stripIndexHtml(target.pathname);
      target.search = url.search;
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
