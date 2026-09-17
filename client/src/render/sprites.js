// นิยาม pixel-art sprite ทั้งหมดของเกม — วาดขึ้นเองด้วยโค้ด 100% ไม่มีส่วนใดใช้ asset ภายนอกเลยแม้แต่นิดเดียว
// (ไม่มีการโหลดไฟล์ภาพ/ฟอนต์พิเศษ/ไอคอนจากที่ไหนทั้งสิ้น) sprite ทุกตัวนิยามเป็น "array ของ index สี" ผ่าน
// row() + parseSprite() (ดู sprite-utils.js) แล้ว renderer จะวาดทีละพิกเซลเป็นสี่เหลี่ยมตัน (ดู draw-sprite.js
// / draw ใน sprite-utils.js) ไม่มีการวาดรูปทรงเรขาคณิตแบบ flat design (ไม่ใช้ ctx.arc()/ctx.ellipse() เลย)
import { parseSprite, row, mirrorGrid } from './sprite-utils.js';

const T = 10; // ความกว้าง/สูงมาตรฐานของ tile ทรัพยากร/พื้น (10x10 พิกเซล) — ไม่เปลี่ยนแม้ตัวละครขยายความละเอียด

// ===== ตัวละคร (chibi หัวโต-ตัวเล็ก) 16x20 พิกเซล จำกัด 4 สี + โปร่งใส =====
// ขยายจาก 10x14 เดิม (เฟส 11 รอบแรก) เป็น 16x20 เพื่อให้มีที่พอใส่รายละเอียดหน้า (ตา) และภาพด้านข้าง/
// ด้านหลังที่แยกออกจากกันได้จริง โดยไม่กระทบขนาด tile พื้น/ทรัพยากรอื่นๆ เลย (T=10 ด้านบนคงเดิมทุกประการ
// — ตัวละครกับ tile ใช้ pixelSize เดียวกันตอน render แค่ sprite ตัวละครมีจำนวนพิกเซลต้นทางมากกว่า)
// legend: o=เส้นขอบเข้ม (ใช้เป็นสีตาด้วย), s=สีผิว, p=เสื้อผ้าสีหลัก (แยกตามอาชีพ), d=เสื้อผ้าสีเข้ม/เงา
const CHARACTER_LEGEND = { o: 1, s: 2, p: 3, d: 4 };

// ทิศ "ล่าง" (หันหน้าเข้าหาผู้เล่น) — เห็นตาทั้ง 2 ข้างชัดเจนตามที่สั่ง
const DOWN_A_ROWS = [
  row(16, [[5, 10, 'o']]),
  row(16, [[4, 4, 'o'], [5, 10, 's'], [11, 11, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 5, 's'], [6, 6, 'o'], [7, 8, 's'], [9, 9, 'o'], [10, 11, 's'], [12, 12, 'o']]), // ตา 2 ข้าง
  row(16, [[3, 3, 'o'], [4, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 's'], [12, 12, 'o']]),
  row(16, [[4, 11, 'o']]),
  row(16, [[4, 4, 'o'], [5, 10, 'p'], [11, 11, 'o']]),
  row(16, [[2, 3, 'o'], [4, 11, 'p'], [12, 13, 'o']]),
  row(16, [[2, 2, 'o'], [3, 11, 'p'], [12, 12, 'p'], [13, 13, 'o']]),
  row(16, [[2, 2, 'o'], [3, 5, 'p'], [6, 9, 'd'], [10, 12, 'p'], [13, 13, 'o']]),
  row(16, [[2, 2, 'o'], [3, 12, 'p'], [13, 13, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 'p'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 'p'], [12, 12, 'o']]),
  row(16, [[4, 11, 'o']]),
  row(16, [[5, 6, 'o'], [9, 10, 'o']]),
  row(16, [[5, 6, 'o'], [9, 10, 'o']]),
  row(16, [[5, 6, 'o'], [9, 10, 'o']]),
];
const DOWN_B_ROWS = [...DOWN_A_ROWS.slice(0, 17), row(16, [[4, 5, 'o'], [10, 11, 'o']]), row(16, [[4, 5, 'o'], [10, 11, 'o']]), row(16, [[4, 5, 'o'], [10, 11, 'o']])];

