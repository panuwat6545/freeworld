import { getSettlementAverageBalance } from '../economy/settlement-economy.js';
import { ECONOMY_CONFIG } from '../economy/economy-config.js';
import { SOCIAL_CONDITIONS_CONFIG } from './social-conditions-config.js';

// ดัชนีความฝืดเคือง (economic hardship): เทียบยอด wallet เฉลี่ยของถิ่นฐาน (จาก settlement-economy.js
// ของเฟส 6 — ไม่สร้างข้อมูลใหม่) กับ "ยอดที่ควรจะเป็น" ถ้ารายได้โตทันเงินเฟ้อพอดี (STARTING_BALANCE ของ
// เฟส 6 คูณดัชนีราคาสะสมปัจจุบันจาก InflationTracker) ดัชนี > 1 แปลว่าฝืดเคือง (เงินจริงโตไม่ทันเงินเฟ้อ)
// ดัชนี < 1 แปลว่าสบาย (รายได้จริงโตเร็วกว่าเงินเฟ้อ) ดัชนี = 1 พอดีคือ "ปกติ" ถิ่นฐานที่ไม่มีสมาชิกเลย
// ถือว่าปกติ (ไม่มีข้อมูลให้ประเมิน จึงคืนค่า neutral point ตรงๆ)
export function computeEconomicHardshipIndex(settlement, characters, cumulativeIndex) {
  const averageBalance = getSettlementAverageBalance(settlement, characters);
  if (averageBalance <= 0) return SOCIAL_CONDITIONS_CONFIG.HARDSHIP_NEUTRAL_POINT;

  const expectedBalance = ECONOMY_CONFIG.STARTING_BALANCE * cumulativeIndex;
  return expectedBalance / averageBalance;
}

// ดัชนีความเหลื่อมล้ำ (inequality): coefficient of variation (stddev/mean) ของ wallet balance สมาชิก
// ในถิ่นฐาน — ใช้ CV แทน variance ดิบเพราะยอดเงินรวมโตตามอายุโลก แต่ความเหลื่อมล้ำเชิงสัดส่วนอาจไม่เปลี่ยน
// เลย (ดูเหตุผลเต็มใน social-conditions-config.js/README) ถิ่นฐานที่มีสมาชิกน้อยกว่า 2 คนวัดความเหลื่อมล้ำ
// ไม่ได้จริงๆ (ต้องมีอย่างน้อย 2 ค่าถึงจะมีความแปรปรวน) ถือว่าเป็น 0 (ปกติ)
export function computeInequalityIndex(settlement, characters) {
  const members = characters.filter((c) => settlement.memberIds.includes(c.id));
  if (members.length < 2) return 0;

  const balances = members.map((c) => c.wallet.balance);
  const mean = balances.reduce((sum, b) => sum + b, 0) / balances.length;
  if (mean <= 0) return 0;

  const variance = balances.reduce((sum, b) => sum + (b - mean) ** 2, 0) / balances.length;
  return Math.sqrt(variance) / mean;
}

// ดัชนีภาระกฎหมาย (law burden): รวมภาระจากกฎหมายทั้ง 2 ข้อของเฟส 8 (ผ่าน SettlementLawsetRegistry —
// ไม่สร้างข้อมูลใหม่ อ่านสถานะกฎหมายที่เปิดอยู่จริงเท่านั้น) ที่เปิดอยู่จริงในถิ่นฐานนี้เท่านั้น — 0 เป๊ะถ้า
// ไม่มีกฎหมายเปิดอยู่เลยตามสเปก ภาษีการค้ายิ่งอัตราสูงยิ่งหนัก (0-0.5 ตาม paramBounds ของเฟส 8) สิทธิ์
// เขตแดนโหมด block ถือว่าภาระเต็มที่ (คนนอกเก็บทรัพยากรในเขตไม่ได้เลย) โหมด penalty ภาระเป็นสัดส่วนกับ
// confiscationRate แทน (ยังเก็บได้แต่โดนยึดบางส่วน เบากว่า block เสมอเมื่อ confiscationRate < 1)
export function computeLawBurdenIndex(settlement, lawsetRegistry) {
  let burden = 0;

  if (lawsetRegistry.isLawActive(settlement.id, 'trade_tax')) {
    const { rate } = lawsetRegistry.getLawParams(settlement.id, 'trade_tax');
    burden += rate;
  }

  if (lawsetRegistry.isLawActive(settlement.id, 'territorial_access')) {
    const { mode, confiscationRate } = lawsetRegistry.getLawParams(settlement.id, 'territorial_access');
    burden +=
      mode === 'penalty'
        ? confiscationRate * SOCIAL_CONDITIONS_CONFIG.LAW_BURDEN_TERRITORIAL_PENALTY_WEIGHT
        : SOCIAL_CONDITIONS_CONFIG.LAW_BURDEN_TERRITORIAL_BLOCK_WEIGHT;
  }

  return burden;
}

// รวม 3 ดัชนีเข้าด้วยกันเป็นจุดเรียกเดียว — คำนวณสดจากข้อมูลเดิมของเฟส 4/6/8 ทุกครั้ง ไม่เก็บ state ใหม่เลย
// ตามสเปกข้อ 1 ("คำนวณจากข้อมูลที่มีอยู่แล้ว ไม่สร้างข้อมูลใหม่")
export function computeConditionIndices(settlement, characters, cumulativeIndex, lawsetRegistry) {
  return {
    economicHardship: computeEconomicHardshipIndex(settlement, characters, cumulativeIndex),
    inequality: computeInequalityIndex(settlement, characters),
    lawBurden: computeLawBurdenIndex(settlement, lawsetRegistry),
  };
}
