import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// GitHub Pages project site: https://<user>.github.io/sandikale/
// VITE_BASE can override this for other hosting environments.
// Use the root path in the development server (Codespaces preview),
// while keeping /sandikale/ for the production GitHub Pages build.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE || (command === 'serve' ? '/' : '/sandikale/'),
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  build: { sourcemap: false, chunkSizeWarningLimit: 1500 },
}));
