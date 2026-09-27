// src/graphics/sprites/monsters/Succubus.ts
//
// 魅魔 — a tall, poised archfiend duelist: swept-back ram horns over a
// gold circlet, a long mane of violet-black hair, folded bat wings and a
// spaded tail. She wears a high-collared obsidian cuirass with rose-gold
// filigree over a split crimson battle robe, armoured greaves and clawed
// gauntlets, and fights with a barbed whip wreathed in magenta abyssfire —
// cocking it back in a looping wind-up and cracking it out to full reach.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  along,
  blobPath,
  capsulePath,
  cel,
  clothChain,
  ellipsePath,
  glow,
  inBone,
  limb,
  polyPath,
  samplePoseTrack,
  tone,
  vec,
  type Key,
  type V,
} from '../rig/Rig';
import { basePose, solveSkeleton, spun, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster } from '../rig/MonsterKit';
import { batWing, curlChain, demonTail, embers, hornPath, hornRidges, localPt, taperPath, type WingLook } from './Imp';
import type { ViewPart, ViewSkeleton } from '../rig/HumanView';
import {
  band,
  decal,
  eyeGlowPoints,
  loftFill,
  lp,
  poly3,
  profileRings,
  ringsBetween,
  sagittal,
  sagittalSpun,
  solid3,
  strap,
  surfCurve,
  surfPatch,
  tube3,
  turnedHead,
  wingDepth,
  wingPlane,
  type L3,
  type Part3,
} from '../rig/MonsterView';

// ── Palette ─────────────────────────────────────────────────────────────
const SKIN = tone(0x9c6490, { light: 0.34 });
const SKIN_FAR = tone(0x683c64, { light: 0.18 });
const HAIR = tone(0x3a1848, { light: 0.3 });
const HAIR_FAR = tone(0x24102e, { light: 0.2 });
const OBSIDIAN = tone(0x2e2238, { light: 0.4 });
const OBSIDIAN_FAR = tone(0x1e1626, { light: 0.25 });
const GILT = tone(0xd49a62, { light: 0.45 });
const ROBE = tone(0x8a1638, { light: 0.28 });
const ROBE_IN = tone(0x4e0c24, { light: 0.15 });
const HORN = tone(0xd6bcc4, { light: 0.4, shadow: 0.5 });
const LEATHER = tone(0x3a1e2a, { light: 0.3 });
const WING: WingLook = { membrane: tone(0x5c1a4a, { light: 0.25, shadow: 0.5 }), bone: tone(0x7c2a52, { light: 0.3 }), tatter: 0.3 };
const WING_FAR: WingLook = { membrane: tone(0x3a1030, { light: 0.15, shadow: 0.5 }), bone: tone(0x52183a), tatter: 0.3 };
const ABYSSFIRE = 0xff2a86;
const FIRE_CORE = 0xffb0e0;
const EYE = 0xff4ad0;

const WHIP_LEN = 35;

const PROP = {
  thigh: 12, shin: 12.5, upperArm: 9.6, foreArm: 9.2,
  torso: 15.5, neck: 7, ankle: 2.8,
  hipN: vec(2, 0), hipF: vec(-2.2, -0.4),
  shN: vec(1.2, 3.6), shF: vec(-3.8, 3),
};

// ── Parts ───────────────────────────────────────────────────────────────

function greave(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, far: boolean): void {
  const plate = far ? OBSIDIAN_FAR : OBSIDIAN;
  limb(ctx, hip, knee, 3.4, 2.6, far ? SKIN_FAR : SKIN);
  limb(ctx, knee, ankle, 2.5, 1.7, plate);
  // Pointed knee cop
  cel(ctx, () => polyPath(ctx, [vec(knee.x - 1.6, knee.y - 2.6), vec(knee.x + 2.6, knee.y - 1), vec(knee.x + 1.4, knee.y + 2.6), vec(knee.x - 1.2, knee.y + 1.4)]), plate, { band: 0.5 });
  ctx.fillStyle = far ? GILT.shade : GILT.base;
  ctx.fillRect(knee.x + 0.2, knee.y - 0.4, 0.9, 0.9);
  // Heeled, pointed sabaton
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 1.8, ankle.y - 1), vec(ankle.x + 1.4, ankle.y - 1.2),
    vec(sole.x + 6, sole.y - 0.6), vec(sole.x + 2, sole.y), vec(sole.x - 0.6, sole.y - 1.2), vec(sole.x - 1.6, sole.y),
    vec(sole.x - 2.2, sole.y), vec(ankle.x - 2, ankle.y + 1),
  ]), plate, { band: 0.6 });
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const plate = far ? OBSIDIAN_FAR : OBSIDIAN;
  limb(ctx, sh, el, 2.2, 1.8, far ? SKIN_FAR : SKIN);
  // Flared gauntlet from elbow to wrist
  const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
  cel(ctx, () => blobPath(ctx, [localPt(el, ang, -1, -2.6), localPt(el, ang, 1.2, -2.2), localPt(hand, ang, -0.6, -1.8), localPt(hand, ang, -0.6, 1.8), localPt(el, ang, 1.2, 2.2), localPt(el, ang, -0.8, 1.8)]), plate, { band: 0.6 });
  ctx.strokeStyle = far ? GILT.shade : GILT.base;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  const g1 = localPt(el, ang, 1.2, -2.2);
  const g2 = localPt(el, ang, 1.2, 2.2);
  ctx.moveTo(g1.x, g1.y);
  ctx.lineTo(g2.x, g2.y);
  ctx.stroke();
}

