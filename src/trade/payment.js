import { TRADE_CONFIG } from './trade-config.js';
import { deposit, withdraw } from '../economy/wallet.js';
import { clampNeedValue } from '../characters/character.js';

// พยายามจ่ายด้วย xcoin ก่อนเสมอ ถ้า buyer มีไม่พอ ถือว่า "จ่ายด้วยเงินไม่ไหว" จึงตกลงแลกแบบ barter แทน
// (ให้ social ทั้งสองฝ่ายแทนเงิน — ดูเหตุผลที่เลือก social เป็นสกุล barter ใน trade-config.js/README)
// คืนค่า 'xcoin' หรือ 'barter' ตามวิธีที่ใช้จ่ายจริง ไม่มีทางล้มเหลว (barter ทำได้เสมอไม่ต้องมีเงื่อนไขเพิ่ม)
export function settlePayment(payer, recipient, price) {
  if (payer.wallet.balance >= price) {
    withdraw(payer.wallet, price);
    deposit(recipient.wallet, price);
    return 'xcoin';
  }

  payer.needs.social = clampNeedValue(payer.needs.social + TRADE_CONFIG.SOCIAL_BARTER_BONUS);
  recipient.needs.social = clampNeedValue(recipient.needs.social + TRADE_CONFIG.SOCIAL_BARTER_BONUS);
  return 'barter';
}
