/**
 * Procedural quest-collectible icons.
 *
 * Same visual language as ItemIcons: authored in the 96-unit IconKit space,
 * cel-shaded with coloured line art, an ink silhouette and one focal accent.
 * Textures are ITEM_ICON_SIZE² with a transparent background; they are shown
 * in quest UI (32–48 px) and floating over gather nodes in the world (~30 px).
 */
import type Phaser from 'phaser';
import { capsulePath, ellipsePath, blobPath, polyPath } from '../sprites/rig/Rig';
import {
  P, celI, tone, glow, css, mixHex, ribbonPath, sample, roundRectPath, sparkle, streak, line,
  clipTo, facetGem, gemCut, inked, starPath, type V, type InkOpts,
} from './IconKit';

/** Same texture edge as ItemIcons.ITEM_ICON_SIZE (kept local so this module stays Phaser-free). */
const ITEM_ICON_SIZE = 96;

export type QuestItemKind =
  | 'herb' | 'moon_herb' | 'mushroom' | 'gel' | 'pendant' | 'pelt' | 'fang' | 'silk'
  | 'relic' | 'crystal' | 'ingot' | 'rune' | 'mithril' | 'scale' | 'water' | 'venom'
  | 'essence' | 'seal' | 'void_crystal' | 'ash' | 'bone' | 'letter';

export const QUEST_ITEM_KINDS: readonly QuestItemKind[] = [
  'herb', 'moon_herb', 'mushroom', 'gel', 'pendant', 'pelt', 'fang', 'silk',
  'relic', 'crystal', 'ingot', 'rune', 'mithril', 'scale', 'water', 'venom',
  'essence', 'seal', 'void_crystal', 'ash', 'bone', 'letter',
];

export function questItemIconKey(kind: QuestItemKind): string {
  return `quest_icon_${kind}`;
}

export function ensureQuestItemIcon(scene: Phaser.Scene, kind: QuestItemKind): string {
  const key = questItemIconKey(kind);
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = ITEM_ICON_SIZE;
  canvas.height = ITEM_ICON_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  drawQuestItemIcon(ctx, kind, ITEM_ICON_SIZE);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Draw a quest item icon into `ctx` (size × size px, transparent background). */
export function drawQuestItemIcon(ctx: CanvasRenderingContext2D, kind: QuestItemKind, size: number): void {
  const spec = SPECS[kind];
  inked(ctx, size, spec.draw, spec.opts);
}

// ════════════════════════════════════════════════════════════════════════
// Shared bits
// ════════════════════════════════════════════════════════════════════════

interface IconSpec {
  draw: (c: CanvasRenderingContext2D) => void;
  opts?: InkOpts;
}

const GOLD = 0xe3b44c;
const LEATHER = 0x8a5332;
const WOOD = 0xa06d3c;
const BONE_C = 0xe6dab8;
const PARCHMENT = 0xefd9a4;

/** Leaf from `a` (stem end) to `b` (tip), half-width `w`, optional sideways bend. */
function leafPath(c: CanvasRenderingContext2D, a: V, b: V, w: number, bend = 0): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (a.x + b.x) / 2 + nx * bend;
  const my = (a.y + b.y) / 2 + ny * bend;
  c.moveTo(a.x, a.y);
  c.quadraticCurveTo(mx + nx * w * 1.3, my + ny * w * 1.3, b.x, b.y);
  c.quadraticCurveTo(mx - nx * w * 1.3, my - ny * w * 1.3, a.x, a.y);
  c.closePath();
}

function leaf(c: CanvasRenderingContext2D, a: V, b: V, w: number, color: number, bend = 0): void {
  const t = tone(color, { light: 0.38 });
  celI(c, () => leafPath(c, a, b, w, bend), t, { band: Math.min(2.2, w * 0.45), hi: 0.8, stroke: 1.2 });
  line(c, [a, P(a.x + (b.x - a.x) * 0.8, a.y + (b.y - a.y) * 0.8)], 0.9, t.shade);
}

function stem(c: CanvasRenderingContext2D, pts: readonly V[], w: number, color: number): void {
  celI(c, () => ribbonPath(c, pts, (t) => w * (1 - t * 0.45)), tone(color), { band: 0.7, hi: 0.3, stroke: 1 });
}

/** Round glass orb with a gradient body (used by essence / mithril). */
function glassOrb(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner: number, rim: number): void {
  c.save();
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, css(mixHex(inner, 0xffffff, 0.6)));
  g.addColorStop(0.45, css(inner));
  g.addColorStop(1, css(mixHex(inner, 0x100818, 0.6)));
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = css(rim);
  c.lineWidth = 1.6;
  c.stroke();
  c.restore();
}

// ════════════════════════════════════════════════════════════════════════
// Plants
// ════════════════════════════════════════════════════════════════════════

const herb: IconSpec = {
  draw: (c) => {
    const tie = P(47, 66);
    const stems: [V, V, number][] = [
      [P(24, 26), P(30, 44), 0x5aa83a],
      [P(46, 14), P(46, 38), 0x6cbf42],
      [P(72, 22), P(64, 42), 0x4f9a34],
      [P(34, 18), P(40, 40), 0x7ccc4c],
      [P(62, 14), P(56, 38), 0x62b43e],
    ];
    for (const [tip, mid, col] of stems) {
      stem(c, [P(46, 88), P(tie.x + (mid.x - tie.x) * 0.2, tie.y), mid, tip], 1.8, 0x4a7a28);
      leaf(c, mid, tip, 5.6, col);
      leaf(c, P(mid.x + (tie.x - mid.x) * 0.35, mid.y + (tie.y - mid.y) * 0.35), P(mid.x + (mid.x < 48 ? -12 : 12), mid.y + 2), 4.4, mixHex(col, 0x2a5a18, 0.2));
    }
    // twine
    const tw = tone(0xc89a5a, { light: 0.4 });
    celI(c, () => roundRectPath(c, 37, 62, 20, 8, 3), tw, { band: 1, hi: 0.4, stroke: 1.1 });
    line(c, [P(40, 63), P(41, 69)], 0.9, tw.shade);
    line(c, [P(46, 63), P(47, 69)], 0.9, tw.shade);
    line(c, [P(52, 63), P(53, 69)], 0.9, tw.shade);
    celI(c, () => leafPath(c, P(56, 66), P(66, 76), 2.4, 1), tw, { band: 0.6, hi: 0.3, stroke: 1 });
  },
  opts: { over: (c) => sparkle(c, 30, 30, 4, '#fff6c8', 0.9) },
};

