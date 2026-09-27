// src/graphics/sprites/monsters/IronGuardian.ts
//
// 铁甲守卫 — mini-boss. An empty suit of dwarven plate animated by a forge
// fire: flames lick out of the great helm's T-visor and crown, a furnace
// grate glows in the breastplate, and every joint seam burns orange. It
// stands sentinel on a huge anvil-headed warhammer, then rears back and
// brings it down two-handed in a ground-shaking slam.
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
import { drawHumanoidView, solveViewSkeleton, type HumanView, type ViewPart, type ViewSkeleton } from '../rig/HumanView';
import {
  MONSTER_VIEWS,
  band,
  decal,
  groundX,
  loftFill,
  lp,
  monsterViewSkin,
  poly3,
  profileRings,
  ringsBetween,
  sagittalSpun,
  solid3,
  sp,
  strap,
  surf,
  surfVis,
  tube3,
  turnedHead,
  type L3,
} from '../rig/MonsterView';

const IRON = tone(0x7c8696, { light: 0.45 });
const IRON_FAR = tone(0x5a6272, { light: 0.25 });
const IRON_DARK = tone(0x444b59, { light: 0.3 });
const STEEL = tone(0xa4aebd, { light: 0.5, shadow: 0.5 });
const BRASS = tone(0xc0924e, { light: 0.4 });
const CLOTH = tone(0x3b3542, { light: 0.25 });
const LEATHER = tone(0x5a3e2a, { light: 0.3 });
const FIRE = 0xff8a2a;
const HOT = 0xffd08a;
const SEAM = 'rgb(255,146,58)';

const HAM_LEN = 24;

/** Pose with a fire-intensity channel (dies out on death). */
interface GuardPose extends HumanPose {
  fire: number;
}

// ── Armour pieces ───────────────────────────────────────────────────────

function seam(ctx: CanvasRenderingContext2D, a: V, b: V, fire: number): void {
  if (fire <= 0.05) return;
  ctx.strokeStyle = SEAM;
  ctx.globalAlpha = Math.min(1, fire);
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function rivets(ctx: CanvasRenderingContext2D, pts: readonly V[], t: Tone): void {
  ctx.fillStyle = t.light;
  for (const r of pts) {
    ctx.beginPath();
    ctx.arc(r.x, r.y, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function sabaton(ctx: CanvasRenderingContext2D, ankle: V, sole: V, t: Tone): void {
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 3.4, ankle.y - 1.4), vec(ankle.x + 2.2, ankle.y - 2),
    vec(sole.x + 5.4, sole.y - 2.6), vec(sole.x + 7.6, sole.y - 0.4), vec(sole.x + 7, sole.y), vec(sole.x - 3.8, sole.y),
  ]), t, { band: 0.9 });
  ctx.strokeStyle = t.shade;
  ctx.lineWidth = 0.45;
  for (const k of [0.35, 0.65]) {
    const x = lerpV(vec(ankle.x, ankle.y), vec(sole.x + 7, sole.y), k);
    ctx.beginPath();
    ctx.moveTo(x.x - 0.4, x.y - 2.4);
    ctx.lineTo(x.x + 0.6, x.y + 0.4);
    ctx.stroke();
  }
}

function armouredLeg(ctx: CanvasRenderingContext2D, sk: Skeleton, near: boolean, fire: number): void {
  const t = near ? IRON : IRON_FAR;
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  const sole = near ? sk.soleN : sk.soleF;
  // Dark mail underlayer at the joints, glowing through the gaps
  limb(ctx, hip, knee, 3.4, 3, IRON_DARK);
  limb(ctx, knee, ankle, 3, 2.6, IRON_DARK);
  seam(ctx, lerpV(hip, knee, 0.82), lerpV(knee, ankle, 0.18), fire);
  // Cuisse + greave plates
  limb(ctx, lerpV(hip, knee, 0.05), lerpV(hip, knee, 0.78), 4.8, 4, t);
  limb(ctx, lerpV(knee, ankle, 0.22), lerpV(knee, ankle, 0.92), 4, 3.2, t);
  inBone(ctx, knee, ankle, (len) => {
    ctx.strokeStyle = t.light;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(1.6, len * 0.3);
    ctx.lineTo(1.2, len * 0.85);
    ctx.stroke();
  });
  sabaton(ctx, ankle, sole, t);
  // Knee cop with a short spike
  cel(ctx, () => ellipsePath(ctx, vec(knee.x + 1, knee.y), 3.4, 3), near ? BRASS : tone(0x8a6a3c), { band: 0.7 });
  cel(ctx, () => polyPath(ctx, [vec(knee.x + 3, knee.y - 1.2), vec(knee.x + 6.4, knee.y), vec(knee.x + 3, knee.y + 1.2)]), t, { band: 0.3, stroke: 0.35 });
}

function pauldron(ctx: CanvasRenderingContext2D, sh: V, el: V, t: Tone, trim: Tone, big: number): void {
  // Drawn in upper-arm space so the lames hang along the arm
  inBone(ctx, sh, el, () => {
    ctx.translate(0, -2.4);
    ctx.scale(big, big);
    for (let i = 1; i >= 1; i--) {
      const y = 2.6 + i * 2.2;
      const w = 5.4 - i * 0.5;
      cel(ctx, () => blobPath(ctx, [vec(-w, y - 1.4), vec(0, y - 2.4), vec(w, y - 1.4), vec(w - 0.2, y + 1.2), vec(0, y + 1.8), vec(-w + 0.2, y + 1.2)]), t, { band: 0.7 });
      ctx.strokeStyle = t.shade;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-w + 0.4, y + 1.1);
      ctx.quadraticCurveTo(0, y + 2, w - 0.4, y + 1.1);
      ctx.stroke();
    }
    // Domed cap
    const dome = [vec(-6.6, 3), vec(-5.8, -2.6), vec(0, -5.4), vec(5.8, -2.6), vec(6.6, 3), vec(0, 4.4)];
    cel(ctx, () => blobPath(ctx, dome), t, { band: 1.2, hi: 0.6, stroke: 0.9 });
    ctx.strokeStyle = trim.base;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-6.2, 2.8);
    ctx.quadraticCurveTo(0, 5.4, 6.2, 2.8);
    ctx.stroke();
    // Spike on the crown
    cel(ctx, () => polyPath(ctx, [vec(-1.5, -4), vec(0, -9.4), vec(1.5, -4)]), t, { band: 0.3, stroke: 0.35 });
    rivets(ctx, [vec(-3.6, 1.4), vec(3.6, 1.4), vec(0, 2.4)], trim);
  });
}

