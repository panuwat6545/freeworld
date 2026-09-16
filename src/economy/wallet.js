import { ECONOMY_CONFIG } from './economy-config.js';

// wallet ของตัวละคร 1 คน เก็บยอด xcoin ปัจจุบัน — เป็น plain object ธรรมดา (เหมือน character.inventory)
// ไม่ใช่ class เพราะไม่มีพฤติกรรมของตัวเอง แก้ไขผ่านฟังก์ชัน deposit/withdraw ด้านล่างเท่านั้น
export function createWallet(startingBalance = ECONOMY_CONFIG.STARTING_BALANCE) {
  return { balance: startingBalance };
}

// เพิ่มยอด xcoin เข้า wallet คืนค่ายอดใหม่หลังเพิ่ม
export function deposit(wallet, amount) {
  if (amount < 0) throw new Error(`deposit amount ต้องไม่ติดลบ (ได้รับ ${amount})`);
  wallet.balance += amount;
  return wallet.balance;
}

// ถอนยอด xcoin ออกจาก wallet ป้องกันยอดติดลบ: ถ้ายอดไม่พอจะไม่ถอนเลยและคืนค่า false
// คืนค่า true เมื่อถอนสำเร็จ
export function withdraw(wallet, amount) {
  if (amount < 0) throw new Error(`withdraw amount ต้องไม่ติดลบ (ได้รับ ${amount})`);
  if (amount > wallet.balance) return false;
  wallet.balance -= amount;
  return true;
}
