// src/graphics/sprites/monsters/SandWraith.ts
//
// 沙漠亡灵 (mini-boss) — a floating desert lich-djinn wrapped in
// sun-bleached burial linen. Deep hood with a golden cobra crown over a
// void face and two ember eyes, a broad gold-and-turquoise collar with a
// glowing scarab, gold arm cuffs, withered claws and a great bronze
// crescent scythe. Below the waist the tattered robe unravels into a
// whirling column of sand. Hovers with streaming linen strips, hoists the
// scythe overhead and reaps down in a sandstorm arc; on death it
// crumbles into a sand heap, leaving only the scythe and its gold behind.
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
  solveIK,
  tone,
  vec,
  type Key,
  type Tone,
  type V,
} from '../rig/Rig';
import { rigMonster } from '../rig/MonsterKit';

interface WraithPose {
  /** Waist position, torso lean (+ forward) and extra head tilt. */
  root: V;
  lean: number;
  head: number;
  /** Near (upper) grip on the scythe; the far hand grips further down. */
  hand: V;
  /** Scythe pole angle (dirUp: 0 = up, + = forward). */
  wpn: number;
  /** Off-hand: 0 on the pole … 1 free (flung out). */
  free: number;
  /** Linen streaming back 0..1. */
  flow: number;
  /** Death: 0 whole … 1 crumbled to sand. */
  fade: number;
  fx: number;
}

// ── Palette ─────────────────────────────────────────────────────────────

const LINEN = tone(0xdccba2, { light: 0.4, shadow: 0.42 });
const LINEN_DK = tone(0xae9870, { light: 0.25, shadow: 0.45 });
const LINEN_FAR = tone(0x8e7a58, { light: 0.2, shadow: 0.45 });
const GOLD = tone(0xe8b440, { light: 0.55, shadow: 0.38 });
const TURQ = tone(0x2fb8a6, { light: 0.45 });
const LAPIS = '#2a4aa8';
const CLAW = tone(0x5a4030, { light: 0.3 });
const WOOD = tone(0x5e3c24, { light: 0.3 });
const BRONZE = tone(0xcf9a3c, { light: 0.55, shadow: 0.4 });
const SAND = tone(0xdcb878, { light: 0.4, shadow: 0.35 });
const SAND_DK = tone(0xb08a52, { light: 0.25, shadow: 0.4 });
const VOID = '#160a14';

const ROOT = vec(CENTER_X - 4, 60);
const REST: WraithPose = {
  root: ROOT, lean: 0.06, head: 0.04,
  hand: vec(55, 46), wpn: 0.3, free: 0, flow: 0.3, fade: 0, fx: 0,
};
const P = (o: Partial<WraithPose>): WraithPose => ({ ...REST, ...o });

const ATTACK: Key<WraithPose>[] = [
  { at: 0, pose: REST },
  { at: 0.33, ease: 'out', pose: P({ root: vec(ROOT.x - 3, ROOT.y - 2), lean: -0.2, head: -0.1, hand: vec(41, 37), wpn: -1.3, flow: 0.15, fx: 0.3 }) },
  { at: 0.67, ease: 'in', pose: P({ root: vec(ROOT.x, ROOT.y - 1), lean: 0.08, head: 0.05, hand: vec(53, 35), wpn: 0.8, flow: 0.5, fx: 0.7 }) },
  { at: 1, ease: 'linear', pose: P({ root: vec(ROOT.x + 3.5, ROOT.y + 1), lean: 0.36, head: 0.12, hand: vec(64, 50), wpn: 2.05, flow: 0.9, fx: 1 }) },
];

const HURT: Key<WraithPose>[] = [
  { at: 0, pose: P({ root: vec(ROOT.x - 3.5, ROOT.y - 1), lean: -0.3, head: -0.3, hand: vec(51, 44), wpn: -0.1, free: 0.4, flow: 0.8 }) },
  { at: 1, pose: P({ root: vec(ROOT.x - 1.5, ROOT.y), lean: -0.1, head: -0.1, hand: vec(53, 45), wpn: 0.15, free: 0.15, flow: 0.5 }) },
];

