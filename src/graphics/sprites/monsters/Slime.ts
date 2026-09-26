// src/graphics/sprites/monsters/Slime.ts
//
// 史莱姆 — glossy, jiggling jelly with a darker core, drifting bubbles, a
// half-digested bone inside and big glaring eyes. Hops to move, rears up
// and body-slams to attack, splats into a puddle on death.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  blobPath,
  cel,
  samplePoseTrack,
  tone,
  vec,
  type Key,
  type V,
} from '../rig/Rig';
import { rigMonster } from '../rig/MonsterKit';

interface SlimePose {
  /** Horizontal centre and how far the bottom is off the ground. */
  x: number;
  hop: number;
  /** Base radius scale: squash (<1 tall / >1 wide). */
  sx: number;
  sy: number;
  /** Top leans forward (+) or back (−). */
  lean: number;
  /** Eye openness 0 (X-ed out) … 1. */
  eyes: number;
  /** Forward pseudopod reach 0..1 (attack). */
  reach: number;
  /** Puddle spread for death 0..1. */
  melt: number;
  fx: number;
}

const BODY = tone(0x5fcf5a, { light: 0.45, shadow: 0.35 });
const CORE = 'rgba(28,110,48,0.55)';
const W = 20;
const H = 17;

const REST: SlimePose = { x: CENTER_X, hop: 0, sx: 1, sy: 1, lean: 0, eyes: 1, reach: 0, melt: 0, fx: 0 };
const P = (o: Partial<SlimePose>): SlimePose => ({ ...REST, ...o });

const WALK: Key<SlimePose>[] = [
  { at: 0, pose: P({ sx: 1.18, sy: 0.8 }) },
  { at: 0.2, ease: 'out', pose: P({ x: CENTER_X + 1, sx: 0.86, sy: 1.18, hop: 6, lean: 0.12 }) },
  { at: 0.45, pose: P({ x: CENTER_X + 2.5, sx: 0.92, sy: 1.1, hop: 9, lean: 0.06 }) },
  { at: 0.7, ease: 'in', pose: P({ x: CENTER_X + 3, sx: 1, sy: 1.02, hop: 3 }) },
  { at: 0.85, pose: P({ x: CENTER_X + 3, sx: 1.25, sy: 0.74 }) },
  { at: 1, pose: P({ x: CENTER_X, sx: 1.18, sy: 0.8 }) },
];

const ATTACK: Key<SlimePose>[] = [
  { at: 0, pose: REST },
  { at: 0.33, ease: 'out', pose: P({ x: CENTER_X - 3, sx: 0.8, sy: 1.3, lean: -0.3, fx: 0.3 }) },
  { at: 0.67, ease: 'in', pose: P({ x: CENTER_X + 4, sx: 0.95, sy: 1.1, hop: 6, lean: 0.35, reach: 0.4, fx: 0.7 }) },
  { at: 1, ease: 'linear', pose: P({ x: CENTER_X + 5, sx: 1.3, sy: 0.72, lean: 0.25, reach: 1, fx: 1 }) },
];

const HURT: Key<SlimePose>[] = [
  { at: 0, pose: P({ x: CENTER_X - 3, sx: 1.35, sy: 0.68, lean: -0.25, eyes: 0.35 }) },
  { at: 1, pose: P({ x: CENTER_X - 1.5, sx: 0.9, sy: 1.12, lean: 0.1, eyes: 0.7 }) },
];

const DEATH: Key<SlimePose>[] = [
  { at: 0, pose: P({ x: CENTER_X - 2, sx: 1.35, sy: 0.7, lean: -0.2, eyes: 0.3 }) },
  { at: 0.33, pose: P({ x: CENTER_X - 2, sx: 0.85, sy: 1.25, eyes: 0 }) },
  { at: 0.67, ease: 'in', pose: P({ x: CENTER_X - 2, sx: 1.6, sy: 0.5, eyes: 0, melt: 0.5 }) },
  { at: 1, ease: 'out', pose: P({ x: CENTER_X - 1, sx: 1.65, sy: 0.3, eyes: 0, melt: 1 }) },
];

function slimePose(act: MonsterAction, t: number): SlimePose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle':
      return P({ sx: 1 + Math.sin(ph) * 0.06, sy: 1 - Math.sin(ph) * 0.07, lean: Math.sin(ph + 0.8) * 0.05 });
    case 'walk': return samplePoseTrack(WALK, t);
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

