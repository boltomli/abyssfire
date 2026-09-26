/**
 * Shared drawing kit for procedural icons (items, skills, UI glyphs).
 *
 * Icons are authored in a 96×96 unit space and composited with the same
 * cel-shading language as the rigged characters (see rig/Rig.ts): 2–3 tones
 * per material, coloured line art, light from the upper left, plus a thin dark
 * ink silhouette so the icon reads on any slot background.
 */
import { cel, tone, glow, type Tone, type V } from '../sprites/rig/Rig';

export { cel, tone, glow };
export type { Tone, V };

export const UNIT = 96;

export function P(x: number, y: number): V {
  return { x, y };
}

// ── Colour helpers ──────────────────────────────────────────────────────

function rgbOf(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

/** Mix two hex colours, returning a hex colour. */
export function mixHex(a: number, b: number, t: number): number {
  const x = rgbOf(a);
  const y = rgbOf(b);
  const r = Math.round(x[0] + (y[0] - x[0]) * t);
  const g = Math.round(x[1] + (y[1] - x[1]) * t);
  const bl = Math.round(x[2] + (y[2] - x[2]) * t);
  return (r << 16) | (g << 8) | bl;
}

export function css(c: number, a = 1): string {
  const [r, g, b] = rgbOf(c);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

/** Icon-scale cel shading defaults (bands sized for a 96-unit icon). */
export function celI(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  t: Tone,
  opts: { band?: number; hi?: number; stroke?: number; noLight?: boolean } = {},
): void {
  cel(ctx, path, t, { band: opts.band ?? 3, hi: opts.hi ?? 1.3, stroke: opts.stroke ?? 1.4, noLight: opts.noLight });
}

// ── Paths ───────────────────────────────────────────────────────────────

/**
 * Closed ribbon around a centreline. `w(t)` returns [left, right] half-widths
 * (left = the side to the left of the travel direction in screen space).
 */
export function ribbonPath(
  ctx: CanvasRenderingContext2D,
  pts: readonly V[],
  w: number | ((t: number, i: number) => [number, number] | number),
): void {
  const n = pts.length;
  const left: V[] = [];
  const right: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;
    const ww = typeof w === 'number' ? w : w(i / (n - 1), i);
    const [wl, wr] = typeof ww === 'number' ? [ww, ww] : ww;
    left.push(P(pts[i].x + nx * wl, pts[i].y + ny * wl));
    right.push(P(pts[i].x - nx * wr, pts[i].y - ny * wr));
  }
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
}

/** Sample a function into a polyline. */
export function sample(n: number, f: (t: number) => V): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) out.push(f(i / n));
  return out;
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, r1: number, r2: number, rot = -Math.PI / 2): void {
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ── Accents ─────────────────────────────────────────────────────────────

/** Four-point twinkle. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#ffffff', alpha = 1): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  const k = r * 0.2;
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** Soft highlight stroke (specular streak). */
export function streak(ctx: CanvasRenderingContext2D, pts: readonly V[], width: number, color = 'rgba(255,255,255,0.8)'): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 3) ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
  else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

export function line(ctx: CanvasRenderingContext2D, pts: readonly V[], width: number, color: string, closed = false): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Run `fn` clipped to `path`. */
export function clipTo(ctx: CanvasRenderingContext2D, path: () => void, fn: () => void): void {
  ctx.save();
  ctx.beginPath();
  path();
  ctx.clip();
  fn();
  ctx.restore();
}

// ── Faceted gems ────────────────────────────────────────────────────────

/**
 * A faceted gem seen from above: outer girdle polygon, an inner table and
 * the facets between them, each shaded by how much it faces the light.
 */
