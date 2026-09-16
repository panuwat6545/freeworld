import { NEEDS_CONFIG, NEED_PRIORITY, NEED_MIN, NEED_MAX } from './needs-config.js';
import { createWallet } from '../economy/wallet.js';

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
    // เฟส 6 (สกุลเงิน xcoin): ทุกตัวละครมี wallet เริ่มต้นด้วย STARTING_BALANCE เท่ากันหมด รวมถึงตัวละคร
    // ที่เกิดใหม่จากเฟส 4 ด้วย (ไม่แยกกรณีให้ซับซ้อนเกินจำเป็น — ดูเหตุผลใน README)
    this.wallet = createWallet();
    // เฟส 4 (ระบบสังคม/ถิ่นฐาน): ถิ่นฐานที่ตัวละครนี้ถือว่าเป็น "บ้าน" กับ tick ที่เริ่มเป็นแบบนั้น
    // อัปเดตอัตโนมัติโดย src/society/home-tracker.js ไม่ได้ตั้งค่าตรงนี้ตอนสร้างตัวละคร
    this.homeSettlementId = null;
    this.homeSettlementSinceTick = null;
    // tick ที่ตัวละครนี้ "เกิด" — ตัวละครที่สร้างตรงๆ ตอนเริ่มโลก (ไม่ได้เกิดจาก reproduction.js)
    // ถือว่าเกิดที่ tick 0 (มีมาตั้งแต่ต้น) ตัวละครที่เกิดจาก reproduction.js จะถูกตั้งค่านี้ทับเป็น tick จริง
    // ที่เกิด เพื่อให้ reproduction.js เช็คอายุขั้นต่ำก่อนอนุญาตให้มีลูกได้ (กันลูกที่เพิ่งเกิดจับคู่กับ
    // พ่อ/แม่ตัวเองทันทีเพราะ needs เต็ม 100 อยู่ติดกัน จนเกิดลูกวนไม่หยุดทั้งที่มี cooldown ต่อคู่แล้ว)
    this.bornAtTick = 0;
    // เฟส 9 (อาชีพที่เกิดเอง): อาชีพปัจจุบัน (null = ยังไม่มีอาชีพชัดเจน) กับ tick ที่เริ่มเป็นอาชีพนี้
    // อัปเดตอัตโนมัติโดย src/professions/profession-assignment.js ไม่ได้ตั้งค่าตรงนี้ตอนสร้างตัวละคร
    this.profession = null;
    this.professionSinceTick = null;
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
