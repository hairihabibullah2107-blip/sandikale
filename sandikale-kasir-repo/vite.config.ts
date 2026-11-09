import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// VITE_BASE: isi "/nama-repo/" untuk GitHub Pages (diatur otomatis oleh workflow). Hosting lain: biarkan kosong.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  build: { sourcemap: false, chunkSizeWarningLimit: 1500 },
});
