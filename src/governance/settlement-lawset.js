import { getLawById } from './law-registry.js';
import { clampParams } from './law.js';

// เก็บ "ชุดกฎหมาย" ที่ใช้งานอยู่ของแต่ละถิ่นฐาน แยกเป็น registry ต่างหาก ไม่ยัดใส่ Settlement class ของ
// เฟส 4 โดยตรง (เหมือนที่ home-tracker.js เก็บ tally ของตัวเองแยกจาก Character แทนที่จะยัดใส่ Character)
// เพื่อให้ src/society/ ไม่ต้องรู้จักเรื่องกฎหมายเลย — ทุกอย่างเกี่ยวกับกฎหมายอยู่ใน src/governance/ ที่เดียว
//
// key ด้วย settlement.id (ไม่ใช่ตัว object) จึงอยู่รอดข้ามการเปลี่ยนผู้นำได้ตามสเปก (leaderId เปลี่ยนแต่
// lawset ของถิ่นฐานเดิมไม่ถูกแตะเลย เพราะไม่มีอะไรผูกกับ leaderId ไว้ตั้งแต่แรก)
export class SettlementLawsetRegistry {
  constructor() {
    this.lawsetBySettlementId = new Map(); // settlementId -> { activeLawIds: [], paramsByLawId: {} }
  }

  _getOrCreate(settlementId) {
    if (!this.lawsetBySettlementId.has(settlementId)) {
      this.lawsetBySettlementId.set(settlementId, { activeLawIds: [], paramsByLawId: {} });
    }
    return this.lawsetBySettlementId.get(settlementId);
  }

  // มีแค่ผู้นำถิ่นฐาน (settlement.leaderId) เท่านั้นที่เปิด/ปิด/ปรับกฎหมายได้ตามสเปก — ตรวจสิทธิ์ตรงนี้
  // ที่เดียว ให้ enable/disable/updateParams เรียกใช้ร่วมกัน
  _requireLeader(settlement, actingCharacterId) {
    if (settlement.leaderId === null || actingCharacterId !== settlement.leaderId) {
      return { success: false, reason: 'มีแค่ผู้นำถิ่นฐานเท่านั้นที่จัดการกฎหมายได้' };
    }
    return null;
  }

  enableLaw(settlement, actingCharacterId, lawId, params = {}) {
    const authError = this._requireLeader(settlement, actingCharacterId);
    if (authError) return authError;

    const law = getLawById(lawId);
    if (!law) return { success: false, reason: `ไม่พบกฎหมาย id="${lawId}"` };

    const lawset = this._getOrCreate(settlement.id);
    if (!lawset.activeLawIds.includes(lawId)) lawset.activeLawIds.push(lawId);
    lawset.paramsByLawId[lawId] = clampParams(law, params);
    return { success: true };
  }

  disableLaw(settlement, actingCharacterId, lawId) {
    const authError = this._requireLeader(settlement, actingCharacterId);
    if (authError) return authError;

    const lawset = this._getOrCreate(settlement.id);
    lawset.activeLawIds = lawset.activeLawIds.filter((id) => id !== lawId);
    return { success: true };
  }

  updateLawParams(settlement, actingCharacterId, lawId, params) {
    const authError = this._requireLeader(settlement, actingCharacterId);
    if (authError) return authError;

    const lawset = this._getOrCreate(settlement.id);
    if (!lawset.activeLawIds.includes(lawId)) {
      return { success: false, reason: `กฎหมาย id="${lawId}" ยังไม่ถูกเปิดใช้งานในถิ่นฐานนี้` };
    }
    const law = getLawById(lawId);
    if (!law) return { success: false, reason: `ไม่พบกฎหมาย id="${lawId}"` };

    lawset.paramsByLawId[lawId] = clampParams(law, { ...lawset.paramsByLawId[lawId], ...params });
    return { success: true };
  }

  isLawActive(settlementId, lawId) {
    return this._getOrCreate(settlementId).activeLawIds.includes(lawId);
  }

  getLawParams(settlementId, lawId) {
    const lawset = this._getOrCreate(settlementId);
    if (lawset.paramsByLawId[lawId]) return lawset.paramsByLawId[lawId];
    return getLawById(lawId)?.defaultParams ?? {};
  }

  // คืนค่ากฎหมาย (object เต็ม จาก law-registry) ที่เปิดใช้งานอยู่จริงของถิ่นฐานนี้ ณ ตอนนี้
  getActiveLaws(settlementId) {
    return this._getOrCreate(settlementId)
      .activeLawIds.map((id) => getLawById(id))
      .filter(Boolean);
  }
}
