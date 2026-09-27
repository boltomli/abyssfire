// src/graphics/sprites/monsters/DungeonBoss.ts
//
// 深渊之主·卡萨诺尔 — Kasanor, Lord of the Abyss and the labyrinth's final
// horror: a towering void-skinned demon with great tattered bat wings,
// ram-curled horns under a floating Crown of the Abyss, a skull-like face
// with burning eyes, a rift of void-fire torn open in his chest, bronze
// war-plate over digitigrade hooved legs, a reaping scythe in one claw
// and a churning void orb in the other.
import {
  CENTER_X,
  GROUND_Y,
  add,
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
import type { Section, ViewPart, ViewSkeleton } from '../rig/HumanView';
import type { MonsterAction } from '../types';
import {
  band,
  decal,
  eye3,
  eyeGlowPoints,
  loftFill,
  lp,
  poly3,
  profileRings,
  ringsBetween,
  sagittalSpun,
  sd,
  solid3,
  sorted,
  surf,
  surfCurve,
  surfPatch,
  surfVis,
  tube3,
  turnedHead,
  wingDepth,
  wingPlane,
  type L3,
  type Part3,
} from '../rig/MonsterView';

const SKIN = tone(0x4a2a66, { light: 0.38, shadow: 0.45 });
const SKIN_FAR = tone(0x2c1840, { light: 0.22 });
const PLATE = tone(0x2e2838, { light: 0.45, shadow: 0.45 });
const PLATE_FAR = tone(0x1c1824, { light: 0.25 });
const BRONZE = tone(0xc0903a, { light: 0.5 });
const BRONZE_DARK = tone(0x7a5a24);
const HORN = tone(0x2a2028, { light: 0.5, shadow: 0.3 });
const BONE = tone(0xd8ccb4, { light: 0.4, shadow: 0.3 });
const MEMBRANE = tone(0x6e2050, { light: 0.3, shadow: 0.4 });
const MEMBRANE_FAR = tone(0x3a0e2a, { light: 0.15 });
const CLOTH = tone(0x3a0e24, { light: 0.2 });
const SCYTHE = tone(0x4a4458, { light: 0.55, shadow: 0.35 });
const RUNE = '#ff4ad8';
const VOID = 0xcc33ff;
const VOID_HOT = 0xffb0ff;
const EYE = 0xff1a4a;

const SHAFT_UP = 25;
const SHAFT_DOWN = 11;

function headPt(sk: Skeleton, l: V): V {
  const c = Math.cos(sk.headAng);
  const s = Math.sin(sk.headAng);
  return vec(sk.head.x + l.x * c - l.y * s, sk.head.y + l.x * s + l.y * c);
}

function torsoPt(sk: Skeleton, l: V): V {
  const a = Math.atan2(sk.pelvis.y - sk.neck.y, sk.pelvis.x - sk.neck.x) - Math.PI / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return vec(sk.neck.x + l.x * c - l.y * s, sk.neck.y + l.x * s + l.y * c);
}

// ── Wings ───────────────────────────────────────────────────────────────

function wing(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number, far: boolean): void {
  wingAt(ctx, add(torsoPt(sk, vec(-4.6, 3.6)), far ? vec(3, -1.5) : vec(0, 0)), p, t, far);
}

/** Bat wing rooted at `root`, spreading back (−x) and up. */
function wingAt(ctx: CanvasRenderingContext2D, root: V, p: HumanPose, t: number, far: boolean): void {
  const fold = Math.max(0, Math.min(1, p.off));
  const flap = Math.sin(t * Math.PI * 2) * 0.1 - p.flow * 0.25 + (far ? 0.28 : 0);
  // Folding sweeps everything back along the spine and shortens the span.
  const turn = (a: number): number => a + flap + (-3.05 - a) * fold * 0.7;
  const reach = 1 - fold * 0.35;
  const bone = far ? SKIN_FAR : tone(0x3a2050, { light: 0.3 });
  const wa = turn(-2.35);
  const elbow = vec(root.x + Math.cos(wa) * 14 * reach, root.y + Math.sin(wa) * 14 * reach);
  const fingers = ([[-2.05, 17], [-2.55, 21], [-3.0, 20], [-3.45, 16]] as const).map(([ang, len]) => {
    const a = turn(ang);
    return vec(elbow.x + Math.cos(a) * len * reach, elbow.y + Math.sin(a) * len * reach);
  });
  const lower = vec(root.x - 2, root.y + 16);
  // Membrane: scalloped between finger tips
  const pts: V[] = [root, elbow, fingers[0]];
  for (let i = 1; i < fingers.length; i++) {
    const m = lerpV(fingers[i - 1], fingers[i], 0.5);
    const inward = lerpV(m, elbow, 0.28);
    pts.push(inward, fingers[i]);
  }
  pts.push(lerpV(lerpV(fingers[fingers.length - 1], lower, 0.5), elbow, 0.2), lower);
  cel(ctx, () => polyPath(ctx, pts), far ? MEMBRANE_FAR : MEMBRANE, { band: 1.6 });
  // Veins / tears in the membrane
  if (!far) {
    ctx.strokeStyle = 'rgba(255,80,190,0.35)';
    ctx.lineWidth = 0.45;
    for (const f of fingers.slice(1, 3)) {
      const m = lerpV(elbow, f, 0.55);
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(lerpV(m, lower, 0.35).x, lerpV(m, lower, 0.35).y);
      ctx.stroke();
    }
  }
  // Wing arm and finger bones
  cel(ctx, () => capsulePath(ctx, root, elbow, 2.2, 1.6), bone, { band: 0.6 });
  for (const f of fingers) {
    cel(ctx, () => capsulePath(ctx, elbow, f, 1.1, 0.35), bone, { band: 0.3, stroke: 0.4 });
  }
  // Thumb claw at the wrist
  cel(ctx, () => polyPath(ctx, [vec(elbow.x - 1.4, elbow.y), vec(elbow.x + 0.6, elbow.y - 4.4), vec(elbow.x + 1.4, elbow.y + 0.4)]), BONE, { band: 0.3, stroke: 0.4 });
}

// ── Body ────────────────────────────────────────────────────────────────

function hoofLeg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, far: boolean): void {
  const skin = far ? SKIN_FAR : SKIN;
  const plate = far ? PLATE_FAR : PLATE;
  limb(ctx, hip, knee, 5.6, 4.4, skin);
  // Back-bent hock: ankle segment kicks back before the hoof
  const hock = vec(ankle.x - 2.4, ankle.y - 3.6);
  limb(ctx, knee, hock, 4, 3, skin);
  limb(ctx, hock, vec(sole.x + 1, sole.y - 2.2), 2.8, 2.4, skin);
  // Greave
  cel(ctx, () => capsulePath(ctx, lerpV(knee, hock, 0.15), lerpV(knee, hock, 0.85), 4, 3.2), plate, { band: 1.1 });
  cel(ctx, () => ellipsePath(ctx, vec(knee.x + 1, knee.y), 3.8, 3.2), plate, { band: 1 });
  cel(ctx, () => polyPath(ctx, [vec(knee.x + 3, knee.y - 1.6), vec(knee.x + 7, knee.y - 3.4), vec(knee.x + 3.4, knee.y + 1.4)]), BRONZE, { band: 0.3, stroke: 0.4 });
  // Cloven hoof
  cel(ctx, () => polyPath(ctx, [vec(sole.x - 2.6, sole.y - 3.6), vec(sole.x + 3.4, sole.y - 3.8), vec(sole.x + 5.2, sole.y), vec(sole.x - 3.2, sole.y)]), far ? tone(0x141018) : HORN, { band: 0.6 });
  ctx.strokeStyle = '#08060a';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(sole.x + 1.8, sole.y - 3);
  ctx.lineTo(sole.x + 2.2, sole.y);
  ctx.stroke();
}

function demonArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const skin = far ? SKIN_FAR : SKIN;
  limb(ctx, sh, el, 4.6, 3.8, skin);
  limb(ctx, el, hand, 3.8, 3, skin);
  // Bronze bracer with spikes
  const a = lerpV(el, hand, 0.25);
  const b = lerpV(el, hand, 0.8);
  cel(ctx, () => capsulePath(ctx, a, b, 4, 3.4), far ? BRONZE_DARK : BRONZE, { band: 0.9 });
  ctx.strokeStyle = far ? '#3a2a10' : BRONZE_DARK.base;
  ctx.lineWidth = 0.5;
  for (const k of [0.35, 0.6]) {
    const m = lerpV(a, b, k);
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!far) {
    // Glowing rune along the forearm
    ctx.strokeStyle = RUNE;
    ctx.lineWidth = 0.6;
    const m = lerpV(sh, el, 0.5);
    ctx.beginPath();
    ctx.moveTo(m.x - 1.4, m.y - 2);
    ctx.lineTo(m.x + 0.6, m.y);
    ctx.lineTo(m.x - 1, m.y + 2);
    ctx.stroke();
  }
}

function claw(ctx: CanvasRenderingContext2D, hand: V, el: V, far: boolean): void {
  const skin = far ? SKIN_FAR : SKIN;
  cel(ctx, () => ellipsePath(ctx, hand, 3.4, 3.1), skin, { band: 0.9 });
  const a = Math.atan2(hand.y - el.y, hand.x - el.x);
  for (let i = -1; i <= 1; i++) {
    const root = vec(hand.x + Math.cos(a + i * 0.5) * 2.6, hand.y + Math.sin(a + i * 0.5) * 2.6);
    const tip = vec(root.x + Math.cos(a + i * 0.5 + 0.7) * 3.2, root.y + Math.sin(a + i * 0.5 + 0.7) * 3.2);
    cel(ctx, () => capsulePath(ctx, root, tip, 0.8, 0.15), HORN, { band: 0.2, stroke: 0.35 });
  }
}

