let nextSettlementId = 1;

// ถิ่นฐาน (Settlement): กลุ่มที่พักที่อยู่ใกล้กันตามระยะที่กำหนด เกิดขึ้นเองจากตำแหน่งการสร้างบ้าน
// ไม่มีใครสั่งตั้งใจ (ดู settlement-detector.js สำหรับตรรกะการจัดกลุ่ม)
export class Settlement {
  constructor() {
    this.id = nextSettlementId++;
    this.structureIds = []; // id ของที่พัก (structure ชนิด shelter) ที่อยู่ในถิ่นฐานนี้
    this.memberIds = []; // id ของตัวละครที่ homeSettlementId ชี้มาที่ถิ่นฐานนี้
    this.leaderId = null; // id ของตัวละครที่เป็นผู้นำปัจจุบัน (ดู leadership.js)
  }
}
