import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/characters/character.js';
import { NEEDS_CONFIG } from '../src/characters/needs-config.js';
import { Settlement } from '../src/society/settlement.js';
import { SettlementLawsetRegistry } from '../src/governance/settlement-lawset.js';
import {
  computeEconomicHardshipIndex,
  computeInequalityIndex,
  computeLawBurdenIndex,
  computeConditionIndices,
} from '../src/social-conditions/condition-index.js';
import {
  computeDecayModifiers,
  NeedsConditionModifier,
} from '../src/social-conditions/needs-condition-modifier.js';
import { SOCIAL_CONDITIONS_CONFIG } from '../src/social-conditions/social-conditions-config.js';

// ===== condition-index.js =====

test('computeEconomicHardshipIndex คำนวณถูกต้อง: ยอดเฉลี่ยเท่ากับที่ควรจะเป็นพอดี -> ดัชนี = 1.0 (ปกติ)', () => {
  const settlement = new Settlement();
  const a = new Character({ needs: {} });
  const b = new Character({ needs: {} });
  a.wallet.balance = 100;
  b.wallet.balance = 300;
  settlement.memberIds = [a.id, b.id];

  // average = 200, cumulativeIndex = 2 -> expected = STARTING_BALANCE(100) * 2 = 200 -> ดัชนี = 200/200 = 1.0
  const index = computeEconomicHardshipIndex(settlement, [a, b], 2);
  assert.ok(Math.abs(index - 1.0) < 1e-9);
});

test('computeEconomicHardshipIndex ดัชนีสูงขึ้นเมื่อยอดเฉลี่ยจริงต่ำกว่าที่ควรจะเป็น (ฝืดเคืองมากขึ้น)', () => {
  const settlement = new Settlement();
  const a = new Character({ needs: {} });
  a.wallet.balance = 50;
  settlement.memberIds = [a.id];

  // average = 50, cumulativeIndex = 2 -> expected = 200 -> ดัชนี = 200/50 = 4.0 (ฝืดเคืองมาก)
  const index = computeEconomicHardshipIndex(settlement, [a], 2);
  assert.ok(Math.abs(index - 4.0) < 1e-9);
});

test('computeEconomicHardshipIndex คืนค่า neutral point เมื่อถิ่นฐานไม่มีสมาชิก (ไม่มีข้อมูลให้ประเมิน)', () => {
  const settlement = new Settlement();
  const index = computeEconomicHardshipIndex(settlement, [], 3);
  assert.equal(index, SOCIAL_CONDITIONS_CONFIG.HARDSHIP_NEUTRAL_POINT);
});

test('computeInequalityIndex คำนวณ coefficient of variation (stddev/mean) ถูกต้อง', () => {
  const settlement = new Settlement();
  const a = new Character({ needs: {} });
  const b = new Character({ needs: {} });
  a.wallet.balance = 100;
  b.wallet.balance = 300;
  settlement.memberIds = [a.id, b.id];

  // mean=200, variance=((100-200)^2+(300-200)^2)/2=10000, stddev=100, CV=100/200=0.5
  const index = computeInequalityIndex(settlement, [a, b]);
  assert.ok(Math.abs(index - 0.5) < 1e-9);
});

test('computeInequalityIndex คืน 0 เมื่อสมาชิกน้อยกว่า 2 คน (วัดความแปรปรวนไม่ได้จริง)', () => {
  const settlement = new Settlement();
  const a = new Character({ needs: {} });
  settlement.memberIds = [a.id];
  assert.equal(computeInequalityIndex(settlement, [a]), 0);
});

test('computeInequalityIndex คืน 0 เมื่อทุกคนมียอดเท่ากันเป๊ะ (ไม่มีความเหลื่อมล้ำเลย)', () => {
  const settlement = new Settlement();
  const a = new Character({ needs: {} });
  const b = new Character({ needs: {} });
  a.wallet.balance = 150;
  b.wallet.balance = 150;
  settlement.memberIds = [a.id, b.id];
  assert.equal(computeInequalityIndex(settlement, [a, b]), 0);
});

test('computeLawBurdenIndex คืน 0 เป๊ะเมื่อไม่มีกฎหมายเปิดอยู่เลยตามสเปก', () => {
  const registry = new SettlementLawsetRegistry();
  const settlement = new Settlement();
  assert.equal(computeLawBurdenIndex(settlement, registry), 0);
});

test('computeLawBurdenIndex รวมภาระจากภาษีการค้า + สิทธิ์เขตแดนโหมด block ถูกต้อง', () => {
  const registry = new SettlementLawsetRegistry();
  const settlement = new Settlement();
  settlement.leaderId = 999;
  registry.enableLaw(settlement, 999, 'trade_tax', { rate: 0.2 });
  registry.enableLaw(settlement, 999, 'territorial_access', { mode: 'block' });

  // burden = 0.2 (ภาษี) + 0.5 (block เต็มที่) = 0.7
  assert.ok(Math.abs(computeLawBurdenIndex(settlement, registry) - 0.7) < 1e-9);
});

