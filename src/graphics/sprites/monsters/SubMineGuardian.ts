// src/graphics/sprites/monsters/SubMineGuardian.ts
//
// 矿道铁卫 — sub-dungeon boss. A squat dwarf-golem miner: a riveted iron and
// bronze barrel body on stumpy legs, a miner's helm with a blazing head-lamp
// over an iron face-mask and a braided stone beard, a cluster of glowing
// blue crystals grown out of its back, and a swinging lantern on the belt.
// Hauls its great pickaxe back over the shoulder and drives the spike into
// the rock, bursting crystal shards; on death it topples onto its back.
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
  type Skeleton,
} from '../rig/Humanoid';
import { rigMonster } from '../rig/MonsterKit';

const IRON = tone(0x727a88, { light: 0.45 });
const IRON_FAR = tone(0x535a67, { light: 0.25 });
const IRON_DARK = tone(0x3e434f, { light: 0.3 });
const BRONZE = tone(0xb3743e, { light: 0.4 });
const STONE = tone(0x8a7a66, { light: 0.35 });
const STONE_DARK = tone(0x5e5244, { light: 0.25 });
const WOOD = tone(0x74502f, { light: 0.3 });
const CRYSTAL = tone(0x62c8ff, { light: 0.55, shadow: 0.3 });
const CRYSTAL_DEEP = tone(0x3a86d0, { light: 0.45, shadow: 0.3 });
const LAMP = 0xffc050;
const BLUE = 0x5ec8ff;

const PICK_LEN = 19;

interface MinerPose extends HumanPose {
  /** Lamp / crystal light intensity (dies on death). */
  light: number;
  /** Lantern swing angle. */
  swing: number;
}

// ── Pieces ──────────────────────────────────────────────────────────────

