// src/graphics/sprites/monsters/MountainTroll.ts
//
// 山岭巨魔 — hulking, hunch-backed mountain troll: slate-green hide with
// moss growing on the shoulders, a shaggy mane down the spine, long
// knuckle-dragging arms, jutting tusks and tiny ember eyes. Swings a
// gnarled log club with a lashed granite head in a huge overhead slam.
import type { MonsterAction } from '../types';
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
import { basePose, solveSkeleton, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster } from '../rig/MonsterKit';
import { solveViewSkeleton, type ViewSkeleton } from '../rig/HumanView';
import {
  backSpikes,
  band,
  decal,
  eye3,
  eyeGlowPoints,
  poly3,
  profileRings,
  solid3,
  strap,
  surfPatch,
  turnedHead,
  type L3,
  type Part3,
} from '../rig/MonsterView';

const HIDE = tone(0x71877a, { light: 0.34 });
const HIDE_FAR = tone(0x4d5f58, { light: 0.18 });
const BELLY = tone(0x9aa592, { light: 0.3, shadow: 0.35 });
const MOSS = tone(0x6f9a3c, { light: 0.4 });
const MOSS_DARK = tone(0x4a6b2a, { light: 0.25 });
const MANE = tone(0x3b3a44, { light: 0.25 });
const TUSK = tone(0xe8dcb8, { light: 0.45, shadow: 0.3 });
const NAIL = tone(0xcfc3a0, { light: 0.35 });
const PELT = tone(0x7a5636, { light: 0.3 });
const PELT_DARK = tone(0x553a24);
const WOOD = tone(0x6e4c30, { light: 0.3 });
const GRANITE = tone(0x8e949c, { light: 0.4 });
const ROPE = tone(0xb49a64, { light: 0.3 });
const IRON = tone(0x6a707c, { light: 0.45 });
const EMBER = 0xff8a2a;

const CLUB_LEN = 21;
const CLUB_SCALE = 1.2;

// ── Body parts ──────────────────────────────────────────────────────────

function trollFoot(ctx: CanvasRenderingContext2D, ankle: V, sole: V, t: Tone): void {
  cel(ctx, () => blobPath(ctx, [
    vec(ankle.x - 3.6, ankle.y - 1), vec(ankle.x + 1.8, ankle.y - 2),
    vec(sole.x + 6.4, sole.y - 2.2), vec(sole.x + 7.4, sole.y), vec(sole.x - 4.2, sole.y + 0.2),
  ]), t, { band: 1 });
  // Blunt toe claws
  for (const dx of [3.4, 5.4, 7.2]) {
    cel(ctx, () => polyPath(ctx, [vec(sole.x + dx - 0.9, sole.y - 1.3), vec(sole.x + dx + 1.3, sole.y - 0.6), vec(sole.x + dx - 0.6, sole.y + 0.1)]), NAIL, { band: 0.2, stroke: 0.3 });
  }
}

function trollLeg(ctx: CanvasRenderingContext2D, sk: Skeleton, near: boolean): void {
  const t = near ? HIDE : HIDE_FAR;
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  const sole = near ? sk.soleN : sk.soleF;
  limb(ctx, hip, knee, 5.4, 4.3, t);
  limb(ctx, knee, ankle, 4.2, 3.2, t);
  trollFoot(ctx, ankle, sole, t);
  if (near) {
    // Knee callus
    cel(ctx, () => ellipsePath(ctx, vec(knee.x + 1.4, knee.y - 0.2), 2.4, 2), BELLY, { band: 0.5, stroke: 0.3 });
  }
}

function trollArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, t: Tone): void {
  limb(ctx, sh, el, 5, 3.8, t);
  // Gorilla forearm: swells toward the wrist
  limb(ctx, el, hand, 3.8, 4.6, t);
}

function trollFist(ctx: CanvasRenderingContext2D, at: V, t: Tone, grip: boolean): void {
  cel(ctx, () => ellipsePath(ctx, at, 4.4, 3.9, 0.3), t, { band: 1 });
  // Knuckles / claws
  for (let i = 0; i < 3; i++) {
    const k = vec(at.x + 1.6 + i * 1.1, at.y + (grip ? -1.6 : 1.8) + i * 0.9);
    cel(ctx, () => ellipsePath(ctx, k, 1.1, 0.9), NAIL, { band: 0.25, stroke: 0.3 });
  }
}

function trollTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const breathe = Math.sin(t * Math.PI * 2) * 0.4;
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Shaggy mane behind the hump
    const mane: V[] = [];
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      const y = -4 + k * (len * 0.8);
      mane.push(vec(-10.5 - Math.sin(k * Math.PI) * 3, y));
      mane.push(vec(-14 - Math.sin(k * Math.PI) * 3.4 - p.flow * 2 + (i % 2) * 1.2, y + 2.2));
    }
    mane.push(vec(-4, len * 0.8), vec(-2, -3));
    cel(ctx, () => polyPath(ctx, mane), MANE, { band: 1 });
    // Barrel body with a big hump over the shoulders
    const body = [
      vec(-9, -3.4), vec(-2, -6.4), vec(5, -3), vec(9.5 + breathe, 3), vec(11 + breathe, len * 0.55),
      vec(8.4, len + 1.4), vec(-5.4, len + 2), vec(-10.4, len * 0.6), vec(-12, len * 0.2),
    ];
    cel(ctx, () => blobPath(ctx, body), HIDE, { band: 2.2, hi: 1 });
    // Pale belly plates
    const belly = [vec(3, 3), vec(9 + breathe, 5.5), vec(10 + breathe, len * 0.6), vec(7, len), vec(1.5, len - 1), vec(0.6, len * 0.45)];
    cel(ctx, () => blobPath(ctx, belly), BELLY, { band: 1.2, stroke: 0.4 });
    ctx.strokeStyle = BELLY.shade;
    ctx.lineWidth = 0.45;
    for (const y of [len * 0.36, len * 0.56, len * 0.76]) {
      ctx.beginPath();
      ctx.moveTo(1.8, y);
      ctx.quadraticCurveTo(6, y + 1.2, 9.6, y - 0.4);
      ctx.stroke();
    }
    // Scars across the chest
    ctx.strokeStyle = 'rgba(40,30,40,0.55)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-4, 3);
    ctx.lineTo(1, 8.5);
    ctx.moveTo(-2.6, 2.4);
    ctx.lineTo(-1.8, 3.6);
    ctx.stroke();
    // Hide loincloth + belt with a trophy bone
    cel(ctx, () => polyPath(ctx, [vec(-6.6, len - 2), vec(9, len - 2.6), vec(9.4, len + 1), vec(-6.4, len + 1.8)]), PELT_DARK, { band: 0.5 });
    const flap = p.flow * 2;
    cel(ctx, () => polyPath(ctx, [vec(-1, len + 1), vec(9.4, len), vec(8.8 - flap, len + 9.5), vec(5.4 - flap, len + 8), vec(2.8 - flap, len + 10), vec(-0.6 - flap * 0.5, len + 8.4)]), PELT, { band: 1 });
    ctx.strokeStyle = PELT_DARK.base;
    ctx.lineWidth = 0.45;
    for (const x of [2.4, 5, 7.4]) {
      ctx.beginPath();
      ctx.moveTo(x, len + 2);
      ctx.lineTo(x - flap * 0.6, len + 7.6);
      ctx.stroke();
    }
    cel(ctx, () => capsulePathLocal(ctx, vec(-2, len - 0.8), vec(3, len + 0.6), 0.9), TUSK, { band: 0.3, stroke: 0.35 });
    // Moss carpet on the hump
    const moss = [vec(-11.4, 1.4), vec(-8, -4.6), vec(-1.6, -7.2), vec(4.6, -4), vec(3.2, -1.6), vec(-2, -2.6), vec(-7, 0.6), vec(-9.6, 4.2)];
    cel(ctx, () => blobPath(ctx, moss), MOSS, { band: 1 });
    ctx.fillStyle = MOSS_DARK.base;
    for (const [x, y] of [[-8, 1], [-5, -2.4], [-1, -4.6], [2, -3.4], [-9.6, 3.4]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hanging moss strands
    ctx.strokeStyle = MOSS.shade;
    ctx.lineWidth = 0.7;
    ctx.lineCap = 'round';
    for (const [x, y, l] of [[-9, 3.6, 3.4], [-6.4, 1.2, 2.6], [3.6, -2, 2.2]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 0.8 - p.flow, y + l * 0.6, x - 0.4 - p.flow * 1.5, y + l);
      ctx.stroke();
    }
  });
}

