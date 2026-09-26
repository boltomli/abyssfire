/**
 * Zone terrain runtime: builds the zone-themed ground / wall textures on zone
 * entry, picks the texture for each tile, generates seamless transition tiles
 * lazily, and manages the depth-sorted wall / palisade overlays.
 */
import Phaser from 'phaser';
import type { MapData, MapTheme } from '../../data/types';
import {
  PERIOD, S, TEX_H, TEX_W, latNoise, makeCanvas, maskDiamond, mixC, mod, pxToLat, tileHash,
} from './TerrainLattice';
import { paintGroundBase, paintGroundDetails } from './GroundPainter';
import {
  OUT_H, OUT_W, OUTCROP_ORIGIN_Y, OUTCROP_VARIANTS, paintOutcrop, paintPalisade,
} from './OutcropPainter';
import { groundStyle, terrainTheme } from './TerrainStyles';
import type { GroundStyle, TerrainTheme } from './TerrainStyles';
import { TEXTURE_SCALE } from '../../config';

const T_WALL = 4;
const T_CAMP = 5;
const T_CAMP_WALL = 6;
const GROUND_VARIANTS = 4;
/** Period (tiles) of the transition-boundary noise; masks are shared per mask class. */
const MASK_PERIOD = 3;
const LEGACY_NAMES = ['grass', 'dirt', 'stone', 'water', 'wall', 'camp', 'camp_wall'];

/** Depth offset for overlays: sorts with monsters (+50) by world y. */
export const OVERLAY_DEPTH_OFFSET = 55;

/**
 * Packed blend mask for one quadrant: only texels that differ from the plain
 * centre ground are stored, with 8-bit weights, to keep the cache small.
 */
interface QuadMask {
  /** Index into the quadrant texel list. */
  p: Uint16Array;
  t1: Uint8Array; t2: Uint8Array;
  /** Blend of t1 over t2, shallow-water tint, lava glow, overlay tint strength (0-255). */
  al: Uint8Array; sh: Uint8Array; gk: Uint8Array; tk: Uint8Array;
  /** Index into `tints` (255 = none). */
  ti: Uint8Array;
  tints: number[];
}

const THEME_SEED: Record<MapTheme, number> = { plains: 101, forest: 202, mountain: 303, desert: 404, abyss: 505 };

export class ZoneTerrain {
  static lastBuildMs = 0;
  /** Dev stats: transition tiles generated and time spent (ms) since zone entry. */
  static transitionStats = { count: 0, ms: 0 };

  readonly theme: MapTheme;
  private readonly scene: Phaser.Scene;
  private readonly map: MapData;
  private readonly style: TerrainTheme;
  private readonly seed: number;
  private readonly wallGround: number;
  private readonly baseData = new Map<string, Uint8ClampedArray>();
  private readonly overlays = new Map<number, Phaser.GameObjects.Image>();
  private readonly overlayPool: Phaser.GameObjects.Image[] = [];
  private readonly legacyTypes = new Set<number>();
  /** Transition tiles waiting to be generated (time-sliced), keyed by texture key. */
  private readonly pending = new Map<string, { center: number; n9: number[]; a: number; b: number; a2: number; b2: number; cells: Set<number> }>();
  private deadline = Infinity;
  private focusCol = 0;
  private focusRow = 0;

  constructor(scene: Phaser.Scene, map: MapData) {
    const t0 = performance.now();
    this.scene = scene;
    this.map = map;
    this.theme = map.theme ?? 'plains';
    this.style = terrainTheme(this.theme);
    this.seed = THEME_SEED[this.theme] ?? 101;
    this.wallGround = this.dominantGround();
    ZoneTerrain.releaseOtherThemes(scene, this.theme);
    this.buildGround();
    this.buildOutcrops();
    ZoneTerrain.lastBuildMs = performance.now() - t0;
    ZoneTerrain.transitionStats = { count: 0, ms: 0 };
  }

  // ── Setup ──────────────────────────────────────────────────────────────

