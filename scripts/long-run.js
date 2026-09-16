// เครื่องมือสำรวจ (ไม่ใช่ demo ปกติ ไม่นับรวมใน Definition of Done ของเฟสไหน)
// รันจำลองโลกยาว 30 ปีในเกม กับตัวละครหลายตัว แบบเงียบ (ไม่ log ทุก tick) เพื่อดูแนวโน้มระยะยาว
// ของ needs เฉลี่ย จำนวนที่พักที่สร้างสำเร็จสะสม และจับสัญญาณตัวละครที่ AI น่าจะมีปัญหา
// (need ตัวใดตัวหนึ่งค้างต่ำกว่า 20 ติดต่อกันนานเกิน 3 ปีเกม) รวมถึงระบบสังคม/ถิ่นฐาน (เฟส 4): จำนวน
// ถิ่นฐาน, ประชากรรวม (นับตัวละครที่เกิดใหม่ด้วย), ผู้นำแต่ละถิ่นฐาน, ระบบเศรษฐกิจ xcoin (เฟส 6):
// ยอด xcoin เฉลี่ยต่อถิ่นฐาน กับอัตราเงินเฟ้อ/ดัชนีราคาสะสม, ระบบแลกเปลี่ยน (เฟส 7): จำนวนธุรกรรมรวม
// แยกประเภท xcoin/barter สะสม, และระบบกฎหมาย/การปกครอง (เฟส 8): ครึ่งแรก (ปีที่ 0-15) ไม่มีกฎหมายเลย
// ครึ่งหลัง (ปีที่ 15-30) ให้ผู้นำทุกถิ่นฐาน ณ ตอนนั้นเปิดกฎหมายทั้ง 2 ข้อ เพื่อเทียบผลกระทบก่อน-หลัง
// (คลังภาษี/จำนวนครั้งที่ถูก block-penalize การเก็บทรัพยากร) และระบบอาชีพที่เกิดเอง (เฟส 9): การกระจาย
// อาชีพของตัวละครทั้งหมด (แทนที่ basic-income เดิมของเฟส 6 ทั้งหมด) รวมถึงระบบ need ที่เปลี่ยนตามสภาพสังคม
// (เฟส 10): ดัชนีความฝืดเคือง/ความเหลื่อมล้ำ/ภาระกฎหมายเฉลี่ยทั้งโลก กับ decay modifier เฉลี่ยของ need
// ทั้ง 4 ตัวทุก 5 ปี แล้วบันทึก snapshot สุดท้ายขึ้น Google Drive เหมือน demo:storage
import { World } from '../src/world/world.js';
import { Character } from '../src/characters/character.js';
import { updateCharacter } from '../src/characters/utility-ai.js';
import { NEED_PRIORITY } from '../src/characters/needs-config.js';
import { saveSnapshot } from '../src/storage/save-snapshot.js';
import { DEFAULT_TICKS_PER_YEAR } from '../src/storage/snapshot-scheduler.js';
import { SocietySystem } from '../src/society/society-system.js';
import { EconomySystem } from '../src/economy/economy-system.js';
import { InflationTracker } from '../src/economy/inflation.js';
import { getSettlementAverageBalance } from '../src/economy/settlement-economy.js';
import { TradeSystem } from '../src/trade/trade-system.js';
import { GovernanceSystem } from '../src/governance/governance-system.js';
import { createRng } from '../src/world/random.js';
import { PROFESSION_REGISTRY } from '../src/professions/profession.js';
import { ProfessionAssignmentTracker } from '../src/professions/profession-assignment.js';
import { IncomeSupportGenerator, ProfessionIncomeTracker } from '../src/professions/income-generation.js';
import { computeConditionIndices } from '../src/social-conditions/condition-index.js';
import { NeedsConditionModifier, computeDecayModifiers } from '../src/social-conditions/needs-condition-modifier.js';

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
  // ตัวละครที่เกิดใหม่จากการขยายเผ่าพันธุ์ (เฟส 4) ยังไม่มี entry มาก่อน สร้างให้ตอนเจอครั้งแรก
  if (!stuckStreaks.has(character.id)) {
    stuckStreaks.set(character.id, Object.fromEntries(NEED_PRIORITY.map((key) => [key, 0])));
    flaggedNeeds.set(character.id, new Set());
  }

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

