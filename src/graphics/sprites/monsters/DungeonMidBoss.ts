// src/graphics/sprites/monsters/DungeonMidBoss.ts
//
// 深渊守卫 — the labyrinth's warden: a towering knight in abyss-forged
// plate, violet light bleeding through every seam, a horned greathelm with
// a burning visor, spiked layered pauldrons, a tattered cape and a notched
// abyssal greatsword runed along its fuller. Hauls the blade far back and
// brings it down in a crushing cleave.
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
import { basePose, solveSkeleton, spun, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster, humanoidTracks, type HumanoidMonsterSpec } from '../rig/MonsterKit';
import type { ViewPart, ViewSkeleton } from '../rig/HumanView';
import type { MonsterAction } from '../types';
import {
  band,
  decal,
  loftFill,
  lp,
  poly3,
  profileRings,
  ringsBetween,
  sagittalSpun,
  solid3,
  strap,
  surf,
  surfCurve,
  surfVis,
  turnedHead,
  type L3,
} from '../rig/MonsterView';

const PLATE = tone(0x464060, { light: 0.55, shadow: 0.5 });
const PLATE_FAR = tone(0x2e283e, { light: 0.25 });
const UNDER = tone(0x241e30, { light: 0.25 });
const UNDER_FAR = tone(0x17131f);
const TRIM = tone(0xb08cff, { light: 0.5 });
const HORN = tone(0x2a2230, { light: 0.45, shadow: 0.3 });
const CAPE = tone(0x4a1430, { light: 0.25 });
const CAPE_IN = tone(0x2a0a1e, { light: 0.15 });
const BLADE = tone(0x5a5470, { light: 0.55, shadow: 0.35 });
const EDGE = '#d8d0ff';
const SEAM = '#c89bff';
const VOID = 0xaa55ff;
const EMBER = 0xff7a1a;

const BLADE_LEN = 27;

function headPt(sk: Skeleton, l: V): V {
  const c = Math.cos(sk.headAng);
  const s = Math.sin(sk.headAng);
  return vec(sk.head.x + l.x * c - l.y * s, sk.head.y + l.x * s + l.y * c);
}

// ── Armour pieces ───────────────────────────────────────────────────────

function sabaton(ctx: CanvasRenderingContext2D, ankle: V, sole: V, t: Tone): void {
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 3.2, ankle.y - 1.6), vec(ankle.x + 2.4, ankle.y - 2.4),
    vec(sole.x + 7, sole.y - 1.8), vec(sole.x + 7.6, sole.y), vec(sole.x - 3.4, sole.y),
  ]), t, { band: 1 });
}

function leg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, far: boolean): void {
  const plate = far ? PLATE_FAR : PLATE;
  limb(ctx, hip, knee, 5.2, 4.3, far ? UNDER_FAR : UNDER);
  cel(ctx, () => capsulePath(ctx, lerpV(hip, knee, 0.12), lerpV(hip, knee, 0.85), 4.7, 3.8), plate, { band: 1.3 });
  limb(ctx, knee, ankle, 4.1, 3.1, plate);
  // Spiked poleyn
  cel(ctx, () => ellipsePath(ctx, vec(knee.x + 1, knee.y), 3.4, 2.9), plate, { band: 0.9 });
  cel(ctx, () => polyPath(ctx, [vec(knee.x + 2.6, knee.y - 1.4), vec(knee.x + 6.2, knee.y - 0.4), vec(knee.x + 2.8, knee.y + 1.2)]), far ? UNDER_FAR : UNDER, { band: 0.3, stroke: 0.4 });
  sabaton(ctx, ankle, sole, plate);
  if (!far) {
    ctx.strokeStyle = SEAM;
    ctx.lineWidth = 0.5;
    const a = lerpV(knee, ankle, 0.3);
    const b = lerpV(knee, ankle, 0.8);
    ctx.beginPath();
    ctx.moveTo(a.x + 1.2, a.y);
    ctx.lineTo(b.x + 1, b.y);
    ctx.stroke();
  }
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const plate = far ? PLATE_FAR : PLATE;
  limb(ctx, sh, el, 3.8, 3.3, far ? UNDER_FAR : UNDER);
  limb(ctx, lerpV(sh, el, 0.35), el, 3.5, 3.2, plate);
  // Flared vambrace
  cel(ctx, () => capsulePath(ctx, el, hand, 3.3, 3), plate, { band: 1 });
  cel(ctx, () => ellipsePath(ctx, el, 2.8, 2.8), far ? UNDER_FAR : UNDER, { band: 0.7 });
}

