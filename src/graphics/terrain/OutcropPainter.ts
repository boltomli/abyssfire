/**
 * Wall (tile 4) outcrops and camp-wall (tile 6) palisades.
 *
 * Each overlay occupies exactly one tile footprint and rises above it; it is
 * rendered as a separate depth-sorted image on top of the ground tile. Several
 * variants per zone are picked by a position hash so map-edge rows read as a
 * natural ridge rather than stamped copies.
 */
import { PROP_S as S, css, mixC, rgb, rng } from './TerrainLattice';
import type { TerrainTheme } from './TerrainStyles';

/** Headroom above the footprint diamond (world px). */
export const OUTCROP_HEAD = 60;
/** Horizontal overhang either side of the footprint (world px). */
export const OUTCROP_SIDE = 8;
export const OUT_W = (64 + OUTCROP_SIDE * 2) * S;
export const OUT_H = (32 + OUTCROP_HEAD) * S;
/** Footprint centre inside the overlay texture (px). */
export const OUT_CX = OUT_W / 2;
export const OUT_CY = (OUTCROP_HEAD + 16) * S;
export const OUTCROP_ORIGIN_Y = OUT_CY / OUT_H;

interface Tone { base: string; shade: string; light: string; line: string; deep: string }

function toneOf(c: number, light = 0.3, shade = 0.34): Tone {
  return {
    base: css(c),
    shade: css(mixC(mixC(c, 0x2a1c4a, 0.3), 0x000000, shade)),
    light: css(mixC(c, 0xfff2d6, light)),
    line: css(mixC(mixC(c, 0x1a0e2a, 0.55), 0x000000, 0.45)),
    deep: css(mixC(mixC(c, 0x1a0e2a, 0.4), 0x000000, 0.55)),
  };
}

type P = [number, number];

