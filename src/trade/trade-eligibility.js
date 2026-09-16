import { TRADE_CONFIG } from './trade-config.js';
import { chebyshevDistance } from '../characters/movement.js';

// need เร่งด่วนที่สุด (ต่ำสุดในบรรดา 4 ตัว) ต่ำกว่าเกณฑ์วิกฤตหรือไม่ — เทียบเท่ากับเช็คว่ามี need ตัวใด
// ตัวหนึ่งต่ำกว่าเกณฑ์ (เพราะ need เร่งด่วนที่สุด = ค่าต่ำสุด นิยามเดียวกับ getMostUrgentNeed ใน utility-ai.js)
export function isNeedCritical(character) {
  return Object.values(character.needs).some((value) => value < TRADE_CONFIG.CRITICAL_NEED_THRESHOLD);
}

// hunger ต่ำกว่าเกณฑ์ safety หรือไม่ — hunger ลดเร็วที่สุดในบรรดา 4 need (1.5/tick) และมีลำดับความสำคัญ
// สูงสุดใน NEED_PRIORITY จึงเป็นตัวที่ "แซง" need อื่นขึ้นมาเป็นเร่งด่วนที่สุดได้เร็วกว่าที่คิด ถ้าปล่อยให้
// ทำธุรกรรม (โดยเฉพาะจ้างบริการที่ไม่ได้ช่วยเรื่องหิวเลย) ตอน hunger กำลังจะต่ำ แม้จะยังไม่ถึงเกณฑ์วิกฤต
// (CRITICAL_NEED_THRESHOLD) ก็ตาม จะเสียเวลา 1 tick ไปกับธุรกรรมแทนที่จะรีบไปหาอาหาร พอสะสมหลายครั้งเข้า
// (ตัวละครไปมัวจ้างคนอื่นช่วยพัก energy ซ้ำๆ แทนที่จะออกไปหาอาหารเมื่อ hunger เริ่มลด) ก็อาจพลาดจังหวะจน
// ไปเจอช่วงที่ทรัพยากรอาหารแถวนั้นหมดพอดี ติด flag "AI มีปัญหา" ได้ (เจอจริงตอนรัน scripts/long-run.js —
// รายละเอียดเต็มอยู่ใน README หัวข้อเฟส 7) จึงต้องกันไว้ตั้งแต่ต้นทาง ไม่ใช่แค่กันตอนวิกฤตแล้ว
function isHungerSafe(character) {
  return character.needs.hunger >= TRADE_CONFIG.HUNGER_SAFETY_THRESHOLD;
}

// เงื่อนไขร่วมของทุกธุรกรรม (ทั้งซื้อขายสินค้าและจ้างบริการ ทั้งแบบ xcoin และ barter): ต้องไม่ใช่ตัวละคร
// เดียวกัน ต้องอยู่ใกล้กันในระยะที่กำหนด, "ทั้งสองฝ่ายต้องไม่วิกฤต" (กฎ "ไม่แข่งกับการเอาตัวรอด" ตามสเปก)
// และทั้งสองฝ่ายต้อง hunger ปลอดภัยพอด้วย (ดู isHungerSafe ด้านบน)
export function canTransact(a, b) {
  if (a === b) return false;
  if (isNeedCritical(a) || isNeedCritical(b)) return false;
  if (!isHungerSafe(a) || !isHungerSafe(b)) return false;
  return chebyshevDistance(a.position, b.position) <= TRADE_CONFIG.TRADE_PROXIMITY_RADIUS;
}
