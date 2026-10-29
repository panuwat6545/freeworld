// FAST-TRACK BATCH 25 — Treasury Monthly Update (NEW_PRODUCT_DECISION, owner-authorized).
//
// THIS FILE IS NEWLY AUTHORED GAME DESIGN, not a recovered formula. The real
// `src/engine/economy/treasury.js` (`calculateNextTreasury`, `calculatePeriodBudgetBalance`) was
// never recovered — zero body lines, zero coefficients (RECOVERY-15/16/17, re-confirmed through
// every later batch). Per the project owner's explicit authorization to replace unrecoverable
// formulas with new, coherent, documented rules ("Build a Working Economy Monthly Simulation"),
// this file defines a new, bounded, config-driven monthly treasury update.
//
// ============================== The model, in plain language ==============================
// Each month, the treasury gains REVENUE and pays EXPENDITURE:
//   revenue      = baseRevenue + gdpRevenueFactor * gdpGrowth
//   expenditure  = baseExpenditure + policyUpkeepCost * activePolicyCount
//   newTreasury  = treasury + revenue - expenditure
//
// In plain language: a healthier, growing economy (`gdpGrowth`, from
// `economy-tick.js::calculateGdpGrowthDelta()`) brings in more revenue; running more active
// policies costs more to administer every month. This is a NEW, direct relationship between
// active policy COUNT and the economy — distinct from, and in addition to, GDP growth's own
// existing, established transitive relationship through Sector Health (Batch 4's own documented
// constraint, unchanged: policy effects reach GDP only via Sector Health, never a second GDP
// formula). Treasury's policy-upkeep term is a separate, clearly-labeled new rule, not a
// reinterpretation of that constraint.
//
// All 4 coefficients are configurable via `config.economy.treasury` and have owner-authorized
// defaults (`DEFAULT_TREASURY_CONFIG`) — never hidden, unexplained magic numbers scattered in
// code. `treasury` itself is never clamped to a floor or ceiling — going into debt (a negative
// treasury) is a legitimate, meaningful game state this model does not paper over.

