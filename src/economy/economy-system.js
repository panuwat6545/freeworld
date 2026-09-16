import { InflationTracker } from './inflation.js';
import { BasicIncomeGenerator } from './basic-income.js';

// จุดรวมของระบบเศรษฐกิจ xcoin (เฟส 6) — ใช้ตัวเดียวนี้แทนการเรียก inflation/basicIncome แยกกัน
// เรียก update() ทุก tick หลัง world.update() (ลำดับก่อน/หลังกับ SocietySystem ไม่สำคัญ เพราะคนละระบบ
// ไม่มีจุดพึ่งพากันโดยตรงในตอนนี้ — เฟส 8/9 ในอนาคตอาจต้องผูกลำดับกันเพิ่ม)
export class EconomySystem {
  constructor({ inflation, basicIncome } = {}) {
    this.inflation = inflation ?? new InflationTracker();
    this.basicIncome = basicIncome ?? new BasicIncomeGenerator();
  }

  // คืนค่า { inflationEvent, incomeEvent } ทั้งคู่เป็น null ถ้ายังไม่ครบปีใหม่ (เช็คปีแยกกันแต่ควรครบ
  // พร้อมกันเสมอเพราะใช้ ticksPerYear เดียวกันโดย default)
  update(world, characters) {
    const inflationEvent = this.inflation.checkAndApply(world);
    const incomeEvent = this.basicIncome.checkAndPay(world, characters);
    return { inflationEvent, incomeEvent };
  }
}
