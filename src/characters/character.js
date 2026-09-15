import { NEEDS_CONFIG, NEED_PRIORITY, NEED_MIN, NEED_MAX } from './needs-config.js';

let nextCharacterId = 1;

function clampNeed(value) {
  return Math.max(NEED_MIN, Math.min(NEED_MAX, value));
}

// ตัวละคร 1 ตัวในโลก: มีตำแหน่งบน grid, ค่าความต้องการ (needs) และของสะสม (inventory)
export class Character {
  constructor({ x = 0, y = 0, needs = {} } = {}) {
    this.id = nextCharacterId++;
    this.position = { x, y };
    this.needs = {
      hunger: clampNeed(needs.hunger ?? NEED_MAX),
      energy: clampNeed(needs.energy ?? NEED_MAX),
      shelter: clampNeed(needs.shelter ?? NEED_MAX),
      social: clampNeed(needs.social ?? NEED_MAX),
    };
    this.inventory = { wood: 0 };
    this.currentBehavior = null;
  }

  // ลด needs ทุกตัวตามอัตรา decay คูณจำนวน tick ที่ผ่านไป ไม่ต่ำกว่า 0
  decayNeeds(deltaTicks = 1) {
    for (const key of NEED_PRIORITY) {
      this.needs[key] = clampNeed(this.needs[key] - NEEDS_CONFIG.DECAY_RATE[key] * deltaTicks);
    }
  }
}

export function clampNeedValue(value) {
  return clampNeed(value);
}
