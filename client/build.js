// สคริปต์ bundle ฝั่ง client ด้วย esbuild (เลือก esbuild แทน vite เพราะงานนี้มีแค่ entry point เดียว ไม่มี
// JSX/framework ต้องคอมไพล์ ใช้ esbuild ตรงๆ เร็วและพึ่งพา dependency น้อยกว่า) รวม client/src/main.js (ซึ่ง
// import โมดูลจาก src/* ของเกมโดยตรงตามสถาปัตยกรรมที่กำหนด) เป็นไฟล์เดียว client/dist/bundle.js
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

// adapter คั่น Node-only API ตามที่สั่ง: client ไม่เคยเรียกใช้ src/storage/save-snapshot.js หรือ
// drive-client.js จริงๆ เลย (client ยิง POST /api/save-snapshot ไปให้ server ทำแทน — ดู
// client/src/api/save-client.js) แต่ import chain บางเส้นก็ยังไหลผ่านมันโดยไม่ตั้งใจ: economy/inflation.js
// และอีกหลายไฟล์ import แค่ค่าคงที่ DEFAULT_TICKS_PER_YEAR จาก storage/snapshot-scheduler.js ซึ่งที่หัวไฟล์
// นั้นมี `import { saveSnapshot } from './save-snapshot.js'` อยู่ (แม้ไม่ได้ใช้ค่านี้เลยในกรณีของเรา) แล้ว
// save-snapshot.js/drive-client.js ก็ import 'googleapis' (แพ็กเกจ Node-only ล้วนๆ ใช้ fs/net/crypto ฯลฯ)
// ต่ออีกที — เป็นไปตามที่คาดไว้ว่า "โมดูลไหนติด Node-only API ให้แยก adapter คั่น" จึงเพิ่ม esbuild plugin
// นี้ ห้าม 'googleapis' จริงๆ ไม่ให้ถูก resolve/bundle เข้า client เลย (แทนที่ด้วยโมดูลเปล่าๆ) โค้ดที่ใช้
// จริงจาก path นี้ (DEFAULT_TICKS_PER_YEAR) ไม่แตะ 'googleapis' อยู่แล้วจึงไม่กระทบพฤติกรรมอะไรเลย — ไม่ได้
// แก้ src/storage/*.js เองแม้แต่บรรทัดเดียว
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

const options = {
  entryPoints: [join(__dirname, 'src', 'main.js')],
  outfile: join(__dirname, 'dist', 'bundle.js'),
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  logLevel: 'info',
  plugins: [stubGoogleapisPlugin],
};

if (watch) {
  const ctx = await (await import('esbuild')).context(options);
  await ctx.watch();
  console.log('[build:client] กำลัง watch การเปลี่ยนแปลง... (Ctrl+C เพื่อหยุด)');
} else {
  await build(options);
  console.log('[build:client] bundle client สำเร็จ -> client/dist/bundle.js');
}