function clawHand(ctx: CanvasRenderingContext2D, el: V, hand: V, far: boolean): void {
  const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
  const plate = far ? OBSIDIAN_FAR : OBSIDIAN;
  cel(ctx, () => ellipsePath(ctx, hand, 1.9, 1.6, ang), plate, { band: 0.5 });
  ctx.strokeStyle = far ? GILT.shade : GILT.light;
  ctx.lineWidth = 0.45;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const a = localPt(hand, ang + i * 0.4, 1.4, 0);
    const b = localPt(hand, ang + i * 0.4 + 0.3, 3.2, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function pauldron(ctx: CanvasRenderingContext2D, sh: V, lean: number, far: boolean): void {
  const plate = far ? OBSIDIAN_FAR : OBSIDIAN;
  ctx.save();
  ctx.translate(sh.x, sh.y);
  ctx.rotate(lean * 0.6);
  cel(ctx, () => blobPath(ctx, [vec(-3.6, 1.4), vec(-3, -1.8), vec(0.4, -3), vec(3.4, -1.6), vec(3.8, 1.6), vec(0, 2.6)]), plate, { band: 0.7 });
  // Swept thorn
  cel(ctx, () => polyPath(ctx, [vec(-1.6, -2.2), vec(-5.4, -5.2), vec(0.8, -2.8)]), plate, { band: 0.3 });
  ctx.strokeStyle = far ? GILT.shade : GILT.base;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.ellipse(0.2, 0, 3.4, 2.2, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  ctx.restore();
}

/** Long mane streaming from the back of the head. */
function mane(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const faceAng = sk.headAng;
  const anchor = localPt(sk.head, faceAng, -3.6, -2.4);
  const chain = clothChain(anchor, 23, 6, 0.25 + p.flow * 0.9, 1.4, t * Math.PI * 2 + 0.6);
  const left: V[] = [];
  const right: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    const half = 4.2 - k * 2.6;
    left.push(vec(pt.x - half, pt.y + k * 0.5));
    right.push(vec(pt.x + half * 0.8, pt.y));
  });
  const tip = chain[chain.length - 1];
  const outline = [...left, vec(tip.x - 1.2, tip.y + 2.4), ...right.reverse()];
  cel(ctx, () => blobPath(ctx, outline), HAIR_FAR, { band: 1.3 });
  // Strand highlights
  ctx.strokeStyle = HAIR.light;
  ctx.lineWidth = 0.4;
  ctx.globalAlpha = 0.55;
  for (const off of [-1.4, 0.8]) {
    ctx.beginPath();
    ctx.moveTo(chain[1].x + off, chain[1].y);
    for (let i = 2; i < chain.length - 1; i++) ctx.lineTo(chain[i].x + off * (1 - i / chain.length), chain[i].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function robeBack(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const belt = along(sk.pelvis, p.lean, 1);
  const chain = clothChain(vec(belt.x - 2.5, belt.y), 24, 6, 0.3 + p.flow, 1, t * Math.PI * 2);
  const left: V[] = [];
  const right: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    left.push(vec(pt.x - 2.8 - k * 4.4, pt.y));
    right.push(vec(pt.x + 2.6 + k * 1.2, pt.y + k * 0.4));
  });
  cel(ctx, () => blobPath(ctx, [...left, ...right.reverse()]), ROBE_IN, { band: 1.2 });
}

function robeFront(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const belt = along(sk.pelvis, p.lean, 1);
  const sway = Math.sin(t * Math.PI * 2) * 0.6 - p.flow * 3.5;
  const top = vec(belt.x + 1.2, belt.y);
  // Front tasset panel, split to show the greaves
  const pts = [
    vec(top.x - 4.4, top.y - 0.4), vec(top.x + 4.8, top.y - 0.8),
    vec(top.x + 5.6 + sway * 0.3, top.y + 10), vec(top.x + 2 + sway * 0.8, top.y + 14.5),
    vec(top.x - 1.2 + sway, top.y + 12), vec(top.x - 4.6 + sway * 0.9, top.y + 15),
  ];
  cel(ctx, () => polyPath(ctx, pts), ROBE, { band: 1.1 });
  ctx.strokeStyle = GILT.base;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(pts[2].x - 0.3, pts[2].y - 0.2);
  ctx.lineTo(pts[3].x, pts[3].y - 0.8);
  ctx.lineTo(pts[4].x, pts[4].y - 0.8);
  ctx.lineTo(pts[5].x + 0.3, pts[5].y - 0.8);
  ctx.stroke();
}

function cuirass(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Slim armoured torso: cuirass flaring over the hips
    const body = [vec(-4.8, 0.4), vec(0.4, -0.8), vec(5, 1.2), vec(6.2, 5.6), vec(4, len * 0.62), vec(5.6, len + 0.6), vec(-4.6, len + 0.8), vec(-4.2, len * 0.6), vec(-5.6, 5)];
    cel(ctx, () => blobPath(ctx, body), OBSIDIAN, { band: 1.5, hi: 0.8 });
    // Filigree: plunge-free V-lines and waist bands
    ctx.strokeStyle = GILT.base;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(-3.8, 1.8);
    ctx.quadraticCurveTo(1.4, 6.6, 4.6, 2.2);
    ctx.moveTo(4.4, len * 0.56);
    ctx.quadraticCurveTo(0, len * 0.66, -4, len * 0.58);
    ctx.moveTo(4.8, len * 0.74);
    ctx.quadraticCurveTo(0, len * 0.82, -4.2, len * 0.76);
    ctx.stroke();
    // Ruby heart brooch
    cel(ctx, () => polyPath(ctx, [vec(3.2, 4.6), vec(4.6, 5.8), vec(3.4, 7.8), vec(2, 5.8)]), tone(0xe0205a, { light: 0.5 }), { band: 0.3, stroke: 0.35 });
    // High collar (gorget)
    cel(ctx, () => polyPath(ctx, [vec(-3.8, 0.8), vec(-3, -3.6), vec(1, -2), vec(4.4, -3), vec(4.4, 1.2), vec(0.6, 2)]), OBSIDIAN, { band: 0.6 });
    ctx.strokeStyle = GILT.light;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(-3, -3.4);
    ctx.lineTo(1, -1.8);
    ctx.lineTo(4.3, -2.8);
    ctx.stroke();
    // Belt with a gilt clasp
    cel(ctx, () => polyPath(ctx, [vec(-4.8, len - 1.2), vec(6, len - 1.6), vec(6.2, len + 0.8), vec(-4.8, len + 1.2)]), LEATHER, { band: 0.4 });
    cel(ctx, () => ellipsePath(ctx, vec(4, len - 0.4), 1.4, 1.4), GILT, { band: 0.4 });
  });
}

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Far horn
  const f = [vec(-2.6, -5), vec(0.4, -6), vec(-9.6, -12), vec(-11.6, -3)] as const;
  cel(ctx, () => hornPath(ctx, f[0], f[1], f[2], f[3], 0.6), tone(0x8a7080), { band: 0.5 });
  // Face: slender with a pointed chin
  const face = [vec(-4.6, -1), vec(-3.8, -5.2), vec(1, -6.4), vec(4.8, -4.4), vec(5.8, -1), vec(5.8, 2), vec(4.2, 4.8), vec(1.6, 5.8), vec(-1.6, 4.6), vec(-4.2, 2.4)];
  cel(ctx, () => blobPath(ctx, face), SKIN, { band: 1.2 });
  // Pointed ear
  cel(ctx, () => polyPath(ctx, [vec(-1, -0.6), vec(-7.4, -3.8 - Math.sin(t * Math.PI * 2) * 0.3), vec(-2, 1.8)]), SKIN, { band: 0.5 });
  // Hair cap with a swept fringe
  const cap = [vec(-6, 0), vec(-5.6, -4.8), vec(-1, -7.4), vec(4, -6.4), vec(6.4, -3.4), vec(4.6, -3.2), vec(2.6, -4.2), vec(0.4, -2.6), vec(-2.2, -3), vec(-2.8, 1), vec(-5.2, 3.4)];
  cel(ctx, () => blobPath(ctx, cap), HAIR, { band: 1 });
  ctx.strokeStyle = HAIR.light;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-3.6, -5.2);
  ctx.quadraticCurveTo(0.8, -6.6, 4.2, -4.6);
  ctx.stroke();
  // Gilt circlet with a ruby
  ctx.strokeStyle = GILT.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-3.4, -3.8);
  ctx.quadraticCurveTo(1.6, -5.2, 5.6, -3.2);
  ctx.stroke();
  cel(ctx, () => polyPath(ctx, [vec(4, -5.2), vec(5, -4), vec(4, -2.8), vec(3, -4)]), tone(0xe0205a, { light: 0.5 }), { band: 0.2, stroke: 0.3 });
  // Glowing eye under a sharp brow
  ctx.fillStyle = '#1e0818';
  ctx.beginPath();
  ctx.moveTo(2.4, -1.2);
  ctx.quadraticCurveTo(4, -2.2, 5.5, -1.2);
  ctx.quadraticCurveTo(4, -0.2, 2.4, -1.2);
  ctx.fill();
  ctx.fillStyle = `rgb(255,${110 + p.fx * 80},230)`;
  ctx.beginPath();
  ctx.ellipse(4.2, -1.15, 0.95, 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1e0818';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(2, -2.6);
  ctx.lineTo(5.8, -2.2);
  ctx.stroke();
  // Nose and a cool, dark-lipped mouth
  ctx.strokeStyle = SKIN.shade;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(5.6, -0.4);
  ctx.lineTo(6.3, 1.2);
  ctx.lineTo(5.6, 1.5);
  ctx.stroke();
  ctx.strokeStyle = '#4a0c2c';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(3.6, 3.2);
  ctx.quadraticCurveTo(4.6, 3.5 - p.fx * 0.4, 5.4, 3.1);
  ctx.stroke();
  // Near horn: ram sweep up, back and curling down
  const b1 = vec(-0.4, -6);
  const b2 = vec(3.2, -5.6);
  const ctrl = vec(-4.2, -15.6);
  const tip = vec(-10.6, -6.2);
  cel(ctx, () => hornPath(ctx, b1, b2, ctrl, tip, 0.6), HORN, { band: 0.7 });
  hornRidges(ctx, b1, b2, ctrl, tip, 4, HORN.shade, 0.35, 0.6);
  ctx.restore();
}

