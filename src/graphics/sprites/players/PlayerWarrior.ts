// src/graphics/sprites/players/PlayerWarrior.ts
//
// 渊火骑士 — plate-armoured knight in a crimson tabard and cape, plumed great
// helm with an ember-lit visor, broadsword and heater shield. Drawn in two
// isometric 3/4 views (se front, ne back; mirrored for sw/nw) by projecting
// the shared humanoid keyframes through rig/HumanView.
import type { EntityDrawer, PlayerAction, PlayerView } from '../types';
import { PLAYER_ACTION_FRAME_COUNTS, PLAYER_SHEET_FRAMES, PLAYER_VIEWS } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  blobPath,
  capsulePath,
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
  showsFront,
  solveViewSkeleton,
  strokeLine,
  v3,
  type HumanView,
  type HumanViewSkin,
  type Ring,
  type ViewPart,
  type ViewSkeleton,
} from '../rig/HumanView';
import { getCurrentZonePalette, standardOutlineBlur } from '../../ZonePalette';

// ── Palette ─────────────────────────────────────────────────────────────
const STEEL = tone(0x9aa6ba, { light: 0.45 });
const STEEL_FAR = tone(0x6c7688, { light: 0.25 });
const IRON = tone(0x4b5366);
const IRON_FAR = tone(0x363c4b);
const GOLD = tone(0xd9a640, { light: 0.5 });
const CRIMSON = tone(0xa82230);
const CRIMSON_IN = tone(0x62131d, { light: 0.15 });
const LEATHER = tone(0x5e3a22);
const BLADE = tone(0xc9d3e2, { light: 0.6, shadow: 0.3 });
const EMBER = 0xff8a2a;

const BLADE_LEN = 27;
/** Figure size within the 96-unit frame. */
const WARRIOR_SCALE = 1.18;

// ── Skin ────────────────────────────────────────────────────────────────

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const plate = far ? STEEL_FAR : STEEL;
  const under = far ? IRON_FAR : IRON;
  limb(ctx, sh, el, 3.4, 3, under);
  limb(ctx, lerpV(sh, el, 0.35), el, 3.2, 2.9, plate);
  limb(ctx, el, hand, 3, 2.6, plate);
  cel(ctx, () => ellipsePath(ctx, el, 2.4, 2.4), under, { band: 0.7 });
}

function fist(ctx: CanvasRenderingContext2D, hand: V, far: boolean): void {
  cel(ctx, () => ellipsePath(ctx, hand, 2.8, 2.6), far ? IRON_FAR : IRON, { band: 0.9 });
  ctx.fillStyle = far ? STEEL_FAR.light : STEEL.light;
  ctx.fillRect(hand.x - 1.6, hand.y - 1.8, 2.6, 0.9);
}

function pauldron(ctx: CanvasRenderingContext2D, sh: V, lean: number, far: boolean): void {
  const plate = far ? STEEL_FAR : STEEL;
  ctx.save();
  ctx.translate(sh.x, sh.y);
  ctx.rotate(lean * 0.6);
  // Three layered lames, top one biggest.
  for (let i = 2; i >= 0; i--) {
    const y = i * 2.4;
    cel(ctx, () => ellipsePath(ctx, vec(0.3, y), 5.6 - i * 0.7, 3.6 - i * 0.4), i === 0 ? plate : (far ? IRON_FAR : IRON), { band: 1 });
  }
  ctx.strokeStyle = GOLD.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0.3, 0, 5.2, 3.2, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  ctx.restore();
}

function sword(ctx: CanvasRenderingContext2D, hand: V, angle: number, fx: number): void {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  // Blade (points toward local −y)
  const blade = [vec(-1.5, -2.2), vec(1.5, -2.2), vec(1.2, -BLADE_LEN + 4), vec(0, -BLADE_LEN), vec(-1.2, -BLADE_LEN + 4)];
  cel(ctx, () => polyPath(ctx, blade), BLADE, { band: 0.8, hi: 0.5 });
  ctx.strokeStyle = 'rgba(70,80,100,0.8)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(0, -BLADE_LEN + 5);
  ctx.stroke();
  if (fx > 0.05) {
    ctx.fillStyle = `rgba(255,170,80,${fx * 0.55})`;
    ctx.beginPath();
    polyPath(ctx, blade);
    ctx.fill();
  }
  // Crossguard with down-swept quillons
  cel(ctx, () => polyPath(ctx, [
    vec(-4.8, -1.2), vec(-3.8, -2.6), vec(3.8, -2.6), vec(4.8, -1.2), vec(3.8, -0.6), vec(-3.8, -0.6),
  ]), GOLD, { band: 0.5 });
  // Grip + pommel
  cel(ctx, () => capsulePath(ctx, vec(0, -0.6), vec(0, 3.6), 0.95, 0.95), LEATHER, { band: 0.4 });
  cel(ctx, () => ellipsePath(ctx, vec(0, 4.6), 1.5, 1.5), GOLD, { band: 0.5 });
  ctx.fillStyle = '#ff7a26';
  ctx.fillRect(-0.5, 4.1, 1, 1);
  ctx.restore();
}

