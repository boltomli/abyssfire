// src/graphics/sprites/players/PlayerRogue.ts
//
// 影刃 — hooded shadowblade in teal and oiled leather: masked face with
// amber eyes, bandolier of throwing knives, wrapped legs, twin curved
// daggers and long scarf tails that stream behind every move.
// Rigged 3/4 view facing right.
import type { EntityDrawer, PlayerAction } from '../types';
import { PLAYER_ACTION_FRAME_COUNTS, PLAYER_TOTAL_FRAMES } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  along,
  blobPath,
  cel,
  clothChain,
  ellipsePath,
  frameTime,
  glow,
  groundShadow,
  inBone,
  lerpV,
  limb,
  polyPath,
  renderRigFrame,
  samplePoseTrack,
  smear,
  tone,
  vec,
  type Key,
  type V,
} from '../rig/Rig';
import {
  basePose,
  drawHumanoid,
  gait,
  solveSkeleton,
  spun,
  type HumanPose,
  type HumanSkin,
  type Skeleton,
} from '../rig/Humanoid';
import { getCurrentZonePalette, standardOutlineBlur } from '../../ZonePalette';

// ── Palette ─────────────────────────────────────────────────────────────
const CLOAK = tone(0x2f7064, { light: 0.3 });
const CLOAK_FAR = tone(0x1d463f, { light: 0.2 });
const LEATHER = tone(0x70492f, { light: 0.35 });
const LEATHER_FAR = tone(0x4c3121, { light: 0.2 });
const WRAP = tone(0x3d3d4a);
const WRAP_FAR = tone(0x2a2a34);
const MASK = tone(0x1f2b2e, { light: 0.25 });
const SKIN = tone(0xd9a47c, { shadow: 0.3, light: 0.25 });
const SKIN_FAR = tone(0xa97c5e, { shadow: 0.3, light: 0.15 });
const BRASS = tone(0xc0953e, { light: 0.5 });
const STEEL = tone(0xcfd8e4, { light: 0.6, shadow: 0.3 });
const POISON = 0x6dffa0;
const EYE = 0xffc24a;

const BLADE_LEN = 13;
const ROGUE_SCALE = 1.15;

// ── Skin ────────────────────────────────────────────────────────────────

function leg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, far: boolean): void {
  const wrap = far ? WRAP_FAR : WRAP;
  const leather = far ? LEATHER_FAR : LEATHER;
  limb(ctx, hip, knee, 3.6, 2.9, wrap);
  limb(ctx, knee, ankle, 2.8, 2.2, wrap);
  // Cross-strapping up the shin
  ctx.strokeStyle = leather.shade;
  ctx.lineWidth = 0.55;
  for (let i = 0; i < 3; i++) {
    const a = lerpV(knee, ankle, 0.2 + i * 0.25);
    ctx.beginPath();
    ctx.moveTo(a.x - 2.3, a.y - 0.8);
    ctx.lineTo(a.x + 2.3, a.y + 0.8);
    ctx.stroke();
  }
  cel(ctx, () => ellipsePath(ctx, vec(knee.x + 0.8, knee.y), 2.6, 2.2), leather, { band: 0.7 });
  // Soft boot
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 2.4, ankle.y - 2.6), vec(ankle.x + 1.8, ankle.y - 2.6),
    vec(sole.x + 5, sole.y - 1.2), vec(sole.x + 5.4, sole.y), vec(sole.x - 2.6, sole.y),
  ]), leather, { band: 0.8 });
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  limb(ctx, sh, el, 2.8, 2.4, far ? WRAP_FAR : WRAP);
  // Leather bracer
  limb(ctx, lerpV(el, hand, 0.1), lerpV(el, hand, 0.85), 2.6, 2.3, far ? LEATHER_FAR : LEATHER);
  ctx.strokeStyle = BRASS.shade;
  ctx.lineWidth = 0.5;
  const b = lerpV(el, hand, 0.5);
  ctx.beginPath();
  ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
  ctx.stroke();
}