function whipPoints(sk: Skeleton, p: HumanPose, t: number): V[] {
  const pts = curlChain(sk.handN, p.wpn, p.off, WHIP_LEN, 14, (0.35 + p.flow * 0.3) * (1 - p.fx * 0.85), t * Math.PI * 2);
  // Slack whip lies along the ground instead of passing through it.
  return pts.map(pt => vec(pt.x, Math.min(pt.y, GROUND_Y - 0.7)));
}

function whip(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const pts = whipPoints(sk, p, t);
  cel(ctx, () => taperPath(ctx, pts, 0.85, 0.22), LEATHER, { band: 0.3, stroke: 0.4 });
  // Barbs along the lash
  ctx.fillStyle = GILT.light;
  for (let i = 3; i < pts.length - 1; i += 2) {
    ctx.fillRect(pts[i].x - 0.35, pts[i].y - 0.35, 0.7, 0.7);
  }
  // Handle
  const ang = p.wpn;
  const back = along(sk.handN, ang + Math.PI, 3.4);
  cel(ctx, () => capsulePath(ctx, back, along(sk.handN, ang, 1.4), 0.9, 0.9), LEATHER, { band: 0.3 });
  cel(ctx, () => ellipsePath(ctx, back, 1.2, 1.2), GILT, { band: 0.3 });
}

