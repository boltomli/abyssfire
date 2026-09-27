// src/graphics/sprites/npcs/Stash.ts
//
// 仓库管理员 — bespectacled keeper of the stash in plum robes with arcane
// trim, key ring at the hip, forever checking the inventory book.
import { npcDrawer } from '../rig/NpcKit';

export const StashDrawer = npcDrawer({
  key: 'npc_stash',
  look: {
    skin: 0xc2a07e,
    build: 'slim',
    hair: { color: 0x4a3d30, style: 'bun' },
    top: { color: 0x3a1c4a, kind: 'robe', trim: 0x8a5ac0 },
    belt: 0x2a1a3a,
    legs: 0x2a1a3a,
    boots: 0x1a1a2a,
    item: 'key',
    offItem: 'book',
    specs: true,
  },
  work: 'read',
  ready: { off: 0.2 },
});
