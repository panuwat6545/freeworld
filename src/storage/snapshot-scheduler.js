import { saveSnapshot } from './save-snapshot.js';

// 1 tick = 1 วันในเกม, 365 tick = 1 ปีในเกม (ตั้งค่าเองได้ผ่าน options.ticksPerYear)
export const DEFAULT_TICKS_PER_YEAR = 365;

// คอยเช็คทุก tick ว่าเวลาในเกมผ่านไปครบ 1 ปีใหม่หรือยัง ถ้าครบจะเรียก saveSnapshot ให้อัตโนมัติ
// ผูกกับ world.tick ที่มีอยู่แล้ว ไม่ต้องแก้ World class
export class SnapshotScheduler {
  constructor({ ticksPerYear = DEFAULT_TICKS_PER_YEAR, saveSnapshotFn = saveSnapshot } = {}) {
    this.ticksPerYear = ticksPerYear;
    this.saveSnapshotFn = saveSnapshotFn;
    this.lastSavedYear = 0;
  }

  // เรียกทุก tick (เช่นหลัง world.update() ในแต่ละรอบ) จะไม่ทำอะไรถ้ายังไม่ครบปีใหม่
  async checkAndSave(world, characters, deps) {
    const currentYear = Math.floor(world.tick / this.ticksPerYear);
    if (currentYear <= this.lastSavedYear) return null;

    this.lastSavedYear = currentYear;
    return this.saveSnapshotFn(world, characters, currentYear, deps);
  }
}
