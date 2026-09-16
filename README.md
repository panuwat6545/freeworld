# Freeworld

เกมจำลองระบบนิเวศ พัฒนาเป็นเฟสตาม `docs/work-instruction.md`

## เฟส 1 — โลกและทรัพยากร (เสร็จแล้ว)

สร้างแผนที่โลกแบบ grid ขนาด 40x40 ช่อง โดยแต่ละช่องอาจมีจุดทรัพยากรธรรมชาติหนึ่งชนิด
(ไม้ / น้ำ / แร่ / อาหาร) ซึ่งจะค่อยๆ งอกกลับมาใหม่ตามเวลา (tick) จนกว่าจะเต็มปริมาณสูงสุดของจุดนั้น
ยังไม่มีตัวละครหรือ AI ในเฟสนี้

โครงสร้างไฟล์ที่เกี่ยวข้อง:

```
src/world/
  resource-types.js    -> ชนิดทรัพยากรและค่าตั้งต้น (ปริมาณสูงสุด, อัตราการงอก)
  resource-node.js      -> จุดทรัพยากร 1 จุด: เก็บเกี่ยว (harvest) และงอกใหม่ (update)
  random.js              -> PRNG แบบ seed ได้ ใช้สร้างโลกซ้ำแบบเดิมได้เพื่อ debug/test
  grid.js                 -> ตาราง 40x40 ของช่องแผนที่
  world-generator.js      -> สุ่มวางจุดทรัพยากรลงบน grid
  world.js                -> รวมทุกอย่างเข้าด้วยกัน มี update(deltaTicks) ให้เวลาผ่านไป
  demo.js                  -> สคริปต์สาธิตรันจริง แสดงผลการเก็บเกี่ยว/งอกใหม่ทาง console
```

### วิธีทดสอบ

```bash
npm install        # ไม่มี dependency ภายนอก แต่รันไว้เผื่อ setup ในอนาคต
npm run demo:world # รันสาธิตเฟส 1 ทาง console
npm test           # รัน unit test (ใช้ node:test ที่มากับ Node.js)
```

`npm test` ตรวจสอบว่า:
- โลกถูกสร้างเป็น grid ขนาด 40x40 จริง
- การสร้างโลกด้วย seed เดียวกันได้ผลลัพธ์ซ้ำเดิม (deterministic)
- ทรัพยากรงอกใหม่ตามอัตราที่กำหนดและไม่เกินค่าสูงสุด
- การเก็บเกี่ยว (harvest) ไม่ได้มากกว่าที่มีอยู่จริง
- `World.update` ทำให้ทรัพยากรที่ถูกเก็บจนหมดค่อยๆ งอกกลับมา

## เฟส 2 — ตัวละครและระบบความคิด (Utility AI) (เสร็จแล้ว)

ตัวละครแต่ละตัวมีตำแหน่งบน grid และค่าความต้องการ (needs) 4 อย่าง: หิว (hunger), พลังงาน (energy),
ที่อยู่ (shelter), สังคม (social) อยู่ในช่วง 0-100 ทุก tick ค่าเหล่านี้จะลดลงเองตามอัตรา decay ที่ตั้งไว้
(หิวลดเร็วที่สุด สังคมลดช้าที่สุด) แล้วระบบ Utility AI จะคำนวณว่า need ไหน "เร่งด่วนที่สุด" (ค่าต่ำสุด)
และให้ตัวละครเลือกทำพฤติกรรมที่ตอบสนอง need นั้นโดยอัตโนมัติ — เป็นสูตรคำนวณล้วนๆ ไม่มีการเรียก LLM
หรือ API ภายนอกต่อตัวละครแต่อย่างใด

พฤติกรรมทั้ง 4 แบบ:
- **หิวต่ำ** -> เดินเข้าหาจุดทรัพยากร "อาหาร" ที่ใกล้ที่สุด แล้วเก็บกินเมื่อถึง
- **พลังงานต่ำ** -> หยุดพัก ฟื้นพลังงานบางส่วนต่อ tick (เฟส 3 เพิ่มโบนัสเมื่อพักใกล้ที่พักที่สร้างไว้แล้ว)
- **ที่อยู่ต่ำ** -> เดินเข้าหาจุดทรัพยากร "ไม้" แล้วสะสมไว้ใน inventory (เฟส 3 นำไม้ที่สะสมนี้ไปสร้างที่พักจริง)
- **สังคมต่ำ** -> เดินเข้าหาตัวละครอื่นที่ใกล้ที่สุด แล้วฟื้นค่า social เมื่ออยู่ติดกัน

