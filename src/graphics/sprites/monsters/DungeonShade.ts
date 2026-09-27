// src/graphics/sprites/monsters/DungeonShade.ts
//
// 深渊暗影 — a floating wraith of abyssal smoke: a deep hood hiding a
// cracked skull with ice-blue eye-lights, a torn cloak that tapers into a
// streaming smoke tail, ribs glimpsed through the rent cloth and long bony
// claws. Glides instead of walking, rears up and rakes on the attack, and
// unravels into drifting wisps on death.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  add,
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
  solveIK,
  tone,
  vec,
  type Key,
  type V,
} from '../rig/Rig';
import { rigMonster } from '../rig/MonsterKit';

interface ShadePose {
  /** Body centre x and hood-centre height. */
  x: number;
  y: number;
  /** Upper-body lean (+ forward) and extra hood tilt. */
  lean: number;
  hood: number;
  /** Hand targets as offsets from their shoulders. */
  handN: V;
  handF: V;
  /** Tail streaming back 0 (hanging) … 1 (streaming). */
  tail: number;
  /** Jaw drop 0..1. */
  jaw: number;
  /** Claw splay 0..1. */
  spread: number;
  fx: number;
  /** Dissolve 0 (solid) … 1 (gone). */
  fade: number;
}

const CLOAK = tone(0x3a2468, { light: 0.3, shadow: 0.45 });
const CLOAK_FAR = tone(0x221540, { light: 0.18 });
const RAG = tone(0x2a1a4e, { light: 0.2 });
const BONE = tone(0xdcd6ee, { light: 0.4, shadow: 0.35 });
const CLAW = tone(0xb4aad6, { light: 0.45, shadow: 0.35 });
const VOID = '#0a0616';
const EYE = 0x5fd8ff;
const WISP = 0x7a5cff;

const ARM1 = 7.6;
const ARM2 = 7.6;

const REST: ShadePose = {
  x: CENTER_X - 1, y: 45, lean: 0.08, hood: -0.05,
  handN: vec(8, 6.5), handF: vec(6, 7.5),
  tail: 0.35, jaw: 0.05, spread: 0.3, fx: 0, fade: 0,
};
const P = (o: Partial<ShadePose>): ShadePose => ({ ...REST, ...o });

const ATTACK: Key<ShadePose>[] = [
  { at: 0, pose: REST },
  { at: 0.33, ease: 'out', pose: P({ x: CENTER_X - 4, y: 40, lean: -0.22, hood: -0.25, handN: vec(-3, -11), handF: vec(-6, -8.5), tail: 0.2, jaw: 0.35, spread: 1, fx: 0.4 }) },
  { at: 0.67, ease: 'in', pose: P({ x: CENTER_X + 1, y: 41.5, lean: 0.22, hood: 0.02, handN: vec(8, -11), handF: vec(5, -8), tail: 0.7, jaw: 0.6, spread: 1, fx: 0.7 }) },
  { at: 1, ease: 'linear', pose: P({ x: CENTER_X + 5, y: 46, lean: 0.5, hood: 0.2, handN: vec(14.2, 4.5), handF: vec(11.5, 7.5), tail: 0.95, jaw: 1, spread: 0.85, fx: 1 }) },
];

const RECOIL = P({ x: CENTER_X - 5, y: 43, lean: -0.36, hood: -0.42, handN: vec(-2, 7), handF: vec(-4.5, 5.5), tail: 0.08, jaw: 0.55, spread: 0.9, fade: 0.14 });

const HURT: Key<ShadePose>[] = [
  { at: 0, pose: RECOIL },
  { at: 1, pose: P({ ...RECOIL, x: CENTER_X - 3, lean: -0.14, hood: -0.16, handN: vec(2, 9), handF: vec(0, 9), tail: 0.2, jaw: 0.25, fade: 0.04 }) },
];

