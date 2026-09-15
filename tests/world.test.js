import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { Grid } from '../src/world/grid.js';
import { ResourceNode } from '../src/world/resource-node.js';
import { RESOURCE_TYPES } from '../src/world/resource-types.js';

test('โลกถูกสร้างเป็น grid ขนาด 40x40 โดยดีฟอลต์', () => {
  const world = new World({ seed: 1 });
  assert.equal(world.width, 40);
  assert.equal(world.height, 40);
  assert.equal(world.grid.cells.length, 40);
  assert.equal(world.grid.cells[0].length, 40);
});

test('การสร้างโลกแบบ seed เดียวกันให้ผลลัพธ์เดิมทุกครั้ง (deterministic)', () => {
  const worldA = new World({ seed: 123 });
  const worldB = new World({ seed: 123 });
  assert.deepEqual(worldA.getResourceTotals(), worldB.getResourceTotals());
  assert.equal(worldA.countResourceNodes(), worldB.countResourceNodes());
});

test('ResourceNode งอกใหม่ตามเวลาแต่ไม่เกินค่าสูงสุด', () => {
  const node = new ResourceNode(RESOURCE_TYPES.WOOD, { amount: 0, maxAmount: 10, regenRate: 3 });
  node.update(1);
  assert.equal(node.amount, 3);
  node.update(10);
  assert.equal(node.amount, 10);
});

test('harvest เก็บได้ไม่เกินปริมาณที่มีอยู่จริง', () => {
  const node = new ResourceNode(RESOURCE_TYPES.WATER, { amount: 5, maxAmount: 100, regenRate: 1 });
  const harvested = node.harvest(20);
  assert.equal(harvested, 5);
  assert.equal(node.amount, 0);
  assert.ok(node.isDepleted());
});

test('World.update ทำให้ทรัพยากรทั้งโลกงอกกลับมาหลังถูกเก็บเกี่ยว', () => {
  const world = new World({ seed: 7 });
  let target = null;
  world.grid.forEachCell((cell) => {
    if (!target && cell.resourceNode) target = cell;
  });
  assert.ok(target, 'ควรมีจุดทรัพยากรอย่างน้อยหนึ่งจุด');

  world.harvestAt(target.x, target.y, 1000);
  assert.equal(target.resourceNode.amount, 0);

  world.update(5);
  assert.ok(target.resourceNode.amount > 0);
  assert.equal(world.tick, 5);
});

test('Grid.getCell คืนค่า null เมื่อพิกัดอยู่นอกขอบเขต', () => {
  const grid = new Grid(40, 40);
  assert.equal(grid.getCell(-1, 0), null);
  assert.equal(grid.getCell(0, 40), null);
  assert.ok(grid.getCell(39, 39));
});
