// src/graphics/sprites/players/PlayerMage.ts
//
// 渊火术士 — hooded arcanist in an indigo robe with gold trim and a crimson
// sash, glowing eyes under the hood, bell sleeves, and a gnarled staff that
// cradles a floating arcane crystal. Drawn in two isometric 3/4 views (se
// front, ne back; mirrored for sw/nw) by projecting the shared humanoid
// keyframes through rig/HumanView.
import type { EntityDrawer, PlayerAction, PlayerView } from '../types';
import { PLAYER_ACTION_FRAME_COUNTS, PLAYER_SHEET_FRAMES, PLAYER_VIEWS } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  along,
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
  Section,
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
const ROBE = tone(0x4a3690, { light: 0.3 });
const ROBE_FAR = tone(0x2f2360, { light: 0.2 });
const LINING = tone(0x8a74d8, { light: 0.35 });
const TRIM = tone(0xdcb24c, { light: 0.5 });
const SASH = tone(0xa0283c);
const SKIN = tone(0xe6b791, { shadow: 0.3, light: 0.25 });
const SKIN_FAR = tone(0xb98a6a, { shadow: 0.3, light: 0.15 });
const BOOT = tone(0x3a2a24);
const BEARD = tone(0xd9dbe6, { light: 0.4, shadow: 0.3 });
const TOME = tone(0x6a2b24);
const WOOD = tone(0x74492a, { light: 0.3 });
const CRYSTAL = tone(0x9fe6ff, { light: 0.6, shadow: 0.25 });
const ARCANE = 0xa47bff;
const ARCANE_HOT = 0x9fe6ff;

const STAFF_UP = 22;
const STAFF_DOWN = 17;
const MAGE_SCALE = 1.16;

// ── Skin ────────────────────────────────────────────────────────────────

function sleeveArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const cloth = far ? ROBE_FAR : ROBE;
  limb(ctx, sh, el, 2.9, 2.6, cloth);
  // Bell sleeve flaring toward the wrist
  const dir = { x: hand.x - el.x, y: hand.y - el.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const nx = -dir.y / len;
  const ny = dir.x / len;
  const cuff = lerpV(el, hand, 0.82);
  const pts = [
    vec(el.x + nx * 2.6, el.y + ny * 2.6),
    vec(cuff.x + nx * 4.2, cuff.y + ny * 4.2 + 1.2),
    vec(cuff.x - nx * 3.6, cuff.y - ny * 3.6 + 1.6),
    vec(el.x - nx * 2.6, el.y - ny * 2.6),
  ];
  cel(ctx, () => polyPath(ctx, pts), cloth, { band: 1 });
  ctx.strokeStyle = far ? TRIM.shade : TRIM.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.stroke();
}

function hand(ctx: CanvasRenderingContext2D, at: V, far: boolean): void {
  cel(ctx, () => ellipsePath(ctx, at, 2, 1.9), far ? SKIN_FAR : SKIN, { band: 0.6, stroke: 0.4 });
}

