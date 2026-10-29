# FREEWORLD

A browser-based nation-management strategy game. Manage a national economy, population,
government ministries, and recurring crises across a deterministic, month-by-month simulation.

## Playing the game

### Online

If this repository is published to GitHub Pages, open the published URL (e.g.
`https://<owner>.github.io/freeworld/`) — the game runs entirely in your browser, no account or
install needed.

### Locally

Requires only [Node.js](https://nodejs.org/) (any reasonably recent version) — there is no other
dependency and no build step.

```
node src/ui/browser/server.js
```

Then open `http://localhost:4173/` in your browser. Pass a different port as an argument
(`node src/ui/browser/server.js 5000`) if 4173 is unavailable, or set a `PORT` environment
variable (useful for hosting the server on a managed platform).

A text-based command-line interface is also available, for players comfortable with a terminal:

```
node src/ui/cli/play.js interactive
```

Type `help` inside that session for the full command list.

## How to play

- **Turns advance by the month.** Every action you take (placing a policy, appointing a
  minister, responding to a crisis, using a recovery tool) is only ever *queued* — nothing
  actually happens until you click "Advance Month." Advancing applies every queued action
  together, atomically: either they all succeed, or none of them do and nothing changes.
- **Policies** are placed into a limited number of slots and run every month until removed.
  Check the Resource Allocation panel to see exactly what a queued action will cost before you
  commit to it.
- **Crises** emerge from sustained grievance/escalation. When one is active, a dedicated response
  panel appears with real cost/effect trade-offs for each available response.
- **National Recovery tools** (Economic Stabilization, Sector Recovery Program) are general,
  always-available nation-management actions with a real Treasury cost, independent of whether a
  crisis is active.
- **Monthly Report and Player Feedback** summarize what changed and why after each advance, with
  links that jump you to the specific sector affected.
- **Historical Trends** charts any tracked metric across every month recorded so far in the
  current session.

Several formulas (Government Performance Index, Crisis Response severity, recovery-tool costs,
policy upkeep) are explicitly labeled `PROVISIONAL_IMPLEMENTATION` in the UI where they appear —
they are functioning, evidence-tuned numbers, not placeholders, but none is a final, certified
balance value. The game currently has no win/loss condition (no Game Over or Uprising mechanic)
— it is an open-ended management sandbox.

## Save and load — read this before you rely on it

**All progress is saved locally in your browser's `localStorage` — there is no server-side save,
no account, and no cloud sync of any kind.** Concretely, this means:

- Your save is tied to **one browser, on one device**. It will not appear if you open the game in
  a different browser, a different device, or a private/incognito window.
- Clearing your browser's site data for this page (or using "Clear all cookies and site data")
  deletes your save permanently — there is no recovery.
- **`localStorage` is scoped by origin (domain + port), not by path.** If this game is hosted at
  `https://<owner>.github.io/freeworld/`, its save data shares the same storage origin as
  `https://<owner>.github.io/` and any *other* project hosted under that same GitHub Pages
  account. This is a real, if unlikely, collision risk only if another project at the same
  account happens to use the identical storage key this game uses internally — not something an
  ordinary player needs to worry about, but worth knowing if you host multiple projects from the
  same GitHub Pages account.
- Only actions you have actually **committed** via "Advance Month" are saved. Anything still
  queued (placed but not yet advanced) is discarded if you reload the page without advancing —
  this is intentional, not a bug.
- There is currently no in-game control to cancel a single queued action short of reloading the
  whole page (which discards the entire queue, not just one action).

## Running the tests

```
node --test tests/*.test.js
```

This runs the full automated regression suite (engine logic, view models, save/load integrity,
and real headless-browser UI tests via Playwright, where available — browser tests skip cleanly
rather than fail if Playwright isn't installed on your machine).

A smaller, faster subset covering the core engine contracts:

```
node --test tests/canonical-state-integration.test.js tests/economy-state-contract.test.js \
  tests/economy-system.test.js tests/end-to-end-sector-policy.test.js \
  tests/events-grievance-crisis.test.js tests/game-runtime.test.js tests/government-system.test.js \
  tests/minister-effectiveness.test.js tests/monthly-pipeline.test.js tests/monthly-report.test.js \
  tests/monthly-report-highlights.test.js tests/policy-system.test.js tests/political-capital.test.js \
  tests/population-agent-validation.test.js tests/population-metrics.test.js \
  tests/population-system.test.js tests/sector-engine.test.js tests/state-adapter.test.js \
  tests/state-contract.test.js tests/state-foundation.test.js
```

Long-run, 120-month balance/stability checks across 5 standard play strategies:

```
node --test tests/long-run-scenario-validation.test.js
```

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how the codebase is organized and how to make a
safe change.

## License

[MIT](./LICENSE).
