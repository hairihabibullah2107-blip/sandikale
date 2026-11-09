import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// GitHub Pages project site: https://<user>.github.io/sandikale/
// VITE_BASE can override this for other hosting environments.
export default defineConfig({
  base: process.env.VITE_BASE || '/sandikale/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  build: { sourcemap: false, chunkSizeWarningLimit: 1500 },
});
