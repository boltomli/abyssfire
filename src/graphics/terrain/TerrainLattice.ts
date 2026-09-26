/**
 * Lattice math shared by the terrain painters.
 *
 * Ground tiles are painted as windows onto one continuous, *periodic* world:
 * every ground feature lives in lattice space (u = col, v = row) inside a
 * PERIOD×PERIOD fundamental domain and is repeated with that period. A tile at
 * (col, row) samples the window centred on (col % PERIOD, row % PERIOD), so
 * neighbouring tiles always agree along their shared edges — no diamond seams —
 * and the pattern only repeats every PERIOD tiles.
 */
import { TEXTURE_SCALE } from '../../config';

export const PERIOD = 3;
/**
 * Ground texel density (texels per world px). Ground is the lowest-detail
 * layer, so it is painted at 2× (vs TEXTURE_SCALE for characters/props) to
 * halve generation and upload cost; tiles are displayed at scale 1 / S.
 */
export const S = 2;
/** Overlay (wall / palisade) texel density — same as other props. */
export const PROP_S = TEXTURE_SCALE;
/** Texture margin (px) around the 64×32 diamond so neighbouring tiles overlap. */
export const MARGIN = 3;
export const TEX_W = 64 * S + MARGIN * 2;
export const TEX_H = 32 * S + MARGIN * 2;
export const CX = TEX_W / 2;
export const CY = TEX_H / 2;

/** Lattice offset (du, dv) from the tile centre → texture px. */
export function latToPx(du: number, dv: number): [number, number] {
  return [CX + (du - dv) * 32 * S, CY + (du + dv) * 16 * S];
}

/** Texture px → lattice offset from the tile centre. */
export function pxToLat(px: number, py: number): [number, number] {
  const a = (px - CX) / (32 * S);
  const b = (py - CY) / (16 * S);
  return [(a + b) / 2, (b - a) / 2];
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Integer hash of a tile position (stable variant picking). */
export function tileHash(col: number, row: number, salt = 0): number {
  let h = (Math.imul(col, 374761393) + Math.imul(row, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** A feature placed in the periodic lattice domain. */
export interface LatFeature {
  u: number;
  v: number;
  /** Reach in lattice units (used to cull images that cannot touch the tile). */
  r: number;
  seed: number;
}

/**
 * Invoke `fn` for every periodic image of every feature that can touch the
 * tile of class (a, b). Coordinates are texture px. Order is stable, so
 * overlapping features stack identically on every tile.
 */
export function eachImage<F extends LatFeature>(
  feats: readonly F[], a: number, b: number,
  fn: (x: number, y: number, f: F) => void,
): void {
  for (const f of feats) {
    for (let k = -1; k <= 1; k++) {
      const du = f.u + k * PERIOD - a;
      if (Math.abs(du) - f.r > 0.62) continue;
      for (let m = -1; m <= 1; m++) {
        const dv = f.v + m * PERIOD - b;
        if (Math.abs(dv) - f.r > 0.62) continue;
        const [x, y] = latToPx(du, dv);
        fn(x, y, f);
      }
    }
  }
}

// ── Periodic noise (for wobbly terrain boundaries) ─────────────────────

const NOISE_RES = 40; // samples per lattice unit
const noiseTables = new Map<number, Float32Array>();

function buildNoise(period: number): Float32Array {
  const N = NOISE_RES * period;
  const t = new Float32Array(N * N);
  // Integer frequencies over the period keep the field exactly periodic.
  const waves: [number, number, number, number][] = [];
  const r = rng(9173 + period);
  const freqs: [number, number][] = period === 3
    ? [[1, 2], [2, -1], [3, 1], [-1, 3], [4, 2], [2, 5], [5, -3], [-4, 5], [7, 2], [3, 7], [8, -5], [-6, 8]]
    : [[1, 1], [1, -1], [2, 1], [-1, 2], [3, 1], [1, 3], [3, -2], [-2, 3], [5, 1], [2, 5], [5, -4], [-4, 5]];
  for (const [k, l] of freqs) {
    const mag = Math.hypot(k, l);
    waves.push([k, l, 1 / Math.pow(mag, 0.9), r() * Math.PI * 2]);
  }
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = i / NOISE_RES, v = j / NOISE_RES;
      let s = 0;
      for (const [k, l, amp, ph] of waves) s += amp * Math.sin((2 * Math.PI * (k * u + l * v)) / period + ph);
      t[j * N + i] = s;
      if (s < min) min = s;
      if (s > max) max = s;
    }
  }
  for (let i = 0; i < t.length; i++) t[i] = ((t[i] - min) / (max - min)) * 2 - 1;
  return t;
}

/** Smooth noise in [-1, 1] at lattice position (u, v), periodic with `period` tiles. */
export function latNoise(u: number, v: number, period = PERIOD): number {
  let table = noiseTables.get(period);
  if (!table) { table = buildNoise(period); noiseTables.set(period, table); }
  const N = NOISE_RES * period;
  const x = mod(u * NOISE_RES, N);
  const y = mod(v * NOISE_RES, N);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
  const a = table[y0 * N + x0], b = table[y0 * N + x1];
  const c = table[y1 * N + x0], d = table[y1 * N + x1];
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

// ── Colour helpers ──────────────────────────────────────────────────────

export function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

export function css(c: number, a = 1): string {
  const [r, g, b] = rgb(c);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

export function mixC(c1: number, c2: number, t: number): number {
  const [r1, g1, b1] = rgb(c1);
  const [r2, g2, b2] = rgb(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

/** Diamond mask (expanded by `grow` px) applied with destination-in. */
export function maskDiamond(ctx: CanvasRenderingContext2D, grow = MARGIN): void {
  const hw = 32 * S + grow * 2, hh = 16 * S + grow;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.moveTo(CX, CY - hh);
  ctx.lineTo(CX + hw, CY);
  ctx.lineTo(CX, CY + hh);
  ctx.lineTo(CX - hw, CY);
  ctx.closePath();
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas2D unavailable');
  return [c, ctx];
}
