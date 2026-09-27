// src/graphics/sprites/npcs/ForestHermit.ts
//
// 林中隐士 — wild-haired hermit in a mossy cloak, puffing a pipe beside his
// gnarled staff with a green crystal.
import { glow, vec } from '../rig/Rig';
import { npcDrawer, propTip, STAFF_ORB } from '../rig/NpcKit';

export const ForestHermitDrawer = npcDrawer({
  key: 'npc_forest_hermit',
  look: {
    skin: 0xa88a64,
    build: 'slim',
    hair: { color: 0x9a9a8c, style: 'wild' },
    beard: { color: 0xb4b4a6, style: 'full' },
    top: { color: 0x3d5a30, kind: 'robe' },
    mantle: 0x303d22,
    cape: 0x223015,
    belt: 0x3d3015,
    legs: 0x303d22,
    boots: 0x2a1a0a,
    item: 'pipe',
    offItem: 'staff',
  },
  work: 'smoke',
  fx: (ctx, p, sk, act, t) => {
    glow(ctx, propTip(sk, p.off, STAFF_ORB, false, 'staff'), 3.6, 0x80e080, 0.6);
    if (act === 'working' && p.fx > 0.2) {
      for (let i = 0; i < 3; i++) {
        const k = (i / 3 + t) % 1;
        ctx.fillStyle = `rgba(220,220,210,${0.5 * (1 - k) * p.fx})`;
        ctx.beginPath();
        ctx.arc(sk.head.x + 7 + k * 3, sk.head.y + 1 - k * 10, 1.2 + k * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
});