// ── Skin ────────────────────────────────────────────────────────────────

function wingRoot(sk: Skeleton, p: HumanPose, far: boolean): V {
  return localPt(sk.neck, p.lean, far ? -1.6 : -3.4, far ? 3.4 : 4.6);
}

const SKIN_DEF: HumanSkin = {
  prop: PROP,
  back(ctx, sk, p, t) {
    const beat = Math.sin(t * Math.PI * 2) * 0.08;
    batWing(ctx, wingRoot(sk, p, true), -0.25 + beat + p.lean * 0.5 + p.flow * -0.2, 22, 0.35, WING_FAR, 11);
    batWing(ctx, wingRoot(sk, p, false), -0.7 + beat + p.lean * 0.5 + p.flow * -0.35, 25, 0.35, WING, 4);
    // Tail curls out behind the robe
    const root = localPt(sk.pelvis, p.lean * 0.3, -3, 1.4);
    const tail = curlChain(root, -2.4 + p.lean * 0.3, 2.4, 17, 8, 1 + p.flow, t * Math.PI * 2 + 1);
    demonTail(ctx, tail, 1.1, SKIN_FAR, HORN, 2.2);
    robeBack(ctx, sk, p, t);
    mane(ctx, sk, p, t);
  },
  armFar(ctx, sk, p) {
    pauldron(ctx, sk.shF, p.lean, true);
    arm(ctx, sk.shF, sk.elF, sk.handF, true);
    clawHand(ctx, sk.elF, sk.handF, true);
  },
  legFar(ctx, sk) {
    greave(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, true);
  },
  legNear(ctx, sk) {
    greave(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, false);
  },
  torso(ctx, sk, p, t) {
    cuirass(ctx, sk);
    robeFront(ctx, sk, p, t);
  },
  head(ctx, sk, p, t) {
    head(ctx, sk, p, t);
  },
  armNear(ctx, sk, p) {
    arm(ctx, sk.shN, sk.elN, sk.handN, false);
    pauldron(ctx, sk.shN, p.lean, false);
  },
  weapon(ctx, sk, p, t) {
    whip(ctx, sk, p, t);
    clawHand(ctx, sk.elN, sk.handN, false);
  },
};