// ทิศ "บน" (หันหลังให้ผู้เล่น เดินขึ้นบน) — ไม่มีตา (มองไม่เห็นหน้า) มีเส้นแบ่งผมกลางหัวแทน
const UP_A_ROWS = [
  row(16, [[5, 10, 'o']]),
  row(16, [[4, 4, 'o'], [5, 10, 's'], [11, 11, 'o']]),
  row(16, [[3, 3, 'o'], [4, 6, 's'], [7, 7, 'o'], [8, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 6, 's'], [7, 7, 'o'], [8, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 6, 's'], [7, 7, 'o'], [8, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 's'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 's'], [12, 12, 'o']]),
  row(16, [[4, 11, 'o']]),
  row(16, [[4, 4, 'o'], [5, 10, 'p'], [11, 11, 'o']]),
  row(16, [[2, 3, 'o'], [4, 11, 'p'], [12, 13, 'o']]),
  row(16, [[2, 2, 'o'], [3, 11, 'p'], [12, 12, 'p'], [13, 13, 'o']]),
  row(16, [[2, 2, 'o'], [3, 5, 'p'], [6, 9, 'd'], [10, 12, 'p'], [13, 13, 'o']]),
  row(16, [[2, 2, 'o'], [3, 12, 'p'], [13, 13, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 'p'], [12, 12, 'o']]),
  row(16, [[3, 3, 'o'], [4, 11, 'p'], [12, 12, 'o']]),
  row(16, [[4, 11, 'o']]),
  row(16, [[5, 6, 'o'], [9, 10, 'o']]),
  row(16, [[5, 6, 'o'], [9, 10, 'o']]),
  row(16, [[5, 6, 'o'], [9, 10, 'o']]),
];
const UP_B_ROWS = [...UP_A_ROWS.slice(0, 17), row(16, [[4, 5, 'o'], [10, 11, 'o']]), row(16, [[4, 5, 'o'], [10, 11, 'o']]), row(16, [[4, 5, 'o'], [10, 11, 'o']])];

// ทิศ "ซ้าย" (หันข้าง) — เห็นตาข้างเดียว + สันจมูกยื่นออกมาเล็กน้อยด้านหน้า (ซ้าย) ทิศ "ขวา" ได้จากการ mirror
// sprite ชุดนี้ทั้งหมด (ดู CHARACTER_SPRITES ด้านล่าง) ไม่ต้องวาดซ้ำอีกชุด
const LEFT_A_ROWS = [
  row(16, [[6, 11, 'o']]),
  row(16, [[5, 5, 'o'], [6, 11, 's'], [12, 12, 'o']]),
  row(16, [[4, 4, 'o'], [5, 12, 's'], [13, 13, 'o']]),
  row(16, [[4, 4, 'o'], [5, 12, 's'], [13, 13, 'o']]),
  row(16, [[3, 3, 'o'], [4, 12, 's'], [13, 13, 'o']]), // สันจมูก
  row(16, [[3, 3, 's'], [4, 4, 'o'], [5, 12, 's'], [13, 13, 'o']]), // ตา
  row(16, [[4, 4, 'o'], [5, 12, 's'], [13, 13, 'o']]),
  row(16, [[4, 4, 'o'], [5, 12, 's'], [13, 13, 'o']]),
  row(16, [[5, 12, 'o']]),
  row(16, [[5, 5, 'o'], [6, 11, 'p'], [12, 12, 'o']]),
  row(16, [[4, 4, 'o'], [5, 12, 'p'], [13, 13, 'o']]),
  row(16, [[4, 4, 'o'], [5, 12, 'p'], [13, 13, 'o']]),
  row(16, [[4, 4, 'o'], [5, 7, 'p'], [8, 10, 'd'], [11, 12, 'p'], [13, 13, 'o']]),
  row(16, [[4, 4, 'o'], [5, 12, 'p'], [13, 13, 'o']]),
  row(16, [[5, 5, 'o'], [6, 11, 'p'], [12, 12, 'o']]),
  row(16, [[5, 5, 'o'], [6, 11, 'p'], [12, 12, 'o']]),
  row(16, [[6, 11, 'o']]),
  row(16, [[6, 7, 'o'], [9, 10, 'o']]),
  row(16, [[6, 7, 'o'], [9, 10, 'o']]),
  row(16, [[6, 7, 'o'], [9, 10, 'o']]),
];
const LEFT_B_ROWS = [...LEFT_A_ROWS.slice(0, 17), row(16, [[4, 5, 'o'], [10, 11, 'o']]), row(16, [[4, 5, 'o'], [10, 11, 'o']]), row(16, [[4, 5, 'o'], [10, 11, 'o']])];

const DOWN_A = parseSprite(DOWN_A_ROWS, CHARACTER_LEGEND);
const DOWN_B = parseSprite(DOWN_B_ROWS, CHARACTER_LEGEND);
const UP_A = parseSprite(UP_A_ROWS, CHARACTER_LEGEND);
const UP_B = parseSprite(UP_B_ROWS, CHARACTER_LEGEND);
const LEFT_A = parseSprite(LEFT_A_ROWS, CHARACTER_LEGEND);
const LEFT_B = parseSprite(LEFT_B_ROWS, CHARACTER_LEGEND);

