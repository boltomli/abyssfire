// src/graphics/sprites/players/PlayerWarrior.ts
//
// 渊火骑士 — plate-armoured knight in a crimson tabard and cape, plumed great
// helm with an ember-lit visor, broadsword and heater shield. Rigged 3/4
// view facing right; every action is keyframed on the shared humanoid rig.
import type { EntityDrawer, PlayerAction } from '../types';
import { PLAYER_ACTION_FRAME_COUNTS, PLAYER_TOTAL_FRAMES } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  along,
  blobPath,
  capsulePath,
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
const STEEL = tone(0x9aa6ba, { light: 0.45 });
const STEEL_FAR = tone(0x6c7688, { light: 0.25 });
const IRON = tone(0x4b5366);
const IRON_FAR = tone(0x363c4b);
const GOLD = tone(0xd9a640, { light: 0.5 });
const CRIMSON = tone(0xa82230);
const CRIMSON_IN = tone(0x62131d, { light: 0.15 });
const LEATHER = tone(0x5e3a22);
const BLADE = tone(0xc9d3e2, { light: 0.6, shadow: 0.3 });
const EMBER = 0xff8a2a;

const BLADE_LEN = 27;
/** Figure size within the 96-unit frame. */
const WARRIOR_SCALE = 1.18;

// ── Skin ────────────────────────────────────────────────────────────────

function sabaton(ctx: CanvasRenderingContext2D, ankle: V, sole: V, t: typeof STEEL): void {
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 3, ankle.y - 1.5),
    vec(ankle.x + 2.2, ankle.y - 2.2),
    vec(sole.x + 6.5, sole.y - 1.6),
    vec(sole.x + 6.8, sole.y),
    vec(sole.x - 3.2, sole.y),
  ]), t, { band: 1 });
}

function leg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, far: boolean): void {
  const plate = far ? STEEL_FAR : STEEL;
  const under = far ? IRON_FAR : IRON;
  limb(ctx, hip, knee, 4.3, 3.6, under);
  // Cuisse plate over the front of the thigh
  cel(ctx, () => capsulePath(ctx, lerpV(hip, knee, 0.15), lerpV(hip, knee, 0.85), 3.8, 3.1), plate, { band: 1.2 });
  limb(ctx, knee, ankle, 3.4, 2.6, plate);
  // Knee cop: steel poleyn with a gold rivet
  cel(ctx, () => ellipsePath(ctx, vec(knee.x + 0.9, knee.y), 3, 2.5), plate, { band: 0.9 });
  ctx.fillStyle = far ? GOLD.shade : GOLD.base;
  ctx.fillRect(knee.x + 0.4, knee.y - 0.5, 1.1, 1.1);
  sabaton(ctx, ankle, sole, plate);
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const plate = far ? STEEL_FAR : STEEL;
  const under = far ? IRON_FAR : IRON;
  limb(ctx, sh, el, 3.4, 3, under);
  limb(ctx, lerpV(sh, el, 0.35), el, 3.2, 2.9, plate);
  limb(ctx, el, hand, 3, 2.6, plate);
  cel(ctx, () => ellipsePath(ctx, el, 2.4, 2.4), under, { band: 0.7 });
}

function fist(ctx: CanvasRenderingContext2D, hand: V, far: boolean): void {
  cel(ctx, () => ellipsePath(ctx, hand, 2.8, 2.6), far ? IRON_FAR : IRON, { band: 0.9 });
  ctx.fillStyle = far ? STEEL_FAR.light : STEEL.light;
  ctx.fillRect(hand.x - 1.6, hand.y - 1.8, 2.6, 0.9);
}

function pauldron(ctx: CanvasRenderingContext2D, sh: V, lean: number, far: boolean): void {
  const plate = far ? STEEL_FAR : STEEL;
  ctx.save();
  ctx.translate(sh.x, sh.y);
  ctx.rotate(lean * 0.6);
  // Three layered lames, top one biggest.
  for (let i = 2; i >= 0; i--) {
    const y = i * 2.4;
    cel(ctx, () => ellipsePath(ctx, vec(0.3, y), 5.6 - i * 0.7, 3.6 - i * 0.4), i === 0 ? plate : (far ? IRON_FAR : IRON), { band: 1 });
  }
  ctx.strokeStyle = GOLD.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0.3, 0, 5.2, 3.2, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  ctx.restore();
}

