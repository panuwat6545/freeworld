// FREEWORLD RECOVERY-08, Phase C — Government & Minister Foundation.
//
// THIS FILE IS NEWLY AUTHORED FOR THIS RECOVERY PHASE. It is NOT a recovered file — no
// src/engine/government/* file survived in the recovered transcript evidence (RECOVERY-04/05).
// Everything below is a minimal reconstruction, scoped strictly to what Phase A's inspection
// actually found, plus a small number of explicit, clearly-labeled new design choices.
//
// ============================== Verified evidence this file is built from ==============================
// The ONLY recovered source that references government/ministry concepts at all is
// `src/ui/view-models/sector-view-model.js` (byte-for-byte recovered, unmodified by this phase).
// Its own comments and code establish these facts as VERIFIED (not inferred):
//   - A policy's ministry relationship comes ONLY from that policy's own `primaryMinistryId` field
//     — "reads a POLICY's own primaryMinistryId field... NEVER reads .sectorId/SECTOR_IDS to infer
//     one" (sector-view-model.js's own header comment). This file's `resolveMinistryForPolicy()`
//     does exactly, and only, that.
//   - `state.government.ministries[ministryId]` exists and has at least a `.name` field (read as
//     `ministryDef.name`).
//   - `state.government.availableMinisters[ministerId]` exists and has at least a `.name` field
//     (read as `minister.name`).
//   - `interpretPolicy(definition, government)` returns a record with `.ministryId` (string or
//     `null` when UNRESOLVED) and `.ministerId` (string or falsy when vacant) — referenced by
//     import only; its OWN implementation is NOT recovered, so this file does not implement it.
//   - `calculateMinisterEffectiveness(record, government, ministerEffectivenessConfig, turnIndex)`
//     returns an object with `.multiplier` (a number) — referenced by import only; its formula is
//     UNKNOWN (docs/RECOVERY-05-RULE-LEDGER.md row 15) and is NOT implemented here, per this
//     phase's own explicit instruction.
//
// config/policies.json (recovered) independently confirms the real `primaryMinistryId` values in
// use: agriculture, education, transport, industry-labor, commerce, foreign-customs — exactly 6,
// all with `supportingMinistryIds: []` (empty in every real recovered example; this file validates
// the field's TYPE generically, but has zero recovered example of a non-empty case to test against
// — documented in docs/RECOVERY-08-GOVERNMENT-FOUNDATION.md).
//
// ============================== RECONSTRUCTION-12 — canonical contract confirmation ==============================
// Per docs/RECONSTRUCTION-11-GOVERNMENT-STATE-CONTRACT-AUDIT.md's recommendation (adopted, not
// re-decided here): `state.government.ministries`/`state.government.availableMinisters`, exactly
// as this file already builds them, is the ONE canonical Government shape this workspace uses.
// `state.government.cabinet.assignments` (found only as a descriptive comment inside one captured
// config fragment, RECOVERY-28/31 — never as executing code anywhere) is deliberately never
// introduced here as a second container, an alias, or a new source of truth — doing so would
// duplicate state this file already owns, per that audit's own risk analysis.
//
// ============================== Explicitly OUT of scope this phase ==============================
//   - NO numeric Minister Effectiveness formula (Skill × (1−Corruption Leakage) × Loyalty ×
//     Bureaucratic Latency, or any other combination) — documented only, per Phase B, never
//     implemented. See the Rule Ledger row 15 and docs/RECOVERY-08-GOVERNMENT-FOUNDATION.md for the
//     full separation of concepts (Skill / Integrity / Corruption Leakage / Loyalty / Bureaucratic
//     Latency / vacancy duration) — none of them are modeled as state fields here, since none has a
//     verified canonical default, range, or neutral value, and this phase does not invent one.
//   - NO integration with src/engine/policies/policy-system.js — ministry/minister state and the
//     Policy Engine remain entirely separate modules this phase.
//   - Minister/Ministry records carry ONLY the two fields verified above (`id`, `name` for a
//     minister; `id`, `name`, `ministerId` for a ministry's appointment state) — no Skill/
//     Integrity/Loyalty/etc. field is added, defaulted, or silently accepted.
//
// ============================== RECONSTRUCTION-14 — Ministry Registry ==============================
// Per docs/RECONSTRUCTION-13-MINISTRY-REGISTRY-AUDIT.md's evidence table and adopted recommendation
// (Option B — a source-code constant, mirroring the existing `SECTOR_IDS` precedent,
// `src/state/game-state.js`): `MINISTRY_IDS` below is the canonical list of the 11 real ministry
// ids, VERIFIED_SOURCE via two independent methods that agree exactly on both ids and order
// (RECOVERY-21 §— a direct probe of the real `config/ministries.json`; RECOVERY-22 §2 — a live
// execution of the real, unmodified `game-runtime.js` logging `Object.keys(state.government.ministries)`).
//
// This constant carries NO display name (none is recovered for any of the 11 — re-confirmed,
// zero new finding, RECONSTRUCTION-13 §2) and is not consumed by `createInitialGovernmentState()`,
// `validateMinistryDefinitions()`, `validateState()`, or `isEveryTrackedMinistryStaffed()` — per
// this task's own explicit instruction, adding it does not make Government data mandatory, does
// not change what counts as "staffed," and does not build the real `ALL_MINISTRIES_STAFFED`
// condition (that still needs a roster decision this phase does not make — RECONSTRUCTION-13 §6).
// The array order matches both evidence captures exactly, but — per RECONSTRUCTION-13 §3 — this
// order is NOT asserted to carry any required meaning (e.g. for display or cabinet listing); it
// is recorded only as the one evidence-backed order, never claimed as semantically significant.
// `Object.freeze()` is used here (unlike `SECTOR_IDS`, which is a plain array) as a deliberate,
// explained improvement — a shared module-level array is one mutation away from corrupting every
// consumer that imports it, and genuine immutability is cheap and testable; this is a safety
// choice, not a claim that the real original data was ever "frozen" in any sense.
import { validateMinisterAttributes } from './minister-attributes.js';

