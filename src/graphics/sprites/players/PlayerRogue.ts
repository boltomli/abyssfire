// src/graphics/sprites/players/PlayerRogue.ts
//
// 影刃 — hooded shadowblade in teal and oiled leather: masked face with
// amber eyes, bandolier of throwing knives, wrapped legs, twin curved
// daggers and long scarf tails that stream behind every move.
// Drawn in two isometric 3/4 views (se front, ne back; mirrored for sw/nw) by
// projecting the shared humanoid keyframes through rig/HumanView.
import type { EntityDrawer, PlayerAction, PlayerView } from '../types';
import { PLAYER_ACTION_FRAME_COUNTS, PLAYER_SHEET_FRAMES, PLAYER_VIEWS } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  blobPath,
  cel,
  clothChain,
  ellipsePath,
  frameTime,
  glow,
  groundShadow,
  lerpV,
  limb,
  polyPath,
  renderRigFrame,
  samplePoseTrack,
  smear,
  tone,
  vec,
  type Key,
  type V,
} from '../rig/Rig';
import {
  basePose,
  gait,
  type HumanPose,
  type Proportions,
} from '../rig/Humanoid';
import {
  drawHumanoidView,
  footOutline,
  inItem,
  midpointPath,
  ringAt,
  solveViewSkeleton,
  strokeLine,
  v3,
  type HumanView,
  type HumanViewSkin,
  type Ring,
  type ViewSkeleton,
} from '../rig/HumanView';
import { getCurrentZonePalette, standardOutlineBlur } from '../../ZonePalette';

// ── Palette ─────────────────────────────────────────────────────────────
const CLOAK = tone(0x2f7064, { light: 0.3 });
const CLOAK_FAR = tone(0x1d463f, { light: 0.2 });
const LEATHER = tone(0x70492f, { light: 0.35 });
const LEATHER_FAR = tone(0x4c3121, { light: 0.2 });
const WRAP = tone(0x3d3d4a);
const WRAP_FAR = tone(0x2a2a34);
const MASK = tone(0x1f2b2e, { light: 0.25 });
const SKIN = tone(0xd9a47c, { shadow: 0.3, light: 0.25 });
const SKIN_FAR = tone(0xa97c5e, { shadow: 0.3, light: 0.15 });
const BRASS = tone(0xc0953e, { light: 0.5 });
const STEEL = tone(0xcfd8e4, { light: 0.6, shadow: 0.3 });
const POISON = 0x6dffa0;
const EYE = 0xffc24a;

const BLADE_LEN = 13;
const ROGUE_SCALE = 1.15;

// ── Skin ────────────────────────────────────────────────────────────────

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  limb(ctx, sh, el, 2.8, 2.4, far ? WRAP_FAR : WRAP);
  // Leather bracer
  limb(ctx, lerpV(el, hand, 0.1), lerpV(el, hand, 0.85), 2.6, 2.3, far ? LEATHER_FAR : LEATHER);
  ctx.strokeStyle = BRASS.shade;
  ctx.lineWidth = 0.5;
  const b = lerpV(el, hand, 0.5);
  ctx.beginPath();
  ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
  ctx.stroke();
}

function gloveHand(ctx: CanvasRenderingContext2D, at: V, far: boolean): void {
  cel(ctx, () => ellipsePath(ctx, at, 2.1, 2), far ? SKIN_FAR : SKIN, { band: 0.6, stroke: 0.4 });
  ctx.fillStyle = far ? MASK.shade : MASK.base;
  ctx.fillRect(at.x - 2, at.y - 0.4, 4, 1.2);
}