function gauntlet(ctx: CanvasRenderingContext2D, hand: V, far: boolean): void {
  cel(ctx, () => ellipsePath(ctx, hand, 3.2, 3), far ? UNDER_FAR : UNDER, { band: 0.9 });
  ctx.fillStyle = far ? PLATE_FAR.light : PLATE.light;
  ctx.fillRect(hand.x - 1.8, hand.y - 2, 3, 1);
}

function pauldron(ctx: CanvasRenderingContext2D, sh: V, lean: number, far: boolean, size = 1.2): void {
  const plate = far ? PLATE_FAR : PLATE;
  ctx.save();
  ctx.translate(sh.x - 0.6, sh.y - 1.8);
  ctx.rotate(lean * 0.6);
  ctx.scale(size, size);
  // Spikes on top
  for (const [x, h] of [[-3, 6.5], [0.6, 8], [3.8, 5.5]] as const) {
    cel(ctx, () => polyPath(ctx, [vec(x - 1.4, -2.6), vec(x - 0.8, -2.6 - h), vec(x + 1.3, -2.8)]), far ? tone(0x201a28) : HORN, { band: 0.4, stroke: 0.4 });
  }
  for (let i = 2; i >= 0; i--) {
    const y = i * 2.6;
    cel(ctx, () => ellipsePath(ctx, vec(0.4, y), 6.8 - i * 0.8, 4.2 - i * 0.4), i === 0 ? plate : (far ? UNDER_FAR : UNDER), { band: 1.1 });
  }
  ctx.strokeStyle = far ? TRIM.shade : TRIM.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0.4, 0, 6.3, 3.8, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  if (!far) {
    ctx.fillStyle = SEAM;
    ctx.beginPath();
    ctx.arc(1.6, -0.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function cape(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const anchor = along(sk.neck, p.lean - 1.45, 4.8);
  const chain = clothChain(vec(anchor.x, anchor.y + 1.5), 30, 6, p.flow, 1, t * Math.PI * 2);
  const left: V[] = [];
  const right: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    const half = 3.4 + k * 5.4;
    left.push(vec(pt.x - half * 0.9, pt.y));
    right.push(vec(pt.x + half * 0.6, pt.y + k * 0.8));
  });
  // Tattered hem: sawtooth between the two bottom corners
  const a = left[left.length - 1];
  const b = right[right.length - 1];
  const hem: V[] = [];
  for (let i = 1; i < 5; i++) {
    const m = lerpV(a, b, i / 5);
    hem.push(vec(m.x, m.y + (i % 2 === 0 ? -3.4 : 0.8)));
  }
  const outline = [...left, ...hem, ...right.reverse()];
  cel(ctx, () => polyPath(ctx, outline), CAPE_IN, { band: 1.4 });
}

function cuirass(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  ctx.save();
  ctx.translate(sk.neck.x, sk.neck.y);
  ctx.rotate(Math.atan2(sk.pelvis.y - sk.neck.y, sk.pelvis.x - sk.neck.x) - Math.PI / 2);
  const len = Math.hypot(sk.pelvis.x - sk.neck.x, sk.pelvis.y - sk.neck.y);
  ctx.scale(1.12, 1);
  // Plated tassets and a hanging war-cloth
  const sw = Math.sin(t * Math.PI * 2) * 0.6 - p.flow * 3;
  cel(ctx, () => polyPath(ctx, [vec(1, len - 2), vec(6.4, len - 2), vec(6.8 + sw * 0.5, len + 12), vec(3.6 + sw, len + 14), vec(0.6 + sw * 0.7, len + 12)]), CAPE, { band: 1 });
  cel(ctx, () => polyPath(ctx, [vec(-7.4, len - 5), vec(7.6, len - 5), vec(8.8, len + 4.2), vec(-7.8, len + 4.4)]), UNDER, { band: 1 });
  for (let i = 0; i < 2; i++) {
    const y = len - 3 + i * 3.2;
    cel(ctx, () => polyPath(ctx, [vec(-7.6, y), vec(8.4, y), vec(8.8, y + 2.8), vec(-7.8, y + 2.8)]), PLATE, { band: 0.7 });
  }
  // Breastplate with a ridge
  const chest = [vec(-8, 0.5), vec(0, -1.4), vec(8.2, 1.6), vec(10.2, 8), vec(7.8, len - 4), vec(-6.6, len - 4), vec(-8.8, 7.5)];
  cel(ctx, () => blobPath(ctx, chest), PLATE, { band: 2, hi: 0.9 });
  ctx.strokeStyle = PLATE.light;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4.8, 1.6);
  ctx.quadraticCurveTo(7.4, 7.5, 5, len - 5);
  ctx.stroke();
  // Glowing seams and an abyssal eye sigil
  ctx.strokeStyle = SEAM;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-7, 8);
  ctx.quadraticCurveTo(0, 10.5, 9.4, 8.4);
  ctx.moveTo(-6.2, len - 4.4);
  ctx.lineTo(7.6, len - 4.6);
  ctx.stroke();
  ctx.fillStyle = '#1a0e28';
  ctx.beginPath();
  ctx.ellipse(5.4, 11.5, 2.2, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SEAM;
  ctx.beginPath();
  ctx.ellipse(5.6, 11.5, 1, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Gorget
  cel(ctx, () => ellipsePath(ctx, vec(0.8, -0.2), 6, 2.8), UNDER, { band: 0.8 });
  ctx.restore();
}

function helm(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Far-side fins
  for (const [y, len, ang] of [[-6.4, 11, -0.45], [-2.6, 9, -0.2]] as const) {
    cel(ctx, () => polyPath(ctx, [vec(-3, y - 1.8), vec(-3 - Math.cos(ang) * len, y + Math.sin(ang) * len - 0.6), vec(-3, y + 1.4)]), tone(0x1a141e), { band: 0.4 });
  }
  // Bucket helm with a sloped brow
  const shell = [vec(-7, -1.4), vec(-6, -7), vec(0, -9.4), vec(6, -7.6), vec(8.2, -2), vec(8, 5), vec(2, 8.4), vec(-6, 7)];
  cel(ctx, () => blobPath(ctx, shell), PLATE, { band: 2, hi: 0.9 });
  // Crest ridge
  cel(ctx, () => polyPath(ctx, [vec(-5.4, -7.4), vec(-1, -11.6), vec(4.4, -9), vec(2, -8.2), vec(-1, -9.2)]), UNDER, { band: 0.5 });
  // Brow band with trim
  cel(ctx, () => polyPath(ctx, [vec(-7, -3.2), vec(8.4, -3.8), vec(8.4, -1.6), vec(-7, -1.2)]), UNDER, { band: 0.5 });
  ctx.fillStyle = TRIM.base;
  ctx.fillRect(-6.6, -3.4, 14.8, 0.6);
  // Burning visor slits
  ctx.fillStyle = '#0c0812';
  ctx.fillRect(1.6, -0.8, 6.8, 1.9);
  ctx.fillRect(4.6, -0.8, 1.4, 5.6);
  ctx.fillStyle = `rgba(255,${140 + Math.round(p.fx * 70)},50,${0.85 + p.fx * 0.15})`;
  ctx.fillRect(2.6, -0.4, 5.2, 1);
  // Breath holes
  ctx.fillStyle = UNDER.shade;
  for (let i = 0; i < 3; i++) ctx.fillRect(1.8 + i * 1.1, 3.4 + i * 0.3, 0.7, 0.7);
  // Swept-back blade fins: the warden's crest
  for (const [y, len, ang] of [[-7.6, 13, -0.5], [-4.2, 11.5, -0.28], [-0.8, 9, -0.08]] as const) {
    cel(ctx, () => polyPath(ctx, [
      vec(-4.6, y - 2), vec(-4.6 - Math.cos(ang) * len, y + Math.sin(ang) * len - 1.2), vec(-4.6 - Math.cos(ang) * len * 0.62, y + Math.sin(ang) * len * 0.62 + 0.6), vec(-4.6, y + 1.6),
    ]), HORN, { band: 0.6 });
  }
  ctx.fillStyle = SEAM;
  ctx.beginPath();
  ctx.arc(-4.6, -4.2, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function greatsword(ctx: CanvasRenderingContext2D, hand: V, angle: number, fx: number): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  const L = BLADE_LEN;
  const blade = [
    vec(-2.2, -2.6), vec(2.2, -2.6), vec(2.4, -L * 0.62), vec(3.4, -L * 0.7), vec(2.2, -L * 0.78),
    vec(1.6, -L + 3), vec(0, -L), vec(-2.2, -L + 4.4), vec(-2.6, -L * 0.5),
  ];
  cel(ctx, () => polyPath(ctx, blade), BLADE, { band: 1, hi: 0.5 });
  // Honed edge
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(2.1, -3.2);
  ctx.lineTo(2.3, -L * 0.6);
  ctx.moveTo(2.1, -L * 0.8);
  ctx.lineTo(0.2, -L + 0.6);
  ctx.stroke();
  // Runed fuller
  ctx.fillStyle = '#140c20';
  ctx.fillRect(-0.7, -L + 6, 1.4, L - 9);
  ctx.fillStyle = `rgba(200,155,255,${0.75 + fx * 0.25})`;
  for (let i = 0; i < 5; i++) {
    const y = -5 - i * 3.6;
    ctx.fillRect(-0.4, y - 1.2, 0.8, 1.2);
    ctx.fillRect(-0.8, y - 0.6 - (i % 2) * 0.4, 1.6, 0.4);
  }
  // Horned crossguard
  cel(ctx, () => polyPath(ctx, [
    vec(-6.4, -0.2), vec(-4.6, -3.2), vec(-2, -2.6), vec(0, -4.2), vec(2, -2.6), vec(4.6, -3.2), vec(6.4, -0.2), vec(3.6, -1.2), vec(-3.6, -1.2),
  ]), UNDER, { band: 0.6 });
  ctx.fillStyle = SEAM;
  ctx.beginPath();
  ctx.arc(0, -2.4, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // Grip and spiked pommel
  cel(ctx, () => capsulePath(ctx, vec(0, -1), vec(0, 5), 1.1, 1.1), tone(0x3a2a2a), { band: 0.4 });
  cel(ctx, () => polyPath(ctx, [vec(-1.8, 5), vec(1.8, 5), vec(0, 8.4)]), UNDER, { band: 0.4 });
  ctx.restore();
}


// ── Isometric 3/4 views ─────────────────────────────────────────────────

const MID_BUILD = { hipW: 3.6, shW: 7.6, elbowOut: 1.8, footOut: 0.8 };
const MID_CHEST = (len: number): V[] => [vec(-9, 0.5), vec(0, -1.6), vec(9, 1.4), vec(11.2, 8), vec(9.4, len * 0.7), vec(7.6, len - 1.2), vec(-7, len - 1), vec(-9.8, 7.5)];
const midRings = (len: number): ReturnType<typeof profileRings> => profileRings(MID_CHEST(len), y => len - y, a => a * 0.95, 8);
const MID_HELM = profileRings([vec(-7, -1.4), vec(-6, -7), vec(0, -9.4), vec(6, -7.6), vec(8.2, -2), vec(8, 5), vec(2, 8.4), vec(-6, 7)], y => -y, a => a * 0.95, 7);
const VISOR_H = 1.8;
const SIGIL = { hk: 0.36, phi: 0.3 };

function seamStroke(ctx: CanvasRenderingContext2D, runs: V[][], w = 0.6): void {
  ctx.strokeStyle = SEAM;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  for (const run of runs) {
    ctx.beginPath();
    run.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  }
}

function midTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = midRings(len);
  const front = T.vis(0) > T.vis(Math.PI);
  const r0 = R[R.length - 1];
  const sw = Math.sin(t * Math.PI * 2) * 0.6 - p.flow * 3;
  const cloth: L3[] = [[1, (r0.f ?? 0) + r0.a + 0.8, -3], [1, (r0.f ?? 0) + r0.a + 0.8, 3], [-13, (r0.f ?? 0) + r0.a + 1.4 + sw, 3], [-15, (r0.f ?? 0) + r0.a + 1.6 + sw, 0], [-13, (r0.f ?? 0) + r0.a + 1.4 + sw, -3]];
  // Plated skirt of tassets
  const skirt = (i: number): ReturnType<typeof ringsBetween> => [
    { h: 0.8 - i * 3, a: r0.a + 0.6 + i * 0.5, b: r0.b + 0.8 + i * 0.5, f: r0.f },
    { h: -2.8 - i * 3, a: r0.a + 1.2 + i * 0.5, b: r0.b + 1.4 + i * 0.5, f: (r0.f ?? 0) + 0.3 },
  ];
  loftFill(ctx, T, [{ h: 1, a: r0.a, b: r0.b, f: r0.f }, { h: -6.4, a: r0.a + 1.2, b: r0.b + 1.2, f: r0.f }], UNDER, { band: 1 });
  if (!front) poly3(ctx, T, cloth, CAPE, { band: 1 });
  for (let i = 0; i < 2; i++) loftFill(ctx, T, skirt(i), PLATE, { band: 0.7 });
  solid3(ctx, T, R, PLATE, {
    band: 2,
    hi: 0.9,
    face: () => {
      // Centre ridge, glowing seams and the abyssal eye sigil
      strap(ctx, T, R, [[len, 0.05], [len * 0.55, 0.1], [2, 0.05]], { ...PLATE, base: PLATE.light, line: 'rgba(0,0,0,0)' }, 0.9, 0.1);
      seamStroke(ctx, surfCurve(T, R, [[len - 8, -1.3], [len - 10, 0], [len - 8.4, 1.3]], 0.1, 6, 0.02));
      seamStroke(ctx, surfCurve(T, R, [[3, -1.4], [3, 0], [3, 1.4]], 0.1, 6, 0.02));
      decal(ctx, T, R, len * SIGIL.hk, SIGIL.phi, () => {
        ctx.fillStyle = '#1a0e28';
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.3, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = SEAM;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
      }, { lift: 0.2, minVis: 0.02 });
    },
    over: () => {
      // Gorget and belt
      loftFill(ctx, T, ringsBetween(R, len - 1.2, len + 1.8, 0.6, 0.9), UNDER, { band: 0.8 });
      band(ctx, T, R, len + 0.4, TRIM, 0.5, 1);
      band(ctx, T, R, 1.2, UNDER, 2.2, 0.4);
      if (front) poly3(ctx, T, cloth, CAPE, { band: 1 });
    },
  });
}

function midHelmView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  const H = turnedHead(sk, 0.3);
  const R = MID_HELM;
  // Swept-back blade fins: the warden's crest, a pair splayed to each side
  const fin = (h: number, len: number, ang: number, l: number): L3[] => [
    [h + 2, -4.6, l], [h + 1.4 + Math.sin(-ang) * len * 0.45, -4.6 - Math.cos(ang) * len * 0.95, l * 1.7],
    [h - 0.6 + Math.sin(-ang) * len * 0.3, -4.6 - Math.cos(ang) * len * 0.6, l * 1.4], [h - 1.6, -4.6, l],
  ];
  const fins: [L3[], boolean][] = [];
  for (const s of [1, -1] as const) {
    for (const [h, len, ang] of [[7.6, 13, -0.5], [4.2, 11.5, -0.28], [0.8, 9, -0.08]] as const) {
      fins.push([fin(h, len, ang, 3.4 * s), s < 0]);
    }
  }
  const deep = (pts: L3[]): boolean => H.rig.d(lp(H, pts[1][0], pts[1][1], pts[1][2])) < H.rig.d(H.o);
  for (const [pts, far] of fins) if (deep(pts)) poly3(ctx, H, pts, far ? tone(0x1a141e) : HORN, { band: 0.6 });
  solid3(ctx, H, R, PLATE, {
    band: 2,
    hi: 0.9,
    face: () => {
      band(ctx, H, R, 3.4, UNDER, 2.2, 0.3);
      band(ctx, H, R, 4.3, TRIM, 0.6, 0.35);
      strap(ctx, H, R, [[9.4, -Math.PI], [9.6, -Math.PI / 2], [9.6, 0], [8, 0.9]], UNDER, 1.4, 0.4);
      if (H.vis(0) < -0.25) return;
      // Burning visor slits (T) and breath holes
      decal(ctx, H, R, VISOR_H, 0, () => {
        ctx.fillStyle = '#0c0812';
        ctx.fillRect(-3.6, -1, 7.2, 2);
        ctx.fillRect(-0.7, 0, 1.4, 5.4);
        ctx.fillStyle = `rgba(255,${140 + Math.round(p.fx * 70)},50,${0.85 + p.fx * 0.15})`;
        ctx.fillRect(-2.8, -0.45, 5.6, 0.9);
      }, { lift: 0.1, minVis: 0.02 });
      for (const [h, phi] of [[-2.4, -0.5], [-2.6, -0.3], [-2.4, 0.5], [-2.6, 0.3]] as const) {
        if (surfVis(H, R, h, phi) < 0.05) continue;
        const q = surf(H, R, h, phi, 0.1);
        ctx.fillStyle = UNDER.shade;
        ctx.fillRect(q.x - 0.35, q.y - 0.35, 0.7, 0.7);
      }
    },
  });
  for (const [pts, far] of fins) if (!deep(pts)) poly3(ctx, H, pts, far ? tone(0x1a141e) : HORN, { band: 0.6 });
}

/** Tattered cape hung across the back plate. */
function midCape(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const top = midRings(len)[0];
  const anchor = lp(T, len - 1, (top.f ?? 0) - top.a * 0.8, 0);
  const chain = clothChain({ x: anchor.x, y: anchor.y }, 30, 6, p.flow, 1, t * Math.PI * 2);
  const left: V[] = [];
  const right: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    const half = 6 + k * 4.6;
    left.push(sk.rig.pt(pt.x, pt.y, -half));
    right.push(sk.rig.pt(pt.x, pt.y, half));
  });
  const a = left[left.length - 1];
  const b = right[right.length - 1];
  const hem: V[] = [];
  for (let i = 1; i < 6; i++) {
    const m = lerpV(a, b, i / 6);
    hem.push(vec(m.x, m.y + (i % 2 === 0 ? -3.4 : 0.8)));
  }
  cel(ctx, () => polyPath(ctx, [...left, ...hem, ...[...right].reverse()]), sk.rig.front ? CAPE_IN : CAPE, { band: 1.4 });
}

