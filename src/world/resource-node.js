// จุดทรัพยากรธรรมชาติ 1 จุดบนแผนที่ เช่น ต้นไม้, แหล่งน้ำ, แหล่งแร่, แหล่งอาหาร
export class ResourceNode {
  constructor(type, { amount, maxAmount, regenRate }) {
    this.type = type;
    this.maxAmount = maxAmount;
    this.regenRate = regenRate;
    this.amount = amount === undefined ? maxAmount : amount;
  }

  // เก็บเกี่ยวทรัพยากร คืนค่าจำนวนที่เก็บได้จริง (อาจน้อยกว่าที่ขอถ้าเหลือไม่พอ)
  harvest(quantity) {
    const harvested = Math.min(this.amount, quantity);
    this.amount -= harvested;
    return harvested;
  }

  // งอกทรัพยากรใหม่ตามอัตรา regenRate คูณจำนวน tick ที่ผ่านไป ไม่เกิน maxAmount
  update(deltaTicks = 1) {
    if (this.amount >= this.maxAmount) return;
    this.amount = Math.min(this.maxAmount, this.amount + this.regenRate * deltaTicks);
  }

  isDepleted() {
    return this.amount <= 0;
  }
}
