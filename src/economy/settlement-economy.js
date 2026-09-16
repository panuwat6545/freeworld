// รวมยอด/เฉลี่ย xcoin ของสมาชิกในแต่ละถิ่นฐาน — เป็นมุมมองแบบคำนวณสด (derived) จาก wallet ของสมาชิก
// ปัจจุบัน ไม่ได้เก็บเป็น "บัญชีกลางของถิ่นฐาน" แยกต่างหาก (ดูเหตุผลการเลือกออกแบบแบบนี้ใน README หัวข้อ
// เฟส 6: xcoin เป็นสกุลเงินเดียวใช้ร่วมกันทั้งโลก มีดัชนีเงินเฟ้อ (InflationTracker) ชุดเดียว ไม่แยกเศรษฐกิจ
// ต่อถิ่นฐาน — ฟังก์ชันในไฟล์นี้แค่ "มองข้อมูลเดิม" แบบแบ่งกลุ่มตามถิ่นฐานเพื่อรายงาน/ใช้ต่อในเฟส 8-9

export function getSettlementTotalBalance(settlement, characters) {
  const members = characters.filter((c) => settlement.memberIds.includes(c.id));
  return members.reduce((sum, c) => sum + c.wallet.balance, 0);
}

export function getSettlementAverageBalance(settlement, characters) {
  const members = characters.filter((c) => settlement.memberIds.includes(c.id));
  if (members.length === 0) return 0;
  const total = members.reduce((sum, c) => sum + c.wallet.balance, 0);
  return total / members.length;
}