const DEATH: Key<ShadePose>[] = [
  { at: 0, pose: RECOIL },
  { at: 0.33, pose: P({ x: CENTER_X - 3, y: 38.5, lean: -0.3, hood: -0.55, handN: vec(2, -12.5), handF: vec(-3, -11.5), tail: 0.2, jaw: 1, spread: 1, fade: 0.12 }) },
  { at: 0.67, ease: 'in', pose: P({ x: CENTER_X - 2, y: 49, lean: 0.12, hood: 0.3, handN: vec(6, 8), handF: vec(3, 9), tail: 0.4, jaw: 0.7, spread: 0.4, fade: 0.55 }) },
  { at: 1, ease: 'out', pose: P({ x: CENTER_X - 2, y: 57, lean: 0.25, hood: 0.5, handN: vec(6, 6), handF: vec(3, 7), tail: 0.15, jaw: 0.3, spread: 0.2, fade: 0.93 }) },
];

function shadePose(act: MonsterAction, t: number): ShadePose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle':
      return P({
        y: REST.y + Math.sin(ph) * 1.5,
        hood: REST.hood + Math.sin(ph - 0.8) * 0.06,
        handN: vec(REST.handN.x + Math.sin(ph + 0.6) * 0.8, REST.handN.y + Math.sin(ph - 0.5) * 1.1),
        handF: vec(REST.handF.x + Math.sin(ph + 1.4) * 0.8, REST.handF.y + Math.sin(ph - 1.1) * 1.1),
        tail: 0.35 + Math.sin(ph) * 0.1,
        jaw: 0.05 + Math.max(0, Math.sin(ph + 1)) * 0.12,
      });
    case 'walk':
      // Glide: body pitched forward, claws trailing, tail streaming.
      return P({
        y: REST.y - 1 + Math.sin(ph * 2) * 1,
        lean: 0.28 + Math.sin(ph * 2 + 0.5) * 0.03,
        hood: 0.02,
        handN: vec(-1 + Math.sin(ph) * 1.2, 11),
        handF: vec(-2.5 + Math.sin(ph + 2) * 1.2, 10.5),
        tail: 0.85 + Math.sin(ph * 2) * 0.08,
      });
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

// ── Geometry ────────────────────────────────────────────────────────────

interface ShadeBody {
  head: V;
  headAng: number;
  shN: V;
  shF: V;
  armN: { mid: V; end: V };
  armF: { mid: V; end: V };
  waist: V;
  chest: V;
}

function solveShade(p: ShadePose): ShadeBody {
  const head = vec(p.x + 3 + p.lean * 8, p.y);
  const chest = vec(p.x + 0.5 + p.lean * 4.5, p.y + 8);
  const shN = vec(chest.x + 3.4, chest.y + 1.2);
  const shF = vec(chest.x - 3, chest.y + 0.2);
  return {
    head,
    headAng: p.hood + p.lean * 0.5,
    shN,
    shF,
    armN: solveIK(shN, add(shN, p.handN), ARM1, ARM2, -1),
    armF: solveIK(shF, add(shF, p.handF), ARM1, ARM2, -1),
    waist: vec(p.x - 0.5, p.y + 19),
    chest,
  };
}

/** Point in hood-local space → sprite space. */
function inHood(b: ShadeBody, l: V): V {
  const c = Math.cos(b.headAng);
  const s = Math.sin(b.headAng);
  return vec(b.head.x + l.x * c - l.y * s, b.head.y + l.x * s + l.y * c);
}

function clawTips(hand: V, el: V, spread: number): { tip: V; root: V }[] {
  const a = Math.atan2(hand.y - el.y, hand.x - el.x);
  const out: { tip: V; root: V }[] = [];
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * (0.25 + spread * 0.3) + 0.15;
    const len = 6.6 - Math.abs(i - 1) * 1;
    const root = vec(hand.x + Math.cos(a + off) * 1.2, hand.y + Math.sin(a + off) * 1.2);
    // Claws curl downward at the tips.
    const mid = vec(root.x + Math.cos(a + off) * len * 0.6, root.y + Math.sin(a + off) * len * 0.6);
    out.push({ root, tip: vec(mid.x + Math.cos(a + off + 0.5) * len * 0.45, mid.y + Math.sin(a + off + 0.5) * len * 0.45) });
  }
  return out;
}

function shadeArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean, spread: number): void {
  const cloth = far ? CLOAK_FAR : RAG;
  const claw = far ? tone(0x8a80ae) : CLAW;
  // Bony forearm, visible through the tattered sleeve.
  limb(ctx, el, hand, 1.4, 1.1, claw);
  // Ragged sleeve over the upper arm, flaring into strips at the elbow.
  const dir = vec(el.x - sh.x, el.y - sh.y);
  const len = Math.hypot(dir.x, dir.y) || 1;
  const nx = -dir.y / len;
  const ny = dir.x / len;
  const cuff = lerpV(el, hand, 0.45);
  const pts = [
    vec(sh.x + nx * 2.8, sh.y + ny * 2.8),
    vec(cuff.x + nx * 3.4, cuff.y + ny * 3.4 + 1.2),
    vec(lerpV(el, cuff, 0.5).x + nx * 0.6, lerpV(el, cuff, 0.5).y + 3.2),
    vec(cuff.x - nx * 1.2, cuff.y - ny * 1.2 + 2.4),
    vec(el.x - nx * 2.8, el.y - ny * 2.8 + 1.5),
    vec(sh.x - nx * 2.6, sh.y - ny * 2.6),
  ];
  cel(ctx, () => polyPath(ctx, pts), cloth, { band: 1 });
  // Knuckled palm and three hooked claws.
  cel(ctx, () => ellipsePath(ctx, hand, 1.7, 1.5), claw, { band: 0.5, stroke: 0.4 });
  for (const c of clawTips(hand, el, spread)) {
    cel(ctx, () => capsulePath(ctx, c.root, c.tip, 0.9, 0.15), claw, { band: 0.3, stroke: 0.35 });
  }
}

function tatters(ctx: CanvasRenderingContext2D, b: ShadeBody, p: ShadePose, t: number): void {
  const ph = t * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    const anchor = vec(b.chest.x - 6 - i * 1.2, b.chest.y + 2 + i * 4.5);
    const chain = clothChain(anchor, 13 + i * 3, 5, 0.35 + p.tail * 0.75, 1.6, ph + i * 1.4);
    const l: V[] = [];
    const r: V[] = [];
    chain.forEach((pt, j) => {
      const w = 1.9 * (1 - j / chain.length) + 0.25;
      l.push(vec(pt.x - w * 0.4, pt.y - w));
      r.push(vec(pt.x + w * 0.4, pt.y + w));
    });
    cel(ctx, () => polyPath(ctx, [...l, ...r.reverse()]), CLOAK_FAR, { band: 0.6 });
  }
}

function cloakOutline(b: ShadeBody, p: ShadePose, t: number): { pts: V[]; tip: V } {
  const ph = t * Math.PI * 2;
  const tailLen = Math.max(12, GROUND_Y - 3.5 - b.waist.y);
  const chain = clothChain(b.waist, tailLen, 6, 0.15 + p.tail * 0.8, 1.5, ph + 0.4);
  const back: V[] = [];
  const front: V[] = [];
  const n = chain.length;
  chain.forEach((pt, i) => {
    const k = i / (n - 1);
    const nxt = chain[Math.min(n - 1, i + 1)];
    const prv = chain[Math.max(0, i - 1)];
    const dx = nxt.x - prv.x;
    const dy = nxt.y - prv.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const half = 10.2 * Math.pow(1 - k, 0.85) + 0.5;
    const wob = Math.sin(ph * 2 + k * 5) * 0.8 * k;
    back.push(vec(pt.x - Math.abs(nx) * half + wob, pt.y + ny * half * 0.2));
    front.push(vec(pt.x + Math.abs(nx) * half * 0.95 - wob, pt.y - ny * half * 0.2));
    // Ragged notch between front points on the lower cloak.
    if (k > 0.1 && k < 0.85 && i < n - 1) {
      const m = lerpV(pt, nxt, 0.5);
      front.push(vec(m.x + half * 0.55, m.y + 1.2));
    }
  });
  const c = b.chest;
  const top = [
    vec(c.x - 8.2, c.y + 1), vec(c.x - 4, c.y - 3.2), vec(c.x + 3.4, c.y - 3), vec(c.x + 8.2, c.y + 1.4),
  ];
  const tip = chain[n - 1];
  return { pts: [...top, ...front, ...back.reverse()], tip };
}

