// src/graphics/sprites/monsters/DemonLord.ts
//
// 魔王 — the Abyss Rift's final boss. A towering archdemon in blackened,
// magma-seamed plate: a demon-skull great helm with a slit of hellfire for
// eyes, colossal back-sweeping horns, an iron crown whose spikes burn with
// abyssfire, spiked pauldrons (one set with a trophy skull), and a long
// tattered crimson cape. He wields a serrated two-handed greatsword with a
// molten fuller that sheds flame. The attack is a huge overhead cleave;
// on death he sinks to one knee on his sword, topples, and burns away into
// a plume of embers.
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
  lerpV,
  limb,
  polyPath,
  samplePoseTrack,
  smear,
  tone,
  vec,
  type Key,
  type Tone,
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
import { rigMonster } from '../rig/MonsterKit';
import { embers, erode, flameTongue, hash01, hornPath, hornRidges, localPt } from './Imp';

// ── Palette ─────────────────────────────────────────────────────────────
const PLATE = tone(0x3c3446, { light: 0.42 });
const PLATE_FAR = tone(0x27212e, { light: 0.25 });
const IRON = tone(0x221c28, { light: 0.35 });
const BRONZE = tone(0xa86c3a, { light: 0.45 });
const CAPE = tone(0x7a1426, { light: 0.25 });
const CAPE_IN = tone(0x3a0814, { light: 0.12 });
const HORN = tone(0x2c2228, { light: 0.4 });
const HORN_FAR = tone(0x1c161c, { light: 0.25 });
const BONE = tone(0xe2d4b8, { light: 0.4, shadow: 0.3 });
const BLADE = tone(0x2e2834, { light: 0.5 });
const HIDE = tone(0x4a1a26, { light: 0.25 });
const MAGMA = 'rgba(255,96,36,0.95)';
const MAGMA_HOT = 'rgba(255,214,130,0.95)';
const HELLFIRE = 0xff4a1a;
const EMBER = 0xffb050;
const FLAME_OUT = 'rgba(255,72,26,0.92)';
const FLAME_IN = 'rgba(255,208,110,0.95)';

const BLADE_LEN = 31;

interface LordPose extends HumanPose {
  /** 0 = one hand, 1 = far hand locked on the hilt too. */
  grip: number;
  /** Crown / blade flame intensity. */
  crown: number;
  /** Death burn-away 0..1. */
  burn: number;
}

const PROP = {
  thigh: 12.5, shin: 12.5, upperArm: 11, foreArm: 10.5,
  torso: 19, neck: 6.6, ankle: 3,
  hipN: vec(2.8, 0), hipF: vec(-3.2, -0.6),
  shN: vec(2.4, 4.4), shF: vec(-6.4, 3.4),
};

// ── Parts ───────────────────────────────────────────────────────────────

function seam(ctx: CanvasRenderingContext2D, pts: readonly V[], heat: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, c] of [[1.1, 'rgba(90,10,10,0.9)'], [0.6, MAGMA], [0.22, MAGMA_HOT]] as const) {
    ctx.strokeStyle = c;
    ctx.globalAlpha = w < 1 ? 0.5 + heat * 0.5 : 1;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function sabaton(ctx: CanvasRenderingContext2D, ankle: V, sole: V, t: Tone): void {
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 3.4, ankle.y - 1.8), vec(ankle.x + 2.6, ankle.y - 2.4),
    vec(sole.x + 7, sole.y - 1.8), vec(sole.x + 8.6, sole.y), vec(sole.x - 3.8, sole.y),
  ]), t, { band: 1 });
  // Talon toes
  for (const dx of [5.6, 8]) {
    cel(ctx, () => polyPath(ctx, [vec(sole.x + dx - 1.4, sole.y - 1.4), vec(sole.x + dx + 2.2, sole.y), vec(sole.x + dx - 1, sole.y)]), BONE, { band: 0.2, stroke: 0.3 });
  }
}

