import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/characters/character.js';
import { NEEDS_CONFIG } from '../src/characters/needs-config.js';
import { getMostUrgentNeed, decideBehavior, updateCharacter } from '../src/characters/utility-ai.js';
import { BEHAVIORS } from '../src/characters/behaviors.js';
import { stepToward, isAdjacentOrSame } from '../src/characters/movement.js';
import { World } from '../src/world/world.js';
import { Grid } from '../src/world/grid.js';
import { ResourceNode } from '../src/world/resource-node.js';
import { RESOURCE_TYPES } from '../src/world/resource-types.js';

test('decayNeeds ลดค่าตามอัตรา decay ของแต่ละ need และหิวลดเร็วกว่าสังคม', () => {
  const character = new Character();
  character.decayNeeds(1);
  assert.equal(character.needs.hunger, 100 - NEEDS_CONFIG.DECAY_RATE.hunger);
  assert.equal(character.needs.energy, 100 - NEEDS_CONFIG.DECAY_RATE.energy);
  assert.equal(character.needs.shelter, 100 - NEEDS_CONFIG.DECAY_RATE.shelter);
  assert.equal(character.needs.social, 100 - NEEDS_CONFIG.DECAY_RATE.social);
  assert.ok(NEEDS_CONFIG.DECAY_RATE.hunger > NEEDS_CONFIG.DECAY_RATE.social);
});

test('decayNeeds ไม่ทำให้ค่าต่ำกว่า 0', () => {
  const character = new Character({ needs: { hunger: 1, energy: 1, shelter: 1, social: 1 } });
  character.decayNeeds(100);
  for (const value of Object.values(character.needs)) {
    assert.equal(value, 0);
  }
});

test('getMostUrgentNeed เลือก need ที่ค่าต่ำสุด', () => {
  assert.equal(getMostUrgentNeed({ hunger: 10, energy: 90, shelter: 90, social: 90 }), 'hunger');
  assert.equal(getMostUrgentNeed({ hunger: 90, energy: 5, shelter: 90, social: 90 }), 'energy');
  assert.equal(getMostUrgentNeed({ hunger: 90, energy: 90, shelter: 5, social: 90 }), 'shelter');
  assert.equal(getMostUrgentNeed({ hunger: 90, energy: 90, shelter: 90, social: 5 }), 'social');
});

test('getMostUrgentNeed ตัดสินด้วยลำดับความสำคัญเมื่อค่าเท่ากัน', () => {
  assert.equal(getMostUrgentNeed({ hunger: 50, energy: 50, shelter: 50, social: 50 }), 'hunger');
  assert.equal(getMostUrgentNeed({ hunger: 90, energy: 50, shelter: 50, social: 50 }), 'energy');
});

test('decideBehavior แม็ป need ที่เร่งด่วนที่สุดไปยังพฤติกรรมที่ถูกต้อง', () => {
  assert.equal(decideBehavior({ hunger: 5, energy: 90, shelter: 90, social: 90 }), BEHAVIORS.SEEK_FOOD);
  assert.equal(decideBehavior({ hunger: 90, energy: 5, shelter: 90, social: 90 }), BEHAVIORS.REST);
  assert.equal(decideBehavior({ hunger: 90, energy: 90, shelter: 5, social: 90 }), BEHAVIORS.GATHER_WOOD);
  assert.equal(decideBehavior({ hunger: 90, energy: 90, shelter: 90, social: 5 }), BEHAVIORS.SOCIALIZE);
});

test('stepToward เดินทีละช่องเข้าหาเป้าหมายในทิศทางที่ถูกต้อง', () => {
  assert.deepEqual(stepToward({ x: 0, y: 0 }, { x: 5, y: 0 }), { x: 1, y: 0 });
  assert.deepEqual(stepToward({ x: 5, y: 5 }, { x: 0, y: 0 }), { x: 4, y: 4 });
  assert.deepEqual(stepToward({ x: 3, y: 3 }, { x: 3, y: 3 }), { x: 3, y: 3 });
  assert.deepEqual(stepToward({ x: 0, y: 5 }, { x: 3, y: 0 }), { x: 1, y: 4 });
});

