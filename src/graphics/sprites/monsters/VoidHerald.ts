// src/graphics/sprites/monsters/VoidHerald.ts
//
// 虚空先驱 — an otherworldly herald of the void. A towering, legless
// figure in indigo vestments that floats above the ground; under a tall
// pointed hood there is no face, only a swirling starfield portal. A
// broken rune-halo turns slowly behind its head, it carries a crescent
// staff cradling a void orb, and tentacles of living darkness trail from
// beneath the ragged hem. It raises the staff, the portal flares, and the
// largest tentacle lashes out to full reach. On death it folds in on
// itself and is swallowed by a collapsing rift.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  along,
  blobPath,
  capsulePath,
  cel,
  ellipsePath,
  glow,
  inBone,
  limb,
  polyPath,
  samplePoseTrack,
  tone,
  vec,
  type Key,
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
  band,
  clipTo,
  decal,
  groundX,
  hull3,
  loftFill,
  lp,
  monsterViewSkin,
  profileRings,
  surf,
  surfPatch,
  surfVis,
  turnedHead,
  withAffine,
} from '../rig/MonsterView';
import { curlChain, embers, erode, hash01, localPt, taperPath } from './Imp';

// ── Palette ─────────────────────────────────────────────────────────────
const ROBE = tone(0x3a2c6e, { light: 0.4 });
const ROBE_FAR = tone(0x221a48, { light: 0.22 });
const MANTLE = tone(0xb2a6d6, { light: 0.45 });
const ROBE_IN = tone(0x120c24, { light: 0.12 });
const TRIM = tone(0x8a6ae0, { light: 0.45 });
const SILVER = tone(0xb8b4d8, { light: 0.5 });
const FLESH = tone(0x9c94b8, { light: 0.35 });
const FLESH_FAR = tone(0x686080, { light: 0.2 });
const TENTACLE = tone(0x5a3494, { light: 0.4 });
const TENTACLE_FAR = tone(0x382060, { light: 0.25 });
const STAFF = tone(0x2a2036, { light: 0.4 });
const VOID = 0x9a5aff;
const VOID_CYAN = 0x5ae0ff;
const VOID_CORE = 0xe8d8ff;

interface HeraldPose extends HumanPose {
  /** Main tentacle coiled back for the lash 0..1. */
  wind: number;
  /** Main tentacle lashed out 0..1. */
  lash: number;
  /** Portal-face intensity. */
  portal: number;
  /** Death: fold into the rift 0..1. */
  fade: number;
}

const PROP = {
  thigh: 10, shin: 10, upperArm: 9.6, foreArm: 9.2,
  torso: 17, neck: 6.6, ankle: 2,
  hipN: vec(2, 0), hipF: vec(-2, -0.4),
  shN: vec(1.6, 3.8), shF: vec(-4.6, 3.2),
};

const HEM = 21;

// ── Parts ───────────────────────────────────────────────────────────────

function hemCentre(sk: Skeleton, p: HeraldPose): V {
  return localPt(sk.pelvis, p.lean * 0.3, 0.5, HEM);
}

interface TentSpec { ang: number; curve: number; len: number; r: number; x: number; ph: number }
const TENTS: TentSpec[] = [
  { ang: 2.4, curve: -1.6, len: 22, r: 2.6, x: 3.5, ph: 0 },
  { ang: 3.0, curve: 1.5, len: 18, r: 2.2, x: -1.5, ph: 2.1 },
  { ang: 3.6, curve: 2, len: 20, r: 2.1, x: -6, ph: 4.2 },
];

function tentaclePts(sk: Skeleton, p: HeraldPose, t: number, i: number): V[] {
  const spec = TENTS[i];
  const base = localPt(hemCentre(sk, p), p.lean * 0.3, spec.x, -2.4);
  let ang = spec.ang + p.lean * 0.4;
  let curve = spec.curve;
  let len = spec.len;
  let wave = 1.4;
  if (i === 0) {
    // Coil up and back behind the body, then whip straight out.
    ang += (-3.3 - ang) * p.wind;
    curve += (-2.6 - curve) * p.wind;
    len += (19 - len) * p.wind;
    ang += (1.62 - ang) * p.lash;
    curve += (0.12 - curve) * p.lash;
    len += (42 - len) * p.lash;
    wave *= 1 - Math.max(p.wind, p.lash) * 0.85;
  } else {
    // Other tentacles recoil and splay during the attack
    curve += p.lash * (i === 1 ? 1 : 1.2);
  }
  const pts = curlChain(base, ang, curve, len, 10, wave, t * Math.PI * 2 + spec.ph);
  return pts.map(pt => vec(pt.x, Math.min(pt.y, GROUND_Y - 1)));
}

