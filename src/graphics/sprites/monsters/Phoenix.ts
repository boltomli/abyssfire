// src/graphics/sprites/monsters/Phoenix.ts
//
// 凤凰 — a blazing firebird. Crimson body with a golden breast, layered
// flame-feather wings whose primaries burn at the tips, a crest of fire,
// a hooked golden beak and long trailing tail plumes ending in fiery eye
// spots. Hovers on a slow wingbeat, rears up and dives to rake with its
// talons, then sputters, greys and bursts into a heap of ash (with one
// last ember glowing inside).
import type { MonsterAction } from '../types';
import {
  GROUND_Y,
  along,
  blobPath,
  capsulePath,
  cel,
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
import { rigMonster } from '../rig/MonsterKit';

interface PhoenixPose {
  body: V;
  /** + noses down, − rears back. */
  pitch: number;
  /** Wing beat −1 (down) … 1 (up), near and far. */
  wingN: number;
  wingF: number;
  /** Wings swept back along the body (dive) 0..1. */
  sweep: number;
  /** Extra head/neck tilt (+ = forward/down). */
  neck: number;
  /** Talons 0 tucked … 1 thrust forward. */
  talon: number;
  /** Tail plume streaming 0 hanging … 1 streaming back. */
  flow: number;
  /** Death: 0 fiery … 1 cold ash grey. */
  ash: number;
  /** Death: 0 whole … 1 dispersed into the ash heap. */
  burst: number;
  fx: number;
}

// ── Palette (ash-blended at draw time) ──────────────────────────────────

const C = {
  crimson: 0xc8281c,
  body: 0xe8542a,
  breast: 0xffb13a,
  flight: 0xd23a1e,
  covert: 0xff7a26,
  lesser: 0xffc444,
  tip: 0xffe07a,
  beak: 0xf2c040,
  leg: 0x6a2414,
  ash: 0x8a8480,
  ashDark: 0x57524f,
};

function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

const toneCache = new Map<string, Tone>();
/** Fiery tone that cools toward ash grey as the bird dies. */
function ft(c: number, ash: number, far = false, light = 0.4): Tone {
  const a = Math.round(ash * 8) / 8;
  const key = `${c}:${a}:${far}:${light}`;
  let t = toneCache.get(key);
  if (!t) {
    let base = mixHex(c, far ? C.ashDark : C.ash, a * (far ? 1 : 0.92));
    if (far) base = mixHex(base, 0x401010, 0.28);
    t = tone(base, { light: light * (1 - a * 0.5), shadow: 0.36 });
    toneCache.set(key, t);
  }
  return t;
}

// ── Poses ───────────────────────────────────────────────────────────────

const HOVER = vec(50, 56);
const REST: PhoenixPose = {
  body: HOVER, pitch: 0, wingN: 1, wingF: 1, sweep: 0, neck: 0, talon: 0,
  flow: 0.2, ash: 0, burst: 0, fx: 0,
};
const P = (o: Partial<PhoenixPose>): PhoenixPose => ({ ...REST, ...o });

const ATTACK: Key<PhoenixPose>[] = [
  { at: 0, pose: P({ wingN: 0.2, wingF: 0.3 }) },
  { at: 0.33, ease: 'out', pose: P({ body: vec(46, 52), pitch: -0.3, wingN: 1.1, wingF: 1.08, neck: -0.2, talon: 0.45, flow: 0.1, fx: 0.3 }) },
  { at: 0.67, ease: 'in', pose: P({ body: vec(56, 61), pitch: 0.3, wingN: 0.35, wingF: 0.45, sweep: 0.85, neck: 0.25, talon: 0.7, flow: 0.9, fx: 0.7 }) },
  { at: 1, ease: 'linear', pose: P({ body: vec(61, 63), pitch: -0.18, wingN: 1, wingF: 1.05, sweep: 0.1, neck: 0.1, talon: 1, flow: 0.8, fx: 1 }) },
];

const HURT: Key<PhoenixPose>[] = [
  { at: 0, pose: P({ body: vec(46, 53), pitch: -0.4, wingN: 0.3, wingF: -0.4, neck: -0.35, talon: 0.3, flow: 0.6 }) },
  { at: 1, pose: P({ body: vec(47, 55), pitch: -0.2, wingN: 0.7, wingF: 0.3, neck: -0.15, talon: 0.15, flow: 0.4 }) },
];

const DEATH: Key<PhoenixPose>[] = [
  { at: 0, pose: P({ body: vec(46, 53), pitch: -0.4, wingN: 0.3, wingF: -0.4, neck: -0.35, talon: 0.3, flow: 0.6 }) },
  { at: 0.33, pose: P({ body: vec(48, 66), pitch: 0.45, wingN: -0.5, wingF: 1.1, neck: 0.5, talon: 0.1, flow: 0.1, ash: 0.35, burst: 0.08 }) },
  { at: 0.67, ease: 'in', pose: P({ body: vec(49, 80), pitch: 0.7, wingN: -0.9, wingF: 0.2, neck: 0.8, flow: 0, ash: 0.85, burst: 0.55 }) },
  { at: 1, ease: 'out', pose: P({ body: vec(49, 84), pitch: 0.8, wingN: -1, wingF: -0.5, neck: 0.9, flow: 0, ash: 1, burst: 1 }) },
];

function phoenixPose(act: MonsterAction, t: number): PhoenixPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle':
      return P({
        body: vec(HOVER.x, HOVER.y + Math.cos(ph) * 1.8),
        wingN: Math.cos(ph),
        wingF: Math.cos(ph - 0.35),
        neck: Math.sin(ph - 0.8) * 0.06,
        flow: 0.25 + Math.sin(ph + 1.2) * 0.12,
      });
    case 'walk':
      return P({
        body: vec(HOVER.x + 1, HOVER.y + 1 + Math.cos(ph) * 2.2),
        pitch: 0.18,
        wingN: Math.cos(ph) * 1.05,
        wingF: Math.cos(ph - 0.35) * 1.05,
        sweep: 0.15 + Math.max(0, -Math.cos(ph)) * 0.15,
        neck: 0.08,
        flow: 0.6 + Math.sin(ph + 1.2) * 0.12,
      });
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

// ── Geometry helpers ────────────────────────────────────────────────────

function sizeK(p: PhoenixPose): number {
  return 1 - p.burst * 0.55;
}

/** Body-local (x forward, y down) → sprite space. */
function L(p: PhoenixPose, lx: number, ly: number): V {
  const k = sizeK(p) * 1.12;
  const c = Math.cos(p.pitch);
  const s = Math.sin(p.pitch);
  return vec(p.body.x + (lx * c - ly * s) * k, p.body.y + (lx * s + ly * c) * k);
}

function norm(v: V): V {
  const l = Math.hypot(v.x, v.y) || 1;
  return vec(v.x / l, v.y / l);
}

/** Flame tongue: teardrop from `base` along `dir` (unit), wavering. */
function flamePath(ctx: CanvasRenderingContext2D, base: V, dir: V, len: number, w: number, wave: number): void {
  const nx = -dir.y;
  const ny = dir.x;
  const tip = vec(base.x + dir.x * len + nx * wave, base.y + dir.y * len + ny * wave);
  const m = vec(base.x + dir.x * len * 0.45, base.y + dir.y * len * 0.45);
  ctx.moveTo(base.x + nx * w, base.y + ny * w);
  ctx.quadraticCurveTo(m.x + nx * w * 1.1 - nx * wave * 0.4, m.y + ny * w * 1.1 - ny * wave * 0.4, tip.x, tip.y);
  ctx.quadraticCurveTo(m.x - nx * w * 1.1 - nx * wave * 0.4, m.y - ny * w * 1.1 - ny * wave * 0.4, base.x - nx * w, base.y - ny * w);
  ctx.closePath();
}

// ── Wings ───────────────────────────────────────────────────────────────

interface WingGeo { sh: V; wr: V; tip: V; feathers: { base: V; tip: V }[] }

function wingGeo(p: PhoenixPose, far: boolean, t: number): WingGeo {
  const k = sizeK(p);
  const beat = far ? p.wingF : p.wingN;
  const sh = far ? L(p, -2.5, -6.5) : L(p, 0.5, -4.5);
  const u = (beat + 1) / 2; // 0 down … 1 up
  let armAng = -2.75 + u * 2.15 + p.pitch;
  let handAng = -3.2 + u * 2.2 + p.pitch;
  // Sweep folds the wing back along the body
  armAng = armAng + (-1.45 + p.pitch - armAng) * p.sweep;
  handAng = handAng + (-1.7 + p.pitch - handAng) * p.sweep;
  if (far) {
    armAng += 0.18;
    handAng += 0.22;
  }
  const armLen = (far ? 11.5 : 13) * k;
  const handLen = (far ? 12 : 14) * k;
  const wr = along(sh, armAng, armLen);
  const tip = along(wr, handAng, handLen);
  const feathers: { base: V; tip: V }[] = [];
  const n = 9;
  const ph = t * Math.PI * 2;
  for (let i = 0; i <= n; i++) {
    const s = i / n; // 0 = wing tip … 1 = shoulder
    const onHand = s < 0.5;
    const base = onHand ? lerpV(tip, wr, s / 0.5) : lerpV(wr, sh, (s - 0.5) / 0.5);
    const d = onHand ? norm(vec(tip.x - wr.x, tip.y - wr.y)) : norm(vec(wr.x - sh.x, wr.y - sh.y));
    const perp = vec(d.y, -d.x);
    const w = 0.18 + s * 0.85;
    const fd = norm(vec(d.x * (1 - w) + perp.x * w, d.y * (1 - w) + perp.y * w));
    const len = (15 - s * 5.5) * k * (far ? 0.9 : 1) * (1 - p.sweep * 0.25);
    const flick = Math.sin(ph * 2 + i * 1.3) * 0.8 * k;
    feathers.push({ base, tip: vec(base.x + fd.x * len - fd.y * flick, base.y + fd.y * len + fd.x * flick) });
  }
  return { sh, wr, tip, feathers };
}

function featherLayer(ctx: CanvasRenderingContext2D, g: WingGeo, scale: number, tn: Tone, band: number): void {
  const f = g.feathers.map(q => vec(q.base.x + (q.tip.x - q.base.x) * scale, q.base.y + (q.tip.y - q.base.y) * scale));
  cel(ctx, () => {
    ctx.moveTo(g.sh.x, g.sh.y);
    ctx.quadraticCurveTo((g.sh.x + g.wr.x) / 2 + (g.sh.y - g.wr.y) * -0.08, (g.sh.y + g.wr.y) / 2 - 0.8, g.wr.x, g.wr.y);
    ctx.lineTo(g.tip.x, g.tip.y);
    // Scalloped trailing edge, tip → shoulder
    for (let i = 0; i < f.length; i++) {
      const b = g.feathers[i].base;
      if (i === 0) {
        ctx.lineTo(f[0].x, f[0].y);
        continue;
      }
      const prev = f[i - 1];
      const notch = lerpV(lerpV(prev, f[i], 0.5), b, 0.28);
      ctx.quadraticCurveTo(notch.x, notch.y, f[i].x, f[i].y);
    }
    ctx.closePath();
  }, tn, { band });
}

function drawWing(ctx: CanvasRenderingContext2D, p: PhoenixPose, far: boolean, t: number): void {
  const g = wingGeo(p, far, t);
  // Flame-tongue tips on the primaries
  if (p.ash < 0.9) {
    const ph = t * Math.PI * 2;
    for (let i = 0; i < 7; i++) {
      const q = g.feathers[i];
      const d = norm(vec(q.tip.x - q.base.x, q.tip.y - q.base.y));
      const b = lerpV(q.base, q.tip, 0.6);
      const len = Math.hypot(q.tip.x - b.x, q.tip.y - b.y) + (3.2 - i * 0.3) * sizeK(p) * (1 - p.ash);
      cel(ctx, () => flamePath(ctx, b, d, len, 1.3 * sizeK(p), Math.sin(ph * 2 + i * 1.9) * 1.2), ft(far ? C.covert : C.lesser, p.ash, far, 0.6), { band: 0.5 });
    }
  }
  featherLayer(ctx, g, 1, ft(C.flight, p.ash, far), 1.4);
  // Burning primary tips
  if (!far && p.ash < 0.6) {
    ctx.strokeStyle = `rgba(255,224,120,${0.8 * (1 - p.ash)})`;
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const q = g.feathers[i];
      const a = lerpV(q.base, q.tip, 0.62);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(q.tip.x, q.tip.y);
      ctx.stroke();
    }
  }
  featherLayer(ctx, g, 0.58, ft(C.covert, p.ash, far), 1);
  featherLayer(ctx, g, 0.28, ft(C.lesser, p.ash, far, 0.5), 0.7);
  // Feather shafts on the near wing
  if (!far) {
    ctx.strokeStyle = 'rgba(120,20,10,0.4)';
    ctx.lineWidth = 0.4;
    for (let i = 1; i < g.feathers.length - 1; i += 2) {
      const q = g.feathers[i];
      const a = lerpV(q.base, q.tip, 0.32);
      const b = lerpV(q.base, q.tip, 0.85);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

// ── Tail plumes ─────────────────────────────────────────────────────────

function drawTail(ctx: CanvasRenderingContext2D, p: PhoenixPose, t: number): void {
  const k = sizeK(p);
  const root = L(p, -10, 2.5);
  const ph = t * Math.PI * 2;
  const plumes = [
    { a0: -1.8, len: 24, w: 3.2, ph: 0 },
    { a0: -2.2, len: 28, w: 3.6, ph: 1.4 },
    { a0: -2.6, len: 22, w: 3, ph: 2.6 },
  ];
  for (const pl of plumes) {
    const pts: V[] = [root];
    const n = 7;
    const seg = (pl.len * k) / n;
    for (let i = 1; i <= n; i++) {
      const s = i / n;
      const ang = pl.a0 + p.pitch + p.flow * 0.55 * s - (1 - p.flow) * 0.25 * s + Math.sin(ph + pl.ph - s * 2.4) * 0.28 * s;
      pts.push(along(pts[i - 1], ang, seg));
    }
    const left: V[] = [];
    const right: V[] = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n, i + 1)];
      const d = norm(vec(b.x - a.x, b.y - a.y));
      const w = pl.w * k * (s < 0.7 ? 0.45 + s * 0.4 : 0.73 + Math.sin(((s - 0.7) / 0.3) * Math.PI) * 0.7);
      left.push(vec(pts[i].x - d.y * w, pts[i].y + d.x * w));
      right.push(vec(pts[i].x + d.y * w, pts[i].y - d.x * w));
    }
    const end = pts[n];
    const ed = norm(vec(end.x - pts[n - 1].x, end.y - pts[n - 1].y));
    const tipPt = vec(end.x + ed.x * 3.5 * k, end.y + ed.y * 3.5 * k);
    cel(ctx, () => polyPath(ctx, [...left, tipPt, ...right.reverse()]), ft(C.body, p.ash), { band: 1 });
    // Fiery eye-spot near the end
    const eye = lerpV(pts[n - 1], end, 0.6);
    cel(ctx, () => ellipsePath(ctx, eye, 2.4 * k, 1.7 * k, Math.atan2(ed.y, ed.x)), ft(C.lesser, p.ash, false, 0.5), { band: 0.5, stroke: 0.35 });
    ctx.fillStyle = p.ash > 0.5 ? 'rgba(60,56,54,0.8)' : '#a8180e';
    ctx.beginPath();
    ctx.ellipse(eye.x + ed.x * 0.4, eye.y + ed.y * 0.4, 1 * k, 0.75 * k, Math.atan2(ed.y, ed.x), 0, Math.PI * 2);
    ctx.fill();
    // Golden shaft
    ctx.strokeStyle = `rgba(255,214,110,${0.65 * (1 - p.ash)})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    for (let i = 2; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
}

// ── Legs, body, head ────────────────────────────────────────────────────

function drawLeg(ctx: CanvasRenderingContext2D, p: PhoenixPose, far: boolean): void {
  const k = sizeK(p);
  const hip = far ? L(p, -2.5, 4) : L(p, 0, 5.5);
  const tucked = L(p, far ? -4 : -2, far ? 9 : 10.5);
  const reach = vec(p.body.x + (far ? 13 : 16) * k, p.body.y + (far ? 13 : 16) * k);
  const foot = lerpV(tucked, reach, p.talon);
  const knee = lerpV(hip, foot, 0.5);
  const kneeOut = vec(knee.x + 2.5 * k * (1 - p.talon), knee.y + 1 * k);
  const t = ft(C.leg, p.ash, far, 0.3);
  limb(ctx, hip, kneeOut, 2.2 * k, 1.3 * k, ft(C.body, p.ash, far));
  limb(ctx, kneeOut, foot, 1.1 * k, 0.9 * k, t);
  // Three hooked talons fanning forward
  const spread = 0.3 + p.talon * 0.5;
  const base = Math.atan2(foot.y - kneeOut.y, foot.x - kneeOut.x) - 0.8 + p.talon * 0.2;
  ctx.fillStyle = p.ash > 0.5 ? '#3a3634' : '#fff1c4';
  for (let i = -1; i <= 1; i++) {
    const a = base + i * spread;
    const tip = vec(foot.x + Math.cos(a) * 3.4 * k, foot.y + Math.sin(a) * 3.4 * k);
    cel(ctx, () => capsulePath(ctx, foot, tip, 0.75 * k, 0.3 * k), t, { band: 0.3, stroke: 0.3 });
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x + Math.cos(a + 1.2) * 1.3 * k, tip.y + Math.sin(a + 1.2) * 1.3 * k);
    ctx.lineTo(tip.x - Math.cos(a) * 0.8 * k, tip.y - Math.sin(a) * 0.8 * k);
    ctx.fill();
  }
}

function headPos(p: PhoenixPose): { neck0: V; head: V; ang: number } {
  const neck0 = L(p, 6, -4);
  const ang = 0.55 + p.neck + p.pitch * 0.3;
  const head = along(neck0, ang, 10.5 * sizeK(p));
  return { neck0, head, ang };
}

function drawBody(ctx: CanvasRenderingContext2D, p: PhoenixPose, t: number): void {
  const k = sizeK(p);
  const ph = t * Math.PI * 2;
  const ash = p.ash;
  // Torso
  const torso = [L(p, -11, 2.5), L(p, -7, -4.5), L(p, 1, -7), L(p, 8, -5), L(p, 11, 0), L(p, 7, 6.5), L(p, -3, 7), L(p, -9, 5)];
  cel(ctx, () => blobPath(ctx, torso), ft(C.crimson, ash), { band: 1.8 * k });
  // Golden breast
  const breast = [L(p, 1, -4), L(p, 8, -4.5), L(p, 11, 0.2), L(p, 7, 6.2), L(p, 0, 5.8), L(p, -2, 1)];
  cel(ctx, () => blobPath(ctx, breast), ft(C.breast, ash, false, 0.5), { band: 1.2 * k });
  // Breast feather scallops
  ctx.strokeStyle = `rgba(200,80,20,${0.55 * (1 - ash * 0.6)})`;
  ctx.lineWidth = 0.45;
  for (const [lx, ly] of [[4, -1.5], [7, -1], [2.5, 2], [5.5, 2.5], [8, 2.6], [4, 5]] as const) {
    const c = L(p, lx, ly);
    ctx.beginPath();
    ctx.arc(c.x, c.y - 0.4 * k, 1.3 * k, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
  // Neck
  const hp = headPos(p);
  cel(ctx, () => capsulePath(ctx, hp.neck0, hp.head, 4.3 * k, 3.4 * k), ft(C.body, ash), { band: 1.2 * k });
  cel(ctx, () => capsulePath(ctx, lerpV(hp.neck0, hp.head, 0.1), lerpV(hp.neck0, hp.head, 0.75), 2.2 * k, 1.8 * k), ft(C.breast, ash, false, 0.5), { band: 0.6 * k, stroke: 0 });
  // Flame crest (behind the head)
  const h = hp.head;
  for (let i = 0; i < 4; i++) {
    const a = -1.55 - i * 0.32 + p.pitch * 0.5 - p.neck * 0.4 + Math.sin(ph * 2 + i) * 0.1;
    const d = vec(Math.sin(a), -Math.cos(a));
    const base = vec(h.x - 1 * k + d.x * 2 * k, h.y - 2.5 * k + d.y * 2 * k);
    const len = (14 - i * 2) * k;
    cel(ctx, () => flamePath(ctx, base, d, len, 2.2 * k, Math.sin(ph * 2 + i * 1.7) * 1.4 * k), ft(i % 2 ? C.covert : C.body, ash), { band: 0.7 * k });
  }
  // Head
  cel(ctx, () => ellipsePath(ctx, h, 5 * k, 4.6 * k, 0.2), ft(C.body, ash), { band: 1.3 * k });
  // Cheek/face mask
  cel(ctx, () => ellipsePath(ctx, vec(h.x + 1.6 * k, h.y + 1 * k), 3 * k, 2.6 * k, 0.3), ft(C.breast, ash, false, 0.5), { band: 0.5 * k, stroke: 0 });
  // Hooked beak
  const bx = h.x + 3.8 * k;
  const by = h.y - 0.2 * k;
  const beak = ft(C.beak, ash, false, 0.5);
  cel(ctx, () => {
    ctx.moveTo(bx - 0.6 * k, by - 2 * k);
    ctx.quadraticCurveTo(bx + 5.5 * k, by - 2.2 * k, bx + 6.4 * k, by + 2.4 * k);
    ctx.quadraticCurveTo(bx + 4.2 * k, by + 0.8 * k, bx + 0.2 * k, by + 1.6 * k);
    ctx.closePath();
  }, beak, { band: 0.6 * k, stroke: 0.4 });
  ctx.strokeStyle = 'rgba(120,60,10,0.7)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(bx, by + 0.3 * k);
  ctx.quadraticCurveTo(bx + 3 * k, by + 0.1 * k, bx + 5.4 * k, by + 1.6 * k);
  ctx.stroke();
  // Fierce eye
  const ex = h.x + 1.8 * k;
  const ey = h.y - 1.2 * k;
  if (ash < 0.5) {
    ctx.fillStyle = '#2a0604';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 1.7 * k, 1.25 * k, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.ellipse(ex + 0.2 * k, ey, 1.2 * k, 0.85 * k, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c22a0c';
    ctx.beginPath();
    ctx.arc(ex + 0.55 * k, ey + 0.05 * k, 0.55 * k, 0, Math.PI * 2);
    ctx.fill();
    // Brow
    ctx.fillStyle = ft(C.crimson, ash).shade;
    ctx.beginPath();
    ctx.moveTo(ex - 2 * k, ey - 1.8 * k);
    ctx.lineTo(ex + 2.4 * k, ey - 0.7 * k);
    ctx.lineTo(ex - 1.2 * k, ey - 0.6 * k);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = '#2a2624';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ex - 1 * k, ey - 0.9 * k);
    ctx.lineTo(ex + 1 * k, ey + 0.9 * k);
    ctx.moveTo(ex + 1 * k, ey - 0.9 * k);
    ctx.lineTo(ex - 1 * k, ey + 0.9 * k);
    ctx.stroke();
  }
}

// ── Ash heap (death) ────────────────────────────────────────────────────

function drawAshHeap(ctx: CanvasRenderingContext2D, p: PhoenixPose): void {
  const a = Math.max(0, (p.burst - 0.35) / 0.65);
  if (a <= 0) return;
  const cx = p.body.x - 1;
  const hgt = 8 * a;
  const w = 16 * (0.5 + 0.5 * a);
  const heap = [vec(cx - w, GROUND_Y + 0.6), vec(cx - w * 0.55, GROUND_Y - hgt * 0.7), vec(cx - 2, GROUND_Y - hgt), vec(cx + w * 0.4, GROUND_Y - hgt * 0.8), vec(cx + w, GROUND_Y + 0.6), vec(cx, GROUND_Y + 1.6)];
  cel(ctx, () => blobPath(ctx, heap), tone(0x6e6864, { light: 0.35, shadow: 0.4 }), { band: 1.2 });
  // Charred feathers poking out
  const ch = tone(0x3c3432, { light: 0.25 });
  for (const [dx, ang, len] of [[-6, -0.9, 6], [4, 0.7, 5], [-1, -0.2, 4.5]] as const) {
    const b = vec(cx + dx * a, GROUND_Y - hgt * 0.5);
    cel(ctx, () => flamePath(ctx, b, vec(Math.sin(ang), -Math.cos(ang)), len * a, 1.2, 0.6), ch, { band: 0.4, stroke: 0.4 });
  }
  // The ember egg of rebirth
  if (a > 0.6) {
    const e = vec(cx + 1, GROUND_Y - hgt * 0.8);
    cel(ctx, () => ellipsePath(ctx, e, 2.6, 3.3), tone(0xff8a2a, { light: 0.6, shadow: 0.3 }), { band: 0.6, stroke: 0.4 });
    ctx.strokeStyle = 'rgba(255,240,170,0.9)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(e.x - 1.2, e.y - 0.6);
    ctx.lineTo(e.x, e.y + 0.3);
    ctx.lineTo(e.x + 0.8, e.y - 0.9);
    ctx.stroke();
  }
}

function drawPhoenix(ctx: CanvasRenderingContext2D, p: PhoenixPose, t: number): void {
  drawAshHeap(ctx, p);
  if (p.burst > 0.97) return;
  drawWing(ctx, p, true, t);
  drawTail(ctx, p, t);
  drawLeg(ctx, p, true);
  drawBody(ctx, p, t);
  drawLeg(ctx, p, false);
  drawWing(ctx, p, false, t);
}

function talonTip(p: PhoenixPose): V {
  const k = sizeK(p);
  const tucked = L(p, -2, 10.5);
  const reach = vec(p.body.x + 16 * k, p.body.y + 16 * k);
  const f = lerpV(tucked, reach, p.talon);
  return vec(f.x + 3 * k, f.y + 1 * k);
}

function phoenixFx(ctx: CanvasRenderingContext2D, p: PhoenixPose, act: MonsterAction, t: number): void {
  const ph = t * Math.PI * 2;
  const heat = 1 - p.ash;
  // Body aura + head blaze
  if (p.burst < 0.97) {
    glow(ctx, L(p, 2, 0), 20 * sizeK(p), 0xff7a22, 0.28 * heat);
    glow(ctx, headPos(p).head, 8, 0xffc050, 0.3 * heat);
    const gN = wingGeo(p, false, t);
    glow(ctx, gN.tip, 7, 0xffb040, 0.35 * heat);
  }
  // Rising embers
  const n = act === 'death' ? 10 : 7;
  for (let i = 0; i < n; i++) {
    const k = (i / n + t * (act === 'idle' || act === 'walk' ? 1 : 0.5)) % 1;
    const sx = p.body.x - 14 + ((i * 37) % 30);
    const sy = p.body.y + 10 - k * 34;
    const r = 0.5 + (i % 3) * 0.25;
    const a = (1 - k) * (act === 'death' ? 0.8 : 0.7);
    if (sy < 4) continue;
    const col = p.ash > 0.7 && i % 2 === 0 ? `rgba(120,116,112,${a})` : `rgba(255,${190 + (i % 3) * 20},90,${a})`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(sx + Math.sin(ph + i) * 1.5, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dive trail and rake slashes
  if (act === 'attack' && t > 0.5) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 0; i <= 5; i++) {
      const q = samplePoseTrack(ATTACK, t - 0.4 + (i / 5) * 0.4);
      tips.push(talonTip(q));
      bases.push(L(q, 0, 2));
    }
    smear(ctx, tips, bases, 0xffb040, 0.5 * p.fx);
    if (t > 0.9) {
      const tp = talonTip(p);
      ctx.strokeStyle = 'rgba(255,236,170,0.9)';
      ctx.lineWidth = 0.9;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(tp.x - 4 + i * 2, tp.y - 6 + i * 1.2);
        ctx.lineTo(tp.x + 3 + i * 2, tp.y + 2 + i * 1.2);
        ctx.stroke();
      }
      glow(ctx, tp, 9, 0xff9030, 0.55);
    }
  }
  // Ash burst puff and the last ember's glow
  if (act === 'death') {
    if (p.burst > 0.2 && p.burst < 0.97) {
      ctx.fillStyle = `rgba(150,144,138,${0.5 * (1 - p.burst)})`;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = 6 + p.burst * 10;
        ctx.beginPath();
        ctx.arc(p.body.x + Math.cos(a) * r, p.body.y + Math.sin(a) * r * 0.6, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (p.burst > 0.6) glow(ctx, vec(p.body.x, GROUND_Y - 5), 6, 0xff7020, 0.5 * p.burst);
  }
}

export const PhoenixDrawer = rigMonster<PhoenixPose>({
  key: 'monster_phoenix',
  // Wider than the old sheet so wingtips and tail plumes fit; width doesn't move the sprite in-game.
  frameW: 72,
  frameH: 56,
  scale: 1.2,
  pose: phoenixPose,
  draw: (ctx, p, _act, t) => drawPhoenix(ctx, p, t),
  shadow: (p) => ({ x: p.body.x, r: 14 * sizeK(p) + 4 * p.burst, lift: Math.max(0, GROUND_Y - p.body.y - 12) }),
  fx: phoenixFx,
  ink: '#3a0c06',
  rim: 'rgba(255,236,160,0.7)',
});
