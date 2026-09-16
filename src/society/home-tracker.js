import { BLUEPRINTS } from '../building/blueprints.js';
import { findNearestStructure } from '../building/structure-finder.js';
import { chebyshevDistance } from '../characters/movement.js';
import { BEHAVIORS } from '../characters/behaviors.js';
import { SETTLEMENT_CONFIG } from './settlement-config.js';

// ไม่แก้ character.js/behaviors.js เพิ่ม — เดาว่าตัวละคร "ใช้ที่พักไหน" จากการสังเกต currentBehavior
// (rest หรือ build_shelter) ว่าตอนนี้อยู่ใกล้ที่พักหลังไหนที่สุดแทน ไม่ต้องผูก dependency ข้ามโมดูล
const HOME_TRACKING_BEHAVIORS = new Set([BEHAVIORS.REST, BEHAVIORS.BUILD_SHELTER]);

// ติดตามว่าแต่ละตัวละครไปพัก/สร้างใกล้ที่พักไหนบ่อยสุดในช่วงเวลาหนึ่ง (tumbling window) แล้วอัปเดต
// character.homeSettlementId ให้เป็นถิ่นฐานของที่พักที่ใช้บ่อยสุด — เก็บ tally ไว้ในคลาสนี้เอง
// ไม่ยัดใส่ Character เพื่อไม่ให้ Character ต้องรู้จักเรื่องถิ่นฐานเกินจำเป็น (เก็บแค่ field ผลลัพธ์)
export class HomeSettlementTracker {
  constructor({
    windowTicks = SETTLEMENT_CONFIG.HOME_TRACKING_WINDOW_TICKS,
    nearbyRadius = BLUEPRINTS.shelter.effects.nearbyRadius,
  } = {}) {
    this.windowTicks = windowTicks;
    this.nearbyRadius = nearbyRadius;
    this.tallyByCharacterId = new Map(); // characterId -> { windowStartTick, counts: Map<settlementId, count> }
  }

  update({ characters, world, settlements, structureToSettlementId, tick }) {
    for (const character of characters) {
      if (!HOME_TRACKING_BEHAVIORS.has(character.currentBehavior)) continue;

      const nearestShelter = findNearestStructure(world, character.position, BLUEPRINTS.shelter.id);
      if (!nearestShelter) continue;
      if (chebyshevDistance(character.position, nearestShelter.position) > this.nearbyRadius) continue;

      const settlementId = structureToSettlementId.get(nearestShelter.id);
      if (settlementId === undefined) continue; // ที่พักนี้ยังไม่ถูกจัดกลุ่มถิ่นฐาน (รอรอบ detect ถัดไป)

      this._tally(character, settlementId, tick);
      this._maybeUpdateHome(character, settlements, tick);
    }
  }

  _tally(character, settlementId, tick) {
    let record = this.tallyByCharacterId.get(character.id);
    if (!record || tick - record.windowStartTick >= this.windowTicks) {
      record = { windowStartTick: tick, counts: new Map() };
      this.tallyByCharacterId.set(character.id, record);
    }
    record.counts.set(settlementId, (record.counts.get(settlementId) ?? 0) + 1);
  }

  _maybeUpdateHome(character, settlements, tick) {
    const record = this.tallyByCharacterId.get(character.id);
    let bestSettlementId = null;
    let bestCount = -1;
    for (const [settlementId, count] of record.counts) {
      if (count > bestCount) {
        bestCount = count;
        bestSettlementId = settlementId;
      }
    }

    if (bestSettlementId === null || bestSettlementId === character.homeSettlementId) return;

    const oldSettlement = settlements.find((s) => s.id === character.homeSettlementId);
    if (oldSettlement) {
      oldSettlement.memberIds = oldSettlement.memberIds.filter((id) => id !== character.id);
    }

    const newSettlement = settlements.find((s) => s.id === bestSettlementId);
    if (newSettlement && !newSettlement.memberIds.includes(character.id)) {
      newSettlement.memberIds.push(character.id);
    }

    character.homeSettlementId = bestSettlementId;
    character.homeSettlementSinceTick = tick;
  }
}