function gloveHand(ctx: CanvasRenderingContext2D, at: V, far: boolean): void {
  cel(ctx, () => ellipsePath(ctx, at, 2.1, 2), far ? SKIN_FAR : SKIN, { band: 0.6, stroke: 0.4 });
  ctx.fillStyle = far ? MASK.shade : MASK.base;
  ctx.fillRect(at.x - 2, at.y - 0.4, 4, 1.2);
}

function dagger(ctx: CanvasRenderingContext2D, at: V, angle: number, far: boolean, fx: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  // Curved, leaf-shaped blade (points toward local −y)
  const blade = () => {
    ctx.moveTo(-1.2, -1.6);
    ctx.quadraticCurveTo(-2.4, -BLADE_LEN * 0.6, 0.6, -BLADE_LEN);
    ctx.quadraticCurveTo(1.6, -BLADE_LEN * 0.55, 1.2, -1.6);
    ctx.closePath();
  };
  cel(ctx, blade, far ? tone(0x9aa3b0) : STEEL, { band: 0.6, hi: 0.4 });
  if (fx > 0.05) {
    ctx.fillStyle = `rgba(109,255,160,${fx * 0.5})`;
    ctx.beginPath();
    blade();
    ctx.fill();
  }
  // Poison-green edge line
  ctx.strokeStyle = far ? 'rgba(90,200,130,0.5)' : 'rgba(120,255,170,0.75)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-1.1, -2.2);
  ctx.quadraticCurveTo(-2.1, -BLADE_LEN * 0.6, 0.5, -BLADE_LEN + 0.6);
  ctx.stroke();
  // Guard and grip
  cel(ctx, () => polyPath(ctx, [vec(-2.8, -1.8), vec(2.8, -1.8), vec(2.2, -0.6), vec(-2.2, -0.6)]), BRASS, { band: 0.4 });
  cel(ctx, () => polyPath(ctx, [vec(-0.8, -0.6), vec(0.8, -0.6), vec(0.8, 3), vec(-0.8, 3)]), LEATHER_FAR, { band: 0.3 });
  cel(ctx, () => ellipsePath(ctx, vec(0, 3.6), 1.1, 1.1), BRASS, { band: 0.3 });
  ctx.restore();
}

function scarf(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const knot = along(sk.neck, p.lean - 1.3, 3.2);
  const ph = t * Math.PI * 2;
  const tails: [number, number, typeof CLOAK][] = [[23, 0, CLOAK_FAR], [19, 1.4, CLOAK]];
  for (const [len, off, col] of tails) {
    const chain = clothChain(vec(knot.x - 1, knot.y + off), len, 6, 0.55 + p.flow * 0.8, 1.5, ph + off);
    const top: V[] = [];
    const bot: V[] = [];
    chain.forEach((pt, i) => {
      const w = 1.6 - i * 0.12;
      top.push(vec(pt.x, pt.y - w));
      bot.push(vec(pt.x, pt.y + w));
    });
    // Forked tip
    const end = chain[chain.length - 1];
    cel(ctx, () => polyPath(ctx, [...top, vec(end.x - 1.6, end.y - 1.2), vec(end.x - 0.4, end.y + 0.2), vec(end.x - 1.6, end.y + 1.6), ...bot.reverse()]), col, { band: 0.7 });
  }
}

