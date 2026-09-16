import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { Grid } from '../src/world/grid.js';
import { ResourceNode } from '../src/world/resource-node.js';
import { RESOURCE_TYPES } from '../src/world/resource-types.js';
import { Character } from '../src/characters/character.js';
import { Settlement } from '../src/society/settlement.js';
import { clampParams } from '../src/governance/law.js';
import { getLawById, LAW_REGISTRY } from '../src/governance/law-registry.js';
import { SettlementLawsetRegistry } from '../src/governance/settlement-lawset.js';
import { GovernanceSystem } from '../src/governance/governance-system.js';

function makeControlledWorld(width, height) {
  const world = new World({ width, height, seed: 1, density: 0 });
  world.grid = new Grid(width, height);
  return world;
}

function placeWood(world, x, y, amount = 100) {
  world.grid.getCell(x, y).resourceNode = new ResourceNode(RESOURCE_TYPES.WOOD, {
    amount,
    maxAmount: amount,
    regenRate: 1,
  });
}

test('law-registry เริ่มต้นมี 2 กฎหมายตามสเปก และ getLawById หาเจอทั้งคู่', () => {
  assert.equal(LAW_REGISTRY.length, 2);
  assert.ok(getLawById('trade_tax'));
  assert.ok(getLawById('territorial_access'));
  assert.equal(getLawById('ไม่มีจริง'), null);
});

test('clampParams รวม default เข้ากับค่าที่ส่งมา และตัดค่าตัวเลขให้อยู่ในขอบเขต paramBounds', () => {
  const law = getLawById('trade_tax');
  assert.deepEqual(clampParams(law, {}), { rate: 0.1 });
  assert.deepEqual(clampParams(law, { rate: 0.9 }), { rate: 0.5 }); // เกิน max ถูกตัดที่ 0.5
  assert.deepEqual(clampParams(law, { rate: -1 }), { rate: 0 }); // ต่ำกว่า min ถูกตัดที่ 0
});

test('SettlementLawsetRegistry: เฉพาะผู้นำถิ่นฐานเท่านั้นที่เปิด/ปิดกฎหมายได้', () => {
  const settlement = new Settlement();
  const leader = new Character({ needs: {} });
  const notLeader = new Character({ needs: {} });
  settlement.leaderId = leader.id;

  const registry = new SettlementLawsetRegistry();
  const deniedResult = registry.enableLaw(settlement, notLeader.id, 'trade_tax');
  assert.equal(deniedResult.success, false);
  assert.equal(registry.isLawActive(settlement.id, 'trade_tax'), false);

  const allowedResult = registry.enableLaw(settlement, leader.id, 'trade_tax');
  assert.equal(allowedResult.success, true);
  assert.equal(registry.isLawActive(settlement.id, 'trade_tax'), true);
});

test('SettlementLawsetRegistry: ชุดกฎหมายยังคงอยู่ถูกต้องแม้ผู้นำถิ่นฐานเปลี่ยน (ไม่รีเซ็ต)', () => {
  const settlement = new Settlement();
  const leaderA = new Character({ needs: {} });
  const leaderB = new Character({ needs: {} });
  settlement.leaderId = leaderA.id;

  const registry = new SettlementLawsetRegistry();
  registry.enableLaw(settlement, leaderA.id, 'trade_tax', { rate: 0.25 });
  assert.equal(registry.isLawActive(settlement.id, 'trade_tax'), true);
  assert.equal(registry.getLawParams(settlement.id, 'trade_tax').rate, 0.25);

  // จำลองเฟส 4 เปลี่ยนผู้นำ (leadership.js ปรับ settlement.leaderId ตรงๆ)
  settlement.leaderId = leaderB.id;

  // lawset เดิมต้องยังอยู่ครบ ไม่ถูกรีเซ็ต
  assert.equal(registry.isLawActive(settlement.id, 'trade_tax'), true);
  assert.equal(registry.getLawParams(settlement.id, 'trade_tax').rate, 0.25);

  // ผู้นำคนเก่าห้ามจัดการกฎหมายอีกต่อไป ส่วนผู้นำคนใหม่ทำได้ทันที
  assert.equal(registry.disableLaw(settlement, leaderA.id, 'trade_tax').success, false);
  assert.equal(registry.disableLaw(settlement, leaderB.id, 'trade_tax').success, true);
  assert.equal(registry.isLawActive(settlement.id, 'trade_tax'), false);
});

