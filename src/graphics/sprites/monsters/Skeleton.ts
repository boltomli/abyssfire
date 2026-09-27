// src/graphics/sprites/monsters/Skeleton.ts
//
// 骷髅战士 — a risen soldier of the Twilight Forest: bleached bones held
// together by teal soul-fire, a cracked skull with glowing eye sockets,
// tatters of a violet burial shroud, a notched rusty sword and a split
// round shield. Chops overhead; on death it buckles and clatters into a
// heap while the skull rolls free.
import type { EntityDrawer, EntityAction, MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  along,
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
import { basePose, solveSkeleton, spun, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster, humanoidTracks, monsterTime, type HumanoidMonsterSpec } from '../rig/MonsterKit';
import { solveViewSkeleton, type HumanView, type ViewSkeleton } from '../rig/HumanView';
import {
  band,
  celPieces,
  clipTo,
  decal,
  loftFill,
  loftPieces,
  poly3,
  profileRings,
  sagittal,
  sp,
  surf,
  surfCurve,
  surfPatch,
  surfVis,
  turnedHead,
  type L3,
} from '../rig/MonsterView';

// ── Palette (cool ivory bone under twilight, violet shroud, teal soul-fire) ──
const BONE = tone(0xddd6c4, { light: 0.4, shadow: 0.34 });
const BONE_FAR = tone(0xa29eab, { light: 0.2 });
const CAVITY = tone(0x2b2238, { light: 0.05, shadow: 0.3 });
const SHROUD = tone(0x5a4680, { light: 0.25 });
const SHROUD_FAR = tone(0x3c2f5a, { light: 0.15 });
const IRON = tone(0x7c808c, { light: 0.4 });
const IRON_DARK = tone(0x4a4d58);
const RUST = tone(0x9a5530, { light: 0.25 });
const WOOD = tone(0x6b5038, { light: 0.25 });
const PAINT = tone(0x3f6b6e, { light: 0.3 });
const LEATHER = tone(0x4a3222);
const SOUL = 0x6ff5e0;

const BLADE_LEN = 17;

/** Current action, so skin hooks can play death-only business (rolling skull). */
const CUR: { act: MonsterAction; t: number } = { act: 'idle', t: 0 };

// ── Bone helpers ────────────────────────────────────────────────────────

function knob(ctx: CanvasRenderingContext2D, c: V, r: number, t: Tone): void {
  cel(ctx, () => ellipsePath(ctx, c, r, r * 0.92), t, { band: r * 0.45, stroke: 0.45 });
}

/** Long bone: slim shaft with knobbly ends. */
function longBone(ctx: CanvasRenderingContext2D, a: V, b: V, r: number, t: Tone): void {
  limb(ctx, lerpV(a, b, 0.08), lerpV(a, b, 0.92), r, r * 0.82, t);
  knob(ctx, lerpV(a, b, 0.06), r * 1.35, t);
  knob(ctx, lerpV(a, b, 0.94), r * 1.25, t);
}

/** Paired forearm / shin bones. */
function pairBone(ctx: CanvasRenderingContext2D, a: V, b: V, r: number, t: Tone): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const n = vec((-dy / l) * r * 0.9, (dx / l) * r * 0.9);
  limb(ctx, vec(a.x - n.x, a.y - n.y), vec(b.x - n.x * 0.6, b.y - n.y * 0.6), r * 0.62, r * 0.55, t);
  limb(ctx, vec(a.x + n.x * 0.5, a.y + n.y * 0.5), vec(b.x + n.x * 0.4, b.y + n.y * 0.4), r * 0.85, r * 0.7, t);
}

function boneFoot(ctx: CanvasRenderingContext2D, ankle: V, sole: V, t: Tone): void {
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 1.8, ankle.y - 0.6), vec(ankle.x + 1.2, ankle.y - 1),
    vec(sole.x + 4.6, sole.y - 1.3), vec(sole.x + 5.4, sole.y), vec(sole.x - 2, sole.y),
  ]), t, { band: 0.6 });
  // Toe joints
  ctx.fillStyle = t.shade;
  ctx.fillRect(sole.x + 2.2, sole.y - 1.2, 0.5, 1.1);
  ctx.fillRect(sole.x + 3.7, sole.y - 1.1, 0.5, 1);
}

function boneHand(ctx: CanvasRenderingContext2D, at: V, t: Tone): void {
  cel(ctx, () => ellipsePath(ctx, at, 1.7, 1.5), t, { band: 0.5, stroke: 0.4 });
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(at.x - 0.6, at.y + 0.9);
  ctx.lineTo(at.x - 0.2, at.y - 0.9);
  ctx.moveTo(at.x + 0.6, at.y + 0.9);
  ctx.lineTo(at.x + 0.9, at.y - 0.8);
  ctx.stroke();
}

function leg(ctx: CanvasRenderingContext2D, sk: Skeleton, near: boolean): void {
  const t = near ? BONE : BONE_FAR;
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  const sole = near ? sk.soleN : sk.soleF;
  longBone(ctx, hip, knee, 1.25, t);
  pairBone(ctx, knee, ankle, 1.35, t);
  knob(ctx, knee, 1.75, t);
  boneFoot(ctx, ankle, sole, t);
  if (near) {
    // Rusted greave strap still clinging to the shin
    const a = lerpV(knee, ankle, 0.45);
    const b = lerpV(knee, ankle, 0.7);
    limb(ctx, a, b, 1.9, 1.7, LEATHER);
    ctx.fillStyle = RUST.light;
    ctx.fillRect(lerpV(a, b, 0.5).x + 0.4, lerpV(a, b, 0.5).y - 0.4, 0.8, 0.8);
  }
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, t: Tone): void {
  longBone(ctx, sh, el, 1.15, t);
  pairBone(ctx, el, hand, 1.2, t);
  knob(ctx, el, 1.45, t);
}

