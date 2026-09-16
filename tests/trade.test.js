import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { Grid } from '../src/world/grid.js';
import { Character } from '../src/characters/character.js';
import { ResourceNode } from '../src/world/resource-node.js';
import { RESOURCE_TYPES } from '../src/world/resource-types.js';
import { TRADE_CONFIG } from '../src/trade/trade-config.js';
import { getWoodPrice, getServicePrice } from '../src/trade/pricing.js';
import { canTransact, isNeedCritical } from '../src/trade/trade-eligibility.js';
import { tryTradeWood } from '../src/trade/goods-trade.js';
import { tryHireGatherWood, tryHireEnergyHelp } from '../src/trade/service-trade.js';
import { TradeSystem } from '../src/trade/trade-system.js';

function makeControlledWorld(width, height) {
  const world = new World({ width, height, seed: 1, density: 0 });
  world.grid = new Grid(width, height);
  return world;
}

function makeSafeNeeds(overrides = {}) {
  return { hunger: 90, energy: 90, shelter: 90, social: 90, ...overrides };
}

test('getWoodPrice / getServicePrice คูณราคาฐานด้วยดัชนีเงินเฟ้อสะสมถูกต้อง', () => {
  assert.equal(getWoodPrice(1), TRADE_CONFIG.WOOD_BASE_PRICE);
  assert.equal(getWoodPrice(2), TRADE_CONFIG.WOOD_BASE_PRICE * 2);
  assert.equal(getServicePrice(1.5), TRADE_CONFIG.SERVICE_BASE_PRICE * 1.5);
});

test('isNeedCritical คืนค่า true เมื่อมี need ตัวใดตัวหนึ่งต่ำกว่าเกณฑ์วิกฤต', () => {
  const safe = new Character({ needs: makeSafeNeeds() });
  const critical = new Character({ needs: makeSafeNeeds({ hunger: 10 }) });
  assert.equal(isNeedCritical(safe), false);
  assert.equal(isNeedCritical(critical), true);
});

test('canTransact ปฏิเสธเมื่ออยู่ไกลเกินระยะ หรือฝ่ายใดฝ่ายหนึ่งวิกฤต', () => {
  const a = new Character({ x: 0, y: 0, needs: makeSafeNeeds() });
  const bFar = new Character({ x: 20, y: 20, needs: makeSafeNeeds() });
  const bNear = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });
  const bCritical = new Character({ x: 1, y: 0, needs: makeSafeNeeds({ energy: 5 }) });

  assert.equal(canTransact(a, bFar), false);
  assert.equal(canTransact(a, bNear), true);
  assert.equal(canTransact(a, bCritical), false);
});

test('tryTradeWood ซื้อขายด้วย xcoin เมื่อ buyer มีพอ คำนวณราคาตามดัชนีเงินเฟ้อถูกต้อง และ wallet ไม่ติดลบ', () => {
  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ shelter: 30 }) });
  const seller = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });
  seller.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 10;
  const buyerStartWood = buyer.inventory.wood;
  const buyerStartBalance = buyer.wallet.balance;
  const sellerStartBalance = seller.wallet.balance;

  const cumulativeIndex = 2;
  const deal = tryTradeWood(buyer, seller, cumulativeIndex);
  const expectedPrice = TRADE_CONFIG.WOOD_BASE_PRICE * cumulativeIndex * TRADE_CONFIG.WOOD_TRADE_QUANTITY;

  assert.ok(deal);
  assert.equal(deal.type, 'xcoin');
  assert.equal(deal.price, expectedPrice);
  assert.equal(buyer.wallet.balance, buyerStartBalance - expectedPrice);
  assert.equal(seller.wallet.balance, sellerStartBalance + expectedPrice);
  assert.ok(buyer.wallet.balance >= 0);
  assert.equal(buyer.inventory.wood, buyerStartWood + TRADE_CONFIG.WOOD_TRADE_QUANTITY);
  assert.equal(seller.inventory.wood, TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 10 - TRADE_CONFIG.WOOD_TRADE_QUANTITY);
});