function rivets(ctx: CanvasRenderingContext2D, pts: readonly V[], t: Tone): void {
  ctx.fillStyle = t.light;
  for (const r of pts) {
    ctx.beginPath();
    ctx.arc(r.x, r.y, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function crystal(ctx: CanvasRenderingContext2D, base: V, ang: number, len: number, w: number, t: Tone): void {
  inBone(ctx, base, along(base, ang, len), (l) => {
    const pts = [vec(-w, 0), vec(-w, l * 0.7), vec(0, l + w * 0.6), vec(w, l * 0.7), vec(w, 0)];
    cel(ctx, () => polyPath(ctx, pts), t, { band: w * 0.5, hi: w * 0.25, stroke: 0.45 });
    ctx.strokeStyle = 'rgba(235,250,255,0.75)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, l * 0.1);
    ctx.lineTo(-w * 0.2, l * 0.72);
    ctx.lineTo(0, l + w * 0.5);
    ctx.stroke();
  });
}

function crystalCluster(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  // Grown out of the back of the shoulders, fanning up and back
  const a = sk.torsoAng;
  const at = (x: number, y: number): V => vec(sk.neck.x + x * Math.cos(a) - y * Math.sin(a), sk.neck.y + x * Math.sin(a) + y * Math.cos(a));
  const up = a + Math.PI; // dirUp angle pointing along the spine upward is `a`
  void up;
  crystal(ctx, at(-8, 6), a - 1.2, 10, 2, CRYSTAL_DEEP);
  crystal(ctx, at(-6, 3), a - 0.5, 15, 2.6, CRYSTAL);
  crystal(ctx, at(-9, 8.5), a - 0.85, 12, 2.2, CRYSTAL);
  crystal(ctx, at(-4, 2), a - 0.12, 10, 2, CRYSTAL_DEEP);
  crystal(ctx, at(-10, 11), a - 1.55, 8, 1.7, CRYSTAL);
  // Rocky crust the crystals grow from
  cel(ctx, () => blobPath(ctx, [at(-11.6, 12), at(-11.4, 4), at(-7, 0.6), at(-2.4, 1.2), at(-4.6, 6), at(-7.6, 13.6)]), STONE_DARK, { band: 0.8 });
}

function boot(ctx: CanvasRenderingContext2D, ankle: V, sole: V, t: Tone): void {
  cel(ctx, () => blobPath(ctx, [
    vec(ankle.x - 4, ankle.y - 1.4), vec(ankle.x + 2.6, ankle.y - 2.2),
    vec(sole.x + 6.8, sole.y - 3.2), vec(sole.x + 8, sole.y), vec(sole.x - 4.6, sole.y),
  ]), t, { band: 1 });
  // Iron toe-cap and sole
  cel(ctx, () => polyPath(ctx, [vec(sole.x + 3.4, sole.y - 3), vec(sole.x + 7, sole.y - 2.8), vec(sole.x + 8.2, sole.y), vec(sole.x + 3.4, sole.y)]), IRON, { band: 0.5, stroke: 0.4 });
  ctx.fillStyle = IRON_DARK.base;
  ctx.fillRect(sole.x - 4.6, sole.y - 0.9, 12.6, 0.9);
}

function minerLeg(ctx: CanvasRenderingContext2D, sk: Skeleton, near: boolean): void {
  const t = near ? STONE : STONE_DARK;
  const plate = near ? IRON : IRON_FAR;
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  const sole = near ? sk.soleN : sk.soleF;
  limb(ctx, hip, knee, 4.6, 4, t);
  limb(ctx, knee, ankle, 4, 3.8, plate);
  inBone(ctx, knee, ankle, (len) => {
    ctx.strokeStyle = plate.shade;
    ctx.lineWidth = 0.5;
    for (const k of [0.35, 0.65]) {
      ctx.beginPath();
      ctx.moveTo(-3.6, len * k);
      ctx.lineTo(3.6, len * k);
      ctx.stroke();
    }
  });
  boot(ctx, ankle, sole, near ? STONE : STONE_DARK);
  cel(ctx, () => ellipsePath(ctx, knee, 3.4, 3), near ? BRONZE : tone(0x7c5430), { band: 0.7 });
}

function minerArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, near: boolean): void {
  const t = near ? STONE : STONE_DARK;
  limb(ctx, sh, el, 4.2, 3.6, t);
  limb(ctx, el, hand, 3.6, 3.8, near ? IRON : IRON_FAR);
  // Bronze bracer band
  const b = lerpV(el, hand, 0.55);
  cel(ctx, () => ellipsePath(ctx, b, 3.6, 2.2, Math.atan2(hand.y - el.y, hand.x - el.x) + Math.PI / 2), near ? BRONZE : tone(0x7c5430), { band: 0.4 });
}

function mitt(ctx: CanvasRenderingContext2D, at: V, t: Tone): void {
  cel(ctx, () => ellipsePath(ctx, at, 3.4, 3, 0.3), t, { band: 0.8 });
  ctx.strokeStyle = t.shade;
  ctx.lineWidth = 0.5;
  for (const d of [-1, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(at.x - 1.6, at.y + d);
    ctx.lineTo(at.x + 2.4, at.y + d + 0.5);
    ctx.stroke();
  }
}

function barrel(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Stone core
    const body = [vec(-10.6, 0), vec(-5, -3.4), vec(5, -2.6), vec(11.4, 2.4), vec(12.6, len * 0.55), vec(10, len + 1.8), vec(-7, len + 2), vec(-11.6, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), STONE, { band: 2.2, hi: 1 });
    // Riveted iron belly plate
    const plate = [vec(-2.4, 3.4), vec(8.6, 3.2), vec(11.4, len * 0.5), vec(9.4, len - 0.6), vec(-1.6, len - 0.4), vec(-3.4, len * 0.5)];
    cel(ctx, () => blobPath(ctx, plate), IRON, { band: 1.4, hi: 0.6 });
    rivets(ctx, [vec(-0.6, 5), vec(3.4, 4.6), vec(7.4, 4.8), vec(-1, len - 2.2), vec(4, len - 2), vec(8.4, len - 2.4)], IRON);
    // Bronze bands across the belly
    for (const y of [len * 0.36, len * 0.62]) {
      cel(ctx, () => polyPath(ctx, [vec(-3.2, y - 1), vec(11.6, y - 1.4), vec(11.8, y + 0.8), vec(-3.2, y + 1.2)]), BRONZE, { band: 0.4, stroke: 0.4 });
    }
    // Wide leather belt with a big buckle
    cel(ctx, () => polyPath(ctx, [vec(-8.4, len - 1.4), vec(11, len - 2), vec(11.2, len + 1.8), vec(-8, len + 2.2)]), tone(0x4e3522), { band: 0.5 });
    cel(ctx, () => polyPath(ctx, [vec(4.6, len - 2.4), vec(9, len - 2.6), vec(9.2, len + 2.2), vec(4.8, len + 2.4)]), BRONZE, { band: 0.5 });
    ctx.fillStyle = IRON_DARK.base;
    ctx.fillRect(6.2, len - 1, 1.6, 1.8);
    // Stone cracks
    ctx.strokeStyle = STONE.shade;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(-5.6, 6);
    ctx.lineTo(-6.4, 9);
    ctx.stroke();
  });
}

function pauldron(ctx: CanvasRenderingContext2D, sh: V, el: V): void {
  inBone(ctx, sh, el, () => {
    ctx.translate(0, -1.4);
    const dome = [vec(-6.4, 3.4), vec(-5.4, -2.8), vec(0, -5.4), vec(5.4, -2.8), vec(6.4, 3.4), vec(0, 4.8)];
    cel(ctx, () => blobPath(ctx, dome), IRON, { band: 1.2, hi: 0.6, stroke: 0.8 });
    ctx.strokeStyle = BRONZE.base;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-6, 3.2);
    ctx.quadraticCurveTo(0, 5.8, 6, 3.2);
    ctx.stroke();
    rivets(ctx, [vec(-3.4, 1.6), vec(0, 2.6), vec(3.4, 1.6)], BRONZE);
  });
  // A few crystals poking out of the near pauldron
  crystal(ctx, vec(sh.x - 2.6, sh.y - 3.4), -0.5, 5, 1.2, CRYSTAL);
  crystal(ctx, vec(sh.x - 0.6, sh.y - 4), -0.1, 3.6, 1, CRYSTAL_DEEP);
}

