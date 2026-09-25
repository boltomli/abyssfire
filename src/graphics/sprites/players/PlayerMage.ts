// src/graphics/sprites/players/PlayerMage.ts
//
// 渊火术士 — hooded arcanist in an indigo robe with gold trim and a crimson
// sash, glowing eyes under the hood, bell sleeves, and a gnarled staff that
// cradles a floating arcane crystal. Rigged 3/4 view facing right.
import type { EntityDrawer, PlayerAction } from '../types';
import { PLAYER_ACTION_FRAME_COUNTS, PLAYER_TOTAL_FRAMES } from '../types';
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
  inBone,
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
  drawHumanoid,
  solveSkeleton,
  spun,
  gait,
  type HumanPose,
  type HumanSkin,
  type Skeleton,
} from '../rig/Humanoid';
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

function boot(ctx: CanvasRenderingContext2D, ankle: V, sole: V, far: boolean): void {
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 2.4, ankle.y - 1.5), vec(ankle.x + 1.8, ankle.y - 1.8),
    vec(sole.x + 5.2, sole.y - 1.2), vec(sole.x + 5.4, sole.y), vec(sole.x - 2.6, sole.y),
  ]), far ? tone(0x2a1e1a) : BOOT, { band: 0.8 });
}

function legs(ctx: CanvasRenderingContext2D, sk: Skeleton, far: boolean): void {
  // Only the shins show under the robe.
  const knee = far ? sk.kneeF : sk.kneeN;
  const ankle = far ? sk.footF : sk.footN;
  const sole = far ? sk.soleF : sk.soleN;
  limb(ctx, knee, ankle, 2.4, 2, far ? tone(0x241a3c) : tone(0x33264f));
  boot(ctx, ankle, sole, far);
}