const WARRIOR_PROP: Proportions = {
  thigh: 12.5, shin: 12, upperArm: 10, foreArm: 9.5,
  torso: 16.5, neck: 7.2, ankle: 2.6,
  hipN: vec(2.2, 0), hipF: vec(-2.6, -0.4),
  shN: vec(1.6, 4), shF: vec(-4.6, 3),
};

// ── Isometric 3/4 views (se = front, ne = back) ─────────────────────────

/** Breastplate loft, pelvis (h = 0) up to the gorget. */
function cuirassRings(len: number): Ring[] {
  return [
    { h: len + 0.8, a: 2.8, b: 4 },
    { h: len - 1.6, a: 4.4, b: 6.6, f: 0.3 },
    { h: len - 5, a: 4.7, b: 6.3, f: 0.8 },
    { h: len - 9.5, a: 4, b: 5.2, f: 0.5 },
    { h: 3.4, a: 3.5, b: 4.7 },
    { h: 1.2, a: 3.8, b: 5 },
  ];
}

const SKIRT_RINGS: Ring[] = [
  { h: 2.4, a: 3.8, b: 5 },
  { h: -1.5, a: 4.5, b: 5.8 },
  { h: -4.2, a: 5, b: 6.3, f: -0.2 },
];

function viewLeg(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, near: boolean): void {
  const far = !near;
  const plate = far ? STEEL_FAR : STEEL;
  const under = far ? IRON_FAR : IRON;
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  limb(ctx, hip, knee, 4.4, 3.7, under);
  cel(ctx, () => capsulePath(ctx, lerpV(hip, knee, 0.15), lerpV(hip, knee, 0.85), 3.9, 3.2), plate, { band: 1.2 });
  limb(ctx, knee, ankle, 3.5, 2.7, plate);
  // Knee cop sits on the front of the knee.
  const f = sk.rig.fwd;
  const cop = vec(knee.x + f.x * 1.1, knee.y + f.y * 1.1 - 0.2);
  cel(ctx, () => ellipsePath(ctx, cop, 3.1, 2.6), plate, { band: 0.9 });
  ctx.fillStyle = far ? GOLD.shade : GOLD.base;
  ctx.fillRect(cop.x - 0.55, cop.y - 0.5, 1.1, 1.1);
  const j = near ? sk.j.footN : sk.j.footF;
  const sole = near ? sk.j.soleN : sk.j.soleF;
  cel(ctx, () => polyPath(ctx, footOutline(sk.rig, j, sole, 6.2, 3, 5.4, 2.2)), plate, { band: 1 });
}

function viewArm(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, near: boolean): void {
  if (near) arm(ctx, sk.shN, sk.elN, sk.handN, false);
  else {
    arm(ctx, sk.shF, sk.elF, sk.handF, true);
    fist(ctx, sk.handF, true);
  }
}

function viewPauldron(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, near: boolean): void {
  const sh = near ? sk.shN : sk.shF;
  const front = showsFront(sk.torso);
  const tilt = sk.torsoAng + (near ? -0.25 : 0.25) * (front ? 1 : -1);
  if (front) {
    // Lift the dome onto the top of the shoulder.
    pauldron(ctx, vec(sh.x, sh.y - 1), tilt, !near);
    return;
  }
  // Back view: a smaller dome pushed out over the arm, so it caps the
  // shoulder without hiding the cape's shoulder line.
  const out = sk.rig.side;
  const sgn = near ? 1 : -1;
  const c = vec(sh.x + out.x * sgn * 2.4, sh.y + out.y * sgn * 2.4 - 0.2);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(0.78, 0.78);
  pauldron(ctx, vec(0, 0), tilt, !near);
  ctx.restore();
}