test('computeLawBurdenIndex โหมด penalty คิดตาม confiscationRate เป็นสัดส่วน (เบากว่า block เสมอเมื่อ confiscationRate < 1)', () => {
  const registry = new SettlementLawsetRegistry();
  const settlement = new Settlement();
  settlement.leaderId = 999;
  registry.enableLaw(settlement, 999, 'territorial_access', { mode: 'penalty', confiscationRate: 0.4 });

  // burden = 0.4 * 0.5 = 0.2
  assert.ok(Math.abs(computeLawBurdenIndex(settlement, registry) - 0.2) < 1e-9);
});

test('computeConditionIndices รวม 3 ดัชนีเข้าด้วยกันถูกต้อง', () => {
  const registry = new SettlementLawsetRegistry();
  const settlement = new Settlement();
  settlement.leaderId = 999;
  const a = new Character({ needs: {} });
  a.wallet.balance = 100;
  settlement.memberIds = [a.id];
  registry.enableLaw(settlement, 999, 'trade_tax', { rate: 0.1 });

  const indices = computeConditionIndices(settlement, [a], 1, registry);
  assert.ok(Math.abs(indices.economicHardship - 1.0) < 1e-9);
  assert.equal(indices.inequality, 0);
  assert.ok(Math.abs(indices.lawBurden - 0.1) < 1e-9);
});

// ===== needs-condition-modifier.js: computeDecayModifiers =====

test('computeDecayModifiers คืนค่าเป็นกลาง (1.0 ทั้ง 4 need) เมื่อดัชนีทั้งหมดอยู่ในเกณฑ์ปกติพอดี', () => {
  const modifiers = computeDecayModifiers({ economicHardship: 1.0, inequality: 0, lawBurden: 0 });
  assert.equal(modifiers.hunger, 1);
  assert.equal(modifiers.energy, 1);
  assert.equal(modifiers.shelter, 1);
  assert.equal(modifiers.social, 1);
});

test('computeDecayModifiers ยังเป็นกลางแม้ดัชนีเบี่ยงเบนเล็กน้อยในกรอบ dead zone (ไม่กระทบการ tune เฟส 1-9 เดิม)', () => {
  const modifiers = computeDecayModifiers({ economicHardship: 1.3, inequality: 0.4, lawBurden: 0 });
  assert.equal(modifiers.hunger, 1); // hardship dead zone = 0.5 -> 1.3 ยังอยู่ในช่วง [0.5, 1.5]
  assert.equal(modifiers.social, 1); // inequality dead zone = 0.6 -> 0.4 ยังอยู่ในช่วง
  assert.equal(modifiers.shelter, 1); // lawBurden = 0
  assert.equal(modifiers.energy, 1); // ทุกตัวเป็นกลางหมด เฉลี่ยจึงเป็นกลางด้วย
});

test('ความฝืดเคืองเกินเกณฑ์ปกติทำให้ hunger decay เร็วขึ้นจริง (modifier > 1) ไม่ใช่กลับทิศ', () => {
  const neutral = computeDecayModifiers({ economicHardship: 1.0, inequality: 0, lawBurden: 0 });
  const harsh = computeDecayModifiers({ economicHardship: 2.5, inequality: 0, lawBurden: 0 });
  assert.ok(harsh.hunger > 1);
  assert.ok(harsh.hunger > neutral.hunger);
});

test('เศรษฐกิจดีกว่าปกติมาก (hardship ต่ำกว่า neutral เกิน dead zone) ทำให้ hunger decay ช้าลง (modifier < 1)', () => {
  const easy = computeDecayModifiers({ economicHardship: 0.1, inequality: 0, lawBurden: 0 });
  assert.ok(easy.hunger < 1);
});

test('ความเหลื่อมล้ำเกินเกณฑ์ปกติทำให้ social decay เร็วขึ้นจริง (modifier > 1)', () => {
  const neutral = computeDecayModifiers({ economicHardship: 1.0, inequality: 0, lawBurden: 0 });
  const divided = computeDecayModifiers({ economicHardship: 1.0, inequality: 1.5, lawBurden: 0 });
  assert.ok(divided.social > 1);
  assert.ok(divided.social > neutral.social);
});

test('ภาระกฎหมายสูงทำให้ shelter decay เร็วขึ้นจริง (modifier > 1)', () => {
  const neutral = computeDecayModifiers({ economicHardship: 1.0, inequality: 0, lawBurden: 0 });
  const burdened = computeDecayModifiers({ economicHardship: 1.0, inequality: 0, lawBurden: 0.8 });
  assert.ok(burdened.shelter > 1);
  assert.ok(burdened.shelter > neutral.shelter);
});

test('modifier รวม (energy) แย่ลงเมื่อทุกดัชนีแย่ลงพร้อมกัน สะท้อนความเหนื่อยล้าทางสังคมโดยรวม', () => {
  const stressed = computeDecayModifiers({ economicHardship: 3, inequality: 2, lawBurden: 1 });
  assert.ok(stressed.energy > 1);
});