/** Rounded bar in the current (bone-local) space. */
function capsulePathLocal(ctx: CanvasRenderingContext2D, a: V, b: V, r: number): void {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.moveTo(a.x + Math.cos(ang + Math.PI / 2) * r, a.y + Math.sin(ang + Math.PI / 2) * r);
  ctx.arc(a.x, a.y, r, ang + Math.PI / 2, ang - Math.PI / 2 + Math.PI * 2);
  ctx.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}

function trollHead(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Far ear
  cel(ctx, () => polyPath(ctx, [vec(-3, -2.4), vec(-9.6, -5.4 - p.flow), vec(-4, 1.4)]), HIDE_FAR, { band: 0.7 });
  // Skull: low forehead, heavy jaw
  const skull = [vec(-5.8, -1), vec(-4.6, -5.8), vec(1.4, -7), vec(6.4, -4.6), vec(8.2, 0), vec(8.4, 4.6), vec(3.4, 7.4), vec(-3.6, 6)];
  cel(ctx, () => blobPath(ctx, skull), HIDE, { band: 1.6, hi: 0.8 });
  // Underbite jaw
  const jaw = [vec(-1.4, 3.2), vec(8.6, 2.4), vec(9.6, 5.8), vec(6.4, 8.4), vec(0, 7.6)];
  cel(ctx, () => blobPath(ctx, jaw), HIDE, { band: 1 });
  ctx.fillStyle = '#23161a';
  ctx.beginPath();
  ctx.moveTo(3, 3.8);
  ctx.quadraticCurveTo(6.4, 4.6, 9, 3.2);
  ctx.lineTo(8.6, 4.4);
  ctx.quadraticCurveTo(6, 5.4, 3.2, 4.6);
  ctx.fill();
  // Tusks jutting up out of the lower jaw
  cel(ctx, () => polyPath(ctx, [vec(4.4, 4.8), vec(6, 4.8), vec(5.2, -0.6)]), TUSK, { band: 0.4, stroke: 0.4 });
  cel(ctx, () => polyPath(ctx, [vec(7.6, 4.2), vec(9, 4), vec(9.4, 0.2)]), TUSK, { band: 0.3, stroke: 0.35 });
  // Heavy brow ridge shading the eye
  cel(ctx, () => polyPath(ctx, [vec(-0.6, -3.8), vec(5, -4.4), vec(8.6, -2.2), vec(7.4, -0.8), vec(1, -1.8)]), HIDE_FAR, { band: 0.5, stroke: 0.4 });
  // Tiny ember eyes
  ctx.fillStyle = '#1a0c08';
  ctx.beginPath();
  ctx.ellipse(5.2, -0.9, 1.5, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb45a';
  ctx.beginPath();
  ctx.arc(5.6, -0.9, 0.65, 0, Math.PI * 2);
  ctx.fill();
  // Bulbous nose
  cel(ctx, () => ellipsePath(ctx, vec(9, 0.8), 2.2, 1.8, 0.4), HIDE, { band: 0.6, stroke: 0.45 });
  ctx.fillStyle = '#2a1c20';
  ctx.fillRect(9.6, 1.6, 0.8, 0.6);
  // Tuft of mane on the crown
  cel(ctx, () => polyPath(ctx, [vec(-6, -2), vec(-4.4, -7), vec(-1.2, -7.6), vec(-3, -9.6 - p.flow), vec(1.6, -7.4), vec(-2, -5.4), vec(-4.6, -1)]), MANE, { band: 0.6 });
  // Near ear, ragged and notched
  cel(ctx, () => polyPath(ctx, [vec(-0.6, -2.6), vec(-7.4, -6.6 - p.flow * 1.4), vec(-6, -4.6), vec(-7.6, -3.4), vec(-1.6, 1)]), HIDE, { band: 0.6 });
  ctx.restore();
}

function club(ctx: CanvasRenderingContext2D, at: V, angle: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.scale(CLUB_SCALE, CLUB_SCALE);
  // Gnarled log haft, thickening toward the head
  cel(ctx, () => blobPath(ctx, [vec(-1.5, 4.5), vec(1.4, 4.2), vec(2.2, -6), vec(2.8, -12.5), vec(-2.6, -12.8), vec(-2, -5)]), WOOD, { band: 0.8 });
  ctx.strokeStyle = WOOD.shade;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-0.4, 3);
  ctx.quadraticCurveTo(0.8, -3, -0.2, -10);
  ctx.stroke();
  // Broken branch stub
  cel(ctx, () => polyPath(ctx, [vec(-1.8, -4.4), vec(-4.6, -6.6), vec(-4.2, -7.8), vec(-1.6, -6.6)]), WOOD, { band: 0.3, stroke: 0.35 });
  // Granite head lashed on with rope
  const head = [vec(-4.6, -12.4), vec(-2.6, -17), vec(1.6, -19.6), vec(5.2, -17.4), vec(5.6, -12.6), vec(2.4, -10.2), vec(-2.4, -10.2)];
  cel(ctx, () => polyPath(ctx, head), GRANITE, { band: 1.2, hi: 0.6 });
  ctx.strokeStyle = GRANITE.shade;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-1.6, -16);
  ctx.lineTo(0.8, -14.4);
  ctx.lineTo(3.8, -15.6);
  ctx.stroke();
  // Iron spikes driven through
  for (const [x, y, dx] of [[5, -15.6, 2.6], [4.6, -12.4, 2.4], [-4, -14.6, -2.4]] as const) {
    cel(ctx, () => polyPath(ctx, [vec(x, y - 0.9), vec(x + dx, y), vec(x, y + 0.9)]), IRON, { band: 0.2, stroke: 0.3 });
  }
  for (const y of [-11.2, -10]) {
    cel(ctx, () => polyPath(ctx, [vec(-3, y - 0.5), vec(3.2, y - 0.5), vec(3.2, y + 0.5), vec(-3, y + 0.5)]), ROPE, { band: 0.2, stroke: 0.3 });
  }
  ctx.restore();
}