test('tryTradeWood แลกแบบ barter (โอนไม้ + ฟื้น social ทั้งคู่) เมื่อ buyer มี xcoin ไม่พอ ไม่แตะ wallet เลย', () => {
  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ shelter: 30, social: 50 }) });
  const seller = new Character({ x: 1, y: 0, needs: makeSafeNeeds({ social: 50 }) });
  buyer.wallet.balance = 0; // จ่ายเป็นเงินไม่ไหวแน่นอน
  seller.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 10;

  const deal = tryTradeWood(buyer, seller, 5); // ดัชนีเงินเฟ้อสูงแค่ไหนก็ไม่เกี่ยวเพราะไม่ได้จ่ายเงิน

  assert.ok(deal);
  assert.equal(deal.type, 'barter');
  assert.equal(deal.price, 0);
  assert.equal(buyer.wallet.balance, 0); // wallet ไม่ถูกแตะเลย ไม่มีทางติดลบ
  assert.equal(seller.wallet.balance, 100); // ค่า default ไม่เปลี่ยน
  assert.equal(buyer.inventory.wood, TRADE_CONFIG.WOOD_TRADE_QUANTITY);
  assert.equal(buyer.needs.social, 50 + TRADE_CONFIG.SOCIAL_BARTER_BONUS);
  assert.equal(seller.needs.social, 50 + TRADE_CONFIG.SOCIAL_BARTER_BONUS);
});

test('tryTradeWood ไม่เกิดธุรกรรมถ้า buyer ไม่ได้อยากได้ไม้ (shelter need ยังสบายดี)', () => {
  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds() }); // shelter=90 สบายดี
  const seller = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });
  seller.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 10;

  assert.equal(tryTradeWood(buyer, seller, 1), null);
});

test('tryTradeWood ไม่เกิดธุรกรรมถ้า seller ไม่มีไม้ส่วนเกินพอ', () => {
  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ shelter: 30 }) });
  const seller = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });
  seller.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD - 1;

  assert.equal(tryTradeWood(buyer, seller, 1), null);
});

test('tryTradeWood ไม่เกิดธุรกรรมเมื่อฝ่ายใดฝ่ายหนึ่ง need วิกฤต (ไม่แข่งกับการเอาตัวรอด)', () => {
  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ shelter: 30, hunger: 5 }) }); // hunger วิกฤต
  const seller = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });
  seller.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 10;

  assert.equal(tryTradeWood(buyer, seller, 1), null);

  const seller2 = new Character({ x: 1, y: 0, needs: makeSafeNeeds({ energy: 5 }) }); // seller วิกฤต
  seller2.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 10;
  const buyer2 = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ shelter: 30 }) });
  assert.equal(tryTradeWood(buyer2, seller2, 1), null);
});

test('tryHireGatherWood จ้างเก็บไม้แทนสำเร็จ เก็บจากทรัพยากรจริงในโลก จ่ายด้วย xcoin ตามราคาที่ปรับเงินเฟ้อ', () => {
  const world = makeControlledWorld(10, 10);
  world.grid.getCell(3, 0).resourceNode = new ResourceNode(RESOURCE_TYPES.WOOD, {
    amount: 100,
    maxAmount: 100,
    regenRate: 1,
  });

  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ shelter: 30 }) });
  const helper = new Character({ x: 3, y: 0, needs: makeSafeNeeds() }); // ยืนอยู่บนจุดไม้พอดี

  const cumulativeIndex = 3;
  const deal = tryHireGatherWood(buyer, helper, world, cumulativeIndex);
  const expectedPrice = TRADE_CONFIG.SERVICE_BASE_PRICE * cumulativeIndex;

  assert.ok(deal);
  assert.equal(deal.type, 'xcoin');
  assert.equal(deal.price, expectedPrice);
  assert.ok(deal.amount > 0);
  assert.equal(buyer.inventory.wood, deal.amount);
  assert.equal(buyer.wallet.balance, 100 - expectedPrice);
  assert.equal(helper.wallet.balance, 100 + expectedPrice);
  assert.ok(buyer.wallet.balance >= 0);
});

test('tryHireGatherWood คืนค่า null ถ้าไม่มีไม้เหลือให้เก็บเลยในโลก', () => {
  const world = makeControlledWorld(10, 10); // ไม่มี resourceNode เลย (density: 0)
  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ shelter: 30 }) });
  const helper = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });

  assert.equal(tryHireGatherWood(buyer, helper, world, 1), null);
});

test('tryHireEnergyHelp ฟื้น energy ให้ buyer ทันที จ่ายด้วย xcoin ตามราคาที่ปรับเงินเฟ้อ', () => {
  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ energy: 20 }) });
  const helper = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });

  const cumulativeIndex = 1.2;
  const deal = tryHireEnergyHelp(buyer, helper, cumulativeIndex);
  const expectedPrice = TRADE_CONFIG.SERVICE_BASE_PRICE * cumulativeIndex;

  assert.ok(deal);
  assert.equal(deal.type, 'xcoin');
  assert.equal(deal.price, expectedPrice);
  assert.equal(buyer.needs.energy, 20 + TRADE_CONFIG.SERVICE_ENERGY_BOOST);
  assert.equal(buyer.wallet.balance, 100 - expectedPrice);
  assert.equal(helper.wallet.balance, 100 + expectedPrice);
});

