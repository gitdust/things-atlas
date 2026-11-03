import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readReleaseManifest } from './scripts/release-notes';

export default defineConfig(({ command, mode }) => {
  const releaseRoot = path.resolve(__dirname);
  // Validate drafts too, so bad records cannot silently reach production.
  readReleaseManifest(releaseRoot);
  const measurementId = loadEnv(mode, process.cwd(), 'GA_').GA_MEASUREMENT_ID?.trim();
  if (measurementId && !/^G-[A-Z0-9]+$/.test(measurementId)) {
    throw new Error('GA_MEASUREMENT_ID must be a GA4 measurement ID (G-...).');
  }

  return {
    plugins: [
      react(),
      {
        name: 'release-manifest',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
            if (pathname !== `${server.config.base}version.json`) return next();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(readReleaseManifest(releaseRoot)));
          });
        },
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify(readReleaseManifest(releaseRoot)),
          });
        },
      },
      {
        name: 'google-analytics',
        transformIndexHtml() {
          if (command !== 'build' || !measurementId) return [];
          return [
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
              },
              injectTo: 'head' as const,
            },
            {
              tag: 'script',
              children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`,
              injectTo: 'head' as const,
            },
          ];
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      target: 'es2020',
      rollupOptions: {
        output: {
          // Keep MapLibre in its own long-cacheable vendor chunk, loaded lazily
          // by MapView; React stays in the small entry chunk.
          manualChunks(id) {
            // JS only: MapLibre's CSS must stay in MapView's stylesheet, ahead of
            // our overrides in styles/map.css.
            if (/node_modules\/maplibre-gl\/.*\.js$/.test(id)) return 'maplibre';
          },
        },
      },
      // maplibre-gl ships as one pre-bundled ~800 kB module that can't be split
      // further; it's lazy-loaded off the critical path, so allow it explicitly.
      // Everything on the critical path stays far below this.
      chunkSizeWarningLimit: 850,
    },
  };
});
