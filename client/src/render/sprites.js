// นิยาม sprite ทั้งหมดของเกม — เดิมวาดด้วยโค้ด 100% ตั้งแต่เฟส 11 รอบแรก ตอนนี้เปลี่ยนมาใช้ไฟล์ภาพ PNG จริง
// ที่ Tonlyw สร้างขึ้นเอง (ด้วย AI image generator ตามคำสั่งของ Tonlyw โดยเฉพาะสำหรับโปรเจกต์นี้ ไม่ใช่ asset
// สำเร็จรูปจากที่อื่น) เก็บไว้ที่ client/assets/sprites/ เป็นแหล่งความจริงเดียว (single source of truth) —
// ดูรายละเอียดเพิ่มเติมในหัวข้อ "เฟส 11" ของ README.md
//
// ยังคงเหลือส่วนเดียวที่วาดด้วยโค้ดต่อไป: เงาโปร่งแสงใต้เท้าตัวละคร (SHADOW_SPRITE/SHADOW_PALETTE ด้านล่าง)
// เพราะไม่มีไฟล์ภาพสำหรับเงาแยกต่างหาก และเป็น "pixel blob" ธรรมดาที่โค้ดสร้างได้ง่ายกว่าอยู่แล้ว
import { parseSprite, row, drawSprite } from './sprite-utils.js';

export { drawSprite };

const SPRITE_BASE = '/assets/sprites';

// ตัวระบุอาชีพในโค้ด (src/professions/profession.js) ไม่ตรงกับชื่อไฟล์ภาพเป๊ะทุกตัว (water_carrier มี
// underscore แต่ไฟล์ภาพชื่อ watercarrier) จึงต้อง map ให้ตรงกันตรงนี้ที่เดียว
const PROFESSION_ASSET_NAME = {
  lumberjack: 'lumberjack',
  water_carrier: 'watercarrier',
  miner: 'miner',
  farmer: 'farmer',
  freelancer: 'freelancer',
};
const UNEMPLOYED_ASSET_NAME = 'unemployed'; // profession === null (ยังไม่มีอาชีพ)

const DIRECTIONS = ['down', 'up', 'left', 'right'];

const TILE_ASSET_FILES = {
  grass: 'grass.png',
  water: 'water.png',
  wood: 'tree.png',
  ore: 'ore.png',
  food: 'food.png',
};

const HOUSE_ASSET_FILES = {
  red: 'house_red.png',
  blue: 'house_blue.png',
};

const characterImages = new Map(); // "<professionAssetName>_<direction>" -> HTMLImageElement
const tileImages = new Map(); // key ของ TILE_ASSET_FILES -> HTMLImageElement
const houseImages = new Map(); // "red" | "blue" -> HTMLImageElement

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`โหลด sprite ไม่สำเร็จ: ${path}`));
    img.src = path;
  });
}

// โหลดไฟล์ PNG ทั้งหมดล่วงหน้าตอนเริ่มเกม (preload) — ต้อง await ให้เสร็จก่อนเริ่ม game loop เสมอ เพราะ
// renderFrame() ต้องใช้ img.naturalWidth/naturalHeight (สำหรับจัดตำแหน่ง "เท้าชนพื้น tile") ซึ่งมีค่าถูกต้อง
// ก็ต่อเมื่อภาพโหลดเสร็จแล้วเท่านั้น
export async function loadSpriteImages() {
  const jobs = [];

  const professionAssetNames = [...Object.values(PROFESSION_ASSET_NAME), UNEMPLOYED_ASSET_NAME];
  for (const assetName of professionAssetNames) {
    for (const direction of DIRECTIONS) {
      const key = `${assetName}_${direction}`;
      jobs.push(
        loadImage(`${SPRITE_BASE}/character_${assetName}_${direction}.png`).then((img) => {
          characterImages.set(key, img);
        }),
      );
    }
  }

  for (const [key, fileName] of Object.entries(TILE_ASSET_FILES)) {
    jobs.push(loadImage(`${SPRITE_BASE}/${fileName}`).then((img) => tileImages.set(key, img)));
  }

  for (const [key, fileName] of Object.entries(HOUSE_ASSET_FILES)) {
    jobs.push(loadImage(`${SPRITE_BASE}/${fileName}`).then((img) => houseImages.set(key, img)));
  }

  await Promise.all(jobs);
}

// คืนรูปตัวละครตามอาชีพ+ทิศทางจริง — profession === null (ยังไม่มีอาชีพ) ใช้ชุด "unemployed"
export function getCharacterImage(professionId, direction) {
  const assetName = professionId === null ? UNEMPLOYED_ASSET_NAME : (PROFESSION_ASSET_NAME[professionId] ?? UNEMPLOYED_ASSET_NAME);
  return characterImages.get(`${assetName}_${direction}`);
}

export function getTileImage(key) {
  return tileImages.get(key);
}

export function getHouseImage(variant) {
  return houseImages.get(variant);
}

// ===== เงาใต้เท้าตัวละคร — ส่วนเดียวที่ยังวาดด้วยโค้ด (pixel blob ทรงรี ด้วย fillRect ล้วนๆ ไม่ใช่
// ctx.ellipse()) เพราะไม่มีไฟล์ภาพแยกสำหรับเงา และใช้สี rgba โปร่งแสงทำให้ตัวละครดูยืนอยู่บนพื้นจริง =====
const SHADOW_LEGEND = { x: 1 };
const SHADOW_ROWS = [row(8, [[2, 5, 'x']]), row(8, [[1, 6, 'x']]), row(8, [[2, 5, 'x']])];
export const SHADOW_SPRITE = parseSprite(SHADOW_ROWS, SHADOW_LEGEND);
export const SHADOW_PALETTE = [null, 'rgba(20, 15, 10, 0.35)'];
