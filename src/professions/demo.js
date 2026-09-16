import { World } from '../world/world.js';
import { Character } from '../characters/character.js';
import { updateCharacter } from '../characters/utility-ai.js';
import { EconomySystem } from '../economy/economy-system.js';
import { TradeSystem } from '../trade/trade-system.js';
import { TRADE_CONFIG } from '../trade/trade-config.js';
import { PROFESSIONS, PROFESSION_REGISTRY } from './profession.js';
import { ProfessionAssignmentTracker } from './profession-assignment.js';
import { IncomeSupportGenerator, ProfessionIncomeTracker } from './income-generation.js';

// สคริปต์สาธิตเฟส 9 (อาชีพที่เกิดขึ้นเองจากสังคม): แสดงว่าตัวละครที่ทำพฤติกรรมซ้ำๆ (เก็บไม้/หาอาหาร)
// บ่อยที่สุดในหน้าต่างเวลาหนึ่ง จะได้อาชีพตามพฤติกรรมนั้นโดยอัตโนมัติ แล้วรายได้จริงจากธุรกรรมเฟส 7 จะถูก
// นับแยกตามอาชีพ ส่วนตัวละครที่ยังไม่มีอาชีพชัดเจนยังได้เงินเดือนขั้นต่ำไปพลางๆ ไม่ให้อดตายก่อนมีอาชีพ

function professionLabelOf(character) {
  return PROFESSION_REGISTRY.find((p) => p.id === character.profession)?.name ?? 'ยังไม่มีอาชีพ';
}

// === ส่วนที่ 1: จำลองโลกจริง (utility AI + trade เฟส 7) ให้เห็นอาชีพเกิดขึ้นเองจากพฤติกรรมสะสม ===
const world = new World({ seed: 555 });

// จงใจตั้ง need ให้เห็นเส้นทางอาชีพต่างกันตั้งแต่ต้น: คนตัดไม้ (shelter ต่ำ -> ไปเก็บไม้บ่อย),
// คนทำฟาร์ม (hunger ต่ำ -> ไปหาอาหารบ่อย) ส่วนตัวที่ needs สมดุลหมด (90 เท่ากัน) จะเลือก seek_food ก่อน
// ตามลำดับ NEED_PRIORITY ของเฟส 2 (hunger มาก่อนเสมอเมื่อ needs เท่ากันพอดี) จึงกลายเป็นคนทำฟาร์มเช่นกัน —
// นี่คือพฤติกรรมจริงของ Utility AI เดิม ไม่ได้ถูกแก้ไขอะไรเลยเพื่อเฟสนี้ (ดูเหตุผลเต็มใน README)
const lumberjackCandidate = new Character({ x: 10, y: 10, needs: { hunger: 90, energy: 90, shelter: 10, social: 90 } });
const farmerCandidate = new Character({ x: 11, y: 10, needs: { hunger: 10, energy: 90, shelter: 90, social: 90 } });
const unemployedNewborn = new Character({ x: 12, y: 10, needs: { hunger: 90, energy: 90, shelter: 90, social: 90 } });

const characters = [lumberjackCandidate, farmerCandidate, unemployedNewborn];

console.log(`สร้างโลกขนาด ${world.width}x${world.height} และตัวละคร ${characters.length} ตัว (ยืนใกล้กันหมด)`);
console.log(`อาชีพที่มีในระบบ: ${PROFESSION_REGISTRY.map((p) => `${p.name}(${p.id})`).join(', ')}`);

const economy = new EconomySystem();
const trade = new TradeSystem();
const professionAssignment = new ProfessionAssignmentTracker({ windowTicks: 150 });
const incomeSupport = new IncomeSupportGenerator({ ticksPerYear: 100, randomFn: () => 0.5 });
const professionIncome = new ProfessionIncomeTracker();

const YEARS_TO_SIMULATE = 5;
const TICKS_PER_YEAR = 100;
const TOTAL_TICKS = TICKS_PER_YEAR * YEARS_TO_SIMULATE;
const lastReportedProfession = new Map(characters.map((c) => [c.id, c.profession]));

console.log(`\nเริ่มจำลอง ${YEARS_TO_SIMULATE} ปีในเกม (${TOTAL_TICKS} tick, ${TICKS_PER_YEAR} tick/ปี)\n`);

