/**
 * Paints seamless, cel-styled ground tiles.
 *
 * Every tile of a material is a window onto the same periodic world (see
 * TerrainLattice), so the edges of any two tiles of that material always
 * match. Interior-only "details" add per-variant variety without touching
 * the diamond border.
 */
import {
  PERIOD, S, TEX_H, TEX_W, css, eachImage, latToPx, mixC, pxToLat, rgb, rng,
} from './TerrainLattice';
import type { LatFeature } from './TerrainLattice';
import type { DetailKind, GroundLayer, GroundStyle } from './TerrainStyles';

interface Feat extends LatFeature {
  rand: number[];
  layer: GroundLayer;
}

interface SlabSeed { u: number; v: number; id: number; tone: number }

const featCache = new WeakMap<GroundLayer, Feat[]>();
const slabCache = new WeakMap<GroundLayer, SlabSeed[]>();

function layerReach(layer: GroundLayer): number {
  switch (layer.kind) {
    case 'patch': return (layer.r[1] * 1.3) / 16;
    case 'snow': return (layer.r[1] * 1.4) / 16;
    case 'crack': return (layer.len[1] * 3.2) / 16;
    case 'ripple': return (layer.len[1] * 0.7) / 16;
    case 'wave': return (layer.len[1] * 0.7) / 16;
    case 'speck': return layer.size[1] * 5 / 16;
    default: return 8 / 16;
  }
}

function featuresFor(layer: GroundLayer, seed: number): Feat[] {
  const cached = featCache.get(layer);
  if (cached) return cached;
  const r = rng(seed);
  const count = 'count' in layer ? Math.round(layer.count * PERIOD * PERIOD) : 0;
  const feats: Feat[] = [];
  // Stratified placement keeps coverage even (no clumps / bald spots).
  const grid = Math.max(1, Math.ceil(Math.sqrt(count)));
  const cell = PERIOD / grid;
  const order: number[] = [];
  for (let i = 0; i < grid * grid; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < count; i++) {
    const g = order[i % order.length];
    const gx = g % grid, gy = Math.floor(g / grid);
    feats.push({
      u: (gx + r()) * cell,
      v: (gy + r()) * cell,
      r: layerReach(layer),
      seed: Math.floor(r() * 1e9),
      rand: Array.from({ length: 12 }, () => r()),
      layer,
    });
  }
  featCache.set(layer, feats);
  return feats;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Wobbly iso-flattened blob path (world radius r, texture px). */
function blobAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rand: number[], squash = 0.5): void {
  const n = 8;
  const pts: [number, number][] = [];
  const rot = rand[0] * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const ang = rot + (i / n) * Math.PI * 2;
    const rr = r * S * (0.72 + rand[(i + 1) % rand.length] * 0.5);
    pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * squash]);
  }
  const mid = (i: number): [number, number] => {
    const p = pts[i % n], q = pts[(i + 1) % n];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

function drawTuft(
  ctx: CanvasRenderingContext2D, x: number, y: number, h: number,
  color: number, light: number, blades: number, rand: number[],
): void {
  const hp = h * S;
  // soft contact shade
  ctx.fillStyle = css(color, 0.35);
  ctx.beginPath();
  ctx.ellipse(x, y + 0.6 * S, hp * 0.42, hp * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < blades; i++) {
    const t = blades === 1 ? 0 : i / (blades - 1) - 0.5;
    const bx = x + t * hp * 0.5;
    const lean = (t * 0.9 + (rand[i % rand.length] - 0.5) * 0.5) * hp;
    const bh = hp * (0.7 + rand[(i + 3) % rand.length] * 0.45) * (1 - Math.abs(t) * 0.35);
    const w = 0.55 * S;
    const tipX = bx + lean * 0.55, tipY = y - bh;
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.moveTo(bx - w, y);
    ctx.quadraticCurveTo(bx - w * 0.4 + lean * 0.12, y - bh * 0.55, tipX, tipY);
    ctx.quadraticCurveTo(bx + w * 0.6 + lean * 0.2, y - bh * 0.5, bx + w, y);
    ctx.closePath();
    ctx.fill();
    if (rand[(i + 6) % rand.length] > 0.35) {
      ctx.strokeStyle = css(light, 0.9);
      ctx.lineWidth = 0.4 * S;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lerp(bx, tipX, 0.55) - w * 0.3, lerp(y, tipY, 0.55));
      ctx.quadraticCurveTo(lerp(bx, tipX, 0.8) - w * 0.2, lerp(y, tipY, 0.82), tipX, tipY);
      ctx.stroke();
    }
  }
}