export const MINISTRY_IDS = Object.freeze([
  'education',
  'agriculture',
  'transport',
  'commerce',
  'foreign-customs',
  'finance',
  'interior-housing',
  'industry-labor',
  'health',
  'defense',
  'digital-ai',
]);

// ============================== RECONSTRUCTION-25 — Default Minister Roster ==============================
// Owner-approved product decision (docs/RECONSTRUCTION-24-GOVERNMENT-ROSTER-PRODUCT-DECISION.md
// Option C, approved per the RECONSTRUCTION-25 task's own "Approved decisions" list): a minimal,
// EXPLICITLY NEW, fictional 12-minister roster. **This is NEW_PRODUCT_DECISION game content, not
// recovered evidence** — no individual minister identity was ever found in any recovered source
// (RECOVERY-21/22, re-confirmed unchanged through RECONSTRUCTION-15/23/24). The one piece of real
// evidence this roster honors is the COUNT (12 `availableMinisters` entries at a real, live
// `initializeGame()` execution — RECOVERY-22 §2) — the names themselves are invented, fictional,
// and must never be presented as recovered or as real public figures. Every name below is a
// generic, plausible Thai given-name + surname combination, deliberately unremarkable (the same
// register this project's own pre-existing test fixtures already use, e.g. "สมชาย"/"สมหยิง" in
// `tests/government-system.test.js`/`tests/minister-effectiveness.test.js`) — none is drawn from,
// or intended to resemble, any real person, living or dead, nor any real officeholder.
//
// Per the owner's original approval, the two fields every confirmed consumer actually reads
// are `{id, name}` (re-verified against `sector-view-model.js:80,87`, protected). FAST-TRACK
// BATCH 24 — under the project owner's explicit, separate authorization to replace the
// unworkable Minister Effectiveness blocker with a newly designed, internally consistent
// alternative — now ALSO gives every minister a 4-field `attributes` object
// ({skill, corruption, loyalty, bureaucraticLatency}, each [0,100]; see
// src/engine/government/minister-attributes.js for the full documented model). These values are
// new, hand-authored game-design content (same category as the names themselves — fictional,
// deliberately varied for gameplay texture, never claimed as recovered). `Object.freeze()`
// mirrors `MINISTRY_IDS`'s own established convention immediately above.
export const DEFAULT_MINISTER_ROSTER = Object.freeze([
  { id: 'minister-01', name: 'สมชาย วัฒนกุล', attributes: { skill: 70, corruption: 20, loyalty: 75, bureaucraticLatency: 30 } },
  { id: 'minister-02', name: 'สุนีย์ ประเสริฐสุข', attributes: { skill: 65, corruption: 15, loyalty: 80, bureaucraticLatency: 25 } },
  { id: 'minister-03', name: 'วิชัย ตันตระกูล', attributes: { skill: 55, corruption: 35, loyalty: 60, bureaucraticLatency: 45 } },
  { id: 'minister-04', name: 'นภา ศรีสุวรรรณ', attributes: { skill: 80, corruption: 10, loyalty: 85, bureaucraticLatency: 20 } },
  { id: 'minister-05', name: 'ประพันธ์ จันทรังษี', attributes: { skill: 50, corruption: 40, loyalty: 55, bureaucraticLatency: 50 } },
  { id: 'minister-06', name: 'กัญญา รุ่งเรือง', attributes: { skill: 75, corruption: 25, loyalty: 70, bureaucraticLatency: 35 } },
  { id: 'minister-07', name: 'ธีระ บุญมา', attributes: { skill: 60, corruption: 30, loyalty: 65, bureaucraticLatency: 40 } },
  { id: 'minister-08', name: 'อรุญี พงษ์ไพบูลย์', attributes: { skill: 85, corruption: 5, loyalty: 90, bureaucraticLatency: 15 } },
  { id: 'minister-09', name: 'สมบัติ เกียรตรรภุคณ', attributes: { skill: 45, corruption: 50, loyalty: 50, bureaucraticLatency: 55 } },
  { id: 'minister-10', name: 'พิมพ์ใจ อินทรสุข', attributes: { skill: 72, corruption: 18, loyalty: 78, bureaucraticLatency: 28 } },
  { id: 'minister-11', name: 'ชาคริต โสภณวงศ์', attributes: { skill: 58, corruption: 38, loyalty: 62, bureaucraticLatency: 42 } },
  { id: 'minister-12', name: 'ลดาวัลย์ ทองสุข', attributes: { skill: 68, corruption: 22, loyalty: 72, bureaucraticLatency: 32 } },
]);

