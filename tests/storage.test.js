import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { ResourceNode } from '../src/world/resource-node.js';
import { RESOURCE_TYPES } from '../src/world/resource-types.js';
import { Character } from '../src/characters/character.js';
import { Structure } from '../src/building/structure.js';
import { buildSnapshot, formatSnapshotFilename, SNAPSHOT_FOLDER_PATH } from '../src/storage/snapshot.js';
import { saveSnapshot } from '../src/storage/save-snapshot.js';
import { ensureFolderPath, resetDriveClientCache, getDriveClient } from '../src/storage/drive-client.js';
import { SnapshotScheduler } from '../src/storage/snapshot-scheduler.js';

test('formatSnapshotFilename ตั้งชื่อไฟล์ตามรูปแบบ snapshot_YYYY-MM-DD_HHmm.json', () => {
  const date = new Date(Date.UTC(2026, 8, 15, 14, 5)); // เดือน 8 = กันยายน (0-indexed)
  assert.equal(formatSnapshotFilename(date), 'snapshot_2026-09-15_1405.json');
});

test('formatSnapshotFilename เติม 0 นำหน้าตัวเลขที่มีหลักเดียวให้ถูกต้อง', () => {
  const date = new Date(Date.UTC(2026, 0, 5, 3, 7));
  assert.equal(formatSnapshotFilename(date), 'snapshot_2026-01-05_0307.json');
});

test('buildSnapshot ประกอบ object ครบตามสเปก (timestamp, gameYear, worldState, characterCount)', () => {
  const world = new World({ width: 5, height: 5, seed: 1, density: 0 });
  world.grid.getCell(0, 0).resourceNode = new ResourceNode(RESOURCE_TYPES.WOOD, {
    amount: 50,
    maxAmount: 100,
    regenRate: 1,
  });
  world.structures.push(new Structure({ type: 'shelter', x: 1, y: 1, builtByCharacterId: 99, builtAtTick: 3 }));
  const character = new Character({ x: 2, y: 2, needs: { hunger: 88.456, energy: 70.1, shelter: 60, social: 40 } });

  const snapshot = buildSnapshot(world, [character], 3);

  assert.equal(snapshot.gameYear, 3);
  assert.equal(snapshot.characterCount, 1);
  assert.equal(typeof snapshot.timestamp, 'string');
  assert.ok(!Number.isNaN(Date.parse(snapshot.timestamp)), 'timestamp ต้อง parse เป็นวันที่ได้');

  assert.equal(snapshot.worldState.width, 5);
  assert.equal(snapshot.worldState.height, 5);
  assert.equal(snapshot.worldState.structures.length, 1);
  assert.equal(snapshot.worldState.structures[0].type, 'shelter');
  assert.equal(snapshot.worldState.resourceNodes.length, 1);
  assert.equal(snapshot.worldState.resourceNodes[0].type, RESOURCE_TYPES.WOOD);
  assert.equal(snapshot.worldState.resourceNodes[0].amount, 50);

  assert.equal(snapshot.characters.length, 1);
  assert.equal(snapshot.characters[0].id, character.id);
  assert.equal(snapshot.characters[0].needs.hunger, 88.5); // ปัดเป็นทศนิยม 1 ตำแหน่ง สรุปสั้นๆ พอ
});

