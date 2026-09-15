import { World } from '../world/world.js';
import { Character } from '../characters/character.js';
import { updateCharacter } from '../characters/utility-ai.js';
import { BEHAVIORS } from '../characters/behaviors.js';
import { BLUEPRINTS } from './blueprints.js';

// สร้างโลกแบบ seed คงที่เพื่อให้ผลลัพธ์ demo ทำนายได้
const world = new World({ seed: 7 });

// ตั้งค่าให้ shelter เป็น need ที่วิกฤตที่สุดตั้งแต่ต้น เพื่อโชว์ flow เก็บไม้ -> สร้างที่พัก
const character = new Character({
  x: 20,
  y: 20,
  needs: { hunger: 90, energy: 90, shelter: 5, social: 90 },
});

console.log(`สร้างโลกขนาด ${world.width}x${world.height} และตัวละคร #${character.id}`);
console.log(`สูตรที่พัก (blueprint): ${JSON.stringify(BLUEPRINTS.shelter.cost)}`);

const MAX_TICKS = 200;
let built = false;

for (let t = 1; t <= MAX_TICKS && !built; t++) {
  world.update(1);
  const behavior = updateCharacter(character, world, [character], 1);

  console.log(
    `tick ${t}: pos(${character.position.x},${character.position.y}) behavior=${behavior} ` +
      `wood=${character.inventory.wood.toFixed(1)} shelter=${character.needs.shelter.toFixed(1)}`,
  );

  if (behavior === BEHAVIORS.BUILD_SHELTER) {
    built = true;
  }
}

if (built) {
  const structure = world.structures[world.structures.length - 1];
  console.log('--- สร้างที่พักสำเร็จ ---');
  console.log(
    `สิ่งก่อสร้าง #${structure.id} ชนิด=${structure.type} ตำแหน่ง=(${structure.position.x},${structure.position.y}) ` +
      `สร้างที่ tick=${structure.builtAtTick} โดยตัวละคร #${structure.builtByCharacterId}`,
  );
  console.log(`ไม้ที่เหลือใน inventory หลังสร้าง: ${character.inventory.wood.toFixed(1)}`);
  console.log(`จำนวนสิ่งก่อสร้างทั้งหมดในโลก: ${world.structures.length}`);

  // โชว์ว่าพักใกล้ที่พักนี้ฟื้นพลังงานได้เร็วขึ้นจริง (ตั้งค่า need อื่นให้ปลอดภัยไว้ก่อน เพื่อบังคับให้เลือกพฤติกรรมพัก)
  character.needs = { hunger: 90, energy: 10, shelter: 90, social: 90 };
  const behaviorAfterBuild = updateCharacter(character, world, [character], 1);
  console.log(
    `หลังสร้างที่พักแล้ว พฤติกรรมพัก (${behaviorAfterBuild}) ฟื้นพลังงานเป็น ${character.needs.energy.toFixed(1)} ` +
      '(เร็วกว่าพักเฉยๆ เพราะอยู่ใกล้ที่พัก)',
  );
} else {
  console.log(`ยังสร้างที่พักไม่สำเร็จภายใน ${MAX_TICKS} tick`);
}
