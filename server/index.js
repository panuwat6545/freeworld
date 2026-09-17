// เซิร์ฟเวอร์ Node/Express บางๆ ตามสเปกเฟส 11: หน้าที่เดียวคือ (1) เสิร์ฟไฟล์ client ที่ build ไว้แล้ว และ
// (2) เก็บ credential ของ Google Drive (GOOGLE_DRIVE_CREDENTIALS) ไว้ฝั่งนี้เท่านั้น เปิด endpoint
// POST /api/save-snapshot ให้ client เรียกตอนกดปุ่ม "บันทึกเกม" — ไม่มีจุดใดใน route หรือ response ที่ส่ง
// client_id/client_secret/refresh_token/credential ดิบกลับไปให้ browser เห็นเลยแม้แต่นิดเดียว (ดูโค้ด
// save-snapshot-endpoint.js: คืนแค่ { success, fileName, fileId } หรือข้อความ error ล้วนๆ)
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { saveClientSnapshot } from './save-snapshot-endpoint.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = join(__dirname, '..', 'client');
const DEFAULT_PORT = 8787;

export function createApp() {
  const app = express();

  // จำกัดขนาด body เพราะ snapshot มีรายชื่อตัวละคร/ทรัพยากรทั้งโลก อาจใหญ่กว่า default 100kb ของ express
  app.use(express.json({ limit: '5mb' }));

  // เสิร์ฟหน้าเกม (index.html + dist/bundle.js ที่ build มาจาก client/build.js) เป็น static ตรงๆ
  app.use(express.static(CLIENT_DIR));

  app.post('/api/save-snapshot', async (req, res) => {
    const result = await saveClientSnapshot(req.body);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(502).json(result);
    }
  });

  // health check เบาๆ ไว้ให้ smoke test/monitor เรียกเช็คว่า server ยังทำงานอยู่ ไม่แตะ Google Drive เลย
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}

// รันจริงเฉพาะตอนถูกเรียกเป็นสคริปต์หลัก (ไม่ใช่ตอนถูก import ไปทดสอบ) กัน smoke test เปิดพอร์ตซ้ำโดยไม่ตั้งใจ
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const app = createApp();
  app.listen(port, () => {
    console.log(`[server] Freeworld server เปิดที่ http://localhost:${port}`);
    if (!process.env.GOOGLE_DRIVE_CREDENTIALS) {
      console.warn(
        '[server] ยังไม่มี environment variable GOOGLE_DRIVE_CREDENTIALS — ปุ่ม "บันทึกเกม" จะกดไม่ได้ผลจนกว่าจะตั้งค่านี้',
      );
    }
  });
}