function midExtra(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number, d0: number): ViewPart[] {
  return [{ z: sk.torso.depth(sk.torsoLen * 0.5, Math.PI, 8, 0) - d0 + (sk.rig.front ? -2 : 1), draw: () => midCape(ctx, sk, p, t) }];
}

function midViewFx(ctx: CanvasRenderingContext2D, p: HumanPose, sk: ViewSkeleton, act: MonsterAction, t: number): void {
  const live = act === 'death' ? Math.max(0, 1 - t * 1.25) : 1;
  const H = turnedHead(sk, 0.3);
  if (surfVis(H, MID_HELM, VISOR_H, 0) > 0.1) glow(ctx, surf(H, MID_HELM, VISOR_H, 0, 0.3), 3.4 + p.fx * 1.5, EMBER, (0.45 + p.fx * 0.35) * live);
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
  const R = midRings(sk.torsoLen);
  const hs = sk.torsoLen * SIGIL.hk;
  if (surfVis(sk.torso, R, hs, SIGIL.phi) > 0.05) glow(ctx, surf(sk.torso, R, hs, SIGIL.phi, 0.3), 3.5 + pulse, VOID, (0.3 + pulse * 0.15) * live);
  sagittalSpun(ctx, sk, p, () => midFx(ctx, p, solveSkeleton(p, SKIN.prop), act, t, true));
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 12.5, shin: 12.5, upperArm: 10, foreArm: 9.5,
    torso: 17, neck: 7.2, ankle: 2.6,
    hipN: vec(2.4, 0), hipF: vec(-2.8, -0.4),
    shN: vec(1.8, 4.2), shF: vec(-5, 3.4),
  },
  back(ctx, sk, p, t) {
    cape(ctx, sk, p, t);
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
  torso(ctx, sk, p, t) {
    cuirass(ctx, sk, p, t);
  },
  head(ctx, sk, p) {
    helm(ctx, sk, p);
  },
  armNear(ctx, sk, p) {
    arm(ctx, sk.shN, sk.elN, sk.handN, false);
    pauldron(ctx, sk.shN, p.lean, false);
  },
  weapon(ctx, sk, p) {
    greatsword(ctx, sk.handN, p.wpn, p.fx);
    gauntlet(ctx, sk.handN, false);
  },
};

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 2, 64),
  lean: 0.1,
  head: -0.05,
  footN: vec(CENTER_X + 6.5, GROUND_Y),
  footF: vec(CENTER_X - 7.5, GROUND_Y),
  handN: vec(CENTER_X + 10, 64),
  handF: vec(CENTER_X + 1.5, 66),
  wpn: 0.75,
  flow: 0.15,
});

