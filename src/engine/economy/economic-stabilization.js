// FAST-TRACK BATCH 41 — Economic Stabilization (NEW_PRODUCT_DECISION).
//
// THIS FILE IS NEWLY AUTHORED GAME DESIGN, not a recovered formula. No evidence of any kind
// names a real "stabilization" mechanic. Per this batch's own task text ("ตรวจระบบเดียมก่อนและ
// เลือกแนวทางที่เข้ากับโครงสร้างจรง" — check the existing system first and pick an approach that
// fits the real structure), this is a real, queued, ONE-TIME player action — applied through the
// EXISTING `dispatchAction()`/`advanceMonth()` action queue, at the SAME Boundary 1
// (action-application) every other player action (PLACE_POLICY/APPOINT/etc.) already uses. This
// is a deliberate, structural choice: unlike Crisis Consequences (Batch 39/40), which is a
// CONTINUOUS effect gated on a live state flag (`crisisActive`) and therefore lives in its own
// "Boundary 2.5," Economic Stabilization has no ongoing condition to re-check every month — it is
// exactly the kind of one-shot, player-initiated state change the action queue already exists
// for. This is this batch's own "แยกผลครั้งเดียวออกจากผลต่อเนื่อง" (separate one-time effects from
// continuous ones) requirement, satisfied by WHERE this lives, not by a new flag.
//
// `gdpGrowth` is never a valid target here, for the same documented reason Batch 28's Random
// Events never targets it either (see `src/engine/events/event-tick.js`'s own header): it is
// recomputed fresh every month by the real Economy stage from sector health alone, and any direct
// write here would be silently overwritten next month regardless. Only `treasury` (spent) and
// `inflation` (the real, bounded relief this action buys) are touched.
//
// Never writes `state.grievance` at all — structurally incapable of double-counting with
// `grievanceUpdates` or of cancelling Crisis directly (see this batch's own report for the
// required source-text re-verification, mirroring Batch 39/40's own proof for
// `crisis-consequences.js`).
import { isEconomyStateInitialized } from './economy-system.js';
import { DEFAULT_INFLATION_CONFIG } from './inflation.js';

