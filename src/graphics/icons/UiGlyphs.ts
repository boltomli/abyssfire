/**
 * Small painted UI glyphs in the same cel-shaded, inked style as item icons.
 *
 *   ensureGlyph(scene, id) -> texture key `glyph_<id>` (GLYPH_SIZE² px,
 *   transparent background), generated on first use. Display at ~14–32 px.
 *
 * Glyph ids:
 *   gold             – stacked gold coins (currency)
 *   str dex vit int spi lck – stat icons: fist, feather, heart+, spellbook,
 *                      spirit flame, four-leaf clover
 *   atk def          – sword, shield (attack / defence)
 *   hp mp            – red life orb, blue mana orb
 *   quest_available  – gold "!" quest marker
 *   quest_complete   – gold "?" quest turn-in marker
 *   close            – round red close button with an X
 *   sort             – sort (bars + down arrow)
 */
import Phaser from 'phaser';
import { capsulePath, ellipsePath, polyPath } from '../sprites/rig/Rig';
import { P, celI, tone, glow, css, mixHex, roundRectPath, sparkle, streak, line, clipTo, inked, starPath, type InkOpts } from './IconKit';
import { heaterPath, drawBladeMotif } from './ItemIcons';

export const GLYPH_SIZE = 64;

export type GlyphId =
  | 'gold' | 'str' | 'dex' | 'vit' | 'int' | 'spi' | 'lck' | 'atk' | 'def' | 'hp' | 'mp'
  | 'quest_available' | 'quest_complete' | 'close' | 'sort';

export const GLYPH_IDS: readonly GlyphId[] = [
  'gold', 'str', 'dex', 'vit', 'int', 'spi', 'lck', 'atk', 'def', 'hp', 'mp',
  'quest_available', 'quest_complete', 'close', 'sort',
];

export function glyphKey(id: string): string {
  return `glyph_${id}`;
}

export function ensureGlyph(scene: Phaser.Scene, id: GlyphId | string): string {
  const key = glyphKey(id);
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = GLYPH_SIZE;
  canvas.height = GLYPH_SIZE;
  drawGlyph(canvas.getContext('2d')!, id, GLYPH_SIZE);
  scene.textures.addCanvas(key, canvas);
  return key;
}

export function drawGlyph(ctx: CanvasRenderingContext2D, id: GlyphId | string, size: number): void {
  const g = GLYPHS[id as GlyphId] ?? GLYPHS.quest_available;
  inked(ctx, size, g.draw, { inkWidth: 3.2, rim: 1.4, ...g.opts });
}

interface Glyph {
  draw: (c: CanvasRenderingContext2D) => void;
  opts?: InkOpts;
}

const GOLD = 0xf0c040;

function coin(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const t = tone(GOLD, { light: 0.5 });
  celI(c, () => ellipsePath(c, P(x + 2, y + 5), r, r * 0.62), tone(0xb07818), { band: 1, hi: 0.4, noLight: true });
  celI(c, () => ellipsePath(c, P(x, y), r, r * 0.62), t, { band: 3, hi: 1.2 });
  c.beginPath(); c.ellipse(x, y, r * 0.68, r * 0.4, 0, 0, Math.PI * 2); c.strokeStyle = t.shade; c.lineWidth = 2; c.stroke();
  c.save(); c.translate(x, y); c.scale(1, 0.62);
  c.beginPath(); starPath(c, 0, 0, 4, r * 0.4, r * 0.14); c.fillStyle = t.light; c.fill();
  c.restore();
}

