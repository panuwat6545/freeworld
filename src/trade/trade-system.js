import { tryTradeWood } from './goods-trade.js';
import { tryHireGatherWood, tryHireEnergyHelp } from './service-trade.js';

// จุดรวมของระบบแลกเปลี่ยน (เฟส 7) — สแกนทุกคู่ตัวละครทุก tick ลองทำธุรกรรมตามลำดับ (ซื้อขายไม้ ->
// จ้างเก็บไม้แทน -> จ้างช่วยพัก) แต่ละตัวละครทำธุรกรรมได้อย่างมากครั้งเดียวต่อ tick (กันสับสน/ธุรกรรม
// ซ้อนกันเกินจำเป็นในรอบเดียว) เรียก update() ทุก tick หลัง world.update() + updateCharacter() ของทุก
// ตัวละครเสร็จแล้ว ต้องมี cumulativeIndex จาก InflationTracker (เฟส 6) เพื่อคำนวณราคา
//
// หมายเหตุการ tune: ตอนพัฒนาเคยลองเพิ่ม cooldown ต่อคู่สำหรับบริการ (กันคู่เดิมจ้างกันซ้ำถี่) แต่พอรันจริง
// 30 ปีด้วย scripts/long-run.js กลับทำให้ flag "AI มีปัญหา" แย่ลง (cooldown เปลี่ยนจังหวะว่าใครได้ทำ
// ธุรกรรมในแต่ละ tick ซึ่งไปกระทบจังหวะการหาอาหารของตัวละครบางตัวโดยไม่ตั้งใจ) รากปัญหาจริงๆ อยู่ที่
// เงื่อนไข hunger safety ใน trade-eligibility.js (canTransact) ต่างหาก จึงตัดกลไก cooldown ออก เหลือแค่
// เงื่อนไข canTransact ที่พิสูจน์แล้วว่าเพียงพอ — รายละเอียดเต็มอยู่ใน README หัวข้อเฟส 7
export class TradeSystem {
  constructor() {
    // เก็บแค่ตัวนับสะสม ไม่เก็บ log ธุรกรรมทั้งหมด กันหน่วยความจำบวมตอนรันจำลองยาวๆ (30 ปี)
    this.totalXcoinTransactions = 0;
    this.totalBarterTransactions = 0;
  }

  // คืนค่ารายการธุรกรรมที่เกิดขึ้นใน tick นี้เท่านั้น (ไว้ให้ demo แสดงรายละเอียดได้)
  update(world, characters, cumulativeIndex) {
    const transactedThisTick = new Set(); // characterId ที่ทำธุรกรรมไปแล้วในรอบนี้
    const events = [];

    for (let i = 0; i < characters.length; i++) {
      const buyer = characters[i];
      if (transactedThisTick.has(buyer.id)) continue;

      for (let j = 0; j < characters.length; j++) {
        if (i === j) continue;
        const counterpart = characters[j];
        if (transactedThisTick.has(buyer.id) || transactedThisTick.has(counterpart.id)) continue;

        const deal =
          tryTradeWood(buyer, counterpart, cumulativeIndex) ??
          tryHireGatherWood(buyer, counterpart, world, cumulativeIndex) ??
          tryHireEnergyHelp(buyer, counterpart, cumulativeIndex);

        if (!deal) continue;

        events.push(deal);
        transactedThisTick.add(buyer.id);
        transactedThisTick.add(counterpart.id);
        if (deal.type === 'xcoin') this.totalXcoinTransactions += 1;
        else this.totalBarterTransactions += 1;
      }
    }

    return events;
  }
}
