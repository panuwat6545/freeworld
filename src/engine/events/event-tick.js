// FAST-TRACK BATCH 28 — Random Events Monthly Simulation (NEW_PRODUCT_DECISION, owner-authorized).
//
// THIS FILE IS NEWLY AUTHORED GAME DESIGN, not a recovered formula. Per the project owner's
// explicit "Strategic Direction" authorization ("replace missing or unusable rules with coherent,
// documented game mechanics... do not spend repeated batches attempting to recover formulas that
// are not available"), this file implements a real, deterministic, config-driven monthly Event
// selection and effect-application mechanism, reusing the existing, unmodified
// `src/engine/events/event-system.js::validateEventDefinitions()` for the one SOURCE_CONFIRMED
// shape fact (sector-domain effects) rather than duplicating it — this file only ADDS validation
// for the extended, NEW_PRODUCT_DECISION effect domains (`economy`/`population`/`grievance`) that
// validator explicitly, deliberately does not check (see its own test 1g).
//
// Deliberately kept in its OWN file, never inside `event-system.js` itself — that file's own
// acceptance test (tests/events-grievance-crisis.test.js 4a) asserts it exports no generator/
// probability/magnitude/duration/timing/stacking function of any kind, a deliberate guard against
// exactly this kind of addition landing in the wrong file. This file is the generator.
//
// ============================== The model, in plain language ==============================
// Each month, the `randomEvents` stage (monthly-pipeline.js) does two deterministic draws from a
// seeded PRNG whose entire state is one 32-bit unsigned integer, round-tripping through save/load
// as an ordinary JSON number (`state.events.rngState`):
//   1. "Does any event occur this month at all?" — compared against `selection.probabilityPerMonth`.
//   2. "Which one?" — a weighted draw among the definitions ELIGIBLE this month (see below).
// Both draws use the SAME deterministic `nextRandomState()` step — never `Math.random()`,
// `Date.now()`, or any other non-reproducible source — so identical starting states and seeds
// always produce identical event sequences, and a save/reload resumes the exact same sequence
// rather than restarting or skipping it.
//
// ELIGIBILITY: an event is eligible this month only when every domain its effects target is
// genuinely initialized right now — `sector` is always eligible (sectors are a required field on
// every canonical state); `economy`/`population`/`grievance` require `isEconomyStateInitialized()`/
// `isPopulationStateInitialized()`/a present, structurally valid `state.grievance` respectively.
// This is the direct implementation of this batch's own instruction to cover "economy, population,
// and public grievance WHERE THEIR STATE CONTRACTS SUPPORT THOSE EFFECTS" — an event whose domain
// is not ready this month is simply never selected, never applied against missing data, and never
// an error. An event with zero effects (the real, recovered `cyberattack`) is always eligible.
//
// EFFECTS: `{domain: 'sector'|'economy'|'population'|'grievance', target: string, value: number}`.
// `sector` effects are applied with the same `clampHealth()`/`getSectorHealthStatus()` (src/engine/
// sectors/health.js, protected, unmodified) every other sector-health change already uses — no
// second clamping rule. `economy` effects add directly to the one real, already-initialized
// `state.economy` field named (`treasury` only, in this batch's own default definitions) — this is
// a DIRECT economy effect, same category as Treasury's own `policyUpkeepCost` term (Batch 25), not
// a second GDP-growth formula (`gdpGrowth` itself is never a valid event target — it is recomputed
// fresh every month by the economy stage and would be silently overwritten next month regardless).
// `population` effects add the same delta to EVERY agent's `economicPressure`, clamped to [0,100]
// — a population-wide shock/relief, not a per-agent one (no evidence or need to vary it per agent).
// `grievance` effects add to `escalationStage` only — never deriving `crisisActive`/
// `gameOverThreshold` (those still depend on the permanently unrecovered `isCrisisActive()`/
// `isGameOverThreshold()` formulas, untouched by this batch).
import { validateEventDefinitions } from './event-system.js';
import { validateGrievanceShape } from '../../state/grievance-validation.js';
import { clampHealth, getSectorHealthStatus } from '../sectors/health.js';
import { isEconomyStateInitialized } from '../economy/economy-system.js';
import { isPopulationStateInitialized } from '../population/population-system.js';