function cape(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const anchor = along(sk.neck, p.lean - 1.45, 4.2);
  const chain = clothChain(vec(anchor.x, anchor.y + 1.5), 25, 6, p.flow, 1, t * Math.PI * 2);
  const left: V[] = [];
  const right: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    const half = 3 + k * 4.5;
    left.push(vec(pt.x - half * 0.9, pt.y));
    right.push(vec(pt.x + half * 0.6, pt.y + k * 0.8));
  });
  const outline = [...left, ...right.reverse()];
  cel(ctx, () => blobPath(ctx, outline), CRIMSON_IN, { band: 1.4 });
  // Gold hem along the bottom
  const a = left[left.length - 1];
  const b = right[0];
  ctx.strokeStyle = GOLD.shade;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - 0.8);
  ctx.lineTo(b.x, b.y - 0.8);
  ctx.stroke();
}

function tabard(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number, front: boolean): void {
  const belt = along(sk.pelvis, p.lean, 1.5);
  const sway = Math.sin(t * Math.PI * 2) * 0.6 - p.flow * 3;
  if (front) {
    const top = vec(belt.x + 3.2, belt.y);
    const pts = [
      vec(top.x - 3.4, top.y),
      vec(top.x + 3.6, top.y),
      vec(top.x + 3.8 + sway * 0.5, top.y + 13),
      vec(top.x + 0.2 + sway, top.y + 15.5),
      vec(top.x - 3.4 + sway * 0.7, top.y + 13.5),
    ];
    cel(ctx, () => polyPath(ctx, pts), CRIMSON, { band: 1.1 });
    ctx.strokeStyle = GOLD.base;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(pts[2].x - 0.4, pts[2].y - 0.8);
    ctx.lineTo(pts[3].x, pts[3].y - 1);
    ctx.lineTo(pts[4].x + 0.4, pts[4].y - 0.8);
    ctx.stroke();
  } else {
    const top = vec(belt.x - 3, belt.y);
    cel(ctx, () => polyPath(ctx, [
      vec(top.x - 3, top.y),
      vec(top.x + 2.5, top.y),
      vec(top.x + 2 + sway, top.y + 13),
      vec(top.x - 3.8 + sway * 1.2, top.y + 12),
    ]), CRIMSON_IN, { band: 1 });
  }
}

function cuirass(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Mail skirt under the plate
    cel(ctx, () => polyPath(ctx, [
      vec(-6.5, len - 5), vec(6.8, len - 5), vec(7.8, len + 3.2), vec(-7, len + 3.4),
    ]), IRON, { band: 1 });
    ctx.strokeStyle = IRON.shade;
    ctx.lineWidth = 0.35;
    for (let y = len - 3; y < len + 3; y += 1.3) {
      ctx.beginPath();
      ctx.moveTo(-6.5, y);
      ctx.lineTo(7.3, y + 0.2);
      ctx.stroke();
    }
    // Breastplate — pigeon chest, narrowing waist
    const chest = [
      vec(-6.8, 0.5), vec(0, -1), vec(7.2, 1.8), vec(9, 7.5),
      vec(6.8, len - 3), vec(-5.6, len - 3), vec(-7.6, 7),
    ];
    cel(ctx, () => blobPath(ctx, chest), STEEL, { band: 1.8, hi: 0.8 });
    // Central ridge highlight
    ctx.strokeStyle = STEEL.light;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(4.2, 1.5);
    ctx.quadraticCurveTo(6.6, 7, 4.4, len - 4);
    ctx.stroke();
    // Gold-trimmed fauld
    cel(ctx, () => polyPath(ctx, [vec(-6, len - 4.2), vec(7.2, len - 4.2), vec(7.6, len - 1.8), vec(-6.2, len - 1.8)]), IRON, { band: 0.7 });
    ctx.fillStyle = GOLD.base;
    ctx.fillRect(-6, len - 4.4, 13.4, 0.8);
    // Belt with buckle
    cel(ctx, () => polyPath(ctx, [vec(-6.4, len - 1.8), vec(7.8, len - 1.8), vec(8, len + 0.6), vec(-6.6, len + 0.6)]), LEATHER, { band: 0.6 });
    cel(ctx, () => polyPath(ctx, [vec(4, len - 2.3), vec(7, len - 2.3), vec(7, len + 1.1), vec(4, len + 1.1)]), GOLD, { band: 0.5 });
    // Gorget
    cel(ctx, () => ellipsePath(ctx, vec(0.8, -0.2), 5.2, 2.4), IRON, { band: 0.8 });
    // Ember sigil on the chest
    ctx.fillStyle = 'rgba(255,138,42,0.85)';
    ctx.beginPath();
    ctx.moveTo(5.2, 4.2);
    ctx.quadraticCurveTo(6.6, 6.3, 5.4, 8.4);
    ctx.quadraticCurveTo(4.3, 6.8, 5.2, 4.2);
    ctx.fill();
  });
}

