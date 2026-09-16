// ลำดับความสำคัญของ need เมื่อค่าเท่ากันพอดี (ใช้ตัดสินเสมอ) เรียงจากสำคัญที่สุดไปน้อยที่สุด
export const NEED_PRIORITY = Object.freeze(['hunger', 'energy', 'shelter', 'social']);

export const NEED_MIN = 0;
export const NEED_MAX = 100;

export const NEEDS_CONFIG = Object.freeze({
  // อัตราการลดลงของแต่ละ need ต่อ 1 tick — หิวลดเร็วที่สุด สังคมลดช้าที่สุด
  DECAY_RATE: Object.freeze({
    hunger: 1.5,
    energy: 1.0,
    shelter: 0.005, // ลดจากเดิม (0.6) ~99% (ลองแค่ 40% แล้วยังสูงเกินเป้า ต้องลดมากกว่านั้นมาก - ดูเหตุผลใน README)
    social: 0.4,
  }),
  ENERGY_REST_RECOVERY: 4, // พลังงานที่ฟื้นกลับต่อ tick เมื่อหยุดพัก
  FOOD_HARVEST_QUANTITY: 15, // ปริมาณอาหารที่เก็บต่อครั้ง
  HUNGER_PER_FOOD_UNIT: 2, // ค่าหิวที่ฟื้นกลับต่อหน่วยอาหารที่กินเข้าไป
  WOOD_HARVEST_QUANTITY: 10, // ปริมาณไม้ที่เก็บต่อครั้ง
  SOCIAL_GAIN_PER_TICK: 6, // ค่าสังคมที่ฟื้นกลับต่อ tick เมื่ออยู่ใกล้ตัวละครอื่น
  SHELTER_RESTORE_AMOUNT: 100, // ค่า shelter ที่ฟื้นกลับทันทีเมื่อสร้างที่พักสำเร็จ 1 หลัง (ฟื้นเต็ม NEED_MAX
  // เพราะการมีที่อยู่เป็นของตัวเองคือ milestone ที่ตอบโจทย์ความต้องการนี้ทันที ต่างจาก
  // hunger/energy/social ที่ฟื้นแบบค่อยเป็นค่อยไปตามการกิน/พัก/เข้าสังคมทีละหน่วย)
});
