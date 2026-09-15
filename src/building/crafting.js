import { BLUEPRINTS } from './blueprints.js';
import { Structure } from './structure.js';

// ตรวจว่า inventory ที่ให้มามีทรัพยากรครบตามสูตร blueprint หรือยัง
export function hasEnoughResources(inventory, blueprint) {
  return Object.entries(blueprint.cost).every(([resource, amount]) => (inventory[resource] ?? 0) >= amount);
}

export function canBuild(character, blueprintId) {
  const blueprint = BLUEPRINTS[blueprintId];
  if (!blueprint) return false;
  return hasEnoughResources(character.inventory, blueprint);
}

// สร้างสิ่งก่อสร้างที่ตำแหน่งของตัวละคร หักทรัพยากรออกจาก inventory แล้ววางลงบนโลก
// คืนค่า Structure ที่สร้างได้ หรือ null ถ้าทรัพยากรไม่พอ
export function build(character, world, blueprintId) {
  const blueprint = BLUEPRINTS[blueprintId];
  if (!blueprint || !hasEnoughResources(character.inventory, blueprint)) return null;

  for (const [resource, amount] of Object.entries(blueprint.cost)) {
    character.inventory[resource] -= amount;
  }

  const structure = new Structure({
    type: blueprint.id,
    x: character.position.x,
    y: character.position.y,
    builtByCharacterId: character.id,
    builtAtTick: world.tick,
  });
  world.structures.push(structure);
  return structure;
}
