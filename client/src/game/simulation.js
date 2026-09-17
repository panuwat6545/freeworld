// ห่อระบบทั้งหมดของเฟส 1-10 (src/world, characters, building ผ่าน utility-ai/behaviors, society, economy,
// trade, governance, professions, social-conditions) เป็น "เกมที่เล่นสดในเบราว์เซอร์ได้" ตัวเดียว — โครงสร้าง
// เดียวกับ scripts/long-run.js (เครื่องมือสำรวจของเฟส 1-10) ทุกประการ เพียงแต่ตัดส่วน "silent + flag
// tracking" ที่เป็นของเครื่องมือวินิจฉัยออก เพราะที่นี่ต้องการ "รันสดให้เห็นบนจอ" ไม่ใช่รันเงียบแล้วสรุปท้าย
// ไม่มีการแก้ logic เดิมใน src/ เลยแม้แต่บรรทัดเดียว — import ตรงๆ ทั้งหมด (import "ตรงๆ" ตามที่สั่ง)
import { World } from '../../../src/world/world.js';
import { Character } from '../../../src/characters/character.js';
import { updateCharacter } from '../../../src/characters/utility-ai.js';
import { NEED_PRIORITY } from '../../../src/characters/needs-config.js';
import { SocietySystem } from '../../../src/society/society-system.js';
import { EconomySystem } from '../../../src/economy/economy-system.js';
import { InflationTracker } from '../../../src/economy/inflation.js';
import { getSettlementAverageBalance } from '../../../src/economy/settlement-economy.js';
import { TradeSystem } from '../../../src/trade/trade-system.js';
import { GovernanceSystem } from '../../../src/governance/governance-system.js';
import { createRng } from '../../../src/world/random.js';
import { ProfessionAssignmentTracker } from '../../../src/professions/profession-assignment.js';
import { IncomeSupportGenerator, ProfessionIncomeTracker } from '../../../src/professions/income-generation.js';
import { NeedsConditionModifier } from '../../../src/social-conditions/needs-condition-modifier.js';

export const TICKS_PER_YEAR = 365;
const CHARACTER_COUNT = 9;

// สร้างโลก+ตัวละครตั้งต้นแบบเดียวกับ scripts/long-run.js (กระจายตำแหน่งทั่วโลก สลับ need วิกฤตแต่ละตัว)
// เพื่อให้ถิ่นฐาน/อาชีพ/เศรษฐกิจเกิดขึ้นได้จริงตั้งแต่ต้นเกมเหมือนที่ผ่านการ tune มาแล้วในเฟส 1-10 ทั้งหมด
function createInitialCharacters(world) {
  const characters = [];
  for (let i = 0; i < CHARACTER_COUNT; i++) {
    const x = Math.floor((i * world.width) / CHARACTER_COUNT) + 1;
    const y = Math.floor(((i * 7) % CHARACTER_COUNT) * (world.height / CHARACTER_COUNT)) + 1;
    const skewedNeed = NEED_PRIORITY[i % NEED_PRIORITY.length];
    const needs = { hunger: 70, energy: 70, shelter: 70, social: 70, [skewedNeed]: 30 };
    characters.push(new Character({ x, y, needs }));
  }
  return characters;
}

// จุดรวมสถานะเกมที่รันสด — ไม่เก็บ log/flag วินิจฉัยแบบ long-run.js เพราะจุดประสงค์ต่างกัน (เล่นสด ไม่ใช่
// สำรวจ) แต่ยังคง "เชื่อมทุกระบบเข้าด้วยกันแบบเดียวกันทุกประการ" เพื่อไม่ให้พฤติกรรมต่างจากที่ tune ไว้
export class Simulation {
  constructor({ seed = 12345 } = {}) {
    this.world = new World({ seed });
    this.characters = createInitialCharacters(this.world);
    this.settlements = [];
    this.tick = 0;

    this.society = new SocietySystem();
    this.economy = new EconomySystem({ inflation: new InflationTracker({ randomFn: createRng(seed + 1) }) });
    this.trade = new TradeSystem();
    this.governance = new GovernanceSystem({ world: this.world });
    this.incomeSupport = new IncomeSupportGenerator({ randomFn: createRng(seed + 2) });
    this.professionAssignment = new ProfessionAssignmentTracker();
    this.professionIncome = new ProfessionIncomeTracker();
    this.needsConditionModifier = new NeedsConditionModifier();
  }

  // เดินหน้าไปทีละ 1 tick พอดี (ลำดับ/การเชื่อมระบบเดียวกับ scripts/long-run.js เป๊ะ)
  stepOneTick() {
    this.tick += 1;
    this.world.update(1);

    this.governance.setSettlements(this.settlements);
    this.needsConditionModifier.updateSettlementModifiers(
      this.settlements,
      this.characters,
      this.economy.inflation.cumulativeIndex,
      this.governance.lawsetRegistry,
    );
    for (const character of this.characters) {
      this.governance.setCurrentHarvester(character);
      this.needsConditionModifier.wrapCharacter(character);
      updateCharacter(character, this.world, this.characters, 1);
      this.professionAssignment.observeBehavior(character, this.world, this.tick);
    }
    this.governance.setCurrentHarvester(null);

    this.settlements = this.society.update(this.world, this.characters, this.tick);
    this.economy.update(this.world);
    this.incomeSupport.checkAndPay(this.world, this.characters);
    const tradeEvents = this.trade.update(this.world, this.characters, this.economy.inflation.cumulativeIndex);
    this.governance.applyTradeLaws(tradeEvents, this.characters, this.settlements);
    this.professionAssignment.observeTradeEvents(tradeEvents, this.characters, this.tick);
    this.professionIncome.observeTradeEvents(tradeEvents, this.characters);
  }

  step(ticks) {
    for (let i = 0; i < ticks; i++) this.stepOneTick();
  }

  get gameYear() {
    return this.tick / TICKS_PER_YEAR;
  }

  getCharacterById(id) {
    return this.characters.find((c) => c.id === id) ?? null;
  }

  getSettlementXcoinAverage(settlement) {
    return getSettlementAverageBalance(settlement, this.characters);
  }
}