function pauldron(ctx: CanvasRenderingContext2D, sh: V, lean: number, size = 1): void {
  ctx.save();
  ctx.translate(sh.x - 0.4, sh.y - 1.6);
  ctx.rotate(lean * 0.6);
  ctx.scale(size, size);
  for (const [x, h] of [[-4, 7], [0, 9.5], [4, 6.5]] as const) {
    cel(ctx, () => polyPath(ctx, [vec(x - 1.6, -3), vec(x - 1.4, -3 - h), vec(x + 1.5, -3.2)]), HORN, { band: 0.4, stroke: 0.4 });
  }
  cel(ctx, () => ellipsePath(ctx, vec(0.4, 2.6), 7, 4.4), PLATE, { band: 1.2 });
  cel(ctx, () => ellipsePath(ctx, vec(0.4, 0), 7.8, 4.8), PLATE, { band: 1.2 });
  ctx.strokeStyle = BRONZE.base;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(0.4, 0, 7.2, 4.3, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  // Skull boss
  cel(ctx, () => ellipsePath(ctx, vec(1.4, -0.4), 2.6, 2.3), BONE, { band: 0.5 });
  ctx.fillStyle = '#1a0a14';
  ctx.fillRect(0.4, -1, 0.9, 0.9);
  ctx.fillRect(1.9, -1, 0.9, 0.9);
  ctx.restore();
}

function torso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  ctx.save();
  ctx.translate(sk.neck.x, sk.neck.y);
  ctx.rotate(Math.atan2(sk.pelvis.y - sk.neck.y, sk.pelvis.x - sk.neck.x) - Math.PI / 2);
  const len = Math.hypot(sk.pelvis.x - sk.neck.x, sk.pelvis.y - sk.neck.y);
  const sw = Math.sin(t * Math.PI * 2) * 0.7 - p.flow * 3;
  // Tattered front loincloth
  cel(ctx, () => polyPath(ctx, [vec(0, len - 2), vec(7.4, len - 2.4), vec(8 + sw * 0.5, len + 15), vec(5.6 + sw, len + 12.4), vec(3.6 + sw, len + 16.6), vec(1.8 + sw * 0.7, len + 12.8), vec(0.2 + sw * 0.6, len + 15.2)]), CLOTH, { band: 1 });
  // Plated fauld
  cel(ctx, () => polyPath(ctx, [vec(-8.4, len - 6), vec(8.6, len - 6.4), vec(9.8, len + 4.6), vec(-9, len + 4.8)]), PLATE, { band: 1.1 });
  ctx.fillStyle = BRONZE.base;
  ctx.fillRect(-8.4, len - 1.2, 18, 0.8);
  // Massive chest: muscled, open to the void rift
  const chest = [vec(-9, 0.4), vec(0, -2), vec(9, 1), vec(11.4, 8), vec(8.6, len - 5), vec(-7.4, len - 5), vec(-9.8, 8)];
  cel(ctx, () => blobPath(ctx, chest), SKIN, { band: 2.4, hi: 1 });
  // Pectoral and ab definition
  ctx.strokeStyle = SKIN.shade;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-2, 7.6);
  ctx.quadraticCurveTo(3.6, 9.6, 9.6, 6.8);
  ctx.moveTo(3.8, 10.5);
  ctx.lineTo(3.8, len - 6);
  ctx.moveTo(0.6, 13.4);
  ctx.lineTo(7.8, 13);
  ctx.stroke();
  // Void rift torn in the sternum
  const rift = [vec(3.2, 2.6), vec(5.2, 4.6), vec(5.8, 8.4), vec(4.4, 11.6), vec(3, 8.2), vec(2.4, 5)];
  ctx.fillStyle = '#12021c';
  ctx.beginPath();
  blobPath(ctx, rift);
  ctx.fill();
  ctx.fillStyle = `rgba(255,150,255,${0.7 + p.fx * 0.3})`;
  ctx.beginPath();
  ctx.ellipse(4.1, 7.4, 0.9, 2.6, 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Rune scars
  ctx.strokeStyle = RUNE;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(-6.4, 4);
  ctx.lineTo(-4.4, 6.4);
  ctx.lineTo(-6, 9);
  ctx.moveTo(-5, 12.4);
  ctx.lineTo(-2.6, 13.6);
  ctx.stroke();
  // Bronze collar chain and gorget spikes
  cel(ctx, () => blobPath(ctx, [vec(-8, 0), vec(0, -2.4), vec(8, 0.4), vec(6.4, 3), vec(0, 1.8), vec(-6.6, 2.8)]), BRONZE, { band: 0.7 });
  ctx.restore();
}

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const jaw = 0.6 + p.fx * 1.8;
  // Far horn curl (behind the skull)
  cel(ctx, () => {
    ctx.moveTo(-1, -6);
    ctx.bezierCurveTo(-8, -12, -14, -4, -9, 1);
    ctx.bezierCurveTo(-7, 3, -4, 0.6, -5.6, -1.4);
    ctx.bezierCurveTo(-8, -4.6, -4.8, -7.6, 1.4, -4.4);
    ctx.closePath();
  }, tone(0x1a1218), { band: 0.6 });
  // Tendril beard
  for (let i = 0; i < 3; i++) {
    const ch = clothChain(vec(3 + i * 1.8, 5.4), 7 - i, 3, 0.3 + p.flow * 0.6, 1.4, t * Math.PI * 2 + i);
    cel(ctx, () => { const e = ch[ch.length - 1]; capsulePath(ctx, ch[0], e, 1.1, 0.25); }, SKIN_FAR, { band: 0.3, stroke: 0.35 });
  }
  // Lower jaw with fangs
  ctx.save();
  ctx.translate(0, 2);
  ctx.rotate(jaw * 0.07);
  cel(ctx, () => blobPath(ctx, [vec(-3, -0.4), vec(9.4, 0.6 + jaw * 0.4), vec(8.6, 3.8), vec(2, 5), vec(-3, 3)]), SKIN, { band: 1 });
  for (const x of [5.2, 7.6]) cel(ctx, () => polyPath(ctx, [vec(x - 0.6, 1), vec(x, -1.8), vec(x + 0.6, 1)]), BONE, { band: 0.2, stroke: 0.3 });
  ctx.restore();
  ctx.fillStyle = '#1a0208';
  ctx.beginPath();
  ctx.moveTo(1.4, 1.4);
  ctx.lineTo(9.6, 1);
  ctx.lineTo(9, 2.4 + jaw * 0.7);
  ctx.lineTo(1.4, 3);
  ctx.closePath();
  ctx.fill();
  // Long skull-like face with deep brow
  const skull = [vec(-6, -2), vec(-4.4, -7.4), vec(1.6, -8.6), vec(7, -6), vec(10.4, -1.6), vec(10.2, 1.8), vec(4, 2.4), vec(-4, 3)];
  cel(ctx, () => blobPath(ctx, skull), SKIN, { band: 1.8 });
  cel(ctx, () => polyPath(ctx, [vec(0.6, -4.4), vec(9.2, -3.2), vec(8.6, -1.4), vec(1, -2)]), SKIN_FAR, { band: 0.4, stroke: 0.4 });
  // Upper fangs
  for (const x of [4.4, 8.4]) cel(ctx, () => polyPath(ctx, [vec(x - 0.6, 1.2), vec(x, 3.8), vec(x + 0.6, 1.2)]), BONE, { band: 0.2, stroke: 0.3 });
  // Burning eyes and a third eye on the brow
  ctx.fillStyle = '#ffe0e8';
  ctx.beginPath();
  ctx.moveTo(4, -1.8);
  ctx.lineTo(7.6, -1.4);
  ctx.lineTo(7, -0.3);
  ctx.lineTo(4.2, -0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = RUNE;
  ctx.beginPath();
  ctx.ellipse(3.8, -5.6, 0.7, 1.2, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Near horn: ram curl around the ear, ridged
  cel(ctx, () => {
    ctx.moveTo(0, -6.6);
    ctx.bezierCurveTo(-9, -13.4, -16.4, -3.4, -10.4, 2.6);
    ctx.bezierCurveTo(-7.4, 5.6, -3, 2.4, -4.8, -0.4);
    ctx.bezierCurveTo(-6.6, 2, -9.4, 0.8, -9.6, -1.6);
    ctx.bezierCurveTo(-10, -6.6, -5.2, -8.6, 2.2, -4.4);
    ctx.closePath();
  }, HORN, { band: 1 });
  ctx.strokeStyle = HORN.light;
  ctx.lineWidth = 0.45;
  for (let i = 0; i < 4; i++) {
    const a = -2.4 + i * 0.75;
    ctx.beginPath();
    ctx.moveTo(-7 + Math.cos(a) * 3.6, -2 + Math.sin(a) * 3.6);
    ctx.lineTo(-7 + Math.cos(a) * 6.6, -2 + Math.sin(a) * 6.6);
    ctx.stroke();
  }
  // Floating Crown of the Abyss
  const bob = Math.sin(t * Math.PI * 2 + 0.8) * 0.7;
  ctx.translate(0, -12 + bob);
  cel(ctx, () => polyPath(ctx, [
    vec(-6.4, 0.8), vec(-6, -3.4), vec(-4, -1.2), vec(-2, -5.6), vec(0.2, -1.4), vec(2.4, -6.6), vec(4.4, -1.4), vec(6.4, -4.4), vec(7, 1),
  ]), BRONZE, { band: 0.8 });
  ctx.fillStyle = '#2a0a30';
  ctx.fillRect(-6.2, -0.4, 13, 1.2);
  ctx.fillStyle = RUNE;
  ctx.beginPath();
  ctx.arc(2.4, -2.6, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function scythe(ctx: CanvasRenderingContext2D, hand: V, angle: number, fx: number): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  // Black iron shaft with bronze rings
  cel(ctx, () => capsulePath(ctx, vec(0, SHAFT_DOWN), vec(0, -SHAFT_UP), 1.2, 1.1), tone(0x2a2230, { light: 0.4 }), { band: 0.4 });
  for (const y of [-SHAFT_UP + 3, -8, 4]) {
    cel(ctx, () => polyPath(ctx, [vec(-1.7, y), vec(1.7, y), vec(1.7, y + 1.4), vec(-1.7, y + 1.4)]), BRONZE, { band: 0.3, stroke: 0.3 });
  }
  cel(ctx, () => polyPath(ctx, [vec(-1.6, SHAFT_DOWN), vec(1.6, SHAFT_DOWN), vec(0, SHAFT_DOWN + 4)]), BRONZE, { band: 0.3 });
  // Great crescent blade, cutting edge on the inside curve
  const y0 = -SHAFT_UP;
  cel(ctx, () => {
    ctx.moveTo(-2.4, y0 + 1.6);
    ctx.quadraticCurveTo(8, y0 - 6.4, 19, y0 + 9);
    ctx.quadraticCurveTo(9.6, y0 + 0.6, 1.4, y0 + 4.4);
    ctx.closePath();
  }, SCYTHE, { band: 1, hi: 0.5 });
  ctx.strokeStyle = `rgba(255,190,255,${0.8 + fx * 0.2})`;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(2, y0 + 3.8);
  ctx.quadraticCurveTo(9.8, y0 + 1, 18.4, y0 + 8.6);
  ctx.stroke();
  // Runes etched in the blade
  ctx.fillStyle = RUNE;
  for (let i = 0; i < 3; i++) {
    const x = 5 + i * 3.8;
    const y = y0 - 1.2 + i * 1.4 + (i === 2 ? 1.2 : 0);
    ctx.fillRect(x, y, 0.7, 1.4);
    ctx.fillRect(x - 0.4, y + 0.5, 1.5, 0.4);
  }
  // Back spike and a skull where blade meets shaft
  cel(ctx, () => polyPath(ctx, [vec(-1, y0 + 0.6), vec(-7, y0 - 3), vec(-1.6, y0 + 3.2)]), SCYTHE, { band: 0.4 });
  cel(ctx, () => ellipsePath(ctx, vec(0, y0 + 2.4), 2.4, 2.2), BONE, { band: 0.5 });
  ctx.fillStyle = '#1a0a14';
  ctx.fillRect(-0.3, y0 + 1.8, 0.9, 0.9);
  ctx.fillRect(1, y0 + 1.8, 0.8, 0.9);
  ctx.restore();
}

function bladeTip(hand: V, angle: number): V {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const l = vec(19, -SHAFT_UP + 9);
  return vec(hand.x + l.x * c - l.y * s, hand.y + l.x * s + l.y * c);
}

function backCloth(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const anchor = torsoPt(sk, vec(-6, sk.pelvis.y - sk.neck.y > 0 ? 17 : 17));
  const chain = clothChain(anchor, 18, 5, 0.25 + p.flow, 1.2, t * Math.PI * 2 + 0.6);
  const l: V[] = [];
  const r: V[] = [];
  chain.forEach((pt, i) => {
    const w = 3 + i * 0.5;
    l.push(vec(pt.x - w, pt.y));
    r.push(vec(pt.x + w * 0.7, pt.y));
  });
  const a = l[l.length - 1];
  const b = r[r.length - 1];
  const hem = [lerpV(a, b, 0.33), lerpV(a, b, 0.66)].map((m, i) => vec(m.x, m.y - (i === 0 ? 3 : 0.5)));
  cel(ctx, () => polyPath(ctx, [...l, ...hem, ...r.reverse()]), tone(0x240818), { band: 1 });
}

const BOSS_SKIN: HumanSkin = {
  prop: {
    thigh: 13, shin: 14, upperArm: 11, foreArm: 10.5,
    torso: 19, neck: 7.2, ankle: 2,
    hipN: vec(2.6, 0), hipF: vec(-3, -0.4),
    shN: vec(2, 4.4), shF: vec(-5.8, 3.6),
  },
  back(ctx, sk, p, t) {
    wing(ctx, sk, p, t, true);
    wing(ctx, sk, p, t, false);
    backCloth(ctx, sk, p, t);
  },
  armFar(ctx, sk) {
    demonArm(ctx, sk.shF, sk.elF, sk.handF, true);
    claw(ctx, sk.handF, sk.elF, true);
  },
  legFar(ctx, sk) {
    hoofLeg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, true);
  },
  legNear(ctx, sk) {
    hoofLeg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, false);
  },
  torso(ctx, sk, p, t) {
    torso(ctx, sk, p, t);
  },
  head(ctx, sk, p, t) {
    head(ctx, sk, p, t);
  },
  armNear(ctx, sk, p) {
    demonArm(ctx, sk.shN, sk.elN, sk.handN, false);
    pauldron(ctx, sk.shN, p.lean);
  },
  weapon(ctx, sk, p) {
    scythe(ctx, sk.handN, p.wpn, p.fx);
    claw(ctx, sk.handN, sk.elN, false);
  },
};