const moonHerb: IconSpec = {
  draw: (c) => {
    const col = 0xbfe0f4;
    stem(c, [P(50, 90), P(48, 70), P(44, 50), P(46, 34)], 3, 0x7aa8b8);
    leaf(c, P(48, 74), P(22, 66), 7, 0x9cc8dc, 2);
    leaf(c, P(46, 60), P(72, 52), 7, 0xa8d4e8, -2);
    leaf(c, P(45, 46), P(26, 38), 6, 0xb4dcee);
    // crescent leaf crowning the sprig
    const crescent = (): void => {
      c.moveTo(32, 12);
      c.bezierCurveTo(62, 0, 82, 32, 60, 44);
      c.bezierCurveTo(52, 48, 44, 42, 44, 36);
      c.bezierCurveTo(62, 34, 62, 12, 32, 12);
      c.closePath();
    };
    celI(c, crescent, tone(col, { light: 0.55, shadow: 0.3 }), { band: 2, hi: 0.8, stroke: 1.3 });
    streak(c, [P(46, 16), P(60, 20), P(62, 32)], 1.6, 'rgba(255,255,255,0.85)');
  },
  opts: {
    under: (c) => { glow(c, P(54, 30), 30, 0x6ae4ff, 0.55); glow(c, P(46, 56), 30, 0x6ae4ff, 0.25); },
    over: (c) => { sparkle(c, 70, 18, 5, '#e8fcff', 0.95); sparkle(c, 26, 56, 3, '#e8fcff', 0.8); },
    rim: 0.8,
  },
};

const mushroom: IconSpec = {
  draw: (c) => {
    const st = tone(0xf0e4c8, { light: 0.35 });
    const cap = tone(0xd8342e, { light: 0.35 });
    const spots = (pts: [number, number, number][]): void => {
      for (const [x, y, r] of pts) {
        c.beginPath(); c.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
        c.fillStyle = '#fbf1da'; c.fill();
      }
    };
    // small mushroom (back, right)
    celI(c, () => { c.moveTo(62, 58); c.quadraticCurveTo(60, 72, 58, 82); c.lineTo(72, 82); c.quadraticCurveTo(69, 72, 69, 58); c.closePath(); }, st, { band: 1.4, hi: 0.5 });
    const cap2 = (): void => { c.moveTo(52, 62); c.bezierCurveTo(52, 40, 80, 40, 80, 62); c.quadraticCurveTo(66, 58, 52, 62); c.closePath(); };
    celI(c, cap2, tone(0xe0703a, { light: 0.35 }), { band: 2.2, hi: 0.9 });
    clipTo(c, cap2, () => spots([[60, 50, 3], [71, 49, 2.6], [66, 57, 2]]));
    // big mushroom (front, left)
    celI(c, () => { c.moveTo(30, 54); c.quadraticCurveTo(26, 72, 24, 86); c.quadraticCurveTo(36, 90, 48, 86); c.quadraticCurveTo(42, 72, 44, 54); c.closePath(); }, st, { band: 2, hi: 0.7 });
    line(c, [P(33, 62), P(31, 80)], 1, st.shade);
    const cap1 = (): void => { c.moveTo(12, 56); c.bezierCurveTo(10, 20, 64, 18, 62, 56); c.quadraticCurveTo(37, 48, 12, 56); c.closePath(); };
    celI(c, cap1, cap, { band: 3, hi: 1.2 });
    clipTo(c, cap1, () => spots([[26, 36, 4.4], [42, 30, 3.6], [52, 42, 3.4], [22, 49, 2.6], [37, 44, 3]]));
    // gills under the cap
    celI(c, () => { c.moveTo(14, 56); c.quadraticCurveTo(37, 48, 60, 56); c.quadraticCurveTo(37, 60, 14, 56); c.closePath(); }, tone(0xe8cfa6), { band: 0.6, hi: 0.3, stroke: 1 });
  },
  opts: { over: (c) => sparkle(c, 20, 30, 4.5, '#ffffff', 0.9) },
};

