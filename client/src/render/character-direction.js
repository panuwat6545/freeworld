// คำนวณ "ทิศทางที่ตัวละครกำลังหันหน้า" ฝั่ง client เองล้วนๆ จากตำแหน่ง (character.position) ก่อน-หลังที่
// อ่านได้จาก simulation ตรงๆ — ไม่เพิ่ม field ใหม่ใน src/characters/character.js เลยตามที่สั่ง (ทิศทางเป็น
// เรื่องของการ "แสดงผล" ล้วนๆ ไม่ใช่ state ของเกม จึงเก็บไว้ในชั้น renderer นี้เท่านั้น)
export class CharacterDirectionTracker {
  constructor() {
    this.stateByCharacterId = new Map(); // characterId -> { x, y, direction }
  }

  // คืนค่าทิศทางล่าสุดของตัวละครนี้ ('down'/'up'/'left'/'right') — ถ้าตำแหน่งไม่ขยับเลยตั้งแต่ครั้งก่อน
  // (หยุดนิ่งอยู่ เช่นกำลังพัก/เก็บของ) จะคงทิศเดิมไว้ ไม่มีเหตุผลให้เปลี่ยนทิศทันทีที่หยุดเดิน
  getDirection(character) {
    const { x, y } = character.position;
    const previous = this.stateByCharacterId.get(character.id);

    if (!previous) {
      const initial = { x, y, direction: 'down' };
      this.stateByCharacterId.set(character.id, initial);
      return initial.direction;
    }

    const dx = x - previous.x;
    const dy = y - previous.y;
    let direction = previous.direction;

    if (dx !== 0 || dy !== 0) {
      // แกนที่ขยับมากกว่าเป็นตัวตัดสินทิศ (การเดินบน grid แบบ stepToward มักขยับทีละ 1 ช่องต่อแกนอยู่แล้ว
      // แต่เผื่อกรณีขยับพร้อมกันทั้ง 2 แกนก็ยังเลือกทิศที่สมเหตุสมผลที่สุดได้)
      direction = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }

    this.stateByCharacterId.set(character.id, { x, y, direction });
    return direction;
  }
}
