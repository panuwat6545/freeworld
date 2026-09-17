// นิยาม pixel-art sprite ทั้งหมดของเกม — วาดขึ้นเองด้วยโค้ด 100% ไม่มีส่วนใดใช้ asset ภายนอกเลยแม้แต่นิดเดียว
// (ไม่มีการโหลดไฟล์ภาพ/ฟอนต์พิเศษ/ไอคอนจากที่ไหนทั้งสิ้น) sprite ทุกตัวนิยามเป็น "array ของ index สี" ผ่าน
// row() + parseSprite() (ดู sprite-utils.js) แล้ว renderer จะวาดทีละพิกเซลเป็นสี่เหลี่ยมตัน (ดู draw-sprite.js
// / draw ใน sprite-utils.js) ไม่มีการวาดรูปทรงเรขาคณิตแบบ flat design (ไม่ใช้ ctx.arc()/ctx.ellipse() เลย)
import { parseSprite, row } from './sprite-utils.js';

const T = 10; // ความกว้าง/สูงมาตรฐานของ tile ทรัพยากร/พื้น (10x10 พิกเซล)

// ===== ตัวละคร (chibi หัวโต-ตัวเล็ก) 10x14 พิกเซล จำกัด 4 สี + โปร่งใส =====
// legend: o=เส้นขอบเข้ม, s=สีผิว, p=เสื้อผ้าสีหลัก (แยกตามอาชีพ), d=เสื้อผ้าสีเข้ม/เงา (แยกตามอาชีพ)
const CHARACTER_LEGEND = { o: 1, s: 2, p: 3, d: 4 };

// เฟรม A: ยืนขาชิด (ใช้ตอนหยุดนิ่ง/ก้าวขาเข้า)
const CHARACTER_FRAME_A_ROWS = [
  row(10, []),
  row(10, [[2, 7, 'o']]),
  row(10, [[1, 1, 'o'], [2, 7, 's'], [8, 8, 'o']]),
  row(10, [[1, 1, 'o'], [2, 7, 's'], [8, 8, 'o']]),
  row(10, [[1, 1, 'o'], [2, 2, 's'], [3, 3, 'o'], [4, 5, 's'], [6, 6, 'o'], [7, 7, 's'], [8, 8, 'o']]),
  row(10, [[1, 1, 'o'], [2, 7, 's'], [8, 8, 'o']]),
  row(10, [[2, 7, 'o']]),
  row(10, [[2, 2, 'o'], [3, 6, 'p'], [7, 7, 'o']]),
  row(10, [[1, 1, 'o'], [2, 7, 'p'], [8, 8, 'o']]),
  row(10, [[1, 1, 'o'], [2, 3, 'p'], [4, 5, 'd'], [6, 7, 'p'], [8, 8, 'o']]),
  row(10, [[1, 1, 'o'], [2, 7, 'p'], [8, 8, 'o']]),
  row(10, [[2, 7, 'o']]),
  row(10, [[2, 3, 'o'], [6, 7, 'o']]),
  row(10, [[2, 3, 'o'], [6, 7, 'o']]),
];

// เฟรม B: ก้าวขาแยกออก (สลับกับเฟรม A ให้ดูเดิน) — เปลี่ยนแค่ 2 แถวขาล่างสุด ส่วนบนเหมือนเฟรม A ทุกประการ
const CHARACTER_FRAME_B_ROWS = [
  ...CHARACTER_FRAME_A_ROWS.slice(0, 12),
  row(10, [[1, 2, 'o'], [7, 8, 'o']]),
  row(10, [[1, 2, 'o'], [7, 8, 'o']]),
];

export const CHARACTER_FRAME_A = parseSprite(CHARACTER_FRAME_A_ROWS, CHARACTER_LEGEND);
export const CHARACTER_FRAME_B = parseSprite(CHARACTER_FRAME_B_ROWS, CHARACTER_LEGEND);

// สีเสื้อผ้าแยกตามอาชีพจากเฟส 9 (ให้แยกอาชีพออกจากกันได้ชัดเจนด้วยสีตามสเปก) — outline(1)/skin(2) ใช้ร่วมกัน
// ทุกอาชีพ มีแค่ p(3)/d(4) ที่เปลี่ยนไปตามอาชีพ
export const OUTLINE_COLOR = '#2a2016';
export const SKIN_COLOR = '#f0c090';