const SPEC: HumanoidMonsterSpec = {
  key: 'monster_dungeon_mid_boss',
  // Wider than the old 64 for the greatsword arc; width doesn't move the sprite.
  frameW: 100,
  frameH: 76,
  scale: 1.1,
  skin: SKIN,
  ready: READY,
  attack: 'overhead',
  walk: { stride: 6, lift: 3, bob: 1.4, lean: 0.06, armSwing: 2 },
  shadowR: 16,
};

const R = (o: Partial<HumanPose>): HumanPose => ({ ...READY, ...o });

/** Hauls the blade far behind the shoulders, rises, and cleaves down. */
const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.33, ease: 'out', pose: R({ root: vec(CENTER_X - 4.5, 65), lean: -0.22, head: 0.05, handN: vec(CENTER_X - 4, 45), wpn: -1.3, handF: vec(CENTER_X + 6, 58), footN: vec(CENTER_X + 8, GROUND_Y), stretch: 0.04, fx: 0.35, flow: 0.3 }) },
  { at: 0.67, ease: 'in', pose: R({ root: vec(CENTER_X - 0.5, 65.5), lean: 0.1, head: 0.02, handN: vec(CENTER_X + 9, 42), wpn: 0.25, handF: vec(CENTER_X + 3, 60), footN: vec(CENTER_X + 10, GROUND_Y), fx: 0.7, flow: 0.45 }) },
  { at: 1, ease: 'linear', pose: R({ root: vec(CENTER_X + 3, 68), lean: 0.44, head: 0.1, handN: vec(CENTER_X + 19, 68), wpn: 2.15, handF: vec(CENTER_X - 2, 65), footN: vec(CENTER_X + 13, GROUND_Y), fx: 1, flow: 0.6, stretch: -0.04 }) },
];

