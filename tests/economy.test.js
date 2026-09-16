import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { Character } from '../src/characters/character.js';
import { Settlement } from '../src/society/settlement.js';
import { ECONOMY_CONFIG } from '../src/economy/economy-config.js';
import { createWallet, deposit, withdraw } from '../src/economy/wallet.js';
import { InflationTracker } from '../src/economy/inflation.js';
import { BasicIncomeGenerator } from '../src/economy/basic-income.js';
import { getSettlementTotalBalance, getSettlementAverageBalance } from '../src/economy/settlement-economy.js';
import { EconomySystem } from '../src/economy/economy-system.js';

test('createWallet เริ่มต้นด้วย STARTING_BALANCE จาก config โดย default', () => {
  const wallet = createWallet();
  assert.equal(wallet.balance, ECONOMY_CONFIG.STARTING_BALANCE);
});

test('createWallet รับค่าเริ่มต้นเองได้ (override default)', () => {
  const wallet = createWallet(50);
  assert.equal(wallet.balance, 50);
});

test('deposit เพิ่มยอด xcoin เข้า wallet ถูกต้อง', () => {
  const wallet = createWallet(100);
  const newBalance = deposit(wallet, 25);
  assert.equal(wallet.balance, 125);
  assert.equal(newBalance, 125);
});

test('deposit จำนวนติดลบต้อง throw error ไม่แก้ยอด', () => {
  const wallet = createWallet(100);
  assert.throws(() => deposit(wallet, -10));
  assert.equal(wallet.balance, 100);
});

test('withdraw ถอนสำเร็จเมื่อยอดพอ และคืนค่า true', () => {
  const wallet = createWallet(100);
  const success = withdraw(wallet, 30);
  assert.equal(success, true);
  assert.equal(wallet.balance, 70);
});

test('withdraw ป้องกันยอดติดลบ: ถอนเกินยอดที่มีคืนค่า false และไม่แก้ยอด', () => {
  const wallet = createWallet(20);
  const success = withdraw(wallet, 50);
  assert.equal(success, false);
  assert.equal(wallet.balance, 20);
});

test('withdraw จำนวนติดลบต้อง throw error ไม่แก้ยอด', () => {
  const wallet = createWallet(100);
  assert.throws(() => withdraw(wallet, -5));
  assert.equal(wallet.balance, 100);
});

test('Character ใหม่ทุกตัวมี wallet เริ่มต้นด้วย STARTING_BALANCE', () => {
  const character = new Character({ needs: {} });
  assert.equal(character.wallet.balance, ECONOMY_CONFIG.STARTING_BALANCE);
});

test('InflationTracker ไม่ทำอะไรจนกว่าจะครบ 1 ปีเกม', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const tracker = new InflationTracker({ ticksPerYear: 100 });

  world.update(50);
  assert.equal(tracker.checkAndApply(world), null);
});

test('InflationTracker สุ่มอัตราเงินเฟ้ออยู่ในช่วง 2-10% เสมอ และปรับ cumulativeIndex แบบทบต้นถูกต้อง', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  // สุ่มค่า "สูงสุด" และ "ต่ำสุด" ที่ randomFn ให้ได้ (0 และเกือบ 1) เพื่อยืนยันขอบเขตของช่วงที่แปลงแล้ว
  const trackerMin = new InflationTracker({ ticksPerYear: 10, randomFn: () => 0 });
  const trackerMax = new InflationTracker({ ticksPerYear: 10, randomFn: () => 1 });

  world.update(10);
  const entryMin = trackerMin.checkAndApply(world);
  const entryMax = trackerMax.checkAndApply(world);

  assert.equal(entryMin.rate, ECONOMY_CONFIG.INFLATION_MIN_RATE);
  assert.equal(entryMax.rate, ECONOMY_CONFIG.INFLATION_MAX_RATE);
  assert.equal(entryMin.cumulativeIndex, 1 * (1 + ECONOMY_CONFIG.INFLATION_MIN_RATE));

  // ปีถัดไปต้องทบต้นจาก cumulativeIndex เดิม ไม่ใช่รีเซ็ตกลับไปที่ 1
  world.update(10);
  const entryYear2 = trackerMax.checkAndApply(world);
  const expected = 1 * (1 + ECONOMY_CONFIG.INFLATION_MAX_RATE) * (1 + ECONOMY_CONFIG.INFLATION_MAX_RATE);
  assert.ok(Math.abs(entryYear2.cumulativeIndex - expected) < 1e-9);
});