// ── Body ────────────────────────────────────────────────────────────────

function torso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Shroud scraps hanging behind the pelvis (far side)
    const ph = t * Math.PI * 2;
    const back = clothChain(vec(-3.4, len - 1), 11, 4, p.flow + 0.1, 1, ph);
    cel(ctx, () => {
      ctx.moveTo(-4.6, len - 1.5);
      for (const q of back) ctx.lineTo(q.x - 1.2, q.y);
      ctx.lineTo(back[4].x + 0.4, back[4].y - 2.2);
      ctx.lineTo(back[4].x + 1.8, back[4].y + 0.4);
      for (let i = back.length - 1; i >= 0; i--) ctx.lineTo(back[i].x + 2.2, back[i].y);
      ctx.closePath();
    }, SHROUD_FAR, { band: 0.6 });

    // Lumbar spine
    for (let i = 0; i < 4; i++) {
      const y = len * 0.6 + i * (len * 0.4 - 1) / 4;
      cel(ctx, () => ellipsePath(ctx, vec(-2.4 + i * 0.15, y), 1.4, 1.05), BONE, { band: 0.5, stroke: 0.4 });
    }
    // Pelvis (iliac wing)
    const pel = [vec(-4.4, len - 2.4), vec(-1, len - 3.6), vec(3.4, len - 2.2), vec(4.2, len + 0.6), vec(1.2, len + 2.2), vec(-3.4, len + 1.6)];
    cel(ctx, () => blobPath(ctx, pel), BONE, { band: 0.9 });
    ctx.fillStyle = CAVITY.base;
    ctx.beginPath();
    ctx.ellipse(0.4, len - 0.3, 1.3, 0.9, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Rib cavity (dark), then ribs over it
    const cage = [vec(-4, 1.2), vec(0.8, 0.2), vec(4.6, 2), vec(5.4, len * 0.34), vec(3.4, len * 0.6), vec(-1.6, len * 0.64), vec(-4.2, len * 0.42)];
    cel(ctx, () => blobPath(ctx, cage), CAVITY, { band: 0.8, stroke: 0.4 });
    // Thoracic spine seen through the ribs
    for (let i = 0; i < 4; i++) {
      cel(ctx, () => ellipsePath(ctx, vec(-3, 1.8 + i * len * 0.13), 1.1, 0.9), BONE_FAR, { band: 0.3, stroke: 0.3 });
    }
    const ribs = 4;
    for (let i = 0; i < ribs; i++) {
      const y0 = 1.8 + i * len * 0.12;
      const drop = 1.6 + i * 0.35;
      const reach = 5.2 - Math.abs(i - 1.2) * 0.5;
      const path = (): void => {
        ctx.moveTo(-3.4, y0);
        ctx.quadraticCurveTo(reach + 1.6, y0 - 1.4, reach - 0.4, y0 + drop);
      };
      ctx.lineCap = 'round';
      ctx.beginPath(); path();
      ctx.strokeStyle = BONE.line; ctx.lineWidth = 1.9; ctx.stroke();
      ctx.beginPath(); path();
      ctx.strokeStyle = BONE.base; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.save();
      ctx.translate(-0.2, -0.35);
      ctx.beginPath(); path();
      ctx.strokeStyle = BONE.light; ctx.lineWidth = 0.4; ctx.stroke();
      ctx.restore();
    }
    // Sternum
    cel(ctx, () => capsule(ctx, vec(4.2, 2.2), vec(3.8, len * 0.46), 1, 0.8), BONE, { band: 0.4, stroke: 0.4 });

    // Front loincloth: two ragged strips of violet shroud on a rope belt
    const fr = clothChain(vec(1.6, len - 0.6), 10, 4, p.flow, 1, ph + 0.8);
    cel(ctx, () => {
      ctx.moveTo(-0.6, len - 1.2);
      for (const q of fr) ctx.lineTo(q.x - 1.8, q.y);
      ctx.lineTo(fr[4].x - 0.8, fr[4].y - 1.6);
      ctx.lineTo(fr[4].x + 0.3, fr[4].y + 0.8);
      ctx.lineTo(fr[4].x + 1.4, fr[4].y - 1.2);
      for (let i = fr.length - 1; i >= 0; i--) ctx.lineTo(fr[i].x + 2.2 - i * 0.15, fr[i].y);
      ctx.closePath();
    }, SHROUD, { band: 0.8 });
    ctx.strokeStyle = SHROUD.shade;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(fr[1].x, fr[1].y);
    ctx.lineTo(fr[3].x + 0.4, fr[3].y);
    ctx.stroke();
    cel(ctx, () => polyPath(ctx, [vec(-4.4, len - 2.2), vec(4.8, len - 2.8), vec(5, len - 1.4), vec(-4.4, len - 0.8)]), LEATHER, { band: 0.35, stroke: 0.4 });

    // Tattered shroud mantle over the shoulders
    const mantle = [vec(-5.4, 0.2), vec(-2.6, -2), vec(1.6, -2), vec(3.2, -0.4), vec(1.6, 1.4), vec(0.2, 0.8), vec(-1.2, 2.6), vec(-3, 1.6), vec(-4.4, 3.4), vec(-5.6, 1.8)];
    cel(ctx, () => polyPath(ctx, mantle), SHROUD, { band: 0.9 });
  });
}

