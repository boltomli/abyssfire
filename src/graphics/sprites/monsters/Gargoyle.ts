// src/graphics/sprites/monsters/Gargoyle.ts
//
// 石像鬼 — a winged stone imp-demon that hovers in a hunched crouch: slate
// hide veined with faint forge-orange cracks, swept-back ram horns, pointed
// ears, a fanged grin and ember eyes, bat wings on stone finger-bones and a
// spade-tipped tail. It flares its wings high, then dives in and rakes with
// both claws; on death it drops out of the air and shatters on the ground.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  along,
  blobPath,
  cel,
  ellipsePath,
  glow,
  lerpV,
  limb,
  polyPath,
  samplePoseTrack,
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
import { drawHumanoidView, solveViewSkeleton, type HumanView, type ViewSkeleton } from '../rig/HumanView';
import {
  MONSTER_VIEWS,
  backSpikes,
  eye3,
  eyeGlowPoints,
  groundX,
  lp,
  monsterViewSkin,
  profileRings,
  sagittal,
  sagittalSpun,
  sd,
  solid3,
  strap,
  surfCurve,
  surfPatch,
  tube3,
  turnedHead,
  wingDepth,
  wingPlane,
  type L3,
  type Part3,
} from '../rig/MonsterView';

const HIDE = tone(0x8190a6, { light: 0.38 });
const HIDE_FAR = tone(0x525d70, { light: 0.2 });
const BELLY = tone(0x98a2b0, { light: 0.35, shadow: 0.35 });
const MEMBRANE = tone(0x414a60, { light: 0.25 });
const MEMBRANE_FAR = tone(0x363d50, { light: 0.15 });
const HORN = tone(0x3d4250, { light: 0.35 });
const CLAW = tone(0xd8d0bc, { light: 0.4, shadow: 0.3 });
const EMBER = 0xff8a2a;

interface GargPose extends HumanPose {
  /** Wing arm angle (dirUp convention: 0 = straight up, − = swept back). */
  wing: number;
  /** Finger spread 0 folded … 1 fully fanned. */
  open: number;
  /** Tail curl (+ curls up). */
  tail: number;
  /** Crack/eye glow. */
  heat: number;
}

// ── Wings & tail ────────────────────────────────────────────────────────

function wing(ctx: CanvasRenderingContext2D, root: V, ang: number, open: number, t: Tone, bone: Tone, size: number): void {
  const elbow = along(root, ang, 9 * size);
  const wrist = along(elbow, ang + 0.35 - open * 0.2, 9 * size);
  // Finger bones fanning back/down from the wrist
  const fingers = [
    along(wrist, ang + 0.25 - open * 0.05, 7 * size),
    along(wrist, ang - 0.6 - open * 0.5, 11.5 * size),
    along(wrist, ang - 1.2 - open * 0.65, 11 * size),
    along(wrist, ang - 1.75 - open * 0.75, 9.5 * size),
  ];
  const lowRoot = vec(root.x + 1.5, root.y + 8 * size);
  const pts: V[] = [root, elbow, wrist, fingers[0]];
  // Scalloped membrane between finger tips
  for (let i = 0; i < fingers.length - 1; i++) {
    const a = fingers[i];
    const b = fingers[i + 1];
    const m = lerpV(a, b, 0.5);
    const pull = lerpV(m, wrist, 0.16);
    pts.push(a, pull);
  }
  pts.push(fingers[fingers.length - 1], lerpV(fingers[fingers.length - 1], lowRoot, 0.45), lowRoot);
  cel(ctx, () => polyPath(ctx, pts), t, { band: 1.2 });
  // Bones on top of the membrane
  limb(ctx, root, elbow, 1.8 * size, 1.4 * size, bone);
  limb(ctx, elbow, wrist, 1.4 * size, 1.1 * size, bone);
  for (const f of fingers) {
    ctx.strokeStyle = bone.shade;
    ctx.lineWidth = 0.8 * size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(wrist.x, wrist.y);
    ctx.lineTo(f.x, f.y);
    ctx.stroke();
  }
  // Thumb claw
  cel(ctx, () => polyPath(ctx, [vec(wrist.x - 1, wrist.y - 0.6), along(wrist, ang + 1, 3.4 * size), vec(wrist.x + 1, wrist.y + 0.6)]), CLAW, { band: 0.2, stroke: 0.3 });
}