const ECONOMY_EFFECT_TARGETS = new Set(['treasury']);
const GRIEVANCE_EFFECT_TARGETS = new Set(['escalationStage']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * The 3 real, directly-captured event definitions (RECOVERY-06, unchanged values/ids) plus 5 new,
 * clearly-disclosed NEW_PRODUCT_DECISION definitions extending coverage to economy/population/
 * grievance, per this batch's own instruction. `label` is this batch's own new, Thai display
 * name for every entry (none existed before this batch, for any of them) — mirroring exactly the
 * same "ภาค\"-style convention already established for Sector display names (FAST-TRACK BATCH 26).
 */
export const DEFAULT_EVENT_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'flood', label: 'นําท่วม', effects: Object.freeze([Object.freeze({ domain: 'sector', target: 'agriculture', metric: 'health', operation: 'add', value: -5 })]) }),
  Object.freeze({ id: 'pandemic', label: 'โรคระบาด', effects: Object.freeze([Object.freeze({ domain: 'sector', target: 'admin', metric: 'health', operation: 'add', value: -8 })]) }),
  Object.freeze({ id: 'cyberattack', label: 'การโจมตีทางไซเบอร์', effects: Object.freeze([]) }),
  Object.freeze({ id: 'trade-boom', label: 'ภาวะการค้าเฟื่องฟู', effects: Object.freeze([Object.freeze({ domain: 'economy', target: 'treasury', operation: 'add', value: 100 })]) }),
  Object.freeze({ id: 'market-crash', label: 'ตลาดล้ม', effects: Object.freeze([Object.freeze({ domain: 'economy', target: 'treasury', operation: 'add', value: -80 })]) }),
  Object.freeze({ id: 'harvest-festival', label: 'เทศกาลเกี้บเกี่ยว', effects: Object.freeze([Object.freeze({ domain: 'population', target: 'economicPressure', operation: 'add', value: -8 })]) }),
  Object.freeze({ id: 'resource-shortage', label: 'ภาวะขาดแคลนทรัพยากร', effects: Object.freeze([Object.freeze({ domain: 'population', target: 'economicPressure', operation: 'add', value: 10 })]) }),
  Object.freeze({ id: 'public-unrest', label: 'ความไม่สงบของประชาชน', effects: Object.freeze([Object.freeze({ domain: 'grievance', target: 'escalationStage', operation: 'add', value: 1 })]) }),
]);

/** Owner-authorized default: a modest, legible 25%-per-month chance of any event at all, equal weight per definition unless overridden. */
export const DEFAULT_EVENT_SELECTION_CONFIG = Object.freeze({
  probabilityPerMonth: 0.25,
  weights: Object.freeze(Object.fromEntries(DEFAULT_EVENT_DEFINITIONS.map((d) => [d.id, 1]))),
});

/** Owner-authorized default starting RNG seed — an arbitrary, documented, nonzero 32-bit value (xorshift32 requires nonzero state). Not evidence-based. */
export const DEFAULT_EVENTS_SEED = 123456789;

// =============================== Deterministic RNG ===============================

/**
 * One xorshift32 step — the entire PRNG state is this single 32-bit unsigned integer, trivially
 * JSON-serializable (an ordinary number) and therefore trivially saved/restored as part of
 * ordinary canonical state. Pure — never mutates anything, never reads any external/non-
 * reproducible source (`Math.random()`, `Date.now()`, wall-clock, etc.).
 * @param {number} state - current rngState (must be a nonzero, finite integer)
 * @returns {{value: number, nextState: number}} `value` in `[0, 1)`; `nextState` the new rngState
 */
export function nextRandomState(state) {
  if (!Number.isFinite(state) || state === 0) {
    throw new Error(`nextRandomState: state must be a finite, nonzero number, got ${JSON.stringify(state)}`);
  }
  let x = state >>> 0;
  if (x === 0) x = 1; // xorshift32 is stuck at 0 forever if it ever reaches 0 — guard defensively
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return { value: x / 4294967296, nextState: x };
}