const gel: IconSpec = {
  draw: (c) => {
    const col = 0x6ee04a;
    const body = (): void => blobPath(c, [P(16, 74), P(18, 52), P(34, 32), P(52, 26), P(70, 36), P(80, 58), P(80, 76), P(64, 82), P(48, 80), P(32, 83)]);
    c.beginPath(); body(); c.fillStyle = css(col, 0.55); c.fill();
    clipTo(c, body, () => {
      const g = c.createRadialGradient(40, 44, 4, 50, 60, 40);
      g.addColorStop(0, css(mixHex(col, 0xffffff, 0.55), 0.95));
      g.addColorStop(0.55, css(col, 0.85));
      g.addColorStop(1, css(mixHex(col, 0x0a3018, 0.55), 0.95));
      c.fillStyle = g;
      c.fillRect(0, 0, 96, 96);
      // inner bubbles / nucleus
      c.fillStyle = css(mixHex(col, 0x0a3018, 0.35), 0.8);
      c.beginPath(); c.ellipse(56, 62, 7, 5, 0.3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
      for (const [x, y, r] of [[36, 64, 2.6], [66, 50, 1.8], [44, 72, 1.6]] as const) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
    });
    c.beginPath(); body(); c.strokeStyle = css(0x2a7a24); c.lineWidth = 1.8; c.stroke();
    // drip
    celI(c, () => { c.moveTo(66, 80); c.quadraticCurveTo(70, 90, 66, 92); c.quadraticCurveTo(62, 90, 62, 81); c.closePath(); }, tone(col, { light: 0.4 }), { band: 1, hi: 0.4, stroke: 1.2 });
    streak(c, [P(26, 60), P(30, 44), P(44, 34)], 3.4, 'rgba(255,255,255,0.9)');
    c.beginPath(); c.arc(26, 68, 2, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
  },
  opts: { under: (c) => glow(c, P(48, 58), 40, 0x6ee04a, 0.3), over: (c) => sparkle(c, 60, 34, 4.5, '#ffffff', 0.9) },
};

// ════════════════════════════════════════════════════════════════════════
// Trinkets
// ════════════════════════════════════════════════════════════════════════

const pendant: IconSpec = {
  draw: (c) => {
    const ct = tone(GOLD, { light: 0.45 });
    const chain = sample(20, (t) => { const a = Math.PI * (1 - t); return P(48 + Math.cos(a) * 28, 12 + Math.sin(a) * 26); });
    chain.forEach((p, i) => {
      const q = chain[Math.min(chain.length - 1, i + 1)];
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      celI(c, () => ellipsePath(c, p, i % 2 === 0 ? 3.2 : 2.6, i % 2 === 0 ? 1.8 : 1.3, ang), ct, { band: 0.8, hi: 0.4, stroke: 0.9 });
    });
    celI(c, () => { c.arc(48, 42, 4.4, 0, Math.PI * 2); }, ct, { band: 1, hi: 0.4, stroke: 1.1 });
    // locket (heart-ish oval with a hinge line)
    const lk = tone(0xeec05a, { light: 0.5 });
    const body = (): void => ellipsePath(c, P(48, 64), 20, 23);
    celI(c, body, lk, { band: 3, hi: 1.2 });
    c.beginPath(); c.ellipse(48, 64, 15, 18, 0, 0, Math.PI * 2); c.strokeStyle = lk.shade; c.lineWidth = 1.4; c.stroke();
    // filigree
    for (const s of [-1, 1]) line(c, [P(48 + s * 6, 50), P(48 + s * 12, 58), P(48 + s * 10, 72), P(48 + s * 4, 78)], 1.1, lk.shade);
    facetGem(c, 48, 64, gemCut('oval', 8), 0xe0283c, { sparkles: 1, stroke: 1 });
  },
  opts: { over: (c) => { glow(c, P(48, 64), 14, 0xff4050, 0.3); sparkle(c, 34, 52, 4.5, '#ffffff', 0.95); } },
};

const relic: IconSpec = {
  draw: (c) => {
    const bt = tone(0x9a7a48, { light: 0.35 });
    // idol head fragment with a broken diagonal bottom
    const head = (): void => {
      c.moveTo(28, 26); c.quadraticCurveTo(48, 10, 68, 26);
      c.lineTo(72, 56); c.lineTo(64, 62); c.lineTo(58, 58); c.lineTo(50, 72); c.lineTo(42, 66); c.lineTo(34, 78); c.lineTo(26, 70);
      c.closePath();
    };
    celI(c, head, bt, { band: 3.4, hi: 1.4 });
    clipTo(c, head, () => {
      // verdigris patches
      c.fillStyle = css(0x5fa08a, 0.75);
      c.beginPath(); blobPath(c, [P(60, 26), P(70, 30), P(70, 42), P(62, 38)]); c.fill();
      c.beginPath(); blobPath(c, [P(28, 58), P(36, 60), P(34, 72), P(26, 68)]); c.fill();
      // brow band + eyes + nose
      line(c, [P(30, 34), P(66, 34)], 1.4, bt.shade);
      for (const x of [39, 57]) {
        c.beginPath(); c.ellipse(x, 42, 5, 2.6, 0, 0, Math.PI * 2); c.fillStyle = bt.shade; c.fill();
        c.beginPath(); c.ellipse(x, 41.4, 2.4, 1.2, 0, 0, Math.PI * 2); c.fillStyle = css(0x3a2a1a); c.fill();
      }
      line(c, [P(48, 44), P(46, 54), P(50, 55)], 1.4, bt.shade);
      // worn runes on the forehead
      c.strokeStyle = css(0xf0c878, 0.85); c.lineWidth = 1.3; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(36, 24); c.lineTo(36, 30); c.moveTo(34, 27); c.lineTo(38, 25);
      c.moveTo(46, 22); c.lineTo(50, 22); c.lineTo(48, 30);
      c.moveTo(58, 24); c.lineTo(60, 30); c.lineTo(62, 24);
      c.stroke();
    });
    // cracks
    line(c, [P(64, 62), P(60, 50), P(66, 44)], 1.1, bt.line);
    // pedestal chip
    celI(c, () => polyPath(c, [P(22, 80), P(70, 76), P(76, 86), P(20, 88)]), tone(0x7a7470), { band: 1.2, hi: 0.5, stroke: 1.1 });
  },
  opts: { over: (c) => sparkle(c, 30, 30, 4, '#fff2c0', 0.85) },
};

const seal: IconSpec = {
  draw: (c) => {
    const gt = tone(0xe8b848, { light: 0.5 });
    const cx = 46;
    const cy = 50;
    const piece = (): void => {
      // intersection approximated with an explicit outline
      c.moveTo(cx + 34, cy - 2);
      c.arc(cx, cy, 34, -0.06, -Math.PI * 0.5, true);
      c.arc(cx, cy, 34, -Math.PI * 0.5, Math.PI * 0.62, true);
      c.lineTo(cx + 2, cy + 30);
      c.lineTo(cx + 6, cy + 18);
      c.lineTo(cx + 18, cy + 16);
      c.lineTo(cx + 24, cy + 4);
      c.closePath();
    };
    celI(c, piece, gt, { band: 3, hi: 1.2, stroke: 1.5 });
    clipTo(c, piece, () => {
      c.strokeStyle = gt.shade; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, 28, 0, Math.PI * 2); c.stroke();
      // tick marks round the rim
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        line(c, [P(cx + Math.cos(a) * 29, cy + Math.sin(a) * 29), P(cx + Math.cos(a) * 33, cy + Math.sin(a) * 33)], 1, gt.shade);
      }
      // sigil
      c.save();
      c.strokeStyle = '#fff4c8'; c.lineWidth = 2.4; c.lineJoin = 'round'; c.lineCap = 'round';
      c.shadowColor = 'rgba(255,220,120,0.9)'; c.shadowBlur = 4;
      c.beginPath(); starPath(c, cx, cy, 6, 20, 9); c.stroke();
      c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2); c.stroke();
      c.restore();
    });
  },
  opts: {
    under: (c) => glow(c, P(40, 46), 36, 0xffd060, 0.3),
    over: (c) => { glow(c, P(44, 48), 18, 0xfff0a0, 0.55); sparkle(c, 24, 26, 5, '#ffffff', 0.95); },
  },
};

