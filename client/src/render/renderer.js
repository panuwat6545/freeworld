// Renderer หลัก — วาดทุกอย่างด้วย Canvas 2D API ล้วนๆ (fillRect เท่านั้น ไม่มี ctx.arc()/ctx.ellipse()/รูปภาพ
// จากไฟล์ภายนอกเลย) ทุกอย่างที่เห็นบนจอมาจาก sprite pixel-art ที่นิยามเองใน sprites.js ทั้งหมด
import { RESOURCE_TYPES } from '../../../src/world/resource-types.js';
import { BLUEPRINTS } from '../../../src/building/blueprints.js';
import { drawSprite } from './sprite-utils.js';
import {
  GRASS_SPRITE,
  GRASS_PALETTE,
  WOOD_SPRITE,
  WOOD_PALETTE,
  WATER_SPRITE,
  WATER_PALETTE,
  ORE_SPRITE,
  ORE_PALETTE,
  FOOD_SPRITE,
  FOOD_PALETTE,
  SHELTER_SPRITE,
  SHELTER_PALETTE,
  CHARACTER_FRAME_A,
  CHARACTER_FRAME_B,
  buildCharacterPalette,
} from './sprites.js';

export const TILE_SIZE = 20; // พิกเซลจริงบนจอต่อ 1 ช่อง grid (sprite tile กว้าง 10 พิกเซล x2 พอดี ไม่มีรอยต่อ)
const SPRITE_PIXEL = TILE_SIZE / 10;

const RESOURCE_SPRITE_BY_TYPE = {
  [RESOURCE_TYPES.WOOD]: [WOOD_SPRITE, WOOD_PALETTE],
  [RESOURCE_TYPES.WATER]: [WATER_SPRITE, WATER_PALETTE],
  [RESOURCE_TYPES.ORE]: [ORE_SPRITE, ORE_PALETTE],
  [RESOURCE_TYPES.FOOD]: [FOOD_SPRITE, FOOD_PALETTE],
};

// วาดพื้นหญ้าเต็มโลก + ทรัพยากรที่ยังไม่หมด (amount > 0) ทับด้านบน
function drawTerrain(ctx, world) {
  world.grid.forEachCell((cell) => {
    const x = cell.x * TILE_SIZE;
    const y = cell.y * TILE_SIZE;
    drawSprite(ctx, GRASS_SPRITE, GRASS_PALETTE, x, y, SPRITE_PIXEL);

    if (cell.resourceNode && cell.resourceNode.amount > 0) {
      const entry = RESOURCE_SPRITE_BY_TYPE[cell.resourceNode.type];
      if (entry) drawSprite(ctx, entry[0], entry[1], x, y, SPRITE_PIXEL);
    }
  });
}

function drawStructures(ctx, world) {
  for (const structure of world.structures) {
    if (structure.type !== BLUEPRINTS.shelter.id) continue;
    const x = structure.position.x * TILE_SIZE;
    // ที่พักสูงกว่า 1 ช่อง (12 แถว vs tile 10 แถว) ให้ฐาน (แถวล่างสุด) ตรงกับพื้นของช่อง grid พอดี
    const y = structure.position.y * TILE_SIZE - (SHELTER_SPRITE.length - 10) * SPRITE_PIXEL;
    drawSprite(ctx, SHELTER_SPRITE, SHELTER_PALETTE, x, y, SPRITE_PIXEL);
  }
}

// เขตถิ่นฐาน (เฟส 4) แสดงเป็นกรอบสี่เหลี่ยมเส้นประรอบตำแหน่งที่พักทั้งหมดของถิ่นฐานนั้น
function drawSettlementBoundaries(ctx, world, settlements) {
  const colors = ['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#8338ec'];

  settlements.forEach((settlement, index) => {
    const positions = world.structures
      .filter((s) => settlement.structureIds.includes(s.id))
      .map((s) => s.position);
    if (positions.length === 0) return;

    const margin = 1;
    const minX = Math.max(0, Math.min(...positions.map((p) => p.x)) - margin);
    const minY = Math.max(0, Math.min(...positions.map((p) => p.y)) - margin);
    const maxX = Math.min(world.width - 1, Math.max(...positions.map((p) => p.x)) + margin);
    const maxY = Math.min(world.height - 1, Math.max(...positions.map((p) => p.y)) + margin);

    ctx.save();
    ctx.strokeStyle = colors[index % colors.length];
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      minX * TILE_SIZE,
      minY * TILE_SIZE,
      (maxX - minX + 1) * TILE_SIZE,
      (maxY - minY + 1) * TILE_SIZE,
    );
    ctx.restore();
  });
}

// เดินสลับเฟรม A/B ทุกๆ ครึ่งวินาทีจริง (ไม่ผูกกับ tick ของซิมูเลชัน เพราะอยากให้ animation ลื่นสม่ำเสมอ
// ไม่ว่าจะเร่งความเร็วเวลาซิมูเลชันแค่ไหนก็ตาม)
function isWalkFrameB(nowMs) {
  return Math.floor(nowMs / 500) % 2 === 1;
}

function drawCharacters(ctx, characters, nowMs, selectedCharacterId) {
  const frame = isWalkFrameB(nowMs) ? CHARACTER_FRAME_B : CHARACTER_FRAME_A;

  for (const character of characters) {
    const palette = buildCharacterPalette(character.profession);
    const x = character.position.x * TILE_SIZE;
    // ตัวละครสูงกว่า tile (14 แถว vs 10) ให้เท้า (แถวล่างสุด) ตรงกับพื้นของช่อง grid พอดี เหมือนที่พัก
    const y = character.position.y * TILE_SIZE - (frame.length - 10) * SPRITE_PIXEL;
    drawSprite(ctx, frame, palette, x, y, SPRITE_PIXEL);

    if (character.id === selectedCharacterId) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, TILE_SIZE + 4, frame.length * SPRITE_PIXEL + 4);
      ctx.restore();
    }
  }
}

// วาด 1 เฟรมเต็ม — เรียกจาก game loop ทุกครั้งที่ requestAnimationFrame ยิง (ไม่ว่าซิมูเลชันจะขยับ tick
// รอบนี้หรือไม่ก็ตาม เพื่อให้ animation เดิน/กล้องขยับลื่นแม้ตอนหยุดเวลา)
export function renderFrame(ctx, { world, characters, settlements }, nowMs, selectedCharacterId) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawTerrain(ctx, world);
  drawStructures(ctx, world);
  drawSettlementBoundaries(ctx, world, settlements);
  drawCharacters(ctx, characters, nowMs, selectedCharacterId);
}

export function canvasSizeFor(world) {
  return { width: world.width * TILE_SIZE, height: world.height * TILE_SIZE };
}