function capsule(ctx: CanvasRenderingContext2D, a: V, b: V, ra: number, rb: number): void {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.arc(a.x, a.y, ra, ang + Math.PI / 2, ang - Math.PI / 2, false);
  ctx.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2, false);
  ctx.closePath();
}

/** Skull drawn at the origin facing +x. `jaw` 0 shut … 1 gaping. */
function skull(ctx: CanvasRenderingContext2D, jaw: number, fire: number): void {
  // Jaw (hinged under the ear, behind the cranium)
  ctx.save();
  ctx.translate(0.6, 2.4);
  ctx.rotate(jaw * 0.45);
  cel(ctx, () => polyPath(ctx, [vec(-1.2, -0.6), vec(5.4, 0.2), vec(6.2, 1.6), vec(5, 3), vec(0.8, 3), vec(-1.4, 1.4)]), BONE, { band: 0.6 });
  ctx.fillStyle = BONE.light;
  for (const x of [2.6, 3.8, 5]) ctx.fillRect(x, -0.1, 0.8, 0.9);
  ctx.restore();
  // Cranium + face
  const head = [vec(-5.2, -0.4), vec(-4.2, -5), vec(0.4, -6.8), vec(5, -5.2), vec(7, -1.4), vec(6.6, 2.6), vec(3.2, 3.4), vec(-0.2, 3), vec(-3.6, 2.4)];
  cel(ctx, () => blobPath(ctx, head), BONE, { band: 1.3 });
  // Cheekbone ridge
  cel(ctx, () => polyPath(ctx, [vec(1.2, 1.6), vec(5.4, 1.2), vec(5.8, 2.4), vec(1.6, 2.8)]), BONE_FAR, { band: 0.3, stroke: 0.3 });
  // Upper teeth
  ctx.fillStyle = BONE.light;
  for (const x of [3, 4.2, 5.4]) ctx.fillRect(x, 2.9, 0.8, 1);
  ctx.strokeStyle = BONE.line;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  for (const x of [3, 4.2, 5.4, 6.2]) { ctx.moveTo(x, 2.9); ctx.lineTo(x, 3.9); }
  ctx.stroke();
  // Eye sockets (near large, far foreshortened) and nasal cavity
  ctx.fillStyle = '#140f1e';
  ctx.beginPath();
  ctx.ellipse(3, -1.2, 1.9, 2.1, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6.4, -1, 0.8, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5.6, 0.6);
  ctx.lineTo(6.6, 2.2);
  ctx.lineTo(5.2, 2.2);
  ctx.closePath();
  ctx.fill();
  // Soul-fire pupils
  if (fire > 0.02) {
    ctx.fillStyle = `rgba(160,255,240,${fire})`;
    ctx.beginPath();
    ctx.arc(3.4, -1, 0.95, 0, Math.PI * 2);
    ctx.arc(6.5, -0.9, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${fire})`;
    ctx.fillRect(3.3, -1.4, 0.5, 0.5);
  }
  // Crack across the dome
  ctx.strokeStyle = BONE.line;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-1.6, -6.2);
  ctx.lineTo(-0.6, -4.2);
  ctx.lineTo(-1.8, -2.8);
  ctx.lineTo(-0.8, -1.4);
  ctx.stroke();
  // Brow shadow
  ctx.fillStyle = 'rgba(40,30,60,0.35)';
  ctx.beginPath();
  ctx.ellipse(4.4, -3.4, 3, 0.8, 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function deathT(): number {
  return CUR.act === 'death' ? CUR.t : 0;
}

/** Where the loose skull comes to rest (unspun, unit space). */
function restingSkull(p: HumanPose): V {
  return vec(p.root.x + 27, GROUND_Y - 4.4);
}

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const dt = deathT();
  const idleChatter = Math.max(0, Math.sin(t * Math.PI * 8)) * 0.25;
  const jaw = CUR.act === 'death' ? 0.6 : Math.min(1, p.fx * 0.9 + idleChatter);
  if (dt > 0.5) {
    // The skull pops off and rolls away as the body collapses: undo the
    // body spin so it lands on the real ground.
    const k = Math.min(1, (dt - 0.5) / 0.5);
    const pivot = lerpV(sk.pelvis, sk.neck, p.pivot);
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(-p.spin);
    ctx.translate(-pivot.x, -pivot.y);
    const from = spun(p, sk.head, sk);
    const to = restingSkull(p);
    const pos = lerpV(from, to, k);
    pos.y -= Math.sin(k * Math.PI) * 5;
    ctx.translate(pos.x, pos.y);
    ctx.rotate(sk.headAng + p.spin + k * 2.6);
    skull(ctx, 0.5, Math.max(0, 1 - k * 1.4));
    ctx.restore();
    return;
  }
  // Neck vertebrae
  for (let i = 0; i < 2; i++) {
    const c = lerpV(sk.neck, sk.head, 0.2 + i * 0.3);
    cel(ctx, () => ellipsePath(ctx, vec(c.x - 1.2, c.y), 1.2, 1), BONE, { band: 0.4, stroke: 0.4 });
  }
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  skull(ctx, jaw, CUR.act === 'death' ? Math.max(0, 1 - dt * 1.6) : 1);
  ctx.restore();
}

// ── Gear ────────────────────────────────────────────────────────────────

function sword(ctx: CanvasRenderingContext2D, at: V, angle: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  // Grip + pommel
  cel(ctx, () => polyPath(ctx, [vec(-0.75, 3.4), vec(0.75, 3.4), vec(0.75, -2.2), vec(-0.75, -2.2)]), LEATHER, { band: 0.3 });
  cel(ctx, () => ellipsePath(ctx, vec(0, 4), 1.2, 1.1), IRON_DARK, { band: 0.3 });
  // Notched, rust-eaten blade
  const L = BLADE_LEN;
  const blade = [
    vec(-1.35, -2.4), vec(1.35, -2.4), vec(1.25, -L * 0.42), vec(0.5, -L * 0.47), vec(1.15, -L * 0.53),
    vec(1, -L * 0.86), vec(0, -L), vec(-1.1, -L * 0.82), vec(-1.2, -L * 0.62), vec(-0.5, -L * 0.58), vec(-1.25, -L * 0.52),
  ];
  cel(ctx, () => polyPath(ctx, blade), IRON, { band: 0.8, hi: 0.4 });
  // Fuller + rust blotches
  ctx.strokeStyle = IRON_DARK.base;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(0, -3.4);
  ctx.lineTo(0, -L * 0.72);
  ctx.stroke();
  ctx.fillStyle = RUST.base;
  ctx.beginPath();
  ctx.ellipse(-0.4, -L * 0.3, 0.9, 1.6, 0.2, 0, Math.PI * 2);
  ctx.ellipse(0.5, -L * 0.7, 0.7, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = RUST.light;
  ctx.fillRect(-0.9, -L * 0.33, 0.6, 0.6);
  // Crossguard
  cel(ctx, () => polyPath(ctx, [vec(-3.4, -2.8), vec(3.4, -2.2), vec(3.2, -1.2), vec(-3.4, -1.6)]), IRON_DARK, { band: 0.35 });
  ctx.restore();
}

function shield(ctx: CanvasRenderingContext2D, at: V, angle: number): void {
  ctx.save();
  ctx.translate(at.x + 0.6, at.y);
  ctx.rotate(angle);
  const rx = 4.4;
  const ry = 6.6;
  // Rim with a chunk broken out of the upper-front edge
  const rim = (): void => {
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      let r = 1;
      if (i === 2) r = 0.62;
      if (i === 3) r = 0.78;
      const x = Math.cos(a) * rx * r;
      const y = Math.sin(a) * ry * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  cel(ctx, rim, IRON_DARK, { band: 1 });
  ctx.save();
  ctx.scale(0.84, 0.86);
  cel(ctx, rim, WOOD, { band: 1.2 });
  ctx.restore();
  // Faded painted band, clipped to the wooden face
  ctx.save();
  ctx.beginPath();
  ctx.save();
  ctx.scale(0.84, 0.86);
  rim();
  ctx.restore();
  ctx.clip();
  cel(ctx, () => polyPath(ctx, [vec(-6, -2.2), vec(6, -3.8), vec(6, 0.6), vec(-6, 2.2)]), PAINT, { band: 0.6, stroke: 0 });
  // Planks
  ctx.strokeStyle = WOOD.shade;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (const x of [-2.2, 0.8, 3.4]) { ctx.moveTo(x, -ry); ctx.lineTo(x - 0.3, ry); }
  ctx.stroke();
  ctx.restore();
  // Split running down from the broken edge
  ctx.strokeStyle = '#1a1220';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(2.2, -5.2);
  ctx.lineTo(1.2, -2.6);
  ctx.lineTo(2, -0.8);
  ctx.lineTo(0.6, 2.4);
  ctx.stroke();
  // Iron boss with rivets
  cel(ctx, () => ellipsePath(ctx, vec(0.3, 0.4), 1.9, 2.2), IRON, { band: 0.6 });
  ctx.fillStyle = RUST.base;
  ctx.fillRect(-0.2, 1, 1, 0.8);
  ctx.fillStyle = IRON.light;
  for (const [x, y] of [[-3, -4.8], [3.4, 4.2], [-3.6, 3.6]]) ctx.fillRect(x, y, 0.7, 0.7);
  ctx.restore();
}

// ── Isometric 3/4 views ─────────────────────────────────────────────────

const CAGE = (len: number): V[] => [vec(-4, 1.2), vec(0.8, 0.2), vec(4.6, 2), vec(5.4, len * 0.34), vec(3.4, len * 0.6), vec(-1.6, len * 0.64), vec(-4.2, len * 0.42)];
const PELVIS = (len: number): V[] => [vec(-4.4, len - 2.4), vec(-1, len - 3.6), vec(3.4, len - 2.2), vec(4.2, len + 0.6), vec(1.2, len + 2.2), vec(-3.4, len + 1.6)];

function ribStroke(ctx: CanvasRenderingContext2D, run: V[]): void {
  const path = (dx = 0, dy = 0): void => {
    ctx.beginPath();
    ctx.moveTo(run[0].x + dx, run[0].y + dy);
    for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x + dx, run[i].y + dy);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = BONE.line; ctx.lineWidth = 1.9; ctx.stroke();
  path(); ctx.strokeStyle = BONE.base; ctx.lineWidth = 1.1; ctx.stroke();
  path(-0.2, -0.35); ctx.strokeStyle = BONE.light; ctx.lineWidth = 0.4; ctx.stroke();
}

function shroudFlap(_len: number, fr: number, s: 1 | -1, p: HumanPose, t: number): L3[] {
  const sway = Math.sin(t * Math.PI * 2 + (s > 0 ? 0.8 : 2)) * 0.6 - p.flow * 2 * s;
  return [
    [1.8, fr, -2.4], [1.8, fr, 2.2], [-6.5, fr + sway + 0.4 * s, 2], [-4.4, fr + sway * 0.6, 0.8],
    [-7.6, fr + sway + 0.6 * s, -0.4], [-5, fr + sway * 0.6, -1.4], [-6.4, fr + sway + 0.4 * s, -2.4],
  ];
}

function skeletonTorsoView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const T = sk.torso;
  const len = sk.torsoLen;
  const hOf = (y: number): number => len - y;
  const cage = profileRings(CAGE(len), hOf, a => a * 1.18, 7);
  const pelvis = profileRings(PELVIS(len), hOf, a => a * 1.35, 5);
  const front = T.vis(0) > T.vis(Math.PI);
  // Shroud strip hanging on the far side of the body.
  poly3(ctx, T, shroudFlap(len, front ? -3.6 : 4.2, front ? -1 : 1, p, t), SHROUD_FAR, { band: 0.6 });
  // Lumbar spine between pelvis and cage
  for (let i = 0; i < 4; i++) {
    const h = len * 0.36 - i * (len * 0.4 - 1) / 4;
    const c = sp(T, h, -2.4 + i * 0.15, 0);
    cel(ctx, () => ellipsePath(ctx, c, 1.5, 1.1), BONE, { band: 0.5, stroke: 0.4 });
  }
  // Pelvis bowl
  const pel = loftFill(ctx, T, pelvis, BONE, { band: 0.9 });
  clipTo(ctx, pel, () => {
    for (const phi of [-0.5, 0.5]) {
      decal(ctx, T, pelvis, 0.2, phi, () => {
        ctx.fillStyle = CAVITY.base;
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.2, 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
      }, { minVis: 0.05 });
    }
  });
  band(ctx, T, pelvis, 1.6, LEATHER, 1.2, 0.2);
  // Rib cavity with the thoracic spine inside, ribs wrapped round it.
  const cav = loftPieces(T, cage);
  celPieces(ctx, cav, CAVITY, { band: 0.8, stroke: 0.4 });
  clipTo(ctx, cav, () => {
    for (let i = 0; i < 4; i++) {
      const c = sp(T, len - 1.8 - i * len * 0.13, -3, 0);
      cel(ctx, () => ellipsePath(ctx, c, 1.1, 0.9), BONE_FAR, { band: 0.3, stroke: 0.3 });
    }
  });
  for (let i = 0; i < 4; i++) {
    const h0 = len - 2 - i * len * 0.12;
    const drop = 1.6 + i * 0.35;
    for (const s of [1, -1]) {
      for (const run of surfCurve(T, cage, [[h0, Math.PI], [h0 - drop * 0.3, s * 1.6], [h0 - drop, s * 0.28]], 0.35, 8, -0.05)) ribStroke(ctx, run);
    }
  }
  if (front) {
    // Sternum
    const a = surf(T, cage, len - 2.2, 0, 0.5);
    const b = surf(T, cage, len * 0.54, 0, 0.5);
    cel(ctx, () => capsule(ctx, a, b, 1, 0.8), BONE, { band: 0.4, stroke: 0.4 });
  } else {
    for (let i = 0; i < 5; i++) {
      const c = surf(T, cage, len - 1.6 - i * len * 0.12, Math.PI, 0.4);
      cel(ctx, () => ellipsePath(ctx, c, 1.2, 1), BONE, { band: 0.4, stroke: 0.4 });
    }
  }
  // Front scrap of shroud on the rope belt
  poly3(ctx, T, shroudFlap(len, front ? 4.4 : -3.8, front ? 1 : -1, p, t), SHROUD, { band: 0.8 });
  // Tattered mantle over the shoulders
  const ph = t * Math.PI * 2;
  const mantle = [
    { h: len + 2, a: 2.6, b: 3.4, f: -0.6 },
    { h: len + 0.2, a: 4.8, b: 6.4, f: -1 },
    { h: len - 2.4, a: 5.2, b: 6.8, f: -1.2 },
  ];
  loftFill(ctx, T, mantle, SHROUD, { band: 0.9 });
  for (let k = 0; k < 10; k++) {
    const phi = (k / 10) * Math.PI * 2 + 0.2;
    if (T.vis(phi) < 0.02) continue;
    const l = 1.6 + ((k * 7) % 3) * 0.9 + Math.sin(ph + k) * 0.3;
    const a = T.at(len - 2.2, phi - 0.18, 5.2, 6.8, -1.2);
    const b = T.at(len - 2.2, phi + 0.18, 5.2, 6.8, -1.2);
    const c = T.at(len - 2.2 - l, phi, 5.3, 6.9, -1.3);
    cel(ctx, () => polyPath(ctx, [a, b, c]), SHROUD, { band: 0.4, stroke: 0.4 });
  }
}

const SKULL_PROFILE: V[] = [vec(-5.2, -0.4), vec(-4.2, -5), vec(0.4, -6.8), vec(5, -5.2), vec(7, -1.4), vec(6.6, 2.6), vec(3.2, 3.4), vec(-0.2, 3), vec(-3.6, 2.4)];
const SKULL_RINGS = profileRings(SKULL_PROFILE, y => -y, a => a * 0.86, 8);

function skullView(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): void {
  const dt = deathT();
  if (dt > 0.5) {
    // The loose skull rolls along the ground: reuse the side art.
    sagittal(ctx, sk.rig, 0, () => head(ctx, solveSkeleton(p, SKIN.prop), p, t));
    return;
  }
  const idleChatter = Math.max(0, Math.sin(t * Math.PI * 8)) * 0.25;
  const jaw = CUR.act === 'death' ? 0.6 : Math.min(1, p.fx * 0.9 + idleChatter);
  const fire = CUR.act === 'death' ? Math.max(0, 1 - dt * 1.6) : 1;
  // Neck vertebrae
  for (let i = 0; i < 2; i++) {
    const c = lerpV(sk.neck, sk.head, 0.2 + i * 0.3);
    cel(ctx, () => ellipsePath(ctx, c, 1.3, 1.1), BONE, { band: 0.4, stroke: 0.4 });
  }
  const H = turnedHead(sk, 0.4);
  const R = SKULL_RINGS;
  // Jaw hangs under the cranium
  const drop = jaw * 1.6;
  const jawRings = [
    { h: -1.6, a: 4, b: 3.6, f: 2.6 },
    { h: -3.6 - drop * 0.6, a: 3.6, b: 3.4, f: 2.8 + drop * 0.2 },
    { h: -5.2 - drop, a: 2.4, b: 2.4, f: 3.2 + drop * 0.3 },
  ];
  const jawP = loftFill(ctx, H, jawRings, BONE, { band: 0.6 });
  if (H.vis(0) > -0.2) {
    clipTo(ctx, jawP, () => {
      ctx.fillStyle = BONE.light;
      for (const phi of [-0.5, -0.17, 0.17, 0.5]) {
        if (surfVis(H, jawRings, -3.2, phi) < 0.05) continue;
        const q = surf(H, jawRings, -2.2 - drop * 0.3, phi, 0.1);
        ctx.fillRect(q.x - 0.4, q.y - 0.4, 0.8, 0.9);
      }
    });
  }
  const shell = loftFill(ctx, H, R, BONE, { band: 1.3 });
  clipTo(ctx, shell, () => {
    // Crack across the dome
    for (const run of surfCurve(H, R, [[6.4, -2.6], [4.6, -2.2], [3.4, -2.8], [2, -2.4]], 0.05, 4)) {
      ctx.strokeStyle = BONE.line;
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      run.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
    }
    if (H.vis(0) < -0.3) return;
    // Brow shadow
    ctx.fillStyle = 'rgba(40,30,60,0.35)';
    ctx.beginPath();
    polyPath(ctx, surfPatch(H, R, 4.4, 3.2, -0.9, 0.9, 0.05));
    ctx.fill();
    // Eye sockets with soul-fire pupils
    for (const phi of [-0.42, 0.42]) {
      decal(ctx, H, R, 1.6, phi, () => {
        ctx.fillStyle = '#140f1e';
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.8, 2.1, 0, 0, Math.PI * 2);
        ctx.fill();
        if (fire > 0.02) {
          ctx.fillStyle = `rgba(160,255,240,${fire})`;
          ctx.beginPath();
          ctx.arc(0, 0.2, 0.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${fire})`;
          ctx.fillRect(-0.2, -0.3, 0.5, 0.5);
        }
      }, { minVis: 0.02 });
    }
    // Nasal cavity
    decal(ctx, H, R, -1, 0, () => {
      ctx.fillStyle = '#140f1e';
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(0.9, 0.9);
      ctx.lineTo(-0.9, 0.9);
      ctx.closePath();
      ctx.fill();
    }, { minVis: 0.02 });
    // Cheekbones + upper teeth
    cel(ctx, () => polyPath(ctx, surfPatch(H, R, -1.6, -2.4, -0.9, -0.35, 0.1, 4)), BONE_FAR, { band: 0.3, stroke: 0.3 });
    cel(ctx, () => polyPath(ctx, surfPatch(H, R, -1.6, -2.4, 0.35, 0.9, 0.1, 4)), BONE_FAR, { band: 0.3, stroke: 0.3 });
    for (const phi of [-0.45, -0.15, 0.15, 0.45]) {
      decal(ctx, H, R, -2.8, phi, () => {
        ctx.fillStyle = BONE.light;
        ctx.fillRect(-0.45, -0.5, 0.9, 1.1);
        ctx.strokeStyle = BONE.line;
        ctx.lineWidth = 0.3;
        ctx.strokeRect(-0.45, -0.5, 0.9, 1.1);
      }, { minVis: 0.05, lift: 0.1 });
    }
  });
}

