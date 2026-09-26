// src/graphics/sprites/npcs/QuestDwarf.ts
//
// 矮人 — stocky dwarf miner with a braided red beard, iron cap and pickaxe,
// polishing a freshly dug gem.
import { glow, vec } from '../rig/Rig';
import { npcDrawer } from '../rig/NpcKit';

export const QuestDwarfDrawer = npcDrawer({
  key: 'npc_quest_dwarf',
  look: {
    skin: 0xc49a7a,
    build: 'dwarf',
    hair: { color: 0x8b3d15, style: 'short' },
    beard: { color: 0xa04a1c, style: 'braided' },
    hat: { kind: 'helm', color: 0x7a8a9a },
    top: { color: 0x4a3d30, kind: 'tunic', trim: 0xb08a3a },
    apron: 0x5a3a22,
    belt: 0x2a1a0a,
    legs: 0x302215,
    boots: 0x2a1a0a,
    item: 'none',
    offItem: 'pickaxe',
  },
  work: 'polish',
  ready: { off: 0.3 },
  fx: (ctx, p, sk, act) => {
    if (act !== 'working') return;
    glow(ctx, vec(sk.handF.x + 1.5, sk.handF.y - 1.5), 2.4, 0x6fd4ff, 0.8);
  },
});
