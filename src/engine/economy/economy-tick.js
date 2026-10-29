// FAST-TRACK BATCH 4 proposal, CONNECTED as of FAST-TRACK BATCH 25 — Economy GDP Growth.
//
// `calculateGdpGrowthDelta()` itself is BYTE-FOR-BYTE UNCHANGED from Batch 4 — still a pure
// function, still requiring explicit `sectorWeights`/`growthRateScale`, still never guessing
// either. What changes in Batch 25: per the project owner's explicit authorization to replace
// unrecoverable/deferred formulas with new, coherent, documented game rules, this file now also
// exports DEFAULT values for both previously-undefaulted parameters
// (`DEFAULT_GDP_SECTOR_WEIGHTS`/`DEFAULT_GROWTH_RATE_SCALE`), and IS now imported by
// `src/engine/orchestration/monthly-pipeline.js` (`createEconomyAndSectorsStage()`) and both
// runtimes. This is a NEW_PRODUCT_DECISION, not a recovered coefficient — see
// docs/FAST-TRACK-BATCH-25-ECONOMY-MONTHLY-SIMULATION.md for the full rationale and the rest of
// the monthly economy model (treasury, inflation) this batch adds alongside it.
//
// ============================== Evidence this proposal is built from ==============================
// SOURCE_CONFIRMED (re-verified this phase, not re-derived or assumed):
//   - `state.economy.{gdpGrowth, inflation, treasury}` are real, UI-consumed number fields
//     (dashboard-view-model.js 59-118, monthly-report.js 78-103/378-386 — RECOVERY-15/16/17/32).
//   - `config.economy.gdp.sectorWeights[sectorId]` is a real, independently-confirmed per-sector
//     config SHAPE (sector-view-model.js's own header comment) — its VALUES were never recovered.
//   - `config/sector-health.json:20` (protected, checksummed, quoted here verbatim): "...reuses the
//     same neutral midpoint convention already used everywhere else in this codebase
//     (initialHealth=50, GDP neutralHealth=50, population statBaseline=50)..." — this is the ONE
//     piece of real evidence naming an actual GDP-related number: a sector at health 50 is the
//     real, confirmed NEUTRAL reference point (health above 50 -> positive contribution; below 50
//     -> negative), reused here as `GDP_NEUTRAL_HEALTH`, not invented.
//   - `config/sector-health.json:99-101` (protected): the KPI definitions for "gdp"/"gdp-growth"/
//     "gdp-per-capita" each explicitly carry `"weight": null, "weightStatus": "DEFERRED"` — the
//     protected evidence file ITSELF marks per-KPI weighting as deferred/unset, confirming (not
//     contradicting) that no real weight VALUE exists anywhere in this workspace's evidence.
//
// NOT evidenced anywhere (this file does NOT guess either of these — both are REQUIRED function
// parameters with no default; omitting either throws a clear error rather than silently
// defaulting or fabricating a plausible-looking number):
//   - `sectorWeights`: the actual per-sector GDP weight values (the shape is confirmed; the
//     numbers are not — and the protected evidence explicitly marks them DEFERRED, see above).
//   - `growthRateScale`: the unit-conversion coefficient from a weighted health-deviation-from-50
//     into an actual GDP growth RATE delta. Zero evidence of any kind names this number or even
//     confirms this is the right formula SHAPE at all — this is a RECONSTRUCTION_DECISION
//     (PROPOSAL), explicitly disclosed, not claimed as recovered or as already-approved.
//
// ============================== What this file still does NOT do ==============================
//   - It does not touch inflation or treasury — those are now separate, new, owner-authorized
//     formulas in src/engine/economy/treasury.js and src/engine/economy/inflation.js (Batch 25),
//     each consuming THIS function's own `gdpGrowthDelta` output as one of their own inputs,
//     never duplicating this calculation.
//   - It does not read or write `state` directly — pure function, explicit inputs/outputs only
//     (the calling stage in monthly-pipeline.js owns all state shape concerns).
//   - Policy's effect on GDP growth remains entirely TRANSITIVE through Sector Health (unchanged
//     design decision, Batch 4) — this function still never reads `state.policies` itself.
//
// ============================== Batch 25's new, owner-authorized defaults ==============================
//   - `DEFAULT_GDP_SECTOR_WEIGHTS`: uniform — every one of the 10 real sectors weighted equally
//     (`1 / SECTOR_IDS.length`, summing to exactly 1). No evidence distinguishes one sector's GDP
//     contribution from another's, so uniform weighting is the simplest, most defensible default
//     — never claimed as recovered. A caller may still override with its own `sectorWeights`.
//   - `DEFAULT_GROWTH_RATE_SCALE`: `0.05`. At the extremes (every sector at health 0 or 100, a
//     uniformly-weighted deviation of magnitude 50), this produces a growth-rate swing of
//     ±2.5 percentage points per month — a deliberately modest, stable range for a monthly tick,
//     chosen to keep the economy readable rather than volatile.
import { SECTOR_IDS } from '../../state/game-state.js';
import { isSectorStateInitialized } from '../sectors/sector-system.js';