function viewCuirass(ctx: CanvasRenderingContext2D, sk: ViewSkeleton): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const rings = cuirassRings(len);
  const front = T.vis(0) > -0.05;
  // Mail skirt under the plate
  const skirt = T.loft(SKIRT_RINGS);
  cel(ctx, () => midpointPath(ctx, skirt), IRON, { band: 1 });
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, skirt);
  ctx.clip();
  for (let h = 0.8; h > -4.4; h -= 1.3) {
    for (const run of T.visibleArcs(ringAt(SKIRT_RINGS, h), 0, Math.PI * 2, 24, -0.2)) strokeLine(ctx, run, IRON.shade, 0.35);
  }
  ctx.restore();
  // Breastplate / backplate
  const shell = T.loft(rings);
  cel(ctx, () => midpointPath(ctx, shell), STEEL, { band: 1.8, hi: 0.8 });
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, shell);
  ctx.clip();
  const ridge: V[] = [];
  const spinePhi = front ? 0 : Math.PI;
  for (let h = len - 1.8; h >= 4.2; h -= 1.2) {
    const r = ringAt(rings, h);
    ridge.push(T.at(h, spinePhi, r.a, r.b, r.f));
  }
  strokeLine(ctx, ridge, front ? STEEL.light : STEEL.shade, front ? 0.9 : 0.6);
  // Side seams where front and back plates meet
  for (const side of [-1, 1]) {
    const seam: V[] = [];
    for (let h = len - 2; h >= 3.6; h -= 1.5) {
      const r = ringAt(rings, h);
      if (T.vis(side * Math.PI / 2, r.a, r.b) > 0.05) seam.push(T.at(h, side * Math.PI / 2, r.a, r.b, r.f));
    }
    strokeLine(ctx, seam, STEEL.shade, 0.5);
  }
  // Gold-trimmed fauld band
  for (const run of T.visibleArcs(ringAt(rings, 4.4), 0, Math.PI * 2, 28, -0.2)) strokeLine(ctx, run, GOLD.base, 0.8);
  if (front) {
    // Ember sigil on the chest
    const c = T.at(len - 6, 0.12, 4.7, 6.3, 0.9);
    ctx.fillStyle = 'rgba(255,138,42,0.9)';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 2.2);
    ctx.quadraticCurveTo(c.x + 1.5, c.y, c.x + 0.2, c.y + 2.1);
    ctx.quadraticCurveTo(c.x - 1.1, c.y + 0.4, c.x, c.y - 2.2);
    ctx.fill();
  }
  ctx.restore();
  // Belt with buckle
  const belt = ringAt(SKIRT_RINGS, 1.6);
  for (const run of T.visibleArcs({ ...belt, a: belt.a + 0.2, b: belt.b + 0.2 }, 0, Math.PI * 2, 28, -0.15)) {
    strokeLine(ctx, run, LEATHER.line, 2.9);
    strokeLine(ctx, run, LEATHER.base, 2.1);
  }
  const buckleVis = T.vis(front ? 0.35 : Math.PI);
  if (buckleVis > 0 && front) {
    const b = T.at(1.6, 0.35, belt.a + 0.3, belt.b + 0.3);
    cel(ctx, () => polyPath(ctx, [vec(b.x - 1.5, b.y - 1.6), vec(b.x + 1.5, b.y - 1.6), vec(b.x + 1.5, b.y + 1.6), vec(b.x - 1.5, b.y + 1.6)]), GOLD, { band: 0.5 });
  }
  // Gorget
  const g = T.loft([{ h: len + 1.6, a: 2.4, b: 3.3 }, { h: len - 0.6, a: 3.4, b: 4.6 }]);
  cel(ctx, () => midpointPath(ctx, g), IRON, { band: 0.8 });
}

/** Tabard panel hanging from the belt, front (φ = 0) or back (φ = π). */
function viewTabard(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number, back: boolean): void {
  const T = sk.torso;
  const phi = back ? Math.PI : 0;
  const sway = Math.sin(t * Math.PI * 2) * 0.6 - p.flow * 3;
  const top = ringAt(SKIRT_RINGS, 2);
  const tl = T.p3(2, phi - 0.62, top.a + 0.5, top.b + 0.5);
  const tr = T.p3(2, phi + 0.62, top.a + 0.5, top.b + 0.5);
  const out = back ? -1 : 1;
  const hang = (q: typeof tl, dy: number, dx: number, dz = 0) => sk.rig.pt(q.x + dx, q.y + dy, q.z + dz);
  const len = back ? 12.5 : 14.5;
  const pts = [
    sk.rig.p(tl),
    sk.rig.p(tr),
    hang(tr, len - 1.5, out * 1.2 + sway * 0.6, 0.2),
    hang(v3((tl.x + tr.x) / 2, (tl.y + tr.y) / 2, (tl.z + tr.z) / 2), len + 1.5, out * 1.4 + sway),
    hang(tl, len - 1.5, out * 1.2 + sway * 0.8, -0.2),
  ];
  const showFace = T.vis(phi) > -0.1;
  cel(ctx, () => polyPath(ctx, pts), showFace && !back ? CRIMSON : CRIMSON_IN, { band: 1.1 });
  if (!back) {
    ctx.strokeStyle = GOLD.base;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    const a = lerpV(pts[2], pts[1], 0.08);
    const b = lerpV(pts[4], pts[0], 0.08);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(pts[3].x, pts[3].y - 1);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function capeGeometry(sk: ViewSkeleton, p: HumanPose, t: number): { left: V[]; right: V[]; hem: V[]; outer: boolean } {
  const T = sk.torso;
  const len = sk.torsoLen;
  const anchor = T.p3(len - 1.2, Math.PI, 3.4, 0);
  const chain = clothChain(vec(anchor.x, anchor.y), 25, 6, p.flow, 1, t * Math.PI * 2);
  const left: V[] = [];
  const right: V[] = [];
  let hem: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    const half = 8 + k * 2.6;
    // U-shaped cross-section: the edges curl forward round the body (most
    // at the shoulders), so the cape keeps some body even seen edge-on.
    const curl = 3.4 * (1 - k) * (1 - k) + 2;
    const ripple = Math.sin(t * Math.PI * 2 + k * 3) * 0.5 * k;
    const row = [-1, -0.5, 0, 0.5, 1].map(u => sk.rig.pt(pt.x + curl * u * u, pt.y + ripple * u, u * half));
    let lo = row[0];
    let hi = row[0];
    for (const q of row) {
      if (q.x < lo.x) lo = q;
      if (q.x > hi.x) hi = q;
    }
    left.push(lo);
    right.push(hi);
    if (i === chain.length - 1) hem = row;
  });
  return { left, right, hem, outer: sk.rig.facing(-1, 0, 0) > 0 };
}