function gauntlet(ctx: CanvasRenderingContext2D, at: V, t: Tone): void {
  cel(ctx, () => ellipsePath(ctx, at, 3.2, 2.8, 0.3), t, { band: 0.7 });
  ctx.strokeStyle = t.shade;
  ctx.lineWidth = 0.45;
  for (const d of [-0.9, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(at.x - 1.8, at.y + d);
    ctx.lineTo(at.x + 2, at.y + d + 0.6);
    ctx.stroke();
  }
}

function armouredArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, t: Tone, fire: number): void {
  limb(ctx, sh, el, 3, 2.7, IRON_DARK);
  limb(ctx, el, hand, 2.7, 2.4, IRON_DARK);
  seam(ctx, lerpV(sh, el, 0.8), lerpV(el, hand, 0.2), fire);
  limb(ctx, lerpV(sh, el, 0.15), lerpV(sh, el, 0.8), 3.8, 3.4, t);
  // Flared vambrace
  limb(ctx, lerpV(el, hand, 0.22), lerpV(el, hand, 0.9), 3.3, 3.9, t);
  cel(ctx, () => ellipsePath(ctx, el, 2.8, 2.6), BRASS, { band: 0.5 });
}

function breastplate(ctx: CanvasRenderingContext2D, sk: Skeleton, p: GuardPose, t: number): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Mail skirt
    cel(ctx, () => polyPath(ctx, [vec(-7, len - 2), vec(8, len - 2.6), vec(8.6, len + 6.4), vec(-6.4, len + 6.8)]), IRON_DARK, { band: 0.8 });
    ctx.strokeStyle = IRON_DARK.shade;
    ctx.lineWidth = 0.35;
    for (let y = len; y < len + 6; y += 1.4) {
      ctx.beginPath();
      ctx.moveTo(-6.4, y);
      ctx.lineTo(8.2, y - 0.3);
      ctx.stroke();
    }
    // Barrel cuirass
    const chest = [vec(-8.4, -0.6), vec(-2, -2.6), vec(6, -1.4), vec(10.2, 3.4), vec(10.4, len * 0.55), vec(7.4, len - 1.4), vec(-6.4, len - 1), vec(-9, len * 0.45)];
    cel(ctx, () => blobPath(ctx, chest), IRON, { band: 2, hi: 1 });
    // Centre ridge + brass neck guard
    ctx.strokeStyle = IRON.light;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.quadraticCurveTo(8.6, len * 0.4, 6.2, len - 2);
    ctx.stroke();
    cel(ctx, () => blobPath(ctx, [vec(-6, -1.2), vec(-1, -4), vec(5.6, -2.8), vec(6.8, 0.6), vec(0, 0.4)]), BRASS, { band: 0.7 });
    // Furnace grate in the chest
    const g = vec(2, len * 0.5);
    cel(ctx, () => blobPath(ctx, [vec(g.x - 4.4, g.y - 3.6), vec(g.x + 4.6, g.y - 3.8), vec(g.x + 5, g.y + 3.6), vec(g.x - 4, g.y + 3.8)]), IRON_DARK, { band: 0.6 });
    const flick = 0.75 + Math.sin(t * Math.PI * 6) * 0.15;
    const a = Math.min(1, p.fire * flick);
    for (let i = 0; i < 3; i++) {
      const y = g.y - 2.2 + i * 2.2;
      ctx.fillStyle = `rgba(255,${150 + i * 25},70,${a})`;
      ctx.fillRect(g.x - 3.2, y - 0.55, 7.2, 1.1);
    }
    rivets(ctx, [vec(g.x - 3.6, g.y - 3), vec(g.x + 4, g.y - 3.2), vec(g.x - 3.4, g.y + 3.2), vec(g.x + 4.2, g.y + 3)], IRON);
    // Brass belt
    cel(ctx, () => polyPath(ctx, [vec(-7.4, len - 2.4), vec(8.8, len - 3), vec(9, len - 0.4), vec(-7.2, len + 0.2)]), LEATHER, { band: 0.4 });
    cel(ctx, () => polyPath(ctx, [vec(3.4, len - 3.2), vec(7, len - 3.4), vec(7.1, len + 0.2), vec(3.5, len + 0.4)]), BRASS, { band: 0.4 });
    // Fauld lames over the hips
    for (let i = 0; i < 2; i++) {
      const y = len + 0.6 + i * 2.6;
      cel(ctx, () => blobPath(ctx, [vec(-6.8 + i, y), vec(9.2 - i * 0.6, y - 0.4), vec(9.4 - i * 0.6, y + 2.8), vec(-6.4 + i, y + 3.2)]), IRON, { band: 0.7 });
    }
  });
}