const DEATH: Key<WraithPose>[] = [
  { at: 0, pose: P({ root: vec(ROOT.x - 3.5, ROOT.y - 1), lean: -0.3, head: -0.3, hand: vec(51, 44), wpn: -0.1, free: 0.4, flow: 0.8 }) },
  { at: 0.33, pose: P({ root: vec(ROOT.x - 2, ROOT.y - 3), lean: -0.34, head: -0.45, hand: vec(58, 38), wpn: 0.9, free: 1, flow: 0.2, fade: 0.12 }) },
  { at: 0.67, ease: 'in', pose: P({ root: vec(ROOT.x, ROOT.y + 10), lean: 0.2, head: 0.3, hand: vec(60, 70), wpn: 1.7, free: 1, flow: 0, fade: 0.6 }) },
  { at: 1, ease: 'out', pose: P({ root: vec(ROOT.x + 1, ROOT.y + 24), lean: 0.4, head: 0.4, hand: vec(64, 88), wpn: 1.57, free: 1, flow: 0, fade: 1 }) },
];

function wraithPose(act: MonsterAction, t: number): WraithPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle':
      return P({
        root: vec(ROOT.x, ROOT.y + Math.sin(ph) * 1.8),
        lean: REST.lean + Math.sin(ph - 0.6) * 0.03,
        head: REST.head + Math.sin(ph - 1.2) * 0.05,
        hand: vec(REST.hand.x, REST.hand.y + Math.sin(ph - 0.4) * 1.6),
        wpn: REST.wpn + Math.sin(ph - 0.8) * 0.05,
        flow: 0.3 + Math.sin(ph) * 0.1,
      });
    case 'walk':
      return P({
        root: vec(ROOT.x + 1, ROOT.y - 1 + Math.sin(ph * 2) * 1.4),
        lean: 0.2,
        head: 0.05,
        hand: vec(REST.hand.x + 1.5, REST.hand.y + 1 + Math.sin(ph * 2 - 0.5) * 1.2),
        wpn: 0.55 + Math.sin(ph) * 0.06,
        flow: 0.85 + Math.sin(ph * 2) * 0.1,
      });
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

// ── Skeleton ────────────────────────────────────────────────────────────

interface Sk {
  waist: V;
  neck: V;
  head: V;
  headAng: number;
  shN: V; elN: V; handN: V;
  shF: V; elF: V; handF: V;
  butt: V;
  top: V;
}

function local(o: V, a: number, x: number, y: number): V {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return vec(o.x + x * c - y * s, o.y + x * s + y * c);
}

function skeleton(p: WraithPose): Sk {
  const waist = p.root;
  const neck = along(waist, p.lean, 20);
  const headAng = p.lean + p.head;
  const head = along(neck, headAng, 6.5);
  const shN = local(neck, p.lean, 4.5, 2.2);
  const shF = local(neck, p.lean, -4.5, 1.2);
  const armN = solveIK(shN, p.hand, 9.5, 9.5, -1);
  const grip = along(armN.end, p.wpn, -8.5);
  const flung = local(shF, p.lean, -12, 6);
  const armF = solveIK(shF, lerpV(grip, flung, p.free), 9, 9, -1);
  return {
    waist, neck, head, headAng,
    shN, elN: armN.mid, handN: armN.end,
    shF, elF: armF.mid, handF: armF.end,
    butt: along(armN.end, p.wpn, -14),
    top: along(armN.end, p.wpn, 18),
  };
}

/** Scythe pole ends; slides off to lie on the sand as the wraith crumbles. */
function scythe(p: WraithPose, sk: Sk): { butt: V; top: V } {
  const d = Math.max(0, (p.fade - 0.45) / 0.55);
  if (d <= 0) return { butt: sk.butt, top: sk.top };
  const e = d * d * (3 - 2 * d);
  const restB = vec(p.root.x - 14, GROUND_Y - 2);
  const restT = vec(p.root.x + 24, GROUND_Y - 3.2);
  return { butt: lerpV(sk.butt, restB, e), top: lerpV(sk.top, restT, e) };
}

// ── Pieces ──────────────────────────────────────────────────────────────

