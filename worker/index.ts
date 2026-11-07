type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const canonical = new URL(url);
    const production = ['things-atlas.com', 'www.things-atlas.com'].includes(url.hostname);
    if (production) {
      canonical.protocol = 'https:';
      canonical.host = 'things-atlas.com';
    }
    // /en is an internal asset directory. Public English URLs retain ?lang=en.
    if (canonical.pathname === '/en' || canonical.pathname.startsWith('/en/')) {
      canonical.pathname = canonical.pathname.slice(3) || '/';
      canonical.searchParams.set('lang', 'en');
    }
    if (canonical.href !== url.href) return Response.redirect(canonical.href, 301);

    const page =
      url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/item/');
    const english = page && url.searchParams.get('lang') === 'en';
    const assetUrl = new URL(url);
    if (english) assetUrl.pathname = `/en${url.pathname}`;
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const location = response.headers.get('Location');
    if (!english || !location) return response;

    // Static assets may normalize a missing slash or /index.html. Translate
    // their internal Location back into the public URL and retain query state.
    const target = new URL(location, assetUrl);
    target.pathname = target.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
    target.search = url.search;
    const redirected = new Response(response.body, response);
    redirected.headers.set('Location', target.href);
    return redirected;
  },
};
