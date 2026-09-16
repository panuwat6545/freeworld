import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { Grid } from '../src/world/grid.js';
import { Structure } from '../src/building/structure.js';
import { Character } from '../src/characters/character.js';
import { BEHAVIORS } from '../src/characters/behaviors.js';
import { Settlement } from '../src/society/settlement.js';
import { SettlementDetector } from '../src/society/settlement-detector.js';
import { HomeSettlementTracker } from '../src/society/home-tracker.js';
import { computeLeader } from '../src/society/leadership.js';
import { ReproductionSystem } from '../src/society/reproduction.js';

function makeControlledWorld(width, height) {
  const world = new World({ width, height, seed: 1, density: 0 });
  world.grid = new Grid(width, height);
  return world;
}

test('SettlementDetector จัดกลุ่มที่พักใกล้กันเป็นถิ่นฐานเดียว และแยกกลุ่มถ้าไกลเกินระยะ', () => {
  const world = makeControlledWorld(50, 50);
  world.structures.push(new Structure({ type: 'shelter', x: 0, y: 0 }));
  world.structures.push(new Structure({ type: 'shelter', x: 3, y: 0 })); // ห่าง 3 <= radius 6
  world.structures.push(new Structure({ type: 'shelter', x: 40, y: 40 })); // ไกลมาก แยกถิ่นฐาน

  const detector = new SettlementDetector({ clusterRadius: 6, intervalTicks: 10 });
  const settlements = detector.detect(world, [], 0);

  assert.equal(settlements.length, 2);
  const bigger = settlements.find((s) => s.structureIds.length === 2);
  const smaller = settlements.find((s) => s.structureIds.length === 1);
  assert.ok(bigger, 'ควรมีถิ่นฐานที่มี 2 ที่พัก');
  assert.ok(smaller, 'ควรมีถิ่นฐานที่มี 1 ที่พักแยกต่างหาก');
});

test('SettlementDetector จัดกลุ่มแบบ transitive (A-B-C ใกล้กันเป็นทอด ถือเป็นถิ่นฐานเดียวแม้ A กับ C ไกลเกิน radius)', () => {
  const world = makeControlledWorld(50, 50);
  world.structures.push(new Structure({ type: 'shelter', x: 0, y: 0 }));
  world.structures.push(new Structure({ type: 'shelter', x: 6, y: 0 })); // ใกล้ A (ระยะ 6)
  world.structures.push(new Structure({ type: 'shelter', x: 12, y: 0 })); // ใกล้ B (ระยะ 6) แต่ไกล A (ระยะ 12)

  const detector = new SettlementDetector({ clusterRadius: 6, intervalTicks: 10 });
  const settlements = detector.detect(world, [], 0);

  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].structureIds.length, 3);
});

test('SettlementDetector ไม่คำนวณกลุ่มใหม่ซ้ำโดยไม่จำเป็น ถ้าจำนวนที่พักไม่เปลี่ยนและยังไม่ครบ intervalTicks', () => {
  const world = makeControlledWorld(50, 50);
  world.structures.push(new Structure({ type: 'shelter', x: 0, y: 0 }));

  const detector = new SettlementDetector({ clusterRadius: 6, intervalTicks: 10 });
  detector.detect(world, [], 0);
  assert.equal(detector.justRecomputed, true, 'ครั้งแรกต้องคำนวณเสมอ');

  detector.detect(world, [], 5); // ยังไม่ครบ interval และจำนวนที่พักไม่เปลี่ยนเลย
  assert.equal(detector.justRecomputed, false, 'ไม่ควรคำนวณซ้ำถ้าไม่มีอะไรเปลี่ยนและยังไม่ครบ interval');
});

test('SettlementDetector คำนวณใหม่ทันทีเมื่อมีที่พักใหม่เกิดขึ้น แม้ยังไม่ครบ intervalTicks (กัน home-tracker พลาดจังหวะที่พักที่เพิ่งสร้าง)', () => {
  const world = makeControlledWorld(50, 50);
  world.structures.push(new Structure({ type: 'shelter', x: 0, y: 0 }));

  const detector = new SettlementDetector({ clusterRadius: 6, intervalTicks: 10 });
  assert.equal(detector.detect(world, [], 0).length, 1);

  world.structures.push(new Structure({ type: 'shelter', x: 30, y: 30 })); // ที่พักใหม่ไกลมาก
  const settlements = detector.detect(world, [], 5); // ยังไม่ครบ interval (5 < 10) แต่มีที่พักใหม่เกิดขึ้น
  assert.equal(settlements.length, 2, 'ควรเห็นถิ่นฐานใหม่ทันทีแม้ยังไม่ครบ interval เพราะจำนวนที่พักเปลี่ยน');
  assert.equal(detector.justRecomputed, true);
});

