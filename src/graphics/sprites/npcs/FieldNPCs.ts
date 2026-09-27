// src/graphics/sprites/npcs/FieldNPCs.ts
//
// The side-quest givers who wait out in the wilds rather than in camp. Each
// gets a silhouette that reads at a glance: the swordsman's straw hat, the
// miner's pickaxe and pipe, the medium's lantern, the knight's broken plate.
import { glow, vec } from '../rig/Rig';
import { npcDrawer, propTip, STAFF_ORB } from '../rig/NpcKit';

/** 平原药师 — herbalist in a sage dress and linen apron, counting dried herbs. */
export const PlainsHerbalistDrawer = npcDrawer({
  key: 'npc_plains_herbalist',
  look: {
    skin: 0xe0b08a, build: 'slim',
    hair: { color: 0x7a4a26, style: 'bun' },
    hat: { kind: 'headband', color: 0x5f8f3a },
    top: { color: 0x6f8f4a, kind: 'tunic', trim: 0xd8c9a0 },
    apron: 0xe2d6b4, belt: 0x6a4a2a, legs: 0x4f5f3a, boots: 0x3a2a1a,
    pack: 0x8a6a3a,
    item: 'pouch', offItem: 'none',
  },
  work: 'count',
  fx: (ctx, _p, sk, _act, t) => {
    glow(ctx, vec(sk.handN.x, sk.handN.y - 2), 3.5 + Math.sin(t * Math.PI * 2) * 0.6, 0x9fe07a, 0.45);
  },
});

/** 流浪剑客 — tall wanderer in a straw hat and travel-worn indigo coat, red scarf, leaning on his sword. */
export const PlainsWandererDrawer = npcDrawer({
  key: 'npc_plains_wanderer',
  look: {
    skin: 0xc8966c, build: 'slim',
    hair: { color: 0x1e1a1e, style: 'ponytail' },
    beard: { color: 0x1e1a1e, style: 'stubble' },
    hat: { kind: 'widebrim', color: 0xc6a860, accent: 0x7a2a22 },
    top: { color: 0x2f3d5c, kind: 'coat', trim: 0x9a2a2a },
    mantle: 0x9a2a2a, belt: 0x2a1c14, legs: 0x262a36, boots: 0x1a140e,
    item: 'sword', offItem: 'none',
  },
  work: 'guard',
});

/** 森林猎人 — hunter in a feathered cap and fur mantle, bow in hand, watching the treeline. */
export const ForestTrackerDrawer = npcDrawer({
  key: 'npc_forest_tracker',
  look: {
    skin: 0xb88a62, build: 'normal',
    hair: { color: 0x5a3a1e, style: 'short' },
    beard: { color: 0x5a3a1e, style: 'short' },
    hat: { kind: 'feathered', color: 0x3d5a2a, accent: 0xc84a2a },
    top: { color: 0x6a4a2e, kind: 'vest', trim: 0x3d5a2a },
    sleeves: 0x4a5a36, mantle: 0x7a6a52, belt: 0x2a1a0e, legs: 0x3d3424, boots: 0x22180e,
    item: 'bow', offItem: 'dagger',
  },
  work: 'lookout',
});

/** 通灵巫女 — spirit medium in a pale robe with violet trim, a soul-lantern glowing in her hand. */
export const ForestSpiritMediumDrawer = npcDrawer({
  key: 'npc_forest_spirit_medium',
  look: {
    skin: 0xecc8a8, build: 'slim',
    hair: { color: 0x14101c, style: 'long' },
    hat: { kind: 'headband', color: 0x7a4aa0 },
    top: { color: 0xe8e2f0, kind: 'robe', trim: 0x7a4aa0 },
    mantle: 0x4a2f66, belt: 0x7a4aa0, legs: 0xd6cfe2, boots: 0x3a2a4a,
    item: 'lantern', offItem: 'none',
  },
  work: 'ready',
  fx: (ctx, _p, sk, _act, t) => {
    const flick = Math.sin(t * Math.PI * 4) * 0.6;
    glow(ctx, vec(sk.handN.x, sk.handN.y + 6), 7 + flick, 0xb68cff, 0.55);
    // A wisp drifting around her shoulders.
    const a = t * Math.PI * 2;
    glow(ctx, vec(sk.neck.x + Math.cos(a) * 9, sk.neck.y - 4 + Math.sin(a) * 4), 2.6, 0xd8c4ff, 0.7);
  },
});

/** 矿工老汉 — stout old miner, bald with a grey beard, leaning on his pickaxe with a pipe going. */
export const MountainMinerDrawer = npcDrawer({
  key: 'npc_mountain_miner',
  look: {
    skin: 0xc49070, build: 'stout',
    hair: { color: 0x9a9a9a, style: 'bald' },
    beard: { color: 0xb8b8b4, style: 'full' },
    hat: { kind: 'cap', color: 0x8a6a2a, accent: 0xffd27a },
    top: { color: 0x6e5a44, kind: 'vest', trim: 0x3a2e22 },
    sleeves: 0x9a7a54, apron: 0x4a3a2a, belt: 0x2a1e12, legs: 0x4a4038, boots: 0x241a10,
    item: 'pipe', offItem: 'pickaxe',
  },
  work: 'smoke',
  // Leaning on the pickaxe, its head planted beside his boot.
  ready: { handF: vec(55, 67), zF: -2, off: 2.95 },
  gesture: 'near',
});

