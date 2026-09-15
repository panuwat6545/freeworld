import { World } from './world.js';

// สคริปต์สาธิตเฟส 1: สร้างโลก, เก็บเกี่ยวทรัพยากรบางส่วน, แล้วปล่อยเวลาผ่านไปดูการงอกใหม่
const world = new World({ seed: 42 });

console.log(`สร้างโลกขนาด ${world.width}x${world.height} สำเร็จ`);
console.log(`จำนวนจุดทรัพยากร: ${world.countResourceNodes()}`);
console.log('ปริมาณทรัพยากรเริ่มต้น:', world.getResourceTotals());

// หาช่องแรกที่มีทรัพยากรแล้วเก็บเกี่ยวจนเกือบหมด เพื่อดูว่ามันงอกกลับมาไหม
let harvestTarget = null;
world.grid.forEachCell((cell) => {
  if (!harvestTarget && cell.resourceNode) harvestTarget = cell;
});

if (harvestTarget) {
  const harvested = world.harvestAt(harvestTarget.x, harvestTarget.y, 1000);
  console.log(
    `เก็บเกี่ยว ${harvestTarget.resourceNode.type} ที่ (${harvestTarget.x}, ${harvestTarget.y}) ได้ ${harvested.toFixed(2)}`,
  );
}

for (let i = 0; i < 10; i++) {
  world.update(1);
}

console.log(`ผ่านไป ${world.tick} tick`);
if (harvestTarget) {
  console.log(
    `ปริมาณ ${harvestTarget.resourceNode.type} ที่จุดเดิมหลังงอกใหม่: ${harvestTarget.resourceNode.amount.toFixed(2)}`,
  );
}
console.log('ปริมาณทรัพยากรรวมหลังผ่านไป 10 tick:', world.getResourceTotals());