function minerHead(ctx: CanvasRenderingContext2D, sk: Skeleton, p: MinerPose): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Iron face-mask
  const face = [vec(-4.6, -2), vec(1, -3.4), vec(6.8, -2), vec(7.4, 2.6), vec(4, 5), vec(-3.4, 3.6)];
  cel(ctx, () => blobPath(ctx, face), IRON, { band: 1 });
  // Glowing eye slits
  ctx.fillStyle = '#140c08';
  ctx.fillRect(2.4, -0.9, 4.6, 1.5);
  if (p.light > 0.05) {
    ctx.fillStyle = `rgba(255,196,90,${Math.min(1, p.light)})`;
    ctx.fillRect(3, -0.6, 1.5, 0.9);
    ctx.fillRect(5.2, -0.6, 1.3, 0.9);
  }
  // Braided stone beard spilling down over the chest
  const beard = [vec(-1.8, 1.6), vec(7.6, 1.8), vec(8.4, 6), vec(6.4, 10), vec(4.2, 13.4), vec(2.4, 10.6), vec(-0.6, 8.2), vec(-2.6, 4.6)];
  cel(ctx, () => blobPath(ctx, beard), STONE, { band: 1.2 });
  ctx.strokeStyle = STONE.shade;
  ctx.lineWidth = 0.5;
  for (const [x0, x1] of [[1, 2.6], [3.6, 4.2], [6, 5.8]] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, 3.4);
    ctx.quadraticCurveTo(x0 + 1.4, 7, x1, 10);
    ctx.stroke();
  }
  // Bronze beard rings
  cel(ctx, () => polyPath(ctx, [vec(2.6, 9.6), vec(6, 9.6), vec(5.6, 11), vec(3, 11)]), BRONZE, { band: 0.3, stroke: 0.35 });
  // Miner's helm: dome + wide brim
  const dome = [vec(-5.6, -1.8), vec(-4.6, -6.6), vec(0.6, -8.8), vec(5.4, -7), vec(7, -2.6)];
  cel(ctx, () => blobPath(ctx, dome), IRON, { band: 1.4, hi: 0.7 });
  cel(ctx, () => polyPath(ctx, [vec(-6.8, -2.6), vec(9.4, -3.2), vec(9.6, -1.4), vec(-6.8, -0.8)]), IRON_DARK, { band: 0.5 });
  ctx.strokeStyle = BRONZE.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-2, -7.8);
  ctx.quadraticCurveTo(2, -9.4, 5.4, -6.6);
  ctx.stroke();
  // Head-lamp housing
  cel(ctx, () => polyPath(ctx, [vec(3.4, -6.6), vec(8.4, -6.4), vec(8.8, -2.8), vec(3.6, -3.2)]), BRONZE, { band: 0.5 });
  ctx.fillStyle = p.light > 0.05 ? `rgba(255,236,170,${0.5 + Math.min(1, p.light) * 0.5})` : '#3a3530';
  ctx.beginPath();
  ctx.ellipse(8.6, -4.7, 1.1, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function lantern(ctx: CanvasRenderingContext2D, sk: Skeleton, p: MinerPose): void {
  // Hangs from the belt at the back hip on a short chain
  const a = sk.torsoAng;
  const len = Math.hypot(sk.pelvis.x - sk.neck.x, sk.pelvis.y - sk.neck.y);
  const hook = vec(sk.neck.x + -6 * Math.cos(a) - (len + 1) * Math.sin(a), sk.neck.y + -6 * Math.sin(a) + (len + 1) * Math.cos(a));
  const body = along(hook, Math.PI + p.swing, 5);
  ctx.strokeStyle = IRON_DARK.base;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(hook.x, hook.y);
  ctx.lineTo(body.x, body.y);
  ctx.stroke();
  inBone(ctx, body, along(body, Math.PI + p.swing, 6), () => {
    cel(ctx, () => polyPath(ctx, [vec(-2.4, 0.4), vec(2.4, 0.4), vec(2.8, 1.4), vec(-2.8, 1.4)]), BRONZE, { band: 0.3, stroke: 0.35 });
    ctx.fillStyle = p.light > 0.05 ? `rgba(255,208,110,${0.6 + Math.min(1, p.light) * 0.4})` : '#4a4036';
    ctx.fillRect(-2.2, 1.4, 4.4, 4);
    ctx.strokeStyle = IRON_DARK.base;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-2.2, 1.4, 4.4, 4);
    ctx.beginPath();
    ctx.moveTo(0, 1.4);
    ctx.lineTo(0, 5.4);
    ctx.stroke();
    cel(ctx, () => polyPath(ctx, [vec(-2.8, 5.4), vec(2.8, 5.4), vec(2, 6.6), vec(-2, 6.6)]), BRONZE, { band: 0.3, stroke: 0.35 });
  });
}