function viewCape(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const { left, right, hem, outer } = capeGeometry(sk, p, t);
  const outline = [...left, ...[...right].reverse()];
  cel(ctx, () => midpointPath(ctx, outline), outer ? CRIMSON : CRIMSON_IN, { band: 1.4 });
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, outline);
  ctx.clip();
  if (outer) {
    // Fold shadows running down the back of the cape
    for (const k of [0.33, 0.66]) {
      const a = lerpV(left[1], right[1], k);
      const b = lerpV(left[left.length - 1], right[right.length - 1], k + (k - 0.5) * 0.3);
      strokeLine(ctx, [a, b], CRIMSON.shade, 0.9);
    }
  }
  // Gold hem, kept inside the cape so an edge-on cape doesn't sprout a stick.
  strokeLine(ctx, hem.map(q => vec(q.x, q.y - 0.6)), outer ? GOLD.base : GOLD.shade, 1.1);
  ctx.restore();
}

const HELM_RINGS: Ring[] = [
  { h: 8.2, a: 1.6, b: 1.5 },
  { h: 6.6, a: 5.2, b: 4.8 },
  { h: 3, a: 6.8, b: 6 },
  { h: -1.5, a: 7, b: 6.1, f: 0.3 },
  { h: -5.2, a: 6.2, b: 5.6, f: 0.9 },
  { h: -7.2, a: 4.2, b: 4.2, f: 1.4 },
];

function viewPlume(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const H = sk.skull;
  const sway = Math.sin(t * Math.PI * 2) * 0.8 + p.flow * 3;
  // Side-view plume points (x = forward, y = down) mapped onto the helm's
  // mid-plane: a crest of feathers streaming back from the crown.
  const src = [
    vec(-1, -7.8), vec(2, -9.6), vec(-3, -10.4 - sway * 0.2), vec(-9 - sway, -8.5),
    vec(-13 - sway * 1.4, -4 + sway * 0.3), vec(-9 - sway, -5.2), vec(-4, -6.2),
  ];
  const pts = src.map(q => H.at(-q.y * 1.08, 0, 0, 0, q.x * 1.15));
  cel(ctx, () => blobPath(ctx, pts), CRIMSON, { band: 1.2 });
}

function viewHelm(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const H = sk.skull;
  // Follows the spin, so the plume swaps sides of the helm mid-roll.
  const plumeBehind = showsFront(H);
  if (plumeBehind) viewPlume(ctx, sk, p, t);
  const shell = H.loft(HELM_RINGS);
  cel(ctx, () => midpointPath(ctx, shell), STEEL, { band: 1.9, hi: 0.9 });
  ctx.save();
  ctx.beginPath();
  midpointPath(ctx, shell);
  ctx.clip();
  // Brow band wraps the helm
  for (const run of H.visibleArcs(ringAt(HELM_RINGS, 2.6), 0, Math.PI * 2, 30, -0.25)) {
    strokeLine(ctx, run, GOLD.line, 1.9);
    strokeLine(ctx, run, GOLD.base, 1.3);
  }
  if (H.vis(0) > -0.25) {
    // T-visor slit with the ember behind it
    const slit = ringAt(HELM_RINGS, 0.1);
    for (const run of H.visibleArcs({ ...slit, a: slit.a + 0.1, b: slit.b + 0.1 }, -0.62, 0.95, 12, -0.1)) {
      strokeLine(ctx, run, '#0c0a12', 1.7);
    }
    const bar: V[] = [];
    for (let h = 0.1; h >= -4.6; h -= 1.1) {
      const r = ringAt(HELM_RINGS, h);
      bar.push(H.at(h, 0.12, r.a + 0.1, r.b + 0.1, r.f));
    }
    strokeLine(ctx, bar, '#0c0a12', 1.5);
    const ember = H.visibleArcs({ ...slit, a: slit.a + 0.15, b: slit.b + 0.15 }, -0.25, 0.55, 6, 0);
    for (const run of ember) {
      strokeLine(ctx, run, `rgba(255,${150 + Math.round(p.fx * 60)},60,${0.75 + p.fx * 0.25})`, 0.8);
    }
    // Breaths on the near cheek
    ctx.fillStyle = IRON.shade;
    for (let i = 0; i < 3; i++) {
      const r = ringAt(HELM_RINGS, -3 - i * 0.6);
      const phi = 0.75 + i * 0.12;
      if (H.vis(phi) > 0.1) {
        const q = H.at(-3 - i * 0.6, phi, r.a, r.b, r.f);
        ctx.fillRect(q.x - 0.3, q.y - 0.3, 0.6, 0.6);
      }
    }
  } else {
    // Back of the helm: a riveted seam down the nape
    const seam: V[] = [];
    for (let h = 6; h >= -6; h -= 1.5) {
      const r = ringAt(HELM_RINGS, h);
      seam.push(H.at(h, Math.PI, r.a, r.b, r.f));
    }
    strokeLine(ctx, seam, STEEL.shade, 0.7);
    ctx.fillStyle = STEEL.light;
    for (const h of [-1.5, -4]) {
      const r = ringAt(HELM_RINGS, h);
      for (const phi of [Math.PI - 0.5, Math.PI + 0.5]) {
        if (H.vis(phi) > 0.1) {
          const q = H.at(h, phi, r.a, r.b, r.f);
          ctx.fillRect(q.x - 0.4, q.y - 0.4, 0.8, 0.8);
        }
      }
    }
  }
  ctx.restore();
  if (!plumeBehind) viewPlume(ctx, sk, p, t);
}