/** @param {object[]} definitions - caller-supplied ministry definitions, each {id, name}
 * @returns {string[]} error strings; empty array = valid */
export function validateMinistryDefinitions(definitions) {
  const errors = [];
  const seen = new Set();
  for (const def of definitions ?? []) {
    if (!def || typeof def.id !== 'string' || def.id.length === 0) {
      errors.push(`ministry definition missing a valid non-empty string "id": ${JSON.stringify(def)}`);
      continue;
    }
    if (seen.has(def.id)) errors.push(`duplicate ministry id: "${def.id}"`);
    seen.add(def.id);
    if (typeof def.name !== 'string' || def.name.length === 0) {
      errors.push(`ministry "${def.id}": "name" must be a non-empty string`);
    }
  }
  return errors;
}

export function assertValidMinistryDefinitions(definitions) {
  const errors = validateMinistryDefinitions(definitions);
  if (errors.length > 0) throw new Error(`invalid ministry definitions:\n- ${errors.join('\n- ')}`);
}

/** @param {object[]} roster - caller-supplied minister roster, each {id, name}
 * @returns {string[]} */
/**
 * FAST-TRACK BATCH 24: now also validates `attributes` WHEN PRESENT, via the existing,
 * unmodified `validateMinisterAttributes()` (minister-attributes.js) — never required here,
 * since a legacy `{id, name}`-only record (no `attributes` key at all) remains a valid, expected
 * shape at this validation tier; `ensureMinisterAttributes()` is the explicit, separate migration
 * step responsible for backfilling it before any effectiveness calculation ever runs (see that
 * function's own header). A record whose `attributes` key IS present but malformed is still
 * rejected here, exactly like every other field.
 */