function leg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, far: boolean): void {
  const plate = far ? PLATE_FAR : PLATE;
  limb(ctx, hip, knee, 5, 4, IRON);
  cel(ctx, () => capsulePath(ctx, lerpV(hip, knee, 0.12), lerpV(hip, knee, 0.88), 4.6, 3.6), plate, { band: 1.3 });
  limb(ctx, knee, ankle, 3.9, 3, plate);
  // Spiked knee cop
  const ka = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
  cel(ctx, () => polyPath(ctx, [localPt(knee, ka, -3, -2.6), localPt(knee, ka, -1, 6.4), localPt(knee, ka, 3, 2.6), localPt(knee, ka, 2.6, -2.6)]), plate, { band: 0.8 });
  if (!far) seam(ctx, [localPt(knee, ka, 3, -1), localPt(knee, ka, 8, -0.6)], 0.5);
  sabaton(ctx, ankle, sole, plate);
}

function gauntlet(ctx: CanvasRenderingContext2D, hand: V, far: boolean): void {
  cel(ctx, () => ellipsePath(ctx, hand, 3, 2.7), far ? PLATE_FAR : IRON, { band: 0.9 });
  ctx.fillStyle = far ? PLATE_FAR.light : PLATE.light;
  ctx.fillRect(hand.x - 1.8, hand.y - 2, 2.8, 0.9);
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const plate = far ? PLATE_FAR : PLATE;
  limb(ctx, sh, el, 4, 3.4, IRON);
  limb(ctx, lerpV(sh, el, 0.3), el, 3.8, 3.3, plate);
  // Flared vambrace
  const a = Math.atan2(hand.y - el.y, hand.x - el.x);
  cel(ctx, () => blobPath(ctx, [localPt(el, a, -1, -3.4), localPt(el, a, 2, -3.8), localPt(hand, a, -1.4, -3.2), localPt(hand, a, -1.4, 3.2), localPt(el, a, 2, 3.8), localPt(el, a, -1, 3.2)]), plate, { band: 1 });
  // Elbow spike
  const up = Math.atan2(el.y - sh.y, el.x - sh.x);
  cel(ctx, () => polyPath(ctx, [localPt(el, up, -1, -2.6), localPt(el, up, 6, -0.6), localPt(el, up, 0.6, 2.2)]), IRON, { band: 0.4 });
  if (!far) seam(ctx, [localPt(el, a, 3, -2.2), localPt(hand, a, -2.4, -2)], 0.6);
}

function pauldron(ctx: CanvasRenderingContext2D, sh: V, lean: number, far: boolean): void {
  const plate = far ? PLATE_FAR : PLATE;
  ctx.save();
  ctx.translate(sh.x, sh.y);
  ctx.rotate(lean * 0.6);
  ctx.translate(-0.8, -3.2);
  // Three back-raked spikes
  for (const [x, h, w] of [[-5.2, 8.5, 1.8], [-1.4, 11, 2.1], [2.6, 7.5, 1.7]] as const) {
    cel(ctx, () => hornPath(ctx, vec(x - w, -2.4), vec(x + w, -2.8), vec(x - 1.4, -2.8 - h * 0.6), vec(x - 3.4, -2.6 - h), 0.5), far ? HORN_FAR : HORN, { band: 0.5 });
  }
  // Layered lames
  for (let i = 2; i >= 0; i--) {
    const y = i * 2.8;
    cel(ctx, () => ellipsePath(ctx, vec(0.4, y), 8.2 - i * 1.1, 5 - i * 0.6), i === 0 ? plate : IRON, { band: 1.2 });
  }
  ctx.strokeStyle = far ? BRONZE.shade : BRONZE.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0.4, 0, 7.7, 4.5, 0, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();
  ctx.restore();
}

