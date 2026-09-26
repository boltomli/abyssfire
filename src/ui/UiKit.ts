/**
 * UiKit — the single source of truth for Abyssfire's dark-fantasy UI look.
 *
 * Every frame, button, slot, divider and orb piece is painted ONCE onto a
 * canvas texture (keyed by size/variant) and reused as a plain Image, so
 * static chrome never costs a per-frame Graphics redraw.
 *
 * Visual language (docs/art-direction.md → UI):
 *   - opaque panels, carved dark-iron frame, gold filigree corners
 *   - warm parchment headings, quality colours for items
 *   - light from the upper left (highlights warm, shadows cool/dark)
 */
import Phaser from 'phaser';

// ─────────────────────────────────────────────────────────────────────────────
// Palette & typography
// ─────────────────────────────────────────────────────────────────────────────

export const UI_FONT = '"Noto Sans SC", sans-serif';
export const UI_TITLE_FONT = '"Cinzel", "Noto Sans SC", serif';

export const UI_COLORS = {
  parchment: '#f0dcae',
  heading: '#e8c77a',
  gold: '#d4a54a',
  goldBright: '#ffd98a',
  text: '#e0d8cc',
  textSoft: '#bfb4a2',
  muted: '#9a8f80',
  dim: '#6e665c',
  faint: '#4f4940',
  good: '#7ed36a',
  bad: '#ff6b5a',
  info: '#7fb6ff',
  goldNum: 0xd4a54a,
  goldDarkNum: 0x5a3a10,
  ironNum: 0x3a3540,
  ironLightNum: 0x6d6573,
  cardNum: 0x18151b,
  cardHoverNum: 0x221d25,
  wellNum: 0x0c0b0e,
} as const;

/** Quality colours (art-direction.md). */
export const QUALITY_HEX: Record<string, string> = {
  normal: '#c8c8c8',
  magic: '#4f8cff',
  rare: '#ffd84a',
  legendary: '#ff8a2a',
  set: '#3ecf6a',
};

export function qualityHex(q: string | null | undefined): string {
  return (q && QUALITY_HEX[q]) || QUALITY_HEX.normal;
}

export function qualityNum(q: string | null | undefined): number {
  return parseInt(qualityHex(q).slice(1), 16);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function numToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** Lighten (amt>0) or darken (amt<0) a hex colour by a 0..1 factor. */
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas helpers
// ─────────────────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.save();
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return key;
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function goldGradient(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff0bd');
  g.addColorStop(0.35, '#e2b35a');
  g.addColorStop(0.7, '#a8772c');
  g.addColorStop(1, '#6e4a18');
  return g;
}

/** Horizontal gold rule that fades at both ends, with a diamond in the middle. */
function drawGoldRule(ctx: Ctx, x: number, y: number, w: number, diamond = true): void {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(212,165,74,0)');
  g.addColorStop(0.15, 'rgba(212,165,74,0.75)');
  g.addColorStop(0.5, 'rgba(255,225,150,0.95)');
  g.addColorStop(0.85, 'rgba(212,165,74,0.75)');
  g.addColorStop(1, 'rgba(212,165,74,0)');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y + 1, w, 1.5);
  ctx.fillStyle = g;
  ctx.fillRect(x, y - 0.5, w, 1.5);
  if (diamond) {
    const cx = x + w / 2;
    ctx.beginPath();
    ctx.moveTo(cx, y - 4.5);
    ctx.lineTo(cx + 5, y + 0.25);
    ctx.lineTo(cx, y + 5);
    ctx.lineTo(cx - 5, y + 0.25);
    ctx.closePath();
    ctx.fillStyle = goldGradient(ctx, cx - 5, y - 5, cx + 5, y + 5);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#3b2507';
    ctx.stroke();
  }
}

function drawRivet(ctx: Ctx, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
  g.addColorStop(0, '#d9d0dc');
  g.addColorStop(0.5, '#7a7280');
  g.addColorStop(1, '#2a252e');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#0a090c';
  ctx.stroke();
}

function drawGem(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
  g.addColorStop(0, shade(color, 0.6));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.6));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#2a1605';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
}

/**
 * Gold filigree corner ornament in local space: the panel's outer corner is
 * (0,0) and the panel extends toward +x/+y. `s` scales the whole ornament.
 */
function drawCornerOrnament(ctx: Ctx, s: number, gem: string | null): void {
  ctx.save();
  ctx.scale(s, s);
  const gold = goldGradient(ctx, 0, 0, 30, 30);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Scroll curls at the end of each arm (drawn first so the plate overlaps)
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#3b2507';
  ctx.beginPath(); ctx.arc(33, 6, 3.4, Math.PI * 1.05, Math.PI * 2.55); ctx.stroke();
  ctx.beginPath(); ctx.arc(6, 33, 3.4, Math.PI * 1.55, Math.PI * 3.05); ctx.stroke();
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = gold;
  ctx.beginPath(); ctx.arc(33, 6, 3.4, Math.PI * 1.05, Math.PI * 2.55); ctx.stroke();
  ctx.beginPath(); ctx.arc(6, 33, 3.4, Math.PI * 1.55, Math.PI * 3.05); ctx.stroke();

  // L-shaped bracket plate hugging the frame
  ctx.beginPath();
  ctx.moveTo(-1.5, -1.5);
  ctx.lineTo(31, -1.5);
  ctx.lineTo(27, 7);
  ctx.lineTo(11, 7);
  ctx.quadraticCurveTo(7, 7, 7, 11);
  ctx.lineTo(7, 27);
  ctx.lineTo(-1.5, 31);
  ctx.closePath();
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#3b2507';
  ctx.stroke();
  // plate highlight (upper-left light)
  ctx.beginPath();
  ctx.moveTo(1, 1); ctx.lineTo(27, 1);
  ctx.moveTo(1, 1); ctx.lineTo(1, 27);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(255,248,220,0.75)';
  ctx.stroke();

  // Leaf pointing into the panel
  ctx.beginPath();
  ctx.moveTo(8.5, 8.5);
  ctx.quadraticCurveTo(21, 10, 21.5, 21.5);
  ctx.quadraticCurveTo(10, 21, 8.5, 8.5);
  ctx.closePath();
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#3b2507';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9.5, 9.5); ctx.lineTo(18.5, 18.5);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(59,37,7,0.8)';
  ctx.stroke();

  if (gem) drawGem(ctx, 3.6, 3.6, 3.3, gem);
  ctx.restore();
}

function eachCorner(ctx: Ctx, x: number, y: number, w: number, h: number, fn: () => void): void {
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    fn();
    ctx.restore();
  }
}

