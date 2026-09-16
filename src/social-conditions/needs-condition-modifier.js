import { NEEDS_CONFIG, NEED_PRIORITY } from '../characters/needs-config.js';
import { clampNeedValue } from '../characters/character.js';
import { computeConditionIndices } from './condition-index.js';
import { SOCIAL_CONDITIONS_CONFIG } from './social-conditions-config.js';

const NEUTRAL_MODIFIERS = Object.freeze({ hunger: 1, energy: 1, shelter: 1, social: 1 });

// ใช้ Symbol กันชื่อชนกับ property อื่นบน Character และมองเห็นได้เฉพาะจากไฟล์นี้ — ใช้เป็น "flag" บอกว่า
// ตัวละครนี้ถูกห่อ decayNeeds ไปแล้ว กัน wrapCharacter() ถูกเรียกซ้ำ (เช่นทุก tick) แล้วห่อซ้อนกันหลายชั้น
const WRAPPED_FLAG = Symbol('needsConditionModifierWrapped');

function clampModifierDeviation(deviation) {
  const { MAX_DEVIATION } = SOCIAL_CONDITIONS_CONFIG;
  return Math.max(-MAX_DEVIATION, Math.min(MAX_DEVIATION, deviation));
}

// แปลงดัชนีดิบ 1 ตัวเป็น "ตัวคูณ decay" (1.0 = ไม่มีผลกระทบเลย) — ใช้ dead zone รอบจุดที่ถือว่า "ปกติ"
// กันไม่ให้ความผันผวนเล็กน้อยตามธรรมชาติ (ที่เกิดขึ้นแน่ๆ จากการ tune เฟส 1-9 อยู่แล้ว) ไปกระทบ decay โดย
// ไม่ตั้งใจ ตามสเปกข้อ 3 ที่บังคับให้ modifier เป็นกลางจนกว่าจะมีสภาพผิดปกติจริงเกิดขึ้นเอง
function indexToModifier(index, neutralPoint, deadZone, sensitivity) {
  const deviation = index - neutralPoint;
  if (Math.abs(deviation) <= deadZone) return 1.0;

  const excess = deviation > 0 ? deviation - deadZone : deviation + deadZone;
  return 1 + clampModifierDeviation(excess * sensitivity);
}

// คำนวณ decay modifier ของ need ทั้ง 4 ตัว (hunger/energy/shelter/social จากเฟส 2) จากดัชนีสภาพสังคม
// 3 ตัว — ทิศทางที่เลือกออกแบบเอง (อธิบายเหตุผลเต็มใน README หัวข้อเฟส 10):
//   - hunger  <- ความฝืดเคือง (เศรษฐกิจแย่ = หาอาหารยากขึ้นจริงในทางเศรษฐกิจ ตามตัวอย่างในสเปก)
//   - social  <- ความเหลื่อมล้ำ (สังคมแตกแยกจากความเหลื่อมล้ำ = รักษาความสัมพันธ์ทางสังคมยากขึ้น ตามตัวอย่างในสเปก)
//   - shelter <- ภาระกฎหมาย (ภาษีการค้า/สิทธิ์เขตแดนจำกัดการเข้าถึงทรัพยากรและเสรีภาพในการซ่อม/สร้างที่พัก
//                โดยตรง — เชื่อมกับที่มาของกฎหมายทั้ง 2 ข้อในเฟส 8 ตรงๆ)
//   - energy  <- ค่าเฉลี่ยของทั้ง 3 ดัชนี (พลังงาน/ขวัญกำลังใจเป็น need ที่สะท้อนความเหนื่อยล้าจากสภาพสังคม
//                โดยรวม ไม่ได้มีสาเหตุเฉพาะเจาะจงตัวเดียวเหมือน need อื่นๆ — ถ้าสังคมแย่ลงพร้อมกันหลายด้าน
//                ขวัญกำลังใจโดยรวมย่อมยิ่งย่ำแย่ตามไปด้วย)
export function computeDecayModifiers(indices) {
  const {
    HARDSHIP_NEUTRAL_POINT,
    HARDSHIP_DEAD_ZONE,
    HARDSHIP_SENSITIVITY,
    INEQUALITY_NEUTRAL_POINT,
    INEQUALITY_DEAD_ZONE,
    INEQUALITY_SENSITIVITY,
    LAW_BURDEN_NEUTRAL_POINT,
    LAW_BURDEN_DEAD_ZONE,
    LAW_BURDEN_SENSITIVITY,
  } = SOCIAL_CONDITIONS_CONFIG;

  const hungerModifier = indexToModifier(
    indices.economicHardship,
    HARDSHIP_NEUTRAL_POINT,
    HARDSHIP_DEAD_ZONE,
    HARDSHIP_SENSITIVITY,
  );
  const socialModifier = indexToModifier(
    indices.inequality,
    INEQUALITY_NEUTRAL_POINT,
    INEQUALITY_DEAD_ZONE,
    INEQUALITY_SENSITIVITY,
  );
  const shelterModifier = indexToModifier(
    indices.lawBurden,
    LAW_BURDEN_NEUTRAL_POINT,
    LAW_BURDEN_DEAD_ZONE,
    LAW_BURDEN_SENSITIVITY,
  );
  const energyModifier = 1 + ((hungerModifier - 1) + (socialModifier - 1) + (shelterModifier - 1)) / 3;

  return { hunger: hungerModifier, energy: energyModifier, shelter: shelterModifier, social: socialModifier };
}