export function validateMinisterRoster(roster) {
  const errors = [];
  const seen = new Set();
  for (const m of roster ?? []) {
    if (!m || typeof m.id !== 'string' || m.id.length === 0) {
      errors.push(`minister record missing a valid non-empty string "id": ${JSON.stringify(m)}`);
      continue;
    }
    if (seen.has(m.id)) errors.push(`duplicate minister id: "${m.id}"`);
    seen.add(m.id);
    if (typeof m.name !== 'string' || m.name.length === 0) {
      errors.push(`minister "${m.id}": "name" must be a non-empty string`);
    }
    if ('attributes' in m) {
      errors.push(...validateMinisterAttributes(m.attributes).map((e) => `minister "${m.id}": ${e}`));
    }
  }
  return errors;
}

export function assertValidMinisterRoster(roster) {
  const errors = validateMinisterRoster(roster);
  if (errors.length > 0) throw new Error(`invalid minister roster:\n- ${errors.join('\n- ')}`);
}

/**
 * Builds the minimal verified government state shape. Requires EXPLICIT ministry definitions and
 * minister roster — this phase invents no default "11 ministries" or "N starting ministers" list
 * (no config/ministries.json or config/ministers.json survived recovery; see
 * docs/RECOVERY-08-GOVERNMENT-FOUNDATION.md for the full gap).
 * @param {{id:string,name:string}[]} ministryDefinitions
 * @param {{id:string,name:string}[]} ministerRoster
 * @returns {{ministries: object, availableMinisters: object}}
 */
export function createInitialGovernmentState(ministryDefinitions, ministerRoster) {
  assertValidMinistryDefinitions(ministryDefinitions);
  assertValidMinisterRoster(ministerRoster);

  const ministries = {};
  for (const def of ministryDefinitions) {
    ministries[def.id] = { id: def.id, name: def.name, ministerId: null };
  }
  const availableMinisters = {};
  for (const m of ministerRoster) {
    // FAST-TRACK BATCH 24: carries `attributes` through when the caller supplied one (already
    // validated above by assertValidMinisterRoster()) — a legacy caller that supplies no
    // `attributes` at all still gets exactly the pre-Batch-24 `{id, name}` shape, unchanged,
    // ready for `ensureMinisterAttributes()` to migrate explicitly later.
    availableMinisters[m.id] = 'attributes' in m
      ? { id: m.id, name: m.name, attributes: m.attributes }
      : { id: m.id, name: m.name };
  }
  return { ministries, availableMinisters };
}

/**
 * Pure; returns a new government state with `ministerId` appointed to `ministryId`.
 * Validates both ids exist. Does NOT enforce (and does not invent a rule for) whether the same
 * minister may simultaneously hold more than one ministry — no recovered evidence addresses this,
 * so this phase neither permits nor forbids it by special-casing; it simply is not checked.
 * @throws if either id is unknown
 */
export function appointMinister(government, ministryId, ministerId) {
  if (!government.ministries[ministryId]) {
    throw new Error(`appointMinister: unknown ministry id "${ministryId}"`);
  }
  if (!government.availableMinisters[ministerId]) {
    throw new Error(`appointMinister: unknown minister id "${ministerId}"`);
  }
  return {
    ...government,
    ministries: {
      ...government.ministries,
      [ministryId]: { ...government.ministries[ministryId], ministerId },
    },
  };
}

/**
 * Pure; returns a new government state with `ministryId` vacated.
 * @throws if `ministryId` is unknown, or if it is already vacant (mirrors
 *   src/engine/policies/policy-system.js::removePolicy()'s own "throw rather than silently no-op"
 *   convention for symmetry, not a recovered rule)
 */
