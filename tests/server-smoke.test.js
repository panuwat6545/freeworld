import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

// smoke test ตามสเปกเฟส 11: "server เปิดได้ไม่ error" — ไม่ต้องครอบคลุมทุก edge case ของ endpoint
// (แค่ยืนยันว่า Express app สร้างได้จริง, ตอบ health check ได้, เสิร์ฟไฟล์ client แบบ static ได้, และ
// route /api/save-snapshot ปฏิเสธ payload ที่ผิดรูปแบบอย่างสุภาพแทนที่จะทำให้ process ล่ม)
test('server: createApp() สร้าง Express app ได้โดยไม่ throw', () => {
  const app = createApp();
  assert.ok(app);
  assert.equal(typeof app.listen, 'function');
});

test('server: เปิดพอร์ตจริงแล้วตอบ GET /api/health เป็น 200 โดยไม่ error', async () => {
  const app = createApp();
  const server = app.listen(0); // พอร์ต 0 = ให้ OS สุ่มพอร์ตว่างให้ กัน test ชนกับ process อื่น
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok' });
  } finally {
    server.close();
  }
});

test('server: เสิร์ฟ client/index.html แบบ static ได้ (200 และมีเนื้อหา HTML จริง)', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.ok(text.includes('<div id="app">'));
  } finally {
    server.close();
  }
});

test('server: POST /api/save-snapshot ปฏิเสธ payload ที่ไม่ตรงรูปแบบด้วย error สุภาพ ไม่ทำให้ server ล่ม', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/save-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.success, false);
    assert.ok(typeof body.error === 'string' && body.error.length > 0);
  } finally {
    server.close();
  }
});

test('server: response ของ /api/save-snapshot ไม่มี credential หลุดออกมาไม่ว่ากรณีใด', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/save-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    });
    const text = await response.text();
    assert.ok(!text.includes('client_secret'));
    assert.ok(!text.includes('refresh_token'));
    assert.ok(!text.includes('private_key'));
  } finally {
    server.close();
  }
});
