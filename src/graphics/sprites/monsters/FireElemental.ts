// src/graphics/sprites/monsters/FireElemental.ts
//
// 火元素 — a living bonfire in a roughly human shape. A V-shaped torso of
// flame hovers over a swirling fire vortex; charred basalt plates float on
// it (brow mask, pauldrons, chest guards, knuckle-rock fists) with magma
// glowing in their cracks, and a white-hot molten core burns in the chest.
// Flickers constantly, cocks a fist to charge a fireball and punches it
// out, gutters out on death so the rocks tumble into a smouldering heap.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  along,
  blobPath,
  capsulePath,
  polyPath,
  cel,
  glow,
  lerpV,
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

interface ElementalPose {
  /** Waist position and torso lean (+ forward). */
  root: V;
  lean: number;
  head: number;
  /** Fist targets. */
  handN: V;
  handF: V;
  /** Flame size multiplier. */
  flare: number;
  /** Fireball charge in the near fist 0..1. */
  charge: number;
  /** Tail streaming back 0..1. */
  flow: number;
  /** Death: 0 blazing … 1 burnt out (rocks fallen). */
  burn: number;
  fx: number;
}

const FLAME = tone(0xff7424, { light: 0.55, shadow: 0.25 });
const FLAME_DEEP = tone(0xd8361a, { light: 0.4, shadow: 0.3 });
const INNER = '#ffd65a';
const HOT = '#fff3c4';
const ROCK = tone(0x4a3432, { light: 0.4, shadow: 0.5 });
const ROCK_FAR = tone(0x33242a, { light: 0.25, shadow: 0.5 });
const CRACK = '#ffa336';

const ROOT = vec(CENTER_X - 3, 60);
const REST: ElementalPose = {
  root: ROOT, lean: 0.05, head: 0,
  handN: vec(58, 58), handF: vec(34, 57),
  flare: 1, charge: 0, flow: 0.2, burn: 0, fx: 0,
};
const P = (o: Partial<ElementalPose>): ElementalPose => ({ ...REST, ...o });

const ATTACK: Key<ElementalPose>[] = [
  { at: 0, pose: REST },
  { at: 0.33, ease: 'out', pose: P({ root: vec(ROOT.x - 2.5, ROOT.y - 1), lean: -0.18, head: 0.1, handN: vec(38, 44), handF: vec(56, 48), charge: 0.55, flare: 1.1, fx: 0.3 }) },
  { at: 0.67, ease: 'in', pose: P({ root: vec(ROOT.x + 0.5, ROOT.y), lean: 0.12, head: 0, handN: vec(55, 42), handF: vec(48, 52), charge: 0.85, flare: 1.15, flow: 0.5, fx: 0.7 }) },
  { at: 1, ease: 'linear', pose: P({ root: vec(ROOT.x + 3.5, ROOT.y + 0.5), lean: 0.3, head: -0.05, handN: vec(71, 43), handF: vec(34, 58), charge: 1, flare: 1.2, flow: 0.8, fx: 1 }) },
];

const HURT: Key<ElementalPose>[] = [
  { at: 0, pose: P({ root: vec(ROOT.x - 3, ROOT.y - 0.5), lean: -0.32, head: -0.3, handN: vec(52, 48), handF: vec(34, 49), flare: 0.7, flow: 0.6 }) },
  { at: 1, pose: P({ root: vec(ROOT.x - 1.5, ROOT.y), lean: -0.12, head: -0.12, handN: vec(55, 53), handF: vec(36, 53), flare: 0.9, flow: 0.4 }) },
];