/** Robe skirt that drapes from the waist and flares around both feet. */
function robeSkirt(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const waist = along(sk.pelvis, p.lean, 3);
  const ph = t * Math.PI * 2;
  const back = Math.min(sk.footF.x, sk.footN.x, sk.kneeF.x) - 4.8 - p.flow * 4;
  const front = Math.max(sk.footN.x, sk.footF.x, sk.kneeN.x) + 4.6 - p.flow * 1.5;
  const hemY = Math.min(GROUND_Y - 3.4, Math.max(sk.footN.y, sk.footF.y) - 1.2);
  const wave = Math.sin(ph * 2) * 0.7;
  const hemMid = (back + front) / 2;
  const pts = [
    vec(waist.x - 5.6, waist.y),
    vec(waist.x + 5.4, waist.y),
    vec(front + 0.8, hemY - 3),
    vec(front, hemY + wave * 0.4),
    vec(hemMid + 2, hemY + 1.4 - wave),
    vec(hemMid - 3, hemY + 0.6 + wave),
    vec(back, hemY - 0.5 - wave * 0.4),
    vec(back - 0.6 - p.flow * 2, hemY - 4),
  ];
  cel(ctx, () => blobPath(ctx, pts), ROBE, { band: 1.8 });
  // Inner lining peeks out along the front opening.
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, pts);
  ctx.clip();
  cel(ctx, () => polyPath(ctx, [
    vec(waist.x + 3, waist.y + 1), vec(waist.x + 5.4, waist.y),
    vec(front + 1, hemY - 1), vec(front - 3.8, hemY + 1.6),
  ]), LINING, { band: 0.8, stroke: 0.4 });
  ctx.restore();
  // Gold hem trim
  ctx.strokeStyle = TRIM.base;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(back + 0.3, hemY - 0.8 - wave * 0.4);
  ctx.quadraticCurveTo(hemMid, hemY + 1.8, front - 0.3, hemY - 0.4 + wave * 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(waist.x + 3.2, waist.y + 1);
  ctx.lineTo(front - 3.4, hemY + 1.2);
  ctx.stroke();
  // Embroidered runes along the front panel
  ctx.fillStyle = TRIM.light;
  for (let i = 0; i < 3; i++) {
    const r = lerpV(vec(waist.x + 1.4, waist.y + 5), vec(front - 5.6, hemY - 2.6), i / 2);
    ctx.beginPath();
    ctx.moveTo(r.x, r.y - 1.2);
    ctx.lineTo(r.x + 0.8, r.y);
    ctx.lineTo(r.x, r.y + 1.2);
    ctx.lineTo(r.x - 0.8, r.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Spellbook chained to the sash, swinging at the hip. */
function tome(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const hook = along(sk.pelvis, p.lean, 1);
  const swing = Math.sin(t * Math.PI * 2 + 0.4) * 0.12 - p.flow * 0.5;
  ctx.save();
  ctx.translate(hook.x + 5.2, hook.y + 0.6);
  ctx.rotate(swing);
  ctx.strokeStyle = TRIM.shade;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 2.6);
  ctx.stroke();
  cel(ctx, () => polyPath(ctx, [vec(-2.8, 2.4), vec(2.8, 2.4), vec(2.8, 9.4), vec(-2.8, 9.4)]), TOME, { band: 0.7 });
  ctx.fillStyle = '#f0e6c8';
  ctx.fillRect(2.4, 3, 0.6, 5.8);
  ctx.fillStyle = TRIM.base;
  ctx.fillRect(-2.8, 2.4, 1.3, 1.3);
  ctx.fillRect(-2.8, 8.1, 1.3, 1.3);
  ctx.beginPath();
  ctx.arc(0, 5.9, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function sashTails(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const knot = along(sk.pelvis, p.lean, 2.2);
  const chain = clothChain(vec(knot.x - 4.5, knot.y), 13, 4, 0.25 + p.flow, 1.3, t * Math.PI * 2 + 1);
  for (let i = 0; i < 2; i++) {
    const off = i * 1.6;
    const pts: V[] = [];
    const back: V[] = [];
    chain.forEach((pt, j) => {
      const w = 1.2 + j * 0.15;
      pts.push(vec(pt.x - off, pt.y + off * 0.5 - w));
      back.push(vec(pt.x - off, pt.y + off * 0.5 + w));
    });
    cel(ctx, () => polyPath(ctx, [...pts, ...back.reverse()]), i === 0 ? SASH : tone(0x6e1a2a), { band: 0.6 });
  }
}

function robeTorso(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    const body = [vec(-5, 0.5), vec(1, -0.6), vec(6, 1.6), vec(6.8, 7), vec(5.4, len - 1), vec(-5.4, len - 1), vec(-6, 7)];
    cel(ctx, () => blobPath(ctx, body), ROBE, { band: 1.5 });
    // Front trim
    ctx.strokeStyle = TRIM.base;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(3.4, 0.4);
    ctx.quadraticCurveTo(4.4, 7, 3.4, len - 1);
    ctx.stroke();
    // Sash
    cel(ctx, () => polyPath(ctx, [vec(-5.6, len - 4), vec(6.2, len - 4.4), vec(6, len - 1.4), vec(-5.6, len - 1)]), SASH, { band: 0.6 });
    // Mantle over the shoulders
    const mantle = [vec(-6.2, 0), vec(0, -1.8), vec(6.4, 0.8), vec(7, 4.8), vec(2, 6.4), vec(-5.6, 5.2)];
    cel(ctx, () => blobPath(ctx, mantle), ROBE_FAR, { band: 1 });
    ctx.strokeStyle = TRIM.base;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-5.4, 4.8);
    ctx.quadraticCurveTo(1.5, 7, 6.8, 4.4);
    ctx.stroke();
    // Clasp gem
    cel(ctx, () => ellipsePath(ctx, vec(3.2, 2.2), 1.3, 1.3), TRIM, { band: 0.4 });
    ctx.fillStyle = '#b48cff';
    ctx.fillRect(2.7, 1.7, 1, 1);
  });
}

function hood(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const sway = Math.sin(t * Math.PI * 2) * 0.5 + p.flow * 2.5;
  // Hood shell with a long tip trailing behind
  const shell = [
    vec(-6.8, 2), vec(-7.2, -3.5), vec(-3.6, -8), vec(1.8, -8.6), vec(6.4, -5),
    vec(7.4, 1), vec(5.6, 6.6), vec(-2, 7.6), vec(-8 - sway, 5.4), vec(-11 - sway * 1.4, 7.6 + sway * 0.3), vec(-8.6 - sway, 2.4),
  ];
  cel(ctx, () => blobPath(ctx, shell), ROBE, { band: 1.7 });
  // Face opening in shadow
  const opening = [vec(-0.4, -5.6), vec(5.6, -4), vec(7, 1.5), vec(5.4, 5.6), vec(-0.2, 5.4)];
  ctx.fillStyle = '#1a1030';
  ctx.beginPath();
  blobPath(ctx, opening);
  ctx.fill();
  // Face: brow in hood shadow, nose and cheek catch the light
  cel(ctx, () => blobPath(ctx, [vec(1, -2.6), vec(5.4, -2.4), vec(6.2, 0.2), vec(7.9, 1.6), vec(6, 2.8), vec(4.6, 4.6), vec(1.2, 4)]), SKIN, { band: 1, stroke: 0.35 });
  ctx.fillStyle = 'rgba(26,16,48,0.55)';
  ctx.fillRect(1, -2.6, 5, 1.3);
  // Silver beard spilling out of the hood
  const beardSway = Math.sin(t * Math.PI * 2 + 0.8) * 0.4 - p.flow * 1.2;
  cel(ctx, () => blobPath(ctx, [
    vec(1.4, 2.6), vec(6.4, 3), vec(6, 6.8), vec(3.8 + beardSway, 11.5), vec(2.2 + beardSway, 8.4), vec(0.4, 5.2),
  ]), BEARD, { band: 0.8, stroke: 0.4 });
  // Hood rim trim
  ctx.strokeStyle = TRIM.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(1, -5.6);
  ctx.quadraticCurveTo(7, -4.2, 7, 1.4);
  ctx.quadraticCurveTo(6.6, 5.2, 4.6, 6.4);
  ctx.stroke();
  // Glowing eyes
  ctx.fillStyle = '#e8fbff';
  ctx.fillRect(3.9, -1.5, 1.6, 0.9);
  ctx.fillRect(6, -1.4, 0.8, 0.8);
  ctx.restore();
}

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

const MAGE_SKIN: HumanSkin = {
  prop: {
    thigh: 12, shin: 12, upperArm: 9, foreArm: 8.5,
    torso: 16, neck: 7, ankle: 2,
    hipN: vec(1.8, 0), hipF: vec(-2.2, -0.4),
    shN: vec(1, 3.6), shF: vec(-3.8, 3),
  },
  back(ctx, sk, p, t) {
    sashTails(ctx, sk, p, t);
  },
  armFar(ctx, sk) {
    sleeveArm(ctx, sk.shF, sk.elF, sk.handF, true);
    hand(ctx, sk.handF, true);
  },
  legFar(ctx, sk) {
    legs(ctx, sk, true);
  },
  legNear(ctx, sk, p, t) {
    legs(ctx, sk, false);
    robeSkirt(ctx, sk, p, t);
  },
  torso(ctx, sk, p, t) {
    robeTorso(ctx, sk);
    tome(ctx, sk, p, t);
  },
  head(ctx, sk, p, t) {
    hood(ctx, sk, p, t);
  },
  armNear(ctx, sk) {
    sleeveArm(ctx, sk.shN, sk.elN, sk.handN, false);
  },
  weapon(ctx, sk, p, t) {
    staff(ctx, sk.handN, p.wpn, t, p.fx);
    hand(ctx, sk.handN, false);
  },
};

// ── Animation ───────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1.5, 65),
  lean: 0.04,
  head: -0.02,
  footN: vec(CENTER_X + 4, GROUND_Y),
  footF: vec(CENTER_X - 5, GROUND_Y),
  handN: vec(CENTER_X + 7.5, 60),
  handF: vec(CENTER_X + 1, 65.5),
  wpn: 0.14,
  flow: 0.12,
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
    handN: vec(CENTER_X + 8 - g.swing * 2.2, 60 + Math.abs(Math.sin(ph)) * 0.6),
    wpn: 0.16 - g.swing * 0.1,
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

function crystalOf(p: HumanPose, t: number): V {
  const sk = solveSkeleton(p, MAGE_SKIN.prop);
  return spun(p, crystalPoint(sk.handN, p.wpn, t), sk);
}

function drawFx(ctx: CanvasRenderingContext2D, act: PlayerAction, t: number, p: HumanPose): void {
  const sk = solveSkeleton(p, MAGE_SKIN.prop);
  const crystal = crystalOf(p, t);
  const alive = act !== 'death' || t < 0.7;
  // Crystal always hums; brighter when channelling.
  if (alive) {
    const eye = spun(p, along(sk.head, sk.headAng + 1.35, 5), sk);
    glow(ctx, eye, 2.6, ARCANE_HOT, 0.5 + p.fx * 0.3);
    glow(ctx, crystal, 6 + p.fx * 8, ARCANE, 0.35 + p.fx * 0.4);
    glow(ctx, crystal, 2.5 + p.fx * 3, ARCANE_HOT, 0.6 + p.fx * 0.35);
  }
  if (act === 'attack' && p.fx > 0.3) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 6; i >= 0; i--) {
      const sp = samplePoseTrack(ATTACK, Math.max(0, t - i * 0.022));
      const ssk = solveSkeleton(sp, MAGE_SKIN.prop);
      tips.push(spun(sp, crystalPoint(ssk.handN, sp.wpn, t), ssk));
      bases.push(spun(sp, along(ssk.handN, sp.wpn, 10), ssk));
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
    const palm = spun(p, sk.handF, sk);
    glow(ctx, palm, 4 + p.fx * 5, ARCANE, 0.6 * p.fx);
    ctx.save();
    ctx.globalAlpha = 0.75 * p.fx;
    ctx.strokeStyle = '#b89bff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(p.root.x + 1, GROUND_Y, 12 + p.fx * 3, 3.6 + p.fx, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([1.5, 2]);
    ctx.beginPath();
    ctx.ellipse(p.root.x + 1, GROUND_Y, 9, 2.6, 0, t * 6, t * 6 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (act === 'dodge' && p.fx > 0.4) {
    for (let i = 0; i < 4; i++) {
      glow(ctx, vec(p.root.x - 6 - i * 4, p.root.y + 4 + Math.sin(i * 1.7) * 3), 2.4, ARCANE, 0.5 * p.fx * (1 - i / 4));
    }
  }
}

export const PlayerMageDrawer: EntityDrawer = {
  key: 'player_mage',
  // Wide frame leaves room for weapon reach at the contact pose.
  frameW: 96,
  frameH: 96,
  totalFrames: PLAYER_TOTAL_FRAMES,

  drawFrame(ctx, frame, action, w, h) {
    const act = action as PlayerAction;
    const count = PLAYER_ACTION_FRAME_COUNTS[act];
    const loop = act === 'idle' || act === 'walk';
    const t = frameTime(frame % count, count, loop);
    const p = magePose(act, t);
    const palette = getCurrentZonePalette();
    const lift = Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y));
    renderRigFrame(
      ctx, w, h,
      c => { drawHumanoid(c, p, MAGE_SKIN, t); },
      { glowColor: palette.playerOutlineColor, glowBlur: standardOutlineBlur(w, h), scale: MAGE_SCALE },
      c => groundShadow(c, p.root.x + 1, 13, lift),
      c => drawFx(c, act, t, p),
    );
  },
};