การเดินใช้วิธี greedy ทีละช่อง (8 ทิศ) เข้าหาเป้าหมายตรงๆ ยังไม่มี pathfinding หลบสิ่งกีดขวาง

โครงสร้างไฟล์ที่เกี่ยวข้อง:

```
src/characters/
  needs-config.js    -> อัตราการ decay และค่าคงที่ของแต่ละพฤติกรรม (ฟื้นพลังงาน, ปริมาณเก็บเกี่ยว ฯลฯ)
  character.js         -> Character entity: position, needs, inventory, decayNeeds()
  movement.js            -> stepToward (เดินทีละช่องแบบ greedy), ระยะห่างแบบ Chebyshev
  target-finder.js        -> หาจุดทรัพยากร/ตัวละครอื่นที่ใกล้ที่สุดบน grid
  behaviors.js              -> พฤติกรรมทั้ง 4 แบบ (seekFood, rest, gatherWood, socialize)
  utility-ai.js              -> หา need ที่เร่งด่วนที่สุดและสั่งให้ตัวละครทำพฤติกรรมที่ตรงกัน
  demo.js                     -> สคริปต์สาธิตตัวละคร 5 ตัว แสดง needs/behavior เปลี่ยนตามเวลา
```

### วิธีทดสอบ

```bash
npm run demo:characters # รันสาธิตเฟส 2 ทาง console ดู needs และพฤติกรรมของตัวละคร 5 ตัวตามเวลา
npm test                 # รวม unit test ของเฟส 1 และเฟส 2 (ใช้ node:test)
```

`npm test` ของเฟส 2 ตรวจสอบว่า:
- needs ลดลงตามอัตรา decay ที่ตั้งไว้ และไม่ต่ำกว่า 0
- ระบบ Utility AI เลือก need ที่เร่งด่วนที่สุด (ค่าต่ำสุด) ได้ถูกต้อง รวมถึงกรณีค่าเท่ากันที่ต้องตัดสิน
  ด้วยลำดับความสำคัญ
- การแม็ป need -> พฤติกรรมถูกต้องครบทั้ง 4 แบบ
- การเดิน (`stepToward`) ขยับเข้าหาเป้าหมายถูกทิศทางทุกกรณี (แนวตรง/แนวทแยง/ถึงเป้าหมายแล้ว)
- พฤติกรรมแต่ละแบบทำงานจริงแบบ end-to-end: เดินเข้าหาเป้าหมายแล้วเก็บเกี่ยว/พัก/เข้าสังคมเมื่อถึง

## เฟส 3 — ระบบสร้างสิ่งของ (Building/Crafting) (เสร็จแล้ว)

เพิ่มสูตรสิ่งก่อสร้าง (blueprint) อย่างน้อย 1 แบบ คือ "ที่พัก" (shelter) ซึ่งต้องใช้ไม้ 10 หน่วย
พฤติกรรม "เก็บไม้" จากเฟส 2 ยังทำงานเหมือนเดิม (สะสมไม้เข้า `inventory.wood`) แต่ตอนนี้ Utility AI
จะตรวจก่อนทุก tick ว่า need ที่เร่งด่วนที่สุดคือ shelter และ inventory มีไม้ครบสูตรหรือยัง — ถ้าครบแล้ว
จะเลือกพฤติกรรมใหม่ "สร้างที่พัก" แทนการเดินไปเก็บไม้เพิ่ม โดยวางสิ่งก่อสร้างลงบน grid ที่ตำแหน่งปัจจุบัน
ของตัวละครทันที แล้วหักไม้ออกจาก inventory ตามสูตร

นอกจากนี้พฤติกรรม "พัก" (energy ต่ำ) จากเฟส 2 ก็ถูกอัปเกรด: ถ้าตัวละครอยู่ใกล้ (ระยะ Chebyshev ≤ 3)
ที่พักที่เคยสร้างไว้ (ของตัวเองหรือตัวละครอื่นก็ได้) จะฟื้นพลังงานเร็วขึ้นกว่าพักเฉยๆ ตามค่าที่ตั้งไว้ใน blueprint

โครงสร้างไฟล์ที่เกี่ยวข้อง:

```
src/building/
  blueprints.js         -> สูตรสิ่งก่อสร้าง (ตอนนี้มี "shelter": ใช้ไม้ 10, โบนัสฟื้นพลังงาน + ระยะใกล้)
  structure.js            -> Structure entity: ชนิด, ตำแหน่ง, ใครสร้าง, สร้างที่ tick ไหน
  crafting.js               -> hasEnoughResources / canBuild / build (หักทรัพยากร + วางสิ่งก่อสร้างลงโลก)
  structure-finder.js        -> หาสิ่งก่อสร้างชนิดที่กำหนดที่ใกล้ตำแหน่งที่สุด / ตรวจว่าอยู่ในระยะใกล้หรือไม่
  demo.js                      -> สคริปต์สาธิตตัวละครเก็บไม้จนครบแล้วสร้างที่พักสำเร็จ
```

ไฟล์ที่แก้ไขเพิ่มจากเฟส 2 (อยู่ในขอบเขตของงาน เพราะต้องเชื่อม building เข้ากับ utility-ai และ world):
- `src/characters/behaviors.js` — เพิ่มพฤติกรรม `build_shelter`, ปรับ `rest` ให้เช็คที่พักใกล้เคียง
- `src/characters/utility-ai.js` — เช็คว่าครบสูตร blueprint หรือยังก่อนเลือกระหว่างเก็บไม้กับสร้างที่พัก
- `src/world/world.js` — เพิ่ม `world.structures` เก็บสิ่งก่อสร้างทั้งหมดที่ถูกสร้างในโลก

### วิธีทดสอบ

```bash
npm run demo:building # รันสาธิตเฟส 3 ทาง console: ตัวละครเก็บไม้จนครบ 10 แล้วสร้างที่พักสำเร็จ
npm test                # รวม unit test ของเฟส 1-3 (ใช้ node:test)
```

`npm test` ของเฟส 3 ตรวจสอบว่า:
- `hasEnoughResources` / `canBuild` ตรวจสูตร blueprint ถูกต้องตามจำนวนที่มีจริงใน inventory
- `build` หักทรัพยากรออกจาก inventory และวางสิ่งก่อสร้างลงบนโลกที่ตำแหน่งตัวละครได้ถูกต้อง
  รวมถึงคืนค่า `null` และไม่หักอะไรเมื่อทรัพยากรไม่พอ
- `findNearestStructure` / `isNearStructureType` หาสิ่งก่อสร้างที่ใกล้ที่สุดและตรวจระยะได้ถูกต้อง
- ผ่าน `utility-ai` ตัวละครเลือกพฤติกรรม `build_shelter` เองอัตโนมัติทันทีที่เก็บไม้ครบสูตร
- พฤติกรรม "พัก" ฟื้นพลังงานเร็วขึ้นจริงเมื่ออยู่ใกล้ที่พัก เทียบกับพักเฉยๆ ที่ไม่มีที่พักอยู่ใกล้

## เฟส 5 — บันทึกข้อมูลลง Google Drive (เสร็จแล้ว)

> ข้ามเฟส 4 (ระบบสังคม/ขยายเผ่าพันธุ์) เพราะเฟส 4 ถูกระบุไว้ว่า "ถ้าต้องการ" (optional) และยังไม่มีคำสั่งให้ทำ
> จึงพัฒนาต่อจากเฟส 3 ไปเฟส 5 ตามคำสั่งของผู้ดูแลโปรเจกต์โดยตรง

เพิ่มระบบบันทึกสถานะโลก ("snapshot") เป็นไฟล์ JSON ขึ้น Google Drive โดยอ่าน credential จาก
environment variable `GOOGLE_DRIVE_CREDENTIALS` (JSON string) เท่านั้น ไม่มีการ hardcode หรือเขียนคีย์
ลงไฟล์ใดๆ ในโค้ดหรือ commit

รองรับ credential ได้ 2 รูปแบบ โดยเลือก auth ให้ถูกอัตโนมัติจาก field `"type"` ในตัว credential เอง:
- **`service_account`** — คีย์ของ service account (ของเดิม เหมาะกับ Google Workspace ที่ใช้ Shared Drive ได้)
- **`authorized_user`** — OAuth2 client_id/client_secret/refresh_token (สำหรับบัญชี Gmail ส่วนตัวที่ไม่มี
  Shared Drive ให้ใช้ — เป็นค่าปัจจุบันของโปรเจกต์นี้)