// ปรับ "อัตรา decay" ของ need จากภายนอกเท่านั้น (เหมือนที่ governance-system.js ของเฟส 8 ห่อ
// world.harvestAt ของ World จากภายนอก แทนที่จะแก้ class World ต้นฉบับ) — ไม่แก้ needs-config.js หรือ
// character.js เลยแม้แต่บรรทัดเดียวตามสเปกข้อ 2
export class NeedsConditionModifier {
  constructor() {
    this.modifiersBySettlementId = new Map();
  }

  // เรียก 1 ครั้งต่อ tick ก่อนเริ่ม loop ตัวละคร (คำนวณสดทุกครั้งจากข้อมูลปัจจุบัน ไม่เก็บ state ข้ามรอบ
  // เอง — เหมือน governance.setSettlements() ที่ต้องเรียกใหม่ทุก tick)
  updateSettlementModifiers(settlements, characters, cumulativeIndex, lawsetRegistry) {
    this.modifiersBySettlementId.clear();
    for (const settlement of settlements) {
      const indices = computeConditionIndices(settlement, characters, cumulativeIndex, lawsetRegistry);
      this.modifiersBySettlementId.set(settlement.id, computeDecayModifiers(indices));
    }
  }

  // ตัวละครที่ยังไม่มี homeSettlementId (ยังไม่สังกัดถิ่นฐานไหน) ถือว่าอยู่ในสภาพ "เป็นกลาง" เสมอ —
  // ไม่มีถิ่นฐานให้ประเมินสภาพสังคม จึงไม่ควรได้รับผลกระทบใดๆ
  getModifiersFor(character) {
    if (character.homeSettlementId === null) return NEUTRAL_MODIFIERS;
    return this.modifiersBySettlementId.get(character.homeSettlementId) ?? NEUTRAL_MODIFIERS;
  }

  // ห่อ character.decayNeeds ของตัวละครนี้ครั้งเดียว (idempotent กันห่อซ้ำด้วย WRAPPED_FLAG) — เรียกได้
  // ทุก tick สำหรับทุกตัวละครโดยไม่มีผลข้างเคียงถ้าเคยห่อไปแล้ว เหมือนรูปแบบ governance.setCurrentHarvester()
  // ที่เรียกซ้ำได้ทุก tick อย่างปลอดภัย
  wrapCharacter(character) {
    if (character[WRAPPED_FLAG]) return;
    character[WRAPPED_FLAG] = true;

    const originalDecayNeeds = character.decayNeeds.bind(character);
    const modifierSource = this;

    // เรียก decayNeeds เดิมก่อนตามปกติ (ลด need ทุกตัวด้วยอัตราฐานจากเฟส 2) แล้วค่อยปรับเพิ่ม/ลดส่วนต่าง
    // ให้ตรงกับ "อัตราเป้าหมาย" (DECAY_RATE[key] * modifier) ทีหลัง — ผลรวมเท่ากับ decay ด้วยอัตรา
    // DECAY_RATE[key] * modifier * deltaTicks พอดี โดยไม่ต้องรู้รายละเอียดภายในของ decayNeeds เดิมเลย
    character.decayNeeds = function wrappedDecayNeeds(deltaTicks = 1) {
      originalDecayNeeds(deltaTicks);

      const modifiers = modifierSource.getModifiersFor(character);
      for (const key of NEED_PRIORITY) {
        const modifier = modifiers[key];
        if (modifier === 1) continue; // เป็นกลาง ไม่ต้องทำอะไรเพิ่ม (กรณีปกติส่วนใหญ่)

        const extraDelta = NEEDS_CONFIG.DECAY_RATE[key] * (modifier - 1) * deltaTicks;
        character.needs[key] = clampNeedValue(character.needs[key] - extraDelta);
      }
    };
  }
}