// รวม sprite ทุกทิศ x 2 เฟรมเดิน เป็นจุดเดียวให้ renderer เลือกใช้ตามทิศทางที่คำนวณได้จากตำแหน่งก่อน-หลัง
// (client/src/render/character-direction.js) — ทิศ "ขวา" ไม่ได้วาดเอง แต่ mirror ชุด "ซ้าย" ทั้งหมด (รวม
// ตำแหน่งขาตอนเดินด้วย) ให้อัตโนมัติ เพราะเป็นภาพสะท้อนกันเป๊ะอยู่แล้วตามธรรมชาติของการหันข้าง
export const CHARACTER_SPRITES = Object.freeze({
  down: [DOWN_A, DOWN_B],
  up: [UP_A, UP_B],
  left: [LEFT_A, LEFT_B],
  right: [mirrorGrid(LEFT_A), mirrorGrid(LEFT_B)],
});

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

// ===== เครื่องมือประจำอาชีพ (เฟส 9) — sprite เล็กแยกต่างหาก วาดข้างตัวละคร ไม่ได้ฝังลงใน sprite ตัวละคร
// โดยตรง (โมดูลแยกจากกันง่ายกว่า: ไม่ต้องคูณ sprite ตัวละคร x ทิศ x เฟรม x อาชีพ ให้กลายเป็นร้อยตัวแปร) =====
const TOOL_LEGEND = { o: 1, h: 2, m: 3, w: 4, c: 5, f: 6 };

const AXE_ROWS = [
  row(8, [[3, 6, 'o']]),
  row(8, [[3, 6, 'm']]),
  row(8, [[2, 2, 'o'], [3, 6, 'm'], [7, 7, 'o']]),
  row(8, [[3, 4, 'h'], [5, 5, 'o']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
];
const BUCKET_ROWS = [
  row(8, [[2, 2, 'o'], [5, 5, 'o']]),
  row(8, [[2, 5, 'w']]),
  row(8, [[1, 1, 'o'], [2, 5, 'm'], [6, 6, 'o']]),
  row(8, [[1, 1, 'o'], [2, 5, 'm'], [6, 6, 'o']]),
  row(8, [[1, 1, 'o'], [2, 5, 'm'], [6, 6, 'o']]),
  row(8, [[2, 2, 'o'], [3, 4, 'm'], [5, 5, 'o']]),
  row(8, [[2, 5, 'o']]),
  row(8, []),
  row(8, []),
  row(8, []),
];
const PICKAXE_ROWS = [
  row(8, [[0, 7, 'o']]),
  row(8, [[0, 2, 'm'], [3, 4, 'o'], [5, 7, 'm']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
];
const SICKLE_ROWS = [
  row(8, [[4, 6, 'm']]),
  row(8, [[5, 7, 'm']]),
  row(8, [[3, 4, 'o'], [5, 6, 'm']]),
  row(8, [[3, 4, 'h'], [5, 5, 'm']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, [[3, 4, 'h']]),
  row(8, []),
  row(8, []),
];
const BAG_ROWS = [
  row(8, [[2, 5, 'o']]),
  row(8, [[2, 2, 'o'], [3, 4, 'f'], [5, 5, 'o']]),
  row(8, [[1, 1, 'o'], [2, 5, 'c'], [6, 6, 'o']]),
  row(8, [[1, 1, 'o'], [2, 5, 'c'], [6, 6, 'o']]),
  row(8, [[1, 1, 'o'], [2, 5, 'c'], [6, 6, 'o']]),
  row(8, [[2, 5, 'o']]),
  row(8, []),
  row(8, []),
  row(8, []),
  row(8, []),
];

const TOOL_PALETTE = [null, OUTLINE_COLOR, '#6b4423', '#9a9a9a', '#5aa0d8', '#b08a4a', '#7a5a30'];

// จับคู่อาชีพ (เฟส 9) กับเครื่องมือที่ควรถือ — ตัวละครที่ profession === null (ยังไม่มีอาชีพ) ไม่ถืออะไรเลย
// (คืนค่า null) ตามที่สั่ง
export const PROFESSION_TOOL_SPRITES = Object.freeze({
  lumberjack: parseSprite(AXE_ROWS, TOOL_LEGEND),
  water_carrier: parseSprite(BUCKET_ROWS, TOOL_LEGEND),
  miner: parseSprite(PICKAXE_ROWS, TOOL_LEGEND),
  farmer: parseSprite(SICKLE_ROWS, TOOL_LEGEND),
  freelancer: parseSprite(BAG_ROWS, TOOL_LEGEND),
});

export function getToolSpriteFor(professionId) {
  const sprite = PROFESSION_TOOL_SPRITES[professionId];
  return sprite ? { grid: sprite, palette: TOOL_PALETTE } : null;
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