function ribbon(ctx: CanvasRenderingContext2D, pts: V[], w0: number, w1: number, t: Tone): void {
  const left: V[] = [];
  const right: V[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.max(0.01, Math.hypot(b.x - a.x, b.y - a.y));
    const nx = -(b.y - a.y) / l;
    const ny = (b.x - a.x) / l;
    const w = w0 + (w1 - w0) * (i / (pts.length - 1));
    // Ragged, notched end
    const notch = i === pts.length - 1 ? 0.4 : 1;
    left.push(vec(pts[i].x + nx * w, pts[i].y + ny * w));
    right.push(vec(pts[i].x - nx * w * notch, pts[i].y - ny * w * notch));
  }
  cel(ctx, () => polyPath(ctx, [...left, ...right.reverse()]), t, { band: 0.6, stroke: 0.45 });
}

function strip(ctx: CanvasRenderingContext2D, anchor: V, len: number, flow: number, ph: number, seed: number, t: Tone, w = 1.4): void {
  const pts = clothChain(anchor, len, 6, flow, 1, ph + seed);
  ribbon(ctx, pts, w, w * 0.7, t);
}

function columnGeo(p: WraithPose, sk: Sk, t: number): { hem: V; tip: V } {
  const ph = t * Math.PI * 2;
  const hem = local(sk.waist, p.lean * 0.5, -0.5, 13);
  const tip = vec(hem.x - 5 - p.flow * 7 + Math.sin(ph) * 1.8, Math.min(GROUND_Y - 4, hem.y + 22));
  return { hem, tip };
}

function drawSandColumn(ctx: CanvasRenderingContext2D, p: WraithPose, sk: Sk, t: number): void {
  const ph = t * Math.PI * 2;
  const { hem, tip } = columnGeo(p, sk, t);
  const mid = lerpV(hem, tip, 0.5);
  const col = [
    vec(hem.x - 8.5, hem.y - 3), vec(hem.x + 8, hem.y - 3), vec(hem.x + 6.5, hem.y + 4),
    vec(mid.x + 3.6 + Math.sin(ph * 2) * 0.8, mid.y), vec(tip.x + 1.6, tip.y - 3), vec(tip.x, tip.y + 1.5),
    vec(tip.x - 1.8, tip.y - 3), vec(mid.x - 4.6, mid.y - 1), vec(hem.x - 8, hem.y + 4),
  ];
  cel(ctx, () => blobPath(ctx, col), SAND_DK, { band: 1.4 });
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, col);
  ctx.clip();
  // Twisting streaks of lighter sand spiralling down
  for (let i = 0; i < 5; i++) {
    const k = (i / 5 + t) % 1;
    const c = lerpV(hem, tip, k);
    const w = 8.5 * (1 - k) + 1.5;
    ctx.strokeStyle = `rgba(246,226,172,${0.8 - k * 0.3})`;
    ctx.lineWidth = 1.2 - k * 0.5;
    ctx.beginPath();
    ctx.moveTo(c.x - w, c.y - 2.5);
    ctx.quadraticCurveTo(c.x - w * 0.1, c.y + 1.5, c.x + w, c.y + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRobe(ctx: CanvasRenderingContext2D, p: WraithPose, sk: Sk, t: number): void {
  const ph = t * Math.PI * 2;
  const W = (x: number, y: number): V => local(sk.waist, p.lean * 0.5, x, y);
  const hemPts: V[] = [];
  for (let i = 0; i <= 7; i++) {
    const k = i / 7;
    const x = 9 - k * 19 - p.flow * 4 * k;
    const y = 12 + (i % 2 ? 4.5 : 0) + Math.sin(ph * 2 + i * 1.3) * 1.2 + k * p.flow * -2;
    hemPts.push(W(x, y));
  }
  const robe = [W(-7.5, -3), W(6.5, -3.5), W(9, 5), ...hemPts, W(-10.5 - p.flow * 3, 5)];
  cel(ctx, () => polyPath(ctx, robe), LINEN_DK, { band: 1.4 });
  // Folds
  ctx.strokeStyle = 'rgba(90,70,44,0.5)';
  ctx.lineWidth = 0.55;
  for (const x of [-4, 0.5, 4.5]) {
    const a = W(x, 0);
    const b = W(x - 1.5 - p.flow * 2, 13);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2 + 1, (a.y + b.y) / 2, b.x, b.y);
    ctx.stroke();
  }
  // Gold sash with turquoise inlay
  const s0 = W(-7.6, -3.8);
  const s1 = W(7, -4.4);
  cel(ctx, () => polyPath(ctx, [s0, s1, W(7.4, -1.2), W(-7.8, -0.6)]), GOLD, { band: 0.6, stroke: 0.4 });
  cel(ctx, () => polyPath(ctx, [W(1.8, -2.4), W(4.6, -2.8), W(3.4, 5.5), W(2.2, 5.6)]), GOLD, { band: 0.5, stroke: 0.35 });
  ctx.fillStyle = TURQ.base;
  for (const x of [-4, 0, 4.2]) {
    const c = W(x, -2.4);
    ctx.fillRect(c.x - 0.6, c.y - 0.6, 1.2, 1.2);
  }
}

function drawTorso(ctx: CanvasRenderingContext2D, p: WraithPose, sk: Sk): void {
  const T = (x: number, y: number): V => local(sk.waist, p.lean, x, y);
  const chest = [T(-6.5, -19.5), T(0, -21.5), T(6.8, -19), T(7.2, -11), T(5.8, -3), T(-6, -2.5), T(-7.6, -10)];
  cel(ctx, () => blobPath(ctx, chest), LINEN, { band: 1.6 });
  // Diagonal burial wraps
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, chest);
  ctx.clip();
  for (let i = 0; i < 7; i++) {
    const y = -20 + i * 3;
    const a = T(-9, y + 2.2);
    const b = T(9, y - 1.2);
    ctx.strokeStyle = 'rgba(120,96,60,0.55)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,226,0.4)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + 0.7);
    ctx.lineTo(b.x, b.y + 0.7);
    ctx.stroke();
  }
  // Ribs of shadow showing through a torn wrap
  ctx.fillStyle = 'rgba(40,20,30,0.55)';
  ctx.beginPath();
  blobPath(ctx, [T(-3.5, -9), T(0.5, -10), T(2, -6.5), T(-2.5, -5.5)]);
  ctx.fill();
  ctx.restore();
}