function printReport(year, settlements) {
  const averages = averageNeeds();
  const shelterCount = world.structures.filter((s) => s.type === 'shelter').length;
  const problemCharacters = characters
    .map((c) => ({ id: c.id, needs: [...(flaggedNeeds.get(c.id) ?? [])] }))
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

  console.log(`จำนวนถิ่นฐาน: ${settlements.length} | ประชากรรวม: ${characters.length} ตัว`);
  if (settlements.length === 0) {
    console.log('  (ยังไม่มีถิ่นฐานเกิดขึ้น)');
  } else {
    for (const s of settlements) {
      const avgXcoin = getSettlementAverageBalance(s, characters);
      console.log(
        `  ถิ่นฐาน #${s.id}: สมาชิก ${s.memberIds.length} คน, ที่พัก ${s.structureIds.length} หลัง, ` +
          `ผู้นำ=${s.leaderId !== null ? `#${s.leaderId}` : 'ยังไม่มี'}, xcoin เฉลี่ย=${avgXcoin.toFixed(1)}`,
      );
    }
  }

  console.log(
    `ดัชนีราคาสะสม (เงินเฟ้อ): ${economy.inflation.cumulativeIndex.toFixed(3)} ` +
      `(เทียบเท่าเงินเฟ้อสะสม ${((economy.inflation.cumulativeIndex - 1) * 100).toFixed(1)}% จากปีที่ 0)`,
  );
  console.log(
    `ธุรกรรมสะสม: xcoin ${trade.totalXcoinTransactions} ครั้ง, barter ${trade.totalBarterTransactions} ครั้ง`,
  );

  console.log(
    `กฎหมาย: ${governanceEnabled ? 'เปิดใช้งานแล้ว (ทุกถิ่นฐาน ณ ตอนเปิด)' : 'ยังไม่เปิด'} | ` +
      `เก็บทรัพยากรถูก block สะสม ${governance.totalBlockedGathers} ครั้ง, penalty สะสม ${governance.totalPenalizedGathers} ครั้ง`,
  );
  if (settlements.length > 0) {
    for (const s of settlements) {
      const treasury = governance.getTreasuryBalance(s.id);
      if (treasury > 0) console.log(`  คลังถิ่นฐาน #${s.id} (จากภาษีการค้า): ${treasury.toFixed(1)} xcoin`);
    }
  }

  const unemployedCount = characters.filter((c) => c.profession === null).length;
  const distributionParts = PROFESSION_REGISTRY.map((p) => {
    const count = characters.filter((c) => c.profession === p.id).length;
    const income = professionIncome.getTotalIncome(p.id);
    return `${p.name}=${count}คน(รายได้สะสม ${income.toFixed(1)})`;
  });
  console.log(
    `อาชีพ: ${distributionParts.join(', ')}, ยังไม่มีอาชีพ=${unemployedCount}คน`,
  );

  if (settlements.length > 0) {
    const allIndices = settlements.map((s) =>
      computeConditionIndices(s, characters, economy.inflation.cumulativeIndex, governance.lawsetRegistry),
    );
    const allModifiers = allIndices.map((indices) => computeDecayModifiers(indices));
    const avgOf = (list, key) => list.reduce((sum, v) => sum + v[key], 0) / list.length;

    console.log(
      `ดัชนีสภาพสังคมเฉลี่ยทุกถิ่นฐาน: ความฝืดเคือง=${avgOf(allIndices, 'economicHardship').toFixed(2)}, ` +
        `ความเหลื่อมล้ำ=${avgOf(allIndices, 'inequality').toFixed(2)}, ภาระกฎหมาย=${avgOf(allIndices, 'lawBurden').toFixed(2)}`,
    );
    console.log(
      'decay modifier เฉลี่ยทุกถิ่นฐาน: ' +
        NEED_PRIORITY.map((key) => `${key}=${avgOf(allModifiers, key).toFixed(2)}`).join(' '),
    );
  }
}

