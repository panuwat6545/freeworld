import { RESOURCE_TYPES } from '../world/resource-types.js';
import { NEEDS_CONFIG } from './needs-config.js';
import { clampNeedValue } from './character.js';
import { stepToward, isAdjacentOrSame } from './movement.js';
import { findNearestResourceCell, findNearestCharacter } from './target-finder.js';

export const BEHAVIORS = Object.freeze({
  SEEK_FOOD: 'seek_food',
  REST: 'rest',
  GATHER_WOOD: 'gather_wood',
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

// energy ต่ำ -> หยุดพัก ฟื้นพลังงานบางส่วน (ยังไม่มีที่พักจริงจนกว่าจะถึงเฟส 3)
function rest(character) {
  character.needs.energy = clampNeedValue(character.needs.energy + NEEDS_CONFIG.ENERGY_REST_RECOVERY);
}

// shelter ต่ำ -> เดินไปเก็บไม้สะสมไว้เป็น placeholder สำหรับระบบสร้างสิ่งปลูกสร้างในเฟส 3
// หมายเหตุ: การเก็บไม้ในเฟสนี้ยังไม่ทำให้ค่า shelter ฟื้นกลับ เพราะยังไม่มีสิ่งปลูกสร้างจริงให้ "อยู่อาศัย"
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
  [BEHAVIORS.SOCIALIZE]: socialize,
});

export function runBehavior(behaviorName, character, world, allCharacters) {
  const handler = BEHAVIOR_HANDLERS[behaviorName];
  if (handler) handler(character, world, allCharacters);
}