function bracer(ctx: CanvasRenderingContext2D, el: V, hand: V): void {
  const a = lerpV(el, hand, 0.45);
  const b = lerpV(el, hand, 0.8);
  limb(ctx, a, b, 4.5, 4.9, IRON);
  inBone(ctx, a, b, (len) => {
    ctx.fillStyle = IRON.light;
    for (const y of [len * 0.2, len * 0.8]) {
      ctx.fillRect(2.4, y - 0.4, 0.9, 0.9);
      ctx.fillRect(-0.4, y - 0.4, 0.9, 0.9);
    }
  });
}

// ── Isometric 3/4 views ─────────────────────────────────────────────────

const TROLL_BODY = (len: number): V[] => [
  vec(-9, -3.4), vec(-2, -6.4), vec(5, -3), vec(9.5, 3), vec(11, len * 0.55),
  vec(8.4, len + 1.4), vec(-5.4, len + 2), vec(-10.4, len * 0.6), vec(-12, len * 0.2),
];

function trollTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const breathe = Math.sin(t * Math.PI * 2) * 0.3;
  const R = profileRings(TROLL_BODY(len), y => len - y, a => a * 0.92 + breathe, 8);
  const front = T.vis(0) > T.vis(Math.PI);
  const flap = p.flow * 2;
  const loin = (s: 1 | -1): L3[] => {
    const fr = s > 0 ? 9.6 : -7;
    return [[1.4, fr, -4.2], [1.4, fr, 4.2], [-8.4, fr - flap * s + 0.8 * s, 3.4], [-6.8, fr - flap * s + 0.4 * s, 0], [-8.8, fr - flap * s + 0.8 * s, -3.4]];
  };
  const mane = backSpikes(T, R, len + 3, len * 0.3, 5, [-1, 0, 1], i => 4.2 - i * 0.4 + p.flow * 1.4, 2.4);
  const parts: Part3[] = [
    { pts: loin(front ? -1 : 1), tone: PELT, bias: -20 },
    ...mane.map(pts => ({ pts, tone: MANE, band: 1, hull: true })),
  ];
  solid3(ctx, T, R, HIDE, {
    band: 2.2,
    hi: 1,
    parts,
    face: () => {
      // Pale belly plates
      if (T.vis(0) > -0.3) {
        cel(ctx, () => polyPath(ctx, surfPatch(T, R, len - 1, 2, -0.95, 0.95, 0.1, 10)), BELLY, { band: 1.2, stroke: 0.4 });
        for (const h of [len * 0.62, len * 0.42, len * 0.22]) strap(ctx, T, R, [[h, -0.9], [h - 0.8, 0], [h, 0.9]], BELLY, 0.3, 0.15);
      }
      // Scars across the chest
      decal(ctx, T, R, len * 0.72, -0.9, () => {
        ctx.strokeStyle = 'rgba(40,30,40,0.55)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-2.4, -2.6);
        ctx.lineTo(2, 2.6);
        ctx.moveTo(-1.2, -3);
        ctx.lineTo(-0.4, -1.6);
        ctx.stroke();
      });
      // Moss carpet over the hump and shoulders
      // (only where the hump faces the camera: a patch wrapping past the
      // silhouette would fold over the chest)
      if (T.vis(Math.PI) > -0.25) cel(ctx, () => polyPath(ctx, surfPatch(T, R, len + 3.4, len - 3, Math.PI - 1.9, Math.PI + 1.9, 0.3, 12, k => len - 3 - Math.abs(Math.sin(k * Math.PI * 4)) * 1.6)), MOSS, { band: 1 });
      for (const [h, phi] of [[len + 1, 2.6], [len - 1, 3.4], [len + 2, 3.9], [len - 2, 2.2]] as const) {
        decal(ctx, T, R, h, phi, () => {
          ctx.fillStyle = MOSS_DARK.base;
          ctx.beginPath();
          ctx.arc(0, 0, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }, { lift: 0.4 });
      }
    },
    over: () => {
      band(ctx, T, R, 1.2, PELT_DARK, 2.2, 0.4);
      decal(ctx, T, R, 1.2, 0.35, () => {
        ctx.save();
        ctx.rotate(0.3);
        cel(ctx, () => ellipsePath(ctx, vec(0, 0), 2.6, 0.9), TUSK, { band: 0.3, stroke: 0.35 });
        ctx.restore();
      }, { lift: 1, minVis: 0.05 });
      poly3(ctx, T, loin(front ? 1 : -1), PELT, { band: 1 });
    },
  });
}