function drawPebble(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number,
  color: number, shade: number, light: number, rot: number,
): void {
  const rx = size * S, ry = rx * 0.62;
  ctx.fillStyle = css(shade);
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.18, y + ry * 0.3, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.92, ry * 0.88, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(light);
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.28, y - ry * 0.32, rx * 0.42, ry * 0.36, rot, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: number, alpha: number): void {
  const [cr, cg, cb] = rgb(color);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
  g.addColorStop(0.45, `rgba(${cr},${cg},${cb},${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function crackPath(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rand: number[], segs = 3, wander = 1.6): void {
  let cx = x, cy = y;
  let ang = rand[0] * Math.PI * 2;
  ctx.moveTo(cx, cy);
  for (let j = 0; j < segs; j++) {
    ang += (rand[(j + 1) % rand.length] - 0.5) * wander;
    const l = len * S * (0.5 + rand[(j + 4) % rand.length] * 0.6) / segs * 1.4;
    cx += Math.cos(ang) * l;
    cy += Math.sin(ang) * l * 0.55;
    ctx.lineTo(cx, cy);
  }
}

function paintLayer(ctx: CanvasRenderingContext2D, layer: GroundLayer, feats: Feat[], a: number, b: number): void {
  switch (layer.kind) {
    case 'patch':
      eachImage(feats, a, b, (x, y, f) => {
        const color = layer.colors[Math.floor(f.rand[11] * layer.colors.length)];
        ctx.fillStyle = css(color, layer.alpha ?? 1);
        ctx.beginPath();
        blobAt(ctx, x, y, lerp(layer.r[0], layer.r[1], f.rand[10]), f.rand);
        ctx.fill();
      });
      break;
    case 'snow':
      eachImage(feats, a, b, (x, y, f) => {
        const r = lerp(layer.r[0], layer.r[1], f.rand[10]);
        ctx.fillStyle = css(layer.shade);
        ctx.beginPath();
        blobAt(ctx, x + 0.6 * S, y + 0.7 * S, r, f.rand);
        ctx.fill();
        ctx.fillStyle = css(layer.color);
        ctx.beginPath();
        blobAt(ctx, x, y, r * 0.95, f.rand);
        ctx.fill();
      });
      break;
    case 'tuft':
      eachImage(feats, a, b, (x, y, f) => {
        drawTuft(ctx, x, y, lerp(layer.size[0], layer.size[1], f.rand[10]), layer.color, layer.light, layer.blades ?? 3, f.rand);
      });
      break;
    case 'pebble':
      eachImage(feats, a, b, (x, y, f) => {
        drawPebble(ctx, x, y, lerp(layer.size[0], layer.size[1], f.rand[10]), layer.color, layer.shade, layer.light, (f.rand[9] - 0.5) * 0.8);
      });
      break;
    case 'crack':
      eachImage(feats, a, b, (x, y, f) => {
        const len = lerp(layer.len[0], layer.len[1], f.rand[10]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (layer.glow !== undefined) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (const [wm, al] of [[7, 0.12], [4, 0.2]] as const) {
            ctx.strokeStyle = css(layer.glow, al);
            ctx.lineWidth = (layer.width ?? 2) * wm;
            ctx.beginPath();
            crackPath(ctx, x, y, len, f.rand, 5, 0.9);
            ctx.stroke();
          }
          ctx.restore();
        }
        if (layer.light !== undefined) {
          ctx.strokeStyle = css(layer.light, 0.8);
          ctx.lineWidth = (layer.width ?? 2) * 0.8;
          ctx.beginPath();
          ctx.save();
          ctx.translate(0.8, 1.2);
          crackPath(ctx, x, y, len, f.rand);
          ctx.restore();
          ctx.stroke();
        }
        const segs = layer.glow !== undefined ? 5 : 3;
        const wander = layer.glow !== undefined ? 0.9 : 1.6;
        ctx.strokeStyle = css(layer.color);
        ctx.lineWidth = layer.width ?? 2;
        ctx.beginPath();
        crackPath(ctx, x, y, len, f.rand, segs, wander);
        ctx.stroke();
        if (layer.core !== undefined) {
          ctx.strokeStyle = css(layer.core);
          ctx.lineWidth = (layer.width ?? 2) * 0.4;
          ctx.beginPath();
          crackPath(ctx, x, y, len, f.rand, segs, wander);
          ctx.stroke();
        }
      });
      break;
    case 'ripple':
      eachImage(feats, a, b, (x, y, f) => {
        const L = lerp(layer.len[0], layer.len[1], f.rand[10]) * S;
        const tilt = 0.22 + (f.rand[9] - 0.5) * 0.18;
        const bow = L * (0.1 + f.rand[8] * 0.08);
        const x0 = x - L / 2, y0 = y - L * tilt / 2, x1 = x + L / 2, y1 = y + L * tilt / 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = css(layer.dark);
        ctx.lineWidth = 0.8 * S;
        ctx.beginPath();
        ctx.moveTo(x0, y0 + 0.5 * S);
        ctx.quadraticCurveTo(x, y - bow + 0.5 * S, x1, y1 + 0.5 * S);
        ctx.stroke();
        ctx.strokeStyle = css(layer.light);
        ctx.lineWidth = 0.6 * S;
        ctx.beginPath();
        ctx.moveTo(x0 + L * 0.08, y0 - 0.25 * S);
        ctx.quadraticCurveTo(x, y - bow - 0.25 * S, x1 - L * 0.1, y1 - 0.25 * S);
        ctx.stroke();
      });
      break;
    case 'wave':
      eachImage(feats, a, b, (x, y, f) => {
        const L = lerp(layer.len[0], layer.len[1], f.rand[10]) * S;
        ctx.lineCap = 'round';
        ctx.strokeStyle = css(layer.color, layer.alpha ?? 0.7);
        ctx.lineWidth = 0.6 * S;
        ctx.beginPath();
        ctx.moveTo(x - L / 2, y);
        ctx.quadraticCurveTo(x, y - L * 0.22, x + L / 2, y);
        ctx.stroke();
      });
      break;
    case 'speck':
      eachImage(feats, a, b, (x, y, f) => {
        const color = layer.colors[Math.floor(f.rand[11] * layer.colors.length)];
        const r = lerp(layer.size[0], layer.size[1], f.rand[10]) * S;
        if (layer.glow) drawGlow(ctx, x, y, r * 4.5, color, 0.45);
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (layer.glow) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath();
          ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      break;
    case 'leaf':
      eachImage(feats, a, b, (x, y, f) => {
        const color = layer.colors[Math.floor(f.rand[11] * layer.colors.length)];
        const sz = lerp(layer.size[0], layer.size[1], f.rand[10]) * S;
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.ellipse(x, y, sz, sz * 0.42, f.rand[9] * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    case 'slabs':
      break;
  }
}

// ── Voronoi slabs (per-pixel, periodic) ─────────────────────────────────

function slabSeeds(layer: Extract<GroundLayer, { kind: 'slabs' }>, seed: number): SlabSeed[] {
  const cached = slabCache.get(layer);
  if (cached) return cached;
  const r = rng(seed);
  const n = Math.round(layer.cells * PERIOD);
  const seeds: SlabSeed[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // Offset every other row so slabs read as a running-bond, not a grid.
      const off = (j % 2) * 0.5;
      seeds.push({
        u: ((i + off + 0.5 + (r() - 0.5) * 0.7) / n) * PERIOD,
        v: ((j + 0.5 + (r() - 0.5) * 0.7) / n) * PERIOD,
        id: seeds.length,
        tone: r(),
      });
    }
  }
  slabCache.set(layer, seeds);
  return seeds;
}

function pairHash(i: number, j: number): number {
  const lo = Math.min(i, j), hi = Math.max(i, j);
  let h = Math.imul(lo, 73856093) ^ Math.imul(hi, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function paintSlabs(
  ctx: CanvasRenderingContext2D, layer: Extract<GroundLayer, { kind: 'slabs' }>, base: number,
  a: number, b: number, seed: number,
): void {
  const seeds = slabSeeds(layer, seed);
  const cands: { u: number; v: number; id: number; tone: number }[] = [];
  for (const s of seeds) {
    for (let k = -1; k <= 1; k++) {
      for (let m = -1; m <= 1; m++) {
        const u = s.u + k * PERIOD - a, v = s.v + m * PERIOD - b;
        if (Math.abs(u) < 1.35 && Math.abs(v) < 1.35) cands.push({ u, v, id: s.id, tone: s.tone });
      }
    }
  }
  const img = ctx.getImageData(0, 0, TEX_W, TEX_H);
  const d = img.data;
  const mortar = rgb(layer.mortar);
  const bl = rgb(layer.bevelLight), bs = rgb(layer.bevelShade);
  const fis = layer.fissure !== undefined ? rgb(layer.fissure) : null;
  const fisCore = layer.fissureCore !== undefined ? rgb(layer.fissureCore) : null;
  const toneCols = [0, 1, 2, 3, 4].map(i => rgb(mixC(base, i < 2 ? 0x000000 : 0xffffff, [0.07, 0.035, 0, 0.035, 0.07][i] * layer.jitter / 0.06)));
  const w = layer.mortarW;
  const invSqrt2 = Math.SQRT1_2;
  for (let py = 0; py < TEX_H; py++) {
    for (let px = 0; px < TEX_W; px++) {
      const [du, dv] = pxToLat(px + 0.5, py + 0.5);
      if (Math.abs(du) > 0.6 || Math.abs(dv) > 0.6) continue;
      let d1 = Infinity, d2 = Infinity, i1 = 0, i2 = 0;
      for (let c = 0; c < cands.length; c++) {
        const q = cands[c];
        const dd = (q.u - du) * (q.u - du) + (q.v - dv) * (q.v - dv);
        if (dd < d1) { d2 = d1; i2 = i1; d1 = dd; i1 = c; } else if (dd < d2) { d2 = dd; i2 = c; }
      }
      const s1 = cands[i1], s2 = cands[i2];
      // Distance to the bisector between the two nearest seeds.
      const ex = s2.u - s1.u, ey = s2.v - s1.v;
      const el = Math.hypot(ex, ey) || 1;
      const mx = (s1.u + s2.u) / 2, my = (s1.v + s2.v) / 2;
      const edge = Math.abs(((du - mx) * ex + (dv - my) * ey) / el);
      const o = (py * TEX_W + px) * 4;
      let col = toneCols[Math.min(4, Math.floor(s1.tone * 5))];
      const isFissure = fis !== null && pairHash(s1.id, s2.id) < (layer.fissureChance ?? 0);
      if (edge < w) {
        if (isFissure && fis && fisCore) col = edge < w * 0.45 ? fisCore : fis;
        else col = mortar;
      } else if (edge < w * 2.6) {
        // Screen-space direction toward the neighbour slab; light comes from upper-left.
        const sx = (ex - ey) * 2, sy = (ex + ey);
        const dot = (-sx - sy) * invSqrt2 / (Math.hypot(sx, sy) || 1);
        if (isFissure && fis) {
          const t = 0.55 * (1 - (edge - w) / (w * 1.6));
          col = [col[0] + (fis[0] - col[0]) * t, col[1] + (fis[1] - col[1]) * t, col[2] + (fis[2] - col[2]) * t];
        } else if (dot > 0.25) col = bl;
        else if (dot < -0.25) col = bs;
      }
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ── Interior details ────────────────────────────────────────────────────

function tuftColors(style: GroundStyle): [number, number] {
  const t = style.layers.find(l => l.kind === 'tuft') as Extract<GroundLayer, { kind: 'tuft' }> | undefined;
  return t ? [t.color, t.light] : [mixC(style.base, 0x000000, 0.25), mixC(style.base, 0xffffff, 0.25)];
}

function pebbleColors(style: GroundStyle): [number, number, number] {
  const p = style.layers.find(l => l.kind === 'pebble') as Extract<GroundLayer, { kind: 'pebble' }> | undefined;
  if (p) return [p.color, p.shade, p.light];
  return [mixC(style.base, 0xffffff, 0.12), mixC(style.base, 0x1a1030, 0.3), mixC(style.base, 0xffffff, 0.3)];
}

function paintDetail(ctx: CanvasRenderingContext2D, kind: DetailKind, style: GroundStyle, r: () => number): void {
  // Anchor well inside the diamond so nothing crosses a tile edge.
  const [x, y] = latToPx((r() - 0.5) * 0.36, (r() - 0.5) * 0.36);
  const acc = style.accents.length ? style.accents : [0xffffff];
  const pick = (): number => acc[Math.floor(r() * acc.length)];
  switch (kind) {
    case 'flowers': {
      const [leaf] = tuftColors(style);
      const n = 3 + Math.floor(r() * 4);
      const color = pick();
      for (let i = 0; i < n; i++) {
        const fx = x + (r() - 0.5) * 9 * S, fy = y + (r() - 0.5) * 4.5 * S;
        ctx.fillStyle = css(leaf);
        ctx.beginPath();
        ctx.ellipse(fx - 0.9 * S, fy + 0.9 * S, 1.1 * S, 0.5 * S, -0.4, 0, Math.PI * 2);
        ctx.fill();
        const c = r() < 0.75 ? color : pick();
        ctx.fillStyle = css(mixC(c, 0x402040, 0.35));
        ctx.beginPath();
        ctx.arc(fx + 0.35 * S, fy + 0.35 * S, 1.25 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(c);
        ctx.beginPath();
        ctx.arc(fx, fy, 1.2 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(mixC(c, 0xfff4c0, 0.6));
        ctx.beginPath();
        ctx.arc(fx - 0.2 * S, fy - 0.2 * S, 0.45 * S, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'bigTuft': {
      const [c, l] = tuftColors(style);
      const rr = [r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r()];
      drawTuft(ctx, x - 1.5 * S, y, 6 + r() * 2, c, l, 5, rr);
      drawTuft(ctx, x + 2 * S, y + 1.2 * S, 4.5 + r() * 1.5, c, l, 3, rr.slice(3).concat(rr.slice(0, 3)));
      break;
    }
    case 'stones': {
      const [c, sh, l] = pebbleColors(style);
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        drawPebble(ctx, x + (r() - 0.5) * 8 * S, y + (r() - 0.5) * 3.5 * S, 1.8 + r() * 1.6, c, sh, l, (r() - 0.5) * 0.6);
      }
      break;
    }
    case 'crackStar': {
      const dark = mixC(style.base, 0x140a20, 0.35);
      ctx.strokeStyle = css(dark);
      ctx.lineWidth = 0.7 * S;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        crackPath(ctx, x, y, 4 + r() * 4, [i / n + r() * 0.1, r(), r(), r(), r(), r(), r()], 2);
        ctx.stroke();
      }
      break;
    }
    case 'glowSpecks': {
      const n = 4 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const gx = x + (r() - 0.5) * 11 * S, gy = y + (r() - 0.5) * 5 * S;
        const c = pick();
        drawGlow(ctx, gx, gy, 3.2 * S, c, 0.5);
        ctx.fillStyle = css(mixC(c, 0xffffff, 0.5));
        ctx.beginPath();
        ctx.arc(gx, gy, 0.55 * S, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'mushrooms': {
      const n = 2 + Math.floor(r() * 3);
      const c = pick();
      for (let i = 0; i < n; i++) {
        const mx = x + (r() - 0.5) * 8 * S, my = y + (r() - 0.5) * 3 * S;
        const h = (1.6 + r() * 1.4) * S;
        const cr = (1.1 + r() * 0.8) * S;
        drawGlow(ctx, mx, my - h, cr * 3.2, c, 0.4);
        ctx.fillStyle = css(0xd8d0e0);
        ctx.fillRect(mx - 0.35 * S, my - h, 0.7 * S, h);
        ctx.fillStyle = css(mixC(c, 0x302050, 0.35));
        ctx.beginPath();
        ctx.ellipse(mx, my - h, cr, cr * 0.6, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = css(c);
        ctx.beginPath();
        ctx.ellipse(mx - cr * 0.15, my - h - cr * 0.1, cr * 0.75, cr * 0.42, 0, Math.PI, 0);
        ctx.fill();
      }
      break;
    }
    case 'snowDrift': {
      const rr = [r(), r(), r(), r(), r(), r(), r(), r(), r()];
      ctx.fillStyle = css(0xc3d0e2);
      ctx.beginPath();
      blobAt(ctx, x + 0.7 * S, y + 0.7 * S, 6 + r() * 2, rr);
      ctx.fill();
      ctx.fillStyle = css(0xf0f5fa);
      ctx.beginPath();
      blobAt(ctx, x, y, 5.6 + r() * 2, rr);
      ctx.fill();
      break;
    }
    case 'bones': {
      const bone = 0xe8dcc4;
      const n = 1 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const bx = x + (r() - 0.5) * 6 * S, by = y + (r() - 0.5) * 2.5 * S;
        const ang = (r() - 0.5) * 1.2;
        const len = (3 + r() * 2.5) * S;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(ang);
        ctx.fillStyle = css(mixC(bone, 0x503848, 0.4));
        ctx.fillRect(-len / 2, -0.2 * S, len, 1.1 * S);
        ctx.fillStyle = css(bone);
        ctx.fillRect(-len / 2, -0.5 * S, len, 0.9 * S);
        for (const ex of [-len / 2, len / 2]) {
          ctx.beginPath();
          ctx.arc(ex, -0.5 * S, 0.7 * S, 0, Math.PI * 2);
          ctx.arc(ex, 0.4 * S, 0.7 * S, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      break;
    }
    case 'emberVent': {
      const c = pick();
      drawGlow(ctx, x, y, 8 * S, c, 0.4);
      ctx.strokeStyle = css(mixC(c, 0x300010, 0.45));
      ctx.lineWidth = 1.1 * S;
      ctx.lineCap = 'round';
      const n = 3 + Math.floor(r() * 2);
      const rays: number[][] = [];
      for (let i = 0; i < n; i++) rays.push([i / n + r() * 0.15, r(), r(), r(), r(), r(), r()]);
      for (const rr of rays) { ctx.beginPath(); crackPath(ctx, x, y, 3.5 + rr[1] * 3, rr, 2); ctx.stroke(); }
      ctx.strokeStyle = css(mixC(c, 0xffffc0, 0.45));
      ctx.lineWidth = 0.45 * S;
      for (const rr of rays) { ctx.beginPath(); crackPath(ctx, x, y, 3.5 + rr[1] * 3, rr, 2); ctx.stroke(); }
      break;
    }
    case 'roots': {
      const dark = mixC(style.base, 0x1a1020, 0.45);
      const light = mixC(style.base, 0xd0c0b0, 0.2);
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const sx = x + (r() - 0.5) * 6 * S, sy = y + (r() - 0.5) * 3 * S;
        const ang = r() * Math.PI * 2;
        const L = (6 + r() * 5) * S;
        const ex = sx + Math.cos(ang) * L, ey = sy + Math.sin(ang) * L * 0.5;
        const cx = (sx + ex) / 2 + (r() - 0.5) * 4 * S, cy = (sy + ey) / 2 + (r() - 0.5) * 2 * S;
        ctx.lineCap = 'round';
        ctx.strokeStyle = css(dark);
        ctx.lineWidth = 1.5 * S;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
        ctx.strokeStyle = css(light);
        ctx.lineWidth = 0.45 * S;
        ctx.beginPath(); ctx.moveTo(sx, sy - 0.4 * S); ctx.quadraticCurveTo(cx, cy - 0.4 * S, ex, ey - 0.3 * S); ctx.stroke();
      }
      break;
    }
    case 'shells': {
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const sx = x + (r() - 0.5) * 9 * S, sy = y + (r() - 0.5) * 4 * S;
        const c = r() < 0.3 ? pick() : 0xf2ead8;
        ctx.fillStyle = css(mixC(c, 0x8a6a40, 0.35));
        ctx.beginPath(); ctx.ellipse(sx + 0.3 * S, sy + 0.3 * S, 0.9 * S, 0.55 * S, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = css(c);
        ctx.beginPath(); ctx.ellipse(sx, sy, 0.8 * S, 0.5 * S, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'straw': {
      const c = acc[0];
      ctx.lineCap = 'round';
      const n = 5 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const sx = x + (r() - 0.5) * 10 * S, sy = y + (r() - 0.5) * 4.5 * S;
        const ang = (r() - 0.5) * 1.4;
        const L = (2 + r() * 2.5) * S;
        ctx.strokeStyle = css(r() < 0.5 ? c : mixC(c, 0x6a4a20, 0.3));
        ctx.lineWidth = 0.5 * S;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(ang) * L, sy + Math.sin(ang) * L * 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'lilyPads': {
      const leaf = acc[0];
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const lx = x + (r() - 0.5) * 8 * S, ly = y + (r() - 0.5) * 3.5 * S;
        const lr = (1.6 + r() * 1.2) * S;
        const notch = r() * Math.PI * 2;
        ctx.fillStyle = css(mixC(leaf, 0x102030, 0.4));
        ctx.beginPath();
        ctx.ellipse(lx + 0.3 * S, ly + 0.35 * S, lr, lr * 0.5, 0, notch + 0.5, notch + Math.PI * 2 - 0.1);
        ctx.lineTo(lx + 0.3 * S, ly + 0.35 * S);
        ctx.fill();
        ctx.fillStyle = css(leaf);
        ctx.beginPath();
        ctx.ellipse(lx, ly, lr, lr * 0.5, 0, notch + 0.5, notch + Math.PI * 2 - 0.1);
        ctx.lineTo(lx, ly);
        ctx.fill();
        if (acc[1] !== undefined && r() < 0.4) {
          ctx.fillStyle = css(acc[1]);
          ctx.beginPath(); ctx.arc(lx, ly - 0.3 * S, 0.8 * S, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
  }
}

/** Paint the periodic base of a ground material for lattice class (a, b). */
export function paintGroundBase(
  ctx: CanvasRenderingContext2D, style: GroundStyle, a: number, b: number, seed: number,
): void {
  ctx.fillStyle = css(style.base);
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  style.layers.forEach((layer, i) => {
    if (layer.kind === 'slabs') {
      paintSlabs(ctx, layer, style.base, a, b, seed + i * 7919);
      return;
    }
    paintLayer(ctx, layer, featuresFor(layer, seed + i * 7919), a, b);
  });
}

/** Add interior-only details for tile `variant` (variant 0 stays clean). */
export function paintGroundDetails(
  ctx: CanvasRenderingContext2D, style: GroundStyle, a: number, b: number, variant: number, seed: number,
): void {
  if (variant <= 0 || style.details.length === 0) return;
  const r = rng(seed * 31 + variant * 977 + (a * PERIOD + b) * 131 + 17);
  const n = r() < 0.75 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    paintDetail(ctx, style.details[Math.floor(r() * style.details.length)], style, r);
  }
}

