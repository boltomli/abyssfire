// src/graphics/sprites/npcs/Blacksmith.ts
//
// 铁匠 — burly, bald smith with a braided red beard, leather apron over a
// soot-grey tunic, hammering at a stump anvil; sparks fly on each strike.
import { anvilScenery, hammerSparks, npcDrawer } from '../rig/NpcKit';

export const BlacksmithDrawer = npcDrawer({
  key: 'npc_blacksmith',
  look: {
    skin: 0xc98b62,
    build: 'stout',
    hair: { color: 0x7a3a1c, style: 'bald' },
    beard: { color: 0x9a4a22, style: 'braided' },
    top: { color: 0x5a5a62, kind: 'tunic' },
    sleeves: 0xc98b62,
    apron: 0x6e4424,
    belt: 0x3a2414,
    legs: 0x4a3a2c,
    boots: 0x2e2018,
    item: 'hammer',
    offItem: 'tongs',
  },
  work: 'hammer',
  ready: { wpn: 1.2, off: 1.3 },
  scenery: (ctx) => anvilScenery(ctx),
  fx: (ctx, p, _sk, act, t) => {
    if (act === 'working') hammerSparks(ctx, p.fx, t);
  },
});
