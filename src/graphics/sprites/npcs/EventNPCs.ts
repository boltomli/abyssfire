// src/graphics/sprites/npcs/EventNPCs.ts
//
// Random-event NPCs (rescue targets and escorts) and hireable mercenaries,
// all built on the shared townsfolk rig. Mercenaries fight beside the
// player, so their "working" loop is a combat-ready stance.
import type { EntityDrawer } from '../types';
import { glow, vec } from '../rig/Rig';
import { npcDrawer, propTip, STAFF_ORB } from '../rig/NpcKit';

export const RescueLostTravelerDrawer = npcDrawer({
  key: 'npc_rescue_lost_traveler',
  look: {
    skin: 0xc49c78, build: 'slim',
    hair: { color: 0x493326, style: 'ponytail' },
    top: { color: 0x526b62, kind: 'coat', trim: 0x677d4d },
    belt: 0x674931, legs: 0x4a4f43, boots: 0x3a2a1c,
    pack: 0x674931, item: 'none', offItem: 'none',
  },
  work: 'lookout',
});

export const RescueWoundedHunterDrawer = npcDrawer({
  key: 'npc_rescue_wounded_hunter',
  look: {
    skin: 0xb28866, build: 'normal',
    hair: { color: 0x392d24, style: 'short' },
    beard: { color: 0x392d24, style: 'short' },
    hat: { kind: 'hood', color: 0x304a34 },
    top: { color: 0x41563b, kind: 'tunic' },
    sleeves: 0x5b3e2b, belt: 0x5b3e2b, legs: 0x3b4535, boots: 0x2a1e14,
    bandage: true, item: 'bow', offItem: 'none',
  },
  work: 'slump',
  ready: { wpn: 0.2 },
});

export const RescueTrappedMinerDrawer = npcDrawer({
  key: 'npc_rescue_trapped_miner',
  look: {
    skin: 0xb88e6c, build: 'stout',
    hair: { color: 0x3a3029, style: 'short' },
    beard: { color: 0x3a3029, style: 'full' },
    hat: { kind: 'cap', color: 0xb58a3b },
    top: { color: 0x796047, kind: 'tunic' },
    apron: 0x493529, belt: 0x493529, legs: 0x4c4640, boots: 0x2a221c,
    bandage: true, item: 'pickaxe', offItem: 'lantern',
  },
  work: 'slump',
});

export const RescueCaravanGuardDrawer = npcDrawer({
  key: 'npc_rescue_caravan_guard',
  look: {
    skin: 0xa87a58, build: 'normal',
    beard: { color: 0x2b211c, style: 'short' },
    hat: { kind: 'turban', color: 0x315e62, accent: 0xd4a030 },
    top: { color: 0x6b4350, kind: 'tunic', trim: 0x315e62 },
    armor: 0x7a7a86, belt: 0x5a3c27, legs: 0x423444, boots: 0x2a2028,
    bandage: true, item: 'spear', offItem: 'none',
  },
  work: 'slump',
  ready: { wpn: 0.1 },
});

export const RescueAbyssExplorerDrawer = npcDrawer({
  key: 'npc_rescue_abyss_explorer',
  look: {
    skin: 0xae8a80, build: 'slim',
    hair: { color: 0x292331, style: 'long' },
    top: { color: 0x453957, kind: 'coat', trim: 0x55c7cf },
    cape: 0x302b3d, belt: 0x312a39, legs: 0x302b3d, boots: 0x1e1a26,
    item: 'lantern', offItem: 'none',
  },
  work: 'lookout',
  fx: (ctx, _p, sk, _act, t) => {
    glow(ctx, vec(sk.handN.x, sk.handN.y + 6), 6 + Math.sin(t * Math.PI * 4) * 0.5, 0x55c7cf, 0.5);
  },
});

export const EscortTravelingMerchantDrawer = npcDrawer({
  key: 'npc_escort_traveling_merchant',
  look: {
    skin: 0xc49c78, build: 'stout',
    hair: { color: 0x3f2d21, style: 'short' },
    beard: { color: 0x3f2d21, style: 'mustache' },
    hat: { kind: 'widebrim', color: 0x6b3e39, accent: 0x28706d },
    top: { color: 0x6b3e39, kind: 'coat', trim: 0x28706d },
    belt: 0x68472d, legs: 0x354458, boots: 0x2a1e14,
    pack: 0x68472d, item: 'none', offItem: 'pouch',
  },
  work: 'count',
  ready: { off: 0 },
});

export const EscortWoundedExplorerDrawer = npcDrawer({
  key: 'npc_escort_wounded_explorer',
  look: {
    skin: 0xb08664, build: 'normal',
    hair: { color: 0x443025, style: 'wild' },
    top: { color: 0x8a6846, kind: 'tunic', trim: 0x8d3f3f },
    belt: 0x5f412d, legs: 0x51463b, boots: 0x2a1e14,
    bandage: true, item: 'crutch', offItem: 'none',
  },
  work: 'slump',
  ready: { wpn: 0.05, handN: { x: 55, y: 64 } },
});