export const PROFESSION_OUTFIT_COLORS = Object.freeze({
  lumberjack: { primary: '#8a5a2b', dark: '#5c3a1a' },
  water_carrier: { primary: '#3b82c4', dark: '#245a8a' },
  miner: { primary: '#7a7a7a', dark: '#4a4a4a' },
  farmer: { primary: '#5a9c3f', dark: '#3a6b28' },
  freelancer: { primary: '#8a4fbf', dark: '#5c3480' },
  // ยังไม่มีอาชีพชัดเจน (เฟส 9: profession === null) — สีกลางๆ ไม่ผูกกับอาชีพไหน
  unemployed: { primary: '#a89a8a', dark: '#6e6255' },
});

// สร้าง palette เต็มสำหรับตัวละคร 1 คนตามอาชีพ (index 0 ไม่ใช้เพราะเป็นโปร่งใสเสมอ)
export function buildCharacterPalette(professionId) {
  const colors = PROFESSION_OUTFIT_COLORS[professionId] ?? PROFESSION_OUTFIT_COLORS.unemployed;
  return [null, OUTLINE_COLOR, SKIN_COLOR, colors.primary, colors.dark];
}

// ===== พื้นหญ้า (background tile เต็มพื้นที่ ไม่มีโปร่งใส) 10x10, 2 สี =====
const GRASS_LEGEND = { g: 1, t: 2 };
const GRASS_ROWS = [
  row(T, [], 'g'),
  row(T, [[2, 2, 't']], 'g'),
  row(T, [], 'g'),
  row(T, [[6, 6, 't']], 'g'),
  row(T, [[1, 1, 't']], 'g'),
  row(T, [], 'g'),
  row(T, [[8, 8, 't']], 'g'),
  row(T, [[4, 4, 't']], 'g'),
  row(T, [], 'g'),
  row(T, [[6, 6, 't'], [1, 1, 't']], 'g'),
];
export const GRASS_SPRITE = parseSprite(GRASS_ROWS, GRASS_LEGEND);
export const GRASS_PALETTE = [null, '#6fa84a', '#5c9440'];

// ===== ไม้ (ต้นไม้) — วางทับพื้นหญ้า ส่วนใหญ่โปร่งใสให้เห็นหญ้าด้านล่าง ลำต้นเป็น "เส้นแนวตั้ง" ตามที่สั่ง =====
const WOOD_LEGEND = { k: 1, c: 2, d: 3 };
const WOOD_ROWS = [
  row(T, [[2, 2, 'c'], [5, 5, 'c'], [8, 8, 'd']]),
  row(T, [[1, 3, 'c'], [4, 6, 'd'], [7, 9, 'c']]),
  row(T, [[2, 2, 'c'], [5, 5, 'd'], [8, 8, 'c']]),
  row(T, []),
  row(T, [[2, 2, 'k'], [5, 5, 'k'], [8, 8, 'k']]),
  row(T, [[2, 2, 'k'], [5, 5, 'k'], [8, 8, 'k']]),
  row(T, [[2, 2, 'k'], [5, 5, 'k'], [8, 8, 'k']]),
  row(T, [[2, 2, 'k'], [5, 5, 'k'], [8, 8, 'k']]),
  row(T, [[2, 2, 'k'], [5, 5, 'k'], [8, 8, 'k']]),
  row(T, []),
];
export const WOOD_SPRITE = parseSprite(WOOD_ROWS, WOOD_LEGEND);
export const WOOD_PALETTE = [null, '#6b4423', '#4a8f3c', '#356628'];