function tentacle(ctx: CanvasRenderingContext2D, pts: readonly V[], r: number, far: boolean): void {
  cel(ctx, () => taperPath(ctx, pts, r, 0.28), far ? TENTACLE_FAR : TENTACLE, { band: r * 0.5 });
  // Glowing suckers along the underside
  ctx.fillStyle = far ? 'rgba(150,110,230,0.55)' : 'rgba(190,150,255,0.85)';
  for (let i = 2; i < pts.length - 1; i += 2) {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const k = 1 - i / pts.length;
    const nx = -(b.y - a.y) / d;
    const ny = (b.x - a.x) / d;
    ctx.beginPath();
    ctx.arc(pts[i].x + nx * r * k * 0.6, pts[i].y + ny * r * k * 0.6, 0.35 + k * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function halo(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HeraldPose, t: number): void {
  const c = localPt(sk.head, sk.headAng, -5.2, -4.4);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(sk.headAng * 0.5 - 0.18);
  const rx = 9;
  const ry = 12.5;
  // Three arcs with gaps; one full turn of the pattern per third of a
  // rotation keeps the idle loop seamless.
  const rot = t * ((Math.PI * 2) / 3);
  const flick = 1 - p.fade;
  for (let i = 0; i < 3; i++) {
    const a0 = rot + (i * Math.PI * 2) / 3 + 0.28;
    const a1 = a0 + (Math.PI * 2) / 3 - 0.56;
    const arc = (): void => {
      const n = 12;
      const outer: V[] = [];
      const inner: V[] = [];
      for (let j = 0; j <= n; j++) {
        const a = a0 + ((a1 - a0) * j) / n;
        outer.push(vec(Math.cos(a) * (rx + 1.1), Math.sin(a) * (ry + 1.1)));
        inner.push(vec(Math.cos(a) * (rx - 1.1), Math.sin(a) * (ry - 1.1)));
      }
      polyPath(ctx, [...outer, ...inner.reverse()]);
    };
    cel(ctx, arc, SILVER, { band: 0.5 });
    // Rune ticks
    ctx.strokeStyle = `rgba(120,70,220,${0.9 * flick})`;
    ctx.lineWidth = 0.45;
    for (let j = 1; j < 4; j++) {
      const a = a0 + ((a1 - a0) * j) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (rx - 0.6), Math.sin(a) * (ry - 0.6));
      ctx.lineTo(Math.cos(a) * (rx + 0.6), Math.sin(a) * (ry + 0.6));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function robe(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HeraldPose, t: number): void {
  const ph = t * Math.PI * 2;
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    const sw = -p.flow * 5;
    const hemY = len + HEM;
    // Ragged hem: wisps that drift and curl back
    const hem: V[] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = 11 - k * 23 + sw * (0.4 + k * 0.6);
      const drop = i % 2 ? 0 : 3.4 + Math.sin(ph + i * 1.7) * 1.2 + k * 1.6;
      hem.push(vec(x + Math.sin(ph + i) * 0.6, hemY + drop - k * 1.4));
    }
    const body = [vec(-6.4, -0.6), vec(1.6, -1.8), vec(7.4, 1), vec(8.6, len * 0.6), vec(10, len + 6), ...hem, vec(-11.6 + sw, len + 8), vec(-8, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), ROBE, { band: 2, hi: 0.8 });
    // Inner shadow fold and the embroidered front panel
    cel(ctx, () => polyPath(ctx, [vec(2.4, len * 0.55), vec(7, len * 0.6), vec(9.6 + sw * 0.4, hemY + 1), vec(4.4 + sw * 0.5, hemY + 2.6)]), ROBE_IN, { band: 0.6, stroke: 0.3 });
    cel(ctx, () => polyPath(ctx, [vec(3, 1.4), vec(6.2, 1.6), vec(6.6, len + 2), vec(5.6 + sw * 0.5, hemY - 0.4), vec(2.6 + sw * 0.5, hemY), vec(2.6, len + 2)]), ROBE_IN, { band: 0.6 });
    // Glowing glyphs down the panel
    ctx.strokeStyle = `rgba(170,120,255,${0.6 + p.portal * 0.4})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = 4 + i * 5.4;
      const x = 4.4 + (y / hemY) * sw * 0.5;
      ctx.beginPath();
      if (i % 2) {
        ctx.moveTo(x - 1, y - 1);
        ctx.lineTo(x + 1, y + 1);
        ctx.moveTo(x + 1, y - 1);
        ctx.lineTo(x - 1, y + 1);
      } else {
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.moveTo(x, y - 2);
        ctx.lineTo(x, y + 2);
      }
      ctx.stroke();
    }
    // Trim along the panel edges
    ctx.strokeStyle = TRIM.base;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(3, 1.4);
    ctx.lineTo(2.6, hemY);
    ctx.moveTo(6.2, 1.6);
    ctx.lineTo(5.6 + sw * 0.5, hemY - 0.4);
    ctx.stroke();
    // Sash with a void gem
    cel(ctx, () => polyPath(ctx, [vec(-7.6, len - 2), vec(9.2, len - 2.4), vec(9.4, len), vec(-7.8, len + 0.6)]), ROBE_IN, { band: 0.4 });
    cel(ctx, () => ellipsePath(ctx, vec(4.6, len - 1.2), 1.6, 1.8), tone(0x7a4ad8, { light: 0.6 }), { band: 0.4, stroke: 0.4 });
    // Layered mantle over the shoulders
    cel(ctx, () => blobPath(ctx, [vec(-8.6, 1), vec(-5, -3.4), vec(2, -3.6), vec(8.4, -0.6), vec(9.4, 4.6), vec(4, 7.4), vec(-3, 7), vec(-9, 5.6)]), MANTLE, { band: 1.2 });
    ctx.strokeStyle = TRIM.base;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-8.4, 5.4);
    ctx.quadraticCurveTo(0, 8.4, 9.2, 4.4);
    ctx.stroke();
  });
}

function hood(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HeraldPose, t: number): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Tall hood with a peak that droops back
  const shell = [vec(-6.6, 5), vec(-7.4, -2), vec(-5.6, -8), vec(-2, -12.6), vec(-7, -17), vec(1.6, -12.4), vec(6, -6.4), vec(7.8, 0), vec(7, 6.4), vec(2, 7.4)];
  cel(ctx, () => blobPath(ctx, shell), ROBE, { band: 1.6 });
  ctx.strokeStyle = TRIM.base;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(2.6, -8.4);
  ctx.quadraticCurveTo(8.2, -3, 7.2, 6);
  ctx.stroke();
  // The void portal where a face should be
  const c = vec(3.2, -0.6);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 4, 5.6, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#05020c';
  ctx.fill();
  ctx.clip();
  const ph = t * Math.PI * 2;
  const glowK = 0.55 + p.portal * 0.45;
  for (let i = 0; i < 4; i++) {
    const r = 1 + i * 1.3;
    ctx.strokeStyle = i % 2 ? `rgba(90,224,255,${0.5 * glowK})` : `rgba(160,100,255,${0.8 * glowK})`;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    const a0 = ph * (i % 2 ? -1 : 1) + i * 1.3;
    ctx.ellipse(c.x, c.y, r * 0.85, r * 1.15, 0.1, a0, a0 + Math.PI * 1.3);
    ctx.stroke();
  }
  // Stars drifting inward
  for (let i = 0; i < 8; i++) {
    const k = (hash01(i * 4.1) + t) % 1;
    const a = hash01(i * 9.3) * Math.PI * 2 + ph * 0.25;
    const r = 5 * (1 - k);
    ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
    ctx.fillRect(c.x + Math.cos(a) * r * 0.8 - 0.25, c.y + Math.sin(a) * r - 0.25, 0.5, 0.5);
  }
  ctx.fillStyle = `rgba(240,225,255,${glowK})`;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 0.9 + p.portal * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Hood rim over the portal edge
  ctx.strokeStyle = ROBE_IN.base;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 4.2, 5.8, 0.1, -Math.PI * 0.75, Math.PI * 0.55);
  ctx.stroke();
  ctx.restore();
}

function sleeveArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const cloth = far ? ROBE_FAR : ROBE;
  limb(ctx, sh, el, 3.2, 2.8, cloth);
  // Bell sleeve flaring toward the wrist
  const a = Math.atan2(hand.y - el.y, hand.x - el.x);
  const L = Math.hypot(hand.x - el.x, hand.y - el.y);
  const P = (x: number, y: number): V => localPt(el, a, x, y);
  cel(ctx, () => polyPath(ctx, [P(-1.4, -2.8), P(L * 0.8, -4.4), P(L * 0.72, 4.8), P(L * 0.45, 3.6), P(-1.2, 2.8)]), cloth, { band: 0.8 });
  ctx.strokeStyle = far ? TRIM.shade : TRIM.base;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(P(L * 0.8, -4.4).x, P(L * 0.8, -4.4).y);
  ctx.lineTo(P(L * 0.72, 4.8).x, P(L * 0.72, 4.8).y);
  ctx.stroke();
}

function boneHand(ctx: CanvasRenderingContext2D, el: V, hand: V, far: boolean): void {
  const a = Math.atan2(hand.y - el.y, hand.x - el.x);
  const t = far ? FLESH_FAR : FLESH;
  cel(ctx, () => ellipsePath(ctx, hand, 1.7, 1.4, a), t, { band: 0.4 });
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 0.55;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const p1 = localPt(hand, a + i * 0.35, 1.2, 0);
    const p2 = localPt(hand, a + i * 0.35 + 0.5, 3.8, 0);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}

function staff(ctx: CanvasRenderingContext2D, hand: V, angle: number): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  cel(ctx, () => capsulePath(ctx, vec(0, 13), vec(0, -20), 0.95, 0.85), STAFF, { band: 0.4 });
  for (const y of [-6, 4, 10]) {
    cel(ctx, () => polyPath(ctx, [vec(-1.3, y - 0.6), vec(1.3, y - 0.6), vec(1.3, y + 0.6), vec(-1.3, y + 0.6)]), SILVER, { band: 0.2, stroke: 0.3 });
  }
  // Crescent head cradling the orb
  const cres = (): void => {
    ctx.moveTo(-1, -19);
    ctx.quadraticCurveTo(-7.4, -24, -3.2, -31);
    ctx.quadraticCurveTo(-5, -25, -0.4, -21.4);
    ctx.quadraticCurveTo(4.8, -25, 3.4, -31.4);
    ctx.quadraticCurveTo(7.8, -24.4, 1, -19);
    ctx.closePath();
  };
  cel(ctx, cres, SILVER, { band: 0.6 });
  cel(ctx, () => ellipsePath(ctx, vec(0, -26.4), 2.8, 2.8), tone(0x6a3ad0, { light: 0.55 }), { band: 0.8, stroke: 0.4 });
  ctx.fillStyle = 'rgba(240,230,255,0.9)';
  ctx.beginPath();
  ctx.arc(-0.8, -27.4, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Skin ────────────────────────────────────────────────────────────────

const HERALD_SKIN: HumanSkin = {
  prop: PROP,
  back(ctx, sk, p: HeraldPose, t) {
    halo(ctx, sk, p, t);
    tentacle(ctx, tentaclePts(sk, p, t, 2), TENTS[2].r, true);
    tentacle(ctx, tentaclePts(sk, p, t, 1), TENTS[1].r, true);
  },
  armFar(ctx, sk) {
    sleeveArm(ctx, sk.shF, sk.elF, sk.handF, true);
    boneHand(ctx, sk.elF, sk.handF, true);
  },
  legFar() {
    // Legless — the robe floats.
  },
  legNear(ctx, sk, p: HeraldPose, t) {
    // Main tentacle sits between the far limbs and the robe.
    tentacle(ctx, tentaclePts(sk, p, t, 0), TENTS[0].r, false);
  },
  torso(ctx, sk, p: HeraldPose, t) {
    robe(ctx, sk, p, t);
  },
  head(ctx, sk, p: HeraldPose, t) {
    hood(ctx, sk, p, t);
  },
  armNear(ctx, sk) {
    sleeveArm(ctx, sk.shN, sk.elN, sk.handN, false);
  },
  weapon(ctx, sk, p) {
    staff(ctx, sk.handN, p.wpn);
    boneHand(ctx, sk.elN, sk.handN, false);
  },
};

// ── Isometric 3/4 views ─────────────────────────────────────────────────

const HERALD_BUILD = { hipW: 2.4, shW: 6.4, elbowOut: 1.4, footOut: 0.3 };
const HOOD_RINGS = profileRings([vec(-6.6, 5), vec(-7.4, -2), vec(-5.6, -8), vec(-1.6, -12.4), vec(1.6, -12.4), vec(6, -6.4), vec(7.4, 0), vec(7, 6.4), vec(2, 7.4)], y => -y, a => a * 0.9, 8);
const PORTAL = { h: 1.2, phi: 0 };

function robeRings(len: number, p: HumanPose): { h: number; a: number; b: number; f: number }[] {
  const sw = -p.flow * 5;
  return [
    { h: len + 0.6, a: 4.6, b: 5.4, f: 0.6 },
    { h: len - 4, a: 7.4, b: 7.8, f: 0.8 },
    { h: len * 0.4, a: 8.2, b: 8.4, f: 0.4 },
    { h: 0, a: 9, b: 9.2, f: sw * 0.3 },
    { h: -HEM + 2, a: 10.6, b: 10.4, f: sw * 0.8 },
  ];
}

function heraldTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const hp = p as HeraldPose;
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = robeRings(len, p);
  const ph = t * Math.PI * 2;
  const pieces = loftFill(ctx, T, R, ROBE, { band: 2, hi: 0.8 });
  // Ragged hem wisps
  const bottom = R[R.length - 1];
  for (let k = 0; k < 12; k++) {
    const phi = (k / 12) * Math.PI * 2 + 0.1;
    if (T.vis(phi) < 0.02) continue;
    const l = 2.4 + (k % 2) * 1.6 + Math.sin(ph + k * 1.7) * 1;
    const a = T.at(bottom.h + 0.3, phi - 0.24, bottom.a, bottom.b, bottom.f);
    const b = T.at(bottom.h + 0.3, phi + 0.24, bottom.a, bottom.b, bottom.f);
    const c = T.at(bottom.h - l, phi, bottom.a + 0.4, bottom.b + 0.4, bottom.f - p.flow * 2);
    cel(ctx, () => polyPath(ctx, [a, b, c]), ROBE, { band: 0.6, stroke: 0.45 });
  }
  clipTo(ctx, pieces, () => {
    if (T.vis(0) < -0.3) return;
    // Embroidered front panel with glowing glyphs
    const panel = surfPatch(T, R, len + 0.2, -HEM + 1, -0.22, 0.22, 0.1, 4);
    cel(ctx, () => polyPath(ctx, panel), ROBE_IN, { band: 0.6 });
    for (const phi of [-0.22, 0.22]) {
      const a = surf(T, R, len, phi, 0.15);
      const b = surf(T, R, -HEM + 1.4, phi, 0.15);
      ctx.strokeStyle = TRIM.base;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      decal(ctx, T, R, len - 4 - i * 5.4, 0, () => {
        ctx.strokeStyle = `rgba(170,120,255,${0.6 + hp.portal * 0.4})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        if (i % 2) {
          ctx.moveTo(-1, -1);
          ctx.lineTo(1, 1);
          ctx.moveTo(1, -1);
          ctx.lineTo(-1, 1);
        } else {
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.moveTo(0, -2);
          ctx.lineTo(0, 2);
        }
        ctx.stroke();
      }, { lift: 0.2, minVis: 0.05 });
    }
  });
  band(ctx, T, R, 1.2, ROBE_IN, 2, 0.3);
  decal(ctx, T, R, 1.2, 0.5, () => cel(ctx, () => ellipsePath(ctx, vec(0, 0), 1.6, 1.8), tone(0x7a4ad8, { light: 0.6 }), { band: 0.4, stroke: 0.4 }), { lift: 0.8, minVis: 0.05 });
  // Layered mantle over the shoulders
  const mantle = [{ h: len + 1.6, a: 4.4, b: 5.2, f: 0.6 }, { h: len - 1.2, a: 7.6, b: 8.6, f: 0.8 }, { h: len - 5.6, a: 8, b: 9, f: 0.9 }];
  loftFill(ctx, T, mantle, MANTLE, { band: 1.2 });
  band(ctx, T, mantle, len - 5, TRIM, 0.6, 0.1);
}