function jerkin(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Tassets over the hips
    cel(ctx, () => polyPath(ctx, [vec(-5.4, len - 3.6), vec(6, len - 3.8), vec(6.8, len + 3.6), vec(1.6, len + 2.6), vec(-5.8, len + 3.2)]), LEATHER_FAR, { band: 0.8 });
    const body = [vec(-5.4, 0.6), vec(0.8, -0.6), vec(6, 1.6), vec(7, 6.4), vec(5.6, len - 1.2), vec(-5, len - 1.2), vec(-6, 6.6)];
    cel(ctx, () => blobPath(ctx, body), LEATHER, { band: 1.5 });
    // Stitched seams
    ctx.strokeStyle = LEATHER.shade;
    ctx.lineWidth = 0.4;
    ctx.setLineDash([0.8, 0.8]);
    ctx.beginPath();
    ctx.moveTo(2.4, 1);
    ctx.quadraticCurveTo(3.6, 6.5, 2.2, len - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Bandolier with throwing knives
    cel(ctx, () => polyPath(ctx, [vec(-4.8, 0.8), vec(-2.4, -0.2), vec(6.6, len - 3.4), vec(4.2, len - 1.8)]), MASK, { band: 0.5 });
    for (let i = 0; i < 3; i++) {
      const k = lerpV(vec(-2.2, 1.6), vec(4.4, len - 4.6), 0.2 + i * 0.3);
      cel(ctx, () => polyPath(ctx, [vec(k.x - 0.5, k.y - 2.2), vec(k.x + 0.5, k.y - 2.2), vec(k.x + 0.4, k.y + 0.6), vec(k.x - 0.4, k.y + 0.6)]), STEEL, { band: 0.2, stroke: 0.3 });
    }
    // Belt + pouch
    cel(ctx, () => polyPath(ctx, [vec(-5.4, len - 2.8), vec(6.6, len - 3), vec(6.8, len - 0.6), vec(-5.6, len - 0.4)]), LEATHER_FAR, { band: 0.4 });
    cel(ctx, () => polyPath(ctx, [vec(3.2, len - 3.2), vec(5.4, len - 3.2), vec(5.4, len - 0.2), vec(3.2, len - 0.2)]), BRASS, { band: 0.3 });
    cel(ctx, () => blobPath(ctx, [vec(-4.8, len - 1.2), vec(-1.2, len - 1.4), vec(-1, len + 2.8), vec(-4.6, len + 3)]), LEATHER, { band: 0.6 });
    // Short capelet over the shoulders
    const cape = [vec(-6.6, -0.2), vec(0, -2), vec(6.2, 0.6), vec(6.6, 4.6), vec(1, 6.2), vec(-6.8, 5)];
    cel(ctx, () => blobPath(ctx, cape), CLOAK, { band: 1.1 });
  });
}

function hood(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const sway = Math.sin(t * Math.PI * 2) * 0.4 + p.flow * 2;
  const shell = [
    vec(-6.4, 3), vec(-7, -2.8), vec(-3.4, -7.4), vec(2.4, -7.8), vec(6.6, -4.2),
    vec(7.4, 0.6), vec(6, 5.8), vec(-1.4, 6.8), vec(-7 - sway, 5.6), vec(-9.6 - sway * 1.4, 7.4), vec(-8.2 - sway, 1.8),
  ];
  cel(ctx, () => blobPath(ctx, shell), CLOAK, { band: 1.6 });
  // Face opening: shadowed brow, skin band at the eyes, mask below
  ctx.fillStyle = '#0e1416';
  ctx.beginPath();
  blobPath(ctx, [vec(0.2, -4.6), vec(5.8, -3.4), vec(7, 1.2), vec(5.6, 5), vec(0.4, 4.6)]);
  ctx.fill();
  cel(ctx, () => blobPath(ctx, [vec(1.4, -2.2), vec(6.2, -1.8), vec(7.3, 0.2), vec(6.8, 1.1), vec(1.6, 1.2)]), SKIN, { band: 0.6, stroke: 0.3 });
  cel(ctx, () => blobPath(ctx, [vec(1, 0.8), vec(7.4, 0.6), vec(7.2, 3.4), vec(5, 5.4), vec(1, 5)]), MASK, { band: 0.8, stroke: 0.4 });
  // Amber eyes
  ctx.fillStyle = '#ffd36e';
  ctx.fillRect(4, -1.3, 1.5, 0.9);
  ctx.fillRect(6.1, -1.2, 0.7, 0.8);
  ctx.restore();
}

const ROGUE_SKIN: HumanSkin = {
  prop: {
    thigh: 12, shin: 12, upperArm: 9, foreArm: 8.5,
    torso: 15, neck: 6.6, ankle: 2.2,
    hipN: vec(1.8, 0), hipF: vec(-2.2, -0.4),
    shN: vec(1.4, 3.6), shF: vec(-3.8, 3),
  },
  back(ctx, sk, p, t) {
    scarf(ctx, sk, p, t);
  },
  armFar(ctx, sk, p) {
    arm(ctx, sk.shF, sk.elF, sk.handF, true);
    dagger(ctx, sk.handF, p.off, true, p.fx);
    gloveHand(ctx, sk.handF, true);
  },
  legFar(ctx, sk) {
    leg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, true);
  },
  legNear(ctx, sk) {
    leg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, false);
  },
  torso(ctx, sk) {
    jerkin(ctx, sk);
  },
  head(ctx, sk, p, t) {
    hood(ctx, sk, p, t);
  },
  armNear(ctx, sk) {
    arm(ctx, sk.shN, sk.elN, sk.handN, false);
  },
  weapon(ctx, sk, p) {
    dagger(ctx, sk.handN, p.wpn, false, p.fx);
    gloveHand(ctx, sk.handN, false);
  },
};

