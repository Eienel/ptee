import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  resolve: { alias: { buffer: 'buffer/' } },
  // Ember's API sends no CORS headers, so it is proxied through this origin.
  // `vercel.json` does the same rewrite in production.
  server: {
    proxy: {
      '/ember': {
        target: 'https://embercurve.fun',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ember/, '/api/solana'),
      },
    },
  },
});
