// src/graphics/sprites/npcs/BlacksmithAdvanced.ts
//
// 大师铁匠 — master smith of the later camps: black-haired, short-bearded,
// charcoal apron with plum trim and an ornate orb-set hammer.
import { glow, vec } from '../rig/Rig';
import { anvilScenery, hammerSparks, npcDrawer, propTip } from '../rig/NpcKit';

export const BlacksmithAdvancedDrawer = npcDrawer({
  key: 'npc_blacksmith_advanced',
  look: {
    skin: 0x9a7a5c,
    build: 'normal',
    hair: { color: 0x1c1c2a, style: 'ponytail' },
    beard: { color: 0x1c1c2a, style: 'short' },
    top: { color: 0x4a4a57, kind: 'tunic' },
    apron: 0x30303d,
    belt: 0x222230,
    legs: 0x2e2e3a,
    boots: 0x1a1a24,
    mantle: 0x572742,
    item: 'hammer',
    offItem: 'tongs',
  },
  work: 'hammer',
  ready: { wpn: 2.7, off: 2.4 },
  scenery: anvilScenery,
  fx: (ctx, p, sk, act, t) => {
    if (act === 'working') hammerSparks(ctx, p.fx, t, sk);
    // Arcane orb on the hammer
    glow(ctx, propTip(sk, p.wpn, 12.5), 2.6, 0xc060ff, 0.55);
  },
});