function drawSpeckle(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, density = 110): void {
  const rand = rng(seed);
  const n = Math.floor((w * h) / density);
  for (let i = 0; i < n; i++) {
    const px = x + rand() * w;
    const py = y + rand() * h;
    const light = rand() < 0.45;
    ctx.fillStyle = light ? `rgba(255,236,200,${0.018 + rand() * 0.03})` : `rgba(0,0,0,${0.05 + rand() * 0.08})`;
    const s = 1 + Math.floor(rand() * 2);
    ctx.fillRect(px, py, s, s);
  }
  // A few faint carved strokes to suggest stone grain
  ctx.lineWidth = 1;
  for (let i = 0; i < Math.max(2, Math.floor((w * h) / 26000)); i++) {
    const sx = x + rand() * w;
    const sy = y + rand() * h;
    const len = 18 + rand() * 40;
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + rand() * 0.06})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + len, sy + (rand() - 0.5) * 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,200,0.03)';
    ctx.beginPath();
    ctx.moveTo(sx, sy + 1);
    ctx.lineTo(sx + len, sy + 1 + (rand() - 0.5) * 8);
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel frames
// ─────────────────────────────────────────────────────────────────────────────

export type FrameVariant = 'panel' | 'tooltip' | 'plate';

export interface FrameOptions {
  /** Header band height (0 = none). Panels only. */
  header?: number;
  /** Accent colour for the inner hairline (tooltip quality, boss red…). */
  accent?: number;
  /** Corner gem colour (panels). */
  gem?: number;
  variant?: FrameVariant;
  /** Body alpha (HUD plates may be slightly translucent). */
  alpha?: number;
}

const FRAME_MARGIN: Record<FrameVariant, number> = { panel: 14, tooltip: 10, plate: 8 };