// =============================== Event definition + config validation ===============================

/**
 * NEW_PRODUCT_DECISION validation, additive to (never replacing) the existing, unmodified
 * `validateEventDefinitions()` — checks only the 3 NEW effect domains that validator explicitly
 * does not cover (its own test 1g: "a non-'sector' domain effect is not checked... only the one
 * confirmed real domain is validated"). Never mutates `definitions`.
 * @param {object[]} definitions
 * @returns {string[]} error strings; empty array = valid
 */
export function validateEventEffectTargets(definitions) {
  const errors = [];
  for (const def of definitions ?? []) {
    if (!def || !Array.isArray(def.effects)) continue;
    for (const [i, effect] of def.effects.entries()) {
      if (effect.domain === 'economy' && !ECONOMY_EFFECT_TARGETS.has(effect.target)) {
        errors.push(`event "${def.id}": effects[${i}].target "${effect.target}" is not a supported economy effect target (expected one of: ${[...ECONOMY_EFFECT_TARGETS].join(', ')})`);
      }
      if (effect.domain === 'population' && effect.target !== 'economicPressure') {
        errors.push(`event "${def.id}": effects[${i}].target "${effect.target}" is not a supported population effect target (expected "economicPressure")`);
      }
      if (effect.domain === 'grievance' && !GRIEVANCE_EFFECT_TARGETS.has(effect.target)) {
        errors.push(`event "${def.id}": effects[${i}].target "${effect.target}" is not a supported grievance effect target (expected one of: ${[...GRIEVANCE_EFFECT_TARGETS].join(', ')})`);
      }
      if (['economy', 'population', 'grievance'].includes(effect.domain) && (typeof effect.value !== 'number' || !Number.isFinite(effect.value))) {
        errors.push(`event "${def.id}": effects[${i}].value must be a finite number, got ${JSON.stringify(effect.value)}`);
      }
    }
  }
  return errors;
}

/** Combines the existing sector-domain validator with this batch's own extended-domain validator — the one, complete check for a real `config.events.definitions` array. Never mutates. */
export function validateFullEventDefinitions(definitions) {
  return [...validateEventDefinitions(definitions), ...validateEventEffectTargets(definitions)];
}

/**
 * Structural validation of `config.events.selection`. Never mutates, never defaults.
 * @param {*} selectionConfig
 * @returns {string[]} error strings; empty array = valid
 */
export function validateEventSelectionConfig(selectionConfig) {
  const errors = [];
  if (!selectionConfig || typeof selectionConfig !== 'object' || Array.isArray(selectionConfig)) {
    errors.push(`eventSelectionConfig must be a plain object, got ${JSON.stringify(selectionConfig)}`);
    return errors;
  }
  const p = selectionConfig.probabilityPerMonth;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
    errors.push(`eventSelectionConfig.probabilityPerMonth must be a finite number in [0, 1], got ${JSON.stringify(p)}`);
  }
  const weights = selectionConfig.weights;
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    errors.push(`eventSelectionConfig.weights must be a plain object, got ${JSON.stringify(weights)}`);
  } else {
    for (const [id, weight] of Object.entries(weights)) {
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
        errors.push(`eventSelectionConfig.weights["${id}"] must be a non-negative finite number, got ${JSON.stringify(weight)}`);
      }
    }
  }
  return errors;
}

/**
 * Structural validation of the full `config.events` shape (`{definitions, selection}`), mirroring
 * `economy-system.js::validateEconomyConfigShape()`'s own delegation convention — combines
 * `validateFullEventDefinitions()` and `validateEventSelectionConfig()`, no new check of its own.
 * `undefined`/`null` is valid (absent). Never mutates.
 * @param {*} eventsConfig - a candidate `config.events` value
 * @returns {string[]} error strings; empty array = structurally valid (or absent)
 */