test('InflationTracker สุ่มด้วย Math.random จริงหลายรอบ ยังอยู่ในช่วง 2-10% ทุกครั้ง', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const tracker = new InflationTracker({ ticksPerYear: 1 });

  for (let year = 1; year <= 100; year++) {
    world.update(1);
    const entry = tracker.checkAndApply(world);
    assert.ok(entry.rate >= ECONOMY_CONFIG.INFLATION_MIN_RATE && entry.rate <= ECONOMY_CONFIG.INFLATION_MAX_RATE);
  }
});

test('BasicIncomeGenerator จ่ายรายได้พื้นฐานให้ทุกตัวละครเมื่อครบปีใหม่ อยู่ในช่วงที่กำหนด', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const characters = [new Character({ needs: {} }), new Character({ needs: {} })];
  const startingBalances = characters.map((c) => c.wallet.balance);

  const generator = new BasicIncomeGenerator({ ticksPerYear: 10, randomFn: () => 0.5 });
  world.update(10);
  const result = generator.checkAndPay(world, characters);

  assert.equal(result.characterCount, 2);
  const expectedAmount =
    ECONOMY_CONFIG.BASIC_INCOME_MIN + 0.5 * (ECONOMY_CONFIG.BASIC_INCOME_MAX - ECONOMY_CONFIG.BASIC_INCOME_MIN);
  characters.forEach((c, i) => {
    assert.ok(Math.abs(c.wallet.balance - (startingBalances[i] + expectedAmount)) < 1e-9);
  });
});

test('BasicIncomeGenerator ไม่จ่ายซ้ำถ้ายังไม่ครบปีใหม่', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const characters = [new Character({ needs: {} })];
  const generator = new BasicIncomeGenerator({ ticksPerYear: 100 });

  world.update(50);
  assert.equal(generator.checkAndPay(world, characters), null);
});

test('getSettlementTotalBalance / getSettlementAverageBalance รวม/เฉลี่ยยอด xcoin ของสมาชิกถิ่นฐานถูกต้อง', () => {
  const characterA = new Character({ needs: {} });
  const characterB = new Character({ needs: {} });
  const characterOutsider = new Character({ needs: {} });
  characterA.wallet.balance = 100;
  characterB.wallet.balance = 300;
  characterOutsider.wallet.balance = 999; // ไม่ได้อยู่ในถิ่นฐานนี้ ไม่ควรถูกนับ

  const settlement = new Settlement();
  settlement.memberIds = [characterA.id, characterB.id];

  const characters = [characterA, characterB, characterOutsider];
  assert.equal(getSettlementTotalBalance(settlement, characters), 400);
  assert.equal(getSettlementAverageBalance(settlement, characters), 200);
});

test('getSettlementAverageBalance คืนค่า 0 เมื่อถิ่นฐานไม่มีสมาชิก', () => {
  const settlement = new Settlement();
  assert.equal(getSettlementAverageBalance(settlement, []), 0);
});

test('EconomySystem.update คืนค่า inflationEvent/incomeEvent พร้อมกันเมื่อครบปีใหม่ และ null ทั้งคู่ถ้ายังไม่ครบ', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const characters = [new Character({ needs: {} })];
  const economy = new EconomySystem({
    inflation: new InflationTracker({ ticksPerYear: 10 }),
    basicIncome: new BasicIncomeGenerator({ ticksPerYear: 10 }),
  });

  world.update(5);
  const beforeYear = economy.update(world, characters);
  assert.equal(beforeYear.inflationEvent, null);
  assert.equal(beforeYear.incomeEvent, null);

  world.update(5);
  const afterYear = economy.update(world, characters);
  assert.ok(afterYear.inflationEvent !== null);
  assert.ok(afterYear.incomeEvent !== null);
});
