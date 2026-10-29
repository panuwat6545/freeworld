// FAST-TRACK BATCH 25 — Inflation Monthly Update (NEW_PRODUCT_DECISION, owner-authorized).
//
// THIS FILE IS NEWLY AUTHORED GAME DESIGN, not a recovered formula — zero evidence of any kind
// exists for an inflation formula anywhere in this workspace (RECOVERY-15/16/17). Per the project
// owner's explicit authorization, this file defines a new, bounded, config-driven monthly
// inflation update.
//
// ============================== The model, in plain language ==============================
//   newInflation = clamp(inflation + gdpGrowth * sensitivity, bounds.min, bounds.max)
//
// A growing economy (positive GDP growth) nudges inflation up; a shrinking economy nudges it
// down — the standard, intuitive macroeconomic direction ("an overheating economy sees rising
// prices"). The result is always clamped to an EXPLICIT, documented range
// (`DEFAULT_INFLATION_CONFIG.bounds`), satisfying this batch's own requirement for "inflation
// movement with explicit limits." No mean-reversion or target-inflation term is included — this
// batch keeps the model to the smallest set of terms that gives meaningful, boundable feedback,
// per the batch's own instruction to keep the model "understandable and tunable" rather than
// scattering unexplained coefficients.
export const DEFAULT_INFLATION_CONFIG = Object.freeze({
  sensitivity: 0.3,
  bounds: Object.freeze({ min: -5, max: 20 }),
});

/**
 * Structural validation only. The config object itself may be absent (the caller then uses
 * `DEFAULT_INFLATION_CONFIG`), but if present, both `sensitivity` and a well-formed `bounds`
 * (`min` strictly less than `max`, both finite) are required.
 * @param {*} inflationConfig
 * @returns {string[]} error strings; empty array = valid
 */
export function validateInflationConfig(inflationConfig) {
  const errors = [];
  if (!inflationConfig || typeof inflationConfig !== 'object' || Array.isArray(inflationConfig)) {
    errors.push(`inflationConfig must be a plain object, got ${JSON.stringify(inflationConfig)}`);
    return errors;
  }
  if (typeof inflationConfig.sensitivity !== 'number' || !Number.isFinite(inflationConfig.sensitivity)) {
    errors.push(`inflationConfig.sensitivity must be a finite number, got ${JSON.stringify(inflationConfig.sensitivity)}`);
  }
  const bounds = inflationConfig.bounds;
  if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)) {
    errors.push(`inflationConfig.bounds must be a plain object, got ${JSON.stringify(bounds)}`);
  } else {
    if (typeof bounds.min !== 'number' || !Number.isFinite(bounds.min)) {
      errors.push(`inflationConfig.bounds.min must be a finite number, got ${JSON.stringify(bounds.min)}`);
    }
    if (typeof bounds.max !== 'number' || !Number.isFinite(bounds.max)) {
      errors.push(`inflationConfig.bounds.max must be a finite number, got ${JSON.stringify(bounds.max)}`);
    }
    if (typeof bounds.min === 'number' && typeof bounds.max === 'number' && bounds.min >= bounds.max) {
      errors.push('inflationConfig.bounds.min must be strictly less than bounds.max');
    }
  }
  return errors;
}

/** Throwing variant of `validateInflationConfig()`. */
export function assertValidInflationConfig(inflationConfig) {
  const errors = validateInflationConfig(inflationConfig);
  if (errors.length > 0) {
    throw new Error(`invalid inflationConfig:\n- ${errors.join('\n- ')}`);
  }
}

/**
 * The new, owner-authorized monthly inflation update — see file header. Always clamped to the
 * configured (or default) explicit bounds. Guards against a non-finite result before returning.
 * @param {number} inflation - the current `state.economy.inflation` value
 * @param {number} gdpGrowth - this month's real, computed GDP growth value
 * @param {object} [inflationConfig] - defaults to `DEFAULT_INFLATION_CONFIG` when omitted
 * @returns {number} the new, clamped inflation value
 */
export function calculateMonthlyInflation(inflation, gdpGrowth, inflationConfig = DEFAULT_INFLATION_CONFIG) {
  if (typeof inflation !== 'number' || !Number.isFinite(inflation)) {
    throw new Error(`calculateMonthlyInflation: inflation must be a finite number, got ${JSON.stringify(inflation)}`);
  }
  if (typeof gdpGrowth !== 'number' || !Number.isFinite(gdpGrowth)) {
    throw new Error(`calculateMonthlyInflation: gdpGrowth must be a finite number, got ${JSON.stringify(gdpGrowth)}`);
  }
  const configErrors = validateInflationConfig(inflationConfig);
  if (configErrors.length > 0) {
    throw new Error(`calculateMonthlyInflation: invalid inflationConfig:\n- ${configErrors.join('\n- ')}`);
  }

  const raw = inflation + gdpGrowth * inflationConfig.sensitivity;
  const clamped = Math.min(inflationConfig.bounds.max, Math.max(inflationConfig.bounds.min, raw));

  if (!Number.isFinite(clamped)) {
    throw new Error(`calculateMonthlyInflation: computed inflation is not finite (${clamped}) — refusing to return NaN/Infinity`);
  }
  return clamped;
}
