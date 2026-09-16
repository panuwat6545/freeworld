import { TRADE_CONFIG } from './trade-config.js';

// ราคาไม้ต่อหน่วย ณ ดัชนีเงินเฟ้อสะสมปัจจุบัน (cumulativeIndex จาก src/economy/inflation.js)
// นี่คือจุดแรกที่ index จากเฟส 6 ถูกใช้คำนวณราคาจริงตามที่ตั้งใจไว้ตอนออกแบบเฟส 6
export function getWoodPrice(cumulativeIndex) {
  return TRADE_CONFIG.WOOD_BASE_PRICE * cumulativeIndex;
}

// ราคาจ้างบริการ (เก็บไม้แทน/ช่วยฟื้น energy) ณ ดัชนีเงินเฟ้อสะสมปัจจุบัน
export function getServicePrice(cumulativeIndex) {
  return TRADE_CONFIG.SERVICE_BASE_PRICE * cumulativeIndex;
}
