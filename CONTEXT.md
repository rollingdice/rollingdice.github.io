# Context — rollingdice.github.io

Bitcoin self-custody consultancy site. This file is a glossary of domain terms the engineering skills use when working in this repo. It is a glossary, not a spec: implementation decisions live in `docs/adr/`.

## Terms

- **Dice grid**: the 10×10 array of virtual dice rendered on screen by the BIP39 dice demo.
- **Shake**: the user interaction (device motion or the fallback button) that triggers a shuffle of the dice.
- **Settle**: the process by which the dice stop and reveal their face values after a shake.
- **Dice pattern**: the settled 10×10 array of face values (1–6).
- **Roll string**: the linear sequence of digits read from the grid (left→right, top→bottom) — the input to the hashed construction.
- **Hashed construction**: `SHA256(digit string) → entropy → BIP-39 mnemonic`. Deterministic and verifiable; the method the demo implements.
- **Seed**: the BIP-39 mnemonic derived from the roll string.
- **Offline**: the app state required for real use of the demo as a seed generator; when online the app warns rather than blocks.
- **Verifiability**: the property that the seed is a pure function of the visible dice pattern, recomputable with any independent tool.