function pickaxe(ctx: CanvasRenderingContext2D, at: V, angle: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  cel(ctx, () => capsulePath(ctx, vec(0, 4), vec(0, -PICK_LEN + 1), 1.1, 1.3), WOOD, { band: 0.4 });
  for (const y of [-4, -9]) {
    cel(ctx, () => polyPath(ctx, [vec(-1.5, y - 0.6), vec(1.5, y - 0.6), vec(1.5, y + 0.6), vec(-1.5, y + 0.6)]), tone(0x4e3522), { band: 0.2, stroke: 0.3 });
  }
  ctx.translate(0, -PICK_LEN);
  // Curved pick head: long spike forward (+x), shorter chisel back (−x)
  const head = [
    vec(-8.4, -0.4), vec(-7.6, -2), vec(-2, -3.4), vec(2, -3.4), vec(8, -2.2), vec(13.4, 1.6),
    vec(8, 0.2), vec(2, 1.8), vec(-2, 1.8), vec(-7.4, 1.6),
  ];
  cel(ctx, () => polyPath(ctx, head), IRON, { band: 1, hi: 0.5 });
  cel(ctx, () => polyPath(ctx, [vec(-2.6, -4), vec(2.6, -4), vec(2.6, 2.4), vec(-2.6, 2.4)]), BRONZE, { band: 0.4 });
  // Crystal-tipped spike
  cel(ctx, () => polyPath(ctx, [vec(9, -1.2), vec(14.4, 2.2), vec(10, 0.6)]), CRYSTAL, { band: 0.3, stroke: 0.35 });
  ctx.strokeStyle = 'rgba(240,244,250,0.8)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(3, -3);
  ctx.lineTo(8, -1.9);
  ctx.stroke();
  ctx.restore();
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 8.5, shin: 8, upperArm: 9.4, foreArm: 9,
    torso: 16.5, neck: 5.2, ankle: 2.8,
    hipN: vec(3.6, 0), hipF: vec(-4.2, -0.5),
    shN: vec(1.4, 3), shF: vec(-7.6, 2.4),
  },
  back(ctx, sk) {
    crystalCluster(ctx, sk);
  },
  armFar(ctx, sk) {
    minerArm(ctx, sk.shF, sk.elF, sk.handF, false);
    mitt(ctx, sk.handF, IRON_FAR);
  },
  legFar(ctx, sk) {
    minerLeg(ctx, sk, false);
  },
  legNear(ctx, sk) {
    minerLeg(ctx, sk, true);
  },
  torso(ctx, sk, p) {
    lantern(ctx, sk, p as MinerPose);
    barrel(ctx, sk);
  },
  head(ctx, sk, p) {
    minerHead(ctx, sk, p as MinerPose);
  },
  armNear(ctx, sk) {
    minerArm(ctx, sk.shN, sk.elN, sk.handN, true);
    pauldron(ctx, sk.shN, sk.elN);
  },
  weapon(ctx, sk, p) {
    pickaxe(ctx, sk.handN, p.wpn);
    mitt(ctx, sk.handN, IRON);
  },
};

