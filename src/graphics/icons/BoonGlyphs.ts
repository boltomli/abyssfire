/**
 * Painted glyphs for the Abyss Labyrinth boons (深渊恩赐), in the same inked
 * cel-shaded language as the item / skill icons (IconKit): dark ink outline,
 * flat 2–3 tone fills, one highlight, light from the upper left.
 *
 *   ensureBoonGlyph(scene, kind, size) -> texture key `boon_glyph_<kind>_<size>`
 *
 * Generated once on first use and cached as a texture.
 */
import Phaser from 'phaser';
import { capsulePath, ellipsePath, polyPath } from '../sprites/rig/Rig';
import { P, celI, tone, glow, css, roundRectPath, sparkle, streak, line, clipTo, inked, starPath, type InkOpts } from './IconKit';
import { heaterPath } from './ItemIcons';
import type { BoonDef } from '../../data/abyssRun';

export type BoonGlyph = BoonDef['glyph'];

export const BOON_GLYPHS: readonly BoonGlyph[] = [
  'blade', 'heart', 'fang', 'wing', 'eye', 'shield', 'hourglass', 'coin', 'star', 'flame', 'skull', 'thorn',
];

export function boonGlyphKey(kind: string, size: number): string {
  return `boon_glyph_${kind}_${Math.round(size)}`;
}

export function ensureBoonGlyph(scene: Phaser.Scene, kind: BoonGlyph | string, size = 96): string {
  const S = Math.max(16, Math.round(size));
  const key = boonGlyphKey(kind, S);
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  drawBoonGlyph(canvas.getContext('2d', { willReadFrequently: true })!, kind, S);
  scene.textures.addCanvas(key, canvas);
  return key;
}

export function drawBoonGlyph(ctx: CanvasRenderingContext2D, kind: BoonGlyph | string, size: number): void {
  const g = GLYPHS[kind as BoonGlyph] ?? GLYPHS.star;
  inked(ctx, size, g.draw, { inkWidth: 3, rim: 1.3, ...g.opts });
}

interface Glyph {
  draw: (c: CanvasRenderingContext2D) => void;
  opts?: InkOpts;
}

const GOLD = 0xf0c040;
const STEEL = 0xc4ccd8;
const BONE = 0xece0c4;

function flameLayer(c: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, color: number, s: number): void {
  const hh = h * s, ww = w * s;
  celI(c, () => {
    c.moveTo(x - ww, y - ww * 0.3);
    c.bezierCurveTo(x - ww * 1.2, y - hh * 0.45, x - ww * 0.1, y - hh * 0.6, x + ww * 0.1, y - hh);
    c.bezierCurveTo(x + ww * 0.6, y - hh * 0.6, x + ww * 1.25, y - hh * 0.4, x + ww, y - ww * 0.3);
    c.quadraticCurveTo(x, y + ww * 0.9, x - ww, y - ww * 0.3);
    c.closePath();
  }, tone(color, { light: 0.45 }), { band: 2.2 * s, hi: 0.9 * s, stroke: 1.2 });
}

