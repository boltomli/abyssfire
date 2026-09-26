// src/graphics/sprites/npcs/MerchantDesert.ts
//
// 沙漠商人 — kohl-eyed caravan trader in a sand-gold robe and turban,
// tallying goods in a leather ledger.
import { npcDrawer } from '../rig/NpcKit';

export const MerchantDesertDrawer = npcDrawer({
  key: 'npc_merchant_desert',
  look: {
    skin: 0xa77a4e,
    build: 'normal',
    beard: { color: 0x1a0e08, style: 'short' },
    hat: { kind: 'turban', color: 0xd9c49a, accent: 0xc02a2a },
    top: { color: 0x8a6a36, kind: 'robe', trim: 0xd4a030 },
    belt: 0x5a3a18,
    legs: 0x573d15,
    boots: 0x3d2714,
    pack: 0x644a22,
    eyes: 0x1a0a0a,
    item: 'none',
    offItem: 'ledger',
  },
  work: 'ledger',
});