function dagger(ctx: CanvasRenderingContext2D, at: V, angle: number, far: boolean, fx: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  // Curved, leaf-shaped blade (points toward local −y)
  const blade = () => {
    ctx.moveTo(-1.2, -1.6);
    ctx.quadraticCurveTo(-2.4, -BLADE_LEN * 0.6, 0.6, -BLADE_LEN);
    ctx.quadraticCurveTo(1.6, -BLADE_LEN * 0.55, 1.2, -1.6);
    ctx.closePath();
  };
  cel(ctx, blade, far ? tone(0x9aa3b0) : STEEL, { band: 0.6, hi: 0.4 });
  if (fx > 0.05) {
    ctx.fillStyle = `rgba(109,255,160,${fx * 0.5})`;
    ctx.beginPath();
    blade();
    ctx.fill();
  }
  // Poison-green edge line
  ctx.strokeStyle = far ? 'rgba(90,200,130,0.5)' : 'rgba(120,255,170,0.75)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-1.1, -2.2);
  ctx.quadraticCurveTo(-2.1, -BLADE_LEN * 0.6, 0.5, -BLADE_LEN + 0.6);
  ctx.stroke();
  // Guard and grip
  cel(ctx, () => polyPath(ctx, [vec(-2.8, -1.8), vec(2.8, -1.8), vec(2.2, -0.6), vec(-2.2, -0.6)]), BRASS, { band: 0.4 });
  cel(ctx, () => polyPath(ctx, [vec(-0.8, -0.6), vec(0.8, -0.6), vec(0.8, 3), vec(-0.8, 3)]), LEATHER_FAR, { band: 0.3 });
  cel(ctx, () => ellipsePath(ctx, vec(0, 3.6), 1.1, 1.1), BRASS, { band: 0.3 });
  ctx.restore();
}

const ROGUE_PROP: Proportions = {
  thigh: 12, shin: 12, upperArm: 9, foreArm: 8.5,
  torso: 15, neck: 6.6, ankle: 2.2,
  hipN: vec(1.8, 0), hipF: vec(-2.2, -0.4),
  shN: vec(1.4, 3.6), shF: vec(-3.8, 3),
};

// ── Isometric 3/4 views (se = front, ne = back) ─────────────────────────

function jerkinRings(len: number): Ring[] {
  return [
    { h: len + 0.6, a: 2.5, b: 3.6 },
    { h: len - 2, a: 3.7, b: 5.6 },
    { h: len - 6.5, a: 3.8, b: 5.2, f: 0.4 },
    { h: 3, a: 3.2, b: 4.4 },
    { h: 0.4, a: 3.5, b: 4.8 },
  ];
}

const TASSET_RINGS: Ring[] = [
  { h: 2.2, a: 3.5, b: 4.8 },
  { h: -1.6, a: 4.3, b: 5.6 },
  { h: -3.6, a: 4.6, b: 5.9, f: 0.2 },
];

function viewLeg(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, near: boolean): void {
  const far = !near;
  const wrap = far ? WRAP_FAR : WRAP;
  const leather = far ? LEATHER_FAR : LEATHER;
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  limb(ctx, hip, knee, 3.7, 3, wrap);
  limb(ctx, knee, ankle, 2.9, 2.3, wrap);
  ctx.strokeStyle = leather.shade;
  ctx.lineWidth = 0.55;
  for (let i = 0; i < 3; i++) {
    const a = lerpV(knee, ankle, 0.2 + i * 0.25);
    ctx.beginPath();
    ctx.moveTo(a.x - 2.3, a.y - 0.8);
    ctx.lineTo(a.x + 2.3, a.y + 0.8);
    ctx.stroke();
  }
  const f = sk.rig.fwd;
  cel(ctx, () => ellipsePath(ctx, vec(knee.x + f.x * 1, knee.y + f.y * 1), 2.6, 2.2), leather, { band: 0.7 });
  const j = near ? sk.j.footN : sk.j.footF;
  const sole = near ? sk.j.soleN : sk.j.soleF;
  cel(ctx, () => polyPath(ctx, footOutline(sk.rig, v3(j.x, j.y - 1, j.z), sole, 5.2, 2.6, 4.4, 1.9)), leather, { band: 0.8 });
}