function tail(ctx: CanvasRenderingContext2D, sk: Skeleton, p: GargPose, t: number): void {
  const pts: V[] = [vec(sk.pelvis.x - 2, sk.pelvis.y + 1)];
  let ang = -2.2 + p.tail * 0.3; // pointing back-down
  const seg = 3.6;
  for (let i = 0; i < 5; i++) {
    ang += 0.28 + p.tail * 0.12 + Math.sin(t * Math.PI * 2 - i * 0.8) * 0.12;
    pts.push(along(pts[i], ang, seg));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    limb(ctx, pts[i], pts[i + 1], 1.9 - i * 0.28, 1.6 - i * 0.28, i < 2 ? HIDE : HIDE_FAR);
  }
  // Spade tip
  const end = pts[pts.length - 1];
  const dir = ang;
  const tip = along(end, dir, 4.6);
  const l = along(end, dir - 1.6, 2.6);
  const r = along(end, dir + 1.6, 2.6);
  cel(ctx, () => polyPath(ctx, [l, along(l, dir, 2.2), tip, along(r, dir, 2.2), r, end]), HORN, { band: 0.5 });
}

// ── Body ────────────────────────────────────────────────────────────────

function crack(ctx: CanvasRenderingContext2D, pts: readonly V[], heat: number): void {
  ctx.strokeStyle = `rgba(255,150,60,${0.35 + heat * 0.55})`;
  ctx.lineWidth = 0.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function clawHand(ctx: CanvasRenderingContext2D, el: V, hand: V, t: Tone, spread: number): void {
  const dir = Math.atan2(hand.y - el.y, hand.x - el.x);
  cel(ctx, () => ellipsePath(ctx, hand, 2.2, 1.9, dir), t, { band: 0.5 });
  for (let i = -1; i <= 1; i++) {
    const a = dir + i * (0.35 + spread * 0.25);
    const b = vec(hand.x + Math.cos(a) * 1.6, hand.y + Math.sin(a) * 1.6);
    const tip = vec(hand.x + Math.cos(a + 0.35) * 4.8, hand.y + Math.sin(a + 0.35) * 4.8);
    cel(ctx, () => polyPath(ctx, [vec(b.x - Math.sin(a) * 0.7, b.y + Math.cos(a) * 0.7), tip, vec(b.x + Math.sin(a) * 0.7, b.y - Math.cos(a) * 0.7)]), CLAW, { band: 0.2, stroke: 0.3 });
  }
}

function leg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, t: Tone): void {
  limb(ctx, hip, knee, 4, 2.9, t);
  // Digitigrade: shin to a raised heel, then a clawed forefoot
  const heel = lerpV(knee, ankle, 0.72);
  limb(ctx, knee, heel, 2.8, 1.9, t);
  limb(ctx, heel, ankle, 1.9, 1.5, t);
  const d = Math.atan2(ankle.y - heel.y, ankle.x - heel.x);
  for (const off of [-0.5, 0.1, 0.7]) {
    const a = d + off;
    const tip = vec(ankle.x + Math.cos(a) * 3.8, ankle.y + Math.sin(a) * 3.8);
    cel(ctx, () => polyPath(ctx, [vec(ankle.x - Math.sin(a) * 0.8, ankle.y + Math.cos(a) * 0.8), tip, vec(ankle.x + Math.sin(a) * 0.8, ankle.y - Math.cos(a) * 0.8)]), CLAW, { band: 0.2, stroke: 0.3 });
  }
}

