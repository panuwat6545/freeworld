import { canBuild } from '../building/crafting.js';
import { BLUEPRINTS } from '../building/blueprints.js';
import { NEED_PRIORITY } from './needs-config.js';
import { BEHAVIORS, runBehavior } from './behaviors.js';

// need แต่ละตัวผูกกับพฤติกรรมที่ตอบสนองมันโดยตรง
const NEED_TO_BEHAVIOR = Object.freeze({
  hunger: BEHAVIORS.SEEK_FOOD,
  energy: BEHAVIORS.REST,
  shelter: BEHAVIORS.GATHER_WOOD,
  social: BEHAVIORS.SOCIALIZE,
});

// หา need ที่ "เร่งด่วนที่สุด" คือค่าต่ำสุด ถ้าเท่ากันให้ใช้ลำดับความสำคัญใน NEED_PRIORITY ตัดสิน
export function getMostUrgentNeed(needs) {
  let urgentKey = NEED_PRIORITY[0];
  let lowestValue = needs[urgentKey];

  for (const key of NEED_PRIORITY) {
    if (needs[key] < lowestValue) {
      lowestValue = needs[key];
      urgentKey = key;
    }
  }

  return urgentKey;
}

export function decideBehavior(needs) {
  return NEED_TO_BEHAVIOR[getMostUrgentNeed(needs)];
}

// เหมือน decideBehavior แต่รู้จัก inventory ของตัวละครด้วย: ถ้า need เร่งด่วนที่สุดคือ shelter
// และเก็บทรัพยากรครบสูตรที่พักแล้ว ให้เลือกสร้างที่พักแทนการเดินไปเก็บไม้เพิ่ม
function resolveBehavior(character) {
  const urgentNeed = getMostUrgentNeed(character.needs);
  if (urgentNeed === 'shelter' && canBuild(character, BLUEPRINTS.shelter.id)) {
    return BEHAVIORS.BUILD_SHELTER;
  }
  return NEED_TO_BEHAVIOR[urgentNeed];
}

// รันหนึ่ง tick ให้ตัวละครตัวเดียว: ลด needs ก่อน แล้วเลือก+ทำพฤติกรรมที่เร่งด่วนที่สุดโดยอัตโนมัติ
export function updateCharacter(character, world, allCharacters, deltaTicks = 1) {
  character.decayNeeds(deltaTicks);
  const behavior = resolveBehavior(character);
  character.currentBehavior = behavior;
  runBehavior(behavior, character, world, allCharacters);
  return behavior;
}
