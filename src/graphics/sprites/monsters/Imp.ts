// src/graphics/sprites/monsters/Imp.ts
//
// 小恶魔 — a wiry, pot-bellied crimson imp that hovers on ragged bat wings:
// oversized head with swept-back horns and ears, a gleeful fanged grin,
// ember-yellow eyes and a spaded whip of a tail. It rears back, ignites its
// talons with hellfire and dives in for a raking slash; on death it tumbles
// out of the air and burns away to ash.
//
// Also exports the small shared "abyss" drawing kit (bat wings, tapered
// tails, ember dissolve) reused by the other Abyss Rift demons.
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
import {
  basePose,
  drawHumanoid,
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
  decal,
  eye3,
  eyeGlowPoints,
  groundX,
  lp,
  monsterViewSkin,
  poly3,
  profileRings,
  sagittal,
  sagittalSpun,
  solid3,
  strap,
  surfPatch,
  tube3,
  turnedHead,
  wingDepth,
  wingPlane,
  type L3,
  type Part3,
} from '../rig/MonsterView';

// ── Shared abyss kit ────────────────────────────────────────────────────

/** Deterministic hash → [0, 1). */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Point in a bone/head-local frame (x forward, y down) rotated by `ang`. */
export function localPt(origin: V, ang: number, x: number, y: number): V {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return vec(origin.x + x * c - y * s, origin.y + x * s + y * c);
}

/** Closed outline around a polyline, radius tapering r0 → r1. */
export function taperPath(ctx: CanvasRenderingContext2D, pts: readonly V[], r0: number, r1: number): void {
  const left: V[] = [];
  const right: V[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const r = r0 + (r1 - r0) * (i / (n - 1));
    left.push(vec(pts[i].x - (dy / l) * r, pts[i].y + (dx / l) * r));
    right.push(vec(pts[i].x + (dy / l) * r, pts[i].y - (dx / l) * r));
  }
  const all = [...left, ...right.reverse()];
  blobPath(ctx, all);
}

/**
 * Curling chain for tails/tentacles. Angles use the dirUp convention
 * (0 = up, −π/2 = straight back). Curvature bends it along its length and a
 * travelling wave adds follow-through.
 */
export function curlChain(root: V, ang0: number, curve: number, len: number, segs: number, wave: number, phase: number): V[] {
  const pts: V[] = [root];
  let a = ang0;
  const seg = len / segs;
  for (let i = 1; i <= segs; i++) {
    const k = i / segs;
    a += curve / segs + Math.sin(phase - k * 3) * wave * 0.12;
    pts.push(along(pts[i - 1], a, seg));
  }
  return pts;
}

/** Spade-tipped demon tail. */
export function demonTail(ctx: CanvasRenderingContext2D, pts: readonly V[], r0: number, t: Tone, tip: Tone, spade = 2.6): void {
  cel(ctx, () => taperPath(ctx, pts, r0, r0 * 0.3), t, { band: r0 * 0.5 });
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const P = (x: number, y: number): V => localPt(b, ang, x, y);
  cel(ctx, () => polyPath(ctx, [P(-0.6, 0), P(spade * 0.5, -spade * 0.85), P(spade * 1.7, 0), P(spade * 0.5, spade * 0.85)]), tip, { band: 0.5 });
}

export interface WingLook {
  membrane: Tone;
  bone: Tone;
  /** Ragged/torn membrane edge. */
  tatter?: number;
  claw?: Tone;
}

/**
 * Bat wing hinged at `root`. `ang` is the arm angle (dirUp: 0 up, − back),
 * `span` the overall size, `fold` 0 (open) … 1 (tucked).
 */