function cape(ctx: CanvasRenderingContext2D, sk: Skeleton, p: LordPose, t: number): void {
  const anchor = localPt(sk.neck, p.lean, -5.4, 2.4);
  const chain = clothChain(anchor, 36, 7, p.flow, 1.2, t * Math.PI * 2);
  const left: V[] = [];
  const right: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    const half = 4 + k * 6.5;
    left.push(vec(pt.x - half * 0.95, pt.y));
    right.push(vec(pt.x + half * 0.55, pt.y + k * 1.2));
  });
  // Ragged, torn hem between the two bottom corners
  const a = left[left.length - 1];
  const b = right[right.length - 1];
  const hem: V[] = [];
  const n = 7;
  for (let i = 1; i < n; i++) {
    const q = lerpV(a, b, i / n);
    const cut = i % 2 ? -3 - hash01(i * 5.1) * 3.5 : 0.6;
    hem.push(vec(q.x, q.y + cut));
  }
  const outline = [...left, ...hem, ...right.reverse()];
  cel(ctx, () => polyPath(ctx, outline), CAPE, { band: 1.8 });
  // Inner lining fold along the leading edge
  cel(ctx, () => polyPath(ctx, [right[right.length - 1], ...right.slice(-4).reverse().map(v => vec(v.x - 2.4, v.y))]), CAPE_IN, { band: 0.5, stroke: 0 });
  // A couple of tears
  ctx.fillStyle = 'rgba(20,4,10,0.85)';
  for (const [k, dx] of [[0.55, -3], [0.75, 1]] as const) {
    const c = chain[Math.round(k * (chain.length - 1))];
    ctx.beginPath();
    ctx.ellipse(c.x + dx, c.y, 0.8, 2.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tassets(ctx: CanvasRenderingContext2D, sk: Skeleton, p: LordPose, t: number, front: boolean): void {
  const belt = along(sk.pelvis, p.lean, 1.2);
  const sway = Math.sin(t * Math.PI * 2) * 0.5 - p.flow * 2.5;
  if (front) {
    // Tattered loincloth between the tassets
    const top = vec(belt.x + 4, belt.y);
    cel(ctx, () => polyPath(ctx, [vec(top.x - 3, top.y), vec(top.x + 3, top.y), vec(top.x + 3.4 + sway * 0.5, top.y + 13), vec(top.x + 1.4 + sway, top.y + 10.6), vec(top.x - 0.4 + sway, top.y + 14.2), vec(top.x - 2.8 + sway * 0.6, top.y + 11)]), CAPE, { band: 1 });
    // Near tasset plate
    cel(ctx, () => polyPath(ctx, [vec(belt.x - 3, belt.y - 0.6), vec(belt.x + 2.6, belt.y - 0.4), vec(belt.x + 3.2 + sway * 0.3, belt.y + 8.6), vec(belt.x - 2.8 + sway * 0.3, belt.y + 9.4)]), PLATE, { band: 1 });
    ctx.fillStyle = BRONZE.base;
    ctx.fillRect(belt.x - 2.6, belt.y + 7.6 + sway * 0.1, 5.4, 0.8);
  } else {
    cel(ctx, () => polyPath(ctx, [vec(belt.x - 7, belt.y - 0.6), vec(belt.x - 1, belt.y - 0.6), vec(belt.x - 1.4 + sway, belt.y + 9), vec(belt.x - 7.4 + sway, belt.y + 8.4)]), PLATE_FAR, { band: 0.8 });
  }
}

function cuirass(ctx: CanvasRenderingContext2D, sk: Skeleton, p: LordPose): void {
  const heat = 0.5 + p.fx * 0.5 - p.burn * 0.5;
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Hulking breastplate
    const chest = [vec(-10.6, 0.8), vec(-3, -3.2), vec(7.4, -1.6), vec(12.4, 5), vec(11.4, len * 0.52), vec(7.6, len - 2.6), vec(-7, len - 2), vec(-10.8, len * 0.5)];
    cel(ctx, () => blobPath(ctx, chest), PLATE, { band: 2.2, hi: 1 });
    // Ribbed abdominal lames
    for (let i = 0; i < 3; i++) {
      const y = len * 0.56 + i * 2.4;
      cel(ctx, () => polyPath(ctx, [vec(-7.6, y), vec(9.4 - i * 0.6, y - 0.4), vec(9 - i * 0.6, y + 2.2), vec(-7.4, y + 2.4)]), IRON, { band: 0.6 });
    }
    // Pectoral ridge
    ctx.strokeStyle = PLATE.light;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0.6, 2.6);
    ctx.quadraticCurveTo(6.6, 3.6, 10, 6.4);
    ctx.stroke();
    // Burning rune: a slit eye in a ring of magma seams
    seam(ctx, [vec(6.4, 6.4), vec(3.6, 8.4), vec(6.6, 10.4), vec(9.4, 8.4), vec(6.4, 6.4)], heat);
    seam(ctx, [vec(6.6, 4.4), vec(6.6, 12.6)], heat);
    seam(ctx, [vec(-4, 4), vec(-1, 7.6), vec(-2.4, 11)], heat * 0.8);
    // Heavy gorget
    cel(ctx, () => polyPath(ctx, [vec(-6, 0.4), vec(-5, -3.4), vec(1.4, -4.6), vec(7, -3), vec(7.6, 1.4), vec(0.6, 2.8)]), IRON, { band: 0.8 });
    ctx.fillStyle = BRONZE.base;
    ctx.fillRect(-4.8, -1.4, 11.8, 0.8);
    // War belt with a horned skull buckle
    cel(ctx, () => polyPath(ctx, [vec(-8, len - 2.4), vec(10, len - 3), vec(10.4, len + 0.4), vec(-8, len + 1)]), IRON, { band: 0.6 });
    cel(ctx, () => blobPath(ctx, [vec(4, len - 3.6), vec(8.4, len - 3.6), vec(9, len - 0.8), vec(7.4, len + 1.8), vec(5, len + 1.8), vec(3.4, len - 0.8)]), BONE, { band: 0.6 });
    ctx.fillStyle = '#1a0a0c';
    ctx.fillRect(4.8, len - 2, 1.2, 1.2);
    ctx.fillRect(7, len - 2, 1.2, 1.2);
    ctx.fillStyle = MAGMA;
    ctx.fillRect(5.1, len - 1.7, 0.6, 0.6);
    ctx.fillRect(7.3, len - 1.7, 0.6, 0.6);
    for (const s of [-1, 1]) {
      cel(ctx, () => polyPath(ctx, [vec(6.2 + s * 2, len - 3.4), vec(6.2 + s * 4.6, len - 6), vec(6.2 + s * 2.8, len - 2.4)]), BONE, { band: 0.2, stroke: 0.3 });
    }
  });
}

