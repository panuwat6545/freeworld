import { chebyshevDistance } from '../characters/movement.js';

// หาสิ่งก่อสร้างชนิดที่กำหนดซึ่งอยู่ใกล้ตำแหน่งที่ให้มามากที่สุดในโลกนี้
export function findNearestStructure(world, position, type) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const structure of world.structures) {
    if (structure.type !== type) continue;
    const distance = chebyshevDistance(position, structure.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = structure;
    }
  }

  return nearest;
}

// ตรวจว่าตำแหน่งที่ให้มาอยู่ในระยะ radius ของสิ่งก่อสร้างชนิดนี้หรือไม่ (ระยะแบบ Chebyshev)
export function isNearStructureType(world, position, type, radius) {
  const nearest = findNearestStructure(world, position, type);
  return Boolean(nearest) && chebyshevDistance(position, nearest.position) <= radius;
}
