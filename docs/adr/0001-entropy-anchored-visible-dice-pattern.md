# ADR-0001 — Entropy anchored in the visible dice pattern (100-dice hashed variant)

**Status**: Accepted

## Context

The BIP39 dice demo needed a way to turn a 10×10 grid of virtual dice into a BIP-39 seed that the user can verify. The canonical "hashed" method (kdmukai-bot.github.io/seedsigner-ai-analysis/dice/standard.html) hashes a *linear roll string*: 50 rolls for 12 words, 99 for 24. The grid is a 2D display of 100 dice, not a linear count.

## Decision

Derive the seed from the **visible settled grid**: read all 100 faces left→right, top→bottom into a 100-digit roll string, then apply the hashed construction (`SHA256(roll string)` → truncate to 128/256 bits → BIP-39). This is a 100-dice variant of the canonical hashed method: same construction, different fixed roll count.

## Consequences

- The seed is a pure function of the visible dice pattern — recomputable with any independent BIP-39 tool.
- A 10×10 grid maps naturally onto the display; no die is left unused.
- Must document that this is a 100-dice variant, not the 50/99 roll count the canonical method uses.
- `crypto.getRandomValues` must be the entropy source for the settled faces (see ADR-0003); the grid is the auditable carrier, not a hidden RNG.
