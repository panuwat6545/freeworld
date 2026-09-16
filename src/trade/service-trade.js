import { TRADE_CONFIG } from './trade-config.js';
import { getServicePrice } from './pricing.js';
import { canTransact } from './trade-eligibility.js';
import { settlePayment } from './payment.js';
import { clampNeedValue } from '../characters/character.js';
import { findNearestResourceCell } from '../characters/target-finder.js';
import { RESOURCE_TYPES } from '../world/resource-types.js';
import { NEEDS_CONFIG } from '../characters/needs-config.js';

// ข้อ 1b ของสเปกเฟส 7: ตัวละครที่ need ปานกลาง-ต่ำ (ยังไม่วิกฤต) จ่าย xcoin (หรือ barter ถ้าจ่ายเงินไม่ไหว)
// ให้ตัวละครอื่นที่อยู่ใกล้และไม่วิกฤตเช่นกัน เพื่อช่วยทำงานแทน สอง service ที่รองรับตามตัวอย่างในสเปก:
// "จ้างไปเก็บไม้ให้" และ "จ้างมาช่วยให้ energy ฟื้นเร็วขึ้น"
//
// หมายเหตุการออกแบบ: บริการ resolve ทันทีใน 1 tick (ไม่ได้จำลองให้ helper เดินไปทำงานจริงหลาย tick)
// เพื่อความง่าย สอดคล้องกับที่ระบบอื่นในเกมนี้ (build/harvest) ก็ resolve ทันทีเช่นกัน

// จ้างให้ไปเก็บไม้แทน: helper เก็บไม้จากทรัพยากรจริงในโลก (ไม่ได้งอกมาจากอากาศ) แล้วยกให้ buyer ทันที
export function tryHireGatherWood(buyer, helper, world, cumulativeIndex) {
  if (!canTransact(buyer, helper)) return null;
  if (buyer.needs.shelter >= TRADE_CONFIG.MODERATE_NEED_THRESHOLD) return null;

  const targetCell = findNearestResourceCell(world, helper.position, RESOURCE_TYPES.WOOD);
  if (!targetCell) return null; // ไม่มีไม้เหลือให้เก็บเลยในโลกตอนนี้ จ้างไม่ได้

  const harvested = world.harvestAt(targetCell.x, targetCell.y, NEEDS_CONFIG.WOOD_HARVEST_QUANTITY);
  if (harvested <= 0) return null;

  const price = getServicePrice(cumulativeIndex);
  const paymentType = settlePayment(buyer, helper, price);
  buyer.inventory.wood += harvested;

  return {
    type: paymentType,
    kind: 'service',
    service: 'gather_wood',
    amount: harvested,
    price: paymentType === 'xcoin' ? price : 0,
    buyerId: buyer.id,
    helperId: helper.id,
  };
}

// จ้างมาช่วยให้ energy ฟื้นเร็วขึ้น (เช่นช่วยดูแล/สลับเวรพัก) — ฟื้น energy ให้ buyer ทันที
export function tryHireEnergyHelp(buyer, helper, cumulativeIndex) {
  if (!canTransact(buyer, helper)) return null;
  if (buyer.needs.energy >= TRADE_CONFIG.MODERATE_NEED_THRESHOLD) return null;

  const price = getServicePrice(cumulativeIndex);
  const paymentType = settlePayment(buyer, helper, price);
  buyer.needs.energy = clampNeedValue(buyer.needs.energy + TRADE_CONFIG.SERVICE_ENERGY_BOOST);

  return {
    type: paymentType,
    kind: 'service',
    service: 'energy_help',
    boost: TRADE_CONFIG.SERVICE_ENERGY_BOOST,
    price: paymentType === 'xcoin' ? price : 0,
    buyerId: buyer.id,
    helperId: helper.id,
  };
}
