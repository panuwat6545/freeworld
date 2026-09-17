import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_ENTRY = join(__dirname, '..', 'client', 'src', 'main.js');

// smoke test ตามสเปกเฟส 11: "client build ผ่าน" — bundle จริงด้วย esbuild API (ไม่เขียนไฟล์ลงดิสก์ ใช้
// write:false เพื่อให้ test เร็วและไม่ไปแตะ client/dist/ ที่ npm run build:client สร้างไว้จริง) ยืนยันว่า
// import ทั้งสายจาก client/src/main.js -> src/world, characters, building, society, economy, trade,
// governance, professions, social-conditions ไม่มีจุดไหนติด Node-only API ที่ bundle เข้า browser ไม่ได้
// (ดู client/build.js เรื่อง stub 'googleapis' — ถ้า adapter นั้นพังหรือไม่ครอบคลุมพอ test นี้จะ fail ทันที)
test('client build: esbuild bundle client/src/main.js สำเร็จไม่มี error (import ทั้งสายจาก src/* ปลอดภัยสำหรับ browser)', async () => {
  const result = await build({
    entryPoints: [CLIENT_ENTRY],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    write: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'stub-googleapis-for-browser',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^googleapis$/ }, (args) => ({
            path: args.path,
            namespace: 'stub-googleapis',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'stub-googleapis' }, () => ({
            contents: 'export const google = {};',
            loader: 'js',
          }));
        },
      },
    ],
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.outputFiles.length, 1);
  assert.ok(result.outputFiles[0].text.length > 0);
});
