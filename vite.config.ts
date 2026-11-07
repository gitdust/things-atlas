import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { readReleaseHistory } from './scripts/release-notes';

export default defineConfig(({ command, mode }) => {
  const releaseRoot = path.resolve(__dirname);
  const historyFile = path.join(releaseRoot, 'src/generated/release-history.json');
  const historyInputs = ['package.json', 'data/changes.json'].map((file) =>
    path.join(releaseRoot, file),
  );
  const writeReleaseHistory = () => {
    const content = JSON.stringify(readReleaseHistory(releaseRoot), null, 2) + '\n';
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    if (!fs.existsSync(historyFile) || fs.readFileSync(historyFile, 'utf8') !== content) {
      fs.writeFileSync(historyFile, content);
    }
  };
  writeReleaseHistory();
  const measurementId = loadEnv(mode, process.cwd(), 'GA_').GA_MEASUREMENT_ID?.trim();
  if (measurementId && !/^G-[A-Z0-9]+$/.test(measurementId)) {
    throw new Error('GA_MEASUREMENT_ID must be a GA4 measurement ID (G-...).');
  }

  return {
    plugins: [
      react(),
      {
        name: 'release-history',
        buildStart() {
          for (const file of historyInputs) this.addWatchFile(file);
          writeReleaseHistory();
        },
        watchChange(file) {
          if (historyInputs.includes(file)) writeReleaseHistory();
        },
        configureServer(server) {
          const updateHistory = (file: string) => {
            if (historyInputs.includes(file)) writeReleaseHistory();
          };
          server.watcher.add(historyInputs);
          server.watcher.on('change', updateHistory);
          server.httpServer?.once('close', () => server.watcher.off('change', updateHistory));
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
