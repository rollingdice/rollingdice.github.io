// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://banitama.my.id',
  vite: {
    plugins: [tailwindcss()],
    server: {
      host: true,
      // Dev-only: allow the cloudflared HTTPS tunnel host so the phone can test
      // the secure-context (shake) path. The production site (banitama.my.id)
      // is served over its own HTTPS and is unaffected.
      allowedHosts: ['.trycloudflare.com'],
    }
  }
});