const letter: IconSpec = {
  draw: (c) => {
    c.save();
    c.translate(48, 50);
    c.rotate(-0.55);
    const pt = tone(PARCHMENT, { light: 0.35 });
    // rolled tube
    celI(c, () => roundRectPath(c, -36, -11, 70, 22, 5), pt, { band: 3, hi: 1.1 });
    line(c, [P(-30, -4), P(28, -4)], 0.9, pt.shade);
    line(c, [P(-30, 5), P(28, 5)], 0.9, pt.shade);
    // spiral end
    celI(c, () => ellipsePath(c, P(34, 0), 6, 11), tone(0xdcc088), { band: 1, hi: 0.4, stroke: 1.2 });
    c.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i * 0.55; const r = 0.4 + i * 0.2; const x = 34 + Math.cos(a) * r * 0.55; const y = Math.sin(a) * r; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.strokeStyle = pt.shade; c.lineWidth = 1; c.stroke();
    // loose flap
    celI(c, () => { c.moveTo(-36, 6); c.quadraticCurveTo(-40, 16, -30, 20); c.lineTo(-20, 11); c.closePath(); }, pt, { band: 1, hi: 0.4, stroke: 1.1 });
    // ribbon
    const rb = tone(0xb8282e);
    celI(c, () => roundRectPath(c, -6, -12.5, 8, 25, 1.5), rb, { band: 1, hi: 0.4, stroke: 1.1 });
    celI(c, () => polyPath(c, [P(-4, 10), P(-12, 30), P(-7, 27), P(-5, 32), P(0, 12)]), rb, { band: 0.8, hi: 0.3, stroke: 1 });
    celI(c, () => polyPath(c, [P(0, 10), P(8, 28), P(3, 26), P(0, 30), P(-3, 12)]), rb, { band: 0.8, hi: 0.3, stroke: 1 });
    // wax seal
    const wt = tone(0xd02a30, { light: 0.4 });
    celI(c, () => blobPath(c, [P(-2, -12), P(8, -8), P(10, 2), P(4, 10), P(-6, 10), P(-12, 2), P(-11, -8)]), wt, { band: 2, hi: 0.8, stroke: 1.3 });
    c.beginPath(); c.arc(-1, 0, 5, 0, Math.PI * 2); c.strokeStyle = wt.shade; c.lineWidth = 1.3; c.stroke();
    line(c, [P(-3, -2), P(1, 2)], 1.2, wt.shade);
    c.restore();
  },
  opts: { over: (c) => sparkle(c, 38, 40, 4, '#ffffff', 0.9) },
};

// ════════════════════════════════════════════════════════════════════════
// Beast parts
// ════════════════════════════════════════════════════════════════════════

/** Polygon with small fur tufts pushed outward along every edge. */
function tuftPath(c: CanvasRenderingContext2D, outline: readonly V[], per: number, depth: number): void {
  const pts: V[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    for (let k = 0; k < per; k++) {
      pts.push(P(a.x + (dx * k) / per, a.y + (dy * k) / per));
      const tm = (k + 0.6) / per;
      pts.push(P(a.x + dx * tm + (dy / len) * depth, a.y + dy * tm - (dx / len) * depth));
    }
  }
  polyPath(c, pts);
}

const pelt: IconSpec = {
  draw: (c) => {
    const ft = tone(0x9c8266, { light: 0.4 });
    const hide = tone(0xe0c8a0, { light: 0.3 });
    // bushy tail curling off the right
    const tail = (): void => tuftPath(c, [P(66, 58), P(84, 50), P(92, 64), P(84, 80), P(72, 74)], 3, 3);
    celI(c, tail, ft, { band: 2, hi: 0.8, stroke: 1.3 });
    clipTo(c, tail, () => { c.fillStyle = css(0xf0e6d4); c.beginPath(); c.ellipse(88, 70, 6, 8, 0.4, 0, Math.PI * 2); c.fill(); });
    // folded underside strip (pale hide) peeking below
    celI(c, () => { c.moveTo(12, 66); c.lineTo(76, 62); c.lineTo(74, 78); c.lineTo(16, 84); c.closePath(); }, hide, { band: 1.6, hi: 0.6, stroke: 1.3 });
    line(c, [P(20, 78), P(70, 72)], 1, hide.shade);
    // fur side on top
    const top = (): void => tuftPath(c, [P(10, 40), P(34, 22), P(64, 20), P(82, 34), P(78, 62), P(46, 70), P(14, 66)], 4, 3.6);
    celI(c, top, ft, { band: 3.4, hi: 1.4, stroke: 1.4 });
    clipTo(c, top, () => {
      c.fillStyle = css(0x5e4a3a, 0.85);
      c.beginPath(); blobPath(c, [P(22, 36), P(46, 28), P(72, 32), P(66, 42), P(44, 40), P(24, 44)]); c.fill();
      for (const [x, y] of [[24, 56], [36, 60], [50, 58], [64, 54], [30, 48], [58, 46], [70, 44]] as const) {
        line(c, [P(x, y), P(x + 3, y - 4), P(x + 6, y - 1)], 1.3, ft.light);
      }
    });
    // paw hanging off the lower left
    celI(c, () => capsulePath(c, P(22, 64), P(14, 84), 6, 5), ft, { band: 1.4, hi: 0.5, stroke: 1.3 });
    for (const dx of [-3.5, 0, 3.5]) {
      c.beginPath(); c.arc(14 + dx, 89, 1.7, 0, Math.PI * 2); c.fillStyle = css(0x3a302a); c.fill();
    }
  },
  opts: { over: (c) => sparkle(c, 60, 24, 4, '#fff4d8', 0.85) },
};

