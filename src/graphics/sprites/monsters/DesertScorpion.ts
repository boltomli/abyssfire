// src/graphics/sprites/monsters/DesertScorpion.ts
//
// 沙漠蝎 — sun-bleached amber scorpion with banded armour plates, heavy
// crab-like pincers, eight scuttling legs and a high-arched segmented tail
// ending in a glowing venom barb. Scuttles on an alternating tetrapod gait,
// coils the tail back and stabs it forward over its head to attack, curls
// up and collapses on death.
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
  lerpV,
  limb,
  samplePoseTrack,
  smear,
  solveIK,
  tone,
  vec,
  type Key,
  type Tone,
  type V,
} from '../rig/Rig';
import { rigMonster } from '../rig/MonsterKit';

interface ScorpionPose {
  /** Body centre x and height of the body centre above the ground. */
  x: number;
  h: number;
  /** Body pitch: + noses down, − rears up. */
  tilt: number;
  /** Tail: first-segment angle (dirUp), per-segment extra curl, length scale. */
  tailBase: number;
  tailCurl: number;
  tailLen: number;
  /** Wrist targets relative to each shoulder. */
  clawN: V;
  clawF: V;
  /** Pincer opening 0 (shut) … 1 (gaping). */
  openN: number;
  openF: number;
  /** Gait phase 0..1 and stride length (0 = feet planted). */
  gait: number;
  stride: number;
  /** Death: legs curl in under the body 0..1. */
  fold: number;
  /** Eye glow 0 (dead) … 1. */
  eyes: number;
  /** Strike intensity (smear, venom glow). */
  fx: number;
}

const SHELL = tone(0xd29a4c, { light: 0.4, shadow: 0.4 });
const SHELL_FAR = tone(0x9a6630, { light: 0.2, shadow: 0.45 });
const PLATE = tone(0xe6bf7a, { light: 0.45, shadow: 0.35 });
const HEAD = tone(0xc2843c, { light: 0.4 });
const LEG = tone(0xb97a36, { light: 0.35 });
const LEG_FAR = tone(0x80522a, { light: 0.2 });
const STING = tone(0xc9432a, { light: 0.45 });
const BARB = tone(0x6e2616, { light: 0.55, shadow: 0.5 });
const LEG_TIP = tone(0x8a5426, { light: 0.3 });
const SEAM = 'rgba(92,44,18,0.75)';

const BX = CENTER_X - 2;
const REST: ScorpionPose = {
  x: BX, h: 9, tilt: 0,
  tailBase: -0.6, tailCurl: 0.55, tailLen: 1,
  clawN: vec(10, -3.5), clawF: vec(11, -6.5), openN: 0.25, openF: 0.2,
  gait: 0, stride: 0, fold: 0, eyes: 1, fx: 0,
};
const P = (o: Partial<ScorpionPose>): ScorpionPose => ({ ...REST, ...o });

const ATTACK: Key<ScorpionPose>[] = [
  { at: 0, pose: REST },
  { at: 0.33, ease: 'out', pose: P({ x: BX - 3, h: 10.5, tilt: -0.1, tailBase: -0.95, tailCurl: 0.66, tailLen: 0.94, clawN: vec(9, -7), clawF: vec(10, -9.5), openN: 1, openF: 0.9, fx: 0.2 }) },
  { at: 0.67, ease: 'in', pose: P({ x: BX + 1, h: 9.5, tilt: 0.02, tailBase: -0.15, tailCurl: 0.52, tailLen: 1.08, clawN: vec(11, -5), clawF: vec(12, -8), openN: 0.9, openF: 0.9, fx: 0.7 }) },
  { at: 1, ease: 'linear', pose: P({ x: BX + 2, h: 8, tilt: 0.12, tailBase: 0.5, tailCurl: 0.36, tailLen: 1.24, clawN: vec(8, -2.2), clawF: vec(9, -4.5), openN: 0.75, openF: 0.8, fx: 1 }) },
];