function helm(ctx: CanvasRenderingContext2D, sk: Skeleton, p: GuardPose): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Gorget
  cel(ctx, () => blobPath(ctx, [vec(-5.4, 3.4), vec(5.6, 2.6), vec(6.6, 6.6), vec(-5, 7.2)]), IRON_DARK, { band: 0.7 });
  // Far horn (behind the shell)
  horn(ctx, vec(4.4, -6.6), -1, IRON_FAR);
  // Bucket helm with a slight forward prow
  const shell = [vec(-5.4, 4.6), vec(-6, -3), vec(-3.6, -7.4), vec(2.6, -7.8), vec(6.4, -4.6), vec(7.6, 0.6), vec(6.8, 5), vec(0, 5.8)];
  cel(ctx, () => polyPath(ctx, shell), IRON, { band: 1.4, hi: 0.7 });
  // Brass crest ridge and brow band
  cel(ctx, () => polyPath(ctx, [vec(-5.6, -3.6), vec(-3.4, -8.4), vec(3.4, -8.8), vec(3, -7.2), vec(-2.6, -6.8), vec(-4.2, -3.2)]), BRASS, { band: 0.5 });
  cel(ctx, () => polyPath(ctx, [vec(-6, -2.6), vec(7, -3.2), vec(7.4, -1.6), vec(-6, -1)]), BRASS, { band: 0.4 });
  // T-visor: black slot with the fire inside
  ctx.fillStyle = '#140a0a';
  ctx.beginPath();
  polyPath(ctx, [vec(1.4, -0.6), vec(7.6, -0.8), vec(7.6, 0.8), vec(5.4, 0.9), vec(5.4, 4.2), vec(3.8, 4.2), vec(3.8, 0.9), vec(1.4, 0.8)]);
  ctx.fill();
  if (p.fire > 0.05) {
    ctx.fillStyle = `rgba(255,170,70,${Math.min(1, p.fire)})`;
    ctx.fillRect(2.2, -0.25, 5, 0.6);
    ctx.fillRect(4.3, 0.6, 0.7, 3.2);
  }
  // Breathing holes
  ctx.fillStyle = IRON_DARK.base;
  for (const [x, y] of [[0.4, 2.6], [1.8, 2.8], [0.8, 3.8]] as const) ctx.fillRect(x, y, 0.6, 0.6);
  rivets(ctx, [vec(-4.4, -1.8), vec(-4.6, 2.6)], BRASS);
  // Near horn with a brass ring at the root
  horn(ctx, vec(-1.8, -3.4), 1, IRON);
  ctx.restore();
}

/** Curved iron bull horn sweeping back, out and up to a forward-hooked tip. */
function horn(ctx: CanvasRenderingContext2D, root: V, side: number, t: Tone): void {
  const k = side > 0 ? 1 : -0.9;
  const pts: V[] = [
    vec(root.x + 1.6, root.y + 1.4),
    vec(root.x - 5.4 * k, root.y + 0.4),
    vec(root.x - 9 * k, root.y - 3.6 * k),
    vec(root.x - 8.6 * k, root.y - 8.4 * k),
    vec(root.x - 6 * k, root.y - 11.4 * k),
    vec(root.x - 7 * k, root.y - 7.6 * k),
    vec(root.x - 6.4 * k, root.y - 4.2 * k),
    vec(root.x - 2.4, root.y - 2.4),
  ];
  cel(ctx, () => blobPath(ctx, pts), t, { band: 0.7 });
  ctx.strokeStyle = t.shade;
  ctx.lineWidth = 0.4;
  for (const [a, b] of [[1, 6], [2, 5]] as const) {
    const m1 = lerpV(pts[a], pts[b], 0.1);
    const m2 = lerpV(pts[a], pts[b], 0.9);
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.lineTo(m2.x, m2.y);
    ctx.stroke();
  }
}