// FAST-TRACK BATCH 44 — PROVISIONAL_IMPLEMENTATION revision of `baseExpenditure` (80 -> 100),
// replacing the Batch 25 original.
//
// ============================== Why this changed (VERIFIED, not speculative) ==============================
// Batch 43's real, 120-month Baseline scenario (ZERO player actions, ZERO active policies, the
// whole game) showed Treasury growing by ≈18.5/month on average, from 1000 to 3224.9 over 120
// months. Tracing the formula below with `activePolicyCount = 0`: `revenue = 100 + 10*gdpGrowth`,
// `expenditure = 80` (the `policyUpkeepCost` term is zero with no policies) — so EVERY month,
// regardless of GDP performance, Treasury gained a GUARANTEED flat `100 - 80 = 20` surplus before
// GDP even enters the picture (the observed ≈18.5 instead of exactly 20 is the real, typically
// mildly-negative baseline GDP growth shaving a little off; see Batch 43's own report). This
// guaranteed, action-independent surplus is the root cause both of "recovery tools are repeatedly
// affordable regardless of play" (Batch 43 Finding 2) and of Treasury having so much slack that 5
// policies' real upkeep (5 * 5 = 25/month) still barely dents it.
//
// ============================== The new assumption (PROVISIONAL_IMPLEMENTATION) ==============================
// `baseExpenditure: 100` makes the Baseline, no-policy, no-GDP-growth case exactly NEUTRAL
// (`revenue - expenditure = 0`): Treasury now moves ONLY in response to real GDP performance
// (`gdpRevenueFactor * gdpGrowth`, transitively driven by real Sector Health, exactly as designed
// — see `economy-tick.js`'s own header) and real policy upkeep — never from a flat, unconditional
// windfall. This is the smallest coherent change that makes "do nothing" genuinely neutral rather
// than profitable, without imposing an arbitrary floor/ceiling (there is none here, and still
// none) and without touching the GDP-growth or policy-upkeep terms this batch did not find reason
// to revise. `baseRevenue`/`gdpRevenueFactor`/`policyUpkeepCost` are UNCHANGED.
// FAST-TRACK BATCH 45 — PROVISIONAL_IMPLEMENTATION revision of `policyUpkeepCost` (5 -> 2),
// replacing the Batch 25 original. `baseRevenue`/`gdpRevenueFactor`/`baseExpenditure` are
// UNCHANGED from Batch 44 — this batch's own Step 2 explicitly forbids restoring the old
// guaranteed windfall, and Baseline/Recovery-focused/Crisis-response (all `activePolicyCount: 0`)
// were never catastrophic under Batch 44's formula, so there was no reason to touch those 3.
//
// ============================== Why this changed (VERIFIED, not speculative) ==============================
// Batch 45's own Step 1 instrumentation (`tests/support/scenario-runner.js`'s new
// revenue/expenditure/policyUpkeep fields, reconciled EXACTLY against every real committed
// month's treasury delta — see `docs/BATCH-45-STEP1-EXACT-OUTCOMES.json`) traced the Policy-
// focused/Mixed deficits to their exact source: 5 active policies' real upkeep
// (`5 * 5 = 25`/month, `3000` cumulative over 120 months) against real cumulative GDP-driven
// revenue of only `~12459`/`~12504` (vs. `15000` expenditure) — a real, persistent ~21/month
// shortfall that compounds into Policy-focused ending at `-1561.1` and Mixed at `-2415.9`. This is
// NOT misattributable to Crisis Consequences (both scenarios: `0`, crisis never triggers) or
// Recovery tools (Policy-focused: `0`, never used; Mixed: `-900`, a real but secondary
// contributor) — `policyUpkeepCost` alone accounts for the entire structural gap.
//
// ============================== The new assumption (PROVISIONAL_IMPLEMENTATION) ==============================
// `policyUpkeepCost: 2` (5 active policies -> `10`/month, `1200` cumulative over 120 months,
// down from `3000`) keeps a REAL, meaningful, strictly-positive recurring cost per active policy
// — placing and maintaining policies is still never free, and 5 policies still costs more than 1
// — while no longer being automatically catastrophic against the real, neutral (Batch 44)
// baseline: re-running the real 120-month Policy-focused scenario under this value ends at a
// real, disclosed decline (not a restored windfall, not an arbitrary floor — see this batch's own
// report §2 for the exact re-measured before/after numbers) rather than a four-figure deficit.
// `baseRevenue`/`gdpRevenueFactor`/`baseExpenditure` are UNCHANGED.
// FAST-TRACK BATCH 46 — PROVISIONAL_IMPLEMENTATION revision of `policyUpkeepCost` (2 -> 0.4),
// replacing the Batch 45 value. `baseRevenue`/`gdpRevenueFactor`/`baseExpenditure` remain
// UNCHANGED — this is, again, not a restoration of any guaranteed windfall.
//
// ============================== Why this changed (VERIFIED by direct long-run execution, not speculative) ==============================
// Batch 46's own Step 2 investigation (`tests/support/generate-batch46-treasury-recovery.mjs`)
// found that maintaining 5 active policies (the real, structural maximum — only 5 real slots
// exist) converges, regardless of STARTING Treasury (confirmed identically from a healthy 1000
// and from a -2000 deficit), to a genuine, permanent SECTOR-HEALTH/GDP-GROWTH EQUILIBRIUM —
// average sector health settles at EXACTLY 55.00 and `gdpGrowth` at EXACTLY 0.25, confirmed by
// direct 300-month execution (both starting conditions converge to the identical steady state by
// ~month 240). At the OLD `policyUpkeepCost: 2`, this equilibrium's own real numbers
// (`revenue = 100 + 10*0.25 = 102.5`; `expenditure = 100 + 2*5 = 110`) produce a GUARANTEED,
// CONSTANT `-7.5`/month shortfall FOREVER once reached — not a temporary dip, a genuine permanent
// divergence with no recovery possible at any horizon, confirmed by a real 300-month run (Treasury
// strictly declining at turn 300, with no sign of leveling). This is a DEMONSTRATED GAMEPLAY DEAD
// END (see this batch's own report §2–3), not a deficit-specific problem and not fixable by any
// starting-Treasury choice — the equilibrium itself (driven entirely by Sector Health/GDP, which
// `policyUpkeepCost` never influences) was always going to be reached by any sufficiently long
// game that places and maintains several policies, which is the INTENDED, encouraged playstyle
// this whole mechanic exists for.
//
// ============================== The new assumption (PROVISIONAL_IMPLEMENTATION) ==============================
// `policyUpkeepCost: 0.4` makes the SAME real equilibrium (`avgHealth: 55`, `gdpGrowth: 0.25`,
// `5` active policies) a real, confirmed SURPLUS (`expenditure = 100 + 0.4*5 = 102`; `revenue =
// 102.5`; net `+0.5`/month) rather than a guaranteed, unbounded loss — chosen as the smallest
// value with a real positive margin at this exact, directly-measured worst-case (maximum real
// slot count) equilibrium; the exact breakeven point is `0.5`, so `0.4` is deliberately just
// below it, not an arbitrary round number chosen for appearance. This does NOT mean policies
// become "free": placing one still costs real Political Capital at placement, still costs a real,
// felt Sector Health trade-off on its shared secondary target (Batch 44's own harmonic-stacking
// fix, unmodified), and still costs a real (now much smaller, but still strictly positive and
// summed across every active policy) monthly Treasury upkeep — maintaining MORE policies is still
// strictly more expensive than maintaining fewer, at every point before the long-run equilibrium
// is reached. Re-running the real 300-month "Mixed" scenario (both starting conditions) under
// this value confirms Treasury no longer diverges to permanent debt — see this batch's own
// report for the exact re-measured trajectory.
export const DEFAULT_TREASURY_CONFIG = Object.freeze({
  baseRevenue: 100,
  gdpRevenueFactor: 10,
  baseExpenditure: 100,
  policyUpkeepCost: 0.4,
});