function heraldHead(sk: ViewSkeleton) {
  return turnedHead(sk, 0.3);
}

function heraldHoodView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const hp = p as HeraldPose;
  const H = heraldHead(sk);
  const R = HOOD_RINGS;
  const peak = [[11, -2.6, -1.8], [11, -2.6, 1.8], [16.4, -8.4, 0], [12.2, -5, 0], [9.6, 0, -2.2], [9.6, 0, 2.2]] as const;
  const peakBehind = H.rig.d(lp(H, 14, -7, 0)) < H.rig.d(H.o);
  if (peakBehind) hull3(ctx, H, peak, ROBE, { band: 1 });
  const pieces = loftFill(ctx, H, R, ROBE, { band: 1.6 });
  if (!peakBehind) hull3(ctx, H, peak, ROBE, { band: 1 });
  if (H.vis(0) < -0.2) return;
  clipTo(ctx, pieces, () => {
    decal(ctx, H, R, PORTAL.h, PORTAL.phi, () => {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 5.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#05020c';
      ctx.fill();
      ctx.clip();
      const ph = t * Math.PI * 2;
      const glowK = 0.55 + hp.portal * 0.45;
      for (let i = 0; i < 4; i++) {
        const r = 1 + i * 1.3;
        ctx.strokeStyle = i % 2 ? `rgba(90,224,255,${0.5 * glowK})` : `rgba(160,100,255,${0.8 * glowK})`;
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        const a0 = ph * (i % 2 ? -1 : 1) + i * 1.3;
        ctx.ellipse(0, 0, r * 0.85, r * 1.15, 0, a0, a0 + Math.PI * 1.3);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const k = (hash01(i * 4.1) + t) % 1;
        const a = hash01(i * 9.3) * Math.PI * 2 + ph * 0.25;
        const r = 5 * (1 - k);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
        ctx.fillRect(Math.cos(a) * r * 0.8 - 0.25, Math.sin(a) * r - 0.25, 0.5, 0.5);
      }
      ctx.fillStyle = `rgba(240,225,255,${glowK})`;
      ctx.beginPath();
      ctx.arc(0, 0, 0.9 + hp.portal * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = ROBE_IN.base;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 5.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }, { lift: 0.1, minVis: 0.02 });
  });
}

