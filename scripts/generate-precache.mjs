// Generates public/sw-precache.json from the built dist/ assets so the
// service worker can precache the full app shell (page HTML + hashed JS/CSS).
// Run after `astro build` (npm run build).
// Scoped to the dice page: only the assets that page actually
// references are precached (parsed from its built HTML), so the cache stays
// small and the SW never needs a network path (ADR-0004).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const pageHtml = readFileSync(join(dist, 'dice', 'index.html'), 'utf8');

// Collect /_astro/*.js and /_astro/*.css references from the page HTML.
const refs = [...pageHtml.matchAll(/(\/_astro\/[^"']+\.(?:js|css))/g)].map((m) => m[1]);

const precache = [
  '/',
  '/dice/',
  '/manifest.webmanifest',
  '/dice/icon.svg',
  ...refs,
];

// Verify each referenced asset exists in dist before writing.
// Directory routes (/ and /dice/) are served as index.html.
const missing = precache.filter((p) => {
  if (p === '/' || p === '/dice/') return false;
  const rel = p.replace(/^\//, '');
  try {
    readFileSync(join(dist, rel));
    return false;
  } catch {
    return true;
  }
});
if (missing.length) {
  console.error('Missing precache assets:', missing);
  process.exit(1);
}

writeFileSync('public/sw-precache.json', JSON.stringify(precache, null, 2) + '\n');
console.log(`Wrote public/sw-precache.json with ${precache.length} assets (${refs.length} from page).`);
