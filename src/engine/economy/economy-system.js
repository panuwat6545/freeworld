// RECONSTRUCTION-04 — Economy System foundation (structural only — no formula).
//
// THIS FILE IS NEWLY AUTHORED RECONSTRUCTION. It is NOT a recovered file, and it does NOT
// implement GDP growth, Treasury, Inflation, monthly income, tax revenue, or Economic Pressure —
// no formula of any kind exists here. See docs/RECONSTRUCTION-04-ECONOMY.md for the full
// SOURCE_CONFIRMED / RECONSTRUCTION_DECISION / UNKNOWN_OR_DEFERRED evidence matrix this file is
// built from.
//
// The REAL, confirmed module paths for the (unrecovered) Economy formulas themselves are
// `src/engine/economy/gdp.js` (`calculateGdpGrowth`) and `src/engine/economy/treasury.js`
// (`calculateNextTreasury`, `calculatePeriodBudgetBalance`) — RECOVERY-15/16/17, re-confirmed this
// phase, zero body lines ever captured for either. This file is deliberately NOT named `gdp.js` or
// `treasury.js`: naming a formula-free structural helper after the real, still-unrecovered formula
// files would misrepresent what this file actually does. `economy-system.js` mirrors this
// workspace's own existing convention for a domain's general state-presence/shape foundation file
// (`src/engine/sectors/sector-system.js`, `src/engine/government/government-system.js`).
//
// SOURCE_CONFIRMED facts this file is built from (RECOVERY-15/16/17/32, re-verified this phase):
//   - `state.economy.{gdpGrowth, inflation, treasury}` are real, UI-consumed number fields, each
//     read only after a guard named `isEconomyStateInitialized(state.economy)` in two independent
//     real call sites (`dashboard-view-model.js`, `monthly-report.js`) — the guard's own NAME is
//     confirmed; its body was never captured.
//   - `config.economy` is a real, independent sibling config object, never nested under
//     `config.sectors` (`game-runtime.js`: `config.economy = loadEconomyConfig()`, alongside a
//     separate `config.sectors = loadSectorConfig()` line).
//   - `config.economy.gdp.sectorWeights[sectorId]` is a real, already-stored per-sector config
//     value (confirmed by `sector-view-model.js`'s own header comment, a byte-for-byte protected
//     file) — its VALUES were never captured, only that the keyed-by-sector-id shape exists.
//
// FAST-TRACK BATCH 25: `validateEconomyConfigShape()` below now ALSO validates
// `gdp.growthRateScale` (a sibling to the already-evidenced `gdp.sectorWeights`) and, when
// present, `treasury`/`inflation` (delegating entirely to their own dedicated validators in
// `src/engine/economy/treasury.js`/`inflation.js` — never a duplicated check). Every one of
// these remains OPTIONAL at this shape tier, exactly like `gdp.sectorWeights` already was — an
// absent `config.economy` (or a `config.economy` missing any of these new sub-keys) is still a
// completely valid, legitimate shape; the calling runtime supplies owner-authorized DEFAULTS for
// whatever is omitted (see `src/game/game-runtime.js`/`src/ui/browser/browser-runtime.js`'s own
// `defaultEconomyConfig()`). This file itself still adds no formula and no default value.
import { SECTOR_IDS } from '../../state/game-state.js';
import { validateTreasuryConfig } from './treasury.js';
import { validateInflationConfig } from './inflation.js';

/**
 * RECONSTRUCTION_DECISION: the real `isEconomyStateInitialized()` is confirmed to exist by NAME
 * and by its USE as a guard before reading `gdpGrowth`/`inflation`/`treasury` as numbers — its own
 * body was never captured. This implementation is the most literal reading of that usage pattern:
 * "initialized" means all 3 known fields are present and are finite numbers (i.e. the Economy
 * simulation has actually produced usable values, as opposed to `state.economy` being absent or
 * partially populated). This is NOT a recovered body — a different, equally plausible reading
 * (e.g. "any one field present") would also be consistent with the sparse evidence; this report
 * documents the choice made and why (docs/RECONSTRUCTION-04-ECONOMY.md).
 * @param {object} economy - a candidate `state.economy` value
 * @returns {boolean}
 */
