// src/graphics/sprites/monsters/Werewolf.ts
//
// 狼人 — a hunched, digitigrade wolf-man of the Twilight Forest: shaggy
// dusk-grey fur with a spiky mane, pale chest ruff, shredded violet breeches,
// a snarling muzzle with glowing amber eyes, long hooked claws and a bushy
// tail. Prowls low, rears back and rips a huge claw swipe across its prey.
//
// The body is built by `werewolfDrawer(spec)` so the Alpha can reuse it with
// its own look, bulk and attack.
import type { EntityDrawer, MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  blobPath,
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
  type Key,
  type Tone,
  type V,
} from '../rig/Rig';
import {
  basePose,
  drawHumanoid,
  gait,
  solveSkeleton,
  spun,
  type HumanPose,
  type HumanSkin,
  type Proportions,
  type Skeleton,
} from '../rig/Humanoid';
import { humanoidTracks, rigMonster } from '../rig/MonsterKit';
import { Section, drawHumanoidView, solveViewSkeleton, v3, type HumanView, type ViewSkeleton } from '../rig/HumanView';
import {
  MONSTER_VIEWS,
  TurnedSection,
  band,
  clipTo,
  decal,
  depthOf,
  groundX,
  hull3,
  loftFill,
  monsterViewSkin,
  poly3,
  profileRings,
  ringsBetween,
  sd,
  sorted,
  sp,
  surf,
  surfPatch,
  surfVis,
  type L3,
} from '../rig/MonsterView';

export interface WolfLook {
  fur: Tone;
  furFar: Tone;
  /** Mane / back ridge. */
  mane: Tone;
  /** Chest ruff, muzzle and tail tip. */
  pale: Tone;
  pants: Tone;
  claw: Tone;
  nose: string;
  gum: string;
  eye: number;
  eyeCore: string;
  /** Battle scars across muzzle and chest. */
  scars?: boolean;
  /** Notched far ear. */
  tornEar?: boolean;
  /** Strokes painted into the fur (dark on light). */
  furLine: string;
  /** Spiked iron collar with a snapped chain. */
  collar?: boolean;
}

export interface WolfSpec {
  key: string;
  frameW: number;
  frameH: number;
  scale: number;
  look: WolfLook;
  /** Limb/torso thickness multiplier. */
  bulk: number;
  /** 'swipe': one-armed rake; 'maul': two-handed overhead crash. */
  attack: 'swipe' | 'maul';
  ready?: Partial<HumanPose>;
  shadowR?: number;
}

const PROP: Proportions = {
  thigh: 9.6, shin: 8, upperArm: 9.6, foreArm: 9,
  torso: 15, neck: 6.2,
  // Digitigrade: the IK "ankle" is the raised hock; the paw is drawn below it.
  ankle: 7.4,
  hipN: vec(1.8, 0), hipF: vec(-2.2, -0.4),
  shN: vec(2, 3.4), shF: vec(-3.4, 3),
};

const IRON = tone(0x8a8e9c, { light: 0.45 });

/** The neck juts forward; the face is rotated back by this much to stay level. */
const FACE_TILT = 0.55;

// ── Drawing helpers ─────────────────────────────────────────────────────

function perp(a: V, b: V): { u: V; n: V } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { u: vec(dx / l, dy / l), n: vec(-dy / l, dx / l) };
}

/** Spiky fur tuft growing from `at` in direction `ang` (radians, canvas). */
function tuft(ctx: CanvasRenderingContext2D, at: V, ang: number, len: number, width: number, t: Tone, spikes = 3): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const P = (along: number, side: number): V => vec(at.x + c * along - s * side, at.y + s * along + c * side);
  const pts: V[] = [P(0, -width)];
  for (let i = 0; i < spikes; i++) {
    const k = (i + 0.5) / spikes;
    const side = -width + k * 2 * width;
    pts.push(P(len * (0.75 + 0.25 * Math.sin(i * 2.3 + 1)), side));
    pts.push(P(len * 0.35, side + width / spikes));
  }
  pts.push(P(0, width));
  cel(ctx, () => polyPath(ctx, pts), t, { band: width * 0.35, stroke: 0.4 });
}

/** Curved claw from `base`, pointing along `ang`, hooking downward. */
function claw(ctx: CanvasRenderingContext2D, base: V, ang: number, len: number, t: Tone): void {
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(ang);
  cel(ctx, () => {
    ctx.moveTo(0, -0.55);
    ctx.quadraticCurveTo(len * 0.6, -0.9, len, len * 0.28);
    ctx.quadraticCurveTo(len * 0.5, 0.2, 0, 0.55);
    ctx.closePath();
  }, t, { band: 0.25, stroke: 0.35 });
  ctx.restore();
}

// ── Werewolf factory ────────────────────────────────────────────────────