/** Soul-fire eye glow positions in a view (visible sockets only). */
function viewEyes(sk: ViewSkeleton): V[] {
  const H = turnedHead(sk, 0.4);
  return [-0.42, 0.42].filter(phi => surfVis(H, SKULL_RINGS, 1.6, phi) > 0.18).map(phi => surf(H, SKULL_RINGS, 1.6, phi, 0.2));
}

// ── Skin & poses ────────────────────────────────────────────────────────

const SKIN: HumanSkin = {
  prop: {
    thigh: 10.5, shin: 10.5, upperArm: 9, foreArm: 8.4,
    torso: 15, neck: 6.6, ankle: 1.6,
    hipN: vec(1.4, 0), hipF: vec(-2, -0.4),
    shN: vec(1.2, 2.8), shF: vec(-3.4, 2.4),
  },
  back(ctx, sk, p, t) {
    // Trailing scrap of shroud from the far shoulder
    const ph = t * Math.PI * 2;
    const tail = clothChain(sk.shF, 13, 4, p.flow + 0.35, 1.2, ph + 1.4);
    cel(ctx, () => {
      ctx.moveTo(tail[0].x + 1.4, tail[0].y - 1);
      for (const q of tail) ctx.lineTo(q.x + 1, q.y);
      ctx.lineTo(tail[4].x - 0.2, tail[4].y + 1.6);
      ctx.lineTo(tail[4].x - 1.2, tail[4].y - 0.4);
      ctx.lineTo(tail[4].x - 2.6, tail[4].y + 0.6);
      for (let i = tail.length - 1; i >= 0; i--) ctx.lineTo(tail[i].x - 2 + i * 0.1, tail[i].y);
      ctx.closePath();
    }, SHROUD_FAR, { band: 0.7 });
  },
  armFar(ctx, sk) {
    arm(ctx, sk.shF, sk.elF, sk.handF, BONE_FAR);
    boneHand(ctx, sk.handF, BONE_FAR);
  },
  legFar(ctx, sk) {
    leg(ctx, sk, false);
  },
  legNear(ctx, sk) {
    leg(ctx, sk, true);
  },
  torso(ctx, sk, p, t) {
    torso(ctx, sk, p, t);
  },
  head(ctx, sk, p, t) {
    head(ctx, sk, p, t);
  },
  offFront(ctx, sk, p) {
    shield(ctx, sk.handF, p.off);
  },
  armNear(ctx, sk) {
    arm(ctx, sk.shN, sk.elN, sk.handN, BONE);
    // Shoulder knob + a scrap of rusted pauldron
    knob(ctx, sk.shN, 1.9, BONE);
    cel(ctx, () => polyPath(ctx, [
      vec(sk.shN.x - 2.8, sk.shN.y - 0.6), vec(sk.shN.x - 0.4, sk.shN.y - 2.8), vec(sk.shN.x + 2.6, sk.shN.y - 1.4),
      vec(sk.shN.x + 2.4, sk.shN.y + 1), vec(sk.shN.x - 0.2, sk.shN.y + 0.2), vec(sk.shN.x - 2.4, sk.shN.y + 1.6),
    ]), RUST, { band: 0.6 });
  },
  weapon(ctx, sk, p) {
    sword(ctx, sk.handN, p.wpn);
    boneHand(ctx, sk.handN, BONE);
  },
};

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1.5, 70.5),
  lean: 0.12,
  head: -0.04,
  footN: vec(CENTER_X + 6, GROUND_Y),
  footF: vec(CENTER_X - 6.5, GROUND_Y),
  handN: vec(CENTER_X + 8, 68),
  handF: vec(CENTER_X + 6.5, 68.5),
  wpn: 1.05,
  off: 0.1,
  flow: 0.12,
});