/** Returns the texture key plus the margin (texture extends `margin` px beyond the frame on every side). */
export function frameTexture(scene: Phaser.Scene, w: number, h: number, opts: FrameOptions = {}): { key: string; margin: number } {
  const variant = opts.variant ?? 'panel';
  const header = Math.round(opts.header ?? 0);
  const accent = opts.accent ?? 0xd4a54a;
  const gem = opts.gem ?? 0xb3202a;
  const alpha = opts.alpha ?? 1;
  const M = FRAME_MARGIN[variant];
  const W = Math.round(w), H = Math.round(h);
  const key = `uik_frame_${variant}_${W}x${H}_h${header}_a${accent.toString(16)}_g${gem.toString(16)}_o${Math.round(alpha * 100)}`;
  bake(scene, key, W + M * 2, H + M * 2, (ctx) => {
    const x = M, y = M;
    const isPanel = variant === 'panel';
    const radius = isPanel ? 7 : variant === 'tooltip' ? 5 : 6;
    const band = isPanel ? 5 : variant === 'tooltip' ? 3 : 3.5;
    const accentHex = numToHex(accent);

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = isPanel ? 14 : 8;
    ctx.shadowOffsetY = isPanel ? 5 : 3;
    rr(ctx, x, y, W, H, radius);
    ctx.fillStyle = `rgba(12,10,14,${alpha})`;
    ctx.fill();
    ctx.restore();

    // Body
    ctx.save();
    rr(ctx, x + 2, y + 2, W - 4, H - 4, radius - 1);
    ctx.clip();
    ctx.globalAlpha = alpha;
    const body = ctx.createLinearGradient(0, y, 0, y + H);
    body.addColorStop(0, '#241f26');
    body.addColorStop(0.45, '#19161c');
    body.addColorStop(1, '#0f0d11');
    ctx.fillStyle = body;
    ctx.fillRect(x, y, W, H);
    drawSpeckle(ctx, x, y, W, H, W * 31 + H * 17, isPanel ? 95 : 140);
    // Warm light from the upper left
    const warm = ctx.createRadialGradient(x + W * 0.2, y + H * 0.05, 0, x + W * 0.2, y + H * 0.05, Math.max(W, H) * 0.8);
    warm.addColorStop(0, 'rgba(255,190,110,0.07)');
    warm.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(x, y, W, H);
    // Vignette
    const vg = ctx.createRadialGradient(x + W / 2, y + H * 0.42, Math.min(W, H) * 0.25, x + W / 2, y + H * 0.42, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(x, y, W, H);

    if (header > 0) {
      const hg = ctx.createLinearGradient(0, y, 0, y + header);
      hg.addColorStop(0, 'rgba(120,78,30,0.34)');
      hg.addColorStop(0.6, 'rgba(70,42,16,0.2)');
      hg.addColorStop(1, 'rgba(20,12,6,0.35)');
      ctx.fillStyle = hg;
      ctx.fillRect(x, y, W, header);
      drawGoldRule(ctx, x + 12, y + header, W - 24, true);
    }
    ctx.restore();

    // Iron frame
    ctx.lineJoin = 'round';
    rr(ctx, x + 0.75, y + 0.75, W - 1.5, H - 1.5, radius);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#050407';
    ctx.stroke();
    const inset = 1.5 + band / 2;
    rr(ctx, x + inset, y + inset, W - inset * 2, H - inset * 2, radius - 1);
    const iron = ctx.createLinearGradient(x, y, x + W * 0.35, y + H);
    iron.addColorStop(0, '#77707c');
    iron.addColorStop(0.4, '#4a444f');
    iron.addColorStop(1, '#221e26');
    ctx.lineWidth = band;
    ctx.strokeStyle = iron;
    ctx.stroke();
    // bevel: light top-left edge, dark inner edge
    ctx.save();
    rr(ctx, x + 1.8, y + 1.8, W - 3.6, H - 3.6, radius);
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = 'rgba(255,240,220,0.22)';
    ctx.stroke();
    ctx.restore();
    const innerEdge = 1.5 + band + 0.5;
    rr(ctx, x + innerEdge, y + innerEdge, W - innerEdge * 2, H - innerEdge * 2, Math.max(2, radius - 2));
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#08070a';
    ctx.stroke();
    const hair = innerEdge + 1.5;
    rr(ctx, x + hair, y + hair, W - hair * 2, H - hair * 2, Math.max(2, radius - 3));
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(accentHex, variant === 'tooltip' ? 0.85 : 0.6);
    ctx.stroke();

    if (isPanel) {
      // Rivets along the band
      const ry = y + inset;
      const spacing = 110;
      for (let rx = x + 60; rx < x + W - 50; rx += spacing) {
        drawRivet(ctx, rx, ry, 1.9);
        drawRivet(ctx, rx, y + H - inset, 1.9);
      }
      for (let ryy = y + 60; ryy < y + H - 50; ryy += spacing) {
        drawRivet(ctx, x + inset, ryy, 1.9);
        drawRivet(ctx, x + W - inset, ryy, 1.9);
      }
      eachCorner(ctx, x, y, W, H, () => drawCornerOrnament(ctx, 1, numToHex(gem)));
    } else if (variant === 'tooltip') {
      eachCorner(ctx, x, y, W, H, () => drawCornerOrnament(ctx, 0.5, null));
    } else {
      eachCorner(ctx, x, y, W, H, () => drawCornerOrnament(ctx, 0.42, null));
    }
  });
  return { key, margin: M };
}

/** Adds a baked frame image so that the frame's rectangle is at (x, y, w, h). */
export function addFrame(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: FrameOptions = {}): Phaser.GameObjects.Image {
  const { key, margin } = frameTexture(scene, w, h, opts);
  return scene.add.image(x - margin, y - margin, key).setOrigin(0, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Close button
// ─────────────────────────────────────────────────────────────────────────────

function closeTexture(scene: Phaser.Scene, hover: boolean): string {
  const S = 30;
  return bake(scene, `uik_close_${hover ? 'h' : 'n'}`, S, S, (ctx) => {
    const c = S / 2, r = 10.5;
    if (hover) {
      const glow = ctx.createRadialGradient(c, c, r * 0.6, c, c, S / 2);
      glow.addColorStop(0, 'rgba(255,90,60,0.45)');
      glow.addColorStop(1, 'rgba(255,90,60,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, S, S);
    }
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    const iron = ctx.createLinearGradient(c - r, c - r, c + r, c + r);
    iron.addColorStop(0, hover ? '#6a3a32' : '#4f4953');
    iron.addColorStop(1, hover ? '#2a100c' : '#1b181e');
    ctx.fillStyle = iron;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = goldGradient(ctx, c - r, c - r, c + r, c + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, r + 1.3, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#050407';
    ctx.stroke();
    const d = 4.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c - d, c - d); ctx.lineTo(c + d, c + d);
    ctx.moveTo(c + d, c - d); ctx.lineTo(c - d, c + d);
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = '#1a0503';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hover ? '#ffb09a' : '#e0634e';
    ctx.stroke();
  });
}

/** A round iron medallion close button (centre at x, y). */
export function addCloseButton(scene: Phaser.Scene, x: number, y: number, onClose: () => void): Phaser.GameObjects.Image {
  const nKey = closeTexture(scene, false);
  const hKey = closeTexture(scene, true);
  const img = scene.add.image(x, y, nKey).setInteractive({ useHandCursor: true });
  img.on('pointerover', () => img.setTexture(hKey));
  img.on('pointerout', () => { img.setTexture(nKey); img.setScale(1); });
  img.on('pointerdown', () => { img.setScale(0.9); onClose(); });
  img.on('pointerup', () => img.setScale(1));
  return img;
}

// ─────────────────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
type ButtonState = 'normal' | 'hover' | 'pressed' | 'disabled';

const BUTTON_STYLE: Record<ButtonVariant, { top: string; bottom: string; border: string; text: string; hoverText: string }> = {
  primary: { top: '#6b4a1e', bottom: '#2c1d0b', border: '#d4a54a', text: '#ffe7b0', hoverText: '#fff4d6' },
  secondary: { top: '#3a353f', bottom: '#17151a', border: '#8a7a64', text: '#e0d8cc', hoverText: '#fff4e0' },
  danger: { top: '#5a1c16', bottom: '#220a08', border: '#c0503c', text: '#ffb8a6', hoverText: '#ffe0d6' },
  success: { top: '#27451f', bottom: '#0e1b0c', border: '#6fb35a', text: '#c6f0b4', hoverText: '#eaffe0' },
  ghost: { top: '#1d1a20', bottom: '#141216', border: '#4d4552', text: '#bfb4a2', hoverText: '#f0dcae' },
};

export function buttonTextColor(variant: ButtonVariant, state: ButtonState): string {
  if (state === 'disabled') return '#6a635c';
  const s = BUTTON_STYLE[variant];
  return state === 'normal' ? s.text : s.hoverText;
}

function buttonTexture(scene: Phaser.Scene, w: number, h: number, variant: ButtonVariant, state: ButtonState): { key: string; margin: number } {
  const W = Math.round(w), H = Math.round(h), M = 5;
  const key = `uik_btn_${variant}_${state}_${W}x${H}`;
  bake(scene, key, W + M * 2, H + M * 2, (ctx) => {
    const st = BUTTON_STYLE[variant];
    const x = M, y = M + (state === 'pressed' ? 1 : 0);
    const r = Math.min(5, H / 3);
    const disabled = state === 'disabled';
    const top = disabled ? '#2a282c' : state === 'hover' ? shade(st.top, 0.18) : state === 'pressed' ? shade(st.top, -0.25) : st.top;
    const bottom = disabled ? '#141316' : state === 'hover' ? shade(st.bottom, 0.12) : st.bottom;
    const border = disabled ? '#3d3a40' : state === 'hover' ? shade(st.border, 0.3) : st.border;

    if (state === 'hover') {
      ctx.save();
      ctx.shadowColor = rgba(st.border, 0.7);
      ctx.shadowBlur = 8;
      rr(ctx, x, y, W, H, r);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
    } else if (state !== 'pressed') {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 2;
      rr(ctx, x, y, W, H, r);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
    }

    rr(ctx, x, y, W, H, r);
    const g = ctx.createLinearGradient(0, y, 0, y + H);
    if (state === 'pressed') {
      g.addColorStop(0, bottom);
      g.addColorStop(1, top);
    } else {
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
    }
    ctx.fillStyle = g;
    ctx.fill();
    // top sheen
    if (state !== 'pressed' && !disabled) {
      ctx.save();
      rr(ctx, x + 1, y + 1, W - 2, H / 2, r);
      ctx.clip();
      const sheen = ctx.createLinearGradient(0, y, 0, y + H / 2);
      sheen.addColorStop(0, 'rgba(255,240,210,0.16)');
      sheen.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x, y, W, H / 2);
      ctx.restore();
    }
    rr(ctx, x + 0.5, y + 0.5, W - 1, H - 1, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#050407';
    ctx.stroke();
    rr(ctx, x + 1.5, y + 1.5, W - 3, H - 3, Math.max(1, r - 1));
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = border;
    ctx.stroke();
    // tiny end studs for wider buttons
    if (W >= 70 && H >= 22 && !disabled) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      for (const sx of [x + 6, x + W - 6]) {
        ctx.beginPath();
        ctx.moveTo(sx, y + H / 2 - 3);
        ctx.lineTo(sx + 2.6, y + H / 2);
        ctx.lineTo(sx, y + H / 2 + 3);
        ctx.lineTo(sx - 2.6, y + H / 2);
        ctx.closePath();
        ctx.fillStyle = border;
        ctx.fill();
      }
      ctx.restore();
    }
  });
  return { key, margin: M };
}

export interface ButtonOptions {
  variant?: ButtonVariant;
  fontSize?: number;
  disabled?: boolean;
  bold?: boolean;
  fontFamily?: string;
  /** Override label colour (normal state). */
  color?: string;
  onClick?: (pointer: Phaser.Input.Pointer) => void;
}

/**
 * Framed button (centre at x, y). Fires `onClick` on pointerdown (same timing
 * as the legacy text buttons) and shows hover / pressed / disabled states.
 */
export class UiButton extends Phaser.GameObjects.Container {
  readonly bg: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  private variant: ButtonVariant;
  private bw: number;
  private bh: number;
  private enabled: boolean;
  private customColor?: string;
  private hovered = false;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, opts: ButtonOptions = {}) {
    super(scene, x, y);
    this.variant = opts.variant ?? 'secondary';
    this.bw = w;
    this.bh = h;
    this.enabled = !opts.disabled;
    this.customColor = opts.color;
    const { key } = buttonTexture(scene, w, h, this.variant, this.enabled ? 'normal' : 'disabled');
    this.bg = scene.add.image(0, 0, key);
    this.label = scene.add.text(0, 0, text, {
      fontSize: `${Math.round(opts.fontSize ?? 13)}px`,
      fontFamily: opts.fontFamily ?? UI_FONT,
      color: this.enabled ? (opts.color ?? buttonTextColor(this.variant, 'normal')) : buttonTextColor(this.variant, 'disabled'),
      fontStyle: opts.bold ? 'bold' : 'normal',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.bg.setInteractive({ useHandCursor: this.enabled });
    this.bg.on('pointerover', () => { this.hovered = true; this.applyState('hover'); });
    this.bg.on('pointerout', () => { this.hovered = false; this.applyState('normal'); });
    this.bg.on('pointerup', () => this.applyState(this.hovered ? 'hover' : 'normal'));
    this.bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled) return;
      this.applyState('pressed');
      opts.onClick?.(pointer);
    });
    scene.add.existing(this);
  }

  private applyState(state: ButtonState): void {
    if (!this.active || !this.bg.active) return;
    const s: ButtonState = this.enabled ? state : 'disabled';
    this.bg.setTexture(buttonTexture(this.scene, this.bw, this.bh, this.variant, s).key);
    this.label.setColor(s === 'normal' && this.customColor ? this.customColor : buttonTextColor(this.variant, s));
    this.label.setY(s === 'pressed' ? 1 : 0);
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.bg.input && (this.bg.input.cursor = v ? 'pointer' : 'default');
    this.applyState('normal');
    return this;
  }

  setLabel(text: string, color?: string): this {
    this.label.setText(text);
    if (color) { this.customColor = color; this.label.setColor(color); }
    return this;
  }
}

export function addButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, opts: ButtonOptions = {}): UiButton {
  return new UiButton(scene, x, y, w, h, text, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

export function tabTexture(scene: Phaser.Scene, w: number, h: number, active: boolean, accent: number): string {
  const W = Math.round(w), H = Math.round(h);
  return bake(scene, `uik_tab_${active ? 'a' : 'i'}_${W}x${H}_${accent.toString(16)}`, W, H + 2, (ctx) => {
    const acc = numToHex(accent);
    const r = 5;
    ctx.beginPath();
    ctx.moveTo(0.5, H);
    ctx.lineTo(0.5, r);
    ctx.quadraticCurveTo(0.5, 0.5, r, 0.5);
    ctx.lineTo(W - r, 0.5);
    ctx.quadraticCurveTo(W - 0.5, 0.5, W - 0.5, r);
    ctx.lineTo(W - 0.5, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (active) {
      g.addColorStop(0, shade(acc, -0.45));
      g.addColorStop(0.5, '#221d25');
      g.addColorStop(1, '#1a161c');
    } else {
      g.addColorStop(0, '#1a171d');
      g.addColorStop(1, '#0f0d11');
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = active ? acc : '#3a343f';
    ctx.stroke();
    if (active) {
      ctx.fillStyle = acc;
      ctx.fillRect(4, H - 2.5, W - 8, 2.5);
      const sheen = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      sheen.addColorStop(0, 'rgba(255,240,210,0.18)');
      sheen.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(2, 2, W - 4, H * 0.5);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(1, H - 3, W - 2, 3);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dividers, flourishes, section headers
// ─────────────────────────────────────────────────────────────────────────────

/** Gold rule centred at (cx, y) spanning `w`. */
export function addDivider(scene: Phaser.Scene, cx: number, y: number, w: number, diamond = true): Phaser.GameObjects.Image {
  const W = Math.max(8, Math.round(w));
  const key = bake(scene, `uik_div_${W}_${diamond ? 1 : 0}`, W, 12, (ctx) => drawGoldRule(ctx, 0, 6, W, diamond));
  return scene.add.image(cx, y, key);
}

/** Vertical iron/gold divider (top at y). */
export function addVDivider(scene: Phaser.Scene, x: number, y: number, h: number): Phaser.GameObjects.Image {
  const H = Math.max(8, Math.round(h));
  const key = bake(scene, `uik_vdiv_${H}`, 6, H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(212,165,74,0)');
    g.addColorStop(0.1, 'rgba(212,165,74,0.55)');
    g.addColorStop(0.9, 'rgba(212,165,74,0.55)');
    g.addColorStop(1, 'rgba(212,165,74,0)');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(3, 0, 1.5, H);
    ctx.fillStyle = g;
    ctx.fillRect(2, 0, 1, H);
  });
  return scene.add.image(x, y, key).setOrigin(0.5, 0);
}

/** Small gold flourish (points left when flipX = false: curl on the outer end). */
function flourishTexture(scene: Phaser.Scene): string {
  return bake(scene, 'uik_flourish', 46, 12, (ctx) => {
    const gold = goldGradient(ctx, 0, 0, 46, 12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(10, 6);
    ctx.lineTo(42, 6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2a1a05';
    ctx.stroke();
    const g = ctx.createLinearGradient(6, 0, 44, 0);
    g.addColorStop(0, 'rgba(226,179,90,0.2)');
    g.addColorStop(1, 'rgba(255,230,160,1)');
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = g;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, 6, 3.2, 0, Math.PI * 1.6);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = gold;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(42, 2.5); ctx.lineTo(45.5, 6); ctx.lineTo(42, 9.5); ctx.lineTo(38.5, 6); ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#2a1a05';
    ctx.stroke();
  });
}

/** Two gold flourishes flanking a centred title of width `textW`. */
export function addTitleFlourishes(scene: Phaser.Scene, cx: number, cy: number, textW: number): Phaser.GameObjects.Image[] {
  const key = flourishTexture(scene);
  const gap = 8;
  const left = scene.add.image(cx - textW / 2 - gap, cy, key).setOrigin(1, 0.5);
  const right = scene.add.image(cx + textW / 2 + gap, cy, key).setOrigin(1, 0.5).setFlipX(true);
  right.setOrigin(0, 0.5);
  return [left, right];
}

/** Section header: small gold caps label followed by a fading rule. Returns [text, rule]. */
export function addSectionHeader(scene: Phaser.Scene, x: number, y: number, w: number, label: string, color: string = UI_COLORS.heading): Phaser.GameObjects.GameObject[] {
  const text = scene.add.text(x, y, label, {
    fontSize: '12px', fontFamily: UI_FONT, color, fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0, 0.5);
  const ruleX = x + text.width + 8;
  const ruleW = Math.max(10, Math.round(w - text.width - 8));
  const key = bake(scene, `uik_srule_${ruleW}`, ruleW, 4, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, ruleW, 0);
    g.addColorStop(0, 'rgba(212,165,74,0.7)');
    g.addColorStop(1, 'rgba(212,165,74,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 1, ruleW, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 2, ruleW, 1);
  });
  const rule = scene.add.image(ruleX, y, key).setOrigin(0, 0.5);
  return [text, rule];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards (Graphics — drawn once per state change, never per frame)
// ─────────────────────────────────────────────────────────────────────────────

export interface CardStyle {
  fill?: number;
  border?: number;
  borderAlpha?: number;
  borderWidth?: number;
  glow?: number;
  /** Left accent strip colour. */
  strip?: number;
  radius?: number;
}

/** Draw an inset card (row/tile inside a panel) onto a Graphics object. */
export function drawCard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, style: CardStyle = {}): Phaser.GameObjects.Graphics {
  const r = style.radius ?? 4;
  const fill = style.fill ?? UI_COLORS.cardNum;
  const border = style.border ?? 0x3a343f;
  if (style.glow !== undefined) {
    g.lineStyle(4, style.glow, 0.12);
    g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    g.lineStyle(2, style.glow, 0.22);
    g.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, r + 1);
  }
  g.fillStyle(0x000000, 0.45);
  g.fillRoundedRect(x, y + 1.5, w, h, r);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
  // top sheen + bottom shade
  g.fillStyle(0xfff0d8, 0.045);
  g.fillRect(x + 2, y + 1, w - 4, Math.min(h / 2, 14));
  g.fillStyle(0x000000, 0.18);
  g.fillRect(x + 2, y + h - Math.min(h / 3, 8), w - 4, Math.min(h / 3, 8) - 1);
  if (style.strip !== undefined) {
    g.fillStyle(style.strip, 0.9);
    g.fillRect(x + 1, y + 3, 3, h - 6);
  }
  g.lineStyle(style.borderWidth ?? 1, border, style.borderAlpha ?? 1);
  g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  g.lineStyle(1, 0xfff0d8, 0.06);
  g.lineBetween(x + r, y + 1.5, x + w - r, y + 1.5);
  return g;
}

/** Recessed well (progress-bar trough, icon backing) on a Graphics object. */
export function drawWell(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius = 3, border = 0x3a343f): Phaser.GameObjects.Graphics {
  g.fillStyle(0x060508, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.fillStyle(0x000000, 0.5);
  g.fillRect(x + 1, y + 1, w - 2, Math.min(3, h / 3));
  g.lineStyle(1, border, 1);
  g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, radius);
  return g;
}

/** Gradient-filled bar onto Graphics (fill part only). */
export function drawBarFill(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): Phaser.GameObjects.Graphics {
  if (w <= 0) return g;
  const hi = Phaser.Display.Color.IntegerToColor(color).clone().lighten(22).color;
  const lo = Phaser.Display.Color.IntegerToColor(color).clone().darken(30).color;
  g.fillGradientStyle(hi, hi, lo, lo, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(x, y, w, Math.max(1, h * 0.3));
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Item slots
// ─────────────────────────────────────────────────────────────────────────────

/** Texture for an item slot well framed in the item's quality colour (null = empty). */
export function slotTexture(scene: Phaser.Scene, size: number, quality: string | null, hover = false): { key: string; margin: number } {
  const S = Math.round(size), M = 6;
  const q = quality ?? 'empty';
  const key = `uik_slot_${S}_${q}_${hover ? 'h' : 'n'}`;
  bake(scene, key, S + M * 2, S + M * 2, (ctx) => {
    const x = M, y = M, r = 4;
    const col = quality ? qualityHex(quality) : '#4a4350';
    const special = quality === 'legendary' || quality === 'set';
    if (special || hover) {
      ctx.save();
      ctx.shadowColor = rgba(quality ? col : '#d4a54a', special ? 0.9 : 0.6);
      ctx.shadowBlur = special ? 9 : 6;
      rr(ctx, x, y, S, S, r);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
    }
    rr(ctx, x, y, S, S, r);
    const bg = ctx.createRadialGradient(x + S / 2, y + S * 0.45, 0, x + S / 2, y + S / 2, S * 0.72);
    if (quality && quality !== 'normal') {
      bg.addColorStop(0, rgba(col, 0.28));
      bg.addColorStop(0.55, '#141117');
      bg.addColorStop(1, '#070609');
    } else {
      bg.addColorStop(0, quality ? '#211d25' : '#17141a');
      bg.addColorStop(1, '#070609');
    }
    ctx.fillStyle = bg;
    ctx.fill();
    // inner shadow at the top (recessed)
    ctx.save();
    rr(ctx, x, y, S, S, r);
    ctx.clip();
    const ish = ctx.createLinearGradient(0, y, 0, y + S * 0.3);
    ish.addColorStop(0, 'rgba(0,0,0,0.6)');
    ish.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ish;
    ctx.fillRect(x, y, S, S * 0.3);
    ctx.restore();
    // outer dark line + quality frame
    rr(ctx, x + 0.5, y + 0.5, S - 1, S - 1, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#030204';
    ctx.stroke();
    rr(ctx, x + 1.5, y + 1.5, S - 3, S - 3, r - 1);
    ctx.lineWidth = quality && quality !== 'normal' ? 1.6 : 1.2;
    ctx.strokeStyle = hover ? shade(col, 0.35) : col;
    ctx.globalAlpha = quality ? 1 : 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // lower-right bevel highlight (light bounces into the well)
    ctx.beginPath();
    ctx.moveTo(x + 3, y + S - 2.5);
    ctx.lineTo(x + S - 2.5, y + S - 2.5);
    ctx.lineTo(x + S - 2.5, y + 3);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255,240,220,0.12)';
    ctx.stroke();
    // corner ticks for rare+
    if (quality === 'rare' || special) {
      const t = Math.max(4, S * 0.18);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = shade(col, 0.35);
      const pts: [number, number, number, number][] = [[x + 1, y + 1, 1, 1], [x + S - 1, y + 1, -1, 1], [x + 1, y + S - 1, 1, -1], [x + S - 1, y + S - 1, -1, -1]];
      for (const [cx, cy, sx, sy] of pts) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * t, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * t);
        ctx.stroke();
      }
    }
  });
  return { key, margin: M };
}

/** Item slot image centred at (cx, cy). */
export function addSlot(scene: Phaser.Scene, cx: number, cy: number, size: number, quality: string | null): Phaser.GameObjects.Image {
  return scene.add.image(cx, cy, slotTexture(scene, size, quality).key);
}

/** Make a slot image react to hover by swapping to its highlighted texture. */
export function wireSlotHover(scene: Phaser.Scene, slot: Phaser.GameObjects.Image, size: number, quality: string | null): void {
  const n = slotTexture(scene, size, quality, false).key;
  const h = slotTexture(scene, size, quality, true).key;
  slot.on('pointerover', () => slot.active && slot.setTexture(h));
  slot.on('pointerout', () => slot.active && slot.setTexture(n));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bars
// ─────────────────────────────────────────────────────────────────────────────

/** Framed bar trough texture (w×h is the inner fill area; frame adds 3px). */
export function barFrameTexture(scene: Phaser.Scene, w: number, h: number): { key: string; pad: number } {
  const W = Math.round(w), H = Math.round(h), P = 3;
  const key = `uik_barframe_${W}x${H}`;
  bake(scene, key, W + P * 2, H + P * 2, (ctx) => {
    rr(ctx, 0.5, 0.5, W + P * 2 - 1, H + P * 2 - 1, (H + P * 2) / 2.2);
    const iron = ctx.createLinearGradient(0, 0, 0, H + P * 2);
    iron.addColorStop(0, '#5f5864');
    iron.addColorStop(1, '#1f1b22');
    ctx.fillStyle = iron;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#040305';
    ctx.stroke();
    rr(ctx, P - 0.5, P - 0.5, W + 1, H + 1, (H + 1) / 2.2);
    ctx.fillStyle = '#070609';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(212,165,74,0.5)';
    ctx.stroke();
  });
  return { key, pad: P };
}

/** Gradient bar fill texture (used with setCrop for the current value). */
export function barFillTexture(scene: Phaser.Scene, w: number, h: number, color: number): string {
  const W = Math.round(w), H = Math.round(h);
  return bake(scene, `uik_barfill_${W}x${H}_${color.toString(16)}`, W, H, (ctx) => {
    const hex = numToHex(color);
    rr(ctx, 0, 0, W, H, H / 2.2);
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(hex, 0.35));
    g.addColorStop(0.45, hex);
    g.addColorStop(1, shade(hex, -0.45));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, 0, W, Math.max(1, H * 0.28));
    ctx.restore();
  });
}

/** Segment tick overlay for long bars (EXP). */
export function barTicksTexture(scene: Phaser.Scene, w: number, h: number, segments: number): string {
  const W = Math.round(w), H = Math.round(h);
  return bake(scene, `uik_barticks_${W}x${H}_${segments}`, W, H, (ctx) => {
    for (let i = 1; i < segments; i++) {
      const x = Math.round((W * i) / segments);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - 1, 0, 1, H);
      ctx.fillStyle = 'rgba(212,165,74,0.35)';
      ctx.fillRect(x, 0, 1, H);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD orb (HP / MP globe) pieces
// ─────────────────────────────────────────────────────────────────────────────

export interface OrbTextures {
  back: string;
  liquid: string;
  glass: string;
  rim: string;
  /** Liquid tile height (surface sits `surface` px below the tile top). */
  liquidH: number;
  surface: number;
}

/** Bake the layered textures for a glass liquid orb of radius r. */
export function orbTextures(scene: Phaser.Scene, r: number, name: string, liquid: number): OrbTextures {
  const R = Math.round(r);
  const D = R * 2;
  const liqHex = numToHex(liquid);
  const surface = 7;
  const liquidH = D + surface + 4;
  const TILE = 64;

  const back = bake(scene, `uik_orb_back_${R}`, D, D, (ctx) => {
    const g = ctx.createRadialGradient(R, R * 0.8, R * 0.1, R, R, R);
    g.addColorStop(0, '#1b1720');
    g.addColorStop(1, '#040305');
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });

  const liquidKey = bake(scene, `uik_orb_liq_${name}_${R}`, TILE, liquidH, (ctx) => {
    // wavy surface — period = TILE so the texture tiles horizontally
    const wave = (x: number) => surface + Math.sin((x / TILE) * Math.PI * 2) * 1.8 + Math.sin((x / TILE) * Math.PI * 4 + 1) * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, wave(0));
    for (let x = 1; x <= TILE; x++) ctx.lineTo(x, wave(x));
    ctx.lineTo(TILE, liquidH);
    ctx.lineTo(0, liquidH);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, liquidH);
    g.addColorStop(0, shade(liqHex, 0.25));
    g.addColorStop(0.18, liqHex);
    g.addColorStop(0.7, shade(liqHex, -0.35));
    g.addColorStop(1, shade(liqHex, -0.6));
    ctx.fillStyle = g;
    ctx.fill();
    // swirling darker veins
    ctx.save();
    ctx.clip();
    const rand = rng(R * 7 + name.length);
    for (let i = 0; i < 5; i++) {
      const y0 = surface + 8 + rand() * (liquidH - surface - 16);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.bezierCurveTo(TILE * 0.3, y0 - 6, TILE * 0.7, y0 + 6, TILE, y0);
      ctx.lineWidth = 3 + rand() * 3;
      ctx.strokeStyle = `rgba(0,0,0,${0.06 + rand() * 0.06})`;
      ctx.stroke();
    }
    // bubbles
    for (let i = 0; i < 7; i++) {
      const bx = 4 + rand() * (TILE - 8);
      const by = surface + 10 + rand() * (liquidH - surface - 20);
      const br = 0.8 + rand() * 1.6;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();
    }
    ctx.restore();
    // meniscus: bright band along the surface
    ctx.beginPath();
    ctx.moveTo(0, wave(0));
    for (let x = 1; x <= TILE; x++) ctx.lineTo(x, wave(x));
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba('#ffffff', 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, wave(0) + 2.2);
    for (let x = 1; x <= TILE; x++) ctx.lineTo(x, wave(x) + 2.2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
  });

  const glass = bake(scene, `uik_orb_glass_${R}`, D, D, (ctx) => {
    // spherical inner shadow
    const sh = ctx.createRadialGradient(R * 0.85, R * 0.75, R * 0.35, R, R, R);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(0.75, 'rgba(0,0,0,0.18)');
    sh.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.fillStyle = sh;
    ctx.fill();
    // big soft specular (upper left)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(R * 0.72, R * 0.52, R * 0.5, R * 0.3, -0.6, 0, Math.PI * 2);
    const sp = ctx.createRadialGradient(R * 0.62, R * 0.42, 0, R * 0.72, R * 0.52, R * 0.55);
    sp.addColorStop(0, 'rgba(255,255,255,0.55)');
    sp.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp;
    ctx.fill();
    ctx.restore();
    // small hard glint
    ctx.beginPath();
    ctx.ellipse(R * 0.55, R * 0.4, R * 0.1, R * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    // lower-right reflected rim light
    ctx.beginPath();
    ctx.arc(R, R, R * 0.86, Math.PI * 0.1, Math.PI * 0.6);
    ctx.lineWidth = R * 0.07;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.stroke();
  });

  const rimPad = 11;
  const rimSize = D + rimPad * 2;
  const rim = bake(scene, `uik_orb_rim_${R}`, rimSize, rimSize, (ctx) => {
    const c = rimSize / 2;
    // iron ring
    ctx.beginPath();
    ctx.arc(c, c, R + 4, 0, Math.PI * 2);
    ctx.arc(c, c, R - 1.5, 0, Math.PI * 2, true);
    const iron = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
    iron.addColorStop(0, '#8a828e');
    iron.addColorStop(0.45, '#4a444f');
    iron.addColorStop(1, '#1d1a20');
    ctx.fillStyle = iron;
    ctx.fill('evenodd');
    // gold inner and outer lips
    ctx.beginPath();
    ctx.arc(c, c, R - 1, 0, Math.PI * 2);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = goldGradient(ctx, c - R, c - R, c + R, c + R);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, R + 4.5, 0, Math.PI * 2);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, R + 5.8, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#040305';
    ctx.stroke();
    // prongs at 45° positions + studs on the cardinal points
    const gold = goldGradient(ctx, c - R, c - R, c + R, c + R);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * (R + 2), c + Math.sin(a) * (R + 2));
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-3, -5);
      ctx.lineTo(8, 0);
      ctx.lineTo(-3, 5);
      ctx.quadraticCurveTo(0, 0, -3, -5);
      ctx.closePath();
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#3b2507';
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      drawRivet(ctx, c + Math.cos(a) * (R + 1.3), c + Math.sin(a) * (R + 1.3), 1.8);
    }
  });

  return { back, liquid: liquidKey, glass, rim, liquidH, surface };
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD pieces
// ─────────────────────────────────────────────────────────────────────────────

/** Framed skill-bar slot (square). */
export function skillSlotTexture(scene: Phaser.Scene, size: number, state: 'normal' | 'hover' | 'empty'): { key: string; margin: number } {
  const S = Math.round(size), M = 4;
  const key = `uik_skslot_${S}_${state}`;
  bake(scene, key, S + M * 2, S + M * 2, (ctx) => {
    const x = M, y = M, r = 4;
    if (state === 'hover') {
      ctx.save();
      ctx.shadowColor = 'rgba(255,200,110,0.8)';
      ctx.shadowBlur = 7;
      rr(ctx, x, y, S, S, r);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
    }
    rr(ctx, x, y, S, S, r);
    const bg = ctx.createRadialGradient(x + S / 2, y + S / 2, 0, x + S / 2, y + S / 2, S * 0.7);
    bg.addColorStop(0, '#1d1a21');
    bg.addColorStop(1, '#060508');
    ctx.fillStyle = bg;
    ctx.fill();
    rr(ctx, x + 1.25, y + 1.25, S - 2.5, S - 2.5, r);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = state === 'empty'
      ? '#39333e'
      : goldGradient(ctx, x, y, x + S, y + S);
    ctx.stroke();
    rr(ctx, x + 0.5, y + 0.5, S - 1, S - 1, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#040305';
    ctx.stroke();
    rr(ctx, x + 3, y + 3, S - 6, S - 6, r - 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.stroke();
    if (state === 'hover') {
      rr(ctx, x + 3, y + 3, S - 6, S - 6, r - 1);
      ctx.fillStyle = 'rgba(255,220,150,0.08)';
      ctx.fill();
    }
  });
  return { key, margin: M };
}

/** Small dark key-cap badge (e.g. skill hotkey number). */
export function keyBadgeTexture(scene: Phaser.Scene, w: number, h: number): string {
  const W = Math.round(w), H = Math.round(h);
  return bake(scene, `uik_keycap_${W}x${H}`, W, H, (ctx) => {
    rr(ctx, 0.5, 0.5, W - 1, H - 1, 3);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b2630');
    g.addColorStop(1, '#0c0a0e');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(212,165,74,0.8)';
    ctx.stroke();
  });
}

/** Wide carved plate behind the skill bar. */
export function hudPlateTexture(scene: Phaser.Scene, w: number, h: number): string {
  const W = Math.round(w), H = Math.round(h);
  return bake(scene, `uik_hudplate_${W}x${H}`, W, H + 6, (ctx) => {
    const r = 10;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    rr(ctx, 2, 2, W - 4, H - 2, r);
    ctx.fillStyle = '#0d0b0f';
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, 2, 2, W - 4, H - 2, r);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c2730');
    g.addColorStop(0.5, '#1a171d');
    g.addColorStop(1, '#0e0c10');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawSpeckle(ctx, 0, 0, W, H, W + H, 80);
    ctx.restore();
    rr(ctx, 2.5, 2.5, W - 5, H - 3, r);
    ctx.lineWidth = 3;
    const iron = ctx.createLinearGradient(0, 0, 0, H);
    iron.addColorStop(0, '#6d6573');
    iron.addColorStop(1, '#241f27');
    ctx.strokeStyle = iron;
    ctx.stroke();
    rr(ctx, 1, 1, W - 2, H, r + 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#040305';
    ctx.stroke();
    // gold trim along the top
    drawGoldRule(ctx, 30, 4.5, W - 60, false);
  });
}

/** Rounded ornate frame for the minimap (inner square size). */
export function minimapFrameTexture(scene: Phaser.Scene, size: number): { key: string; pad: number } {
  const S = Math.round(size), P = 9;
  const key = `uik_mmframe_${S}`;
  bake(scene, key, S + P * 2, S + P * 2, (ctx) => {
    const T = S + P * 2;
    // frame ring (evenodd)
    ctx.beginPath();
    rr(ctx, 2, 2, T - 4, T - 4, 8);
    ctx.rect(P - 1, P - 1, S + 2, S + 2);
    const iron = ctx.createLinearGradient(0, 0, T, T);
    iron.addColorStop(0, '#7a7280');
    iron.addColorStop(0.45, '#46404b');
    iron.addColorStop(1, '#1d1a20');
    ctx.fillStyle = iron;
    ctx.fill('evenodd');
    rr(ctx, 2, 2, T - 4, T - 4, 8);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#040305';
    ctx.stroke();
    ctx.strokeStyle = goldGradient(ctx, 0, 0, T, T);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(P - 1.5, P - 1.5, S + 3, S + 3);
    // inner vignette over the map
    const vg = ctx.createRadialGradient(T / 2, T / 2, S * 0.3, T / 2, T / 2, S * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(P, P, S, S);
    eachCorner(ctx, 2, 2, T - 4, T - 4, () => drawCornerOrnament(ctx, 0.55, null));
    // compass N marker
    ctx.beginPath();
    ctx.moveTo(T / 2, 0.5);
    ctx.lineTo(T / 2 + 4.5, 7);
    ctx.lineTo(T / 2, 5.5);
    ctx.lineTo(T / 2 - 4.5, 7);
    ctx.closePath();
    ctx.fillStyle = goldGradient(ctx, T / 2 - 5, 0, T / 2 + 5, 8);
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#3b2507';
    ctx.stroke();
  });
  return { key, pad: P };
}

/** Round coin glyph for gold displays. */
export function coinTexture(scene: Phaser.Scene, size = 14): string {
  const S = Math.round(size);
  return bake(scene, `uik_coin_${S}`, S, S, (ctx) => {
    const c = S / 2, r = S / 2 - 1;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = goldGradient(ctx, 0, 0, S, S);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#3b2507';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, r * 0.58, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(90,58,16,0.8)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c - r * 0.35, c - r * 0.35, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  });
}

/** Diamond pip (active/inactive) for level indicators. */
export function pipTexture(scene: Phaser.Scene, size: number, color: number | null): string {
  const S = Math.round(size);
  const key = `uik_pip_${S}_${color === null ? 'off' : color.toString(16)}`;
  return bake(scene, key, S + 2, S + 2, (ctx) => {
    const c = (S + 2) / 2, r = S / 2;
    ctx.beginPath();
    ctx.moveTo(c, c - r); ctx.lineTo(c + r, c); ctx.lineTo(c, c + r); ctx.lineTo(c - r, c); ctx.closePath();
    if (color === null) {
      ctx.fillStyle = '#0d0b0f';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#3f3845';
      ctx.stroke();
    } else {
      const hex = numToHex(color);
      const g = ctx.createLinearGradient(c - r, c - r, c + r, c + r);
      g.addColorStop(0, shade(hex, 0.5));
      g.addColorStop(1, shade(hex, -0.3));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = shade(hex, -0.65);
      ctx.stroke();
    }
  });
}

/** Full-screen dim backdrop texture with a soft vignette (for modal dialogs). */
export function backdropTexture(scene: Phaser.Scene, w: number, h: number): string {
  const W = Math.round(w), H = Math.round(h);
  return bake(scene, `uik_backdrop_${W}x${H}`, W / 4, H / 4, (ctx) => {
    const g = ctx.createRadialGradient(W / 8, H / 8, Math.min(W, H) / 16, W / 8, H / 8, Math.max(W, H) / 7);
    g.addColorStop(0, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W / 4, H / 4);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Touch controls (mobile)
// ─────────────────────────────────────────────────────────────────────────────

/** Virtual joystick base ring + thumb knob textures. */
export function joystickTextures(scene: Phaser.Scene, r: number): { base: string; thumb: string } {
  const R = Math.round(r);
  const S = R * 2 + 8;
  const base = bake(scene, `uik_joy_base_${R}`, S, S, (ctx) => {
    const c = S / 2;
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(c, c, R * 0.2, c, c, R);
    g.addColorStop(0, 'rgba(20,16,24,0.25)');
    g.addColorStop(1, 'rgba(8,6,10,0.6)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(90,82,96,0.85)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, R - 3, 0, Math.PI * 2);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(212,165,74,0.75)';
    ctx.stroke();
    // direction chevrons
    ctx.fillStyle = 'rgba(232,199,122,0.7)';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * (R - 11), c + Math.sin(a) * (R - 11));
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(5, 0); ctx.lineTo(-3, -5); ctx.lineTo(-3, 5); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });
  const tr = Math.round(R * 0.45);
  const TS = tr * 2 + 6;
  const thumb = bake(scene, `uik_joy_thumb_${tr}`, TS, TS, (ctx) => {
    const c = TS / 2;
    ctx.beginPath();
    ctx.arc(c, c, tr, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(c - tr * 0.35, c - tr * 0.35, 0, c, c, tr);
    g.addColorStop(0, '#8a828e');
    g.addColorStop(0.6, '#3a3540');
    g.addColorStop(1, '#16131a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = goldGradient(ctx, c - tr, c - tr, c + tr, c + tr);
    ctx.stroke();
    drawGem(ctx, c, c, tr * 0.28, '#d4a54a');
  });
  return { base, thumb };
}

/** Round medallion button texture for touch actions (dodge / target). */
export function medallionTexture(scene: Phaser.Scene, size: number, color: number): string {
  const S = Math.round(size);
  return bake(scene, `uik_medal_${S}_${color.toString(16)}`, S + 6, S + 6, (ctx) => {
    const c = (S + 6) / 2, r = S / 2;
    const hex = numToHex(color);
    ctx.beginPath();
    ctx.arc(c, c + 1.5, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.4, 0, c, c, r);
    g.addColorStop(0, shade(hex, 0.35));
    g.addColorStop(0.7, hex);
    g.addColorStop(1, shade(hex, -0.55));
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = goldGradient(ctx, c - r, c - r, c + r, c + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, r + 1.2, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#050407';
    ctx.stroke();
  });
}