function viewSword(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  inItem(ctx, sk.rig, sk.handN, p.wpn, () => sword(ctx, vec(0, 0), 0, p.fx));
  fist(ctx, sk.handN, false);
}

/** Shield plane: faces forward, turned in across the chest by `SHIELD_TURN`. */
const SHIELD_TURN = 0.3;

function shieldFrame(sk: ViewSkeleton, p: HumanPose): { at: (x: number, y: number) => V; faceUp: boolean; c: V } {
  const n = v3(Math.cos(SHIELD_TURN), 0, Math.sin(SHIELD_TURN));
  // In-plane horizontal axis (screen-right-ish in the front view) and up.
  const w = v3(Math.sin(SHIELD_TURN), 0, -Math.cos(SHIELD_TURN));
  const h = sk.j.handF;
  const c = v3(h.x + 1.8 + n.x * 1.2, h.y + 1.2, h.z + n.z * 1.2);
  const co = Math.cos(p.off);
  const si = Math.sin(p.off);
  const at = (x: number, y: number): V => {
    const rx = x * co - y * si;
    const ry = x * si + y * co;
    return sk.rig.pt(c.x + w.x * rx, c.y + ry, c.z + w.z * rx);
  };
  return { at, faceUp: sk.rig.facing(n.x, n.y, n.z) > 0, c: sk.rig.p(c) };
}

function viewShield(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  const { at, faceUp } = shieldFrame(sk, p);
  const src = [
    vec(-6.8, -8.6), vec(0, -9.8), vec(6.8, -8.6), vec(6.6, 0.5), vec(3.6, 6.6), vec(0, 10.2), vec(-3.6, 6.6), vec(-6.6, 0.5),
  ];
  const outline = src.map(q => at(q.x, q.y));
  if (!faceUp) {
    // Back of the shield: iron rim, wooden boards, leather arm straps
    cel(ctx, () => blobPath(ctx, outline), IRON_FAR, { band: 1 });
    const inner = src.map(q => at(q.x * 0.84, q.y * 0.86));
    cel(ctx, () => blobPath(ctx, inner), LEATHER, { band: 1.2 });
    strokeLine(ctx, [at(-4, -2), at(4, -2)], LEATHER.line, 1.4);
    strokeLine(ctx, [at(-4, 3), at(4, 3)], LEATHER.line, 1.4);
    return;
  }
  cel(ctx, () => blobPath(ctx, outline), GOLD, { band: 1.1 });
  const inner = src.map(q => at(q.x * 0.8, q.y * 0.82 + 0.1));
  cel(ctx, () => blobPath(ctx, inner), CRIMSON, { band: 1.5 });
  // Flame emblem
  const e = (x: number, y: number): V => at(x, y);
  ctx.fillStyle = GOLD.base;
  ctx.beginPath();
  let q = e(0, -5.4); ctx.moveTo(q.x, q.y);
  const quad = (cx: number, cy: number, x: number, y: number): void => {
    const c1 = e(cx, cy); const p1 = e(x, y);
    ctx.quadraticCurveTo(c1.x, c1.y, p1.x, p1.y);
  };
  quad(3.4, -1.2, 2.4, 2.4);
  quad(1.6, 4.8, 0, 5.6);
  quad(-1.6, 4.8, -2.4, 2.4);
  quad(-2.8, -0.4, -1, -2.2);
  quad(-0.6, 0.4, 0.4, 0.8);
  quad(1.4, -2, 0, -5.4);
  ctx.fill();
  q = e(0.2, 2.8);
  const r1 = e(1.2, 2.8);
  ctx.fillStyle = '#ffcf6b';
  ctx.beginPath();
  ctx.ellipse(q.x, q.y, Math.max(0.4, Math.hypot(r1.x - q.x, r1.y - q.y)), 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeLine(ctx, [e(-5.6, -7.6), e(0, -8.6), e(5.6, -7.6)], 'rgba(255,240,210,0.45)', 0.7);
}

const WARRIOR_VIEW_SKIN: HumanViewSkin = {
  prop: WARRIOR_PROP,
  build: { hipW: 2.9, shW: 5.6, elbowOut: 1.3, footOut: 0.5 },
  parts(ctx, sk, p, t) {
    const d0 = sk.d.pelvis;
    const rig = sk.rig;
    const T = sk.torso;
    const capeZ = T.depth(sk.torsoLen - 6, Math.PI, 5, 0) - d0;
    const armZ = (near: boolean): number => (near
      ? sk.d.elN * 0.6 + sk.d.handN * 0.4
      : sk.d.elF * 0.6 + sk.d.handF * 0.4) - d0;
    const legZ = (near: boolean): number => -0.6 + 0.02 * ((near ? sk.d.kneeN + sk.d.footN : sk.d.kneeF + sk.d.footF) / 2 - d0);
    const headZ = Math.max(sk.d.head - d0 + 2.5, capeZ + 0.2);
    const shield = shieldFrame(sk, p);
    const shieldZ = Math.max(armZ(false) + 0.05, rig.d(sk.j.handF) - d0 + (shield.faceUp ? 1.5 : -0.5));
    // Only the tabard panel on the camera side is drawn: the other one would
    // just peek past the legs as an edge-on sliver.
    const front = showsFront(T);
    const parts: ViewPart[] = [
      { z: capeZ, draw: () => viewCape(ctx, sk, p, t) },
      { z: T.depth(-4, Math.PI, 5, 5) - d0, draw: () => { if (!front) viewTabard(ctx, sk, p, t, true); } },
      { z: legZ(true), draw: () => viewLeg(ctx, sk, true) },
      { z: legZ(false), draw: () => viewLeg(ctx, sk, false) },
      { z: 0, draw: () => viewCuirass(ctx, sk) },
      { z: T.depth(-4, 0, 5, 5) - d0, draw: () => { if (front) viewTabard(ctx, sk, p, t, false); } },
      { z: armZ(false), draw: () => viewArm(ctx, sk, false) },
      { z: Math.max(armZ(false), sk.d.shF - d0) + 0.01, draw: () => viewPauldron(ctx, sk, false) },
      { z: shieldZ, draw: () => viewShield(ctx, sk, p) },
      { z: armZ(true), draw: () => viewArm(ctx, sk, true) },
      { z: Math.max(armZ(true), sk.d.shN - d0, capeZ) + 0.01, draw: () => viewPauldron(ctx, sk, true) },
      { z: headZ, draw: () => viewHelm(ctx, sk, p, t) },
      { z: Math.max(armZ(true), sk.d.handN - d0) + 0.02, draw: () => viewSword(ctx, sk, p) },
    ];
    return parts;
  },
};

// ── Animation ───────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1, 64.6),
  lean: 0.07,
  head: -0.05,
  footN: vec(CENTER_X + 6, GROUND_Y),
  footF: vec(CENTER_X - 6.5, GROUND_Y),
  handN: vec(CENTER_X + 7.5, 64.5),
  handF: vec(CENTER_X + 3.5, 58),
  wpn: 1.95,
  off: 0.08,
  flow: 0.12,
  // 3/4 views: the shield is carried across the chest.
  zF: 1.4,
});