function midFx(ctx: CanvasRenderingContext2D, p: HumanPose, sk: Skeleton, act: MonsterAction, t: number, bladeOnly = false): void {
  const live = act === 'death' ? Math.max(0, 1 - t * 1.25) : 1;
  const S = (pt: V): V => spun(p, pt, sk);
  if (!bladeOnly) {
    // Visor ember and chest sigil
    glow(ctx, S(headPt(sk, vec(5, 0))), 3.4 + p.fx * 1.5, EMBER, (0.45 + p.fx * 0.35) * live);
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
    const chest = S(lerpV(sk.neck, sk.pelvis, 0.68));
    glow(ctx, vec(chest.x + 5.4, chest.y), 3.5 + pulse, VOID, (0.3 + pulse * 0.15) * live);
  }
  // Runes along the blade
  const mid = S(along(sk.handN, p.wpn, BLADE_LEN * 0.45));
  glow(ctx, mid, 5 + p.fx * 5, VOID, (0.2 + p.fx * 0.35) * live);
  if (act === 'attack' && t > 0.5) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const sp = samplePoseTrack(ATTACK, Math.max(0.34, t - i * 0.05));
      const ssk = solveSkeleton(sp, SKIN.prop);
      tips.push(spun(sp, along(ssk.handN, sp.wpn, BLADE_LEN), ssk));
      bases.push(spun(sp, along(ssk.handN, sp.wpn, 8), ssk));
    }
    smear(ctx, tips, bases, 0xb07aff, 0.6 * p.fx);
  }
  if (act === 'attack' && t >= 0.99) {
    // Shockwave where the blade bites the floor
    const tip = S(along(sk.handN, p.wpn, BLADE_LEN));
    glow(ctx, vec(tip.x, GROUND_Y - 1), 10, VOID, 0.45);
    ctx.save();
    ctx.strokeStyle = 'rgba(200,160,255,0.7)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(tip.x - 2, GROUND_Y, 10, 2.6, 0, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
    ctx.restore();
  }
}