const HURT: Key<ScorpionPose>[] = [
  { at: 0, pose: P({ x: BX - 3.5, h: 10, tilt: -0.16, tailBase: -1.0, tailCurl: 0.5, clawN: vec(7, -2), clawF: vec(8, -5), openN: 0.8, openF: 0.8, eyes: 0.4 }) },
  { at: 1, pose: P({ x: BX - 1.8, h: 9.5, tilt: -0.07, tailBase: -0.8, tailCurl: 0.54, clawN: vec(8.5, -3), clawF: vec(9.5, -5.5), openN: 0.5, openF: 0.4, eyes: 0.7 }) },
];

const DEATH: Key<ScorpionPose>[] = [
  { at: 0, pose: P({ x: BX - 3, h: 10, tilt: -0.14, tailBase: -1.0, tailCurl: 0.5, clawN: vec(7, -2), clawF: vec(8, -5), openN: 0.8, openF: 0.8, eyes: 0.4 }) },
  { at: 0.33, pose: P({ x: BX - 3, h: 12, tilt: -0.26, tailBase: -1.15, tailCurl: 0.72, tailLen: 0.95, clawN: vec(8, -9), clawF: vec(9, -11), openN: 1, openF: 1, fold: 0.2, eyes: 0.2 }) },
  { at: 0.67, ease: 'in', pose: P({ x: BX - 2, h: 6, tilt: 0.08, tailBase: -1.0, tailCurl: 0.62, tailLen: 0.86, clawN: vec(10, -1), clawF: vec(11, -2.5), openN: 0.4, openF: 0.5, fold: 0.6, eyes: 0 }) },
  { at: 1, ease: 'out', pose: P({ x: BX - 2, h: 4.2, tilt: 0.05, tailBase: -1.3, tailCurl: 0.5, tailLen: 0.82, clawN: vec(11, -1.5), clawF: vec(12, -3), openN: 0.15, openF: 0.3, fold: 1, eyes: 0 }) },
];

function scorpionPose(act: MonsterAction, t: number): ScorpionPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle':
      return P({
        h: REST.h + Math.sin(ph) * 0.35,
        tailBase: REST.tailBase + Math.sin(ph) * 0.07,
        tailCurl: REST.tailCurl + Math.sin(ph - 0.9) * 0.04,
        clawN: vec(REST.clawN.x + Math.sin(ph) * 0.6, REST.clawN.y + Math.cos(ph) * 0.8),
        clawF: vec(REST.clawF.x + Math.sin(ph + 1.4) * 0.6, REST.clawF.y + Math.cos(ph + 1.4) * 0.7),
        openN: 0.25 + Math.max(0, Math.sin(ph * 2)) * 0.45,
        openF: 0.2 + Math.max(0, Math.sin(ph * 2 + 2)) * 0.4,
      });
    case 'walk':
      return P({
        h: REST.h + Math.abs(Math.sin(ph * 2)) * 0.6,
        tilt: 0.03 + Math.sin(ph * 2) * 0.015,
        tailBase: REST.tailBase - 0.06 + Math.sin(ph * 2) * 0.05,
        tailCurl: REST.tailCurl + Math.sin(ph * 2 - 1) * 0.03,
        clawN: vec(REST.clawN.x + 1 + Math.sin(ph) * 1.2, REST.clawN.y + 1),
        clawF: vec(REST.clawF.x + 1 - Math.sin(ph) * 1.2, REST.clawF.y + 1),
        gait: t, stride: 4,
      });
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

// ── Body frame ──────────────────────────────────────────────────────────

function bodyY(p: ScorpionPose): number {
  return GROUND_Y - p.h;
}

/** Body-local (x forward, y down) → sprite space. */
function toWorld(p: ScorpionPose, lx: number, ly: number): V {
  const c = Math.cos(p.tilt);
  const s = Math.sin(p.tilt);
  return vec(p.x + lx * c - ly * s, bodyY(p) + lx * s + ly * c);
}

interface TailChain {
  joints: V[];
  radii: number[];
  endAng: number;
  bulb: V;
  tip: V;
}

const SEG_LEN = [6.4, 6.4, 6.4, 6.6, 6.8];
const SEG_R = [3.4, 3.15, 2.95, 2.8, 2.65, 2.5];