/**
 * Structural validation only: every field, when the config object itself is present, must be a
 * finite number. The config object itself may be absent (the caller then uses
 * `DEFAULT_TREASURY_CONFIG`) but if present, every one of the 4 fields is required — this is
 * brand-new, complete, owner-authorized content from day one, not a partially-evidenced legacy
 * shape with optional fields.
 * @param {*} treasuryConfig
 * @returns {string[]} error strings; empty array = valid
 */
export function validateTreasuryConfig(treasuryConfig) {
  const errors = [];
  if (!treasuryConfig || typeof treasuryConfig !== 'object' || Array.isArray(treasuryConfig)) {
    errors.push(`treasuryConfig must be a plain object, got ${JSON.stringify(treasuryConfig)}`);
    return errors;
  }
  for (const field of ['baseRevenue', 'gdpRevenueFactor', 'baseExpenditure', 'policyUpkeepCost']) {
    const value = treasuryConfig[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`treasuryConfig.${field} must be a finite number, got ${JSON.stringify(value)}`);
    }
  }
  return errors;
}

/** Throwing variant of `validateTreasuryConfig()`. */
export function assertValidTreasuryConfig(treasuryConfig) {
  const errors = validateTreasuryConfig(treasuryConfig);
  if (errors.length > 0) {
    throw new Error(`invalid treasuryConfig:\n- ${errors.join('\n- ')}`);
  }
}

/**
 * The new, owner-authorized monthly treasury update — see file header for the full formula and
 * rationale. Never clamps the result (a negative treasury is a legitimate state). Guards against
 * a non-finite result before returning.
 * @param {number} treasury - the current `state.economy.treasury` value
 * @param {number} gdpGrowth - this month's real, computed GDP growth value
 * @param {number} activePolicyCount - count of currently FILLED policy slots this month
 * @param {object} [treasuryConfig] - defaults to `DEFAULT_TREASURY_CONFIG` when omitted
 * @returns {number} the new treasury value
 */
export function calculateMonthlyTreasuryChange(treasury, gdpGrowth, activePolicyCount, treasuryConfig = DEFAULT_TREASURY_CONFIG) {
  if (typeof treasury !== 'number' || !Number.isFinite(treasury)) {
    throw new Error(`calculateMonthlyTreasuryChange: treasury must be a finite number, got ${JSON.stringify(treasury)}`);
  }
  if (typeof gdpGrowth !== 'number' || !Number.isFinite(gdpGrowth)) {
    throw new Error(`calculateMonthlyTreasuryChange: gdpGrowth must be a finite number, got ${JSON.stringify(gdpGrowth)}`);
  }
  if (typeof activePolicyCount !== 'number' || !Number.isFinite(activePolicyCount) || activePolicyCount < 0) {
    throw new Error(`calculateMonthlyTreasuryChange: activePolicyCount must be a non-negative finite number, got ${JSON.stringify(activePolicyCount)}`);
  }
  const configErrors = validateTreasuryConfig(treasuryConfig);
  if (configErrors.length > 0) {
    throw new Error(`calculateMonthlyTreasuryChange: invalid treasuryConfig:\n- ${configErrors.join('\n- ')}`);
  }

  const revenue = treasuryConfig.baseRevenue + treasuryConfig.gdpRevenueFactor * gdpGrowth;
  const expenditure = treasuryConfig.baseExpenditure + treasuryConfig.policyUpkeepCost * activePolicyCount;
  const nextTreasury = treasury + revenue - expenditure;

  if (!Number.isFinite(nextTreasury)) {
    throw new Error(`calculateMonthlyTreasuryChange: computed treasury is not finite (${nextTreasury}) — refusing to return NaN/Infinity`);
  }
  return nextTreasury;
}