function helm(ctx: CanvasRenderingContext2D, sk: Skeleton, p: LordPose, t: number): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Far horn: sweeping back behind the crown
  {
    const b1 = vec(-2.6, -6);
    const b2 = vec(2.4, -7.6);
    const ctrl = vec(-8.6, -17);
    const tip = vec(5.2, -25.5);
    cel(ctx, () => hornPath(ctx, b1, b2, ctrl, tip, 0.9), HORN_FAR, { band: 0.8 });
  }
  // Demon-skull great helm
  const dome = [vec(-6.4, -1), vec(-5.8, -6), vec(0, -8.4), vec(5.8, -6.8), vec(8, -2.4), vec(8.4, 2), vec(6.6, 6), vec(1.2, 7.8), vec(-5, 5.6)];
  cel(ctx, () => blobPath(ctx, dome), PLATE, { band: 1.9, hi: 0.9 });
  // Charred jaw with fangs beneath the visor
  cel(ctx, () => polyPath(ctx, [vec(2, 3.6), vec(8.4, 2.6), vec(8.8, 5.6), vec(3.4, 7.6)]), HIDE, { band: 0.5 });
  ctx.fillStyle = '#12060a';
  ctx.beginPath();
  ctx.moveTo(3.2, 4.8);
  ctx.lineTo(8.6, 3.8);
  ctx.lineTo(8.2, 5.2);
  ctx.lineTo(3.6, 6.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = BONE.base;
  for (const [x, y, d] of [[4.2, 4.6, 1.3], [6, 4.2, 1.5], [7.6, 3.9, 1.1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 0.5, y);
    ctx.lineTo(x + 0.5, y);
    ctx.lineTo(x, y + d);
    ctx.fill();
  }
  // Angular visor with a brow ridge
  cel(ctx, () => polyPath(ctx, [vec(1, -4.6), vec(8.6, -3.6), vec(9.4, -0.6), vec(8.8, 2.8), vec(5, 3.8), vec(1.4, 2.2)]), IRON, { band: 0.8 });
  cel(ctx, () => polyPath(ctx, [vec(0.4, -5.6), vec(9.6, -4.2), vec(9.4, -2.8), vec(1, -3.8)]), PLATE, { band: 0.4 });
  // Hellfire eye slit
  ctx.fillStyle = '#12060a';
  ctx.fillRect(3.4, -2.2, 5.8, 1.9);
  ctx.fillStyle = `rgb(255,${90 + p.fx * 100},40)`;
  ctx.fillRect(4, -1.8, 4.8, 1);
  ctx.fillStyle = MAGMA_HOT;
  ctx.fillRect(5.6, -1.6, 1.6, 0.6);
  // Nasal ridge seam
  seam(ctx, [vec(8.8, -0.2), vec(9, 2.4)], 0.5);
  // Crown: iron circlet of spikes, each crowned with flame
  const fl = 0.7 + p.crown * 0.6;
  const ph = t * Math.PI * 2;
  const spikes: [number, number][] = [[-4.6, 4.6], [-1.6, 6.4], [1.4, 7.2], [4.2, 6]];
  for (const [x, h] of spikes) {
    const base = vec(x, -6.8 + Math.abs(x) * 0.12);
    if (fl > 0.05) {
      flameTongue(ctx, vec(base.x - 0.4, base.y - h + 1.2), -sk.headAng, (3.4 + h * 0.35) * fl, 1.3, ph * 2 + x, FLAME_OUT, FLAME_IN);
    }
    cel(ctx, () => polyPath(ctx, [vec(base.x - 1.2, base.y + 0.6), vec(base.x - 0.6, base.y - h), vec(base.x + 1.2, base.y + 0.4)]), IRON, { band: 0.4 });
  }
  cel(ctx, () => polyPath(ctx, [vec(-6.2, -5.6), vec(-0.2, -8.2), vec(6.4, -6.8), vec(6.6, -4.8), vec(-0.2, -6.2), vec(-6, -3.8)]), IRON, { band: 0.5 });
  ctx.fillStyle = MAGMA;
  for (const x of [-3, 0.2, 3.4]) ctx.fillRect(x, -6.2 + Math.abs(x) * 0.05, 0.9, 0.9);
  // Near horn: colossal, raking back from the temple then hooking up
  const b1 = vec(-4.6, -2.4);
  const b2 = vec(2, -5.8);
  const ctrl = vec(-19, -8);
  const tip = vec(-6.5, -25);
  cel(ctx, () => hornPath(ctx, b1, b2, ctrl, tip, 0.9), HORN, { band: 1.4 });
  hornRidges(ctx, b1, b2, ctrl, tip, 6, HORN.shade, 0.55, 0.9);
  // Bone-pale tip
  const tb1 = vec(-12.4, -19.4);
  const tb2 = vec(-9.2, -21.4);
  cel(ctx, () => hornPath(ctx, tb1, tb2, vec(-10.6, -23.4), tip, 0.5), BONE, { band: 0.3, stroke: 0.3 });
  ctx.restore();
}

function greatsword(ctx: CanvasRenderingContext2D, hand: V, angle: number, heat: number): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  // Blade points toward local −y; serrated spine on −x, keen edge on +x.
  const L = BLADE_LEN;
  const edge: V[] = [vec(2.4, -3), vec(3.5, -L * 0.5), vec(2.8, -L + 5.5), vec(0, -L)];
  const spine: V[] = [];
  for (let i = 0; i <= 7; i++) {
    const k = i / 7;
    const y = -3 - k * (L - 8);
    spine.push(vec(-2.6 - (i % 2 ? 1.4 : 0), y));
  }
  const blade = [...edge, vec(-2.2, -L + 5.5), ...spine.reverse()];
  cel(ctx, () => polyPath(ctx, blade), BLADE, { band: 1, hi: 0.5 });
  // Honed edge + molten fuller
  ctx.strokeStyle = 'rgba(220,210,230,0.7)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(1.9, -4);
  ctx.lineTo(2.6, -L * 0.5);
  ctx.lineTo(1.9, -L + 5);
  ctx.stroke();
  seam(ctx, [vec(0, -4), vec(0.2, -L * 0.55), vec(0, -L + 6)], heat);
  // Horned crossguard with a burning eye-gem
  cel(ctx, () => polyPath(ctx, [vec(-7, 1), vec(-5.6, -1.6), vec(-2, -3.2), vec(2, -3.2), vec(5.6, -1.6), vec(7, 1), vec(4, -0.6), vec(-4, -0.6)]), IRON, { band: 0.6 });
  cel(ctx, () => ellipsePath(ctx, vec(0, -1.8), 1.6, 1.6), BRONZE, { band: 0.4 });
  ctx.fillStyle = MAGMA;
  ctx.beginPath();
  ctx.ellipse(0, -1.8, 0.6, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Long wrapped grip + spiked pommel
  cel(ctx, () => capsulePath(ctx, vec(0, -0.4), vec(0, 7.4), 1.1, 1.1), tone(0x3a1a20), { band: 0.4 });
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.35;
  for (let y = 0.6; y < 7; y += 1.3) {
    ctx.beginPath();
    ctx.moveTo(-1, y);
    ctx.lineTo(1, y + 0.7);
    ctx.stroke();
  }
  cel(ctx, () => polyPath(ctx, [vec(-1.6, 7.2), vec(1.6, 7.2), vec(0, 11)]), IRON, { band: 0.3 });
  ctx.restore();
}

// ── Skin ────────────────────────────────────────────────────────────────

const LORD_SKIN: HumanSkin = {
  prop: PROP,
  back(ctx, sk, p: LordPose, t) {
    cape(ctx, sk, p, t);
    tassets(ctx, sk, p, t, false);
  },
  armFar(ctx, sk, p) {
    pauldron(ctx, sk.shF, p.lean, true);
    arm(ctx, sk.shF, sk.elF, sk.handF, true);
    gauntlet(ctx, sk.handF, true);
  },
  legFar(ctx, sk) {
    leg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, true);
  },
  legNear(ctx, sk) {
    leg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, false);
  },
  torso(ctx, sk, p: LordPose, t) {
    cuirass(ctx, sk, p);
    tassets(ctx, sk, p, t, true);
  },
  head(ctx, sk, p: LordPose, t) {
    helm(ctx, sk, p, t);
  },
  armNear(ctx, sk, p) {
    arm(ctx, sk.shN, sk.elN, sk.handN, false);
    pauldron(ctx, sk.shN, p.lean, false);
  },
  weapon(ctx, sk, p: LordPose) {
    greatsword(ctx, sk.handN, p.wpn, Math.max(0, 0.45 + p.fx * 0.55 - p.burn));
    gauntlet(ctx, sk.handN, false);
  },
};

