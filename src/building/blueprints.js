// สูตร (blueprint) ของสิ่งก่อสร้างที่ตัวละครสร้างได้เมื่อสะสมทรัพยากรครบตามที่กำหนด
export const BLUEPRINTS = Object.freeze({
  shelter: Object.freeze({
    id: 'shelter',
    name: 'ที่พัก',
    cost: Object.freeze({ wood: 10 }),
    effects: Object.freeze({
      // พลังงานที่ฟื้นเพิ่มขึ้นต่อ tick (นอกเหนือจากอัตราพักเฉยๆ) เมื่อพักใกล้ที่พักนี้
      restRecoveryBonus: 6,
      // ระยะ (Chebyshev) ที่ถือว่าตัวละครอยู่ "ใกล้" ที่พัก
      nearbyRadius: 3,
    }),
  }),
});
