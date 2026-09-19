// สคริปต์ build เฉพาะสำหรับเวอร์ชันที่จะ publish เป็น Claude Artifact เท่านั้น — แยกจาก
// client/build.js (ตัวจริงที่ build ให้รันกับ Express server) โดยสิ้นเชิงตามที่สั่ง ไม่แก้
// client/build.js หรือโค้ดหลักใน client/src/ เลยแม้แต่บรรทัดเดียว
//
// ทำ 2 อย่าง: (1) generate sprite-data.generated.js จากไฟล์ PNG ล่าสุดใน client/assets/sprites/ ก่อนเสมอ
// (2) bundle client/src/main.js ตัวจริงด้วย esbuild เหมือน client/build.js ทุกประการ ต่างแค่เพิ่ม resolve
// plugin ที่สลับให้ renderer.js import './sprites.js' (ตัวโหลดจากไฟล์แยก) ไปเป็น sprites.artifact.js
// (ตัวฝัง base64 data URI) แทน — main.js/renderer.js/ระบบซิมูเลชันอื่นๆ ไม่ถูกแก้ไขเลยสักบรรทัด แค่ถูก
// bundle ซ้ำด้วยแหล่งที่มาของภาพคนละแบบเท่านั้น
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

// ต้อง generate ให้เสร็จก่อน bundle เสมอ (sprites.artifact.js import ไฟล์นี้ตรงๆ)
execFileSync(process.execPath, [join(__dirname, 'generate-sprite-data.js')], { stdio: 'inherit' });

// เหมือนกับ stubGoogleapisPlugin ใน client/build.js เป๊ะ (import chain เดิมจาก src/economy/inflation.js
// ยังไหลผ่าน googleapis อยู่ดีไม่ว่าจะ build เวอร์ชันไหน)
const stubGoogleapisPlugin = {
  name: 'stub-googleapis-for-browser',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^googleapis$/ }, (args) => ({ path: args.path, namespace: 'stub-googleapis' }));
    pluginBuild.onLoad({ filter: /.*/, namespace: 'stub-googleapis' }, () => ({
      contents:
        "export const google = new Proxy({}, { get() { throw new Error('googleapis ถูก stub ไว้สำหรับ client — ไม่ควรถูกเรียกใช้จริงในเบราว์เซอร์ ฝั่ง server เท่านั้นที่คุยกับ Google Drive จริง'); } });",
      loader: 'js',
    }));
  },
};

// สลับเฉพาะ import './sprites.js' ตัวเดียว (มีแค่ renderer.js ตัวเดียวที่ import ด้วย specifier นี้เป๊ะๆ)
// ให้ไปเป็น sprites.artifact.js แทน — ไม่กระทบ import อื่นใดใน bundle เลย
const useArtifactSpritesPlugin = {
  name: 'use-artifact-sprites',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^\.\/sprites\.js$/ }, () => ({
      path: join(__dirname, 'sprites.artifact.js'),
    }));
  },
};

const options = {
  entryPoints: [join(__dirname, '..', 'src', 'main.js')],
  outfile: join(__dirname, 'dist', 'bundle.js'),
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: false, // ไม่ต้องใช้ source map ในหน้า artifact (ลดขนาดไฟล์ที่ต้อง publish)
  logLevel: 'info',
  plugins: [stubGoogleapisPlugin, useArtifactSpritesPlugin],
};

if (watch) {
  const ctx = await (await import('esbuild')).context(options);
  await ctx.watch();
  console.log('[build:artifact] กำลัง watch การเปลี่ยนแปลง... (Ctrl+C เพื่อหยุด)');
} else {
  await build(options);
  console.log('[build:artifact] bundle เวอร์ชัน artifact (sprite ฝัง base64 ทั้งหมด) สำเร็จ -> client/artifact/dist/bundle.js');
}