ถ้า field `type` เป็นค่าอื่นที่ไม่รู้จัก หรือ credential ขาด field ที่จำเป็นของแต่ละรูปแบบ ระบบจะโยน error
ข้อความชัดเจนบอกว่าขาดอะไร (ถูก `saveSnapshot` ครอบ try/catch ไว้อีกชั้นเพื่อไม่ให้เกมล่ม)

Snapshot object ประกอบด้วย field ตามสเปกในข้อ 6 ของ `docs/work-instruction.md` เป็นอย่างน้อย:
`timestamp`, `gameYear`, `worldState` (tick, ขนาด grid, ทรัพยากรทุกจุดบน grid, สิ่งก่อสร้างทั้งหมด)
และ `characterCount` — ส่วนข้อมูลตัวละครสรุปแบบสั้นๆ พอ (id, ตำแหน่ง, needs ปัดทศนิยม, inventory,
พฤติกรรมปัจจุบัน) ไม่เอา field ภายในทุกตัว เพื่อไม่ให้ไฟล์ใหญ่เกินจำเป็น

ไฟล์จะถูกอัปโหลดเข้าโฟลเดอร์ `/freeworld-ecosystem/snapshots` บน Drive ชื่อไฟล์รูปแบบ
`snapshot_YYYY-MM-DD_HHmm.json` (เวลาแบบ UTC) ถ้าโฟลเดอร์ตามลำดับยังไม่มีอยู่จริงจะสร้างให้อัตโนมัติ
การบันทึกจะถูกเรียกอัตโนมัติทุกครั้งที่เวลาในเกมผ่านไปครบ 1 ปี โดยผูกกับ `world.tick` ที่มีอยู่แล้ว
(ไม่ต้องแก้ `World` class) ผ่าน `SnapshotScheduler`

ทุกจุดที่คุยกับ Google Drive API ถูกครอบด้วย try/catch: ถ้า credential ผิด รูปแบบไม่ถูกต้อง หรือ
Drive API error (เช่น permission ไม่พอ) จะ log ข้อความที่เข้าใจง่ายแล้วคืนค่า `{ success: false, error }`
**ไม่ throw ออกไป** เพื่อไม่ให้เกมทั้งตัวล่ม

โครงสร้างไฟล์ที่เกี่ยวข้อง:

```
src/storage/
  drive-client.js       -> อ่าน credential จาก env, เลือก auth (service_account / authorized_user)
                             ตาม field "type" อัตโนมัติ, สร้าง Google Drive client,
                             ensureFolderPath หา/สร้างโฟลเดอร์ตามลำดับ path อัตโนมัติ
  snapshot.js             -> buildSnapshot ประกอบ object ตามสเปก, formatSnapshotFilename ตั้งชื่อไฟล์
  save-snapshot.js          -> saveSnapshot: ประกอบ snapshot + อัปโหลดขึ้น Drive พร้อม error handling
                                 (รับ deps แบบ inject ได้เพื่อ mock ตอน test)
  snapshot-scheduler.js       -> SnapshotScheduler: เรียก saveSnapshot อัตโนมัติทุกครั้งที่ครบ 1 ปีเกม
  demo.js                       -> สคริปต์สาธิตจำลอง 3 ปี ใช้ credential จริงจาก env ยืนยันการเชื่อมต่อ Drive
```

### วิธีทดสอบ

```bash
npm run demo:storage # รันจำลอง 3 ปีในเกม (ย่อเหลือปีละ 20 tick เพื่อให้ demo จบไว) ใช้ credential จริง
                      # จาก GOOGLE_DRIVE_CREDENTIALS แสดง log ว่าบันทึกไฟล์ชื่ออะไรสำเร็จ/ไม่สำเร็จ
npm test              # รวม unit test ของเฟส 1, 2, 3, 5 (ใช้ node:test, mock Google Drive API ทั้งหมด
                      # ไม่ยิง API จริงตอนรัน test)
```

`npm test` ของเฟส 5 ตรวจสอบว่า:
- `formatSnapshotFilename` ตั้งชื่อไฟล์ตรงตามรูปแบบ `snapshot_YYYY-MM-DD_HHmm.json` ครบทุกกรณี (รวมเติม 0 นำหน้า)
- `buildSnapshot` ประกอบ object ครบตามสเปก มี `timestamp` / `gameYear` / `worldState` / `characterCount`
  และสรุปข้อมูลตัวละครแบบย่อถูกต้อง
- `saveSnapshot` อัปโหลดผ่าน mock Drive client ได้ถูกต้อง (ตั้งชื่อไฟล์ถูก, เนื้อหาไฟล์ตรงกับ snapshot ที่ประกอบไว้)
  โดยไม่ยิง API จริง
