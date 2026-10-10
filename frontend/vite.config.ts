import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
