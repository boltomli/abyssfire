// src/graphics/sprites/monsters/DungeonFiend.ts
//
// 深渊恶鬼 — a hunched abyssal brute: blood-red hide split by molten
// cracks, a humped back ridged with obsidian spines, forward-curving horns,
// a tusked underbite, a whipping spiked tail and long arms ending in black
// talons. Knuckle-walks on the prowl and rakes with both claws.
import {
  CENTER_X,
  add,
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
  type Tone,
  type V,
} from '../rig/Rig';
import { basePose, solveSkeleton, spun, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster, humanoidTracks, type HumanoidMonsterSpec } from '../rig/MonsterKit';
import type { ViewSkeleton } from '../rig/HumanView';
import type { MonsterAction } from '../types';
import {
  backSpikes,
  eye3,
  eyeGlowPoints,
  lp,
  poly3,
  profileRings,
  sagittalSpun,
  solid3,
  surf,
  surfCurve,
  surfPatch,
  surfVis,
  tube3,
  turnedHead,
  type L3,
  type Part3,
} from '../rig/MonsterView';

const HIDE = tone(0x8e2a2c, { light: 0.3, shadow: 0.45 });
const HIDE_FAR = tone(0x5a171d, { light: 0.18 });
const BELLY = tone(0xb4553e, { light: 0.35 });
const OBSIDIAN = tone(0x2e2233, { light: 0.4, shadow: 0.3 });
const HORN = tone(0x3a2a2c, { light: 0.45, shadow: 0.3 });
const TUSK = tone(0xe8dcc0, { light: 0.4, shadow: 0.3 });
const MAGMA = '#ffb347';
const MAGMA_GLOW = 0xff6a1a;
const EYE = 0xffd23a;

/** Point in torso bone space (origin neck, +y toward pelvis, +x forward). */
function torsoPt(sk: Skeleton, l: V): V {
  const a = Math.atan2(sk.pelvis.y - sk.neck.y, sk.pelvis.x - sk.neck.x) - Math.PI / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return vec(sk.neck.x + l.x * c - l.y * s, sk.neck.y + l.x * s + l.y * c);
}

function headPt(sk: Skeleton, l: V): V {
  const c = Math.cos(sk.headAng);
  const s = Math.sin(sk.headAng);
  return vec(sk.head.x + l.x * c - l.y * s, sk.head.y + l.x * s + l.y * c);
}

/** Closed polygon around a centreline, radius tapering from r0 to r1. */
function taper(pts: readonly V[], r0: number, r1: number): V[] {
  const l: V[] = [];
  const r: V[] = [];
  const n = pts.length;
  pts.forEach((c, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / d;
    const ny = (b.x - a.x) / d;
    const w = r0 + (r1 - r0) * (i / (n - 1));
    l.push(vec(c.x + nx * w, c.y + ny * w));
    r.push(vec(c.x - nx * w, c.y - ny * w));
  });
  return [...l, ...r.reverse()];
}

function talons(hand: V, el: V, spread: number): { root: V; tip: V }[] {
  const a = Math.atan2(hand.y - el.y, hand.x - el.x);
  const out: { root: V; tip: V }[] = [];
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * (0.35 + spread * 0.25);
    const root = vec(hand.x + Math.cos(a + off) * 2, hand.y + Math.sin(a + off) * 2);
    const len = 5.4 - Math.abs(i - 1) * 0.9;
    const bend = a + off + 0.55;
    out.push({ root, tip: vec(root.x + Math.cos(a + off) * len * 0.55 + Math.cos(bend) * len * 0.5, root.y + Math.sin(a + off) * len * 0.55 + Math.sin(bend) * len * 0.5) });
  }
  return out;
}

function clawHand(ctx: CanvasRenderingContext2D, hand: V, el: V, skin: Tone, spread: number): void {
  cel(ctx, () => ellipsePath(ctx, hand, 2.9, 2.6), skin, { band: 0.8 });
  for (const c of talons(hand, el, spread)) {
    cel(ctx, () => capsulePath(ctx, c.root, c.tip, 1.05, 0.2), OBSIDIAN, { band: 0.4, stroke: 0.4 });
  }
}

function fiendArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, skin: Tone, far: boolean): void {
  limb(ctx, sh, el, 4.2, 3.2, skin);
  limb(ctx, el, hand, 3.3, 2.6, skin);
  // Forearm spur
  const d = vec(hand.x - el.x, hand.y - el.y);
  const l = Math.hypot(d.x, d.y) || 1;
  const n = vec(d.y / l, -d.x / l);
  const base = lerpV(el, hand, 0.3);
  cel(ctx, () => polyPath(ctx, [
    vec(base.x + n.x * 2.2 - d.x / l * 1.4, base.y + n.y * 2.2 - d.y / l * 1.4),
    vec(base.x + n.x * 2.2 + d.x / l * 1.6, base.y + n.y * 2.2 + d.y / l * 1.6),
    vec(base.x + n.x * 5.4 - d.x / l * 2.4, base.y + n.y * 5.4 - d.y / l * 2.4),
  ]), far ? tone(0x241a28) : OBSIDIAN, { band: 0.4, stroke: 0.4 });
  if (!far) {
    // Molten crack along the forearm
    ctx.strokeStyle = MAGMA;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    const a = lerpV(el, hand, 0.2);
    const b = lerpV(el, hand, 0.75);
    ctx.moveTo(a.x - n.x * 0.6, a.y - n.y * 0.6);
    ctx.lineTo(lerpV(a, b, 0.5).x + n.x * 0.5, lerpV(a, b, 0.5).y + n.y * 0.5);
    ctx.lineTo(b.x - n.x * 0.4, b.y - n.y * 0.4);
    ctx.stroke();
  }
}

function fiendLeg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, skin: Tone): void {
  limb(ctx, hip, knee, 4.6, 3.4, skin);
  limb(ctx, knee, ankle, 3.2, 2.3, skin);
  // Splayed clawed foot
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 2.6, ankle.y - 1), vec(ankle.x + 1.8, ankle.y - 1.6),
    vec(sole.x + 5.6, sole.y - 1.6), vec(sole.x + 6, sole.y), vec(sole.x - 3, sole.y),
  ]), skin, { band: 0.8 });
  for (const dx of [2.6, 5.2]) {
    cel(ctx, () => polyPath(ctx, [vec(sole.x + dx, sole.y - 1.4), vec(sole.x + dx + 2.4, sole.y - 0.2), vec(sole.x + dx + 0.6, sole.y)]), OBSIDIAN, { band: 0.2, stroke: 0.3 });
  }
  cel(ctx, () => polyPath(ctx, [vec(sole.x - 2.4, sole.y - 1.4), vec(sole.x - 4.6, sole.y - 0.4), vec(sole.x - 2.2, sole.y)]), OBSIDIAN, { band: 0.2, stroke: 0.3 });
}

function tail(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const root = torsoPt(sk, vec(-4.5, 14));
  const chain = clothChain(root, 17, 6, 0.85 + p.flow * 0.3, 1.1, t * Math.PI * 2 + 0.5);
  // Curl the tip upward a little
  const pts = chain.map((c, i) => vec(c.x, c.y - Math.pow(i / 6, 2) * 6));
  const l: V[] = [];
  const r: V[] = [];
  pts.forEach((c, i) => {
    const w = 3.4 * (1 - i / pts.length) + 0.7;
    l.push(vec(c.x, c.y - w));
    r.push(vec(c.x, c.y + w));
  });
  cel(ctx, () => blobPath(ctx, [...l, ...r.reverse()]), HIDE_FAR, { band: 1 });
  // Spiked tip
  const tip = pts[pts.length - 1];
  const pre = pts[pts.length - 2];
  const a = Math.atan2(tip.y - pre.y, tip.x - pre.x);
  cel(ctx, () => polyPath(ctx, [
    vec(tip.x + Math.cos(a + 1.6) * 2.2, tip.y + Math.sin(a + 1.6) * 2.2),
    vec(tip.x + Math.cos(a) * 5, tip.y + Math.sin(a) * 5),
    vec(tip.x + Math.cos(a - 1.6) * 2.2, tip.y + Math.sin(a - 1.6) * 2.2),
  ]), OBSIDIAN, { band: 0.5 });
}

