import { World } from '../world/world.js';
import { Character } from '../characters/character.js';
import { updateCharacter } from '../characters/utility-ai.js';
import { EconomySystem } from '../economy/economy-system.js';
import { TradeSystem } from './trade-system.js';
import { TRADE_CONFIG } from './trade-config.js';
import { getWoodPrice, getServicePrice } from './pricing.js';

// สคริปต์สาธิตเฟส 7 (ระบบแลกเปลี่ยน): แสดงธุรกรรมทั้ง 2 แบบ (ซื้อขายด้วย xcoin และแลกแบบ barter ไม่ใช้เงิน)
// เกิดขึ้นจริงผ่าน TradeSystem ตัวเดียวกับที่ใช้ใน scripts/long-run.js พร้อมราคาที่เปลี่ยนตามดัชนีเงินเฟ้อ
// สะสมจากเฟส 6 — ตั้งค่าตัวละครบางส่วนแบบจงใจ (เหมือน demo เฟสก่อนๆ) เพื่อบังคับให้เห็นทั้ง 3 รูปแบบ
// ธุรกรรม (ซื้อขายไม้ด้วยเงิน, แลกไม้แบบ barter, จ้างบริการด้วยเงิน) ภายในเวลาสั้นๆ แน่นอน

const world = new World({ seed: 999 });
const economy = new EconomySystem();
const trade = new TradeSystem();

// ทุกคนยืนใกล้กันในระยะ TRADE_PROXIMITY_RADIUS อยู่แล้ว (หมู่บ้านเดียวกัน) เพื่อตัดปัญหาเรื่องระยะออกไป
const seller = new Character({ x: 10, y: 10, needs: { hunger: 90, energy: 90, shelter: 90, social: 90 } });
const buyerXcoin = new Character({ x: 11, y: 10, needs: { hunger: 90, energy: 90, shelter: 30, social: 90 } });
const buyerBarter = new Character({ x: 10, y: 11, needs: { hunger: 90, energy: 90, shelter: 30, social: 40 } });
const buyerService = new Character({ x: 11, y: 11, needs: { hunger: 90, energy: 20, shelter: 90, social: 90 } });
const helper = new Character({ x: 12, y: 10, needs: { hunger: 90, energy: 90, shelter: 90, social: 90 } });

seller.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 30; // มีไม้ส่วนเกินเหลือเฟือ พร้อมขาย/แจก
buyerBarter.wallet.balance = 0; // ตั้งใจให้จ่ายเป็นเงินไม่ไหว จะได้เห็นเส้นทาง barter ชัดๆ

const characters = [seller, buyerXcoin, buyerBarter, buyerService, helper];

console.log(`สร้างโลกขนาด ${world.width}x${world.height} และตัวละคร ${characters.length} ตัว (ยืนใกล้กันหมด)`);
console.log(
  `TRADE_PROXIMITY_RADIUS=${TRADE_CONFIG.TRADE_PROXIMITY_RADIUS}, ` +
    `WOOD_SURPLUS_THRESHOLD=${TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD}, ` +
    `CRITICAL_NEED_THRESHOLD=${TRADE_CONFIG.CRITICAL_NEED_THRESHOLD}`,
);

function describeDeal(deal) {
  if (deal.kind === 'goods') {
    const label = deal.type === 'xcoin' ? `จ่าย ${deal.price.toFixed(2)} xcoin` : 'แลกแบบ barter (ฟื้น social แทนเงิน)';
    return `ตัวละคร #${deal.buyerId} ซื้อไม้ ${deal.quantity} หน่วยจาก #${deal.sellerId} — ${label}`;
  }
  const label = deal.type === 'xcoin' ? `จ่าย ${deal.price.toFixed(2)} xcoin` : 'แลกแบบ barter (ฟื้น social แทนเงิน)';
  const detail = deal.service === 'gather_wood' ? `ได้ไม้ ${deal.amount.toFixed(1)} หน่วย` : `ฟื้น energy +${deal.boost}`;
  return `ตัวละคร #${deal.buyerId} จ้าง #${deal.helperId} ให้ ${deal.service === 'gather_wood' ? 'เก็บไม้แทน' : 'ช่วยพัก'} (${detail}) — ${label}`;
}

const YEARS_TO_SIMULATE = 10;
const TOTAL_TICKS = 365 * YEARS_TO_SIMULATE;
let lastYearShown = 0;

console.log(`\nเริ่มจำลอง ${YEARS_TO_SIMULATE} ปีในเกม (${TOTAL_TICKS} tick)\n`);

for (let t = 1; t <= TOTAL_TICKS; t++) {
  world.update(1);
  for (const character of characters) updateCharacter(character, world, characters, 1);
  const { inflationEvent } = economy.update(world, characters);
  const events = trade.update(world, characters, economy.inflation.cumulativeIndex);

  for (const deal of events) {
    console.log(`[tick ${t}, ปีที่ ${Math.floor(t / 365)}] ${describeDeal(deal)}`);
  }

  if (inflationEvent && inflationEvent.year !== lastYearShown && inflationEvent.year % 3 === 0) {
    lastYearShown = inflationEvent.year;
    console.log(
      `  (อ้างอิง: ปีที่ ${inflationEvent.year} ดัชนีราคาสะสม=${inflationEvent.cumulativeIndex.toFixed(3)} ` +
        `-> ราคาไม้ตอนนี้ ${getWoodPrice(inflationEvent.cumulativeIndex).toFixed(2)} xcoin/หน่วย, ` +
        `ราคาจ้างบริการตอนนี้ ${getServicePrice(inflationEvent.cumulativeIndex).toFixed(2)} xcoin/ครั้ง)`,
    );
  }
}

console.log(
  `\nสรุป: ธุรกรรมด้วย xcoin ทั้งหมด ${trade.totalXcoinTransactions} ครั้ง, ` +
    `แลกแบบ barter ทั้งหมด ${trade.totalBarterTransactions} ครั้ง`,
);
console.log('จบการสาธิตเฟส 7');