  private dominantGround(): number {
    const counts = new Map<number, number>();
    for (const row of this.map.tiles) {
      for (const t of row) {
        if (t === T_WALL || t === T_CAMP || t === T_CAMP_WALL || t === 3) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    let best = 0, n = -1;
    for (const [t, c] of counts) if (c > n) { best = t; n = c; }
    return best;
  }

  /** Ground material shown on a tile (walls stand on the zone's dominant ground). */
  private ground(t: number): number {
    if (t === T_WALL) return this.wallGround;
    if (t === T_CAMP_WALL) return T_CAMP;
    return t;
  }

  static releaseOtherThemes(scene: Phaser.Scene, keep: MapTheme): void {
    for (const key of scene.textures.getTextureKeys()) {
      if (key.startsWith('terr_') && !key.startsWith(`terr_${keep}_`)) scene.textures.remove(key);
    }
  }

  private isExternal(key: string): boolean {
    if (!this.scene.textures.exists(key)) return false;
    return this.scene.textures.get(key).source[0]?.source instanceof HTMLImageElement;
  }

  private groundTexKey(t: number, a: number, b: number, v: number): string {
    return `terr_${this.theme}_g${t}_${a}${b}_${v}`;
  }

  private buildGround(): void {
    const used = new Set<number>();
    for (const row of this.map.tiles) for (const t of row) used.add(this.ground(t));
    for (const t of used) {
      if (this.isExternal(`tile_${LEGACY_NAMES[t]}_0`)) { this.legacyTypes.add(t); continue; }
      const style = groundStyle(this.style, t);
      const seed = this.seed * 17 + t * 1231;
      for (let a = 0; a < PERIOD; a++) {
        for (let b = 0; b < PERIOD; b++) {
          if (this.scene.textures.exists(this.groundTexKey(t, a, b, GROUND_VARIANTS - 1))) continue;
          const [base, bctx] = makeCanvas(TEX_W, TEX_H);
          paintGroundBase(bctx, style, a, b, seed);
          for (let v = GROUND_VARIANTS - 1; v >= 0; v--) {
            const key = this.groundTexKey(t, a, b, v);
            if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
            let canvas = base;
            if (v > 0) {
              const [c, ctx] = makeCanvas(TEX_W, TEX_H);
              ctx.drawImage(base, 0, 0);
              paintGroundDetails(ctx, style, a, b, v, seed);
              canvas = c;
            }
            maskDiamond(canvas.getContext('2d')!);
            this.scene.textures.addCanvas(key, canvas);
          }
        }
      }
    }
  }

  private buildOutcrops(): void {
    let hasWall = false;
    for (const row of this.map.tiles) { if (row.includes(T_WALL)) { hasWall = true; break; } }
    if (!hasWall || this.isExternal('tile_wall')) return;
    for (let v = 0; v < OUTCROP_VARIANTS; v++) {
      const key = `terr_${this.theme}_wall_${v}`;
      if (this.scene.textures.exists(key)) continue;
      const [canvas, ctx] = makeCanvas(OUT_W, OUT_H);
      paintOutcrop(ctx, this.style, v, this.seed);
      this.scene.textures.addCanvas(key, canvas);
    }
  }

  private palisadeKey(mask: number): string {
    const key = `terr_${this.theme}_cwall_${mask}`;
    if (!this.scene.textures.exists(key)) {
      const [canvas, ctx] = makeCanvas(OUT_W, OUT_H);
      paintPalisade(ctx, this.style, mask, this.seed);
      this.scene.textures.addCanvas(key, canvas);
    }
    return key;
  }

  // ── Tile selection ────────────────────────────────────────────────────

  /** Display scale for a ground texture key returned by `groundKey`. */
  tileScale(key: string): number {
    return key.startsWith('terr_') || key.startsWith('tile_t_') ? 1 / S : 1 / TEXTURE_SCALE;
  }

  private typeAt(col: number, row: number, fallback: number): number {
    const tiles = this.map.tiles;
    if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[row].length) return fallback;
    return this.ground(tiles[row][col]);
  }

  /** Ground texture key for the tile at (col, row). */
  groundKey(col: number, row: number): string {
    const center = this.ground(this.map.tiles[row][col]);
    if (this.legacyTypes.has(center)) {
      const k = `tile_${LEGACY_NAMES[center]}_${tileHash(col, row) % 3}`;
      return this.scene.textures.exists(k) ? k : `tile_${LEGACY_NAMES[center]}`;
    }
    const n9: number[] = [];
    let mixed = false;
    for (let dv = -1; dv <= 1; dv++) {
      for (let du = -1; du <= 1; du++) {
        const t = this.typeAt(col + du, row + dv, center);
        n9.push(t);
        if (t !== center && !this.legacyTypes.has(t)) mixed = true;
      }
    }
    const a = mod(col, PERIOD), b = mod(row, PERIOD);
    if (mixed) {
      const a2 = mod(col, MASK_PERIOD), b2 = mod(row, MASK_PERIOD);
      const key = this.transitionName(n9, a, b, a2, b2);
      if (this.scene.textures.exists(key)) return key;
      // Tiles on screen are built now; the off-screen margin is time-sliced.
      const dc = col - this.focusCol, dr = row - this.focusRow;
      const onScreen = Math.abs(dc - dr) <= 12 && Math.abs(dc + dr) <= 14;
      if (onScreen || performance.now() < this.deadline) return this.transitionKey(center, n9, a, b, a2, b2);
      let job = this.pending.get(key);
      if (!job) { job = { center, n9, a, b, a2, b2, cells: new Set() }; this.pending.set(key, job); }
      job.cells.add(row * this.map.cols + col);
      return this.groundTexKey(center, a, b, 0);
    }
    const h = tileHash(col, row, 7) % 12;
    const v = h < 6 ? 0 : 1 + (h % 3);
    return this.groundTexKey(center, a, b, v);
  }

  private base(t: number, a: number, b: number): Uint8ClampedArray {
    const key = this.groundTexKey(t, a, b, 0);
    let data = this.baseData.get(key);
    if (!data) {
      const src = this.scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
      const ctx = src.getContext('2d', { willReadFrequently: true });
      data = ctx ? ctx.getImageData(0, 0, TEX_W, TEX_H).data : new Uint8ClampedArray(TEX_W * TEX_H * 4);
      this.baseData.set(key, data);
    }
    return data;
  }

  /** Lattice offset of every texel (shared by all transition tiles). */
  private static latU: Float32Array | null = null;
  private static latV: Float32Array | null = null;
  private static inside: Uint8Array | null = null;

  private static lattice(): void {
    if (ZoneTerrain.latU) return;
    const n = TEX_W * TEX_H;
    const U = new Float32Array(n), V = new Float32Array(n), I = new Uint8Array(n);
    for (let py = 0; py < TEX_H; py++) {
      for (let px = 0; px < TEX_W; px++) {
        const [du, dv] = pxToLat(px + 0.5, py + 0.5);
        const i = py * TEX_W + px;
        U[i] = du; V[i] = dv;
        I[i] = Math.abs(du) <= 0.56 && Math.abs(dv) <= 0.56 ? 1 : 0;
      }
    }
    ZoneTerrain.latU = U; ZoneTerrain.latV = V; ZoneTerrain.inside = I;
    const lists: number[][] = [[], [], [], []];
    for (let i = 0; i < n; i++) {
      if (!I[i]) continue;
      lists[(V[i] < 0 ? 0 : 2) + (U[i] < 0 ? 0 : 1)].push(i);
    }
    ZoneTerrain.quadIdx = lists.map(l => Int32Array.from(l));
  }

  /** Texel indices of each quadrant (0: u<0,v<0  1: u>=0,v<0  2: u<0,v>=0  3: u>=0,v>=0). */
  private static quadIdx: Int32Array[] = [];

  private readonly noiseCache = new Map<number, Float32Array>();

  /** Boundary noise for terrain type t at every texel of mask class (a2, b2). */
  private noiseFor(t: number, a2: number, b2: number): Float32Array {
    const id = (t * MASK_PERIOD + a2) * MASK_PERIOD + b2;
    let arr = this.noiseCache.get(id);
    if (!arr) {
      ZoneTerrain.lattice();
      const U = ZoneTerrain.latU!, V = ZoneTerrain.latV!, I = ZoneTerrain.inside!;
      arr = new Float32Array(U.length);
      const ou = a2 + t * 0.37, ov = b2 - t * 0.61;
      for (let i = 0; i < U.length; i++) if (I[i]) arr[i] = latNoise(U[i] + ou, V[i] + ov, MASK_PERIOD);
      this.noiseCache.set(id, arr);
    }
    return arr;
  }

  private transitionName(n9: number[], a: number, b: number, a2: number, b2: number): string {
    return MASK_PERIOD === PERIOD
      ? `tile_t_${this.theme}_${a}${b}_${n9.join('')}`
      : `tile_t_${this.theme}_${a}${b}${a2}${b2}_${n9.join('')}`;
  }

  /**
   * Start a tile-selection pass: tiles near (col, row) — the visible screen —
   * are generated synchronously; others only while `budgetMs` lasts.
   */
  beginPass(col: number, row: number, budgetMs: number): void {
    this.focusCol = col;
    this.focusRow = row;
    this.deadline = performance.now() + budgetMs;
  }

  hasPending(): boolean {
    return this.pending.size > 0;
  }

  /** Generate queued transition tiles for up to `budgetMs`, handing each finished tile to `apply`. */
  flush(
    budgetMs: number,
    wanted: (col: number, row: number) => boolean,
    apply: (col: number, row: number, key: string) => void,
  ): void {
    const end = performance.now() + budgetMs;
    const cols = this.map.cols;
    for (const [key, job] of this.pending) {
      if (performance.now() > end) break;
      this.pending.delete(key);
      const cells = [...job.cells].filter(idx => wanted(idx % cols, Math.floor(idx / cols)));
      if (cells.length === 0) continue; // scrolled away before we got to it
      this.transitionKey(job.center, job.n9, job.a, job.b, job.a2, job.b2);
      for (const idx of cells) apply(idx % cols, Math.floor(idx / cols), key);
    }
  }

  /** Cached quadrant blend masks keyed by mask class, quadrant and its 4 corner types. */
  private readonly quadCache = new Map<string, QuadMask>();

  /**
   * Blend mask for one quadrant (the area between four tile centres that falls
   * inside this tile). It depends only on the mask class, the quadrant and its
   * four corner types, so it is shared by every tile with that pattern; colours
   * are sampled from the (world-continuous) ground textures at assembly.
   */
  private quadMask(a2: number, b2: number, q: number, corners: number[]): QuadMask {
    const key = `${a2}${b2}${q}${corners.join('')}`;
    const hit = this.quadCache.get(key);
    if (hit) return hit;
    const U = ZoneTerrain.latU!, V = ZoneTerrain.latV!;
    const idx = ZoneTerrain.quadIdx[q];
    const n = idx.length;
    const qu = q & 1 ? 0 : -1, qv = q & 2 ? 0 : -1;
    // The centre tile is the corner opposite this quadrant.
    const center = corners[3 - q];
    const noiseOf: (Float32Array | null)[] = [null, null, null, null, null, null, null, null];
    const biasOf = [0, 0, 0, 0, 0, 0, 0, 0];
    const styleOf: (GroundStyle | null)[] = [null, null, null, null, null, null, null, null];
    for (const t of new Set(corners)) {
      const st = groundStyle(this.style, t);
      noiseOf[t] = this.noiseFor(t, a2, b2);
      biasOf[t] = st.rank * 0.025;
      styleOf[t] = st;
    }
    const P: number[] = [], T1: number[] = [], T2: number[] = [], AL: number[] = [];
    const SH: number[] = [], GK: number[] = [], TK: number[] = [], TI: number[] = [];
    const tints: number[] = [];
    const tintIndex = (c: number): number => {
      let i = tints.indexOf(c);
      if (i < 0) { tints.push(c); i = tints.length - 1; }
      return i;
    };
    const fT = [0, 0, 0, 0];
    const tT = [0, 0, 0, 0];
    const NOISE = 0.3;
    for (let p = 0; p < n; p++) {
      const i = idx[p];
      const fu = U[i] - qu, fv = V[i] - qv;
      let cnt = 0, sumK = 0;
      for (let k = 0; k < 4; k++) {
        const ddu = k & 1 ? 1 - fu : fu, ddv = k & 2 ? 1 - fv : fv;
        const d2 = ddu * ddu + ddv * ddv;
        if (d2 >= 1) continue;
        const w = (1 - d2) * (1 - d2);
        const t = corners[k];
        sumK += w;
        let j = 0;
        while (j < cnt && tT[j] !== t) j++;
        if (j === cnt) { tT[cnt] = t; fT[cnt] = 0; cnt++; }
        fT[j] += w;
      }
      if (cnt < 2) {
        if (tT[0] === center) continue;
        P.push(p); T1.push(tT[0]); T2.push(tT[0]); AL.push(255); SH.push(0); GK.push(0); TK.push(0); TI.push(255);
        continue;
      }
      let b1 = 0, s1 = -Infinity, b2 = 0, s2 = -Infinity;
      for (let j = 0; j < cnt; j++) {
        const t = tT[j];
        const f = fT[j] / sumK;
        fT[j] = f;
        const sc = f + biasOf[t] + NOISE * noiseOf[t]![i];
        if (sc > s1) { s2 = s1; b2 = b1; s1 = sc; b1 = j; } else if (sc > s2) { s2 = sc; b2 = j; }
      }
      const t1 = tT[b1], t2 = tT[b2];
      const d = s1 - s2;
      const al = d >= 0.025 ? 1 : 0.5 + d / 0.05;
      let sh = 0, gk = 0, tk = 0, tint = -1;
      const st1 = styleOf[t1]!, st2 = styleOf[t2]!;
      if (st1.liquid) {
        sh = (1 - smooth(0.5, 0.95, fT[b1])) * 0.75;
        if (d < 0.065) { tint = st1.liquid.foam; tk = Math.pow(1 - d / 0.065, 0.6) * 0.92; }
      } else if (st2.liquid) {
        if (d < 0.045) { tint = st2.liquid.bank; tk = 0.7 * (1 - d / 0.045); }
        else if (st2.liquid.glow && d < 0.16) gk = 1 - (d - 0.045) / 0.115;
        else if (d < 0.1) { tint = st2.liquid.bank; tk = 0.25 * (1 - (d - 0.045) / 0.055); }
      } else if (st1.rank > st2.rank) {
        if (d < 0.032) { tint = st1.lip ?? mixC(st1.base, 0xfff2d6, 0.25); tk = 0.75; }
      } else if (st1.rank < st2.rank) {
        if (d < 0.055) { tint = 0x241a3a; tk = 0.2 * (1 - d / 0.055); }
      }
      const alB = Math.round(al * 255), shB = Math.round(sh * 255), gkB = Math.round(gk * 255), tkB = Math.round(tk * 255);
      if (t1 === center && alB >= 255 && shB === 0 && gkB === 0 && (tint < 0 || tkB === 0)) continue;
      P.push(p); T1.push(t1); T2.push(t2); AL.push(alB); SH.push(shB); GK.push(gkB); TK.push(tkB);
      TI.push(tint >= 0 && tkB > 0 ? tintIndex(tint) : 255);
    }
    const m: QuadMask = {
      p: Uint16Array.from(P), t1: Uint8Array.from(T1), t2: Uint8Array.from(T2), al: Uint8Array.from(AL),
      sh: Uint8Array.from(SH), gk: Uint8Array.from(GK), tk: Uint8Array.from(TK), ti: Uint8Array.from(TI), tints,
    };
    this.quadCache.set(key, m);
    return m;
  }

  /** Reused pixel buffer for assembling transition tiles. */
  private scratch: ImageData | null = null;

  private transitionKey(center: number, n9: number[], a: number, b: number, a2: number, b2: number): string {
    const key = this.transitionName(n9, a, b, a2, b2);
    if (this.scene.textures.exists(key)) return key;
    const tStart = performance.now();
    ZoneTerrain.lattice();

    const [canvas, ctx] = makeCanvas(TEX_W, TEX_H);
    if (!this.scratch) this.scratch = ctx.createImageData(TEX_W, TEX_H);
    const img = this.scratch;
    const out = img.data;
    out.set(this.base(center, a, b));
    const dataOf: (Uint8ClampedArray | null)[] = [null, null, null, null, null, null, null, null];
    const liquidOf: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const t of new Set(n9)) {
      dataOf[t] = this.base(t, a, b);
      const liq = groundStyle(this.style, t).liquid;
      if (liq) liquidOf[t] = liq.shallow;
    }
    for (let q = 0; q < 4; q++) {
      const qu = q & 1 ? 0 : -1, qv = q & 2 ? 0 : -1;
      const corners: number[] = [];
      let mixed = false;
      for (let k = 0; k < 4; k++) {
        const t = n9[(qv + (k >> 1) + 1) * 3 + (qu + (k & 1) + 1)];
        corners.push(t);
        if (t !== center) mixed = true;
      }
      if (!mixed) continue;
      const m = this.quadMask(a2, b2, q, corners);
      const idx = ZoneTerrain.quadIdx[q];
      for (let e = 0; e < m.p.length; e++) {
        const o = idx[m.p[e]] * 4;
        const c1 = dataOf[m.t1[e]]!, c2 = dataOf[m.t2[e]]!;
        const al = m.al[e] / 255;
        let r: number, g: number, bl: number;
        if (al >= 1) { r = c1[o]; g = c1[o + 1]; bl = c1[o + 2]; }
        else {
          r = c1[o] * al + c2[o] * (1 - al);
          g = c1[o + 1] * al + c2[o + 1] * (1 - al);
          bl = c1[o + 2] * al + c2[o + 2] * (1 - al);
        }
        const sh = m.sh[e];
        if (sh > 0) {
          const c = liquidOf[m.t1[e]], k = sh / 255;
          r += (((c >> 16) & 255) - r) * k; g += (((c >> 8) & 255) - g) * k; bl += ((c & 255) - bl) * k;
        }
        const gk = m.gk[e];
        if (gk > 0) {
          const c = liquidOf[m.t2[e]], k = gk / 255;
          r += ((c >> 16) & 255) * 0.35 * k; g += ((c >> 8) & 255) * 0.2 * k; bl += (c & 255) * 0.1 * k;
        }
        const ti = m.ti[e];
        if (ti !== 255) {
          const c = m.tints[ti], k = m.tk[e] / 255;
          r += (((c >> 16) & 255) - r) * k; g += (((c >> 8) & 255) - g) * k; bl += ((c & 255) - bl) * k;
        }
        out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    maskDiamond(ctx);
    this.scene.textures.addCanvas(key, canvas);
    ZoneTerrain.transitionStats.count++;
    ZoneTerrain.transitionStats.ms += performance.now() - tStart;
    return key;
  }

  // ── Overlays (walls / palisades) ──────────────────────────────────────

  /** Create the wall / palisade overlay for a tile if it has one. */
  showOverlay(col: number, row: number, x: number, y: number): void {
    const idx = row * this.map.cols + col;
    if (this.overlays.has(idx)) return;
    const t = this.map.tiles[row][col];
    let key: string | null = null;
    if (t === T_WALL) {
      if (this.isExternal('tile_wall')) return;
      key = `terr_${this.theme}_wall_${tileHash(col, row, 3) % OUTCROP_VARIANTS}`;
    } else if (t === T_CAMP_WALL) {
      const tiles = this.map.tiles;
      const is = (c: number, r: number): boolean => tiles[r]?.[c] === T_CAMP_WALL;
      const mask = (is(col + 1, row) ? 1 : 0) | (is(col - 1, row) ? 2 : 0) | (is(col, row + 1) ? 4 : 0) | (is(col, row - 1) ? 8 : 0);
      key = this.palisadeKey(mask);
    }
    if (!key || !this.scene.textures.exists(key)) return;
    let img = this.overlayPool.pop();
    if (img) img.setTexture(key).setPosition(x, y).setVisible(true).setActive(true).setAlpha(1);
    else img = this.scene.add.image(x, y, key);
    img.setOrigin(0.5, OUTCROP_ORIGIN_Y).setScale(1 / TEXTURE_SCALE).setDepth(y + OVERLAY_DEPTH_OFFSET);
    this.overlays.set(idx, img);
  }

  hideOverlay(col: number, row: number): void {
    const idx = row * this.map.cols + col;
    const img = this.overlays.get(idx);
    if (!img) return;
    img.setVisible(false).setActive(false);
    this.overlayPool.push(img);
    this.overlays.delete(idx);
  }

  /** Fade overlays that hide the player standing behind them. */
  /** Fade wall overlays hiding any of `points` (flat x,y pairs: player, nearby monsters). */
  updateOcclusion(points: readonly number[], delta: number): void {
    const k = Math.min(1, delta / 110);
    for (const img of this.overlays.values()) {
      let target = 1;
      for (let i = 0; i < points.length; i += 2) {
        const px = points[i], py = points[i + 1];
        if (Math.abs(img.x - px) < 34 && py < img.y - 30 && py > img.y - 110) { target = 0.45; break; }
      }
      if (img.alpha !== target) {
        const a = img.alpha + (target - img.alpha) * k;
        img.setAlpha(Math.abs(a - target) < 0.02 ? target : a);
      }
    }
  }

  destroy(): void {
    this.pending.clear();
    for (const img of this.overlays.values()) img.destroy();
    for (const img of this.overlayPool) img.destroy();
    this.overlays.clear();
    this.overlayPool.length = 0;
    this.baseData.clear();
    this.noiseCache.clear();
    this.quadCache.clear();
    this.scratch = null;
  }
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