function fiendTorso(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Spine ridge spikes along the humped back
    for (let i = 0; i < 4; i++) {
      const y = 0.5 + i * (len * 0.22);
      const h = 5.2 - i * 0.9;
      cel(ctx, () => polyPath(ctx, [vec(-6.5 + i * 0.3, y - 1.6), vec(-8 - h + i * 0.4, y - 0.4 - h * 0.5), vec(-6.6 + i * 0.5, y + 2)]), OBSIDIAN, { band: 0.5, stroke: 0.4 });
    }
    // Massive hunched torso: humped back, deep chest, narrow waist
    const body = [vec(-7.4, -1), vec(0, -3), vec(7, 0.6), vec(9.4, len * 0.42), vec(6.4, len * 0.85), vec(4, len + 1), vec(-4.4, len + 1.2), vec(-7, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), HIDE, { band: 2.2, hi: 0.9 });
    // Plated belly
    for (let i = 0; i < 4; i++) {
      const y = len * 0.28 + i * 3;
      cel(ctx, () => blobPath(ctx, [vec(2.2 - i * 0.3, y), vec(8.2 - i * 0.7, y - 0.6), vec(7.8 - i * 0.8, y + 2.6), vec(2.4 - i * 0.3, y + 2.8)]), BELLY, { band: 0.6, stroke: 0.4 });
    }
    // Molten cracks across the chest and flank
    ctx.strokeStyle = MAGMA;
    ctx.lineWidth = 0.65;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(-1.6, 4.6);
    ctx.lineTo(-2.4, 7.6);
    ctx.lineTo(0.4, 10.4);
    ctx.moveTo(-1.6, 4.6);
    ctx.lineTo(1.6, 5.4);
    ctx.moveTo(-5, len * 0.62);
    ctx.lineTo(-2.4, len * 0.7);
    ctx.lineTo(-3, len * 0.84);
    ctx.stroke();
    // Loin wrap of scorched hide
    cel(ctx, () => polyPath(ctx, [vec(-4.6, len - 1.2), vec(6, len - 2), vec(5, len + 5), vec(1.6, len + 3.6), vec(-2, len + 5.4), vec(-4.8, len + 2)]), tone(0x3a2622), { band: 0.6 });
  });
}