function body(ctx: CanvasRenderingContext2D, sk: Skeleton, p: GargPose): void {
  const a = sk.torsoAng;
  const L = (x: number, y: number): V => vec(sk.neck.x + x * Math.cos(a) - y * Math.sin(a), sk.neck.y + x * Math.sin(a) + y * Math.cos(a));
  const len = Math.hypot(sk.pelvis.x - sk.neck.x, sk.pelvis.y - sk.neck.y);
  // Hunched, barrel-chested torso tapering to a narrow waist
  const shape = [L(-7.4, 0), L(-2, -3.2), L(4.6, -1.8), L(8.4, 2.6), L(7.4, len * 0.6), L(3.6, len + 1.2), L(-3.2, len + 1.4), L(-5.2, len * 0.6), L(-8.4, len * 0.25)];
  cel(ctx, () => blobPath(ctx, shape), HIDE, { band: 1.6, hi: 0.8 });
  const belly = [L(2.2, 2.2), L(6.4, 3), L(6, len * 0.6), L(3, len), L(0.6, len * 0.55)];
  cel(ctx, () => blobPath(ctx, belly), BELLY, { band: 0.9, stroke: 0.35 });
  ctx.strokeStyle = BELLY.shade;
  ctx.lineWidth = 0.4;
  for (const k of [0.4, 0.6, 0.8]) {
    const l = L(1.4, len * k);
    const r = L(6, len * k - 0.4);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();
  }
  // Spinal ridge spikes
  for (let i = 0; i < 3; i++) {
    const b = L(-6.2 + i * 0.4, 1.6 + i * 3);
    const tip = L(-9.4 + i * 0.4, 0.4 + i * 3);
    cel(ctx, () => polyPath(ctx, [L(-6 + i * 0.4, 0.2 + i * 3), tip, b]), HORN, { band: 0.3, stroke: 0.35 });
  }
  crack(ctx, [L(-4, 2), L(-1.6, 4.6), L(-2.6, 7), L(-0.6, 9.4)], p.heat);
}

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: GargPose): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  ctx.scale(1.15, 1.15);
  // Far horn
  cel(ctx, () => blobPath(ctx, [vec(0, -3.4), vec(-3.4, -7.4), vec(-8.6, -8.8), vec(-12, -6.8), vec(-8.6, -7.2), vec(-4.2, -4.2), vec(-2, -1.8)]), HIDE_FAR, { band: 0.5 });
  // Far ear
  cel(ctx, () => polyPath(ctx, [vec(-2, -1.6), vec(-7.6, -2.6), vec(-2.6, 1.4)]), HIDE_FAR, { band: 0.4 });
  // Skull + snout
  const skull = [vec(-4.4, -0.4), vec(-3.2, -4.4), vec(1.6, -5.2), vec(5.2, -3), vec(8.6, -0.8), vec(8.8, 1.8), vec(5.6, 4.4), vec(0, 4.2), vec(-3.4, 2.6)];
  cel(ctx, () => blobPath(ctx, skull), HIDE, { band: 1.2 });
  // Brow ridge
  cel(ctx, () => polyPath(ctx, [vec(0.6, -3), vec(6.2, -2.4), vec(6.6, -1.2), vec(1, -1.6)]), HIDE_FAR, { band: 0.3, stroke: 0.35 });
  // Fanged grin
  ctx.fillStyle = '#1c0f12';
  ctx.beginPath();
  ctx.moveTo(2.4, 2);
  ctx.quadraticCurveTo(5.6, 3.6 + p.fx * 1.2, 8.6, 1.6);
  ctx.lineTo(8.2, 2.8 + p.fx);
  ctx.quadraticCurveTo(5.4, 4.6 + p.fx * 1.4, 2.6, 2.8);
  ctx.fill();
  ctx.fillStyle = CLAW.base;
  for (const [x, dy] of [[4.2, 1.6], [6.8, 1.2]] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 0.5, 2.4);
    ctx.lineTo(x + 0.5, 2.3);
    ctx.lineTo(x, 2.4 + dy);
    ctx.fill();
  }
  // Ember eye
  ctx.fillStyle = '#1a0a08';
  ctx.beginPath();
  ctx.ellipse(4.2, -0.8, 1.5, 1, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,${170 + Math.round(p.heat * 50)},80,${0.6 + p.heat * 0.4})`;
  ctx.beginPath();
  ctx.ellipse(4.5, -0.8, 1, 0.65, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Near ear
  cel(ctx, () => polyPath(ctx, [vec(-1, -1.4), vec(-6.4, -3.8 - p.flow), vec(-5, -1.8), vec(-1.6, 1.8)]), HIDE, { band: 0.4 });
  // Near ram horn sweeping back and curling down
  cel(ctx, () => blobPath(ctx, [vec(1.4, -4.4), vec(-2, -8.6), vec(-7.4, -10.4), vec(-11.2, -8.4), vec(-11.4, -4.6), vec(-9.6, -6.6), vec(-6.6, -7.4), vec(-2.8, -5), vec(-1, -2.6)]), HORN, { band: 0.6 });
  ctx.strokeStyle = HORN.light;
  ctx.lineWidth = 0.4;
  for (const [x, y] of [[-3, -7], [-6, -8.4], [-9, -8.4]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y - 1);
    ctx.lineTo(x + 0.6, y + 1);
    ctx.stroke();
  }
  crack(ctx, [vec(-2, -3), vec(0.4, -1.6), vec(-0.4, 0.8)], p.heat);
  ctx.restore();
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 8, shin: 8.5, upperArm: 7.6, foreArm: 7.4,
    torso: 13, neck: 4.6, ankle: 0.5,
    hipN: vec(1.6, 0), hipF: vec(-2, -0.4),
    shN: vec(1, 2.6), shF: vec(-4, 2.2),
  },
  back(ctx, sk, p, t) {
    const g = p as GargPose;
    const a = sk.torsoAng;
    const at = (x: number, y: number): V => vec(sk.neck.x + x * Math.cos(a) - y * Math.sin(a), sk.neck.y + x * Math.sin(a) + y * Math.cos(a));
    wing(ctx, at(-0.5, 0.8), g.wing + 0.42, g.open * 0.85, MEMBRANE_FAR, HIDE_FAR, 1.05);
    tail(ctx, sk, g, t);
    wing(ctx, at(-4, 2.6), g.wing, g.open, MEMBRANE, HIDE, 1.3);
  },
  armFar(ctx, sk) {
    limb(ctx, sk.shF, sk.elF, 2.7, 2.1, HIDE_FAR);
    limb(ctx, sk.elF, sk.handF, 2.1, 1.8, HIDE_FAR);
    clawHand(ctx, sk.elF, sk.handF, HIDE_FAR, 0.5);
  },
  legFar(ctx, sk) {
    leg(ctx, sk.hipF, sk.kneeF, sk.footF, HIDE_FAR);
  },
  legNear(ctx, sk) {
    leg(ctx, sk.hipN, sk.kneeN, sk.footN, HIDE);
  },
  torso(ctx, sk, p) {
    body(ctx, sk, p as GargPose);
  },
  head(ctx, sk, p) {
    head(ctx, sk, p as GargPose);
  },
  armNear(ctx, sk, p) {
    limb(ctx, sk.shN, sk.elN, 3.1, 2.4, HIDE);
    limb(ctx, sk.elN, sk.handN, 2.4, 2, HIDE);
    // Elbow spur
    cel(ctx, () => polyPath(ctx, [vec(sk.elN.x - 1, sk.elN.y - 1), along(sk.elN, -2.2, 3.4), vec(sk.elN.x + 1, sk.elN.y + 0.4)]), HORN, { band: 0.2, stroke: 0.3 });
    clawHand(ctx, sk.elN, sk.handN, HIDE, p.fx);
  },
  weapon() {
    // Claws are drawn with the hands.
  },
};

// ── Isometric 3/4 views ─────────────────────────────────────────────────

const GARG_BODY = (len: number): V[] => [vec(-7.4, 0), vec(-2, -3.2), vec(4.6, -1.8), vec(8.4, 2.6), vec(7.4, len * 0.6), vec(3.6, len + 1.2), vec(-3.2, len + 1.4), vec(-5.2, len * 0.6), vec(-8.4, len * 0.25)];
const garRings = (len: number): ReturnType<typeof profileRings> => profileRings(GARG_BODY(len), y => len - y, a => a * 0.95, 7);

function crackRuns(ctx: CanvasRenderingContext2D, runs: V[][], heat: number): void {
  for (const r of runs) crack(ctx, r, heat);
}

function gargTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  const g = p as GargPose;
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = garRings(len);
  const spikes = backSpikes(T, R, len - 1, len * 0.35, 3, [0], i => 3.4 - i * 0.4, 1.2);
  solid3(ctx, T, R, HIDE, {
    band: 1.6,
    hi: 0.8,
    parts: spikes.map(pts => ({ pts, tone: HORN, hull: true, band: 0.3 })),
    face: () => {
      if (T.vis(0) > -0.3) {
        cel(ctx, () => polyPath(ctx, surfPatch(T, R, len - 2, 1.4, -0.8, 0.8, 0.1, 8)), BELLY, { band: 0.9, stroke: 0.35 });
        for (const k of [0.4, 0.6, 0.8]) strap(ctx, T, R, [[len * (1 - k), -0.75], [len * (1 - k) - 0.4, 0.75]], BELLY, 0.2, 0.15);
      }
      crackRuns(ctx, surfCurve(T, R, [[len - 2, 2.2], [len - 4.6, 1.8], [len - 7, 2.3], [len - 9.4, 1.9]], 0.05, 4), g.heat);
      crackRuns(ctx, surfCurve(T, R, [[len - 2, -2.2], [len - 4.6, -1.8], [len - 7, -2.3]], 0.05, 4), g.heat);
    },
  });
}

const GARG_SKULL = profileRings([vec(-4.4, -0.4), vec(-3.2, -4.4), vec(1.6, -5.2), vec(5.2, -3), vec(6, -0.8), vec(5.6, 3.4), vec(0, 4.2), vec(-3.4, 2.6)].map(q => vec(q.x * 1.15, q.y * 1.15)), y => -y, a => a * 0.95, 7);
const GARG_EYE = { h: 1.6, phi: 0.5 };

function gargHeadView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose): void {
  const g = p as GargPose;
  const H = turnedHead(sk, 0.35);
  const R = GARG_SKULL;
  const k = 1.15;
  const horn = (s: 1 | -1): L3[] => [[4.2, 1, 3.4 * s], [7.4, -2.4, 5.2 * s], [8.4, -7.2, 6.4 * s], [5.6, -10.4, 7 * s], [2.2, -9.4, 7.4 * s]].map(q => [q[0] * k, q[1] * k, q[2] * k] as const);
  const parts: Part3[] = [
    { pts: [[2, -1, 5.2], [3, -7.4 - g.flow, 7.4], [1, -5.6, 7], [-1.4, -1.6, 5.2]], tone: HIDE, farTone: HIDE_FAR, mirror: true, band: 0.4 },
    // Snout + fanged jaw
    { pts: [[1.4, 5.2, -3], [1.4, 5.2, 3], [-0.6, 10, -1.8], [-0.6, 10, 1.8], [-3.2, 9.4, -1.6], [-3.2, 9.4, 1.6], [-4.2, 4.6, -3], [-4.2, 4.6, 3]], tone: HIDE, hull: true, band: 1, bias: 0.3 },
  ];
  const hornItems = ([1, -1] as const).map(s => ({ s, d: sd(H, 7 * k, -5 * k, 6 * s * k) }));
  const drawHorn = (s: 1 | -1): void => {
    tube3(ctx, H, horn(s), [1.8, 1.6, 1.3, 0.9, 0.5], s > 0 ? HORN : tone(0x2e323d));
  };
  const c0 = sd(H, 0, 0, 0);
  for (const h of hornItems) if (h.d < c0) drawHorn(h.s);
  solid3(ctx, H, R, HIDE, {
    band: 1.2,
    parts,
    face: () => {
      if (H.vis(0) < -0.3) return;
      cel(ctx, () => polyPath(ctx, surfPatch(H, R, GARG_EYE.h + 2.2, GARG_EYE.h + 1, -1, 1, 0.2, 6)), HIDE_FAR, { band: 0.3, stroke: 0.35 });
      for (const sgn of [1, -1]) {
        eye3(ctx, H, R, GARG_EYE.h, sgn * GARG_EYE.phi, { rx: 1.5, ry: 1, socket: '#1a0a08', iris: `rgba(255,${170 + Math.round(g.heat * 50)},80,${0.6 + g.heat * 0.4})`, irisR: 0.65, tilt: -0.2 });
      }
      crackRuns(ctx, surfCurve(H, R, [[4.6, -1.8], [3, -2.2], [1, -2]], 0.05, 3), g.heat);
    },
    over: () => {
      if (H.vis(0) < -0.2) return;
      // Fanged grin across the muzzle
      const a = sp3(H, -1.4, 9.6, 0);
      const l = sp3(H, -1.2, 5.6, 2.8);
      const r = sp3(H, -1.2, 5.6, -2.8);
      ctx.fillStyle = '#1c0f12';
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.quadraticCurveTo(a.x, a.y + 1.2 + g.fx * 1.2, r.x, r.y);
      ctx.quadraticCurveTo(a.x, a.y + 0.2, l.x, l.y);
      ctx.fill();
      ctx.fillStyle = CLAW.base;
      for (const lat of [-1.6, 1.6]) {
        const f = sp3(H, -1.4, 8.4, lat);
        ctx.beginPath();
        ctx.moveTo(f.x - 0.5, f.y);
        ctx.lineTo(f.x + 0.5, f.y);
        ctx.lineTo(f.x, f.y + 1.5);
        ctx.fill();
      }
    },
  });
  for (const h of hornItems) if (h.d >= c0) drawHorn(h.s);
}

function sp3(H: ReturnType<typeof turnedHead>, h: number, f: number, l: number): V {
  return H.rig.p(lp(H, h, f, l));
}

/** Wings spread out to either side in their own planes; tail on the body plane. */
function gargExtra(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number, d0: number): { z: number; draw: () => void }[] {
  const g = p as GargPose;
  const T = sk.torso;
  const len = sk.torsoLen;
  const R = garRings(len);
  const back = R[1];
  const spread = 1.3;
  const out: { z: number; draw: () => void }[] = [];
  for (const s of [1, -1] as const) {
    const anchor = lp(T, len - 2, (back.f ?? 0) - back.a * 0.6, s * 2.2);
    const size = s > 0 ? 1.3 : 1.15;
    out.push({
      z: wingDepth(sk.rig, anchor, s, spread, 10) - d0 + (s > 0 ? 0 : -6),
      draw: () => wingPlane(ctx, sk.rig, anchor, vec(anchor.x, anchor.y), s, spread, () =>
        wing(ctx, vec(anchor.x, anchor.y), g.wing + (s > 0 ? 0 : 0.2), g.open, s > 0 ? MEMBRANE : MEMBRANE_FAR, s > 0 ? HIDE : HIDE_FAR, size)),
    });
  }
  out.push({
    z: sk.torso.depth(0, Math.PI, 4, 0) - d0,
    draw: () => sagittal(ctx, sk.rig, 0, () => tail(ctx, solveSkeleton(p, SKIN.prop), g, t)),
  });
  return out;
}

// ── Poses ───────────────────────────────────────────────────────────────

const HOVER_Y = 69;

const READY: GargPose = {
  ...basePose({
    root: vec(CENTER_X - 3, HOVER_Y),
    lean: 0.55,
    head: -0.55,
    footN: vec(CENTER_X + 7, HOVER_Y + 11),
    footF: vec(CENTER_X + 1, HOVER_Y + 10),
    handN: vec(CENTER_X + 11, HOVER_Y + 1),
    handF: vec(CENTER_X + 7, HOVER_Y - 1),
  }),
  wing: -1.3,
  open: 0.7,
  tail: 0,
  heat: 0.5,
};

const P = (o: Partial<GargPose>): GargPose => ({ ...READY, ...o });

/** One wingbeat: up-stroke lifts the wings high, down-stroke drives the body up. */
function flap(t: number, base: GargPose, amp: number, bob: number): GargPose {
  const ph = t * Math.PI * 2;
  const w = Math.cos(ph); // +1 wings up, −1 wings down
  const lift = -Math.sin(ph + 0.6) * bob;
  return {
    ...base,
    root: vec(base.root.x, base.root.y + lift),
    footN: vec(base.footN.x, base.footN.y + lift * 0.8),
    footF: vec(base.footF.x, base.footF.y + lift * 0.8),
    handN: vec(base.handN.x, base.handN.y + lift * 0.6 + w * 0.6),
    handF: vec(base.handF.x, base.handF.y + lift * 0.6 + w * 0.5),
    wing: base.wing + w * amp,
    open: base.open + w * 0.2,
    tail: base.tail + Math.sin(ph - 1) * 0.5,
    head: base.head + Math.sin(ph - 0.4) * 0.05,
  };
}

const ATTACK: Key<GargPose>[] = [
  { at: 0, pose: READY },
  // Rear up: wings flared high and wide, claws raised
  { at: 0.33, ease: 'out', pose: P({ root: vec(CENTER_X - 5, HOVER_Y - 3), lean: 0.05, head: -0.2, handN: vec(CENTER_X + 4, 53), handF: vec(CENTER_X - 1, 54), footN: vec(CENTER_X + 4, 79), footF: vec(CENTER_X - 3, 78), wing: -0.75, open: 1, tail: 0.8, heat: 0.9, fx: 0.5 }) },
  // Dive: wings sweep back, body pitches forward
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X + 1, HOVER_Y + 1), lean: 0.85, head: -0.75, handN: vec(CENTER_X + 15, 60), handF: vec(CENTER_X + 11, 58), footN: vec(CENTER_X - 3, 83), footF: vec(CENTER_X - 9, 81), wing: -1.9, open: 0.4, tail: -0.4, heat: 1, fx: 0.8 }) },
  // RAKE — claws down through the target, hind talons swung forward
  { at: 1, ease: 'linear', pose: P({ root: vec(CENTER_X + 4, HOVER_Y + 3), lean: 0.7, head: -0.6, handN: vec(CENTER_X + 20, 80), handF: vec(CENTER_X + 15, 82), footN: vec(CENTER_X + 11, 87), footF: vec(CENTER_X + 4, 86), wing: -1.3, open: 1, tail: 0.3, heat: 1, fx: 1 }) },
];

const recoil = P({ root: vec(CENTER_X - 6, HOVER_Y - 1), lean: 0.05, head: -0.45, handN: vec(CENTER_X + 3, 60), handF: vec(CENTER_X - 1, 58), footN: vec(CENTER_X + 5, 80), footF: vec(CENTER_X - 1, 79), wing: -0.85, open: 0.35, tail: 1, heat: 1 });

const HURT: Key<GargPose>[] = [
  { at: 0, pose: recoil },
  { at: 1, pose: P({ root: vec(CENTER_X - 4, HOVER_Y), lean: 0.3, head: -0.45, handN: vec(CENTER_X + 7, 67), handF: vec(CENTER_X + 3, 65), wing: -1.05, open: 0.5, tail: 0.5, heat: 0.7 }) },
];

// Drops out of the air and slams face-down, wings draped over its back.
// Spin rotates the whole rig, so the lying pose is authored upright.
const DEATH: Key<GargPose>[] = [
  { at: 0, pose: recoil },
  { at: 0.33, ease: 'in', pose: P({ root: vec(CENTER_X - 4, 78), lean: 0.2, head: 0.1, handN: vec(CENTER_X + 5, 68), handF: vec(CENTER_X + 1, 66), footN: vec(CENTER_X + 3, 90), footF: vec(CENTER_X - 2, 90), wing: 0, open: 0.3, tail: 1.2, heat: 0.6 }) },
  { at: 0.67, ease: 'out', pose: P({ root: vec(CENTER_X - 4, 82), lean: 0.1, head: 0.2, spin: 0.9, handN: vec(CENTER_X + 3, 62), handF: vec(CENTER_X - 1, 64), footN: vec(CENTER_X - 1, 96), footF: vec(CENTER_X - 5, 96), wing: -1.6, open: 0.6, tail: 0.6, heat: 0.3 }) },
  { at: 1, ease: 'out', pose: P({ root: vec(CENTER_X - 6, 84), lean: 0, head: 0.25, spin: 1.45, handN: vec(CENTER_X + 2, 60), handF: vec(CENTER_X - 3, 62), footN: vec(CENTER_X - 3, 99), footF: vec(CENTER_X - 7, 98), wing: -2.35, open: 0.9, tail: 0.1, heat: 0 }) },
];

function gargPose(act: MonsterAction, t: number): GargPose {
  switch (act) {
    case 'idle': return flap(t, READY, 0.42, 1.6);
    case 'walk': return flap(t, P({ lean: 0.8, head: -0.75, root: vec(CENTER_X - 2, HOVER_Y), footN: vec(CENTER_X - 1, 82), footF: vec(CENTER_X - 7, 81), handN: vec(CENTER_X + 11, 71), handF: vec(CENTER_X + 6, 70), wing: -1.4, tail: -0.3 }), 0.5, 2);
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

function drawFx(ctx: CanvasRenderingContext2D, p: GargPose, act: MonsterAction, t: number): void {
  const sk = solveSkeleton(p, SKIN.prop);
  if (p.heat > 0.05) {
    const eye = spun(p, vec(sk.head.x + Math.cos(sk.headAng) * 4.5 + Math.sin(sk.headAng) * 0.8, sk.head.y + Math.sin(sk.headAng) * 4.5 - Math.cos(sk.headAng) * 0.8), sk);
    glow(ctx, eye, 2.4 + p.fx, EMBER, 0.35 + p.heat * 0.35);
  }
  if (act === 'attack' && t > 0.9) {
    // Three raking claw slashes across the target
    const c = vec(sk.handN.x + 4, sk.handN.y - 4);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const o = (i - 1) * 3.2;
      const a = vec(c.x - 5 + o, c.y - 9 + o * 0.3);
      const b = vec(c.x + 6 + o, c.y + 8 + o * 0.3);
      ctx.strokeStyle = 'rgba(255,140,60,0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(c.x + o + 2, c.y + o * 0.3 - 1, b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,210,0.95)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }
  if (act === 'attack' && p.fx > 0.3 && t < 0.9) {
    // Wind whipped off the wings on the dive
    const r = spun(p, sk.neck, sk);
    ctx.strokeStyle = `rgba(220,230,255,${0.35 * p.fx})`;
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(r.x - 8 - i * 3, r.y - 8 + i * 5);
      ctx.lineTo(r.x - 20 - i * 3, r.y - 12 + i * 5);
      ctx.stroke();
    }
  }
  if (act === 'death' && t > 0.6) {
    // Stone chips and dust knocked off on impact
    const k = (t - 0.6) / 0.4;
    ctx.fillStyle = `rgba(180,184,196,${0.5 * (1 - k * 0.6)})`;
    for (const [dx, dy, r] of [[-12, -3, 3], [-4, -5, 3.6], [8, -4, 3.2], [15, -2, 2.4]] as const) {
      ctx.beginPath();
      ctx.arc(p.root.x + dx, GROUND_Y + dy * (0.5 + k * 0.5), r * (0.7 + k * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGargoyle(ctx: CanvasRenderingContext2D, p: GargPose, t: number): void {
  drawHumanoid(ctx, p, SKIN, t);
}

const VIEW_SKIN = monsterViewSkin(SKIN, {
  build: { hipW: 2.6, shW: 5.2, elbowOut: 1.4, footOut: 0.6 },
  headBias: 4,
  torso: gargTorsoView,
  head: gargHeadView,
  back: () => undefined,
  extra: gargExtra,
});

function drawFxView(ctx: CanvasRenderingContext2D, p: GargPose, act: MonsterAction, t: number, view: HumanView): void {
  const sk = solveViewSkeleton(p, SKIN.prop, VIEW_SKIN.build, view);
  if (p.heat > 0.05) {
    for (const e of eyeGlowPoints(turnedHead(sk, 0.35), GARG_SKULL, GARG_EYE.h, [GARG_EYE.phi, -GARG_EYE.phi])) {
      glow(ctx, e, 2.2 + p.fx, EMBER, 0.35 + p.heat * 0.35);
    }
  }
  sagittalSpun(ctx, sk, p, () => drawFx(ctx, { ...p, heat: 0 }, act, t));
}

export const GargoyleDrawer = rigMonster<GargPose>({
  key: 'monster_gargoyle',
  // Wide for the wing span; width doesn't move the sprite in-game.
  frameW: 84,
  frameH: 60,
  scale: 1.38,
  views: MONSTER_VIEWS,
  pose: gargPose,
  draw: (ctx, p, _act, t, view) => (view ? drawHumanoidView(ctx, p, VIEW_SKIN, t, view) : drawGargoyle(ctx, p, t)),
  shadow: (p, _act, _t, view) => ({ x: groundX(view, p.root.x + 1), r: Math.abs(p.spin) > 1 ? 16 : 12, lift: Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y)) }),
  fx: (ctx, p, act, t, view) => (view ? drawFxView(ctx, p, act, t, view) : drawFx(ctx, p, act, t)),
});
