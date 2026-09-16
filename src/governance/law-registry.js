import { tradeTaxLaw } from './trade-tax-law.js';
import { territorialAccessLaw } from './territorial-access-law.js';

// รายการกฎหมายทั้งหมดที่มีในระบบ (เริ่มต้นมีแค่ 2 ข้อตามสเปกเฟส 8)
//
// เพิ่มกฎหมายใหม่ในอนาคต: เขียนไฟล์ใหม่ (เช่น curfew-law.js) ให้ export object ตาม shape ใน law.js
// แล้ว import + เพิ่มเข้า array นี้ที่เดียว — ไม่ต้องแก้ settlement-lawset.js, governance-system.js,
// หรือไฟล์กฎหมายอื่นเลย (ผู้นำจะเลือกเปิดใช้ id ใหม่ได้ทันทีผ่าน settlement-lawset.js ตามปกติ)
export const LAW_REGISTRY = Object.freeze([tradeTaxLaw, territorialAccessLaw]);

export function getLawById(id) {
  return LAW_REGISTRY.find((law) => law.id === id) ?? null;
}