function viewJerkin(ctx: CanvasRenderingContext2D, sk: ViewSkeleton): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const rings = jerkinRings(len);
  const front = T.vis(0.2) > -0.05;
  const tassets = T.loft(TASSET_RINGS);
  cel(ctx, () => midpointPath(ctx, tassets), LEATHER_FAR, { band: 0.8 });
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, tassets);
  ctx.clip();
  // Split tassets: vertical slits round the skirt
  for (let k = 0; k < 8; k++) {
    const phi = (k / 8) * Math.PI * 2 + 0.2;
    if (T.vis(phi) < 0.05) continue;
    const a = T.at(-0.2, phi, 4, 5.3);
    const b = T.at(-3.8, phi, 4.7, 6);
    strokeLine(ctx, [a, b], LEATHER_FAR.shade, 0.5);
  }
  ctx.restore();
  const body = T.loft(rings);
  cel(ctx, () => midpointPath(ctx, body), LEATHER, { band: 1.5 });
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, body);
  ctx.clip();
  // Stitched seam down the front (or spine)
  const seam: V[] = [];
  for (let h = len - 1; h >= 1; h -= 1.5) {
    const r = ringAt(rings, h);
    seam.push(T.at(h, front ? 0.25 : Math.PI, r.a, r.b, r.f));
  }
  ctx.setLineDash([0.8, 0.8]);
  strokeLine(ctx, seam, LEATHER.shade, 0.4);
  ctx.setLineDash([]);
  // Bandolier: near shoulder, across the chest (front) or back, to the far hip.
  const strap = (phiEnd: number): V[][] => {
    const runs: V[][] = [];
    let cur: V[] = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      const h = len - 0.2 + (2.2 - (len - 0.2)) * k;
      const phi = Math.PI / 2 + (phiEnd - Math.PI / 2) * k;
      const r = ringAt(rings, h);
      if (T.vis(phi, r.a, r.b) > -0.05) cur.push(T.at(h, phi, r.a + 0.25, r.b + 0.25, r.f));
      else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
    return runs;
  };
  for (const run of strap(front ? -0.9 : Math.PI + 0.9)) {
    strokeLine(ctx, run, MASK.line, 3);
    strokeLine(ctx, run, MASK.base, 2.2);
  }
  if (front) {
    for (let i = 0; i < 3; i++) {
      const k = 0.3 + i * 0.18;
      const h = len - 0.2 + (2.2 - (len - 0.2)) * k;
      const phi = Math.PI / 2 + (-0.9 - Math.PI / 2) * k;
      const r = ringAt(rings, h);
      if (T.vis(phi) < 0.1) continue;
      const c = T.at(h, phi, r.a + 0.4, r.b + 0.4, r.f);
      cel(ctx, () => polyPath(ctx, [vec(c.x - 0.5, c.y - 2.2), vec(c.x + 0.5, c.y - 2.2), vec(c.x + 0.4, c.y + 0.6), vec(c.x - 0.4, c.y + 0.6)]), STEEL, { band: 0.2, stroke: 0.3 });
    }
  }
  ctx.restore();
  // Belt, buckle and hip pouch
  const belt = ringAt(rings, 1.4);
  for (const run of T.visibleArcs({ ...belt, a: belt.a + 0.3, b: belt.b + 0.3 }, 0, Math.PI * 2, 28, -0.15)) {
    strokeLine(ctx, run, LEATHER_FAR.line, 2.8);
    strokeLine(ctx, run, LEATHER_FAR.base, 2);
  }
  if (T.vis(0.3) > 0.1) {
    const b = T.at(1.4, 0.3, belt.a + 0.4, belt.b + 0.4);
    cel(ctx, () => polyPath(ctx, [vec(b.x - 1.1, b.y - 1.5), vec(b.x + 1.1, b.y - 1.5), vec(b.x + 1.1, b.y + 1.5), vec(b.x - 1.1, b.y + 1.5)]), BRASS, { band: 0.3 });
  }
  const pouchPhi = -1.9;
  if (T.vis(pouchPhi) > -0.2) {
    const c = T.at(0.2, pouchPhi, belt.a + 1, belt.b + 1);
    cel(ctx, () => blobPath(ctx, [vec(c.x - 1.8, c.y - 1.4), vec(c.x + 1.8, c.y - 1.5), vec(c.x + 1.7, c.y + 2.6), vec(c.x - 1.6, c.y + 2.8)]), LEATHER, { band: 0.6 });
  }
  // Short capelet over the shoulders
  const capelet: Ring[] = [
    { h: len + 1.2, a: 2.8, b: 3.9 },
    { h: len - 1, a: 4.5, b: 6.5 },
    { h: len - 4.6, a: 4.9, b: 6.8, f: 0.1 },
  ];
  const cape = T.loft(capelet, 28);
  cel(ctx, () => midpointPath(ctx, cape), CLOAK, { band: 1.1 });
}

