// Renderer หลัก — วาดตัวโลก/ตัวละครด้วยไฟล์ภาพ PNG จริงที่ Tonlyw สร้างขึ้นเอง (เก็บที่
// client/assets/sprites/ ดูรายละเอียดที่มาใน README หัวข้อ "เฟส 11") ผ่าน ctx.drawImage() เป็นหลัก — ส่วน
// เดียวที่ยังวาดด้วยโค้ด (fillRect ล้วนๆ) คือเงาโปร่งแสงใต้เท้าตัวละคร เพราะไม่มีไฟล์ภาพแยกสำหรับเงา
import { RESOURCE_TYPES } from '../../../src/world/resource-types.js';
import { BLUEPRINTS } from '../../../src/building/blueprints.js';
import { drawSprite } from './sprite-utils.js';
import { CharacterDirectionTracker } from './character-direction.js';
import { getCharacterImage, getTileImage, getHouseImage, SHADOW_SPRITE, SHADOW_PALETTE } from './sprites.js';
import { drawCharacterIndicators } from './character-status.js';

export { loadSpriteImages } from './sprites.js';

const NATIVE_TILE_SIZE = 16; // ความกว้าง/สูงต้นทางของไฟล์ภาพ grass/water/tree/ore/food (พิกเซล)
const SPRITE_SCALE = 2; // อัตราขยายจากภาพต้นทางไปเป็นพิกเซลจริงบนจอ (คงเส้นคงวาทั้งเกม)
export const TILE_SIZE = NATIVE_TILE_SIZE * SPRITE_SCALE; // = 32 พิกเซลจริงบนจอต่อ 1 ช่อง grid
const SHADOW_ONSCREEN_WIDTH = SHADOW_SPRITE[0].length * SPRITE_SCALE;
const SHADOW_ONSCREEN_HEIGHT = SHADOW_SPRITE.length * SPRITE_SCALE;

const directionTracker = new CharacterDirectionTracker();

// หาว่าที่พักหลังนี้ (structureId) เป็นของถิ่นฐานลำดับที่เท่าไหร่ (index ใน settlements array) เพื่อเลือก
// เฉดสีหลังคาให้ต่างกันตามถิ่นฐาน — คืนค่า -1 ถ้ายังไม่สังกัดถิ่นฐานไหนเลย (ใช้เฉดแดงเป็นค่าเริ่มต้น)
function settlementIndexForStructure(structureId, settlements) {
  return settlements.findIndex((settlement) => settlement.structureIds.includes(structureId));
}

const RESOURCE_TILE_KEY_BY_TYPE = {
  [RESOURCE_TYPES.WOOD]: 'wood',
  [RESOURCE_TYPES.WATER]: 'water',
  [RESOURCE_TYPES.ORE]: 'ore',
  [RESOURCE_TYPES.FOOD]: 'food',
};

// วาดภาพ tile 1 ช่อง โดยขยายจากขนาดต้นทางจริงของไฟล์ (img.naturalWidth/Height) ด้วย SPRITE_SCALE คงที่ —
// ถ้าภาพสูงกว่า 1 tile (เช่นต้นไม้/บ้าน) จัดให้ฐาน (แถวล่างสุดของภาพ) ตรงกับพื้นของช่อง grid พอดีเสมอ
// (แนวเดียวกับที่ sprite pixel-art โค้ดเดิมเคยทำกับที่พัก/ตัวละครที่สูงกว่า tile)
function drawGroundedImage(ctx, img, gridX, gridY) {
  const width = img.naturalWidth * SPRITE_SCALE;
  const height = img.naturalHeight * SPRITE_SCALE;
  const x = gridX * TILE_SIZE;
  const y = gridY * TILE_SIZE - (height - TILE_SIZE);
  ctx.drawImage(img, x, y, width, height);
}

// วาดพื้นหญ้าเต็มโลก + ทรัพยากรที่ยังไม่หมด (amount > 0) ทับด้านบน
function drawTerrain(ctx, world) {
  const grassImage = getTileImage('grass');

  world.grid.forEachCell((cell) => {
    const x = cell.x * TILE_SIZE;
    const y = cell.y * TILE_SIZE;
    ctx.drawImage(grassImage, x, y, TILE_SIZE, TILE_SIZE);

    if (cell.resourceNode && cell.resourceNode.amount > 0) {
      const tileKey = RESOURCE_TILE_KEY_BY_TYPE[cell.resourceNode.type];
      const image = tileKey && getTileImage(tileKey);
      if (image) drawGroundedImage(ctx, image, cell.x, cell.y);
    }
  });
}

