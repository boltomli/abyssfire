// src/graphics/sprites/npcs/WanderingMerchant.ts
//
// 流浪商人 — road-worn peddler with a huge pack, wide-brimmed hat and a
// walking staff, counting takings from a purse.
import { glow, vec } from '../rig/Rig';
import { npcDrawer } from '../rig/NpcKit';

export const WanderingMerchantDrawer = npcDrawer({
  key: 'npc_wandering_merchant',
  look: {
    skin: 0xc49a72,
    build: 'normal',
    hair: { color: 0x5a4028, style: 'short' },
    beard: { color: 0x5a4028, style: 'short' },
    hat: { kind: 'widebrim', color: 0x5a4a30, accent: 0x9a2a2a },
    top: { color: 0x3a4a30, kind: 'coat', trim: 0xb08a3a },
    belt: 0x3a2414,
    legs: 0x4a3a2a,
    boots: 0x2a1a0a,
    pack: 0x7a5a36,
    item: 'none',
    offItem: 'pouch',
  },
  work: 'count',
  ready: { off: 0 },
  fx: (ctx, p, sk, act) => {
    if (act === 'working') glow(ctx, vec(sk.handN.x + 0.5, sk.handN.y - 3 - p.fx * 5), 1.8, 0xffd860, 0.9);
  },
});
