// src/graphics/sprites/monsters/GoblinShaman.ts
//
// 哥布林萨满 — the tribe's hunched spirit-caller: a cracked bird-skull mask
// with a feather headdress, a mangy fur shawl over a hide skirt hung with
// bone charms, and a gnarled totem staff crowned with a horned skull that
// burns with green spirit-fire. Raises the totem and hurls the fire.
import {
  CENTER_X,
  GROUND_Y,
  along,
  blobPath,
  cel,
  ellipsePath,
  glow,
  inBone,
  lerpV,
  polyPath,
  tone,
  vec,
  type V,
} from '../rig/Rig';
import { basePose, spun, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster, humanoidTracks, type HumanoidMonsterSpec } from '../rig/MonsterKit';
import { goblinArm, goblinHand, goblinHead, goblinLeg, type GoblinLook } from './Goblin';

const LOOK: GoblinLook = {
  skin: tone(0x6f9c46, { light: 0.34 }),
  skinFar: tone(0x48692c, { light: 0.2 }),
  cloth: tone(0x5a4630),
  strap: tone(0x3e2c1c),
};

const BONE = tone(0xece2c6, { light: 0.4, shadow: 0.3 });
const FUR = tone(0x8a7a64, { light: 0.35 });
const FUR_DARK = tone(0x5a4c3e);
const HIDE = tone(0x7a5634, { light: 0.3 });
const HIDE_DARK = tone(0x543820);
const WOOD = tone(0x6a4a2a, { light: 0.3 });
const WOOD_DARK = tone(0x4a321c);
const FEATHER_RED = tone(0xc8402e, { light: 0.35 });
const FEATHER_TEAL = tone(0x2f9c8e, { light: 0.35 });
const FEATHER_CREAM = tone(0xe8dcb4, { light: 0.35 });
const GEM = tone(0x4dff88, { light: 0.6, shadow: 0.3 });
const SPIRIT = 0x4dff7a;
const SPIRIT_HOT = 0xd4ffb0;

const STAFF_UP = 21;
const STAFF_DOWN = 12;

/** Head-local point → sprite space. */
function headPt(sk: Skeleton, l: V): V {
  const c = Math.cos(sk.headAng);
  const s = Math.sin(sk.headAng);
  return vec(sk.head.x + l.x * c - l.y * s, sk.head.y + l.x * s + l.y * c);
}