// ── Isometric 3/4 views ─────────────────────────────────────────────────

const CUIRASS = (len: number): V[] => [vec(-4.8, 0.4), vec(0.4, -0.8), vec(5, 1.2), vec(6.2, 5.6), vec(4, len * 0.62), vec(5.6, len + 0.6), vec(-4.6, len + 0.8), vec(-4.2, len * 0.6), vec(-5.6, 5)];
const FACE_RINGS = profileRings([vec(-4.6, -1), vec(-3.8, -5.2), vec(1, -6.4), vec(4.8, -4.4), vec(5.8, -1), vec(5.4, 2), vec(3.8, 4.8), vec(1.6, 5.8), vec(-1.6, 4.6), vec(-4.2, 2.4)], y => -y, a => a * 0.9, 8);
const S_EYE = { h: 1.6, phi: 0.42 };

function robePanel(_len: number, s: 1 | -1, p: HumanPose, t: number): L3[] {
  const sway = Math.sin(t * Math.PI * 2) * 0.6 - p.flow * 3.5;
  const fr = s > 0 ? 5 : -4.4;
  const out = (k: number): number => fr + s * (0.6 + k * 1.4) + (s > 0 ? sway * 0.3 * k : -Math.abs(sway) * 0.6 * k);
  return [[1.4, fr, -4.2], [1.4, fr, 4.4], [-10, out(0.7), 4.8], [-14.5, out(1), 1.8], [-12, out(0.85), -0.8], [-15, out(1), -3.6], [-10, out(0.7), -4.8]];
}

function succTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = profileRings(CUIRASS(len), y => len - y, a => a * 1.12, 8);
  const front = T.vis(0) > T.vis(Math.PI);
  poly3(ctx, T, robePanel(len, front ? -1 : 1, p, t), ROBE_IN, { band: 1.2 });
  solid3(ctx, T, R, OBSIDIAN, {
    band: 1.5,
    hi: 0.8,
    face: () => {
      // Gilt filigree V and waist bands
      strap(ctx, T, R, [[len - 1.6, -1.1], [len - 5.4, 0], [len - 1.6, 1.1]], GILT, 0.5, 0.1);
      strap(ctx, T, R, [[len - 1.6, Math.PI - 1.1], [len - 5, Math.PI], [len - 1.6, Math.PI + 1.1]], GILT, 0.5, 0.1);
      for (const h of [len * 0.4, len * 0.22]) band(ctx, T, R, h, GILT, 0.45, 0.1);
      decal(ctx, T, R, len - 5.4, 0.1, () => cel(ctx, () => polyPath(ctx, [vec(0, -1.6), vec(1.2, 0), vec(0, 1.6), vec(-1.2, 0)]), tone(0xe0205a, { light: 0.5 }), { band: 0.3, stroke: 0.35 }), { lift: 0.2, minVis: 0.05 });
    },
    over: () => {
      // High gorget collar
      const collar = ringsBetween(R, len - 1, len + 2.4, 0.5, 0.9);
      loftFill(ctx, T, collar, OBSIDIAN, { band: 0.6 });
      band(ctx, T, R, len + 1.8, GILT, 0.45, 0.6);
      band(ctx, T, R, 0.4, LEATHER, 2, 0.5);
      decal(ctx, T, R, 0.4, 0.4, () => cel(ctx, () => ellipsePath(ctx, vec(0, 0), 1.4, 1.4), GILT, { band: 0.4 }), { lift: 0.8, minVis: 0.05 });
      const panel = robePanel(len, front ? 1 : -1, p, t);
      poly3(ctx, T, panel, ROBE, { band: 1.1 });
    },
  });
}