/** The broken rune-halo turns in a plane behind the head, facing forward. */
function haloCentre(sk: ViewSkeleton): { x: number; y: number; z: number } {
  return lp(sk.skull, 4.4, -6.4, 0);
}

function heraldBack(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const hp = p as HeraldPose;
  tentacle(ctx, tentaclePts(sk, hp, t, 2), TENTS[2].r, true);
  tentacle(ctx, tentaclePts(sk, hp, t, 1), TENTS[1].r, true);
}

function heraldExtra(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number, d0: number): ViewPart[] {
  const hp = p as HeraldPose;
  const c = haloCentre(sk);
  return [{
    z: sk.rig.d(c) - d0 + (sk.rig.front ? -2 : 6),
    draw: () => {
      // Local halo art: x → lateral, y → down, around the centre point.
      withAffine(ctx, q => sk.rig.pt(c.x, c.y + q.y, c.z + q.x), () => {
        ctx.save();
        // A stand-in skeleton that puts the halo centre at the origin, unrotated.
        const ha = 0.36;
        const off = localPt(vec(0, 0), ha, -5.2, -4.4);
        const fake = { head: vec(-off.x, -off.y), headAng: ha } as unknown as Skeleton;
        halo(ctx, fake, hp, t);
        ctx.restore();
      });
    },
  }];
}