export function batWing(ctx: CanvasRenderingContext2D, root: V, ang: number, span: number, fold: number, look: WingLook, seed = 0): void {
  const elbow = along(root, ang - 0.75, span * 0.36);
  const wrist = along(elbow, ang + 0.35 - fold * 0.5, span * 0.4 * (1 - fold * 0.25));
  const fan = 0.44 * (1 - fold * 0.65);
  const tips: V[] = [];
  for (let i = 0; i < 4; i++) {
    tips.push(along(wrist, ang - 1.25 - i * fan - fold * 0.6, span * (0.66 - i * 0.07) * (1 - fold * 0.35)));
  }
  const attach = along(root, ang - 2.9, span * 0.2);
  const tat = look.tatter ?? 0;
  const pts = [...tips, attach];
  const outline = (): void => {
    ctx.moveTo(root.x, root.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.lineTo(tips[0].x, tips[0].y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const m = lerpV(lerpV(a, b, 0.5), wrist, 0.3 + (i === pts.length - 1 ? -0.1 : 0));
      if (tat > 0) {
        // Torn notches along the scallop
        const q1 = lerpV(a, m, 0.55);
        const q2 = lerpV(m, b, 0.45);
        const nick = tat * (0.6 + hash01(seed + i) * 0.8);
        ctx.quadraticCurveTo(lerpV(a, m, 0.3).x, lerpV(a, m, 0.3).y, q1.x, q1.y);
        ctx.lineTo(lerpV(q1, wrist, 0.12 * nick).x, lerpV(q1, wrist, 0.12 * nick).y);
        ctx.lineTo(q2.x, q2.y);
        ctx.quadraticCurveTo(lerpV(m, b, 0.7).x, lerpV(m, b, 0.7).y, b.x, b.y);
      } else {
        ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
      }
    }
    ctx.closePath();
  };
  cel(ctx, outline, look.membrane, { band: span * 0.05 });
  // Finger bones and the arm's leading edge
  ctx.lineCap = 'round';
  ctx.strokeStyle = look.bone.shade;
  ctx.lineWidth = Math.max(0.45, span * 0.028);
  for (const tp of tips) {
    ctx.beginPath();
    ctx.moveTo(wrist.x, wrist.y);
    ctx.lineTo(tp.x, tp.y);
    ctx.stroke();
  }
  limb(ctx, root, elbow, span * 0.05, span * 0.04, look.bone, 0.4);
  limb(ctx, elbow, wrist, span * 0.04, span * 0.03, look.bone, 0.3);
  // Thumb claw on the wrist
  const c = look.claw ?? look.bone;
  const hook = along(wrist, ang + 0.3, span * 0.09);
  cel(ctx, () => polyPath(ctx, [along(wrist, ang - 1.2, span * 0.03), hook, along(wrist, ang + 1.4, span * 0.03)]), c, { band: 0.2, stroke: 0.3 });
}

/**
 * Eat the drawn body away from the edges inward (death burn/dissolve).
 * Call inside a draw callback, after painting the body.
 */
export function erode(ctx: CanvasRenderingContext2D, amt: number, box: { x: number; y: number; w: number; h: number }, seed: number, char = 0.6, charColor = '20,6,10'): void {
  if (amt <= 0.001) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(${charColor},${Math.min(0.85, amt * char)})`;
  ctx.fillRect(box.x - 20, box.y - 20, box.w + 40, box.h + 40);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  const cell = 1.1;
  for (let y = box.y; y < box.y + box.h; y += cell) {
    for (let x = box.x; x < box.x + box.w; x += cell) {
      // Smooth value field so the body burns away in coherent patches,
      // eating in from the top of the box first.
      const n = 0.5
        + 0.22 * Math.sin(x * 0.42 + seed) * Math.cos(y * 0.37 - seed * 0.7)
        + 0.16 * Math.sin((x + y) * 0.23 + seed * 1.9)
        + 0.1 * (hash01(seed + Math.floor(x) * 13.1 + Math.floor(y) * 7.7) - 0.5)
        + 0.3 * ((y - box.y) / box.h - 0.5);
      if (n < amt) {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Embers drifting up out of a box (fx layer). */
export function embers(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, n: number, t: number, amt: number, color = 0xff7a2a, seed = 0): void {
  if (amt <= 0.02) return;
  for (let i = 0; i < n; i++) {
    const k = (hash01(seed + i) + t * 0.9) % 1;
    const x = box.x + hash01(seed + i * 3.3) * box.w + Math.sin(i * 2.1 + t * 8) * 2;
    const y = box.y + box.h - k * (box.h + 14);
    const a = amt * (1 - k) * (0.6 + hash01(i * 7.1) * 0.4);
    glow(ctx, vec(x, y), 1.4 + hash01(i * 1.7) * 1.4, color, a);
    ctx.fillStyle = `rgba(255,${200 + ((i * 17) % 50)},140,${a})`;
    ctx.fillRect(x - 0.35, y - 0.35, 0.7, 0.7);
  }
}

/** Two-tone cartoon flame tongue rising from `base` along angle `ang`. */
export function flameTongue(ctx: CanvasRenderingContext2D, base: V, ang: number, h: number, w: number, phase: number, outer: string, inner: string): void {
  const sway = Math.sin(phase) * 0.25;
  const P = (x: number, y: number): V => localPt(base, ang, x, y);
  const tip = P(sway * h * 0.6, -h);
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(P(-w, 0).x, P(-w, 0).y);
  ctx.quadraticCurveTo(P(-w * 1.1, -h * 0.5).x, P(-w * 1.1, -h * 0.5).y, tip.x, tip.y);
  ctx.quadraticCurveTo(P(w * 1.1, -h * 0.45).x, P(w * 1.1, -h * 0.45).y, P(w, 0).x, P(w, 0).y);
  ctx.quadraticCurveTo(P(0, w * 0.8).x, P(0, w * 0.8).y, P(-w, 0).x, P(-w, 0).y);
  ctx.fill();
  const tip2 = P(sway * h * 0.4, -h * 0.55);
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.moveTo(P(-w * 0.5, 0).x, P(-w * 0.5, 0).y);
  ctx.quadraticCurveTo(P(-w * 0.55, -h * 0.3).x, P(-w * 0.55, -h * 0.3).y, tip2.x, tip2.y);
  ctx.quadraticCurveTo(P(w * 0.55, -h * 0.3).x, P(w * 0.55, -h * 0.3).y, P(w * 0.5, 0).x, P(w * 0.5, 0).y);
  ctx.closePath();
  ctx.fill();
}

/** Control points that keep a horn's thickness as it bows through `ctrl`. */
function hornCtrls(b1: V, b2: V, ctrl: V, taper: number): [V, V] {
  const m = lerpV(b1, b2, 0.5);
  return [
    vec(ctrl.x + (b1.x - m.x) * taper, ctrl.y + (b1.y - m.y) * taper),
    vec(ctrl.x + (b2.x - m.x) * taper, ctrl.y + (b2.y - m.y) * taper),
  ];
}

/** Curved horn from a two-point base, bowing through `ctrl` to `tip`. */
export function hornPath(ctx: CanvasRenderingContext2D, b1: V, b2: V, ctrl: V, tip: V, taper = 0.75): void {
  const [c1, c2] = hornCtrls(b1, b2, ctrl, taper);
  ctx.moveTo(b1.x, b1.y);
  ctx.quadraticCurveTo(c1.x, c1.y, tip.x, tip.y);
  ctx.quadraticCurveTo(c2.x, c2.y, b2.x, b2.y);
  ctx.closePath();
}

/** Ring grooves across a horn (drawn over it). */
export function hornRidges(ctx: CanvasRenderingContext2D, b1: V, b2: V, ctrl: V, tip: V, n: number, color: string, w = 0.4, taper = 0.75): void {
  const [c1, c2] = hornCtrls(b1, b2, ctrl, taper);
  const q = (a: V, c: V, k: number): V => lerpV(lerpV(a, c, k), lerpV(c, tip, k), k);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  for (let i = 1; i <= n; i++) {
    const k = (i / (n + 1)) * 0.8;
    const p1 = q(b1, c1, k);
    const p2 = q(b2, c2, k);
    const mid = lerpV(lerpV(p1, p2, 0.5), tip, -0.06);
    ctx.beginPath();
    ctx.moveTo(lerpV(p1, p2, 0.06).x, lerpV(p1, p2, 0.06).y);
    ctx.quadraticCurveTo(mid.x, mid.y, lerpV(p1, p2, 0.94).x, lerpV(p1, p2, 0.94).y);
    ctx.stroke();
  }
}

// ── Imp look ────────────────────────────────────────────────────────────

const SKIN = tone(0xb3262f, { light: 0.34 });
const SKIN_FAR = tone(0x7c1624, { light: 0.18 });
const BELLY = tone(0xd9574a, { light: 0.3 });
const HORN = tone(0x3a2432, { light: 0.35 });
const CLAW = tone(0xf0e2c2, { light: 0.4, shadow: 0.3 });
const CLOTH = tone(0x2c1428, { light: 0.2 });
const WING: WingLook = {
  membrane: tone(0x5a1638, { light: 0.25, shadow: 0.5 }),
  bone: tone(0x8a2430, { light: 0.3 }),
  claw: CLAW,
  tatter: 0.8,
};
const WING_FAR: WingLook = {
  membrane: tone(0x3c0e28, { light: 0.15, shadow: 0.5 }),
  bone: tone(0x5e1624),
  claw: CLAW,
  tatter: 0.8,
};
const HELLFIRE = 0xff6a1a;
const EYE = 0xffc23a;

interface ImpPose extends HumanPose {
  /** Wing beat: +1 raised, −1 swept down. */
  wing: number;
  /** Tail whip phase offset. */
  tail: number;
  /** Death burn-away 0..1. */
  burn: number;
}

const PROP = {
  thigh: 6.4, shin: 6.4, upperArm: 6.6, foreArm: 6.2,
  torso: 10.5, neck: 6.2, ankle: 1.2,
  hipN: vec(1.4, 0), hipF: vec(-1.6, -0.3),
  shN: vec(0.8, 2.4), shF: vec(-2.8, 2),
};

function talonHand(ctx: CanvasRenderingContext2D, el: V, hand: V, t: Tone, fire: number): void {
  const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
  cel(ctx, () => ellipsePath(ctx, hand, 1.9, 1.6, ang), t, { band: 0.5 });
  for (let i = -1; i <= 1; i++) {
    const P = (x: number, y: number): V => localPt(hand, ang + i * 0.45, x, y);
    cel(ctx, () => polyPath(ctx, [P(1, -0.55), P(4.2, 0.6), P(1.1, 0.55)]), fire > 0.4 ? tone(0xffd27a, { light: 0.5 }) : CLAW, { band: 0.2, stroke: 0.3 });
  }
}

function talonFoot(ctx: CanvasRenderingContext2D, ankle: V, t: Tone, droop: number): void {
  const ang = 0.35 + droop;
  const P = (x: number, y: number): V => localPt(ankle, ang, x, y);
  cel(ctx, () => blobPath(ctx, [P(-1.2, -1), P(1.2, -1.1), P(4, 0.2), P(3.8, 1.3), P(-1, 1.2)]), t, { band: 0.5 });
  for (const dy of [-0.6, 0.6]) {
    cel(ctx, () => polyPath(ctx, [P(3.4, dy - 0.45), P(5.6, dy + 0.9), P(3.3, dy + 0.5)]), CLAW, { band: 0.15, stroke: 0.25 });
  }
}

function impLeg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, t: Tone): void {
  limb(ctx, hip, knee, 2, 1.4, t);
  limb(ctx, knee, ankle, 1.4, 0.95, t);
  cel(ctx, () => ellipsePath(ctx, knee, 1.5, 1.4), t, { band: 0.4 });
  talonFoot(ctx, ankle, t, 0.5);
}

function impArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, t: Tone, fire: number): void {
  limb(ctx, sh, el, 1.7, 1.25, t);
  limb(ctx, el, hand, 1.25, 1.05, t);
  // Bony elbow spur
  const back = Math.atan2(el.y - sh.y, el.x - sh.x);
  cel(ctx, () => polyPath(ctx, [localPt(el, back, -0.4, -0.9), localPt(el, back, 2.4, -0.2), localPt(el, back, 0.4, 0.9)]), HORN, { band: 0.2, stroke: 0.3 });
  talonHand(ctx, el, hand, t, fire);
}

function wingRoot(sk: Skeleton, p: HumanPose, far: boolean): V {
  return localPt(sk.neck, p.lean, far ? -1.2 : -3.2, far ? 2.2 : 3.4);
}

function wingAng(p: ImpPose, far: boolean): number {
  return -0.95 + p.wing * 0.62 + (far ? 0.42 : 0) + p.lean * 0.5;
}

const IMP_SKIN: HumanSkin = {
  prop: PROP,
  back(ctx, sk, p: ImpPose, t) {
    // Far wing peeks above the far shoulder; near wing spreads behind.
    batWing(ctx, wingRoot(sk, p, true), wingAng(p, true), 21, Math.max(0, -p.wing) * 0.35, WING_FAR, 3);
    // Tail sweeps back from the rump and curls up
    const root = localPt(sk.pelvis, p.lean * 0.3, -2.4, 1);
    const tail = curlChain(root, -2.1 + p.lean * 0.4, 2.1, 17, 8, 1 + p.flow, t * Math.PI * 2 + p.tail);
    demonTail(ctx, tail, 1.25, SKIN_FAR, HORN, 2.2);
  },
  armFar(ctx, sk, p) {
    impArm(ctx, sk.shF, sk.elF, sk.handF, SKIN_FAR, p.fx);
  },
  legFar(ctx, sk) {
    impLeg(ctx, sk.hipF, sk.kneeF, sk.footF, SKIN_FAR);
  },
  legNear(ctx, sk) {
    impLeg(ctx, sk.hipN, sk.kneeN, sk.footN, SKIN);
  },
  torso(ctx, sk, p: ImpPose) {
    batWing(ctx, wingRoot(sk, p, false), wingAng(p, false), 26, Math.max(0, -p.wing) * 0.3, WING, 7);
    inBone(ctx, sk.neck, sk.pelvis, (len) => {
      const body = [vec(-3.6, 0), vec(1.2, -0.8), vec(4, 1.6), vec(5.4, len * 0.55), vec(4.6, len + 0.4), vec(-2.8, len + 0.8), vec(-4.2, len * 0.45)];
      cel(ctx, () => blobPath(ctx, body), SKIN, { band: 1.3 });
      // Lighter pot belly
      cel(ctx, () => ellipsePath(ctx, vec(2.4, len * 0.62), 2.7, 3.4, -0.15), BELLY, { band: 0.8, stroke: 0.3 });
      // Ribs
      ctx.strokeStyle = SKIN.shade;
      ctx.lineWidth = 0.4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-1.4, 2.4 + i * 1.5);
        ctx.quadraticCurveTo(1.2, 3 + i * 1.5, 2.8, 2.2 + i * 1.6);
        ctx.stroke();
      }
      // Tattered loincloth on a cord
      ctx.strokeStyle = HORN.base;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-3, len - 0.4);
      ctx.lineTo(4.8, len - 0.8);
      ctx.stroke();
      cel(ctx, () => polyPath(ctx, [vec(0.2, len - 0.6), vec(4.8, len - 1), vec(4.2, len + 4.6), vec(2.8, len + 3.6), vec(1.6, len + 5), vec(0.6, len + 3.4)]), CLOTH, { band: 0.6 });
    });
  },
  head(ctx, sk, p: ImpPose, t) {
    ctx.save();
    ctx.translate(sk.head.x, sk.head.y);
    ctx.rotate(sk.headAng);
    const flick = Math.sin(t * Math.PI * 2 + 1.3) * 0.8 + p.flow * 1.2;
    // Far horn + far ear
    const fh = [vec(-2.2, -5.2), vec(0.6, -6.2), vec(-4, -12), vec(-7.5, -15.5)] as const;
    cel(ctx, () => hornPath(ctx, fh[0], fh[1], fh[2], fh[3]), tone(0x2a1a26), { band: 0.6 });
    cel(ctx, () => polyPath(ctx, [vec(-2.6, -2.8), vec(-12 - flick, -6.4), vec(-9, -3.4), vec(-3, 0.8)]), SKIN_FAR, { band: 0.6 });
    // Cranium with a long grinning jaw
    const skull = [vec(-5.4, -1), vec(-4.6, -5.4), vec(0.6, -7.2), vec(5.2, -5.4), vec(7.2, -1.6), vec(8.4, 1.8), vec(6.4, 5.2), vec(1.6, 6), vec(-3.4, 4.2)];
    cel(ctx, () => blobPath(ctx, skull), SKIN, { band: 1.4 });
    // Heavy brow
    cel(ctx, () => polyPath(ctx, [vec(1, -3.6), vec(4.2, -4.4), vec(7.8, -2.6), vec(7.2, -1.4), vec(3.4, -2.2), vec(1.2, -2.2)]), SKIN_FAR, { band: 0.3, stroke: 0.3 });
    // Eyes: glowing yellow almonds, the far one smaller
    ctx.fillStyle = '#2a0608';
    ctx.beginPath();
    ctx.ellipse(4.2, -0.9, 2, 1.4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.ellipse(4.4, -0.9, 1.6, 1, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(4.6, -1.4, 0.8, 0.6);
    ctx.fillStyle = '#ffb030';
    ctx.beginPath();
    ctx.ellipse(7.3, -0.7, 0.6, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Snub nose
    cel(ctx, () => ellipsePath(ctx, vec(8.2, 0.9), 1.2, 1), SKIN, { band: 0.3, stroke: 0.35 });
    // Wide fanged grin
    ctx.fillStyle = '#2a0508';
    ctx.beginPath();
    ctx.moveTo(1.2, 2.2);
    ctx.quadraticCurveTo(4.6, 5.2 + p.fx * 0.8, 8, 2.8);
    ctx.quadraticCurveTo(4.6, 3.6, 1.2, 2.2);
    ctx.fill();
    ctx.fillStyle = CLAW.base;
    for (const [x, y, l] of [[2.6, 2.9, 1.3], [4.3, 3.3, 1.1], [6, 3.3, 1.3], [7.2, 3, 0.9]] as const) {
      ctx.beginPath();
      ctx.moveTo(x - 0.45, y);
      ctx.lineTo(x + 0.45, y);
      ctx.lineTo(x, y + l);
      ctx.fill();
    }
    // Near ear: long, pointed, swept back
    const ear = [vec(-1.6, -2.2), vec(-13.5 - flick, -6.8), vec(-10, -2.6), vec(-2.6, 1.6)];
    cel(ctx, () => polyPath(ctx, ear), SKIN, { band: 0.8 });
    cel(ctx, () => polyPath(ctx, [vec(-3.2, -1.4), vec(-11.2 - flick * 0.9, -5.8), vec(-8.8, -3), vec(-3.4, 0.4)]), SKIN_FAR, { band: 0.3, stroke: 0 });
    // Near horn: thick base on the brow, curling back and up
    const b1 = vec(0.2, -6.4);
    const b2 = vec(3.6, -5.6);
    const ctrl = vec(0.4, -13);
    const tip = vec(-6.2, -17);
    cel(ctx, () => hornPath(ctx, b1, b2, ctrl, tip), HORN, { band: 0.8 });
    hornRidges(ctx, b1, b2, ctrl, tip, 3, HORN.shade);
    ctx.restore();
  },
  armNear() {
    // Drawn in weapon(): the rig then layers it over the big head whenever
    // the talons are forward of the neck, and behind it on the wind-up.
  },
  weapon(ctx, sk, p) {
    impArm(ctx, sk.shN, sk.elN, sk.handN, SKIN, p.fx);
  },
};

// ── Isometric 3/4 views ─────────────────────────────────────────────────

const IMP_BODY = (len: number): V[] => [vec(-3.6, 0), vec(1.2, -0.8), vec(4, 1.6), vec(5.4, len * 0.55), vec(4.6, len + 0.4), vec(-2.8, len + 0.8), vec(-4.2, len * 0.45)];
const IMP_SKULL = profileRings([vec(-5.4, -1), vec(-4.6, -5.4), vec(0.6, -7.2), vec(5.2, -5.4), vec(7.2, -1.6), vec(7.4, 1.8), vec(5.4, 5.2), vec(1.6, 6), vec(-3.4, 4.2)], y => -y, a => a * 0.95, 8);
const IMP_EYE = { h: 2.2, phi: 0.48 };

function impTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, _p: HumanPose): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = profileRings(IMP_BODY(len), y => len - y, a => a * 1.05, 7);
  const front = T.vis(0) > T.vis(Math.PI);
  const flap = (s: 1 | -1): L3[] => {
    const fr = s > 0 ? 4.6 : -3.6;
    return [[0.8, fr, -2], [0.8, fr, 2], [-4.4, fr + 0.4 * s, 1.6], [-3.4, fr + 0.3 * s, 0], [-4.8, fr + 0.4 * s, -1.6]];
  };
  poly3(ctx, T, flap(front ? -1 : 1), CLOTH, { band: 0.6 });
  solid3(ctx, T, R, SKIN, {
    band: 1.3,
    face: () => {
      decal(ctx, T, R, len * 0.38, 0.3, () => cel(ctx, () => ellipsePath(ctx, vec(0, 0), 2.7, 3.4), BELLY, { band: 0.8, stroke: 0.3 }), { lift: 0.1 });
      for (let i = 0; i < 3; i++) strap(ctx, T, R, [[len - 2.4 - i * 1.5, -1.2], [len - 3 - i * 1.5, 0], [len - 2.4 - i * 1.5, 1.2]], { ...SKIN, base: SKIN.shade, line: 'rgba(0,0,0,0)' }, 0.4, 0.05);
    },
    over: () => {
      strap(ctx, T, R, [[0.8, -Math.PI], [0.8, 0], [0.8, Math.PI]], HORN, 0.6, 0.3);
      poly3(ctx, T, flap(front ? 1 : -1), CLOTH, { band: 0.6 });
    },
  });
}

function impHeadView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const H = turnedHead(sk, 0.4);
  const R = IMP_SKULL;
  const flick = Math.sin(t * Math.PI * 2 + 1.3) * 0.8 + p.flow * 1.2;
  const horn = (s: 1 | -1): L3[] => [[5.8, 2.4, 2.6 * s], [9.8, 0.4, 4.2 * s], [13.4, -3.6, 5.2 * s], [16, -7, 5.6 * s]];
  const parts: Part3[] = [
    { pts: [[3.6, -0.6, 4.6], [5 + flick * 0.3, -6 - flick, 13], [2.6, -4.6, 11], [-1.4, -1, 4.8]], tone: SKIN, farTone: SKIN_FAR, mirror: true, band: 0.8 },
    { pts: [[0.6, 7.4, -1.1], [0.6, 7.4, 1.1], [-0.8, 8.6, -0.9], [-0.8, 8.6, 0.9], [-1.6, 7.2, -1.1], [-1.6, 7.2, 1.1]], tone: SKIN, hull: true, band: 0.3, stroke: 0.35, bias: 0.4 },
  ];
  const drawHorns = (behind: boolean): void => {
    for (const s of [1, -1] as const) {
      const deep = H.rig.d(lp(H, 10, 0, 4.2 * s)) < H.rig.d(H.o);
      if (deep !== behind) continue;
      tube3(ctx, H, horn(s), [1.5, 1.2, 0.8, 0.35], s > 0 ? HORN : tone(0x2a1a26));
    }
  };
  drawHorns(true);
  solid3(ctx, H, R, SKIN, {
    band: 1.4,
    parts,
    face: () => {
      if (H.vis(0) < -0.3) return;
      cel(ctx, () => polyPath(ctx, surfPatch(H, R, IMP_EYE.h + 2.4, IMP_EYE.h + 1.2, -1.1, 1.1, 0.2, 6, k => IMP_EYE.h + 1.2 - Math.sin(k * Math.PI) * 0.3)), SKIN_FAR, { band: 0.3, stroke: 0.3 });
      for (const sgn of [1, -1]) {
        eye3(ctx, H, R, IMP_EYE.h, sgn * IMP_EYE.phi, { rx: 2, ry: 1.4, socket: '#2a0608', iris: '#ffd24a', irisR: 0.8, tilt: -0.2 });
      }
      // Wide fanged grin
      const mouth = surfPatch(H, R, -1.6, -2, -0.9, 0.9, 0.15, 10, k => -2.2 - Math.sin(k * Math.PI) * (1.4 + p.fx * 0.8));
      ctx.fillStyle = '#2a0508';
      ctx.beginPath();
      polyPath(ctx, mouth);
      ctx.fill();
      ctx.fillStyle = CLAW.base;
      for (const phi of [-0.6, -0.2, 0.2, 0.6]) {
        decal(ctx, H, R, -1.8, phi, () => {
          ctx.beginPath();
          ctx.moveTo(-0.45, 0);
          ctx.lineTo(0.45, 0);
          ctx.lineTo(0, 1.2);
          ctx.fill();
        }, { lift: 0.2, minVis: 0.05 });
      }
    },
  });
  drawHorns(false);
}

/** Bat wings spread out in their own planes; tail on the body plane. */
function impExtra(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number, d0: number): ViewPart[] {
  const ip = p as ImpPose;
  const T = sk.torso;
  const len = sk.torsoLen;
  const out: ViewPart[] = [];
  for (const s of [1, -1] as const) {
    const anchor = lp(T, len - 2.4, -3, s * 1.6);
    const spread = s < 0 && sk.rig.front ? 0.2 : 1.2;
    const root = { x: anchor.x, y: anchor.y };
    out.push({
      z: wingDepth(sk.rig, anchor, s, spread, 8) - d0 + (s > 0 ? 0 : -8),
      draw: () => wingPlane(ctx, sk.rig, anchor, root, s, spread, () =>
        batWing(ctx, root, wingAng(ip, s < 0) - p.lean * 0.5, s > 0 ? 24 : 21, Math.max(0, -ip.wing) * 0.3, s > 0 ? WING : WING_FAR, s > 0 ? 7 : 3)),
    });
  }
  out.push({
    z: T.depth(0, Math.PI, 4, 0) - d0,
    draw: () => sagittal(ctx, sk.rig, 0, () => {
      const side = solveSkeleton(p, PROP);
      const root = localPt(side.pelvis, p.lean * 0.3, -2.4, 1);
      const tail = curlChain(root, -2.1 + p.lean * 0.4, 2.1, 17, 8, 1 + p.flow, t * Math.PI * 2 + ip.tail);
      demonTail(ctx, tail, 1.25, SKIN_FAR, HORN, 2.2);
    }),
  });
  return out;
}

const IMP_VIEW = monsterViewSkin(IMP_SKIN, {
  build: { hipW: 1.8, shW: 3.6, elbowOut: 1, footOut: 0.4 },
  headBias: 5,
  torso: impTorsoView,
  head: impHeadView,
  back: () => undefined,
  extra: impExtra,
  armNear: (ctx, sk, p) => impArm(ctx, sk.shN, sk.elN, sk.handN, SKIN, p.fx),
  weapon: () => undefined,
});

function impViewEyes(sk: ViewSkeleton): V[] {
  return eyeGlowPoints(turnedHead(sk, 0.4), IMP_SKULL, IMP_EYE.h, [IMP_EYE.phi, -IMP_EYE.phi]);
}

// ── Animation ───────────────────────────────────────────────────────────

const READY: ImpPose = {
  ...basePose({
    root: vec(CENTER_X - 2, 60),
    lean: 0.3,
    head: -0.28,
    footN: vec(CENTER_X + 1.5, 73.5),
    footF: vec(CENTER_X - 3, 73),
    handN: vec(CENTER_X + 8, 57),
    handF: vec(CENTER_X + 4.5, 55),
    flow: 0.15,
  }),
  wing: 0,
  tail: 0,
  burn: 0,
};

const P = (o: Partial<ImpPose>): ImpPose => ({ ...READY, ...o });

const ATTACK: Key<ImpPose>[] = [
  { at: 0, pose: READY },
  { at: 0.33, ease: 'out', pose: P({
    root: vec(CENTER_X - 5, 56.5), lean: -0.18, head: -0.42,
    handN: vec(CENTER_X - 5, 41), handF: vec(CENTER_X + 3, 49),
    footN: vec(CENTER_X + 2, 69), footF: vec(CENTER_X - 2.5, 70),
    wing: 1, tail: 1.2, fx: 0.55, flow: 0.1,
  }) },
  { at: 0.67, ease: 'in', pose: P({
    root: vec(CENTER_X + 0.5, 57.5), lean: 0.55, head: -0.05,
    handN: vec(CENTER_X + 12, 43), handF: vec(CENTER_X + 6, 58),
    footN: vec(CENTER_X - 3, 71), footF: vec(CENTER_X - 7, 70),
    wing: 0.2, tail: 2.4, fx: 0.85, flow: 0.4,
  }) },
  { at: 1, ease: 'linear', pose: P({
    root: vec(CENTER_X + 3, 61), lean: 0.62, head: -0.02,
    handN: vec(CENTER_X + 20, 64), handF: vec(CENTER_X + 6, 60),
    footN: vec(CENTER_X - 5, 70), footF: vec(CENTER_X - 9, 68.5),
    wing: -1, tail: 3.4, fx: 1, flow: 0.7, stretch: -0.03,
  }) },
];

const RECOIL = P({
  root: vec(CENTER_X - 5.5, 57), lean: -0.38, head: -0.45,
  handN: vec(CENTER_X + 1, 51), handF: vec(CENTER_X - 2, 50),
  footN: vec(CENTER_X + 3, 70), footF: vec(CENTER_X - 1, 71),
  wing: 0.85, tail: 2, flow: 0.6, stretch: -0.04,
});

const HURT: Key<ImpPose>[] = [
  { at: 0, pose: RECOIL },
  { at: 1, pose: P({ ...RECOIL, root: vec(CENTER_X - 3.5, 58.5), lean: -0.12, head: -0.3, wing: -0.2, handN: vec(CENTER_X + 4, 55), flow: 0.3 }) },
];

const lie = (x: number, y: number, spin: number, burn: number, wing: number): ImpPose => P({
  root: vec(x, y), spin, lean: 0, head: 0.3,
  footN: vec(x + 1, y + 11.5), footF: vec(x - 2.5, y + 11),
  handN: vec(x + 9, y - 10), handF: vec(x + 7, y - 12),
  wing, burn, flow: 0.05,
});

const DEATH: Key<ImpPose>[] = [
  { at: 0, pose: RECOIL },
  { at: 0.33, pose: P({ ...RECOIL, root: vec(CENTER_X - 3, 69), spin: 0.5, lean: 0.2, wing: 1, head: -0.1, handN: vec(CENTER_X + 6, 70), handF: vec(CENTER_X + 3, 71), burn: 0.08, flow: 0.8 }) },
  { at: 0.67, ease: 'in', pose: lie(CENTER_X - 4, 82.5, 1.2, 0.22, 0.6) },
  { at: 1, ease: 'out', pose: lie(CENTER_X - 5, 86, 1.5, 0.4, 0.2) },
];

/** Airborne poses are authored high; drop them toward the ground a touch. */
function lower(p: ImpPose, dy: number): ImpPose {
  const d = (v: V): V => vec(v.x, v.y + dy);
  return { ...p, root: d(p.root), footN: d(p.footN), footF: d(p.footF), handN: d(p.handN), handF: d(p.handF) };
}

function impPose(act: MonsterAction, t: number): ImpPose {
  return act === 'death' ? rawPose(act, t) : lower(rawPose(act, t), 5);
}

function rawPose(act: MonsterAction, t: number): ImpPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle': {
      const b = Math.sin(ph);
      return P({
        root: vec(READY.root.x, READY.root.y - b * 1.4),
        wing: Math.cos(ph),
        head: READY.head + Math.sin(ph - 0.8) * 0.06,
        footN: vec(READY.footN.x - 0.5 + b * 0.6, READY.footN.y - b * 0.9),
        footF: vec(READY.footF.x - 0.5 + b * 0.5, READY.footF.y - b * 0.7),
        handN: vec(READY.handN.x, READY.handN.y - b * 1.1),
        handF: vec(READY.handF.x, READY.handF.y - Math.sin(ph - 0.5) * 1),
        flow: 0.15 + b * 0.1,
      });
    }
    case 'walk': {
      const b = Math.sin(ph);
      return P({
        root: vec(READY.root.x + 1, READY.root.y - 1 - b * 1.6),
        lean: 0.55 + Math.cos(ph) * 0.05,
        head: -0.45,
        wing: Math.cos(ph) * 1.1,
        footN: vec(CENTER_X - 4 + b * 0.8, 72 - b * 1.2),
        footF: vec(CENTER_X - 8 + b * 0.6, 71 - b),
        handN: vec(CENTER_X + 7, 59 - b),
        handF: vec(CENTER_X + 2, 59 - Math.sin(ph - 0.6)),
        flow: 0.65 + b * 0.1,
        tail: ph,
      });
    }
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

function clawTip(p: ImpPose): { tip: V; base: V } {
  const sk = solveSkeleton(p, PROP);
  const ang = Math.atan2(sk.handN.y - sk.elN.y, sk.handN.x - sk.elN.x);
  return { tip: spun(p, localPt(sk.handN, ang, 4.5, 0.4), sk), base: spun(p, localPt(sk.handN, ang, -2.5, 0), sk) };
}

export const ImpDrawer = rigMonster<ImpPose>({
  key: 'monster_imp',
  // Wide for the wings and the diving slash; width doesn't move the sprite.
  frameW: 64,
  frameH: 48,
  scale: 1.36,
  views: MONSTER_VIEWS,
  pose: impPose,
  draw: (ctx, p, _act, t, view) => {
    const sk = view ? drawHumanoidView(ctx, p, IMP_VIEW, t, view) : drawHumanoid(ctx, p, IMP_SKIN, t);
    if (p.burn > 0) {
      const c = sk.pelvis;
      erode(ctx, p.burn, { x: c.x - 26, y: c.y - 24, w: 50, h: 34 }, 17, 1.7);
    }
  },
  shadow: (p, _act, _t, view) => ({ x: groundX(view, p.root.x + 1), r: 11, lift: Math.max(0, GROUND_Y - 4 - Math.max(p.footN.y, p.footF.y)) }),
  fx: (ctx, p, act, t, view) => {
    if (view) {
      impFxView(ctx, p, act, t, view);
      return;
    }
    const sk = solveSkeleton(p, PROP);
    // Hellfire talons + slash smear
    if (act === 'attack' && p.fx > 0.3) {
      if (t > 0.5) {
        const tips: V[] = [];
        const bases: V[] = [];
        for (let i = 6; i >= 0; i--) {
          const sp = lower(samplePoseTrack(ATTACK, Math.max(0, t - i * 0.055)), 5);
          const c = clawTip(sp);
          tips.push(c.tip);
          bases.push(c.base);
        }
        smear(ctx, tips, bases, HELLFIRE, 0.6 * p.fx);
      }
      const hand = spun(p, sk.handN, sk);
      glow(ctx, hand, 5 + p.fx * 4, HELLFIRE, 0.45 * p.fx);
      glow(ctx, hand, 2.2, 0xffe08a, 0.7 * p.fx);
      for (let i = 0; i < 4; i++) {
        const k = (i / 4 + t * 2) % 1;
        glow(ctx, vec(hand.x + Math.sin(i * 2.4) * 2.5, hand.y - k * 7), 1.2, 0xffa040, (1 - k) * p.fx);
      }
    }
    // Ember eyes
    if (act !== 'death' || t < 0.5) {
      const eye = spun(p, localPt(sk.head, sk.headAng, 4.4, -0.9), sk);
      glow(ctx, eye, 3.2, EYE, 0.55 + p.fx * 0.25);
    }
    if (p.burn > 0) {
      const c = spun(p, sk.pelvis, sk);
      embers(ctx, { x: c.x - 14, y: c.y - 12, w: 26, h: 14 }, 14, t, Math.min(1, p.burn * 1.6), HELLFIRE, 5);
    }
  },
  rim: 'rgba(255,170,120,0.5)',
});

function impFxView(ctx: CanvasRenderingContext2D, p: ImpPose, act: MonsterAction, t: number, view: HumanView): void {
  const vsk = solveViewSkeleton(p, PROP, IMP_VIEW.build, view);
  if (act === 'attack' && p.fx > 0.3) {
    if (t > 0.5) {
      // Slash smear: the side art on the body plane
      sagittalSpun(ctx, vsk, p, () => {
        const tips: V[] = [];
        const bases: V[] = [];
        for (let i = 6; i >= 0; i--) {
          const q = lower(samplePoseTrack(ATTACK, Math.max(0, t - i * 0.055)), 5);
          const c = clawTip(q);
          tips.push(c.tip);
          bases.push(c.base);
        }
        smear(ctx, tips, bases, HELLFIRE, 0.6 * p.fx);
      });
    }
    const hand = vsk.handN;
    glow(ctx, hand, 5 + p.fx * 4, HELLFIRE, 0.45 * p.fx);
    glow(ctx, hand, 2.2, 0xffe08a, 0.7 * p.fx);
    for (let i = 0; i < 4; i++) {
      const k = (i / 4 + t * 2) % 1;
      glow(ctx, vec(hand.x + Math.sin(i * 2.4) * 2.5, hand.y - k * 7), 1.2, 0xffa040, (1 - k) * p.fx);
    }
  }
  if (act !== 'death' || t < 0.5) {
    for (const e of impViewEyes(vsk)) glow(ctx, e, 2.6, EYE, 0.5 + p.fx * 0.25);
  }
  if (p.burn > 0) {
    const c = vsk.pelvis;
    embers(ctx, { x: c.x - 14, y: c.y - 12, w: 26, h: 14 }, 14, t, Math.min(1, p.burn * 1.6), HELLFIRE, 5);
  }
}
