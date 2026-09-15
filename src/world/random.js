// PRNG แบบ mulberry32 — ใช้ seed เพื่อให้สุ่มซ้ำได้เหมือนเดิม (สำหรับ test และ debug)
export function createRng(seed = Date.now()) {
  let state = seed >>> 0;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