test('GovernanceSystem: ไม่เปิดกฎหมายใดๆ เลย harvestAt ต้องให้ผลเหมือนเดิมทุกประการ (regression-safe)', () => {
  const worldA = makeControlledWorld(10, 10);
  placeWood(worldA, 2, 2, 100);
  const expected = worldA.harvestAt(2, 2, 10); // ผลลัพธ์อ้างอิงจากโลกที่ไม่มี governance เลย

  const worldB = makeControlledWorld(10, 10);
  placeWood(worldB, 2, 2, 100);
  const governance = new GovernanceSystem({ world: worldB });
  const settlement = new Settlement();
  const harvester = new Character({ x: 2, y: 2, needs: {} });

  governance.setSettlements([settlement]);
  governance.setCurrentHarvester(harvester);
  const actual = worldB.harvestAt(2, 2, 10); // เรียกผ่าน harvestAt ที่ถูก wrap แล้ว แต่ไม่มีกฎหมายเปิดอยู่

  assert.equal(actual, expected);
});

test('GovernanceSystem.applyTradeLaws: เปิด trade_tax แล้วหักภาษีจากผู้รับเงินเข้าคลังถิ่นฐานถูกต้อง', () => {
  const settlement = new Settlement();
  const leader = new Character({ needs: {} });
  settlement.leaderId = leader.id;
  const seller = new Character({ needs: {} });
  seller.homeSettlementId = settlement.id;
  const buyer = new Character({ needs: {} });

  const governance = new GovernanceSystem({});
  governance.lawsetRegistry.enableLaw(settlement, leader.id, 'trade_tax', { rate: 0.2 });

  const deal = { type: 'xcoin', kind: 'goods', price: 50, buyerId: buyer.id, sellerId: seller.id };
  const sellerBalanceBeforeTax = seller.wallet.balance; // settlePayment ของเฟส 7 โอนเงินเต็มไปแล้วก่อนหน้านี้

  const effects = governance.applyTradeLaws([deal], [buyer, seller], [settlement]);

  assert.equal(effects.length, 1);
  assert.equal(effects[0].amount, 10); // 20% ของ 50
  assert.equal(seller.wallet.balance, sellerBalanceBeforeTax - 10);
  assert.equal(governance.getTreasuryBalance(settlement.id), 10);
});

test('GovernanceSystem.applyTradeLaws: ไม่เก็บภาษีธุรกรรมแบบ barter หรือถ้าไม่ได้เปิดกฎหมาย', () => {
  const settlement = new Settlement();
  const leader = new Character({ needs: {} });
  settlement.leaderId = leader.id;
  const seller = new Character({ needs: {} });
  seller.homeSettlementId = settlement.id;
  const buyer = new Character({ needs: {} });

  const governance = new GovernanceSystem({});
  // ไม่เปิด trade_tax เลย
  const xcoinDeal = { type: 'xcoin', price: 50, buyerId: buyer.id, sellerId: seller.id };
  governance.applyTradeLaws([xcoinDeal], [buyer, seller], [settlement]);
  assert.equal(governance.getTreasuryBalance(settlement.id), 0);

  governance.lawsetRegistry.enableLaw(settlement, leader.id, 'trade_tax', { rate: 0.2 });
  const barterDeal = { type: 'barter', price: 0, buyerId: buyer.id, sellerId: seller.id };
  governance.applyTradeLaws([barterDeal], [buyer, seller], [settlement]);
  assert.equal(governance.getTreasuryBalance(settlement.id), 0);
});