/** 符文学者 — rune scholar in a deep blue robe and coif, reading a book whose runes glow. */
export const MountainRuneScholarDrawer = npcDrawer({
  key: 'npc_mountain_rune_scholar',
  look: {
    skin: 0xdcb08c, build: 'slim',
    hair: { color: 0x8a8a92, style: 'short' },
    beard: { color: 0x8a8a92, style: 'long' },
    hat: { kind: 'coif', color: 0x2e3f6e, accent: 0xd8a84a },
    top: { color: 0x2e3f6e, kind: 'robe', trim: 0xd8a84a },
    belt: 0xd8a84a, legs: 0x26324f, boots: 0x1a1a24,
    item: 'book', offItem: 'none',
  },
  work: 'read',
  fx: (ctx, _p, sk, _act, t) => {
    glow(ctx, vec(sk.handN.x, sk.handN.y - 3), 4 + Math.sin(t * Math.PI * 2) * 0.8, 0x6ad8ff, 0.5);
  },
});

/** 沙漠考古学家 — archaeologist in a khaki vest and wide hat, pack on his back, checking a map scroll. */
export const DesertArchaeologistDrawer = npcDrawer({
  key: 'npc_desert_archaeologist',
  look: {
    skin: 0xd2a07a, build: 'normal',
    hair: { color: 0x6a4a2a, style: 'short' },
    beard: { color: 0x6a4a2a, style: 'mustache' },
    hat: { kind: 'widebrim', color: 0xb59a6a, accent: 0x5a3a1e },
    top: { color: 0xc8b088, kind: 'vest', trim: 0x6a4a2a },
    sleeves: 0xe6dcc4, belt: 0x5a3a1e, legs: 0x8a7254, boots: 0x3a2a1a,
    pack: 0x7a5a36,
    item: 'scroll', offItem: 'pouch',
  },
  work: 'ledger',
});

/** 寻水者 — water diviner in a teal turban and sand robes, a dowsing staff whose tip drips light. */
export const DesertWaterDivinerDrawer = npcDrawer({
  key: 'npc_desert_water_diviner',
  look: {
    skin: 0xa8744e, build: 'slim',
    hair: { color: 0x1a120c, style: 'short' },
    beard: { color: 0x2a1c12, style: 'short' },
    hat: { kind: 'turban', color: 0x2f8f8a, accent: 0xd8b060 },
    top: { color: 0xd6b98a, kind: 'robe', trim: 0x2f8f8a },
    mantle: 0x2f8f8a, belt: 0x8a5a2a, legs: 0xc2a476, boots: 0x5a3a1e,
    item: 'staff', offItem: 'none',
  },
  work: 'ready',
  fx: (ctx, p, sk, _act, t) => {
    const tip = propTip(sk, p.wpn, STAFF_ORB, true, 'staff');
    glow(ctx, tip, 3.5 + Math.sin(t * Math.PI * 4) * 0.6, 0x6ac8ff, 0.65);
  },
});

/** 堕落骑士 — fallen knight in blackened plate and a torn crimson cape; embers smoulder in the cracks. */
export const AbyssFallenKnightDrawer = npcDrawer({
  key: 'npc_abyss_fallen_knight',
  look: {
    skin: 0xb49a8a, build: 'stout',
    hat: { kind: 'helm', color: 0x3a3a48, accent: 0x8a1a22 },
    top: { color: 0x2e2e3a, kind: 'tunic', trim: 0x8a1a22 },
    armor: 0x3a3a48, cape: 0x5a1a22, belt: 0x1a1418, legs: 0x2a2a34, boots: 0x16141a,
    eyes: 0xff5a3a,
    item: 'sword', offItem: 'shield',
  },
  work: 'guard',
  fx: (ctx, _p, sk, _act, t) => {
    glow(ctx, vec(sk.neck.x - 1, sk.neck.y + 7), 3 + Math.sin(t * Math.PI * 2) * 0.8, 0xff5a2a, 0.45);
  },
});

/** 虚空研究者 — void researcher in a violet-black hooded robe, notes in one hand, a humming shard in the other. */
export const AbyssVoidResearcherDrawer = npcDrawer({
  key: 'npc_abyss_void_researcher',
  look: {
    skin: 0xd8c0b0, build: 'slim',
    hair: { color: 0xd8d8e0, style: 'long' },
    hat: { kind: 'hood', color: 0x2a1f3a },
    top: { color: 0x2a1f3a, kind: 'robe', trim: 0x8a6adc },
    belt: 0x8a6adc, legs: 0x1f1830, boots: 0x14101c,
    eyes: 0xb89aff,
    item: 'wand', offItem: 'book',
  },
  work: 'read',
  fx: (ctx, p, sk, _act, t) => {
    const tip = propTip(sk, p.wpn, 11);
    glow(ctx, tip, 3.2 + Math.sin(t * Math.PI * 4), 0x9f78dc, 0.75);
  },
});

export const FIELD_NPC_DRAWERS = [
  PlainsHerbalistDrawer,
  PlainsWandererDrawer,
  ForestTrackerDrawer,
  ForestSpiritMediumDrawer,
  MountainMinerDrawer,
  MountainRuneScholarDrawer,
  DesertArchaeologistDrawer,
  DesertWaterDivinerDrawer,
  AbyssFallenKnightDrawer,
  AbyssVoidResearcherDrawer,
];