function fiendHead(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const jaw = 0.8 + p.fx * 2.2;
  // Far horn
  const hornLine = [vec(-1, -5), vec(-5, -7.6), vec(-7.6, -11), vec(-6.4, -14.6), vec(-2.6, -16), vec(1.6, -15)];
  cel(ctx, () => blobPath(ctx, taper(hornLine.map(h => vec(h.x + 2.6, h.y + 0.8)), 2, 0.25)), tone(0x241a1c), { band: 0.6 });
  // Lower jaw with tusks (drops open while attacking)
  ctx.save();
  ctx.translate(-1, 2.5);
  ctx.rotate(jaw * 0.08);
  cel(ctx, () => blobPath(ctx, [vec(-3, 0), vec(8.6, 0.8 + jaw * 0.4), vec(8.8, 3.6 + jaw * 0.3), vec(3, 5.4), vec(-3, 3.6)]), HIDE, { band: 1 });
  cel(ctx, () => polyPath(ctx, [vec(6.4, 1.4), vec(7.8, -3), vec(8.4, 1.2)]), TUSK, { band: 0.3, stroke: 0.35 });
  cel(ctx, () => polyPath(ctx, [vec(3.6, 1.2), vec(4.4, -1.6), vec(5.2, 1.2)]), TUSK, { band: 0.2, stroke: 0.3 });
  ctx.restore();
  // Maw interior
  ctx.fillStyle = '#2a0808';
  ctx.beginPath();
  ctx.moveTo(1, 2);
  ctx.lineTo(8.6, 1.4);
  ctx.lineTo(8.2, 2.6 + jaw * 0.6);
  ctx.lineTo(1, 3.4);
  ctx.closePath();
  ctx.fill();
  // Skull: heavy brow, short snout
  const skull = [vec(-5.4, -1.8), vec(-3.6, -6.2), vec(2, -6.8), vec(6.4, -4.4), vec(9.4, -1.6), vec(9.6, 1.6), vec(4, 2.4), vec(-3.6, 2.4)];
  cel(ctx, () => blobPath(ctx, skull), HIDE, { band: 1.6 });
  // Brow ridge and nostrils
  cel(ctx, () => polyPath(ctx, [vec(0.4, -4.2), vec(7.8, -3), vec(7.4, -1.4), vec(0.6, -2)]), HIDE_FAR, { band: 0.4, stroke: 0.35 });
  ctx.fillStyle = '#2a0808';
  ctx.fillRect(8.4, -0.6, 0.9, 0.7);
  // Burning eyes under the brow
  ctx.fillStyle = '#fff2a0';
  ctx.beginPath();
  ctx.moveTo(3.2, -1.6);
  ctx.lineTo(6.2, -1.2);
  ctx.lineTo(5.6, -0.2);
  ctx.lineTo(3.4, -0.6);
  ctx.closePath();
  ctx.fill();
  // Near horn sweeping back then hooking forward
  const horn = taper(hornLine, 2.6, 0.3);
  cel(ctx, () => blobPath(ctx, horn), HORN, { band: 0.9 });
  ctx.strokeStyle = HORN.shade;
  ctx.lineWidth = 0.4;
  for (let i = 1; i < 4; i++) {
    const a = hornLine[i];
    ctx.beginPath();
    ctx.moveTo(a.x - 1.8, a.y + 0.6);
    ctx.lineTo(a.x + 1.6, a.y - 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Isometric 3/4 views ─────────────────────────────────────────────────

const FIEND_BODY = (len: number): V[] => [vec(-7.4, -1), vec(0, -3), vec(7, 0.6), vec(9.4, len * 0.42), vec(6.4, len * 0.85), vec(4, len + 1), vec(-4.4, len + 1.2), vec(-7, len * 0.5)];
const fiendRings = (len: number): ReturnType<typeof profileRings> => profileRings(FIEND_BODY(len), y => len - y, a => a * 1.05, 8);
const FIEND_SKULL = profileRings([vec(-5.4, -1.8), vec(-3.6, -6.2), vec(2, -6.8), vec(6.4, -4.4), vec(7.4, -1.6), vec(7, 2.2), vec(4, 3), vec(-3.6, 2.4)], y => -y, a => a * 0.95, 7);
const FIEND_EYE = { h: 1.6, phi: 0.5 };
/** Molten cracks on the chest, as (h from neck, phi) control points. */
const CRACKS: (readonly [number, number])[][] = [
  [[2, -0.9], [4.6, -0.5], [7.6, -0.7], [10.4, -0.3]],
  [[4.6, -0.5], [5.4, -0.1]],
];

function fiendTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = fiendRings(len);
  const front = T.vis(0) > T.vis(Math.PI);
  const flap = (s: 1 | -1): L3[] => {
    const fr = s > 0 ? 5.6 : -4.8;
    const sw = -p.flow * 2 * s;
    return [[1.2, fr, -3], [1.2, fr, 3], [-5, fr + sw + s, 2.4], [-3.6, fr + sw + s * 0.6, 0], [-5.4, fr + sw + s, -2.4]];
  };
  const spikes = backSpikes(T, R, len + 0.5, len * 0.35, 4, [0], i => 5.2 - i * 0.9, 1.4);
  const parts: Part3[] = [
    { pts: flap(front ? -1 : 1), tone: tone(0x3a2622), bias: -30 },
    ...spikes.map(pts => ({ pts, tone: OBSIDIAN, hull: true, band: 0.4 })),
  ];
  solid3(ctx, T, R, HIDE, {
    band: 2.2,
    hi: 0.9,
    parts,
    face: () => {
      if (T.vis(0) > -0.3) {
        for (let i = 0; i < 4; i++) {
          const h = len - len * 0.28 - i * 3;
          cel(ctx, () => polyPath(ctx, surfPatch(T, R, h, h - 2.6, -0.7 + i * 0.05, 0.7 - i * 0.05, 0.2, 6)), BELLY, { band: 0.6, stroke: 0.4 });
        }
      }
      for (const c of CRACKS) {
        for (const run of surfCurve(T, R, c.map(([h, phi]) => [len - h, phi] as const), 0.1, 4, 0.02)) {
          ctx.strokeStyle = MAGMA;
          ctx.lineWidth = 0.65;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          run.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
          ctx.stroke();
        }
      }
    },
    over: () => poly3(ctx, T, flap(front ? 1 : -1), tone(0x3a2622), { band: 0.6 }),
  });
}

function fiendHeadView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  const H = turnedHead(sk, 0.35);
  const R = FIEND_SKULL;
  const jaw = 0.8 + p.fx * 2.2;
  const horn = (s: 1 | -1): L3[] => [[5, 1, 3.6 * s], [7.4, -3.4, 6.4 * s], [11, -6, 7.6 * s], [14.6, -4.8, 7 * s], [16, -1, 5.6 * s], [15, 2.4, 4.4 * s]];
  const deep = (s: 1 | -1): boolean => H.rig.d(lp(H, 12, -5, 7 * s)) < H.rig.d(H.o);
  const drawHorn = (s: 1 | -1): void => tube3(ctx, H, horn(s), [2.4, 2, 1.6, 1.1, 0.6, 0.25], s > 0 ? HORN : tone(0x241a1c));
  for (const s2 of [1, -1] as const) if (deep(s2)) drawHorn(s2);
  const d = jaw * 0.6;
  const parts: Part3[] = [
    // Lower jaw hanging open with the snarl, tusks jutting up
    { pts: [[-1.8, 0, -4], [-1.8, 0, 4], [-3 - d * 0.3, 9, -2.4], [-3 - d * 0.3, 9, 2.4], [-5.8 - d, 7, -2.2], [-5.8 - d, 7, 2.2], [-5.4 - d * 0.5, 0.4, -3.4], [-5.4 - d * 0.5, 0.4, 3.4]], tone: HIDE, hull: true, band: 1, bias: -0.4 },
    { pts: [[-3.2 - d * 0.3, 7.6, 2], [-3.2 - d * 0.3, 8.6, 1.8], [1.4, 8.4, 2.2]], tone: TUSK, mirror: true, band: 0.3, bias: 1 },
  ];
  solid3(ctx, H, R, HIDE, {
    band: 1.6,
    parts,
    face: () => {
      if (H.vis(0) < -0.3) return;
      cel(ctx, () => polyPath(ctx, surfPatch(H, R, FIEND_EYE.h + 2.4, FIEND_EYE.h + 1, -1.05, 1.05, 0.3, 6)), HIDE_FAR, { band: 0.4, stroke: 0.35 });
      for (const sgn of [1, -1]) {
        eye3(ctx, H, R, FIEND_EYE.h, sgn * FIEND_EYE.phi, { rx: 1.7, ry: 0.65, iris: '#fff2a0', tilt: -0.15 });
      }
      ctx.fillStyle = '#2a0808';
      ctx.beginPath();
      polyPath(ctx, surfPatch(H, R, -2, -2.6 - d * 0.5, -0.8, 0.8, 0.2, 6));
      ctx.fill();
      for (const phi of [-0.15, 0.15]) {
        if (surfVis(H, R, -0.6, phi) < 0.1) continue;
        const q = surf(H, R, -0.6, phi, 0.2);
        ctx.fillRect(q.x - 0.45, q.y - 0.35, 0.9, 0.7);
      }
    },
  });
  for (const s2 of [1, -1] as const) if (!deep(s2)) drawHorn(s2);
}

function fiendRakeSmear(ctx: CanvasRenderingContext2D, p: HumanPose, act: MonsterAction, t: number): void {
  if (!(act === 'attack' && t > 0.8)) return;
  const tips: V[] = [];
  const bases: V[] = [];
  for (let i = 6; i >= 0; i--) {
    const sp = samplePoseTrack(TRACKS_REF.attack, Math.max(0.34, t - i * 0.05));
    const ssk = solveSkeleton(sp, SKIN.prop);
    const tl = talons(ssk.handN, ssk.elN, sp.fx)[1];
    tips.push(spun(sp, tl.tip, ssk));
    bases.push(spun(sp, lerpV(ssk.handN, tl.tip, 0.25), ssk));
  }
  smear(ctx, tips, bases, 0xff7a3a, 0.6 * p.fx);
}

function fiendViewFx(ctx: CanvasRenderingContext2D, p: HumanPose, sk: ViewSkeleton, act: MonsterAction, t: number): void {
  if (act === 'death' && t > 0.8) return;
  const live = act === 'death' ? 1 - t : 1;
  for (const e of eyeGlowPoints(turnedHead(sk, 0.35), FIEND_SKULL, FIEND_EYE.h, [FIEND_EYE.phi, -FIEND_EYE.phi])) glow(ctx, e, 2.6 + p.fx * 1.5, EYE, (0.5 + p.fx * 0.3) * live);
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
  const R = fiendRings(sk.torsoLen);
  for (const [h, phi] of [[4.6, -0.5], [8.6, -0.6], [11.8, -0.4]] as const) {
    if (surfVis(sk.torso, R, sk.torsoLen - h, phi) < 0.05) continue;
    glow(ctx, surf(sk.torso, R, sk.torsoLen - h, phi, 0.3), 2.6 + pulse, MAGMA_GLOW, (0.35 + pulse * 0.15 + p.fx * 0.2) * live);
  }
  glow(ctx, lerpV(sk.elN, sk.handN, 0.5), 2.4, MAGMA_GLOW, 0.3 * live);
  sagittalSpun(ctx, sk, p, () => fiendRakeSmear(ctx, p, act, t));
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 10, shin: 10, upperArm: 10, foreArm: 10,
    torso: 15, neck: 5.4, ankle: 2,
    hipN: vec(2, 0), hipF: vec(-2.6, -0.4),
    shN: vec(1.6, 3.6), shF: vec(-4.4, 3),
  },
  back(ctx, sk, p, t) {
    tail(ctx, sk, p, t);
  },
  armFar(ctx, sk, p) {
    fiendArm(ctx, sk.shF, sk.elF, sk.handF, HIDE_FAR, true);
    clawHand(ctx, sk.handF, sk.elF, HIDE_FAR, p.fx);
  },
  legFar(ctx, sk) {
    fiendLeg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, HIDE_FAR);
  },
  legNear(ctx, sk) {
    fiendLeg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, HIDE);
  },
  torso(ctx, sk) {
    fiendTorso(ctx, sk);
  },
  head(ctx, sk, p) {
    fiendHead(ctx, sk, p);
  },
  armNear(ctx, sk) {
    fiendArm(ctx, sk.shN, sk.elN, sk.handN, HIDE, false);
    // Bone-spur shoulder
    cel(ctx, () => ellipsePath(ctx, add(sk.shN, vec(0.2, -0.6)), 5.4, 4.8), HIDE, { band: 1.4 });
    for (let i = 0; i < 2; i++) {
      const b = add(sk.shN, vec(-2 + i * 2.6, -3.2 + i * 0.3));
      cel(ctx, () => polyPath(ctx, [vec(b.x - 1.2, b.y + 0.6), vec(b.x - 1.6 - i * 0.4, b.y - 4 + i * 0.8), vec(b.x + 1.2, b.y + 0.2)]), OBSIDIAN, { band: 0.3, stroke: 0.35 });
    }
  },
  weapon(ctx, sk, p) {
    clawHand(ctx, sk.handN, sk.elN, HIDE, p.fx);
  },
};

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 6, 71),
  lean: 0.92,
  head: -0.95,
  footN: vec(CENTER_X + 1, 91),
  footF: vec(CENTER_X - 11, 91),
  handN: vec(CENTER_X + 14, 81),
  handF: vec(CENTER_X + 8, 83),
  wpn: 0,
  flow: 0.1,
});