const TROLL_SKULL = profileRings([vec(-5.8, -1), vec(-4.6, -5.8), vec(1.4, -7), vec(6.4, -4.6), vec(8.2, 0), vec(8.4, 4.6), vec(3.4, 7.4), vec(-3.6, 6)], y => -y, a => a * 0.95, 8);
const TROLL_EYE = { h: 1.4, phi: 0.5 };

function trollHeadView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  const H = turnedHead(sk, 0.35);
  const R = TROLL_SKULL;
  const parts: Part3[] = [
    // Ragged ears
    { pts: [[2.4, -1, 5.6], [4.6 + p.flow, -5.6, 11], [2.8, -4.6, 9.4], [2.2, -6, 9.6], [-1, -2, 5.8]], tone: HIDE, farTone: HIDE_FAR, mirror: true, band: 0.6 },
    // Underbite jaw
    { pts: [[-2, 1, -4.2], [-2, 1, 4.2], [-3, 9, -3], [-3, 9, 3], [-7.4, 6.6, -2.6], [-7.4, 6.6, 2.6], [-6.4, 0.6, -3.6], [-6.4, 0.6, 3.6]], tone: HIDE, hull: true, band: 1, bias: 0.6 },
    // Tusks jutting up out of the jaw
    { pts: [[-2.8, 7.4, 2.4], [-2.8, 8.6, 2.2], [2.4, 8.4, 3], [-3.2, 8, 3]], tone: TUSK, mirror: true, hull: true, band: 0.4, bias: 1.2 },
    // Bulbous nose
    { pts: [[3, 8, -1.4], [3, 8, 1.4], [0.4, 10.4, -1.6], [0.4, 10.4, 1.6], [-1.6, 9.8, -1.8], [-1.6, 9.8, 1.8], [-1.4, 7.6, -1.6], [-1.4, 7.6, 1.6], [1.4, 11, 0]], tone: HIDE, hull: true, smooth: true, band: 0.6, bias: 0.8 },
    // Tuft of mane on the crown
    { pts: [[6.4, -5, -1.6], [6.6, 1, 0], [6.4, -5, 1.6], [9.6 + p.flow, -5.4, 0]], tone: MANE, hull: true, band: 0.6 },
  ];
  solid3(ctx, H, R, HIDE, {
    band: 1.6,
    hi: 0.8,
    parts,
    face: () => {
      if (H.vis(0) < -0.3) return;
      cel(ctx, () => polyPath(ctx, surfPatch(H, R, 4.6, 2.8, -1, 1, 0.3, 8, k => 2.6 - Math.sin(k * Math.PI) * 0.4)), HIDE_FAR, { band: 0.5, stroke: 0.4 });
      for (const s of [1, -1]) {
        eye3(ctx, H, R, TROLL_EYE.h, s * TROLL_EYE.phi, { rx: 1.5, ry: 1, socket: '#1a0c08', iris: '#ffb45a', irisR: 0.45 });
      }
      // Grimace under the nose
      ctx.fillStyle = '#23161a';
      ctx.beginPath();
      polyPath(ctx, surfPatch(H, R, -2.4, -3.2, -0.7, 0.7, 0.2, 6, k => -2.8 - Math.sin(k * Math.PI) * 0.8));
      ctx.fill();
    },
  });
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 12, shin: 11.5, upperArm: 13, foreArm: 12.5,
    torso: 20, neck: 4.5, ankle: 2.4,
    hipN: vec(3.5, 0), hipF: vec(-3.5, -0.6),
    shN: vec(2.4, 3.6), shF: vec(-6.4, 2.6),
  },
  armFar(ctx, sk) {
    trollArm(ctx, sk.shF, sk.elF, sk.handF, HIDE_FAR);
    trollFist(ctx, sk.handF, HIDE_FAR, false);
  },
  legFar(ctx, sk) {
    trollLeg(ctx, sk, false);
  },
  legNear(ctx, sk) {
    trollLeg(ctx, sk, true);
  },
  torso(ctx, sk, p, t) {
    trollTorso(ctx, sk, p, t);
  },
  head(ctx, sk, p) {
    trollHead(ctx, sk, p);
  },
  armNear(ctx, sk) {
    trollArm(ctx, sk.shN, sk.elN, sk.handN, HIDE);
    bracer(ctx, sk.elN, sk.handN);
    // Moss clump on the near shoulder
    cel(ctx, () => blobPath(ctx, [vec(sk.shN.x - 4.4, sk.shN.y + 0.6), vec(sk.shN.x - 2.6, sk.shN.y - 3.8), vec(sk.shN.x + 2.4, sk.shN.y - 4), vec(sk.shN.x + 4.6, sk.shN.y - 0.4), vec(sk.shN.x + 1, sk.shN.y + 1.2)]), MOSS, { band: 0.8 });
  },
  weapon(ctx, sk, p) {
    club(ctx, sk.handN, p.wpn);
    trollFist(ctx, sk.handN, HIDE, true);
  },
};

