import { RESOURCE_TYPES } from '../world/resource-types.js';
import { BEHAVIORS } from '../characters/behaviors.js';

// ตัวระบุอาชีพ (ใช้แทนสตริงตรงๆ กันพิมพ์ผิด) — 4 อาชีพแรกตามทรัพยากรเฟส 1, อาชีพสุดท้ายตามบริการเฟส 7
export const PROFESSIONS = Object.freeze({
  LUMBERJACK: 'lumberjack',
  WATER_CARRIER: 'water_carrier',
  MINER: 'miner',
  FARMER: 'farmer',
  FREELANCER: 'freelancer',
});

// ดึงยอดรายได้ที่ควรนับเป็น "รายได้จากอาชีพนี้" จาก trade event จริง (เฟส 7) — ไม่ได้จ่ายเงินเอง แค่รายงาน/
// นับสถิติ เพราะ settlePayment ของเฟส 7 โอนเงินเต็มจำนวนไปแล้วจริงๆ ตอนธุรกรรมเกิดขึ้น (ธุรกรรมแบบ barter
// ไม่มีเงินจึงนับเป็น 0 เสมอ) ทุกอาชีพในเฟสนี้ใช้สูตรเดียวกัน แต่ประกาศเป็น field แยกต่ออาชีพเพื่อให้อาชีพ
// ใหม่ในอนาคตปรับสูตรเฉพาะของตัวเองได้โดยไม่กระทบอาชีพอื่น (เหมือน apply() ของกฎหมายในเฟส 8)
function defaultComputeIncome(deal) {
  return deal.type === 'xcoin' ? deal.price : 0;
}

// นิยาม shape กลางของ "อาชีพ" 1 อาชีพ — plain object ธรรมดา ไม่มี state ของตัวเอง (state ของแต่ละตัวละคร
// เก็บเป็น character.profession/professionSinceTick แทน คล้ายกับที่เฟส 4 ทำกับ homeSettlementId)
//
// {
//   id: string,
//   name: string,
//   resourceType: string | null,    // ทรัพยากรที่เกี่ยวข้อง (จาก RESOURCE_TYPES) หรือ null ถ้าเป็นอาชีพบริการ
//   trackedBehavior: string | null,  // ค่าคงที่จาก BEHAVIORS ที่นับเป็น "ทำอาชีพนี้อยู่" หรือ null ถ้า
//                                       สังเกตจากเหตุการณ์อื่นแทน (เช่น freelancer สังเกตจาก trade event)
//   computeIncome(deal): number,      // ดึงยอดรายได้จริงจาก trade event มานับเป็นรายได้อาชีพนี้
// }
//
// หมายเหตุสำคัญ: เฟส 1-2 มีแค่พฤติกรรมเก็บ "ไม้" (gather_wood) กับ "อาหาร" (seek_food) จริงๆ ยังไม่มี
// พฤติกรรมเก็บ "น้ำ"/"แร่" เลย (ดู src/characters/behaviors.js) จึงยังไม่มีทางที่ตัวละครจะได้อาชีพ
// water_carrier/miner จากการเล่นจริงในตอนนี้ (trackedBehavior เป็น null) — ยังคงประกาศไว้ครบ 4 อาชีพตาม
// ทรัพยากรตามสเปก เผื่อเฟสหลังเพิ่มพฤติกรรมเก็บน้ำ/แร่จริงๆ ค่อยผูก trackedBehavior ทีหลังโดยไม่ต้องแก้
// โครงสร้างนี้ใหม่ (ดูเหตุผลเต็มใน README)
export const PROFESSION_REGISTRY = Object.freeze([
  {
    id: PROFESSIONS.LUMBERJACK,
    name: 'คนตัดไม้',
    resourceType: RESOURCE_TYPES.WOOD,
    trackedBehavior: BEHAVIORS.GATHER_WOOD,
    computeIncome: defaultComputeIncome,
  },
  {
    id: PROFESSIONS.WATER_CARRIER,
    name: 'คนหาน้ำ',
    resourceType: RESOURCE_TYPES.WATER,
    trackedBehavior: null,
    computeIncome: defaultComputeIncome,
  },
  {
    id: PROFESSIONS.MINER,
    name: 'คนขุดแร่',
    resourceType: RESOURCE_TYPES.ORE,
    trackedBehavior: null,
    computeIncome: defaultComputeIncome,
  },
  {
    id: PROFESSIONS.FARMER,
    name: 'คนทำฟาร์ม',
    resourceType: RESOURCE_TYPES.FOOD,
    trackedBehavior: BEHAVIORS.SEEK_FOOD,
    computeIncome: defaultComputeIncome,
  },
  {
    id: PROFESSIONS.FREELANCER,
    name: 'คนรับจ้าง',
    resourceType: null,
    trackedBehavior: null, // สังเกตจาก trade event (เป็น helper ในธุรกรรมบริการเฟส 7) ไม่ใช่ currentBehavior
    computeIncome: defaultComputeIncome,
  },
]);

export function getProfessionById(id) {
  return PROFESSION_REGISTRY.find((p) => p.id === id) ?? null;
}

export function getProfessionByBehavior(behavior) {
  if (!behavior) return null;
  return PROFESSION_REGISTRY.find((p) => p.trackedBehavior === behavior) ?? null;
}
