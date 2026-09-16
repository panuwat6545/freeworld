import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { Character } from '../src/characters/character.js';
import { BEHAVIORS } from '../src/characters/behaviors.js';
import { PROFESSIONS, getProfessionById, getProfessionByBehavior } from '../src/professions/profession.js';
import { ProfessionAssignmentTracker, getScarcityWeight } from '../src/professions/profession-assignment.js';
import { IncomeSupportGenerator, ProfessionIncomeTracker } from '../src/professions/income-generation.js';

test('getProfessionByBehavior คืนอาชีพที่ผูกกับพฤติกรรมนั้นถูกต้อง (gather_wood -> lumberjack, seek_food -> farmer)', () => {
  assert.equal(getProfessionByBehavior(BEHAVIORS.GATHER_WOOD).id, PROFESSIONS.LUMBERJACK);
  assert.equal(getProfessionByBehavior(BEHAVIORS.SEEK_FOOD).id, PROFESSIONS.FARMER);
});

test('getProfessionByBehavior คืน null สำหรับพฤติกรรมที่ไม่ได้ผูกกับอาชีพไหนเลย (rest/build_shelter/socialize/null)', () => {
  assert.equal(getProfessionByBehavior(BEHAVIORS.REST), null);
  assert.equal(getProfessionByBehavior(BEHAVIORS.BUILD_SHELTER), null);
  assert.equal(getProfessionByBehavior(BEHAVIORS.SOCIALIZE), null);
  assert.equal(getProfessionByBehavior(null), null);
});

test('ProfessionAssignmentTracker กำหนดอาชีพให้ตัวละครที่ทำพฤติกรรมเดิมซ้ำๆ บ่อยที่สุดในหน้าต่างเวลาปัจจุบัน (ต้องสะสมน้ำหนักถึงเกณฑ์ขั้นต่ำก่อน)', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const character = new Character({ needs: {} });
  const tracker = new ProfessionAssignmentTracker({ windowTicks: 100 });

  assert.equal(character.profession, null);

  character.currentBehavior = BEHAVIORS.GATHER_WOOD;
  // ทำแค่ไม่กี่ครั้งยังไม่ถึงเกณฑ์ขั้นต่ำ (MIN_WEIGHT_TO_ASSIGN) ควรยังไม่มีอาชีพ
  for (let tick = 1; tick <= 5; tick++) tracker.observeBehavior(character, world, tick);
  assert.equal(character.profession, null);

  // สะสมต่อจนเกินเกณฑ์ขั้นต่ำ -> ควรได้อาชีพแล้ว
  for (let tick = 6; tick <= 25; tick++) tracker.observeBehavior(character, world, tick);

  assert.equal(character.profession, PROFESSIONS.LUMBERJACK);
  assert.equal(character.professionSinceTick, 20); // ครบเกณฑ์ขั้นต่ำ (weight=20) พอดีที่ tick 20 (5 จากรอบแรก + 15)
});

test('ProfessionAssignmentTracker เปลี่ยนอาชีพให้ตัวละครได้เมื่อพฤติกรรมเปลี่ยนไปนานพอ (ครบหน้าต่างเวลาใหม่)', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const character = new Character({ needs: {} });
  const tracker = new ProfessionAssignmentTracker({ windowTicks: 50 });

  // ช่วงแรก: ทำ gather_wood บ่อยพอ (เกินเกณฑ์ขั้นต่ำ) -> กลายเป็นคนตัดไม้
  character.currentBehavior = BEHAVIORS.GATHER_WOOD;
  for (let tick = 1; tick <= 25; tick++) tracker.observeBehavior(character, world, tick);
  assert.equal(character.profession, PROFESSIONS.LUMBERJACK);

  // ช่วงถัดไป (ครบ windowTicks แล้ว เริ่มนับใหม่): เปลี่ยนไปทำ seek_food บ่อยแทน -> ควรเปลี่ยนเป็นคนทำฟาร์ม
  character.currentBehavior = BEHAVIORS.SEEK_FOOD;
  for (let tick = 51; tick <= 75; tick++) tracker.observeBehavior(character, world, tick);
  assert.equal(character.profession, PROFESSIONS.FARMER);
  assert.equal(character.professionSinceTick, 70); // หน้าต่างใหม่เริ่ม tick 51 ครบเกณฑ์ขั้นต่ำที่ tick 70 (51+19)
});

test('ProfessionAssignmentTracker.observeTradeEvents กำหนดอาชีพ freelancer ให้ helper ที่รับจ้างบ่อย (ต้องสะสมน้ำหนักถึงเกณฑ์ขั้นต่ำก่อน)', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const helper = new Character({ needs: {} });
  const tracker = new ProfessionAssignmentTracker({ windowTicks: 100 });
  const characters = [helper];

  for (let tick = 1; tick <= 25; tick++) {
    const tradeEvents = [{ kind: 'service', service: 'energy_help', helperId: helper.id, buyerId: 999 }];
    tracker.observeTradeEvents(tradeEvents, characters, tick);
  }

  assert.equal(helper.profession, PROFESSIONS.FREELANCER);
});