export function isEconomyStateInitialized(economy) {
  if (!economy || typeof economy !== 'object' || Array.isArray(economy)) {
    return false;
  }
  return ['gdpGrowth', 'inflation', 'treasury'].every(
    (field) => typeof economy[field] === 'number' && Number.isFinite(economy[field]),
  );
}

/**
 * Structural validation only, matching `src/state/economy-validation.js::validateEconomyShape()`'s
 * own convention (shape/type only, never a formula or a default). Validates `config.economy.gdp.
 * sectorWeights`, the ONE confirmed real sub-shape of `config.economy` — every other possible
 * field of `config.economy` (budget rules, inflation parameters, tax rates — none of which has any
 * evidence at all) is intentionally left unvalidated, since inventing a shape for an unevidenced
 * field would itself be a fabrication. Never mutates `economyConfig`, never adds a default.
 * @param {object} economyConfig - a candidate `config.economy` value
 * @returns {string[]} error strings; empty array = structurally valid (or absent)
 */
export function validateEconomyConfigShape(economyConfig) {
  const errors = [];

  if (economyConfig === null || economyConfig === undefined) {
    return errors;
  }
  if (typeof economyConfig !== 'object' || Array.isArray(economyConfig)) {
    errors.push(`config.economy must be a plain object when present, got ${JSON.stringify(economyConfig)}`);
    return errors;
  }

  if ('gdp' in economyConfig) {
    const gdp = economyConfig.gdp;
    if (!gdp || typeof gdp !== 'object' || Array.isArray(gdp)) {
      errors.push(`config.economy.gdp must be a plain object when present, got ${JSON.stringify(gdp)}`);
    } else {
      if ('sectorWeights' in gdp) {
        const weights = gdp.sectorWeights;
        if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
          errors.push(`config.economy.gdp.sectorWeights must be a plain object when present, got ${JSON.stringify(weights)}`);
        } else {
          const knownSectorIds = new Set(SECTOR_IDS);
          for (const [sectorId, weight] of Object.entries(weights)) {
            if (!knownSectorIds.has(sectorId)) {
              errors.push(`config.economy.gdp.sectorWeights["${sectorId}"] is not a known sector id`);
              continue;
            }
            if (typeof weight !== 'number' || !Number.isFinite(weight)) {
              errors.push(`config.economy.gdp.sectorWeights["${sectorId}"] must be a finite number, got ${JSON.stringify(weight)}`);
            }
          }
        }
      }
      // FAST-TRACK BATCH 25: optional, sibling to sectorWeights.
      if ('growthRateScale' in gdp) {
        if (typeof gdp.growthRateScale !== 'number' || !Number.isFinite(gdp.growthRateScale)) {
          errors.push(`config.economy.gdp.growthRateScale must be a finite number when present, got ${JSON.stringify(gdp.growthRateScale)}`);
        }
      }
    }
  }

  // FAST-TRACK BATCH 25: optional; delegates entirely to each formula module's own validator.
  if ('treasury' in economyConfig) {
    errors.push(...validateTreasuryConfig(economyConfig.treasury).map((e) => `config.economy.treasury: ${e}`));
  }
  if ('inflation' in economyConfig) {
    errors.push(...validateInflationConfig(economyConfig.inflation).map((e) => `config.economy.inflation: ${e}`));
  }

  return errors;
}

/** Throwing variant of `validateEconomyConfigShape()`. */
export function assertValidEconomyConfigShape(economyConfig) {
  const errors = validateEconomyConfigShape(economyConfig);
  if (errors.length > 0) {
    throw new Error(`invalid config.economy shape:\n- ${errors.join('\n- ')}`);
  }
}