export const MercenaryTankDrawer = npcDrawer({
  key: 'npc_mercenary_tank',
  look: {
    skin: 0xb08a6a, build: 'stout',
    beard: { color: 0x30241e, style: 'full' },
    hat: { kind: 'helm', color: 0x8a96a6 },
    top: { color: 0x315678, kind: 'tunic', trim: 0x5ca0c7 },
    armor: 0x8a96a6, belt: 0x4d392a, legs: 0x35404e, boots: 0x22262e,
    item: 'mace', offItem: 'shield',
  },
  work: 'ready',
  ready: { lean: 0.12, wpn: 0.6, handN: { x: 55, y: 66 }, handF: { x: 57, y: 58 }, off: 0.1 },
});

export const MercenaryMeleeDrawer = npcDrawer({
  key: 'npc_mercenary_melee',
  look: {
    skin: 0xb88a68, build: 'normal',
    hair: { color: 0x3e261d, style: 'ponytail' },
    beard: { color: 0x3e261d, style: 'stubble' },
    hat: { kind: 'headband', color: 0xd07a40 },
    top: { color: 0x8d3d37, kind: 'tunic', trim: 0xd07a40 },
    sleeves: 0x5d3826, mantle: 0x5d3826, belt: 0x5d3826, legs: 0x4c3430, boots: 0x2a1c16,
    item: 'sword', offItem: 'dagger',
  },
  work: 'ready',
  ready: { lean: 0.16, wpn: 1.3, handN: { x: 57, y: 63 }, handF: { x: 52, y: 60 }, off: 1.1 },
});

export const MercenaryRangedDrawer = npcDrawer({
  key: 'npc_mercenary_ranged',
  look: {
    skin: 0xb28866, build: 'slim',
    hair: { color: 0x342c23, style: 'braid' },
    hat: { kind: 'hood', color: 0x376443 },
    top: { color: 0x376443, kind: 'tunic', trim: 0x75b76a },
    sleeves: 0x60442c, cape: 0x2a4a32, belt: 0x60442c, legs: 0x354437, boots: 0x2a2018,
    item: 'none', offItem: 'bow',
  },
  work: 'ready',
  ready: { lean: 0.1, handF: { x: 58, y: 57 }, off: 0.05, handN: { x: 50, y: 58 } },
});

export const MercenaryHealerDrawer = npcDrawer({
  key: 'npc_mercenary_healer',
  look: {
    skin: 0xc8a288, build: 'slim',
    hair: { color: 0x624f44, style: 'bun' },
    top: { color: 0xd7d1c4, kind: 'robe', trim: 0xf1ce68 },
    mantle: 0x536a79, belt: 0x6d5845, legs: 0x536a79, boots: 0x3a3228,
    item: 'staff', offItem: 'book',
  },
  work: 'ready',
  ready: { wpn: 0.08, handN: { x: 55, y: 60 } },
  fx: (ctx, p, sk) => {
    glow(ctx, propTip(sk, p.wpn, STAFF_ORB, true, 'staff'), 4, 0xfff0a0, 0.6);
  },
});

export const MercenaryMageDrawer = npcDrawer({
  key: 'npc_mercenary_mage',
  look: {
    skin: 0xae8a86, build: 'slim',
    hair: { color: 0x30233b, style: 'long' },
    hat: { kind: 'hood', color: 0x5b3977 },
    top: { color: 0x5b3977, kind: 'robe', trim: 0x9f78dc },
    belt: 0x4d3458, legs: 0x382d52, boots: 0x241c30,
    item: 'wand', offItem: 'none',
  },
  work: 'ready',
  ready: { handN: { x: 57, y: 60 }, wpn: 0.9, handF: { x: 52, y: 62 } },
  fx: (ctx, p, sk, _act, t) => {
    glow(ctx, propTip(sk, p.wpn, 11), 3 + Math.sin(t * Math.PI * 4), 0x9f78dc, 0.7);
  },
});

export const EVENT_NPC_DRAWERS: readonly EntityDrawer[] = [
  RescueLostTravelerDrawer,
  RescueWoundedHunterDrawer,
  RescueTrappedMinerDrawer,
  RescueCaravanGuardDrawer,
  RescueAbyssExplorerDrawer,
  EscortTravelingMerchantDrawer,
  EscortWoundedExplorerDrawer,
  MercenaryTankDrawer,
  MercenaryMeleeDrawer,
  MercenaryRangedDrawer,
  MercenaryHealerDrawer,
  MercenaryMageDrawer,
];