function helm(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Plume streaming back from the crest
  const sway = Math.sin(t * Math.PI * 2) * 0.8 + p.flow * 3;
  const plume = [
    vec(-1, -7.8), vec(2, -9.6), vec(-3, -10.4 - sway * 0.2), vec(-9 - sway, -8.5),
    vec(-13 - sway * 1.4, -4 + sway * 0.3), vec(-9 - sway, -5.2), vec(-4, -6.2),
  ];
  cel(ctx, () => blobPath(ctx, plume), CRIMSON, { band: 1.2 });
  // Helm shell
  const shell = [
    vec(-6.6, -1.5), vec(-5.4, -6.4), vec(0.2, -8.4), vec(5.6, -6.6),
    vec(7.4, -1.6), vec(7.2, 4.6), vec(1.6, 7.6), vec(-5.4, 6.4),
  ];
  cel(ctx, () => blobPath(ctx, shell), STEEL, { band: 1.9, hi: 0.9 });
  // Brow band
  ctx.fillStyle = GOLD.base;
  ctx.beginPath();
  ctx.moveTo(-6.6, -2.8);
  ctx.quadraticCurveTo(1, -4.4, 7.5, -2.9);
  ctx.lineTo(7.4, -1.7);
  ctx.quadraticCurveTo(1, -3.2, -6.6, -1.6);
  ctx.closePath();
  ctx.fill();
  // T-visor slit
  ctx.fillStyle = '#0c0a12';
  ctx.fillRect(1.2, -0.9, 6.4, 1.7);
  ctx.fillRect(4.1, -0.9, 1.5, 5.4);
  // Ember glow in the slit
  ctx.fillStyle = `rgba(255,${150 + Math.round(p.fx * 60)},60,${0.75 + p.fx * 0.25})`;
  ctx.fillRect(3.2, -0.5, 3.4, 0.9);
  // Breaths
  ctx.fillStyle = IRON.shade;
  for (let i = 0; i < 3; i++) ctx.fillRect(1.6 + i * 1.1, 3 + i * 0.3, 0.6, 0.6);
  // Rivets
  ctx.fillStyle = STEEL.light;
  ctx.fillRect(-4.6, 1.8, 0.8, 0.8);
  ctx.fillRect(-4.2, 4, 0.8, 0.8);
  ctx.restore();
}