// ── Animation ───────────────────────────────────────────────────────────

const READY: LordPose = {
  ...basePose({
    root: vec(CENTER_X - 4, 61.5),
    lean: 0.1,
    head: -0.1,
    footN: vec(CENTER_X + 5, GROUND_Y),
    footF: vec(CENTER_X - 11, GROUND_Y),
    handN: vec(CENTER_X + 7, 63),
    handF: vec(CENTER_X + 3, 66),
    wpn: 2.05,
    flow: 0.15,
  }),
  grip: 1,
  crown: 0.5,
  burn: 0,
};

const P = (o: Partial<LordPose>): LordPose => ({ ...READY, ...o });
const R = READY.root;

const ATTACK: Key<LordPose>[] = [
  { at: 0, pose: READY },
  // Heave the greatsword back over the shoulder; crown flares
  { at: 0.33, ease: 'out', pose: P({
    root: vec(R.x - 3, R.y + 1.2), lean: -0.2, head: -0.1,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 12, GROUND_Y),
    handN: vec(R.x - 1, 36), wpn: -1.25, crown: 1, fx: 0.6, flow: 0.3, stretch: 0.04,
  }) },
  // Over the top
  { at: 0.67, ease: 'in', pose: P({
    root: vec(R.x + 1.5, R.y + 1), lean: 0.14, head: 0,
    footN: vec(CENTER_X + 11, GROUND_Y), footF: vec(CENTER_X - 12, GROUND_Y),
    handN: vec(R.x + 13, 36), wpn: 0.62, crown: 1, fx: 0.85, flow: 0.5,
  }) },
  // Cleave: blade buried at the target's feet
  { at: 1, ease: 'linear', pose: P({
    root: vec(R.x + 5.5, R.y + 4.5), lean: 0.52, head: 0.12,
    footN: vec(CENTER_X + 14, GROUND_Y), footF: vec(CENTER_X - 11, GROUND_Y),
    handN: vec(R.x + 22, 65), wpn: 2.3, crown: 1, fx: 1, flow: 0.75, stretch: -0.04,
  }) },
];