for (let t = 1; t <= TOTAL_TICKS; t++) {
  world.update(1);
  for (const character of characters) {
    updateCharacter(character, world, characters, 1);
    professionAssignment.observeBehavior(character, world, t);
  }

  economy.update(world);
  incomeSupport.checkAndPay(world, characters);
  const tradeEvents = trade.update(world, characters, economy.inflation.cumulativeIndex);
  professionAssignment.observeTradeEvents(tradeEvents, characters, t);
  professionIncome.observeTradeEvents(tradeEvents, characters);

  for (const character of characters) {
    if (character.profession !== lastReportedProfession.get(character.id)) {
      lastReportedProfession.set(character.id, character.profession);
      console.log(
        `[tick ${t}] ตัวละคร #${character.id} ได้อาชีพใหม่: ${professionLabelOf(character)} ` +
          `(xcoin ปัจจุบัน: ${character.wallet.balance.toFixed(1)})`,
      );
    }
  }

  if (t % TICKS_PER_YEAR === 0) {
    console.log(
      `--- สรุปปีที่ ${t / TICKS_PER_YEAR}: ` +
        characters.map((c) => `#${c.id}=${professionLabelOf(c)}(${c.wallet.balance.toFixed(1)} xcoin)`).join(', '),
    );
  }
}

console.log('\n=== สรุปผลส่วนที่ 1 ===');
for (const character of characters) {
  console.log(`ตัวละคร #${character.id}: อาชีพ=${professionLabelOf(character)}, xcoin=${character.wallet.balance.toFixed(1)}`);
}
console.log('รายได้สะสมแยกตามอาชีพ (จากธุรกรรมจริงเฟส 7 เท่านั้น):');
for (const profession of PROFESSION_REGISTRY) {
  console.log(`  ${profession.name}: ${professionIncome.getTotalIncome(profession.id).toFixed(1)} xcoin`);
}
console.log(
  `ธุรกรรมสะสม: xcoin ${trade.totalXcoinTransactions} ครั้ง, barter ${trade.totalBarterTransactions} ครั้ง ` +
    `(WOOD_SURPLUS_THRESHOLD=${TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD} ใช้ตัดสิน "ไม้ส่วนเกิน" ของเฟส 7)`,
);

// === ส่วนที่ 2: อาชีพ "คนรับจ้าง" (freelancer) สังเกตจาก trade event ไม่ใช่ currentBehavior โดยตรง ===
// ในเกมจริงต้องรอให้ตัวละครถูกจ้างเป็น helper บ่อยพอถึงจะกลายเป็นคนรับจ้าง แต่ในโลกเล็กๆ ของส่วนที่ 1
// เหตุการณ์นี้เกิดไม่บ่อยพอให้เห็นภายในเวลาสาธิตสั้นๆ (ธุรกรรมทั้งหมดที่เกิดขึ้นจริงมีน้อยครั้ง เพราะ
// เงื่อนไข canTransact ของเฟส 7 เข้มงวดมาก) จึงจำลองเหตุการณ์ "ถูกจ้างเป็น helper" ซ้ำๆ ตรงๆ ผ่าน
// observeTradeEvents() (API เดียวกับที่ scripts/long-run.js เรียกจริงทุก tick) เพื่อแสดงกลไกการกำหนด
// อาชีพจากพฤติกรรม/เหตุการณ์สะสมให้เห็นชัดเจน โดยไม่ต้องรอโอกาสสุ่มเกิดขึ้นเองนานๆ
console.log('\n=== ส่วนที่ 2: จำลองอาชีพ "คนรับจ้าง" จากเหตุการณ์ถูกจ้างซ้ำๆ ===');
const freelancerDemo = new Character({ needs: {} });
const freelancerTracker = new ProfessionAssignmentTracker({ windowTicks: 100 });
console.log(`ก่อนถูกจ้าง: ตัวละคร #${freelancerDemo.id} อาชีพ=${professionLabelOf(freelancerDemo)}`);

// ต้องสะสมน้ำหนักถึง MIN_WEIGHT_TO_ASSIGN (เกณฑ์ขั้นต่ำกันพฤติกรรมแค่ 1-2 ครั้งถูกนับเป็นอาชีพทันที)
// ก่อนถึงจะได้อาชีพจริง — ลูปให้พอเกินเกณฑ์นั้น
for (let tick = 1; tick <= 25; tick++) {
  const serviceDeal = { kind: 'service', service: 'energy_help', helperId: freelancerDemo.id, buyerId: 999 };
  freelancerTracker.observeTradeEvents([serviceDeal], [freelancerDemo], tick);
}
console.log(
  `หลังถูกจ้างเป็น helper ต่อเนื่อง 25 ครั้ง: ตัวละคร #${freelancerDemo.id} อาชีพ=${professionLabelOf(freelancerDemo)} ` +
    `(ตรงกับ PROFESSIONS.FREELANCER = "${PROFESSIONS.FREELANCER}")`,
);

console.log('\nจบการสาธิตเฟส 9');