function succHeadView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const H = turnedHead(sk, 0.4);
  const R = FACE_RINGS;
  const horn = (s: 1 | -1): L3[] => [[5.6, 1.6, 2.8 * s], [9.4, -0.6, 4.8 * s], [11.4, -5, 6.4 * s], [8.4, -9.6, 7.2 * s], [3.6, -10.2, 7 * s]];
  const drawHorn = (s: 1 | -1): void => tube3(ctx, H, horn(s), [1.3, 1.1, 0.9, 0.6, 0.25], s > 0 ? HORN : tone(0x8a7080));
  const deep = (s: 1 | -1): boolean => H.rig.d(lp(H, 9, -4, 6 * s)) < H.rig.d(H.o);
  for (const s of [1, -1] as const) if (deep(s)) drawHorn(s);
  const tw = Math.sin(t * Math.PI * 2) * 0.3;
  const parts: Part3[] = [
    { pts: [[1.2, -0.6, 4], [4 + tw, -5, 7.4], [-1.6, -1.4, 4.2]], tone: SKIN, farTone: SKIN_FAR, mirror: true, band: 0.5 },
  ];
  // Hair cap over the crown; the back of the head is hair down to the nape
  const hair = ringsBetween(R, 4.9, 8, 0.5);
  solid3(ctx, H, R, SKIN, {
    band: 1.2,
    parts,
    face: () => {
      if (H.vis(0) < -0.3) return;
      for (const sgn of [1, -1]) {
        decal(ctx, H, R, S_EYE.h, sgn * S_EYE.phi, () => {
          ctx.fillStyle = '#1e0818';
          ctx.beginPath();
          ctx.moveTo(-1.2, 0);
          ctx.quadraticCurveTo(0, -0.8, 1.2, 0);
          ctx.quadraticCurveTo(0, 0.6, -1.2, 0);
          ctx.fill();
          ctx.fillStyle = `rgb(255,${110 + p.fx * 80},230)`;
          ctx.beginPath();
          ctx.ellipse(0, -0.05, 0.6, 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1e0818';
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(-1.3 * sgn, -1.3);
          ctx.lineTo(1.3 * sgn, -0.95);
          ctx.stroke();
        }, { minVis: 0.02 });
      }
      for (const run of surfCurve(H, R, [[-2.8, -0.35], [-2.9 - p.fx * 0.3, 0], [-2.8, 0.35]], 0.1, 4)) {
        ctx.strokeStyle = '#4a0c2c';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        run.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
      for (const run of surfCurve(H, R, [[0.6, 0.02], [-0.8, 0.08]], 0.2, 2)) {
        ctx.strokeStyle = SKIN.shade;
        ctx.lineWidth = 0.45;
        ctx.beginPath();
        run.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
    },
    over: () => {
      // Hair cap: a lofted shell over the crown with a swept fringe
      const back = surfPatch(H, R, 4, -3.6, Math.PI - 1.9, Math.PI + 1.9, 0.5, 12);
      if (H.vis(Math.PI) > 0.1) cel(ctx, () => polyPath(ctx, back), HAIR, { band: 1 });
      loftFill(ctx, H, hair, HAIR, { band: 1 });
      if (H.vis(0) > -0.3) {
        const fringe = surfPatch(H, R, 5.8, 4.4, -1.1, 1.1, 0.6, 10, k => 4.6 - Math.abs(Math.sin(k * Math.PI * 2)) * 0.9);
        cel(ctx, () => polyPath(ctx, fringe), HAIR, { band: 0.6 });
      }
      band(ctx, H, R, 5, GILT, 0.8, 0.9);
      decal(ctx, H, R, 5.2, 0, () => cel(ctx, () => polyPath(ctx, [vec(0, -1.2), vec(1, 0), vec(0, 1.2), vec(-1, 0)]), tone(0xe0205a, { light: 0.5 }), { band: 0.2, stroke: 0.3 }), { lift: 1, minVis: 0.05 });
    },
  });
  for (const s of [1, -1] as const) if (!deep(s)) drawHorn(s);
}

function succExtra(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number, d0: number): ViewPart[] {
  const T = sk.torso;
  const len = sk.torsoLen;
  const beat = Math.sin(t * Math.PI * 2) * 0.08;
  const out: ViewPart[] = [];
  for (const s of [1, -1] as const) {
    const anchor = lp(T, len - 3.4, -3.6, s * 2);
    const spread = s < 0 && sk.rig.front ? 0.15 : 1.15;
    const root = { x: anchor.x, y: anchor.y };
    out.push({
      z: wingDepth(sk.rig, anchor, s, spread, 8) - d0 + (s > 0 ? 0 : -8),
      draw: () => wingPlane(ctx, sk.rig, anchor, root, s, spread, () =>
        batWing(ctx, root, (s > 0 ? -0.7 : -0.35) + beat + p.flow * -0.3, s > 0 ? 25 : 22, 0.35, s > 0 ? WING : WING_FAR, s > 0 ? 4 : 11)),
    });
  }
  // Tail and mane stream behind, on the body plane.
  out.push({
    z: T.depth(0, Math.PI, 4, 0) - d0,
    draw: () => sagittal(ctx, sk.rig, 0, () => {
      const side = solveSkeleton(p, PROP);
      const root = localPt(side.pelvis, p.lean * 0.3, -3, 1.4);
      const tail = curlChain(root, -2.4 + p.lean * 0.3, 2.4, 17, 8, 1 + p.flow, t * Math.PI * 2 + 1);
      demonTail(ctx, tail, 1.1, SKIN_FAR, HORN, 2.2);
    }),
  });
  out.push({
    z: sk.skull.depth(0, Math.PI, 5, 0) - d0 + (sk.rig.front ? 0 : 3),
    draw: () => sagittal(ctx, sk.rig, 0, () => mane(ctx, solveSkeleton(p, PROP), p, t)),
  });
  return out;
}

function succFx(ctx: CanvasRenderingContext2D, p: HumanPose, sk: Skeleton, act: MonsterAction, t: number, skipEye = false): void {
  const dead = act === 'death';
  // Abyssfire licking along the lash
  const pts = whipPoints(sk, p, t).map(pt => spun(p, pt, sk));
  const heat = dead ? Math.max(0, 0.4 - t * 0.5) : 0.25 + p.fx * 0.75;
  for (let i = 2; i < pts.length; i += 2) {
    const k = i / (pts.length - 1);
    glow(ctx, pts[i], 2 + k * 1.5 + p.fx * 1.5, ABYSSFIRE, heat * (0.35 + k * 0.3));
  }
  if (act === 'attack' && t > 0.5) {
    // Ghost of the lash a beat earlier, as a motion blur
    const prev = samplePoseTrack(ATTACK, t - 0.06);
    const psk = solveSkeleton(prev, PROP);
    const ghost = whipPoints(psk, prev, t).map(pt => spun(prev, pt, psk));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(255,120,200,${0.28 * p.fx})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ghost[0].x, ghost[0].y);
    for (let i = 1; i < ghost.length; i++) ctx.lineTo(ghost[i].x, ghost[i].y);
    ctx.stroke();
    ctx.restore();
    if (t > 0.9) {
      // The crack: a sharp starburst at the tip
      const tip = pts[pts.length - 1];
      glow(ctx, tip, 9, ABYSSFIRE, 0.75);
      glow(ctx, tip, 3.5, FIRE_CORE, 0.95);
      ctx.strokeStyle = 'rgba(255,230,250,0.95)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const r = i % 2 ? 3.4 : 6.4;
        ctx.beginPath();
        ctx.moveTo(tip.x + Math.cos(a) * 1.6, tip.y + Math.sin(a) * 1.6);
        ctx.lineTo(tip.x + Math.cos(a) * r, tip.y + Math.sin(a) * r);
        ctx.stroke();
      }
    }
  }
  if (!skipEye && (!dead || t < 0.5)) {
    const eye = spun(p, localPt(sk.head, sk.headAng, 4.2, -1.15), sk);
    glow(ctx, eye, 1.9, EYE, 0.4 + p.fx * 0.3);
  }
  if (dead) {
    const c = spun(p, sk.pelvis, sk);
    embers(ctx, { x: c.x - 16, y: c.y - 10, w: 34, h: 10 }, 12, t, 0.15 + t * 0.6, ABYSSFIRE, 21);
  }
}

