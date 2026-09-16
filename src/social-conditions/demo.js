import { Character } from '../characters/character.js';
import { NEED_PRIORITY, NEEDS_CONFIG } from '../characters/needs-config.js';
import { Settlement } from '../society/settlement.js';
import { SettlementLawsetRegistry } from '../governance/settlement-lawset.js';
import { computeConditionIndices } from './condition-index.js';
import { computeDecayModifiers, NeedsConditionModifier } from './needs-condition-modifier.js';

// สคริปต์สาธิตเฟส 10 (need พื้นฐานที่เปลี่ยนแปลงไปตามสภาพสังคม): แสดงดัชนีสภาพสังคม 3 ตัว (ความฝืดเคือง/
// ความเหลื่อมล้ำ/ภาระกฎหมาย) กับ decay modifier ที่คำนวณได้จริงในสถานการณ์ต่างๆ ทาง console — ใช้คลาส/
// ฟังก์ชันจริงทั้งหมด (Settlement จากเฟส 4, SettlementLawsetRegistry จากเฟส 8, condition-index.js/
// needs-condition-modifier.js ของเฟสนี้) ไม่ hardcode ผลลัพธ์

function printScenario(label, settlement, characters, cumulativeIndex, lawsetRegistry) {
  const indices = computeConditionIndices(settlement, characters, cumulativeIndex, lawsetRegistry);
  const modifiers = computeDecayModifiers(indices);

  console.log(`\n--- ${label} ---`);
  console.log(
    `ดัชนี: ความฝืดเคือง=${indices.economicHardship.toFixed(2)}, ความเหลื่อมล้ำ=${indices.inequality.toFixed(2)}, ` +
      `ภาระกฎหมาย=${indices.lawBurden.toFixed(2)}`,
  );
  console.log(
    'decay modifier: ' + NEED_PRIORITY.map((key) => `${key}=${modifiers[key].toFixed(2)}`).join(' '),
  );
  return modifiers;
}

console.log('=== ส่วนที่ 1: ดัชนีสภาพสังคม + decay modifier ในสถานการณ์ต่างๆ ===');

// สถานการณ์ 1: ปกติทุกประการ — รายได้โตทันเงินเฟ้อพอดี ไม่มีความเหลื่อมล้ำ ไม่มีกฎหมายเปิดอยู่
{
  const settlement = new Settlement();
  const a = new Character({ needs: {} });
  const b = new Character({ needs: {} });
  a.wallet.balance = 100;
  b.wallet.balance = 100;
  settlement.memberIds = [a.id, b.id];
  const registry = new SettlementLawsetRegistry();

  printScenario('สถานการณ์ 1: ถิ่นฐานปกติ (ควรได้ modifier = 1.0 ทุกตัว)', settlement, [a, b], 1, registry);
}

// สถานการณ์ 2: เศรษฐกิจฝืดเคือง — เงินเฟ้อสะสมสูงมากแต่ wallet เฉลี่ยแทบไม่โต
{
  const settlement = new Settlement();
  const a = new Character({ needs: {} });
  const b = new Character({ needs: {} });
  a.wallet.balance = 60;
  b.wallet.balance = 40;
  settlement.memberIds = [a.id, b.id];
  const registry = new SettlementLawsetRegistry();

  printScenario(
    'สถานการณ์ 2: เศรษฐกิจฝืดเคือง (เงินเฟ้อสะสม 5 เท่า แต่ wallet เฉลี่ยแทบไม่โต) -> hunger ควรเร็วขึ้น',
    settlement,
    [a, b],
    5,
    registry,
  );
}

// สถานการณ์ 3: ความเหลื่อมล้ำสูง — สมาชิกบางคนรวยมาก บางคนจนมาก
{
  const settlement = new Settlement();
  const rich = new Character({ needs: {} });
  const poor = new Character({ needs: {} });
  rich.wallet.balance = 5000;
  poor.wallet.balance = 20;
  settlement.memberIds = [rich.id, poor.id];
  const registry = new SettlementLawsetRegistry();

  printScenario(
    'สถานการณ์ 3: ความเหลื่อมล้ำสูง (คนหนึ่งรวย 5000 อีกคนจน 20) -> social ควรเร็วขึ้น',
    settlement,
    [rich, poor],
    1,
    registry,
  );
}