function viewScarf(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const knot = sk.torso.p3(sk.torsoLen + 0.4, Math.PI - 0.4, 3.2, 3.8);
  const ph = t * Math.PI * 2;
  const tails: [number, number, typeof CLOAK][] = [[23, 0, CLOAK_FAR], [19, 1.4, CLOAK]];
  for (const [len, off, col] of tails) {
    // Shorter and hanging lower than in profile: streaming straight back
    // reads as a stray limb once the back is foreshortened.
    const chain = clothChain(vec(knot.x - 1, knot.y + off), len * 0.85, 6, 0.3 + p.flow * 0.6, 1.5, ph + off);
    const top: V[] = [];
    const bot: V[] = [];
    chain.forEach((pt, i) => {
      const w = 1.6 - i * 0.12;
      const z = knot.z - off * 1.2 + Math.sin(ph + i * 0.9) * 0.6 * (i / 6);
      top.push(sk.rig.pt(pt.x, pt.y - w, z));
      bot.push(sk.rig.pt(pt.x, pt.y + w, z));
    });
    const end = chain[chain.length - 1];
    const e = (dx: number, dy: number): V => sk.rig.pt(end.x + dx, end.y + dy, knot.z - off * 1.2);
    cel(ctx, () => polyPath(ctx, [...top, e(-1.6, -1.2), e(-0.4, 0.2), e(-1.6, 1.6), ...bot.reverse()]), col, { band: 0.7 });
  }
}

const RHOOD_RINGS: Ring[] = [
  { h: 8, a: 1.6, b: 1.6, f: -0.6 },
  { h: 6.2, a: 5.4, b: 5.2, f: -0.4 },
  { h: 1.2, a: 7.2, b: 6.5, f: -0.2 },
  { h: -3.8, a: 6.8, b: 6.4 },
  { h: -5.8, a: 5, b: 5.8, f: -0.5 },
];

function viewRogueHood(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const H = sk.skull;
  const front = H.vis(0.1) > -0.15;
  const sway = Math.sin(t * Math.PI * 2) * 0.4 + p.flow * 2;
  const tip = [
    H.at(2, Math.PI, 6.2, 6),
    H.at(-2.6, Math.PI, 8.4 + sway, 5.4),
    H.at(-6.8 - sway * 0.3, Math.PI, 9.6 + sway * 1.4, 0),
    H.at(-4.6, Math.PI - 0.5, 6.4, 6),
    H.at(-4.6, Math.PI + 0.5, 6.4, 6),
  ];
  if (front) cel(ctx, () => blobPath(ctx, tip), CLOAK_FAR, { band: 1 });
  const shell = H.loft(RHOOD_RINGS, 28);
  cel(ctx, () => midpointPath(ctx, shell), CLOAK, { band: 1.6 });
  if (!front) {
    ctx.save();
    ctx.beginPath();
    midpointPath(ctx, shell);
    ctx.clip();
    strokeLine(ctx, RHOOD_RINGS.map(r => H.at(r.h, Math.PI, r.a, r.b, r.f)), CLOAK.shade, 0.7);
    ctx.restore();
    cel(ctx, () => blobPath(ctx, tip), CLOAK, { band: 1 });
    return;
  }
  const patch = (hAmp: number, hMid: number, phiAmp: number, phiMid: number, lift = 0.2): V[] => {
    const out: V[] = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const h = hMid + Math.sin(a) * hAmp;
      const phi = phiMid + Math.cos(a) * phiAmp;
      const r = ringAt(RHOOD_RINGS, h);
      out.push(H.at(h, phi, r.a + lift, r.b + lift, r.f));
    }
    return out;
  };
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, shell);
  ctx.clip();
  const open = patch(5, -0.2, 1, 0.22);
  ctx.fillStyle = '#0e1416';
  ctx.beginPath();
  midpointPath(ctx, open);
  ctx.fill();
  // Skin band across the eyes, mask below.
  const band: V[] = [
    ...[-0.5, -0.1, 0.3, 0.7, 1.0].map(phi => H.at(1.9, phi, 6.6, 6.2)),
    ...[1.0, 0.7, 0.3, -0.1, -0.5].map(phi => H.at(-0.4, phi, 6.8, 6.3)),
  ];
  cel(ctx, () => polyPath(ctx, band), SKIN, { band: 0.6, stroke: 0.3 });
  const mask: V[] = [
    ...[-0.6, -0.2, 0.2, 0.6, 1.05].map(phi => H.at(-0.2, phi, 6.9, 6.4)),
    ...[1.0, 0.6, 0.25, -0.1, -0.5].map((phi, i) => H.at(-4.6 + Math.abs(i - 2) * 0.5, phi, 6.4, 6.1)),
  ];
  cel(ctx, () => polyPath(ctx, mask), MASK, { band: 0.8, stroke: 0.4 });
  ctx.fillStyle = '#ffd36e';
  for (const phi of [-0.15, 0.55]) {
    if (H.vis(phi) > 0.05) {
      const e = H.at(0.9, phi, 6.8, 6.3);
      ctx.fillRect(e.x - 0.75, e.y - 0.45, 1.5, 0.9);
    }
  }
  ctx.restore();
}