export function werewolfDrawer(spec: WolfSpec): EntityDrawer {
  const L = spec.look;
  const b = spec.bulk;
  const clawLen = 5.4 * (0.9 + b * 0.1);

  function paw(ctx: CanvasRenderingContext2D, hand: V, el: V, t: Tone, fx: number): void {
    const dir = Math.atan2(hand.y - el.y, hand.x - el.x);
    const spread = 0.28 + fx * 0.2;
    // Far claws behind the palm
    for (const i of [-1.5, -0.5]) {
      const a = dir + i * spread * 0.7;
      claw(ctx, vec(hand.x + Math.cos(a) * 1.8, hand.y + Math.sin(a) * 1.8), a + 0.25, clawLen, L.claw);
    }
    cel(ctx, () => ellipsePath(ctx, hand, 2.8 * b, 2.3 * b, dir), t, { band: 0.8 });
    for (const i of [0.5, 1.5]) {
      const a = dir + i * spread * 0.7;
      claw(ctx, vec(hand.x + Math.cos(a) * 2.1, hand.y + Math.sin(a) * 2.1), a + 0.25, clawLen, L.claw);
    }
  }

  function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, t: Tone, fx: number, near: boolean): void {
    limb(ctx, sh, el, 3.4 * b, 2.6 * b, t);
    // Elbow tuft sweeping back
    const { u } = perp(sh, el);
    tuft(ctx, el, Math.atan2(u.y, u.x) + 2.5, 3.4 * b, 1.5 * b, t, 2);
    limb(ctx, el, hand, 2.5 * b, 2.1 * b, t);
    paw(ctx, hand, el, t, fx);
    if (near) {
      // Shoulder mane tuft
      tuft(ctx, vec(sh.x - 1, sh.y - 1), -2.3, 5 * b, 2.4 * b, L.mane, 3);
    }
  }

  function leg(ctx: CanvasRenderingContext2D, sk: Skeleton, near: boolean): void {
    const t = near ? L.fur : L.furFar;
    const hip = near ? sk.hipN : sk.hipF;
    const knee = near ? sk.kneeN : sk.kneeF;
    const hock = near ? sk.footN : sk.footF;
    const sole = near ? sk.soleN : sk.soleF;
    // Haunch
    limb(ctx, hip, knee, 4.4 * b, 3.1 * b, t);
    tuft(ctx, lerpV(hip, knee, 0.55), Math.PI * 0.85, 3.6 * b, 1.6 * b, t, 2);
    // Shin to the raised hock
    limb(ctx, knee, hock, 2.9 * b, 2 * b, t);
    // Hock spur tuft
    tuft(ctx, hock, Math.PI * 0.95, 2.6 * b, 1.1 * b, t, 2);
    // Long paw down to the toes
    const ball = vec(sole.x + 4.6, sole.y - 1.6);
    limb(ctx, hock, ball, 2 * b, 1.7 * b, t);
    cel(ctx, () => ellipsePath(ctx, vec(sole.x + 5.6, sole.y - 1.3), 2.9 * b, 1.4 * b), t, { band: 0.5 });
    for (const dx of [7.2, 8.4]) {
      claw(ctx, vec(sole.x + dx * (0.9 + b * 0.1), sole.y - 1.3), 0.55, 2.4, L.claw);
    }
  }

  function torso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
    inBone(ctx, sk.neck, sk.pelvis, (len) => {
      const ph = t * Math.PI * 2;
      const ruffle = Math.sin(ph) * 0.4 + p.flow * 1.2;
      // Spiky mane down the back
      const mane = [
        vec(-1, -4 * b), vec(-5.5 * b, -6 * b - ruffle), vec(-6.5 * b, -3), vec(-11 * b - ruffle, -3.6), vec(-8.6 * b, 0),
        vec(-12 * b - ruffle, 2), vec(-9 * b, 3.6), vec(-11 * b - ruffle * 0.6, 7), vec(-8 * b, 7.4),
        vec(-9 * b, len * 0.7), vec(-5, len * 0.62), vec(0, 2),
      ];
      cel(ctx, () => polyPath(ctx, mane), L.mane, { band: 1.2 });
      // Barrel chest tapering to a lean waist
      const body = [
        vec(-7 * b, -0.6), vec(0, -3 * b), vec(6.8 * b, -0.2), vec(8.6 * b, len * 0.34),
        vec(6.4 * b, len * 0.72), vec(4.6 * b, len + 0.4), vec(-4.8 * b, len + 0.8), vec(-6.6 * b, len * 0.5),
      ];
      cel(ctx, () => blobPath(ctx, body), L.fur, { band: 1.8 });
      // Pale chest ruff with jagged edge
      const ruff = [
        vec(2.4, -1.6), vec(7.2 * b, 0.4), vec(8.6 * b, len * 0.3), vec(7 * b, len * 0.48), vec(7.6 * b, len * 0.56),
        vec(5.6 * b, len * 0.7), vec(5.8 * b, len * 0.8), vec(3.6, len * 0.72), vec(2.4, len * 0.5), vec(3.4, len * 0.4), vec(1.6, len * 0.2),
      ];
      cel(ctx, () => polyPath(ctx, ruff), L.pale, { band: 1 });
      // Fur strokes
      ctx.strokeStyle = L.furLine;
      ctx.lineWidth = 0.45;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [x, y] of [[-3, 3], [-1, 6], [-4, len * 0.55], [0.5, len * 0.35], [-2.2, len * 0.75]] as const) {
        ctx.moveTo(x, y);
        ctx.lineTo(x - 1.4, y + 1.6);
      }
      for (const [x, y] of [[5, 2.4], [6.2, len * 0.28], [4.6, len * 0.5]] as const) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.8, y + 1.4);
      }
      ctx.stroke();
      if (L.scars) {
        ctx.strokeStyle = 'rgba(214,168,176,0.85)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(2, len * 0.18);
        ctx.lineTo(7, len * 0.42);
        ctx.moveTo(1.4, len * 0.3);
        ctx.lineTo(5.8, len * 0.56);
        ctx.moveTo(-5, 1);
        ctx.lineTo(-2.4, 5);
        ctx.stroke();
      }
      // Shredded breeches
      const hem = (x: number, ph2: number): V => {
        const c = clothChain(vec(x, len + 2.2), 2.6, 2, p.flow, 1, ph + ph2);
        return c[2];
      };
      const h1 = hem(4.6 * b, 0);
      const h2 = hem(0.8, 1.3);
      const h3 = hem(-3.6 * b, 2.2);
      cel(ctx, () => polyPath(ctx, [
        vec(-5.4 * b, len - 3), vec(5.8 * b, len - 3.6), vec(6.4 * b, len + 1.4), h1, vec(3, len + 2.4),
        h2, vec(-1.4, len + 2.2), h3, vec(-5.8 * b, len + 1.2),
      ]), L.pants, { band: 0.9 });
      // Frayed rope belt
      cel(ctx, () => polyPath(ctx, [vec(-5.6 * b, len - 3.4), vec(6 * b, len - 4), vec(6.1 * b, len - 2.6), vec(-5.6 * b, len - 2)]), tone(0x7a6448), { band: 0.3, stroke: 0.4 });
      // Throat ruff tufts
      tuft(ctx, vec(4.2, 0.6), 1.2, 4 * b, 2.2 * b, L.pale, 3);
      if (L.collar) {
        // Spiked iron collar, a snapped chain swinging from it
        const chain = clothChain(vec(-2, 1.6), 7, 4, p.flow + 0.2, 1.4, ph + 0.6);
        for (let i = 1; i < chain.length; i++) {
          const m = lerpV(chain[i - 1], chain[i], 0.5);
          const ang = Math.atan2(chain[i].y - chain[i - 1].y, chain[i].x - chain[i - 1].x);
          cel(ctx, () => ellipsePath(ctx, m, 1.2, i % 2 ? 0.55 : 0.8, ang), IRON, { band: 0.3, stroke: 0.4 });
        }
        cel(ctx, () => polyPath(ctx, [vec(-6.8 * b, -1.6), vec(7 * b, -0.6), vec(7 * b, 1.6), vec(-6.8 * b, 0.8)]), IRON, { band: 0.6 });
        for (const x of [-4.4, -0.8, 2.8, 6]) {
          cel(ctx, () => polyPath(ctx, [vec(x - 0.8, -1.2), vec(x + 0.2, -3.6), vec(x + 0.8, -1.1)]), IRON, { band: 0.25, stroke: 0.35 });
        }
      }
    });
  }

  function head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
    // Thick neck
    limb(ctx, sk.neck, lerpV(sk.neck, sk.head, 0.55), 3.8 * b, 3 * b, L.fur);
    ctx.save();
    ctx.translate(sk.head.x, sk.head.y);
    ctx.rotate(sk.headAng - FACE_TILT);
    ctx.scale(b * 0.96, b * 0.96);
    const ph = t * Math.PI * 2;
    const twitch = Math.sin(ph * 2 + 0.5) * 0.12;
    // Far ear
    const farEar = L.tornEar
      ? [vec(-2.6, -3.4), vec(-4.4, -9.6), vec(-3.2, -8.6), vec(-3, -10.8), vec(-0.4, -4.6)]
      : [vec(-2.6, -3.4), vec(-4.2, -11), vec(-0.4, -4.6)];
    cel(ctx, () => polyPath(ctx, farEar), L.furFar, { band: 0.6 });
    // Lower jaw (hinged back under the ear, opens with the snarl)
    const jaw = 0.12 + p.fx * 0.5 + Math.max(0, Math.sin(ph * 2)) * 0.04;
    ctx.save();
    ctx.translate(0.4, 2.2);
    ctx.rotate(jaw * 0.75);
    cel(ctx, () => polyPath(ctx, [vec(-1.8, -0.6), vec(8.6, 0.2), vec(8.8, 1.4), vec(3, 2.8), vec(-1.4, 2)]), L.pale, { band: 0.6 });
    ctx.fillStyle = L.gum;
    ctx.fillRect(1.6, -0.6, 6.8, 0.9);
    ctx.fillStyle = '#f4efe0';
    for (const x of [3, 5, 7.2]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 0.5, -1.4);
      ctx.lineTo(x + 1, 0);
      ctx.fill();
    }
    ctx.restore();
    // Cheek ruff flaring back behind the jaw
    tuft(ctx, vec(-3.6, 1.6), 2.45, 6, 3, L.mane, 3);
    // Cranium
    const skull = [vec(-5.4, -0.4), vec(-4, -4.6), vec(0.6, -5.8), vec(4.6, -4), vec(5.8, -1.6), vec(4.4, 2.6), vec(0.6, 3.4), vec(-4, 3)];
    cel(ctx, () => blobPath(ctx, skull), L.fur, { band: 1.4 });
    // Muzzle (snout) with a wrinkled snarl ridge
    const snout = [vec(2.2, -2.8), vec(6, -2.6 - p.fx * 0.4), vec(10.6, -1.2), vec(11.2, 0.6), vec(10.4, 1.9), vec(4, 2.4), vec(2, 1.2)];
    cel(ctx, () => polyPath(ctx, snout), L.pale, { band: 0.8 });
    ctx.strokeStyle = L.furLine;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    for (let i = 0; i < 2 + Math.round(p.fx); i++) {
      ctx.moveTo(5.4 + i * 1.3, -2.4);
      ctx.lineTo(5.8 + i * 1.3, -1.6);
    }
    ctx.stroke();
    // Upper gum line + fangs
    ctx.fillStyle = L.gum;
    ctx.beginPath();
    ctx.moveTo(3, 1.6);
    ctx.lineTo(10.6, 1.6);
    ctx.lineTo(10, 2.6);
    ctx.lineTo(3.4, 2.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4efe0';
    for (const [x, l] of [[4, 1.6], [6, 1.1], [8.4, 1.9], [9.6, 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x + 0.45, 2 + l);
      ctx.lineTo(x + 0.9, 2);
      ctx.fill();
    }
    // Nose
    cel(ctx, () => ellipsePath(ctx, vec(10.8, -0.9), 1.3, 1), tone(0x1a1620), { band: 0.3, stroke: 0.35 });
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(10.2, -1.5, 0.6, 0.4);
    // Heavy, angry brow + glowing eye
    ctx.fillStyle = '#140e18';
    ctx.beginPath();
    ctx.ellipse(3.1, -2.4, 1.8, 1.1, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = L.eyeCore;
    ctx.beginPath();
    ctx.ellipse(3.3, -2.3, 1.25, 0.7, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#140e18';
    ctx.fillRect(3.3, -2.9, 0.45, 1.2);
    cel(ctx, () => polyPath(ctx, [vec(0.6, -4.4), vec(5.8, -3.2), vec(5.4, -2.2), vec(1, -3.2)]), L.fur, { band: 0.3, stroke: 0.35 });
    if (L.scars) {
      ctx.strokeStyle = 'rgba(214,168,176,0.9)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(1.4, -5.2);
      ctx.lineTo(4.6, 0.8);
      ctx.moveTo(6.6, -2.8);
      ctx.lineTo(8.4, 0.6);
      ctx.stroke();
    }
    // Near ear
    cel(ctx, () => polyPath(ctx, [vec(-3.8, -3), vec(-5.6 - twitch * 4, -11.6), vec(-0.6, -5)]), L.fur, { band: 0.8 });
    ctx.fillStyle = L.gum;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-3.4, -4);
    ctx.lineTo(-5 - twitch * 4, -9.8);
    ctx.lineTo(-1.8, -5.2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function tail(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
    const ph = t * Math.PI * 2;
    const c = Math.cos(p.lean * 0.3);
    const s = Math.sin(p.lean * 0.3);
    const anchor = vec(sk.pelvis.x - 4 * c, sk.pelvis.y - 4 * s - 1);
    const chain = clothChain(anchor, 15 * b, 6, 0.55 + p.flow * 0.6, 1.4, ph);
    const left: V[] = [];
    const right: V[] = [];
    for (let i = 0; i < chain.length; i++) {
      const k = i / (chain.length - 1);
      const a = chain[Math.max(0, i - 1)];
      const bb = chain[Math.min(chain.length - 1, i + 1)];
      const { n } = perp(a, bb);
      const r = (2.2 + Math.sin(k * Math.PI) * 2.4) * (1 - k * 0.55) * b;
      left.push(vec(chain[i].x + n.x * r, chain[i].y + n.y * r));
      right.push(vec(chain[i].x - n.x * r, chain[i].y - n.y * r));
    }
    const tip = chain[chain.length - 1];
    const outline = [...left, vec(tip.x - 1.5, tip.y + 1.5), ...right.reverse()];
    cel(ctx, () => blobPath(ctx, outline), L.fur, { band: 1.2 });
    // Pale tip
    const k0 = chain.length - 3;
    cel(ctx, () => blobPath(ctx, [left[k0], left[k0 + 1], left[k0 + 2], vec(tip.x - 1.5, tip.y + 1.5), ...right.slice(0, 3)]), L.pale, { band: 0.6 });
  }


  // ── Isometric 3/4 views ───────────────────────────────────────────────

  const BODY = (len: number): V[] => [
    vec(-7 * b, -0.6), vec(0, -3 * b), vec(6.8 * b, -0.2), vec(8.6 * b, len * 0.34),
    vec(6.4 * b, len * 0.72), vec(4.6 * b, len + 0.4), vec(-4.8 * b, len + 0.8), vec(-6.6 * b, len * 0.5),
  ];

  function torsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
    const T = sk.torso;
    const len = sk.torsoLen;
    const R = profileRings(BODY(len), y => len - y, a => a * 0.95, 8);
    const ph = t * Math.PI * 2;
    const ruffle = Math.sin(ph) * 0.4 + p.flow * 1.2;
    const front = T.vis(0) > T.vis(Math.PI);
    // Spiky mane down the back: tufts standing off the spine
    const mane: { d: number; draw: () => void }[] = [];
    for (let i = 0; i < 5; i++) {
      const h = len + 1.6 - i * (len * 0.17);
      for (const s of [-1, 0, 1]) {
        const rr = (R.find(q => q.h <= h) ?? R[R.length - 1]);
        const back = (rr.f ?? 0) - rr.a * 0.85;
        const len2 = (3 - i * 0.3) * b + ruffle * 0.6;
        const pts: L3[] = [
          [h + 1.8, back, s * rr.b * 0.45 - 2],
          [h + 1.8, back, s * rr.b * 0.45 + 2],
          [h + 1.6 + len2 * 0.5, back - len2, s * rr.b * 0.6 + 1],
          [h + 0.4, back - len2 * 0.55, s * rr.b * 0.55],
          [h + 0.8 + len2 * 0.3, back - len2 * 0.9, s * rr.b * 0.6 - 1.2],
          [h - 1.6, back, s * rr.b * 0.45],
        ];
        mane.push({ d: depthOf(T, pts), draw: () => poly3(ctx, T, pts, L.mane, { band: 0.8 }) });
      }
    }
    const d0 = depthOf(T, [[len * 0.5, 0, 0]]);
    sorted(mane.filter(m => m.d < d0));
    // Tattered breeches (behind the body where they hang away)
    const body = loftFill(ctx, T, R, L.fur, { band: 1.8 });
    clipTo(ctx, body, () => {
      // Pale chest ruff with a jagged lower edge
      if (T.vis(0) > -0.2) {
        const ruff = surfPatch(T, R, len + 0.6, len * 0.35, -1.1, 1.1, 0.15, 10, k => len * 0.3 + Math.abs(Math.sin(k * Math.PI * 3.5)) * 2.4 - Math.sin(k * Math.PI) * 1.6);
        cel(ctx, () => polyPath(ctx, ruff), L.pale, { band: 1 });
      }
      // Fur strokes
      ctx.strokeStyle = L.furLine;
      ctx.lineWidth = 0.45;
      ctx.lineCap = 'round';
      for (const [h, phi] of [[len * 0.8, 2.2], [len * 0.5, 2.6], [len * 0.3, 1.8], [len * 0.6, -2.2], [len * 0.25, -2.7], [len * 0.7, 3.1]] as const) {
        decal(ctx, T, R, h, phi, () => {
          ctx.beginPath();
          ctx.moveTo(0, -0.8);
          ctx.lineTo(-0.6, 0.9);
          ctx.stroke();
        }, { lift: 0.1 });
      }
      if (L.scars) {
        decal(ctx, T, R, len * 0.62, 0.3, () => {
          ctx.strokeStyle = 'rgba(214,168,176,0.85)';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(-2.6, -2.4);
          ctx.lineTo(2.2, 1.6);
          ctx.moveTo(-2.8, -0.6);
          ctx.lineTo(1.6, 3);
          ctx.stroke();
        }, { lift: 0.2 });
      }
    });
    // Shredded breeches + rope belt
    const pants = ringsBetween(R, -1.2, 3.4, 0.4);
    loftFill(ctx, T, pants, L.pants, { band: 0.9 });
    const bottom = pants[pants.length - 1];
    for (let k = 0; k < 9; k++) {
      const phi = (k / 9) * Math.PI * 2 + 0.2;
      if (T.vis(phi) < 0.02) continue;
      const l = 1.6 + ((k * 5) % 3) * 0.8 + p.flow * 0.8;
      const a = T.at(bottom.h + 0.2, phi - 0.22, bottom.a, bottom.b, bottom.f ?? 0);
      const c = T.at(bottom.h + 0.2, phi + 0.22, bottom.a, bottom.b, bottom.f ?? 0);
      const tip = T.at(bottom.h - l, phi, bottom.a + 0.2, bottom.b + 0.2, bottom.f ?? 0);
      cel(ctx, () => polyPath(ctx, [a, c, tip]), L.pants, { band: 0.4, stroke: 0.4 });
    }
    band(ctx, T, R, 3, tone(0x7a6448), 1.2, 0.6);
    sorted(mane.filter(m => m.d >= d0));
    if (front) {
      // Throat ruff tuft
      const pts: L3[] = [[len + 1.4, (R[0].f ?? 0) + R[0].a * 0.6, -2.6 * b], [len + 1.4, (R[0].f ?? 0) + R[0].a * 0.6, 2.6 * b], [len - 3.4, (R[0].f ?? 0) + R[0].a + 2.2 * b, 0]];
      poly3(ctx, T, pts, L.pale, { band: 0.6 });
    }
    if (L.collar) {
      band(ctx, T, R, len - 0.2, IRON, 2, 0.5);
      for (let k = 0; k < 10; k++) {
        const phi = (k / 10) * Math.PI * 2;
        if (T.vis(phi) < 0.1) continue;
        const base = surf(T, R, len - 0.2, phi, 0.9);
        const tip = surf(T, R, len - 0.2, phi, 3);
        const n = { x: tip.x - base.x, y: tip.y - base.y };
        cel(ctx, () => polyPath(ctx, [vec(base.x - n.y * 0.3 - 0.6, base.y + n.x * 0.3), vec(tip.x, tip.y - 0.6), vec(base.x + n.y * 0.3 + 0.6, base.y - n.x * 0.3)]), IRON, { band: 0.25, stroke: 0.35 });
      }
    }
  }

  /** Head frame with the face levelled (the neck juts forward). */
  function faceSection(sk: ViewSkeleton, p: HumanPose): Section {
    const a = p.lean + p.head - FACE_TILT + (sk.rig.front ? 0 : 0.35);
    const S = new Section(sk.rig, sk.j.head, v3(Math.sin(a), -Math.cos(a), 0), v3(Math.cos(a), Math.sin(a), 0));
    return sk.rig.front ? new TurnedSection(S, 0.35) : S;
  }

  const k = b * 0.96;
  const CRANIUM = profileRings(
    [vec(-5.4, -0.4), vec(-4, -4.6), vec(0.6, -5.8), vec(4.6, -4), vec(5.8, -1.6), vec(4.4, 2.6), vec(0.6, 3.4), vec(-4, 3)].map(q => vec(q.x * k, q.y * k)),
    y => -y, a => a * 1.02, 8,
  );
  /** Snout cross-sections along the face's forward axis: [forward, up offset, vertical r, lateral r]. */
  const SNOUT: [number, number, number, number][] = [
    [2.6, 0.9, 2.7, 2.9], [7, 0.6, 2.1, 2.1], [10.4, 0.1, 1.6, 1.5], [11.2, -0.1, 0.9, 1],
  ];
  const ring3 = (f: number, up: number, rv: number, rl: number, n = 12): L3[] => {
    const out: L3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([(up + Math.cos(a) * rv) * k, f * k, Math.sin(a) * rl * k]);
    }
    return out;
  };
  const EYE_H = 1.8 * k;
  const EYE_PHI = 0.62;

  function headView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
    limb(ctx, sk.neck, lerpV(sk.neck, sk.head, 0.55), 3.8 * b, 3 * b, L.fur);
    const F = faceSection(sk, p);
    const ph = t * Math.PI * 2;
    const twitch = Math.sin(ph * 2 + 0.5) * 0.12;
    const jaw = 0.12 + p.fx * 0.5 + Math.max(0, Math.sin(ph * 2)) * 0.04;
    const items: { d: number; draw: () => void }[] = [];
    for (const s of [1, -1] as const) {
      const torn = L.tornEar && s < 0;
      const ear: L3[] = torn
        ? [[3.2 * k, -0.4 * k, s * 1.2 * k], [3.4 * k, 0.2 * k, s * 4.4 * k], [7.6 * k, -0.6 * k, s * 4.2 * k], [8 * k, -0.9 * k, s * 3.2 * k], [9.6 * k, -1.2 * k, s * 2.8 * k]]
        : [[3.2 * k, -0.4 * k, s * 1.2 * k], [3.4 * k, 0.2 * k, s * 4.4 * k], [10.6 * k + twitch * 3, -1.4 * k, s * 3.4 * k]];
      const inner: L3[] = [[4 * k, 0, s * 2 * k], [4 * k, 0.3 * k, s * 3.8 * k], [8.8 * k + twitch * 3, -0.8 * k, s * 3.2 * k]];
      items.push({
        d: depthOf(F, ear),
        draw: () => {
          poly3(ctx, F, ear, s > 0 ? L.fur : L.furFar, { band: 0.7 });
          if (F.vis(s * 0.3) > 0.05) poly3(ctx, F, inner, tone(0x8a2a3a), { band: 0.2, stroke: 0 });
        },
      });
      // Cheek ruff flaring back behind the jaw
      const ruff: L3[] = [[1 * k, -1 * k, s * 4.4 * k], [-2.6 * k, 0, s * 4.8 * k], [-1.4 * k, -4 * k, s * 7.2 * k], [-3.4 * k, -3 * k, s * 6.4 * k], [-4 * k, -6.2 * k, s * 6.2 * k], [-2.2 * k, -3 * k, s * 4.2 * k]];
      items.push({ d: depthOf(F, ruff) - 0.5, draw: () => poly3(ctx, F, ruff, L.mane, { band: 0.8 }) });
    }
    const center = depthOf(F, [[0, 0, 0]]);
    // Lower jaw hinged under the ear, dropping open with the snarl
    const drop = jaw * 4;
    const jawPts: L3[] = [
      ...ring3(1.4, -1.6, 1.4, 2.2, 8),
      ...ring3(8.4, -2.4 - drop * 0.6 / k, 0.9, 1.2, 8),
    ];
    items.push({ d: center + 0.2, draw: () => hull3(ctx, F, jawPts, L.pale, { band: 0.6 }) });
    items.push({
      d: center,
      draw: () => {
        const shell = loftFill(ctx, F, CRANIUM, L.fur, { band: 1.4 });
        if (F.vis(0) < -0.3) return;
        clipTo(ctx, shell, () => {
          cel(ctx, () => polyPath(ctx, surfPatch(F, CRANIUM, EYE_H + 2.2 * k, EYE_H + 0.9 * k, -1.2, 1.2, 0.15, 6)), L.furFar, { band: 0.3, stroke: 0.3 });
          for (const s of [1, -1]) {
            decal(ctx, F, CRANIUM, EYE_H, s * EYE_PHI, () => {
              ctx.fillStyle = '#140e18';
              ctx.beginPath();
              ctx.ellipse(0, 0, 1.8 * k, 1.15 * k, 0.3 * s, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = L.eyeCore;
              ctx.beginPath();
              ctx.ellipse(0, 0, 1.25 * k, 0.7 * k, 0.3 * s, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#140e18';
              ctx.fillRect(-0.2, -0.6, 0.45, 1.2);
            }, { minVis: 0.02 });
          }
          if (L.scars) {
            decal(ctx, F, CRANIUM, EYE_H + 1, -0.4, () => {
              ctx.strokeStyle = 'rgba(214,168,176,0.9)';
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(-0.6, -2.8);
              ctx.lineTo(0.8, 3.2);
              ctx.stroke();
            }, { minVis: 0.02 });
          }
        });
      },
    });
    // Muzzle, gums, fangs and nose
    items.push({
      d: depthOf(F, [[0, 6 * k, 0]]),
      draw: () => {
        const pts: L3[] = SNOUT.flatMap(([f, up, rv, rl]) => ring3(f, up - (f > 9 ? p.fx * 0.3 : 0), rv, rl));
        const outline = hull3(ctx, F, pts, L.pale, { band: 0.8 });
        ctx.save();
        ctx.beginPath();
        polyPath(ctx, outline);
        ctx.clip();
        for (const s of [1, -1] as const) {
          const g0 = sp(F, -1.3 * k, 2.8 * k, s * 2.6 * k);
          const g1 = sp(F, -0.9 * k, 10.6 * k, s * 1.1 * k);
          ctx.strokeStyle = L.gum;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(g0.x, g0.y);
          ctx.lineTo(g1.x, g1.y);
          ctx.stroke();
        }
        ctx.strokeStyle = L.furLine;
        ctx.lineWidth = 0.4;
        for (let i = 0; i < 2 + Math.round(p.fx); i++) {
          const a = sp(F, 2.6 * k, (4.6 + i * 1.3) * k, -0.9 * k);
          const c = sp(F, 2.8 * k, (4.8 + i * 1.3) * k, 0.9 * k);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#f4efe0';
        for (const s of [1, -1] as const) {
          for (const [f, l] of [[4, 1.6], [6.4, 1.1], [8.8, 1.9]] as const) {
            const lat = s * (2.7 - f * 0.14) * k;
            if (sd(F, -1.2 * k, f * k, lat) < sd(F, -1.2 * k, f * k, 0) - 0.3) continue;
            const a = sp(F, -1.1 * k, (f - 0.5) * k, lat);
            const c = sp(F, -1.1 * k, (f + 0.5) * k, lat);
            const tp = sp(F, -1.1 * k - l, f * k, lat * 0.95);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(tp.x, tp.y);
            ctx.lineTo(c.x, c.y);
            ctx.fill();
          }
        }
        const np = sp(F, 0.8 * k, 11.3 * k, 0);
        cel(ctx, () => ellipsePath(ctx, np, 1.3 * k, 1 * k), tone(0x1a1620), { band: 0.3, stroke: 0.35 });
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(np.x - 0.6, np.y - 0.6, 0.6, 0.4);
      },
    });
    sorted(items);
  }

  function eyePoints(sk: ViewSkeleton, p: HumanPose): V[] {
    const F = faceSection(sk, p);
    return [1, -1]
      .filter(s => surfVis(F, CRANIUM, EYE_H, s * EYE_PHI) > 0.28)
      .map(s => surf(F, CRANIUM, EYE_H, s * EYE_PHI, 0.2));
  }

  const VIEW_OPTS = {
    build: { hipW: 2.6 * b, shW: 5.6 * b, elbowOut: 1.5, footOut: 0.5 },
    headBias: 3,
    torso: torsoView,
    head: headView,
  };

  const SKIN: HumanSkin = {
    prop: PROP,
    back: tail,
    armFar(ctx, sk, p) { arm(ctx, sk.shF, sk.elF, sk.handF, L.furFar, p.fx, false); },
    legFar(ctx, sk) { leg(ctx, sk, false); },
    legNear(ctx, sk) { leg(ctx, sk, true); },
    torso,
    head,
    armNear(ctx, sk, p) { arm(ctx, sk.shN, sk.elN, sk.handN, L.fur, p.fx, true); },
    weapon() { /* claws are drawn with the paws */ },
  };

  const READY: HumanPose = basePose({
    root: vec(CENTER_X - 5, 68.5),
    lean: 0.85,
    head: -0.32,
    footN: vec(CENTER_X - 0.5, GROUND_Y),
    footF: vec(CENTER_X - 11, GROUND_Y),
    handN: vec(CENTER_X + 15, 76),
    handF: vec(CENTER_X + 9, 78),
    flow: 0.2,
    ...spec.ready,
  });
  const R = READY;
  const P = (o: Partial<HumanPose>): HumanPose => ({ ...R, ...o });
  const ox = (v: V, dx: number, dy: number): V => vec(v.x + dx, v.y + dy);

  const ATTACK: Key<HumanPose>[] = spec.attack === 'swipe'
    ? [
      { at: 0, pose: R },
      // Rear back, near claw cocked high behind the head
      { at: 0.33, ease: 'out', pose: P({
        root: ox(R.root, -3, -1.5), lean: R.lean - 0.42, head: R.head + 0.18,
        handN: vec(CENTER_X - 7, 44), handF: vec(CENTER_X + 12, 60),
        footN: ox(R.footN, 1, 0), stretch: 0.06, flow: 0.1, fx: 0.35,
      }) },
      // Lunge: claw whips over the top
      { at: 0.67, ease: 'in', pose: P({
        root: ox(R.root, 2, 0), lean: R.lean - 0.05, head: R.head - 0.05,
        handN: vec(CENTER_X + 17, 43), handF: vec(CENTER_X + 6, 70),
        footN: ox(R.footN, 5, 0), flow: 0.45, fx: 0.75,
      }) },
      // (between frames: shapes the claw arc for the smear)
      { at: 0.84, pose: P({
        root: ox(R.root, 4, 1), lean: R.lean + 0.1, head: R.head - 0.07,
        handN: vec(CENTER_X + 29, 58), handF: vec(CENTER_X + 1, 67),
        footN: ox(R.footN, 8, 0), flow: 0.6, fx: 0.9,
      }) },
      // Contact: raked down and through, far arm flung back
      { at: 1, ease: 'linear', pose: P({
        root: ox(R.root, 5.5, 2), lean: R.lean + 0.28, head: R.head - 0.08,
        handN: vec(CENTER_X + 27, 78), handF: vec(CENTER_X - 4, 64),
        footN: ox(R.footN, 10, 0), footF: ox(R.footF, 2, 0), flow: 0.7, fx: 1, stretch: -0.04,
      }) },
    ]
    : [
      { at: 0, pose: R },
      // Rise up tall, both claws raised overhead, roaring
      { at: 0.33, ease: 'out', pose: P({
        root: ox(R.root, -3, -3), lean: R.lean - 0.55, head: R.head + 0.05,
        handN: vec(CENTER_X + 2, 43.5), handF: vec(CENTER_X - 5, 45.5),
        footN: ox(R.footN, 1, 0), stretch: 0.08, flow: 0.1, fx: 0.6,
      }) },
      { at: 0.67, ease: 'in', pose: P({
        root: ox(R.root, 1.5, -1), lean: R.lean - 0.1, head: R.head,
        handN: vec(CENTER_X + 18, 47), handF: vec(CENTER_X + 12, 46),
        footN: ox(R.footN, 5, 0), flow: 0.4, fx: 0.8,
      }) },
      { at: 0.84, pose: P({
        root: ox(R.root, 3.5, 0.5), lean: R.lean + 0.1, head: R.head - 0.05,
        handN: vec(CENTER_X + 28, 56), handF: vec(CENTER_X + 23, 55),
        footN: ox(R.footN, 7, 0), flow: 0.6, fx: 0.9,
      }) },
      // Both claws crash down together
      { at: 1, ease: 'linear', pose: P({
        root: ox(R.root, 5, 3), lean: R.lean + 0.32, head: R.head - 0.1,
        handN: vec(CENTER_X + 26, 83), handF: vec(CENTER_X + 20, 85),
        footN: ox(R.footN, 9, 0), footF: ox(R.footF, 2, 0), flow: 0.7, fx: 1, stretch: -0.06,
      }) },
    ];

  const gen = humanoidTracks({
    key: spec.key, frameW: spec.frameW, frameH: spec.frameH, scale: spec.scale,
    skin: SKIN, ready: R, attack: 'claw', deathDir: -1,
  });
  // Death: stagger, drop to the knees, then keel over onto its back.
  const DEATH: Key<HumanPose>[] = [
    gen.death[0],
    { at: 0.33, pose: P({
      ...gen.death[0].pose, root: ox(R.root, -3, 5), lean: R.lean - 0.6, head: R.head - 0.3,
      handN: ox(R.root, 8, -12), handF: ox(R.root, -2, -14), flow: 0.4, fx: 0.6,
    }) },
    { at: 0.67, ease: 'in', pose: P({
      root: vec(R.root.x - 3, GROUND_Y - 9), lean: -0.1, head: -0.3, spin: -0.5,
      footN: ox(R.footN, -2, 0), footF: ox(R.footF, 1, 0),
      handN: ox(R.root, 10, -6), handF: ox(R.root, -2, -8), flow: 0.3,
    }) },
    { at: 1, ease: 'out', pose: P({
      root: vec(R.root.x + 1, GROUND_Y - 7 * b), lean: 0, head: -0.25, spin: -1.45, pivot: 0,
      footN: vec(R.root.x + 6, GROUND_Y + 8.5), footF: vec(R.root.x - 1, GROUND_Y + 9.5),
      handN: vec(R.root.x - 3, GROUND_Y - 18.5), handF: vec(R.root.x - 5, GROUND_Y - 14.5), flow: 0.05,
    }) },
  ];
  const HURT: Key<HumanPose>[] = [
    { at: 0, pose: P({
      root: ox(R.root, -4, 0.5), lean: R.lean - 0.4, head: R.head - 0.35,
      handN: ox(R.handN, -5, -5), handF: ox(R.handF, -4, -6), footF: ox(R.footF, -1.5, 0), flow: 0.6, fx: 0.7, stretch: -0.03,
    }) },
    { at: 1, pose: P({
      root: ox(R.root, -2, 0.3), lean: R.lean - 0.15, head: R.head - 0.12,
      handN: ox(R.handN, -2, -2), handF: ox(R.handF, -1.5, -2), flow: 0.4, fx: 0.4,
    }) },
  ];

  function idle(t: number): HumanPose {
    const ph = t * Math.PI * 2;
    const breath = Math.sin(ph);
    return P({
      root: ox(R.root, 0, breath * 0.7),
      stretch: -breath * 0.03,
      lean: R.lean + breath * 0.03,
      head: R.head + Math.sin(ph - 0.7) * 0.07,
      handN: ox(R.handN, Math.sin(ph + 0.4) * 0.6, breath * 0.9),
      handF: ox(R.handF, Math.sin(ph - 0.4) * 0.6, Math.sin(ph - 0.6) * 0.9),
      flow: R.flow + Math.sin(ph + 1) * 0.18,
      fx: Math.max(0, Math.sin(ph * 2)) * 0.15,
    });
  }

  function walk(t: number): HumanPose {
    const g = gait(t, { stride: 7.5, lift: 4.5, bob: 2, rootY: R.root.y + 0.8, footSpread: 1 });
    const ph = t * Math.PI * 2;
    const mid = (R.footN.x + R.footF.x) / 2 - CENTER_X;
    return P({
      root: vec(R.root.x + 1, g.rootY),
      lean: R.lean + 0.1 + Math.sin(ph * 2) * 0.03,
      head: R.head - 0.05 - Math.sin(ph * 2) * 0.05,
      footN: vec(g.footN.x + mid + 1, g.footN.y),
      footF: vec(g.footF.x + mid + 1, g.footF.y),
      handN: vec(R.handN.x + 1 - g.swing * 4.5, R.handN.y + 1 - Math.max(0, g.swing) * 2),
      handF: vec(R.handF.x + 1 + g.swing * 4, R.handF.y + 1 - Math.max(0, -g.swing) * 2),
      flow: 0.55 + Math.sin(ph * 2) * 0.12,
    });
  }

  function pose(act: MonsterAction, t: number): HumanPose {
    switch (act) {
      case 'idle': return idle(t);
      case 'walk': return walk(t);
      case 'attack': return samplePoseTrack(ATTACK, t);
      case 'hurt': return samplePoseTrack(HURT, t);
      case 'death': return samplePoseTrack(DEATH, t);
    }
  }

  function clawTips(p: HumanPose, far: boolean): { tip: V; base: V } {
    const sk = solveSkeleton(p, PROP);
    const hand = spun(p, far ? sk.handF : sk.handN, sk);
    const el = spun(p, far ? sk.elF : sk.elN, sk);
    const d = perp(el, hand).u;
    return { tip: vec(hand.x + d.x * (clawLen + 2), hand.y + d.y * (clawLen + 2)), base: hand };
  }

  function fx(ctx: CanvasRenderingContext2D, p: HumanPose, act: MonsterAction, t: number): void {
    const sk = solveSkeleton(p, PROP);
    if (act === 'attack' && t > 0.5) {
      for (const far of spec.attack === 'maul' ? [true, false] : [false]) {
        const tips: V[] = [];
        const bases: V[] = [];
        for (let i = 5; i >= 0; i--) {
          const s = clawTips(samplePoseTrack(ATTACK, Math.max(0, t - i * 0.07)), far);
          tips.push(s.tip);
          bases.push(s.base);
        }
        smear(ctx, tips, bases, 0xe8f0ff, 0.45 * p.fx);
        // Three parallel rake streaks along the claw path
        for (let c = 0; c < 3; c++) {
          const off = (c - 1) * 1.6;
          ctx.strokeStyle = `rgba(255,255,255,${0.75 * p.fx})`;
          ctx.lineWidth = 0.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          tips.forEach((q, i) => {
            const x = q.x + off;
            const y = q.y - off * 0.6;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        }
      }
    }
    if (act === 'death' && t > 0.6) return;
    // Glowing eye
    const a = sk.headAng - FACE_TILT;
    const e = vec(3.3 * b * 0.96, -2.3 * b * 0.96);
    const eye = spun(p, vec(
      sk.head.x + e.x * Math.cos(a) - e.y * Math.sin(a),
      sk.head.y + e.x * Math.sin(a) + e.y * Math.cos(a),
    ), sk);
    glow(ctx, eye, 3 + p.fx * 1.5, L.eye, 0.55 + p.fx * 0.3);
  }

  const VSKIN = monsterViewSkin(SKIN, VIEW_OPTS);

  function viewFx(ctx: CanvasRenderingContext2D, p: HumanPose, act: MonsterAction, t: number, view: HumanView): void {
    const vsk = solveViewSkeleton(p, PROP, VSKIN.build, view);
    if (act === 'attack' && t > 0.5) {
      for (const far of spec.attack === 'maul' ? [true, false] : [false]) {
        const tips: V[] = [];
        const bases: V[] = [];
        for (let i = 5; i >= 0; i--) {
          const sp0 = samplePoseTrack(ATTACK, Math.max(0, t - i * 0.07));
          const s = solveViewSkeleton(sp0, PROP, VSKIN.build, view);
          const hand = far ? s.handF : s.handN;
          const el = far ? s.elF : s.elN;
          const d = perp(el, hand).u;
          tips.push(vec(hand.x + d.x * (clawLen + 2), hand.y + d.y * (clawLen + 2)));
          bases.push(hand);
        }
        smear(ctx, tips, bases, 0xe8f0ff, 0.45 * p.fx);
        for (let c = 0; c < 3; c++) {
          const off = (c - 1) * 1.6;
          ctx.strokeStyle = `rgba(255,255,255,${0.75 * p.fx})`;
          ctx.lineWidth = 0.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          tips.forEach((q, i) => {
            if (i === 0) ctx.moveTo(q.x + off, q.y - off * 0.6); else ctx.lineTo(q.x + off, q.y - off * 0.6);
          });
          ctx.stroke();
        }
      }
    }
    if (act === 'death' && t > 0.6) return;
    for (const eye of eyePoints(vsk, p)) glow(ctx, eye, 2.6 + p.fx * 1.4, L.eye, 0.5 + p.fx * 0.3);
  }

  return rigMonster<HumanPose>({
    key: spec.key,
    frameW: spec.frameW,
    frameH: spec.frameH,
    scale: spec.scale,
    views: MONSTER_VIEWS,
    pose,
    draw: (ctx, p, _act, t, view) => {
      if (view) drawHumanoidView(ctx, p, VSKIN, t, view);
      else drawHumanoid(ctx, p, SKIN, t);
    },
    shadow: (p, _act, _t, view) => ({
      x: groundX(view, Math.abs(p.spin) > 1 ? p.root.x + (p.spin > 0 ? 8 : -8) : p.root.x + 2),
      r: (spec.shadowR ?? 13) * (Math.abs(p.spin) > 1 ? 1.4 : 1),
      lift: Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y)),
    }),
    fx: (ctx, p, act, t, view) => (view ? viewFx(ctx, p, act, t, view) : fx(ctx, p, act, t)),
  });
}

// ── Twilight werewolf ───────────────────────────────────────────────────

export const WEREWOLF_LOOK: WolfLook = {
  fur: tone(0x75676a, { light: 0.3 }),
  furFar: tone(0x4d4250, { light: 0.15 }),
  mane: tone(0x4f4458, { light: 0.25 }),
  pale: tone(0xc4b49c, { light: 0.35, shadow: 0.38 }),
  pants: tone(0x4d3e6a, { light: 0.2 }),
  claw: tone(0xeee6d2, { light: 0.4, shadow: 0.3 }),
  nose: '#1a1620',
  gum: '#8a2a3a',
  eye: 0xffc23a,
  eyeCore: '#ffe48a',
  furLine: 'rgba(30,22,36,0.55)',
};

export const WerewolfDrawer = werewolfDrawer({
  key: 'monster_werewolf',
  // Wide for the hunched body, tail and claw swipe; width doesn't move the sprite in-game.
  frameW: 88,
  frameH: 64,
  scale: 1.42,
  look: WEREWOLF_LOOK,
  bulk: 1,
  attack: 'swipe',
});