function hammer(ctx: CanvasRenderingContext2D, at: V, angle: number, fire: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  // Haft, iron-banded, with a spiked pommel below the grip
  cel(ctx, () => capsulePath(ctx, vec(0, 5), vec(0, -HAM_LEN + 3), 1.1, 1.2), LEATHER, { band: 0.4 });
  for (const y of [-6, -12, -18]) {
    cel(ctx, () => polyPath(ctx, [vec(-1.5, y - 0.6), vec(1.5, y - 0.6), vec(1.5, y + 0.6), vec(-1.5, y + 0.6)]), IRON_DARK, { band: 0.2, stroke: 0.3 });
  }
  cel(ctx, () => polyPath(ctx, [vec(-1.6, 4.6), vec(1.6, 4.6), vec(0, 8)]), IRON, { band: 0.3, stroke: 0.35 });
  // Anvil head: flat striking face forward (+x), wedge back
  ctx.translate(0, -HAM_LEN);
  const head = [vec(-9.6, -1.8), vec(-4, -4.4), vec(8.4, -5.4), vec(9, -3.8), vec(9, 3.8), vec(8.4, 5.4), vec(-4, 4.4), vec(-9.6, 1.8)];
  cel(ctx, () => polyPath(ctx, head), IRON, { band: 1.3, hi: 0.6 });
  cel(ctx, () => polyPath(ctx, [vec(-4.4, -4.8), vec(-1.4, -5.2), vec(-1.4, 5.2), vec(-4.4, 4.8)]), BRASS, { band: 0.4 });
  cel(ctx, () => polyPath(ctx, [vec(7.2, -5.8), vec(9.6, -5.8), vec(9.6, 5.8), vec(7.2, 5.8)]), IRON_DARK, { band: 0.4 });
  // Forge rune on the cheek
  ctx.strokeStyle = `rgba(255,150,60,${0.4 + fire * 0.6})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(3, -3);
  ctx.lineTo(5, 0);
  ctx.lineTo(3, 3);
  ctx.lineTo(1, 0);
  ctx.closePath();
  ctx.moveTo(3, -1.2);
  ctx.lineTo(3, 1.2);
  ctx.stroke();
  ctx.restore();
}

function tabard(ctx: CanvasRenderingContext2D, sk: Skeleton, p: GuardPose, t: number): void {
  // Scorched charcoal tabard hanging from the belt, swaying with the stride
  const c = Math.cos(sk.torsoAng * 0.6);
  const sn = Math.sin(sk.torsoAng * 0.6);
  const at = (x: number, y: number): V => vec(sk.pelvis.x + x * c - y * sn, sk.pelvis.y + x * sn + y * c);
  const ph = t * Math.PI * 2;
  const l = clothChain(at(0.6, 0.4), 13, 3, 0.1 + p.flow * 0.8, 0.8, ph);
  const r = clothChain(at(7.6, 0), 12.4, 3, 0.1 + p.flow * 0.8, 0.8, ph + 0.7);
  const endL = l[l.length - 1];
  const endR = r[r.length - 1];
  const pts: V[] = [...l, vec(lerpV(endL, endR, 0.3).x, lerpV(endL, endR, 0.3).y - 2), lerpV(endL, endR, 0.55), vec(lerpV(endL, endR, 0.8).x, lerpV(endL, endR, 0.8).y - 1.6), ...r.slice().reverse()];
  cel(ctx, () => polyPath(ctx, pts), CLOTH, { band: 1 });
  // Brass anvil emblem
  const e = lerpV(lerpV(l[1], r[1], 0.5), lerpV(l[2], r[2], 0.5), 0.3);
  cel(ctx, () => polyPath(ctx, [vec(e.x - 2.6, e.y - 1.2), vec(e.x + 2.8, e.y - 1.2), vec(e.x + 1.4, e.y + 0.2), vec(e.x + 1.4, e.y + 1.4), vec(e.x - 1.4, e.y + 1.4), vec(e.x - 1.4, e.y + 0.2)]), BRASS, { band: 0.3, stroke: 0.35 });
}

/** Two forge chimneys bolted to the back plate (bone-local positions). */
const STACKS: readonly { base: V; top: V; r: number }[] = [
  { base: vec(-6.6, 8), top: vec(-11.6, -9), r: 2 },
  { base: vec(-7.4, 10), top: vec(-14.6, -3.6), r: 1.6 },
];

function stackTop(sk: Skeleton, i: number): V {
  const st = STACKS[i];
  const ang = Math.atan2(sk.pelvis.y - sk.neck.y, sk.pelvis.x - sk.neck.x) - Math.PI / 2;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  return vec(sk.neck.x + st.top.x * c - st.top.y * sn, sk.neck.y + st.top.x * sn + st.top.y * c);
}

function smokestacks(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, () => {
    for (const st of STACKS) {
      cel(ctx, () => capsulePath(ctx, st.base, st.top, st.r, st.r * 1.05), IRON_DARK, { band: 0.6 });
      const cap = lerpV(st.base, st.top, 0.94);
      cel(ctx, () => ellipsePath(ctx, cap, st.r * 1.5, st.r * 1.1, Math.atan2(st.top.y - st.base.y, st.top.x - st.base.x) + Math.PI / 2), BRASS, { band: 0.4 });
      ctx.fillStyle = '#1a0e0a';
      ctx.beginPath();
      ctx.ellipse(st.top.x, st.top.y, st.r * 0.9, st.r * 0.55, Math.atan2(st.top.y - st.base.y, st.top.x - st.base.x) + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

const SKIN: HumanSkin = {
  back(ctx, sk) {
    smokestacks(ctx, sk);
  },
  prop: {
    thigh: 12.5, shin: 12.5, upperArm: 11, foreArm: 11,
    torso: 18.5, neck: 6.4, ankle: 2.6,
    hipN: vec(3.4, 0), hipF: vec(-3.6, -0.5),
    shN: vec(0.4, 2.6), shF: vec(-7.6, 2.2),
  },
  armFar(ctx, sk, p) {
    const g = p as GuardPose;
    pauldron(ctx, sk.shF, sk.elF, IRON_FAR, tone(0x8a6a3c), 1.05);
    armouredArm(ctx, sk.shF, sk.elF, sk.handF, IRON_FAR, g.fire);
    gauntlet(ctx, sk.handF, IRON_FAR);
  },
  legFar(ctx, sk, p) {
    armouredLeg(ctx, sk, false, (p as GuardPose).fire);
  },
  legNear(ctx, sk, p) {
    armouredLeg(ctx, sk, true, (p as GuardPose).fire);
  },
  torso(ctx, sk, p, t) {
    breastplate(ctx, sk, p as GuardPose, t);
    tabard(ctx, sk, p as GuardPose, t);
  },
  head(ctx, sk, p) {
    helm(ctx, sk, p as GuardPose);
  },
  armNear(ctx, sk, p) {
    armouredArm(ctx, sk.shN, sk.elN, sk.handN, IRON, (p as GuardPose).fire);
    pauldron(ctx, sk.shN, sk.elN, STEEL, BRASS, 1.25);
  },
  weapon(ctx, sk, p) {
    hammer(ctx, sk.handN, p.wpn, (p as GuardPose).fire);
    gauntlet(ctx, sk.handN, IRON);
  },
};

// ── Isometric 3/4 views ─────────────────────────────────────────────────

const GUARD_BUILD = { hipW: 4, shW: 8.6, elbowOut: 1.8, footOut: 0.8 };
const CHEST = (len: number): V[] => [vec(-8.4, -0.6), vec(-2, -2.6), vec(6, -1.4), vec(10.2, 3.4), vec(10.4, len * 0.55), vec(7.4, len - 1.4), vec(-6.4, len - 1), vec(-9, len * 0.45)];
const guardRings = (len: number): ReturnType<typeof profileRings> => profileRings(CHEST(len), y => len - y, a => a * 0.95, 8);
const GRATE = { hk: 0.5, phi: 0.25 };
const HELM = profileRings([vec(-5.4, 4.6), vec(-6, -3), vec(-3.6, -7.4), vec(2.6, -7.8), vec(6.4, -4.6), vec(7, 0.6), vec(6.4, 5), vec(0, 5.8)], y => -y, a => a * 1.02, 7);
const VISOR_H = 1.6;

/** Tabard panel hanging from the belt, front (+1) or back (−1). */
function tabardPanel(_len: number, s: 1 | -1, R: ReturnType<typeof guardRings>, p: HumanPose, t: number): L3[] {
  const r = R[R.length - 1];
  const fr = (r.f ?? 0) + s * (r.a + 1.2);
  const ph = t * Math.PI * 2;
  const sw = (Math.sin(ph) * 0.5 - p.flow * 2.4) * (s > 0 ? 1 : -1);
  return [[1, fr, -3.4], [1, fr, 3.4], [-11, fr + s * 1 + sw, 3.2], [-9.4, fr + s * 0.8 + sw, 1], [-11.6, fr + s * 1 + sw, -0.6], [-9.6, fr + s * 0.8 + sw, -3.2]];
}

function guardTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const gp = p as GuardPose;
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = guardRings(len);
  const front = T.vis(0) > T.vis(Math.PI);
  // Mail skirt below the cuirass
  const mail = [{ h: 2, a: 8, b: 7.6, f: 0.6 }, { h: -5.6, a: 8.4, b: 8, f: 0.2 - p.flow }];
  poly3(ctx, T, tabardPanel(len, front ? -1 : 1, R, p, t), CLOTH, { band: 1 });
  loftFill(ctx, T, mail, IRON_DARK, { band: 0.8 });
  for (let h = 1; h > -5.4; h -= 1.4) band(ctx, T, mail, h, { ...IRON_DARK, base: IRON_DARK.shade, line: 'rgba(0,0,0,0)' }, 0.35, 0.05);
  solid3(ctx, T, R, IRON, {
    band: 2,
    hi: 1,
    face: () => {
      strap(ctx, T, R, [[len, 0.1], [len * 0.55, 0.2], [2, 0.15]], { ...IRON, base: IRON.light, line: 'rgba(0,0,0,0)' }, 0.8, 0.1);
      // Furnace grate
      const flick = 0.75 + Math.sin(t * Math.PI * 6) * 0.15;
      const a = Math.min(1, gp.fire * flick);
      decal(ctx, T, R, len * GRATE.hk, GRATE.phi, () => {
        cel(ctx, () => blobPath(ctx, [vec(-4.4, -3.6), vec(4.6, -3.8), vec(5, 3.6), vec(-4, 3.8)]), IRON_DARK, { band: 0.6 });
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = `rgba(255,${150 + i * 25},70,${a})`;
          ctx.fillRect(-3.2, -2.2 + i * 2.2 - 0.55, 7.2, 1.1);
        }
        rivets(ctx, [vec(-3.6, -3), vec(4, -3.2), vec(-3.4, 3.2), vec(4.2, 3)], IRON);
      }, { lift: 0.2, minVis: 0.02 });
    },
    over: () => {
      // Brass neck guard, belt and fauld lames
      loftFill(ctx, T, ringsBetween(R, len - 1.2, len + 1.6, 0.6, 0.95), BRASS, { band: 0.7 });
      band(ctx, T, R, 1.4, LEATHER, 2.4, 0.4);
      decal(ctx, T, R, 1.4, 0.35, () => cel(ctx, () => polyPath(ctx, [vec(-1.8, -1.6), vec(1.8, -1.6), vec(1.8, 1.8), vec(-1.8, 1.8)]), BRASS, { band: 0.4 }), { lift: 0.8, minVis: 0.05 });
      const r0 = R[R.length - 1];
      for (let i = 0; i < 2; i++) {
        const fl = [{ h: 0.2 - i * 2.6, a: r0.a + 0.8 + i * 0.3, b: r0.b + 0.8 + i * 0.3, f: r0.f }, { h: -2.6 - i * 2.6, a: r0.a + 1.2 + i * 0.3, b: r0.b + 1.2 + i * 0.3, f: r0.f }];
        loftFill(ctx, T, fl, IRON, { band: 0.7 });
      }
      const panel = tabardPanel(len, front ? 1 : -1, R, p, t);
      poly3(ctx, T, panel, CLOTH, { band: 1 });
      if (front) {
        // Brass anvil emblem on the tabard
        const e = sp(T, -3, panel[0][1] + 0.3, 0);
        cel(ctx, () => polyPath(ctx, [vec(e.x - 2.6, e.y - 1.2), vec(e.x + 2.8, e.y - 1.2), vec(e.x + 1.4, e.y + 0.2), vec(e.x + 1.4, e.y + 1.4), vec(e.x - 1.4, e.y + 1.4), vec(e.x - 1.4, e.y + 0.2)]), BRASS, { band: 0.3, stroke: 0.35 });
      }
    },
  });
}

function guardHelmView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  const gp = p as GuardPose;
  const H = turnedHead(sk, 0.3);
  const R = HELM;
  const horn = (s: 1 | -1): L3[] => [[3, -1, 5.4 * s], [3.6, -3, 9.4 * s], [7, -4, 11.6 * s], [11.4, -2.6, 11 * s], [13.6, 0.6, 9.4 * s]];
  const deep = (s: 1 | -1): boolean => H.rig.d(lp(H, 7, -3, 11 * s)) < H.rig.d(H.o);
  const drawHorn = (s: 1 | -1): void => {
    tube3(ctx, H, horn(s), [1.9, 1.7, 1.3, 0.9, 0.35], s > 0 ? IRON : IRON_FAR);
    const b = sp(H, 3, -1, 5.4 * s);
    cel(ctx, () => ellipsePath(ctx, b, 2, 2), BRASS, { band: 0.4 });
  };
  // Gorget
  loftFill(ctx, H, [{ h: -3.4, a: 5.4, b: 5.4, f: 0.4 }, { h: -7, a: 6.6, b: 6.6, f: 0.6 }], IRON_DARK, { band: 0.7 });
  for (const s of [1, -1] as const) if (deep(s)) drawHorn(s);
  solid3(ctx, H, R, IRON, {
    band: 1.4,
    hi: 0.7,
    face: () => {
      strap(ctx, H, R, [[3, -Math.PI], [7.4, -Math.PI / 2], [8.2, 0], [7.4, Math.PI / 2], [3, Math.PI]], BRASS, 1.2, 0.3);
      band(ctx, H, R, 2.6, BRASS, 1.4, 0.3);
      if (H.vis(0) < -0.2) return;
      // T-visor slot with the fire inside
      decal(ctx, H, R, VISOR_H, 0, () => {
        ctx.fillStyle = '#140a0a';
        ctx.beginPath();
        polyPath(ctx, [vec(-3.2, -0.8), vec(3.2, -0.8), vec(3.2, 0.8), vec(0.8, 0.8), vec(0.8, 4.2), vec(-0.8, 4.2), vec(-0.8, 0.8), vec(-3.2, 0.8)]);
        ctx.fill();
        if (gp.fire > 0.05) {
          ctx.fillStyle = `rgba(255,170,70,${Math.min(1, gp.fire)})`;
          ctx.fillRect(-2.5, -0.3, 5, 0.6);
          ctx.fillRect(-0.35, 0.6, 0.7, 3.2);
        }
      }, { lift: 0.1, minVis: 0.02 });
      for (const [h, phi] of [[-1.4, -0.7], [-1.6, -0.45], [-2.6, -0.6], [-1.4, 0.7], [-1.6, 0.45], [-2.6, 0.6]] as const) {
        if (surfVis(H, R, h, phi) < 0.05) continue;
        const q = surf(H, R, h, phi, 0.1);
        ctx.fillStyle = IRON_DARK.base;
        ctx.fillRect(q.x - 0.3, q.y - 0.3, 0.6, 0.6);
      }
    },
  });
  for (const s of [1, -1] as const) if (!deep(s)) drawHorn(s);
}

/** Forge chimneys bolted to the back plate. */
function stackPts(sk: ViewSkeleton, i: number): L3[] {
  const len = sk.torsoLen;
  const R = guardRings(len);
  const r = R[2];
  const back = (r.f ?? 0) - r.a * 0.85;
  return i === 0 ? [[len - 8, back, -2.6], [len + 9, back - 5, -3.4]] : [[len - 10, back, 2.8], [len + 3.6, back - 7.4, 3.6]];
}

function guardExtra(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, _p: HumanPose, _t: number, d0: number): ViewPart[] {
  return [0, 1].map(i => ({
    z: sk.torso.depth(sk.torsoLen, Math.PI, 8, 0) - d0,
    draw: () => {
      const pts = stackPts(sk, i);
      const r = i === 0 ? 2 : 1.6;
      tube3(ctx, sk.torso, pts, [r, r * 1.05], IRON_DARK);
      const top = sp(sk.torso, pts[1][0], pts[1][1], pts[1][2]);
      cel(ctx, () => ellipsePath(ctx, top, r * 1.5, r * 0.9), BRASS, { band: 0.4 });
      ctx.fillStyle = '#1a0e0a';
      ctx.beginPath();
      ctx.ellipse(top.x, top.y, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  }));
}

const GUARD_VIEW = monsterViewSkin(SKIN, {
  build: GUARD_BUILD,
  headBias: 9,
  torso: guardTorsoView,
  head: guardHelmView,
  back: () => undefined,
  extra: guardExtra,
  // Pauldrons a size down: seen from the front they'd swallow the helm.
  armNear: (ctx, sk, p) => {
    armouredArm(ctx, sk.shN, sk.elN, sk.handN, IRON, (p as GuardPose).fire);
    pauldron(ctx, sk.shN, sk.elN, STEEL, BRASS, 0.85);
  },
  armFar: (ctx, sk, p) => {
    pauldron(ctx, sk.shF, sk.elF, IRON_FAR, tone(0x8a6a3c), 0.8);
    armouredArm(ctx, sk.shF, sk.elF, sk.handF, IRON_FAR, (p as GuardPose).fire);
    gauntlet(ctx, sk.handF, IRON_FAR);
  },
});

/** Two-handed haft in 3/4: the far hand crosses over to the near side. */
function viewPose(p: GuardPose, t: number, act: MonsterAction): GuardPose {
  const gripping = act !== 'death' || t < 0.5;
  return gripping ? { ...p, zF: GUARD_BUILD.shW * 2 - 2 } : p;
}

function drawFxView(ctx: CanvasRenderingContext2D, p0: GuardPose, act: MonsterAction, t: number, view: HumanView): void {
  const p = viewPose(p0, t, act);
  const vsk = solveViewSkeleton(p, SKIN.prop, GUARD_BUILD, view);
  sagittalSpun(ctx, vsk, p, () => drawFx(ctx, p, act, t, true));
  const fire = p.fire;
  if (fire <= 0.02) return;
  const T = vsk.torso;
  const R = guardRings(vsk.torsoLen);
  const hc = vsk.torsoLen * GRATE.hk;
  if (surfVis(T, R, hc, GRATE.phi) > 0.05) glow(ctx, surf(T, R, hc, GRATE.phi, 0.4), 6 + p.fx * 2, FIRE, 0.35 * fire);
  const H = turnedHead(vsk, 0.3);
  if (H.vis(0) > 0.1) glow(ctx, surf(H, HELM, VISOR_H, 0, 0.3), 3.4 + p.fx, FIRE, 0.55 * Math.min(1, fire));
  // Flames licking out of the crown of the helm
  const up = vsk.rig.vec(H.up.x, H.up.y, 0);
  const crown0 = surf(H, HELM, 7.6, 0, 0);
  const crown = vec(crown0.x + up.x * 1.2, crown0.y + up.y * 1.2);
  const f = Math.min(1, fire);
  const back = vsk.rig.fwd;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const ph = t * Math.PI * 2 * 2 + i * 2.1;
    const h = (7 + Math.sin(ph) * 1.6 + p.fx * 3 - i * 1.6) * f;
    const bx = crown.x - 1.6 + i * 1.6;
    const tipX = bx - back.x * (1.6 + p.flow * 4) + Math.sin(ph + 1) * 1.2;
    ctx.fillStyle = i === 1 ? `rgba(255,214,140,${0.75 * f})` : `rgba(255,120,40,${0.6 * f})`;
    ctx.beginPath();
    ctx.moveTo(bx - 1.8, crown.y + 1);
    ctx.quadraticCurveTo(bx - 2, crown.y - h * 0.5, tipX, crown.y - h);
    ctx.quadraticCurveTo(bx + 1.6, crown.y - h * 0.4, bx + 1.8, crown.y + 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 2; i++) {
    const pts = stackPts(vsk, i);
    const top = sp(T, pts[1][0], pts[1][1], pts[1][2]);
    for (let j = 0; j < 3; j++) {
      const k = (j / 3 + t + i * 0.17) % 1;
      const pos = vec(top.x - back.x * k * (4 + p.flow * 6), top.y - 1 - k * 9);
      ctx.fillStyle = `rgba(70,66,76,${0.45 * (1 - k) * f})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.4 + k * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    glow(ctx, top, 2.2, FIRE, 0.5 * f);
  }
  for (const j of [vsk.kneeN, vsk.elN, vsk.kneeF]) glow(ctx, j, 2.4, FIRE, 0.3 * f);
}