function viewDagger(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, near: boolean): void {
  const hand = near ? sk.handN : sk.handF;
  inItem(ctx, sk.rig, hand, near ? p.wpn : p.off, () => dagger(ctx, vec(0, 0), 0, !near, p.fx));
  gloveHand(ctx, hand, !near);
}

const ROGUE_VIEW_SKIN: HumanViewSkin = {
  prop: ROGUE_PROP,
  build: { hipW: 2.5, shW: 5.2, elbowOut: 1.8, footOut: 0.4 },
  parts(ctx, sk, p, t) {
    const d0 = sk.d.pelvis;
    const T = sk.torso;
    const armZ = (near: boolean): number => (near
      ? sk.d.elN * 0.6 + sk.d.handN * 0.4
      : sk.d.elF * 0.6 + sk.d.handF * 0.4) - d0;
    const legZ = (near: boolean): number => -0.6 + 0.02 * ((near ? sk.d.kneeN + sk.d.footN : sk.d.kneeF + sk.d.footF) / 2 - d0);
    const scarfZ = T.depth(sk.torsoLen, Math.PI, 5, 0) - d0;
    const headZ = Math.max(sk.d.head - d0 + 2.5, scarfZ + 0.2);
    return [
      { z: scarfZ, draw: () => viewScarf(ctx, sk, p, t) },
      { z: legZ(true), draw: () => viewLeg(ctx, sk, true) },
      { z: legZ(false), draw: () => viewLeg(ctx, sk, false) },
      { z: 0, draw: () => viewJerkin(ctx, sk) },
      { z: armZ(false), draw: () => arm(ctx, sk.shF, sk.elF, sk.handF, true) },
      { z: Math.max(armZ(false), sk.d.handF - d0) + 0.02, draw: () => viewDagger(ctx, sk, p, false) },
      { z: armZ(true), draw: () => arm(ctx, sk.shN, sk.elN, sk.handN, false) },
      { z: headZ, draw: () => viewRogueHood(ctx, sk, p, t) },
      { z: Math.max(armZ(true), sk.d.handN - d0) + 0.02, draw: () => viewDagger(ctx, sk, p, true) },
    ];
  },
};

// ── Animation ───────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1.5, 66.4),
  lean: 0.2,
  head: -0.14,
  footN: vec(CENTER_X + 7, GROUND_Y),
  footF: vec(CENTER_X - 7.5, GROUND_Y),
  handN: vec(CENTER_X + 9.5, 64),
  handF: vec(CENTER_X + 5.5, 57.5),
  wpn: 1.45,
  off: 0.8,
  flow: 0.15,
  // 3/4 views: blades held wide of the body so the jerkin reads.
  zN: 2.6,
  zF: -1.8,
});

