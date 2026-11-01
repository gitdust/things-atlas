import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
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
});