const SPEC: HumanoidMonsterSpec = {
  key: 'monster_dungeon_fiend',
  // Wider than the old 56 for the long-armed rake; width doesn't move the sprite.
  frameW: 80,
  frameH: 68,
  scale: 1.34,
  skin: SKIN,
  ready: READY,
  attack: 'claw',
  deathDir: 1,
  walk: { stride: 6.5, lift: 3.8, bob: 1.6, lean: 0.08, armSwing: 5, spread: 1.5 },
  shadowR: 15,
};

const GEN = humanoidTracks(SPEC);
const RECOIL = GEN.hurt[0].pose;
const D = (o: Partial<HumanPose>): HumanPose => ({ ...READY, ...o });

/** Staggers, drops to its knuckles and slumps prone, tail last to fall. */
const TRACKS = {
  ...GEN,
  death: [
    { at: 0, pose: RECOIL },
    { at: 0.33, pose: D({ root: vec(CENTER_X - 8, 76), lean: 0.55, head: -0.3, footN: vec(CENTER_X, 91), footF: vec(CENTER_X - 12, 91), handN: vec(CENTER_X + 8, 86), handF: vec(CENTER_X + 3, 87), flow: 0.4 }) },
    { at: 0.67, ease: 'in' as const, pose: D({ root: vec(CENTER_X - 6, 81), lean: 1.2, head: -0.4, footN: vec(CENTER_X - 1, 91), footF: vec(CENTER_X - 13, 91), handN: vec(CENTER_X + 15, 90), handF: vec(CENTER_X + 11, 90.5), flow: 0.3 }) },
    { at: 1, ease: 'out' as const, pose: D({ root: vec(CENTER_X - 8, 82), lean: 1.5, head: -0.1, footN: vec(CENTER_X - 26, 91), footF: vec(CENTER_X - 22, 91), handN: vec(CENTER_X + 16, 91), handF: vec(CENTER_X + 6, 91), flow: 0 }) },
  ],
};