function staff(ctx: CanvasRenderingContext2D, at: V, angle: number, t: number, fx: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  // Gnarled shaft
  cel(ctx, () => {
    ctx.moveTo(-0.9, STAFF_DOWN);
    ctx.quadraticCurveTo(-1.6, 4, -0.8, -STAFF_UP + 3);
    ctx.lineTo(0.9, -STAFF_UP + 3);
    ctx.quadraticCurveTo(0.2, 4, 0.9, STAFF_DOWN);
    ctx.closePath();
  }, WOOD, { band: 0.5, hi: 0.3 });
  // Gold bands
  ctx.fillStyle = TRIM.base;
  ctx.fillRect(-1.3, -STAFF_UP + 3, 2.6, 1.1);
  ctx.fillRect(-1.2, -4.5, 2.4, 0.9);
  ctx.fillRect(-1.1, STAFF_DOWN - 1.4, 2.2, 1);
  // Claw head cradling the crystal
  for (const side of [-1, 1]) {
    cel(ctx, () => {
      ctx.moveTo(side * 0.5, -STAFF_UP + 3.4);
      ctx.quadraticCurveTo(side * 5.2, -STAFF_UP - 0.5, side * 2.4, -STAFF_UP - 6.4);
      ctx.lineTo(side * 1.6, -STAFF_UP - 5.6);
      ctx.quadraticCurveTo(side * 3.4, -STAFF_UP - 0.4, side * 0.2, -STAFF_UP + 1.6);
      ctx.closePath();
    }, WOOD, { band: 0.4, hi: 0.2 });
  }
  // Floating crystal (bobs independently of the shaft)
  const bob = Math.sin(t * Math.PI * 4) * 0.6;
  const cy = -STAFF_UP - 3.4 + bob;
  cel(ctx, () => polyPath(ctx, [vec(0, cy - 4.4), vec(2.3, cy), vec(0, cy + 3.6), vec(-2.3, cy)]), CRYSTAL, { band: 0.8, hi: 0.5, stroke: 0.5 });
  ctx.fillStyle = `rgba(255,255,255,${0.7 + fx * 0.3})`;
  ctx.beginPath();
  ctx.moveTo(-0.6, cy - 2.6);
  ctx.lineTo(0.4, cy - 3.4);
  ctx.lineTo(0.1, cy - 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function crystalPoint(at: V, angle: number, t: number): V {
  const bob = Math.sin(t * Math.PI * 4) * 0.6;
  return along(at, angle, STAFF_UP + 3.4 - bob);
}

const MAGE_PROP: Proportions = {
  thigh: 12, shin: 12, upperArm: 9, foreArm: 8.5,
  torso: 16, neck: 7, ankle: 2,
  hipN: vec(1.8, 0), hipF: vec(-2.2, -0.4),
  shN: vec(1, 3.6), shF: vec(-3.8, 3),
};

// ── Isometric 3/4 views (se = front, ne = back) ─────────────────────────

function robeRings(len: number): Ring[] {
  return [
    { h: len + 0.6, a: 2.8, b: 4 },
    { h: len - 2, a: 4.1, b: 6.2 },
    { h: len - 7, a: 4.1, b: 5.9, f: 0.4 },
    { h: 2.5, a: 3.8, b: 5.4 },
    { h: 0, a: 4, b: 5.7 },
  ];
}

/** Robe skirt hangs plumb from the waist and flares round both feet. */
function skirtSection(sk: ViewSkeleton, p: HumanPose): { S: Section; rings: Ring[] } {
  const S = new Section(sk.rig, sk.j.pelvis, v3(0, -1, 0), v3(1, 0, 0));
  const fN = sk.j.footN;
  const fF = sk.j.footF;
  const spread = Math.abs(fN.x - fF.x);
  const hemY = Math.min(GROUND_Y - 3.4, Math.max(fN.y, fF.y) - 1.2);
  const hemH = sk.j.pelvis.y - hemY;
  const mid = (fN.x + fF.x) / 2 - sk.j.pelvis.x - p.flow * 2.6;
  const rings: Ring[] = [
    { h: 2.6, a: 3.9, b: 5.6 },
    { h: -2, a: 4.6, b: 6.3, f: mid * 0.3 },
    { h: hemH * 0.55, a: 5 + spread * 0.25, b: 6.9, f: mid * 0.65 },
    { h: hemH, a: 5.5 + spread * 0.45, b: 7.8, f: mid },
  ];
  return { S, rings };
}

function viewSkirt(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const { S, rings } = skirtSection(sk, p);
  const wave = Math.sin(t * Math.PI * 4) * 0.35;
  const hem = rings[rings.length - 1];
  const outline = S.loft(rings.map((r, i) => (i === rings.length - 1 ? { ...r, h: r.h + wave } : r)), 28);
  cel(ctx, () => midpointPath(ctx, outline), ROBE, { band: 1.8 });
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, outline);
  ctx.clip();
  const front = S.vis(0.3) > -0.1;
  if (front) {
    // Front opening showing the lining, edged in gold, with runes.
    const edge = (phi: number): V[] => rings.map(r => S.at(r.h, phi, r.a + 0.1, r.b + 0.1, r.f ?? 0));
    const a = edge(0.12);
    const b = edge(0.55);
    const panel = [...a, ...[...b].reverse()];
    cel(ctx, () => polyPath(ctx, panel), LINING, { band: 0.8, stroke: 0.4 });
    strokeLine(ctx, a, TRIM.base, 0.9);
    strokeLine(ctx, b, TRIM.base, 0.9);
    ctx.fillStyle = TRIM.light;
    for (let i = 0; i < 3; i++) {
      const k = 0.25 + i * 0.25;
      const h = rings[0].h + (hem.h - rings[0].h) * k;
      const r = ringAt(rings, h);
      const c = S.at(h, -0.12, r.a + 0.1, r.b + 0.1, r.f ?? 0);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 1.2);
      ctx.lineTo(c.x + 0.8, c.y);
      ctx.lineTo(c.x, c.y + 1.2);
      ctx.lineTo(c.x - 0.8, c.y);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Back seam and fold lines
    const seam = rings.map(r => S.at(r.h, Math.PI, r.a, r.b, r.f ?? 0));
    strokeLine(ctx, seam.slice(1), ROBE.shade, 0.7);
    for (const phi of [Math.PI - 0.8, Math.PI + 0.7]) {
      strokeLine(ctx, rings.slice(2).map(r => S.at(r.h, phi, r.a, r.b, r.f ?? 0)), ROBE.shade, 0.6);
    }
  }
  ctx.restore();
  // Gold hem trim
  for (const run of S.visibleArcs({ ...hem, h: hem.h + 0.8 + wave, a: hem.a + 0.1, b: hem.b + 0.1 }, 0, Math.PI * 2, 32, -0.3)) {
    strokeLine(ctx, run, TRIM.base, 0.9);
  }
}

function viewRobeTorso(ctx: CanvasRenderingContext2D, sk: ViewSkeleton): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const rings = robeRings(len);
  const body = T.loft(rings);
  cel(ctx, () => midpointPath(ctx, body), ROBE, { band: 1.5 });
  const front = T.vis(0.2) > -0.05;
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, body);
  ctx.clip();
  if (front) {
    const trim: V[] = [];
    for (let h = len; h >= 0; h -= 2) {
      const r = ringAt(rings, h);
      trim.push(T.at(h, 0.3, r.a, r.b, r.f));
    }
    strokeLine(ctx, trim, TRIM.base, 0.9);
  }
  ctx.restore();
  // Sash band round the waist
  const sash = ringAt(rings, 2);
  for (const run of T.visibleArcs({ ...sash, a: sash.a + 0.3, b: sash.b + 0.3 }, 0, Math.PI * 2, 28, -0.2)) {
    strokeLine(ctx, run, SASH.line, 3.4);
    strokeLine(ctx, run, SASH.base, 2.6);
  }
  // Mantle over the shoulders
  const mantleRings: Ring[] = [
    { h: len + 1.4, a: 3, b: 4.2 },
    { h: len - 0.8, a: 5, b: 7.3 },
    { h: len - 5, a: 5.3, b: 7.5, f: 0.2 },
  ];
  const mantle = T.loft(mantleRings, 28);
  cel(ctx, () => midpointPath(ctx, mantle), ROBE_FAR, { band: 1 });
  for (const run of T.visibleArcs({ ...mantleRings[2], h: mantleRings[2].h + 0.7 }, 0, Math.PI * 2, 28, -0.2)) {
    strokeLine(ctx, run, TRIM.base, 0.8);
  }
  if (front) {
    const g = T.at(len - 2.6, 0.3, 5.1, 7.3);
    cel(ctx, () => ellipsePath(ctx, g, 1.3, 1.3), TRIM, { band: 0.4 });
    ctx.fillStyle = '#b48cff';
    ctx.fillRect(g.x - 0.5, g.y - 0.5, 1, 1);
  }
}

