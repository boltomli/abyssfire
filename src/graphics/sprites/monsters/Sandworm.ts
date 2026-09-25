// src/graphics/sprites/monsters/Sandworm.ts
//
// 沙虫 — a great armoured worm bursting from a sand mound. Telescoping
// sun-bleached ring plates with hot flesh glowing in the gaps, a blunt
// head that splits into two jaw petals around a ringed, tooth-lined maw
// with a molten gullet. Sways and churns the sand to move, rears back and
// lunges down to bite, slumps and sinks into the dune on death.
import type { MonsterAction } from '../types';
import {
  GROUND_Y,
  blobPath,
  capsulePath,
  cel,
  glow,
  lerpV,
  polyPath,
  samplePoseTrack,
  smear,
  tone,
  vec,
  type Key,
  type Tone,
  type V,
} from '../rig/Rig';
import { rigMonster } from '../rig/MonsterKit';

interface WormPose {
  /** Bezier control point of the body and the head centre. */
  mid: V;
  head: V;
  /** Direction the maw faces (canvas radians, 0 = right, + = down). */
  ang: number;
  /** Maw opening 0..1. */
  maw: number;
  /** How far the whole worm has sunk below the sand. */
  sink: number;
  /** Mound size 0..1. */
  mound: number;
  /** Strike intensity. */
  fx: number;
  /** Life: 1 alive … 0 dead (dims the gullet glow). */
  life: number;
}

const BASE = vec(40, GROUND_Y + 5);
const RING = tone(0xdcae68, { light: 0.42, shadow: 0.4 });
const RING_B = tone(0xb8743c, { light: 0.35, shadow: 0.42 });
const HEAD = tone(0x9c5a30, { light: 0.4 });
const PETAL = tone(0xc98848, { light: 0.45 });
const FLESH = tone(0xe0582a, { light: 0.3, shadow: 0.3 });
const SAND = tone(0xe6c68a, { light: 0.4, shadow: 0.3 });
const SAND_BACK = tone(0xc7a26a, { light: 0.25, shadow: 0.35 });
const BONE = '#f6ecd2';
const SPINE = tone(0xf0dcae, { light: 0.4, shadow: 0.45 });

const REST: WormPose = { mid: vec(33, 60), head: vec(59, 43), ang: 0.4, maw: 0.15, sink: 0, mound: 1, fx: 0, life: 1 };
const P = (o: Partial<WormPose>): WormPose => ({ ...REST, ...o });

const ATTACK: Key<WormPose>[] = [
  { at: 0, pose: REST },
  { at: 0.33, ease: 'out', pose: P({ mid: vec(30, 58), head: vec(44, 39), ang: -0.25, maw: 0.05, fx: 0.2 }) },
  { at: 0.67, ease: 'in', pose: P({ mid: vec(44, 50), head: vec(66, 44), ang: 0.45, maw: 0.85, fx: 0.6 }) },
  { at: 1, ease: 'linear', pose: P({ mid: vec(54, 50), head: vec(76, 63), ang: 0.72, maw: 1, fx: 1, sink: -1 }) },
];

const HURT: Key<WormPose>[] = [
  { at: 0, pose: P({ mid: vec(35, 58), head: vec(47, 44), ang: -0.2, maw: 0.7 }) },
  { at: 1, pose: P({ mid: vec(38, 58), head: vec(53, 41), ang: 0.1, maw: 0.4 }) },
];

const DEATH: Key<WormPose>[] = [
  { at: 0, pose: P({ mid: vec(35, 58), head: vec(47, 44), ang: -0.2, maw: 0.7 }) },
  { at: 0.33, pose: P({ mid: vec(31, 56), head: vec(46, 46), ang: -0.38, maw: 1, life: 0.8 }) },
  { at: 0.67, ease: 'in', pose: P({ mid: vec(50, 58), head: vec(70, 70), ang: 0.9, maw: 0.5, life: 0.4, mound: 0.8 }) },
  { at: 1, ease: 'out', pose: P({ mid: vec(56, 78), head: vec(76, 86), ang: 0.35, maw: 0.25, life: 0, sink: 3, mound: 0.6 }) },
];

