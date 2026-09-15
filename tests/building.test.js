import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/characters/character.js';
import { updateCharacter } from '../src/characters/utility-ai.js';
import { BEHAVIORS } from '../src/characters/behaviors.js';
import { World } from '../src/world/world.js';
import { Grid } from '../src/world/grid.js';
import { ResourceNode } from '../src/world/resource-node.js';
import { RESOURCE_TYPES } from '../src/world/resource-types.js';
import { BLUEPRINTS } from '../src/building/blueprints.js';
import { canBuild, build, hasEnoughResources } from '../src/building/crafting.js';
import { Structure } from '../src/building/structure.js';
import { findNearestStructure, isNearStructureType } from '../src/building/structure-finder.js';

function makeControlledWorld(width, height) {
  const world = new World({ width, height, seed: 1, density: 0 });
  world.grid = new Grid(width, height);
  return world;
}

test('hasEnoughResources ตรวจสูตรถูกต้องตามจำนวนที่มีใน inventory', () => {
  const blueprint = BLUEPRINTS.shelter;
  assert.equal(hasEnoughResources({ wood: 9 }, blueprint), false);
  assert.equal(hasEnoughResources({ wood: 10 }, blueprint), true);
  assert.equal(hasEnoughResources({ wood: 20 }, blueprint), true);
});

test('gatherWood behavior สะสมไม้เข้า inventory เมื่อเก็บเกี่ยวสำเร็จ', () => {
  const world = makeControlledWorld(4, 4);
  world.grid.getCell(2, 0).resourceNode = new ResourceNode(RESOURCE_TYPES.WOOD, {
    amount: 100,
    maxAmount: 100,
    regenRate: 1,
  });
  const character = new Character({ x: 0, y: 0, needs: { hunger: 100, energy: 100, shelter: 5, social: 100 } });

  updateCharacter(character, world, [character], 1); // เดินเข้าใกล้
  updateCharacter(character, world, [character], 1); // เดินถึง (2,0)
  assert.equal(character.inventory.wood, 0);

  updateCharacter(character, world, [character], 1); // เก็บเกี่ยว
  assert.ok(character.inventory.wood > 0);
});

test('canBuild คืนค่า true เมื่อ inventory ครบสูตร และ false เมื่อไม่ครบ', () => {
  const characterPoor = new Character({ needs: {} });
  characterPoor.inventory.wood = 5;
  assert.equal(canBuild(characterPoor, 'shelter'), false);

  const characterRich = new Character({ needs: {} });
  characterRich.inventory.wood = 10;
  assert.equal(canBuild(characterRich, 'shelter'), true);
});

test('build หักทรัพยากรออกจาก inventory และวางสิ่งก่อสร้างลงบนโลกที่ตำแหน่งตัวละคร', () => {
  const world = makeControlledWorld(5, 5);
  const character = new Character({ x: 3, y: 2, needs: {} });
  character.inventory.wood = 25;

  const structure = build(character, world, 'shelter');

  assert.ok(structure instanceof Structure);
  assert.equal(structure.type, 'shelter');
  assert.deepEqual(structure.position, { x: 3, y: 2 });
  assert.equal(character.inventory.wood, 15); // 25 - 10 ตามสูตร
  assert.equal(world.structures.length, 1);
  assert.equal(world.structures[0], structure);
});

test('build คืนค่า null และไม่หักทรัพยากรเมื่อของไม่ครบสูตร', () => {
  const world = makeControlledWorld(5, 5);
  const character = new Character({ x: 0, y: 0, needs: {} });
  character.inventory.wood = 3;

  const structure = build(character, world, 'shelter');

  assert.equal(structure, null);
  assert.equal(character.inventory.wood, 3);
  assert.equal(world.structures.length, 0);
});

test('findNearestStructure / isNearStructureType หาที่พักที่ใกล้ที่สุดได้ถูกต้อง', () => {
  const world = makeControlledWorld(20, 20);
  world.structures.push(new Structure({ type: 'shelter', x: 10, y: 10 }));
  world.structures.push(new Structure({ type: 'shelter', x: 1, y: 1 }));

  const nearest = findNearestStructure(world, { x: 0, y: 0 }, 'shelter');
  assert.deepEqual(nearest.position, { x: 1, y: 1 });

  assert.ok(isNearStructureType(world, { x: 0, y: 0 }, 'shelter', 3));
  assert.ok(!isNearStructureType(world, { x: 0, y: 0 }, 'shelter', 0));
});

test('ตัวละครสร้างที่พักอัตโนมัติเมื่อเก็บไม้ครบสูตร (ผ่าน utility-ai)', () => {
  const world = makeControlledWorld(4, 4);
  world.grid.getCell(0, 0).resourceNode = new ResourceNode(RESOURCE_TYPES.WOOD, {
    amount: 100,
    maxAmount: 100,
    regenRate: 1,
  });
  const character = new Character({ x: 0, y: 0, needs: { hunger: 100, energy: 100, shelter: 5, social: 100 } });

  let built = false;
  for (let i = 0; i < 5 && !built; i++) {
    const behavior = updateCharacter(character, world, [character], 1);
    if (behavior === BEHAVIORS.BUILD_SHELTER) built = true;
  }

  assert.ok(built, 'ควรเลือกพฤติกรรม build_shelter เมื่อไม้ครบสูตร');
  assert.equal(world.structures.length, 1);
  assert.equal(world.structures[0].type, 'shelter');
  assert.equal(character.inventory.wood, 0); // เก็บได้พอดี 10 แล้วหักหมดตอนสร้าง
});

test('rest ฟื้นพลังงานเร็วขึ้นเมื่ออยู่ใกล้ที่พัก เทียบกับพักเฉยๆ', () => {
  const worldNoShelter = makeControlledWorld(10, 10);
  const characterAlone = new Character({ x: 5, y: 5, needs: { hunger: 90, energy: 10, shelter: 90, social: 90 } });
  updateCharacter(characterAlone, worldNoShelter, [characterAlone], 1);
  const recoveryWithoutShelter = characterAlone.needs.energy;

  const worldWithShelter = makeControlledWorld(10, 10);
  worldWithShelter.structures.push(new Structure({ type: 'shelter', x: 5, y: 5 }));
  const characterNearShelter = new Character({ x: 5, y: 5, needs: { hunger: 90, energy: 10, shelter: 90, social: 90 } });
  updateCharacter(characterNearShelter, worldWithShelter, [characterNearShelter], 1);
  const recoveryWithShelter = characterNearShelter.needs.energy;

  assert.ok(recoveryWithShelter > recoveryWithoutShelter);
});