const DEATH: Key<ElementalPose>[] = [
  { at: 0, pose: P({ root: vec(ROOT.x - 3, ROOT.y - 0.5), lean: -0.32, head: -0.3, handN: vec(52, 48), handF: vec(34, 49), flare: 0.7, flow: 0.6 }) },
  { at: 0.33, pose: P({ root: vec(ROOT.x - 1, ROOT.y - 2), lean: -0.15, head: -0.4, handN: vec(58, 38), handF: vec(36, 38), flare: 1.3, flow: 0.1, fx: 0.6 }) },
  { at: 0.67, ease: 'in', pose: P({ root: vec(ROOT.x, ROOT.y + 10), lean: 0.3, head: 0.4, handN: vec(56, 72), handF: vec(38, 74), flare: 0.45, burn: 0.5 }) },
  { at: 1, ease: 'out', pose: P({ root: vec(ROOT.x, ROOT.y + 18), lean: 0.4, head: 0.5, handN: vec(56, 82), handF: vec(38, 84), flare: 0.05, burn: 1 }) },
];

function elementalPose(act: MonsterAction, t: number): ElementalPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle':
      return P({
        root: vec(ROOT.x, ROOT.y + Math.sin(ph) * 1.4),
        lean: REST.lean + Math.sin(ph - 0.5) * 0.03,
        handN: vec(REST.handN.x, REST.handN.y + Math.sin(ph - 0.7) * 1.6),
        handF: vec(REST.handF.x, REST.handF.y + Math.sin(ph - 1.4) * 1.4),
        flare: 1 + Math.sin(ph * 2) * 0.06,
      });
    case 'walk':
      return P({
        root: vec(ROOT.x + 1, ROOT.y - 1 + Math.sin(ph * 2) * 1.2),
        lean: 0.2,
        handN: vec(REST.handN.x + 1 + Math.sin(ph) * 2.5, REST.handN.y + 1 - Math.cos(ph) * 1),
        handF: vec(REST.handF.x + 3 - Math.sin(ph) * 2.5, REST.handF.y + 1 + Math.cos(ph) * 1),
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
  shN: V;
  shF: V;
  elN: V;
  elF: V;
  handN: V;
  handF: V;
}

function local(o: V, lean: number, x: number, y: number): V {
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  return vec(o.x + x * c - y * s, o.y + x * s + y * c);
}

function skeleton(p: ElementalPose): Sk {
  const waist = p.root;
  const neck = along(waist, p.lean, 22);
  const head = along(neck, p.lean + p.head, 7);
  const shN = local(neck, p.lean, 8, 2.5);
  const shF = local(neck, p.lean, -7, 1.5);
  const armN = solveIK(shN, p.handN, 10.5, 10.5, -1);
  const armF = solveIK(shF, p.handF, 9.5, 9.5, -1);
  return { waist, neck, head, shN, shF, elN: armN.mid, elF: armF.mid, handN: armN.end, handF: armF.end };
}

// ── Flame primitives ────────────────────────────────────────────────────

/** Teardrop flame from `base` along unit `dir`, with a sideways waver. */
function flamePath(ctx: CanvasRenderingContext2D, base: V, dir: V, len: number, w: number, wave: number): void {
  const nx = -dir.y;
  const ny = dir.x;
  const tip = vec(base.x + dir.x * len + nx * wave, base.y + dir.y * len + ny * wave);
  const m = vec(base.x + dir.x * len * 0.4, base.y + dir.y * len * 0.4);
  ctx.moveTo(base.x + nx * w, base.y + ny * w);
  ctx.quadraticCurveTo(m.x + nx * w * 1.2 - nx * wave * 0.5, m.y + ny * w * 1.2 - ny * wave * 0.5, tip.x, tip.y);
  ctx.quadraticCurveTo(m.x - nx * w * 1.2 - nx * wave * 0.5, m.y - ny * w * 1.2 - ny * wave * 0.5, base.x - nx * w, base.y - ny * w);
  ctx.closePath();
}

function up(a: number): V {
  return vec(Math.sin(a), -Math.cos(a));
}

/** Rising tongues of fire around a point, oldest (outer) first. */
function tongues(ctx: CanvasRenderingContext2D, c: V, spread: number, len: number, n: number, ph: number, flare: number, lean: number, flow: number, seed: number): void {
  if (flare < 0.05) return;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0 : i / (n - 1) - 0.5;
      const a = k * spread + lean * 0.4 - flow * 0.55 + Math.sin(ph * 2 + i * 1.7 + seed) * 0.12;
      const l = len * flare * (0.75 + 0.25 * Math.sin(ph * 3 + i * 2.3 + seed)) * (1 - Math.abs(k) * 0.6) * (layer ? 0.55 : 1);
      const base = vec(c.x + k * 5, c.y);
      const wave = Math.sin(ph * 2 + i + seed) * 1.6 * flare;
      if (layer === 0) {
        cel(ctx, () => flamePath(ctx, base, up(a), l, 2.4 * flare, wave), FLAME, { band: 0.8, stroke: 0.4 });
      } else {
        ctx.fillStyle = INNER;
        ctx.beginPath();
        flamePath(ctx, vec(base.x, base.y + 1), up(a), l, 1.3 * flare, wave * 0.6);
        ctx.fill();
      }
    }
  }
}