function drawCollar(ctx: CanvasRenderingContext2D, p: WraithPose, sk: Sk, t: number): void {
  const c = local(sk.neck, p.lean, 1, 0.5);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(p.lean);
  ctx.scale(1, 0.82);
  const a0 = 0.05;
  const a1 = Math.PI - 0.05;
  // Broad usekh bib (gold base)
  cel(ctx, () => {
    ctx.arc(0, 0, 8.6, a0, a1, false);
    ctx.arc(0, 0, 3.2, a1, a0, true);
    ctx.closePath();
  }, GOLD, { band: 1, stroke: 0.5 });
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = TURQ.base;
  ctx.beginPath();
  ctx.arc(0, 0, 4.7, a0 + 0.1, a1 - 0.1);
  ctx.stroke();
  ctx.strokeStyle = LAPIS;
  ctx.beginPath();
  ctx.arc(0, 0, 6.4, a0 + 0.08, a1 - 0.08);
  ctx.stroke();
  // Teardrop beads along the rim
  ctx.fillStyle = TURQ.light;
  for (let i = 0; i < 9; i++) {
    const a = a0 + 0.15 + (i / 8) * (a1 - a0 - 0.3);
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 8, Math.sin(a) * 8, 0.55, 0.85, a - Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Scarab amulet
  const s = local(sk.neck, p.lean, 1.5, 7.8);
  const pulse = 0.75 + Math.sin(t * Math.PI * 4) * 0.25;
  cel(ctx, () => ellipsePath(ctx, s, 2, 2.4, p.lean), TURQ, { band: 0.5, stroke: 0.45 });
  ctx.fillStyle = `rgba(210,255,240,${0.7 * pulse})`;
  ctx.beginPath();
  ctx.ellipse(s.x - 0.5, s.y - 0.8, 0.8, 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,50,50,0.7)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - 2.3);
  ctx.lineTo(s.x, s.y + 2.3);
  ctx.stroke();
}