/** How far the face sits back from the hood's front edge (front 3/4 view). */
const FACE_SHIFT = 2.2;

function hoodAndSkull(ctx: CanvasRenderingContext2D, b: ShadeBody, p: ShadePose, t: number): void {
  ctx.save();
  ctx.translate(b.head.x, b.head.y);
  ctx.rotate(b.headAng);
  const sway = Math.sin(t * Math.PI * 2) * 0.6 + p.tail * 3;
  const shell = [
    vec(-7, 2.4), vec(-7.6, -3.4), vec(-3.4, -8.8), vec(2.4, -9.2), vec(7, -5.4),
    vec(8.2, 1), vec(6.4, 7), vec(-1.6, 8.2), vec(-8.6 - sway, 6.4), vec(-13.5 - sway * 1.5, 9.5 + sway * 0.3), vec(-9 - sway, 2.8),
  ];
  cel(ctx, () => blobPath(ctx, shell), CLOAK, { band: 1.8 });
  // The face turns toward the camera (front 3/4) rather than profile.
  ctx.translate(-FACE_SHIFT, 0);
  // Deep hood opening
  const opening = [vec(-0.4, -6.2), vec(6, -4.6), vec(7.8, 1.4), vec(6, 6.4), vec(-0.2, 6)];
  ctx.fillStyle = VOID;
  ctx.beginPath();
  blobPath(ctx, opening);
  ctx.fill();
  // Skull: cranium, cheekbone, dropping jaw
  const jaw = p.jaw * 2.2;
  cel(ctx, () => blobPath(ctx, [vec(1.2, -3.8), vec(4.6, -4.6), vec(7.2, -2.4), vec(7.6, 0.8), vec(6.4, 2.6), vec(3, 2.6), vec(1, 0.4)]), BONE, { band: 0.9, stroke: 0.4 });
  cel(ctx, () => polyPath(ctx, [vec(2.6, 3 + jaw * 0.4), vec(6.8, 3.2 + jaw), vec(6.4, 5 + jaw), vec(3, 4.8 + jaw * 0.6)]), BONE, { band: 0.5, stroke: 0.35 });
  // Teeth
  ctx.fillStyle = BONE.light;
  for (const x of [3.6, 4.9, 6.1]) {
    ctx.fillRect(x, 2.4, 0.7, 0.9);
    ctx.fillRect(x - 0.2, 2.9 + jaw, 0.7, 0.8);
  }
  // Sockets, nasal cavity and a crack
  ctx.fillStyle = VOID;
  ctx.beginPath();
  ctx.ellipse(3.6, -0.9, 1.4, 1.3, 0, 0, Math.PI * 2);
  ctx.ellipse(6.6, -0.8, 1.2, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5.1, 0.6);
  ctx.lineTo(5.8, 1.9);
  ctx.lineTo(4.4, 1.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = BONE.shade;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(3, -4.2);
  ctx.lineTo(3.8, -2.8);
  ctx.lineTo(3.2, -2.2);
  ctx.stroke();
  // Eye-lights (the fx pass adds the glow)
  ctx.fillStyle = '#d8f8ff';
  ctx.fillRect(3.2, -1.4, 1, 0.9);
  ctx.fillRect(6.2, -1.3, 0.9, 0.9);
  // Hood rim folds catching the light
  ctx.strokeStyle = CLOAK.light;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0.4, -6.4);
  ctx.quadraticCurveTo(7.6, -5, 7.8, 1.6);
  ctx.stroke();
  ctx.restore();
}