function drawStructures(ctx, world, settlements) {
  for (const structure of world.structures) {
    if (structure.type !== BLUEPRINTS.shelter.id) continue;
    // หลังคาสลับสีแดง/น้ำเงินตามลำดับถิ่นฐานที่สังกัด ให้แยกกลุ่มบ้านแต่ละถิ่นฐานออกจากกันด้วยสี
    const settlementIndex = settlementIndexForStructure(structure.id, settlements);
    const variant = settlementIndex >= 0 && settlementIndex % 2 === 1 ? 'blue' : 'red';
    drawGroundedImage(ctx, getHouseImage(variant), structure.position.x, structure.position.y);
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

function drawCharacters(ctx, simulation, selectedCharacterId) {
  for (const character of simulation.characters) {
    const direction = directionTracker.getDirection(character);
    const image = getCharacterImage(character.profession, direction);
    const width = image.naturalWidth * SPRITE_SCALE;
    const height = image.naturalHeight * SPRITE_SCALE;
    const x = character.position.x * TILE_SIZE;
    // ตัวละครสูงกว่า tile ให้เท้า (แถวล่างสุดของภาพ) ตรงกับพื้นของช่อง grid พอดี เหมือนที่พัก/ต้นไม้
    const y = character.position.y * TILE_SIZE - (height - TILE_SIZE);
    const feetY = character.position.y * TILE_SIZE + TILE_SIZE;

    // วาดเงาใต้เท้าก่อนตัวละครเสมอ ให้ตัวละครดูยืนทับเงาอยู่ (ขาบังเงาบางส่วนได้ตามธรรมชาติ) — ยังคงเป็น
    // pixel blob โค้ดเดิม (ไม่ใช่ ctx.ellipse()) เพราะไม่มีไฟล์ภาพแยกสำหรับเงา
    drawSprite(
      ctx,
      SHADOW_SPRITE,
      SHADOW_PALETTE,
      x + (width - SHADOW_ONSCREEN_WIDTH) / 2,
      feetY - SHADOW_ONSCREEN_HEIGHT / 2,
      SPRITE_SCALE,
    );
    ctx.drawImage(image, x, y, width, height);
    // indicator (วงอาชีพ+สถานะ) วาดเหนือขอบบนของภาพเสมอ (y คือขอบบนพอดี) จึงไม่มีทางทับตัวภาพตัวละคร —
    // panel รายละเอียดที่คลิกดูได้เป็น DOM element แยกชั้นอยู่เหนือ canvas อยู่แล้ว จึงไม่มีทางถูก indicator
    // นี้บังเช่นกัน (ดู client/src/ui/overlay.js)
    drawCharacterIndicators(ctx, character, simulation, x + width / 2, y);

    if (character.id === selectedCharacterId) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
      ctx.restore();
    }
  }
}

// วาด 1 เฟรมเต็ม — เรียกจาก game loop ทุกครั้งที่ requestAnimationFrame ยิง (ไม่ว่าซิมูเลชันจะขยับ tick
// รอบนี้หรือไม่ก็ตาม เพื่อให้กล้อง/การคลิกยังลื่นแม้ตอนหยุดเวลา) ต้อง loadSpriteImages() ให้เสร็จก่อนเรียก
// ฟังก์ชันนี้เสมอ (ดู main.js) ไม่งั้น getCharacterImage()/getTileImage() จะคืนค่า undefined — ไม่รับ nowMs
// อีกต่อไปเพราะภาพชุดนี้เป็นภาพนิ่งเฟรมเดียวต่อทิศทาง/ทรัพยากร ไม่มี animation ที่ผูกกับเวลาแล้ว
export function renderFrame(ctx, simulation, selectedCharacterId) {
  const { world, settlements } = simulation;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawTerrain(ctx, world);
  drawStructures(ctx, world, settlements);
  drawSettlementBoundaries(ctx, world, settlements);
  drawCharacters(ctx, simulation, selectedCharacterId);
}

export function canvasSizeFor(world) {
  return { width: world.width * TILE_SIZE, height: world.height * TILE_SIZE };
}
