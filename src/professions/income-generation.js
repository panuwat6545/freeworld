import { deposit } from '../economy/wallet.js';
import { getProfessionById } from './profession.js';
import { DEFAULT_TICKS_PER_YEAR } from '../storage/snapshot-scheduler.js';

// ช่วง "เงินเดือนขั้นต่ำ" เต็มจำนวนสำหรับตัวละครที่ยังไม่มีอาชีพชัดเจน (เท่ากับ BASIC_INCOME_MIN/MAX เดิม
// ของเฟส 6 เป๊ะ — ตัวละครกลุ่มนี้ยังไม่ได้เลือกเส้นทางอาชีพเองด้วยซ้ำ จึงยังสมควรได้รับความคุ้มครองเท่าเดิม
// ทุกประการ ตามสเปกข้อ "เพื่อไม่ให้อดตายก่อนมีอาชีพ")
const FULL_STIPEND_MIN = 5;
const FULL_STIPEND_MAX = 20;

// สัดส่วนของเงินเดือนขั้นต่ำเต็มจำนวนที่ตัวละครซึ่ง "มีอาชีพแล้ว" ยังคงได้รับต่อไปทุกปี (ไม่ใช่ศูนย์เป๊ะ
// ตามที่สเปกอนุญาตให้ตัดสินใจเอง) — ค่านี้มาจากการ tune จริงด้วย scripts/long-run.js 30 ปีตามข้อบังคับ
// ของทุกเฟส ไม่ใช่เดาเอา: ตัดเหลือ 0% (ไม่จ่ายเลย) หรือลดเหลือ 20-50% ทำให้เกิด flag "AI มีปัญหา" ใหม่ที่
// ไม่เคยมีมาก่อนในเฟส 8 (วินิจฉัยแล้วไม่ใช่เพราะอดตายโดยตรง — งานหาอาหาร/ที่พักไม่ใช้เงินเลย — แต่เพราะยอด
// xcoin หมุนเวียนที่ลดฮวบทำให้สัดส่วนธุรกรรม xcoin/barter ของเฟส 7 เปลี่ยนไปมากพอจะไปสั่นคลอนค่า social
// need ผ่านกลไก SOCIAL_BARTER_BONUS ตอน barter ซึ่งไปกระทบจังหวะการเลือกพฤติกรรมของ Utility AI เดิมของ
// เฟส 2 แบบไม่ตั้งใจ (ระบบนี้ไวต่อยอดเงินหมุนเวียนรวมมากกว่าที่คาดไว้) ทดสอบเป็นขั้นๆ ตั้งแต่ 20% ถึง 100%
// พบว่าช่วง 55-70% ไม่เกิด flag เลยตลอด 30 ปี (นอกช่วงนี้ทั้งสูงและต่ำกว่ากลับเกิด flag แบบไม่เป็นเชิงเส้น
// เพราะเป็นระบบ deterministic ที่อ่อนไหวสูงกับเงื่อนไขเริ่มต้น ไม่ใช่ threshold เดียวตรงไปตรงมา) จึงเลือก
// 60% เป็นค่ากึ่งกลางของช่วงที่ปลอดภัยจริง เผื่อระยะห่างทั้งสองด้าน — รายได้หลักของคนมีอาชีพยังคงตั้งใจให้
// มาจากธุรกรรมจริงตามอาชีพเป็นด้านหลัก (ProfessionIncomeTracker ด้านล่าง เช่น คนทำฟาร์มได้รายได้จริงสะสม
// ~2,868 xcoin ใน 30 ปีจากการรันจริง มากกว่าเงินสวัสดิการนี้หลายเท่า) เงินสวัสดิการนี้เป็นแค่ตาข่ายรองรับ
// ความเสี่ยงเชิงเสถียรภาพ ไม่ใช่แหล่งรายได้หลัก — ดูรายละเอียดการวินิจฉัยเต็มใน README หัวข้อเฟส 9
const EMPLOYED_STIPEND_FRACTION = 0.6;