function drawHead(ctx: CanvasRenderingContext2D, p: WraithPose, sk: Sk, t: number): void {
  const ph = t * Math.PI * 2;
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Hood with a peaked, drooping crown
  const hood = [vec(-7.5, 6), vec(-9, -0.5), vec(-6.8, -7), vec(-1, -10), vec(5, -8.4), vec(8.6, -3), vec(8.4, 3.2), vec(5.6, 7.6), vec(-1, 8.6)];
  cel(ctx, () => blobPath(ctx, hood), LINEN, { band: 1.7 });
  ctx.strokeStyle = 'rgba(110,86,54,0.55)';
  ctx.lineWidth = 0.55;
  for (const [x0, y0, x1, y1] of [[-6, -5, -3.5, 6], [-3, -8, 0, 4], [2, -8.8, 3.6, -5]] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 - 1.5, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
  }
  // Void face
  const face = [vec(1.2, -4.6), vec(5.2, -5), vec(8, -1), vec(7.4, 4.2), vec(4, 6.4), vec(1, 3.4)];
  ctx.fillStyle = VOID;
  ctx.beginPath();
  blobPath(ctx, face);
  ctx.fill();
  ctx.strokeStyle = LINEN.shade;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // Hood rim highlight
  ctx.strokeStyle = 'rgba(255,248,226,0.6)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(1, -5.6);
  ctx.quadraticCurveTo(6.4, -6.4, 8.8, -1.6);
  ctx.stroke();
  // Ember eyes (skip once crumbling)
  if (p.fade < 0.55) {
    const e = 1 - p.fade * 1.6;
    for (const [x, r] of [[5.8, 1.1], [2.9, 0.85]] as const) {
      ctx.fillStyle = `rgba(255,150,40,${0.9 * e})`;
      ctx.beginPath();
      ctx.ellipse(x, -0.6, r * 1.3, r * 0.75, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,246,200,${e})`;
      ctx.beginPath();
      ctx.ellipse(x + 0.15, -0.65, r * 0.6, r * 0.38, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    // Faint glowing mouth slit
    ctx.strokeStyle = `rgba(255,140,40,${0.45 * e})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(3.4, 3);
    ctx.quadraticCurveTo(5, 3.6 + Math.sin(ph) * 0.3, 6.6, 2.8);
    ctx.stroke();
  }
  // Golden uraeus (rearing cobra) crown
  cel(ctx, () => polyPath(ctx, [vec(-1.5, -7.4), vec(6.2, -6.6), vec(6.6, -5.2), vec(-1.2, -5.8)]), GOLD, { band: 0.5, stroke: 0.4 });
  cel(ctx, () => blobPath(ctx, [vec(4.2, -6.6), vec(4.6, -10.4), vec(6, -12.2), vec(7.6, -11.2), vec(7, -9.4), vec(6.2, -6.4)]), GOLD, { band: 0.6, stroke: 0.4 });
  cel(ctx, () => blobPath(ctx, [vec(4.6, -11), vec(6.2, -13.6), vec(8.6, -12.6), vec(8.4, -10.6), vec(6.6, -9.6)]), GOLD, { band: 0.5, stroke: 0.4 });
  ctx.fillStyle = '#c8281c';
  ctx.beginPath();
  ctx.arc(6.8, -11.6, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TURQ.base;
  ctx.fillRect(1.4, -7, 1.2, 1.1);
  ctx.restore();
}

function drawArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const t = far ? LINEN_FAR : LINEN;
  limb(ctx, sh, el, far ? 2.3 : 2.6, far ? 1.9 : 2.1, t);
  limb(ctx, el, hand, far ? 1.9 : 2.1, far ? 1.5 : 1.6, t);
  // Wrap lines
  if (!far) {
    inBone(ctx, el, hand, (len) => {
      ctx.strokeStyle = 'rgba(110,86,54,0.55)';
      ctx.lineWidth = 0.45;
      for (let y = 1.5; y < len - 1; y += 2) {
        ctx.beginPath();
        ctx.moveTo(-2, y);
        ctx.lineTo(2, y + 1);
        ctx.stroke();
      }
    });
  }
  // Gold cuffs
  inBone(ctx, sh, el, (len) => {
    cel(ctx, () => polyPath(ctx, [vec(-2.7, len * 0.45), vec(2.7, len * 0.45), vec(2.5, len * 0.45 + 2), vec(-2.5, len * 0.45 + 2)]), far ? tone(0xa07a2a) : GOLD, { band: 0.4, stroke: 0.4 });
  });
  inBone(ctx, el, hand, (len) => {
    cel(ctx, () => polyPath(ctx, [vec(-2.2, len - 3.2), vec(2.2, len - 3.2), vec(2, len - 1.4), vec(-2, len - 1.4)]), far ? tone(0xa07a2a) : GOLD, { band: 0.4, stroke: 0.4 });
  });
}

function drawClaw(ctx: CanvasRenderingContext2D, hand: V, ang: number, far: boolean): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(ang);
  const t = far ? tone(0x3e2c22) : CLAW;
  cel(ctx, () => ellipsePath(ctx, vec(0.6, 0), 2.2, 1.9), t, { band: 0.5 });
  for (const [a, l] of [[-0.5, 3.2], [0.1, 3.6], [0.7, 3]] as const) {
    cel(ctx, () => capsulePath(ctx, vec(1.6, 0), vec(1.6 + Math.cos(a) * l, Math.sin(a) * l + 0.8), 0.65, 0.25), t, { band: 0.3, stroke: 0.35 });
  }
  ctx.restore();
}