test('SettlementDetector รวม 2 ถิ่นฐานเดิมเข้าด้วยกันเมื่อมีที่พักใหม่มาเชื่อม พร้อมย้าย memberIds และปรับ homeSettlementId ของตัวละคร', () => {
  const world = makeControlledWorld(50, 50);
  world.structures.push(new Structure({ type: 'shelter', x: 0, y: 0 }));
  world.structures.push(new Structure({ type: 'shelter', x: 10, y: 0 })); // ห่างกัน 10 > radius 6 แยกกลุ่ม

  const characterA = new Character({ x: 0, y: 0, needs: {} });
  const characterB = new Character({ x: 10, y: 0, needs: {} });

  const detector = new SettlementDetector({ clusterRadius: 6, intervalTicks: 10 });
  const initial = detector.detect(world, [characterA, characterB], 0);
  assert.equal(initial.length, 2);

  const settlementA = initial.find((s) => s.structureIds.includes(world.structures[0].id));
  const settlementB = initial.find((s) => s.structureIds.includes(world.structures[1].id));
  settlementA.memberIds.push(characterA.id);
  characterA.homeSettlementId = settlementA.id;
  settlementB.memberIds.push(characterB.id);
  characterB.homeSettlementId = settlementB.id;

  // ที่พักใหม่ตรงกลาง (5,0) ห่างจากทั้งสองฝั่งแค่ 5 <= radius 6 จึงเชื่อม 2 ถิ่นฐานเดิมเข้าด้วยกัน
  world.structures.push(new Structure({ type: 'shelter', x: 5, y: 0 }));
  const merged = detector.detect(world, [characterA, characterB], 10);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].structureIds.length, 3);
  assert.ok(merged[0].memberIds.includes(characterA.id));
  assert.ok(merged[0].memberIds.includes(characterB.id));
  assert.equal(characterA.homeSettlementId, merged[0].id);
  assert.equal(characterB.homeSettlementId, merged[0].id);
});

test('HomeSettlementTracker อัปเดต homeSettlementId เมื่อตัวละครพัก/สร้างใกล้ที่พักที่จัดกลุ่มถิ่นฐานแล้ว', () => {
  const world = makeControlledWorld(20, 20);
  world.structures.push(new Structure({ type: 'shelter', x: 5, y: 5 }));
  const shelterId = world.structures[0].id;

  const character = new Character({ x: 5, y: 5, needs: {} });
  character.currentBehavior = BEHAVIORS.REST;

  const settlement = new Settlement();
  settlement.structureIds = [shelterId];
  const structureToSettlementId = new Map([[shelterId, settlement.id]]);

  const tracker = new HomeSettlementTracker({ windowTicks: 100, nearbyRadius: 3 });
  tracker.update({ characters: [character], world, settlements: [settlement], structureToSettlementId, tick: 1 });

  assert.equal(character.homeSettlementId, settlement.id);
  assert.equal(character.homeSettlementSinceTick, 1);
  assert.ok(settlement.memberIds.includes(character.id));
});

test('HomeSettlementTracker ไม่นับตัวละครที่ไม่ได้ rest/build_shelter หรืออยู่ไกลเกินระยะที่พัก', () => {
  const world = makeControlledWorld(20, 20);
  world.structures.push(new Structure({ type: 'shelter', x: 5, y: 5 }));
  const shelterId = world.structures[0].id;
  const settlement = new Settlement();
  settlement.structureIds = [shelterId];
  const structureToSettlementId = new Map([[shelterId, settlement.id]]);
  const tracker = new HomeSettlementTracker({ windowTicks: 100, nearbyRadius: 3 });

  const idleCharacter = new Character({ x: 5, y: 5, needs: {} });
  idleCharacter.currentBehavior = BEHAVIORS.SEEK_FOOD; // ไม่ใช่พฤติกรรมที่เกี่ยวกับที่พัก
  const farCharacter = new Character({ x: 19, y: 19, needs: {} });
  farCharacter.currentBehavior = BEHAVIORS.REST; // rest แต่ไกลเกิน nearbyRadius

  tracker.update({
    characters: [idleCharacter, farCharacter],
    world,
    settlements: [settlement],
    structureToSettlementId,
    tick: 1,
  });

  assert.equal(idleCharacter.homeSettlementId, null);
  assert.equal(farCharacter.homeSettlementId, null);
});