function drawShade(ctx: CanvasRenderingContext2D, p: ShadePose, t: number): void {
  const b = solveShade(p);
  tatters(ctx, b, p, t);
  shadeArm(ctx, b.shF, b.armF.mid, b.armF.end, true, p.spread);

  // Cloak body tapering into a smoke tail.
  const { pts, tip } = cloakOutline(b, p, t);
  cel(ctx, () => blobPath(ctx, pts), CLOAK, { band: 2.2, hi: 1 });
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, pts);
  ctx.clip();
  // Rent in the cloak: dark void with ribs showing
  const c = b.chest;
  const rent = [vec(c.x + 1.2, c.y + 1.5), vec(c.x + 6.6, c.y + 2), vec(c.x + 6, c.y + 10), vec(c.x + 3, c.y + 13.5), vec(c.x + 0.6, c.y + 8)];
  ctx.fillStyle = VOID;
  ctx.beginPath();
  blobPath(ctx, rent);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const y = c.y + 4 + i * 2.6;
    cel(ctx, () => {
      ctx.moveTo(c.x + 1.4, y);
      ctx.quadraticCurveTo(c.x + 5, y - 1.4, c.x + 6.4 - i * 0.6, y + 0.4);
      ctx.lineTo(c.x + 6 - i * 0.6, y + 1.2);
      ctx.quadraticCurveTo(c.x + 4.6, y - 0.4, c.x + 1.4, y + 1);
      ctx.closePath();
    }, BONE, { band: 0.3, stroke: 0.3 });
  }
  // Sternum
  cel(ctx, () => capsulePath(ctx, vec(c.x + 1.8, c.y + 2.4), vec(c.x + 1.6, c.y + 10), 0.7, 0.5), BONE, { band: 0.3, stroke: 0.3 });
  // Fold lines
  ctx.strokeStyle = CLOAK_FAR.base;
  ctx.lineWidth = 0.7;
  for (const [dx, len] of [[-4.5, 18], [-1, 22]] as const) {
    ctx.beginPath();
    ctx.moveTo(c.x + dx, c.y + 4);
    ctx.quadraticCurveTo(c.x + dx + 1, c.y + len * 0.6, c.x + dx - 2 - p.tail * 4, c.y + len);
    ctx.stroke();
  }
  ctx.restore();

  // Smoke tail thins out toward its tip.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 14);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(tip.x - 14, tip.y - 14, 28, 28);
  ctx.restore();

  // Torn strips hanging off the front hem
  const ph = t * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    const a = vec(b.waist.x + 7 - i * 3.2 - p.tail * i * 1.5, b.waist.y + 2 + i * 3.5);
    const sw = Math.sin(ph * 2 + i * 1.7) * 1.2 - p.tail * 3;
    cel(ctx, () => polyPath(ctx, [vec(a.x - 1.6, a.y - 1), vec(a.x + 1.8, a.y - 1.4), vec(a.x + sw * 0.5 + 0.8, a.y + 5.5 - i * 0.6), vec(a.x + sw - 0.4, a.y + 8 - i * 0.8)]), RAG, { band: 0.7 });
  }

  hoodAndSkull(ctx, b, p, t);
  shadeArm(ctx, b.shN, b.armN.mid, b.armN.end, false, p.spread);

  if (p.fade > 0.01) {
    // Unravel: the silhouette is eaten away in growing holes, then fades.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 18; i++) {
      const rx = Math.sin(i * 12.9898) * 43758.5453;
      const ry = Math.sin(i * 78.233) * 12345.678;
      const fx = rx - Math.floor(rx);
      const fy = ry - Math.floor(ry);
      const r = p.fade * (3 + ((i * 7) % 5)) * 1.5;
      const cx = p.x - 13 + fx * 28;
      const cy = p.y - 9 + fy * (GROUND_Y - p.y + 6);
      const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g2.addColorStop(0, 'rgba(0,0,0,1)');
      g2.addColorStop(0.55, 'rgba(0,0,0,0.8)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.fillStyle = '#000';
    ctx.globalAlpha = Math.min(1, p.fade * 0.7);
    ctx.fillRect(-200, -200, 600, 600);
    ctx.restore();
  }
}

