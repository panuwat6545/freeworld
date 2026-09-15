// โฟลเดอร์บน Drive ที่เก็บ snapshot ตามที่กำหนดไว้ใน docs/work-instruction.md ข้อ 6
export const SNAPSHOT_FOLDER_PATH = Object.freeze(['freeworld-ecosystem', 'snapshots']);

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ตั้งชื่อไฟล์ตามรูปแบบ snapshot_YYYY-MM-DD_HHmm.json (ใช้เวลาแบบ UTC เพื่อให้ผลลัพธ์คงที่ไม่ขึ้นกับ timezone เครื่อง)
export function formatSnapshotFilename(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hours = pad2(date.getUTCHours());
  const minutes = pad2(date.getUTCMinutes());
  return `snapshot_${year}-${month}-${day}_${hours}${minutes}.json`;
}

function collectResourceNodes(world) {
  const nodes = [];
  world.grid.forEachCell((cell) => {
    if (!cell.resourceNode) return;
    nodes.push({
      x: cell.x,
      y: cell.y,
      type: cell.resourceNode.type,
      amount: Number(cell.resourceNode.amount.toFixed(2)),
      maxAmount: cell.resourceNode.maxAmount,
    });
  });
  return nodes;
}

function summarizeStructure(structure) {
  return {
    id: structure.id,
    type: structure.type,
    position: structure.position,
    builtByCharacterId: structure.builtByCharacterId,
    builtAtTick: structure.builtAtTick,
  };
}

// สรุปตัวละครแบบสั้นๆ พอ ไม่เอา field ภายในทุกตัว เพื่อไม่ให้ไฟล์ snapshot ใหญ่เกินจำเป็น
function summarizeCharacter(character) {
  return {
    id: character.id,
    position: character.position,
    needs: Object.fromEntries(
      Object.entries(character.needs).map(([key, value]) => [key, Number(value.toFixed(1))]),
    ),
    inventory: character.inventory,
    currentBehavior: character.currentBehavior,
  };
}

// ประกอบ object ของ snapshot ตามสเปกใน work-instruction.md ข้อ 6
// (ต้องมีอย่างน้อย timestamp, gameYear, worldState, characterCount)
export function buildSnapshot(world, characters, gameYear) {
  return {
    timestamp: new Date().toISOString(),
    gameYear,
    characterCount: characters.length,
    worldState: {
      tick: world.tick,
      width: world.width,
      height: world.height,
      resourceNodes: collectResourceNodes(world),
      resourceTotals: world.getResourceTotals(),
      structures: world.structures.map(summarizeStructure),
    },
    characters: characters.map(summarizeCharacter),
  };
}