function poly(ctx: CanvasRenderingContext2D, pts: P[]): void {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function smoothPoly(ctx: CanvasRenderingContext2D, pts: P[]): void {
  const n = pts.length;
  const mid = (i: number): P => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

function glowAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: number, alpha: number): void {
  const [cr, cg, cb] = rgb(color);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
  g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${alpha * 0.4})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function contactShadow(ctx: CanvasRenderingContext2D, color: number, rx = 30, ry = 14, alpha = 0.42): void {
  const [r, g, b] = rgb(color);
  ctx.save();
  ctx.translate(OUT_CX, OUT_CY + 2 * S);
  ctx.scale(1, ry / rx);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * S);
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  grad.addColorStop(0.65, `rgba(${r},${g},${b},${alpha * 0.7})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Faceted rock ────────────────────────────────────────────────────────

interface RockGeo { sil: P[]; top: P; ridgeFoot: P; capEdge: P[] }

function rockGeo(gx: number, gy: number, hw: number, h: number, r: () => number, pointy = 0): RockGeo {
  const j = (s: number): number => (r() - 0.5) * s;
  const top: P = [gx + hw * (0.02 + j(0.35)), gy - h];
  const tl: P = [gx - hw * (0.42 + j(0.2) - pointy * 0.2), gy - h * (0.86 + j(0.1) - pointy * 0.2)];
  const l1: P = [gx - hw * (0.9 + j(0.12)), gy - h * (0.42 + j(0.14))];
  const l0: P = [gx - hw, gy];
  const fb: P = [gx + hw * 0.08, gy + hw * 0.42];
  const r0: P = [gx + hw, gy];
  const r1: P = [gx + hw * (0.93 + j(0.12)), gy - h * (0.4 + j(0.14))];
  const r2: P = [gx + hw * (0.55 + j(0.2) - pointy * 0.2), gy - h * (0.82 + j(0.1) - pointy * 0.2)];
  const sil: P[] = [l0, l1, tl, top, r2, r1, r0, [gx + hw * 0.62, gy + hw * 0.3], fb, [gx - hw * 0.6, gy + hw * 0.3]];
  const ridgeFoot: P = fb;
  const t = 0.3;
  const capM: P = [top[0] + (fb[0] - top[0]) * t, top[1] + (fb[1] - top[1]) * t];
  const capEdge: P[] = [
    [tl[0] + hw * 0.05, tl[1] + h * 0.12],
    capM,
    [r2[0] - hw * 0.05, r2[1] + h * 0.1],
  ];
  return { sil, top, ridgeFoot, capEdge };
}

function drawRock(
  ctx: CanvasRenderingContext2D, geo: RockGeo, t: Tone, r: () => number,
  opts: { crackCount?: number; lineW?: number } = {},
): void {
  const { sil, top, ridgeFoot } = geo;
  // Right (shade) face = whole silhouette.
  ctx.fillStyle = t.shade;
  ctx.beginPath(); poly(ctx, sil); ctx.fill();
  // Left (lit) face: from the left base up to the top and down the ridge.
  const leftFace: P[] = [sil[0], sil[1], sil[2], top, ridgeFoot, sil[9]];
  ctx.fillStyle = t.base;
  ctx.beginPath(); poly(ctx, leftFace); ctx.fill();
  // Top cap (brightest).
  const cap: P[] = [sil[2], top, sil[4], geo.capEdge[2], geo.capEdge[1], geo.capEdge[0]];
  ctx.fillStyle = t.light;
  ctx.beginPath(); poly(ctx, cap); ctx.fill();
  // Ridge line.
  ctx.strokeStyle = t.deep;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 0.5 * S;
  ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(ridgeFoot[0], ridgeFoot[1]); ctx.stroke();
  ctx.globalAlpha = 1;
  // Cracks on the faces.
  const n = opts.crackCount ?? 1;
  ctx.strokeStyle = t.deep;
  ctx.lineWidth = 0.55 * S;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const sx = top[0] + side * (r() * 0.5 + 0.2) * Math.abs(sil[0][0] - top[0]) * 0.8;
    const sy = top[1] + (sil[0][1] - top[1]) * (0.3 + r() * 0.3);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + side * 2 * S, sy + 3.5 * S);
    ctx.lineTo(sx + side * 1.2 * S, sy + 6.5 * S);
    ctx.stroke();
  }
  // Coloured line art around the silhouette.
  ctx.strokeStyle = t.line;
  ctx.lineWidth = opts.lineW ?? 0.75 * S;
  ctx.lineJoin = 'round';
  ctx.beginPath(); poly(ctx, sil); ctx.stroke();
}

function clipTo(ctx: CanvasRenderingContext2D, sil: P[], draw: () => void): void {
  ctx.save();
  ctx.beginPath(); poly(ctx, sil); ctx.clip();
  draw();
  ctx.restore();
}

/** Organic cap (moss or snow) covering the top of a rock, with drips. */
function capOver(ctx: CanvasRenderingContext2D, geo: RockGeo, color: number, shade: number, r: () => number, drips: number, jag = false): void {
  const { sil, top } = geo;
  const minX = Math.min(...sil.map(p => p[0])), maxX = Math.max(...sil.map(p => p[0]));
  const baseY = Math.max(...sil.map(p => p[1]));
  const h = baseY - top[1];
  clipTo(ctx, sil, () => {
    const pts: P[] = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const x = minX + ((maxX - minX) * i) / steps;
      const drop = h * (0.28 + r() * 0.12) + (jag && i % 2 ? h * 0.1 : 0);
      pts.push([x, top[1] + drop + (Math.abs(x - top[0]) / (maxX - minX)) * h * 0.25]);
    }
    const shape = (): void => {
      ctx.moveTo(minX - 4, top[1] - 10);
      ctx.lineTo(maxX + 4, top[1] - 10);
      for (let i = pts.length - 1; i >= 0; i--) {
        if (jag) ctx.lineTo(pts[i][0], pts[i][1]);
        else {
          const p = pts[i], q = pts[Math.max(0, i - 1)];
          ctx.quadraticCurveTo(p[0], p[1] + 2 * S, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
        }
      }
      ctx.closePath();
    };
    ctx.fillStyle = css(shade);
    ctx.beginPath();
    ctx.save(); ctx.translate(0, 1.2 * S); shape(); ctx.restore();
    ctx.fill();
    ctx.fillStyle = css(color);
    ctx.beginPath(); shape(); ctx.fill();
    // Light band on the upper-left.
    ctx.fillStyle = css(mixC(color, 0xffffff, 0.3));
    ctx.beginPath();
    ctx.ellipse(top[0] - (maxX - minX) * 0.16, top[1] + h * 0.1, (maxX - minX) * 0.2, h * 0.08, -0.2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < drips; i++) {
      const p = pts[1 + Math.floor(r() * (pts.length - 2))];
      const dl = (2.5 + r() * 4) * S;
      ctx.fillStyle = css(color);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] + dl * 0.4, 1.4 * S, dl * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function tuftAt(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: number, light: number): void {
  const blades = 4;
  for (let i = 0; i < blades; i++) {
    const t = i / (blades - 1) - 0.5;
    const bh = h * S * (1 - Math.abs(t) * 0.4);
    const lean = t * h * S * 0.7;
    ctx.fillStyle = css(i % 2 ? color : mixC(color, 0x000000, 0.1));
    ctx.beginPath();
    ctx.moveTo(x + t * 4 * S - 0.6 * S, y);
    ctx.quadraticCurveTo(x + t * 4 * S + lean * 0.2, y - bh * 0.6, x + t * 4 * S + lean, y - bh);
    ctx.quadraticCurveTo(x + t * 4 * S + lean * 0.3 + 0.8 * S, y - bh * 0.5, x + t * 4 * S + 0.7 * S, y);
    ctx.fill();
  }
  ctx.strokeStyle = css(light);
  ctx.lineWidth = 0.4 * S;
  ctx.beginPath();
  ctx.moveTo(x - 0.5 * S, y - h * S * 0.4);
  ctx.lineTo(x - 0.9 * S, y - h * S * 0.9);
  ctx.stroke();
}

// ── Theme outcrops ──────────────────────────────────────────────────────

interface Mass { gx: number; gy: number; hw: number; h: number }

function layoutMasses(r: () => number, tall: number, count: number): Mass[] {
  const cx = OUT_CX, cy = OUT_CY;
  const masses: Mass[] = [];
  // One big back mass filling the footprint, then smaller front stones.
  masses.push({ gx: cx + (r() - 0.5) * 8 * S, gy: cy - 3 * S, hw: (24 + r() * 5) * S, h: (tall * (0.75 + r() * 0.35)) * S });
  const spots: P[] = [[-15, 5], [14, 6], [0, 9], [-4, -9], [10, -6]];
  for (let i = 1; i < count; i++) {
    const [sx, sy] = spots[(i - 1 + Math.floor(r() * 2)) % spots.length];
    masses.push({
      gx: cx + (sx + (r() - 0.5) * 5) * S,
      gy: cy + (sy + (r() - 0.5) * 2) * S,
      hw: (9 + r() * 6) * S,
      h: (tall * (0.3 + r() * 0.3)) * S,
    });
  }
  return masses.sort((a, b) => a.gy - b.gy);
}

function mossBoulder(ctx: CanvasRenderingContext2D, th: TerrainTheme, v: number, r: () => number): void {
  const o = th.outcrop;
  contactShadow(ctx, o.shadow);
  const hedge = v % 3 === 2;
  if (hedge) {
    // Hedge: scalloped leafy clouds (no round "blob" silhouettes).
    const lt = toneOf(o.extra, 0.3, 0.32);
    const cloud = (cx: number, cy: number, rx: number, ry: number): void => {
      const n = 11;
      const pts: P[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.2;
        const k = 0.85 + r() * 0.25;
        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
      }
      const path = (): void => {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 0; i < n; i++) {
          const p0 = pts[i], p1 = pts[(i + 1) % n];
          const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
          const ox = mx - cx, oy = my - cy;
          const l = Math.hypot(ox, oy) || 1;
          ctx.quadraticCurveTo(mx + (ox / l) * 3.2 * S, my + (oy / l) * 2.6 * S, p1[0], p1[1]);
        }
        ctx.closePath();
      };
      ctx.fillStyle = lt.shade;
      ctx.beginPath(); path(); ctx.fill();
      ctx.save();
      ctx.beginPath(); path(); ctx.clip();
      ctx.fillStyle = lt.base;
      ctx.beginPath(); ctx.ellipse(cx - rx * 0.22, cy - ry * 0.25, rx * 0.95, ry * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = lt.light;
      for (let i = 0; i < 4; i++) {
        const lx = cx - rx * (0.1 + r() * 0.55), ly = cy - ry * (0.2 + r() * 0.55);
        ctx.beginPath(); ctx.ellipse(lx, ly, 2.6 * S, 1.3 * S, -0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = lt.line;
      ctx.lineWidth = 0.6 * S;
      ctx.lineJoin = 'round';
      ctx.beginPath(); path(); ctx.stroke();
    };
    cloud(OUT_CX - 6 * S, OUT_CY - 14 * S, 20 * S, 13 * S);
    cloud(OUT_CX + 12 * S, OUT_CY - 6 * S, 14 * S, 10 * S);
  }
  const masses = hedge ? [{ gx: OUT_CX + 8 * S, gy: OUT_CY + 6 * S, hw: 13 * S, h: 13 * S }] : layoutMasses(r, 30, 2 + (v % 2));
  const t = toneOf(o.rock);
  for (const m of masses) {
    // Rounded boulder: smoothed silhouette.
    const geo = rockGeo(m.gx, m.gy, m.hw, m.h, r);
    ctx.save();
    ctx.fillStyle = t.shade;
    ctx.beginPath(); smoothPoly(ctx, geo.sil); ctx.fill();
    ctx.clip();
    ctx.fillStyle = t.base;
    ctx.beginPath(); ctx.ellipse(m.gx - m.hw * 0.28, m.gy - m.h * 0.5, m.hw * 0.78, m.h * 0.72, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.light;
    ctx.beginPath(); ctx.ellipse(m.gx - m.hw * 0.3, m.gy - m.h * 0.78, m.hw * 0.42, m.h * 0.22, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const smoothSil = geo.sil;
    capOver(ctx, { ...geo, sil: smoothSil }, o.cap, mixC(o.cap, 0x1a3020, 0.35), r, 2 + Math.floor(r() * 2));
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 0.7 * S;
    ctx.beginPath(); smoothPoly(ctx, geo.sil); ctx.stroke();
    // Grass tufts hugging the base.
    tuftAt(ctx, m.gx - m.hw * 0.7, m.gy + m.hw * 0.18, 4 + r() * 2, 0x5a8a3a, 0xa9cc68);
    if (r() < 0.6) tuftAt(ctx, m.gx + m.hw * 0.6, m.gy + m.hw * 0.25, 3 + r() * 2, 0x5a8a3a, 0xa9cc68);
  }
}

function forestRock(ctx: CanvasRenderingContext2D, th: TerrainTheme, v: number, r: () => number): void {
  const o = th.outcrop;
  contactShadow(ctx, o.shadow, 31, 15, 0.5);
  const stump = v % 3 === 1;
  if (stump) {
    // Gnarled stump with flaring roots.
    const wood = toneOf(o.extra, 0.22, 0.35);
    const x = OUT_CX + (r() - 0.5) * 6 * S, y = OUT_CY + 2 * S;
    const rw = (13 + r() * 3) * S, h = (30 + r() * 10) * S;
    ctx.lineCap = 'round';
    for (const [dx, dy] of [[-22, 4], [20, 6], [-8, 10], [12, -6], [-16, -6]] as P[]) {
      ctx.strokeStyle = wood.line;
      ctx.lineWidth = 6 * S;
      ctx.beginPath(); ctx.moveTo(x, y - 4 * S); ctx.quadraticCurveTo(x + dx * S * 0.5, y + dy * S * 0.2 - 6 * S, x + dx * S, y + dy * S * 0.6); ctx.stroke();
      ctx.strokeStyle = wood.shade;
      ctx.lineWidth = 4.4 * S;
      ctx.stroke();
      ctx.strokeStyle = wood.base;
      ctx.lineWidth = 2 * S;
      ctx.beginPath(); ctx.moveTo(x - 0.8 * S, y - 5 * S); ctx.quadraticCurveTo(x + dx * S * 0.5 - 0.8 * S, y + dy * S * 0.2 - 7 * S, x + dx * S - 0.8 * S, y + dy * S * 0.6 - 1 * S); ctx.stroke();
    }
    const body: P[] = [[x - rw, y], [x - rw * 0.9, y - h * 0.6], [x - rw * 0.75, y - h], [x + rw * 0.8, y - h * 0.94], [x + rw * 0.92, y - h * 0.5], [x + rw, y], [x, y + rw * 0.35]];
    ctx.fillStyle = wood.shade;
    ctx.beginPath(); poly(ctx, body); ctx.fill();
    clipTo(ctx, body, () => {
      ctx.fillStyle = wood.base;
      ctx.fillRect(x - rw * 1.1, y - h * 1.1, rw * 1.05, h * 1.4);
      ctx.strokeStyle = wood.deep;
      ctx.lineWidth = 0.6 * S;
      for (let i = 0; i < 5; i++) {
        const bx = x - rw * 0.8 + (i / 4) * rw * 1.6;
        ctx.beginPath(); ctx.moveTo(bx, y - h); ctx.quadraticCurveTo(bx + (r() - 0.5) * 6 * S, y - h * 0.5, bx + (r() - 0.5) * 4 * S, y + 4 * S); ctx.stroke();
      }
    });
    // Cut top with rings.
    ctx.fillStyle = css(mixC(o.extra, 0xd8b890, 0.5));
    ctx.beginPath(); ctx.ellipse(x + 0.5 * S, y - h * 0.97, rw * 0.8, rw * 0.36, -0.04, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = css(mixC(o.extra, 0x6a4a3a, 0.4));
    ctx.lineWidth = 0.5 * S;
    ctx.beginPath(); ctx.ellipse(x + 0.5 * S, y - h * 0.97, rw * 0.5, rw * 0.22, -0.04, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = wood.line;
    ctx.lineWidth = 0.75 * S;
    ctx.beginPath(); poly(ctx, body); ctx.stroke();
    ctx.fillStyle = css(o.cap);
    ctx.beginPath(); ctx.ellipse(x - rw * 0.55, y - h * 0.93, rw * 0.35, rw * 0.2, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - rw * 0.75, y - h * 0.8, rw * 0.18, rw * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    const masses = layoutMasses(r, 38, 2 + (v % 2));
    const t = toneOf(o.rock, 0.26, 0.38);
    for (const m of masses) {
      const geo = rockGeo(m.gx, m.gy, m.hw, m.h, r, 0.2);
      drawRock(ctx, geo, t, r, { crackCount: 1 });
      capOver(ctx, geo, o.cap, mixC(o.cap, 0x10202a, 0.4), r, 2 + Math.floor(r() * 3));
    }
    // Roots draped over the big rock.
    const wood = toneOf(o.extra, 0.2, 0.3);
    ctx.lineCap = 'round';
    const m = masses.find(q => q.hw > 20 * S) ?? masses[0];
    for (let i = 0; i < 2; i++) {
      const sx = m.gx + (r() - 0.6) * m.hw, sy = m.gy - m.h * (0.75 + r() * 0.2);
      const ex = sx + (r() - 0.5) * 16 * S, ey = m.gy + 4 * S;
      ctx.strokeStyle = wood.line;
      ctx.lineWidth = 2.6 * S;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx + 6 * S, sy + 8 * S, ex - 6 * S, ey - 10 * S, ex, ey); ctx.stroke();
      ctx.strokeStyle = wood.base;
      ctx.lineWidth = 1.4 * S;
      ctx.stroke();
    }
  }
  // Bioluminescent mushrooms at the foot.
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const mx = OUT_CX + (r() - 0.5) * 34 * S, my = OUT_CY + (4 + r() * 6) * S;
    const c = r() < 0.6 ? o.accent : 0xc9a2ff;
    const h = (2.5 + r() * 2.5) * S, cr = (1.8 + r() * 1.2) * S;
    glowAt(ctx, mx, my - h, cr * 4, c, 0.55);
    ctx.fillStyle = css(0xdcd4e6);
    ctx.fillRect(mx - 0.45 * S, my - h, 0.9 * S, h);
    ctx.fillStyle = css(mixC(c, 0x302050, 0.4));
    ctx.beginPath(); ctx.ellipse(mx, my - h, cr, cr * 0.62, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = css(c);
    ctx.beginPath(); ctx.ellipse(mx - cr * 0.15, my - h - cr * 0.12, cr * 0.72, cr * 0.4, 0, Math.PI, 0); ctx.fill();
  }
}

function crag(ctx: CanvasRenderingContext2D, th: TerrainTheme, v: number, r: () => number): void {
  const o = th.outcrop;
  contactShadow(ctx, o.shadow, 31, 15, 0.45);
  const masses = layoutMasses(r, 50, 2 + (v % 3));
  const t = toneOf(o.rock, 0.3, 0.36);
  for (const m of masses) {
    const geo = rockGeo(m.gx, m.gy, m.hw * 0.92, m.h, r, 0.9);
    drawRock(ctx, geo, t, r, { crackCount: 2 });
    if (m.h > 20 * S || r() < 0.4) capOver(ctx, geo, o.cap, 0xbccbe0, r, 1 + Math.floor(r() * 2), true);
  }
  // Scree at the foot.
  for (let i = 0; i < 5; i++) {
    const x = OUT_CX + (r() - 0.5) * 44 * S, y = OUT_CY + (3 + r() * 8) * S;
    const rr = (1.2 + r() * 1.6) * S;
    ctx.fillStyle = t.shade;
    ctx.beginPath(); ctx.ellipse(x + rr * 0.2, y + rr * 0.25, rr, rr * 0.65, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.base;
    ctx.beginPath(); ctx.ellipse(x, y, rr * 0.9, rr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function mesa(ctx: CanvasRenderingContext2D, th: TerrainTheme, v: number, r: () => number): void {
  const o = th.outcrop;
  contactShadow(ctx, o.shadow, 32, 15, 0.36);
  const t = toneOf(o.rock, 0.26, 0.3);
  const butte = (gx: number, gy: number, hw: number, h: number): void => {
    const hd = hw * 0.5;
    const j = (k: number): number => (r() - 0.5) * k * hw;
    const topW = 0.78 + r() * 0.1;
    const ledge = 0.35 + r() * 0.25;
    const L: P[] = [
      [gx - hw, gy], [gx - hw * 0.97 + j(0.05), gy - h * ledge],
      [gx - hw * (topW + 0.06) + j(0.05), gy - h * (ledge + 0.04)], [gx - hw * (topW + 0.02) + j(0.06), gy - h * 0.8],
      [gx - hw * topW, gy - h],
    ];
    const R: P[] = [
      [gx + hw, gy], [gx + hw * 0.96 + j(0.05), gy - h * (ledge - 0.08)],
      [gx + hw * (topW + 0.05) + j(0.05), gy - h * (ledge - 0.04)], [gx + hw * (topW + 0.02) + j(0.06), gy - h * 0.78],
      [gx + hw * topW, gy - h],
    ];
    const tb: P = [gx + j(0.12), gy - h - hd * topW];
    const tf: P = [gx + j(0.08), gy - h + hd * topW];
    const bf: P = [gx, gy + hd];
    const sil: P[] = [...L, tb, ...R.slice().reverse(), bf];
    ctx.fillStyle = t.shade; ctx.beginPath(); poly(ctx, sil); ctx.fill();
    ctx.fillStyle = t.base; ctx.beginPath(); poly(ctx, [...L, tf, bf]); ctx.fill();
    // Wavy strata bands
    clipTo(ctx, sil, () => {
      for (let k = 1; k <= 3; k++) {
        const f = k / 4 + (r() - 0.5) * 0.08;
        const y0 = gy - h * f;
        ctx.fillStyle = css(o.extra, 0.45);
        ctx.beginPath();
        ctx.moveTo(gx - hw * 1.1, y0);
        ctx.quadraticCurveTo(gx - hw * 0.5, y0 + hd * 0.6 + j(0.1), gx, y0 + hd);
        ctx.quadraticCurveTo(gx + hw * 0.5, y0 + hd * 0.6 + j(0.1), gx + hw * 1.1, y0);
        ctx.lineTo(gx + hw * 1.1, y0 + 2.2 * S);
        ctx.quadraticCurveTo(gx + hw * 0.5, y0 + hd * 0.6 + 2.2 * S, gx, y0 + hd + 2.2 * S);
        ctx.quadraticCurveTo(gx - hw * 0.5, y0 + hd * 0.6 + 2.2 * S, gx - hw * 1.1, y0 + 2.2 * S);
        ctx.closePath();
        ctx.fill();
      }
      // vertical erosion runnels on the lit face
      ctx.strokeStyle = t.deep; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.5 * S;
      for (let k = 0; k < 3; k++) {
        const x = gx - hw * (0.2 + r() * 0.6);
        ctx.beginPath(); ctx.moveTo(x, gy - h * (0.7 + r() * 0.25)); ctx.lineTo(x + j(0.05), gy - h * (0.2 + r() * 0.2)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    // Ridge between faces
    ctx.strokeStyle = t.deep; ctx.globalAlpha = 0.4; ctx.lineWidth = 0.5 * S;
    ctx.beginPath(); ctx.moveTo(tf[0], tf[1]); ctx.lineTo(bf[0], bf[1]); ctx.stroke();
    ctx.globalAlpha = 1;
    // Cap rock
    const cap: P[] = [L[4], tb, R[4], tf];
    ctx.fillStyle = css(mixC(o.cap, o.extra, 0.35));
    ctx.beginPath(); smoothPoly(ctx, cap.map(([x, y]) => [x, y + 1.6 * S] as P)); ctx.fill();
    ctx.fillStyle = css(o.cap);
    ctx.beginPath(); smoothPoly(ctx, cap); ctx.fill();
    ctx.fillStyle = css(mixC(o.cap, 0xffffff, 0.3));
    ctx.beginPath(); ctx.ellipse((L[4][0] + tb[0]) / 2 + hw * 0.1, (L[4][1] + tb[1]) / 2 + hd * 0.2, hw * 0.28, hd * 0.18, -0.45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = t.line; ctx.lineWidth = 0.72 * S; ctx.lineJoin = 'round';
    ctx.beginPath(); poly(ctx, sil); ctx.stroke();
  };
  const boulder = (gx: number, gy: number, hw: number, h: number): void => {
    const geo = rockGeo(gx, gy, hw, h, r);
    ctx.fillStyle = t.shade; ctx.beginPath(); smoothPoly(ctx, geo.sil); ctx.fill();
    ctx.save(); ctx.beginPath(); smoothPoly(ctx, geo.sil); ctx.clip();
    ctx.fillStyle = t.base; ctx.beginPath(); ctx.ellipse(gx - hw * 0.3, gy - h * 0.45, hw * 0.8, h * 0.7, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = css(o.cap); ctx.beginPath(); ctx.ellipse(gx - hw * 0.25, gy - h * 0.8, hw * 0.5, h * 0.22, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = t.line; ctx.lineWidth = 0.7 * S; ctx.beginPath(); smoothPoly(ctx, geo.sil); ctx.stroke();
  };
  const kind = v % 3;
  if (kind === 0) {
    butte(OUT_CX + (r() - 0.5) * 4 * S, OUT_CY - 1 * S, (24 + r() * 4) * S, (34 + r() * 12) * S);
  } else if (kind === 1) {
    butte(OUT_CX - 3 * S + (r() - 0.5) * 4 * S, OUT_CY - 3 * S, (25 + r() * 3) * S, (18 + r() * 8) * S);
    boulder(OUT_CX + 14 * S, OUT_CY + 6 * S, (8 + r() * 3) * S, (7 + r() * 4) * S);
  } else {
    butte(OUT_CX - 8 * S, OUT_CY - 5 * S, (15 + r() * 3) * S, (40 + r() * 10) * S);
    butte(OUT_CX + 11 * S, OUT_CY + 3 * S, (13 + r() * 3) * S, (20 + r() * 10) * S);
  }
  // Sand drift at the base
  const sand = 0xe3c489;
  const sx = OUT_CX + (r() - 0.5) * 16 * S;
  ctx.fillStyle = css(mixC(sand, 0xb08050, 0.22));
  ctx.beginPath(); ctx.ellipse(sx, OUT_CY + 10.5 * S, 17 * S, 4.2 * S, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = css(sand);
  ctx.beginPath(); ctx.ellipse(sx - 1 * S, OUT_CY + 11.2 * S, 14 * S, 3.4 * S, 0, Math.PI, 0); ctx.fill();
}

function basalt(ctx: CanvasRenderingContext2D, th: TerrainTheme, v: number, r: () => number): void {
  const o = th.outcrop;
  contactShadow(ctx, o.shadow, 32, 16, 0.55);
  glowAt(ctx, OUT_CX, OUT_CY + 4 * S, 26 * S, o.accent, 0.12);
  const t = toneOf(o.rock, 0.22, 0.4);
  const cols: { x: number; y: number; rw: number; h: number }[] = [];
  const spots: P[] = [[-4, -10], [10, -6], [-14, -3], [2, 0], [16, 3], [-10, 6], [6, 8]];
  const n = 4 + (v % 3);
  for (let i = 0; i < n; i++) {
    const [sx, sy] = spots[i % spots.length];
    const back = 1 - (sy + 10) / 20;
    cols.push({
      x: OUT_CX + (sx + (r() - 0.5) * 3) * S,
      y: OUT_CY + (sy + (r() - 0.5) * 2) * S,
      rw: (8.5 + r() * 2.5) * S,
      h: (14 + back * 30 + r() * 12) * S,
    });
  }
  cols.sort((a, b) => a.y - b.y);
  for (const c of cols) {
    const hex: P[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      hex.push([c.x + Math.cos(a) * c.rw, c.y - c.h + Math.sin(a) * c.rw * 0.5]);
    }
    const down = (p: P): P => [p[0], p[1] + c.h];
    // faces: 0-1 (right), 1-2 (front-right), 2-3 (front-left), 3-4? (left edge at 180°)
    const faceR: P[] = [hex[0], hex[1], down(hex[1]), down(hex[0])];
    const faceF: P[] = [hex[1], hex[2], down(hex[2]), down(hex[1])];
    const faceL: P[] = [hex[2], hex[3], down(hex[3]), down(hex[2])];
    ctx.fillStyle = t.shade; ctx.beginPath(); poly(ctx, faceR); ctx.fill();
    ctx.fillStyle = css(mixC(o.rock, 0x000000, 0.12)); ctx.beginPath(); poly(ctx, faceF); ctx.fill();
    ctx.fillStyle = t.base; ctx.beginPath(); poly(ctx, faceL); ctx.fill();
    ctx.fillStyle = css(o.cap); ctx.beginPath(); poly(ctx, hex); ctx.fill();
    ctx.fillStyle = css(mixC(o.cap, 0xffffff, 0.18));
    ctx.beginPath(); poly(ctx, [hex[3], hex[4], hex[5], [c.x, c.y - c.h]]); ctx.fill();
    // Glowing fissure down a face.
    if (r() < 0.55) {
      const face = r() < 0.5 ? faceL : faceF;
      const fx = (face[0][0] + face[1][0]) / 2 + (r() - 0.5) * 2 * S;
      const fy = (face[0][1] + face[1][1]) / 2 + c.h * 0.15;
      const pts: P[] = [[fx, fy]];
      let y = fy, x = fx;
      while (y < fy + c.h * 0.75) { y += (3 + r() * 3) * S; x += (r() - 0.5) * 2.6 * S; pts.push([x, y]); }
      glowAt(ctx, x, y - c.h * 0.2, 7 * S, o.accent, 0.45);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = css(o.accent); ctx.lineWidth = 1.3 * S;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = css(0xffc0a0); ctx.lineWidth = 0.5 * S; ctx.stroke();
    }
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 0.7 * S;
    ctx.lineJoin = 'round';
    ctx.beginPath(); poly(ctx, [hex[0], down(hex[0]), down(hex[1]), down(hex[2]), down(hex[3]), hex[3], hex[4], hex[5]]); ctx.stroke();
    ctx.strokeStyle = t.deep;
    ctx.lineWidth = 0.4 * S;
    ctx.beginPath();
    ctx.moveTo(hex[3][0], hex[3][1]); ctx.lineTo(hex[2][0], hex[2][1]); ctx.lineTo(hex[1][0], hex[1][1]); ctx.lineTo(hex[0][0], hex[0][1]);
    ctx.moveTo(hex[1][0], hex[1][1]); ctx.lineTo(hex[1][0], hex[1][1] + c.h);
    ctx.moveTo(hex[2][0], hex[2][1]); ctx.lineTo(hex[2][0], hex[2][1] + c.h);
    ctx.stroke();
  }
  // Ember glints at the foot
  for (let i = 0; i < 3; i++) {
    const x = OUT_CX + (r() - 0.5) * 40 * S, y = OUT_CY + (6 + r() * 6) * S;
    glowAt(ctx, x, y, 4 * S, 0xff6a3a, 0.5);
  }
}

export const OUTCROP_VARIANTS = 6;

export function paintOutcrop(ctx: CanvasRenderingContext2D, th: TerrainTheme, variant: number, seed: number): void {
  const r = rng(seed * 7 + variant * 1013 + 5);
  switch (th.outcrop.kind) {
    case 'mossBoulder': mossBoulder(ctx, th, variant, r); break;
    case 'forestRock': forestRock(ctx, th, variant, r); break;
    case 'crag': crag(ctx, th, variant, r); break;
    case 'mesa': mesa(ctx, th, variant, r); break;
    case 'basalt': basalt(ctx, th, variant, r); break;
  }
}

// ── Camp palisades ──────────────────────────────────────────────────────

/** Half-line directions (texture px per lattice unit) for neighbour bits: c+1, c-1, r+1, r-1. */
const HALF_DIRS: P[] = [[32 * S, 16 * S], [-32 * S, -16 * S], [-32 * S, 16 * S], [32 * S, -16 * S]];

function stake(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, wood: number, band: number, dark: boolean, accent: number, r: () => number): void {
  const t = toneOf(wood, 0.26, 0.34);
  const top = y - h;
  const tip = top - w * 1.1;
  const body: P[] = [[x - w, y], [x - w, top], [x - w * 0.1, tip], [x + w, top], [x + w, y]];
  ctx.fillStyle = t.shade; ctx.beginPath(); poly(ctx, body); ctx.fill();
  ctx.fillStyle = t.base; ctx.beginPath(); poly(ctx, [[x - w, y], [x - w, top], [x - w * 0.1, tip], [x + w * 0.25, top + w * 0.2], [x + w * 0.25, y]]); ctx.fill();
  ctx.fillStyle = t.light; ctx.beginPath(); poly(ctx, [[x - w * 0.8, y - h * 0.08], [x - w * 0.8, top], [x - w * 0.3, top - w * 0.5], [x - w * 0.35, y - h * 0.08]]); ctx.fill();
  // grain
  ctx.strokeStyle = t.deep; ctx.lineWidth = 0.4 * S;
  ctx.beginPath(); ctx.moveTo(x + w * 0.5, top + h * 0.15); ctx.lineTo(x + w * 0.45, top + h * (0.4 + r() * 0.3)); ctx.stroke();
  // lashing bands
  for (const f of [0.3, 0.68]) {
    const by = y - h * f;
    ctx.fillStyle = css(mixC(band, 0x000000, 0.3)); ctx.fillRect(x - w, by, w * 2, 1.6 * S);
    ctx.fillStyle = css(band); ctx.fillRect(x - w, by - 0.2 * S, w * 1.2, 1.2 * S);
  }
  ctx.strokeStyle = t.line; ctx.lineWidth = 0.65 * S; ctx.lineJoin = 'round';
  ctx.beginPath(); poly(ctx, body); ctx.stroke();
  if (dark && r() < 0.35) glowAt(ctx, x - w * 0.1, tip + w * 0.6, 5 * S, accent, 0.55);
}

function wallRun(
  ctx: CanvasRenderingContext2D, from: P, to: P, h: number, thick: number, stone: number, kind: 'stone' | 'mud', accent: number, r: () => number,
): void {
  const t = toneOf(stone, 0.28, 0.32);
  // Normal toward the viewer (positive y) in screen space.
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny < 0) { nx = -nx; ny = -ny; }
  const off = thick / 2;
  const a0: P = [from[0] + nx * off, from[1] + ny * off * 0.5], a1: P = [to[0] + nx * off, to[1] + ny * off * 0.5];
  const b0: P = [from[0] - nx * off, from[1] - ny * off * 0.5], b1: P = [to[0] - nx * off, to[1] - ny * off * 0.5];
  const up = (p: P): P => [p[0], p[1] - h];
  // front face
  const front: P[] = [a0, a1, up(a1), up(a0)];
  const lit = nx < 0; // facing lower-left catches the light
  ctx.fillStyle = lit ? t.base : t.shade; ctx.beginPath(); poly(ctx, front); ctx.fill();
  // block joints
  ctx.strokeStyle = t.deep; ctx.lineWidth = 0.45 * S;
  const rows = kind === 'stone' ? 3 : 4;
  for (let k = 1; k < rows; k++) {
    const f = k / rows;
    ctx.beginPath(); ctx.moveTo(a0[0], a0[1] - h * f); ctx.lineTo(a1[0], a1[1] - h * f); ctx.stroke();
    const segs = kind === 'stone' ? 3 : 4;
    for (let s = 0; s < segs; s++) {
      const q = (s + (k % 2 ? 0.5 : 0.1)) / segs;
      const x = a0[0] + (a1[0] - a0[0]) * q, y = a0[1] + (a1[1] - a0[1]) * q;
      ctx.beginPath(); ctx.moveTo(x, y - h * f); ctx.lineTo(x, y - h * (f + 1 / rows)); ctx.stroke();
    }
  }
  // top face
  ctx.fillStyle = t.light; ctx.beginPath(); poly(ctx, [up(a0), up(a1), up(b1), up(b0)]); ctx.fill();
  if (kind === 'stone') {
    // snow line on top
    ctx.fillStyle = css(0xeef3f9);
    ctx.beginPath(); poly(ctx, [up(a0), up(a1), [up(a1)[0], up(a1)[1] - 1.2 * S], [up(b1)[0], up(b1)[1] - 1.2 * S], up(b1), up(b0)]); ctx.fill();
  } else {
    // crenellations
    for (let q = 0.12; q < 1; q += 0.42) {
      const x = a0[0] + (a1[0] - a0[0]) * q, y = a0[1] + (a1[1] - a0[1]) * q - h;
      ctx.fillStyle = lit ? t.base : t.shade; ctx.fillRect(x - 3 * S, y - 3.4 * S, 6 * S, 3.6 * S);
      ctx.fillStyle = t.light; ctx.fillRect(x - 3 * S, y - 4.4 * S, 6 * S, 1.2 * S);
      ctx.strokeStyle = t.line; ctx.lineWidth = 0.5 * S; ctx.strokeRect(x - 3 * S, y - 4.4 * S, 6 * S, 4.6 * S);
    }
    if (r() < 0.5) {
      const x = (a0[0] + a1[0]) / 2, y = (a0[1] + a1[1]) / 2 - h * 0.55;
      ctx.fillStyle = css(accent); ctx.fillRect(x - 1.6 * S, y - 1.6 * S, 3.2 * S, 3.2 * S);
    }
  }
  ctx.strokeStyle = t.line; ctx.lineWidth = 0.65 * S; ctx.lineJoin = 'round';
  ctx.beginPath(); poly(ctx, [a0, a1, up(a1), up(b1), up(b0), up(a0)]); ctx.stroke();
}

/**
 * Paint a camp wall. `mask` bits mark camp-wall neighbours:
 * 1 = col+1, 2 = col-1, 4 = row+1, 8 = row-1.
 */
export function paintPalisade(ctx: CanvasRenderingContext2D, th: TerrainTheme, mask: number, seed: number): void {
  const p = th.palisade;
  const r = rng(seed * 13 + mask * 101 + 3);
  contactShadow(ctx, th.outcrop.shadow, 22, 10, 0.3);
  const c: P = [OUT_CX, OUT_CY];
  const dirs = HALF_DIRS.filter((_, i) => mask & (1 << i));
  if (p.kind === 'stoneWall' || p.kind === 'mudbrick') {
    const kind = p.kind === 'stoneWall' ? 'stone' : 'mud';
    const runs = dirs.map(d => [c, [c[0] + d[0] / 2, c[1] + d[1] / 2] as P] as [P, P]);
    // draw far runs first
    runs.sort((a, b) => a[1][1] - b[1][1]);
    for (const [from, to] of runs) wallRun(ctx, from, to, 20 * S, 9 * S, p.wood, kind, p.accent, r);
    // centre pillar
    const pt = toneOf(p.wood, 0.3, 0.3);
    const pw = 6 * S, ph = 25 * S;
    ctx.fillStyle = pt.shade; ctx.fillRect(c[0], c[1] - ph, pw, ph + 2 * S);
    ctx.fillStyle = pt.base; ctx.fillRect(c[0] - pw, c[1] - ph, pw, ph + 2 * S);
    ctx.fillStyle = kind === 'stone' ? css(0xeef3f9) : pt.light;
    ctx.beginPath(); poly(ctx, [[c[0] - pw, c[1] - ph], [c[0], c[1] - ph - pw * 0.5], [c[0] + pw, c[1] - ph], [c[0], c[1] - ph + pw * 0.5]]); ctx.fill();
    ctx.strokeStyle = pt.line; ctx.lineWidth = 0.65 * S;
    ctx.strokeRect(c[0] - pw, c[1] - ph, pw * 2, ph + 2 * S);
    if (kind === 'stone' && r() < 0.5) glowAt(ctx, c[0], c[1] - ph - 3 * S, 6 * S, p.accent, 0.3);
    return;
  }
  // Stake palisade: stakes at ±0.2, ±0.4 along each half-line plus the centre.
  const pts: P[] = [c];
  for (const d of dirs) {
    for (const s of [0.2, 0.4]) pts.push([c[0] + d[0] * s, c[1] + d[1] * s]);
  }
  pts.sort((a, b) => a[1] - b[1]);
  const dark = p.kind === 'darkStakes';
  for (const q of pts) {
    const h = (23 + r() * 7) * S;
    stake(ctx, q[0] + (r() - 0.5) * 1.2 * S, q[1], h, 3.1 * S, mixC(p.wood, 0x000000, r() * 0.12), p.band, dark, p.accent, r);
  }
  if (!dark && p.accent && r() < 0.35) {
    // Ivy on a stake
    const q = pts[Math.floor(r() * pts.length)];
    ctx.fillStyle = css(th.outcrop.cap);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse(q[0] + (r() - 0.5) * 5 * S, q[1] - (4 + i * 3.5) * S, 1.6 * S, 1 * S, r(), 0, Math.PI * 2); ctx.fill();
    }
  }
}