function viewTome(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const hook = sk.torso.at(1.2, 1.05, 4.2, 5.4);
  const swing = Math.sin(t * Math.PI * 2 + 0.4) * 0.12 - p.flow * 0.5 * (sk.rig.front ? 1 : -1);
  ctx.save();
  ctx.translate(hook.x, hook.y);
  ctx.rotate(swing);
  ctx.strokeStyle = TRIM.shade;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 2.6);
  ctx.stroke();
  const w = sk.rig.front ? 2.4 : 2.1;
  cel(ctx, () => polyPath(ctx, [vec(-w, 2.4), vec(w, 2.4), vec(w, 9.4), vec(-w, 9.4)]), TOME, { band: 0.7 });
  ctx.fillStyle = '#f0e6c8';
  ctx.fillRect(sk.rig.front ? -w - 0.3 : w - 0.3, 3, 0.6, 5.8);
  ctx.fillStyle = TRIM.base;
  ctx.fillRect(-w, 2.4, 1.3, 1.3);
  ctx.fillRect(-w, 8.1, 1.3, 1.3);
  ctx.beginPath();
  ctx.arc(0, 5.9, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function viewSashTails(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const knot = sk.torso.p3(2, Math.PI - 0.5, 4.2, 5.2);
  const chain = clothChain(vec(knot.x, knot.y), 13, 4, 0.25 + p.flow, 1.3, t * Math.PI * 2 + 1);
  for (let i = 0; i < 2; i++) {
    const off = i * 1.6;
    const top: V[] = [];
    const bot: V[] = [];
    chain.forEach((pt, j) => {
      const w = 1.2 + j * 0.15;
      const z = knot.z - off * 0.8;
      top.push(sk.rig.pt(pt.x - off * 0.4, pt.y + off * 0.5 - w, z));
      bot.push(sk.rig.pt(pt.x - off * 0.4, pt.y + off * 0.5 + w, z));
    });
    cel(ctx, () => polyPath(ctx, [...top, ...bot.reverse()]), i === 0 ? SASH : tone(0x6e1a2a), { band: 0.6 });
  }
}

const HOOD_RINGS: Ring[] = [
  { h: 8.8, a: 1.6, b: 1.6, f: -0.8 },
  { h: 6.8, a: 5.8, b: 5.6, f: -0.6 },
  { h: 1.5, a: 7.6, b: 6.9, f: -0.3 },
  { h: -4.2, a: 7, b: 6.8 },
  { h: -7.4, a: 5.2, b: 6.4, f: -0.6 },
];

function hoodTip(sk: ViewSkeleton, p: HumanPose, t: number): V[] {
  const H = sk.skull;
  const sway = Math.sin(t * Math.PI * 2) * 0.5 + p.flow * 2.5;
  return [
    H.at(3, Math.PI, 6.6, 6),
    H.at(-2, Math.PI, 8.2 + sway, 5.8),
    H.at(-7.6 - sway * 0.3, Math.PI, 11 + sway * 1.4, 0),
    H.at(-5, Math.PI - 0.5, 6.6, 6.4),
    H.at(-5, Math.PI + 0.5, 6.6, 6.4),
  ];
}

function viewHood(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const H = sk.skull;
  const front = H.vis(0.1) > -0.15;
  const tip = hoodTip(sk, p, t);
  if (front) cel(ctx, () => blobPath(ctx, tip), ROBE_FAR, { band: 1.2 });
  const shell = H.loft(HOOD_RINGS, 28);
  cel(ctx, () => midpointPath(ctx, shell), ROBE, { band: 1.7 });
  if (front) {
    // Face opening: a dark oval on the front of the hood.
    const open: V[] = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const h = Math.sin(a) * 5.8 - 0.3;
      const phi = 0.2 + Math.cos(a) * 1.05;
      const r = ringAt(HOOD_RINGS, h);
      open.push(H.at(h, phi, r.a + 0.2, r.b + 0.2, r.f));
    }
    ctx.save();
    ctx.beginPath();
    midpointPath(ctx, shell);
    ctx.clip();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    midpointPath(ctx, open);
    ctx.fill();
    // Face: cheeks and nose catch the light, brow in hood shadow.
    const face: V[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const h = Math.sin(a) * 3.7 + 0.1;
      const phi = 0.22 + Math.cos(a) * 0.74;
      face.push(H.at(h, phi, 6.2, 5.8));
    }
    cel(ctx, () => midpointPath(ctx, face), SKIN, { band: 1, stroke: 0.35 });
    const nose = H.at(-0.4, 0.15, 7.4, 6.2);
    cel(ctx, () => ellipsePath(ctx, nose, 1, 1.3), SKIN, { band: 0.5, stroke: 0.3 });
    const brow: V[] = [];
    for (let phi = -0.45; phi <= 0.8; phi += 0.25) brow.push(H.at(2.6, phi, 6.4, 6));
    strokeLine(ctx, brow, 'rgba(26,16,48,0.6)', 1.6);
    // Glowing eyes
    ctx.fillStyle = '#e8fbff';
    for (const phi of [-0.2, 0.52]) {
      if (H.vis(phi) > 0.05) {
        const e = H.at(1.1, phi, 6.5, 6);
        ctx.fillRect(e.x - 0.8, e.y - 0.45, 1.6, 0.9);
      }
    }
    ctx.restore();
    // Rim trim round the opening
    ctx.save();
    ctx.beginPath();
    midpointPath(ctx, shell);
    ctx.clip();
    ctx.strokeStyle = TRIM.base;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    midpointPath(ctx, open);
    ctx.stroke();
    ctx.restore();
    // Silver beard spilling out of the hood
    const bs = Math.sin(t * Math.PI * 2 + 0.8) * 0.4 - p.flow * 1.2;
    const beard = [
      H.at(-1.6, -0.4, 6.8, 6), H.at(-1.8, 0.75, 6.8, 6), H.at(-5.6, 0.6, 6.4, 5.4),
      H.at(-10.6, 0.2, 5.4 + bs, 4), H.at(-7.6, -0.05, 5.8 + bs, 4.4), H.at(-4.8, -0.45, 6.4, 5.4),
    ];
    cel(ctx, () => blobPath(ctx, beard), BEARD, { band: 0.8, stroke: 0.4 });
  } else {
    // Back of the hood: centre seam and the long tip hanging down the back.
    ctx.save();
    ctx.beginPath();
    midpointPath(ctx, shell);
    ctx.clip();
    const seam = HOOD_RINGS.map(r => H.at(r.h, Math.PI, r.a, r.b, r.f));
    strokeLine(ctx, seam, ROBE.shade, 0.7);
    ctx.restore();
    cel(ctx, () => blobPath(ctx, tip), ROBE, { band: 1.2 });
    const side = H.visibleArcs({ h: -1, a: 7.7, b: 7 }, 0.4, 1.6, 8, 0);
    for (const run of side) strokeLine(ctx, run, TRIM.shade, 0.8);
  }
}

