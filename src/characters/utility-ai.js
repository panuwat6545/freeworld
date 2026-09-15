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

// รันหนึ่ง tick ให้ตัวละครตัวเดียว: ลด needs ก่อน แล้วเลือก+ทำพฤติกรรมที่เร่งด่วนที่สุดโดยอัตโนมัติ
export function updateCharacter(character, world, allCharacters, deltaTicks = 1) {
  character.decayNeeds(deltaTicks);
  const behavior = decideBehavior(character.needs);
  character.currentBehavior = behavior;
  runBehavior(behavior, character, world, allCharacters);
  return behavior;
}