// ── Poses ───────────────────────────────────────────────────────────────

/** Both hands on the haft: the far hand grips a little further up. */
function grip(p: GuardPose, gap = 5.5): GuardPose {
  return { ...p, handF: along(p.handN, p.wpn, gap) };
}

// Sentinel stance: hammer head planted, both gauntlets on the haft.
const READY: GuardPose = {
  ...basePose({
    root: vec(CENTER_X - 2, 66.5),
    lean: 0.06,
    head: -0.04,
    footN: vec(CENTER_X + 6, GROUND_Y),
    footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 13, 63),
    wpn: Math.PI - 0.12,
    flow: 0.1,
  }),
  fire: 1,
};

const P = (o: Partial<GuardPose>): GuardPose => ({ ...READY, ...o });

const ATTACK: Key<GuardPose>[] = [
  { at: 0, pose: READY },
  // Heave the hammer up and back over the shoulder, rearing onto the back foot
  { at: 0.33, ease: 'out', pose: P({ root: vec(CENTER_X - 5, 67), lean: -0.18, head: -0.12, handN: vec(CENTER_X + 1, 49), wpn: -1.25, footN: vec(CENTER_X + 7, GROUND_Y), stretch: 0.05, flow: 0.4, fx: 0.3 }) },
  // Over the top
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X, 67), lean: 0.22, head: 0, handN: vec(CENTER_X + 11, 46), wpn: 0.75, footN: vec(CENTER_X + 11, GROUND_Y), flow: 0.45, fx: 0.8 }) },
  // SLAM
  { at: 1, ease: 'linear', pose: P({ root: vec(CENTER_X + 4, 71), lean: 0.55, head: 0.12, handN: vec(CENTER_X + 21, 72), wpn: 2.0, footN: vec(CENTER_X + 14, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y), flow: 0.55, fx: 1, stretch: -0.05 }) },
];

