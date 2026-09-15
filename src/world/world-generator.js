import { RESOURCE_TYPES, RESOURCE_CONFIG } from './resource-types.js';
import { ResourceNode } from './resource-node.js';
import { createRng } from './random.js';

const ALL_TYPES = Object.values(RESOURCE_TYPES);

// ความหนาแน่นของจุดทรัพยากรต่อช่อง (สัดส่วนของ cell ทั้งหมดที่จะมีทรัพยากร)
const DEFAULT_DENSITY = 0.15;

// สุ่มวางจุดทรัพยากรธรรมชาติลงบน grid
export function generateWorld(grid, { seed, density = DEFAULT_DENSITY } = {}) {
  const rng = createRng(seed ?? Date.now());

  grid.forEachCell((cell) => {
    if (rng() >= density) return;
    const type = ALL_TYPES[Math.floor(rng() * ALL_TYPES.length)];
    const config = RESOURCE_CONFIG[type];
    // เริ่มต้นด้วยปริมาณสุ่มระหว่าง 50%-100% ของค่าสูงสุด
    const amount = config.maxAmount * (0.5 + rng() * 0.5);
    cell.resourceNode = new ResourceNode(type, {
      amount,
      maxAmount: config.maxAmount,
      regenRate: config.regenRate,
    });
  });

  return grid;
}
