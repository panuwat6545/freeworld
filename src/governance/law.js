// เหตุการณ์ที่กฎหมายตอบสนองได้ — เพิ่มชนิดเหตุการณ์ใหม่ในอนาคตได้โดยไม่ต้องแก้ core (governance-system.js
// แค่ต้องรู้จักเรียก apply() ตอนเหตุการณ์นั้นเกิดขึ้น ส่วนกฎหมายแต่ละข้อเช็ค context.eventType เองว่าสนใจไหม)
export const LAW_EVENTS = Object.freeze({
  TRADE: 'trade', // มีธุรกรรม xcoin เกิดขึ้นจริง (เรียกหลัง settlePayment สำเร็จ จากเฟส 7)
  RESOURCE_GATHER: 'resource_gather', // ตัวละครพยายามเก็บทรัพยากรจาก world.harvestAt (เฟส 1-2)
});

// นิยาม "shape" กลางของกฎหมาย 1 ข้อ — ไม่ใช้ class เพราะกฎหมายเป็นแค่ plain object ประกาศ config
// ล้วนๆ ไม่มี state ของตัวเอง (state ของแต่ละถิ่นฐานเก็บแยกไว้ใน settlement-lawset.js)
//
// กฎหมายทุกข้อต้อง export object รูปแบบนี้ (ดูตัวอย่างจริงใน trade-tax-law.js / territorial-access-law.js)
// แล้วเพิ่มเข้า LAW_REGISTRY ใน law-registry.js — แค่นี้พอ ไม่ต้องแก้ไฟล์อื่นเลยเพื่อให้กฎหมายใหม่ใช้งานได้จริง
//
// {
//   id: string,                 // unique, ใช้อ้างอิงใน settlement-lawset.js
//   name: string,                // ชื่อแสดงผล
//   description: string,          // อธิบายว่ากฎหมายนี้ทำอะไร
//   defaultParams: object,         // พารามิเตอร์เริ่มต้นที่ผู้นำปรับได้ เช่น { rate: 0.1 }
//   paramBounds: object,            // ขอบเขตของแต่ละ param ตัวเลข เช่น { rate: { min: 0, max: 0.5 } }
//                                    // ใช้ clampParams() ด้านล่าง กันผู้นำตั้งค่านอกช่วงที่กำหนด
//   apply(context) -> result,        // เรียกทุกครั้งที่เกิดเหตุการณ์ใดๆ ที่ถิ่นฐานนี้เปิดกฎหมายข้อนี้อยู่
//                                     // context.eventType บอกว่าเหตุการณ์ไหน ถ้ากฎหมายไม่สนใจ event นี้
//                                     // ให้ return { allow: true } เฉยๆ (no-op ผ่านไปเลย ไม่กระทบอะไร)
// }

// ตัด param ให้อยู่ในขอบเขตที่กฎหมายกำหนด (เฉพาะ key ที่เป็นตัวเลขและมี bounds ประกาศไว้ — key อื่น เช่น
// string enum อย่าง mode ผ่านไปตรงๆ ไม่ยุ่ง) รวม default เข้ากับค่าที่ส่งมาก่อน clamp เสมอ
export function clampParams(law, params = {}) {
  const merged = { ...law.defaultParams, ...params };
  const bounds = law.paramBounds ?? {};
  for (const [key, range] of Object.entries(bounds)) {
    if (typeof merged[key] === 'number') {
      merged[key] = Math.min(range.max, Math.max(range.min, merged[key]));
    }
  }
  return merged;
}
