import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {viteStaticCopy} from 'vite-plugin-static-copy';

// CesiumJS loads its workers, assets and widget styles at runtime from CESIUM_BASE_URL,
// so they are copied to /cesium as in Cesium's official Vite example.
const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = 'cesium';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: ['ThirdParty', 'Workers', 'Assets', 'Widgets'].map((dir) => ({
        src: `${cesiumSource}/${dir}`,
        dest: cesiumBaseUrl,
        rename: {stripBase: 4},
      })),
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Both apps read the repo-root .env; the repo assets directory is served from the URL root.
  envDir: '..',
  publicDir: '../assets',
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
