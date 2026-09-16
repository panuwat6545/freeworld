import { getDriveClient, ensureFolderPath } from './drive-client.js';
import { buildSnapshot, formatSnapshotFilename, SNAPSHOT_FOLDER_PATH } from './snapshot.js';

function describeError(error) {
  return error?.message ?? String(error);
}

// บันทึกสถานะโลก ณ ตอนนี้เป็นไฟล์ JSON ขึ้น Google Drive ที่ /freeworld-ecosystem/snapshots
// deps ใช้สำหรับ inject ของปลอม (mock) ตอน test เพื่อไม่ต้องยิง Drive API จริง
// - deps.driveClient: ถ้าไม่ให้มา จะสร้างจาก getDriveClient() (ใช้ credential จริงจาก env)
// - deps.resolveFolderId: ค่าเริ่มต้นคือ ensureFolderPath
// - deps.now: ค่าเริ่มต้นคือ () => new Date()
// คืนค่า { success: true, fileName, fileId, snapshot } เมื่อสำเร็จ
// หรือ { success: false, error } เมื่อล้มเหลว — ไม่ throw ออกไปเด็ดขาด เพื่อไม่ให้เกมทั้งตัวล่ม
export async function saveSnapshot(world, characters, gameYear, deps = {}) {
  const { driveClient, resolveFolderId = ensureFolderPath, now = () => new Date() } = deps;

  try {
    const drive = driveClient ?? getDriveClient();
    const snapshot = buildSnapshot(world, characters, gameYear);
    const fileName = formatSnapshotFilename(now());
    const folderId = await resolveFolderId(drive, SNAPSHOT_FOLDER_PATH);

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

    console.log(`[storage] บันทึก snapshot สำเร็จ: ${fileName} (fileId=${response.data.id})`);
    return { success: true, fileName, fileId: response.data.id, snapshot };
  } catch (error) {
    console.error(`[storage] บันทึก snapshot ล้มเหลว: ${describeError(error)}`);
    return { success: false, error: describeError(error) };
  }
}
