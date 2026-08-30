# ADR-0003 — CSPRNG-anchored settle

**Status**: Accepted

## Context

The dice must tumble "realistically." A pure unseeded physics simulation would produce settled faces that are neither reproducible nor verifiable — the fake-diceware trap the canonical method page warns about. The user's taste preference requires honest, auditable entropy.

## Decision

The resting face values of the 100 dice are drawn from `crypto.getRandomValues` using uniform sampling with rejection (modulo-bias-free). The physics simulation only animates the tumbling; the settled faces are the CSPRNG-determined values. The seed is then derived from those visible faces (ADR-0001).

## Consequences

- The seed is verifiable: re-reading the settled grid reproduces it.
- The physics is visual theater around a real random settle, which is honest and documented in the UI.
- `crypto.getRandomValues` is available on all modern browsers including in secure contexts (PWA/HTTPS).
