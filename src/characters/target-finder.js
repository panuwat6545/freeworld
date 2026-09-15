import { chebyshevDistance } from './movement.js';

// หาจุดทรัพยากรชนิดที่กำหนดซึ่งใกล้ตำแหน่ง from มากที่สุด (ต้องมีของเหลืออยู่ > 0)
export function findNearestResourceCell(world, from, resourceType) {
  let nearestCell = null;
  let nearestDistance = Infinity;

  world.grid.forEachCell((cell) => {
    const node = cell.resourceNode;
    if (!node || node.type !== resourceType || node.amount <= 0) return;
    const distance = chebyshevDistance(from, cell);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestCell = cell;
    }
  });

  return nearestCell;
}

// หาตัวละครอื่นที่ใกล้ตัวละครที่กำหนดมากที่สุด
export function findNearestCharacter(character, allCharacters) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const other of allCharacters) {
    if (other === character) continue;
    const distance = chebyshevDistance(character.position, other.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = other;
    }
  }

  return nearest;
}
