import { chebyshevDistance } from '../characters/movement.js';
import { Settlement } from './settlement.js';
import { SETTLEMENT_CONFIG } from './settlement-config.js';

// จัดกลุ่มที่พัก (shelter) ที่อยู่ใกล้กันในระยะ radius เป็นกลุ่มแบบ transitive ด้วย union-find:
// ถ้า A ใกล้ B และ B ใกล้ C ทั้ง 3 หลังอยู่กลุ่มเดียวกัน แม้ A กับ C จะไกลกันเกิน radius ก็ตาม
function clusterShelters(shelters, radius) {
  const parent = shelters.map((_, i) => i);
  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootA] = rootB;
  }

  for (let i = 0; i < shelters.length; i++) {
    for (let j = i + 1; j < shelters.length; j++) {
      if (chebyshevDistance(shelters[i].position, shelters[j].position) <= radius) {
        union(i, j);
      }
    }
  }

  const groups = new Map(); // root index -> Structure[]
  for (let i = 0; i < shelters.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(shelters[i]);
  }

  return [...groups.values()];
}

// สแกน world.structures ทั้งหมดแล้วจัดกลุ่มเป็นถิ่นฐาน คำนวณใหม่เป็นระยะ (ไม่ทุก tick เพื่อประหยัด)
// รักษา identity ของ Settlement เดิมไว้ข้ามรอบคำนวณ (ไม่สร้างใหม่ทิ้งทุกครั้ง) เพื่อให้ memberIds/leaderId
// ที่ผูกกับ Settlement เดิมยังใช้ต่อได้ และ tie-break ผู้นำแบบ "อยู่นานสุด" มีความหมายจริง
export class SettlementDetector {
  constructor({
    clusterRadius = SETTLEMENT_CONFIG.CLUSTER_RADIUS,
    intervalTicks = SETTLEMENT_CONFIG.DETECTION_INTERVAL_TICKS,
  } = {}) {
    this.clusterRadius = clusterRadius;
    this.intervalTicks = intervalTicks;
    this.lastDetectionTick = null; // null = ยังไม่เคยคำนวณ บังคับให้คำนวณครั้งแรกเสมอ
    this.lastKnownStructureCount = 0;
    this.settlements = [];
    this.structureToSettlementId = new Map();
    this.justRecomputed = false;
  }

  // เรียกทุก tick ได้ตามสบาย ฟังก์ชันเองเช็คว่าถึงรอบคำนวณใหม่หรือยัง คำนวณใหม่เมื่อ (1) ครบ intervalTicks
  // ตามปกติ หรือ (2) มีที่พักใหม่ถูกสร้างเพิ่ม (ไม่รอครบ interval) — ข้อ 2 จำเป็นเพื่อกันช่วงเวลาที่
  // structureToSettlementId ยังไม่รู้จักที่พักที่เพิ่งสร้างเสร็จ ซึ่งจะทำให้ home-tracker พลาดไม่นับตัวละคร
  // ที่สร้าง/พักใกล้ที่พักนั้นทันทีแล้วไม่ได้กลับมาใกล้อีกเลย (บั๊กจริงที่เจอตอนรัน demo:society)
  // ต้องส่ง characters มาด้วย เผื่อกรณี 2 ถิ่นฐานเดิมถูกที่พักใหม่เชื่อมรวมกัน จะได้ปรับ
  // homeSettlementId ของตัวละครที่อยู่ถิ่นฐานที่ถูกรวม (merged away) ให้ตามไปอยู่ถิ่นฐานที่เหลือด้วย
  detect(world, characters, tick) {
    this.justRecomputed = false;
    const structureCountChanged = world.structures.length !== this.lastKnownStructureCount;
    const intervalElapsed = this.lastDetectionTick === null || tick - this.lastDetectionTick >= this.intervalTicks;

    if (!structureCountChanged && !intervalElapsed) {
      return this.settlements;
    }

    this.lastDetectionTick = tick;
    this.lastKnownStructureCount = world.structures.length;
    this.justRecomputed = true;
    this._recompute(world, characters);
    return this.settlements;
  }

  _recompute(world, characters) {
    const shelters = world.structures.filter((s) => s.type === 'shelter');
    const clusters = clusterShelters(shelters, this.clusterRadius);

    const oldSettlementsById = new Map(this.settlements.map((s) => [s.id, s]));
    const newSettlements = [];

    for (const clusterStructures of clusters) {
      const structureIds = clusterStructures.map((s) => s.id);

      // หา settlement เดิมที่เคยมี structure ในกลุ่มนี้อยู่แล้ว (อาจมีมากกว่า 1 ตัวถ้าเพิ่งมีที่พักใหม่
      // มาเชื่อม 2 ถิ่นฐานเดิมเข้าด้วยกัน) — ถ้ามี ใช้ id ที่เก่าแก่ที่สุด (เลขน้อยสุด) เป็นตัวแทน
      const overlappingOldIds = [
        ...new Set(structureIds.map((id) => this.structureToSettlementId.get(id)).filter((id) => id !== undefined)),
      ];

      let settlement;
      if (overlappingOldIds.length === 0) {
        settlement = new Settlement();
      } else {
        const keepId = Math.min(...overlappingOldIds);
        settlement = oldSettlementsById.get(keepId);

        // ถิ่นฐานอื่นที่ถูกรวมเข้ามา (merged away): ย้าย memberIds มาไว้ที่ settlement ที่เหลือ
        // แล้วปรับ homeSettlementId ของตัวละครที่เคยชี้ไปถิ่นฐานที่หายไปให้ตามมาด้วย
        const mergedAwayIds = overlappingOldIds.filter((id) => id !== keepId);
        for (const mergedAwayId of mergedAwayIds) {
          const mergedAwaySettlement = oldSettlementsById.get(mergedAwayId);
          for (const memberId of mergedAwaySettlement.memberIds) {
            if (!settlement.memberIds.includes(memberId)) settlement.memberIds.push(memberId);
          }
        }
        if (mergedAwayIds.length > 0) {
          for (const character of characters) {
            if (mergedAwayIds.includes(character.homeSettlementId)) {
              character.homeSettlementId = keepId;
            }
          }
        }
      }

      settlement.structureIds = structureIds;
      newSettlements.push(settlement);
    }

    this.settlements = newSettlements;
    this.structureToSettlementId = new Map();
    for (const settlement of this.settlements) {
      for (const structureId of settlement.structureIds) {
        this.structureToSettlementId.set(structureId, settlement.id);
      }
    }
  }
}
