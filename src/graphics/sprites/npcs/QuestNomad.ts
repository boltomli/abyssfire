// src/graphics/sprites/npcs/QuestNomad.ts
//
// 游牧者 — desert wayfinder in a sandy cloak and headwrap, holding up a
// warm lantern and scanning the dunes.
import { glow, vec } from '../rig/Rig';
import { npcDrawer } from '../rig/NpcKit';

export const QuestNomadDrawer = npcDrawer({
  key: 'npc_quest_nomad',
  look: {
    skin: 0xa0764a,
    build: 'normal',
    beard: { color: 0x1a1a0a, style: 'stubble' },
    hat: { kind: 'bandana', color: 0xc9a86a },
    top: { color: 0x7a5e26, kind: 'coat', trim: 0xc0960a },
    cape: 0x715722,
    belt: 0x3d270d,
    legs: 0x644a22,
    boots: 0x301a0d,
    item: 'none',
    offItem: 'lantern',
  },
  work: 'lookout',
  ready: { handF: { x: 57, y: 60 }, off: 0 },
  fx: (ctx, _p, sk, _act, t) => {
    glow(ctx, vec(sk.handF.x, sk.handF.y + 6), 6 + Math.sin(t * Math.PI * 4) * 0.6, 0xffaa30, 0.55);
  },
});