function pose(over: Partial<HumanPose>): HumanPose {
  return { ...READY, ...over };
}

const HIT = pose({
  root: vec(CENTER_X - 4.5, 67), lean: -0.2, head: -0.45,
  footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 9, GROUND_Y),
  handN: vec(CENTER_X + 3, 60), wpn: 0.9, handF: vec(CENTER_X - 1, 56), off: 0.2,
  flow: 0.5, stretch: -0.04,
});

const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.28, ease: 'out', pose: pose({
    root: vec(CENTER_X - 3.5, 67.6), lean: 0.06, head: -0.05,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 8.5, GROUND_Y),
    handN: vec(CENTER_X - 4, 55), wpn: -0.35, handF: vec(CENTER_X + 8, 60), off: 1.2,
    flow: 0.25, stretch: 0.03,
  }) },
  { at: 0.43, ease: 'in', pose: pose({
    root: vec(CENTER_X + 3, 67.6), lean: 0.42,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 11, 52), wpn: 0.6, handF: vec(CENTER_X + 6, 60), off: 1.3,
    flow: 0.5, fx: 0.7,
  }) },
  { at: 0.571, ease: 'linear', pose: pose({
    root: vec(CENTER_X + 6, 68.8), lean: 0.58, head: -0.02,
    footN: vec(CENTER_X + 15, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 20, 63.5), wpn: 2.05, handF: vec(CENTER_X + 12, 58), off: 1.45,
    flow: 0.8, fx: 1, stretch: -0.03,
  }) },
  { at: 0.71, ease: 'out', pose: pose({
    root: vec(CENTER_X + 5.5, 69), lean: 0.6,
    footN: vec(CENTER_X + 15, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    // Off-hand follow-up stab
    handN: vec(CENTER_X + 13, 71), wpn: 2.7, handF: vec(CENTER_X + 20, 59), off: 1.55,
    flow: 0.6, fx: 0.6,
  }) },
  { at: 0.86, pose: pose({ root: vec(CENTER_X + 1.5, 67.4), lean: 0.34, handN: vec(CENTER_X + 11, 66), wpn: 1.7, footN: vec(CENTER_X + 10, GROUND_Y), flow: 0.3 }) },
  { at: 1, pose: READY },
];

const CAST: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.36, ease: 'out', pose: pose({
    root: vec(CENTER_X - 2, 69.5), lean: 0.3, head: 0.02,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 8.5, GROUND_Y),
    handN: vec(CENTER_X + 6, 55), wpn: 0.35, handF: vec(CENTER_X + 5, 57), off: -0.3,
    flow: 0.3, fx: 0.9, stretch: -0.02,
  }) },
  { at: 0.5, ease: 'in', pose: pose({
    root: vec(CENTER_X + 3.5, 67.5), lean: 0.46, head: -0.05,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 19, 56), wpn: 1.5, handF: vec(CENTER_X - 3, 60), off: 0.6,
    flow: 0.7, fx: 1,
  }) },
  { at: 0.72, pose: pose({
    root: vec(CENTER_X + 3, 67.5), lean: 0.4,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 16, 58), wpn: 1.55, handF: vec(CENTER_X - 1, 60), off: 0.7,
    flow: 0.4, fx: 0.4,
  }) },
  { at: 1, pose: READY },
];

const HURT: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.33, pose: pose({ ...HIT, root: vec(CENTER_X - 5, 67.4), lean: -0.1, head: -0.3, flow: 0.4 }) },
  { at: 1, pose: READY },
];

const TUCK = (x: number, y: number, spin: number): HumanPose => pose({
  root: vec(x, y), spin, pivot: 0.5, lean: 0.75, head: 0.5,
  footN: vec(x + 5, y + 10), footF: vec(x + 2.5, y + 10.5),
  handN: vec(x + 6, y - 1), wpn: 2.4, handF: vec(x + 5, y - 4), off: 2.2,
  flow: 0.85, stretch: -0.08,
});

