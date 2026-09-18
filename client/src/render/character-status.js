// Indicator เหนือหัวตัวละคร — วาดสดด้วย Canvas ทุกเฟรม อ่านค่าจริงจากตัวละคร/simulation เท่านั้น (ไม่มี
// state เก็บเอง ไม่แก้ src/ เดิม) ประกอบด้วย 2 วง: วงอาชีพ (ซ้าย, สีตามอาชีพจากเฟส 9) + วงสถานะ (ขวา, ไอคอน
// ตาม behavior ปัจจุบันจาก utility-ai หรือธุรกรรมล่าสุดจากเฟส 7) — ถ้า need ตัวใดวิกฤต วงสถานะจะถูกแทนที่
// ด้วยเครื่องหมาย "!" สีแดงทันที (สำคัญกว่าการโชว์ behavior ปกติเสมอ) ทุกเครื่องหมายวาดด้วยเส้น/รูปทรงพื้นฐาน
// (arc/line/rect) ไม่ใช้ font/ตัวอักษรเลย เพื่อความคมชัดสม่ำเสมอไม่ว่าจะซูมแค่ไหน
import { NEED_PRIORITY } from '../../../src/characters/needs-config.js';
import { BEHAVIORS } from '../../../src/characters/behaviors.js';
import { PROFESSIONS } from '../../../src/professions/profession.js';

// เกณฑ์ "need วิกฤต" เดียวกับ STUCK_THRESHOLD ที่ scripts/long-run.js ใช้ flag "AI มีปัญหา" (ค่าคงที่ 20
// นั้นไม่ได้ export ออกมาจากสคริปต์ตัวนั้น — scripts/long-run.js เป็นสคริปต์รันตรงๆ ไม่มี main-guard จะรัน
// จำลอง 30 ปี + เซฟขึ้น Google Drive ทันทีถ้า import เข้ามา จึงคัดลอกแค่ค่าตัวเลขมาใช้ตรงๆ แทนการ import)
export const CRITICAL_NEED_THRESHOLD = 20;

// ธุรกรรม (เฟส 7) ไม่ใช่ currentBehavior ต่อเนื่องแบบ 5 พฤติกรรมหลัก แต่เป็นเหตุการณ์ชั่ววูบต่อ tick —
// โชว์ไอคอนเหรียญค้างไว้สักพักหลังเทรดจริงเพื่อให้ผู้เล่นทันเห็น ไม่ใช่กระพริบแค่ 1 tick จนมองไม่ทัน
const TRADE_INDICATOR_WINDOW_TICKS = 20;

const MARK_STROKE = 'rgba(20, 14, 10, 0.85)'; // สีเส้นเครื่องหมายในวงอาชีพ (เข้มพอเห็นชัดบนทุกสีพื้น)

// สีวงอาชีพ — กลุ่มสีเดียวกับที่เฟส 9/11 ใช้แยกอาชีพมาตลอด (น้ำตาล/น้ำเงิน/เทา/เขียว/ม่วง) แต่ละอาชีพมี
// สัญลักษณ์เรขาคณิตเฉพาะตัวในวงด้วย ให้แยกออกได้แม้มองไม่เห็นสี (ตาบอดสี/จอขาวดำ)
const PROFESSION_INDICATOR = {
  [PROFESSIONS.LUMBERJACK]: { color: '#9c5f22', mark: 'diagonal' }, // เส้นทแยง (ขวานฟัน)
  [PROFESSIONS.WATER_CARRIER]: { color: '#2f8fe0', mark: 'bars' }, // เส้นแนวนอน 2 เส้น (ระลอกน้ำ)
  [PROFESSIONS.MINER]: { color: '#7a828c', mark: 'cross' }, // กากบาท (จอบขุด)
  [PROFESSIONS.FARMER]: { color: '#4fae2e', mark: 'plus' }, // เครื่องหมายบวก (พืชงอก)
  [PROFESSIONS.FREELANCER]: { color: '#9c3fd6', mark: 'dot' }, // จุดกลม (สัญลักษณ์กลางๆ)
};
const UNEMPLOYED_INDICATOR = { color: '#b39c82', mark: 'none' }; // ยังไม่มีอาชีพ = วงเปล่า ไม่มีเครื่องหมาย

function getProfessionIndicator(professionId) {
  return PROFESSION_INDICATOR[professionId] ?? UNEMPLOYED_INDICATOR;
}

// สถานะ "วิกฤต" ถ้า need ตัวใดตัวหนึ่งต่ำกว่าเกณฑ์ — เช็คทันทีทุกเฟรมจากค่าจริง ไม่ต้องรอสะสมหลาย tick
// เหมือน STUCK_TICKS_LIMIT ของ long-run.js (ที่นี่ต้องการเตือนผู้เล่นทันทีที่เห็นปัญหา ไม่ใช่วิเคราะห์ย้อนหลัง)
export function hasCriticalNeed(character) {
  return NEED_PRIORITY.some((key) => character.needs[key] < CRITICAL_NEED_THRESHOLD);
}

// ธุรกรรม (เฟส 7) ไม่ได้ถูกเก็บไว้ใน src/ เลย (TradeSystem.update() คืนแค่ event ของ tick นั้นแล้วทิ้ง) —
// client/src/game/simulation.js จึงเก็บ "tick ล่าสุดที่แต่ละตัวละครเทรด" ไว้เองต่างหาก (ดูที่นั่น) ฟังก์ชัน
// นี้แค่เทียบว่ายังอยู่ในช่วงเวลาที่ควรโชว์ไอคอนอยู่ไหม
function hasRecentTrade(character, simulation) {
  const lastTradeTick = simulation.getLastTradeTick(character.id);
  return lastTradeTick !== null && simulation.tick - lastTradeTick <= TRADE_INDICATOR_WINDOW_TICKS;
}

