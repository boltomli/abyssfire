// src/graphics/sprites/decorations/DecorKit.ts
//
// Shared cel-shading kit for static world props (decorations, camp props,
// interactive props). Drawers author in *world pixels*: `defineDecor` scales
// the context by TEXTURE_SCALE so a 1-unit stroke is one world pixel, the
// same unit the rigged characters use (player ≈ 66 px tall).
//
// Style: 2–3 tones per material, coloured line art (thin — decorations sit
// below characters in the value hierarchy), light from the upper-left, cool
// soft contact shadows.
import type { EntityDrawer } from '../types';
import { tone, glow, type Tone, type V } from '../rig/Rig';

export { tone, glow };
export type { Tone, V };

export interface DecorDrawer extends EntityDrawer {
  /** Fraction of the frame height where the prop's base meets the ground (sprite origin Y). */
  readonly anchorY: number;
  /** Upright prop tall enough to hide a character standing behind it. */
  readonly tall?: boolean;
  /** Flat ground cover (grass, flowers, bones) — always drawn under entities. */
  readonly flat?: boolean;
  /**
   * Idle loop over the first `frames` frames, registered by SpriteGenerator
   * as `<key>_anim` (e.g. a chest's glint, a portal's swirl). Frames after
   * the loop are extra states (an opened chest) addressed by index.
   */
  readonly loop?: { readonly frames: number; readonly fps: number };
}

export type Rand = () => number;