export function removeMinister(government, ministryId) {
  const ministry = government.ministries[ministryId];
  if (!ministry) {
    throw new Error(`removeMinister: unknown ministry id "${ministryId}"`);
  }
  if (ministry.ministerId === null) {
    throw new Error(`removeMinister: ministry "${ministryId}" is already vacant`);
  }
  return {
    ...government,
    ministries: {
      ...government.ministries,
      [ministryId]: { ...ministry, ministerId: null },
    },
  };
}

/**
 * The one VERIFIED Policy→Ministry rule: a policy's ministry is whatever its own
 * `primaryMinistryId` field says, full stop — never inferred from `sectorId` or anything else.
 * @param {object} definition - a policy definition
 * @returns {string|null}
 */
export function resolveMinistryForPolicy(definition) {
  return definition.primaryMinistryId ?? null;
}

/**
 * RECONSTRUCTION-12 — a pure, deliberately NARROWER helper related to Policy Slot 4's real
 * `ALL_MINISTRIES_STAFFED` unlock condition. **This function does not implement that condition.**
 *
 * The real condition (per the captured `config/political-capital.json` comment, RECOVERY-28/31)
 * means "all 11 real canonical ministries are staffed." This workspace has no canonical roster of
 * those 11 real ministries anywhere — no `config/ministries.json` exists (RECONSTRUCTION-10 §2);
 * only a forensically-documented id LIST (RECOVERY-21/22) that was never loaded as data anywhere
 * in `src/`. A function given only `government.ministries` cannot tell whether that object
 * represents "all of them" or merely whichever subset a specific game happened to be constructed
 * with — building the real `ALL_MINISTRIES_STAFFED` would require either that canonical roster
 * (deferred, RECONSTRUCTION-10 §5) or hardcoding the 11-id list here, a product/implementation
 * decision this phase does not make unilaterally (RECONSTRUCTION-11 §6, open question 1).
 *
 * What IS honestly computable from canonical state alone — and exactly what this function
 * returns — is narrower: whether EVERY ministry actually present in `government.ministries`
 * (whatever subset that is) currently has a non-null `ministerId`. Returns `false` (never
 * vacuously `true`) when there are zero tracked ministries, since "zero ministries, all staffed"
 * would misrepresent an empty/unset government as a fully-staffed one.
 *
 * Deliberately NOT wired into `src/engine/policies/slots.js::applySlotUnlocks()`, the monthly
 * pipeline, or any other call site in this phase, per this task's own explicit instruction.
 * @param {{ministries: object}} government
 * @returns {boolean}
 */
export function isEveryTrackedMinistryStaffed(government) {
  if (!government || typeof government !== 'object' || !government.ministries || typeof government.ministries !== 'object') {
    return false;
  }
  const ministries = Object.values(government.ministries);
  if (ministries.length === 0) return false;
  return ministries.every((ministry) => ministry && ministry.ministerId !== null && ministry.ministerId !== undefined);
}

/**
 * Validates that every policy's `primaryMinistryId` (and, where present, every entry of
 * `supportingMinistryIds`) refers to a ministry that actually exists in the given government
 * state. This is validation-only — it does not repair or guess a mapping for an unknown id.
 * @param {object[]} policyDefinitions
 * @param {object} government - as produced by createInitialGovernmentState()
 * @returns {string[]} error strings; empty array = valid
 */
export function validatePolicyMinistryReferences(policyDefinitions, government) {
  const errors = [];
  const knownMinistryIds = new Set(Object.keys(government.ministries));

  for (const def of policyDefinitions ?? []) {
    const primary = resolveMinistryForPolicy(def);
    if (primary !== null && !knownMinistryIds.has(primary)) {
      errors.push(`policy "${def.id}": primaryMinistryId "${primary}" does not match any known ministry`);
    }
    for (const supportingId of def.supportingMinistryIds ?? []) {
      if (!knownMinistryIds.has(supportingId)) {
        errors.push(`policy "${def.id}": supportingMinistryIds entry "${supportingId}" does not match any known ministry`);
      }
    }
  }
  return errors;
}