const RECOIL = P({
  root: vec(R.x - 4, R.y + 1), lean: -0.28, head: -0.35,
  footF: vec(CENTER_X - 13, GROUND_Y),
  handN: vec(R.x + 6, 58), wpn: 1.5, grip: 0.3, handF: vec(R.x - 3, 58),
  crown: 0.2, flow: 0.55, stretch: -0.03,
});

const HURT: Key<LordPose>[] = [
  { at: 0, pose: RECOIL },
  { at: 1, pose: P({ ...RECOIL, root: vec(R.x - 2, R.y + 0.5), lean: -0.08, head: -0.18, handN: vec(R.x + 9, 61), wpn: 1.8, grip: 0.7, crown: 0.4, flow: 0.3 }) },
];

const DEATH: Key<LordPose>[] = [
  { at: 0, pose: RECOIL },
  // Sinks to one knee, leaning on the planted sword
  { at: 0.33, pose: P({
    root: vec(R.x - 1, 71), lean: 0.3, head: 0.45,
    footN: vec(CENTER_X + 9, GROUND_Y), footF: vec(CENTER_X - 16, GROUND_Y),
    handN: vec(R.x + 15, 60), wpn: 3.08, grip: 0, handF: vec(R.x + 6, 70),
    crown: 0.25, fx: 0, flow: 0.25, burn: 0.05,
  }) },
  // Topples forward, already burning away
  { at: 0.67, ease: 'in', pose: P({
    root: vec(R.x + 1, 74), spin: 0.7, lean: 0.2, head: 0.4,
    footN: vec(R.x + 1, 97), footF: vec(R.x - 5, 96),
    handN: vec(R.x + 14, 78), wpn: 2.7, grip: 0, handF: vec(R.x + 9, 80),
    crown: 0.1, flow: 0.5, burn: 0.3,
  }) },
  { at: 1, ease: 'out', pose: P({
    root: vec(R.x - 4, GROUND_Y - 12), spin: 1.5, lean: 0, head: 0.3,
    footN: vec(R.x - 3, GROUND_Y - 12 + 25), footF: vec(R.x - 7, GROUND_Y - 12.4 + 25),
    handN: vec(R.x + 8, GROUND_Y - 26), wpn: 1.3, grip: 0, handF: vec(R.x + 4, GROUND_Y - 24),
    crown: 0, flow: 0.05, burn: 0.5,
  }) },
];