// ── Poses ───────────────────────────────────────────────────────────────

function grip(p: MinerPose, gap = 5): MinerPose {
  return { ...p, handF: along(p.handN, p.wpn, gap) };
}

const READY: MinerPose = {
  ...basePose({
    root: vec(CENTER_X - 3, 72.5),
    lean: 0.2,
    head: -0.12,
    footN: vec(CENTER_X + 5, GROUND_Y),
    footF: vec(CENTER_X - 9, GROUND_Y),
    handN: vec(CENTER_X + 10, 72),
    wpn: 0.55,
    flow: 0.1,
  }),
  light: 1,
  swing: 0,
};

const P = (o: Partial<MinerPose>): MinerPose => ({ ...READY, ...o });

const ATTACK: Key<MinerPose>[] = [
  { at: 0, pose: READY },
  // Pick hauled back over the shoulder
  { at: 0.33, ease: 'out', pose: P({ root: vec(CENTER_X - 6, 72), lean: -0.16, head: -0.2, handN: vec(CENTER_X + 1, 54), wpn: -0.7, footN: vec(CENTER_X + 6, GROUND_Y), stretch: 0.05, swing: -0.5, fx: 0.3 }) },
  // Over the top
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X - 1, 72), lean: 0.25, head: -0.15, handN: vec(CENTER_X + 10, 52), wpn: 0.95, footN: vec(CENTER_X + 9, GROUND_Y), swing: 0.3, fx: 0.8 }) },
  // Spike into the rock
  { at: 1, ease: 'linear', pose: P({ root: vec(CENTER_X + 2, 75.5), lean: 0.62, head: 0.05, handN: vec(CENTER_X + 16, 69), wpn: 2.2, footN: vec(CENTER_X + 11, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y), swing: 0.6, fx: 1, stretch: -0.05 }) },
];

const recoil = P({ root: vec(CENTER_X - 7, 73), lean: -0.22, head: -0.3, handN: vec(CENTER_X + 4, 66), wpn: 0.2, footF: vec(CENTER_X - 11, GROUND_Y), swing: -0.7, stretch: -0.03 });