function feather(ctx: CanvasRenderingContext2D, root: V, ang: number, len: number, w: number, t: ReturnType<typeof tone>): void {
  ctx.save();
  ctx.translate(root.x, root.y);
  ctx.rotate(ang);
  cel(ctx, () => {
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(w, -len * 0.45, 0, -len);
    ctx.quadraticCurveTo(-w, -len * 0.45, 0, 0);
    ctx.closePath();
  }, t, { band: 0.5, stroke: 0.4 });
  ctx.strokeStyle = t.shade;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(0, -0.5);
  ctx.lineTo(0, -len * 0.92);
  ctx.stroke();
  // Dark barred tip
  ctx.fillStyle = 'rgba(30,20,20,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, -len * 0.82, w * 0.55, len * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function headdress(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number, back: boolean): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const sway = Math.sin(t * Math.PI * 2 + 0.5) * 0.06 - p.flow * 0.25;
  if (back) {
    // Feather fan behind the head
    const set: [number, number, ReturnType<typeof tone>][] = [
      [-1.75, 12, FEATHER_TEAL], [-1.35, 13.5, FEATHER_RED], [-0.95, 12.5, FEATHER_CREAM], [-0.55, 11, FEATHER_RED],
    ];
    set.forEach(([a, len, tn], i) => feather(ctx, vec(-2 + i * 0.8, -5.5), a + sway * (1 + i * 0.2), len, 2.2, tn));
  } else {
    // Beaded band across the brow
    cel(ctx, () => polyPath(ctx, [vec(-5.8, -5.6), vec(1, -7.8), vec(1.6, -6.2), vec(-5.4, -3.8)]), HIDE, { band: 0.4 });
    ctx.fillStyle = '#d24a2a';
    ctx.beginPath();
    ctx.arc(-3.2, -5.6, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3fbfae';
    ctx.beginPath();
    ctx.arc(-1, -6.4, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Cracked bird-skull mask covering the brow and nose, beak jutting forward. */
function mask(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const shape = [vec(-0.6, -6.8), vec(4, -8.2), vec(8.2, -5.8), vec(9.8, -2.4), vec(13.6, 0.8), vec(9.4, 2.4), vec(6.2, 1.6), vec(1.2, 1.2), vec(-1.2, -2.2)];
  cel(ctx, () => blobPath(ctx, shape), BONE, { band: 1.2 });
  // Beak ridge
  ctx.strokeStyle = BONE.shade;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(8.4, -2.8);
  ctx.quadraticCurveTo(11, -0.8, 13.2, 0.8);
  ctx.stroke();
  // Eye hole with a green ember
  ctx.fillStyle = '#10180c';
  ctx.beginPath();
  ctx.ellipse(4.8, -2.2, 1.9, 1.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(190,255,190,${0.8 + p.fx * 0.2})`;
  ctx.fillRect(4.6, -2.6, 1.2, 0.9);
  // War-paint stripe and a crack
  ctx.strokeStyle = 'rgba(190,40,30,0.9)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(1.6, -7.4);
  ctx.lineTo(2.6, -0.4);
  ctx.stroke();
  ctx.strokeStyle = BONE.line;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(6.4, -7.2);
  ctx.lineTo(6, -5.2);
  ctx.lineTo(7, -4.4);
  ctx.stroke();
  ctx.restore();
}

function shamanTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, t: number): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    const body = [vec(-4.8, 0.4), vec(1, -0.6), vec(5, 1.8), vec(6.8, len * 0.6), vec(5, len + 0.6), vec(-4, len + 0.8), vec(-5.6, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), LOOK.skin, { band: 1.5 });
    // Painted spiral on the belly
    ctx.strokeStyle = 'rgba(240,240,220,0.75)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(3, len * 0.62, 1.8, 0.2, Math.PI * 1.7);
    ctx.stroke();
    // Belt with pouch and a dangling bone charm
    cel(ctx, () => polyPath(ctx, [vec(-5, len - 1.2), vec(6.2, len - 1.8), vec(6.4, len + 0.6), vec(-5, len + 1)]), LOOK.strap, { band: 0.4 });
    cel(ctx, () => blobPath(ctx, [vec(-3.6, len - 0.4), vec(-0.4, len - 0.6), vec(-0.2, len + 3), vec(-3.4, len + 3.2)]), HIDE_DARK, { band: 0.5 });
    const sw = Math.sin(t * Math.PI * 2) * 0.6;
    ctx.strokeStyle = LOOK.strap.base;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(4.4, len);
    ctx.lineTo(4.4 + sw, len + 3);
    ctx.stroke();
    cel(ctx, () => polyPath(ctx, [vec(3.6 + sw, len + 2.8), vec(5.2 + sw, len + 2.8), vec(4.4 + sw, len + 5.8)]), BONE, { band: 0.3, stroke: 0.3 });
    // Mangy fur shawl with ragged fringe
    const shawl = [vec(-7.4, 1), vec(-2.6, -2.4), vec(3.6, -1.8), vec(7.6, 1.6), vec(7, 6), vec(5, 7.6), vec(3, 6.4), vec(1, 8.2), vec(-1.4, 6.6), vec(-3.8, 8), vec(-6, 6.2), vec(-8.4, 5)];
    cel(ctx, () => blobPath(ctx, shawl), FUR, { band: 1.2 });
    ctx.strokeStyle = FUR_DARK.base;
    ctx.lineWidth = 0.45;
    for (let i = 0; i < 5; i++) {
      const x = -6 + i * 3;
      ctx.beginPath();
      ctx.moveTo(x, 3.6);
      ctx.lineTo(x + 0.5, 5.8);
      ctx.stroke();
    }
    // Tooth necklace with a spirit-stone
    for (let i = 0; i < 5; i++) {
      const b = lerpV(vec(-1.6, 5.6), vec(5.8, 6.6), i / 4);
      cel(ctx, () => polyPath(ctx, [vec(b.x - 0.5, b.y), vec(b.x + 0.5, b.y), vec(b.x, b.y + 1.9)]), BONE, { band: 0.2, stroke: 0.3 });
    }
    cel(ctx, () => polyPath(ctx, [vec(2.2, 6.6), vec(3.4, 5.8), vec(4.4, 7.2), vec(3.2, 9)]), GEM, { band: 0.4, stroke: 0.4 });
  });
}

/** Hide skirt hung from the waist, draped over the thighs. */
function skirt(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const waist = along(sk.pelvis, p.lean * 0.4, 1.4);
  const ph = t * Math.PI * 2;
  const knees = [sk.kneeN, sk.kneeF];
  const back = Math.min(knees[0].x, knees[1].x, waist.x - 4) - 2.5 - p.flow * 3;
  const front = Math.max(knees[0].x, knees[1].x, waist.x + 4) + 2.2 - p.flow;
  const hem = Math.max(knees[0].y, knees[1].y) + 1.8;
  const w = Math.sin(ph * 2) * 0.6;
  const pts = [
    vec(waist.x - 5.2, waist.y - 0.6), vec(waist.x + 5.8, waist.y - 1),
    vec(front + 0.6, hem - 3), vec(front, hem + w * 0.5), vec(front - 2.6, hem - 1.2),
    vec((front + back) / 2 + 0.6, hem + 1 - w), vec((front + back) / 2 - 2.4, hem - 0.8),
    vec(back + 1.6, hem + 0.6 + w), vec(back, hem - 2),
  ];
  cel(ctx, () => polyPath(ctx, pts), HIDE, { band: 1.2 });
  // Stitched seam and tassels
  ctx.strokeStyle = HIDE_DARK.base;
  ctx.lineWidth = 0.45;
  ctx.setLineDash([0.8, 0.8]);
  ctx.beginPath();
  ctx.moveTo(waist.x + 1.8, waist.y);
  ctx.lineTo((front + back) / 2 + 0.8, hem - 0.4);
  ctx.stroke();
  ctx.setLineDash([]);
}

function totem(ctx: CanvasRenderingContext2D, at: V, angle: number, t: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  // Gnarled shaft
  cel(ctx, () => {
    ctx.moveTo(-0.8, STAFF_DOWN);
    ctx.quadraticCurveTo(-1.8, 2, -0.9, -STAFF_UP + 2);
    ctx.lineTo(1, -STAFF_UP + 2);
    ctx.quadraticCurveTo(0.2, 2, 0.8, STAFF_DOWN);
    ctx.closePath();
  }, WOOD, { band: 0.5, hi: 0.3 });
  // Knot and leather wraps
  cel(ctx, () => ellipsePath(ctx, vec(-1, -6), 1.2, 1.5), WOOD_DARK, { band: 0.3, stroke: 0.3 });
  for (const y of [-STAFF_UP + 4, -STAFF_UP + 6.2]) {
    cel(ctx, () => polyPath(ctx, [vec(-1.4, y), vec(1.4, y - 0.4), vec(1.4, y + 1.1), vec(-1.4, y + 1.4)]), HIDE_DARK, { band: 0.3, stroke: 0.3 });
  }
  // Dangling feathers from the head
  const sw = Math.sin(t * Math.PI * 2 + 1) * 0.25;
  ctx.strokeStyle = HIDE_DARK.base;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-1.2, -STAFF_UP + 4.5);
  ctx.lineTo(-3 + sw * 4, -STAFF_UP + 9);
  ctx.stroke();
  feather(ctx, vec(-3 + sw * 4, -STAFF_UP + 9), Math.PI - 0.15 + sw, 6.5, 1.5, FEATHER_RED);
  feather(ctx, vec(-2.4 + sw * 4, -STAFF_UP + 9), Math.PI + 0.25 + sw, 5.5, 1.4, FEATHER_TEAL);
  // Horned skull crowning the staff
  const y = -STAFF_UP;
  for (const side of [-1, 1]) {
    cel(ctx, () => {
      ctx.moveTo(side * 1.4, y - 1.6);
      ctx.quadraticCurveTo(side * 6.6, y - 2.4, side * 4.4, y - 8.4);
      ctx.lineTo(side * 3.8, y - 7.6);
      ctx.quadraticCurveTo(side * 4.8, y - 3.6, side * 0.6, y - 0.2);
      ctx.closePath();
    }, BONE, { band: 0.4, stroke: 0.4 });
  }
  cel(ctx, () => blobPath(ctx, [vec(-2.8, y - 1), vec(-2.4, y - 4.4), vec(0.6, y - 5.2), vec(3, y - 3.4), vec(2.8, y + 0.2), vec(1.4, y + 1.8), vec(-1.6, y + 1.8)]), BONE, { band: 0.7, stroke: 0.45 });
  ctx.fillStyle = '#14200e';
  ctx.beginPath();
  ctx.ellipse(-0.8, y - 1.8, 0.9, 1, 0, 0, Math.PI * 2);
  ctx.ellipse(1.6, y - 1.8, 0.9, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8ffc0';
  ctx.fillRect(-1.1, y - 2.1, 0.6, 0.6);
  ctx.fillRect(1.3, y - 2.1, 0.6, 0.6);
  ctx.restore();
}

function flamePoint(hand: V, wpn: number): V {
  return along(hand, wpn, STAFF_UP + 6.5);
}

/** Flickering spirit-fire tongue, drawn additive over the inked body. */
function spiritFlame(ctx: CanvasRenderingContext2D, base: V, size: number, t: number, lean: number): void {
  const flick = Math.sin(t * Math.PI * 6) * 0.8;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [k, col] of [[1, 'rgba(60,220,110,0.55)'], [0.62, 'rgba(150,255,170,0.7)'], [0.32, 'rgba(235,255,220,0.85)']] as const) {
    const h = size * 2.2 * k;
    const w = size * 0.8 * k;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(base.x - w, base.y + w * 0.4);
    ctx.quadraticCurveTo(base.x - w * 1.1, base.y - h * 0.5, base.x - lean * h * 0.5 + flick * k, base.y - h);
    ctx.quadraticCurveTo(base.x + w * 1.2, base.y - h * 0.4, base.x + w, base.y + w * 0.4);
    ctx.quadraticCurveTo(base.x, base.y + w, base.x - w, base.y + w * 0.4);
    ctx.fill();
  }
  ctx.restore();
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 9, shin: 9, upperArm: 8.4, foreArm: 8,
    torso: 13, neck: 6.2, ankle: 1.6,
    hipN: vec(1.6, 0), hipF: vec(-2, -0.4),
    shN: vec(1, 3), shF: vec(-3.2, 2.6),
  },
  back(ctx, sk, p, t) {
    headdress(ctx, sk, p, t, true);
  },
  armFar(ctx, sk) {
    goblinArm(ctx, sk.shF, sk.elF, sk.handF, LOOK.skinFar);
    goblinHand(ctx, sk.handF, LOOK.skinFar);
  },
  legFar(ctx, sk) {
    goblinLeg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, LOOK.skinFar);
  },
  legNear(ctx, sk, p, t) {
    goblinLeg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, LOOK.skin);
    skirt(ctx, sk, p, t);
  },
  torso(ctx, sk, _p, t) {
    shamanTorso(ctx, sk, t);
  },
  head(ctx, sk, p, t) {
    goblinHead(ctx, sk, p, t, LOOK, 0.6);
    mask(ctx, sk, p);
    headdress(ctx, sk, p, t, false);
  },
  armNear(ctx, sk) {
    goblinArm(ctx, sk.shN, sk.elN, sk.handN, LOOK.skin);
    // Bone bracer
    const a = lerpV(sk.elN, sk.handN, 0.35);
    const b = lerpV(sk.elN, sk.handN, 0.7);
    cel(ctx, () => { ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, 2.2, 0, Math.PI * 2); }, BONE, { band: 0.4, stroke: 0.35 });
    cel(ctx, () => { ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); }, BONE, { band: 0.4, stroke: 0.35 });
  },
  weapon(ctx, sk, p, t) {
    totem(ctx, sk.handN, p.wpn, t);
    goblinHand(ctx, sk.handN, LOOK.skin);
  },
};

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 2, 73.5),
  lean: 0.3,
  head: -0.26,
  footN: vec(CENTER_X + 4.5, GROUND_Y),
  footF: vec(CENTER_X - 6, GROUND_Y),
  handN: vec(CENTER_X + 15.5, 72),
  handF: vec(CENTER_X + 5, 71),
  wpn: 0.15,
  flow: 0.1,
});

const SPEC: HumanoidMonsterSpec = {
  key: 'monster_goblin_shaman',
  // Wider than the old 52 so the thrust totem and its flame stay in frame.
  frameW: 80,
  frameH: 60,
  scale: 1.36,
  skin: SKIN,
  ready: READY,
  attack: 'cast',
  contactWpn: 0.9,
  walk: { stride: 5, lift: 3, bob: 1.2, lean: 0.05, armSwing: 1.8 },
  shadowR: 11,
};

const GEN = humanoidTracks(SPEC);
const R = (o: Partial<HumanPose>): HumanPose => ({ ...READY, ...o });

/** Draws the totem back past the shoulder, sweeps it up, thrusts the fire. */
const ATTACK = [
  { at: 0, pose: READY },
  { at: 0.33, ease: 'out' as const, pose: R({ root: vec(CENTER_X - 3.5, 74), lean: 0.1, head: -0.35, handN: vec(CENTER_X + 6, 59), wpn: -0.35, handF: vec(CENTER_X + 1, 64), fx: 0.8, stretch: 0.04 }) },
  { at: 0.67, ease: 'in' as const, pose: R({ root: vec(CENTER_X - 1.5, 74), lean: 0.28, head: -0.3, handN: vec(CENTER_X + 10, 58), wpn: 0.45, handF: vec(CENTER_X + 6, 64), fx: 0.9 }) },
  GEN.attack[3],
];

export const GoblinShamanDrawer = humanoidMonster({
  ...SPEC,
  tracks: { attack: ATTACK },
  fx: (ctx, p, sk, act, t) => {
    const live = act === 'death' ? Math.max(0, 1 - t * 1.4) : 1;
    if (live <= 0) return;
    const S = (pt: V): V => spun(p, pt, sk);
    // Mask eye ember
    glow(ctx, S(headPt(sk, vec(5.2, -2.2))), 2.4 + p.fx, SPIRIT, (0.45 + p.fx * 0.3) * live);
    // Spirit-stone pulse
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
    const stone = S(lerpV(sk.neck, sk.pelvis, 0.52));
    glow(ctx, vec(stone.x + 3, stone.y), 2.4 + pulse, SPIRIT, 0.3 * live);
    // Spirit-fire on the totem, flaring with the cast
    const fp = S(flamePoint(sk.handN, p.wpn));
    const size = 2.2 + p.fx * 2.2;
    glow(ctx, fp, 6 + p.fx * 7, SPIRIT, (0.35 + p.fx * 0.35) * live);
    ctx.save();
    ctx.globalAlpha = live;
    spiritFlame(ctx, vec(fp.x, fp.y + 2.5), size, t, act === 'walk' ? 0.4 : p.flow * 0.6);
    ctx.restore();
    glow(ctx, fp, 2 + p.fx * 2, SPIRIT_HOT, (0.6 + p.fx * 0.3) * live);
    if (act === 'attack' && p.fx > 0.5) {
      // Off-hand flame, orbiting spirit motes and a rune ring at the feet
      const palm = S(sk.handF);
      glow(ctx, palm, 3 + p.fx * 4, SPIRIT, 0.55 * p.fx);
      for (let i = 0; i < 5; i++) {
        const a = t * 10 + i * (Math.PI * 2 / 5);
        glow(ctx, vec(fp.x + Math.cos(a) * 6, fp.y + Math.sin(a) * 3), 1.5, SPIRIT_HOT, 0.85 * p.fx);
      }
      ctx.save();
      ctx.globalAlpha = 0.7 * p.fx;
      ctx.strokeStyle = '#7dffa0';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(p.root.x + 1, GROUND_Y, 11 + p.fx * 3, 3.2 + p.fx, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([1.4, 1.8]);
      ctx.beginPath();
      ctx.ellipse(p.root.x + 1, GROUND_Y, 8, 2.3, 0, t * 6, t * 6 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (act === 'attack' && t >= 0.99) {
      // Released bolt of spirit-fire leaving the totem
      const tip = S(along(sk.handN, p.wpn, STAFF_UP + 10));
      glow(ctx, tip, 7, SPIRIT, 0.7);
      glow(ctx, tip, 3, SPIRIT_HOT, 0.9);
    }
  },
});