test('tryHireEnergyHelp แลกแบบ barter (ฟื้น social แทนเงิน) เมื่อ buyer มี xcoin ไม่พอ', () => {
  const buyer = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ energy: 20, social: 40 }) });
  const helper = new Character({ x: 1, y: 0, needs: makeSafeNeeds({ social: 40 }) });
  buyer.wallet.balance = 0;

  const deal = tryHireEnergyHelp(buyer, helper, 5);

  assert.ok(deal);
  assert.equal(deal.type, 'barter');
  assert.equal(deal.price, 0);
  assert.equal(buyer.wallet.balance, 0);
  assert.equal(helper.wallet.balance, 100);
  assert.equal(buyer.needs.energy, 20 + TRADE_CONFIG.SERVICE_ENERGY_BOOST);
  assert.equal(buyer.needs.social, 40 + TRADE_CONFIG.SOCIAL_BARTER_BONUS);
  assert.equal(helper.needs.social, 40 + TRADE_CONFIG.SOCIAL_BARTER_BONUS);
});

test('TradeSystem.update นับจำนวนธุรกรรมแยกประเภท xcoin/barter สะสมถูกต้อง และไม่ให้ตัวละครเดียวทำธุรกรรมซ้ำในรอบเดียว', () => {
  const world = makeControlledWorld(10, 10);

  // คู่ที่ 1: จ่ายด้วย xcoin ได้ (มีเงินพอ)
  const buyer1 = new Character({ x: 0, y: 0, needs: makeSafeNeeds({ shelter: 30 }) });
  const seller1 = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });
  seller1.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 10;

  // คู่ที่ 2: จ่ายด้วย xcoin ไม่ไหว ต้อง barter
  const buyer2 = new Character({ x: 5, y: 5, needs: makeSafeNeeds({ shelter: 30 }) });
  const seller2 = new Character({ x: 6, y: 5, needs: makeSafeNeeds() });
  buyer2.wallet.balance = 0;
  seller2.inventory.wood = TRADE_CONFIG.WOOD_SURPLUS_THRESHOLD + 10;

  const characters = [buyer1, seller1, buyer2, seller2];
  const trade = new TradeSystem();
  const events = trade.update(world, characters, 1);

  assert.equal(events.length, 2);
  assert.equal(trade.totalXcoinTransactions, 1);
  assert.equal(trade.totalBarterTransactions, 1);

  // แต่ละตัวละครควรปรากฏในธุรกรรมแค่ครั้งเดียวต่อ tick
  const involvedIds = events.flatMap((e) => [e.buyerId, e.sellerId ?? e.helperId]);
  assert.equal(new Set(involvedIds).size, involvedIds.length);
});

test('canTransact ปฏิเสธเมื่อฝ่ายใดฝ่ายหนึ่ง hunger ต่ำกว่าเกณฑ์ safety แม้จะยังไม่ถึงเกณฑ์วิกฤตก็ตาม', () => {
  const a = new Character({ x: 0, y: 0, needs: makeSafeNeeds() });
  const bHungrySafe = new Character({ x: 1, y: 0, needs: makeSafeNeeds({ hunger: TRADE_CONFIG.HUNGER_SAFETY_THRESHOLD }) });
  const bHungryUnsafe = new Character({
    x: 1,
    y: 0,
    needs: makeSafeNeeds({ hunger: TRADE_CONFIG.HUNGER_SAFETY_THRESHOLD - 1 }),
  });

  assert.equal(bHungryUnsafe.needs.hunger >= TRADE_CONFIG.CRITICAL_NEED_THRESHOLD, true, 'ค่านี้ต้องยังไม่วิกฤต');
  assert.equal(canTransact(a, bHungrySafe), true);
  assert.equal(canTransact(a, bHungryUnsafe), false);
});

test('tryHireEnergyHelp ไม่เกิดธุรกรรมถ้า buyer hunger ต่ำกว่าเกณฑ์ safety (กันหลงลืมหิวเพราะมัวจ้างบริการ)', () => {
  const buyer = new Character({
    x: 0,
    y: 0,
    needs: makeSafeNeeds({ energy: 20, hunger: TRADE_CONFIG.HUNGER_SAFETY_THRESHOLD - 1 }),
  });
  const helper = new Character({ x: 1, y: 0, needs: makeSafeNeeds() });

  assert.equal(tryHireEnergyHelp(buyer, helper, 1), null);
});
