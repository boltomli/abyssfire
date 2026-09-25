// src/graphics/sprites/npcs/QuestScout.ts
//
// 斥候 — alert ranger in a forest-green hooded cloak and leather, sword at
// hand, shading her eyes to watch the treeline.
import { npcDrawer } from '../rig/NpcKit';

export const QuestScoutDrawer = npcDrawer({
  key: 'npc_quest_scout',
  look: {
    skin: 0xc49a72,
    build: 'slim',
    hair: { color: 0x3a2a0a, style: 'braid' },
    hat: { kind: 'hood', color: 0x2a3d1c },
    top: { color: 0x3d5a2a, kind: 'tunic', trim: 0x8a6a3a },
    sleeves: 0x3d2e1a,
    cape: 0x223015,
    belt: 0x2a1a08,
    legs: 0x3d2e1a,
    boots: 0x1a1008,
    item: 'none',
    offItem: 'sword',
  },
  work: 'lookout',
  ready: { off: 2.6, handF: { x: 45, y: 68 } },
});