// ── Animation ───────────────────────────────────────────────────────────
// `wpn` aims the whip handle, `off` is how hard the lash curls.

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 3, 63.8),
  lean: 0.04,
  head: -0.04,
  footN: vec(CENTER_X + 3.5, GROUND_Y),
  footF: vec(CENTER_X - 5.5, GROUND_Y),
  handN: vec(CENTER_X + 8, 60),
  handF: vec(CENTER_X - 6.5, 62),
  wpn: 2.2,
  off: 2.6,
  flow: 0.1,
});

const P = (o: Partial<HumanPose>): HumanPose => ({ ...READY, ...o });
const R = READY.root;

const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  // Cock the whip back overhead, the lash looping behind her
  { at: 0.33, ease: 'out', pose: P({
    root: vec(R.x - 2, R.y + 0.6), lean: -0.2, head: -0.12,
    handN: vec(R.x - 3, 36), handF: vec(R.x + 8, 55),
    footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y),
    wpn: -1.1, off: -2.6, fx: 0.5, flow: 0.3, stretch: 0.03,
  }) },
  // Arm whips forward; the lash still trails, loaded
  { at: 0.67, ease: 'in', pose: P({
    root: vec(R.x + 1, R.y + 0.8), lean: 0.14, head: 0,
    handN: vec(R.x + 12, 42), handF: vec(R.x - 2, 58),
    footN: vec(CENTER_X + 9, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y),
    wpn: 0.1, off: -3.4, fx: 0.8, flow: 0.5,
  }) },
  // Crack: lash snaps straight out to full reach
  { at: 1, ease: 'linear', pose: P({
    root: vec(R.x + 3.5, R.y + 1.6), lean: 0.3, head: 0.06,
    handN: vec(R.x + 18, 57), handF: vec(R.x - 5, 60),
    footN: vec(CENTER_X + 11, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y),
    wpn: 1.62, off: 0.25, fx: 1, flow: 0.7, stretch: -0.02,
  }) },
];