function sword(ctx: CanvasRenderingContext2D, hand: V, angle: number, fx: number): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  // Blade (points toward local −y)
  const blade = [vec(-1.5, -2.2), vec(1.5, -2.2), vec(1.2, -BLADE_LEN + 4), vec(0, -BLADE_LEN), vec(-1.2, -BLADE_LEN + 4)];
  cel(ctx, () => polyPath(ctx, blade), BLADE, { band: 0.8, hi: 0.5 });
  ctx.strokeStyle = 'rgba(70,80,100,0.8)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(0, -BLADE_LEN + 5);
  ctx.stroke();
  if (fx > 0.05) {
    ctx.fillStyle = `rgba(255,170,80,${fx * 0.55})`;
    ctx.beginPath();
    polyPath(ctx, blade);
    ctx.fill();
  }
  // Crossguard with down-swept quillons
  cel(ctx, () => polyPath(ctx, [
    vec(-4.8, -1.2), vec(-3.8, -2.6), vec(3.8, -2.6), vec(4.8, -1.2), vec(3.8, -0.6), vec(-3.8, -0.6),
  ]), GOLD, { band: 0.5 });
  // Grip + pommel
  cel(ctx, () => capsulePath(ctx, vec(0, -0.6), vec(0, 3.6), 0.95, 0.95), LEATHER, { band: 0.4 });
  cel(ctx, () => ellipsePath(ctx, vec(0, 4.6), 1.5, 1.5), GOLD, { band: 0.5 });
  ctx.fillStyle = '#ff7a26';
  ctx.fillRect(-0.5, 4.1, 1, 1);
  ctx.restore();
}

function shield(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose): void {
  const c = vec(sk.handF.x + 2.2, sk.handF.y + 1.2);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(p.off);
  ctx.scale(0.82, 1); // turned three-quarters toward the viewer
  const outline = [
    vec(-6.8, -8.6), vec(0, -9.8), vec(6.8, -8.6), vec(6.6, 0.5), vec(3.6, 6.6), vec(0, 10.2), vec(-3.6, 6.6), vec(-6.6, 0.5),
  ];
  cel(ctx, () => blobPath(ctx, outline), GOLD, { band: 1.1 });
  const inner = outline.map(pt => vec(pt.x * 0.8, pt.y * 0.82 + 0.1));
  cel(ctx, () => blobPath(ctx, inner), CRIMSON, { band: 1.5 });
  // Flame emblem
  ctx.fillStyle = GOLD.base;
  ctx.beginPath();
  ctx.moveTo(0, -5.4);
  ctx.quadraticCurveTo(3.4, -1.2, 2.4, 2.4);
  ctx.quadraticCurveTo(1.6, 4.8, 0, 5.6);
  ctx.quadraticCurveTo(-1.6, 4.8, -2.4, 2.4);
  ctx.quadraticCurveTo(-2.8, -0.4, -1, -2.2);
  ctx.quadraticCurveTo(-0.6, 0.4, 0.4, 0.8);
  ctx.quadraticCurveTo(1.4, -2, 0, -5.4);
  ctx.fill();
  ctx.fillStyle = '#ffcf6b';
  ctx.beginPath();
  ctx.ellipse(0.2, 2.8, 1, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Top highlight
  ctx.strokeStyle = 'rgba(255,240,210,0.45)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-5.6, -7.6);
  ctx.quadraticCurveTo(0, -8.8, 5.6, -7.6);
  ctx.stroke();
  ctx.restore();
}

const WARRIOR_SKIN: HumanSkin = {
  prop: {
    thigh: 12.5, shin: 12, upperArm: 10, foreArm: 9.5,
    torso: 16.5, neck: 7.2, ankle: 2.6,
    hipN: vec(2.2, 0), hipF: vec(-2.6, -0.4),
    shN: vec(1.6, 4), shF: vec(-4.6, 3),
  },
  back(ctx, sk, p, t) {
    cape(ctx, sk, p, t);
    tabard(ctx, sk, p, t, false);
  },
  armFar(ctx, sk, p) {
    pauldron(ctx, sk.shF, p.lean, true);
    arm(ctx, sk.shF, sk.elF, sk.handF, true);
    fist(ctx, sk.handF, true);
  },
  legFar(ctx, sk) {
    leg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, true);
  },
  legNear(ctx, sk) {
    leg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, false);
  },
  torso(ctx, sk, p, t) {
    cuirass(ctx, sk);
    tabard(ctx, sk, p, t, true);
  },
  head(ctx, sk, p, t) {
    helm(ctx, sk, p, t);
  },
  offFront(ctx, sk, p) {
    shield(ctx, sk, p);
  },
  armNear(ctx, sk, p) {
    arm(ctx, sk.shN, sk.elN, sk.handN, false);
    pauldron(ctx, sk.shN, p.lean, false);
  },
  weapon(ctx, sk, p) {
    sword(ctx, sk.handN, p.wpn, p.fx);
    fist(ctx, sk.handN, false);
  },
};