const SPEC: HumanoidMonsterSpec = {
  key: 'monster_skeleton',
  // Wide for the sword arc and the rolling skull; width doesn't move the sprite in-game.
  frameW: 76,
  frameH: 64,
  scale: 1.42,
  skin: SKIN,
  ready: READY,
  attack: 'overhead',
  contactWpn: 2.15,
  deathDir: 1,
  walk: { stride: 5.5, lift: 3.6, bob: 1.4, lean: 0.04, armSwing: 2.2 },
  shadowR: 11,
  view: {
    build: { hipW: 2.3, shW: 5, elbowOut: 1.3 },
    headBias: 5,
    torso: skeletonTorsoView,
    head: skullView,
  },
};

function buildTracks(): Partial<Record<MonsterAction, Key<HumanPose>[]>> {
  const g = humanoidTracks(SPEC);
  const R = READY;
  const P = (o: Partial<HumanPose>): HumanPose => ({ ...R, ...o });
  // Death: knees buckle, it folds forward and clatters into a heap.
  const recoil = g.death[0].pose;
  const lying = g.death[3].pose;
  const death: Key<HumanPose>[] = [
    { at: 0, pose: recoil },
    { at: 0.33, pose: P({
      ...recoil, root: vec(R.root.x - 2, R.root.y + 8), lean: 0.45, head: 0.5,
      footN: vec(R.footN.x + 1, GROUND_Y), footF: vec(R.footF.x, GROUND_Y),
      handN: vec(R.root.x + 8, R.root.y + 12), handF: vec(R.root.x + 5, R.root.y + 8), wpn: 2.1, off: 0.6,
    }) },
    { at: 0.67, ease: 'in', pose: P({
      root: vec(R.root.x, GROUND_Y - 8), lean: 0.9, head: 0.6, spin: 0.35,
      footN: vec(R.root.x + 8, GROUND_Y), footF: vec(R.root.x + 3, GROUND_Y),
      handN: vec(R.root.x + 16, GROUND_Y - 3), handF: vec(R.root.x + 12, GROUND_Y - 5), wpn: 2.4, off: 1.2, flow: 0.3,
    }) },
    { at: 1, ease: 'out', pose: { ...lying, off: 1.5, wpn: 2.6 } },
  ];
  // Attack: keep the shield up in front while the sword comes over the top.
  const attack = g.attack.map((k, i) => ({
    ...k,
    pose: i === 0 ? k.pose : {
      ...k.pose,
      handN: vec(k.pose.handN.x, k.pose.handN.y + [0, 2.5, 2, 0][i]),
      handF: vec(R.handF.x + [0, 1.5, 3, 2.5][i], R.handF.y + [0, -4, -2, 0.5][i]),
      off: [0, -0.25, 0.1, 0.35][i],
    },
  }));
  return { death, attack };
}