function drawScythe(ctx: CanvasRenderingContext2D, butt: V, top: V): void {
  cel(ctx, () => capsulePath(ctx, butt, top, 1.15, 1.05), WOOD, { band: 0.6 });
  inBone(ctx, butt, top, (len) => {
    // Gold bands and a spiked pommel
    for (const y of [2, len * 0.55, len - 3]) {
      cel(ctx, () => polyPath(ctx, [vec(-1.6, y), vec(1.6, y), vec(1.6, y + 1.6), vec(-1.6, y + 1.6)]), GOLD, { band: 0.3, stroke: 0.35 });
    }
    cel(ctx, () => polyPath(ctx, [vec(-1.5, 0.5), vec(0, -3.2), vec(1.5, 0.5)]), GOLD, { band: 0.3, stroke: 0.35 });
    // Crescent blade: sweeps forward (−x in bone space) and hooks down
    const L = len;
    const blade = (): void => {
      ctx.moveTo(1.4, L + 1.4);
      ctx.quadraticCurveTo(-10, L + 8.5, -23, L - 7);
      ctx.quadraticCurveTo(-12, L + 0.6, -1.2, L - 3);
      ctx.closePath();
    };
    cel(ctx, blade, BRONZE, { band: 1, stroke: 0.5 });
    // Honed edge + engraved eye
    ctx.strokeStyle = 'rgba(255,250,224,0.95)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-22.2, L - 6.8);
    ctx.quadraticCurveTo(-12, L + 0.1, -2.2, L - 2.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,50,14,0.8)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.ellipse(-5.5, L + 0.6, 1.4, 0.7, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = TURQ.base;
    ctx.beginPath();
    ctx.arc(-5.5, L + 0.6, 0.45, 0, Math.PI * 2);
    ctx.fill();
    // Socket collar
    cel(ctx, () => polyPath(ctx, [vec(-2, L - 4), vec(2, L - 4), vec(2.2, L + 1), vec(-2.2, L + 1)]), GOLD, { band: 0.4, stroke: 0.4 });
  });
}

function bladeTip(butt: V, top: V): V {
  // The crescent tip (−23, L − 7) in bone space.
  const len = Math.max(0.01, Math.hypot(top.x - butt.x, top.y - butt.y));
  const ux = (top.x - butt.x) / len;
  const uy = (top.y - butt.y) / len;
  // Bone-space +x is the bone's right: (−uy, ux) rotated … derived from inBone's rotation.
  const rx = -uy;
  const ry = ux;
  return vec(butt.x + ux * (len - 7) + rx * -23, butt.y + uy * (len - 7) + ry * -23);
}

function drawSandHeap(ctx: CanvasRenderingContext2D, p: WraithPose): void {
  const a = Math.max(0, (p.fade - 0.25) / 0.75);
  if (a <= 0) return;
  const cx = ROOT.x + 1;
  const w = 8 + 12 * a;
  const h = 2 + 7 * a;
  cel(ctx, () => blobPath(ctx, [vec(cx - w, GROUND_Y + 0.6), vec(cx - w * 0.5, GROUND_Y - h * 0.75), vec(cx, GROUND_Y - h), vec(cx + w * 0.55, GROUND_Y - h * 0.7), vec(cx + w, GROUND_Y + 0.6), vec(cx, GROUND_Y + 1.8)]), SAND, { band: 1.4 });
  ctx.strokeStyle = 'rgba(160,120,64,0.55)';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.6, GROUND_Y - h * 0.3);
  ctx.quadraticCurveTo(cx, GROUND_Y - h * 0.6, cx + w * 0.5, GROUND_Y - h * 0.25);
  ctx.stroke();
}

