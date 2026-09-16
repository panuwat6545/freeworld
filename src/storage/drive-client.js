import { google } from 'googleapis';

const DRIVE_SCOPES = Object.freeze(['https://www.googleapis.com/auth/drive.file']);
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

let cachedDriveClient = null;

// อ่าน credential จาก environment variable เท่านั้น ห้าม hardcode หรือเขียนคีย์ลงไฟล์ใดๆ
// รองรับได้ทั้ง 2 รูปแบบ แยกกันด้วย field "type":
// - "service_account" -> คีย์ของ service account (ใช้กับ Google Workspace + Shared Drive)
// - "authorized_user"  -> OAuth2 refresh token (ใช้กับบัญชี Gmail ส่วนตัว ไม่มี Shared Drive)
function loadCredentials() {
  const raw = process.env.GOOGLE_DRIVE_CREDENTIALS;
  if (!raw) {
    throw new Error('ไม่พบ environment variable GOOGLE_DRIVE_CREDENTIALS (ต้องเป็น JSON string ของ credential)');
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`GOOGLE_DRIVE_CREDENTIALS ไม่ใช่ JSON ที่ถูกต้อง: ${error.message}`);
  }
}

// สร้าง auth client ให้ตรงกับชนิด credential ตาม field "type"
function createAuthClient(credentials) {
  const { type } = credentials;

  if (type === 'authorized_user') {
    if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
      throw new Error(
        'GOOGLE_DRIVE_CREDENTIALS ชนิด authorized_user ต้องมี client_id, client_secret และ refresh_token ครบ',
      );
    }
    const oauth2Client = new google.auth.OAuth2(credentials.client_id, credentials.client_secret);
    oauth2Client.setCredentials({ refresh_token: credentials.refresh_token });
    return oauth2Client;
  }

  if (type === 'service_account') {
    return new google.auth.GoogleAuth({ credentials, scopes: DRIVE_SCOPES });
  }

  throw new Error(
    `GOOGLE_DRIVE_CREDENTIALS มี field "type" ที่ไม่รู้จัก: "${type}" (รองรับเฉพาะ "service_account" หรือ "authorized_user")`,
  );
}

// สร้าง (หรือคืนค่า client เดิมที่แคชไว้) Google Drive API client โดยเลือกวิธี authenticate ให้ตรงกับ
// รูปแบบ credential ที่อ่านได้จาก environment variable โดยอัตโนมัติ
export function getDriveClient() {
  if (cachedDriveClient) return cachedDriveClient;

  const credentials = loadCredentials();
  const auth = createAuthClient(credentials);
  cachedDriveClient = google.drive({ version: 'v3', auth });
  return cachedDriveClient;
}

// เคลียร์แคช client — ใช้สำหรับ test ที่ต้องการบังคับให้อ่าน credential ใหม่ทุกครั้ง
export function resetDriveClientCache() {
  cachedDriveClient = null;
}

function escapeQueryValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function findFolder(drive, name, parentId) {
  const conditions = [
    `name = '${escapeQueryValue(name)}'`,
    `mimeType = '${FOLDER_MIME_TYPE}'`,
    'trashed = false',
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ];

  const response = await drive.files.list({
    q: conditions.join(' and '),
    fields: 'files(id, name)',
    spaces: 'drive',
    // Service account ไม่มี storage quota ของตัวเอง ต้องใช้งานผ่าน Shared Drive เสมอ
    // สองตัวเลือกนี้ทำให้ query มองเห็นไฟล์/โฟลเดอร์ใน Shared Drive ที่ service account เป็นสมาชิกด้วย
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
  });

  return response.data.files?.[0] ?? null;
}

async function createFolder(drive, name, parentId) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return response.data.id;
}

// หาหรือสร้างโฟลเดอร์ตามลำดับ path (เช่น ['freeworld-ecosystem', 'snapshots']) ถ้ายังไม่มีให้สร้างอัตโนมัติ
// คืนค่า id ของโฟลเดอร์สุดท้ายในลำดับ
export async function ensureFolderPath(drive, segments) {
  let parentId;
  for (const segment of segments) {
    const existing = await findFolder(drive, segment, parentId);
    parentId = existing ? existing.id : await createFolder(drive, segment, parentId);
  }
  return parentId;
}