// ── Poses ───────────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 4, 68.5),
  lean: 0.62,
  head: -0.72,
  footN: vec(CENTER_X + 6, GROUND_Y),
  footF: vec(CENTER_X - 9, GROUND_Y),
  handN: vec(CENTER_X + 15, 75),
  handF: vec(CENTER_X + 3, 81),
  wpn: 1.95,
  flow: 0.1,
});

const P = (o: Partial<HumanPose>): HumanPose => ({ ...READY, ...o });

const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  // Rear up and haul the club back across the shoulders; off-hand reaches forward
  { at: 0.33, ease: 'out', pose: P({ root: vec(CENTER_X - 7, 68), lean: 0.1, head: -0.25, handN: vec(CENTER_X - 9, 40), wpn: -1.55, handF: vec(CENTER_X + 14, 62), footN: vec(CENTER_X + 7, GROUND_Y), stretch: 0.05, flow: 0.35 }) },
  // Club whips over the top
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X - 2, 69), lean: 0.4, head: -0.55, handN: vec(CENTER_X + 16, 41), wpn: 1.2, handF: vec(CENTER_X + 4, 72), footN: vec(CENTER_X + 10, GROUND_Y), fx: 0.8, flow: 0.4 }) },
  // SLAM — full-body follow-through, granite head buried in the ground
  { at: 1, ease: 'linear', pose: P({ root: vec(CENTER_X + 2, 73), lean: 1.02, head: -1.05, handN: vec(CENTER_X + 22, 74), wpn: 2.0, handF: vec(CENTER_X + 12, 84), footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 9, GROUND_Y), fx: 1, stretch: -0.06, flow: 0.55 }) },
];