// ── Animation ───────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1, 64.6),
  lean: 0.07,
  head: -0.05,
  footN: vec(CENTER_X + 6, GROUND_Y),
  footF: vec(CENTER_X - 6.5, GROUND_Y),
  handN: vec(CENTER_X + 7.5, 64.5),
  handF: vec(CENTER_X + 3.5, 58),
  wpn: 1.95,
  off: 0.08,
  flow: 0.12,
});

function pose(over: Partial<HumanPose>): HumanPose {
  return { ...READY, ...over };
}

const HIT = pose({
  root: vec(CENTER_X - 3.5, 65.8), lean: -0.34, head: -0.38,
  footN: vec(CENTER_X + 6.5, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
  handN: vec(CENTER_X + 2, 62), wpn: 1.2, handF: vec(CENTER_X, 55), off: -0.25,
  flow: 0.45, stretch: -0.04,
});

const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.28, ease: 'out', pose: pose({
    root: vec(CENTER_X - 3, 66.6), lean: -0.24, head: 0.04,
    footN: vec(CENTER_X + 8.5, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X - 5, 39.5), wpn: -0.9, handF: vec(CENTER_X + 6, 57), off: -0.12,
    flow: 0.25, stretch: 0.035,
  }) },
  { at: 0.43, ease: 'in', pose: pose({
    root: vec(CENTER_X + 0.5, 66.8), lean: 0.1, head: 0.05,
    footN: vec(CENTER_X + 10.5, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 8, 40.5), wpn: 0.75, handF: vec(CENTER_X + 2, 58),
    flow: 0.35, fx: 0.7, stretch: 0.02,
  }) },
  { at: 0.571, ease: 'linear', pose: pose({
    root: vec(CENTER_X + 4, 68), lean: 0.4, head: 0.1,
    footN: vec(CENTER_X + 13, GROUND_Y), footF: vec(CENTER_X - 7.5, GROUND_Y),
    handN: vec(CENTER_X + 17, 63), wpn: 2.25, handF: vec(CENTER_X - 1.5, 61), off: 0.2,
    flow: 0.55, fx: 1, stretch: -0.035,
  }) },
  { at: 0.71, ease: 'out', pose: pose({
    root: vec(CENTER_X + 3.5, 68.4), lean: 0.44, head: 0.08,
    footN: vec(CENTER_X + 13, GROUND_Y), footF: vec(CENTER_X - 7.5, GROUND_Y),
    handN: vec(CENTER_X + 13, 70), wpn: 2.5, handF: vec(CENTER_X, 61.5),
    flow: 0.45, fx: 0.35,
  }) },
  { at: 0.86, pose: pose({
    root: vec(CENTER_X + 1, 66.6), lean: 0.22, handN: vec(CENTER_X + 10, 66.5), wpn: 2.25,
    footN: vec(CENTER_X + 8, GROUND_Y), flow: 0.25,
  }) },
  { at: 1, pose: READY },
];

const CAST: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.36, ease: 'out', pose: pose({
    root: vec(CENTER_X - 1, 67.4), lean: -0.06, head: -0.2,
    footN: vec(CENTER_X + 7.5, GROUND_Y), footF: vec(CENTER_X - 7.5, GROUND_Y),
    handN: vec(CENTER_X + 5, 42), wpn: 0.12, handF: vec(CENTER_X - 7, 57), off: -0.35,
    flow: 0.18, fx: 0.9, stretch: 0.04,
  }) },
  { at: 0.5, ease: 'in', pose: pose({
    root: vec(CENTER_X + 2.5, 67), lean: 0.3, head: 0.05,
    footN: vec(CENTER_X + 11, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y),
    handN: vec(CENTER_X + 17, 52), wpn: 1.45, handF: vec(CENTER_X - 5, 59),
    flow: 0.5, fx: 1,
  }) },
  { at: 0.72, pose: pose({
    root: vec(CENTER_X + 2, 67), lean: 0.24, handN: vec(CENTER_X + 15, 54), wpn: 1.55,
    footN: vec(CENTER_X + 11, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y), handF: vec(CENTER_X - 4, 59),
    flow: 0.3, fx: 0.5,
  }) },
  { at: 1, pose: READY },
];

