// src/graphics/sprites/npcs/RescueNPC.ts
//
// 待救者 — generic stranded traveller: bandaged, clutching their side and
// swaying on their feet until rescued.
import { npcDrawer } from '../rig/NpcKit';

export const RescueNPCDrawer = npcDrawer({
  key: 'npc_rescue',
  look: {
    skin: 0xc49a72,
    build: 'slim',
    hair: { color: 0x6a4a2a, style: 'short' },
    top: { color: 0x7a6a50, kind: 'tunic' },
    belt: 0x3a2414,
    legs: 0x4a3a2a,
    boots: 0x2a1a0a,
    bandage: true,
    item: 'none',
  },
  work: 'slump',
});