/** Dome outline: flat-ish base, top skewed by lean, optional forward pseudopod. */
function outline(p: SlimePose): V[] {
  const base = GROUND_Y - p.hop;
  const w = W * p.sx;
  const h = H * p.sy;
  const pts: V[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI; // left → over the top → right
    const k = Math.sin(a - Math.PI); // 0 at the base, 1 at the top
    let x = p.x + Math.cos(a) * w + p.lean * h * k * 1.2;
    let y = base - Math.abs(Math.sin(a)) * h * (1 - p.melt * 0.5);
    if (p.reach > 0 && Math.cos(a) > 0.2) {
      x += p.reach * 7 * Math.cos(a) * (1 - k);
      y += p.reach * 2 * (1 - k);
    }
    pts.push(vec(x, y));
  }
  // Base bulges slightly and drips when melting
  pts.push(vec(p.x + w * 0.7, base + 1.2 + p.melt));
  pts.push(vec(p.x, base + 1.6 + p.melt * 1.5));
  pts.push(vec(p.x - w * 0.7, base + 1.2 + p.melt));
  return pts;
}

function drawSlime(ctx: CanvasRenderingContext2D, p: SlimePose, t: number): void {
  const pts = outline(p);
  const base = GROUND_Y - p.hop;
  const h = H * p.sy;
  cel(ctx, () => blobPath(ctx, pts), BODY, { band: 2.6, hi: 1.2 });
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, pts);
  ctx.clip();
  // Dark jelly core
  ctx.fillStyle = CORE;
  ctx.beginPath();
  ctx.ellipse(p.x + p.lean * 4, base - h * 0.42, W * p.sx * 0.55, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Half-digested bone
  ctx.save();
  ctx.translate(p.x - 5 * p.sx + p.lean * 3, base - h * 0.3);
  ctx.rotate(-0.5);
  ctx.fillStyle = 'rgba(236,226,198,0.7)';
  ctx.fillRect(-3.5, -0.7, 7, 1.4);
  for (const sx of [-3.5, 3.5]) {
    ctx.beginPath();
    ctx.arc(sx, -0.8, 1, 0, Math.PI * 2);
    ctx.arc(sx, 0.8, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Rising bubbles
  ctx.strokeStyle = 'rgba(210,255,200,0.7)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const k = (i / 4 + t) % 1;
    const bx = p.x + Math.sin(i * 2.3) * W * p.sx * 0.5;
    const by = base - 2 - k * h * 0.8;
    ctx.beginPath();
    ctx.arc(bx, by, 0.6 + (i % 2) * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Glossy sheen
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(p.x - W * p.sx * 0.35 + p.lean * h * 0.6, base - h * 0.72, 3.4 * p.sx, 1.6 * p.sy, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(p.x - W * p.sx * 0.12 + p.lean * h * 0.7, base - h * 0.84, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eyes
  const ex = p.x + 4 * p.sx + p.lean * h * 0.75;
  const ey = base - h * 0.58;
  for (const [dx, r] of [[0, 3], [5.6, 2.3]] as const) {
    const cx = ex + dx * p.sx;
    if (p.eyes <= 0.05) {
      ctx.strokeStyle = '#123018';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, ey - r * 0.6);
      ctx.lineTo(cx + r * 0.6, ey + r * 0.6);
      ctx.moveTo(cx + r * 0.6, ey - r * 0.6);
      ctx.lineTo(cx - r * 0.6, ey + r * 0.6);
      ctx.stroke();
      continue;
    }
    const ry = r * (0.35 + 0.65 * p.eyes);
    ctx.fillStyle = '#f7fff0';
    ctx.beginPath();
    ctx.ellipse(cx, ey, r * 0.85, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d4a24';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = '#10200f';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.25, ey + 0.2, r * 0.42, Math.min(ry, r * 0.55), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + r * 0.05, ey - ry * 0.45, 0.8, 0.8);
  }
  // Angry brow when attacking
  if (p.fx > 0.2) {
    ctx.strokeStyle = '#1d4a24';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(ex - 3, ey - 4.2);
    ctx.lineTo(ex + 2.5, ey - 2.6);
    ctx.moveTo(ex + 4 * p.sx, ey - 3);
    ctx.lineTo(ex + 8 * p.sx, ey - 3.8);
    ctx.stroke();
  }
}

export const SlimeDrawer = rigMonster<SlimePose>({
  key: 'monster_slime',
  // Wider than tall for the lunge; width doesn't move the sprite in-game.
  frameW: 72,
  frameH: 40,
  scale: 2.4,
  pose: slimePose,
  draw: (ctx, p, _act, t) => drawSlime(ctx, p, t),
  shadow: (p) => ({ x: p.x, r: W * p.sx * 1.05, lift: p.hop * 1.5 }),
  fx: (ctx, p) => {
    if (p.melt > 0) {
      ctx.fillStyle = `rgba(95,207,90,${0.35 * p.melt})`;
      ctx.beginPath();
      ctx.ellipse(p.x, GROUND_Y + 0.5, W * p.sx * 1.1, 3 * p.melt, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  rim: 'rgba(230,255,220,0.6)',
});