const HERALD_VIEW = monsterViewSkin(HERALD_SKIN, {
  build: HERALD_BUILD,
  headBias: 5,
  torso: heraldTorsoView,
  head: heraldHoodView,
  back: heraldBack,
  extra: heraldExtra,
});

function heraldFxView(ctx: CanvasRenderingContext2D, p: HeraldPose, act: MonsterAction, t: number, view: HumanView): void {
  const vsk = solveViewSkeleton(p, PROP, HERALD_BUILD, view);
  const H = heraldHead(vsk);
  const face = surfVis(H, HOOD_RINGS, PORTAL.h, PORTAL.phi) > 0 ? surf(H, HOOD_RINGS, PORTAL.h, PORTAL.phi, 0.3) : vsk.head;
  const { ang, k } = vsk.rig.dir(p.wpn);
  const orb = vec(vsk.handN.x + Math.sin(ang) * k * 26.4, vsk.handN.y - Math.cos(ang) * k * 26.4);
  const hc = vsk.rig.p(haloCentre(vsk));
  const facing = H.vis(0) > 0;
  heraldFx(ctx, facing ? p : { ...p, portal: 0 }, act, t, vsk, face, orb, hc, q => q, q => {
    const s2 = solveViewSkeleton(q, PROP, HERALD_BUILD, view);
    return tentaclePts(s2, q, t, 0);
  });
}

