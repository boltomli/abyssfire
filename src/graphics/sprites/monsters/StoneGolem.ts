// src/graphics/sprites/monsters/StoneGolem.ts
//
// 石魔像 — a hulking boulder golem bound together by forge-rune magic:
// slate granite slabs with glowing orange cracks, a burning rune-core in the
// chest, a small sunken head with slit eyes, and colossal boulder fists
// hung on floating rock segments. Raises both fists overhead and hammers
// them into the ground; on death the runes flare and it crumbles to rubble.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  blobPath,
  cel,
  glow,
  inBone,
  lerpV,
  polyPath,
  samplePoseTrack,
  tone,
  vec,
  type Key,
  type Tone,
  type V,
} from '../rig/Rig';
import { basePose, drawHumanoid, gait, solveSkeleton, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { rigMonster } from '../rig/MonsterKit';

const ROCK = tone(0x98a0aa, { light: 0.4 });
const BODY = tone(0x7a8392, { light: 0.38 });
const ROCK_FAR = tone(0x646c79, { light: 0.25 });
const ROCK_DARK = tone(0x4d5461, { light: 0.25 });
const LICHEN = 'rgba(196,204,170,0.55)';
const RUNE = 0xff8a2a;
const HOT = 0xffd08a;

interface GolemPose extends HumanPose {
  /** Rune glow intensity. */
  glow: number;
  /** 0 intact … 1 fully collapsed into rubble. */
  crumble: number;
}

// ── Rock pieces ─────────────────────────────────────────────────────────

/** Faceted rock slab along a bone: irregular hexagon, wider at `wa`/`wb`. */
function rockSeg(ctx: CanvasRenderingContext2D, a: V, b: V, wa: number, wb: number, t: Tone, seed: number): void {
  inBone(ctx, a, b, (len) => {
    const j = (k: number): number => Math.sin(seed * 12.9898 + k * 78.233) * 0.8;
    const pts = [
      vec(-wa * 0.7 + j(1), -wa * 0.55), vec(wa * 0.6 + j(2), -wa * 0.7), vec(wa + j(3) * 0.5, len * 0.3),
      vec(wb * 0.95, len * 0.8 + j(4)), vec(wb * 0.4, len + wb * 0.5), vec(-wb * 0.8, len + wb * 0.3 + j(5)),
      vec(-wb, len * 0.6), vec(-wa * 0.95 + j(6) * 0.5, len * 0.2),
    ];
    cel(ctx, () => polyPath(ctx, pts), t, { band: Math.min(wa, wb) * 0.4, stroke: 0.6 });
    // Chisel facet line
    ctx.strokeStyle = t.shade;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(wa * 0.3, len * 0.15);
    ctx.lineTo(wb * 0.2 + j(7), len * 0.7);
    ctx.stroke();
  });
}

function runeLine(ctx: CanvasRenderingContext2D, pts: readonly V[], k: number): void {
  if (k <= 0.03) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(120,40,10,${Math.min(1, k)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,${150 + Math.min(1, k) * 40},70,${Math.min(1, k)})`;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function fist(ctx: CanvasRenderingContext2D, at: V, dir: number, t: Tone, g: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(dir);
  const pts = [vec(-6, -5), vec(1, -6.8), vec(6.4, -4.4), vec(7.6, 1.6), vec(5, 6.4), vec(-2.4, 6.8), vec(-6.8, 3)];
  cel(ctx, () => polyPath(ctx, pts), t, { band: 1.6, stroke: 0.6 });
  // Knuckle ridges
  ctx.strokeStyle = t.shade;
  ctx.lineWidth = 0.6;
  for (const y of [-2.2, 1, 4]) {
    ctx.beginPath();
    ctx.moveTo(3.2, y - 1);
    ctx.lineTo(6.8, y);
    ctx.stroke();
  }
  runeLine(ctx, [vec(-4, -2), vec(-1, 0.4), vec(-2, 3.6)], g * 0.8);
  ctx.restore();
}

function golemArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, t: Tone, g: number, seed: number): void {
  // Floating segments: the gaps between them glow with binding runes
  rockSeg(ctx, sh, lerpV(sh, el, 0.86), 5.4, 4.4, t, seed);
  rockSeg(ctx, lerpV(el, hand, 0.08), lerpV(el, hand, 0.72), 4.6, 5.4, t, seed + 1);
  ctx.save();
  ctx.globalAlpha = Math.min(1, g);
  ctx.fillStyle = 'rgb(255,160,70)';
  for (const k of [lerpV(sh, el, 0.93), lerpV(el, hand, 0.8)]) {
    ctx.beginPath();
    ctx.arc(k.x, k.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  fist(ctx, hand, Math.atan2(hand.y - el.y, hand.x - el.x) - Math.PI / 2 + 0.2, t, g);
}

function golemLeg(ctx: CanvasRenderingContext2D, sk: Skeleton, near: boolean, g: number): void {
  const t = near ? ROCK : ROCK_FAR;
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  const sole = near ? sk.soleN : sk.soleF;
  rockSeg(ctx, hip, knee, 5.8, 5, t, near ? 3 : 7);
  rockSeg(ctx, knee, ankle, 5, 5.4, t, near ? 4 : 8);
  // Slab foot
  cel(ctx, () => polyPath(ctx, [vec(ankle.x - 5.6, ankle.y - 1.4), vec(ankle.x + 3, ankle.y - 2.6), vec(sole.x + 8, sole.y - 3), vec(sole.x + 8.6, sole.y), vec(sole.x - 6.4, sole.y)]), t, { band: 1, stroke: 0.6 });
  if (near) runeLine(ctx, [vec(knee.x + 1.6, knee.y - 3), vec(knee.x - 0.6, knee.y), vec(knee.x + 1, knee.y + 3.4)], g * 0.7);
}

function golemTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: GolemPose, t: number): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Great boulder body, shoulders heaped high behind the head
    const body = [
      vec(-14, 1), vec(-11.6, -6.4), vec(-4, -8.4), vec(4, -6.6), vec(11, -1), vec(12.4, len * 0.42),
      vec(8.6, len * 0.85), vec(4, len + 2), vec(-5, len + 2), vec(-9.4, len * 0.7), vec(-12.6, len * 0.35),
    ];
    cel(ctx, () => polyPath(ctx, body), BODY, { band: 2.6, hi: 1.1, stroke: 0.7 });
    // Plate seams
    ctx.strokeStyle = BODY.shade;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-12, len * 0.3);
    ctx.lineTo(-4, len * 0.42);
    ctx.lineTo(2, len * 0.3);
    ctx.moveTo(-6.4, len + 2);
    ctx.lineTo(-3, len * 0.7);
    ctx.lineTo(8, len * 0.8);
    ctx.moveTo(-8, -7);
    ctx.lineTo(-5, -1);
    ctx.stroke();
    // Lichen patches
    ctx.fillStyle = LICHEN;
    for (const [x, y, r] of [[-8, -6, 1.6], [-5.6, -7.6, 1], [9, len * 0.7, 1.2], [-10, len * 0.5, 1.1]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glowing crack network radiating from the core
    const g = p.glow;
    const core = vec(4.4, len * 0.38);
    runeLine(ctx, [core, vec(0, len * 0.2), vec(-3.4, len * 0.24), vec(-7, 2)], g);
    runeLine(ctx, [core, vec(8.6, len * 0.14), vec(10.6, -1)], g);
    runeLine(ctx, [core, vec(1.8, len * 0.62), vec(-1.6, len * 0.78), vec(-2, len + 1.6)], g);
    runeLine(ctx, [core, vec(9.6, len * 0.62), vec(12.2, len * 0.72)], g * 0.8);
    // Rune-core socket
    cel(ctx, () => polyPath(ctx, [vec(core.x - 4.4, core.y - 1.2), vec(core.x - 1, core.y - 4.6), vec(core.x + 3.8, core.y - 2.6), vec(core.x + 4.2, core.y + 2.4), vec(core.x, core.y + 4.4), vec(core.x - 3.8, core.y + 2.6)]), ROCK_DARK, { band: 0.7, stroke: 0.5 });
    ctx.fillStyle = `rgba(255,${120 + Math.round(60 * Math.min(1, g))},50,${Math.min(1, 0.25 + g * 0.75)})`;
    ctx.beginPath();
    polyPath(ctx, [vec(core.x, core.y - 3), vec(core.x + 2.6, core.y), vec(core.x, core.y + 3), vec(core.x - 2.6, core.y)]);
    ctx.fill();
    if (g > 0.05) {
      ctx.fillStyle = `rgba(255,236,190,${Math.min(1, g) * (0.7 + 0.3 * Math.sin(t * Math.PI * 4))})`;
      ctx.beginPath();
      polyPath(ctx, [vec(core.x, core.y - 1.4), vec(core.x + 1.2, core.y), vec(core.x, core.y + 1.4), vec(core.x - 1.2, core.y)]);
      ctx.fill();
    }
  });
}

/** The head sits sunk into the front of the shoulders, not on a neck. */
function headAt(sk: Skeleton): V {
  const a = sk.torsoAng;
  const off = vec(7.4, 0.6);
  return vec(sk.neck.x + off.x * Math.cos(a) - off.y * Math.sin(a), sk.neck.y + off.x * Math.sin(a) + off.y * Math.cos(a));
}

function golemHead(ctx: CanvasRenderingContext2D, sk: Skeleton, p: GolemPose): void {
  const h = headAt(sk);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(sk.headAng);
  const pts = [vec(-4.6, -3), vec(-1, -5.6), vec(4.8, -4.8), vec(7, -1), vec(6.4, 3.4), vec(1, 4.6), vec(-4.4, 3)];
  cel(ctx, () => polyPath(ctx, pts), ROCK, { band: 1.2, stroke: 0.6 });
  // Heavy brow slab
  cel(ctx, () => polyPath(ctx, [vec(-1, -3.4), vec(7.6, -2.8), vec(7.4, -0.8), vec(0, -1)]), ROCK_DARK, { band: 0.5, stroke: 0.5 });
  // Slit eyes
  const g = Math.min(1, p.glow);
  ctx.fillStyle = '#1a0e0a';
  ctx.fillRect(2.4, -0.8, 4.6, 1.5);
  if (g > 0.05) {
    ctx.fillStyle = `rgba(255,190,90,${g})`;
    ctx.fillRect(3, -0.5, 1.6, 0.9);
    ctx.fillRect(5.4, -0.5, 1.3, 0.9);
  }
  // Jaw crack
  ctx.strokeStyle = ROCK.shade;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(2, 2.6);
  ctx.lineTo(6, 2);
  ctx.stroke();
  ctx.restore();
}

function shoulderRock(ctx: CanvasRenderingContext2D, sh: V, ang: number, t: Tone, k: number): void {
  ctx.save();
  ctx.translate(sh.x, sh.y - 1.2);
  ctx.rotate(ang * 0.6);
  ctx.scale(k, k);
  const pts = [vec(-6.6, 2.4), vec(-6, -3.4), vec(-1.4, -6.8), vec(4.4, -5.6), vec(7, -0.6), vec(5.4, 3.6), vec(-1, 4.8)];
  cel(ctx, () => polyPath(ctx, pts), t, { band: 1.6, hi: 0.8, stroke: 0.7 });
  ctx.strokeStyle = t.shade;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-4, -2.6);
  ctx.lineTo(0.4, -1.4);
  ctx.lineTo(3, -4);
  ctx.stroke();
  ctx.fillStyle = LICHEN;
  ctx.beginPath();
  ctx.arc(-2.6, -4.4, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 8.5, shin: 8, upperArm: 11, foreArm: 11,
    torso: 19, neck: 3.2, ankle: 3,
    hipN: vec(4, 0), hipF: vec(-5, -0.6),
    shN: vec(3, 3), shF: vec(-10, 2),
  },
  armFar(ctx, sk, p) {
    shoulderRock(ctx, sk.shF, sk.torsoAng, ROCK_FAR, 0.9);
    golemArm(ctx, sk.shF, sk.elF, sk.handF, ROCK_FAR, (p as GolemPose).glow * 0.7, 11);
  },
  legFar(ctx, sk, p) {
    golemLeg(ctx, sk, false, (p as GolemPose).glow);
  },
  legNear(ctx, sk, p) {
    golemLeg(ctx, sk, true, (p as GolemPose).glow);
  },
  torso(ctx, sk, p, t) {
    golemTorso(ctx, sk, p as GolemPose, t);
  },
  head(ctx, sk, p) {
    golemHead(ctx, sk, p as GolemPose);
  },
  armNear(ctx, sk, p) {
    golemArm(ctx, sk.shN, sk.elN, sk.handN, ROCK, (p as GolemPose).glow, 5);
    shoulderRock(ctx, sk.shN, sk.torsoAng, ROCK, 1);
  },
  weapon() {
    // Fists are drawn with the arms.
  },
};

// ── Poses ───────────────────────────────────────────────────────────────

const READY: GolemPose = {
  ...basePose({
    root: vec(CENTER_X - 3, 73),
    lean: 0.26,
    head: -0.2,
    footN: vec(CENTER_X + 5, GROUND_Y),
    footF: vec(CENTER_X - 9, GROUND_Y),
    handN: vec(CENTER_X + 13, 76),
    handF: vec(CENTER_X - 13, 79),
  }),
  glow: 0.8,
  crumble: 0,
};

const P = (o: Partial<GolemPose>): GolemPose => ({ ...READY, ...o });

const ATTACK: Key<GolemPose>[] = [
  { at: 0, pose: READY },
  // Both fists heaved up over the head, rocking back
  { at: 0.33, ease: 'out', pose: P({ root: vec(CENTER_X - 5, 72), lean: -0.12, head: -0.25, handN: vec(CENTER_X + 3, 42), handF: vec(CENTER_X - 7, 44), glow: 1.1, stretch: 0.05, fx: 0.4 }) },
  // Tipping forward, fists coming over
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X - 1, 72), lean: 0.3, head: -0.3, handN: vec(CENTER_X + 14, 44), handF: vec(CENTER_X + 6, 46), footN: vec(CENTER_X + 8, GROUND_Y), glow: 1.3, fx: 0.8 }) },
  // SLAM — both fists into the ground
  { at: 1, ease: 'linear', pose: P({ root: vec(CENTER_X + 2, 76.5), lean: 0.78, head: -0.55, handN: vec(CENTER_X + 21, 83), handF: vec(CENTER_X + 12, 84), footN: vec(CENTER_X + 9, GROUND_Y), glow: 1.5, fx: 1, stretch: -0.06 }) },
];

const recoil = P({ root: vec(CENTER_X - 6, 73.5), lean: 0.02, head: -0.35, handN: vec(CENTER_X + 7, 72), handF: vec(CENTER_X - 7, 74), footF: vec(CENTER_X - 11, GROUND_Y), glow: 1.4, stretch: -0.03 });

const HURT: Key<GolemPose>[] = [
  { at: 0, pose: recoil },
  { at: 1, pose: P({ root: vec(CENTER_X - 4.5, 73), lean: 0.16, head: -0.25, handN: vec(CENTER_X + 11, 75), handF: vec(CENTER_X - 4, 77), glow: 1 }) },
];

const DEATH: Key<GolemPose>[] = [
  { at: 0, pose: { ...recoil, glow: 1.6 } },
  // Runes flare and the knees buckle
  { at: 0.33, pose: P({ root: vec(CENTER_X - 4, 77), lean: 0.3, head: 0.1, footN: vec(CENTER_X + 4, GROUND_Y), footF: vec(CENTER_X - 10, GROUND_Y), handN: vec(CENTER_X + 11, 84), handF: vec(CENTER_X - 1, 85), glow: 2 }) },
  // Breaking apart
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X - 4, 78), lean: 0.36, head: 0.2, footN: vec(CENTER_X + 4, GROUND_Y), footF: vec(CENTER_X - 10, GROUND_Y), handN: vec(CENTER_X + 12, 85), handF: vec(CENTER_X - 1, 86), glow: 0.9, crumble: 0.55 }) },
  { at: 1, ease: 'out', pose: P({ root: vec(CENTER_X - 4, 78), lean: 0.36, head: 0.2, footN: vec(CENTER_X + 4, GROUND_Y), footF: vec(CENTER_X - 10, GROUND_Y), handN: vec(CENTER_X + 12, 85), handF: vec(CENTER_X - 1, 86), glow: 0.2, crumble: 1 }) },
];

function golemPose(act: MonsterAction, t: number): GolemPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle': {
      const b = Math.sin(ph);
      return {
        ...READY,
        root: vec(READY.root.x, READY.root.y + b * 0.5),
        stretch: b * -0.015,
        head: READY.head + Math.sin(ph - 0.7) * 0.04,
        handN: vec(READY.handN.x, READY.handN.y + b * 0.6),
        handF: vec(READY.handF.x, READY.handF.y + Math.sin(ph - 0.5) * 0.6),
        glow: 0.75 + 0.2 * Math.sin(ph),
      };
    }
    case 'walk': {
      const g = gait(t, { stride: 5.5, lift: 2.4, bob: 1.8, rootY: READY.root.y + 0.4, footSpread: 2 });
      return {
        ...READY,
        root: vec(READY.root.x, g.rootY),
        lean: READY.lean + 0.05 + Math.sin(ph * 2) * 0.02,
        footN: vec(g.footN.x - 2, g.footN.y),
        footF: vec(g.footF.x - 2, g.footF.y),
        handN: vec(READY.handN.x - g.swing * 3.5, READY.handN.y - Math.abs(g.swing) * 0.8),
        handF: vec(READY.handF.x + g.swing * 3, READY.handF.y),
        glow: 0.8,
      };
    }
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

// ── Crumble rendering ───────────────────────────────────────────────────

const RUBBLE: readonly { x: number; r: number; h: number; seed: number }[] = [
  { x: -16, r: 4.4, h: 3.2, seed: 1 },
  { x: -9, r: 6, h: 4.4, seed: 2 },
  { x: 11, r: 5, h: 3.6, seed: 3 },
  { x: 17, r: 3.6, h: 2.6, seed: 4 },
  { x: -1, r: 5.4, h: 3.4, seed: 5 },
  { x: 5, r: 4, h: 3, seed: 6 },
];

function rubbleRock(ctx: CanvasRenderingContext2D, c: V, r: number, h: number, seed: number, t: Tone): void {
  const pts: V[] = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    const j = 0.8 + 0.25 * Math.sin(seed * 3.1 + i * 1.7);
    pts.push(vec(c.x + Math.cos(a) * r * j, c.y + Math.sin(a) * h * 2 * j));
  }
  pts.push(vec(c.x + r * 0.6, c.y + 0.4), vec(c.x - r * 0.6, c.y + 0.4));
  cel(ctx, () => polyPath(ctx, pts), t, { band: 1, stroke: 0.6 });
}

function drawGolem(ctx: CanvasRenderingContext2D, p: GolemPose, t: number): void {
  const c = p.crumble;
  if (c <= 0.001) {
    drawHumanoid(ctx, p, SKIN, t);
    return;
  }
  const sk = solveSkeleton(p, SKIN.prop);
  const cx = p.root.x;
  // Rubble behind the falling pieces
  for (const r of RUBBLE.slice(0, 3)) {
    rubbleRock(ctx, vec(cx + r.x * 0.9, GROUND_Y), r.r * c, r.h * c, r.seed, ROCK_FAR);
  }
  // Each body part drops toward the pile, tumbling
  const piece = (centre: V, rest: V, rot: number, fn: () => void): void => {
    const k = Math.min(1, c * 1.1);
    const e = k * k;
    ctx.save();
    ctx.translate(centre.x + (rest.x - centre.x) * e, centre.y + (rest.y - centre.y) * e);
    ctx.rotate(rot * k);
    ctx.translate(-centre.x, -centre.y);
    fn();
    ctx.restore();
  };
  const torsoC = lerpV(sk.neck, sk.pelvis, 0.5);
  piece(sk.elF, vec(cx - 12, GROUND_Y - 5), -0.9, () => SKIN.armFar(ctx, sk, p, t));
  piece(sk.kneeF, vec(cx - 8, GROUND_Y - 4), -1.2, () => SKIN.legFar(ctx, sk, p, t));
  piece(sk.kneeN, vec(cx + 4, GROUND_Y - 4), 1.1, () => SKIN.legNear(ctx, sk, p, t));
  // The boulder body shatters into three slabs along jagged fault lines
  const shards: readonly { a0: number; a1: number; rest: V; rot: number }[] = [
    { a0: -2.6, a1: -0.5, rest: vec(cx - 6, GROUND_Y - 6), rot: -1.2 },
    { a0: -0.5, a1: 1.3, rest: vec(cx + 6, GROUND_Y - 5), rot: 0.9 },
    { a0: 1.3, a1: 3.68, rest: vec(cx - 1, GROUND_Y - 5), rot: 0.25 },
  ];
  const jag = (a: number): V => vec(torsoC.x + Math.cos(a + 0.4) * 6, torsoC.y + Math.sin(a + 0.4) * 6);
  for (const sh of shards) {
    piece(torsoC, sh.rest, sh.rot, () => {
      ctx.save();
      ctx.beginPath();
      const R = 40;
      polyPath(ctx, [
        torsoC, jag(sh.a0), vec(torsoC.x + Math.cos(sh.a0) * R, torsoC.y + Math.sin(sh.a0) * R),
        vec(torsoC.x + Math.cos((sh.a0 + sh.a1) / 2) * R, torsoC.y + Math.sin((sh.a0 + sh.a1) / 2) * R),
        vec(torsoC.x + Math.cos(sh.a1) * R, torsoC.y + Math.sin(sh.a1) * R), jag(sh.a1),
      ]);
      ctx.clip();
      SKIN.torso(ctx, sk, p, t);
      ctx.restore();
    });
  }
  piece(headAt(sk), vec(cx + 15, GROUND_Y - 4), 1.6, () => SKIN.head(ctx, sk, p, t));
  piece(sk.elN, vec(cx + 9, GROUND_Y - 6), 1.2, () => SKIN.armNear(ctx, sk, p, t));
  // Rubble in front
  for (const r of RUBBLE.slice(3)) {
    rubbleRock(ctx, vec(cx + r.x, GROUND_Y + 0.5), r.r * c, r.h * c, r.seed, ROCK);
  }
}

function drawFx(ctx: CanvasRenderingContext2D, p: GolemPose, act: MonsterAction, t: number): void {
  const sk = solveSkeleton(p, SKIN.prop);
  const g = Math.min(1.5, p.glow);
  if (p.crumble < 0.3) {
    const core = lerpV(sk.neck, sk.pelvis, 0.38);
    glow(ctx, vec(core.x + 4, core.y), 5 + g * 2, RUNE, 0.2 * g);
    const hd = headAt(sk);
    const eye = vec(hd.x + Math.cos(sk.headAng) * 4.6, hd.y + Math.sin(sk.headAng) * 4.6);
    glow(ctx, eye, 3, RUNE, 0.45 * Math.min(1, g));
    // Wind-up: rune energy gathering in the fists
    if (act === 'attack') {
      for (const h of [sk.handN, sk.handF]) glow(ctx, h, 5 + p.fx * 4, RUNE, 0.3 * p.fx);
    }
  }
  if (act === 'attack' && t > 0.95) {
    const hit = vec((sk.handN.x + sk.handF.x) / 2 + 3, GROUND_Y);
    glow(ctx, hit, 14, RUNE, 0.5);
    glow(ctx, hit, 6, HOT, 0.7);
    // Ground crack + shockwave ring
    ctx.strokeStyle = 'rgba(255,190,110,0.85)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(hit.x - 14, hit.y + 1.2);
    ctx.lineTo(hit.x - 7, hit.y + 0.2);
    ctx.lineTo(hit.x - 2, hit.y + 1.6);
    ctx.lineTo(hit.x + 6, hit.y + 0.4);
    ctx.lineTo(hit.x + 14, hit.y + 1.4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220,210,190,0.6)';
    ctx.beginPath();
    ctx.ellipse(hit.x, hit.y + 0.5, 17, 3.4, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    // Flung stone chips
    ctx.fillStyle = '#9aa2ad';
    for (const [dx, dy, s] of [[-13, -8, 1.6], [-7, -13, 1.2], [5, -14, 1.4], [12, -9, 1.7], [16, -4, 1.1]] as const) {
      ctx.fillRect(hit.x + dx, hit.y + dy, s, s * 0.8);
    }
  }
  if (act === 'death') {
    if (t > 0.2 && t < 0.8) {
      // Dust bursting out as it breaks
      const k = (t - 0.2) / 0.6;
      ctx.fillStyle = `rgba(190,184,172,${0.5 * (1 - k)})`;
      for (const [dx, dy, r] of [[-14, -6, 4], [-6, -12, 5], [6, -10, 4.6], [14, -5, 3.8], [0, -3, 5]] as const) {
        ctx.beginPath();
        ctx.arc(p.root.x + dx * (0.6 + k * 0.6), GROUND_Y + dy * (0.5 + k * 0.5), r * (0.6 + k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (p.crumble > 0.5) {
      // Dying embers in the rubble
      for (const [dx, dy] of [[-6, -5], [3, -7], [9, -3]] as const) {
        glow(ctx, vec(p.root.x + dx, GROUND_Y + dy), 2.4, RUNE, 0.5 * p.glow + 0.1);
      }
    }
  }
}

export const StoneGolemDrawer = rigMonster<GolemPose>({
  key: 'monster_stone_golem',
  // Wide for the double-fist slam; width doesn't move the sprite in-game.
  frameW: 84,
  frameH: 68,
  scale: 1.45,
  pose: golemPose,
  draw: (ctx, p, _act, t) => drawGolem(ctx, p, t),
  shadow: (p) => ({ x: p.root.x + 2, r: p.crumble > 0.5 ? 20 : 17, lift: Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y)) }),
  fx: drawFx,
  rim: 'rgba(230,236,255,0.5)',
});