const TRACKS = buildTracks();
const ATTACK = TRACKS.attack!;

function solveViewSkeletonFor(p: HumanPose, view: HumanView): ViewSkeleton {
  return solveViewSkeleton(p, SKIN.prop, SPEC.view!.build, view);
}

function swordLine(p: HumanPose): { tip: V; base: V } {
  const sk = solveSkeleton(p, SKIN.prop);
  const hand = spun(p, sk.handN, sk);
  return { tip: along(hand, p.wpn + p.spin, BLADE_LEN), base: along(hand, p.wpn + p.spin, 4) };
}

const BASE = humanoidMonster({
  ...SPEC,
  tracks: TRACKS,
  viewFx: (ctx, p, sk, act, t) => {
    if (act === 'attack' && p.fx > 0.3) {
      const tips: V[] = [];
      const bases: V[] = [];
      for (let i = 5; i >= 0; i--) {
        const sp0 = samplePoseTrack(ATTACK, Math.max(0, t - i * 0.05));
        const vsk = solveViewSkeletonFor(sp0, sk.rig.view);
        const { ang, k } = vsk.rig.dir(sp0.wpn);
        const dir = vec(Math.sin(ang) * k, -Math.cos(ang) * k);
        tips.push(vec(vsk.handN.x + dir.x * BLADE_LEN, vsk.handN.y + dir.y * BLADE_LEN));
        bases.push(vec(vsk.handN.x + dir.x * 4, vsk.handN.y + dir.y * 4));
      }
      smear(ctx, tips, bases, SOUL, 0.5 * p.fx);
    }
    const dt = act === 'death' ? t : 0;
    const fire = act === 'death' ? Math.max(0, 1 - dt * 1.6) : 1;
    if (fire <= 0.02 || dt > 0.5) return;
    const back = sk.rig.fwd;
    for (const eye of viewEyes(sk)) {
      glow(ctx, eye, 3 + p.fx * 1.5, SOUL, (0.5 + p.fx * 0.3) * fire);
      for (let i = 1; i <= 3; i++) {
        const k = i / 3;
        const wob = Math.sin(t * Math.PI * 4 + i * 1.7) * 0.8;
        const d = k * 4.5 + p.flow * 3;
        glow(ctx, vec(eye.x - back.x * d, eye.y - back.y * d - k * 1.5 + wob), 1.6 - k * 0.5, SOUL, 0.3 * (1 - k * 0.6) * fire);
      }
    }
  },
  fx: (ctx, p, sk, act, t) => {
    if (act === 'attack' && p.fx > 0.3) {
      const tips: V[] = [];
      const bases: V[] = [];
      for (let i = 5; i >= 0; i--) {
        const s = swordLine(samplePoseTrack(ATTACK, Math.max(0, t - i * 0.05)));
        tips.push(s.tip);
        bases.push(s.base);
      }
      smear(ctx, tips, bases, SOUL, 0.5 * p.fx);
    }
    // Soul-fire in the eye sockets, streaming back as a wisp
    const dt = act === 'death' ? t : 0;
    const fire = act === 'death' ? Math.max(0, 1 - dt * 1.6) : 1;
    if (fire <= 0.02 || dt > 0.5) return;
    const eye = spun(p, vec(
      sk.head.x + Math.cos(sk.headAng) * 3.4 + Math.sin(sk.headAng) * 1,
      sk.head.y + Math.sin(sk.headAng) * 3.4 - Math.cos(sk.headAng) * 1,
    ), sk);
    glow(ctx, eye, 3.4 + p.fx * 1.5, SOUL, (0.55 + p.fx * 0.3) * fire);
    for (let i = 1; i <= 3; i++) {
      const k = i / 3;
      const wob = Math.sin(t * Math.PI * 4 + i * 1.7) * 0.8;
      glow(ctx, vec(eye.x - k * 4.5 - p.flow * 3, eye.y - k * 1.5 + wob), 1.8 - k * 0.6, SOUL, 0.35 * (1 - k * 0.6) * fire);
    }
  },
});

export const SkeletonDrawer: EntityDrawer = {
  ...BASE,
  drawFrame(ctx, frame, action: EntityAction, w, h, utils, view) {
    const act = action as MonsterAction;
    CUR.act = act;
    CUR.t = monsterTime(act, frame);
    BASE.drawFrame(ctx, frame, action, w, h, utils, view);
  },
};