// ── Rock plates ─────────────────────────────────────────────────────────

function rockPlate(ctx: CanvasRenderingContext2D, at: V, rot: number, pts: V[], t: Tone, cracks: number[][], heat: number, smooth = false): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(rot);
  cel(ctx, () => (smooth ? blobPath : polyPath)(ctx, pts), t, { band: 1.3, hi: 0.7, stroke: 0.5 });
  if (heat > 0.02) {
    ctx.strokeStyle = CRACK;
    ctx.globalAlpha = Math.min(1, heat);
    ctx.lineWidth = 0.55;
    ctx.lineCap = 'round';
    for (const c of cracks) {
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      for (let i = 2; i < c.length; i += 2) ctx.lineTo(c[i], c[i + 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Plate position: on the body while alive, tumbling to a rubble spot as it burns out. */
function fallen(p: ElementalPose, alive: V, rubble: V, rot: number, rubbleRot: number): { at: V; rot: number } {
  const b = Math.max(0, Math.min(1, (p.burn - 0.25) / 0.75));
  const e = b * b;
  return { at: lerpV(alive, rubble, e), rot: rot + (rubbleRot - rot) * e };
}

const MASK = [vec(-3.2, -2.6), vec(0.5, -3.8), vec(4, -3.4), vec(7.4, -1.4), vec(6.6, 0.2), vec(3.4, -0.6), vec(0.8, 0.4), vec(-2.6, 1)];
const JAW = [vec(0.6, 3.2), vec(3.6, 2.4), vec(6.2, 3.2), vec(5.2, 5), vec(1.6, 5.2)];
const PAULDRON = [vec(-4.4, -0.8), vec(-2, -3.2), vec(1.4, -3.8), vec(4.4, -2), vec(5, 1), vec(2.4, 2.8), vec(-1.6, 2.4), vec(-4.2, 1.6)];
const CHEST_A = [vec(-3.2, -2.4), vec(-0.6, -3.6), vec(2.4, -3), vec(3, 0.4), vec(1.6, 3.4), vec(-1.6, 3), vec(-3.4, 0.8)];
const CHEST_B = [vec(-2.4, -3.4), vec(2.6, -2.6), vec(2.8, 2.4), vec(-1, 3.2), vec(-2.8, 0)];
const FIST = [vec(-3, -2.4), vec(0, -3.6), vec(3, -3.2), vec(4.6, -1.2), vec(4.4, 1.8), vec(2, 3.6), vec(-2, 3.2), vec(-3.4, 0.6)];
const BELT = [vec(-5, -1.6), vec(0, -2.4), vec(5, -1.4), vec(4.4, 1.8), vec(-4.4, 1.8)];

// ── Draw ────────────────────────────────────────────────────────────────

function drawArm(ctx: CanvasRenderingContext2D, p: ElementalPose, sh: V, el: V, hand: V, far: boolean, ph: number): void {
  const f = Math.max(0.05, p.flare);
  const alive = 1 - p.burn;
  if (alive > 0.1) {
    const r = far ? 3 : 3.6;
    cel(ctx, () => capsulePath(ctx, sh, el, r * f, r * 0.85 * f), far ? FLAME_DEEP : FLAME, { band: 0.8 });
    cel(ctx, () => capsulePath(ctx, el, hand, r * 0.85 * f, r * 0.95 * f), far ? FLAME_DEEP : FLAME, { band: 0.8 });
    ctx.fillStyle = far ? 'rgba(255,190,80,0.7)' : INNER;
    ctx.beginPath();
    capsulePath(ctx, lerpV(sh, el, 0.15), lerpV(el, hand, 0.7), r * 0.45 * f, r * 0.4 * f);
    ctx.fill();
    // Flame licks streaming off the forearm
    const d = vec(el.x - hand.x, el.y - hand.y);
    const l = Math.max(0.01, Math.hypot(d.x, d.y));
    const back = vec(d.x / l * 0.5 + 0, d.y / l * 0.5 - 0.85);
    const bl = Math.hypot(back.x, back.y);
    cel(ctx, () => flamePath(ctx, lerpV(el, hand, 0.4), vec(back.x / bl, back.y / bl), 6 * f, 1.6 * f, Math.sin(ph * 2 + (far ? 1 : 0)) * 1.2), far ? FLAME_DEEP : FLAME, { band: 0.5, stroke: 0.4 });
  }
  // Bracer + knuckle-rock fist
  const heat = alive * (far ? 0.6 : 1);
  const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
  const brAlive = lerpV(el, hand, 0.62);
  const br = fallen(p, brAlive, vec(p.root.x + (far ? -9 : 7), GROUND_Y - 1.6), ang, far ? 2.8 : 0.3);
  rockPlate(ctx, br.at, br.rot, [vec(-3, -2.2), vec(2.6, -2.6), vec(3.4, 0), vec(2.6, 2.6), vec(-3, 2.2)], far ? ROCK_FAR : ROCK, [[-1.6, -1.8, -0.4, 0, -1.2, 2]], heat);
  const fs = fallen(p, hand, vec(p.root.x + (far ? -4 : 12), GROUND_Y - 2.6), ang, far ? -0.6 : 0.5);
  const s = far ? 1.3 : 1.5;
  ctx.save();
  ctx.translate(fs.at.x, fs.at.y);
  ctx.scale(s, s);
  rockPlate(ctx, vec(0, 0), fs.rot, FIST, far ? ROCK_FAR : ROCK, [[1.5, -3, 1, -0.4, 2.8, 1.4], [-2, 1.6, 0.4, 0.8]], heat, true);
  if (!far) {
    ctx.save();
    ctx.rotate(fs.rot);
    ctx.strokeStyle = 'rgba(20,10,10,0.6)';
    ctx.lineWidth = 0.4;
    for (const y of [-1.4, 0.4, 2]) {
      ctx.beginPath();
      ctx.moveTo(2.6, y - 0.6);
      ctx.lineTo(4, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, p: ElementalPose, t: number): void {
  const ph = t * Math.PI * 2;
  const sk = skeleton(p);
  const f = Math.max(0.05, p.flare);
  const alive = 1 - p.burn;
  const T = (x: number, y: number): V => local(sk.waist, p.lean, x, y);
  const H = (x: number, y: number): V => local(sk.head, p.lean + p.head, x, y);

  // Back flames rising off shoulders and head
  if (alive > 0.1) {
    tongues(ctx, T(-2, -21), 1.5, 14, 5, ph, f * alive, p.lean - 0.3, p.flow, 0.5);
    tongues(ctx, H(-2, -4), 1.0, 15, 3, ph, f * alive, p.lean + p.head - 0.4, p.flow, 2.1);
  }
  // Far arm behind the torso
  drawArm(ctx, p, sk.shF, sk.elF, sk.handF, true, ph);
  const pff = fallen(p, local(sk.shF, p.lean, 0, -1.4), vec(p.root.x - 12, GROUND_Y - 2.5), p.lean - 0.2, -2.6);
  rockPlate(ctx, pff.at, pff.rot, PAULDRON.map(q => vec(q.x * 1.2, q.y * 1.2)), ROCK_FAR, [[-2, 0, 2, -1]], alive * 0.6);

  if (alive > 0.1) {
    // Fire wisp below the waist: a tapering core wrapped in upward licks
    const tailLen = 26 * (0.55 + 0.45 * f);
    const down = local(vec(0, 0), p.lean * 0.4, 0, 1);
    const centre = (s: number): V => vec(
      sk.waist.x + down.x * tailLen * s + (Math.sin(ph + s * 2.5) * 2.4 - p.flow * 9) * s * s,
      sk.waist.y + down.y * tailLen * s,
    );
    const width = (s: number): number => 6.2 * Math.pow(1 - s, 0.9) + 0.4;
    const left: V[] = [];
    const right: V[] = [];
    for (let i = 0; i <= 6; i++) {
      const s = i / 6;
      const c = centre(s);
      left.push(vec(c.x - width(s), c.y));
      right.unshift(vec(c.x + width(s), c.y));
    }
    cel(ctx, () => blobPath(ctx, [...left, centre(1.1), ...right]), FLAME_DEEP, { band: 1.2 });
    for (let i = 5; i >= 0; i--) {
      const s = 0.08 + i * 0.15;
      const c = centre(s);
      const side = i % 2 === 0 ? -1 : 1;
      const base = vec(c.x + side * width(s) * 0.45, c.y + 2);
      const a = -0.3 - p.flow * 0.5 + side * 0.18 + Math.sin(ph * 2 + i * 1.7) * 0.14;
      const len = (3.5 + (1 - s) * 9) * (0.6 + 0.4 * f);
      const wv = Math.sin(ph * 2 + i * 2.1) * 1.2;
      cel(ctx, () => flamePath(ctx, base, up(a), len, width(s) * 0.62 + 0.8, wv), i % 2 ? FLAME : FLAME_DEEP, { band: 0.8, stroke: 0 });
      ctx.fillStyle = i < 3 ? INNER : 'rgba(255,170,60,0.95)';
      ctx.beginPath();
      flamePath(ctx, vec(base.x, base.y - 0.5), up(a), len * 0.6, width(s) * 0.3 + 0.4, wv * 0.6);
      ctx.fill();
    }

    // Flame torso (broad V) with upward licks
    const torso = [T(-10.5, -21), T(0, -24.5), T(11.5, -22), T(12, -15), T(7, -6), T(4.5, 1), T(-5.5, 1), T(-9.5, -9)];
    const sq = f;
    cel(ctx, () => blobPath(ctx, torso.map(q => lerpV(T(0, -10), q, 0.6 + 0.4 * sq))), FLAME, { band: 1.8, hi: 0.8 });
    for (const [x, y, len, w, sd] of [[-3, -1, 14, 4.2, 0], [4, -3, 11, 3.2, 1.3]] as const) {
      ctx.fillStyle = INNER;
      ctx.beginPath();
      flamePath(ctx, T(x, y), up(p.lean - 0.25 - p.flow * 0.3 + Math.sin(ph * 2 + sd) * 0.08), len * sq, w, Math.sin(ph * 2 + sd) * 1.2);
      ctx.fill();
    }
    // Neck + flame head: a tall teardrop blaze leaning back
    cel(ctx, () => capsulePath(ctx, T(0.5, -21), sk.head, 3.4 * f, 4.8 * f), FLAME, { band: 1 });
    const hAng = p.lean + p.head - 0.35 - p.flow * 0.4;
    const hw = Math.sin(ph * 2 + 0.7) * 1.8;
    cel(ctx, () => flamePath(ctx, H(0.5, 3), up(hAng), 17 * (0.55 + 0.45 * f), 6.4, hw), FLAME, { band: 1.2 });
    ctx.fillStyle = INNER;
    ctx.beginPath();
    flamePath(ctx, H(0.5, 2), up(hAng), 11 * (0.55 + 0.45 * f), 3.8, hw * 0.7);
    ctx.fill();
  }

  // ── Basalt plates (fall away as it burns out) ──
  const heat = alive;
  const bY = GROUND_Y;
  const beltP = fallen(p, T(0, -1), vec(p.root.x - 1, bY - 2), p.lean, 0.1);
  rockPlate(ctx, beltP.at, beltP.rot, BELT, ROCK, [[-3, 0.6, 0, -0.6, 2.4, 0.8]], heat);
  const ca = fallen(p, T(-3.5, -14), vec(p.root.x - 7, bY - 3), p.lean - 0.1, -0.9);
  rockPlate(ctx, ca.at, ca.rot, CHEST_A, ROCK, [[-2, -1.6, 0, 0, -0.8, 2.4]], heat);
  const cb = fallen(p, T(6.2, -15.5), vec(p.root.x + 3, bY - 5.5), p.lean + 0.15, 0.6);
  rockPlate(ctx, cb.at, cb.rot, CHEST_B, ROCK, [[1.8, -2, 0.4, 0.2, 1.4, 2.4]], heat);
  const pf = fallen(p, local(sk.shN, p.lean, 0, -1.2), vec(p.root.x - 1, bY - 6.5), p.lean + 0.2, -0.3);
  rockPlate(ctx, pf.at, pf.rot, PAULDRON.map(q => vec(q.x * 1.35, q.y * 1.35)), ROCK, [[-3.4, -0.8, 0, 0.5, 3.4, -1.5]], heat);

  // Molten core
  if (alive > 0.05) {
    const c = T(1.6, -12);
    const r = (2.9 + Math.sin(ph * 2) * 0.35 + p.charge * 0.6) * (0.4 + 0.6 * alive);
    const g = ctx.createRadialGradient(c.x - 0.5, c.y - 0.5, 0, c.x, c.y, r);
    g.addColorStop(0, HOT);
    g.addColorStop(0.55, '#ffd060');
    g.addColorStop(1, '#ff7a20');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brow mask with blazing eye slits
  const mk = fallen(p, H(-1.6, -0.4), vec(p.root.x + 7, bY - 7.5), p.lean + p.head, 1.3);
  rockPlate(ctx, mk.at, mk.rot, MASK, ROCK, [[-1.6, 2.2, -0.6, 3.2]], heat);
  ctx.save();
  ctx.translate(mk.at.x, mk.at.y);
  ctx.rotate(mk.rot);
  if (alive > 0.2) {
    // Blazing almond eyes under the brow, turned toward the camera (3/4)
    for (const [x, w] of [[1.2, 3.2], [5, 2.8]] as const) {
      ctx.fillStyle = '#3a0a04';
      ctx.beginPath();
      ctx.ellipse(x, 1.5, w / 2 + 0.55, 1.35, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = HOT;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 1.1);
      ctx.quadraticCurveTo(x, 0.5, x + w / 2, 1.4);
      ctx.quadraticCurveTo(x, 2.4, x - w / 2, 1.1);
      ctx.fill();
    }
  }
  ctx.restore();

  const jw = fallen(p, H(-1.8, -0.2), vec(p.root.x + 10, bY - 2), p.lean + p.head, -0.4);
  rockPlate(ctx, jw.at, jw.rot, JAW, ROCK, [[2, 3.4, 3, 4.4, 4.6, 3.4]], heat);

  // Near arm in front
  drawArm(ctx, p, sk.shN, sk.elN, sk.handN, false, ph);

  // Smouldering ash under the rubble at the end
  if (p.burn > 0.6) {
    const a = (p.burn - 0.6) / 0.4;
    ctx.fillStyle = `rgba(52,40,40,${0.9 * a})`;
    ctx.beginPath();
    ctx.ellipse(p.root.x + 1, GROUND_Y - 0.2, 15 * a, 2 * a, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function fistFront(p: ElementalPose): V {
  const sk = skeleton(p);
  const d = vec(sk.handN.x - sk.elN.x, sk.handN.y - sk.elN.y);
  const l = Math.max(0.01, Math.hypot(d.x, d.y));
  return vec(sk.handN.x + (d.x / l) * 4.5, sk.handN.y + (d.y / l) * 4.5);
}

function elementalFx(ctx: CanvasRenderingContext2D, p: ElementalPose, act: MonsterAction, t: number): void {
  const ph = t * Math.PI * 2;
  const sk = skeleton(p);
  const alive = 1 - p.burn;
  // Heat aura and core glow
  glow(ctx, local(sk.waist, p.lean, 1, -12), 22 * (0.4 + 0.6 * alive), 0xff6a1a, 0.3 * alive * Math.min(1.2, p.flare));
  glow(ctx, local(sk.waist, p.lean, 1.6, -12), 7, 0xfff0b0, 0.55 * alive);
  glow(ctx, sk.head, 7, 0xffc050, 0.3 * alive);
  // Fireball charging in the fist
  if (p.charge > 0.02) {
    const c = fistFront(p);
    const r = 2 + p.charge * 3.2;
    glow(ctx, c, r * 3, 0xff8a2a, 0.55 * p.charge);
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.5, 'rgba(255,200,80,0.95)');
    g.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Licking flame wisps around the ball
    ctx.strokeStyle = `rgba(255,210,110,${0.8 * p.charge})`;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) {
      const a = ph * 1.5 + i * (Math.PI / 2);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 1.25, a, a + 0.9);
      ctx.stroke();
    }
  }
  // Punch smear + release burst
  if (act === 'attack' && t > 0.5) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 0; i <= 5; i++) {
      const q = samplePoseTrack(ATTACK, t - 0.34 + (i / 5) * 0.34);
      tips.push(fistFront(q));
      bases.push(skeleton(q).elN);
    }
    smear(ctx, tips, bases, 0xffb050, 0.55 * p.fx);
    if (t > 0.9) {
      const c = fistFront(p);
      ctx.fillStyle = 'rgba(255,230,150,0.85)';
      for (let i = 0; i < 7; i++) {
        const a = -1.2 + (i / 6) * 2.4;
        const r0 = 5.5;
        const r1 = 8 + (i % 2) * 2.5;
        ctx.beginPath();
        ctx.moveTo(c.x + Math.cos(a - 0.08) * r0, c.y + Math.sin(a - 0.08) * r0);
        ctx.lineTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
        ctx.lineTo(c.x + Math.cos(a + 0.08) * r0, c.y + Math.sin(a + 0.08) * r0);
        ctx.fill();
      }
    }
  }
  // Sparks and embers drifting up
  const n = 7;
  for (let i = 0; i < n; i++) {
    const k = (i / n + t * (act === 'idle' || act === 'walk' ? 1 : 0.5)) % 1;
    const x = sk.waist.x - 10 + ((i * 29) % 22) + Math.sin(ph + i * 2) * 1.5 - p.flow * k * 6;
    const y = sk.waist.y - 8 - k * 30;
    if (y < 6) continue;
    const a = (1 - k) * (0.4 + 0.5 * alive);
    ctx.fillStyle = alive < 0.3 ? `rgba(120,110,104,${a})` : `rgba(255,${200 - (i % 3) * 30},90,${a})`;
    ctx.fillRect(x, y, 0.9, 0.9);
  }
  // Smoke wisps as it gutters out
  if (act === 'death' && p.burn > 0.3) {
    for (let i = 0; i < 3; i++) {
      const k = (i / 3 + t * 0.6) % 1;
      ctx.fillStyle = `rgba(90,82,80,${0.35 * (1 - k) * p.burn})`;
      ctx.beginPath();
      ctx.arc(p.root.x - 4 + i * 5 + Math.sin(ph + i) * 2, GROUND_Y - 8 - k * 18, 2.4 + k * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    glow(ctx, vec(p.root.x + 1, GROUND_Y - 3), 10, 0xff5a1a, 0.35 * (1 - (p.burn - 0.3)));
  }
}

export const FireElementalDrawer = rigMonster<ElementalPose>({
  key: 'monster_fire_elemental',
  // Wider than the old sheet so the fireball punch fits; width doesn't move the sprite in-game.
  frameW: 60,
  frameH: 60,
  scale: 1.1,
  pose: elementalPose,
  draw: (ctx, p, _act, t) => drawBody(ctx, p, t),
  shadow: (p) => ({ x: p.root.x, r: 12 + p.burn * 4, lift: Math.max(0, 18 - p.burn * 18) }),
  fx: elementalFx,
  ink: '#4a1206',
  rim: 'rgba(255,236,160,0.7)',
});