// ── Isometric 3/4 views ─────────────────────────────────────────────────

const BOSS_BUILD = { hipW: 3.8, shW: 8, elbowOut: 2, footOut: 0.8 };
const BOSS_CHEST = (len: number): V[] => [vec(-9, 0.4), vec(0, -2), vec(9, 1), vec(11.4, 8), vec(9.6, len * 0.7), vec(8, len - 1), vec(-7.4, len - 1), vec(-9.8, 8)];
const bossRings = (len: number): ReturnType<typeof profileRings> => profileRings(BOSS_CHEST(len), y => len - y, a => a * 0.95, 8);
const BOSS_SKULL = profileRings([vec(-6, -2), vec(-4.4, -7.4), vec(1.6, -8.6), vec(7, -6), vec(10, -1.6), vec(9.6, 2), vec(4, 3), vec(-4, 3)], y => -y, a => a * 0.72, 7);
const B_EYE = { h: 2.6, phi: 0.42 };
const THIRD_H = 6.6;
const RIFT = { h: 0.55, phi: 0.18 };
const bossHead = (sk: ViewSkeleton): Section => turnedHead(sk, 0.35);
const crownH = (t: number): number => 13 + Math.sin(t * Math.PI * 2 + 0.8) * 0.7;

/** Cloth panel hanging from the belt at the front (+1) or back (−1). */
function bossPanel(R: ReturnType<typeof bossRings>, s: 1 | -1, p: HumanPose, t: number): L3[] {
  const r0 = R[R.length - 1];
  const fr = (r0.f ?? 0) + s * (r0.a + 1.4);
  const sw = (Math.sin(t * Math.PI * 2) * 0.7 - p.flow * 3) * s;
  const L = s > 0 ? 16 : 19;
  return [[1, fr, -3.6], [1, fr, 3.6], [-L + 1, fr + s + sw, 3.8], [-L + 4, fr + s + sw, 1.8], [-L, fr + s + sw, 0], [-L + 3.4, fr + s + sw, -1.8], [-L + 0.6, fr + s + sw, -3.6]];
}