export function facetGem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outline: readonly V[],
  color: number,
  opts: { table?: number; tableOffset?: V; stroke?: number; sparkles?: number; ink?: boolean } = {},
): void {
  const t = tone(color, { shadow: 0.5, light: 0.45 });
  const k = opts.table ?? 0.52;
  const off = opts.tableOffset ?? P(-0.06, -0.08);
  const outer = outline.map((p) => P(cx + p.x, cy + p.y));
  let maxR = 0;
  for (const p of outline) maxR = Math.max(maxR, Math.hypot(p.x, p.y));
  const inner = outline.map((p) => P(cx + p.x * k + off.x * maxR, cy + p.y * k + off.y * maxR));
  const deep = css(mixHex(color, 0x100820, 0.62));
  const glint = css(mixHex(color, 0xffffff, 0.72));
  const light = t.light;
  const base = t.base;
  const shade = t.shade;
  const n = outer.length;
  const pathOuter = (): void => {
    ctx.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(outer[i].x, outer[i].y);
    ctx.closePath();
  };
  ctx.save();
  // Body
  ctx.beginPath();
  pathOuter();
  ctx.fillStyle = base;
  ctx.fill();
  // Facets
  for (let i = 0; i < n; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % n];
    const c = inner[(i + 1) % n];
    const d = inner[i];
    const mx = (a.x + b.x) / 2 - cx;
    const my = (a.y + b.y) / 2 - cy;
    const len = Math.hypot(mx, my) || 1;
    const facing = (-mx * 0.72 - my * 0.7) / len; // 1 = faces upper-left light
    const alt = i % 2 === 0 ? 0.12 : -0.12;
    const f = facing + alt;
    let fill: string;
    if (f > 0.62) fill = glint;
    else if (f > 0.18) fill = light;
    else if (f > -0.3) fill = base;
    else if (f > -0.7) fill = shade;
    else fill = deep;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    // Star facet split for sparkle: a thin line from table corner to girdle midpoint
    ctx.strokeStyle = css(mixHex(color, 0xffffff, 0.35), 0.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
  }
  // Table
  ctx.beginPath();
  ctx.moveTo(inner[0].x, inner[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(inner[i].x, inner[i].y);
  ctx.closePath();
  const tc = inner.reduce((s, p) => P(s.x + p.x / n, s.y + p.y / n), P(0, 0));
  const g = ctx.createLinearGradient(tc.x - maxR * k, tc.y - maxR * k, tc.x + maxR * k, tc.y + maxR * k);
  g.addColorStop(0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = css(mixHex(color, 0xffffff, 0.5), 0.8);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // Inner reflection: a lighter wedge on the table's upper-left
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(tc.x - maxR, tc.y - maxR * 0.2);
  ctx.lineTo(tc.x + maxR * 0.1, tc.y - maxR);
  ctx.lineTo(tc.x + maxR * 0.25, tc.y - maxR);
  ctx.lineTo(tc.x - maxR, tc.y + maxR * 0.05);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.restore();
  // Girdle line art
  ctx.beginPath();
  pathOuter();
  ctx.strokeStyle = t.line;
  ctx.lineWidth = opts.stroke ?? 1.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  // Specular sparkles
  const sp = opts.sparkles ?? 1;
  if (sp > 0) sparkle(ctx, tc.x - maxR * 0.28, tc.y - maxR * 0.22, maxR * 0.34, '#ffffff', 0.95);
  if (sp > 1) sparkle(ctx, cx + maxR * 0.5, cy + maxR * 0.35, maxR * 0.2, '#ffffff', 0.8);
}

/** Polygon points for common gem cuts, radius r. */
export function gemCut(kind: 'oval' | 'round' | 'emerald' | 'pear' | 'trillion' | 'marquise', r: number): V[] {
  const pts: V[] = [];
  switch (kind) {
    case 'round':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        pts.push(P(Math.cos(a) * r, Math.sin(a) * r));
      }
      return pts;
    case 'oval':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        pts.push(P(Math.cos(a) * r * 0.8, Math.sin(a) * r));
      }
      return pts;
    case 'emerald': {
      const w = r * 0.72;
      const h = r;
      const c = r * 0.28;
      return [P(-w + c, -h), P(w - c, -h), P(w, -h + c), P(w, h - c), P(w - c, h), P(-w + c, h), P(-w, h - c), P(-w, -h + c)];
    }
    case 'pear':
      for (let i = 0; i < 11; i++) {
        const a = -Math.PI / 2 + (i / 11) * Math.PI * 2;
        const top = Math.sin(a) < 0 ? 1 - 0.55 * Math.pow(-Math.sin(a), 3) : 1;
        pts.push(P(Math.cos(a) * r * 0.78 * top, Math.sin(a) * r + (Math.sin(a) < 0 ? -r * 0.12 : 0)));
      }
      return pts;
    case 'marquise':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        pts.push(P(Math.cos(a) * r * 0.6 * Math.pow(Math.abs(Math.cos(a)), 0.2), Math.sin(a) * r));
      }
      return pts;
    case 'trillion': {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        const b = a + Math.PI / 3;
        pts.push(P(Math.cos(a) * r, Math.sin(a) * r));
        pts.push(P(Math.cos(b) * r * 0.62, Math.sin(b) * r * 0.62));
      }
      return pts;
    }
  }
}