function tailChain(p: ScorpionPose): TailChain {
  const joints: V[] = [toWorld(p, -16.5, -3)];
  let a = p.tailBase;
  for (let i = 0; i < SEG_LEN.length; i++) {
    a = p.tailBase + p.tailCurl * i;
    joints.push(along(joints[i], a, SEG_LEN[i] * p.tailLen));
  }
  const endAng = a + p.tailCurl * 0.7;
  const bulb = along(joints[joints.length - 1], endAng, 3);
  const tip = along(bulb, endAng + 0.85, 8.6);
  return { joints, radii: SEG_R, endAng, bulb, tip };
}

// ── Legs ────────────────────────────────────────────────────────────────

interface LegDef { hip: V; foot: number; far: boolean; idx: number }

const NEAR_LEGS = [
  { hip: vec(9, 1.2), foot: 13 },
  { hip: vec(5, 1.8), foot: 5 },
  { hip: vec(0.5, 2), foot: -4 },
  { hip: vec(-4, 2), foot: -13 },
];
const FAR_LEGS = [
  { hip: vec(8, -1), foot: 15 },
  { hip: vec(4, -0.5), foot: 7.5 },
  { hip: vec(-0.5, -0.5), foot: -1.5 },
  { hip: vec(-5, -0.8), foot: -10 },
];

function drawLeg(ctx: CanvasRenderingContext2D, p: ScorpionPose, def: LegDef): void {
  const hip = toWorld(p, def.hip.x, def.hip.y);
  const out = Math.sign(def.foot - def.hip.x) || 1;
  const groundY = def.far ? GROUND_Y - 2.2 : GROUND_Y;
  let fx = p.x + def.foot;
  let fy = groundY;
  if (p.stride > 0) {
    const u = (p.gait + ((def.idx + (def.far ? 1 : 0)) % 2) * 0.5 + def.idx * 0.04) % 1;
    if (u < 0.5) {
      fx += p.stride * (1 - 4 * u);
    } else {
      const v = (u - 0.5) * 2;
      const e = v * v * (3 - 2 * v);
      fx += -p.stride + 2 * p.stride * e;
      fy -= Math.sin(v * Math.PI) * 3.2;
    }
  }
  let foot = vec(fx, fy);
  if (p.fold > 0) {
    foot = lerpV(foot, vec(hip.x + out * 3.5, hip.y + 1.5), p.fold * 0.8);
  }
  const L1 = 8.6;
  const L2 = 9.4;
  const d = Math.hypot(foot.x - hip.x, foot.y - hip.y);
  const mid = lerpV(hip, foot, 0.42);
  const hgt = Math.sqrt(Math.max(0.5, ((L1 + L2) / 2) ** 2 - (d / 2) ** 2)) * 0.9;
  const knee = vec(mid.x + out * hgt * 0.45, mid.y - hgt * 0.9);
  const t: Tone = def.far ? LEG_FAR : LEG;
  limb(ctx, hip, knee, 1.7, 1.35, t);
  limb(ctx, knee, foot, 1.35, 0.55, def.far ? LEG_FAR : LEG_TIP);
  // Knee joint knob and sun-bleached ridge
  ctx.fillStyle = def.far ? 'rgba(40,20,10,0.35)' : 'rgba(255,236,190,0.45)';
  ctx.beginPath();
  ctx.arc(knee.x - 0.3, knee.y - 0.4, 0.7, 0, Math.PI * 2);
  ctx.fill();
}

// ── Pincers ─────────────────────────────────────────────────────────────