const fang: IconSpec = {
  draw: (c) => {
    const it = tone(0xefe4c4, { light: 0.4 });
    const one = (root: V, tip: V, bend: number, w: number): void => {
      const pts = sample(12, (t) => {
        const x = root.x + (tip.x - root.x) * t;
        const y = root.y + (tip.y - root.y) * t;
        const dx = tip.x - root.x;
        const dy = tip.y - root.y;
        const len = Math.hypot(dx, dy) || 1;
        const k = Math.sin(t * Math.PI) * bend;
        return P(x + (-dy / len) * k, y + (dx / len) * k);
      });
      const body = (): void => ribbonPath(c, pts, (t) => w * (1 - t) ** 0.8 + 0.2);
      celI(c, body, it, { band: 2.2, hi: 0.9, stroke: 1.3 });
      clipTo(c, body, () => {
        // darker root band
        c.fillStyle = css(0xa88a5a, 0.85);
        c.beginPath(); c.arc(root.x, root.y, w * 1.6, 0, Math.PI * 2); c.fill();
      });
      streak(c, [pts[3], pts[6], pts[9]], 1.4, 'rgba(255,255,255,0.8)');
    };
    one(P(30, 16), P(24, 84), -16, 9.5);
    one(P(62, 16), P(58, 80), -16, 9.5);
    // leather cord binding the roots
    const lt = tone(LEATHER);
    line(c, [P(30, 20), P(46, 12), P(62, 20)], 2, lt.base);
    celI(c, () => roundRectPath(c, 22, 24, 50, 7, 3), lt, { band: 1, hi: 0.4, stroke: 1.1 });
  },
  opts: { over: (c) => sparkle(c, 40, 50, 4.5, '#ffffff', 0.9) },
};

const silk: IconSpec = {
  draw: (c) => {
    c.save();
    c.translate(48, 50); c.rotate(0.55); c.translate(-48, -50);
    const wt = tone(WOOD);
    // spindle rod
    celI(c, () => capsulePath(c, P(48, 8), P(48, 92), 3, 3), wt, { band: 1, hi: 0.4, stroke: 1.1 });
    celI(c, () => ellipsePath(c, P(48, 82), 10, 4), tone(0x7a4e2c), { band: 1, hi: 0.4, stroke: 1.1 });
    // silk cocoon
    const st = tone(0xeef0f6, { light: 0.4, shadow: 0.25 });
    const coc = (): void => ellipsePath(c, P(48, 46), 20, 28);
    celI(c, coc, st, { band: 3, hi: 1.2 });
    clipTo(c, coc, () => {
      for (let i = -4; i <= 4; i++) {
        c.beginPath();
        c.moveTo(24, 46 + i * 7 - 8);
        c.quadraticCurveTo(48, 46 + i * 7 + 6, 72, 46 + i * 7 - 8);
        c.strokeStyle = i % 2 === 0 ? st.shade : 'rgba(255,255,255,0.8)';
        c.lineWidth = 1;
        c.stroke();
      }
    });
    c.restore();
    // loose strand
    c.save();
    c.beginPath(); c.moveTo(64, 58); c.bezierCurveTo(78, 66, 70, 80, 84, 88);
    c.strokeStyle = 'rgba(240,244,252,0.95)'; c.lineWidth = 1.4; c.stroke();
    c.restore();
  },
  opts: { under: (c) => glow(c, P(48, 48), 30, 0xd8e8ff, 0.25), over: (c) => sparkle(c, 34, 30, 4.5, '#ffffff', 0.95) },
};

const scale: IconSpec = {
  draw: (c) => {
    const col = 0xe0582a;
    const st = tone(col, { light: 0.4 });
    const body = (): void => {
      c.moveTo(48, 90);
      c.bezierCurveTo(22, 72, 12, 44, 18, 18);
      c.quadraticCurveTo(48, 6, 78, 18);
      c.bezierCurveTo(84, 44, 74, 72, 48, 90);
      c.closePath();
    };
    celI(c, body, st, { band: 3.6, hi: 1.4, stroke: 1.6 });
    clipTo(c, body, () => {
      // central keel and growth ridges
      c.fillStyle = st.light;
      c.beginPath(); c.moveTo(48, 16); c.lineTo(54, 52); c.lineTo(48, 86); c.lineTo(42, 52); c.closePath(); c.fill();
      for (let i = 1; i <= 3; i++) {
        c.beginPath();
        c.moveTo(18 + i * 4, 18 + i * 12);
        c.quadraticCurveTo(48, 30 + i * 16, 78 - i * 4, 18 + i * 12);
        c.strokeStyle = st.shade; c.lineWidth = 1.2; c.stroke();
      }
      // iridescent edge
      const g = c.createLinearGradient(14, 10, 82, 90);
      g.addColorStop(0, 'rgba(90,230,210,0.95)');
      g.addColorStop(0.5, 'rgba(200,120,255,0.9)');
      g.addColorStop(1, 'rgba(255,210,90,0.95)');
      c.beginPath(); body();
      c.strokeStyle = g; c.lineWidth = 5; c.stroke();
    });
  },
  opts: { under: (c) => glow(c, P(48, 50), 36, 0xff6a2a, 0.25), over: (c) => sparkle(c, 30, 26, 5, '#ffffff', 0.95) },
};

const bone: IconSpec = {
  draw: (c) => {
    const bt = tone(BONE_C, { light: 0.35 });
    const one = (a: V, b: V): void => {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      for (const e of [a, b]) {
        for (const s of [-1, 1]) {
          celI(c, () => c.arc(e.x + nx * s * 5, e.y + ny * s * 5, 6.4, 0, Math.PI * 2), bt, { band: 1.6, hi: 0.6, stroke: 1.3 });
        }
      }
      const shaft = (): void => capsulePath(c, P(a.x + Math.cos(ang) * 3, a.y + Math.sin(ang) * 3), P(b.x - Math.cos(ang) * 3, b.y - Math.sin(ang) * 3), 5, 5);
      celI(c, shaft, bt, { band: 1.8, hi: 0.7, stroke: 1.3 });
      line(c, [P(a.x + Math.cos(ang) * 14 + nx * 2, a.y + Math.sin(ang) * 14 + ny * 2), P(b.x - Math.cos(ang) * 14 + nx * 2, b.y - Math.sin(ang) * 14 + ny * 2)], 1, bt.shade);
    };
    one(P(20, 22), P(76, 76));
    one(P(76, 22), P(20, 76));
    // age stains
    c.fillStyle = css(0xa08a5a, 0.5);
    c.beginPath(); c.ellipse(62, 62, 4, 2.4, 0.8, 0, Math.PI * 2); c.fill();
  },
  opts: { over: (c) => sparkle(c, 30, 26, 4, '#ffffff', 0.85) },
};

// ════════════════════════════════════════════════════════════════════════
// Minerals & metals
// ════════════════════════════════════════════════════════════════════════

