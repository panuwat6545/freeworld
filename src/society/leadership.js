// เลือกผู้นำถิ่นฐาน 1 ตัวจากสมาชิกปัจจุบัน ด้วยกฎ: สร้างที่พักในถิ่นฐานนี้มากสุดชนะ
// ถ้าเท่ากันให้ตัวที่ homeSettlementId เป็นถิ่นฐานนี้ "นานที่สุด" ชนะ (homeSettlementSinceTick น้อยสุด)
// ถ้ายังเท่ากันอีก (เช่นย้ายเข้ามาพร้อมกันเป๊ะ) ตัดสินด้วย character.id น้อยสุด เพื่อให้ผลลัพธ์ deterministic เสมอ
export function computeLeader(settlement, characters, structures) {
  const members = characters.filter((c) => settlement.memberIds.includes(c.id));
  if (members.length === 0) return null;

  const structuresInSettlement = structures.filter((s) => settlement.structureIds.includes(s.id));

  let leader = null;
  let leaderBuiltCount = -1;
  let leaderSinceTick = Infinity;

  for (const member of members) {
    const builtCount = structuresInSettlement.filter((s) => s.builtByCharacterId === member.id).length;
    const sinceTick = member.homeSettlementSinceTick ?? Infinity;

    const isBetter =
      builtCount > leaderBuiltCount ||
      (builtCount === leaderBuiltCount &&
        (sinceTick < leaderSinceTick || (sinceTick === leaderSinceTick && member.id < leader.id)));

    if (isBetter) {
      leader = member;
      leaderBuiltCount = builtCount;
      leaderSinceTick = sinceTick;
    }
  }

  return leader.id;
}

// เรียกพร้อมกับรอบที่ settlement-detector คำนวณกลุ่มถิ่นฐานใหม่ (ดู society-system.js)
export function computeAllLeaders(settlements, characters, structures) {
  for (const settlement of settlements) {
    settlement.leaderId = computeLeader(settlement, characters, structures);
  }
}