// ===== น้ำ — tile เต็ม แทนที่หญ้าไปเลย (เป็นแหล่งน้ำจริง) ลายเส้นคลื่นแนวนอน =====
const WATER_LEGEND = { w: 1, l: 2 };
const WATER_ROWS = [
  row(T, [], 'w'),
  row(T, [[1, 3, 'l'], [6, 8, 'l']], 'w'),
  row(T, [], 'w'),
  row(T, [], 'w'),
  row(T, [[0, 1, 'l'], [4, 6, 'l'], [8, 9, 'l']], 'w'),
  row(T, [], 'w'),
  row(T, [], 'w'),
  row(T, [[2, 4, 'l'], [7, 9, 'l']], 'w'),
  row(T, [], 'w'),
  row(T, [], 'w'),
];
export const WATER_SPRITE = parseSprite(WATER_ROWS, WATER_LEGEND);
export const WATER_PALETTE = [null, '#2f6fb0', '#5aa0d8'];

// ===== แร่ — tile เต็ม (พื้นหินแทนหญ้า) มีก้อนหินเข้ม/อ่อนสลับ =====
const ORE_LEGEND = { r: 1, h: 2, l: 3 };
const ORE_ROWS = [
  row(T, [], 'r'),
  row(T, [[2, 4, 'h']], 'r'),
  row(T, [[2, 4, 'h'], [3, 3, 'l']], 'r'),
  row(T, [], 'r'),
  row(T, [[6, 8, 'h']], 'r'),
  row(T, [[6, 8, 'h'], [7, 7, 'l']], 'r'),
  row(T, [], 'r'),
  row(T, [[1, 3, 'h']], 'r'),
  row(T, [[1, 3, 'h'], [2, 2, 'l']], 'r'),
  row(T, [], 'r'),
];
export const ORE_SPRITE = parseSprite(ORE_ROWS, ORE_LEGEND);
export const ORE_PALETTE = [null, '#7d7d7d', '#5a5a5a', '#b8b8b8'];

// ===== อาหาร (แปลงเกษตร) — tile เต็ม (ดินแทนหญ้า) มีต้นพืช+ผลสีสด กระจายเป็นแถว =====
const FOOD_LEGEND = { b: 1, g: 2, y: 3 };
const FOOD_ROWS = [
  row(T, [], 'b'),
  row(T, [[1, 1, 'g'], [4, 4, 'g'], [7, 7, 'g']], 'b'),
  row(T, [[1, 1, 'y'], [4, 4, 'y'], [7, 7, 'g']], 'b'),
  row(T, [], 'b'),
  row(T, [[2, 2, 'g'], [5, 5, 'g'], [8, 8, 'g']], 'b'),
  row(T, [[2, 2, 'g'], [5, 5, 'y'], [8, 8, 'y']], 'b'),
  row(T, [], 'b'),
  row(T, [[0, 0, 'g'], [3, 3, 'g'], [6, 6, 'g']], 'b'),
  row(T, [[0, 0, 'y'], [3, 3, 'g'], [6, 6, 'y']], 'b'),
  row(T, [], 'b'),
];
export const FOOD_SPRITE = parseSprite(FOOD_ROWS, FOOD_LEGEND);
export const FOOD_PALETTE = [null, '#6b4a2a', '#4a8f3c', '#d8b23a'];

// ===== ที่พัก (เฟส 3) 10x12 พิกเซล — หลังคา+ผนัง+ประตู =====
const SHELTER_LEGEND = { o: 1, r: 2, w: 3, d: 4 };
const SHELTER_ROWS = [
  row(T, [[4, 5, 'r']]),
  row(T, [[3, 6, 'r']]),
  row(T, [[2, 7, 'r']]),
  row(T, [[1, 8, 'r']]),
  row(T, [[0, 9, 'o']]),
  row(T, [[1, 1, 'o'], [2, 7, 'w'], [8, 8, 'o']]),
  row(T, [[1, 1, 'o'], [2, 3, 'w'], [4, 5, 'd'], [6, 7, 'w'], [8, 8, 'o']]),
  row(T, [[1, 1, 'o'], [2, 3, 'w'], [4, 5, 'd'], [6, 7, 'w'], [8, 8, 'o']]),
  row(T, [[1, 1, 'o'], [2, 7, 'w'], [8, 8, 'o']]),
  row(T, [[0, 9, 'o']]),
  row(T, []),
  row(T, []),
];
export const SHELTER_SPRITE = parseSprite(SHELTER_ROWS, SHELTER_LEGEND);
export const SHELTER_PALETTE = [null, '#3a2a1a', '#8a3a2a', '#c9a86a', '#5c3a1a'];