test('saveSnapshot อัปโหลดผ่าน mock Drive client (ไม่ยิง API จริง) และตั้งชื่อไฟล์ถูกต้อง', async () => {
  const world = new World({ width: 3, height: 3, seed: 1, density: 0 });
  const createCalls = [];
  const fakeDrive = {
    files: {
      create: async ({ requestBody, media }) => {
        createCalls.push({ requestBody, media });
        return { data: { id: 'fake-file-id', name: requestBody.name } };
      },
    },
  };
  const fakeResolveFolderId = async (drive, segments) => {
    assert.equal(drive, fakeDrive);
    assert.deepEqual(segments, SNAPSHOT_FOLDER_PATH);
    return 'fake-folder-id';
  };

  const result = await saveSnapshot(world, [], 1, {
    driveClient: fakeDrive,
    resolveFolderId: fakeResolveFolderId,
    now: () => new Date(Date.UTC(2026, 0, 2, 3, 4)),
  });

  assert.equal(result.success, true);
  assert.equal(result.fileName, 'snapshot_2026-01-02_0304.json');
  assert.equal(result.fileId, 'fake-file-id');
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].requestBody.name, 'snapshot_2026-01-02_0304.json');
  assert.equal(createCalls[0].requestBody.parents[0], 'fake-folder-id');

  const uploaded = JSON.parse(createCalls[0].media.body);
  assert.equal(uploaded.gameYear, 1);
});

test('saveSnapshot จัดการ error โดยไม่ throw เมื่อ Drive API ล้มเหลว', async () => {
  const world = new World({ width: 3, height: 3, seed: 1, density: 0 });
  const failingDrive = {
    files: {
      create: async () => {
        throw new Error('invalid_grant: บัญชีไม่ได้รับอนุญาต');
      },
    },
  };

  const result = await saveSnapshot(world, [], 1, {
    driveClient: failingDrive,
    resolveFolderId: async () => 'folder-id',
  });

  assert.equal(result.success, false);
  assert.match(result.error, /invalid_grant/);
});

test('saveSnapshot จัดการ error เมื่อไม่มี credential โดยไม่ throw จนโปรแกรมพัง', async () => {
  const originalEnv = process.env.GOOGLE_DRIVE_CREDENTIALS;
  delete process.env.GOOGLE_DRIVE_CREDENTIALS;
  resetDriveClientCache();

  try {
    const world = new World({ width: 3, height: 3, seed: 1, density: 0 });
    const result = await saveSnapshot(world, [], 1, {});
    assert.equal(result.success, false);
    assert.match(result.error, /GOOGLE_DRIVE_CREDENTIALS/);
  } finally {
    if (originalEnv !== undefined) process.env.GOOGLE_DRIVE_CREDENTIALS = originalEnv;
    resetDriveClientCache();
  }
});

// ตั้ง GOOGLE_DRIVE_CREDENTIALS ชั่วคราวให้ fn ใช้ แล้วคืนค่าเดิมกลับให้เสมอ (แม้ fn จะ throw/reject)
// เป็น async เสมอและ await fn() ก่อนคืนค่า env เดิม เพื่อไม่ให้ env ถูกคืนก่อน fn ทำงานเสร็จจริง
async function withEnvCredential(credentialObjectOrRaw, fn) {
  const originalEnv = process.env.GOOGLE_DRIVE_CREDENTIALS;
  process.env.GOOGLE_DRIVE_CREDENTIALS =
    typeof credentialObjectOrRaw === 'string' ? credentialObjectOrRaw : JSON.stringify(credentialObjectOrRaw);
  resetDriveClientCache();
  try {
    return await fn();
  } finally {
    if (originalEnv !== undefined) process.env.GOOGLE_DRIVE_CREDENTIALS = originalEnv;
    else delete process.env.GOOGLE_DRIVE_CREDENTIALS;
    resetDriveClientCache();
  }
}

test('getDriveClient สร้าง client ได้เมื่อ credential เป็น service_account', async () => {
  await withEnvCredential(
    {
      type: 'service_account',
      project_id: 'p',
      private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
      client_email: 'bot@p.iam.gserviceaccount.com',
    },
    () => {
      const drive = getDriveClient();
      assert.ok(drive.files, 'ควรได้ Drive client ที่มี files API');
    },
  );
});

