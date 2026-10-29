# Contributing to FREEWORLD

## Project structure

```
config/              Game data: sector health definitions, policy definitions (plain JSON)
src/engine/           Pure game logic — economy, sectors, population, government, policies,
                       grievance/crisis, events, history, orchestration. No DOM, no I/O.
src/state/             GameState shape, validation, and the one state-shape adapter.
src/game/              The real Node.js game runtime (src/game/game-runtime.js) — used by the CLI.
src/ui/browser/        The browser entry point: server.js (static file server), index.html,
                       app.js (DOM rendering), browser-runtime.js (a browser-safe port of
                       game-runtime.js — see its own header for exactly why it's a separate file).
src/ui/cli/            The command-line entry point (play.js).
src/ui/view-models/    Pure functions that turn real engine state into display-ready data —
                       both the Browser and CLI render from the SAME view-model functions.
src/ui/drawers/        A small number of report-formatting helpers, also shared by both UIs.
tests/                 node:test files, one per module/feature area. tests/support/ holds shared
                       test infrastructure (e.g. the 120-month scenario runner).
```

## Core conventions — please preserve these

- **Deterministic simulation.** Random events use a fixed default seed; the same starting state
  and the same sequence of actions always produces the same outcome. Don't introduce real
  `Math.random()`/`Date.now()`-seeded randomness into engine logic.
- **Queue, then commit.** Every player action goes through `dispatchAction()`, which only
  performs a *static* check (e.g., "does this policy ID exist") and queues the action. Nothing is
  actually applied until `advanceMonth()` runs, which checks *dynamic* conditions (e.g.,
  affordability) and applies every queued action together, atomically — either the whole month
  commits, or none of it does, and the state rolls back to exactly what it was before. Don't add
  a code path that mutates committed state outside of `advanceMonth()`.
- **Browser and CLI share engine code, not UI code.** `src/ui/browser/browser-runtime.js` is a
  deliberate, near-verbatim port of `src/game/game-runtime.js`'s orchestration logic — it exists
  only because `game-runtime.js` has a static `node:fs` import that a browser can't resolve. If
  you change the orchestration logic in one, check whether the same change belongs in the other.
  Both the Browser and CLI render from the exact same `src/ui/view-models/*.js` functions — never
  duplicate a formula or a cost calculation directly inside `app.js` or `play.js`.
- **View models never fabricate data.** A value a view model can't compute from real state is
  reported as unavailable/null, never guessed or defaulted to make the UI look more complete than
  the engine actually is.
- **Label provisional formulas.** A few values (Government Performance Index, Crisis Response
  severity, National Recovery tool costs, policy upkeep) are marked
  `PROVISIONAL_IMPLEMENTATION` in code comments and in the UI itself. If you tune one of these,
  keep that label until the design is formally finalized, and justify the change in your PR
  description with real evidence (a reproducible scenario, not just intuition).

## Before submitting a change

1. Run the full test suite: `node --test tests/*.test.js`. Browser/Playwright-based tests skip
   cleanly if Playwright isn't installed — that's expected on a machine without it.
2. If you changed anything under `src/engine/`, `src/state/`, `src/game/`, or
   `src/ui/browser/browser-runtime.js`, add or update a test in `tests/` that reproduces the
   behavior you changed — don't rely on manual play-testing alone.
3. If you changed `src/ui/browser/app.js` or `src/ui/browser/index.html`, run the real
   browser-based tests (`node --test tests/browser-gui*.test.js`) — they drive the actual page in
   a real headless browser via Playwright.
4. If you changed a formula or a cost, run `node --test tests/long-run-scenario-validation.test.js`
   and check the 5 standard 120-month scenarios still complete without violating any documented
   bound (sector health, inflation range, population floor, escalation range).
5. Keep changes minimal and scoped — this codebase deliberately avoids speculative abstraction
   and unused flexibility. A bug fix doesn't need a refactor alongside it.

## Reporting a bug or suggesting a change

Open an issue describing: what you did, what you expected, what actually happened, and — if
possible — the exact steps to reproduce it (including whether you were using the Browser or CLI
interface).