// ── Animation ───────────────────────────────────────────────────────────

const READY: HeraldPose = {
  ...basePose({
    root: vec(CENTER_X - 3, 60),
    lean: 0.06,
    head: 0.02,
    footN: vec(CENTER_X, 80),
    footF: vec(CENTER_X - 4, 80),
    handN: vec(CENTER_X + 8, 61),
    handF: vec(CENTER_X - 1, 64),
    wpn: 0.1,
    flow: 0.15,
  }),
  wind: 0,
  lash: 0,
  portal: 0.4,
  fade: 0,
};

const P = (o: Partial<HeraldPose>): HeraldPose => ({ ...READY, ...o });
const R = READY.root;

const ATTACK: Key<HeraldPose>[] = [
  { at: 0, pose: READY },
  // Staff raised, portal flaring, the great tentacle coiling back
  { at: 0.33, ease: 'out', pose: P({
    root: vec(R.x - 2, R.y - 2.5), lean: -0.16, head: -0.2,
    handN: vec(R.x + 7, 47.5), wpn: -0.15, handF: vec(R.x - 6, 52),
    wind: 1, portal: 1, fx: 0.6, flow: 0.35, stretch: 0.04,
  }) },
  { at: 0.67, ease: 'in', pose: P({
    root: vec(R.x + 1, R.y - 1.5), lean: 0.12, head: 0.02,
    handN: vec(R.x + 15, 48), wpn: 0.7, handF: vec(R.x - 3, 58),
    wind: 0.45, lash: 0.35, portal: 1, fx: 0.85, flow: 0.5,
  }) },
  // Lash: staff levelled, tentacle at full reach
  { at: 1, ease: 'linear', pose: P({
    root: vec(R.x + 3, R.y), lean: 0.26, head: 0.12,
    handN: vec(R.x + 19, 58), wpn: 1.2, handF: vec(R.x - 5, 61),
    wind: 0, lash: 1, portal: 1, fx: 1, flow: 0.7, stretch: -0.02,
  }) },
];

const RECOIL = P({
  root: vec(R.x - 4, R.y - 1.5), lean: -0.3, head: -0.3,
  handN: vec(R.x + 4, 56), wpn: -0.3, handF: vec(R.x - 7, 57),
  portal: 0.1, flow: 0.6, stretch: -0.03,
});

