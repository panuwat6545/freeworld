// ชนิดทรัพยากรธรรมชาติที่มีอยู่ในโลก
export const RESOURCE_TYPES = Object.freeze({
  WOOD: 'wood',
  WATER: 'water',
  ORE: 'ore',
  FOOD: 'food',
});

// ค่าตั้งต้นของแต่ละชนิดทรัพยากร: ปริมาณสูงสุดต่อจุด และอัตราการงอกใหม่ต่อ 1 tick
export const RESOURCE_CONFIG = Object.freeze({
  [RESOURCE_TYPES.WOOD]: { maxAmount: 100, regenRate: 1 },
  [RESOURCE_TYPES.WATER]: { maxAmount: 100, regenRate: 2 },
  [RESOURCE_TYPES.ORE]: { maxAmount: 100, regenRate: 0.2 },
  [RESOURCE_TYPES.FOOD]: { maxAmount: 100, regenRate: 1.5 },
});