const recoil = P({ root: vec(CENTER_X - 6, 67.5), lean: -0.22, head: -0.3, handN: vec(CENTER_X + 7, 60), wpn: 2.5, footF: vec(CENTER_X - 11, GROUND_Y), flow: 0.5, fire: 1.4, stretch: -0.03 });

const HURT: Key<GuardPose>[] = [
  { at: 0, pose: recoil },
  { at: 1, pose: P({ root: vec(CENTER_X - 4, 67), lean: -0.06, head: -0.12, handN: vec(CENTER_X + 11, 62), wpn: 2.8, flow: 0.3, fire: 1.1 }) },
];

// The fire gutters out; it drops to one knee, sags forward and crashes down.
const DEATH: Key<GuardPose>[] = [
  { at: 0, pose: { ...recoil, fire: 1.2 } },
  { at: 0.33, pose: P({ root: vec(CENTER_X - 3, 76), lean: 0.3, head: 0.3, footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 12, GROUND_Y), handN: vec(CENTER_X + 12, 65), wpn: 2.75, flow: 0.25, fire: 0.6 }) },
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X - 4, 80), lean: 0.2, head: 0.3, spin: 0.8, footN: vec(CENTER_X - 3, 102), footF: vec(CENTER_X - 7, 102), handN: vec(CENTER_X + 4, 60), wpn: 1.2, flow: 0.15, fire: 0.25 }) },
  { at: 1, ease: 'out', pose: P({ root: vec(CENTER_X - 9, 82), lean: 0.05, head: 0.2, spin: 1.5, footN: vec(CENTER_X - 8, 104.5), footF: vec(CENTER_X - 11, 105), handN: vec(CENTER_X - 1, 68), wpn: 0.1, flow: 0.05, fire: 0 }) },
];

