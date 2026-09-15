let nextStructureId = 1;

// สิ่งก่อสร้าง 1 หลังที่ถูกสร้างขึ้นบนโลก ณ ตำแหน่งใดตำแหน่งหนึ่ง
export class Structure {
  constructor({ type, x, y, builtByCharacterId = null, builtAtTick = 0 }) {
    this.id = nextStructureId++;
    this.type = type;
    this.position = { x, y };
    this.builtByCharacterId = builtByCharacterId;
    this.builtAtTick = builtAtTick;
  }
}