function drawClaw(ctx: CanvasRenderingContext2D, p: ScorpionPose, far: boolean): void {
  const sh = far ? toWorld(p, 12, -2) : toWorld(p, 13.5, 1.5);
  const off = far ? p.clawF : p.clawN;
  const open = far ? p.openF : p.openN;
  const wrist = vec(sh.x + off.x, sh.y + off.y);
  const arm = solveIK(sh, wrist, 6.2, 6.4, -1);
  const tArm = far ? SHELL_FAR : SHELL;
  const tHand = far ? SHELL_FAR : HEAD;
  limb(ctx, sh, arm.mid, 2.1, 1.8, tArm);
  limb(ctx, arm.mid, arm.end, 1.9, 2.1, tArm);
  const ang = Math.atan2(arm.end.y - arm.mid.y, arm.end.x - arm.mid.x) * 0.55 - 0.12;
  const s = far ? 0.9 : 1;
  ctx.save();
  ctx.translate(arm.end.x, arm.end.y);
  ctx.rotate(ang);
  ctx.scale(s, s);
  const gape = 0.12 + open * 0.55;
  // Movable (upper) finger
  ctx.save();
  ctx.translate(6.2, -1.2);
  ctx.rotate(-gape);
  cel(ctx, () => {
    ctx.moveTo(-1, -1.6);
    ctx.quadraticCurveTo(4, -3.2, 7.2, 0.6);
    ctx.quadraticCurveTo(3.6, -0.6, -0.6, 1.2);
    ctx.closePath();
  }, far ? SHELL_FAR : SHELL, { band: 0.6 });
  ctx.restore();
  // Fixed (lower) finger
  ctx.save();
  ctx.translate(6.6, 1.4);
  ctx.rotate(gape * 0.35);
  cel(ctx, () => {
    ctx.moveTo(-1.2, -1.6);
    ctx.quadraticCurveTo(4.6, -1.4, 7.6, -1.2);
    ctx.quadraticCurveTo(4, 2.2, -1, 1.8);
    ctx.closePath();
  }, far ? SHELL_FAR : SHELL, { band: 0.6 });
  // Serrated teeth on the inner edge
  if (!far) {
    ctx.fillStyle = PLATE.light;
    for (const x of [1.4, 3.2, 5]) {
      ctx.beginPath();
      ctx.moveTo(x, -1.3);
      ctx.lineTo(x + 0.6, -2.2);
      ctx.lineTo(x + 1.2, -1.2);
      ctx.fill();
    }
  }
  ctx.restore();
  // Bulbous palm
  cel(ctx, () => blobPath(ctx, [vec(-1.5, -2), vec(2, -4.6), vec(6.8, -3.6), vec(8.6, 0.2), vec(6.8, 3.6), vec(2, 4.2), vec(-1.2, 2)]), tHand, { band: 1.2 });
  if (!far) {
    ctx.strokeStyle = SEAM;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(1.2, -3);
    ctx.quadraticCurveTo(0.2, 0, 1.4, 3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.5)';
    ctx.beginPath();
    ctx.ellipse(3.8, -2, 1.9, 0.7, -0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Carapace ────────────────────────────────────────────────────────────

function drawBody(ctx: CanvasRenderingContext2D, p: ScorpionPose): void {
  ctx.save();
  ctx.translate(p.x, bodyY(p));
  ctx.rotate(p.tilt);
  // Abdomen (mesosoma)
  const abd = [vec(-19.5, -1.5), vec(-17.5, -5.8), vec(-10, -7.4), vec(-2, -7.6), vec(5, -6.8), vec(8.5, -3), vec(8.5, 2.6), vec(0, 4.2), vec(-10, 4), vec(-17.5, 2.6)];
  cel(ctx, () => blobPath(ctx, abd), SHELL, { band: 1.8, hi: 0.8 });
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, abd);
  ctx.clip();
  // Overlapping tergite plates, rear → front, each with a bleached rim
  const seams = [-14, -9, -4, 1];
  for (let i = 0; i < seams.length; i++) {
    const sx = seams[i];
    ctx.fillStyle = 'rgba(88,40,16,0.28)';
    ctx.beginPath();
    ctx.moveTo(sx - 0.2, -9);
    ctx.quadraticCurveTo(sx + 1.8, -2, sx + 0.4, 6);
    ctx.lineTo(sx - 1.4, 6);
    ctx.quadraticCurveTo(sx, -2, sx - 1.8, -9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PLATE.light;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(sx + 0.5, -8);
    ctx.quadraticCurveTo(sx + 2.1, -3, sx + 1.4, 0);
    ctx.stroke();
    ctx.strokeStyle = SEAM;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 0.2, -9);
    ctx.quadraticCurveTo(sx + 1.8, -2, sx + 0.4, 6);
    ctx.stroke();
  }
  // Dorsal keel and sheen
  ctx.fillStyle = 'rgba(255,244,210,0.4)';
  ctx.beginPath();
  ctx.ellipse(-5, -5.6, 11, 1.3, -0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,58,22,0.55)';
  for (const kx of [-15.5, -11, -6, -1, 3.5]) {
    ctx.beginPath();
    ctx.arc(kx, -6.3, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pale underside
  ctx.fillStyle = 'rgba(240,214,160,0.45)';
  ctx.beginPath();
  ctx.ellipse(-5, 3.8, 12, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cephalothorax (prosoma) shield
  const head = [vec(3, -7), vec(10, -6.8), vec(15.5, -4.6), vec(18.6, -1.2), vec(18, 2.2), vec(12, 4.2), vec(4, 4.2), vec(1.5, -1.5)];
  cel(ctx, () => blobPath(ctx, head), HEAD, { band: 1.5, hi: 0.8 });
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, head);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,238,196,0.4)';
  ctx.beginPath();
  ctx.ellipse(9, -5.4, 6, 1.4, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SEAM;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(4.5, -6.8);
  ctx.quadraticCurveTo(10, -3, 17.5, -1.5);
  ctx.stroke();
  ctx.restore();

  // Chelicerae (little mouth pincers)
  cel(ctx, () => blobPath(ctx, [vec(17, 0), vec(20.2, 0.2), vec(20.8, 1.8), vec(18.4, 2.8), vec(16.6, 2)]), BARB, { band: 0.4, stroke: 0.35 });

  // Eyes: a glowing median pair on the crest, black lateral clusters
  const ex = 11.5;
  const ey = -6.3;
  if (p.eyes > 0.05) {
    ctx.fillStyle = '#1a0a06';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 2.2, 1.35, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,${150 + 80 * p.eyes},60,${0.5 + 0.5 * p.eyes})`;
    for (const dx of [-0.8, 0.9]) {
      ctx.beginPath();
      ctx.arc(ex + dx, ey + 0.05, 0.62 * (0.5 + 0.5 * p.eyes), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(ex - 1.1, ey - 0.5, 0.45, 0.45);
  } else {
    ctx.strokeStyle = '#2a0e06';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ex - 1.4, ey - 0.8);
    ctx.lineTo(ex + 1.4, ey + 0.8);
    ctx.moveTo(ex + 1.4, ey - 0.8);
    ctx.lineTo(ex - 1.4, ey + 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = '#1a0a06';
  for (const [x, y] of [[16.4, -2.8], [17.2, -1.9], [15.6, -2.1]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTail(ctx: CanvasRenderingContext2D, tail: TailChain): void {
  const j = tail.joints;
  for (let i = 0; i < j.length - 1; i++) {
    const a = j[i];
    const b = j[i + 1];
    cel(ctx, () => capsulePath(ctx, a, b, tail.radii[i], tail.radii[i + 1]), SHELL, { band: 1.1 });
    // Bleached ridge along the outer (top) edge + dark joint ring
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(0.01, Math.hypot(dx, dy));
    const nx = dy / len;
    const ny = -dx / len;
    const side = ny < 0 || (Math.abs(ny) < 0.2 && nx < 0) ? 1 : -1;
    const r = tail.radii[i] * 0.55;
    ctx.strokeStyle = 'rgba(255,238,196,0.55)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * r * side + dx * 0.15, a.y + ny * r * side + dy * 0.15);
    ctx.lineTo(b.x + nx * r * side - dx * 0.2, b.y + ny * r * side - dy * 0.2);
    ctx.stroke();
    ctx.strokeStyle = SEAM;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    const rr = tail.radii[i + 1] * 0.95;
    ctx.moveTo(b.x + nx * rr, b.y + ny * rr);
    ctx.lineTo(b.x - nx * rr, b.y - ny * rr);
    ctx.stroke();
  }
  // Telson: venom bulb + curved barb
  const last = j[j.length - 1];
  const bulbAng = Math.atan2(tail.bulb.y - last.y, tail.bulb.x - last.x);
  const tipDir = Math.atan2(tail.tip.y - tail.bulb.y, tail.tip.x - tail.bulb.x);
  ctx.save();
  ctx.translate(tail.bulb.x, tail.bulb.y);
  ctx.rotate(tipDir);
  const len = Math.hypot(tail.tip.x - tail.bulb.x, tail.tip.y - tail.bulb.y);
  cel(ctx, () => {
    ctx.moveTo(0.5, -2.6);
    ctx.quadraticCurveTo(len * 0.6, -2.2, len, 1.4);
    ctx.quadraticCurveTo(len * 0.5, 0.9, 0.5, 2.4);
    ctx.closePath();
  }, BARB, { band: 0.5 });
  ctx.restore();
  ctx.save();
  ctx.translate(tail.bulb.x, tail.bulb.y);
  ctx.rotate(bulbAng);
  cel(ctx, () => ellipsePath(ctx, vec(0, 0), 3.8, 3.1), STING, { band: 1 });
  ctx.fillStyle = 'rgba(255,220,160,0.6)';
  ctx.beginPath();
  ctx.ellipse(-0.6, -1.4, 2, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScorpion(ctx: CanvasRenderingContext2D, p: ScorpionPose): void {
  for (let i = FAR_LEGS.length - 1; i >= 0; i--) {
    drawLeg(ctx, p, { hip: FAR_LEGS[i].hip, foot: FAR_LEGS[i].foot, far: true, idx: i });
  }
  drawClaw(ctx, p, true);
  drawBody(ctx, p);
  for (let i = NEAR_LEGS.length - 1; i >= 0; i--) {
    drawLeg(ctx, p, { hip: NEAR_LEGS[i].hip, foot: NEAR_LEGS[i].foot, far: false, idx: i });
  }
  drawTail(ctx, tailChain(p));
  drawClaw(ctx, p, false);
}

function scorpionFx(ctx: CanvasRenderingContext2D, p: ScorpionPose, act: MonsterAction, t: number): void {
  const tail = tailChain(p);
  if (act === 'attack' && t > 0.5) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 0; i <= 5; i++) {
      const q = tailChain(samplePoseTrack(ATTACK, t - 0.36 + (i / 5) * 0.36));
      tips.push(q.tip);
      bases.push(q.joints[q.joints.length - 2]);
    }
    smear(ctx, tips, bases, 0xffc070, 0.5 * p.fx);
  }
  if (p.eyes > 0.05) {
    glow(ctx, tail.tip, 2.5 + 3.5 * p.fx, 0xff9a3a, 0.35 + 0.45 * p.fx);
    ctx.fillStyle = `rgba(255,236,150,${0.6 + 0.4 * p.fx})`;
    ctx.beginPath();
    ctx.arc(tail.tip.x, tail.tip.y, 0.6 + 0.4 * p.fx, 0, Math.PI * 2);
    ctx.fill();
    glow(ctx, toWorld(p, 11.5, -6.3), 2.6, 0xffa040, 0.3 * p.eyes);
  }
  // Kicked-up sand at contact / collapse
  const puff = act === 'attack' ? Math.max(0, (t - 0.67) * 3) : act === 'death' ? Math.max(0, (t - 0.5) * 2) : 0;
  if (puff > 0) {
    ctx.fillStyle = `rgba(226,196,140,${0.45 * (1 - puff * 0.4)})`;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      const r = 5 + puff * 5;
      const cx = act === 'attack' ? Math.min(tail.tip.x, p.x + 16) : p.x;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 1.4, GROUND_Y - 1 + Math.sin(a) * r * 0.35, 1.3 + (i % 2) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export const DesertScorpionDrawer = rigMonster<ScorpionPose>({
  key: 'monster_desert_scorpion',
  // Wider than the old sheet so the claws and strike fit; width doesn't move the sprite in-game.
  frameW: 72,
  frameH: 44,
  scale: 1.92,
  pose: scorpionPose,
  draw: (ctx, p) => drawScorpion(ctx, p),
  shadow: (p) => ({ x: p.x - 1, r: 21, lift: Math.max(0, p.h - 9) }),
  fx: scorpionFx,
  rim: 'rgba(255,238,200,0.6)',
  ink: '#1e0e08',
});