test('isAdjacentOrSame คืนค่า true เมื่อระยะห่างไม่เกิน 1 ช่อง', () => {
  assert.ok(isAdjacentOrSame({ x: 5, y: 5 }, { x: 5, y: 5 }));
  assert.ok(isAdjacentOrSame({ x: 5, y: 5 }, { x: 6, y: 6 }));
  assert.ok(!isAdjacentOrSame({ x: 5, y: 5 }, { x: 7, y: 5 }));
});

test('rest ฟื้นพลังงานเมื่อ energy เป็น need ที่เร่งด่วนที่สุด', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  const character = new Character({ x: 2, y: 2, needs: { hunger: 90, energy: 10, shelter: 90, social: 90 } });
  const before = character.needs.energy;
  const behavior = updateCharacter(character, world, [character], 1);
  assert.equal(behavior, BEHAVIORS.REST);
  assert.ok(character.needs.energy > before - NEEDS_CONFIG.DECAY_RATE.energy);
});

test('socialize เดินเข้าหาตัวละครอื่นและฟื้น social เมื่ออยู่ติดกัน', () => {
  const world = new World({ width: 10, height: 10, seed: 1, density: 0 });
  const a = new Character({ x: 0, y: 0, needs: { hunger: 90, energy: 90, shelter: 90, social: 5 } });
  const b = new Character({ x: 5, y: 0, needs: { hunger: 90, energy: 90, shelter: 90, social: 90 } });
  const all = [a, b];

  updateCharacter(a, world, all, 1);
  assert.equal(a.currentBehavior, BEHAVIORS.SOCIALIZE);
  assert.deepEqual(a.position, { x: 1, y: 0 });

  a.position = { x: 4, y: 0 };
  const socialBefore = a.needs.social;
  updateCharacter(a, world, all, 1);
  assert.ok(a.needs.social > socialBefore);
});

test('seekFood เดินเข้าหาจุดอาหารที่ใกล้ที่สุดแล้วเก็บกินเมื่อไปถึง', () => {
  const grid = new Grid(6, 6);
  const world = new World({ width: 6, height: 6, seed: 1, density: 0 });
  world.grid = grid;
  grid.getCell(4, 4).resourceNode = new ResourceNode(RESOURCE_TYPES.FOOD, {
    amount: 100,
    maxAmount: 100,
    regenRate: 1,
  });

  const character = new Character({ x: 0, y: 0, needs: { hunger: 10, energy: 100, shelter: 100, social: 100 } });

  for (let i = 0; i < 4; i++) {
    updateCharacter(character, world, [character], 1);
    assert.equal(character.currentBehavior, BEHAVIORS.SEEK_FOOD);
  }
  assert.deepEqual(character.position, { x: 4, y: 4 });

  const hungerBeforeEat = character.needs.hunger;
  updateCharacter(character, world, [character], 1);
  assert.ok(character.needs.hunger > hungerBeforeEat);
  assert.ok(grid.getCell(4, 4).resourceNode.amount < 100);
});

test('gatherWood สะสมไม้เข้า inventory เมื่อไปถึงจุดทรัพยากรไม้', () => {
  const grid = new Grid(4, 4);
  const world = new World({ width: 4, height: 4, seed: 1, density: 0 });
  world.grid = grid;
  grid.getCell(2, 0).resourceNode = new ResourceNode(RESOURCE_TYPES.WOOD, {
    amount: 100,
    maxAmount: 100,
    regenRate: 1,
  });

  const character = new Character({ x: 0, y: 0, needs: { hunger: 100, energy: 100, shelter: 5, social: 100 } });

  updateCharacter(character, world, [character], 1);
  assert.equal(character.currentBehavior, BEHAVIORS.GATHER_WOOD);
  updateCharacter(character, world, [character], 1);
  assert.deepEqual(character.position, { x: 2, y: 0 });

  assert.equal(character.inventory.wood, 0);
  updateCharacter(character, world, [character], 1);
  assert.ok(character.inventory.wood > 0);
});