function pose(over: Partial<HumanPose>): HumanPose {
  return { ...READY, ...over };
}

const HIT = pose({
  root: vec(CENTER_X - 3.5, 65.8), lean: -0.34, head: -0.38,
  footN: vec(CENTER_X + 6.5, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
  handN: vec(CENTER_X + 2, 62), wpn: 1.2, handF: vec(CENTER_X, 55), off: -0.25,
  flow: 0.45, stretch: -0.04,
});

const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.28, ease: 'out', pose: pose({
    root: vec(CENTER_X - 3, 66.6), lean: -0.24, head: 0.04,
    footN: vec(CENTER_X + 8.5, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X - 5, 39.5), wpn: -0.9, handF: vec(CENTER_X + 6, 57), off: -0.12,
    flow: 0.25, stretch: 0.035,
  }) },
  { at: 0.43, ease: 'in', pose: pose({
    root: vec(CENTER_X + 0.5, 66.8), lean: 0.1, head: 0.05,
    footN: vec(CENTER_X + 10.5, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    handN: vec(CENTER_X + 8, 40.5), wpn: 0.75, handF: vec(CENTER_X + 2, 58),
    flow: 0.35, fx: 0.7, stretch: 0.02,
  }) },
  { at: 0.571, ease: 'linear', pose: pose({
    root: vec(CENTER_X + 4, 68), lean: 0.4, head: 0.1,
    footN: vec(CENTER_X + 13, GROUND_Y), footF: vec(CENTER_X - 7.5, GROUND_Y),
    handN: vec(CENTER_X + 17, 63), wpn: 2.25, handF: vec(CENTER_X - 1.5, 61), off: 0.2,
    flow: 0.55, fx: 1, stretch: -0.035,
  }) },
  { at: 0.71, ease: 'out', pose: pose({
    root: vec(CENTER_X + 3.5, 68.4), lean: 0.44, head: 0.08,
    footN: vec(CENTER_X + 13, GROUND_Y), footF: vec(CENTER_X - 7.5, GROUND_Y),
    handN: vec(CENTER_X + 13, 70), wpn: 2.5, handF: vec(CENTER_X, 61.5),
    flow: 0.45, fx: 0.35,
  }) },
  { at: 0.86, pose: pose({
    root: vec(CENTER_X + 1, 66.6), lean: 0.22, handN: vec(CENTER_X + 10, 66.5), wpn: 2.25,
    footN: vec(CENTER_X + 8, GROUND_Y), flow: 0.25,
  }) },
  { at: 1, pose: READY },
];

