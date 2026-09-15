import { RESOURCE_TYPES } from '../world/resource-types.js';
import { BLUEPRINTS } from '../building/blueprints.js';
import { build } from '../building/crafting.js';
import { isNearStructureType } from '../building/structure-finder.js';
import { NEEDS_CONFIG } from './needs-config.js';
import { clampNeedValue } from './character.js';
import { stepToward, isAdjacentOrSame } from './movement.js';
import { findNearestResourceCell, findNearestCharacter } from './target-finder.js';

export const BEHAVIORS = Object.freeze({
  SEEK_FOOD: 'seek_food',
  REST: 'rest',
  GATHER_WOOD: 'gather_wood',
  BUILD_SHELTER: 'build_shelter',
  SOCIALIZE: 'socialize',
});

// hunger ต่ำ -> เดินไปยังจุดอาหารที่ใกล้ที่สุดแล้วเก็บกิน
function seekFood(character, world) {
  const targetCell = findNearestResourceCell(world, character.position, RESOURCE_TYPES.FOOD);
  if (!targetCell) return; // ไม่มีอาหารเหลือในโลกเลย ณ ตอนนี้ ทำอะไรไม่ได้ นอกจากรอ

  if (character.position.x === targetCell.x && character.position.y === targetCell.y) {
    const harvested = world.harvestAt(targetCell.x, targetCell.y, NEEDS_CONFIG.FOOD_HARVEST_QUANTITY);
    character.needs.hunger = clampNeedValue(character.needs.hunger + harvested * NEEDS_CONFIG.HUNGER_PER_FOOD_UNIT);
  } else {
    character.position = stepToward(character.position, targetCell);
  }
}

// energy ต่ำ -> หยุดพัก ฟื้นพลังงานบางส่วน ถ้าอยู่ใกล้ "ที่พัก" ที่สร้างไว้แล้วจะฟื้นเร็วขึ้น
function rest(character, world) {
  const shelterBlueprint = BLUEPRINTS.shelter;
  const nearShelter = isNearStructureType(
    world,
    character.position,
    shelterBlueprint.id,
    shelterBlueprint.effects.nearbyRadius,
  );
  const recovery = NEEDS_CONFIG.ENERGY_REST_RECOVERY + (nearShelter ? shelterBlueprint.effects.restRecoveryBonus : 0);
  character.needs.energy = clampNeedValue(character.needs.energy + recovery);
}

// shelter ต่ำ (และยังเก็บทรัพยากรไม่ครบสูตรที่พัก) -> เดินไปเก็บไม้สะสมไว้ใน inventory
function gatherWood(character, world) {
  const targetCell = findNearestResourceCell(world, character.position, RESOURCE_TYPES.WOOD);
  if (!targetCell) return;

  if (character.position.x === targetCell.x && character.position.y === targetCell.y) {
    const harvested = world.harvestAt(targetCell.x, targetCell.y, NEEDS_CONFIG.WOOD_HARVEST_QUANTITY);
    character.inventory.wood += harvested;
  } else {
    character.position = stepToward(character.position, targetCell);
  }
}

// shelter ต่ำ (และเก็บทรัพยากรครบสูตรที่พักแล้ว) -> สร้างที่พักลงบน grid ที่ตำแหน่งปัจจุบัน แล้วหักทรัพยากรออกจาก inventory
function buildShelter(character, world) {
  build(character, world, BLUEPRINTS.shelter.id);
}

// social ต่ำ -> เดินเข้าใกล้ตัวละครอื่นที่ใกล้ที่สุด แล้วปฏิสัมพันธ์เมื่ออยู่ติดกัน
function socialize(character, world, allCharacters) {
  const target = findNearestCharacter(character, allCharacters);
  if (!target) return; // อยู่คนเดียวในโลก ไม่มีใครให้เข้าหา

  if (isAdjacentOrSame(character.position, target.position)) {
    character.needs.social = clampNeedValue(character.needs.social + NEEDS_CONFIG.SOCIAL_GAIN_PER_TICK);
  } else {
    character.position = stepToward(character.position, target.position);
  }
}

export const BEHAVIOR_HANDLERS = Object.freeze({
  [BEHAVIORS.SEEK_FOOD]: seekFood,
  [BEHAVIORS.REST]: rest,
  [BEHAVIORS.GATHER_WOOD]: gatherWood,
  [BEHAVIORS.BUILD_SHELTER]: buildShelter,
  [BEHAVIORS.SOCIALIZE]: socialize,
});

export function runBehavior(behaviorName, character, world, allCharacters) {
  const handler = BEHAVIOR_HANDLERS[behaviorName];
  if (handler) handler(character, world, allCharacters);
}