const HURT: Key<MinerPose>[] = [
  { at: 0, pose: recoil },
  { at: 1, pose: P({ root: vec(CENTER_X - 5, 72.5), lean: 0, head: -0.18, handN: vec(CENTER_X + 8, 70), wpn: 0.4, swing: 0.4 }) },
];

// Staggers, drops to a knee and pitches forward onto its face; the crystal
// back juts up from the heap and the lamp gutters out. Spin rotates the
// whole rig, so the lying pose is authored upright (legs below the pelvis).
const DEATH: Key<MinerPose>[] = [
  { at: 0, pose: recoil },
  { at: 0.33, pose: P({ root: vec(CENTER_X - 4, 77.5), lean: 0.45, head: 0.2, handN: vec(CENTER_X + 11, 74), wpn: 2.6, footN: vec(CENTER_X + 4, GROUND_Y), footF: vec(CENTER_X - 11, GROUND_Y), swing: 0.3, light: 0.7 }) },
  { at: 0.67, ease: 'in', pose: P({ root: vec(CENTER_X - 5, 79.5), lean: 0.1, head: 0.2, spin: 0.85, handN: vec(CENTER_X + 2, 55), wpn: 0.8, footN: vec(CENTER_X - 4, 97), footF: vec(CENTER_X - 8, 97), swing: -0.85, light: 0.35 }) },
  { at: 1, ease: 'out', pose: P({ root: vec(CENTER_X - 9, 79.5), lean: 0, head: 0.25, spin: 1.5, handN: vec(CENTER_X - 5, 57), wpn: -0.35, footN: vec(CENTER_X - 8, 97.5), footF: vec(CENTER_X - 12, 97), swing: -1.5, light: 0 }) },
];

function minerPose(act: MonsterAction, t: number): MinerPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle': {
      const b = Math.sin(ph);
      return grip({
        ...READY,
        root: vec(READY.root.x, READY.root.y + b * 0.5),
        stretch: b * -0.015,
        head: READY.head + Math.sin(ph - 0.6) * 0.04,
        handN: vec(READY.handN.x, READY.handN.y + b * 0.4),
        wpn: READY.wpn + Math.sin(ph - 0.3) * 0.03,
        swing: Math.sin(ph - 1) * 0.12,
      });
    }
    case 'walk': {
      const g = gait(t, { stride: 5.5, lift: 2.8, bob: 1.5, rootY: READY.root.y + 0.4, footSpread: 1.6 });
      // Pick carried on the shoulder, far hand swinging free
      return {
        ...READY,
        root: vec(READY.root.x, g.rootY),
        lean: 0.24,
        footN: vec(g.footN.x - 1.5, g.footN.y),
        footF: vec(g.footF.x - 1.5, g.footF.y),
        handN: vec(CENTER_X + 5, 57 + Math.abs(g.swing) * 0.5),
        wpn: -1.2 - g.swing * 0.05,
        handF: vec(CENTER_X - 4 + g.swing * 3.5, 71),
        swing: -g.swing * 0.35 + 0.1,
      };
    }
    case 'attack': return grip(samplePoseTrack(ATTACK, t));
    case 'hurt': return grip(samplePoseTrack(HURT, t));
    case 'death': {
      const p = samplePoseTrack(DEATH, t);
      return t < 0.4 ? grip(p) : { ...p, handF: vec(p.root.x - 6, p.root.y - 10) };
    }
  }
}

function pickTip(p: MinerPose): { tip: V; base: V } {
  const sk = solveSkeleton(p, SKIN.prop);
  return { tip: along(sk.handN, p.wpn, PICK_LEN + 3), base: along(sk.handN, p.wpn, PICK_LEN - 8) };
}

