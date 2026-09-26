// src/graphics/sprites/npcs/Merchant.ts
//
// 商人 — cheerful trader in a teal cap and blue vest over a cream shirt,
// tossing and catching a coin while weighing a fat purse.
import { glow, vec } from '../rig/Rig';
import { npcDrawer } from '../rig/NpcKit';

export const MerchantDrawer = npcDrawer({
  key: 'npc_merchant',
  look: {
    skin: 0xc79a70,
    build: 'stout',
    hair: { color: 0x3a2a1a, style: 'short' },
    beard: { color: 0x3a2a1a, style: 'mustache' },
    hat: { kind: 'cap', color: 0x1a5a4a, accent: 0xd4aa30 },
    top: { color: 0x1e4a70, kind: 'vest', trim: 0xd4aa30 },
    sleeves: 0xd8ccaa,
    belt: 0x4a3015,
    legs: 0x4a3a2a,
    boots: 0x2a1a0a,
    item: 'none',
    offItem: 'pouch',
  },
  work: 'count',
  ready: { off: 0 },
  fx: (ctx, p, sk, act) => {
    if (act !== 'working') return;
    // The tossed coin glints above the palm
    glow(ctx, vec(sk.handN.x + 0.5, sk.handN.y - 3 - p.fx * 5), 1.8, 0xffd860, 0.9);
  },
});
