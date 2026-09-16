import { LAW_EVENTS } from './law.js';

// กฎหมายตัวอย่างข้อ 1 (สเปกเฟส 8 ข้อ 4a): หักภาษี % จากทุกธุรกรรม xcoin ที่สมาชิกถิ่นฐานนี้ "ได้รับ" เข้า
// กองกลาง (treasury) ของถิ่นฐาน — คิดภาษีฝั่งผู้รับเงิน (ผู้ขาย/ผู้รับจ้าง) เหมือนภาษีเงินได้ที่จ่ายให้
// เขตปกครองของตัวเอง ไม่ใช่ภาษีฝั่งผู้ซื้อ (เป็นการตัดสินใจออกแบบ อธิบายเหตุผลเต็มใน README) ธุรกรรมแบบ
// barter ไม่มีเงินให้เก็บภาษี จึงไม่ถูกกฎนี้แตะเลย
export const tradeTaxLaw = {
  id: 'trade_tax',
  name: 'ภาษีการค้า',
  description: 'หักภาษี % จากยอดที่ผู้ขาย/ผู้รับจ้างในถิ่นฐานได้รับจากธุรกรรม xcoin เข้ากองกลางถิ่นฐาน',
  defaultParams: { rate: 0.1 }, // 10%
  paramBounds: { rate: { min: 0, max: 0.5 } }, // ผู้นำปรับได้ 0-50%
  apply(context) {
    if (context.eventType !== LAW_EVENTS.TRADE) return { allow: true };
    if (context.deal.type !== 'xcoin') return { allow: true };

    const taxAmount = context.deal.price * context.params.rate;
    return { allow: true, taxAmount };
  },
};