// คำนวณเขตสี่เหลี่ยมล้อมรอบที่พักทั้งหมดของถิ่นฐาน (บวก margin) ใช้เป็นพารามิเตอร์ territorial_access
// — เป็นการตัดสินใจออกแบบง่ายๆ ให้เครื่องมือสำรวจนี้: "เขตของถิ่นฐาน" คือบริเวณรอบๆ ที่พักของตัวเอง
function computeSettlementTerritory(settlement, margin = 3) {
  const positions = world.structures.filter((s) => settlement.structureIds.includes(s.id)).map((s) => s.position);
  if (positions.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  return {
    minX: Math.max(0, Math.min(...xs) - margin),
    minY: Math.max(0, Math.min(...ys) - margin),
    maxX: Math.min(world.width - 1, Math.max(...xs) + margin),
    maxY: Math.min(world.height - 1, Math.max(...ys) + margin),
  };
}

// เรียกครั้งเดียวตอนเปลี่ยนเข้าสู่ครึ่งหลัง (ปีที่ 15): ให้ผู้นำทุกถิ่นฐาน ณ ตอนนั้นเปิดกฎหมายทั้ง 2 ข้อ
// ถิ่นฐานที่เพิ่งก่อตัวทีหลัง (หลังปีที่ 15) จะไม่ได้กฎหมายอัตโนมัติ (นอกขอบเขตของเครื่องมือสำรวจนี้)
function enableGovernanceForAllSettlements(settlements) {
  for (const settlement of settlements) {
    if (settlement.leaderId === null) continue;
    governance.lawsetRegistry.enableLaw(settlement, settlement.leaderId, 'trade_tax', { rate: 0.15 });
    governance.lawsetRegistry.enableLaw(
      settlement,
      settlement.leaderId,
      'territorial_access',
      computeSettlementTerritory(settlement),
    );
  }
}

const society = new SocietySystem();
// เฟส 6 (เงินเฟ้อ/รายได้พื้นฐาน) ใช้ Math.random() จริงโดย default ทำให้ผลรันแต่ละครั้งไม่เหมือนกัน
// ขัดกับหลักการ "ใช้ seed คงที่ให้ผลลัพธ์ทำนายได้" ของสคริปต์นี้ (ตั้งแต่เฟส 4/5 ที่ตัวละคร/โลกใช้ seed
// คงที่อยู่แล้ว) จึงฉีด RNG ที่มี seed คงที่ (createRng เดิมจาก src/world/random.js) เข้าไปแทน
const economy = new EconomySystem({
  inflation: new InflationTracker({ randomFn: createRng(20260916) }),
});
const trade = new TradeSystem();
const governance = new GovernanceSystem({ world });
let governanceEnabled = false;
// เฟส 9 (อาชีพที่เกิดเอง): แทนที่ BasicIncomeGenerator เดิมทั้งหมด — ตัวละครไม่มีอาชีพยังได้เงินเดือนขั้นต่ำ
// เต็มจำนวนเหมือนเดิม ส่วนตัวละครมีอาชีพแล้วได้แค่เศษเสี้ยว (EMPLOYED_STIPEND_FRACTION) เพื่อความเสถียร
// ของระบบ (ดูเหตุผล/การ tune เต็มใน README) ใช้ seed คงที่แยกจาก inflation เดิมเพื่อคงหลักการกำหนดเอง
const incomeSupport = new IncomeSupportGenerator({ randomFn: createRng(19700101) });
const professionAssignment = new ProfessionAssignmentTracker();
const professionIncome = new ProfessionIncomeTracker();
// เฟส 10 (need ตามสภาพสังคม): ห่อ character.decayNeeds จากภายนอกทั้งหมด ไม่แก้ needs-config.js/character.js
// เลย (ดูเหตุผล/การ tune เต็มใน README) ต้อง wrapCharacter() ตัวละครทุกตัวก่อนอย่างน้อยครั้งเดียว (เรียก
// ซ้ำได้ทุก tick อย่างปลอดภัย เพราะเป็น idempotent) แล้วอัปเดต modifier ของทุกถิ่นฐานก่อน updateCharacter()
const needsConditionModifier = new NeedsConditionModifier();
const GOVERNANCE_START_YEAR = 15; // ครึ่งแรก (0-15 ปี) ไม่มีกฎหมายเลย ครึ่งหลัง (15-30 ปี) เปิดกฎหมายทั้ง 2 ข้อ

const TOTAL_TICKS = TICKS_PER_YEAR * YEARS_TO_SIMULATE;
console.log(
  `เริ่มจำลอง ${YEARS_TO_SIMULATE} ปีในเกม (${TOTAL_TICKS} tick, ${TICKS_PER_YEAR} tick/ปี) ` +
    `กับตัวละคร ${characters.length} ตัว (แบบเงียบ สรุปผลทุก ${YEARS_PER_REPORT} ปี)`,
);

let settlements = []; // ผลจาก tick ก่อนหน้า ใช้บอก governance ว่าถิ่นฐานไหนบ้าง (มี lag 1 tick เหมือน
// ที่ home-tracker.js ของเฟส 4 ใช้ structureToSettlementId ที่อาจ stale ได้เล็กน้อยเช่นกัน)

for (let t = 1; t <= TOTAL_TICKS; t++) {
  world.update(1);

  if (!governanceEnabled && t === TICKS_PER_YEAR * GOVERNANCE_START_YEAR) {
    enableGovernanceForAllSettlements(settlements);
    governanceEnabled = true;
  }

  governance.setSettlements(settlements);
  // ใช้ settlements/cumulativeIndex ของ tick ก่อนหน้า (lag 1 tick เหมือน governance.setSettlements()
  // ด้านบน) คำนวณ modifier ก่อนเริ่ม loop ตัวละคร เพราะ decayNeeds ถูกเรียกเป็นบรรทัดแรกสุดใน updateCharacter()
  needsConditionModifier.updateSettlementModifiers(settlements, characters, economy.inflation.cumulativeIndex, governance.lawsetRegistry);
  for (const character of characters) {
    governance.setCurrentHarvester(character);
    needsConditionModifier.wrapCharacter(character);
    updateCharacter(character, world, characters, 1);
    updateStuckTracking(character);
    professionAssignment.observeBehavior(character, world, t);
  }
  governance.setCurrentHarvester(null);

  // เรียกหลัง update ตัวละครทุกตัวในรอบนี้เสร็จแล้ว (อาจ push ตัวละครใหม่เข้า characters ถ้าเกิดลูก
  // ซึ่งจะเข้าร่วมลูปรอบ tick ถัดไปโดยอัตโนมัติ)
  settlements = society.update(world, characters, t);
  economy.update(world);
  incomeSupport.checkAndPay(world, characters);
  const tradeEvents = trade.update(world, characters, economy.inflation.cumulativeIndex);
  governance.applyTradeLaws(tradeEvents, characters, settlements);
  professionAssignment.observeTradeEvents(tradeEvents, characters, t);
  professionIncome.observeTradeEvents(tradeEvents, characters);

  if (t % (TICKS_PER_YEAR * YEARS_PER_REPORT) === 0) {
    printReport(t / TICKS_PER_YEAR, settlements);
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