function idle(t: number): GuardPose {
  const ph = t * Math.PI * 2;
  const b = Math.sin(ph);
  return {
    ...READY,
    root: vec(READY.root.x, READY.root.y + b * 0.5),
    stretch: b * -0.012,
    head: READY.head + Math.sin(ph - 0.6) * 0.03,
    handN: vec(READY.handN.x, READY.handN.y + b * 0.35),
    flow: READY.flow + Math.sin(ph) * 0.06,
  };
}

function walk(t: number): GuardPose {
  const g = gait(t, { stride: 6, lift: 3, bob: 1.6, rootY: READY.root.y + 0.4, footSpread: 1.4 });
  const ph = t * Math.PI * 2;
  return {
    ...READY,
    root: vec(READY.root.x, g.rootY),
    lean: 0.12,
    // Hammer carried at port-arms, head high in front
    footN: vec(g.footN.x - 1, g.footN.y),
    footF: vec(g.footF.x - 1, g.footF.y),
    handN: vec(CENTER_X + 9 - g.swing * 1.2, 68 + Math.abs(g.swing) * 0.6),
    wpn: 0.42 - g.swing * 0.05,
    flow: 0.3 + Math.sin(ph * 2) * 0.08,
  };
}

function guardPose(act: MonsterAction, t: number): GuardPose {
  switch (act) {
    case 'idle': return grip(idle(t), 3.5);
    case 'walk': return grip(walk(t));
    case 'attack': return grip(samplePoseTrack(ATTACK, t));
    case 'hurt': return grip(samplePoseTrack(HURT, t));
    case 'death': {
      const p = samplePoseTrack(DEATH, t);
      // Grip loosens as it falls
      return { ...p, handF: t < 0.5 ? along(p.handN, p.wpn, 5.5) : vec(p.root.x - 6, p.root.y - 8) };
    }
  }
}