function viewLegs(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, near: boolean): void {
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  limb(ctx, knee, ankle, 2.4, 2, near ? tone(0x33264f) : tone(0x241a3c));
  const j = near ? sk.j.footN : sk.j.footF;
  const sole = near ? sk.j.soleN : sk.j.soleF;
  cel(ctx, () => polyPath(ctx, footOutline(sk.rig, j, sole, 5, 2.4, 4.2, 1.8)), near ? BOOT : tone(0x2a1e1a), { band: 0.8 });
}

/** The staff leans a little out to the side so the crystal clears the hood. */
const STAFF_LAT = 0.3;

function viewStaff(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  inItem(ctx, sk.rig, sk.handN, p.wpn, () => staff(ctx, vec(0, 0), 0, t, p.fx), STAFF_LAT);
  hand(ctx, sk.handN, false);
}

const MAGE_VIEW_SKIN: HumanViewSkin = {
  prop: MAGE_PROP,
  build: { hipW: 2.4, shW: 5.4, elbowOut: 1.4, footOut: 0.4 },
  parts(ctx, sk, p, t) {
    const d0 = sk.d.pelvis;
    const T = sk.torso;
    const armZ = (near: boolean): number => (near
      ? sk.d.elN * 0.6 + sk.d.handN * 0.4
      : sk.d.elF * 0.6 + sk.d.handF * 0.4) - d0;
    const legZ = (near: boolean): number => -0.6 + 0.02 * ((near ? sk.d.kneeN + sk.d.footN : sk.d.kneeF + sk.d.footF) / 2 - d0);
    const backZ = T.depth(2, Math.PI, 5, 5) - d0;
    const headZ = Math.max(sk.d.head - d0 + 2.5, backZ + 0.3);
    const tomeZ = T.depth(1, 1.05, 5, 6) - d0;
    return [
      { z: backZ, draw: () => viewSashTails(ctx, sk, p, t) },
      { z: legZ(true), draw: () => viewLegs(ctx, sk, true) },
      { z: legZ(false), draw: () => viewLegs(ctx, sk, false) },
      { z: 0, draw: () => { viewSkirt(ctx, sk, p, t); viewRobeTorso(ctx, sk); } },
      { z: tomeZ, draw: () => viewTome(ctx, sk, p, t) },
      { z: armZ(false), draw: () => { sleeveArm(ctx, sk.shF, sk.elF, sk.handF, true); hand(ctx, sk.handF, true); } },
      { z: armZ(true), draw: () => sleeveArm(ctx, sk.shN, sk.elN, sk.handN, false) },
      { z: headZ, draw: () => viewHood(ctx, sk, p, t) },
      { z: Math.max(armZ(true), sk.d.handN - d0) + 0.02, draw: () => viewStaff(ctx, sk, p, t) },
    ];
  },
};

