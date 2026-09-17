// จุดเริ่มต้นของเกม (bundle เข้าไฟล์เดียวด้วย esbuild — ดู client/build.js) ต่อสาย Simulation (ซึ่งห่อ
// src/world, characters, building, society, economy, trade, governance, professions, social-conditions
// ตรงๆ ไม่มีการแก้ logic เดิมเลย) เข้ากับ pixel-art renderer และ UI overlay
import { Simulation, TICKS_PER_YEAR } from './game/simulation.js';
import { renderFrame, canvasSizeFor, TILE_SIZE } from './render/renderer.js';
import { createOverlay } from './ui/overlay.js';

const BASE_TICKS_PER_SECOND = TICKS_PER_YEAR / 36; // ความเร็วปกติ (1x): ~1 ปีเกมทุก 36 วินาทีจริง
const MAX_TICKS_PER_FRAME = 200; // กันแท็บค้าง/สลับแท็บนานแล้วกลับมาทำให้ต้องเดินหลาย tick รวดเดียวมากเกินไป

function mount() {
  const root = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'fw-canvas';
  root.appendChild(canvas);

  const simulation = new Simulation({ seed: 12345 });
  const { width, height } = canvasSizeFor(simulation.world);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; // สำคัญมากสำหรับ pixel art: ห้าม blur ตอนขยายพิกเซล

  const overlay = createOverlay(root, simulation);

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const gridX = Math.floor(((event.clientX - rect.left) * scaleX) / TILE_SIZE);
    const gridY = Math.floor(((event.clientY - rect.top) * scaleY) / TILE_SIZE);

    let closest = null;
    let closestDistance = Infinity;
    for (const character of simulation.characters) {
      const distance = Math.abs(character.position.x - gridX) + Math.abs(character.position.y - gridY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = character;
      }
    }
    // คลิกใกล้ตัวละครพอสมควร (ในระยะ 1 ช่อง grid) ถึงจะนับว่าเลือก ไม่ใช่ทุกครั้งที่คลิกบนแผนที่
    overlay.selectCharacter(closest && closestDistance <= 1 ? closest.id : null);
  });

  let tickDebt = 0;
  let lastFrameMs = performance.now();

  function frame(nowMs) {
    const deltaSeconds = Math.min(0.25, (nowMs - lastFrameMs) / 1000); // กัน delta พุ่งตอนสลับแท็บ
    lastFrameMs = nowMs;

    if (!overlay.state.paused) {
      tickDebt += deltaSeconds * BASE_TICKS_PER_SECOND * overlay.state.speedMultiplier;
      const ticksToRun = Math.min(MAX_TICKS_PER_FRAME, Math.floor(tickDebt));
      if (ticksToRun > 0) {
        simulation.step(ticksToRun);
        tickDebt -= ticksToRun;
      }
    }

    renderFrame(ctx, simulation, nowMs, overlay.state.selectedCharacterId);
    overlay.refresh();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

mount();
