# ADR-0004 — Zero network calls by design

**Status**: Accepted

## Context

A seed generator that makes network requests could exfiltrate a seed (accidentally or via a supply-chain bug). The app runs offline-capable and claims "full security features."

## Decision

The app makes **zero network calls** by design. All code (BIP-39 wordlist, crypto, renderers) is bundled locally; no CDN, no telemetry, no analytics, no external font/image/fetch. Offline/online state comes from `navigator.onLine` and the `online`/`offline` events. The service worker serves cached assets only.

## Consequences

- Even a bug cannot exfiltrate a seed — there is no network path in the code.
- The wordlist ships with the bundle (~2.5 kB gzipped for the English BIP-39 list).
- The page works fully offline once cached by the service worker.
