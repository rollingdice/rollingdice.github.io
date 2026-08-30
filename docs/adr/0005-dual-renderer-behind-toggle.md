# ADR-0005 — Dual renderer behind a toggle

**Status**: Accepted

## Context

The user wanted to compare a lightweight canvas-2D dice renderer against a Three.js 3D one before choosing. Shipping only one would force the choice early; shipping Three.js statically would bloat the default page.

## Decision

Implement **both** renderers behind a UI toggle. Canvas-2D is the default (lightweight, pips stay readable, fast on phones). Three.js is dynamically imported on demand so the default bundle stays light. Both render the same settled faces (ADR-0003) and produce the same seed.

## Consequences

- The user can compare the two looks and pick a default later without rework.
- Default page stays light; Three.js only loads when chosen.
- Two renderers to maintain, but the renderer interface is small (mount/destroy, set faces, animate settle) and the derivation path is shared and identical.
