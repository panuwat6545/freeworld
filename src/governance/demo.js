import { World } from '../world/world.js';
import { Character } from '../characters/character.js';
import { updateCharacter } from '../characters/utility-ai.js';
import { ResourceNode } from '../world/resource-node.js';
import { RESOURCE_TYPES } from '../world/resource-types.js';
import { SocietySystem } from '../society/society-system.js';
import { EconomySystem } from '../economy/economy-system.js';
import { TradeSystem } from '../trade/trade-system.js';
import { GovernanceSystem } from './governance-system.js';

// สคริปต์สาธิตเฟส 8 (กฎหมาย/การปกครอง): ผู้นำถิ่นฐานเปิดกฎหมายแต่ละข้อ แล้วแสดงผลกระทบจริงทาง console
// ผ่านระบบจริงทั้งหมด (SocietySystem, EconomySystem, TradeSystem, GovernanceSystem) ไม่ hardcode ผลลัพธ์
// stage 1 ปล่อยให้ถิ่นฐาน 2 กลุ่มก่อตัวเอง (เหมือน demo:society) stage 2-3 บังคับสถานการณ์บางส่วนเพื่อโชว์
// ผลของกฎหมายแต่ละข้อให้เห็นชัดภายในเวลาสั้นๆ

const world = new World({ seed: 2468 });

const villageA = [
  new Character({ x: 5, y: 5, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
  new Character({ x: 6, y: 5, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
];
const villageB = [
  new Character({ x: 34, y: 34, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
  new Character({ x: 35, y: 34, needs: { hunger: 90, energy: 90, shelter: 5, social: 90 } }),
];
const characters = [...villageA, ...villageB];

console.log(`สร้างโลกขนาด ${world.width}x${world.height} และตัวละคร ${characters.length} ตัว (2 หมู่บ้าน)`);

const society = new SocietySystem();
const economy = new EconomySystem();
const trade = new TradeSystem();
const governance = new GovernanceSystem({ world });

let settlements = [];

function runTicks(count, tickOffset, onTick) {
  for (let i = 1; i <= count; i++) {
    const t = tickOffset + i;
    world.update(1);
    governance.setSettlements(settlements);
    for (const character of characters) {
      governance.setCurrentHarvester(character);
      updateCharacter(character, world, characters, 1);
    }
    governance.setCurrentHarvester(null);
    settlements = society.update(world, characters, t);
    economy.update(world, characters);
    const tradeEvents = trade.update(world, characters, economy.inflation.cumulativeIndex);
    const lawEffects = governance.applyTradeLaws(tradeEvents, characters, settlements);
    onTick?.(t, tradeEvents, lawEffects);
  }
}

console.log('\n--- stage 1: ปล่อยให้ถิ่นฐานก่อตัวเอง (บังคับ shelter วิกฤตสุดตั้งแต่ต้น) ---');
runTicks(200, 0);

console.log('สรุปถิ่นฐานหลัง stage 1:');
for (const s of settlements) {
  console.log(`  ถิ่นฐาน #${s.id}: สมาชิก=[${s.memberIds.join(',')}] ผู้นำ=#${s.leaderId}`);
}

const settlementA = settlements.find((s) => s.memberIds.includes(villageA[0].id));
const settlementB = settlements.find((s) => s.memberIds.includes(villageB[0].id));

if (settlementA) {
  console.log(`\n--- stage 2: ผู้นำถิ่นฐาน #${settlementA.id} (#${settlementA.leaderId}) เปิด "ภาษีการค้า" 20% ---`);
  const result = governance.lawsetRegistry.enableLaw(settlementA, settlementA.leaderId, 'trade_tax', { rate: 0.2 });
  console.log(`ผลการเปิดกฎหมาย: ${JSON.stringify(result)}`);

  // บังคับให้สมาชิกถิ่นฐาน A ทำธุรกรรมกันแน่ๆ ในไม่กี่ tick เพื่อโชว์การหักภาษี (เหมือน demo:trade)
  const [memberX, memberY] = characters.filter((c) => settlementA.memberIds.includes(c.id));
  if (memberX && memberY) {
    memberX.position = { x: memberY.position.x, y: memberY.position.y };
    memberX.needs.energy = 20;
    memberY.needs.energy = 90;
    memberY.needs.hunger = 90;
    memberY.needs.shelter = 90;
    memberY.needs.social = 90;
  }

  runTicks(50, 200, (t, tradeEvents, lawEffects) => {
    for (const deal of tradeEvents) {
      console.log(`[tick ${t}] ธุรกรรม: ${JSON.stringify(deal)}`);
    }
    for (const effect of lawEffects) {
      console.log(
        `[tick ${t}] >>> ภาษีการค้า: ตัวละคร #${effect.payerId} ถูกหัก ${effect.amount.toFixed(2)} xcoin ` +
          `เข้าคลังถิ่นฐาน #${effect.settlementId} (คลังตอนนี้ = ${governance.getTreasuryBalance(effect.settlementId).toFixed(2)})`,
      );
    }
  });
} else {
  console.log('\n--- ข้าม stage 2: ถิ่นฐาน A ยังไม่ก่อตัวสำเร็จใน stage 1 ---');
}

if (settlementB) {
  console.log(
    `\n--- stage 3: ผู้นำถิ่นฐาน #${settlementB.id} (#${settlementB.leaderId}) ประกาศเขตหวงห้าม (30,30)-(40,40) โหมด block ---`,
  );
  const result = governance.lawsetRegistry.enableLaw(settlementB, settlementB.leaderId, 'territorial_access', {
    minX: 30,
    minY: 30,
    maxX: 40,
    maxY: 40,
    mode: 'block',
  });
  console.log(`ผลการเปิดกฎหมาย: ${JSON.stringify(result)}`);

  world.grid.getCell(36, 36).resourceNode = new ResourceNode(RESOURCE_TYPES.WOOD, {
    amount: 100,
    maxAmount: 100,
    regenRate: 1,
  });

  governance.setSettlements(settlements);

  const outsider = characters.find((c) => settlementA?.memberIds.includes(c.id)) ?? villageA[0];
  governance.setCurrentHarvester(outsider);
  const outsiderHarvest = world.harvestAt(36, 36, 10);
  console.log(
    `ตัวละครนอกถิ่นฐาน #${outsider.id} พยายามเก็บไม้ในเขตหวงห้าม (36,36): เก็บได้ ${outsiderHarvest} หน่วย ` +
      `(คาดว่า 0 เพราะโดน block)`,
  );

  const member = characters.find((c) => settlementB.memberIds.includes(c.id));
  governance.setCurrentHarvester(member);
  const memberHarvest = world.harvestAt(36, 36, 10);
  console.log(`ตัวละครในถิ่นฐาน #${member.id} เก็บไม้ในเขตของตัวเอง (36,36): เก็บได้ ${memberHarvest} หน่วย (ปกติ)`);
} else {
  console.log('\n--- ข้าม stage 3: ถิ่นฐาน B ยังไม่ก่อตัวสำเร็จใน stage 1 ---');
}

console.log('\nจบการสาธิตเฟส 8');
