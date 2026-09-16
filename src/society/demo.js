import { World } from '../world/world.js';
import { Character } from '../characters/character.js';
import { updateCharacter } from '../characters/utility-ai.js';
import { BLUEPRINTS } from '../building/blueprints.js';
import { SocietySystem } from './society-system.js';
import { SETTLEMENT_CONFIG } from './settlement-config.js';

// สคริปต์สาธิตเฟส 4 (ระบบสังคม/ถิ่นฐาน): แสดง 3 เรื่องหลักทาง console ผ่านกลไกจริงของเกม (ไม่ hardcode
// ผลลัพธ์) คือ (1) ถิ่นฐานก่อตัวเองจากตำแหน่งที่พักที่ตัวละครสร้างจริง (2) ผู้นำถิ่นฐานเปลี่ยนมือได้เมื่อ
// มีสมาชิกสร้างที่พักแซงหน้า (3) ตัวละครใหม่เกิดจากการขยายเผ่าพันธุ์เมื่อเงื่อนไข social/ระยะห่างครบ
// stage 2 และ 3 ตั้งค่าตัวละครบางส่วนแบบจงใจ (เหมือน demo:building) เพื่อบังคับให้เห็นผลไวภายในเวลาสั้นๆ
// แทนที่จะรอให้เกิดขึ้นเองตามธรรมชาติซึ่งอาจใช้เวลาหลายปีเกม — แต่ log เกิด/ผู้นำเปลี่ยนไว้ทุก stage
// เพราะระบบอาจทำงาน "เกิดเองตามธรรมชาติ" ได้ทุกเมื่อ (เช่นตัวละครกลุ่มแรกอยู่ใกล้กัน + social สูงพออยู่แล้ว)

const world = new World({ seed: 555 });

