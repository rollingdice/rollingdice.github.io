# ADR-0002 — Online warns, does not block; PWA for offline reboot

**Status**: Accepted

## Context

The demo is intended to be usable as a real seed generator only when run offline. The strictest reading would refuse to generate when the page detects a connection. The user wants the demo to survive a reboot and rerun offline, and to warn rather than block when online.

## Decision

The app ships as a **PWA** (web manifest + service worker) so it can be installed and rerun offline after a reboot. When the app detects it is online (`navigator.onLine` + `online`/`offline` events), it shows a prominent warning that real seeds should only be generated offline — but it does **not** block generation.

## Consequences

- The demo remains usable in every context (online demo, offline reboot, installed PWA).
- Honesty relies on the warning plus ADR-0004 (zero network calls): even online, the app has nothing to send.
- A future "hard block" mode is possible by flipping a flag, but is not the default.