function drawRelics(ctx: CanvasRenderingContext2D, p: WraithPose): void {
  const a = Math.max(0, (p.fade - 0.8) / 0.2);
  if (a <= 0) return;
  // The empty hood and golden collar resting on the heap
  const c = vec(ROOT.x + 2, GROUND_Y - 8.5);
  cel(ctx, () => blobPath(ctx, [vec(c.x - 6, c.y + 3), vec(c.x - 4.5, c.y - 3), vec(c.x + 1, c.y - 4.6), vec(c.x + 5.4, c.y - 1.4), vec(c.x + 5, c.y + 3)]), LINEN_DK, { band: 0.8 });
  ctx.fillStyle = VOID;
  ctx.beginPath();
  ctx.ellipse(c.x + 2.4, c.y + 0.4, 2.2, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  cel(ctx, () => {
    ctx.ellipse(c.x - 1, c.y + 3.6, 6.5, 1.8, 0, 0, Math.PI * 2);
  }, GOLD, { band: 0.5, stroke: 0.45 });
  ctx.fillStyle = TURQ.base;
  ctx.fillRect(c.x - 5, c.y + 3.2, 8, 0.8);
}

function crumbleLine(fade: number): number {
  return fade <= 0 ? -100 : -12 + fade * 104;
}

/** Clip away everything above a ragged, crumbling edge. */
function crumbleClip(ctx: CanvasRenderingContext2D, line: number, t: number): void {
  ctx.beginPath();
  ctx.moveTo(-100, 300);
  ctx.lineTo(-100, line);
  for (let x = 0; x <= 100; x += 3) {
    ctx.lineTo(x, line + ((x / 3) % 2 ? 2.4 : -0.6) + Math.sin(x * 0.7 + t * 9) * 0.8);
  }
  ctx.lineTo(200, line);
  ctx.lineTo(200, 300);
  ctx.closePath();
  ctx.clip();
}

function drawWraith(ctx: CanvasRenderingContext2D, p: WraithPose, t: number): void {
  const ph = t * Math.PI * 2;
  const sk = skeleton(p);
  const sc = scythe(p, sk);
  const fade = p.fade;
  drawSandHeap(ctx, p);

  ctx.save();
  if (fade > 0) {
    // Crumble from the crown down
    crumbleClip(ctx, crumbleLine(fade), t);
  }
  // Streaming linen behind: hood tails + far shoulder
  const back = local(sk.head, sk.headAng, -6, 2);
  strip(ctx, back, 20, p.flow + 0.3, ph, 0, LINEN_FAR, 1.8);
  strip(ctx, local(sk.head, sk.headAng, -4, 5), 15, p.flow + 0.2, ph, 1.7, LINEN_DK, 1.5);
  drawSandColumn(ctx, p, sk, t);
  drawArm(ctx, sk.shF, sk.elF, sk.handF, true);
  drawClaw(ctx, sk.handF, Math.atan2(sk.handF.y - sk.elF.y, sk.handF.x - sk.elF.x), true);
  drawRobe(ctx, p, sk, t);
  drawTorso(ctx, p, sk);
  drawCollar(ctx, p, sk, t);
  drawHead(ctx, p, sk, t);
  ctx.restore();

  drawScythe(ctx, sc.butt, sc.top);

  ctx.save();
  if (fade > 0) {
    crumbleClip(ctx, crumbleLine(fade), t);
  }
  drawArm(ctx, sk.shN, sk.elN, sk.handN, false);
  drawClaw(ctx, sk.handN, p.wpn - Math.PI / 2 + 0.3, false);
  strip(ctx, lerpV(sk.elN, sk.handN, 0.55), 11, p.flow + 0.15, ph, 3.1, LINEN, 1.1);
  ctx.restore();
  drawRelics(ctx, p);
}

function wraithFx(ctx: CanvasRenderingContext2D, p: WraithPose, act: MonsterAction, t: number): void {
  const ph = t * Math.PI * 2;
  const sk = skeleton(p);
  const alive = 1 - p.fade;
  // Eye + scarab glow
  if (p.fade < 0.55) {
    glow(ctx, local(sk.head, sk.headAng, 4.5, -0.6), 5, 0xffa030, 0.55 * alive);
    glow(ctx, local(sk.neck, p.lean, 1.5, 7.8), 4.5, 0x40ffe0, 0.35 * alive);
  }
  // Orbiting sand grains
  const n = act === 'death' ? 14 : 10;
  for (let i = 0; i < n; i++) {
    const k = (i / n + t * (act === 'idle' || act === 'walk' ? 1 : 0.5)) % 1;
    const a = k * Math.PI * 2 + i;
    const r = 13 + (i % 3) * 3;
    const x = sk.waist.x + Math.cos(a) * r - p.flow * 3;
    const y = sk.waist.y + 2 + Math.sin(a) * r * 0.35 - (i % 4) * 5 + (act === 'death' ? k * 10 : 0);
    const front = Math.sin(a) > 0;
    ctx.fillStyle = `rgba(240,214,160,${(front ? 0.9 : 0.45) * (0.4 + 0.6 * alive)})`;
    ctx.fillRect(x, y, front ? 1 : 0.7, front ? 1 : 0.7);
  }
  // Reaping sandstorm arc
  if (act === 'attack' && t > 0.5) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 0; i <= 6; i++) {
      const q = samplePoseTrack(ATTACK, t - 0.4 + (i / 6) * 0.4);
      const s = skeleton(q);
      tips.push(bladeTip(s.butt, s.top));
      bases.push(lerpV(s.handN, s.top, 0.6));
    }
    smear(ctx, tips, bases, 0xf0d090, 0.6 * p.fx);
    if (t > 0.9) {
      const tip = bladeTip(sk.butt, sk.top);
      glow(ctx, tip, 8, 0xffd080, 0.5);
      ctx.fillStyle = 'rgba(236,206,146,0.8)';
      for (let i = 0; i < 8; i++) {
        const a = -2.6 + i * 0.5;
        const r = 4 + (i % 3) * 2.5;
        ctx.beginPath();
        ctx.arc(tip.x + Math.cos(a) * r, Math.min(GROUND_Y - 1, tip.y + Math.sin(a) * r * 0.6), 0.9 + (i % 2) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Sand pouring out as it crumbles
  if (act === 'death' && p.fade > 0.05 && p.fade < 0.98) {
    const line = Math.max(crumbleLine(p.fade), sk.head.y - 8);
    for (let i = 0; i < 14; i++) {
      const k = (i / 14 + t * 1.5) % 1;
      const x = p.root.x - 9 + (i * 7) % 20 + Math.sin(ph + i) * 1.2;
      const y = Math.min(GROUND_Y - 1, line + k * (GROUND_Y - line));
      ctx.fillStyle = `rgba(226,196,136,${0.85 * (1 - k * 0.5)})`;
      ctx.fillRect(x, y, 1, 1.4);
    }
  }
}

export const SandWraithDrawer = rigMonster<WraithPose>({
  key: 'monster_sand_wraith',
  // Wider than the old sheet so the scythe swing fits; width doesn't move the sprite in-game.
  frameW: 76,
  frameH: 64,
  scale: 1.1,
  pose: wraithPose,
  draw: (ctx, p, _act, t) => drawWraith(ctx, p, t),
  shadow: (p) => ({ x: p.root.x - 2, r: 13 + p.fade * 6, lift: Math.max(0, 12 - p.fade * 12) }),
  fx: wraithFx,
  ink: '#241408',
  rim: 'rgba(255,240,200,0.65)',
});