test('getDriveClient สร้าง client ได้เมื่อ credential เป็น authorized_user (OAuth2 + refresh_token)', async () => {
  await withEnvCredential(
    {
      type: 'authorized_user',
      client_id: 'fake-client-id',
      client_secret: 'fake-client-secret',
      refresh_token: 'fake-refresh-token',
    },
    () => {
      const drive = getDriveClient();
      assert.ok(drive.files, 'ควรได้ Drive client ที่มี files API');
    },
  );
});

test('getDriveClient โยน error ที่เข้าใจง่ายเมื่อ authorized_user ขาด field ที่จำเป็น', async () => {
  await withEnvCredential({ type: 'authorized_user', client_id: 'only-this-field' }, () => {
    assert.throws(() => getDriveClient(), /authorized_user.*client_id.*client_secret.*refresh_token/s);
  });
});

test('getDriveClient โยน error ที่เข้าใจง่ายเมื่อ field "type" ไม่รู้จัก', async () => {
  await withEnvCredential({ type: 'something_unexpected' }, () => {
    assert.throws(() => getDriveClient(), /ไม่รู้จัก/);
  });
});

test('saveSnapshot จัดการ error โดยไม่ throw เมื่อ credential เป็น authorized_user แต่ข้อมูลไม่ครบ', async () => {
  await withEnvCredential({ type: 'authorized_user', client_id: 'x' }, async () => {
    const world = new World({ width: 3, height: 3, seed: 1, density: 0 });
    const result = await saveSnapshot(world, [], 1, {});
    assert.equal(result.success, false);
    assert.match(result.error, /authorized_user/);
  });
});

test('ensureFolderPath สร้างโฟลเดอร์ตามลำดับ path เมื่อยังไม่มีอยู่จริง', async () => {
  const createCalls = [];
  let nextId = 1;
  const fakeDrive = {
    files: {
      list: async () => ({ data: { files: [] } }), // ยังไม่มีโฟลเดอร์นี้ ต้องสร้างใหม่ทุกระดับ
      create: async ({ requestBody }) => {
        createCalls.push(requestBody);
        return { data: { id: `folder-${nextId++}` } };
      },
    },
  };

  const folderId = await ensureFolderPath(fakeDrive, ['freeworld-ecosystem', 'snapshots']);

  assert.equal(createCalls.length, 2);
  assert.equal(createCalls[0].name, 'freeworld-ecosystem');
  assert.equal(createCalls[0].parents, undefined);
  assert.equal(createCalls[1].name, 'snapshots');
  assert.equal(createCalls[1].parents[0], 'folder-1');
  assert.equal(folderId, 'folder-2');
});

test('ensureFolderPath ใช้โฟลเดอร์เดิมที่มีอยู่แล้วแทนการสร้างซ้ำ', async () => {
  const fakeDrive = {
    files: {
      list: async () => ({ data: { files: [{ id: 'existing-folder-id', name: 'freeworld-ecosystem' }] } }),
      create: async () => {
        throw new Error('ไม่ควรเรียก create เพราะมีโฟลเดอร์อยู่แล้ว');
      },
    },
  };

  const folderId = await ensureFolderPath(fakeDrive, ['freeworld-ecosystem']);
  assert.equal(folderId, 'existing-folder-id');
});

test('SnapshotScheduler เรียก saveSnapshot อัตโนมัติทุกครั้งที่เวลาในเกมผ่านไปครบ 1 ปี', async () => {
  const world = new World({ width: 3, height: 3, seed: 1, density: 0 });
  const calls = [];
  const fakeSave = async (w, characters, gameYear) => {
    calls.push({ tick: w.tick, gameYear });
    return { success: true };
  };
  const scheduler = new SnapshotScheduler({ ticksPerYear: 10, saveSnapshotFn: fakeSave });

  for (let i = 0; i < 25; i++) {
    world.update(1);
    await scheduler.checkAndSave(world, []);
  }

  assert.deepEqual(
    calls.map((c) => c.gameYear),
    [1, 2],
  );
  assert.equal(calls[0].tick, 10);
  assert.equal(calls[1].tick, 20);
});
