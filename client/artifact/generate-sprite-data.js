// สคริปต์ generate เฉพาะสำหรับ build เวอร์ชัน publish เป็น Claude Artifact เท่านั้น (ไม่เกี่ยวกับ
// client/ ตัวจริงที่รันกับ Express server เลย — ตัวนั้นยังโหลด PNG จากไฟล์แยกที่ client/assets/sprites/
// ได้ตามปกติ ไม่มีปัญหาอะไร) อ่านไฟล์ PNG ทุกไฟล์ใน client/assets/sprites/ แล้วแปลงเป็น base64 data URI
// เขียนออกเป็นโมดูล JS เดียว (sprite-data.generated.js) ให้ client/artifact/sprites.artifact.js
// import ไปฝังตรงใน bundle — เพราะหน้า Claude Artifact ต้องเป็นไฟล์ HTML/JS จบในตัว ไม่รองรับการ fetch
// ไฟล์ภาพแยกจากโฟลเดอร์ /assets/ แบบที่ local server ทำได้
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, '..', 'assets', 'sprites');
const OUTPUT_FILE = join(__dirname, 'sprite-data.generated.js');

const pngFiles = readdirSync(SPRITES_DIR).filter((name) => name.endsWith('.png'));

const entries = pngFiles.map((fileName) => {
  const base64 = readFileSync(join(SPRITES_DIR, fileName)).toString('base64');
  return `  ${JSON.stringify(fileName)}: ${JSON.stringify(`data:image/png;base64,${base64}`)},`;
});

const fileContents =
  '// ไฟล์นี้ generate อัตโนมัติโดย client/artifact/generate-sprite-data.js — ห้ามแก้มือ\n' +
  '// รันใหม่ทุกครั้งที่ไฟล์ภาพใน client/assets/sprites/ เปลี่ยน (client/artifact/build.js เรียกให้อัตโนมัติแล้ว)\n' +
  `export const SPRITE_DATA_URIS = {\n${entries.join('\n')}\n};\n`;

writeFileSync(OUTPUT_FILE, fileContents);
console.log(`[generate-sprite-data] ฝัง sprite ${pngFiles.length} ไฟล์เป็น base64 -> ${OUTPUT_FILE}`);
