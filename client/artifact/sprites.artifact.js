// เวอร์ชันของ sprites.js สำหรับ publish เป็น Claude Artifact เท่านั้น (ไฟล์เดียวจบในตัว/self-contained
// ตามข้อจำกัดของหน้า Artifact ที่ไม่รองรับการ fetch ไฟล์แยกจากโฟลเดอร์ /assets/) — ไม่ใช่โค้ดที่
// client/ ตัวจริงใช้เลย client/src/render/renderer.js ตัวจริงยัง import จาก
// client/src/render/sprites.js เดิมเป๊ะ (โหลด PNG จากไฟล์แยกผ่าน Express server ได้ตามปกติ ไม่ถูกแตะ
// ต้องแม้แต่บรรทัดเดียว) ไฟล์นี้ถูกสลับเข้ามาแทนเฉพาะตอน build ด้วย client/artifact/build.js ผ่าน
// esbuild resolve plugin เท่านั้น
//
// ต่างจาก sprites.js เดิมจุดเดียว: loadImage() ใช้ base64 data URI ที่ฝังไว้ใน sprite-data.generated.js
// (generate จาก client/artifact/generate-sprite-data.js) แทนการสร้าง URL ไปโหลดไฟล์แยก — Image.src
// รับ data: URI ได้ตรงๆ ไม่ต้อง fetch เครือข่ายเลย จึงใช้ในหน้า Artifact ที่ปิด fetch ภายนอกได้
//
// ตาราง mapping ด้านล่าง (PROFESSION_ASSET_NAME/DIRECTIONS/TILE_ASSET_FILES/HOUSE_ASSET_FILES) คัดลอกมา
// จาก client/src/render/sprites.js ตรงๆ (ไฟล์นั้นไม่ export ค่าพวกนี้ออกมาให้ใช้ร่วม และตามที่สั่งให้แยก
// ไฟล์นี้ออกจากโค้ดหลักโดยสิ้นเชิง) — ถ้าแก้ mapping ในไฟล์จริงต้องมาแก้ที่นี่ให้ตรงกันด้วย
import { parseSprite, row, drawSprite } from '../src/render/sprite-utils.js';
import { SPRITE_DATA_URIS } from './sprite-data.generated.js';

export { drawSprite };

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

function loadImage(fileName) {
  const dataUri = SPRITE_DATA_URIS[fileName];
  if (!dataUri) {
    return Promise.reject(
      new Error(`ไม่พบ sprite ที่ฝังไว้: ${fileName} (ลืมรัน generate-sprite-data.js ใหม่หลังเพิ่ม/เปลี่ยนไฟล์ภาพหรือเปล่า?)`),
    );
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`โหลด sprite ที่ฝังไว้ไม่สำเร็จ: ${fileName}`));
    img.src = dataUri;
  });
}

// โหลด sprite ทั้งหมดล่วงหน้าตอนเริ่มเกม (preload) เหมือน sprites.js เดิมทุกประการ ต่างแค่แหล่งที่มาของภาพ
export async function loadSpriteImages() {
  const jobs = [];

  const professionAssetNames = [...Object.values(PROFESSION_ASSET_NAME), UNEMPLOYED_ASSET_NAME];
  for (const assetName of professionAssetNames) {
    for (const direction of DIRECTIONS) {
      const key = `${assetName}_${direction}`;
      jobs.push(
        loadImage(`character_${assetName}_${direction}.png`).then((img) => {
          characterImages.set(key, img);
        }),
      );
    }
  }

  for (const [key, fileName] of Object.entries(TILE_ASSET_FILES)) {
    jobs.push(loadImage(fileName).then((img) => tileImages.set(key, img)));
  }

  for (const [key, fileName] of Object.entries(HOUSE_ASSET_FILES)) {
    jobs.push(loadImage(fileName).then((img) => houseImages.set(key, img)));
  }

  await Promise.all(jobs);
}

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

// ===== เงาใต้เท้าตัวละคร — เหมือน sprites.js เดิมทุกประการ (pixel blob ด้วย fillRect ไม่ใช้ ctx.ellipse()) =====
const SHADOW_LEGEND = { x: 1 };
const SHADOW_ROWS = [row(8, [[2, 5, 'x']]), row(8, [[1, 6, 'x']]), row(8, [[2, 5, 'x']])];
export const SHADOW_SPRITE = parseSprite(SHADOW_ROWS, SHADOW_LEGEND);
export const SHADOW_PALETTE = [null, 'rgba(20, 15, 10, 0.35)'];
