import { ECONOMY_CONFIG } from './economy-config.js';
import { deposit } from './wallet.js';
import { DEFAULT_TICKS_PER_YEAR } from '../storage/snapshot-scheduler.js';

// PLACEHOLDER ชั่วคราว: เฟส 7 (ระบบแลกเปลี่ยน) และเฟส 9 (อาชีพที่เกิดเอง) ยังไม่ถูกสร้าง จึงยังไม่มี
// "การค้า/ทำงาน" จริงให้ xcoin ไหลเข้าระบบตามสเปกเฟส 6 ข้อ "xcoin เกิดจากการค้า/ทำงาน"
// ไฟล์นี้จำลอง "รายได้พื้นฐาน" สุ่มเล็กน้อยให้ทุกตัวละครทุกปี แทนไปพลางๆ เพื่อให้มีข้อมูล xcoin ไหลเวียน
// จริงสำหรับทดสอบเงินเฟ้อ (inflation.js) ได้ — เมื่อเฟส 9 เสร็จ ควรลบ/ปิดการใช้งานไฟล์นี้แล้วให้รายได้
// มาจากอาชีพจริงแทน
export class BasicIncomeGenerator {
  constructor({ ticksPerYear = DEFAULT_TICKS_PER_YEAR, randomFn = Math.random } = {}) {
    this.ticksPerYear = ticksPerYear;
    this.randomFn = randomFn;
    this.lastProcessedYear = 0;
  }

  // เรียกทุก tick จะจ่ายรายได้พื้นฐานให้ทุกตัวละครทุกครั้งที่ครบ 1 ปีเกม
  // คืนค่า { year, characterCount, totalPaid } เมื่อครบปีใหม่ หรือ null ถ้ายังไม่ครบ
  checkAndPay(world, characters) {
    const currentYear = Math.floor(world.tick / this.ticksPerYear);
    if (currentYear <= this.lastProcessedYear) return null;

    this.lastProcessedYear = currentYear;
    const { BASIC_INCOME_MIN, BASIC_INCOME_MAX } = ECONOMY_CONFIG;
    let totalPaid = 0;

    for (const character of characters) {
      const amount = BASIC_INCOME_MIN + this.randomFn() * (BASIC_INCOME_MAX - BASIC_INCOME_MIN);
      deposit(character.wallet, amount);
      totalPaid += amount;
    }

    return { year: currentYear, characterCount: characters.length, totalPaid };
  }
}