const HURT: Key<HeraldPose>[] = [
  { at: 0, pose: RECOIL },
  { at: 1, pose: P({ ...RECOIL, root: vec(R.x - 2, R.y - 0.5), lean: -0.1, head: -0.1, handN: vec(R.x + 7, 60), wpn: 0, portal: 0.3, flow: 0.3 }) },
];

const DEATH: Key<HeraldPose>[] = [
  { at: 0, pose: RECOIL },
  // Convulses upward, the portal tearing open
  { at: 0.33, pose: P({
    root: vec(R.x - 2, R.y - 4), lean: -0.2, head: -0.5,
    handN: vec(R.x + 10, 45), wpn: 0.7, handF: vec(R.x - 10, 42),
    portal: 1, fade: 0.1, flow: 0.8, stretch: 0.05,
  }) },
  // Folds in on itself and sinks
  { at: 0.67, ease: 'in', pose: P({
    root: vec(R.x - 1, R.y + 8), lean: 0.35, head: 0.5,
    handN: vec(R.x + 5, 66), wpn: 1.8, handF: vec(R.x - 1, 68),
    portal: 0.8, fade: 0.5, flow: 0.3, stretch: -0.08,
  }) },
  { at: 1, ease: 'out', pose: P({
    root: vec(R.x, R.y + 16), lean: 0.6, head: 0.6,
    handN: vec(R.x + 6, 76), wpn: 2.6, handF: vec(R.x, 73),
    portal: 0.4, fade: 1, flow: 0.1, stretch: -0.12,
  }) },
];

function heraldPose(act: MonsterAction, t: number): HeraldPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle': {
      const b = Math.sin(ph);
      return P({
        root: vec(R.x, R.y - b * 1.5),
        head: READY.head + Math.sin(ph - 0.7) * 0.05,
        handN: vec(READY.handN.x, READY.handN.y - b * 1.3),
        handF: vec(READY.handF.x + Math.sin(ph + 0.4) * 0.6, READY.handF.y - Math.sin(ph - 0.5) * 1.4),
        portal: 0.4 + Math.sin(ph) * 0.15,
        flow: 0.15 + b * 0.08,
      });
    }
    case 'walk': {
      const b = Math.sin(ph);
      return P({
        root: vec(R.x + 1, R.y - 1 - b * 1.2),
        lean: 0.2,
        head: -0.06,
        handN: vec(READY.handN.x + 1, READY.handN.y - b),
        wpn: 0.28,
        handF: vec(READY.handF.x - 2, READY.handF.y + 1),
        portal: 0.45,
        flow: 0.55 + Math.sin(ph * 2) * 0.1,
      });
    }
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

function portalPoint(p: HeraldPose, sk: Skeleton): V {
  return spun(p, localPt(sk.head, sk.headAng, 3.2, -0.6), sk);
}

export const VoidHeraldDrawer = rigMonster<HeraldPose>({
  key: 'monster_void_herald',
  // Wide for the tentacle lash; width doesn't move the sprite in-game.
  frameW: 96,
  frameH: 68,
  scale: 1.15,
  pose: heraldPose,
  draw: (ctx, p, _act, t, view) => {
    if (view) {
      const vsk0 = solveViewSkeleton(p, PROP, HERALD_BUILD, view);
      if (p.fade > 0) {
        const c = vsk0.head;
        const k = 1 - p.fade * 0.55;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(k * (1 - p.fade * 0.2), k);
        ctx.translate(-c.x, -c.y);
        drawHumanoidView(ctx, p, HERALD_VIEW, t, view);
        ctx.restore();
        erode(ctx, p.fade * 0.85, { x: c.x - 30, y: c.y - 26, w: 56, h: 60 }, 57, 0.8, '30,10,60');
        return;
      }
      drawHumanoidView(ctx, p, HERALD_VIEW, t, view);
      return;
    }
    if (p.fade > 0) {
      // Fold toward the portal: squeeze the figure about its face.
      const sk0 = solveSkeleton(p, PROP);
      const c = portalPoint(p, sk0);
      const k = 1 - p.fade * 0.55;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(k * (1 - p.fade * 0.2), k);
      ctx.translate(-c.x, -c.y);
      const sk = drawHumanoid(ctx, p, HERALD_SKIN, t);
      ctx.restore();
      const cc = portalPoint(p, sk);
      erode(ctx, p.fade * 0.85, { x: cc.x - 30, y: cc.y - 26, w: 56, h: 60 }, 57, 0.8, '30,10,60');
      return;
    }
    drawHumanoid(ctx, p, HERALD_SKIN, t);
  },
  shadow: (p, _act, _t, view) => ({ x: groundX(view, p.root.x + 1), r: 14 * (1 - p.fade * 0.6), lift: Math.max(4, 12 - (p.root.y - 60) * 0.6) }),
  views: MONSTER_VIEWS,
  fx: (ctx, p, act, t, view) => {
    if (view) {
      heraldFxView(ctx, p, act, t, view);
      return;
    }
    const sk = solveSkeleton(p, PROP);
    heraldFx(ctx, p, act, t, sk, portalPoint(p, sk), spun(p, along(sk.handN, p.wpn, 26.4), sk), spun(p, localPt(sk.head, sk.headAng, -5.2, -4.4), sk), q => spun(p, q, sk));
  },
  ink: '#0c0618',
  rim: 'rgba(190,160,255,0.55)',
});

