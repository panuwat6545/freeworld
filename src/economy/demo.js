import { World } from '../world/world.js';
import { Character } from '../characters/character.js';
import { updateCharacter } from '../characters/utility-ai.js';
import { SocietySystem } from '../society/society-system.js';
import { EconomySystem } from './economy-system.js';
import { getSettlementAverageBalance } from './settlement-economy.js';
import { DEFAULT_TICKS_PER_YEAR } from '../storage/snapshot-scheduler.js';

// สคริปต์สาธิตเฟส 6 (สกุลเงิน xcoin): แสดงยอด xcoin เฉลี่ยของแต่ละถิ่นฐานเปลี่ยนแปลงตามปี พร้อมอัตรา
// เงินเฟ้อที่สุ่มได้แต่ละปีทาง console ใช้ SocietySystem จากเฟส 4 คู่กับ EconomySystem ตัวใหม่ของเฟสนี้
// ตัวละครถูกจัดเป็น 2 กลุ่มตำแหน่งห่างกัน (เหมือน demo:society) และบังคับ shelter เป็น need วิกฤตสุดตั้งแต่
// ต้น เพื่อให้ถิ่นฐานก่อตัวเร็วๆ จะได้เห็นยอด xcoin แยกตามถิ่นฐานได้ตั้งแต่ปีแรกๆ

const world = new World({ seed: 777 });

const villageA = [
  new Character({ x: 5, y: 5, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
  new Character({ x: 6, y: 5, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
  new Character({ x: 5, y: 6, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
];
const villageB = [
  new Character({ x: 34, y: 34, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
  new Character({ x: 35, y: 34, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
];
const characters = [...villageA, ...villageB];

console.log(`สร้างโลกขนาด ${world.width}x${world.height} และตัวละคร ${characters.length} ตัว (2 กลุ่มตำแหน่งห่างกัน)`);
console.log(`xcoin เริ่มต้นของทุกตัวละคร: ${characters[0].wallet.balance}`);

const society = new SocietySystem();
const economy = new EconomySystem();

const YEARS_TO_SIMULATE = 15;
const TOTAL_TICKS = DEFAULT_TICKS_PER_YEAR * YEARS_TO_SIMULATE;

console.log(`\nเริ่มจำลอง ${YEARS_TO_SIMULATE} ปีในเกม (${TOTAL_TICKS} tick)\n`);

for (let t = 1; t <= TOTAL_TICKS; t++) {
  world.update(1);
  for (const character of characters) updateCharacter(character, world, characters, 1);
  const settlements = society.update(world, characters, t);
  const { inflationEvent } = economy.update(world);

  if (inflationEvent) {
    console.log(
      `=== ปีที่ ${inflationEvent.year} === อัตราเงินเฟ้อปีนี้: ${(inflationEvent.rate * 100).toFixed(2)}% ` +
        `| ดัชนีราคาสะสม: ${inflationEvent.cumulativeIndex.toFixed(3)}`,
    );

    if (settlements.length === 0) {
      console.log('  (ยังไม่มีถิ่นฐานเกิดขึ้น)');
    } else {
      for (const s of settlements) {
        const avgBalance = getSettlementAverageBalance(s, characters);
        console.log(
          `  ถิ่นฐาน #${s.id}: สมาชิก ${s.memberIds.length} คน, ยอด xcoin เฉลี่ย = ${avgBalance.toFixed(1)}`,
        );
      }
    }
  }
}

console.log('\nจบการสาธิตเฟส 6');