/** mulberry32 — tiny deterministic PRNG. */
export function rng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashKey(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DecorCtx {
  /** Frame size in world px. */
  w: number;
  h: number;
  /** Horizontal centre and ground line (world px). */
  cx: number;
  gy: number;
  r: Rand;
}

export interface DecorSpec {
  key: string;
  w: number;
  h: number;
  /** Ground line in world px from the top (default h - 4). */
  ground?: number;
  tall?: boolean;
  flat?: boolean;
  frames?: number;
  /** Idle loop over the first N frames (see DecorDrawer.loop). */
  loop?: { frames: number; fps: number };
  draw(ctx: CanvasRenderingContext2D, k: DecorCtx, frame: number): void;
}

export function defineDecor(spec: DecorSpec): DecorDrawer {
  const ground = spec.ground ?? spec.h - 4;
  return {
    key: spec.key,
    frameW: spec.w,
    frameH: spec.h,
    totalFrames: spec.frames ?? 1,
    anchorY: ground / spec.h,
    tall: spec.tall,
    flat: spec.flat,
    loop: spec.loop,
    // Decorations carry their own thin line art; no shared ink pass.
    inked: true,
    drawFrame(ctx, frame, _action, W) {
      const s = W / spec.w;
      ctx.save();
      ctx.scale(s, s);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      spec.draw(ctx, { w: spec.w, h: spec.h, cx: spec.w / 2, gy: ground, r: rng(hashKey(spec.key) + frame * 7919) }, frame);
      ctx.restore();
    },
  };
}

// ── Shading ─────────────────────────────────────────────────────────────

/** Light direction (from upper-left) used to offset shade/highlight bands. */
const LDX = 0.55;
const LDY = 0.83;

export interface ShadeOpts {
  /** Width of the lower-right shadow band (world px). */
  band?: number;
  /** Width of the upper-left highlight crescent (0 = none). */
  hi?: number;
  /** Line-art width (0 = none). */
  stroke?: number;
  /** Override line colour. */
  line?: string;
}

/**
 * Three-tone cel fill of an arbitrary closed path: a light crescent on the
 * upper-left edge, base in the middle, a cool shadow band on the lower right,
 * then thin coloured line art.
 */
export function shade(ctx: CanvasRenderingContext2D, path: () => void, t: Tone, o: ShadeOpts = {}): void {
  const band = o.band ?? 2;
  const hi = o.hi ?? 1;
  ctx.save();
  ctx.beginPath();
  path();
  ctx.clip();
  ctx.fillStyle = t.shade;
  ctx.fillRect(-2000, -2000, 4000, 4000);
  ctx.save();
  ctx.translate(-band * LDX, -band * LDY);
  ctx.beginPath();
  path();
  ctx.restore();
  ctx.clip();
  if (hi > 0) {
    ctx.fillStyle = t.light;
    ctx.fillRect(-2000, -2000, 4000, 4000);
    ctx.save();
    ctx.translate(hi * LDX, hi * LDY);
    ctx.beginPath();
    path();
    ctx.fillStyle = t.base;
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = t.base;
    ctx.fillRect(-2000, -2000, 4000, 4000);
  }
  ctx.restore();
  const stroke = o.stroke ?? 0.7;
  if (stroke > 0) {
    ctx.beginPath();
    path();
    ctx.strokeStyle = o.line ?? t.line;
    ctx.lineWidth = stroke;
    ctx.stroke();
  }
}

/** Flat fill + line (for small details). */
export function flat(ctx: CanvasRenderingContext2D, path: () => void, fill: string, line?: string, lw = 0.6): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) {
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Soft, cool contact shadow on the ground. `dx` pushes it lower-right. */
export function contactShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha = 0.38): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(14,10,30,${alpha})`);
  g.addColorStop(0.6, `rgba(14,10,30,${alpha * 0.6})`);
  g.addColorStop(1, 'rgba(14,10,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Paths ───────────────────────────────────────────────────────────────

export function ellipseP(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): () => void {
  return () => ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function polyP(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]): () => void {
  return () => {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
}

/** Smooth closed curve through points (quadratic midpoints). */
export function blobP(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]): () => void {
  return () => {
    const n = pts.length;
    const mx = (i: number) => (pts[i % n][0] + pts[(i + 1) % n][0]) / 2;
    const my = (i: number) => (pts[i % n][1] + pts[(i + 1) % n][1]) / 2;
    ctx.moveTo(mx(n - 1), my(n - 1));
    for (let i = 0; i < n; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx(i), my(i));
    ctx.closePath();
  };
}

/**
 * Scalloped "cloud" outline (foliage lumps): rounded lobes with sharp inward
 * cusps. Built as a sampled polygon so it never self-intersects.
 */
export function cloudP(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number,
  lobes: number, amp: number, r: Rand, phase = r() * Math.PI,
): () => void {
  const vars = Array.from({ length: lobes }, () => 0.75 + r() * 0.5);
  const pts: [number, number][] = [];
  const N = Math.max(48, lobes * 10);
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const k = (th * lobes) / 2 + phase;
    const li = Math.floor(((k / Math.PI) % lobes + lobes) % lobes);
    const bump = Math.abs(Math.cos(k)) * vars[li];
    const rr = 1 - amp + amp * bump;
    pts.push([x + Math.cos(th) * rx * rr, y + Math.sin(th) * ry * rr]);
  }
  return () => {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
}

/** Irregular rock outline: flat-ish bottom, faceted top. */
export function rockPts(x: number, gy: number, w: number, h: number, r: Rand, n = 7): [number, number][] {
  const pts: [number, number][] = [];
  pts.push([x - w / 2, gy]);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const th = Math.PI * (1 - t);
    const rr = 0.78 + r() * 0.3;
    pts.push([x + Math.cos(th) * (w / 2) * rr, gy - Math.sin(th) * h * rr - (t < 0.5 ? 0 : h * 0.05)]);
  }
  pts.push([x + w / 2, gy]);
  pts.push([x + w * 0.2, gy + h * 0.1]);
  pts.push([x - w * 0.25, gy + h * 0.1]);
  return pts;
}

// ── Strokes ─────────────────────────────────────────────────────────────

export function line(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], color: string, w: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

export function curve(ctx: CanvasRenderingContext2D, a: readonly [number, number], c: readonly [number, number], b: readonly [number, number], color: string, w: number): void {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Tapered stroke (leaf / blade / crack) from a to b with a mid control point. */
export function blade(
  ctx: CanvasRenderingContext2D,
  a: readonly [number, number], c: readonly [number, number], b: readonly [number, number],
  width: number, fill: string, lineColor?: string,
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * width;
  const ny = (dx / len) * width;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx, a[1] + ny);
  ctx.quadraticCurveTo(c[0] + nx * 0.6, c[1] + ny * 0.6, b[0], b[1]);
  ctx.quadraticCurveTo(c[0] - nx * 0.6, c[1] - ny * 0.6, a[0] - nx, a[1] - ny);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineColor) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 0.45;
    ctx.stroke();
  }
}

// ── Composite helpers ───────────────────────────────────────────────────

export interface CanopyPalette {
  leaf: number;
  /** Darker colour for back lumps. */
  back: number;
  /** Accent for leaf strokes on lit areas. */
  accent?: string;
}

/**
 * Cartoon canopy: back lumps (dark) then front lumps, each cel shaded, plus a
 * few leaf strokes on the lit side. `lumps` are [x, y, rx, ry] in world px.
 */
export function canopy(
  ctx: CanvasRenderingContext2D,
  lumps: readonly (readonly [number, number, number, number])[],
  pal: CanopyPalette,
  r: Rand,
  backCount = Math.floor(lumps.length / 2),
): void {
  const back = tone(pal.back, { shadow: 0.35, light: 0.18 });
  const front = tone(pal.leaf, { shadow: 0.4, light: 0.3 });
  lumps.forEach(([x, y, rx, ry], i) => {
    const t = i < backCount ? back : front;
    const lobes = Math.max(5, Math.round((rx + ry) / 5));
    shade(ctx, cloudP(ctx, x, y, rx, ry, lobes, 0.16, r), t, {
      band: Math.max(2.5, ry * 0.42),
      hi: i < backCount ? 0 : Math.max(1.4, ry * 0.14),
      stroke: 0.75,
    });
  });
  // Leaf flicks on the lit upper-left of the front lumps.
  const accent = pal.accent ?? front.light;
  for (let i = backCount; i < lumps.length; i++) {
    const [x, y, rx, ry] = lumps[i];
    const n = Math.round(rx / 5);
    for (let j = 0; j < n; j++) {
      const a = -Math.PI * (0.55 + r() * 0.5);
      const d = 0.35 + r() * 0.45;
      const px = x + Math.cos(a) * rx * d;
      const py = y + Math.sin(a) * ry * d;
      blade(ctx, [px, py], [px + 1.5, py - 1.5], [px + 3.5, py - 1], 0.9, accent);
    }
    // One or two darker inner cusp strokes suggest leaf clusters.
    const shadeLine = tone(pal.leaf).shade;
    for (let j = 0; j < 2; j++) {
      const a = Math.PI * (0.05 + r() * 0.5);
      const px = x + Math.cos(a) * rx * 0.45;
      const py = y + Math.sin(a) * ry * 0.35;
      curve(ctx, [px - 4, py], [px, py + 2.5], [px + 4, py - 0.5], shadeLine, 0.8);
    }
  }
}

/** Tapered trunk with flared roots and optional branch stubs into the canopy. */
export function trunk(
  ctx: CanvasRenderingContext2D,
  x: number, gy: number, topY: number, baseW: number, topW: number,
  bark: number, r: Rand, lean = 0,
): void {
  const t = tone(bark, { shadow: 0.45, light: 0.25 });
  const tx = x + lean;
  const midY = (gy + topY) / 2;
  const path = () => {
    ctx.moveTo(x - baseW * 0.95, gy + 1);
    ctx.quadraticCurveTo(x - baseW * 0.45, gy - 2, x - baseW * 0.42, gy - 6);
    ctx.quadraticCurveTo(x - baseW * 0.3 + lean * 0.4, midY, tx - topW / 2, topY);
    ctx.lineTo(tx + topW / 2, topY);
    ctx.quadraticCurveTo(x + baseW * 0.3 + lean * 0.4, midY, x + baseW * 0.42, gy - 6);
    ctx.quadraticCurveTo(x + baseW * 0.45, gy - 2, x + baseW * 0.95, gy + 1);
    ctx.quadraticCurveTo(x + baseW * 0.3, gy + 2, x, gy + 1.2);
    ctx.quadraticCurveTo(x - baseW * 0.3, gy + 2, x - baseW * 0.95, gy + 1);
    ctx.closePath();
  };
  shade(ctx, path, t, { band: baseW * 0.35, hi: 1.2, stroke: 0.8 });
  // Bark strokes.
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const fx = -0.2 + (i / Math.max(1, n - 1)) * 0.4;
    const y0 = gy - 4 - r() * 6;
    const y1 = topY + (gy - topY) * (0.25 + r() * 0.3);
    curve(ctx, [x + fx * baseW, y0], [x + fx * baseW * 1.3 + lean * 0.3, (y0 + y1) / 2], [tx + fx * topW, y1], t.shade, 0.8);
  }
}

/** A branch limb (tapered capsule) drawn as a filled stroke pair. */
export function limbP(
  ctx: CanvasRenderingContext2D, a: readonly [number, number], c: readonly [number, number], b: readonly [number, number], wa: number, wb: number,
): () => void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return () => {
    ctx.moveTo(a[0] + nx * wa, a[1] + ny * wa);
    ctx.quadraticCurveTo(c[0] + nx * (wa + wb) / 2, c[1] + ny * (wa + wb) / 2, b[0] + nx * wb, b[1] + ny * wb);
    ctx.lineTo(b[0] - nx * wb, b[1] - ny * wb);
    ctx.quadraticCurveTo(c[0] - nx * (wa + wb) / 2, c[1] - ny * (wa + wb) / 2, a[0] - nx * wa, a[1] - ny * wa);
    ctx.closePath();
  };
}

/** Grass tuft: a fan of tapered blades. */
export function tuft(ctx: CanvasRenderingContext2D, x: number, gy: number, h: number, n: number, dark: string, light: string, r: Rand): void {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ang = (t - 0.5) * 1.4 + (r() - 0.5) * 0.3;
    const hh = h * (0.6 + r() * 0.4) * (1 - Math.abs(t - 0.5) * 0.5);
    const bx = x + (t - 0.5) * n * 1.2;
    const tip: [number, number] = [bx + Math.sin(ang) * hh, gy - Math.cos(ang) * hh];
    const mid: [number, number] = [bx + Math.sin(ang) * hh * 0.3, gy - hh * 0.55];
    blade(ctx, [bx, gy], mid, tip, 1.1, i % 2 ? light : dark);
  }
}

/** Faceted crystal shard with glow-friendly bright core. */
export function shard(
  ctx: CanvasRenderingContext2D, x: number, gy: number, h: number, w: number, lean: number, col: number,
): void {
  const t = tone(col, { shadow: 0.35, light: 0.55 });
  const tipX = x + lean;
  const tipY = gy - h;
  const pts: [number, number][] = [
    [x - w / 2, gy],
    [x - w / 2 + lean * 0.7, gy - h * 0.72],
    [tipX, tipY],
    [x + w / 2 + lean * 0.7, gy - h * 0.7],
    [x + w / 2, gy],
  ];
  shade(ctx, polyP(ctx, pts), t, { band: w * 0.45, hi: 0, stroke: 0.7 });
  // Lit left facet.
  flat(ctx, polyP(ctx, [[x - w / 2, gy], [x - w / 2 + lean * 0.7, gy - h * 0.72], [tipX, tipY], [x - w * 0.05 + lean * 0.6, gy - h * 0.65], [x - w * 0.08, gy]]), t.light);
  // Specular streak.
  line(ctx, [[x - w * 0.28 + lean * 0.1, gy - h * 0.15], [x - w * 0.22 + lean * 0.55, gy - h * 0.6]], 'rgba(255,255,255,0.75)', Math.max(0.6, w * 0.08));
}

export function rgbaHex(c: number, a: number): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}
