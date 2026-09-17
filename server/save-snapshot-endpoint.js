// endpoint สำหรับบันทึก snapshot ที่ client ส่งมาขึ้น Google Drive จริง — ใช้ฟังก์ชันที่ export ไว้แล้วจาก
// src/storage/drive-client.js และ src/storage/snapshot.js ตรงๆ (ไม่แก้ไฟล์เดิมเลยสักบรรทัด) ต่างจาก
// src/storage/save-snapshot.js ตรงที่ save-snapshot.js รับ `world`/`characters` (instance จริงของเกม) แล้ว
// เรียก buildSnapshot() เอง แต่ในสถาปัตยกรรม client/server นี้ client เป็นฝ่ายมี world/characters ตัวจริง
// (รันซิมูเลชันสดในเบราว์เซอร์) จึง buildSnapshot() ได้เองอยู่แล้วก่อนส่งมา (ดู client/src/api/save-client.js)
// server แค่รับ snapshot object ที่ประกอบเสร็จแล้วมาอัปโหลดต่อเท่านั้น — คัดลอกเฉพาะ "ขั้นตอนอัปโหลด" มาจาก
// saveSnapshot() มาทำเองตรงนี้ (ไม่ได้เรียก saveSnapshot() ตรงๆ เพราะ signature ไม่ตรงกัน)
import { getDriveClient, ensureFolderPath } from '../src/storage/drive-client.js';
import { formatSnapshotFilename, SNAPSHOT_FOLDER_PATH } from '../src/storage/snapshot.js';

function describeError(error) {
  return error?.message ?? String(error);
}

function isValidSnapshot(body) {
  return (
    body &&
    typeof body === 'object' &&
    typeof body.timestamp === 'string' &&
    typeof body.gameYear === 'number' &&
    typeof body.characterCount === 'number' &&
    body.worldState &&
    typeof body.worldState === 'object'
  );
}

// รับ snapshot object (ที่ client ประกอบไว้แล้วด้วย buildSnapshot() ของ src/storage/snapshot.js) มาอัปโหลด
// ขึ้น Google Drive ที่ /freeworld-ecosystem/snapshots ตามมาตรฐานเดียวกับ docs/work-instruction.md ข้อ 6
// คืนค่า { success: true, fileName, fileId } เมื่อสำเร็จ หรือ { success: false, error } เมื่อล้มเหลว —
// ไม่ throw ออกไปให้ Express default error handler จับ (จะได้ควบคุม status code/รูปแบบ response เองได้)
export async function saveClientSnapshot(snapshot) {
  if (!isValidSnapshot(snapshot)) {
    return { success: false, error: 'snapshot ที่ส่งมาไม่ตรงรูปแบบที่กำหนด (ต้องมี timestamp/gameYear/characterCount/worldState อย่างน้อย)' };
  }

  try {
    const drive = getDriveClient();
    const fileName = formatSnapshotFilename(new Date());
    const folderId = await ensureFolderPath(drive, SNAPSHOT_FOLDER_PATH);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json',
      },
      media: {
        mimeType: 'application/json',
        body: JSON.stringify(snapshot, null, 2),
      },
      fields: 'id, name',
    });

    console.log(`[server] บันทึก snapshot สำเร็จ: ${fileName} (fileId=${response.data.id})`);
    return { success: true, fileName, fileId: response.data.id };
  } catch (error) {
    console.error(`[server] บันทึก snapshot ล้มเหลว: ${describeError(error)}`);
    return { success: false, error: describeError(error) };
  }
}