const HURT: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.33, pose: pose({ ...HIT, root: vec(CENTER_X - 4, 67.2), lean: -0.26, head: -0.22, flow: 0.35 }) },
  { at: 1, pose: READY },
];

const TUCK = (x: number, y: number, spin: number): HumanPose => pose({
  root: vec(x, y), spin, pivot: 0.5, lean: 0.7, head: 0.5,
  footN: vec(x + 6, y + 10), footF: vec(x + 3, y + 11),
  handN: vec(x + 7, y - 1), wpn: 2.6, handF: vec(x + 6, y - 5), off: 0.6,
  flow: 0.75, stretch: -0.08,
});

const DODGE: Key<HumanPose>[] = [
  { at: 0, pose: pose({
    root: vec(CENTER_X, 72), pivot: 0.5, lean: 0.55, head: 0.25,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 9, 69), wpn: 2.4, handF: vec(CENTER_X + 8, 63), off: 0.3, flow: 0.35,
  }) },
  { at: 0.2, pose: TUCK(CENTER_X - 1, 73, 1.3) },
  { at: 0.4, ease: 'linear', pose: TUCK(CENTER_X, 71, 2.9) },
  { at: 0.6, ease: 'linear', pose: TUCK(CENTER_X + 0.5, 72, 4.5) },
  { at: 0.8, pose: pose({
    root: vec(CENTER_X + 2, 71), spin: 6.0, pivot: 0.5, lean: 0.4, head: 0.1,
    footN: vec(CENTER_X + 9, GROUND_Y), footF: vec(CENTER_X - 4, GROUND_Y),
    handN: vec(CENTER_X + 10, 67), wpn: 2.2, handF: vec(CENTER_X + 7, 61), flow: 0.45,
  }) },
  { at: 1, pose: { ...READY, spin: Math.PI * 2, pivot: 0.5 } },
];

const DEATH: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.2, pose: pose({ ...HIT, root: vec(CENTER_X - 5, 68), lean: -0.42, head: -0.45, handN: vec(CENTER_X - 1, 64), wpn: 1.8 }) },
  { at: 0.45, pose: pose({
    root: vec(CENTER_X - 3, 76.5), lean: 0.2, head: 0.4,
    footN: vec(CENTER_X + 5, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y),
    handN: vec(CENTER_X + 3, 80), wpn: 2.7, handF: vec(CENTER_X - 1, 74), off: 0.4, flow: 0.2,
  }) },
  { at: 0.7, ease: 'in', pose: pose({
    root: vec(CENTER_X - 3, 82), spin: -0.95, lean: -0.1, head: -0.3,
    footN: vec(CENTER_X + 2, 104), footF: vec(CENTER_X - 3, 103),
    handN: vec(CENTER_X + 4, 76), wpn: 2.6, handF: vec(CENTER_X - 2, 74), flow: 0.6,
  }) },
  { at: 1, ease: 'out', pose: pose({
    root: vec(CENTER_X - 1, 86.5), spin: -1.52, lean: 0, head: -0.25,
    footN: vec(CENTER_X + 1, 111), footF: vec(CENTER_X - 1.5, 110.5),
    handN: vec(CENTER_X + 4, 80), wpn: 3.1, handF: vec(CENTER_X - 2, 78), off: 0.9, flow: 0.05,
  }) },
];

function idlePose(t: number): HumanPose {
  const ph = t * Math.PI * 2;
  const b = Math.sin(ph);
  return pose({
    root: vec(READY.root.x, READY.root.y + b * 0.55),
    stretch: b * -0.012,
    head: READY.head + Math.sin(ph - 0.6) * 0.03,
    handN: vec(READY.handN.x, READY.handN.y + b * 0.45),
    handF: vec(READY.handF.x, READY.handF.y + Math.sin(ph - 0.5) * 0.55),
    wpn: READY.wpn + Math.sin(ph - 0.3) * 0.03,
    flow: 0.12 + Math.sin(ph) * 0.05,
  });
}