function orbGlyph(color: number): Glyph {
  return {
    draw: (c) => {
      const t = tone(color, { light: 0.5 });
      const g = c.createRadialGradient(38, 36, 4, 48, 50, 36);
      g.addColorStop(0, css(mixHex(color, 0xffffff, 0.6)));
      g.addColorStop(0.5, t.base);
      g.addColorStop(1, t.shade);
      c.beginPath(); c.arc(48, 50, 34, 0, Math.PI * 2); c.fillStyle = g; c.fill();
      c.strokeStyle = t.line; c.lineWidth = 2; c.stroke();
      clipTo(c, () => c.arc(48, 50, 34, 0, Math.PI * 2), () => {
        c.fillStyle = css(mixHex(color, 0x000000, 0.25), 0.6);
        c.beginPath(); c.moveTo(0, 60); c.quadraticCurveTo(30, 52, 48, 60); c.quadraticCurveTo(70, 68, 96, 58); c.lineTo(96, 96); c.lineTo(0, 96); c.closePath(); c.fill();
      });
      c.beginPath(); c.ellipse(36, 34, 10, 6, -0.6, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
    },
  };
}

const GLYPHS: Record<GlyphId, Glyph> = {
  gold: {
    draw: (c) => {
      coin(c, 36, 64, 26);
      coin(c, 60, 52, 26);
      coin(c, 44, 34, 24);
    },
    opts: { over: (c) => sparkle(c, 30, 26, 8) },
  },
  str: {
    draw: (c) => {
      const ft = tone(0xe0a070, { light: 0.4 });
      celI(c, () => roundRectPath(c, 20, 26, 56, 50, 14), ft, { band: 3.4, hi: 1.4 });
      for (let i = 0; i < 4; i++) celI(c, () => ellipsePath(c, P(28 + i * 13.3, 28), 7.5, 9), ft, { band: 2, hi: 0.8 });
      celI(c, () => capsulePath(c, P(20, 56), P(52, 50), 8, 7), ft, { band: 2, hi: 0.8 });
      celI(c, () => roundRectPath(c, 22, 72, 52, 18, 4), tone(0xc83030), { band: 2, hi: 0.8 });
    },
  },
  dex: {
    draw: (c) => {
      const ft = tone(0x5ad070, { light: 0.45 });
      c.save(); c.translate(48, 48); c.rotate(Math.PI / 4);
      const vane = (): void => { c.moveTo(0, 40); c.bezierCurveTo(-22, 10, -18, -30, 0, -44); c.bezierCurveTo(18, -30, 22, 10, 0, 40); c.closePath(); };
      celI(c, vane, ft, { band: 3, hi: 1.2 });
      clipTo(c, vane, () => { for (let y = -30; y < 34; y += 9) { line(c, [P(0, y + 6), P(-20, y - 4)], 1.6, ft.shade); line(c, [P(0, y + 6), P(20, y - 4)], 1.6, ft.shade); } });
      line(c, [P(0, -40), P(0, 46)], 3, css(0xf0e8d0));
      c.restore();
    },
  },
  vit: {
    draw: (c) => {
      const ht = tone(0xe0303c, { light: 0.45 });
      celI(c, () => { c.moveTo(48, 86); c.bezierCurveTo(4, 56, 12, 12, 48, 30); c.bezierCurveTo(84, 12, 92, 56, 48, 86); c.closePath(); }, ht, { band: 4, hi: 1.6 });
      streak(c, [P(22, 46), P(24, 32), P(36, 26)], 4, 'rgba(255,255,255,0.75)');
      const gt = tone(GOLD, { light: 0.5 });
      celI(c, () => roundRectPath(c, 44, 40, 10, 32, 3), gt, { band: 1.4, hi: 0.6 });
      celI(c, () => roundRectPath(c, 33, 51, 32, 10, 3), gt, { band: 1.4, hi: 0.6 });
    },
  },
  int: {
    draw: (c) => {
      const ct = tone(0x2f5ab0, { light: 0.4 });
      const pt = tone(0xf0e2bc, { light: 0.3 });
      celI(c, () => { c.moveTo(8, 30); c.quadraticCurveTo(28, 20, 48, 30); c.quadraticCurveTo(68, 20, 88, 30); c.lineTo(88, 80); c.quadraticCurveTo(68, 70, 48, 80); c.quadraticCurveTo(28, 70, 8, 80); c.closePath(); }, ct, { band: 2, hi: 0.8 });
      for (const s of [-1, 1]) celI(c, () => { c.moveTo(48, 28); c.quadraticCurveTo(48 + s * 20, 18, 48 + s * 36, 26); c.lineTo(48 + s * 36, 72); c.quadraticCurveTo(48 + s * 20, 64, 48, 74); c.closePath(); }, pt, { band: 2, hi: 0.8 });
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(c, [P(48 + s * 10, 38 + i * 10), P(48 + s * 28, 36 + i * 10)], 1.6, pt.shade);
    },
    opts: { over: (c) => { sparkle(c, 48, 20, 9, '#bfe0ff'); glow(c, P(48, 20), 16, 0x80c0ff, 0.5); } },
  },
  spi: {
    draw: (c) => {
      const layer = (s: number, color: number): void => {
        celI(c, () => { c.moveTo(48, 90 - 4 * s); c.bezierCurveTo(48 - 30 * s, 84, 48 - 26 * s, 48, 48 - 4 * s, 10 + (1 - s) * 40); c.bezierCurveTo(48 + 2 * s, 36, 48 + 30 * s, 50, 48 + 26 * s, 70); c.bezierCurveTo(48 + 22 * s, 84, 48 + 8 * s, 90, 48, 90 - 4 * s); c.closePath(); }, tone(color, { light: 0.5 }), { band: 2.6 * s, hi: 1 * s, stroke: 1.4 });
      };
      layer(1, 0x8a4ae0);
      layer(0.66, 0xb888ff);
      layer(0.36, 0xeedcff);
    },
    opts: { over: (c) => glow(c, P(48, 64), 26, 0xb070ff, 0.35) },
  },
  lck: {
    draw: (c) => {
      const lt = tone(0x48b848, { light: 0.45 });
      line(c, [P(50, 52), P(58, 76), P(70, 90)], 5, css(0x2f7a2f));
      for (let i = 0; i < 4; i++) {
        c.save(); c.translate(48, 48); c.rotate(i * Math.PI / 2 + Math.PI / 4);
        celI(c, () => { c.moveTo(0, 0); c.bezierCurveTo(-26, -10, -20, -36, -6, -32); c.quadraticCurveTo(0, -30, 0, -24); c.quadraticCurveTo(0, -30, 6, -32); c.bezierCurveTo(20, -36, 26, -10, 0, 0); c.closePath(); }, lt, { band: 2.4, hi: 1 });
        c.restore();
      }
      celI(c, () => c.arc(48, 48, 5, 0, Math.PI * 2), tone(GOLD), { band: 1, hi: 0.4 });
    },
    opts: { over: (c) => sparkle(c, 28, 24, 7) },
  },
  atk: {
    draw: (c) => {
      c.save(); c.translate(30, 68); c.rotate(Math.PI / 4); c.scale(1.35, 1.35);
      drawBladeMotif(c, 'w_broad_sword');
      c.restore();
    },
    opts: { inkWidth: 2.4 },
  },
  def: {
    draw: (c) => {
      celI(c, () => heaterPath(c, 48, 8, 36, 84), tone(0x9aa4b4, { light: 0.5 }), { band: 2.4, hi: 1 });
      c.save(); c.translate(48, 46); c.scale(0.8, 0.82); c.translate(-48, -46);
      celI(c, () => heaterPath(c, 48, 8, 36, 84), tone(0x3e6ab0, { light: 0.4 }), { band: 3.4, hi: 1.4 });
      c.restore();
      celI(c, () => polyPath(c, [P(48, 22), P(58, 44), P(48, 70), P(38, 44)]), tone(GOLD, { light: 0.5 }), { band: 1.4, hi: 0.6 });
    },
  },
  hp: orbGlyph(0xd8283a),
  mp: orbGlyph(0x2f6cf0),
  quest_available: {
    draw: (c) => {
      const t = tone(GOLD, { light: 0.55 });
      celI(c, () => { c.moveTo(36, 8); c.lineTo(60, 8); c.lineTo(54, 62); c.lineTo(42, 62); c.closePath(); }, t, { band: 3, hi: 1.2 });
      celI(c, () => c.arc(48, 80, 10, 0, Math.PI * 2), t, { band: 2.4, hi: 1 });
    },
    opts: { under: (c) => glow(c, P(48, 48), 44, 0xffc040, 0.45), inkWidth: 3.6 },
  },
  quest_complete: {
    draw: (c) => {
      const t = tone(GOLD, { light: 0.55 });
      celI(c, () => {
        c.moveTo(22, 32);
        c.bezierCurveTo(20, 4, 76, 2, 74, 32);
        c.bezierCurveTo(72, 48, 56, 48, 56, 64);
        c.lineTo(40, 64);
        c.bezierCurveTo(38, 42, 56, 42, 56, 30);
        c.bezierCurveTo(56, 20, 40, 20, 40, 32);
        c.closePath();
      }, t, { band: 3, hi: 1.2 });
      celI(c, () => c.arc(48, 82, 9.5, 0, Math.PI * 2), t, { band: 2.4, hi: 1 });
    },
    opts: { under: (c) => glow(c, P(48, 48), 44, 0xffc040, 0.45), inkWidth: 3.6 },
  },
  close: {
    draw: (c) => {
      celI(c, () => c.arc(48, 48, 40, 0, Math.PI * 2), tone(0x4a4450, { light: 0.4 }), { band: 3, hi: 1.2 });
      celI(c, () => c.arc(48, 48, 32, 0, Math.PI * 2), tone(0xb82a30, { light: 0.4 }), { band: 4, hi: 1.6 });
      const xt = tone(0xf4e8d0, { light: 0.3 });
      celI(c, () => capsulePath(c, P(34, 34), P(62, 62), 5.5, 5.5), xt, { band: 1.6, hi: 0.6 });
      celI(c, () => capsulePath(c, P(62, 34), P(34, 62), 5.5, 5.5), xt, { band: 1.6, hi: 0.6 });
      streak(c, [P(24, 44), P(30, 28), P(44, 20)], 3, 'rgba(255,255,255,0.45)');
    },
  },
  sort: {
    draw: (c) => {
      const t = tone(0xe8d8b0, { light: 0.4 });
      for (const [y, w] of [[16, 46], [38, 34], [60, 22]] as const) celI(c, () => roundRectPath(c, 8, y, w, 13, 4), t, { band: 2, hi: 0.8 });
      const gt = tone(GOLD, { light: 0.5 });
      celI(c, () => polyPath(c, [P(66, 12), P(78, 12), P(78, 60), P(90, 60), P(72, 88), P(54, 60), P(66, 60)]), gt, { band: 2.4, hi: 1 });
    },
  },
};
