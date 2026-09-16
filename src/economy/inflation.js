import { ECONOMY_CONFIG } from './economy-config.js';
import { DEFAULT_TICKS_PER_YEAR } from '../storage/snapshot-scheduler.js';

// สุ่มอัตราเงินเฟ้อของปีนี้ อยู่ในช่วง [INFLATION_MIN_RATE, INFLATION_MAX_RATE] เสมอ
function randomInflationRate(randomFn) {
  const { INFLATION_MIN_RATE, INFLATION_MAX_RATE } = ECONOMY_CONFIG;
  return INFLATION_MIN_RATE + randomFn() * (INFLATION_MAX_RATE - INFLATION_MIN_RATE);
}

// ติดตามเงินเฟ้อสะสมของระบบเศรษฐกิจ xcoin (ดูเหตุผลการออกแบบใน README หัวข้อเฟส 6)
//
// ยังไม่มีสินค้า/บริการให้อ้างอิงราคาจริง (รอเฟส 7 ระบบแลกเปลี่ยน และเฟส 9 อาชีพ) จึง "ยังไม่ implement
// เป็นตัวคูณราคาสินค้า" ตรงๆ แต่เก็บเป็น cumulativeIndex สะสมไว้ก่อน (เหมือนดัชนีราคาผู้บริโภค/CPI ในโลก
// จริง เริ่มที่ 1.0 แล้วคูณด้วย (1 + อัตราเงินเฟ้อ) ทบต้นทุกปี) — เมื่อเฟส 7/9 มีราคาสินค้า/ค่าจ้างจริงแล้ว
// ค่อยหารราคาที่ตั้งไว้ ณ ตอนนั้นด้วย cumulativeIndex เพื่อคำนวณ "มูลค่าจริง" ของ xcoin ได้ทันที ไม่ต้องแก้
// โครงสร้างตรงนี้ใหม่
export class InflationTracker {
  constructor({ ticksPerYear = DEFAULT_TICKS_PER_YEAR, randomFn = Math.random } = {}) {
    this.ticksPerYear = ticksPerYear;
    this.randomFn = randomFn;
    this.lastProcessedYear = 0;
    this.cumulativeIndex = 1; // ดัชนีราคาสะสม เริ่มที่ 1.0 (ยังไม่มีเงินเฟ้อสะสมเลย)
    this.history = []; // [{ year, rate, cumulativeIndex }] เก็บไว้รายงาน/ตรวจสอบย้อนหลัง
  }

  // เรียกทุก tick (เหมือน SnapshotScheduler.checkAndSave) จะสุ่มอัตราเงินเฟ้อใหม่ทุกครั้งที่ครบ 1 ปีเกม
  // คืนค่า { year, rate, cumulativeIndex } เมื่อครบปีใหม่ หรือ null ถ้ายังไม่ครบ
  checkAndApply(world) {
    const currentYear = Math.floor(world.tick / this.ticksPerYear);
    if (currentYear <= this.lastProcessedYear) return null;

    this.lastProcessedYear = currentYear;
    const rate = randomInflationRate(this.randomFn);
    this.cumulativeIndex *= 1 + rate;

    const entry = { year: currentYear, rate, cumulativeIndex: this.cumulativeIndex };
    this.history.push(entry);
    return entry;
  }
}