// ── Animation ───────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1.5, 65),
  lean: 0.04,
  head: -0.02,
  footN: vec(CENTER_X + 4, GROUND_Y),
  footF: vec(CENTER_X - 5, GROUND_Y),
  handN: vec(CENTER_X + 3.5, 60.5),
  handF: vec(CENTER_X + 1, 65.5),
  wpn: 0.1,
  flow: 0.12,
  // 3/4 views: the staff is held out to the side, clear of the face.
  zN: 5,
});

function pose(over: Partial<HumanPose>): HumanPose {
  return { ...READY, ...over };
}

const HIT = pose({
  root: vec(CENTER_X - 4, 66), lean: -0.32, head: -0.4,
  footN: vec(CENTER_X + 4.5, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y),
  handN: vec(CENTER_X + 3, 57), wpn: -0.25, handF: vec(CENTER_X + 2, 58),
  flow: 0.45, stretch: -0.04,
});

const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.28, ease: 'out', pose: pose({
    root: vec(CENTER_X - 3, 65.8), lean: -0.2, head: 0.05,
    footN: vec(CENTER_X + 7, GROUND_Y), footF: vec(CENTER_X - 6.5, GROUND_Y),
    handN: vec(CENTER_X - 1, 51), wpn: -0.62, handF: vec(CENTER_X + 9, 58),
    flow: 0.2, fx: 0.35, stretch: 0.03,
  }) },
  { at: 0.43, ease: 'in', pose: pose({
    root: vec(CENTER_X + 0.5, 66), lean: 0.08,
    footN: vec(CENTER_X + 9.5, GROUND_Y), footF: vec(CENTER_X - 6.5, GROUND_Y),
    handN: vec(CENTER_X + 9, 49), wpn: 0.55, handF: vec(CENTER_X + 5, 60),
    flow: 0.3, fx: 0.7,
  }) },
  { at: 0.571, ease: 'linear', pose: pose({
    root: vec(CENTER_X + 3.5, 66.8), lean: 0.3, head: 0.08,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 13, 56), wpn: 1.2, handF: vec(CENTER_X - 2, 61),
    flow: 0.5, fx: 1, stretch: -0.03,
  }) },
  { at: 0.71, ease: 'out', pose: pose({
    root: vec(CENTER_X + 3, 66.8), lean: 0.3,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 12, 58), wpn: 1.35, handF: vec(CENTER_X - 1, 62),
    flow: 0.4, fx: 0.5,
  }) },
  { at: 0.86, pose: pose({ root: vec(CENTER_X + 0.5, 65.6), lean: 0.14, handN: vec(CENTER_X + 10, 59), wpn: 0.7, footN: vec(CENTER_X + 7, GROUND_Y), flow: 0.22, fx: 0.15 }) },
  { at: 1, pose: READY },
];