const CAST: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.36, ease: 'out', pose: pose({
    root: vec(CENTER_X - 1, 67.4), lean: -0.06, head: -0.2,
    footN: vec(CENTER_X + 7.5, GROUND_Y), footF: vec(CENTER_X - 7.5, GROUND_Y),
    handN: vec(CENTER_X + 5, 42), wpn: 0.12, handF: vec(CENTER_X - 7, 57), off: -0.35,
    flow: 0.18, fx: 0.9, stretch: 0.04,
  }) },
  { at: 0.5, ease: 'in', pose: pose({
    root: vec(CENTER_X + 2.5, 67), lean: 0.3, head: 0.05,
    footN: vec(CENTER_X + 11, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y),
    handN: vec(CENTER_X + 17, 52), wpn: 1.45, handF: vec(CENTER_X - 5, 59),
    flow: 0.5, fx: 1,
  }) },
  { at: 0.72, pose: pose({
    root: vec(CENTER_X + 2, 67), lean: 0.24, handN: vec(CENTER_X + 15, 54), wpn: 1.55,
    footN: vec(CENTER_X + 11, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y), handF: vec(CENTER_X - 4, 59),
    flow: 0.3, fx: 0.5,
  }) },
  { at: 1, pose: READY },
];

const HURT: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.33, pose: pose({ ...HIT, root: vec(CENTER_X - 4, 67.2), lean: -0.26, head: -0.22, flow: 0.35 }) },
  { at: 1, pose: READY },
];

const TUCK = (x: number, y: number, spin: number): HumanPose => pose({
  root: vec(x, y), spin, pivot: 0.5, lean: 0.7, head: 0.5,
  footN: vec(x + 6, y + 10), footF: vec(x + 3, y + 11),
  handN: vec(x + 7, y - 1), wpn: 2.6, handF: vec(x + 6, y - 5), off: 0.6,
  flow: 0.75, stretch: -0.08,
});

const DODGE: Key<HumanPose>[] = [
  { at: 0, pose: pose({
    root: vec(CENTER_X, 72), pivot: 0.5, lean: 0.55, head: 0.25,
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 6, GROUND_Y),
    handN: vec(CENTER_X + 9, 69), wpn: 2.4, handF: vec(CENTER_X + 8, 63), off: 0.3, flow: 0.35,
  }) },
  { at: 0.2, pose: TUCK(CENTER_X - 1, 73, 1.3) },
  { at: 0.4, ease: 'linear', pose: TUCK(CENTER_X, 71, 2.9) },
  { at: 0.6, ease: 'linear', pose: TUCK(CENTER_X + 0.5, 72, 4.5) },
  { at: 0.8, pose: pose({
    root: vec(CENTER_X + 2, 71), spin: 6.0, pivot: 0.5, lean: 0.4, head: 0.1,
    footN: vec(CENTER_X + 9, GROUND_Y), footF: vec(CENTER_X - 4, GROUND_Y),
    handN: vec(CENTER_X + 10, 67), wpn: 2.2, handF: vec(CENTER_X + 7, 61), flow: 0.45,
  }) },
  { at: 1, pose: { ...READY, spin: Math.PI * 2, pivot: 0.5 } },
];

const DEATH: Key<HumanPose>[] = [
  { at: 0, pose: HIT },
  { at: 0.2, pose: pose({ ...HIT, root: vec(CENTER_X - 5, 68), lean: -0.42, head: -0.45, handN: vec(CENTER_X - 1, 64), wpn: 1.8 }) },
  { at: 0.45, pose: pose({
    root: vec(CENTER_X - 3, 76.5), lean: 0.2, head: 0.4,
    footN: vec(CENTER_X + 5, GROUND_Y), footF: vec(CENTER_X - 7, GROUND_Y),
    handN: vec(CENTER_X + 3, 80), wpn: 2.7, handF: vec(CENTER_X - 1, 74), off: 0.4, flow: 0.2,
  }) },
  { at: 0.7, ease: 'in', pose: pose({
    root: vec(CENTER_X - 3, 82), spin: -0.95, lean: -0.1, head: -0.3,
    footN: vec(CENTER_X + 2, 104), footF: vec(CENTER_X - 3, 103),
    handN: vec(CENTER_X + 4, 76), wpn: 2.6, handF: vec(CENTER_X - 2, 74), flow: 0.6,
  }) },
  { at: 1, ease: 'out', pose: pose({
    root: vec(CENTER_X - 1, 86.5), spin: -1.52, lean: 0, head: -0.25,
    footN: vec(CENTER_X + 1, 111), footF: vec(CENTER_X - 1.5, 110.5),
    handN: vec(CENTER_X + 4, 80), wpn: 3.1, handF: vec(CENTER_X - 2, 78), off: 0.9, flow: 0.05,
  }) },
];

function idlePose(t: number): HumanPose {
  const ph = t * Math.PI * 2;
  const b = Math.sin(ph);
  return pose({
    root: vec(READY.root.x, READY.root.y + b * 0.55),
    stretch: b * -0.012,
    head: READY.head + Math.sin(ph - 0.6) * 0.03,
    handN: vec(READY.handN.x, READY.handN.y + b * 0.45),
    handF: vec(READY.handF.x, READY.handF.y + Math.sin(ph - 0.5) * 0.55),
    wpn: READY.wpn + Math.sin(ph - 0.3) * 0.03,
    flow: 0.12 + Math.sin(ph) * 0.05,
  });
}

