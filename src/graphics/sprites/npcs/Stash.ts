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
  },
  work: 'read',
  ready: { off: 0.2 },
  fx: (ctx, _p, sk) => {
    // Round spectacles
    ctx.save();
    ctx.translate(sk.head.x, sk.head.y);
    ctx.rotate(sk.headAng);
    ctx.strokeStyle = 'rgba(160,210,240,0.9)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(4, -0.5, 1.6, 0, Math.PI * 2);
    ctx.moveTo(7.6, -0.4);
    ctx.arc(6.6, -0.4, 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
});