const recoil = P({ root: vec(CENTER_X - 8, 69.5), lean: 0.22, head: -0.2, handN: vec(CENTER_X + 6, 70), handF: vec(CENTER_X - 6, 72), wpn: 0.55, footF: vec(CENTER_X - 12, GROUND_Y), flow: 0.5, stretch: -0.03 });

const HURT: Key<HumanPose>[] = [
  { at: 0, pose: recoil },
  { at: 1, pose: P({ root: vec(CENTER_X - 6, 69), lean: 0.45, head: -0.5, handN: vec(CENTER_X + 11, 74), handF: vec(CENTER_X, 78), wpn: 0.9, flow: 0.3 }) },
];

// Staggers, drops to its knees, then topples forward onto its face.
// Spin rotates the whole rig (legs included), so the lying pose is authored
// upright with the legs hanging straight below the pelvis.
const DEATH: Key<HumanPose>[] = [
  { at: 0, pose: recoil },
  { at: 0.33, pose: P({ root: vec(CENTER_X - 5, 78), lean: 0.55, head: -0.35, footN: vec(CENTER_X + 2, GROUND_Y), footF: vec(CENTER_X - 13, GROUND_Y), handN: vec(CENTER_X + 12, 86), handF: vec(CENTER_X + 1, 89), wpn: 1.9, flow: 0.3 }) },
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X - 7, 80), lean: 0.2, head: -0.1, spin: 0.75, footN: vec(CENTER_X - 5, 100), footF: vec(CENTER_X - 9, 100), handN: vec(CENTER_X + 2, 52), handF: vec(CENTER_X - 6, 56), wpn: 0.9, flow: 0.2 }) },
  { at: 1, ease: 'out', pose: P({ root: vec(CENTER_X - 10, 80.5), lean: 0.05, head: 0.15, spin: 1.5, footN: vec(CENTER_X - 9, 102), footF: vec(CENTER_X - 12, 102.5), handN: vec(CENTER_X - 2, 70), handF: vec(CENTER_X - 14, 54), wpn: 0.05, flow: 0.05 }) },
];

const VIEW_BUILD = { hipW: 4, shW: 8, elbowOut: 1.8, footOut: 0.8 };

function clubTip(p: HumanPose): { tip: V; base: V } {
  const sk = solveSkeleton(p, SKIN.prop);
  return { tip: along(sk.handN, p.wpn, CLUB_LEN), base: along(sk.handN, p.wpn, 8) };
}