/** Lock the far hand onto the hilt below the near hand for two-handed holds. */
function applyGrip(p: LordPose): LordPose {
  if (p.grip <= 0.001) return p;
  const hilt = along(p.handN, p.wpn + Math.PI, 3.8);
  return { ...p, handF: lerpV(p.handF, hilt, p.grip) };
}

function lordPose(act: MonsterAction, t: number): LordPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle': {
      const b = Math.sin(ph);
      return applyGrip(P({
        root: vec(R.x, R.y + b * 0.7),
        stretch: -b * 0.015,
        head: READY.head + Math.sin(ph - 0.6) * 0.04,
        handN: vec(READY.handN.x, READY.handN.y + b * 0.6),
        wpn: READY.wpn + Math.sin(ph - 0.4) * 0.03,
        flow: 0.15 + b * 0.06,
      }));
    }
    case 'walk': {
      const g = gait(t, { stride: 7.5, lift: 3.6, bob: 1.8, rootY: R.y + 0.4, footSpread: 1.8 });
      const cx = (READY.footN.x + READY.footF.x) / 2 - CENTER_X;
      return applyGrip(P({
        root: vec(R.x, g.rootY),
        lean: 0.16,
        footN: vec(g.footN.x + cx, g.footN.y),
        footF: vec(g.footF.x + cx, g.footF.y),
        handN: vec(READY.handN.x - g.swing * 1.6, READY.handN.y + Math.abs(g.swing) * 0.6),
        wpn: READY.wpn - g.swing * 0.06,
        flow: 0.45 + Math.sin(ph * 2) * 0.08,
      }));
    }
    case 'attack': return applyGrip(samplePoseTrack(ATTACK, t));
    case 'hurt': return applyGrip(samplePoseTrack(HURT, t));
    case 'death': return applyGrip(samplePoseTrack(DEATH, t));
  }
}

function bladeLine(p: LordPose): { tip: V; base: V } {
  const sk = solveSkeleton(p, PROP);
  const hand = spun(p, sk.handN, sk);
  const ang = p.wpn + p.spin;
  return { tip: along(hand, ang, BLADE_LEN), base: along(hand, ang, 6) };
}