// ── Animation ───────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1.5, 66.4),
  lean: 0.2,
  head: -0.14,
  footN: vec(CENTER_X + 7, GROUND_Y),
  footF: vec(CENTER_X - 7.5, GROUND_Y),
  handN: vec(CENTER_X + 9.5, 64),
  handF: vec(CENTER_X + 5.5, 57.5),
  wpn: 1.45,
  off: 0.8,
  flow: 0.15,
});

function pose(over: Partial<HumanPose>): HumanPose {
  return { ...READY, ...over };
}

const HIT = pose({
  root: vec(CENTER_X - 4.5, 67), lean: -0.2, head: -0.45,
  footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 9, GROUND_Y),
  handN: vec(CENTER_X + 3, 60), wpn: 0.9, handF: vec(CENTER_X - 1, 56), off: 0.2,
  flow: 0.5, stretch: -0.04,
});

const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.28, ease: 'out', pose: pose({
    root: vec(CENTER_X - 3.5, 67.6), lean: 0.06, head: -0.05,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 8.5, GROUND_Y),
    handN: vec(CENTER_X - 4, 55), wpn: -0.35, handF: vec(CENTER_X + 8, 60), off: 1.2,
    flow: 0.25, stretch: 0.03,
  }) },
  { at: 0.43, ease: 'in', pose: pose({
    root: vec(CENTER_X + 3, 67.6), lean: 0.42,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 11, 52), wpn: 0.6, handF: vec(CENTER_X + 6, 60), off: 1.3,
    flow: 0.5, fx: 0.7,
  }) },
  { at: 0.571, ease: 'linear', pose: pose({
    root: vec(CENTER_X + 6, 68.8), lean: 0.58, head: -0.02,
    footN: vec(CENTER_X + 15, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 20, 63.5), wpn: 2.05, handF: vec(CENTER_X + 12, 58), off: 1.45,
    flow: 0.8, fx: 1, stretch: -0.03,
  }) },
  { at: 0.71, ease: 'out', pose: pose({
    root: vec(CENTER_X + 5.5, 69), lean: 0.6,
    footN: vec(CENTER_X + 15, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    // Off-hand follow-up stab
    handN: vec(CENTER_X + 13, 71), wpn: 2.7, handF: vec(CENTER_X + 20, 59), off: 1.55,
    flow: 0.6, fx: 0.6,
  }) },
  { at: 0.86, pose: pose({ root: vec(CENTER_X + 1.5, 67.4), lean: 0.34, handN: vec(CENTER_X + 11, 66), wpn: 1.7, footN: vec(CENTER_X + 10, GROUND_Y), flow: 0.3 }) },
  { at: 1, pose: READY },
];

const CAST: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.36, ease: 'out', pose: pose({
    root: vec(CENTER_X - 2, 69.5), lean: 0.3, head: 0.02,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 8.5, GROUND_Y),
    handN: vec(CENTER_X + 6, 55), wpn: 0.35, handF: vec(CENTER_X + 5, 57), off: -0.3,
    flow: 0.3, fx: 0.9, stretch: -0.02,
  }) },
  { at: 0.5, ease: 'in', pose: pose({
    root: vec(CENTER_X + 3.5, 67.5), lean: 0.46, head: -0.05,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 19, 56), wpn: 1.5, handF: vec(CENTER_X - 3, 60), off: 0.6,
    flow: 0.7, fx: 1,
  }) },
  { at: 0.72, pose: pose({
    root: vec(CENTER_X + 3, 67.5), lean: 0.4,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 16, 58), wpn: 1.55, handF: vec(CENTER_X - 1, 60), off: 0.7,
    flow: 0.4, fx: 0.4,
  }) },
  { at: 1, pose: READY },
];