const CAST: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.36, ease: 'out', pose: pose({
    root: vec(CENTER_X - 1, 65.4), lean: -0.08, head: -0.22,
    footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 6.5, GROUND_Y),
    handN: vec(CENTER_X + 5, 44), wpn: 0.05, handF: vec(CENTER_X + 3, 50),
    flow: 0.35, fx: 0.9, stretch: 0.05,
  }) },
  { at: 0.5, ease: 'in', pose: pose({
    root: vec(CENTER_X + 2.5, 66.2), lean: 0.26, head: 0.05,
    footN: vec(CENTER_X + 10.5, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 11, 52), wpn: 0.85, handF: vec(CENTER_X + 17, 56),
    flow: 0.55, fx: 1,
  }) },
  { at: 0.72, pose: pose({
    root: vec(CENTER_X + 2, 66), lean: 0.2,
    footN: vec(CENTER_X + 10.5, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 10, 54), wpn: 0.7, handF: vec(CENTER_X + 14, 58),
    flow: 0.3, fx: 0.45,
  }) },
  { at: 1, pose: READY },
];

const HURT: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.33, pose: pose({ ...HIT, root: vec(CENTER_X - 4.5, 66.4), lean: -0.24, head: -0.25, flow: 0.35 }) },
  { at: 1, pose: READY },
];