function walkPose(t: number): HumanPose {
  const g = gait(t, { stride: 7, lift: 4.2, bob: 1.4, rootY: 64.9, footSpread: 1.2 });
  const ph = t * Math.PI * 2;
  return pose({
    root: vec(CENTER_X, g.rootY),
    lean: 0.11,
    head: -0.06,
    footN: g.footN,
    footF: g.footF,
    handN: vec(CENTER_X + 6.5 - g.swing * 3.2, 64.5 + Math.abs(g.swing) * 0.6),
    wpn: 1.95 - g.swing * 0.12,
    handF: vec(CENTER_X + 3.5 + g.swing * 1.8, 58 - Math.abs(Math.sin(ph)) * 0.8),
    flow: 0.38 + Math.sin(ph * 2) * 0.08,
    stretch: Math.abs(Math.sin(ph)) * 0.015,
  });
}

function warriorPose(act: PlayerAction, t: number): HumanPose {
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

/**
 * Back view: the guard pose's sword points along the forward axis, which in
 * ne projects to a flat bar jutting out to the right. Near rest, let it hang
 * down and a little back beside the leg instead. Weighted by how close the
 * pose is to the guard angle, so swings keep their keyframes and there's no
 * pop going into or out of an attack.
 */
function viewPose(p: HumanPose, view: HumanView): HumanPose {
  if (view !== 'ne') return p;
  const w = Math.max(0, 1 - Math.abs(p.wpn - READY.wpn) / 0.7) * (1 - Math.min(1, p.fx * 2));
  if (w <= 0) return p;
  return {
    ...p,
    wpn: p.wpn + (3.3 - READY.wpn) * w,
    handN: vec(p.handN.x - 2.5 * w, p.handN.y - 1.5 * w),
    zN: (p.zN ?? 0) + 1.2 * w,
  };
}

function swordTip(p: HumanPose, view: HumanView): { tip: V; base: V } {
  const sk = solveViewSkeleton(p, WARRIOR_PROP, WARRIOR_VIEW_SKIN.build, view);
  const { ang, k } = sk.rig.dir(p.wpn);
  const d = vec(Math.sin(ang) * k, -Math.cos(ang) * k);
  return {
    tip: vec(sk.handN.x + d.x * BLADE_LEN, sk.handN.y + d.y * BLADE_LEN),
    base: vec(sk.handN.x + d.x * 5, sk.handN.y + d.y * 5),
  };
}

function drawFx(ctx: CanvasRenderingContext2D, act: PlayerAction, t: number, p: HumanPose, view: HumanView): void {
  const track = act === 'attack' ? ATTACK : act === 'cast' ? CAST : null;
  if (track && p.fx > 0.3) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const sp = viewPose(samplePoseTrack(track, Math.max(0, t - i * 0.022)), view);
      const { tip, base } = swordTip(sp, view);
      tips.push(tip);
      bases.push(base);
    }
    smear(ctx, tips, bases, act === 'cast' ? EMBER : 0xdfe8ff, 0.55 * p.fx);
  }
  if (act === 'cast' && p.fx > 0.05) {
    const { tip, base } = swordTip(p, view);
    glow(ctx, lerpV(base, tip, 0.55), 11 * p.fx, EMBER, 0.55 * p.fx);
    glow(ctx, tip, 6 * p.fx, 0xffd08a, 0.8 * p.fx);
    // Embers spiralling up the blade
    for (let i = 0; i < 6; i++) {
      const k = (i / 6 + t * 1.7) % 1;
      const pt = lerpV(base, tip, k);
      glow(ctx, vec(pt.x + Math.sin(i * 2.1 + t * 9) * 2.6, pt.y - k * 2), 1.6, 0xffb060, 0.9 * p.fx);
    }
  }
  // Visor ember (only while the visor faces the camera)
  const sk = solveViewSkeleton(p, WARRIOR_PROP, WARRIOR_VIEW_SKIN.build, view);
  const H = sk.skull;
  if (H.vis(0.2) > 0.1 && (act !== 'death' || t < 0.6)) {
    const visor = H.at(0.1, 0.2, 7.2, 6.3, 0.3);
    glow(ctx, visor, 3.2, EMBER, (0.45 + p.fx * 0.3) * Math.min(1, H.vis(0.2) * 2));
  }
}

export const PlayerWarriorDrawer: EntityDrawer = {
  key: 'player_warrior',
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
    const p = viewPose(warriorPose(act, t), v);
    const palette = getCurrentZonePalette();
    const lift = Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y));
    let shadowX = p.root.x + 1;
    renderRigFrame(
      ctx, w, h,
      c => { shadowX = drawHumanoidView(c, p, WARRIOR_VIEW_SKIN, t, v).rig.pt(p.root.x + 1, GROUND_Y).x; },
      { glowColor: palette.playerOutlineColor, glowBlur: standardOutlineBlur(w, h), scale: WARRIOR_SCALE },
      c => groundShadow(c, shadowX, 15, lift),
      c => drawFx(c, act, t, p, v),
    );
  },
};