// 2 กลุ่มตำแหน่งห่างกันมาก (เกิน CLUSTER_RADIUS แน่นอน) เพื่อโชว์ว่าถิ่นฐานเกิดขึ้นเองตามตำแหน่งสร้างบ้าน
const villageA = [
  new Character({ x: 5, y: 5, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
  new Character({ x: 6, y: 5, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
];
const villageB = [
  new Character({ x: 34, y: 34, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
  new Character({ x: 35, y: 34, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
];
const characters = [...villageA, ...villageB];

console.log(`สร้างโลกขนาด ${world.width}x${world.height} และตัวละคร ${characters.length} ตัว (2 กลุ่มตำแหน่งห่างกัน)`);
console.log(
  `CLUSTER_RADIUS=${SETTLEMENT_CONFIG.CLUSTER_RADIUS}, ` +
    `DETECTION_INTERVAL_TICKS=${SETTLEMENT_CONFIG.DETECTION_INTERVAL_TICKS}`,
);

const society = new SocietySystem();
const lastLeaderBySettlement = new Map();
let lastSettlementCount = 0;
let lastPopulation = characters.length;

// เรียกทุก tick หลัง update ตัวละครเสร็จ: log ทั้งการเปลี่ยนแปลงถิ่นฐาน/ผู้นำ และตัวละครใหม่ที่เกิด
// (เกิดได้ทุก stage จริงๆ ไม่ใช่แค่ stage 3 ที่ตั้งใจบังคับ — ถ้าตัวละครกลุ่มไหนบังเอิญเข้าเงื่อนไขเองก็โชว์ด้วย)
function reportChanges(settlements, tick) {
  if (settlements.length !== lastSettlementCount) {
    console.log(`[tick ${tick}] จำนวนถิ่นฐานทั้งหมดตอนนี้: ${settlements.length}`);
    lastSettlementCount = settlements.length;
  }
  for (const s of settlements) {
    if (s.leaderId !== lastLeaderBySettlement.get(s.id)) {
      console.log(
        `[tick ${tick}] ถิ่นฐาน #${s.id} (สมาชิก ${s.memberIds.length} คน, ที่พัก ${s.structureIds.length} หลัง) ` +
          `ผู้นำ: ${s.leaderId !== null ? `#${s.leaderId}` : 'ยังไม่มี'}`,
      );
      lastLeaderBySettlement.set(s.id, s.leaderId);
    }
  }
  if (characters.length > lastPopulation) {
    for (let i = lastPopulation; i < characters.length; i++) {
      const child = characters[i];
      console.log(
        `[tick ${tick}] >>> เกิดตัวละครใหม่ #${child.id} ที่ตำแหน่ง (${child.position.x},${child.position.y}) ` +
          `ในถิ่นฐาน #${child.homeSettlementId}`,
      );
    }
    lastPopulation = characters.length;
  }
}

console.log('\n--- stage 1: ปล่อยให้ตัวละครสร้างที่พักเองตามธรรมชาติ (บังคับ shelter เป็น need วิกฤตสุดตั้งแต่ต้น) ---');
const STAGE1_TICKS = 200;
for (let t = 1; t <= STAGE1_TICKS; t++) {
  world.update(1);
  for (const character of characters) updateCharacter(character, world, characters, 1);
  reportChanges(society.update(world, characters, t), t);
}

console.log('\nสรุปถิ่นฐานหลัง stage 1:');
for (const s of society.detector.settlements) {
  console.log(
    `  ถิ่นฐาน #${s.id}: สมาชิก=[${s.memberIds.join(',')}] ที่พัก=${s.structureIds.length} หลัง ผู้นำ=#${s.leaderId}`,
  );
}

// stage 2: บังคับสมาชิกที่ไม่ใช่ผู้นำของถิ่นฐาน A ให้สร้างที่พักเพิ่มอีก 1 หลัง "แซงหน้า" ผู้นำเดิม
// (ยืนที่ตำแหน่งเดียวกับที่พักเดิมของถิ่นฐาน A พอดี + มีไม้พร้อมสร้างทันที กันหลุดไปไกลจนกลายเป็นถิ่นฐานใหม่)
const settlementA = society.detector.settlements.find((s) => s.memberIds.includes(villageA[0].id));
if (settlementA && settlementA.memberIds.length >= 2) {
  const challenger = characters.find((c) => settlementA.memberIds.includes(c.id) && c.id !== settlementA.leaderId);
  const existingStructure = world.structures.find((s) => settlementA.structureIds.includes(s.id));

  if (challenger && existingStructure) {
    console.log(
      `\n--- stage 2: บังคับตัวละคร #${challenger.id} สร้างที่พักเพิ่มอีก 1 หลังในถิ่นฐาน #${settlementA.id} เพื่อแซงเป็นผู้นำ ---`,
    );
    challenger.position = { ...existingStructure.position };
    challenger.needs = { hunger: 90, energy: 90, shelter: 5, social: 90 };
    challenger.inventory.wood = BLUEPRINTS.shelter.cost.wood; // มีไม้พร้อมสร้างทันที ไม่ต้องเดินไปเก็บใหม่

    const STAGE2_TICKS = 20;
    for (let t = STAGE1_TICKS + 1; t <= STAGE1_TICKS + STAGE2_TICKS; t++) {
      world.update(1);
      for (const character of characters) updateCharacter(character, world, characters, 1);
      reportChanges(society.update(world, characters, t), t);
    }
  } else {
    console.log('\n--- ข้าม stage 2: ถิ่นฐาน A ยังไม่มีที่พัก/สมาชิกพอให้สาธิตการแซงตำแหน่งผู้นำ ---');
  }
} else {
  console.log('\n--- ข้าม stage 2: ถิ่นฐาน A ยังไม่มีสมาชิกครบ 2 คน (สร้างที่พักไม่สำเร็จใน stage 1) ---');
}

// stage 3: ถ้ายังไม่มีใครเกิดเองระหว่าง stage 1-2 ให้บังคับ 2 ตัวละครในถิ่นฐาน A ยืนติดกัน + social สูง
// ต่อเนื่องครบ REPRODUCTION_TICKS_REQUIRED tick (pin needs ทั้งหมดไว้ทุก tick ไม่ให้ AI เดินหนีไปทำ
// อย่างอื่นหรือปล่อย social ตกต่ำกว่า threshold ก่อนครบเงื่อนไข) เพื่อโชว์การเกิดลูกแน่ๆ ไม่ว่าจะ tune
// ค่า config ไว้เท่าไหร่ก็ตาม
if (characters.length === 4) {
  console.log('\n--- stage 3: บังคับ 2 ตัวละครในถิ่นฐาน A ให้อยู่ติดกัน + social สูง เพื่อโชว์การเกิดลูก ---');
  const [parentA, parentB] = villageA;
  const pinnedPosition = { x: parentA.position.x, y: parentA.position.y };
  const STAGE3_MAX_TICKS = SETTLEMENT_CONFIG.REPRODUCTION_TICKS_REQUIRED + 50; // เผื่อ margin เกินพอ

  for (let i = 1; i <= STAGE3_MAX_TICKS; i++) {
    const t = STAGE1_TICKS + 1000 + i; // เว้นช่วง tick ให้ชัดเจนว่าเป็นคนละ stage กับด้านบน
    world.update(1);
    for (const character of characters) {
      if (character === parentA || character === parentB) {
        // pin needs ทั้งหมดไว้สูงคงที่ (ไม่ให้ social ตกต่ำกว่า threshold แม้ streak ที่ต้องการจะยาวแค่ไหน)
        character.needs.hunger = 95;
        character.needs.energy = 95;
        character.needs.shelter = 95;
        character.needs.social = 100;
        character.position = { ...pinnedPosition };
      } else {
        updateCharacter(character, world, characters, 1);
      }
    }
    reportChanges(society.update(world, characters, t), t);

    if (characters.length > 4) break;
  }

  if (characters.length === 4) {
    console.log('ยังไม่มีตัวละครใหม่เกิดภายใน stage 3 (ลองเพิ่ม STAGE3_MAX_TICKS ถ้าอยากเห็นผลจริงแน่ๆ)');
  }
} else {
  console.log('\n--- ข้าม stage 3: มีตัวละครใหม่เกิดขึ้นเองแล้วระหว่าง stage 1-2 (ดู log ด้านบน) ---');
}

console.log(`\nประชากรรวมสุดท้าย: ${characters.length} ตัว`);
console.log('จบการสาธิตเฟส 4');
