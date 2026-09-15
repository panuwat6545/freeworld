import { Grid } from './grid.js';
import { generateWorld } from './world-generator.js';
import { RESOURCE_TYPES } from './resource-types.js';

const DEFAULT_WIDTH = 40;
const DEFAULT_HEIGHT = 40;

// โลกจำลอง: ครอบ grid และควบคุมการผ่านไปของเวลา (tick) เพื่อให้ทรัพยากรงอกใหม่
export class World {
  constructor({ width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, seed, density } = {}) {
    this.width = width;
    this.height = height;
    this.tick = 0;
    this.grid = new Grid(width, height);
    this.structures = []; // สิ่งก่อสร้างทั้งหมดที่ถูกสร้างในโลกนี้ (ดู src/building)
    generateWorld(this.grid, { seed, density });
  }

  // เดินเวลาไปข้างหน้า deltaTicks ช่วง ทำให้ทรัพยากรทุกจุดงอกใหม่ตามอัตราของมัน
  update(deltaTicks = 1) {
    this.tick += deltaTicks;
    this.grid.forEachCell((cell) => {
      cell.resourceNode?.update(deltaTicks);
    });
  }

  harvestAt(x, y, quantity) {
    const cell = this.grid.getCell(x, y);
    if (!cell?.resourceNode) return 0;
    return cell.resourceNode.harvest(quantity);
  }

  // รวมปริมาณทรัพยากรทั้งหมดในโลก แยกตามชนิด
  getResourceTotals() {
    const totals = Object.fromEntries(Object.values(RESOURCE_TYPES).map((t) => [t, 0]));
    this.grid.forEachCell((cell) => {
      if (cell.resourceNode) {
        totals[cell.resourceNode.type] += cell.resourceNode.amount;
      }
    });
    return totals;
  }

  countResourceNodes() {
    let count = 0;
    this.grid.forEachCell((cell) => {
      if (cell.resourceNode) count += 1;
    });
    return count;
  }
}