export const DemonLordDrawer = rigMonster<LordPose>({
  key: 'monster_demon_lord',
  // Wide for the greatsword's wind-up and cleave; width doesn't move the sprite.
  frameW: 120,
  frameH: 84,
  scale: 1.04,
  pose: lordPose,
  draw: (ctx, p, _act, t) => {
    const sk = drawHumanoid(ctx, p, LORD_SKIN, t);
    if (p.burn > 0) {
      const c = spun(p, sk.pelvis, sk);
      erode(ctx, p.burn, { x: c.x - 34, y: c.y - 38, w: 70, h: 50 }, 31, 1.4);
    }
  },
  shadow: (p) => ({
    x: Math.abs(p.spin) > 1 ? p.root.x + 12 : p.root.x + 2,
    r: Math.abs(p.spin) > 1 ? 26 : 19,
    lift: 0,
  }),
  fx: (ctx, p, act, t) => {
    const sk = solveSkeleton(p, PROP);
    const dead = act === 'death';
    const live = dead ? Math.max(0, 1 - p.burn * 1.6) : 1;
    // Blade: molten glow and flame licking up along it
    const { tip, base } = bladeLine(p);
    const heat = (0.45 + p.fx * 0.55) * live;
    for (let i = 0; i <= 5; i++) {
      const q = lerpV(base, tip, i / 5);
      glow(ctx, q, 3.2 + p.fx * 2, HELLFIRE, 0.28 * heat);
    }
    if (heat > 0.1) {
      for (let i = 0; i < 5; i++) {
        const k = 0.15 + i * 0.18;
        const q = lerpV(base, tip, k);
        const hgt = (2.6 + hash01(i * 3.7) * 2.4) * (0.6 + p.fx * 0.7);
        flameTongue(ctx, q, 0, hgt * heat, 1, t * 14 + i * 1.9, 'rgba(255,80,30,0.55)', 'rgba(255,210,120,0.6)');
      }
    }
    // Swing smear
    if (act === 'attack' && p.fx > 0.3 && t > 0.5) {
      const tips: V[] = [];
      const bases: V[] = [];
      for (let i = 7; i >= 0; i--) {
        const sp = applyGrip(samplePoseTrack(ATTACK, Math.max(0.4, t - i * 0.03)));
        const b = bladeLine(sp);
        tips.push(b.tip);
        bases.push(b.base);
      }
      smear(ctx, tips, bases, HELLFIRE, 0.7 * p.fx);
    }
    // Impact: ground eruption where the blade bites
    if (act === 'attack' && t > 0.9) {
      const at = vec(tip.x - 2, GROUND_Y);
      glow(ctx, vec(at.x, at.y - 4), 20, HELLFIRE, 0.55);
      glow(ctx, vec(at.x, at.y - 2), 8, EMBER, 0.85);
      for (let i = 0; i < 6; i++) {
        const a = -1 + (i / 5) * 2;
        flameTongue(ctx, vec(at.x + a * 10, at.y + 0.5), a * 0.45, 8 + hash01(i * 2.3) * 7 - Math.abs(a) * 3, 2, i * 2.1, FLAME_OUT, FLAME_IN);
      }
    }
    // Crown and visor glow
    if (live > 0.05) {
      const crown = spun(p, localPt(sk.head, sk.headAng, 0, -12), sk);
      glow(ctx, crown, 9 + p.crown * 4, HELLFIRE, (0.18 + p.crown * 0.22) * live);
      const eye = spun(p, localPt(sk.head, sk.headAng, 6.4, -1.3), sk);
      glow(ctx, eye, 4, HELLFIRE, (0.55 + p.fx * 0.3) * live);
      const rune = spun(p, localPt(sk.neck, sk.torsoAng, 6.5, 8.4), sk);
      glow(ctx, rune, 6 + p.fx * 3, HELLFIRE, (0.3 + p.fx * 0.3) * live);
    }
    if (dead) {
      const c = spun(p, sk.pelvis, sk);
      embers(ctx, { x: c.x - 22, y: c.y - 26, w: 50, h: 30 }, 26, t, Math.min(1, 0.2 + p.burn * 1.5), HELLFIRE, 41);
    }
  },
  rim: 'rgba(255,150,110,0.5)',
});
