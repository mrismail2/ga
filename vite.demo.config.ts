import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Demo build: the Supabase client is swapped for the in-memory one in
 * src/demo so the whole system can be explored (and screenshotted) with no
 * backend. `npm run build` uses vite.config.ts and is unaffected.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      { find: /^@\/lib\/supabase$/, replacement: fileURLToPath(new URL('./src/demo/client.ts', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  build: { outDir: 'dist-demo' },
});
