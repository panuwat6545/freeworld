import { InflationTracker } from './inflation.js';

// จุดรวมของระบบเศรษฐกิจ xcoin (เฟส 6) — ใช้ตัวเดียวนี้แทนการเรียก inflation แยก
// เรียก update() ทุก tick หลัง world.update() (ลำดับก่อน/หลังกับ SocietySystem ไม่สำคัญ เพราะคนละระบบ
// ไม่มีจุดพึ่งพากันโดยตรงในตอนนี้)
//
// เฟส 9 (อาชีพที่เกิดเอง) เอา BasicIncomeGenerator (placeholder ของเฟสนี้) ออกไปแล้ว — รายได้จริงตอนนี้มา
// จาก src/professions/income-generation.js แทน (ประกาศแยกโมดูลเพราะผูกกับ character.profession ซึ่งเป็น
// concept ของเฟส 9 ไม่ใช่ของเฟส 6)
export class EconomySystem {
  constructor({ inflation } = {}) {
    this.inflation = inflation ?? new InflationTracker();
  }

  // คืนค่า { inflationEvent } เป็น null ถ้ายังไม่ครบปีใหม่
  update(world) {
    const inflationEvent = this.inflation.checkAndApply(world);
    return { inflationEvent };
  }
}