function heraldFx(
  ctx: CanvasRenderingContext2D, p: HeraldPose, act: MonsterAction, t: number, sk: Skeleton,
  face: V, orb: V, hc: V, S: (q: V) => V, ghostOf: (q: HeraldPose) => V[] = q => {
    const psk = solveSkeleton(q, PROP);
    return tentaclePts(psk, q, t, 0).map(pt => spun(q, pt, psk));
  },
): void {
    const live = 1 - p.fade;
  // Portal and orb glow
  glow(ctx, face, 6 + p.portal * 5, VOID, (0.3 + p.portal * 0.35) * (0.4 + live * 0.6));
  glow(ctx, face, 2.2, VOID_CORE, 0.5 + p.portal * 0.4);
  if (live > 0.3) {
    glow(ctx, orb, 5 + p.fx * 4, VOID, 0.45 * live);
    glow(ctx, orb, 2, VOID_CYAN, 0.6 * live);
  }
  // Void mist pooling beneath the floating hem
  const hem = S(hemCentre(sk, p));
  glow(ctx, vec(hem.x - 1, hem.y + 2), 12, VOID, 0.22 * live);
  for (let i = 0; i < 5; i++) {
    const k = (hash01(i * 2.7) + t) % 1;
    glow(ctx, vec(hem.x - 9 + i * 4.5 + Math.sin(t * 6 + i) * 1.5, hem.y + 4 - k * 8), 1.5, i % 2 ? VOID_CYAN : VOID, 0.5 * (1 - k) * live);
  }
  // Halo shimmer
  glow(ctx, hc, 15, VOID_CYAN, 0.1 * live + p.portal * 0.06);
  glow(ctx, hc, 11, VOID, 0.16 * live + p.portal * 0.1);
  // Tentacle tips
  for (let i = 0; i < 3; i++) {
    const pts = tentaclePts(sk, p, t, i);
    const tip = S(pts[pts.length - 1]);
    glow(ctx, tip, i === 0 ? 2.6 + p.lash * 3 : 1.8, VOID, 0.55 * live);
  }
  if (act === 'attack') {
    // Void motes spiralling into the staff during the wind-up
    for (let i = 0; i < 6; i++) {
      const k = (i / 6 + t * 1.5) % 1;
      const a = i * 1.05 + t * 9;
      const r = 9 * (1 - k);
      glow(ctx, vec(orb.x + Math.cos(a) * r, orb.y + Math.sin(a) * r), 1.3, i % 2 ? VOID_CYAN : VOID, p.fx * k);
    }
    if (t > 0.5) {
      const main = tentaclePts(sk, p, t, 0).map(S);
      const prev = samplePoseTrack(ATTACK, t - 0.07);
      const ghost = ghostOf(prev);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(160,110,255,${0.3 * p.fx})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ghost[0].x, ghost[0].y);
      for (let i = 1; i < ghost.length; i++) ctx.lineTo(ghost[i].x, ghost[i].y);
      ctx.stroke();
      ctx.restore();
      if (t > 0.9) {
        const tip = main[main.length - 1];
        glow(ctx, tip, 10, VOID, 0.7);
        glow(ctx, tip, 4, VOID_CORE, 0.9);
        // A small rift tearing open at the point of impact
        ctx.save();
        ctx.translate(tip.x + 1, tip.y);
        ctx.fillStyle = 'rgba(8,2,20,0.9)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.6, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,160,255,0.95)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(90,224,255,0.9)';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 2.6, Math.sin(a) * 4);
          ctx.lineTo(Math.cos(a) * 5.4, Math.sin(a) * 7);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  if (act === 'death') {
    // The rift that swallows it
    const r = 3 + Math.sin(Math.min(1, t) * Math.PI) * 7;
    ctx.save();
    ctx.translate(face.x, face.y);
    ctx.fillStyle = `rgba(6,2,16,${0.4 + 0.5 * p.fade})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(190,140,255,${0.5 + 0.4 * p.fade})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
    glow(ctx, face, r * 1.6, VOID, 0.45);
    embers(ctx, { x: face.x - 16, y: face.y - 4, w: 32, h: 34 }, 16, t, 0.3 + p.fade * 0.6, VOID, 63);
  }
}
