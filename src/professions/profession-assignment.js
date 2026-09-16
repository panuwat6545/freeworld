import { PROFESSIONS, getProfessionByBehavior } from './profession.js';
import { RESOURCE_CONFIG } from '../world/resource-types.js';

// หน้าต่างเวลา (แบบ tumbling window เหมือน HOME_TRACKING_WINDOW_TICKS ของเฟส 4) ที่ใช้นับว่าตัวละครทำ
// พฤติกรรมที่ผูกกับอาชีพไหนบ่อยสุด — ครบช่วงแล้วเริ่มนับใหม่ ทำให้ตัวละครเปลี่ยนอาชีพได้จริงถ้าพฤติกรรม
// เปลี่ยนไปนานพอ (ไม่ตายตัวถาวรตามสเปก)
const PROFESSION_WINDOW_TICKS = 200;

// น้ำหนักสะสมขั้นต่ำก่อนจะยอมตัดสินอาชีพให้ (ทั้งการตัดสินครั้งแรกจาก "ยังไม่มีอาชีพ" และการเปลี่ยนอาชีพ
// ครั้งถัดๆ ไป) กันไม่ให้พฤติกรรมแค่ 1 ครั้งเดียว (เช่น hunger/energy/shelter/social เท่ากันพอดีตอนเริ่มต้น
// แล้ว getMostUrgentNeed ของเฟส 2 เลือก seek_food ไปตามลำดับ NEED_PRIORITY เป็นค่าเริ่มต้น) เพียงพอจะถูก
// นับเป็น "อาชีพ" ทันที ต้องทำพฤติกรรมนั้นสะสมพอควรก่อนจริงๆ ตามความหมายของ "พฤติกรรมสะสม" ในสเปก — ผลข้าง
// เคียงที่สำคัญ: ตัวละครที่พฤติกรรมยังไม่นิ่งพอ (รวมถึงตัวละครเกิดใหม่ส่วนใหญ่) จะยังคง profession=null
// (ได้รับรายได้พื้นฐานเล็กน้อยจาก IncomeSupportGenerator ต่อไป) นานพอสมควร แทนที่จะถูกจัดเป็นอาชีพใด
// อาชีพหนึ่งทันทีตั้งแต่ tick แรก (ดูการวินิจฉัยเต็มใน README ว่าทำไมเรื่องนี้สำคัญต่อเสถียรภาพเศรษฐกิจ)
const MIN_WEIGHT_TO_ASSIGN = 20;

function countNodesOfType(world, resourceType) {
  let count = 0;
  world.grid.forEachCell((cell) => {
    if (cell.resourceNode?.type === resourceType) count += 1;
  });
  return count;
}

// น้ำหนักตามความขาดแคลนของทรัพยากรชนิดนั้นในโลกตอนนี้ เทียบกับความจุเต็มที่ของทุกจุดที่มีทรัพยากรชนิดนี้
// (ยิ่งเหลือน้อยยิ่งได้น้ำหนักเพิ่ม เหมือนแรงจูงใจทางเศรษฐกิจที่สินค้าขาดตลาดมีมูลค่าสูงกว่า) อยู่ในช่วง
// 1.0 (ทรัพยากรเต็มทุกจุดในโลก ไม่ขาดแคลนเลย) ถึง 2.0 (หมดเกลี้ยงทุกจุด) — นี่คือ "น้ำหนักออกแบบเอง" ตาม
// สเปกข้อ 2 ที่ให้ทรัพยากรที่ถิ่นฐานขาดแคลนมีโอกาสดึงคนไปทำอาชีพนั้นมากกว่า
export function getScarcityWeight(world, resourceType) {
  if (!resourceType) return 1; // อาชีพบริการ (เช่น freelancer) ไม่มีทรัพยากรให้ขาดแคลน น้ำหนักคงที่เสมอ

  const nodeCount = countNodesOfType(world, resourceType);
  if (nodeCount === 0) return 1;

  const totals = world.getResourceTotals();
  const maxPossibleTotal = nodeCount * RESOURCE_CONFIG[resourceType].maxAmount;
  const fullness = Math.min(1, Math.max(0, totals[resourceType] / maxPossibleTotal));
  return 1 + (1 - fullness);
}

// ติดตามพฤติกรรม/เหตุการณ์สะสมของแต่ละตัวละคร แล้วตัดสินอาชีพให้อัตโนมัติ — ไม่แก้ behaviors.js/
// utility-ai.js เลย (สังเกต character.currentBehavior ที่ตั้งไว้แล้วโดย utility-ai จากภายนอกเหมือนที่
// home-tracker.js ของเฟส 4 ทำกับพฤติกรรม rest/build_shelter)
export class ProfessionAssignmentTracker {
  constructor({ windowTicks = PROFESSION_WINDOW_TICKS } = {}) {
    this.windowTicks = windowTicks;
    this.tallyByCharacterId = new Map(); // characterId -> { windowStartTick, counts: Map<professionId, weight> }
  }

  // เรียกทุก tick หลัง updateCharacter ของตัวละครแต่ละตัวเสร็จแล้ว
  observeBehavior(character, world, tick) {
    const profession = getProfessionByBehavior(character.currentBehavior);
    if (!profession) return; // พฤติกรรมนี้ไม่ได้ผูกกับอาชีพไหนเลย (เช่น rest/socialize) ไม่นับ
    this._tally(character, profession.id, getScarcityWeight(world, profession.resourceType), tick);
  }

  // เรียกทุก tick หลัง trade.update() คืน event ของ tick นั้นมา (สังเกตว่าใครรับจ้างเป็น helper บ่อยๆ)
  observeTradeEvents(tradeEvents, characters, tick) {
    for (const deal of tradeEvents) {
      if (deal.kind !== 'service') continue;
      const helper = characters.find((c) => c.id === deal.helperId);
      if (!helper) continue;
      this._tally(helper, PROFESSIONS.FREELANCER, 1, tick);
    }
  }

  _tally(character, professionId, weight, tick) {
    let record = this.tallyByCharacterId.get(character.id);
    if (!record || tick - record.windowStartTick >= this.windowTicks) {
      record = { windowStartTick: tick, counts: new Map() };
      this.tallyByCharacterId.set(character.id, record);
    }
    record.counts.set(professionId, (record.counts.get(professionId) ?? 0) + weight);
    this._maybeUpdateProfession(character, tick);
  }

  _maybeUpdateProfession(character, tick) {
    const record = this.tallyByCharacterId.get(character.id);
    let bestId = null;
    let bestWeight = -1;
    for (const [id, weight] of record.counts) {
      if (weight > bestWeight) {
        bestWeight = weight;
        bestId = id;
      }
    }

    if (bestId === null || bestId === character.profession) return;
    if (bestWeight < MIN_WEIGHT_TO_ASSIGN) return;
    character.profession = bestId;
    character.professionSinceTick = tick;
  }
}
