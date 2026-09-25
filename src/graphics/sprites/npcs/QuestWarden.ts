// src/graphics/sprites/npcs/QuestWarden.ts
//
// 守望者 — grim warden in dark plate under a black cloak, longsword planted
// point-down, standing a silent watch.
import { npcDrawer } from '../rig/NpcKit';

export const QuestWardenDrawer = npcDrawer({
  key: 'npc_quest_warden',
  look: {
    skin: 0x9a7a66,
    build: 'normal',
    hair: { color: 0x1a1a1a, style: 'short' },
    beard: { color: 0x1a1a1a, style: 'stubble' },
    top: { color: 0x2a1a2a, kind: 'coat', trim: 0x4a2742 },
    armor: 0x4a4a5a,
    cape: 0x1a0a1a,
    belt: 0x1a1a1a,
    legs: 0x222230,
    boots: 0x0a0a0a,
    item: 'sword',
    offItem: 'none',
  },
  work: 'guard',
  ready: { handN: { x: 54, y: 72 }, wpn: 3.14, handF: { x: 51, y: 71 } },
});