const DODGE: Key<HumanPose>[] = [
  { at: 0, pose: pose({
    root: vec(CENTER_X, 71.5), pivot: 0.5, lean: 0.6, head: 0.2,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 9, 70), wpn: 2, handF: vec(CENTER_X + 7, 66), off: 1.8, flow: 0.4,
  }) },
  { at: 0.2, pose: TUCK(CENTER_X - 1, 72, 1.4) },
  { at: 0.4, ease: 'linear', pose: TUCK(CENTER_X, 70.5, 3) },
  { at: 0.6, ease: 'linear', pose: TUCK(CENTER_X + 0.5, 71.5, 4.6) },
  { at: 0.8, pose: pose({
    root: vec(CENTER_X + 1.5, 70), spin: 6.05, pivot: 0.5, lean: 0.45, head: 0,
    footN: vec(CENTER_X + 9, GROUND_Y), footF: vec(CENTER_X - 5, GROUND_Y),
    handN: vec(CENTER_X + 10, 66), wpn: 1.7, handF: vec(CENTER_X + 6, 60), off: 1.1, flow: 0.5,
  }) },
  { at: 1, pose: { ...READY, spin: Math.PI * 2, pivot: 0.5 } },
];

const DEATH: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.22, pose: pose({ ...HIT, root: vec(CENTER_X - 5, 70), lean: -0.05, head: 0.1, handN: vec(CENTER_X + 2, 66), wpn: 2.2 }) },
  { at: 0.45, pose: pose({
    root: vec(CENTER_X - 3, 76), lean: 0.12, head: 0.35,
    footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 7, 86),
    handN: vec(CENTER_X + 4, 79), wpn: 2.8, handF: vec(CENTER_X, 76), off: 2.4, flow: 0.25,
  }) },
  { at: 0.72, ease: 'in', pose: pose({
    root: vec(CENTER_X - 3, 82), spin: -0.95, lean: -0.1, head: -0.3,
    footN: vec(CENTER_X + 3, 103), footF: vec(CENTER_X - 2, 102),
    handN: vec(CENTER_X + 5, 76), wpn: 2.4, handF: vec(CENTER_X - 2, 74), off: 2.4, flow: 0.6,
  }) },
  { at: 1, ease: 'out', pose: pose({
    root: vec(CENTER_X - 1, 86.5), spin: -1.52, lean: 0, head: -0.2,
    footN: vec(CENTER_X + 1.5, 110.5), footF: vec(CENTER_X - 1, 110),
    handN: vec(CENTER_X + 5, 80), wpn: 3.1, handF: vec(CENTER_X - 3, 78), off: 3, flow: 0.08,
  }) },
];

function idlePose(t: number): HumanPose {
  const ph = t * Math.PI * 2;
  const b = Math.sin(ph);
  return pose({
    // Light on the feet: a small bounce rather than a heavy breath.
    root: vec(READY.root.x + Math.sin(ph) * 0.3, READY.root.y + Math.abs(b) * -0.6 + 0.3),
    stretch: b * -0.01,
    head: READY.head + Math.sin(ph - 0.5) * 0.04,
    handN: vec(READY.handN.x, READY.handN.y + Math.sin(ph - 0.3) * 0.5),
    handF: vec(READY.handF.x, READY.handF.y + Math.sin(ph - 0.8) * 0.6),
    wpn: READY.wpn + Math.sin(ph) * 0.04,
    off: READY.off + Math.sin(ph - 0.6) * 0.05,
    flow: 0.15 + Math.sin(ph) * 0.07,
  });
}

function walkPose(t: number): HumanPose {
  const g = gait(t, { stride: 7.8, lift: 5, bob: 1.2, rootY: 66.2, footSpread: 1 });
  const ph = t * Math.PI * 2;
  return pose({
    root: vec(CENTER_X, g.rootY),
    lean: 0.26,
    head: -0.16,
    footN: g.footN,
    footF: g.footF,
    handN: vec(CENTER_X + 9 - g.swing * 4, 64 + Math.abs(g.swing) * 0.5),
    wpn: 1.5 - g.swing * 0.15,
    handF: vec(CENTER_X + 5 + g.swing * 3, 59),
    off: 0.9 + g.swing * 0.1,
    flow: 0.5 + Math.sin(ph * 2) * 0.1,
  });
}