// FAST-TRACK BATCH 44 — PROVISIONAL_IMPLEMENTATION revision of `inflationReduction` (1.0 -> 3.0),
// replacing the Batch 41 original. `treasuryCost` is UNCHANGED.
//
// ============================== Why this changed (VERIFIED, not speculative) ==============================
// Organic inflation (`calculateMonthlyInflation()`, inflation.js: `inflation += gdpGrowth *
// sensitivity(0.3)`, no mean-reversion) accumulates WITHOUT BOUND whenever GDP growth stays one
// sign — Batch 43's Policy-focused scenario (never uses this tool at all) saw inflation climb
// organically from 2.0 to 15.3 over 120 months purely from sustained positive GDP growth
// (≈0.1/month at `gdpGrowth≈0.36`, `*0.3 sensitivity`). The Recovery-focused scenario used this
// tool 22 times over the same 120 months (its own real affordability ceiling) — total nominal
// relief `22 * 1.0 = 22.0` — yet inflation still climbed from 2.0 to a peak of 12.6, meaning the
// organic rise it was fighting was itself over 32 points; the OLD `1.0`/use reduction barely dented
// a sustained drift, confirming (not merely suspecting) it was too weak relative to the real
// organic trend this batch's own 120-month evidence shows (§5 of the task).
//
// ============================== The new assumption (PROVISIONAL_IMPLEMENTATION) ==============================
// `inflationReduction: 3.0` — three times the prior value, still a FLAT, bounded, clamped-at-use
// reduction (never a rate or a percentage), chosen so that even occasional, affordability-gated use
// (an average of once every ~5 months under the real Recovery-focused scenario's own observed
// cadence) can out-pace a sustained organic drift of this magnitude rather than merely slowing it.
// This does not make the tool "solve" inflation outright — it is still a single flat value with no
// memory of how fast inflation is currently rising, and it is still gated by the SAME real
// Treasury-affordability check and exactly-once-per-queued-use charging as before (unchanged —
// see `applyEconomicStabilization()`, below). Inflation is still always clamped to the real,
// documented `inflationConfig.bounds`, as it already was.
// FAST-TRACK BATCH 45 — PROVISIONAL_IMPLEMENTATION addition: `neutralInflation` and the
// "never-reduce-past-neutral" effective-reduction rule (see `applyEconomicStabilization()`,
// below). `treasuryCost`/`inflationReduction` themselves are UNCHANGED from Batch 44.
//
// ============================== Why this changed (VERIFIED, not speculative) ==============================
// Batch 45's own Step 1 month-by-month trace of the real Recovery-focused scenario (its own
// greedy strategy queues this tool whenever affordable, and Treasury starts flush) found
// `ECONOMIC_STABILIZATION` fired in 3 CONSECUTIVE opening months (turns 1, 2, 3) — each a full,
// flat `-3.0` — driving inflation from the real starting `2.0` down to `-4.97` by turn 3 alone
// (the real, documented floor is `-5`), well before any sustained organic drift ever had a chance
// to justify that much correction. The tool was never checking whether inflation was ALREADY low
// before applying its full, flat effect again — a real, reachable "deflation exploit": repeated,
// cheap, early use can drive inflation to its floor almost immediately, regardless of whether
// inflation needed correcting at all.
//
// ============================== The new assumption (PROVISIONAL_IMPLEMENTATION) ==============================
// `neutralInflation: 0` — a documented, configurable reference point ("no inflation," the
// classic macroeconomic neutral, independent of whatever a particular game's starting inflation
// happens to be — Batch 25's own `2.0` default was only ever "a round, legible starting number,"
// never claimed as a meaningful target). The EFFECTIVE reduction a single use applies is now
// `clamp(currentInflation - neutralInflation, 0, inflationReduction)` — i.e. the tool can bring
// inflation DOWN TO, but never PAST, the neutral reference in one use, and has ZERO effect at all
// once inflation is already at or below it. This preserves full strength (the complete `3.0`,
// identical to Batch 44) whenever inflation is meaningfully elevated (the tool's real, intended
// use case — e.g. Policy-focused's own organic peak of 15.3 is utterly unaffected by this change,
// since `15.3 - 0 = 15.3 > 3.0`, so the clamp never engages) while making repeated use against
// already-low inflation self-limiting rather than exploitable. `treasuryCost` and the exact
// affordability check/exactly-once charging are UNCHANGED. The real, documented
// `inflationConfig.bounds` clamp still applies on top, unchanged, as a final safety net.
export const DEFAULT_ECONOMIC_STABILIZATION_CONFIG = Object.freeze({
  treasuryCost: 200,
  inflationReduction: 3.0,
  neutralInflation: 0,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {object} config
 * @returns {string[]} error strings; empty = structurally valid
 */
export function validateEconomicStabilizationConfigShape(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    errors.push(`economicStabilizationConfig must be an object, got ${JSON.stringify(config)}`);
    return errors;
  }
  for (const field of ['treasuryCost', 'inflationReduction']) {
    if (typeof config[field] !== 'number' || !Number.isFinite(config[field]) || config[field] < 0) {
      errors.push(`economicStabilizationConfig.${field} must be a non-negative finite number`);
    }
  }
  if (typeof config.neutralInflation !== 'number' || !Number.isFinite(config.neutralInflation)) {
    errors.push('economicStabilizationConfig.neutralInflation must be a finite number');
  }
  return errors;
}

/** Throwing variant of {@link validateEconomicStabilizationConfigShape}. */
export function assertValidEconomicStabilizationConfigShape(config) {
  const errors = validateEconomicStabilizationConfigShape(config);
  if (errors.length > 0) {
    throw new Error(`invalid economicStabilizationConfig:\n- ${errors.join('\n- ')}`);
  }
}

/**
 * The real, one-time, bounded effect. Pure; never mutates `state`. Throws (never silently
 * no-ops) when Economy is not tracked this game, or when the real, current treasury cannot
 * cover the real, configured cost — "ป้องกันการใช้ทรัพยากรเกากฎามนวนที่มีอยู่จรง" (never spend more than is
 * actually available), checked against the CURRENT, dynamic `state.economy.treasury`, exactly
 * like every other dynamic, apply-time-only check this codebase already uses (e.g.
 * `placePolicy()`'s "no empty slot" throw).
 * @param {object} state - the candidate state, as of Boundary 1 (action-application)
 * @param {object} [config] - defaults to `DEFAULT_ECONOMIC_STABILIZATION_CONFIG`
 * @param {object} [inflationConfig] - defaults to `DEFAULT_INFLATION_CONFIG`, for the real,
 *   documented inflation clamp bounds (the same bounds Crisis Consequences already reuses)
 * @returns {object} the new state
 */
export function applyEconomicStabilization(state, config = DEFAULT_ECONOMIC_STABILIZATION_CONFIG, inflationConfig = DEFAULT_INFLATION_CONFIG) {
  if (!state || typeof state !== 'object') {
    throw new Error('applyEconomicStabilization: state must be an object');
  }
  assertValidEconomicStabilizationConfigShape(config);
  if (!isEconomyStateInitialized(state.economy)) {
    throw new Error('applyEconomicStabilization: this game has no state.economy to stabilize');
  }
  if (state.economy.treasury < config.treasuryCost) {
    throw new Error(`applyEconomicStabilization: insufficient treasury — have ${state.economy.treasury}, need ${config.treasuryCost}`);
  }

  const treasury = state.economy.treasury - config.treasuryCost;
  // FAST-TRACK BATCH 45 — never reduce PAST the documented neutral reference in one use (see this
  // file's own header). Full strength while inflation is meaningfully elevated; self-limiting as
  // it approaches/reaches neutral, never a flat, unconditional over-correction toward the floor.
  const effectiveReduction = clamp(state.economy.inflation - config.neutralInflation, 0, config.inflationReduction);
  const inflation = clamp(state.economy.inflation - effectiveReduction, inflationConfig.bounds.min, inflationConfig.bounds.max);
  return { ...state, economy: { ...state.economy, treasury, inflation } };
}