const HURT: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.33, pose: pose({ ...HIT, root: vec(CENTER_X - 5, 67.4), lean: -0.1, head: -0.3, flow: 0.4 }) },
  { at: 1, pose: READY },
];

const TUCK = (x: number, y: number, spin: number): HumanPose => pose({
  root: vec(x, y), spin, pivot: 0.5, lean: 0.75, head: 0.5,
  footN: vec(x + 5, y + 10), footF: vec(x + 2.5, y + 10.5),
  handN: vec(x + 6, y - 1), wpn: 2.4, handF: vec(x + 5, y - 4), off: 2.2,
  flow: 0.85, stretch: -0.08,
});

const DODGE: Key<HumanPose>[] = [
  { at: 0, pose: pose({
    root: vec(CENTER_X, 71.5), pivot: 0.5, lean: 0.6, head: 0.2,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 9, 70), wpn: 2, handF: vec(CENTER_X + 7, 66), off: 1.8, flow: 0.4,
  }) },
  { at: 0.2, pose: TUCK(CENTER_X - 1, 72, 1.4) },
  { at: 0.4, ease: 'linear', pose: TUCK(CENTER_X, 70.5, 3) },
  { at: 0.6, ease: 'linear', pose: TUCK(CENTER_X + 0.5, 71.5, 4.6) },
  { at: 0.8, pose: pose({
    root: vec(CENTER_X + 1.5, 70), spin: 6.05, pivot: 0.5, lean: 0.45, head: 0,
    footN: vec(CENTER_X + 9, GROUND_Y), footF: vec(CENTER_X - 5, GROUND_Y),
    handN: vec(CENTER_X + 10, 66), wpn: 1.7, handF: vec(CENTER_X + 6, 60), off: 1.1, flow: 0.5,
  }) },
  { at: 1, pose: { ...READY, spin: Math.PI * 2, pivot: 0.5 } },
];

const DEATH: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.22, pose: pose({ ...HIT, root: vec(CENTER_X - 5, 70), lean: -0.05, head: 0.1, handN: vec(CENTER_X + 2, 66), wpn: 2.2 }) },
  { at: 0.45, pose: pose({
    root: vec(CENTER_X - 3, 76), lean: 0.12, head: 0.35,
    footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 7, 86),
    handN: vec(CENTER_X + 4, 79), wpn: 2.8, handF: vec(CENTER_X, 76), off: 2.4, flow: 0.25,
  }) },
  { at: 0.72, ease: 'in', pose: pose({
    root: vec(CENTER_X - 3, 82), spin: -0.95, lean: -0.1, head: -0.3,
    footN: vec(CENTER_X + 3, 103), footF: vec(CENTER_X - 2, 102),
    handN: vec(CENTER_X + 5, 76), wpn: 2.4, handF: vec(CENTER_X - 2, 74), off: 2.4, flow: 0.6,
  }) },
  { at: 1, ease: 'out', pose: pose({
    root: vec(CENTER_X - 1, 86.5), spin: -1.52, lean: 0, head: -0.2,
    footN: vec(CENTER_X + 1.5, 110.5), footF: vec(CENTER_X - 1, 110),
    handN: vec(CENTER_X + 5, 80), wpn: 3.1, handF: vec(CENTER_X - 3, 78), off: 3, flow: 0.08,
  }) },
];

function idlePose(t: number): HumanPose {
  const ph = t * Math.PI * 2;
  const b = Math.sin(ph);
  return pose({
    // Light on the feet: a small bounce rather than a heavy breath.
    root: vec(READY.root.x + Math.sin(ph) * 0.3, READY.root.y + Math.abs(b) * -0.6 + 0.3),
    stretch: b * -0.01,
    head: READY.head + Math.sin(ph - 0.5) * 0.04,
    handN: vec(READY.handN.x, READY.handN.y + Math.sin(ph - 0.3) * 0.5),
    handF: vec(READY.handF.x, READY.handF.y + Math.sin(ph - 0.8) * 0.6),
    wpn: READY.wpn + Math.sin(ph) * 0.04,
    off: READY.off + Math.sin(ph - 0.6) * 0.05,
    flow: 0.15 + Math.sin(ph) * 0.07,
  });
}