const GEN = humanoidTracks({ ...SPEC, tracks: undefined });

export const DungeonMidBossDrawer = humanoidMonster({
  ...SPEC,
  tracks: {
    attack: ATTACK,
    hurt: GEN.hurt,
    // Heavy plate lies thicker than the generated fall assumes: lift it clear of the frame floor.
    death: GEN.death.map(k => (k.at >= 0.67 ? { ...k, pose: { ...k.pose, root: vec(k.pose.root.x, k.pose.root.y - 3.5) } } : k)),
  },
  view: {
    build: MID_BUILD,
    headBias: 5,
    torso: midTorsoView,
    head: midHelmView,
    back: () => undefined,
    extra: midExtra,
    // Pauldrons a size down: seen from the front they'd swallow the chest.
    armNear: (ctx, sk, p) => {
      arm(ctx, sk.shN, sk.elN, sk.handN, false);
      pauldron(ctx, sk.shN, p.lean, false, 0.8);
    },
    armFar: (ctx, sk, p) => {
      pauldron(ctx, sk.shF, p.lean, true, 0.8);
      arm(ctx, sk.shF, sk.elF, sk.handF, true);
      gauntlet(ctx, sk.handF, true);
    },
  },
  viewFx: midViewFx,
  fx: (ctx, p, sk, act, t) => midFx(ctx, p, sk, act, t),
});