function hammerHead(p: GuardPose): { tip: V; base: V } {
  const sk = solveSkeleton(p, SKIN.prop);
  const hand = spun(p, sk.handN, sk);
  return { tip: along(hand, p.wpn + p.spin, HAM_LEN + 7), base: along(hand, p.wpn + p.spin, HAM_LEN - 7) };
}

function drawFx(ctx: CanvasRenderingContext2D, p: GuardPose, act: MonsterAction, t: number, groundOnly = false): void {
  const sk = solveSkeleton(p, SKIN.prop);
  const fire = p.fire;
  if (act === 'attack' && t > 0.9) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const s = hammerHead(grip(samplePoseTrack(ATTACK, Math.max(0.67, t - i * 0.055))));
      tips.push(s.tip);
      bases.push(s.base);
    }
    smear(ctx, tips, bases, FIRE, 0.35);
    // Shockwave + sparks where the anvil head lands
    const hit = vec(along(sk.handN, p.wpn, HAM_LEN).x + 4, GROUND_Y - 1);
    glow(ctx, hit, 9, FIRE, 0.5);
    glow(ctx, hit, 4, HOT, 0.7);
    ctx.strokeStyle = 'rgba(255,200,120,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(hit.x, hit.y + 0.6, 13, 2.6, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#ffd89a';
    for (const [dx, dy] of [[-9, -7], [-4, -11], [3, -12], [8, -8], [11, -4], [-12, -3]] as const) {
      ctx.fillRect(hit.x + dx, hit.y + dy, 1, 1);
    }
  }
  if (fire <= 0.02 || groundOnly) return;
  // Chest furnace and visor glow
  const chest = spun(p, lerpV(sk.neck, sk.pelvis, 0.42), sk);
  glow(ctx, vec(chest.x + 2, chest.y + 1), 6 + p.fx * 2, FIRE, 0.35 * fire);
  const visor = spun(p, vec(sk.head.x + Math.cos(sk.headAng) * 4.6, sk.head.y + Math.sin(sk.headAng) * 4.6), sk);
  glow(ctx, visor, 3.4 + p.fx, FIRE, 0.55 * Math.min(1, fire));
  // Flames licking out of the crown of the helm
  const crown = spun(p, along(sk.head, sk.headAng, 7.6), sk);
  const f = Math.min(1, fire);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const ph = t * Math.PI * 2 * 2 + i * 2.1;
    const h = (7 + Math.sin(ph) * 1.6 + p.fx * 3 - i * 1.6) * f;
    const bx = crown.x - 1.6 + i * 1.6;
    const tipX = bx - 1.6 - p.flow * 4 + Math.sin(ph + 1) * 1.2;
    ctx.fillStyle = i === 1 ? `rgba(255,214,140,${0.75 * f})` : `rgba(255,120,40,${0.6 * f})`;
    ctx.beginPath();
    ctx.moveTo(bx - 1.8, crown.y + 1);
    ctx.quadraticCurveTo(bx - 2, crown.y - h * 0.5, tipX, crown.y - h);
    ctx.quadraticCurveTo(bx + 1.6, crown.y - h * 0.4, bx + 1.8, crown.y + 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const k = (i / 3 + t * 1.5) % 1;
    glow(ctx, vec(crown.x - k * (3 + p.flow * 5) + Math.sin(i * 2.4 + t * 12) * 1.4, crown.y - 6 - k * 8), 1.4, FIRE, 0.9 * (1 - k) * f);
  }
  // Smoke and sparks venting from the back chimneys
  for (let i = 0; i < STACKS.length; i++) {
    const top = spun(p, stackTop(sk, i), sk);
    for (let j = 0; j < 3; j++) {
      const k = (j / 3 + t + i * 0.17) % 1;
      const pos = vec(top.x - k * (4 + p.flow * 6) - i, top.y - 1 - k * 9);
      ctx.fillStyle = `rgba(70,66,76,${0.45 * (1 - k) * f})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.4 + k * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    glow(ctx, top, 2.2, FIRE, 0.5 * f);
  }
  // Seam embers
  for (const j of [sk.kneeN, sk.elN, sk.kneeF]) {
    glow(ctx, spun(p, j, sk), 2.4, FIRE, 0.3 * Math.min(1, fire));
  }
}

export const IronGuardianDrawer = rigMonster<GuardPose>({
  key: 'monster_iron_guardian',
  // Wide for the hammer slam reach; width doesn't move the sprite in-game.
  frameW: 104,
  frameH: 72,
  scale: 1.25,
  views: MONSTER_VIEWS,
  pose: guardPose,
  draw: (ctx, p, act, t, view) => {
    if (view) drawHumanoidView(ctx, viewPose(p, t, act), GUARD_VIEW, t, view);
    else drawHumanoid(ctx, p, SKIN, t);
  },
  shadow: (p, _act, _t, view) => ({
    x: groundX(view, Math.abs(p.spin) > 1 ? p.root.x + 8 : p.root.x + 2),
    r: Math.abs(p.spin) > 1 ? 22 : 16,
    lift: Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y)),
  }),
  fx: (ctx, p, act, t, view) => (view ? drawFxView(ctx, p, act, t, view) : drawFx(ctx, p, act, t)),
  rim: 'rgba(255,214,170,0.55)',
});