/** Low arcane leap: crouch, skim forward with robes streaming, land. */
const DODGE: Key<HumanPose>[] = [
  { at: 0, pose: pose({
    root: vec(CENTER_X - 1, 70), lean: 0.35, head: 0.1,
    footN: vec(CENTER_X + 6, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 5, 64), wpn: 0.9, handF: vec(CENTER_X + 3, 67), flow: 0.3, fx: 0.3,
  }) },
  { at: 0.25, ease: 'out', pose: pose({
    root: vec(CENTER_X + 2, 60), lean: 0.62, head: -0.1,
    footN: vec(CENTER_X + 1, 82), footF: vec(CENTER_X - 9, 80),
    handN: vec(CENTER_X + 10, 57), wpn: 1.2, handF: vec(CENTER_X - 7, 58), flow: 0.95, fx: 0.8, stretch: 0.04,
  }) },
  { at: 0.5, pose: pose({
    root: vec(CENTER_X + 3, 59), lean: 0.55, head: -0.05,
    footN: vec(CENTER_X + 4, 80), footF: vec(CENTER_X - 7, 81),
    handN: vec(CENTER_X + 10, 58), wpn: 1.1, handF: vec(CENTER_X - 7, 59), flow: 1, fx: 1,
  }) },
  { at: 0.75, ease: 'in', pose: pose({
    root: vec(CENTER_X + 2, 71), lean: 0.3, head: 0.12,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 5, GROUND_Y),
    handN: vec(CENTER_X + 8, 64), wpn: 0.8, handF: vec(CENTER_X - 2, 66), flow: 0.5, fx: 0.4, stretch: -0.05,
  }) },
  { at: 1, pose: READY },
];

/** Crumples to the knees and pitches forward onto the ground. */
const DEATH: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.25, pose: pose({ ...HIT, root: vec(CENTER_X - 3, 70), lean: 0.1, head: 0.4, handN: vec(CENTER_X + 4, 64), wpn: 0.6 }) },
  { at: 0.5, pose: pose({
    root: vec(CENTER_X - 1, 77), lean: 0.35, head: 0.5,
    footN: vec(CENTER_X + 3, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 8, 76), wpn: 1.2, handF: vec(CENTER_X + 6, 78), flow: 0.2,
  }) },
  { at: 0.75, ease: 'in', pose: pose({
    root: vec(CENTER_X - 1, 82), spin: 0.95, lean: 0.1, head: 0.2,
    footN: vec(CENTER_X - 3, 103), footF: vec(CENTER_X - 7, 101),
    handN: vec(CENTER_X + 8, 70), wpn: 0.9, handF: vec(CENTER_X + 5, 72), flow: 0.6,
  }) },
  { at: 1, ease: 'out', pose: pose({
    root: vec(CENTER_X - 2, 86.5), spin: 1.5, lean: 0, head: 0.25,
    footN: vec(CENTER_X - 2.5, 110), footF: vec(CENTER_X - 4, 109.5),
    handN: vec(CENTER_X + 6, 66), wpn: 0.1, handF: vec(CENTER_X + 3, 70), flow: 0.05,
  }) },
];

function idlePose(t: number): HumanPose {
  const ph = t * Math.PI * 2;
  const b = Math.sin(ph);
  return pose({
    root: vec(READY.root.x, READY.root.y + b * 0.5),
    stretch: b * -0.012,
    head: READY.head + Math.sin(ph - 0.7) * 0.035,
    handN: vec(READY.handN.x, READY.handN.y + b * 0.35),
    handF: vec(READY.handF.x + Math.sin(ph) * 0.6, READY.handF.y - 0.5 + Math.sin(ph - 0.4) * 0.8),
    wpn: READY.wpn + Math.sin(ph - 0.3) * 0.025,
    flow: 0.12 + Math.sin(ph) * 0.06,
    fx: 0.25 + 0.15 * Math.sin(ph),
  });
}

function walkPose(t: number): HumanPose {
  const g = gait(t, { stride: 6, lift: 3.2, bob: 1.1, rootY: 65.2, footSpread: 0.6 });
  const ph = t * Math.PI * 2;
  return pose({
    root: vec(CENTER_X - 0.5, g.rootY),
    lean: 0.08,
    head: -0.03,
    footN: g.footN,
    footF: g.footF,
    // Staff is planted like a walking stick in rhythm with the stride.
    handN: vec(CENTER_X + 4 - g.swing * 2.2, 60.5 + Math.abs(Math.sin(ph)) * 0.6),
    wpn: 0.12 - g.swing * 0.1,
    handF: vec(CENTER_X + 1 + g.swing * 3, 65 - Math.abs(g.swing) * 0.8),
    flow: 0.34 + Math.sin(ph * 2) * 0.08,
    fx: 0.25,
  });
}

