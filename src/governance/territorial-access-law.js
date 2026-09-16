import { LAW_EVENTS } from './law.js';

function isInsideTerritory(x, y, params) {
  return x >= params.minX && x <= params.maxX && y >= params.minY && y <= params.maxY;
}

// กฎหมายตัวอย่างข้อ 2 (สเปกเฟส 8 ข้อ 4b): ผู้นำกำหนดเขตสี่เหลี่ยมบน grid (minX/minY/maxX/maxY) ที่เป็น
// "เขตหวงห้าม" ของถิ่นฐาน — ตัวละครที่ไม่ใช่สมาชิกถิ่นฐานนี้ (homeSettlementId ไม่ตรงกัน) ที่พยายามเก็บ
// ทรัพยากรในเขตนี้จะโดน 2 โหมดตามที่ผู้นำตั้งไว้ (`mode`):
//   - 'block'   -> เก็บไม่ได้เลย (harvestAt คืนค่า 0 ทันที ทรัพยากรไม่ถูกหักออกจาก world ด้วย)
//   - 'penalty' -> เก็บได้ปกติ (หักทรัพยากรจาก world จริง) แต่ถูกยึดไปบางส่วนตาม confiscationRate
//                  (ส่วนที่ถูกยึดถือว่าสูญเปล่า/ถูกทำลายโดยหน่วยลาดตระเวน ไม่ได้ไหลเข้าคลังของใครทั้งนั้น
//                  — ทำให้ไม่ต้องเพิ่มแนวคิด "คลังทรัพยากรของถิ่นฐาน" ใหม่ในเฟสนี้ เก็บไว้ให้เฟสหลังตัดสินใจ)
// ค่าเริ่มต้นเป็นเขตขนาด 0 (minX=minY=maxX=maxY=0) เท่ากับไม่ block อะไรเลยจนกว่าผู้นำจะตั้งเขตจริง
export const territorialAccessLaw = {
  id: 'territorial_access',
  name: 'สิทธิ์เขตแดน',
  description: 'กำหนดเขตบน grid ที่คนนอกถิ่นฐานเก็บทรัพยากรไม่ได้ (block) หรือเก็บได้แต่ถูกยึดบางส่วน (penalty)',
  defaultParams: { minX: 0, minY: 0, maxX: 0, maxY: 0, mode: 'block', confiscationRate: 0.5 },
  paramBounds: {
    minX: { min: 0, max: 10000 },
    minY: { min: 0, max: 10000 },
    maxX: { min: 0, max: 10000 },
    maxY: { min: 0, max: 10000 },
    confiscationRate: { min: 0, max: 1 },
  },
  apply(context) {
    if (context.eventType !== LAW_EVENTS.RESOURCE_GATHER) return { allow: true };
    const { harvester, x, y, settlement, params } = context;

    if (!isInsideTerritory(x, y, params)) return { allow: true };
    if (harvester.homeSettlementId === settlement.id) return { allow: true }; // สมาชิกเอง ไม่โดน

    if (params.mode === 'penalty') {
      return { allow: true, confiscationRate: params.confiscationRate };
    }
    return { allow: false }; // ค่าเริ่มต้น/โหมดอื่นที่ไม่รู้จักถือเป็น block ปลอดภัยไว้ก่อน
  },
};
