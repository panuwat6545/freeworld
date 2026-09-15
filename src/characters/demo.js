import { World } from '../world/world.js';
import { Character } from './character.js';
import { updateCharacter } from './utility-ai.js';

// สร้างโลกแบบ seed คงที่เพื่อให้ผลลัพธ์ demo ทำนายได้
const world = new World({ seed: 99 });

// ตั้งค่าเริ่มต้นให้แต่ละตัวละครมี need ที่วิกฤตต่างกัน เพื่อโชว์ว่า Utility AI เลือกพฤติกรรมต่างกันจริง
const characters = [
  new Character({ x: 2, y: 2, needs: { hunger: 15, energy: 80, shelter: 80, social: 80 } }),
  new Character({ x: 10, y: 10, needs: { hunger: 80, energy: 15, shelter: 80, social: 80 } }),
  new Character({ x: 20, y: 20, needs: { hunger: 80, energy: 80, shelter: 15, social: 80 } }),
  new Character({ x: 30, y: 30, needs: { hunger: 80, energy: 80, shelter: 80, social: 15 } }),
  new Character({ x: 35, y: 5, needs: { hunger: 60, energy: 60, shelter: 60, social: 60 } }),
];

const TICKS = 15;

function formatNeeds(needs) {
  return Object.entries(needs)
    .map(([key, value]) => `${key}:${value.toFixed(1)}`)
    .join(' ');
}

console.log(`สร้างโลกขนาด ${world.width}x${world.height} และตัวละคร ${characters.length} ตัว`);

for (let t = 1; t <= TICKS; t++) {
  world.update(1);
  for (const character of characters) {
    updateCharacter(character, world, characters, 1);
  }

  console.log(`--- tick ${t} ---`);
  for (const character of characters) {
    console.log(
      `#${character.id} pos(${character.position.x},${character.position.y}) ` +
        `behavior=${character.currentBehavior} wood=${character.inventory.wood.toFixed(1)} ` +
        formatNeeds(character.needs),
    );
  }
}
