// src/graphics/sprites/npcs/QuestElder.ts
//
// 村长 — the village elder: long grey hair and beard, sage robe with gold
// trim, leaning on a staff topped with a golden orb, reading old records.
import { glow, vec } from '../rig/Rig';
import { npcDrawer, propTip, STAFF_ORB } from '../rig/NpcKit';

export const QuestElderDrawer = npcDrawer({
  key: 'npc_quest_elder',
  look: {
    skin: 0xc49c78,
    build: 'slim',
    hair: { color: 0xb8b4ae, style: 'long' },
    beard: { color: 0xd6d2cc, style: 'long' },
    top: { color: 0x5a5a28, kind: 'robe', trim: 0xc8960e },
    mantle: 0x6e6e36,
    belt: 0x303015,
    legs: 0x3a3a1a,
    boots: 0x2a1a0a,
    item: 'staff',
    offItem: 'scroll',
  },
  work: 'read',
  ready: { lean: 0.08, head: 0.04, handN: vec(56, 60), wpn: 0.05 },
  fx: (ctx, p, sk) => {
    glow(ctx, propTip(sk, p.wpn, STAFF_ORB, true, 'staff'), 4, 0xffcf50, 0.55);
  },
});
