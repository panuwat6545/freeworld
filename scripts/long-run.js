// เครื่องมือสำรวจ (ไม่ใช่ demo ปกติ ไม่นับรวมใน Definition of Done ของเฟสไหน)
// รันจำลองโลกยาว 30 ปีในเกม กับตัวละครหลายตัว แบบเงียบ (ไม่ log ทุก tick) เพื่อดูแนวโน้มระยะยาว
// ของ needs เฉลี่ย จำนวนที่พักที่สร้างสำเร็จสะสม และจับสัญญาณตัวละครที่ AI น่าจะมีปัญหา
// (need ตัวใดตัวหนึ่งค้างต่ำกว่า 20 ติดต่อกันนานเกิน 3 ปีเกม) แล้วบันทึก snapshot สุดท้ายขึ้น
// Google Drive เหมือน demo:storage
import { World } from '../src/world/world.js';
import { Character } from '../src/characters/character.js';
import { updateCharacter } from '../src/characters/utility-ai.js';
import { NEED_PRIORITY } from '../src/characters/needs-config.js';
import { saveSnapshot } from '../src/storage/save-snapshot.js';
import { DEFAULT_TICKS_PER_YEAR } from '../src/storage/snapshot-scheduler.js';

const TICKS_PER_YEAR = DEFAULT_TICKS_PER_YEAR; // 1 ปีเกมจริง = 365 tick (ไม่ย่อเหมือน demo:storage)
const YEARS_TO_SIMULATE = 30;
const YEARS_PER_REPORT = 5;
const STUCK_THRESHOLD = 20; // need ต่ำกว่าค่านี้ถือว่า "ค้าง"
const STUCK_YEARS_LIMIT = 3; // ค้างติดต่อกันเกินกี่ปีเกมถึงถือว่าผิดปกติ
const STUCK_TICKS_LIMIT = STUCK_YEARS_LIMIT * TICKS_PER_YEAR;

// สร้างโลกและตัวละครด้วย config เดียวกับ demo:characters/demo:building (ขนาดโลกค่า default 40x40)
// ใช้ seed คงที่เพื่อให้ผลลัพธ์ของการรันแต่ละครั้งทำนายได้เหมือนกัน
const world = new World({ seed: 12345 });

const CHARACTER_COUNT = 9;
const characters = [];
for (let i = 0; i < CHARACTER_COUNT; i++) {
  // กระจายตำแหน่งเริ่มต้นทั่วโลก และสลับ need ที่เริ่มวิกฤตให้แตกต่างกันไปในแต่ละตัว
  // เพื่อให้เห็นพฤติกรรมหลากหลายเหมือนที่ demo:characters ทำ
  const x = Math.floor((i * world.width) / CHARACTER_COUNT) + 1;
  const y = Math.floor(((i * 7) % CHARACTER_COUNT) * (world.height / CHARACTER_COUNT)) + 1;
  const skewedNeed = NEED_PRIORITY[i % NEED_PRIORITY.length];
  const needs = { hunger: 70, energy: 70, shelter: 70, social: 70, [skewedNeed]: 30 };
  characters.push(new Character({ x, y, needs }));
}

// สถานะติดตามต่อตัวละคร: streak ปัจจุบันของแต่ละ need ที่ค้างต่ำกว่า STUCK_THRESHOLD ติดต่อกัน
// และ set ของ need ที่เคยค้างเกิน STUCK_TICKS_LIMIT แล้ว (เป็นสัญญาณเตือนสะสม ไม่หายแม้ need จะฟื้นภายหลัง)
const stuckStreaks = new Map();
const flaggedNeeds = new Map();
for (const character of characters) {
  stuckStreaks.set(character.id, Object.fromEntries(NEED_PRIORITY.map((key) => [key, 0])));
  flaggedNeeds.set(character.id, new Set());
}

function updateStuckTracking(character) {
  const streaks = stuckStreaks.get(character.id);
  const flagged = flaggedNeeds.get(character.id);
  for (const key of NEED_PRIORITY) {
    if (character.needs[key] < STUCK_THRESHOLD) {
      streaks[key] += 1;
      if (streaks[key] > STUCK_TICKS_LIMIT) {
        flagged.add(key);
      }
    } else {
      streaks[key] = 0;
    }
  }
}

function averageNeeds() {
  const totals = Object.fromEntries(NEED_PRIORITY.map((key) => [key, 0]));
  for (const character of characters) {
    for (const key of NEED_PRIORITY) {
      totals[key] += character.needs[key];
    }
  }
  return Object.fromEntries(NEED_PRIORITY.map((key) => [key, totals[key] / characters.length]));
}

function printReport(year) {
  const averages = averageNeeds();
  const shelterCount = world.structures.filter((s) => s.type === 'shelter').length;
  const problemCharacters = characters
    .map((c) => ({ id: c.id, needs: [...flaggedNeeds.get(c.id)] }))
    .filter((entry) => entry.needs.length > 0);

  console.log(`\n=== สรุปผล ณ ปีที่ ${year} ===`);
  console.log(
    'ค่าเฉลี่ย need: ' +
      NEED_PRIORITY.map((key) => `${key}=${averages[key].toFixed(1)}`).join(' '),
  );
  console.log(`ที่พักสร้างสำเร็จสะสม: ${shelterCount}`);
  if (problemCharacters.length === 0) {
    console.log('ตัวละครที่ AI น่าจะมีปัญหา: ไม่มี');
  } else {
    console.log(
      'ตัวละครที่ AI น่าจะมีปัญหา (need ค้างต่ำกว่า 20 เกิน 3 ปีเกม): ' +
        problemCharacters.map((p) => `#${p.id}(${p.needs.join(',')})`).join(', '),
    );
  }
}

const TOTAL_TICKS = TICKS_PER_YEAR * YEARS_TO_SIMULATE;
console.log(
  `เริ่มจำลอง ${YEARS_TO_SIMULATE} ปีในเกม (${TOTAL_TICKS} tick, ${TICKS_PER_YEAR} tick/ปี) ` +
    `กับตัวละคร ${characters.length} ตัว (แบบเงียบ สรุปผลทุก ${YEARS_PER_REPORT} ปี)`,
);

for (let t = 1; t <= TOTAL_TICKS; t++) {
  world.update(1);
  for (const character of characters) {
    updateCharacter(character, world, characters, 1);
    updateStuckTracking(character);
  }

  if (t % (TICKS_PER_YEAR * YEARS_PER_REPORT) === 0) {
    printReport(t / TICKS_PER_YEAR);
  }
}

const finalYear = TOTAL_TICKS / TICKS_PER_YEAR;
const result = await saveSnapshot(world, characters, finalYear);
if (result.success) {
  console.log(`\n>>> บันทึก snapshot สุดท้าย (ปีที่ ${finalYear}) สำเร็จ: ${result.fileName}`);
} else {
  console.log(`\n>>> บันทึก snapshot สุดท้าย (ปีที่ ${finalYear}) ไม่สำเร็จ: ${result.error}`);
}

console.log('จบการรันจำลองระยะยาว');
