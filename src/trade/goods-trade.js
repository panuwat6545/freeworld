import { TRADE_CONFIG } from './trade-config.js';
import { getWoodPrice } from './pricing.js';
import { canTransact } from './trade-eligibility.js';
import { settlePayment } from './payment.js';

// ข้อ 1a ของสเปกเฟส 7: ตัวละครที่มีไม้ส่วนเกิน (surplus) ขายให้ตัวละครอื่นที่ต้องการ (shelter need
// ปานกลาง-ต่ำ และไม้ไม่พอ) ราคาผูกกับดัชนีเงินเฟ้อสะสมจากเฟส 6 — ถ้า buyer มี xcoin ไม่พอ จะแลกแบบ barter
// แทน (ดู payment.js) ตามข้อ 2 ของสเปกที่ให้ barter เป็นทางเลือกคู่ขนาน ไม่ใช่ทางเดียว
//
// คืนค่า record ธุรกรรมถ้าสำเร็จ หรือ null ถ้าเงื่อนไขไม่ครบ (ไม่ throw เพื่อให้ trade-system.js
// ลองจับคู่อื่นต่อได้เรื่อยๆ โดยไม่ต้องดักจับ error)
export function tryTradeWood(buyer, seller, cumulativeIndex) {
  if (!canTransact(buyer, seller)) return null;
  if (buyer.needs.shelter >= TRADE_CONFIG.MODERATE_NEED_THRESHOLD) return null; // buyer ยังไม่อยากได้ไม้เพิ่ม
  if (seller.inventory.wood < TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD) return null; // seller ไม่มีส่วนเกินให้ขาย

  const quantity = TRADE_CONFIG.WOOD_TRADE_QUANTITY;
  const price = getWoodPrice(cumulativeIndex) * quantity;
  const paymentType = settlePayment(buyer, seller, price);

  seller.inventory.wood -= quantity;
  buyer.inventory.wood += quantity;

  return {
    type: paymentType,
    kind: 'goods',
    good: 'wood',
    quantity,
    price: paymentType === 'xcoin' ? price : 0,
    buyerId: buyer.id,
    sellerId: seller.id,
  };
}
