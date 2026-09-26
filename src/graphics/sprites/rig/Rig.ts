/**
 * Lightweight 2D character rig for procedurally drawn, hand-animated sprites.
 *
 * Characters are authored in a 96×96 "unit" space (ground at y = GROUND_Y),
 * facing right in a 3/4 view. Poses are keyframed as absolute joint targets;
 * limbs are solved with two-bone IK so feet stay planted and hands land where
 * the animator put them. Rendering helpers give a consistent cel-shaded,
 * ink-outlined look across every rigged character.
 */

export interface V {
  x: number;
  y: number;
}

export const GROUND_Y = 91;
export const CENTER_X = 48;

export function vec(x: number, y: number): V {
  return { x, y };
}

export function add(a: V, b: V): V {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function lerpV(a: V, b: V, t: number): V {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function dist(a: V, b: V): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Unit vector for an "upward" bone angle: 0 = straight up, + = leaning forward (+x). */
export function dirUp(angle: number): V {
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

/** Point at `len` along an upward-angle bone from `from`. */
export function along(from: V, angle: number, len: number): V {
  const d = dirUp(angle);
  return { x: from.x + d.x * len, y: from.y + d.y * len };
}

/**
 * Two-bone IK. `bend` = +1 puts the middle joint toward +x (knees),
 * -1 toward -x (elbows hanging back). Unreachable targets are clamped.
 */
export function solveIK(root: V, target: V, l1: number, l2: number, bend: number): { mid: V; end: V } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const raw = Math.hypot(dx, dy);
  const d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, raw || 0.01));
  const base = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const midAng = base - Math.sign(bend || 1) * a;
  return {
    mid: { x: root.x + Math.cos(midAng) * l1, y: root.y + Math.sin(midAng) * l1 },
    end: { x: root.x + Math.cos(base) * d, y: root.y + Math.sin(base) * d },
  };
}

// ── Keyframed poses ─────────────────────────────────────────────────────

export type Ease = 'smooth' | 'in' | 'out' | 'linear' | 'hold';

export interface Key<P> {
  at: number;
  pose: P;
  /** Easing used when travelling *into* this key. */
  ease?: Ease;
}

function applyEase(t: number, ease: Ease): number {
  switch (ease) {
    case 'in': return t * t * t;
    case 'out': return 1 - Math.pow(1 - t, 3);
    case 'linear': return t;
    case 'hold': return t < 1 ? 0 : 1;
    default: return t * t * (3 - 2 * t);
  }
}

type Numeric = number | { [k: string]: Numeric };

function lerpDeep<T>(a: T, b: T, t: number): T {
  if (typeof a === 'number' && typeof b === 'number') {
    return (a + (b - a) * t) as T;
  }
  const out: Record<string, Numeric> = {};
  const ao = a as unknown as Record<string, Numeric>;
  const bo = b as unknown as Record<string, Numeric>;
  for (const key of Object.keys(ao)) {
    out[key] = bo[key] === undefined ? ao[key] : lerpDeep(ao[key], bo[key], t);
  }
  return out as unknown as T;
}

/** Sample a keyframe track at t ∈ [0, 1]. */
export function samplePoseTrack<P>(keys: readonly Key<P>[], t: number): P {
  if (keys.length === 0) throw new Error('empty pose track');
  const tt = Math.max(0, Math.min(1, t));
  if (tt <= keys[0].at) return keys[0].pose;
  for (let i = 1; i < keys.length; i++) {
    const prev = keys[i - 1];
    const next = keys[i];
    if (tt <= next.at) {
      const span = Math.max(0.0001, next.at - prev.at);
      const local = applyEase((tt - prev.at) / span, next.ease ?? 'smooth');
      return lerpDeep(prev.pose, next.pose, local);
    }
  }
  return keys[keys.length - 1].pose;
}

// ── Palettes & shading ──────────────────────────────────────────────────

export interface Tone {
  base: string;
  shade: string;
  light: string;
  line: string;
}