test('computeLeader เลือกตัวละครที่สร้างที่พักมากสุดในถิ่นฐานเป็นผู้นำ', () => {
  const charA = new Character({ needs: {} });
  const charB = new Character({ needs: {} });

  const s1 = new Structure({ type: 'shelter', x: 0, y: 0, builtByCharacterId: charA.id });
  const s2 = new Structure({ type: 'shelter', x: 1, y: 0, builtByCharacterId: charA.id });
  const s3 = new Structure({ type: 'shelter', x: 2, y: 0, builtByCharacterId: charB.id });

  const settlement = new Settlement();
  settlement.structureIds = [s1.id, s2.id, s3.id];
  settlement.memberIds = [charA.id, charB.id];

  assert.equal(computeLeader(settlement, [charA, charB], [s1, s2, s3]), charA.id);
});

test('computeLeader tie-break: สร้างเท่ากัน ให้ตัวที่ homeSettlementSinceTick น้อยกว่า (อยู่นานกว่า) ชนะ', () => {
  const charA = new Character({ needs: {} });
  const charB = new Character({ needs: {} });
  charA.homeSettlementSinceTick = 200; // ย้ายมาทีหลัง
  charB.homeSettlementSinceTick = 50; // อยู่มาก่อน นานกว่า

  const s1 = new Structure({ type: 'shelter', x: 0, y: 0, builtByCharacterId: charA.id });
  const s2 = new Structure({ type: 'shelter', x: 1, y: 0, builtByCharacterId: charB.id });

  const settlement = new Settlement();
  settlement.structureIds = [s1.id, s2.id];
  settlement.memberIds = [charA.id, charB.id];

  assert.equal(computeLeader(settlement, [charA, charB], [s1, s2]), charB.id);
});

test('computeLeader tie-break สุดท้าย: สร้างเท่ากันและ sinceTick เท่ากัน ให้ character.id น้อยกว่าชนะ', () => {
  const charA = new Character({ needs: {} }); // สร้างก่อน id เลยน้อยกว่า
  const charB = new Character({ needs: {} });
  charA.homeSettlementSinceTick = 100;
  charB.homeSettlementSinceTick = 100;

  const settlement = new Settlement();
  settlement.structureIds = [];
  settlement.memberIds = [charB.id, charA.id]; // สลับลำดับเจตนา กันบั๊ก "มาก่อนใน array ชนะ"

  assert.equal(computeLeader(settlement, [charB, charA], []), charA.id);
});

test('computeLeader คืนค่า null เมื่อถิ่นฐานไม่มีสมาชิกเลย', () => {
  const settlement = new Settlement();
  assert.equal(computeLeader(settlement, [], []), null);
});

test('ReproductionSystem เกิดตัวละครใหม่เมื่อ 2 ตัวใกล้กัน social สูงต่อเนื่องครบเงื่อนไข และอยู่ถิ่นฐานเดียวกัน', () => {
  const settlement = new Settlement();
  const parentA = new Character({ x: 5, y: 5, needs: { social: 90 } });
  const parentB = new Character({ x: 5, y: 5, needs: { social: 90 } });
  parentA.homeSettlementId = settlement.id;
  parentB.homeSettlementId = settlement.id;
  settlement.memberIds = [parentA.id, parentB.id];

  const characters = [parentA, parentB];
  const reproduction = new ReproductionSystem({
    proximityRadius: 1,
    socialThreshold: 80,
    ticksRequired: 5,
    cooldownTicks: 100,
    maxPopulation: 10,
    minAgeTicks: 0,
  });

  let newborns = [];
  for (let tick = 1; tick <= 5; tick++) {
    newborns = reproduction.update({ characters, settlements: [settlement], tick });
  }

  assert.equal(newborns.length, 1);
  assert.equal(characters.length, 3);
  const child = characters[2];
  assert.equal(child.homeSettlementId, settlement.id);
  assert.ok(settlement.memberIds.includes(child.id));
});

test('ReproductionSystem ไม่เกิดตัวละครใหม่ถ้าพ่อแม่ไม่มีถิ่นฐานเดียวกัน (หรือยังไม่มีถิ่นฐานเลย)', () => {
  const parentA = new Character({ x: 0, y: 0, needs: { social: 90 } });
  const parentB = new Character({ x: 0, y: 0, needs: { social: 90 } });
  // ไม่ตั้ง homeSettlementId ให้ทั้งคู่ (ค่า default คือ null)

  const characters = [parentA, parentB];
  const reproduction = new ReproductionSystem({
    proximityRadius: 1,
    socialThreshold: 80,
    ticksRequired: 3,
    cooldownTicks: 100,
    maxPopulation: 10,
    minAgeTicks: 0,
  });

  let newborns = [];
  for (let tick = 1; tick <= 5; tick++) {
    newborns = reproduction.update({ characters, settlements: [], tick });
  }

  assert.equal(newborns.length, 0);
  assert.equal(characters.length, 2);
});

