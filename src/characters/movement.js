// ระยะห่างแบบ Chebyshev (นับช่องแนวทแยงเป็น 1 ก้าวเหมือนแนวตรง) ใช้กับการเดินแบบ 8 ทิศ
export function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isAdjacentOrSame(a, b) {
  return chebyshevDistance(a, b) <= 1;
}

// เดินแบบ greedy: ขยับเข้าหาเป้าหมายทีละ 1 ช่อง ต่อ 1 tick (ไม่มี pathfinding หลบสิ่งกีดขวาง)
export function stepToward(position, target) {
  const dx = Math.sign(target.x - position.x);
  const dy = Math.sign(target.y - position.y);
  return { x: position.x + dx, y: position.y + dy };
}