function roguePose(act: PlayerAction, t: number): HumanPose {
  switch (act) {
    case 'idle': return idlePose(t);
    case 'walk': return walkPose(t);
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'cast': return samplePoseTrack(CAST, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'dodge': return samplePoseTrack(DODGE, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

function bladePoint(sk: ViewSkeleton, near: boolean, angle: number, len: number): V {
  const hand = near ? sk.handN : sk.handF;
  const { ang, k } = sk.rig.dir(angle);
  return vec(hand.x + Math.sin(ang) * k * len, hand.y - Math.cos(ang) * k * len);
}

function drawFx(ctx: CanvasRenderingContext2D, act: PlayerAction, t: number, p: HumanPose, view: HumanView): void {
  const sk = solveViewSkeleton(p, ROGUE_PROP, ROGUE_VIEW_SKIN.build, view);
  if (act === 'attack' && p.fx > 0.3) {
    for (const which of ['n', 'f'] as const) {
      const tips: V[] = [];
      const bases: V[] = [];
      for (let i = 6; i >= 0; i--) {
        const sp = samplePoseTrack(ATTACK, Math.max(0, t - i * 0.02));
        const ssk = solveViewSkeleton(sp, ROGUE_PROP, ROGUE_VIEW_SKIN.build, view);
        const near = which === 'n';
        const ang = near ? sp.wpn : sp.off;
        tips.push(bladePoint(ssk, near, ang, BLADE_LEN));
        bases.push(bladePoint(ssk, near, ang, 3));
      }
      smear(ctx, tips, bases, which === 'n' ? 0xd8ffe8 : POISON, (which === 'n' ? 0.55 : 0.35) * p.fx);
    }
  }
  if (act === 'cast' && p.fx > 0.05) {
    for (const hand of [sk.handN, sk.handF]) {
      glow(ctx, hand, 4 + p.fx * 4, POISON, 0.5 * p.fx);
    }
    // Wisps of shadow rising off the body
    const r = sk.rig.pt(p.root.x, p.root.y);
    for (let i = 0; i < 5; i++) {
      const k = (i / 5 + t * 1.3) % 1;
      glow(ctx, vec(r.x - 4 + i * 2.5, r.y + 8 - k * 26), 2.2, 0x2fd6a0, 0.45 * p.fx * (1 - k));
    }
  }
  const H = sk.skull;
  if (H.vis(0.2) > 0.1 && (act !== 'death' || t < 0.6)) {
    for (const phi of [-0.15, 0.55]) {
      if (H.vis(phi) > 0.05) glow(ctx, H.at(0.9, phi, 6.8, 6.3), 1.8, EYE, 0.4);
    }
  }
}

export const PlayerRogueDrawer: EntityDrawer = {
  key: 'player_rogue',
  // Wide frame leaves room for weapon reach at the contact pose.
  frameW: 96,
  frameH: 96,
  totalFrames: PLAYER_SHEET_FRAMES,
  inked: true,
  views: PLAYER_VIEWS,

  drawFrame(ctx, frame, action, w, h, _utils, view?: PlayerView) {
    const v: HumanView = view ?? 'se';
    const act = action as PlayerAction;
    const count = PLAYER_ACTION_FRAME_COUNTS[act];
    const loop = act === 'idle' || act === 'walk';
    const t = frameTime(frame % count, count, loop);
    const p = roguePose(act, t);
    const palette = getCurrentZonePalette();
    const lift = Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y));
    let shadowX = p.root.x + 1;
    renderRigFrame(
      ctx, w, h,
      c => { shadowX = drawHumanoidView(c, p, ROGUE_VIEW_SKIN, t, v).rig.pt(p.root.x + 1, GROUND_Y).x; },
      { glowColor: palette.playerOutlineColor, glowBlur: standardOutlineBlur(w, h), scale: ROGUE_SCALE },
      c => groundShadow(c, shadowX, 13, lift),
      c => drawFx(c, act, t, p, v),
    );
  },
};