function runeStroke(ctx: CanvasRenderingContext2D, runs: V[][]): void {
  ctx.strokeStyle = RUNE;
  ctx.lineWidth = 0.55;
  ctx.lineJoin = 'round';
  for (const run of runs) {
    ctx.beginPath();
    run.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  }
}

function bossTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = bossRings(len);
  const front = T.vis(0) > T.vis(Math.PI);
  const r0 = R[R.length - 1];
  const fauld = [{ h: 2, a: r0.a + 0.6, b: r0.b + 0.8, f: r0.f }, { h: -5.2, a: r0.a + 1.6, b: r0.b + 1.8, f: (r0.f ?? 0) + 0.3 }];
  poly3(ctx, T, bossPanel(R, front ? -1 : 1, p, t), front ? tone(0x240818) : CLOTH, { band: 1 });
  loftFill(ctx, T, fauld, PLATE, { band: 1.1 });
  band(ctx, T, fauld, -1, BRONZE, 0.8, 0.2);
  solid3(ctx, T, R, SKIN, {
    band: 2.4,
    hi: 1,
    face: () => {
      // Pectoral and ab definition
      ctx.strokeStyle = SKIN.shade;
      ctx.lineWidth = 0.6;
      for (const run of [
        ...surfCurve(T, R, [[len - 7.6, -1.3], [len - 9.4, -0.5], [len - 8.4, 0.3], [len - 9.4, 1.0], [len - 7.6, 1.4]], 0.05, 6, 0.02),
        ...surfCurve(T, R, [[len - 10.5, 0.05], [len * 0.3, 0.05]], 0.05, 4, 0.02),
        ...surfCurve(T, R, [[len - 13.4, -0.6], [len - 13.2, 0.7]], 0.05, 4, 0.02),
      ]) {
        ctx.beginPath();
        run.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
      // Void rift torn in the sternum
      if (surfVis(T, R, len * RIFT.h, RIFT.phi) > -0.1) {
        const hc = len * RIFT.h;
        ctx.fillStyle = '#12021c';
        ctx.beginPath();
        polyPath(ctx, surfPatch(T, R, hc + 4.4, hc - 4.4, RIFT.phi - 0.2, RIFT.phi + 0.2, 0.1, 6, k => 0.6 - Math.abs(k - 0.5)));
        ctx.fill();
        decal(ctx, T, R, hc, RIFT.phi, () => {
          ctx.fillStyle = `rgba(255,150,255,${0.7 + p.fx * 0.3})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, 0.9, 2.6, 0.08, 0, Math.PI * 2);
          ctx.fill();
        }, { lift: 0.2, minVis: 0.02 });
      }
      // Rune scars on the flanks
      runeStroke(ctx, surfCurve(T, R, [[len - 4, -1.9], [len - 6.4, -1.6], [len - 9, -1.9]], 0.1, 4, 0.02));
      runeStroke(ctx, surfCurve(T, R, [[len - 12.4, 1.8], [len - 13.6, 1.4]], 0.1, 3, 0.02));
    },
    over: () => {
      // Bronze collar and belt
      loftFill(ctx, T, ringsBetween(R, len - 1.2, len + 1.8, 0.6, 0.92), BRONZE, { band: 0.7 });
      band(ctx, T, R, 1.2, BRONZE_DARK, 1.2, 0.5);
      poly3(ctx, T, bossPanel(R, front ? 1 : -1, p, t), front ? CLOTH : tone(0x240818), { band: 1 });
    },
  });
}

function bossHeadView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const H = bossHead(sk);
  const R = BOSS_SKULL;
  const jaw = 0.6 + p.fx * 1.8;
  // Ram-curled horns spiralling back around the ears
  const horn = (s: 1 | -1): L3[] => [[6, 0, 4 * s], [8, -3.6, 5.4 * s], [6.8, -7.6, 6.6 * s], [3, -8.8, 7.4 * s], [-0.6, -7, 7.8 * s], [-0.4, -4, 7.6 * s], [1.6, -4.4, 7 * s]];
  const deep = (s: 1 | -1): boolean => sd(H, 3, -8, 7 * s) < H.rig.d(H.o);
  const drawHorn = (s: 1 | -1): void => tube3(ctx, H, horn(s), [2.3, 2.2, 2, 1.7, 1.4, 1, 0.5], s > 0 ? HORN : tone(0x1a1218));
  for (const s of [1, -1] as const) if (deep(s)) drawHorn(s);
  const d = jaw * 0.5;
  const parts: Part3[] = [
    // Lower jaw hanging open, fangs up
    { pts: [[-1.4, -2.6, -3.6], [-1.4, -2.6, 3.6], [-2 - d * 0.4, 9.4, -2.2], [-2 - d * 0.4, 9.4, 2.2], [-5.4 - d, 8.6, -2], [-5.4 - d, 8.6, 2], [-5.2 - d * 0.5, 0, -3.2], [-5.2 - d * 0.5, 0, 3.2]], tone: SKIN, hull: true, band: 1, bias: -0.4 },
    { pts: [[-2.4 - d * 0.4, 7.6, 1.6], [-2.4 - d * 0.4, 8.4, 1.4], [0.6, 8, 1.6]], tone: BONE, mirror: true, band: 0.2, bias: 1 },
  ];
  // Tendril beard hanging under the jaw
  const beard = (i: number): L3[] => {
    const sw = Math.sin(t * Math.PI * 2 + i) * 1.2 - p.flow * 2;
    const l = (i - 1) * 1.6;
    return [[-4.6 - d, 5 - i * 1.2, l], [-8.6 - d, 4 - i * 1.2 + sw * 0.5, l * 1.1], [-12 + i * 1.2 - d, 3.4 - i * 1.2 + sw, l * 1.2]];
  };
  const beardDeep = sd(H, -8, 4, 0) < H.rig.d(H.o);
  const drawBeard = (): void => {
    for (let i = 0; i < 3; i++) tube3(ctx, H, beard(i), [1.1, 0.7, 0.25], SKIN_FAR);
  };
  if (beardDeep) drawBeard();
  solid3(ctx, H, R, SKIN, {
    band: 1.8,
    parts,
    face: () => {
      if (H.vis(0) < -0.3) return;
      // Deep brow shadow, burning eyes, third eye
      cel(ctx, () => polyPath(ctx, surfPatch(H, R, B_EYE.h + 2.6, B_EYE.h + 1.2, -1, 1, 0.3, 6)), SKIN_FAR, { band: 0.4, stroke: 0.4 });
      for (const sgn of [1, -1]) eye3(ctx, H, R, B_EYE.h, sgn * B_EYE.phi, { rx: 1.8, ry: 0.6, iris: '#ffe0e8', tilt: -0.2 });
      decal(ctx, H, R, THIRD_H, 0, () => {
        ctx.fillStyle = RUNE;
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.7, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }, { lift: 0.1, minVis: 0.02 });
      // Maw and upper fangs
      ctx.fillStyle = '#1a0208';
      ctx.beginPath();
      polyPath(ctx, surfPatch(H, R, -1.2, -2.6 - d * 0.6, -0.9, 0.9, 0.2, 6));
      ctx.fill();
      for (const phi of [-0.55, -0.2, 0.2, 0.55]) {
        decal(ctx, H, R, -1.3, phi, () => cel(ctx, () => polyPath(ctx, [vec(-0.6, 0), vec(0.6, 0), vec(0, 2.4)]), BONE, { band: 0.2, stroke: 0.3 }), { lift: 0.3, minVis: 0.05 });
      }
    },
  });
  if (!beardDeep) drawBeard();
  for (const s of [1, -1] as const) if (!deep(s)) drawHorn(s);
}

/** Floating Crown of the Abyss: a hollow ring of bronze spikes over the skull. */
function crownView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, t: number): void {
  const H = bossHead(sk);
  const h0 = crownH(t);
  const N = 10;
  const pt = (i: number, dh: number, k = 1): L3 => {
    const a = (i / N) * Math.PI * 2;
    return [h0 + dh, 1 + Math.cos(a) * 6.2 * k, Math.sin(a) * 6.4 * k];
  };
  const items: { d: number; draw: () => void }[] = [];
  for (let i = 0; i < N; i++) {
    const quad: L3[] = [pt(i, 0), pt(i + 1, 0), pt(i + 1, 1.6), pt(i, 1.6)];
    const spike: L3[] = [pt(i + 0.15, 1.4), pt(i + 0.85, 1.4), pt(i + 0.5, 1.4 + (i % 2 ? 3.4 : 5.4), 1.02)];
    const mid = pt(i + 0.5, 0);
    const d = sd(H, mid[0], mid[1], mid[2]);
    const outward = H.rig.d(lp(H, mid[0], mid[1] * 1.1 - 0.1, mid[2] * 1.1)) > d;
    const tn = outward ? BRONZE : BRONZE_DARK;
    items.push({ d, draw: () => {
      poly3(ctx, H, spike, tn, { band: 0.3, stroke: 0.4 });
      poly3(ctx, H, quad, tn, { band: 0.4, stroke: 0.4 });
    } });
  }
  items.push({ d: sd(H, h0 + 3, 7.6, 0), draw: () => undefined });
  sorted(items);
}

function bossWings(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number, d0: number): ViewPart[] {
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = bossRings(len);
  const r = R[2];
  const back = (r.f ?? 0) - r.a * 0.7;
  const out: ViewPart[] = [];
  for (const s of [1, -1] as const) {
    const anchor = lp(T, len - 3.6, back, s * 2.4);
    // From behind the near wing swings a little forward so it clears the back instead of drooping over it.
    const spread = sk.rig.front ? (s < 0 ? 0.25 : 1.15) : (s > 0 ? 1.9 : 1.1);
    const root = { x: anchor.x, y: anchor.y };
    out.push({
      z: wingDepth(sk.rig, anchor, s, spread, 10) - d0 + (s > 0 ? 0 : -8),
      draw: () => wingPlane(ctx, sk.rig, anchor, root, s, spread, () => wingAt(ctx, root, p, t, s < 0)),
    });
  }
  out.push({ z: sk.d.head - d0 + 3, draw: () => crownView(ctx, sk, t) });
  // The void orb sits in the far claw: sorted with it, so the body hides it from behind.
  const a = Math.atan2(sk.handF.y - sk.elF.y, sk.handF.x - sk.elF.x);
  const orb = vec(sk.handF.x + Math.cos(a) * 4.5, sk.handF.y + Math.sin(a) * 4.5 - 3);
  out.push({ z: sk.d.handF - d0 + 1, draw: () => bossOrb(ctx, p, t, orbLive(p), orb) });
  return out;
}

/** Orb fade in the body pass (no action there): the death track folds the wings (`off` → 1). */
const orbLive = (p: HumanPose): number => Math.max(0, Math.min(1, 1 - (p.off - 0.25) / 0.6));

interface BossFxPts {
  eyes: V[];
  third: V | null;
  gem: V;
  rift: V | null;
  /** Omitted when the orb is drawn as its own depth-sorted part. */
  orb?: V;
}

function bossBodyFx(ctx: CanvasRenderingContext2D, p: HumanPose, act: MonsterAction, t: number, q: BossFxPts): void {
  const dying = act === 'death';
  const live = dying ? Math.max(0, 1 - t * 1.15) : 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
  for (const e of q.eyes) glow(ctx, e, 3.4 + p.fx * 1.5, EYE, (0.55 + p.fx * 0.3) * live);
  if (q.third) glow(ctx, q.third, 2.2, VOID, 0.5 * live);
  glow(ctx, q.gem, 3, VOID, (0.35 + pulse * 0.2) * live);
  if (q.rift) {
    glow(ctx, q.rift, 3.5 + pulse + p.fx * 2, VOID, (0.3 + pulse * 0.1 + p.fx * 0.2) * live);
    glow(ctx, q.rift, 1.6, VOID_HOT, 0.5 * live);
  }
  if (q.orb) bossOrb(ctx, p, t, live, q.orb);
}

/** Churning void orb in the off hand. */
function bossOrb(ctx: CanvasRenderingContext2D, p: HumanPose, t: number, live: number, orb: V): void {
  const orbR = 2.6 + p.fx * 2.2;
  if (live > 0) {
    glow(ctx, orb, orbR * 3, VOID, (0.4 + p.fx * 0.35) * live);
    ctx.save();
    ctx.globalAlpha = live;
    ctx.fillStyle = '#16021e';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,255,0.9)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orbR, t * 8, t * 8 + Math.PI * 1.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orbR * 0.55, -t * 10, -t * 10 + Math.PI);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const a = t * 9 + i * (Math.PI / 2);
      glow(ctx, vec(orb.x + Math.cos(a) * (orbR + 2.5), orb.y + Math.sin(a) * (orbR + 1.2)), 1.3, VOID_HOT, 0.7 * live);
    }
  }
}

function bossBladeFx(ctx: CanvasRenderingContext2D, p: HumanPose, sk: Skeleton, act: MonsterAction, t: number): void {
  const live = act === 'death' ? Math.max(0, 1 - t * 1.15) : 1;
  const S = (pt: V): V => spun(p, pt, sk);
  const tip = S(bladeTip(sk.handN, p.wpn));
  glow(ctx, tip, 3 + p.fx * 3, VOID, (0.25 + p.fx * 0.4) * live);
  if (act === 'attack' && t > 0.5) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const sp = samplePoseTrack(ATTACK, Math.max(0.34, t - i * 0.05));
      const ssk = solveSkeleton(sp, BOSS_SKIN.prop);
      tips.push(spun(sp, bladeTip(ssk.handN, sp.wpn), ssk));
      bases.push(spun(sp, along(ssk.handN, sp.wpn, SHAFT_UP - 2), ssk));
    }
    smear(ctx, tips, bases, 0xd060ff, 0.65 * p.fx);
  }
  if (act === 'attack' && t >= 0.99) {
    // Void nova ring bursting from the reap
    const c = vec(tip.x - 4, GROUND_Y - 1);
    glow(ctx, c, 14, VOID, 0.45);
    ctx.save();
    ctx.strokeStyle = 'rgba(230,150,255,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, GROUND_Y, 13, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Void bleeding out of the fallen lord. */
function bossBleed(ctx: CanvasRenderingContext2D, act: MonsterAction, t: number, rift: V): void {
  if (!(act === 'death' && t > 0.3)) return;
  const k = (t - 0.3) / 0.7;
  for (let i = 0; i < 7; i++) {
    const u = (i / 7 + t * 0.6) % 1;
    const base = add(rift, vec(Math.sin(i * 2.1) * 8, 0));
    glow(ctx, vec(base.x - u * 4, base.y - u * 20 * k), 3 + u * 3, VOID, 0.45 * (1 - u) * k);
  }
}

function bossViewFx(ctx: CanvasRenderingContext2D, p: HumanPose, sk: ViewSkeleton, act: MonsterAction, t: number): void {
  const H = bossHead(sk);
  const T = sk.torso;
  const R = bossRings(sk.torsoLen);
  const hr = sk.torsoLen * RIFT.h;
  const riftVis = surfVis(T, R, hr, RIFT.phi) > 0.05;
  const rift = surf(T, R, hr, riftVis ? RIFT.phi : Math.PI, 0.3);
  bossBodyFx(ctx, p, act, t, {
    eyes: eyeGlowPoints(H, BOSS_SKULL, B_EYE.h, [B_EYE.phi, -B_EYE.phi]),
    third: surfVis(H, BOSS_SKULL, THIRD_H, 0) > 0.2 ? surf(H, BOSS_SKULL, THIRD_H, 0, 0.2) : null,
    gem: H.rig.p(lp(H, crownH(t) + 2.6, 7.2, 0)),
    rift: riftVis ? rift : null,
  });
  sagittalSpun(ctx, sk, p, () => bossBladeFx(ctx, p, solveSkeleton(p, BOSS_SKIN.prop), act, t));
  bossBleed(ctx, act, t, rift);
}

// ── Animation ───────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 3, 61),
  lean: 0.1,
  head: -0.08,
  footN: vec(CENTER_X + 6, GROUND_Y),
  footF: vec(CENTER_X - 9, GROUND_Y),
  handN: vec(CENTER_X + 13, 60),
  handF: vec(CENTER_X + 6, 55),
  wpn: 0.12,
  off: 0,
  flow: 0.15,
});

const R = (o: Partial<HumanPose>): HumanPose => ({ ...READY, ...o });

/** Rears back charging the orb, then reaps the scythe down across the front. */
const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.33, ease: 'out', pose: R({ root: vec(CENTER_X - 5.5, 62), lean: -0.2, head: -0.2, handN: vec(CENTER_X - 7, 55), wpn: -1.05, handF: vec(CENTER_X + 12, 47), fx: 0.6, flow: 0.35, off: -0.25, stretch: 0.04 }) },
  { at: 0.67, ease: 'in', pose: R({ root: vec(CENTER_X - 1, 62.5), lean: 0.12, head: -0.05, handN: vec(CENTER_X + 6, 44), wpn: 0.35, handF: vec(CENTER_X + 8, 53), footN: vec(CENTER_X + 9, GROUND_Y), fx: 0.8, flow: 0.45, off: -0.1 }) },
  { at: 1, ease: 'linear', pose: R({ root: vec(CENTER_X + 2.5, 65), lean: 0.42, head: 0.1, handN: vec(CENTER_X + 20, 62), wpn: 1.8, handF: vec(CENTER_X - 3, 60), footN: vec(CENTER_X + 12, GROUND_Y), fx: 1, flow: 0.6, off: 0.1, stretch: -0.04 }) },
];

/** Drops to his knees, slumps, then crashes forward with wings folding. */
const DEATH_OVERRIDE = (recoil: HumanPose): Key<HumanPose>[] => [
  { at: 0, pose: recoil },
  { at: 0.33, pose: R({ root: vec(CENTER_X - 4, 72), lean: 0.25, head: 0.35, footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 11, GROUND_Y), handN: vec(CENTER_X + 14, 72), wpn: 0.8, handF: vec(CENTER_X + 3, 70), off: 0.3, flow: 0.3 }) },
  { at: 0.67, ease: 'in', pose: R({ root: vec(CENTER_X - 3, 78), lean: 0.95, head: 0.3, footN: vec(CENTER_X + 2, GROUND_Y), footF: vec(CENTER_X - 14, GROUND_Y), handN: vec(CENTER_X + 18, 80), wpn: 1.0, handF: vec(CENTER_X + 12, 87), off: 0.7, flow: 0.2 }) },
  { at: 1, ease: 'out', pose: R({ root: vec(CENTER_X - 6, 81), lean: 1.45, head: 0.15, footN: vec(CENTER_X - 26, GROUND_Y), footF: vec(CENTER_X - 30, GROUND_Y - 0.5), handN: vec(CENTER_X + 17, 84), wpn: 1.0, handF: vec(CENTER_X + 12, 89.5), off: 1, flow: 0 }) },
];

const SPEC: HumanoidMonsterSpec = {
  key: 'monster_dungeon_boss',
  // Much wider than the old 80: wingspan and scythe reach; width doesn't move the sprite.
  frameW: 128,
  frameH: 96,
  scale: 1.08,
  skin: BOSS_SKIN,
  ready: READY,
  attack: 'overhead',
  walk: { stride: 6.5, lift: 3.2, bob: 1.6, lean: 0.06, armSwing: 2 },
  shadowR: 20,
};

const GEN = humanoidTracks(SPEC);
const TRACKS = { attack: ATTACK, hurt: GEN.hurt, death: DEATH_OVERRIDE(GEN.hurt[0].pose) };

function orbPoint(sk: Skeleton): V {
  const a = Math.atan2(sk.handF.y - sk.elF.y, sk.handF.x - sk.elF.x);
  return vec(sk.handF.x + Math.cos(a) * 4.5, sk.handF.y + Math.sin(a) * 4.5 - 3);
}

export const DungeonBossDrawer = humanoidMonster({
  ...SPEC,
  tracks: TRACKS,
  view: {
    build: BOSS_BUILD,
    headBias: 5,
    torso: bossTorsoView,
    head: bossHeadView,
    back: () => undefined,
    extra: bossWings,
    armNear: (ctx, sk, p) => {
      demonArm(ctx, sk.shN, sk.elN, sk.handN, false);
      pauldron(ctx, sk.shN, p.lean, 0.62);
    },
  },
  viewFx: bossViewFx,
  fx: (ctx, p, sk, act, t) => {
    const S = (pt: V): V => spun(p, pt, sk);
    const rift = S(torsoPt(sk, vec(4.1, 7.4)));
    bossBodyFx(ctx, p, act, t, {
      eyes: [S(headPt(sk, vec(5.8, -1.1)))],
      third: S(headPt(sk, vec(3.8, -5.6))),
      gem: S(headPt(sk, vec(2.4, -14.6))),
      rift,
      orb: S(orbPoint(sk)),
    });
    bossBladeFx(ctx, p, sk, act, t);
    bossBleed(ctx, act, t, rift);
  },
});