// ── Effects ─────────────────────────────────────────────────────────────

function shadeFx(ctx: CanvasRenderingContext2D, p: ShadePose, act: MonsterAction, t: number): void {
  const b = solveShade(p);
  const live = 1 - p.fade;
  // Eye-lights
  for (const [l, r] of [[vec(3.7 - FACE_SHIFT, -1), 2.8], [vec(6.6 - FACE_SHIFT, -0.9), 2.6]] as const) {
    glow(ctx, inHood(b, l), r + p.fx, EYE, (0.4 + p.fx * 0.2) * live);
  }
  // Cold soul-flame burning inside the ribcage
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
  glow(ctx, vec(b.chest.x + 3.8, b.chest.y + 6.5), 4.5 + pulse * 1.2 + p.fx * 2, EYE, (0.35 + pulse * 0.15 + p.fx * 0.2) * live);
  // Drifting wisps off the tail and shoulders
  const { tip } = cloakOutline(b, p, t);
  const n = act === 'death' ? 9 : 5;
  for (let i = 0; i < n; i++) {
    const k = (i / n + t * (act === 'walk' ? 1 : 0.5)) % 1;
    const src = i % 2 === 0 ? tip : vec(b.chest.x - 6, b.chest.y + 6);
    const rise = act === 'death' ? 22 * p.fade : 10;
    const pt = vec(src.x - k * (6 + p.tail * 8) + Math.sin(k * 6 + i) * 2, src.y - k * rise - 2);
    glow(ctx, pt, 2.4 + (act === 'death' ? p.fade * 2 : 0), WISP, 0.45 * (1 - k) * (act === 'death' ? 1 : live));
  }
  if (act === 'attack' && t > 0.8) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const sp = samplePoseTrack(ATTACK, Math.max(0, t - i * 0.05));
      const sb = solveShade(sp);
      const claws = clawTips(sb.armN.end, sb.armN.mid, sp.spread);
      tips.push(claws[1].tip);
      bases.push(lerpV(sb.armN.end, claws[1].tip, 0.2));
    }
    smear(ctx, tips, bases, 0x9d86ff, 0.55 * p.fx);
    glow(ctx, b.armN.end, 3 + p.fx * 4, WISP, 0.5 * p.fx);
  }
  if (act === 'death' && p.fade > 0.4) {
    // Last ember of the eyes lingering in the smoke
    glow(ctx, inHood(b, vec(5, -1)), 5, EYE, 0.3 * (1.2 - p.fade));
  }
}

export const DungeonShadeDrawer = rigMonster<ShadePose>({
  key: 'monster_dungeon_shade',
  // Wider than the old 48 for the claw lunge; width doesn't move the sprite.
  frameW: 64,
  frameH: 60,
  scale: 1.36,
  pose: shadePose,
  draw: (ctx, p, _act, t) => drawShade(ctx, p, t),
  shadow: (p) => ({ x: p.x + 1, r: 11 * (1 - p.fade * 0.6), lift: 10 }),
  fx: shadeFx,
  ink: '#1c1034',
  rim: 'rgba(170,150,255,0.55)',
});
