import { Character } from '../characters/character.js';
import { chebyshevDistance } from '../characters/movement.js';
import { SETTLEMENT_CONFIG } from './settlement-config.js';

function pairKey(a, b) {
  return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
}

// ตัวละคร 2 ตัวที่ social สูงต่อกันนานพอ (อยู่ใกล้กัน + social ของทั้งคู่เกิน threshold ต่อเนื่องครบจำนวน
// tick ที่กำหนด) จะเกิดตัวละครใหม่ 1 ตัวในถิ่นฐานเดียวกัน — ต้องมี homeSettlementId เดียวกันทั้งคู่
// (ยังไม่มีถิ่นฐาน = ยังเกิดลูกไม่ได้) จำกัดอัตราการเกิดด้วย cooldown ต่อคู่ + เพดานประชากรรวม
export class ReproductionSystem {
  constructor({
    proximityRadius = SETTLEMENT_CONFIG.REPRODUCTION_PROXIMITY_RADIUS,
    socialThreshold = SETTLEMENT_CONFIG.REPRODUCTION_SOCIAL_THRESHOLD,
    ticksRequired = SETTLEMENT_CONFIG.REPRODUCTION_TICKS_REQUIRED,
    cooldownTicks = SETTLEMENT_CONFIG.REPRODUCTION_COOLDOWN_TICKS,
    maxPopulation = SETTLEMENT_CONFIG.MAX_POPULATION,
    minAgeTicks = SETTLEMENT_CONFIG.REPRODUCTION_MIN_AGE_TICKS,
  } = {}) {
    this.proximityRadius = proximityRadius;
    this.socialThreshold = socialThreshold;
    this.ticksRequired = ticksRequired;
    this.cooldownTicks = cooldownTicks;
    this.maxPopulation = maxPopulation;
    this.minAgeTicks = minAgeTicks;
    this.streakByPair = new Map(); // "idA-idB" -> จำนวน tick ติดต่อกันที่ผ่านเงื่อนไข
    this.cooldownUntilByPair = new Map(); // "idA-idB" -> tick ที่คูลดาวน์หมด
  }

  // คืนค่ารายการตัวละครใหม่ที่เกิดในรอบนี้ (เผื่ออยากใช้ log/ตรวจสอบ) และ push เข้า characters array ให้เลย
  update({ characters, settlements, tick }) {
    const newborns = [];

    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        const a = characters[i];
        const b = characters[j];
        const key = pairKey(a, b);

        const closeEnough = chebyshevDistance(a.position, b.position) <= this.proximityRadius;
        const bothSocialHigh = a.needs.social >= this.socialThreshold && b.needs.social >= this.socialThreshold;
        const bothMatureEnough = tick - a.bornAtTick >= this.minAgeTicks && tick - b.bornAtTick >= this.minAgeTicks;

        if (!closeEnough || !bothSocialHigh || !bothMatureEnough) {
          this.streakByPair.delete(key); // ต้องต่อเนื่อง ขาดตอนเมื่อไหร่เริ่มนับ streak ใหม่
          continue;
        }

        const streak = (this.streakByPair.get(key) ?? 0) + 1;
        this.streakByPair.set(key, streak);
        if (streak < this.ticksRequired) continue;

        if (tick < (this.cooldownUntilByPair.get(key) ?? 0)) continue;
        if (a.homeSettlementId === null || a.homeSettlementId !== b.homeSettlementId) continue;
        if (characters.length + newborns.length >= this.maxPopulation) continue;

        const child = new Character({ x: a.position.x, y: a.position.y });
        child.homeSettlementId = a.homeSettlementId;
        child.homeSettlementSinceTick = tick;
        child.bornAtTick = tick;
        newborns.push(child);

        const settlement = settlements.find((s) => s.id === a.homeSettlementId);
        if (settlement && !settlement.memberIds.includes(child.id)) {
          settlement.memberIds.push(child.id);
        }

        this.cooldownUntilByPair.set(key, tick + this.cooldownTicks);
        this.streakByPair.set(key, 0);
      }
    }

    for (const child of newborns) characters.push(child);
    return newborns;
  }
}