function walkPose(t: number): HumanPose {
  const g = gait(t, { stride: 7.8, lift: 5, bob: 1.2, rootY: 66.2, footSpread: 1 });
  const ph = t * Math.PI * 2;
  return pose({
    root: vec(CENTER_X, g.rootY),
    lean: 0.26,
    head: -0.16,
    footN: g.footN,
    footF: g.footF,
    handN: vec(CENTER_X + 9 - g.swing * 4, 64 + Math.abs(g.swing) * 0.5),
    wpn: 1.5 - g.swing * 0.15,
    handF: vec(CENTER_X + 5 + g.swing * 3, 59),
    off: 0.9 + g.swing * 0.1,
    flow: 0.5 + Math.sin(ph * 2) * 0.1,
  });
}

function roguePose(act: PlayerAction, t: number): HumanPose {
  switch (act) {
    case 'idle': return idlePose(t);
    case 'walk': return walkPose(t);
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'cast': return samplePoseTrack(CAST, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'dodge': return samplePoseTrack(DODGE, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

function drawFx(ctx: CanvasRenderingContext2D, act: PlayerAction, t: number, p: HumanPose): void {
  const sk = solveSkeleton(p, ROGUE_SKIN.prop);
  if (act === 'attack' && p.fx > 0.3) {
    for (const which of ['n', 'f'] as const) {
      const tips: V[] = [];
      const bases: V[] = [];
      for (let i = 6; i >= 0; i--) {
        const sp = samplePoseTrack(ATTACK, Math.max(0, t - i * 0.02));
        const ssk = solveSkeleton(sp, ROGUE_SKIN.prop);
        const hand = which === 'n' ? ssk.handN : ssk.handF;
        const ang = which === 'n' ? sp.wpn : sp.off;
        tips.push(spun(sp, along(hand, ang, BLADE_LEN), ssk));
        bases.push(spun(sp, along(hand, ang, 3), ssk));
      }
      smear(ctx, tips, bases, which === 'n' ? 0xd8ffe8 : POISON, (which === 'n' ? 0.55 : 0.35) * p.fx);
    }
  }
  if (act === 'cast' && p.fx > 0.05) {
    for (const hand of [sk.handN, sk.handF]) {
      glow(ctx, spun(p, hand, sk), 4 + p.fx * 4, POISON, 0.5 * p.fx);
    }
    // Wisps of shadow rising off the body
    for (let i = 0; i < 5; i++) {
      const k = (i / 5 + t * 1.3) % 1;
      glow(ctx, vec(p.root.x - 4 + i * 2.5, p.root.y + 8 - k * 26), 2.2, 0x2fd6a0, 0.45 * p.fx * (1 - k));
    }
  }
  const eye = spun(p, along(sk.head, sk.headAng + 1.4, 5), sk);
  if (act !== 'death' || t < 0.6) glow(ctx, eye, 2.2, EYE, 0.45);
}

export const PlayerRogueDrawer: EntityDrawer = {
  key: 'player_rogue',
  // Wide frame leaves room for weapon reach at the contact pose.
  frameW: 96,
  frameH: 96,
  totalFrames: PLAYER_TOTAL_FRAMES,

  drawFrame(ctx, frame, action, w, h) {
    const act = action as PlayerAction;
    const count = PLAYER_ACTION_FRAME_COUNTS[act];
    const loop = act === 'idle' || act === 'walk';
    const t = frameTime(frame % count, count, loop);
    const p = roguePose(act, t);
    const palette = getCurrentZonePalette();
    const lift = Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y));
    renderRigFrame(
      ctx, w, h,
      c => { drawHumanoid(c, p, ROGUE_SKIN, t); },
      { glowColor: palette.playerOutlineColor, glowBlur: standardOutlineBlur(w, h), scale: ROGUE_SCALE },
      c => groundShadow(c, p.root.x + 1, 13, lift),
      c => drawFx(c, act, t, p),
    );
  },
};