function drawFx(ctx: CanvasRenderingContext2D, p: MinerPose, act: MonsterAction, t: number): void {
  const sk = solveSkeleton(p, SKIN.prop);
  const L = Math.min(1, p.light);
  if (act === 'attack' && t > 0.9) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const s = pickTip(grip(samplePoseTrack(ATTACK, Math.max(0.67, t - i * 0.055))));
      tips.push(s.tip);
      bases.push(s.base);
    }
    smear(ctx, tips, bases, 0xbfe8ff, 0.4);
    // Spike strikes rock: blue crystal shards + sparks
    const head = along(sk.handN, p.wpn, PICK_LEN);
    const hit = vec(head.x - 3, GROUND_Y - 1);
    glow(ctx, hit, 10, BLUE, 0.5);
    glow(ctx, hit, 4, 0xffffff, 0.6);
    for (const [dx, dy, a] of [[-10, -8, -0.6], [-5, -12, -0.3], [3, -13, 0.2], [9, -9, 0.6], [13, -4, 1]] as const) {
      crystal(ctx, vec(hit.x + dx, hit.y + dy), a, 3.2, 0.9, CRYSTAL);
    }
    ctx.fillStyle = '#ffe0a0';
    for (const [dx, dy] of [[-7, -4], [6, -6], [11, -2], [-12, -2]] as const) ctx.fillRect(hit.x + dx, hit.y + dy, 1, 1);
  }
  if (L > 0.02) {
    // Head-lamp beam + lantern + crystal glow
    const lamp = spun(p, vec(sk.head.x + Math.cos(sk.headAng) * 8.6 - Math.sin(sk.headAng) * -4.7, sk.head.y + Math.sin(sk.headAng) * 8.6 + Math.cos(sk.headAng) * -4.7), sk);
    glow(ctx, lamp, 4.5, LAMP, 0.65 * L);
    const beamDir = sk.headAng + p.spin + 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(lamp.x, lamp.y, lamp.x + Math.cos(beamDir) * 16, lamp.y + Math.sin(beamDir) * 16);
    g.addColorStop(0, `rgba(255,220,140,${0.28 * L})`);
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(lamp.x, lamp.y - 1);
    ctx.lineTo(lamp.x + Math.cos(beamDir - 0.25) * 16, lamp.y + Math.sin(beamDir - 0.25) * 16);
    ctx.lineTo(lamp.x + Math.cos(beamDir + 0.25) * 16, lamp.y + Math.sin(beamDir + 0.25) * 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const eye = spun(p, vec(sk.head.x + Math.cos(sk.headAng) * 4.6, sk.head.y + Math.sin(sk.headAng) * 4.6), sk);
    glow(ctx, eye, 2.6, LAMP, 0.4 * L);
    const a = sk.torsoAng;
    const back = spun(p, vec(sk.neck.x - 9 * Math.cos(a) - 2 * Math.sin(a), sk.neck.y - 9 * Math.sin(a) + 2 * Math.cos(a)), sk);
    glow(ctx, back, 9, BLUE, (0.3 + 0.08 * Math.sin(t * Math.PI * 4)) * L);
  }
  if (act === 'death' && t > 0.6) {
    // Shattered crystal shards around the fallen body
    const k = (t - 0.6) / 0.4;
    for (const [dx, a] of [[-18, -0.8], [-12, 0.4], [14, 0.9], [19, -0.3]] as const) {
      crystal(ctx, vec(p.root.x + dx * (0.6 + k * 0.4), GROUND_Y - 0.5), a + Math.PI, 3, 0.9, CRYSTAL_DEEP);
    }
  }
}

export const SubMineGuardianDrawer = rigMonster<MinerPose>({
  key: 'monster_sub_mine_guardian',
  // Wide for the pickaxe reach; width doesn't move the sprite in-game.
  frameW: 80,
  frameH: 68,
  scale: 1.36,
  pose: minerPose,
  draw: (ctx, p, _act, t) => { drawHumanoid(ctx, p, SKIN, t); },
  shadow: (p) => ({
    x: Math.abs(p.spin) > 1 ? p.root.x + 8 : p.root.x + 1,
    r: Math.abs(p.spin) > 1 ? 20 : 15,
    lift: Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y)),
  }),
  fx: drawFx,
});
