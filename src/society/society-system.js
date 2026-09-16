import { SettlementDetector } from './settlement-detector.js';
import { HomeSettlementTracker } from './home-tracker.js';
import { computeAllLeaders } from './leadership.js';
import { ReproductionSystem } from './reproduction.js';

// จุดรวมของระบบสังคม/ถิ่นฐาน (เฟส 4) — ใช้ตัวเดียวนี้แทนการเรียก detector/tracker/reproduction แยกๆ
// เรียก update() ทุก tick หลัง world.update() และ updateCharacter() ของทุกตัวละครในรอบนั้นเสร็จแล้ว
export class SocietySystem {
  constructor({ detector, homeTracker, reproduction } = {}) {
    this.detector = detector ?? new SettlementDetector();
    this.homeTracker = homeTracker ?? new HomeSettlementTracker();
    this.reproduction = reproduction ?? new ReproductionSystem();
  }

  // characters ถูกแก้ไข in-place ได้ (อาจมีตัวละครใหม่ถูก push เข้ามาจากการขยายเผ่าพันธุ์)
  // คืนค่ารายการถิ่นฐานปัจจุบันทั้งหมด
  update(world, characters, tick) {
    const settlements = this.detector.detect(world, characters, tick);

    this.homeTracker.update({
      characters,
      world,
      settlements,
      structureToSettlementId: this.detector.structureToSettlementId,
      tick,
    });

    if (this.detector.justRecomputed) {
      computeAllLeaders(settlements, characters, world.structures);
    }

    this.reproduction.update({ characters, settlements, tick });

    return settlements;
  }
}
