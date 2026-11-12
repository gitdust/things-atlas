import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/index.ts';

const FILES = new Set([
  '/index.html',
  '/en/index.html',
  '/item/mirror/index.html',
  '/en/item/mirror/index.html',
  '/404.html',
]);

/** Simulate Cloudflare Workers Assets with auto-trailing-slash + 404-page handling. */
function createAssetsEnv() {
  return {
    ASSETS: {
      async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const p = url.pathname;
        const body = (text: string) => (request.method === 'HEAD' ? null : text);

        if (p === '/404.html') {
          return new Response(null, { status: 307, headers: { Location: '/404' } });
        }
        if (p === '/404') {
          return new Response(body('404 page'), {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }
        if (p === '/index.html' || p.endsWith('/index.html')) {
          const target = p === '/index.html' ? '/' : p.slice(0, -'index.html'.length);
          if (FILES.has(p)) {
            return new Response(null, { status: 307, headers: { Location: target } });
          }
        }
        if (!p.endsWith('/') && FILES.has(`${p}/index.html`)) {
          return new Response(null, { status: 307, headers: { Location: `${p}/` } });
        }
        if (p.endsWith('/') && FILES.has(`${p}index.html`)) {
          return new Response(body(`served:${p}`), {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }
        return new Response(body('404 page'), {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      },
    },
  };
}

const env = createAssetsEnv();

test('canonical Chinese and English URLs serve 200 directly', async () => {
  for (const [url, expected] of [
    ['https://things-atlas.com/', 'served:/'],
    ['https://things-atlas.com/?lang=en', 'served:/en/'],
    ['https://things-atlas.com/item/mirror/', 'served:/item/mirror/'],
    ['https://things-atlas.com/item/mirror/?lang=en', 'served:/en/item/mirror/'],
  ] as const) {
    const res = await worker.fetch(new Request(url), env);
    assert.equal(res.status, 200, url);
    assert.equal(await res.text(), expected, url);
  }
});

test('http, www, workers.dev, and pages.dev redirect 301 to canonical origin', async () => {
  for (const url of [
    'http://things-atlas.com/item/mirror/',
    'https://www.things-atlas.com/item/mirror/',
    'https://things-atlas.example.workers.dev/item/mirror/',
    'https://things-atlas.pages.dev/item/mirror/',
  ]) {
    const res = await worker.fetch(new Request(url), env);
    assert.equal(res.status, 301, url);
    assert.equal(res.headers.get('Location'), 'https://things-atlas.com/item/mirror/', url);
  }
});

test('local development hosts are not redirected to production', async () => {
  const res = await worker.fetch(new Request('http://localhost:8787/item/mirror/'), env);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'served:/item/mirror/');
});

test('missing trailing slash, index.html, and /en/ paths redirect with 301 in a single hop', async () => {
  const cases: Array<[string, string]> = [
    ['https://things-atlas.com/item/mirror', 'https://things-atlas.com/item/mirror/'],
    [
      'https://things-atlas.com/item/mirror?lang=en',
      'https://things-atlas.com/item/mirror/?lang=en',
    ],
    ['https://things-atlas.com/en', 'https://things-atlas.com/?lang=en'],
    ['https://things-atlas.com/en/', 'https://things-atlas.com/?lang=en'],
    ['https://things-atlas.com/en/item/mirror', 'https://things-atlas.com/item/mirror/?lang=en'],
    ['https://things-atlas.com/en/item/mirror/', 'https://things-atlas.com/item/mirror/?lang=en'],
    ['https://things-atlas.com/index.html', 'https://things-atlas.com/'],
    ['https://things-atlas.com/index.html?lang=en', 'https://things-atlas.com/?lang=en'],
    ['https://things-atlas.com/item/mirror/index.html', 'https://things-atlas.com/item/mirror/'],
    [
      'https://things-atlas.com/en/item/mirror/index.html',
      'https://things-atlas.com/item/mirror/?lang=en',
    ],
  ];
  for (const [input, expected] of cases) {
    const res = await worker.fetch(new Request(input), env);
    assert.equal(res.status, 301, input);
    assert.equal(res.headers.get('Location'), expected, input);
  }
});

test('legacy /?id=<id> URLs 301 redirect to /item/<id>/ when item exists', async () => {
  const zh = await worker.fetch(new Request('https://things-atlas.com/?id=mirror'), env);
  assert.equal(zh.status, 301);
  assert.equal(zh.headers.get('Location'), 'https://things-atlas.com/item/mirror/');

  const en = await worker.fetch(new Request('https://things-atlas.com/?id=mirror&lang=en'), env);
  assert.equal(en.status, 301);
  assert.equal(en.headers.get('Location'), 'https://things-atlas.com/item/mirror/?lang=en');

  const enPath = await worker.fetch(new Request('https://things-atlas.com/en/?id=mirror'), env);
  assert.equal(enPath.status, 301);
  assert.equal(enPath.headers.get('Location'), 'https://things-atlas.com/item/mirror/?lang=en');

  const unknown = await worker.fetch(new Request('https://things-atlas.com/?id=unknown'), env);
  assert.equal(unknown.status, 200);
});

test('404 routes and missing items return 404 directly without redirect or 200 soft-404', async () => {
  for (const url of [
    'https://things-atlas.com/404',
    'https://things-atlas.com/404.html',
    'https://things-atlas.com/en/404.html',
    'https://things-atlas.com/item/nonexistent',
    'https://things-atlas.com/item/nonexistent/',
    'https://things-atlas.com/item/nonexistent/?lang=en',
  ]) {
    const res = await worker.fetch(new Request(url), env);
    assert.equal(res.status, 404, url);
    assert.equal(res.headers.get('Location'), null, url);
    assert.equal(await res.text(), '404 page', url);
  }

  const head = await worker.fetch(
    new Request('https://things-atlas.com/404.html', { method: 'HEAD' }),
    env,
  );
  assert.equal(head.status, 404);
  assert.equal(await head.text(), '');
});
