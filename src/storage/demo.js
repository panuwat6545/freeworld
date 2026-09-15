import { World } from '../world/world.js';
import { Character } from '../characters/character.js';
import { updateCharacter } from '../characters/utility-ai.js';
import { SnapshotScheduler } from './snapshot-scheduler.js';

// สคริปต์นี้ใช้ credential จริงจาก environment variable GOOGLE_DRIVE_CREDENTIALS
// เพื่อยืนยันว่าเชื่อมต่อ Google Drive ได้จริง (ไม่ mock เหมือนใน unit test)
if (!process.env.GOOGLE_DRIVE_CREDENTIALS) {
  console.warn(
    '[demo] ไม่พบ GOOGLE_DRIVE_CREDENTIALS ใน environment — การบันทึก snapshot จะล้มเหลว ' +
      'แต่สคริปต์นี้ก็ยังควรรันจบได้โดยไม่ล่ม (ตามข้อกำหนดเรื่อง error handling)',
  );
}

const world = new World({ seed: 2026 });
const characters = [
  new Character({ x: 5, y: 5, needs: { hunger: 70, energy: 70, shelter: 70, social: 70 } }),
  new Character({ x: 30, y: 30, needs: { hunger: 60, energy: 60, shelter: 60, social: 60 } }),
  new Character({ x: 15, y: 25, needs: { hunger: 80, energy: 50, shelter: 40, social: 65 } }),
];

// ย่อ 1 ปีในเกมให้เหลือ 20 tick เพื่อให้ demo จบไวและเห็นการบันทึกซ้ำหลายรอบ
const TICKS_PER_YEAR_FOR_DEMO = 20;
const scheduler = new SnapshotScheduler({ ticksPerYear: TICKS_PER_YEAR_FOR_DEMO });

const YEARS_TO_SIMULATE = 3;
const TOTAL_TICKS = TICKS_PER_YEAR_FOR_DEMO * YEARS_TO_SIMULATE;

console.log(
  `เริ่มจำลอง ${YEARS_TO_SIMULATE} ปีในเกม (${TOTAL_TICKS} tick, ${TICKS_PER_YEAR_FOR_DEMO} tick/ปี) ` +
    `กับตัวละคร ${characters.length} ตัว`,
);

for (let t = 1; t <= TOTAL_TICKS; t++) {
  world.update(1);
  for (const character of characters) {
    updateCharacter(character, world, characters, 1);
  }

  const result = await scheduler.checkAndSave(world, characters);
  if (result) {
    if (result.success) {
      console.log(`>>> ครบ 1 ปีเกม (tick ${world.tick}) บันทึกไฟล์ "${result.fileName}" สำเร็จ`);
    } else {
      console.log(`>>> ครบ 1 ปีเกม (tick ${world.tick}) แต่บันทึกไม่สำเร็จ: ${result.error}`);
    }
  }
}

console.log('จบการจำลอง');