/** A hexagonal crystal prism from base `b` pointing along `ang`, length `len`, half-width `w`. */
function prism(c: CanvasRenderingContext2D, b: V, ang: number, len: number, w: number, color: number): void {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const nx = -dy;
  const ny = dx;
  const tipLen = w * 1.6;
  const p = (along: number, side: number): V => P(b.x + dx * along + nx * side, b.y + dy * along + ny * side);
  const L = p(0, -w); const R = p(0, w);
  const L2 = p(len - tipLen, -w); const R2 = p(len - tipLen, w);
  const T = p(len, 0);
  const ct = tone(color, { light: 0.5, shadow: 0.35 });
  // left facet (lit), right facet (shade), centre ridge
  const M = p(0, w * 0.1); const M2 = p(len - tipLen, w * 0.1);
  c.save();
  c.beginPath(); polyPath(c, [L, L2, T, M2, M]); c.fillStyle = ct.light; c.fill();
  c.beginPath(); polyPath(c, [M, M2, T, R2, R]); c.fillStyle = ct.base; c.fill();
  c.beginPath(); polyPath(c, [p(0, w * 0.55), p(len - tipLen, w * 0.55), T, R2, R]); c.fillStyle = ct.shade; c.fill();
  c.beginPath(); polyPath(c, [L, L2, T, R2, R]); c.strokeStyle = ct.line; c.lineWidth = 1.4; c.lineJoin = 'round'; c.stroke();
  line(c, [M, M2, T], 0.8, css(mixHex(color, 0xffffff, 0.6), 0.8));
  c.restore();
}

const crystal: IconSpec = {
  draw: (c) => {
    const col = 0x9ad4ff;
    celI(c, () => blobPath(c, [P(16, 80), P(30, 70), P(52, 68), P(76, 72), P(84, 84), P(50, 90), P(22, 90)]), tone(0x6e7888), { band: 1.8, hi: 0.7 });
    prism(c, P(30, 80), -Math.PI / 2 - 0.55, 40, 7, mixHex(col, 0xffffff, 0.15));
    prism(c, P(66, 80), -Math.PI / 2 + 0.5, 42, 7.5, col);
    prism(c, P(48, 82), -Math.PI / 2 - 0.05, 66, 10, col);
    prism(c, P(58, 84), -Math.PI / 2 + 0.95, 24, 5, mixHex(col, 0x5a80d0, 0.3));
  },
  opts: {
    under: (c) => glow(c, P(48, 44), 34, 0x8ad0ff, 0.3),
    over: (c) => { sparkle(c, 44, 30, 5.5, '#ffffff', 0.95); sparkle(c, 70, 50, 3.5, '#ffffff', 0.85); },
  },
};