function magePose(act: PlayerAction, t: number): HumanPose {
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

function crystalOf(p: HumanPose, t: number, view: HumanView): V {
  const sk = solveViewSkeleton(p, MAGE_PROP, MAGE_VIEW_SKIN.build, view);
  return itemPoint(sk, p.wpn, STAFF_UP + 3.4 - Math.sin(t * Math.PI * 4) * 0.6);
}

/** Screen point `len` along an item held in the main hand at pose angle `angle`. */
function itemPoint(sk: ViewSkeleton, angle: number, len: number): V {
  const { ang, k } = sk.rig.dir(angle, STAFF_LAT);
  return vec(sk.handN.x + Math.sin(ang) * k * len, sk.handN.y - Math.cos(ang) * k * len);
}

function drawFx(ctx: CanvasRenderingContext2D, act: PlayerAction, t: number, p: HumanPose, view: HumanView): void {
  const sk = solveViewSkeleton(p, MAGE_PROP, MAGE_VIEW_SKIN.build, view);
  const crystal = crystalOf(p, t, view);
  const alive = act !== 'death' || t < 0.7;
  // Crystal always hums; brighter when channelling.
  if (alive) {
    const H = sk.skull;
    if (H.vis(0.2) > 0.1) {
      for (const phi of [-0.2, 0.52]) {
        if (H.vis(phi) > 0.05) glow(ctx, H.at(1.1, phi, 6.5, 6), 2, ARCANE_HOT, 0.45 + p.fx * 0.3);
      }
    }
    glow(ctx, crystal, 6 + p.fx * 8, ARCANE, 0.35 + p.fx * 0.4);
    glow(ctx, crystal, 2.5 + p.fx * 3, ARCANE_HOT, 0.6 + p.fx * 0.35);
  }
  if (act === 'attack' && p.fx > 0.3) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const sp = samplePoseTrack(ATTACK, Math.max(0, t - i * 0.022));
      const ssk = solveViewSkeleton(sp, MAGE_PROP, MAGE_VIEW_SKIN.build, view);
      tips.push(itemPoint(ssk, sp.wpn, STAFF_UP + 3.4 - Math.sin(t * Math.PI * 4) * 0.6));
      bases.push(itemPoint(ssk, sp.wpn, 10));
    }
    smear(ctx, tips, bases, ARCANE, 0.5 * p.fx);
  }
  if ((act === 'cast' || act === 'attack') && p.fx > 0.6) {
    // Orbiting motes around the crystal
    for (let i = 0; i < 5; i++) {
      const a = t * 9 + i * (Math.PI * 2 / 5);
      glow(ctx, vec(crystal.x + Math.cos(a) * 5.5, crystal.y + Math.sin(a) * 2.4), 1.5, ARCANE_HOT, 0.9 * p.fx);
    }
  }
  if (act === 'cast' && p.fx > 0.05) {
    // Palm flare on the off hand and a rune ring at the feet.
    glow(ctx, sk.handF, 4 + p.fx * 5, ARCANE, 0.6 * p.fx);
    const g = sk.rig.pt(p.root.x + 1, GROUND_Y);
    ctx.save();
    ctx.globalAlpha = 0.75 * p.fx;
    ctx.strokeStyle = '#b89bff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(g.x, GROUND_Y, 12 + p.fx * 3, 3.6 + p.fx, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([1.5, 2]);
    ctx.beginPath();
    ctx.ellipse(g.x, GROUND_Y, 9, 2.6, 0, t * 6, t * 6 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (act === 'dodge' && p.fx > 0.4) {
    const back = sk.rig.fwd;
    const r = sk.rig.pt(p.root.x, p.root.y);
    for (let i = 0; i < 4; i++) {
      const d = 6 + i * 4;
      glow(ctx, vec(r.x - back.x * d, r.y - back.y * d + 4 + Math.sin(i * 1.7) * 3), 2.4, ARCANE, 0.5 * p.fx * (1 - i / 4));
    }
  }
}

export const PlayerMageDrawer: EntityDrawer = {
  key: 'player_mage',
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
    const p = magePose(act, t);
    const palette = getCurrentZonePalette();
    const lift = Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y));
    let shadowX = p.root.x + 1;
    renderRigFrame(
      ctx, w, h,
      c => { shadowX = drawHumanoidView(c, p, MAGE_VIEW_SKIN, t, v).rig.pt(p.root.x + 1, GROUND_Y).x; },
      { glowColor: palette.playerOutlineColor, glowBlur: standardOutlineBlur(w, h), scale: MAGE_SCALE },
      c => groundShadow(c, shadowX, 13, lift),
      c => drawFx(c, act, t, p, v),
    );
  },
};
