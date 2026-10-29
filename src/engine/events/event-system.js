// RECONSTRUCTION-06 — Event definition structural validation (no generator, no probability).
//
// THIS FILE IS NEWLY AUTHORED RECONSTRUCTION. It does NOT implement an event generator, a
// selection/probability mechanism, magnitude/duration/timing/stacking rules, or any threshold —
// none of those has recovered evidence, and this file does not invent any of them. See
// docs/RECONSTRUCTION-06-EVENTS-GRIEVANCE-CRISIS.md for the full SOURCE_CONFIRMED /
// RECONSTRUCTION_DECISION / UNKNOWN_OR_DEFERRED evidence matrix this file is built from.
//
// SOURCE_CONFIRMED basis (re-verified this phase via a fresh transcript search this recovery
// effort had not previously performed for Events/Grievance/Crisis — see the report's own §2):
//   - `config/events.json` is a real file. A direct `cat config/events.json | python3 -c "..."`
//     capture of it shows exactly 3 real event definitions: `flood` (one sector effect,
//     agriculture, -5), `pandemic` (one sector effect, admin, -8), `cyberattack` (zero sector
//     effects). This capture filtered the output to only `id` and `effects` — it is NOT proof
//     that these are the ONLY fields a real event definition carries (compare
//     `config/policies.json`'s own definitions, which carry many more fields than `id`/`effects`
//     alone) — this file does not assume completeness.
//   - Every captured real effect follows exactly the same shape as a policy's own
//     `effects[]` entries: `{domain: 'sector', target: <sectorId>, metric: 'health',
//     operation: 'add', value: <number>}` — confirmed by direct structural comparison this phase.
//   - `config/event-selection.json` is also a real, separate file (confirmed to exist by a
//     `find config -iname '*event*'` capture) — its own content was never captured; this file
//     does not model it at all.
//   - `src/engine/pipeline/actions-phase.js` applies a player's event-CHOICE effects
//     (`choice.effects`) and `src/engine/pipeline/events-phase.js` applies a spontaneous event's
//     own effects (`definition.effects`) — both already established, RECOVERY-29 §2.2-2.3,
//     re-confirmed unchanged this phase.
//
// Explicitly NOT found anywhere in the available transcript, despite this task's own text naming
// them as facts to check (see the report's §3/§4 for the full account): Event Effect
// Magnitude/Duration/Timing/Stacking concepts, a "PD-18"/"PD-19"/"PD-20" product decision, or a
// Sector-Readiness-reduces-severity rule. None of these is implemented here.
import { SECTOR_IDS } from '../../state/game-state.js';

/**
 * Structural validation only, deliberately mirroring
 * `src/engine/policies/policy-system.js::validatePolicyDefinitions()`'s own convention exactly —
 * the one thing this phase can actually verify is that a `domain:'sector'` effect's `target` is a
 * real sector id and `value` is a finite number, because that shape is the one SOURCE_CONFIRMED
 * fact about real event definitions (see file header). This function does NOT validate or assume
 * any other field (no `name`, no probability, no magnitude/duration/timing, no stacking rule) —
 * none of them has any evidence to validate against.
 * @param {object[]} definitions - a candidate array of event definitions
 * @returns {string[]} error strings; empty array = valid
 */
export function validateEventDefinitions(definitions) {
  const errors = [];
  const knownSectorIds = new Set(SECTOR_IDS);
  const seenIds = new Set();

  for (const def of definitions ?? []) {
    if (!def || typeof def.id !== 'string' || def.id.length === 0) {
      errors.push(`event definition missing a valid non-empty string "id": ${JSON.stringify(def)}`);
      continue;
    }
    if (seenIds.has(def.id)) {
      errors.push(`duplicate event id in definitions: "${def.id}"`);
    }
    seenIds.add(def.id);

    if (!Array.isArray(def.effects)) {
      errors.push(`event "${def.id}": "effects" must be an array when present`);
      continue;
    }
    // Unlike a policy definition, a real event is confirmed to carry ZERO sector effects at
    // least once (`cyberattack`) — an empty effects array is therefore explicitly valid, not an
    // error, mirroring that one confirmed real example.
    for (const [i, effect] of def.effects.entries()) {
      if (effect.domain !== 'sector') continue; // only the one confirmed real effect domain is checked
      if (typeof effect.target !== 'string' || !knownSectorIds.has(effect.target)) {
        errors.push(`event "${def.id}": effects[${i}].target "${effect.target}" is not a known sector id`);
      }
      if (typeof effect.value !== 'number' || !Number.isFinite(effect.value)) {
        errors.push(`event "${def.id}": effects[${i}].value must be a finite number, got ${JSON.stringify(effect.value)}`);
      }
    }
  }
  return errors;
}

/** Throwing variant of `validateEventDefinitions()`. */
export function assertValidEventDefinitions(definitions) {
  const errors = validateEventDefinitions(definitions);
  if (errors.length > 0) {
    throw new Error(`invalid event definitions:\n- ${errors.join('\n- ')}`);
  }
}