const RECOIL = P({
  root: vec(R.x - 3.5, R.y + 1), lean: -0.3, head: -0.35,
  handN: vec(R.x + 4, 55), handF: vec(R.x - 8, 56),
  footF: vec(CENTER_X - 7, GROUND_Y), wpn: 2.6, off: 1.6, flow: 0.55, stretch: -0.03,
});

const HURT: Key<HumanPose>[] = [
  { at: 0, pose: RECOIL },
  { at: 1, pose: P({ ...RECOIL, root: vec(R.x - 2, R.y + 0.5), lean: -0.12, head: -0.15, handN: vec(R.x + 7, 58), wpn: 2.4, off: 2.2, flow: 0.3 }) },
];

const DEATH: Key<HumanPose>[] = [
  { at: 0, pose: RECOIL },
  // Buckles to her knees, whip slipping from her grasp
  { at: 0.33, pose: P({
    root: vec(R.x - 2, 75), lean: 0.2, head: 0.35,
    footN: vec(CENTER_X + 9, GROUND_Y), footF: vec(CENTER_X - 10, GROUND_Y),
    handN: vec(R.x + 9, 80), handF: vec(R.x + 3, 76), wpn: 2.9, off: 1.6, flow: 0.3, fx: 0.2,
  }) },
  { at: 0.67, ease: 'in', pose: P({
    root: vec(R.x - 4, 80), spin: 0.85, lean: 0.1, head: 0.2,
    footN: vec(R.x - 1, 104), footF: vec(R.x - 5, 103),
    handN: vec(R.x + 10, 82), handF: vec(R.x + 6, 80), wpn: 2.4, off: 1.4, flow: 0.6,
  }) },
  { at: 1, ease: 'out', pose: P({
    root: vec(R.x - 6, GROUND_Y - 5.6), spin: 1.5, lean: 0, head: 0.3,
    footN: vec(R.x - 5, GROUND_Y - 5.6 + 24), footF: vec(R.x - 8, GROUND_Y - 6 + 24),
    handN: vec(R.x + 3, GROUND_Y - 21), handF: vec(R.x, GROUND_Y - 19), wpn: 1.4, off: 1.2, flow: 0.05,
  }) },
];

export const SuccubusDrawer = humanoidMonster({
  key: 'monster_succubus',
  // Wide for the whip's reach; width doesn't move the sprite in-game.
  frameW: 100,
  frameH: 64,
  scale: 1.3,
  skin: SKIN_DEF,
  ready: READY,
  attack: 'overhead',
  tracks: { attack: ATTACK, hurt: HURT, death: DEATH },
  walk: { stride: 6, lift: 3.4, bob: 1, lean: 0.04, armSwing: 2, spread: 0.6 },
  shadowR: 11,
  idle: (t, ready) => {
    const ph = t * Math.PI * 2;
    const b = Math.sin(ph);
    return {
      ...ready,
      root: vec(ready.root.x, ready.root.y + b * 0.5),
      head: ready.head + Math.sin(ph - 0.6) * 0.04,
      handN: vec(ready.handN.x, ready.handN.y + b * 0.5),
      handF: vec(ready.handF.x, ready.handF.y + Math.sin(ph - 0.5) * 0.5),
      off: ready.off + Math.sin(ph) * 0.25,
      flow: ready.flow + Math.sin(ph) * 0.08,
    };
  },
  view: {
    build: { hipW: 2.4, shW: 5, elbowOut: 1.3, footOut: 0.3 },
    headBias: 4,
    torso: succTorsoView,
    head: succHeadView,
    back: () => undefined,
    extra: succExtra,
  },
  viewFx: (ctx, p, sk, act, t) => {
    sagittalSpun(ctx, sk, p, () => succFx(ctx, p, solveSkeleton(p, PROP), act, t, true));
    if (act !== 'death' || t < 0.5) {
      for (const e of eyeGlowPoints(turnedHead(sk, 0.4), FACE_RINGS, S_EYE.h, [S_EYE.phi, -S_EYE.phi], 0.3)) glow(ctx, e, 1.2, EYE, 0.3 + p.fx * 0.3);
    }
  },
  fx: (ctx, p, sk, act, t) => succFx(ctx, p, sk, act, t),
});