test('modifier ทุกตัวถูกจำกัดไม่ให้เกินขอบเขต [1 - MAX_DEVIATION, 1 + MAX_DEVIATION] แม้ดัชนีจะสุดขั้วแค่ไหน', () => {
  const extreme = computeDecayModifiers({ economicHardship: 1000, inequality: 1000, lawBurden: 1000 });
  const { MAX_DEVIATION } = SOCIAL_CONDITIONS_CONFIG;
  for (const key of ['hunger', 'energy', 'shelter', 'social']) {
    assert.ok(extreme[key] <= 1 + MAX_DEVIATION + 1e-9);
    assert.ok(extreme[key] >= 1 - MAX_DEVIATION - 1e-9);
  }
});

// ===== NeedsConditionModifier: การห่อ decayNeeds จากภายนอก =====

test('NeedsConditionModifier.wrapCharacter ทำให้ decay เร็วขึ้นจริงเมื่อสภาพสังคมแย่ (ไม่ใช่กลับทิศ)', () => {
  const settlement = new Settlement();
  const character = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
  character.homeSettlementId = settlement.id;
  settlement.memberIds = [character.id];
  character.wallet.balance = 1; // ยากจนมาก เทียบกับเงินเฟ้อสะสมสูง -> hardship สูงเกิน dead zone แน่นอน

  const modifier = new NeedsConditionModifier();
  const registry = new SettlementLawsetRegistry();
  modifier.updateSettlementModifiers([settlement], [character], 10, registry);
  modifier.wrapCharacter(character);

  character.decayNeeds(1);

  const plainCharacter = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
  plainCharacter.decayNeeds(1);

  assert.ok(character.needs.hunger < plainCharacter.needs.hunger);
});

test('NeedsConditionModifier ไม่กระทบตัวละครที่ยังไม่มี homeSettlementId (ยัง decay ปกติทุกประการ)', () => {
  const character = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
  const modifier = new NeedsConditionModifier();
  modifier.wrapCharacter(character);

  const plainCharacter = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
  character.decayNeeds(1);
  plainCharacter.decayNeeds(1);

  assert.equal(character.needs.hunger, plainCharacter.needs.hunger);
  assert.equal(character.needs.energy, plainCharacter.needs.energy);
  assert.equal(character.needs.shelter, plainCharacter.needs.shelter);
  assert.equal(character.needs.social, plainCharacter.needs.social);
});

test('NeedsConditionModifier ไม่กระทบ decay เลยเมื่อสภาพสังคมของถิ่นฐานยังอยู่ในเกณฑ์ปกติ (regression-safe กับเฟส 1-9)', () => {
  const settlement = new Settlement();
  const character = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
  character.homeSettlementId = settlement.id;
  settlement.memberIds = [character.id];
  character.wallet.balance = 100; // เท่ากับ STARTING_BALANCE พอดี

  const modifier = new NeedsConditionModifier();
  const registry = new SettlementLawsetRegistry();
  // cumulativeIndex = 1 (ยังไม่มีเงินเฟ้อสะสมเลย) -> expected = 100 = ยอดจริงพอดี -> hardship = 1.0 (ปกติ)
  modifier.updateSettlementModifiers([settlement], [character], 1, registry);
  modifier.wrapCharacter(character);

  character.decayNeeds(1);

  const plainCharacter = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
  plainCharacter.decayNeeds(1);

  assert.equal(character.needs.hunger, plainCharacter.needs.hunger);
  assert.equal(character.needs.energy, plainCharacter.needs.energy);
  assert.equal(character.needs.shelter, plainCharacter.needs.shelter);
  assert.equal(character.needs.social, plainCharacter.needs.social);
});

test('wrapCharacter เรียกซ้ำหลายครั้งไม่ทำให้ห่อซ้อนกัน (idempotent)', () => {
  const settlement = new Settlement();
  const character = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
  character.homeSettlementId = settlement.id;
  settlement.memberIds = [character.id];
  character.wallet.balance = 1;

  const modifier = new NeedsConditionModifier();
  const registry = new SettlementLawsetRegistry();
  modifier.updateSettlementModifiers([settlement], [character], 10, registry);

  modifier.wrapCharacter(character);
  const wrappedOnce = character.decayNeeds;
  modifier.wrapCharacter(character);
  modifier.wrapCharacter(character);

  // ห่อซ้ำแล้ว reference ของ decayNeeds ต้องไม่เปลี่ยน (ไม่ได้ห่อซ้อนทับอีกชั้น)
  assert.equal(character.decayNeeds, wrappedOnce);

  // เรียกครั้งเดียวต้องให้ผลเหมือนห่อแค่ชั้นเดียว ไม่ใช่ลดซ้ำหลายเท่าจากการห่อซ้อน
  character.decayNeeds(1);
  const singleWrapExpectedHunger = 100 - NEEDS_CONFIG.DECAY_RATE.hunger * computeDecayModifiers({
    economicHardship: 1000,
    inequality: 0,
    lawBurden: 0,
  }).hunger;
  assert.ok(Math.abs(character.needs.hunger - singleWrapExpectedHunger) < 1e-9);
});