// สถานการณ์ 4: ภาระกฎหมายสูง — ผู้นำเปิดทั้งภาษีการค้าอัตราสูงและสิทธิ์เขตแดนโหมด block
{
  const settlement = new Settlement();
  settlement.leaderId = 1;
  const a = new Character({ needs: {} });
  a.wallet.balance = 100;
  settlement.memberIds = [a.id];
  const registry = new SettlementLawsetRegistry();
  registry.enableLaw(settlement, 1, 'trade_tax', { rate: 0.4 });
  registry.enableLaw(settlement, 1, 'territorial_access', { mode: 'block' });

  printScenario(
    'สถานการณ์ 4: ภาระกฎหมายสูง (ภาษี 40% + เขตหวงห้ามโหมด block) -> shelter ควรเร็วขึ้น',
    settlement,
    [a],
    1,
    registry,
  );
}

// สถานการณ์ 5: แย่พร้อมกันทุกด้าน — โชว์ energy (ค่าเฉลี่ยของทั้ง 3 ดัชนี) แย่ลงชัดเจน
{
  const settlement = new Settlement();
  settlement.leaderId = 1;
  const a = new Character({ needs: {} });
  const b = new Character({ needs: {} });
  a.wallet.balance = 500;
  b.wallet.balance = 5;
  settlement.memberIds = [a.id, b.id];
  const registry = new SettlementLawsetRegistry();
  registry.enableLaw(settlement, 1, 'trade_tax', { rate: 0.5 });
  registry.enableLaw(settlement, 1, 'territorial_access', { mode: 'block' });

  printScenario(
    'สถานการณ์ 5: สภาพสังคมแย่พร้อมกันทุกด้าน -> energy (ภาพรวม) ควรแย่ลงชัดเจนที่สุด',
    settlement,
    [a, b],
    8,
    registry,
  );
}

console.log('\n=== ส่วนที่ 2: เปรียบเทียบ decay จริงระหว่างถิ่นฐานปกติกับถิ่นฐานที่สภาพสังคมย่ำแย่ ===');

const normalSettlement = new Settlement();
const normalCharacter = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
normalCharacter.homeSettlementId = normalSettlement.id;
normalSettlement.memberIds = [normalCharacter.id];
// รายได้โตทันเงินเฟ้อสมมติ (cumulativeIndex = 6) พอดี: STARTING_BALANCE(100) * 6 = 600 -> hardship = 1.0 (ปกติ)
normalCharacter.wallet.balance = 600;

const harshSettlement = new Settlement();
harshSettlement.leaderId = 999;
const harshCharacter = new Character({ needs: { hunger: 100, energy: 100, shelter: 100, social: 100 } });
harshCharacter.homeSettlementId = harshSettlement.id;
harshSettlement.memberIds = [harshCharacter.id];
harshCharacter.wallet.balance = 5; // ยากจนมากเทียบกับเงินเฟ้อสะสม

const registry = new SettlementLawsetRegistry();
registry.enableLaw(harshSettlement, 999, 'trade_tax', { rate: 0.5 });
registry.enableLaw(harshSettlement, 999, 'territorial_access', { mode: 'block' });

const modifier = new NeedsConditionModifier();
modifier.wrapCharacter(normalCharacter);
modifier.wrapCharacter(harshCharacter);

const CUMULATIVE_INDEX = 6; // เสมือนผ่านไปหลายปีจนเงินเฟ้อสะสมโตขึ้นมาก
const TICKS_TO_SIMULATE = 20;

console.log(`เปรียบเทียบ decay ${TICKS_TO_SIMULATE} tick (cumulativeIndex เงินเฟ้อสมมติ = ${CUMULATIVE_INDEX}):\n`);

for (let t = 1; t <= TICKS_TO_SIMULATE; t++) {
  modifier.updateSettlementModifiers([normalSettlement, harshSettlement], [normalCharacter, harshCharacter], CUMULATIVE_INDEX, registry);
  normalCharacter.decayNeeds(1);
  harshCharacter.decayNeeds(1);
}

console.log(
  `ถิ่นฐานปกติ #${normalSettlement.id}: ` +
    NEED_PRIORITY.map((key) => `${key}=${normalCharacter.needs[key].toFixed(1)}`).join(' '),
);
console.log(
  `ถิ่นฐานย่ำแย่ #${harshSettlement.id}: ` +
    NEED_PRIORITY.map((key) => `${key}=${harshCharacter.needs[key].toFixed(1)}`).join(' '),
);
console.log(
  `\nสรุป: หลังผ่านไป ${TICKS_TO_SIMULATE} tick เท่ากัน ตัวละครในถิ่นฐานย่ำแย่มี hunger ต่ำกว่าจริง ` +
    `${(normalCharacter.needs.hunger - harshCharacter.needs.hunger).toFixed(1)} หน่วย ` +
    `(อัตราฐานเดิม hunger decay = ${NEEDS_CONFIG.DECAY_RATE.hunger}/tick เท่ากันทั้งคู่ ต่างกันเพราะ modifier จากสภาพสังคมเท่านั้น)`,
);

console.log('\nจบการสาธิตเฟส 10');