export function validateEventsConfigShape(eventsConfig) {
  if (eventsConfig === null || eventsConfig === undefined) return [];
  const errors = [];
  if (typeof eventsConfig !== 'object' || Array.isArray(eventsConfig)) {
    errors.push(`config.events must be a plain object when present, got ${JSON.stringify(eventsConfig)}`);
    return errors;
  }
  if ('definitions' in eventsConfig) {
    if (!Array.isArray(eventsConfig.definitions)) {
      errors.push(`config.events.definitions must be an array when present, got ${JSON.stringify(eventsConfig.definitions)}`);
    } else {
      errors.push(...validateFullEventDefinitions(eventsConfig.definitions));
    }
  }
  if ('selection' in eventsConfig) {
    errors.push(...validateEventSelectionConfig(eventsConfig.selection).map((e) => `config.events.selection: ${e}`));
  }
  return errors;
}

/** Throwing variant of `validateEventsConfigShape()`. */
export function assertValidEventsConfigShape(eventsConfig) {
  const errors = validateEventsConfigShape(eventsConfig);
  if (errors.length > 0) {
    throw new Error(`invalid config.events shape:\n- ${errors.join('\n- ')}`);
  }
}

/**
 * Structural validation of `state.events` (`{rngState: number, history: {turn, eventId}[]}`) —
 * this batch's own new, genuinely new state shape (nothing to be consistent with beforehand).
 * `undefined`/`null` is valid (absent — a legitimate, honest "events not tracked for this game").
 * Never mutates, never defaults.
 * @param {*} events
 * @returns {string[]} error strings; empty array = valid (or absent)
 */
export function validateEventsStateShape(events) {
  if (events === undefined || events === null) return [];
  const errors = [];
  if (typeof events !== 'object' || Array.isArray(events)) {
    errors.push(`state.events must be a plain object when present, got ${JSON.stringify(events)}`);
    return errors;
  }
  if (typeof events.rngState !== 'number' || !Number.isFinite(events.rngState)) {
    errors.push(`state.events.rngState must be a finite number, got ${JSON.stringify(events.rngState)}`);
  }
  if (!Array.isArray(events.history)) {
    errors.push(`state.events.history must be an array, got ${JSON.stringify(events.history)}`);
  } else {
    events.history.forEach((entry, i) => {
      if (!entry || typeof entry !== 'object') {
        errors.push(`state.events.history[${i}] must be an object, got ${JSON.stringify(entry)}`);
        return;
      }
      if (!Number.isInteger(entry.turn) || entry.turn < 0) {
        errors.push(`state.events.history[${i}].turn must be a non-negative integer, got ${JSON.stringify(entry.turn)}`);
      }
      if (entry.eventId !== null && typeof entry.eventId !== 'string') {
        errors.push(`state.events.history[${i}].eventId must be null or a string, got ${JSON.stringify(entry.eventId)}`);
      }
    });
  }
  return errors;
}

/** Throwing variant of `validateEventsStateShape()`. */
export function assertValidEventsStateShape(events) {
  const errors = validateEventsStateShape(events);
  if (errors.length > 0) {
    throw new Error(`invalid state.events shape:\n- ${errors.join('\n- ')}`);
  }
}

// =============================== Eligibility + selection ===============================

/**
 * @param {object} definition - one event definition
 * @param {{economyInitialized: boolean, populationInitialized: boolean, grievanceInitialized: boolean}} context
 * @returns {boolean}
 */
/**
 * Builds the real eligibility context for this month from the current candidate `state` —
 * encapsulated here (not in the calling pipeline stage) so `monthly-pipeline.js` itself never
 * needs to import `grievance-validation.js` directly (see this file's own test-compatibility
 * note in the header). Never mutates `state`.
 * @param {object} state
 * @returns {{economyInitialized: boolean, populationInitialized: boolean, grievanceInitialized: boolean}}
 */
export function buildEligibilityContext(state) {
  return {
    economyInitialized: isEconomyStateInitialized(state.economy),
    populationInitialized: isPopulationStateInitialized(state.population),
    grievanceInitialized: !!state.grievance && validateGrievanceShape(state.grievance).length === 0,
  };
}

