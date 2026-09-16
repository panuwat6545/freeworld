import { LAW_EVENTS } from './law.js';
import { SettlementLawsetRegistry } from './settlement-lawset.js';
import { withdraw } from '../economy/wallet.js';

// จุดรวมของระบบกฎหมาย/การปกครอง (เฟส 8) — ผูกกฎหมายที่เปิดอยู่เข้ากับ 2 เหตุการณ์จริงในเกม:
//   1) ธุรกรรม xcoin จากเฟส 7 (ดู applyTradeLaws) — เรียกทุก tick หลัง trade.update()
//   2) การเก็บทรัพยากรจากเฟส 1-2 (ดู world.harvestAt ที่ถูก wrap ไว้ในตัว constructor)
//
// ไม่แก้ src/trade/, src/characters/behaviors.js, src/characters/utility-ai.js, หรือ src/world/world.js
// (source ไฟล์) เลยแม้แต่บรรทัดเดียว — trade laws ทำงานแบบ "สังเกตผลลัพธ์ธุรกรรมแล้วเก็บภาษีย้อนหลัง"
// (เพราะ settlePayment โอนเงินเต็มจำนวนไปแล้ว governance แค่หักคืนบางส่วนเข้าคลัง) ส่วน resource-gather
// laws ทำงานผ่านการ "ห่อ" (wrap) เมธอด world.harvestAt ของอินสแตนซ์นั้นๆ จากภายนอกตอน construct
// GovernanceSystem (ไม่แก้ class World ต้นฉบับ) — ตัวเรียก (long-run.js/demo.js) ต้องบอกด้วยว่า "ใครกำลัง
// เก็บอยู่" ผ่าน setCurrentHarvester() ก่อนเรียก updateCharacter() ของตัวละครแต่ละตัว เพราะ
// world.harvestAt(x, y, quantity) เดิมไม่มี parameter ระบุตัวผู้เก็บเลย
export class GovernanceSystem {
  constructor({ world } = {}) {
    this.lawsetRegistry = new SettlementLawsetRegistry();
    this.treasuryBySettlementId = new Map();
    this.world = world ?? null;
    this.currentHarvester = null;
    this.currentSettlements = [];
    // ตัวนับสะสมไว้ให้เครื่องมือสำรวจ (เช่น scripts/long-run.js) รายงานผลกระทบของ territorial_access ได้
    // โดยไม่ต้องเก็บ log เต็มทุกครั้ง (เหมือนแนวทาง totalXcoinTransactions ของ TradeSystem)
    this.totalBlockedGathers = 0;
    this.totalPenalizedGathers = 0;

    if (this.world) {
      this._originalHarvestAt = this.world.harvestAt.bind(this.world);
      this.world.harvestAt = (x, y, quantity) => this._interceptedHarvestAt(x, y, quantity);
    }
  }

  // เรียก 1 ครั้งต่อ tick ก่อนเริ่ม loop ตัวละคร เพื่อให้ resource-gather law รู้ถิ่นฐานปัจจุบันทั้งหมด
  setSettlements(settlements) {
    this.currentSettlements = settlements;
  }

  // เรียกก่อน updateCharacter(character, ...) ของตัวละครแต่ละตัว บอกว่า "ตอนนี้ใครกำลังจะทำ tick ของตัวเอง"
  // เพื่อให้ world.harvestAt ที่ถูก wrap รู้ว่าใครกำลังเก็บ — เคลียร์เป็น null หลัง loop จบ (กัน harvestAt
  // ที่ถูกเรียกนอก loop ตัวละคร เช่นจาก unit test อื่น ไปโดน territorial law โดยไม่ตั้งใจ)
  setCurrentHarvester(character) {
    this.currentHarvester = character;
  }

  getTreasuryBalance(settlementId) {
    return this.treasuryBySettlementId.get(settlementId) ?? 0;
  }

  _depositToTreasury(settlementId, amount) {
    if (amount <= 0) return;
    this.treasuryBySettlementId.set(settlementId, this.getTreasuryBalance(settlementId) + amount);
  }

  // เรียกทุก tick หลัง trade.update() คืน events ของ tick นั้นมา — คืนค่ารายการภาษี/ผลของกฎหมายที่เกิดขึ้นจริง
  applyTradeLaws(tradeEvents, characters, settlements) {
    const appliedEffects = [];

    for (const deal of tradeEvents) {
      const recipientId = deal.sellerId ?? deal.helperId;
      const recipient = characters.find((c) => c.id === recipientId);
      if (!recipient || recipient.homeSettlementId === null) continue;

      const settlement = settlements.find((s) => s.id === recipient.homeSettlementId);
      if (!settlement) continue;

      for (const law of this.lawsetRegistry.getActiveLaws(settlement.id)) {
        const params = this.lawsetRegistry.getLawParams(settlement.id, law.id);
        const result = law.apply({ eventType: LAW_EVENTS.TRADE, deal, settlement, params });

        if (result.taxAmount > 0 && withdraw(recipient.wallet, result.taxAmount)) {
          this._depositToTreasury(settlement.id, result.taxAmount);
          appliedEffects.push({
            lawId: law.id,
            settlementId: settlement.id,
            payerId: recipient.id,
            amount: result.taxAmount,
          });
        }
      }
    }

    return appliedEffects;
  }

  _interceptedHarvestAt(x, y, quantity) {
    const harvester = this.currentHarvester;
    if (!harvester) return this._originalHarvestAt(x, y, quantity);

    for (const settlement of this.currentSettlements) {
      for (const law of this.lawsetRegistry.getActiveLaws(settlement.id)) {
        const params = this.lawsetRegistry.getLawParams(settlement.id, law.id);
        const result = law.apply({
          eventType: LAW_EVENTS.RESOURCE_GATHER,
          harvester,
          x,
          y,
          settlement,
          params,
          world: this.world,
        });

        if (result.allow === false) {
          this.totalBlockedGathers += 1;
          return 0; // ถูก block สนิท ไม่ได้อะไรเลย ไม่แตะทรัพยากรจริงด้วย
        }
        if (result.confiscationRate) {
          this.totalPenalizedGathers += 1;
          const harvested = this._originalHarvestAt(x, y, quantity);
          return harvested * (1 - result.confiscationRate);
        }
      }
    }

    return this._originalHarvestAt(x, y, quantity);
  }
}
