// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://banitama.my.id',
  vite: {
    plugins: [tailwindcss()],
    // Dev-only: allow the cloudflared HTTPS tunnel host so the phone can test
    // the secure-context (shake) path. The production site (banitama.my.id)
    // is served over its own HTTPS and is unaffected.
    //
    // IMPORTANT: this block must ONLY apply during `astro dev`. If it leaks into
    // `astro build`, Vite's allowedHosts injection changes the production routing
    // table and every non-explicit page (e.g. /insights/*) falls back to /dice/.
    // We gate it on the command so a mistaken `astro build` never serves wrong content.
    ...(process.argv.includes('dev') ? {
      server: {
        host: true,
        allowedHosts: ['.trycloudflare.com'],
      },
    } : {}),
  }
});

