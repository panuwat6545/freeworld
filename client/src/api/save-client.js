// เรียก server (server/index.js) ให้บันทึก snapshot ขึ้น Google Drive แทน client — client ไม่มีสิทธิ์เข้าถึง
// credential ของ Google Drive เลย (ดู README หัวข้อ client/server ว่าทำไมต้องแยกแบบนี้)
// buildSnapshot มาจาก src/storage/snapshot.js ตรงๆ (ไฟล์นี้เป็นฟังก์ชันล้วนๆ ไม่มี Node-only API เลย จึง
// bundle เข้า client ได้ปลอดภัย ต่างจาก drive-client.js ที่มี googleapis/process.env ซึ่งต้องอยู่ฝั่ง server เท่านั้น)
import { buildSnapshot } from '../../../src/storage/snapshot.js';

export async function saveSnapshotToServer(simulation) {
  const snapshot = buildSnapshot(simulation.world, simulation.characters, simulation.gameYear);

  const response = await fetch('/api/save-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error ?? `บันทึกไม่สำเร็จ (HTTP ${response.status})`);
  }
  return result;
}
