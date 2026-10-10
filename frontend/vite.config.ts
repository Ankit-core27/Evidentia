import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Both apps read the repo-root .env, and GLB files are served from /3d/... (see docs/PLAN.md).
  envDir: '..',
  publicDir: '../assets',
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