test('GovernanceSystem: territorial_access โหมด block ปฏิเสธคนนอกถิ่นฐานเก็บทรัพยากรในเขตสนิท ไม่แตะทรัพยากรจริงด้วย', () => {
  const world = makeControlledWorld(10, 10);
  placeWood(world, 2, 2, 100);
  const governance = new GovernanceSystem({ world });

  const settlement = new Settlement();
  const leader = new Character({ needs: {} });
  settlement.leaderId = leader.id;
  governance.lawsetRegistry.enableLaw(settlement, leader.id, 'territorial_access', {
    minX: 0,
    minY: 0,
    maxX: 5,
    maxY: 5,
    mode: 'block',
  });

  const outsider = new Character({ x: 2, y: 2, needs: {} }); // homeSettlementId เป็น null (ไม่ใช่สมาชิก)

  governance.setSettlements([settlement]);
  governance.setCurrentHarvester(outsider);
  const harvested = world.harvestAt(2, 2, 10);

  assert.equal(harvested, 0);
  assert.equal(world.grid.getCell(2, 2).resourceNode.amount, 100, 'ทรัพยากรในโลกต้องไม่ถูกหักเลย');
  assert.equal(governance.totalBlockedGathers, 1);
  assert.equal(governance.totalPenalizedGathers, 0);
});

test('GovernanceSystem: territorial_access โหมด penalty ยอมให้เก็บแต่ยึดไปตาม confiscationRate', () => {
  const world = makeControlledWorld(10, 10);
  placeWood(world, 2, 2, 100);
  const governance = new GovernanceSystem({ world });

  const settlement = new Settlement();
  const leader = new Character({ needs: {} });
  settlement.leaderId = leader.id;
  governance.lawsetRegistry.enableLaw(settlement, leader.id, 'territorial_access', {
    minX: 0,
    minY: 0,
    maxX: 5,
    maxY: 5,
    mode: 'penalty',
    confiscationRate: 0.5,
  });

  const outsider = new Character({ x: 2, y: 2, needs: {} });

  governance.setSettlements([settlement]);
  governance.setCurrentHarvester(outsider);
  const harvested = world.harvestAt(2, 2, 10);

  assert.equal(harvested, 5); // เก็บได้จริง 10 แต่ถูกยึดครึ่งหนึ่ง
  assert.equal(world.grid.getCell(2, 2).resourceNode.amount, 90, 'ทรัพยากรในโลกต้องถูกหักเต็มจำนวนที่เก็บจริง');
  assert.equal(governance.totalPenalizedGathers, 1);
  assert.equal(governance.totalBlockedGathers, 0);
});

test('GovernanceSystem: territorial_access ไม่กระทบสมาชิกถิ่นฐานเจ้าของเขตเอง หรือคนที่เก็บนอกเขต', () => {
  const world = makeControlledWorld(10, 10);
  placeWood(world, 2, 2, 100);
  placeWood(world, 8, 8, 100);
  const governance = new GovernanceSystem({ world });

  const settlement = new Settlement();
  const leader = new Character({ needs: {} });
  settlement.leaderId = leader.id;
  governance.lawsetRegistry.enableLaw(settlement, leader.id, 'territorial_access', {
    minX: 0,
    minY: 0,
    maxX: 5,
    maxY: 5,
    mode: 'block',
  });
  governance.setSettlements([settlement]);

  const member = new Character({ x: 2, y: 2, needs: {} });
  member.homeSettlementId = settlement.id;
  governance.setCurrentHarvester(member);
  assert.equal(world.harvestAt(2, 2, 10), 10, 'สมาชิกถิ่นฐานเองต้องเก็บในเขตของตัวเองได้ปกติ');

  const outsiderElsewhere = new Character({ x: 8, y: 8, needs: {} });
  governance.setCurrentHarvester(outsiderElsewhere);
  assert.equal(world.harvestAt(8, 8, 10), 10, 'นอกเขตที่กำหนด ใครเก็บก็ได้ตามปกติ');
});