function drawFx(ctx: CanvasRenderingContext2D, p: HumanPose, sk: Skeleton, act: MonsterAction, t: number): void {
  if (act === 'attack' && t > 0.9) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const s = clubTip(samplePoseTrack(ATTACK, Math.max(0.67, t - i * 0.055)));
      tips.push(s.tip);
      bases.push(s.base);
    }
    smear(ctx, tips, bases, 0xe8dcc0, 0.35);
  }
  if (act === 'attack' && t > 0.95) {
    // Ground impact: dust plume, stone chips and a crack flash
    const hit = vec(clubTip(p).tip.x, GROUND_Y - 1);
    glow(ctx, vec(hit.x + 2, hit.y + 1), 6, 0xffc27a, 0.4);
    ctx.fillStyle = 'rgba(200,190,170,0.45)';
    for (const [dx, dy, r] of [[-12, -1.5, 3], [-8, -3, 2.4], [9, -2.4, 2.8], [13, -1, 2.2]] as const) {
      ctx.beginPath();
      ctx.ellipse(hit.x + dx, hit.y + dy, r * 1.3, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#8e949c';
    for (const [dx, dy] of [[-8, -10], [6, -12], [11, -7], [-12, -6]] as const) {
      ctx.fillRect(hit.x + dx, hit.y + dy, 1.4, 1.2);
    }
    ctx.strokeStyle = 'rgba(255,200,120,0.8)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(hit.x - 9, hit.y + 1.4);
    ctx.lineTo(hit.x - 3, hit.y + 0.6);
    ctx.lineTo(hit.x + 2, hit.y + 1.6);
    ctx.lineTo(hit.x + 9, hit.y + 0.8);
    ctx.stroke();
  }
  // Ember eyes
  if (act !== 'death' || t < 0.5) {
    const eye = vec(sk.head.x + Math.cos(sk.headAng) * 5.6 - Math.sin(sk.headAng) * -0.9, sk.head.y + Math.sin(sk.headAng) * 5.6 + Math.cos(sk.headAng) * -0.9);
    glow(ctx, eye, 2.6 + p.fx, EMBER, 0.4 + p.fx * 0.35);
  }
}

export const MountainTrollDrawer = humanoidMonster({
  key: 'monster_mountain_troll',
  // Wide for the club slam reach; width doesn't move the sprite in-game.
  frameW: 96,
  frameH: 72,
  scale: 1.34,
  skin: SKIN,
  ready: READY,
  attack: 'overhead',
  walk: { stride: 6.5, lift: 3, bob: 1.8, lean: 0.06, armSwing: 4, spread: 1.5 },
  tracks: { attack: ATTACK, hurt: HURT, death: DEATH },
  idle: (t, R) => {
    const ph = t * Math.PI * 2;
    const b = Math.sin(ph);
    return {
      ...R,
      root: vec(R.root.x, R.root.y + b * 0.9),
      lean: R.lean + b * 0.03,
      head: R.head + Math.sin(ph - 0.8) * 0.06,
      handN: vec(R.handN.x + Math.sin(ph - 0.5) * 0.6, R.handN.y + b * 0.9),
      handF: vec(R.handF.x - Math.sin(ph - 0.7) * 0.8, R.handF.y + Math.sin(ph - 0.7) * 0.8),
      wpn: R.wpn + Math.sin(ph - 0.4) * 0.05,
      flow: R.flow + b * 0.08,
    };
  },
  fx: drawFx,
  view: {
    build: VIEW_BUILD,
    headBias: 4,
    torso: trollTorsoView,
    head: trollHeadView,
  },
  viewFx: (ctx, p, sk, act, t) => {
    if (act === 'attack' && t > 0.9) {
      const tips: V[] = [];
      const bases: V[] = [];
      for (let i = 6; i >= 0; i--) {
        const q = samplePoseTrack(ATTACK, Math.max(0.67, t - i * 0.055));
        const s2 = solveViewSkeleton(q, SKIN.prop, VIEW_BUILD, sk.rig.view);
        const { ang, k } = s2.rig.dir(q.wpn);
        tips.push(vec(s2.handN.x + Math.sin(ang) * k * CLUB_LEN, s2.handN.y - Math.cos(ang) * k * CLUB_LEN));
        bases.push(vec(s2.handN.x + Math.sin(ang) * k * 8, s2.handN.y - Math.cos(ang) * k * 8));
      }
      smear(ctx, tips, bases, 0xe8dcc0, 0.35);
    }
    if (act === 'attack' && t > 0.95) {
      // Ground impact where the club head lands
      const { ang, k } = sk.rig.dir(p.wpn);
      const hit = vec(sk.handN.x + Math.sin(ang) * k * CLUB_LEN, GROUND_Y + (sk.rig.front ? 3 : -3));
      glow(ctx, hit, 6, 0xffc27a, 0.4);
      ctx.fillStyle = 'rgba(200,190,170,0.45)';
      for (const [dx, dy, r] of [[-10, -1.5, 3], [-6, -3, 2.4], [8, -2.4, 2.8], [11, -1, 2.2]] as const) {
        ctx.beginPath();
        ctx.ellipse(hit.x + dx, hit.y + dy, r * 1.3, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#8e949c';
      for (const [dx, dy] of [[-8, -10], [6, -12], [11, -7], [-12, -6]] as const) ctx.fillRect(hit.x + dx, hit.y + dy, 1.4, 1.2);
    }
    if (act !== 'death' || t < 0.5) {
      for (const e of eyeGlowPoints(turnedHead(sk, 0.35), TROLL_SKULL, TROLL_EYE.h, [TROLL_EYE.phi, -TROLL_EYE.phi])) {
        glow(ctx, e, 2.2 + p.fx, EMBER, 0.4 + p.fx * 0.35);
      }
    }
  },
  shadowR: 17,
});