export function isEventEligible(definition, context) {
  if (!Array.isArray(definition.effects) || definition.effects.length === 0) return true;
  return definition.effects.every((effect) => {
    if (effect.domain === 'sector') return true;
    if (effect.domain === 'economy') return context.economyInitialized;
    if (effect.domain === 'population') return context.populationInitialized;
    if (effect.domain === 'grievance') return context.grievanceInitialized;
    return true; // an unrecognized domain is neither validated nor blocked here — see validateEventEffectTargets()
  });
}

/**
 * The real monthly selection — see file header for the full two-draw model. Deterministic, pure;
 * never mutates `definitions`/`selectionConfig`.
 * @param {number} rngState - current `state.events.rngState`
 * @param {object[]} definitions - `config.events.definitions`
 * @param {object} selectionConfig - `config.events.selection`
 * @param {{economyInitialized: boolean, populationInitialized: boolean, grievanceInitialized: boolean}} context
 * @returns {{eventId: string|null, nextRngState: number}}
 */
export function selectMonthlyEvent(rngState, definitions, selectionConfig, context) {
  const eligible = definitions.filter((def) => isEventEligible(def, context));
  const occurrenceDraw = nextRandomState(rngState);
  if (eligible.length === 0 || occurrenceDraw.value >= selectionConfig.probabilityPerMonth) {
    return { eventId: null, nextRngState: occurrenceDraw.nextState };
  }

  const weights = selectionConfig.weights ?? {};
  const totalWeight = eligible.reduce((sum, def) => sum + (weights[def.id] ?? 1), 0);
  const selectionDraw = nextRandomState(occurrenceDraw.nextState);
  if (totalWeight <= 0) {
    return { eventId: null, nextRngState: selectionDraw.nextState };
  }
  let threshold = selectionDraw.value * totalWeight;
  for (const def of eligible) {
    const w = weights[def.id] ?? 1;
    if (threshold < w) {
      return { eventId: def.id, nextRngState: selectionDraw.nextState };
    }
    threshold -= w;
  }
  // Floating-point edge case only (threshold landed exactly on the boundary) — the last eligible
  // definition, never an invented extra option.
  return { eventId: eligible[eligible.length - 1].id, nextRngState: selectionDraw.nextState };
}

// =============================== Effect application ===============================

/**
 * Applies ONE event definition's effects to `state`, domain by domain — see file header for the
 * per-domain rule. Never mutates `state`; always returns a new object. A definition with no
 * effects (the real `cyberattack`) returns `state` completely unchanged (reference-equal).
 * @param {object} state - the candidate state this event applies against (already past the
 *   Economy/Population stages this month, per the documented `CANONICAL_STAGE_ORDER`)
 * @param {object} definition - the selected event definition
 * @param {object} healthConfig - config.sectors.health, for the one real, protected
 *   clampHealth()/getSectorHealthStatus() sector-effect path
 * @returns {object} the new state
 */
export function applyEventEffects(state, definition, healthConfig) {
  if (!Array.isArray(definition.effects) || definition.effects.length === 0) return state;

  let next = state;
  for (const effect of definition.effects) {
    if (effect.domain === 'sector') {
      const sector = next.sectors[effect.target];
      const health = clampHealth(sector.health + effect.value, healthConfig);
      next = {
        ...next,
        sectors: { ...next.sectors, [effect.target]: { ...sector, health, status: getSectorHealthStatus(health, healthConfig) } },
      };
    } else if (effect.domain === 'economy') {
      next = { ...next, economy: { ...next.economy, [effect.target]: next.economy[effect.target] + effect.value } };
    } else if (effect.domain === 'population') {
      next = { ...next, population: next.population.map((a) => ({ ...a, economicPressure: clamp(a.economicPressure + effect.value, 0, 100) })) };
    } else if (effect.domain === 'grievance') {
      next = { ...next, grievance: { ...next.grievance, [effect.target]: next.grievance[effect.target] + effect.value } };
    }
  }
  return next;
}
