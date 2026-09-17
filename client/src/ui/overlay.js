// UI overlay ทั้งหมด (นอก canvas) — สร้าง element ด้วย DOM API ล้วนๆ ไม่มี framework ไม่มี CSS/asset ภายนอก
// ผูก event เข้ากับ Simulation (client/src/game/simulation.js) ที่ main.js สร้างไว้
import { NEED_PRIORITY } from '../../../src/characters/needs-config.js';
import { getProfessionById } from '../../../src/professions/profession.js';
import { saveSnapshotToServer } from '../api/save-client.js';

const NEED_LABEL_TH = { hunger: 'หิว', energy: 'พลังงาน', shelter: 'ที่อยู่', social: 'สังคม' };

function createStatusBar() {
  const bar = document.createElement('div');
  bar.className = 'fw-status-bar';
  bar.innerHTML = `
    <span class="fw-stat">ปีที่ <b id="fw-year">0</b></span>
    <span class="fw-stat">ประชากร <b id="fw-population">0</b> คน</span>
    <span class="fw-stat">ถิ่นฐาน <b id="fw-settlements">0</b></span>
    <span class="fw-controls">
      <button id="fw-btn-pause">หยุด</button>
      <button id="fw-btn-speed-1" class="fw-active">1x</button>
      <button id="fw-btn-speed-2">2x</button>
      <button id="fw-btn-speed-5">5x</button>
      <button id="fw-btn-speed-20">20x</button>
      <button id="fw-btn-save">บันทึกเกม</button>
      <span id="fw-save-status"></span>
    </span>
  `;
  return bar;
}

function createCharacterPanel() {
  const panel = document.createElement('div');
  panel.className = 'fw-character-panel';
  panel.id = 'fw-character-panel';
  panel.hidden = true;
  return panel;
}

function renderCharacterPanel(panel, character) {
  if (!character) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  const profession = getProfessionById(character.profession);
  const needsRows = NEED_PRIORITY.map((key) => {
    const value = character.needs[key];
    const pct = Math.max(0, Math.min(100, value)).toFixed(0);
    const color = value < 20 ? '#ef476f' : value < 50 ? '#ffd166' : '#06d6a0';
    return `
      <div class="fw-need-row">
        <span>${NEED_LABEL_TH[key]}</span>
        <div class="fw-need-track"><div class="fw-need-fill" style="width:${pct}%;background:${color}"></div></div>
        <span>${value.toFixed(0)}</span>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <button class="fw-close" id="fw-panel-close">×</button>
    <h3>ตัวละคร #${character.id}</h3>
    <p>อาชีพ: ${profession ? profession.name : 'ยังไม่มีอาชีพ'}</p>
    <p>xcoin: ${character.wallet.balance.toFixed(1)}</p>
    <p>ถิ่นฐาน: ${character.homeSettlementId !== null ? `#${character.homeSettlementId}` : 'ยังไม่มี'}</p>
    <p>พฤติกรรมปัจจุบัน: ${character.currentBehavior ?? '-'}</p>
    ${needsRows}
  `;
  panel.querySelector('#fw-panel-close').addEventListener('click', () => {
    panel.hidden = true;
    panel.dataset.selectedId = '';
  });
}

// ประกอบ overlay ทั้งหมดเข้ากับ container ที่ให้มา คืนค่า handle ไว้ให้ main.js เรียกอัปเดตทุกเฟรม
export function createOverlay(container, simulation) {
  const statusBar = createStatusBar();
  const characterPanel = createCharacterPanel();
  container.appendChild(statusBar);
  container.appendChild(characterPanel);

  const state = { speedMultiplier: 1, paused: false, selectedCharacterId: null };

  const speedButtons = {
    1: statusBar.querySelector('#fw-btn-speed-1'),
    2: statusBar.querySelector('#fw-btn-speed-2'),
    5: statusBar.querySelector('#fw-btn-speed-5'),
    20: statusBar.querySelector('#fw-btn-speed-20'),
  };
  function setActiveSpeedButton() {
    for (const [multiplier, button] of Object.entries(speedButtons)) {
      button.classList.toggle('fw-active', Number(multiplier) === state.speedMultiplier);
    }
  }
  for (const [multiplier, button] of Object.entries(speedButtons)) {
    button.addEventListener('click', () => {
      state.speedMultiplier = Number(multiplier);
      setActiveSpeedButton();
    });
  }

  const pauseButton = statusBar.querySelector('#fw-btn-pause');
  pauseButton.addEventListener('click', () => {
    state.paused = !state.paused;
    pauseButton.textContent = state.paused ? 'เล่นต่อ' : 'หยุด';
  });

  const saveButton = statusBar.querySelector('#fw-btn-save');
  const saveStatus = statusBar.querySelector('#fw-save-status');
  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    saveStatus.textContent = 'กำลังบันทึก...';
    try {
      const result = await saveSnapshotToServer(simulation);
      saveStatus.textContent = `บันทึกสำเร็จ: ${result.fileName}`;
    } catch (error) {
      saveStatus.textContent = `บันทึกไม่สำเร็จ: ${error.message}`;
    } finally {
      saveButton.disabled = false;
    }
  });

  return {
    state,
    selectCharacter(characterId) {
      state.selectedCharacterId = characterId;
    },
    // เรียกทุกเฟรม (หรือถี่พอสมควร) อัปเดตตัวเลข/panel ให้ตรงกับสถานะซิมูเลชันล่าสุด
    refresh() {
      statusBar.querySelector('#fw-year').textContent = simulation.gameYear.toFixed(2);
      statusBar.querySelector('#fw-population').textContent = String(simulation.characters.length);
      statusBar.querySelector('#fw-settlements').textContent = String(simulation.settlements.length);

      const selected = state.selectedCharacterId !== null ? simulation.getCharacterById(state.selectedCharacterId) : null;
      renderCharacterPanel(characterPanel, selected);
    },
  };
}