// แทนที่ BasicIncomeGenerator (placeholder ของเฟส 6) ตามสเปกเฟส 9: ตัวละครที่มีอาชีพแล้วรายได้หลักคือ
// รายได้จริงจากธุรกรรมเฟส 7 ตามอาชีพที่ทำอยู่ (ดู ProfessionIncomeTracker ด้านล่าง) ไม่ใช่เงินเดือนเต็ม
// จำนวนแบบเดิมอีกต่อไป — ตัวละครที่ยังไม่มีอาชีพชัดเจน (เพิ่งเกิด/พฤติกรรมยังไม่คงที่พอให้
// ProfessionAssignmentTracker ตัดสินอาชีพได้) ยังได้รับเงินเดือนขั้นต่ำเต็มจำนวนต่อไปเพื่อไม่ให้อดตาย
// ทางเศรษฐกิจในช่วงเปลี่ยนผ่าน ส่วนตัวละครที่มีอาชีพแล้วยังได้รับเศษเสี้ยวหนึ่ง (EMPLOYED_STIPEND_FRACTION)
// ของเต็มจำนวนต่อไปด้วยเพื่อความเสถียรของระบบ (ไม่ใช่ศูนย์เป๊ะ) — ดูเหตุผลที่ไม่ตัดเหลือศูนย์เป๊ะเต็มๆ
// ใน README หัวข้อเฟส 9
export class IncomeSupportGenerator {
  constructor({ ticksPerYear = DEFAULT_TICKS_PER_YEAR, randomFn = Math.random } = {}) {
    this.ticksPerYear = ticksPerYear;
    this.randomFn = randomFn;
    this.lastProcessedYear = 0;
  }

  // เรียกทุก tick จะจ่ายเงินเดือนให้ทุกตัวละครทุกครั้งที่ครบ 1 ปีเกม (เต็มจำนวนสำหรับคนยังไม่มีอาชีพ,
  // เศษเสี้ยว EMPLOYED_STIPEND_FRACTION สำหรับคนมีอาชีพแล้ว) คืนค่า { year, paidCount, totalPaid }
  // เมื่อครบปีใหม่ หรือ null ถ้ายังไม่ครบ
  checkAndPay(world, characters) {
    const currentYear = Math.floor(world.tick / this.ticksPerYear);
    if (currentYear <= this.lastProcessedYear) return null;

    this.lastProcessedYear = currentYear;
    let totalPaid = 0;
    let paidCount = 0;

    for (const character of characters) {
      const fullAmount = FULL_STIPEND_MIN + this.randomFn() * (FULL_STIPEND_MAX - FULL_STIPEND_MIN);
      const amount = character.profession === null ? fullAmount : fullAmount * EMPLOYED_STIPEND_FRACTION;
      deposit(character.wallet, amount);
      totalPaid += amount;
      paidCount += 1;
    }

    return { year: currentYear, paidCount, totalPaid };
  }
}

// ติดตามยอดรายได้สะสมแยกตามอาชีพ — ไม่ได้จ่ายเงินเอง (settlePayment ของเฟส 7 โอนเงินจริงไปแล้วตอนธุรกรรม
// เกิดขึ้น) แค่สังเกต event ที่ TradeSystem.update() คืนมาแล้วนับว่าควรถือเป็น "รายได้จากอาชีพไหน" ตาม
// computeIncome ของอาชีพนั้นๆ ไว้ให้ demo/long-run รายงานสถิติ
export class ProfessionIncomeTracker {
  constructor() {
    this.totalIncomeByProfessionId = new Map();
  }

  observeTradeEvents(tradeEvents, characters) {
    for (const deal of tradeEvents) {
      const recipientId = deal.sellerId ?? deal.helperId;
      const recipient = characters.find((c) => c.id === recipientId);
      if (!recipient || recipient.profession === null) continue;

      const profession = getProfessionById(recipient.profession);
      if (!profession) continue;

      const income = profession.computeIncome(deal);
      if (income > 0) {
        this.totalIncomeByProfessionId.set(
          profession.id,
          (this.totalIncomeByProfessionId.get(profession.id) ?? 0) + income,
        );
      }
    }
  }

  getTotalIncome(professionId) {
    return this.totalIncomeByProfessionId.get(professionId) ?? 0;
  }
}