- `saveSnapshot` จัดการ error โดยไม่ throw ทั้งกรณี Drive API ล้มเหลว และกรณีไม่มี/credential ผิดรูปแบบ
- `getDriveClient` สร้าง client ได้ถูกต้องทั้ง 2 รูปแบบ credential (`service_account` และ `authorized_user`)
  และโยน error ข้อความชัดเจนเมื่อ `authorized_user` ขาด field ที่จำเป็น หรือ `type` เป็นค่าที่ไม่รู้จัก
- `ensureFolderPath` หาโฟลเดอร์เดิมถ้ามีอยู่แล้ว หรือสร้างใหม่ตามลำดับ path ถ้ายังไม่มี
- `SnapshotScheduler` เรียก `saveSnapshot` อัตโนมัติทุกครั้งที่ `world.tick` ผ่านไปครบ 1 ปีเกมพอดี

### หมายเหตุสำคัญจากการทดสอบเชื่อมต่อจริง

**อัปเดต:** โปรเจกต์นี้เปลี่ยนมาใช้บัญชี Gmail ส่วนตัว (credential รูปแบบ `authorized_user`) แทน service
account เดิม เพราะบัญชี Gmail ส่วนตัวใช้ Shared Drive ไม่ได้ โค้ดฝั่งนี้อัปเดตให้รองรับทั้งสองรูปแบบแล้ว
(เลือก auth อัตโนมัติจาก field `type`) และเอา `supportsAllDrives` ออกจาก upload call เพราะไม่จำเป็นอีกต่อไป

**ยืนยันแล้ว (session ใหม่):** เปิด session ใหม่แล้วรัน `npm run demo:storage` อีกครั้ง คราวนี้ environment
variable `GOOGLE_DRIVE_CREDENTIALS` ที่ session อ่านได้เป็น credential แบบ `authorized_user` จริง (มี
`client_id` / `client_secret` / `refresh_token` ครบ) — `getDriveClient` เลือกใช้ `google.auth.OAuth2` ตามที่
ออกแบบไว้ได้ถูกต้อง ไม่มีการล่มหรือ error เรื่อง credential ผิดรูปแบบเหมือนครั้งก่อนอีกต่อไป ยืนยันได้ว่า
**การรองรับ credential แบบ `authorized_user` ในโค้ดทำงานถูกต้อง**

อย่างไรก็ตาม การอัปโหลด snapshot จริงยัง **ไม่สำเร็จ** ในการทดสอบครั้งนี้ ด้วย error ใหม่ (ต่างจากครั้งก่อน):

```
Google Drive API has not been used in project 1070078689033 before or it is disabled.
```

เลข `1070078689033` คือหมายเลขโปรเจกต์ GCP ของ OAuth client เอง (ตรงกับ prefix ของ `client_id` ที่ใช้) —
สาเหตุคือ **ยังไม่ได้เปิดใช้งาน Google Drive API ในโปรเจกต์ GCP นี้** ไม่ใช่บั๊กของโค้ด เพราะ:
- error เปลี่ยนไปอีกขั้นจากครั้งก่อน (จาก "โปรเจกต์ของ service account เดิมถูกลบ" มาเป็น "API ยังไม่ถูกเปิดใช้
  ในโปรเจกต์ของ OAuth client ใหม่") แสดงว่า auth ผ่านขั้นตอนเดิมไปได้แล้ว และไปสะดุดที่ขั้นถัดไปซึ่งเป็นเรื่อง
  การตั้งค่าฝั่ง Google Cloud Console
- `saveSnapshot` จับ error และคืนค่า `{ success: false, error }` ตามสเปกได้ถูกต้อง สคริปต์ demo รันจบครบ 3 ปี
  โดยไม่ล่ม (ตามที่ error handling ควรทำงาน)

**ต้องทำต่อ:** เข้า Google Cloud Console ของโปรเจกต์ `1070078689033` แล้วเปิดใช้งาน Drive API ที่
`https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=1070078689033`
รอสักครู่ให้การเปิดใช้งานมีผล จากนั้นรัน `npm run demo:storage` อีกครั้งเพื่อยืนยันว่าบันทึกไฟล์ขึ้น Drive
ส่วนตัวได้จริง

## เฟสถัดไป

ดูลำดับเฟสทั้งหมดและ Definition of Done ได้ที่ `docs/work-instruction.md`