const TRACKS_REF = TRACKS;

export const DungeonFiendDrawer = humanoidMonster({
  ...SPEC,
  tracks: TRACKS,
  view: {
    build: { hipW: 3, shW: 6.4, elbowOut: 1.6, footOut: 0.7 },
    headBias: 3,
    torso: fiendTorsoView,
    head: fiendHeadView,
  },
  viewFx: fiendViewFx,
  fx: (ctx, p, sk, act, t) => {
    if (act === 'death' && t > 0.8) return;
    const live = act === 'death' ? 1 - t : 1;
    const S = (pt: V): V => spun(p, pt, sk);
    // Burning eyes and glowing cracks
    glow(ctx, S(headPt(sk, vec(4.8, -1))), 3 + p.fx * 1.5, EYE, (0.5 + p.fx * 0.3) * live);
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
    for (const l of [vec(-1.6, 4.6), vec(-2.4, 8.6), vec(-3.4, 11.8)]) {
      glow(ctx, S(torsoPt(sk, l)), 2.6 + pulse, MAGMA_GLOW, (0.35 + pulse * 0.15 + p.fx * 0.2) * live);
    }
    glow(ctx, S(lerpV(sk.elN, sk.handN, 0.5)), 2.4, MAGMA_GLOW, 0.3 * live);
    if (act === 'attack' && t > 0.8) {
      // Twin rake smears from the near talons
      const tips: V[] = [];
      const bases: V[] = [];
      for (let i = 6; i >= 0; i--) {
        const sp = samplePoseTrack(TRACKS.attack, Math.max(0.34, t - i * 0.05));
        const ssk = solveSkeleton(sp, SKIN.prop);
        const tl = talons(ssk.handN, ssk.elN, sp.fx)[1];
        tips.push(spun(sp, tl.tip, ssk));
        bases.push(spun(sp, lerpV(ssk.handN, tl.tip, 0.25), ssk));
      }
      smear(ctx, tips, bases, 0xff7a3a, 0.6 * p.fx);
    }
  },
});