// ── Compositing ─────────────────────────────────────────────────────────

export interface InkOpts {
  /** Ink outline colour and width (units). */
  ink?: string;
  inkWidth?: number;
  /** Soft drop shadow toward the lower right (default on). */
  shadow?: boolean;
  /** Warm rim light along upper-left edges; width in units (0 = off). */
  rim?: number;
  /** Painted before the inked body (e.g. glows), in unit space. */
  under?: (c: CanvasRenderingContext2D) => void;
  /** Painted after the inked body (sparkles, glints), in unit space. */
  over?: (c: CanvasRenderingContext2D) => void;
  /** Uniform scale about the icon centre. */
  scale?: number;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toUnit(c: CanvasRenderingContext2D, size: number, k: number): void {
  const s = size / UNIT;
  c.scale(s, s);
  if (k !== 1) {
    c.translate(UNIT / 2, UNIT / 2);
    c.scale(k, k);
    c.translate(-UNIT / 2, -UNIT / 2);
  }
}

/**
 * Draw `draw` (unit space) into `ctx` at `size` px with an ink silhouette,
 * optional rim light and a soft drop shadow.
 */
export function inked(ctx: CanvasRenderingContext2D, size: number, draw: (c: CanvasRenderingContext2D) => void, opts: InkOpts = {}): void {
  const k = opts.scale ?? 1;
  const s = (size / UNIT) * k;
  const [body, bx] = makeCanvas(size, size);
  bx.save();
  toUnit(bx, size, k);
  draw(bx);
  bx.restore();

  const rimW = (opts.rim ?? 1.1) * s;
  if (rimW > 0) {
    const [rim, rx] = makeCanvas(size, size);
    rx.drawImage(body, 0, 0);
    rx.globalCompositeOperation = 'source-in';
    rx.fillStyle = 'rgba(255,240,210,0.45)';
    rx.fillRect(0, 0, size, size);
    rx.globalCompositeOperation = 'destination-out';
    rx.drawImage(body, rimW, rimW);
    bx.save();
    bx.globalCompositeOperation = 'source-atop';
    bx.drawImage(rim, 0, 0);
    bx.restore();
  }

  const [out, ox] = makeCanvas(size, size);
  const inkW = (opts.inkWidth ?? 2) * s;
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ox.drawImage(body, Math.cos(a) * inkW, Math.sin(a) * inkW);
  }
  ox.globalCompositeOperation = 'source-in';
  ox.fillStyle = opts.ink ?? '#140c1c';
  ox.fillRect(0, 0, size, size);
  ox.globalCompositeOperation = 'source-over';
  ox.drawImage(body, 0, 0);

  ctx.save();
  if (opts.under) {
    ctx.save();
    toUnit(ctx, size, k);
    opts.under(ctx);
    ctx.restore();
  }
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 3 * s;
    ctx.shadowOffsetX = 1.5 * s;
    ctx.shadowOffsetY = 2.5 * s;
  }
  ctx.drawImage(out, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  if (opts.over) {
    ctx.save();
    toUnit(ctx, size, k);
    opts.over(ctx);
    ctx.restore();
  }
  ctx.restore();
}