const voidCrystal: IconSpec = {
  draw: (c) => {
    const col = 0x5a2c96;
    const shard = (): void => polyPath(c, [P(40, 90), P(28, 58), P(36, 26), P(54, 6), P(64, 34), P(66, 64), P(56, 90)]);
    const st = tone(col, { light: 0.4, shadow: 0.5 });
    celI(c, shard, st, { band: 3.6, hi: 1.4, stroke: 1.6 });
    clipTo(c, shard, () => {
      c.fillStyle = css(mixHex(col, 0x0a0418, 0.5));
      c.beginPath(); polyPath(c, [P(54, 6), P(64, 34), P(66, 64), P(56, 90), P(50, 60), P(52, 30)]); c.fill();
      // inner glow core
      const g = c.createRadialGradient(47, 54, 1, 47, 54, 20);
      g.addColorStop(0, 'rgba(240,200,255,0.95)');
      g.addColorStop(0.35, 'rgba(190,110,255,0.8)');
      g.addColorStop(1, 'rgba(120,40,200,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 96, 96);
      line(c, [P(36, 26), P(52, 30), P(50, 60), P(40, 90)], 1, css(0xc890ff, 0.7));
    });
    // small side shards
    celI(c, () => polyPath(c, [P(22, 90), P(16, 72), P(20, 60), P(30, 76), P(30, 90)]), st, { band: 1.6, hi: 0.6, stroke: 1.3 });
    celI(c, () => polyPath(c, [P(64, 90), P(70, 70), P(80, 64), P(78, 82), P(72, 90)]), st, { band: 1.6, hi: 0.6, stroke: 1.3 });
  },
  opts: {
    under: (c) => glow(c, P(48, 54), 40, 0xa050ff, 0.45),
    over: (c) => { glow(c, P(47, 54), 12, 0xd090ff, 0.5); sparkle(c, 40, 30, 4.5, '#f0e0ff', 0.9); },
  },
};

const ingot: IconSpec = {
  draw: (c) => {
    const col = 0xcf8e48;
    const it = tone(col, { light: 0.45 });
    // trapezoid bar in 3/4 view: top face, front face, end face
    const top = [P(26, 34), P(72, 28), P(80, 40), P(34, 48)];
    const front = [P(34, 48), P(80, 40), P(88, 62), P(26, 72)];
    const end = [P(26, 34), P(34, 48), P(26, 72), P(12, 56)];
    c.beginPath(); polyPath(c, front); c.fillStyle = it.base; c.fill();
    c.beginPath(); polyPath(c, end); c.fillStyle = it.shade; c.fill();
    c.beginPath(); polyPath(c, top); c.fillStyle = it.light; c.fill();
    for (const f of [front, end, top]) { c.beginPath(); polyPath(c, f); c.strokeStyle = it.line; c.lineWidth = 1.4; c.lineJoin = 'round'; c.stroke(); }
    // stamped rune on the top face
    c.save();
    c.strokeStyle = it.shade; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(46, 36); c.lineTo(58, 34);
    c.moveTo(52, 31); c.lineTo(52, 43);
    c.moveTo(47, 42); c.lineTo(52, 37); c.lineTo(57, 41);
    c.stroke();
    c.restore();
    streak(c, [P(38, 58), P(74, 52)], 2.4, 'rgba(255,240,210,0.7)');
  },
  opts: { over: (c) => sparkle(c, 70, 32, 5, '#ffffff', 0.95) },
};

const mithril: IconSpec = {
  draw: (c) => {
    const it = tone(0x4d5361);
    // claw setting
    celI(c, () => blobPath(c, [P(30, 84), P(48, 76), P(66, 84), P(60, 92), P(36, 92)]), it, { band: 1.4, hi: 0.5 });
    for (const [a, b] of [[P(30, 82), P(20, 44)], [P(66, 82), P(76, 44)], [P(48, 82), P(48, 76)]] as const) {
      celI(c, () => capsulePath(c, a, b, 4, 2.4), it, { band: 1, hi: 0.4, stroke: 1.1 });
    }
    glassOrb(c, 48, 52, 24, 0xdfe8f4, 0x6a7890);
    // metallic swirl bands
    clipTo(c, () => c.arc(48, 52, 24, 0, Math.PI * 2), () => {
      c.strokeStyle = 'rgba(160,180,210,0.8)'; c.lineWidth = 2;
      for (const k of [-8, 4]) { c.beginPath(); c.moveTo(22, 52 + k); c.quadraticCurveTo(48, 40 + k, 74, 56 + k); c.stroke(); }
    });
    streak(c, [P(32, 52), P(34, 38), P(46, 32)], 3, 'rgba(255,255,255,0.95)');
    // prong tips over the orb
    for (const x of [22, 74]) celI(c, () => c.arc(x, 44, 3.4, 0, Math.PI * 2), tone(0x8c95a3), { band: 0.8, hi: 0.3, stroke: 1 });
  },
  opts: {
    under: (c) => glow(c, P(48, 52), 40, 0xe8f4ff, 0.5),
    over: (c) => { sparkle(c, 60, 40, 6, '#ffffff', 1); sparkle(c, 30, 70, 3.5, '#ffffff', 0.8); },
  },
};

const rune: IconSpec = {
  draw: (c) => {
    const st = tone(0x7a8292, { light: 0.3 });
    const slab = (): void => polyPath(c, [P(18, 20), P(62, 14), P(66, 28), P(74, 34), P(70, 52), P(80, 64), P(74, 86), P(22, 84), P(16, 60), P(24, 46)]);
    celI(c, slab, st, { band: 3.4, hi: 1.4, stroke: 1.5 });
    clipTo(c, slab, () => {
      // thickness edge along the bottom
      c.fillStyle = st.shade;
      c.fillRect(0, 80, 96, 16);
      line(c, [P(22, 20), P(28, 34)], 1, st.shade);
      line(c, [P(60, 78), P(66, 70)], 1, st.shade);
      // glowing rune
      c.save();
      c.strokeStyle = '#ffd08a'; c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round';
      c.shadowColor = 'rgba(255,130,30,1)'; c.shadowBlur = 6;
      c.beginPath();
      c.moveTo(46, 26); c.lineTo(46, 74);
      c.moveTo(46, 36); c.lineTo(60, 46);
      c.moveTo(46, 46); c.lineTo(32, 56);
      c.moveTo(46, 62); c.lineTo(58, 70);
      c.stroke();
      c.strokeStyle = '#ff8a2a'; c.lineWidth = 1.4; c.shadowBlur = 0;
      c.stroke();
      c.restore();
    });
  },
  opts: { under: (c) => glow(c, P(46, 50), 34, 0xff7a1a, 0.3), over: (c) => glow(c, P(46, 50), 22, 0xff8a2a, 0.45) },
};

const water: IconSpec = {
  draw: (c) => {
    const lt = tone(0x9a6038, { light: 0.35 });
    const bag = (): void => { c.moveTo(38, 30); c.bezierCurveTo(12, 40, 12, 86, 44, 88); c.bezierCurveTo(78, 90, 80, 50, 54, 30); c.closePath(); };
    celI(c, bag, lt, { band: 3.6, hi: 1.4 });
    clipTo(c, bag, () => {
      // stitched seam
      c.save(); c.setLineDash([3, 3]);
      line(c, [P(24, 58), P(30, 76), P(46, 84), P(64, 76)], 1.2, css(0xe8c890));
      c.restore();
      c.fillStyle = css(0x2a1810, 0.2);
      c.beginPath(); c.ellipse(60, 70, 14, 14, 0, 0, Math.PI * 2); c.fill();
    });
    // neck + cord
    celI(c, () => { c.moveTo(38, 30); c.lineTo(40, 18); c.lineTo(52, 18); c.lineTo(54, 30); c.closePath(); }, lt, { band: 1.2, hi: 0.5, stroke: 1.2 });
    celI(c, () => roundRectPath(c, 36, 24, 20, 5, 2), tone(0xd8b878), { band: 0.8, hi: 0.3, stroke: 1 });
    line(c, [P(56, 26), P(72, 22), P(80, 30)], 1.6, css(0xd8b878));
    // wooden stopper
    celI(c, () => roundRectPath(c, 41, 8, 10, 11, 2.5), tone(WOOD), { band: 1.2, hi: 0.5, stroke: 1.2 });
    // water droplet accent
    celI(c, () => { c.moveTo(76, 44); c.bezierCurveTo(84, 56, 86, 64, 76, 66); c.bezierCurveTo(66, 64, 68, 56, 76, 44); c.closePath(); }, tone(0x3a9cff, { light: 0.45 }), { band: 1.8, hi: 0.7, stroke: 1.2 });
    c.beginPath(); c.arc(73.5, 59, 1.8, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill();
  },
  opts: { over: (c) => { glow(c, P(76, 58), 14, 0x4ab0ff, 0.4); sparkle(c, 28, 44, 4, '#fff4d8', 0.8); } },
};

function vialBody(c: CanvasRenderingContext2D): void {
  c.moveTo(42, 30); c.lineTo(54, 30); c.lineTo(54, 44);
  c.bezierCurveTo(70, 50, 70, 84, 48, 84);
  c.bezierCurveTo(26, 84, 26, 50, 42, 44);
  c.closePath();
}

const venom: IconSpec = {
  draw: (c) => {
    const col = 0xb4e024;
    const lt = tone(col, { light: 0.45, shadow: 0.35 });
    const body = (): void => vialBody(c);
    c.beginPath(); body(); c.fillStyle = 'rgba(200,225,245,0.35)'; c.fill();
    clipTo(c, body, () => {
      const g = c.createLinearGradient(30, 52, 66, 84);
      g.addColorStop(0, lt.light); g.addColorStop(0.5, lt.base); g.addColorStop(1, lt.shade);
      c.fillStyle = g; c.fillRect(0, 54, 96, 42);
      c.beginPath(); c.ellipse(48, 54, 16, 3, 0, 0, Math.PI * 2); c.fillStyle = css(mixHex(col, 0xffffff, 0.45)); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1;
      for (const [x, y, r] of [[54, 66, 2.2], [44, 74, 1.6]] as const) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
    });
    c.beginPath(); body(); c.strokeStyle = css(0x3a4a18); c.lineWidth = 1.8; c.lineJoin = 'round'; c.stroke();
    streak(c, [P(36, 74), P(35, 60), P(40, 50)], 2.6, 'rgba(255,255,255,0.85)');
    // lip + cork
    celI(c, () => roundRectPath(c, 39, 28, 18, 5, 2), tone(0xcfe4f2), { band: 1, hi: 0.4, stroke: 1.1 });
    celI(c, () => roundRectPath(c, 42, 16, 12, 12, 2.5), tone(0x6a4a30), { band: 1.4, hi: 0.5 });
    // drip running down the side and falling
    celI(c, () => { c.moveTo(56, 32); c.quadraticCurveTo(62, 36, 60, 44); c.quadraticCurveTo(58, 46, 57, 40); c.closePath(); }, lt, { band: 0.8, hi: 0.3, stroke: 1 });
    celI(c, () => { c.moveTo(72, 50); c.bezierCurveTo(78, 58, 78, 64, 72, 64); c.bezierCurveTo(66, 64, 66, 58, 72, 50); c.closePath(); }, lt, { band: 1.2, hi: 0.5, stroke: 1.2 });
    // skull-ish warning dots on a tag
    celI(c, () => polyPath(c, [P(24, 30), P(38, 34), P(34, 44), P(20, 40)]), tone(0xe8dcc0), { band: 0.8, hi: 0.3, stroke: 1 });
    c.fillStyle = css(0x3a3020);
    c.beginPath(); c.arc(27, 36, 1.4, 0, Math.PI * 2); c.arc(32, 38, 1.4, 0, Math.PI * 2); c.fill();
  },
  opts: { under: (c) => glow(c, P(48, 68), 30, 0xb4e024, 0.35), over: (c) => sparkle(c, 58, 58, 4, '#ffffff', 0.9) },
};

const essence: IconSpec = {
  draw: (c) => {
    // small dark-iron cradle
    const it = tone(0x3a2c3a);
    celI(c, () => { c.moveTo(30, 76); c.lineTo(66, 76); c.lineTo(60, 90); c.lineTo(36, 90); c.closePath(); }, it, { band: 1.4, hi: 0.5 });
    for (const s of [-1, 1]) celI(c, () => { c.moveTo(48 + s * 14, 78); c.quadraticCurveTo(48 + s * 30, 70, 48 + s * 24, 50); c.lineTo(48 + s * 20, 52); c.quadraticCurveTo(48 + s * 24, 70, 48 + s * 10, 78); c.closePath(); }, it, { band: 1, hi: 0.4, stroke: 1.1 });
    glassOrb(c, 48, 50, 25, 0x3a0a2a, 0xb03a70);
    clipTo(c, () => c.arc(48, 50, 25, 0, Math.PI * 2), () => {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      for (const [col, w, off] of [[0xff2a58, 5, 0], [0xff5ad8, 3, 2.1], [0xffb0d0, 1.4, 4.2]] as const) {
        c.beginPath();
        for (let i = 0; i <= 50; i++) {
          const a = off + i * 0.24;
          const r = 2 + i * 0.4;
          const x = 48 + Math.cos(a) * r;
          const y = 50 + Math.sin(a) * r * 0.85;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.strokeStyle = css(col, 0.9); c.lineWidth = w; c.stroke();
      }
      c.restore();
    });
    streak(c, [P(31, 52), P(33, 38), P(45, 30)], 2.6, 'rgba(255,255,255,0.85)');
  },
  opts: {
    under: (c) => glow(c, P(48, 50), 40, 0xff2a70, 0.45),
    over: (c) => { glow(c, P(48, 50), 12, 0xff60c0, 0.5); sparkle(c, 62, 36, 4.5, '#ffe0f0', 0.9); },
  },
};

const ash: IconSpec = {
  draw: (c) => {
    const at = tone(0x7c7478, { light: 0.35 });
    const pile = (): void => { c.moveTo(10, 82); c.bezierCurveTo(18, 58, 32, 40, 48, 38); c.bezierCurveTo(64, 40, 80, 58, 86, 82); c.quadraticCurveTo(48, 90, 10, 82); c.closePath(); };
    celI(c, pile, at, { band: 3.4, hi: 1.4 });
    clipTo(c, pile, () => {
      // darker charcoal flecks + ember glints
      c.fillStyle = css(0x3a3438);
      for (const [x, y, r] of [[30, 70, 4], [58, 58, 3.4], [68, 76, 4.4], [42, 80, 3]] as const) { c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0.3, 0, Math.PI * 2); c.fill(); }
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const [x, y, r] of [[48, 56, 6], [34, 66, 4], [62, 70, 4.6], [52, 76, 3.4], [24, 78, 3]] as const) {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,240,160,1)');
        g.addColorStop(0.4, 'rgba(255,130,30,0.95)');
        g.addColorStop(1, 'rgba(200,40,10,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
      c.restore();
      line(c, [P(22, 64), P(40, 50)], 1, at.light);
    });
    // rising smoke wisp
    c.save();
    c.beginPath(); c.moveTo(48, 36); c.bezierCurveTo(40, 26, 58, 22, 50, 10);
    c.strokeStyle = 'rgba(190,184,190,0.85)'; c.lineWidth = 2.4; c.lineCap = 'round'; c.stroke();
    c.restore();
  },
  opts: {
    under: (c) => glow(c, P(48, 66), 34, 0xff6a1a, 0.3),
    over: (c) => { glow(c, P(48, 64), 16, 0xff8a2a, 0.45); for (const [x, y] of [[38, 30], [60, 26], [66, 40]] as const) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fillStyle = '#ffb040'; c.fill(); } },
  },
};

const SPECS: Record<QuestItemKind, IconSpec> = {
  herb, moon_herb: moonHerb, mushroom, gel, pendant, pelt, fang, silk,
  relic, crystal, ingot, rune, mithril, scale, water, venom,
  essence, seal, void_crystal: voidCrystal, ash, bone, letter,
};