function walkPose(t: number): HumanPose {
  const g = gait(t, { stride: 7, lift: 4.2, bob: 1.4, rootY: 64.9, footSpread: 1.2 });
  const ph = t * Math.PI * 2;
  return pose({
    root: vec(CENTER_X, g.rootY),
    lean: 0.11,
    head: -0.06,
    footN: g.footN,
    footF: g.footF,
    handN: vec(CENTER_X + 6.5 - g.swing * 3.2, 64.5 + Math.abs(g.swing) * 0.6),
    wpn: 1.95 - g.swing * 0.12,
    handF: vec(CENTER_X + 3.5 + g.swing * 1.8, 58 - Math.abs(Math.sin(ph)) * 0.8),
    flow: 0.38 + Math.sin(ph * 2) * 0.08,
    stretch: Math.abs(Math.sin(ph)) * 0.015,
  });
}

function warriorPose(act: PlayerAction, t: number): HumanPose {
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

function swordTip(p: HumanPose): { tip: V; base: V } {
  const sk = solveSkeleton(p, WARRIOR_SKIN.prop);
  const hand = spun(p, sk.handN, sk);
  const ang = p.wpn + p.spin;
  return { tip: along(hand, ang, BLADE_LEN), base: along(hand, ang, 5) };
}

function drawFx(ctx: CanvasRenderingContext2D, act: PlayerAction, t: number, p: HumanPose): void {
  const track = act === 'attack' ? ATTACK : act === 'cast' ? CAST : null;
  if (track && p.fx > 0.3) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const sp = samplePoseTrack(track, Math.max(0, t - i * 0.022));
      const { tip, base } = swordTip(sp);
      tips.push(tip);
      bases.push(base);
    }
    smear(ctx, tips, bases, act === 'cast' ? EMBER : 0xdfe8ff, 0.55 * p.fx);
  }
  if (act === 'cast' && p.fx > 0.05) {
    const { tip, base } = swordTip(p);
    glow(ctx, lerpV(base, tip, 0.55), 11 * p.fx, EMBER, 0.55 * p.fx);
    glow(ctx, tip, 6 * p.fx, 0xffd08a, 0.8 * p.fx);
    // Embers spiralling up the blade
    for (let i = 0; i < 6; i++) {
      const k = (i / 6 + t * 1.7) % 1;
      const pt = lerpV(base, tip, k);
      glow(ctx, vec(pt.x + Math.sin(i * 2.1 + t * 9) * 2.6, pt.y - k * 2), 1.6, 0xffb060, 0.9 * p.fx);
    }
  }
  // Visor ember
  const sk = solveSkeleton(p, WARRIOR_SKIN.prop);
  const visor = spun(p, along(sk.head, sk.headAng + Math.PI / 2, 4.4), sk);
  if (act !== 'death' || t < 0.6) glow(ctx, vec(visor.x, visor.y - 0.2), 3.2, EMBER, 0.45 + p.fx * 0.3);
}

export const PlayerWarriorDrawer: EntityDrawer = {
  key: 'player_warrior',
  // Wide frame leaves room for weapon reach at the contact pose.
  frameW: 96,
  frameH: 96,
  totalFrames: PLAYER_TOTAL_FRAMES,
  inked: true,

  drawFrame(ctx, frame, action, w, h) {
    const act = action as PlayerAction;
    const count = PLAYER_ACTION_FRAME_COUNTS[act];
    const loop = act === 'idle' || act === 'walk';
    const t = frameTime(frame % count, count, loop);
    const p = warriorPose(act, t);
    const palette = getCurrentZonePalette();
    const lift = Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y));
    renderRigFrame(
      ctx, w, h,
      c => { drawHumanoid(c, p, WARRIOR_SKIN, t); },
      { glowColor: palette.playerOutlineColor, glowBlur: standardOutlineBlur(w, h), scale: WARRIOR_SCALE },
      c => groundShadow(c, p.root.x + 1, 15, lift),
      c => drawFx(c, act, t, p),
    );
  },
};