const GLYPHS: Record<BoonGlyph, Glyph> = {
  blade: {
    draw: (c) => {
      c.save();
      c.translate(48, 48);
      c.rotate(Math.PI / 4);
      const bt = tone(STEEL, { light: 0.55 });
      // blade
      celI(c, () => polyPath(c, [P(0, -44), P(9, -32), P(8, 16), P(-8, 16), P(-9, -32)]), bt, { band: 2.6, hi: 1 });
      line(c, [P(0, -38), P(0, 12)], 2, bt.shade);
      // guard, grip, pommel
      celI(c, () => roundRectPath(c, -22, 14, 44, 9, 4), tone(GOLD, { light: 0.5 }), { band: 1.6, hi: 0.6 });
      celI(c, () => roundRectPath(c, -4.5, 22, 9, 18, 3), tone(0x6a3a22), { band: 1.2, hi: 0.4 });
      celI(c, () => c.arc(0, 44, 6.5, 0, Math.PI * 2), tone(GOLD, { light: 0.5 }), { band: 1.2, hi: 0.5 });
      streak(c, [P(-4, -30), P(-4, 8)], 2.4, 'rgba(255,255,255,0.8)');
      c.restore();
    },
  },
  heart: {
    draw: (c) => {
      const ht = tone(0xd8283a, { light: 0.45 });
      celI(c, () => { c.moveTo(48, 86); c.bezierCurveTo(2, 56, 10, 8, 48, 28); c.bezierCurveTo(86, 8, 94, 56, 48, 86); c.closePath(); }, ht, { band: 4, hi: 1.6 });
      streak(c, [P(22, 46), P(23, 32), P(36, 25)], 4.5, 'rgba(255,255,255,0.8)');
    },
    opts: { under: (c) => glow(c, P(48, 52), 44, 0xff4050, 0.3) },
  },
  fang: {
    draw: (c) => {
      const ft = tone(BONE, { light: 0.5 });
      const tooth = (x: number, y: number, h: number, w: number, lean: number): void => {
        celI(c, () => {
          c.moveTo(x - w, y);
          c.quadraticCurveTo(x - w * 0.8, y + h * 0.6, x + lean, y + h);
          c.quadraticCurveTo(x + w * 0.9, y + h * 0.55, x + w, y);
          c.closePath();
        }, ft, { band: 2.6, hi: 1 });
      };
      // gum arc
      celI(c, () => { c.moveTo(10, 30); c.quadraticCurveTo(48, 8, 86, 30); c.lineTo(84, 40); c.quadraticCurveTo(48, 22, 12, 40); c.closePath(); }, tone(0x8a1c2c), { band: 2, hi: 0.8 });
      tooth(30, 34, 50, 10, 4);
      tooth(66, 34, 50, 10, -4);
      tooth(48, 30, 20, 7, 0);
      // blood drop off the left fang
      celI(c, () => { c.moveTo(34, 86); c.quadraticCurveTo(28, 94, 34, 96); c.quadraticCurveTo(40, 94, 34, 86); c.closePath(); }, tone(0xd8283a, { light: 0.5 }), { band: 1, hi: 0.4 });
      streak(c, [P(24, 40), P(27, 62)], 2.4, 'rgba(255,255,255,0.85)');
    },
  },
  wing: {
    draw: (c) => {
      const wt = tone(0xcfe8f4, { light: 0.5 });
      const ft2 = tone(0x8ec4e0, { light: 0.4 });
      // feathers (back to front)
      const feather = (ang: number, len: number, t: typeof wt): void => {
        c.save();
        c.translate(22, 70);
        c.rotate(ang);
        celI(c, () => { c.moveTo(0, 0); c.bezierCurveTo(10, -6, len * 0.7, -10, len, -2); c.bezierCurveTo(len * 0.7, 8, 10, 8, 0, 0); c.closePath(); }, t, { band: 2, hi: 0.8, stroke: 1.2 });
        c.restore();
      };
      feather(-0.35, 60, ft2);
      feather(-0.65, 66, ft2);
      feather(-0.95, 64, wt);
      feather(-1.25, 56, wt);
      // shoulder
      celI(c, () => { c.moveTo(14, 76); c.bezierCurveTo(10, 44, 40, 20, 64, 20); c.bezierCurveTo(52, 36, 44, 56, 30, 78); c.closePath(); }, wt, { band: 3, hi: 1.2 });
      streak(c, [P(20, 64), P(28, 42), P(48, 26)], 3, 'rgba(255,255,255,0.85)');
    },
    opts: { over: (c) => { streak(c, [P(60, 78), P(86, 78)], 2.4, 'rgba(220,245,255,0.8)'); streak(c, [P(54, 88), P(80, 88)], 2.4, 'rgba(220,245,255,0.6)'); } },
  },
  eye: {
    draw: (c) => {
      const lid = (): void => { c.moveTo(6, 48); c.quadraticCurveTo(48, 6, 90, 48); c.quadraticCurveTo(48, 90, 6, 48); c.closePath(); };
      celI(c, lid, tone(0xf2ead8, { light: 0.4 }), { band: 2.6, hi: 1 });
      clipTo(c, lid, () => {
        const it = tone(0xe0a020, { light: 0.5 });
        celI(c, () => c.arc(48, 48, 20, 0, Math.PI * 2), it, { band: 3, hi: 1.2 });
        c.fillStyle = '#140c1c';
        c.beginPath(); c.ellipse(48, 48, 5, 15, 0, 0, Math.PI * 2); c.fill();
      });
      c.beginPath(); c.ellipse(40, 40, 5, 3.5, -0.5, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill();
    },
    opts: { under: (c) => glow(c, P(48, 48), 44, 0xffb040, 0.3) },
  },
  shield: {
    draw: (c) => {
      celI(c, () => heaterPath(c, 48, 8, 36, 84), tone(0xa8b0c0, { light: 0.5 }), { band: 2.4, hi: 1 });
      c.save(); c.translate(48, 46); c.scale(0.8, 0.82); c.translate(-48, -46);
      celI(c, () => heaterPath(c, 48, 8, 36, 84), tone(0x7a2230, { light: 0.35 }), { band: 3.4, hi: 1.4 });
      c.restore();
      const gt = tone(GOLD, { light: 0.5 });
      celI(c, () => roundRectPath(c, 44, 20, 8, 52, 2), gt, { band: 1.4, hi: 0.6 });
      celI(c, () => roundRectPath(c, 26, 36, 44, 8, 2), gt, { band: 1.4, hi: 0.6 });
      streak(c, [P(22, 22), P(24, 44)], 3, 'rgba(255,255,255,0.7)');
    },
  },
  hourglass: {
    draw: (c) => {
      const wood = tone(0x8a5a2c, { light: 0.4 });
      const glass = (): void => { c.moveTo(26, 18); c.lineTo(70, 18); c.quadraticCurveTo(70, 40, 52, 48); c.quadraticCurveTo(70, 56, 70, 78); c.lineTo(26, 78); c.quadraticCurveTo(26, 56, 44, 48); c.quadraticCurveTo(26, 40, 26, 18); c.closePath(); };
      celI(c, glass, tone(0xbfe4ff, { light: 0.5 }), { band: 2, hi: 0.8, stroke: 1.4 });
      clipTo(c, glass, () => {
        const st = tone(0xf0b848, { light: 0.4 });
        celI(c, () => { c.moveTo(20, 80); c.lineTo(20, 64); c.quadraticCurveTo(48, 54, 76, 64); c.lineTo(76, 80); c.closePath(); }, st, { band: 1.6, hi: 0.6, stroke: 0 });
        celI(c, () => { c.moveTo(34, 34); c.lineTo(62, 34); c.lineTo(48, 47); c.closePath(); }, st, { band: 1.2, hi: 0.4, stroke: 0 });
        line(c, [P(48, 46), P(48, 62)], 2, css(0xf0b848));
      });
      celI(c, () => roundRectPath(c, 16, 8, 64, 11, 4), wood, { band: 1.6, hi: 0.6 });
      celI(c, () => roundRectPath(c, 16, 77, 64, 11, 4), wood, { band: 1.6, hi: 0.6 });
      streak(c, [P(32, 24), P(34, 36)], 2.6, 'rgba(255,255,255,0.85)');
    },
  },
  coin: {
    draw: (c) => {
      const t = tone(GOLD, { light: 0.5 });
      celI(c, () => ellipsePath(c, P(50, 54), 36, 36), tone(0xa06c14), { band: 1, hi: 0.4, noLight: true });
      celI(c, () => ellipsePath(c, P(46, 48), 36, 36), t, { band: 3.6, hi: 1.4 });
      c.beginPath(); c.arc(46, 48, 26, 0, Math.PI * 2); c.strokeStyle = t.shade; c.lineWidth = 2.4; c.stroke();
      // an abyss eye stamped in the coin
      c.beginPath(); starPath(c, 46, 48, 4, 16, 5); c.fillStyle = t.shade; c.fill();
      c.beginPath(); c.arc(46, 48, 4, 0, Math.PI * 2); c.fillStyle = t.light; c.fill();
    },
    opts: { over: (c) => sparkle(c, 26, 24, 9) },
  },
  star: {
    draw: (c) => {
      const st = tone(0xffd060, { light: 0.55 });
      celI(c, () => starPath(c, 48, 50, 5, 42, 18), st, { band: 3.4, hi: 1.4 });
      celI(c, () => starPath(c, 48, 50, 5, 18, 8), tone(0xfff4c0, { light: 0.4 }), { band: 1.4, hi: 0.5, stroke: 0 });
    },
    opts: { under: (c) => glow(c, P(48, 50), 46, 0xffc040, 0.4), over: (c) => sparkle(c, 78, 20, 8) },
  },
  flame: {
    draw: (c) => {
      flameLayer(c, 48, 88, 82, 30, 0xe0381c, 1);
      flameLayer(c, 48, 88, 82, 30, 0xff9a22, 0.68);
      flameLayer(c, 48, 88, 82, 30, 0xffe070, 0.38);
    },
    opts: { under: (c) => glow(c, P(48, 60), 44, 0xff6020, 0.45) },
  },
  skull: {
    draw: (c) => {
      const t = tone(BONE, { light: 0.45 });
      const s = 2.3, x = 48, y = 46;
      celI(c, () => {
        c.moveTo(x - 16 * s, y + 4 * s);
        c.bezierCurveTo(x - 20 * s, y - 22 * s, x + 20 * s, y - 22 * s, x + 16 * s, y + 4 * s);
        c.lineTo(x + 10 * s, y + 10 * s);
        c.lineTo(x + 9 * s, y + 18 * s);
        c.lineTo(x - 9 * s, y + 18 * s);
        c.lineTo(x - 10 * s, y + 10 * s);
        c.closePath();
      }, t, { band: 3.4, hi: 1.4 });
      c.fillStyle = '#2a0810';
      c.beginPath(); c.ellipse(x - 7 * s, y - 1 * s, 5 * s, 5.6 * s, 0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x + 7 * s, y - 1 * s, 5 * s, 5.6 * s, -0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff3040';
      c.beginPath(); c.arc(x - 7 * s, y, 2.2 * s * 0.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 7 * s, y, 2.2 * s * 0.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#140c1c';
      c.beginPath(); polyPath(c, [P(x, y + 5 * s), P(x + 2.6 * s, y + 9 * s), P(x - 2.6 * s, y + 9 * s)]); c.fill();
      for (let i = -1; i <= 1; i++) line(c, [P(x + i * 4 * s, y + 12 * s), P(x + i * 4 * s, y + 18 * s)], 2, t.shade);
      streak(c, [P(20, 40), P(24, 24), P(38, 14)], 3.4, 'rgba(255,255,255,0.75)');
    },
    opts: { over: (c) => { glow(c, P(32, 46), 10, 0xff2030, 0.6); glow(c, P(64, 46), 10, 0xff2030, 0.6); } },
  },
  thorn: {
    draw: (c) => {
      // A briar wreath: thick thorned vine curled into a ring, a blood-red bloom on top.
      const vt = tone(0x4a8a36, { light: 0.45 });
      const thornT = tone(0xd8b070, { light: 0.4 });
      const R = 30;
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + 0.5 + (i / 9) * Math.PI * 1.75;
        c.save(); c.translate(48 + Math.cos(a) * R, 50 + Math.sin(a) * R); c.rotate(a + (i % 2 ? -Math.PI / 2 : Math.PI / 2));
        celI(c, () => polyPath(c, [P(-6, 0), P(6, 0), P(0, -22)]), thornT, { band: 1.2, hi: 0.5, stroke: 1.2 });
        c.restore();
      }
      celI(c, () => {
        c.arc(48, 50, R + 7, -Math.PI / 2 + 0.35, -Math.PI / 2 + 0.35 + Math.PI * 1.8);
        c.arc(48, 50, R - 7, -Math.PI / 2 + 0.35 + Math.PI * 1.8, -Math.PI / 2 + 0.35, true);
        c.closePath();
      }, vt, { band: 2.4, hi: 1 });
      c.save(); c.translate(26, 72); c.rotate(-0.8);
      celI(c, () => { c.moveTo(0, 0); c.quadraticCurveTo(10, -14, 24, -10); c.quadraticCurveTo(14, 4, 0, 0); c.closePath(); }, tone(0x6cc85a, { light: 0.4 }), { band: 1.6, hi: 0.6 });
      c.restore();
      const rt = tone(0xd02840, { light: 0.5 });
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
        celI(c, () => c.arc(48 + Math.cos(a) * 8, 18 + Math.sin(a) * 8, 8, 0, Math.PI * 2), rt, { band: 1.6, hi: 0.6 });
      }
      celI(c, () => c.arc(48, 18, 6, 0, Math.PI * 2), tone(0x8a1024, { light: 0.3 }), { band: 1, hi: 0.4 });
      streak(c, [P(24, 40), P(28, 30)], 3, 'rgba(255,255,255,0.7)');
    },
  },
};