/** FAST-TRACK BATCH 25 — owner-authorized default, see file header. */
export const DEFAULT_GDP_SECTOR_WEIGHTS = Object.freeze(
  Object.fromEntries(SECTOR_IDS.map((id) => [id, 1 / SECTOR_IDS.length])),
);

/** FAST-TRACK BATCH 25 — owner-authorized default, see file header. */
export const DEFAULT_GROWTH_RATE_SCALE = 0.05;

/** SOURCE_CONFIRMED (config/sector-health.json:20, quoted above) — the real, confirmed neutral
 * reference health point: a sector exactly at this health contributes zero to GDP growth under
 * this proposal. Never redefined elsewhere; exported so a future, approved connection point reads
 * the same single source of truth rather than a second copy of the number 50. */
export const GDP_NEUTRAL_HEALTH = 50;

/**
 * Validates a candidate `sectorWeights` object covers every real `SECTOR_IDS` key with a finite
 * number. Never defaults a missing or invalid weight — returns the exact problem(s) instead.
 * @param {object} sectorWeights
 * @returns {string[]} error strings; empty array = valid
 */
export function validateSectorWeights(sectorWeights) {
  const errors = [];
  if (!sectorWeights || typeof sectorWeights !== 'object' || Array.isArray(sectorWeights)) {
    errors.push(`sectorWeights must be a plain object, got ${JSON.stringify(sectorWeights)}`);
    return errors;
  }
  for (const id of SECTOR_IDS) {
    const value = sectorWeights[id];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`sectorWeights["${id}"] must be a finite number, got ${JSON.stringify(value)}`);
    }
  }
  return errors;
}

/**
 * PROPOSAL (RECONSTRUCTION_DECISION, NOT APPROVED) — the one, narrow, explicitly-disclosed new
 * formula shape this batch adds: GDP growth delta is the `growthRateScale`-scaled sum, across
 * every real sector, of `(health - GDP_NEUTRAL_HEALTH) * sectorWeights[sectorId]`. A sector
 * exactly at the confirmed neutral health (50) contributes nothing; above it contributes
 * positively; below it, negatively — scaled by that sector's own (not-yet-approved) weight.
 *
 * Both `sectorWeights` and `growthRateScale` are REQUIRED — this function never defaults, infers,
 * or fabricates either. Guards every computed value against NaN/Infinity before returning, and
 * NEVER connects this result to `state.economy` itself (that would require its own separate,
 * not-yet-made decision about how a delta becomes the next stored `gdpGrowth` value — e.g.
 * replace vs. accumulate — explicitly out of this proposal's scope).
 *
 * @param {object} sectors - a real `state.sectors`-shaped object (every real SECTOR_IDS key
 *   present, each with a finite `.health`)
 * @param {object} sectorWeights - REQUIRED; `{[sectorId]: number}` covering every real sector id
 *   — the real values are not evidenced anywhere in this workspace (see file header) and must be
 *   supplied by the caller; this function throws rather than guessing one
 * @param {number} growthRateScale - REQUIRED; a finite unit-conversion coefficient — zero
 *   evidence names this number; this function throws rather than guessing one
 * @returns {{gdpGrowthDelta: number}}
 */
export function calculateGdpGrowthDelta(sectors, sectorWeights, growthRateScale) {
  if (!isSectorStateInitialized(sectors)) {
    throw new Error('calculateGdpGrowthDelta: sectors must be a fully-initialized state.sectors object');
  }
  const weightErrors = validateSectorWeights(sectorWeights);
  if (weightErrors.length > 0) {
    throw new Error(`calculateGdpGrowthDelta: invalid sectorWeights:\n- ${weightErrors.join('\n- ')}`);
  }
  if (typeof growthRateScale !== 'number' || !Number.isFinite(growthRateScale)) {
    throw new Error(`calculateGdpGrowthDelta: growthRateScale must be a finite number, got ${JSON.stringify(growthRateScale)}`);
  }

  let weightedDeviation = 0;
  for (const id of SECTOR_IDS) {
    const deviation = sectors[id].health - GDP_NEUTRAL_HEALTH;
    weightedDeviation += deviation * sectorWeights[id];
  }

  const gdpGrowthDelta = weightedDeviation * growthRateScale;
  if (!Number.isFinite(gdpGrowthDelta)) {
    throw new Error(`calculateGdpGrowthDelta: computed delta is not finite (${gdpGrowthDelta}) — refusing to return NaN/Infinity rather than silently propagating a broken value`);
  }

  return { gdpGrowthDelta };
}

// ============================== CONNECTED as of FAST-TRACK BATCH 25 ==============================
// `calculateGdpGrowthDelta()`, `DEFAULT_GDP_SECTOR_WEIGHTS`, and `DEFAULT_GROWTH_RATE_SCALE` are
// now imported by `src/engine/orchestration/monthly-pipeline.js::createEconomyAndSectorsStage()`.
// `isCompleteMonthlySimulation` still correctly stays `false` — connecting this one formula does
// not make the other 8 unimplemented canonical stages exist.