test('ReproductionSystem หยุดเกิดตัวละครใหม่เมื่อถึงเพดานประชากร (maxPopulation)', () => {
  const settlement = new Settlement();
  const parentA = new Character({ x: 0, y: 0, needs: { social: 90 } });
  const parentB = new Character({ x: 0, y: 0, needs: { social: 90 } });
  parentA.homeSettlementId = settlement.id;
  parentB.homeSettlementId = settlement.id;
  settlement.memberIds = [parentA.id, parentB.id];

  const characters = [parentA, parentB];
  const reproduction = new ReproductionSystem({
    proximityRadius: 1,
    socialThreshold: 80,
    ticksRequired: 3,
    cooldownTicks: 100,
    maxPopulation: 2, // เท่ากับจำนวนพ่อแม่พอดี ถือว่าเต็มแล้วตั้งแต่ต้น
    minAgeTicks: 0,
  });

  let newborns = [];
  for (let tick = 1; tick <= 5; tick++) {
    newborns = reproduction.update({ characters, settlements: [settlement], tick });
  }

  assert.equal(newborns.length, 0);
  assert.equal(characters.length, 2);
});

test('ReproductionSystem มี cooldown ต่อคู่ ไม่เกิดซ้ำทันทีหลังเกิดไปแล้ว 1 คน', () => {
  const settlement = new Settlement();
  const parentA = new Character({ x: 0, y: 0, needs: { social: 90 } });
  const parentB = new Character({ x: 0, y: 0, needs: { social: 90 } });
  parentA.homeSettlementId = settlement.id;
  parentB.homeSettlementId = settlement.id;
  settlement.memberIds = [parentA.id, parentB.id];

  const reproduction = new ReproductionSystem({
    proximityRadius: 1,
    socialThreshold: 80,
    ticksRequired: 3,
    cooldownTicks: 50,
    maxPopulation: 20,
    minAgeTicks: 0,
  });

  let totalNewborns = 0;
  // ตั้งใจส่ง array ที่มีแค่พ่อแม่ 2 คนเดิมทุกครั้ง (ไม่พาลูกที่เกิดไปแล้วไปรวมในรอบถัดไป) เพื่อแยกทดสอบ
  // เฉพาะกลไก cooldown ของคู่นี้ล้วนๆ ไม่ปนกับกรณีลูกโตแล้วมาจับคู่กับพ่อแม่เอง (ซึ่งมี minAgeTicks
  // กันไว้อีกชั้นในการใช้งานจริง — ดู test ถัดไป)
  for (let tick = 1; tick <= 20; tick++) {
    const newborns = reproduction.update({ characters: [parentA, parentB], settlements: [settlement], tick });
    totalNewborns += newborns.length;
  }

  assert.equal(totalNewborns, 1, 'เงื่อนไขครบซ้ำได้หลายรอบใน 20 tick แต่ cooldown (50) ต้องกันไม่ให้เกิดซ้ำ');
});

test('ReproductionSystem ไม่นับตัวละครที่อายุยังไม่ถึงเกณฑ์ขั้นต่ำเป็นคู่ขยายเผ่าพันธุ์ (กันลูกจับคู่กับพ่อแม่ตัวเองทันทีหลังเกิด)', () => {
  const settlement = new Settlement();
  const parent = new Character({ x: 0, y: 0, needs: { social: 90 } }); // bornAtTick default = 0 (โตแล้ว)
  const newborn = new Character({ x: 0, y: 0, needs: { social: 90 } });
  newborn.bornAtTick = 5; // เพิ่งเกิดที่ tick 5
  parent.homeSettlementId = settlement.id;
  newborn.homeSettlementId = settlement.id;
  settlement.memberIds = [parent.id, newborn.id];

  const characters = [parent, newborn];
  const reproduction = new ReproductionSystem({
    proximityRadius: 1,
    socialThreshold: 80,
    ticksRequired: 3,
    cooldownTicks: 100,
    maxPopulation: 20,
    minAgeTicks: 50,
  });

  let totalNewborns = 0;
  for (let tick = 5; tick <= 20; tick++) {
    // อายุของ newborn ตอน tick 20 คือ 20-5=15 ยังไม่ถึงเกณฑ์ 50 เลยตลอดช่วงนี้
    const newborns = reproduction.update({ characters, settlements: [settlement], tick });
    totalNewborns += newborns.length;
  }

  assert.equal(totalNewborns, 0);
});