function hex(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

function toCss([r, g, b]: [number, number, number], a = 1): string {
  return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

function mix(c: [number, number, number], d: [number, number, number], t: number): [number, number, number] {
  return [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t, c[2] + (d[2] - c[2]) * t];
}

/**
 * Build a cel-shading tone from one base colour. Shadows shift toward a cool
 * purple and highlights toward warm light, which reads richer than plain
 * darken/lighten.
 */
export function tone(base: number, opts: { shadow?: number; light?: number } = {}): Tone {
  const c = hex(base);
  const shadowAmt = opts.shadow ?? 0.42;
  const lightAmt = opts.light ?? 0.32;
  const shade = mix(mix(c, [30, 20, 60], 0.35), [0, 0, 0], shadowAmt);
  const light = mix(c, [255, 244, 214], lightAmt);
  const line = mix(mix(c, [20, 10, 30], 0.5), [0, 0, 0], 0.55);
  return { base: toCss(c), shade: toCss(shade), light: toCss(light), line: toCss(line) };
}

export function rgba(c: number, a: number): string {
  return toCss(hex(c), a);
}

/**
 * Cel-shade an arbitrary closed path: shadow band on the lower-right edge,
 * highlight band on the upper-left edge (light comes from the top-left), and
 * a thin coloured line-art stroke.
 */
export function cel(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  t: Tone,
  opts: { band?: number; hi?: number; stroke?: number; noLight?: boolean } = {},
): void {
  const band = opts.band ?? 1.4;
  const hi = opts.hi ?? 0.7;
  ctx.save();
  ctx.beginPath();
  path();
  ctx.fillStyle = t.shade;
  ctx.fill();
  ctx.clip();
  if (!opts.noLight) {
    ctx.save();
    ctx.translate(-band, -band);
    ctx.beginPath();
    path();
    ctx.fillStyle = t.light;
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(-band + (opts.noLight ? 0 : hi), -band + (opts.noLight ? 0 : hi));
  ctx.beginPath();
  path();
  ctx.fillStyle = t.base;
  ctx.fill();
  ctx.restore();
  ctx.restore();

  const stroke = opts.stroke ?? 0.55;
  if (stroke > 0) {
    ctx.beginPath();
    path();
    ctx.strokeStyle = t.line;
    ctx.lineWidth = stroke;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** Tapered capsule path from a (radius ra) to b (radius rb). */
export function capsulePath(ctx: CanvasRenderingContext2D, a: V, b: V, ra: number, rb: number): void {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const d = Math.max(0.001, dist(a, b));
  // Tangent offset so the sides meet both end circles smoothly.
  const off = Math.asin(Math.max(-1, Math.min(1, (ra - rb) / d)));
  const p = Math.PI / 2 + off;
  ctx.moveTo(a.x + Math.cos(ang + p) * ra, a.y + Math.sin(ang + p) * ra);
  ctx.arc(a.x, a.y, ra, ang + p, ang - p + Math.PI * 2, false);
  ctx.lineTo(b.x + Math.cos(ang - p) * rb, b.y + Math.sin(ang - p) * rb);
  ctx.arc(b.x, b.y, rb, ang - p, ang + p, false);
  ctx.closePath();
}

export function limb(ctx: CanvasRenderingContext2D, a: V, b: V, ra: number, rb: number, t: Tone, band?: number): void {
  cel(ctx, () => capsulePath(ctx, a, b, ra, rb), t, { band: band ?? Math.min(ra, rb) * 0.45 });
}

export function ellipsePath(ctx: CanvasRenderingContext2D, c: V, rx: number, ry: number, rot = 0): void {
  ctx.ellipse(c.x, c.y, rx, ry, rot, 0, Math.PI * 2);
}

export function polyPath(ctx: CanvasRenderingContext2D, pts: readonly V[]): void {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Smooth closed curve through points (quadratic midpoints). */
export function blobPath(ctx: CanvasRenderingContext2D, pts: readonly V[]): void {
  const n = pts.length;
  const mid = (i: number): V => lerpV(pts[i % n], pts[(i + 1) % n], 0.5);
  const m0 = mid(n - 1);
  ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  ctx.closePath();
}

/**
 * Run `fn` in bone space: origin at `a`, +y pointing from a toward b,
 * +x to the bone's right. Handy for armour plates and weapon heads.
 */
export function inBone(ctx: CanvasRenderingContext2D, a: V, b: V, fn: (len: number) => void): void {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
  fn(dist(a, b));
  ctx.restore();
}

/** Glow blob with additive-looking falloff (drawn with 'lighter'). */
export function glow(ctx: CanvasRenderingContext2D, c: V, r: number, color: number, alpha: number): void {
  if (alpha <= 0.01 || r <= 0) return;
  const [cr, cg, cb] = hex(color);
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
  g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${alpha * 0.45})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Motion smear: a crescent swept by a weapon between successive tip/base
 * samples (oldest first). Bright at the leading edge, fading toward the tail.
 */
export function smear(
  ctx: CanvasRenderingContext2D,
  tips: readonly V[],
  bases: readonly V[],
  color: number,
  alpha: number,
): void {
  if (tips.length < 2 || alpha <= 0.02) return;
  const [r, g, b] = hex(color);
  ctx.save();
  for (let i = 1; i < tips.length; i++) {
    const k = i / (tips.length - 1);
    ctx.beginPath();
    ctx.moveTo(bases[i - 1].x, bases[i - 1].y);
    ctx.lineTo(tips[i - 1].x, tips[i - 1].y);
    ctx.lineTo(tips[i].x, tips[i].y);
    ctx.lineTo(bases[i].x, bases[i].y);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha * k * k})`;
    ctx.fill();
  }
  // Hot leading edge along the tip path
  ctx.beginPath();
  ctx.moveTo(tips[0].x, tips[0].y);
  for (let i = 1; i < tips.length; i++) ctx.lineTo(tips[i].x, tips[i].y);
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/**
 * Chain of cloth points hanging from `anchor`, trailing opposite the motion.
 * `flow` 0 = hanging still, 1 = streaming straight back.
 */
export function clothChain(anchor: V, length: number, segments: number, flow: number, wave: number, phase: number): V[] {
  const pts: V[] = [anchor];
  const seg = length / segments;
  for (let i = 1; i <= segments; i++) {
    const k = i / segments;
    // Angle from straight down; positive swings the cloth back (-x).
    const ang = flow * 1.2 * (0.6 + 0.4 * k) + Math.sin(phase - k * 2.2) * wave * 0.35 * k;
    const prev = pts[i - 1];
    pts.push({ x: prev.x - Math.sin(ang) * seg, y: prev.y + Math.cos(ang) * seg });
  }
  return pts;
}

// ── Frame compositing ───────────────────────────────────────────────────

const canvasCache = new Map<string, HTMLCanvasElement>();
const GLOW_DOWNSAMPLE = 3;

function scratch(name: string, w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const key = `${name}:${w}x${h}`;
  let c = canvasCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    canvasCache.set(key, c);
  }
  // CPU-backed like the sheet canvases (DrawUtils.createCanvas): mixing
  // GPU scratch canvases with a willReadFrequently sheet forces a GPU→CPU
  // readback on every composite, which made sheet generation ~15× slower.
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, w, h);
  return [c, x];
}

export interface FrameFinish {
  /** Ink outline colour and width in units. */
  ink?: string;
  inkWidth?: number;
  /** Rim light colour (upper-left edges). */
  rim?: string;
  rimWidth?: number;
  /** Soft outer glow (zone-harmonised), applied when compositing. */
  glowColor?: string;
  glowBlur?: number;
  /** Whole-sprite opacity (death fades, dodge blur). */
  alpha?: number;
  /** Darken toward the feet for grounding; 0..1. */
  grounding?: number;
  /** Uniform scale about the ground centre (character size in the frame). */
  scale?: number;
}

function toUnits(c: CanvasRenderingContext2D, w: number, s: number, k: number): void {
  c.scale(s, s);
  c.translate((w / s - 96) / 2, 0);
  if (k !== 1) {
    c.translate(CENTER_X, GROUND_Y);
    c.scale(k, k);
    c.translate(-CENTER_X, -GROUND_Y);
  }
}

/**
 * Render a rigged character: `draw` paints the body (in unit space) and the
 * result gets a solid ink silhouette outline, rim light and foot grounding
 * before being composited into the sheet cell.
 */
export function renderRigFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
  finish: FrameFinish = {},
  under?: (c: CanvasRenderingContext2D) => void,
  over?: (c: CanvasRenderingContext2D) => void,
): void {
  const s = h / 96;
  const k = finish.scale ?? 1;
  const [body, bx] = scratch('body', w, h);
  bx.save();
  toUnits(bx, w, s, k);
  draw(bx);
  bx.restore();

  // Grounding: slight cool darkening toward the feet.
  const grounding = finish.grounding ?? 0.22;
  if (grounding > 0) {
    bx.save();
    bx.globalCompositeOperation = 'source-atop';
    const g = bx.createLinearGradient(0, h * 0.62, 0, h * 0.95);
    g.addColorStop(0, 'rgba(10,8,24,0)');
    g.addColorStop(1, `rgba(10,8,24,${grounding})`);
    bx.fillStyle = g;
    bx.fillRect(0, 0, w, h);
    bx.restore();
  }

  // Rim light: silhouette minus itself shifted toward the lower-right.
  const rimW = (finish.rimWidth ?? 0.9) * s;
  if (finish.rim !== 'none') {
    const [rim, rx] = scratch('rim', w, h);
    rx.drawImage(body, 0, 0);
    rx.globalCompositeOperation = 'source-in';
    rx.fillStyle = finish.rim ?? 'rgba(255,236,200,0.55)';
    rx.fillRect(0, 0, w, h);
    rx.globalCompositeOperation = 'destination-out';
    rx.drawImage(body, rimW, rimW);
    bx.save();
    bx.globalCompositeOperation = 'source-atop';
    bx.drawImage(rim, 0, 0);
    bx.restore();
  }

  // Ink outline: stamp the silhouette around a ring, tint it, body on top.
  const [out, ox] = scratch('out', w, h);
  const inkW = (finish.inkWidth ?? 1.1) * s;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ox.drawImage(body, Math.cos(a) * inkW, Math.sin(a) * inkW);
  }
  ox.globalCompositeOperation = 'source-in';
  ox.fillStyle = finish.ink ?? '#120c18';
  ox.fillRect(0, 0, w, h);
  ox.globalCompositeOperation = 'source-over';
  ox.drawImage(body, 0, 0);

  ctx.save();
  if (under) {
    ctx.save();
    toUnits(ctx, w, s, k);
    under(ctx);
    ctx.restore();
  }
  ctx.globalAlpha = finish.alpha ?? 1;
  if (finish.glowColor) {
    // The glow is soft, so blur a 1/3-size copy and upscale it — full-size
    // shadowBlur was the single most expensive step of sheet generation.
    const gw = Math.ceil(w / GLOW_DOWNSAMPLE), gh = Math.ceil(h / GLOW_DOWNSAMPLE);
    const [glowC, gx] = scratch('glow', gw, gh);
    // Draw the silhouette off-canvas so only its shadow lands.
    gx.shadowColor = finish.glowColor;
    gx.shadowBlur = (finish.glowBlur ?? 6) / GLOW_DOWNSAMPLE;
    gx.shadowOffsetX = gw * 2;
    gx.drawImage(out, -gw * 2, 0, w / GLOW_DOWNSAMPLE, h / GLOW_DOWNSAMPLE);
    gx.shadowBlur = 0;
    gx.shadowOffsetX = 0;
    gx.shadowColor = 'transparent';
    ctx.drawImage(glowC, 0, 0, gw * GLOW_DOWNSAMPLE, gh * GLOW_DOWNSAMPLE);
  }
  ctx.drawImage(out, 0, 0);
  if (over) {
    ctx.save();
    toUnits(ctx, w, s, k);
    over(ctx);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Give a legacy (non-rig) sprite frame the same ink silhouette and rim light
 * as rigged characters. Legacy drawers bake a soft glow into their pixels,
 * so the outline traces an alpha-thresholded mask instead of raw alpha.
 */
export function inkLegacyFrame(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  w: number,
  h: number,
  opts: { inkPx?: number; ink?: string; rim?: string } = {},
): void {
  const [mask, mx] = scratch('lmask', w, h);
  const sctx = src.getContext('2d')!;
  const img = sctx.getImageData(0, 0, w, h);
  const out = mx.createImageData(w, h);
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] > 110) out.data[i] = 255;
  }
  mx.putImageData(out, 0, 0);

  const inkPx = opts.inkPx ?? 2.6;
  const [ring, rx] = scratch('lring', w, h);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rx.drawImage(mask, Math.cos(a) * inkPx, Math.sin(a) * inkPx);
  }
  rx.globalCompositeOperation = 'source-in';
  rx.fillStyle = opts.ink ?? '#120c18';
  rx.fillRect(0, 0, w, h);
  rx.globalCompositeOperation = 'destination-out';
  rx.drawImage(mask, 0, 0);

  // Rim: mask minus itself shifted down-right, tinted, clipped to the body.
  const [rim, rmx] = scratch('lrim', w, h);
  rmx.drawImage(mask, 0, 0);
  rmx.globalCompositeOperation = 'destination-out';
  rmx.drawImage(mask, inkPx * 0.9, inkPx * 0.9);
  rmx.globalCompositeOperation = 'source-in';
  rmx.fillStyle = opts.rim ?? 'rgba(255,236,200,0.4)';
  rmx.fillRect(0, 0, w, h);

  ctx.drawImage(ring, 0, 0);
  ctx.drawImage(src, 0, 0);
  ctx.drawImage(rim, 0, 0);
}

/** Soft contact shadow on the ground, shrinking as the body leaves it. */
export function groundShadow(ctx: CanvasRenderingContext2D, x: number, rx: number, lift: number): void {
  const k = Math.max(0.45, 1 - lift / 24);
  const r = rx * k;
  ctx.save();
  ctx.translate(x, GROUND_Y + 0.5);
  ctx.scale(1, 0.32);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(8,6,16,${0.45 * (0.6 + 0.4 * k)})`);
  g.addColorStop(0.65, 'rgba(8,6,16,0.26)');
  g.addColorStop(1, 'rgba(8,6,16,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Normalised time for a sheet frame: loops exclude the end, one-shots include it. */
export function frameTime(frame: number, count: number, loop: boolean): number {
  if (count <= 1) return 0;
  return loop ? frame / count : frame / (count - 1);
}