function wormPose(act: MonsterAction, t: number): WormPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle':
      return P({
        mid: vec(REST.mid.x - Math.sin(ph) * 1.5, REST.mid.y),
        head: vec(REST.head.x + Math.sin(ph) * 1.8, REST.head.y + Math.cos(ph) * 1.1),
        ang: REST.ang + Math.sin(ph - 0.6) * 0.1,
        maw: 0.12 + Math.max(0, Math.sin(ph)) * 0.22,
      });
    case 'walk':
      return P({
        mid: vec(REST.mid.x - Math.sin(ph) * 4.5, REST.mid.y + Math.sin(ph * 2) * 1.2),
        head: vec(REST.head.x + Math.sin(ph) * 3.5, REST.head.y + 1.5 + Math.sin(ph * 2 + 0.8) * 1.6),
        ang: REST.ang + Math.sin(ph + 0.8) * 0.16,
        maw: 0.12,
        sink: 1.5 + Math.sin(ph * 2) * 1.5,
        mound: 1.1,
      });
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

// ── Body curve ──────────────────────────────────────────────────────────

const N = 9;

function neckOf(p: WormPose): V {
  return vec(p.head.x - Math.cos(p.ang) * 6, p.head.y - Math.sin(p.ang) * 6 + p.sink);
}

function bez(p: WormPose, t: number): V {
  const a = BASE;
  const b = vec(p.mid.x, p.mid.y + p.sink);
  const c = neckOf(p);
  const u = 1 - t;
  return vec(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y);
}

function radius(t: number): number {
  return 10.5 - 2.4 * t;
}