// ไอคอนสถานะ: ธุรกรรมล่าสุด (ถ้าเพิ่งเกิด) มาก่อน behavior ปกติเสมอ เพราะเป็นเหตุการณ์เด่นกว่า behavior
// ต่อเนื่อง — currentBehavior เป็น null ได้ตอนตัวละครเพิ่งเกิด/ยังไม่เคยรับ behavior จาก utility-ai เลย
function resolveStatusKey(character, simulation) {
  if (hasRecentTrade(character, simulation)) return 'trade';
  return character.currentBehavior;
}

const STATUS_INDICATOR = {
  [BEHAVIORS.SEEK_FOOD]: { color: '#e8b23f', mark: 'triangle' }, // สามเหลี่ยม (คำอาหาร)
  [BEHAVIORS.REST]: { color: '#7a8fd6', mark: 'zzz' }, // ตัว Z (นอนพัก)
  [BEHAVIORS.GATHER_WOOD]: { color: '#8a5a2b', mark: 'log' }, // แท่งไม้
  [BEHAVIORS.BUILD_SHELTER]: { color: '#c2432c', mark: 'house' }, // หลังคา+ผนังย่อ
  [BEHAVIORS.SOCIALIZE]: { color: '#e05a9c', mark: 'people' }, // จุด 2 จุดซ้อนกัน (คนคุยกัน)
  trade: { color: '#e8c23f', mark: 'coin' }, // เหรียญ (มีวงในซ้อน)
};
const CRITICAL_INDICATOR = { color: '#e63946', mark: 'exclaim' }; // "!" สีแดง

const INDICATOR_RADIUS = 4; // รัศมีวงกลม (เส้นผ่านศูนย์กลาง 8px ตามสเปก)
const INDICATOR_GAP = 2; // ช่องว่างระหว่างวงอาชีพกับวงสถานะ
const INDICATOR_MARGIN_ABOVE_HEAD = 4; // ช่องว่างระหว่างขอบล่างของกลุ่ม indicator กับขอบบนของภาพตัวละคร

function drawMark(ctx, mark, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = MARK_STROKE;
  ctx.fillStyle = MARK_STROKE;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';

  switch (mark) {
    case 'none':
      break;
    case 'dot':
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'diagonal':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.5);
      ctx.stroke();
      break;
    case 'bars':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.3);
      ctx.moveTo(cx - r * 0.5, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.3);
      ctx.stroke();
      break;
    case 'cross':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
      ctx.moveTo(cx - r * 0.5, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.5);
      ctx.stroke();
      break;
    case 'plus':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.55);
      ctx.lineTo(cx, cy + r * 0.55);
      ctx.moveTo(cx - r * 0.55, cy);
      ctx.lineTo(cx + r * 0.55, cy);
      ctx.stroke();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.4);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.4);
      ctx.closePath();
      ctx.fill();
      break;
    case 'zzz':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.45, cy - r * 0.45);
      ctx.lineTo(cx - r * 0.45, cy + r * 0.45);
      ctx.lineTo(cx + r * 0.45, cy + r * 0.45);
      ctx.stroke();
      break;
    case 'log':
      ctx.beginPath();
      ctx.rect(cx - r * 0.55, cy - r * 0.22, r * 1.1, r * 0.44);
      ctx.fill();
      break;
    case 'house':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.05);
      ctx.lineTo(cx - r * 0.5, cy - r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.rect(cx - r * 0.3, cy - r * 0.05, r * 0.6, r * 0.55);
      ctx.fill();
      break;
    case 'people':
      ctx.beginPath();
      ctx.arc(cx - r * 0.28, cy, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + r * 0.28, cy, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'coin':
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'exclaim':
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.rect(cx - r * 0.16, cy - r * 0.55, r * 0.32, r * 0.65);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.4, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawIndicatorCircle(ctx, cx, cy, r, fillColor, mark) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.stroke();
  ctx.restore();
  drawMark(ctx, mark, cx, cy, r);
}

// วาด indicator เหนือหัวตัวละคร 1 ตัว — centerX/topY คือตำแหน่งกึ่งกลางแนวนอน/ขอบบนของภาพตัวละครบนจอ (ก่อน
// วาดภาพตัวละครจริง เรียกฟังก์ชันนี้ก่อนหรือหลัง drawImage ก็ได้เพราะวาดอยู่เหนือขอบบนเสมอ ไม่ทับตัวภาพแน่นอน)
export function drawCharacterIndicators(ctx, character, simulation, centerX, topY) {
  const profession = getProfessionIndicator(character.profession);
  const critical = hasCriticalNeed(character);
  const statusKey = critical ? 'critical' : resolveStatusKey(character, simulation);
  const status = critical ? CRITICAL_INDICATOR : STATUS_INDICATOR[statusKey];

  const r = INDICATOR_RADIUS;
  const groupCy = topY - INDICATOR_MARGIN_ABOVE_HEAD - r;

  if (status) {
    const groupWidth = r * 4 + INDICATOR_GAP;
    const professionCx = centerX - groupWidth / 2 + r;
    const statusCx = professionCx + r * 2 + INDICATOR_GAP;
    drawIndicatorCircle(ctx, professionCx, groupCy, r, profession.color, profession.mark);
    drawIndicatorCircle(ctx, statusCx, groupCy, r, status.color, status.mark);
  } else {
    // ยังไม่มี behavior/สถานะให้แสดง (เช่นตัวละครเพิ่งเกิด) โชว์แค่วงอาชีพวงเดียว กึ่งกลางพอดี
    drawIndicatorCircle(ctx, centerX, groupCy, r, profession.color, profession.mark);
  }
}