test('getScarcityWeight คืนค่า 1 สำหรับอาชีพที่ไม่มีทรัพยากร (resourceType null) เช่น freelancer', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  assert.equal(getScarcityWeight(world, null), 1);
});

test('getScarcityWeight อยู่ในช่วง 1.0 - 2.0 เสมอเมื่อมีทรัพยากรชนิดนั้นในโลก', () => {
  const world = new World({ seed: 42 }); // ขนาด default เพื่อให้มีโอกาสมีจุดไม้เกิดขึ้นจริง
  const weight = getScarcityWeight(world, 'wood');
  assert.ok(weight >= 1 && weight <= 2);
});

test('IncomeSupportGenerator จ่ายเต็มจำนวนให้ตัวละครที่ยังไม่มีอาชีพ และจ่ายแค่เศษเสี้ยวให้ตัวละครที่มีอาชีพแล้ว', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const unemployed = new Character({ needs: {} });
  const employed = new Character({ needs: {} });
  employed.profession = PROFESSIONS.LUMBERJACK;

  const startingUnemployed = unemployed.wallet.balance;
  const startingEmployed = employed.wallet.balance;

  const generator = new IncomeSupportGenerator({ ticksPerYear: 10, randomFn: () => 0.5 });
  world.update(10);
  const result = generator.checkAndPay(world, [unemployed, employed]);

  // randomFn คงที่ 0.5 -> fullAmount = 5 + 0.5*(20-5) = 12.5
  const unemployedGain = unemployed.wallet.balance - startingUnemployed;
  const employedGain = employed.wallet.balance - startingEmployed;

  assert.equal(result.paidCount, 2);
  assert.ok(Math.abs(unemployedGain - 12.5) < 1e-9);
  // ตัวละครมีอาชีพแล้วต้องได้น้อยกว่าเต็มจำนวนอย่างมีนัยสำคัญ (เศษเสี้ยวเพื่อความเสถียร ไม่ใช่เงินเดือนเต็ม)
  assert.ok(employedGain > 0 && employedGain < unemployedGain);
});

test('IncomeSupportGenerator ไม่จ่ายซ้ำถ้ายังไม่ครบปีใหม่', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const character = new Character({ needs: {} });
  const generator = new IncomeSupportGenerator({ ticksPerYear: 100 });

  world.update(50);
  assert.equal(generator.checkAndPay(world, [character]), null);
});

test('ProfessionIncomeTracker นับรายได้จาก trade event จริงตามอาชีพของผู้รับเงิน (ผู้ขาย/ผู้รับจ้าง)', () => {
  const seller = new Character({ needs: {} });
  seller.profession = PROFESSIONS.LUMBERJACK;
  const helper = new Character({ needs: {} });
  helper.profession = PROFESSIONS.FREELANCER;
  const characters = [seller, helper];

  const tracker = new ProfessionIncomeTracker();
  tracker.observeTradeEvents(
    [
      { type: 'xcoin', kind: 'goods', good: 'wood', price: 15, sellerId: seller.id, buyerId: 999 },
      { type: 'xcoin', kind: 'service', service: 'energy_help', price: 8, helperId: helper.id, buyerId: 999 },
      // barter ไม่มีเงินจริง ไม่ควรนับเป็นรายได้
      { type: 'barter', kind: 'goods', good: 'wood', price: 0, sellerId: seller.id, buyerId: 999 },
    ],
    characters,
  );

  assert.equal(tracker.getTotalIncome(PROFESSIONS.LUMBERJACK), 15);
  assert.equal(tracker.getTotalIncome(PROFESSIONS.FREELANCER), 8);
});

test('ProfessionIncomeTracker ไม่นับรายได้ให้ตัวละครที่ยังไม่มีอาชีพ (profession null)', () => {
  const seller = new Character({ needs: {} });
  const tracker = new ProfessionIncomeTracker();

  tracker.observeTradeEvents(
    [{ type: 'xcoin', kind: 'goods', good: 'wood', price: 15, sellerId: seller.id, buyerId: 999 }],
    [seller],
  );

  assert.equal(tracker.getTotalIncome(PROFESSIONS.LUMBERJACK), 0);
});

test('ตัวละครที่ยังไม่มีอาชีพยังอยู่รอดทางเศรษฐกิจได้ (ไม่อดตาย): ยังได้เงินเดือนขั้นต่ำไปเรื่อยๆ ทุกปี', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const character = new Character({ needs: {} });
  const generator = new IncomeSupportGenerator({ ticksPerYear: 10, randomFn: () => 0.5 });

  let balance = character.wallet.balance;
  for (let year = 1; year <= 5; year++) {
    world.update(10);
    generator.checkAndPay(world, [character]);
    assert.ok(character.wallet.balance > balance);
    balance = character.wallet.balance;
  }
});

test('getProfessionById คืนอาชีพที่ถูกต้องตาม id และ null เมื่อไม่พบ', () => {
  assert.equal(getProfessionById(PROFESSIONS.FARMER).name, 'คนทำฟาร์ม');
  assert.equal(getProfessionById('not_a_real_profession'), null);
});