function drawBody(ctx: CanvasRenderingContext2D, p: WormPose): void {
  const pts: V[] = [];
  for (let i = 0; i <= N; i++) pts.push(bez(p, i / N));
  // Hot flesh underneath the plates
  for (let i = 0; i < N; i++) {
    cel(ctx, () => capsulePath(ctx, pts[i], pts[i + 1], radius(i / N) - 0.8, radius((i + 1) / N) - 0.8), FLESH, { band: 1.6, stroke: 0 });
  }
  // Ring plates, base → neck; edges curve toward the base (seen from above)
  for (let i = 0; i < N; i++) {
    const a = lerpV(pts[i], pts[i + 1], 0.02);
    const b = lerpV(pts[i], pts[i + 1], 0.8);
    const ra = radius(i / N);
    const rb = radius((i + 0.8) / N) + 0.3;
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.max(0.01, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const path = (): void => {
      ctx.moveTo(a.x + nx * ra, a.y + ny * ra);
      ctx.quadraticCurveTo(a.x - ux * ra * 0.55, a.y - uy * ra * 0.55, a.x - nx * ra, a.y - ny * ra);
      ctx.lineTo(b.x - nx * rb, b.y - ny * rb);
      ctx.quadraticCurveTo(b.x - ux * rb * 0.55, b.y - uy * rb * 0.55, b.x + nx * rb, b.y + ny * rb);
      ctx.closePath();
    };
    const t: Tone = i % 2 === 0 ? RING : RING_B;
    cel(ctx, path, t, { band: 2.2, hi: 1 });
    ctx.save();
    ctx.beginPath();
    path();
    ctx.clip();
    // Pale belly scute on the forward-facing side
    const bs = nx > 0 ? 1 : -1;
    const bm = lerpV(a, b, 0.4);
    ctx.fillStyle = 'rgba(250,232,190,0.5)';
    ctx.beginPath();
    ctx.ellipse(bm.x + nx * bs * rb * 0.6, bm.y + ny * bs * rb * 0.6, rb * 0.36, len * 0.9, Math.atan2(dy, dx) - Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    // Sun-bleached lip on the leading edge
    ctx.strokeStyle = 'rgba(255,244,214,0.75)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(b.x - nx * rb - ux * 0.5, b.y - ny * rb - uy * 0.5);
    ctx.quadraticCurveTo(b.x - ux * (rb * 0.55 + 0.5), b.y - uy * (rb * 0.55 + 0.5), b.x + nx * rb - ux * 0.5, b.y + ny * rb - uy * 0.5);
    ctx.stroke();
    // Worn pits
    ctx.fillStyle = 'rgba(96,48,20,0.45)';
    for (const k of [-0.45, 0.1]) {
      ctx.beginPath();
      ctx.arc(bm.x - nx * bs * rb * k * -1 - ux, bm.y - ny * bs * rb * k * -1 - uy, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Dorsal spine on the back ridge
    if (i > 0) {
      const sb = lerpV(a, b, 0.45);
      const bx = sb.x - nx * bs * (rb - 0.6);
      const by = sb.y - ny * bs * (rb - 0.6);
      const tipLen = 3.4 - i * 0.12;
      cel(ctx, () => polyPath(ctx, [
        vec(bx - ux * 1.6, by - uy * 1.6),
        vec(bx - nx * bs * tipLen - ux * 1.4, by - ny * bs * tipLen - uy * 1.4),
        vec(bx + ux * 1.4, by + uy * 1.4),
      ]), SPINE, { band: 0.5, stroke: 0.4 });
    }
  }
}

function petal(ctx: CanvasRenderingContext2D, hinge: V, rot: number, flip: number): void {
  ctx.save();
  ctx.translate(hinge.x, hinge.y);
  ctx.rotate(rot);
  ctx.scale(1, flip);
  cel(ctx, () => blobPath(ctx, [vec(-1, -2.2), vec(4, -3.4), vec(9.5, -1.8), vec(12.6, 1.4), vec(7, 1.6), vec(0, 2.2)]), PETAL, { band: 1 });
  // Hooked fang at the petal tip + ridge
  ctx.fillStyle = BONE;
  ctx.beginPath();
  ctx.moveTo(10, 0.8);
  ctx.lineTo(12.8, 1.2);
  ctx.lineTo(10.4, 3.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(96,44,18,0.6)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(1, -0.8);
  ctx.quadraticCurveTo(6, -2, 10.5, -0.2);
  ctx.stroke();
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, p: WormPose): void {
  const hx = p.head.x;
  const hy = p.head.y + p.sink;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.ang);
  ctx.scale(1.22, 1.22);
  const open = p.maw;
  // Upper jaw petal sits behind the head silhouette
  petal(ctx, vec(3, -5.6), 0.42 - open * 1.05, 1);
  // Armoured head
  const skull = [vec(-7, -8), vec(-1, -8.8), vec(4.5, -7.2), vec(6.8, -2), vec(6.8, 2), vec(4.5, 7.2), vec(-1, 8.8), vec(-7, 8)];
  cel(ctx, () => blobPath(ctx, skull), HEAD, { band: 1.6, hi: 0.8 });
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, skull);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,230,190,0.55)';
  ctx.lineWidth = 0.8;
  for (const x of [-4.5, -0.5]) {
    ctx.beginPath();
    ctx.moveTo(x, -9);
    ctx.quadraticCurveTo(x + 2.2, 0, x, 9);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,240,210,0.35)';
  ctx.beginPath();
  ctx.ellipse(-1.5, -5.6, 4.6, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Sensory pits glow faintly
  for (const [x, y] of [[1.6, -5.2], [3.6, -4.1], [-1.2, -5.8]] as const) {
    ctx.fillStyle = '#2a0c06';
    ctx.beginPath();
    ctx.arc(x, y, 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,170,70,${0.8 * p.life})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ringed maw
  const mx = 5.8;
  const rx = 1 + 3.4 * open;
  const ry = 5.2 + 1.2 * open;
  ctx.fillStyle = '#2a0806';
  ctx.beginPath();
  ctx.ellipse(mx, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (open > 0.08) {
    const g = ctx.createRadialGradient(mx + rx * 0.3, 0, 0, mx + rx * 0.3, 0, ry);
    g.addColorStop(0, `rgba(255,${190 * p.life + 40},90,${0.95 * p.life + 0.05})`);
    g.addColorStop(0.45, `rgba(214,60,24,${0.8 * p.life + 0.1})`);
    g.addColorStop(1, 'rgba(60,8,6,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(mx, 0, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Two rings of inward-pointing teeth
    for (const [scale, n, tl] of [[0.95, 10, 1.9], [0.58, 8, 1.2]] as const) {
      ctx.fillStyle = scale > 0.9 ? BONE : 'rgba(246,226,190,0.85)';
      for (let k = 0; k < n; k++) {
        const th = (k / n) * Math.PI * 2 + (scale < 0.9 ? 0.4 : 0);
        const px = mx + Math.cos(th) * rx * scale;
        const py = Math.sin(th) * ry * scale;
        const ix = mx + Math.cos(th) * rx * (scale - 0.35);
        const iy = Math.sin(th) * ry * Math.max(0.1, scale - tl / ry);
        const tx = -Math.sin(th) * 0.55;
        const ty = Math.cos(th) * 0.8;
        ctx.beginPath();
        ctx.moveTo(px + tx, py + ty);
        ctx.lineTo(ix, iy);
        ctx.lineTo(px - tx, py - ty);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = '#5a2412';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(mx, 0, rx + 0.4, ry + 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Lower jaw petal in front
  petal(ctx, vec(3, 5.6), -(0.42 - open * 1.05), -1);
  ctx.restore();
}

function drawMound(ctx: CanvasRenderingContext2D, p: WormPose, front: boolean, t: number): void {
  const m = p.mound;
  const cx = BASE.x;
  if (!front) {
    cel(ctx, () => blobPath(ctx, [vec(cx - 16 * m, GROUND_Y), vec(cx - 10 * m, GROUND_Y - 9 * m), vec(cx - 2, GROUND_Y - 13 * m), vec(cx + 7 * m, GROUND_Y - 12 * m), vec(cx + 14 * m, GROUND_Y - 7 * m), vec(cx + 18 * m, GROUND_Y)]), SAND_BACK, { band: 1.2 });
    return;
  }
  const pts = [
    vec(cx - 22 * m, GROUND_Y + 0.8), vec(cx - 17 * m, GROUND_Y - 3 * m), vec(cx - 10 * m, GROUND_Y - 8.5 * m),
    vec(cx - 4 * m, GROUND_Y - 6.5 * m), vec(cx + 3 * m, GROUND_Y - 9 * m), vec(cx + 9 * m, GROUND_Y - 6 * m),
    vec(cx + 16 * m, GROUND_Y - 4 * m), vec(cx + 23 * m, GROUND_Y + 0.8), vec(cx, GROUND_Y + 2.2),
  ];
  cel(ctx, () => blobPath(ctx, pts), SAND, { band: 1.6, hi: 0.9 });
  // Wind ripples, pebbles and a sun-bleached bone
  ctx.strokeStyle = 'rgba(160,112,58,0.55)';
  ctx.lineWidth = 0.55;
  for (const [x, y, w] of [[-9, -2.5, 6], [3, -3.2, 7], [11, -1.2, 5]] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + x * m, GROUND_Y + y * m);
    ctx.quadraticCurveTo(cx + (x + w / 2) * m, GROUND_Y + (y - 1) * m, cx + (x + w) * m, GROUND_Y + y * m);
    ctx.stroke();
  }
  const peb = tone(0x9a7a58, { light: 0.4 });
  for (const [x, y, r] of [[-15, -1, 1.3], [16, -0.6, 1.1], [7, -0.4, 0.8]] as const) {
    cel(ctx, () => { ctx.ellipse(cx + x * m, GROUND_Y + y, r * 1.3, r, 0, 0, Math.PI * 2); }, peb, { band: 0.4, stroke: 0.3 });
  }
  // Grains trickling off the rim (animated)
  ctx.fillStyle = 'rgba(248,226,176,0.9)';
  for (let i = 0; i < 7; i++) {
    const k = (i / 7 + t * 2) % 1;
    const side = i % 2 === 0 ? -1 : 1;
    const x = cx + side * (4 + k * 12) * m;
    const y = GROUND_Y - 5 * m + k * 5 * m;
    ctx.fillRect(x, y, 0.8, 0.8);
  }
}

function drawWorm(ctx: CanvasRenderingContext2D, p: WormPose, t: number): void {
  drawMound(ctx, p, false, t);
  ctx.save();
  // Everything below the dune line is buried
  ctx.beginPath();
  ctx.rect(-200, -200, 500, GROUND_Y - 1 + 200);
  ctx.clip();
  drawBody(ctx, p);
  drawHead(ctx, p);
  ctx.restore();
  drawMound(ctx, p, true, t);
}

function mawCentre(p: WormPose): V {
  return vec(p.head.x + Math.cos(p.ang) * 8, p.head.y + p.sink + Math.sin(p.ang) * 8);
}

function wormFx(ctx: CanvasRenderingContext2D, p: WormPose, act: MonsterAction, t: number): void {
  // Gullet glow
  if (p.maw > 0.1 && p.life > 0.05) {
    glow(ctx, mawCentre(p), 5 + 6 * p.maw * p.fx + 3 * p.maw, 0xff6a2a, (0.25 + 0.4 * p.maw) * p.life);
  }
  if (act === 'attack' && t > 0.5) {
    const tips: V[] = [];
    const bases: V[] = [];
    for (let i = 0; i <= 5; i++) {
      const q = samplePoseTrack(ATTACK, t - 0.34 + (i / 5) * 0.34);
      tips.push(mawCentre(q));
      bases.push(vec(q.head.x - Math.cos(q.ang) * 4, q.head.y - Math.sin(q.ang) * 4));
    }
    smear(ctx, tips, bases, 0xffd08a, 0.45 * p.fx);
  }
  // Sand spray when churning / biting / collapsing
  let spray = 0;
  if (act === 'walk') spray = 0.8;
  else if (act === 'attack') spray = Math.max(0, t - 0.5) * 2;
  else if (act === 'death') spray = t > 0.5 ? 1 - (t - 0.5) : 0;
  if (spray > 0) {
    for (let i = 0; i < 9; i++) {
      const k = (i / 9 + t * (act === 'walk' ? 1 : 0.6)) % 1;
      const side = i % 2 === 0 ? -1 : 1;
      const x = BASE.x + side * (8 + k * 16) + (i % 3) * 1.5;
      const y = GROUND_Y - 6 - Math.sin(k * Math.PI) * (6 + (i % 3) * 2);
      ctx.fillStyle = `rgba(236,208,150,${0.75 * spray * (1 - k * 0.6)})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + (i % 2) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export const SandwormDrawer = rigMonster<WormPose>({
  key: 'monster_sandworm',
  // Wider than the old sheet so the lunge fits; width doesn't move the sprite in-game.
  frameW: 72,
  frameH: 48,
  scale: 1.32,
  pose: wormPose,
  draw: (ctx, p, _act, t) => drawWorm(ctx, p, t),
  shadow: (p) => ({ x: BASE.x + 2 + (p.head.x - 58) * 0.2, r: 24, lift: 0 }),
  fx: wormFx,
  rim: 'rgba(255,238,200,0.6)',
  ink: '#22100a',
});
