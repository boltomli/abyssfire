/**
 * Painted skill emblems.
 *
 * generateSkillIcons(scene) creates `skill_icon_<skillId>` textures
 * (SKILL_ICON_SIZE² px) for every skill of every class: a rounded-square
 * emblem with an element-coloured backdrop (damage type; physical skills are
 * tinted by their tree), a carved iron frame and a cel-shaded, inked motif.
 * Unknown skill ids get a generic element motif.
 */
import Phaser from 'phaser';
import { AllClasses } from '../../data/classes';
import type { SkillDefinition } from '../../data/types';
import { capsulePath, ellipsePath, blobPath, polyPath } from '../sprites/rig/Rig';
import {
  P, UNIT, celI, tone, glow, css, mixHex, ribbonPath, sample, roundRectPath, sparkle, streak, line,
  clipTo, facetGem, gemCut, inked, starPath, type V, type InkOpts,
} from './IconKit';
import { drawBladeMotif, drawAxe, torsoPath, heaterPath, bez, bootPath } from './ItemIcons';

export const SKILL_ICON_SIZE = 128;

export function skillIconKey(skillId: string): string {
  return `skill_icon_${skillId}`;
}

type Element = SkillDefinition['damageType'];

interface Backdrop {
  mid: number;
  deep: number;
  rim: number;
}

const ELEMENT_BG: Record<Exclude<Element, 'physical'>, Backdrop> = {
  fire: { mid: 0xd0501c, deep: 0x3a0a06, rim: 0xffb060 },
  ice: { mid: 0x2e8ed6, deep: 0x081a3a, rim: 0xaeeaff },
  lightning: { mid: 0x6a52e6, deep: 0x120c3a, rim: 0xd8d0ff },
  poison: { mid: 0x4f9c22, deep: 0x0a2008, rim: 0xc8ff80 },
  arcane: { mid: 0x9a3ad6, deep: 0x1e0838, rim: 0xf0b0ff },
};

const TREE_BG: Record<string, Backdrop> = {
  combat_master: { mid: 0xb4742e, deep: 0x2a1206, rim: 0xffd890 },
  guardian: { mid: 0x3a6eaa, deep: 0x0a1428, rim: 0xb8d8ff },
  berserker: { mid: 0xa82a26, deep: 0x280606, rim: 0xffa080 },
  assassination: { mid: 0x5e3c90, deep: 0x120822, rim: 0xd8b8ff },
  archery: { mid: 0x3a8c5a, deep: 0x08200e, rim: 0xc0f0b0 },
  traps: { mid: 0xa47c2a, deep: 0x221806, rim: 0xffe0a0 },
};

function backdropFor(skill: Pick<SkillDefinition, 'damageType' | 'tree'>): Backdrop {
  if (skill.damageType !== 'physical') return ELEMENT_BG[skill.damageType];
  return TREE_BG[skill.tree] ?? TREE_BG.combat_master;
}

/** Generate every class skill's emblem texture (idempotent). */
export function generateSkillIcons(scene: Phaser.Scene): void {
  for (const cls of Object.values(AllClasses)) {
    for (const skill of cls.skills) ensureSkillIcon(scene, skill);
  }
}

export function ensureSkillIcon(scene: Phaser.Scene, skill: Pick<SkillDefinition, 'id' | 'damageType' | 'tree'>): string {
  const key = skillIconKey(skill.id);
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = SKILL_ICON_SIZE;
  canvas.height = SKILL_ICON_SIZE;
  drawSkillIcon(canvas.getContext('2d')!, skill, SKILL_ICON_SIZE);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Paint one emblem into `ctx` at size × size px. */
export function drawSkillIcon(ctx: CanvasRenderingContext2D, skill: Pick<SkillDefinition, 'id' | 'damageType' | 'tree'>, size: number): void {
  const bg = backdropFor(skill);
  const k = size / UNIT;
  const inset = 2 * k;
  const r = 15 * k;
  const w = size - inset * 2;
  const frame = (): void => roundRectPath(ctx, inset, inset, w, w, r);

  ctx.save();
  // Backdrop
  ctx.beginPath();
  frame();
  const g = ctx.createRadialGradient(size * 0.4, size * 0.36, size * 0.05, size * 0.5, size * 0.5, size * 0.72);
  g.addColorStop(0, css(mixHex(bg.mid, 0xffffff, 0.22)));
  g.addColorStop(0.45, css(bg.mid));
  g.addColorStop(1, css(bg.deep));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Painted rays behind the motif
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, -size * 0.09);
    ctx.lineTo(size, size * 0.09);
    ctx.closePath();
    ctx.fillStyle = css(bg.rim, 0.045);
    ctx.fill();
  }
  ctx.restore();

  // Motif
  const m = MOTIFS[skill.id] ?? genericMotif(skill.damageType);
  const opts: InkOpts = { ...m.opts, scale: m.opts?.scale ?? 0.9, inkWidth: m.opts?.inkWidth ?? 2.1 };
  inked(ctx, size, m.draw, opts);

  // Vignette
  const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.36, size / 2, size / 2, size * 0.74);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // Frame: dark iron, inner element hairline, top-left bevel
  ctx.beginPath();
  frame();
  ctx.lineWidth = 3.2 * k;
  ctx.strokeStyle = '#17121c';
  ctx.stroke();
  ctx.beginPath();
  roundRectPath(ctx, inset + 2.6 * k, inset + 2.6 * k, w - 5.2 * k, w - 5.2 * k, r - 2.4 * k);
  ctx.lineWidth = 1.2 * k;
  ctx.strokeStyle = css(bg.rim, 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(inset + 1.2 * k, inset + r);
  ctx.arcTo(inset + 1.2 * k, inset + 1.2 * k, inset + r, inset + 1.2 * k, r - 1.2 * k);
  ctx.lineTo(size * 0.6, inset + 1.2 * k);
  ctx.lineWidth = 1 * k;
  ctx.strokeStyle = 'rgba(255,240,210,0.35)';
  ctx.stroke();
  ctx.restore();
}

// ════════════════════════════════════════════════════════════════════════
// Motif helpers
// ════════════════════════════════════════════════════════════════════════

interface Motif {
  draw: (c: CanvasRenderingContext2D) => void;
  opts?: InkOpts;
}

const STEEL = 0xd0d8e2;
const GOLD = 0xe8b848;
const BONE = 0xece2c6;
const WOOD = 0x9a6a3a;

/** Tapered crescent swoosh along an arc (head at a1). */
function swoosh(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number, w: number, color: number): void {
  const pts = sample(24, (t) => { const a = a0 + (a1 - a0) * t; return P(cx + Math.cos(a) * r, cy + Math.sin(a) * r); });
  const wf = (t: number): [number, number] => { const v = w * Math.pow(t, 0.8) * Math.pow(1 - t, 0.25); return a1 > a0 ? [0, v] : [v, 0]; };
  const t = tone(color, { light: 0.6 });
  celI(c, () => ribbonPath(c, pts, wf), t, { band: 1.4, hi: 0.6, stroke: 1 });
  streak(c, pts.slice(8, 23), 1.4, 'rgba(255,255,255,0.85)');
}

/** Layered cartoon flame, base at (x, y), height h. */
function flame(c: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, lean = 0): void {
  const layer = (s: number, color: number): void => {
    const hh = h * s;
    const ww = w * s;
    const tip = P(x + lean * hh, y - hh);
    celI(c, () => {
      c.moveTo(x - ww, y - ww * 0.4);
      c.bezierCurveTo(x - ww * 1.1, y - hh * 0.45, x - ww * 0.2 + lean * hh * 0.4, y - hh * 0.6, tip.x, tip.y);
      c.bezierCurveTo(x + ww * 0.5 + lean * hh * 0.5, y - hh * 0.55, x + ww * 1.2, y - hh * 0.4, x + ww, y - ww * 0.4);
      c.quadraticCurveTo(x, y + ww * 0.9, x - ww, y - ww * 0.4);
      c.closePath();
    }, tone(color, { light: 0.45 }), { band: 1.6 * s, hi: 0.6 * s, stroke: 1 });
  };
  layer(1, 0xe8401c);
  layer(0.72, 0xff9a22);
  layer(0.42, 0xffe070);
}

function snowflake(c: CanvasRenderingContext2D, x: number, y: number, r: number, color = 0xeaf8ff): void {
  c.save();
  c.translate(x, y);
  for (let i = 0; i < 6; i++) {
    c.rotate(Math.PI / 3);
    line(c, [P(0, 0), P(0, -r)], r * 0.16, css(color));
    line(c, [P(-r * 0.28, -r * 0.72), P(0, -r * 0.5), P(r * 0.28, -r * 0.72)], r * 0.12, css(color));
  }
  c.restore();
}

function bolt(c: CanvasRenderingContext2D, pts: readonly V[], w: number): void {
  const t = tone(0xfff08a, { light: 0.6 });
  celI(c, () => ribbonPath(c, pts, (u) => w * (1 - u * 0.6)), t, { band: 1, hi: 0.4, stroke: 1 });
  streak(c, pts, w * 0.5, 'rgba(255,255,255,0.9)');
}

function arrow(c: CanvasRenderingContext2D, a: V, b: V, opts: { head?: number; fletch?: number; shaft?: number; w?: number } = {}): void {
  const w = opts.w ?? 1;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  c.save();
  c.translate(b.x, b.y);
  c.rotate(ang);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  // shaft along -x from the tip
  celI(c, () => capsulePath(c, P(-len, 0), P(-6 * w, 0), 1.9 * w, 1.9 * w), tone(opts.shaft ?? WOOD), { band: 0.8, hi: 0.3, stroke: 0.9 });
  const ft = tone(opts.fletch ?? 0xe8e0d0);
  for (const s of [-1, 1]) {
    celI(c, () => polyPath(c, [P(-len + 1, 0), P(-len - 3 * w, s * 6 * w), P(-len + 9 * w, s * 5.5 * w), P(-len + 10 * w, 0)]), ft, { band: 0.8, hi: 0.3, stroke: 0.9 });
  }
  celI(c, () => polyPath(c, [P(2 * w, 0), P(-9 * w, -5 * w), P(-6.5 * w, 0), P(-9 * w, 5 * w)]), tone(opts.head ?? STEEL, { light: 0.5 }), { band: 1, hi: 0.4, stroke: 1 });
  c.restore();
}

function speedLines(c: CanvasRenderingContext2D, pts: readonly [V, V][], color = 'rgba(255,255,255,0.85)'): void {
  for (const [a, b] of pts) streak(c, [a, b], 2.2, color);
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number): () => void {
  return () => {
    c.moveTo(x, y + 26 * s);
    c.bezierCurveTo(x - 36 * s, y + 2 * s, x - 26 * s, y - 26 * s, x, y - 12 * s);
    c.bezierCurveTo(x + 26 * s, y - 26 * s, x + 36 * s, y + 2 * s, x, y + 26 * s);
    c.closePath();
  };
}

function skull(c: CanvasRenderingContext2D, x: number, y: number, s: number, eye = 0x100810, color = BONE): void {
  const t = tone(color);
  celI(c, () => {
    c.moveTo(x - 16 * s, y + 4 * s);
    c.bezierCurveTo(x - 20 * s, y - 22 * s, x + 20 * s, y - 22 * s, x + 16 * s, y + 4 * s);
    c.lineTo(x + 10 * s, y + 10 * s);
    c.lineTo(x + 9 * s, y + 18 * s);
    c.lineTo(x - 9 * s, y + 18 * s);
    c.lineTo(x - 10 * s, y + 10 * s);
    c.closePath();
  }, t, { band: 2.4 * s, hi: 1 * s });
  c.fillStyle = css(eye);
  c.beginPath(); c.ellipse(x - 7 * s, y - 1 * s, 5 * s, 5.6 * s, 0.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(x + 7 * s, y - 1 * s, 5 * s, 5.6 * s, -0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#100810';
  c.beginPath(); polyPath(c, [P(x, y + 5 * s), P(x + 2.6 * s, y + 9 * s), P(x - 2.6 * s, y + 9 * s)]); c.fill();
  for (let i = -1; i <= 1; i++) line(c, [P(x + i * 4 * s, y + 12 * s), P(x + i * 4 * s, y + 18 * s)], 1.1, t.shade);
}

function cloudPath(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  blobPath(c, [
    P(x - 30 * s, y + 8 * s), P(x - 32 * s, y - 6 * s), P(x - 18 * s, y - 14 * s), P(x - 8 * s, y - 24 * s),
    P(x + 10 * s, y - 22 * s), P(x + 20 * s, y - 12 * s), P(x + 32 * s, y - 8 * s), P(x + 32 * s, y + 8 * s),
  ]);
}

function blade(c: CanvasRenderingContext2D, key: string, dagger: boolean, x: number, y: number, rot: number, s: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);
  drawBladeMotif(c, key, dagger);
  c.restore();
}

function heater(c: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number, face: number, rim: number): void {
  celI(c, () => heaterPath(c, cx, top, w, h), tone(rim, { light: 0.45 }), { band: 2, hi: 0.8 });
  c.save();
  c.translate(cx, top + h * 0.45);
  c.scale(0.82, 0.85);
  c.translate(-cx, -(top + h * 0.45));
  celI(c, () => heaterPath(c, cx, top, w, h), tone(face, { light: 0.4 }), { band: 3, hi: 1.2 });
  c.restore();
}

// ════════════════════════════════════════════════════════════════════════
// Motifs
// ════════════════════════════════════════════════════════════════════════

const MOTIFS: Record<string, Motif> = {
  // ── Warrior ──────────────────────────────────────────────────────────
  slash: {
    draw: (c) => {
      blade(c, 'w_broad_sword', false, 32, 70, Math.PI / 4, 1.05);
      swoosh(c, 44, 60, 38, Math.PI * 1.05, Math.PI * 1.95, 13, 0xfff0c8);
    },
  },
  whirlwind: {
    draw: (c) => {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        swoosh(c, 48, 48, 34 - i * 2, a, a + Math.PI * 0.85, 11, i === 0 ? 0xfff0c8 : 0xe8d8b8);
      }
      blade(c, 'w_claymore', false, 44, 58, Math.PI / 5, 0.62);
    },
    opts: { over: (c) => sparkle(c, 70, 24, 5) },
  },
  war_stomp: {
    draw: (c) => {
      const gt = tone(0x8a6a48);
      celI(c, () => ellipsePath(c, P(48, 78), 40, 13), gt, { band: 2, hi: 0.8 });
      for (const pts of [[P(48, 78), P(30, 84), P(16, 80)], [P(48, 78), P(66, 86), P(80, 82)], [P(48, 78), P(52, 90)], [P(48, 78), P(40, 70), P(26, 70)]]) line(c, pts, 1.8, '#2a1a10');
      for (const [x, y, r] of [[22, 60, 4], [74, 58, 3.5], [30, 50, 2.6], [68, 46, 2.4]] as const) celI(c, () => blobPath(c, [P(x - r, y), P(x, y - r), P(x + r, y + r * 0.2), P(x, y + r)]), gt, { band: 1, hi: 0.4, stroke: 1 });
      c.save();
      c.translate(48, 40);
      c.scale(0.72, 0.72);
      c.translate(-59, -50);
      celI(c, () => bootPath(c), tone(0xb8c2cf, { light: 0.5 }), { band: 3, hi: 1.3 });
      for (const y of [30, 42, 54]) line(c, [P(30, y), P(66, y + 1)], 1.6, tone(0xb8c2cf).shade);
      celI(c, () => roundRectPath(c, 26, 10, 44, 8, 3), tone(GOLD), { band: 1.2, hi: 0.5 });
      c.restore();
    },
    opts: {
      under: (c) => {
        c.save();
        c.strokeStyle = 'rgba(255,220,140,0.85)';
        for (const [rx, lw] of [[30, 3], [40, 2.2], [48, 1.4]] as const) { c.lineWidth = lw; c.beginPath(); c.ellipse(48, 78, rx, rx * 0.32, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
      },
    },
  },
  shield_wall: {
    draw: (c) => {
      heater(c, 26, 22, 20, 54, 0x5a6a88, 0x3a4050);
      heater(c, 70, 22, 20, 54, 0x5a6a88, 0x3a4050);
      heater(c, 48, 12, 26, 72, 0x3e6ab0, 0x9aa4b4);
      celI(c, () => { roundRectPath(c, 45, 24, 6, 44, 2); }, tone(GOLD), { band: 1, hi: 0.4, stroke: 1 });
      celI(c, () => { roundRectPath(c, 34, 36, 28, 6, 2); }, tone(GOLD), { band: 1, hi: 0.4, stroke: 1 });
    },
    opts: { over: (c) => sparkle(c, 36, 20, 5) },
  },
  taunt_roar: {
    draw: (c) => {
      const it = tone(0xb8c2cf, { light: 0.5 });
      celI(c, () => { c.moveTo(24, 78); c.bezierCurveTo(18, 38, 30, 16, 48, 16); c.bezierCurveTo(66, 16, 78, 38, 72, 78); c.closePath(); }, it, { band: 3.4, hi: 1.4 });
      // face opening (T)
      c.fillStyle = '#1a1018';
      c.beginPath(); c.moveTo(30, 40); c.lineTo(66, 40); c.lineTo(66, 48); c.lineTo(55, 48); c.lineTo(58, 80); c.lineTo(38, 80); c.lineTo(41, 48); c.lineTo(30, 48); c.closePath(); c.fill();
      // roaring mouth
      celI(c, () => ellipsePath(c, P(48, 66), 7, 10), tone(0xc02030), { band: 1.2, hi: 0.4, stroke: 1 });
      c.fillStyle = '#fff4e0';
      c.fillRect(43, 57, 10, 2.4);
      c.fillStyle = css(0xffc040);
      c.beginPath(); c.ellipse(37, 44, 3, 1.6, 0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(59, 44, 3, 1.6, -0.2, 0, Math.PI * 2); c.fill();
      // horns
      for (const pts of [[P(26, 34), P(10, 30), P(8, 12)], [P(70, 34), P(86, 30), P(88, 12)]]) celI(c, () => ribbonPath(c, sample(10, (t) => bez(pts, t)), (t) => 5 * (1 - t) + 0.4), tone(BONE), { band: 1.2, hi: 0.5 });
    },
    opts: {
      under: (c) => {
        c.save();
        c.lineCap = 'round';
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
          c.strokeStyle = `rgba(255,200,120,${0.9 - i * 0.22})`;
          c.lineWidth = 3.4 - i * 0.6;
          c.beginPath();
          c.arc(48, 64, 34 + i * 8, s < 0 ? Math.PI * 0.85 : -Math.PI * 0.15, s < 0 ? Math.PI * 1.15 : Math.PI * 0.15);
          c.stroke();
        }
        c.restore();
      },
    },
  },
  vengeful_wrath: {
    draw: (c) => {
      flame(c, 30, 64, 50, 12, -0.25);
      flame(c, 66, 64, 50, 12, 0.25);
      flame(c, 48, 56, 56, 14, 0);
      const ft = tone(0xd89a6a);
      celI(c, () => roundRectPath(c, 30, 40, 36, 34, 9), ft, { band: 3, hi: 1.2 });
      for (let i = 0; i < 4; i++) celI(c, () => ellipsePath(c, P(35 + i * 8.6, 42), 5, 6), ft, { band: 1.4, hi: 0.6 });
      celI(c, () => capsulePath(c, P(30, 60), P(52, 56), 5, 4.4), ft, { band: 1.4, hi: 0.6 });
      celI(c, () => roundRectPath(c, 32, 72, 32, 16, 3), tone(0x8a3a24), { band: 1.8, hi: 0.7 });
    },
    opts: { over: (c) => glow(c, P(48, 44), 30, 0xff7a2a, 0.35) },
  },
  charge: {
    draw: (c) => {
      speedLines(c, [[P(6, 30), P(30, 30)], [P(4, 46), P(26, 46)], [P(8, 62), P(30, 62)], [P(14, 76), P(34, 76)]]);
      const dt = tone(0xc8b090);
      for (const [x, y, r] of [[18, 82, 7], [8, 74, 5], [28, 88, 5]] as const) celI(c, () => c.arc(x, y, r, 0, Math.PI * 2), dt, { band: 1.4, hi: 0.5, stroke: 1 });
      c.save();
      c.translate(58, 48);
      c.rotate(0.18);
      c.translate(-48, -48);
      heater(c, 48, 14, 26, 70, 0xa83030, 0x9aa4b4);
      celI(c, () => polyPath(c, [P(36, 36), P(58, 46), P(36, 56)]), tone(GOLD), { band: 1, hi: 0.4, stroke: 1 });
      celI(c, () => polyPath(c, [P(74, 44), P(92, 48), P(74, 52)]), tone(STEEL, { light: 0.5 }), { band: 1, hi: 0.4, stroke: 1 });
      c.restore();
    },
  },
  lethal_strike: {
    draw: (c) => blade(c, 'w_claymore', false, 48, 24, Math.PI, 0.95),
    opts: {
      under: (c) => {
        c.save();
        c.beginPath(); starPath(c, 48, 82, 10, 18, 6, 0.1); c.fillStyle = css(0xff3030); c.fill();
        c.beginPath(); starPath(c, 48, 82, 10, 11, 4, 0.4); c.fillStyle = css(0xffe0a0); c.fill();
        c.restore();
      },
      over: (c) => { glow(c, P(48, 82), 16, 0xff4040, 0.5); sparkle(c, 58, 36, 6); },
    },
  },
  dual_wield_mastery: {
    draw: (c) => {
      blade(c, 'w_militia_sword', false, 30, 70, Math.PI / 4, 0.95);
      blade(c, 'w_broad_sword', false, 66, 70, -Math.PI / 4, 0.95);
    },
    opts: { over: (c) => sparkle(c, 48, 32, 6) },
  },
  iron_fortress: {
    draw: (c) => {
      const st = tone(0x8a94a8, { light: 0.45 });
      const tower = (): void => { c.moveTo(22, 88); c.lineTo(24, 30); c.lineTo(20, 30); c.lineTo(20, 16); c.lineTo(30, 16); c.lineTo(30, 22); c.lineTo(38, 22); c.lineTo(38, 16); c.lineTo(58, 16); c.lineTo(58, 22); c.lineTo(66, 22); c.lineTo(66, 16); c.lineTo(76, 16); c.lineTo(76, 30); c.lineTo(72, 30); c.lineTo(74, 88); c.closePath(); };
      celI(c, tower, st, { band: 3.4, hi: 1.4 });
      clipTo(c, tower, () => {
        for (let y = 36; y < 90; y += 10) {
          line(c, [P(18, y), P(80, y)], 1.2, st.shade);
          for (let x = 24 + ((y / 10) % 2) * 8; x < 76; x += 16) line(c, [P(x, y), P(x, y + 10)], 1.2, st.shade);
        }
      });
      celI(c, () => { c.moveTo(38, 88); c.lineTo(38, 64); c.quadraticCurveTo(48, 52, 58, 64); c.lineTo(58, 88); c.closePath(); }, tone(0x4a5060), { band: 1.8, hi: 0.7 });
      for (const x of [42, 48, 54]) line(c, [P(x, 62), P(x, 88)], 1.2, '#20242c');
      heater(c, 48, 30, 12, 26, 0x3e6ab0, GOLD);
    },
  },
  unyielding: {
    draw: (c) => {
      const ht = tone(0xd02838, { light: 0.4 });
      const hp = heart(c, 48, 46, 1.25);
      celI(c, hp, ht, { band: 3.6, hi: 1.5 });
      clipTo(c, hp, () => {
        const bt = tone(0x9aa4b4, { light: 0.5 });
        for (const y of [36, 58]) {
          c.fillStyle = bt.base; c.fillRect(0, y, 96, 7);
          c.fillStyle = bt.light; c.fillRect(0, y, 96, 2);
          for (let x = 22; x < 80; x += 12) rivetDot(c, x, y + 3.5);
        }
        line(c, [P(48, 22), P(44, 34), P(52, 46), P(46, 56), P(50, 72)], 1.8, '#3a0810');
      });
      streak(c, [P(28, 38), P(30, 28), P(38, 24)], 2.6, 'rgba(255,255,255,0.7)');
    },
    opts: { under: (c) => glow(c, P(48, 50), 44, 0xffd060, 0.55) },
  },
  life_regen: {
    draw: (c) => {
      celI(c, heart(c, 44, 48, 1.1), tone(0xe0303c, { light: 0.45 }), { band: 3.2, hi: 1.4 });
      streak(c, [P(24, 44), P(26, 34), P(34, 30)], 2.6, 'rgba(255,255,255,0.75)');
      const gt = tone(0x5ad04a, { light: 0.5 });
      celI(c, () => { roundRectPath(c, 62, 54, 8, 26, 2.5); }, gt, { band: 1.2, hi: 0.5 });
      celI(c, () => { roundRectPath(c, 53, 63, 26, 8, 2.5); }, gt, { band: 1.2, hi: 0.5 });
      for (const [x, y, r] of [[24, 18, -0.6], [70, 20, 0.6]] as const) {
        c.save(); c.translate(x, y); c.rotate(r);
        celI(c, () => blobPath(c, [P(0, -8), P(4.5, 0), P(0, 8), P(-4.5, 0)]), tone(0x5ab04a), { band: 1.2, hi: 0.5, stroke: 1 });
        c.restore();
      }
    },
    opts: { over: (c) => { sparkle(c, 16, 60, 4, '#d8ffc0'); sparkle(c, 82, 40, 5, '#d8ffc0'); sparkle(c, 48, 10, 4, '#d8ffc0'); } },
  },
  frenzy: {
    draw: (c) => {
      flame(c, 48, 88, 84, 30, 0);
      const mt = tone(0x3a1c24, { light: 0.35 });
      celI(c, () => { c.moveTo(26, 44); c.bezierCurveTo(24, 20, 72, 20, 70, 44); c.lineTo(66, 70); c.lineTo(48, 84); c.lineTo(30, 70); c.closePath(); }, mt, { band: 3, hi: 1.2 });
      for (const pts of [[P(28, 36), P(12, 26), P(10, 8)], [P(68, 36), P(84, 26), P(86, 8)]]) celI(c, () => ribbonPath(c, sample(10, (t) => bez(pts, t)), (t) => 5 * (1 - t) + 0.4), tone(BONE), { band: 1.2, hi: 0.5 });
      c.fillStyle = css(0xffe040);
      c.beginPath(); polyPath(c, [P(30, 44), P(44, 50), P(42, 55), P(32, 51)]); c.fill();
      c.beginPath(); polyPath(c, [P(66, 44), P(52, 50), P(54, 55), P(64, 51)]); c.fill();
      c.fillStyle = '#fff4e0';
      c.beginPath(); polyPath(c, [P(38, 66), P(58, 66), P(55, 72), P(51, 68), P(48, 73), P(45, 68), P(41, 72)]); c.fill();
    },
    opts: { over: (c) => { glow(c, P(37, 50), 10, 0xffc040, 0.7); glow(c, P(59, 50), 10, 0xffc040, 0.7); } },
  },
  bleed_strike: {
    draw: (c) => {
      blade(c, 'w_assassin_blade', true, 26, 74, Math.PI / 4, 1.05);
      const rt = tone(0xd01828, { light: 0.45 });
      for (let i = 0; i < 3; i++) {
        const o = i * 11;
        celI(c, () => ribbonPath(c, sample(12, (t) => P(46 + o + t * 22 - 10, 18 + o * 0.3 + t * 40)), (t) => 3.6 * Math.sin(Math.PI * t)), rt, { band: 1, hi: 0.4, stroke: 1 });
      }
      for (const [x, y, s] of [[62, 76, 1], [76, 70, 0.8], [52, 86, 0.7]] as const) {
        celI(c, () => { c.moveTo(x, y - 8 * s); c.quadraticCurveTo(x + 5 * s, y, x, y + 4 * s); c.quadraticCurveTo(x - 5 * s, y, x, y - 8 * s); c.closePath(); }, rt, { band: 1, hi: 0.4, stroke: 1 });
      }
    },
  },
  rampage: {
    draw: (c) => {
      c.save();
      c.translate(48, 48);
      c.scale(0.92, 0.92);
      c.translate(-48, -48);
      drawAxe(c);
      c.restore();
    },
    opts: {
      under: (c) => {
        c.save();
        c.beginPath(); starPath(c, 44, 44, 12, 46, 22, 0); c.fillStyle = 'rgba(255,90,60,0.55)'; c.fill();
        c.beginPath(); starPath(c, 44, 44, 12, 30, 14, 0.25); c.fillStyle = 'rgba(255,200,120,0.5)'; c.fill();
        c.restore();
      },
    },
  },

  // ── Mage ─────────────────────────────────────────────────────────────
  fireball: {
    draw: (c) => {
      c.save();
      c.translate(58, 38);
      c.rotate(Math.PI * 1.25);
      flame(c, 0, 14, 66, 17, 0);
      c.restore();
      celI(c, () => c.arc(58, 38, 16, 0, Math.PI * 2), tone(0xff7a1a, { light: 0.5 }), { band: 3, hi: 1.2 });
      celI(c, () => c.arc(56, 36, 10, 0, Math.PI * 2), tone(0xffe070, { light: 0.6 }), { band: 2, hi: 0.8, stroke: 0 });
    },
    opts: { over: (c) => { glow(c, P(58, 38), 30, 0xffa040, 0.5); sparkle(c, 52, 31, 5); } },
  },
  meteor: {
    draw: (c) => {
      c.save();
      c.translate(40, 60);
      c.rotate(Math.PI * 0.25);
      flame(c, 0, 12, 74, 22, 0);
      c.restore();
      const rt = tone(0x5a4040, { light: 0.35 });
      const rock = (): void => blobPath(c, [P(18, 62), P(24, 44), P(42, 38), P(58, 50), P(56, 72), P(38, 82), P(20, 76)]);
      celI(c, rock, rt, { band: 3.6, hi: 1.5 });
      clipTo(c, rock, () => {
        c.save();
        c.globalCompositeOperation = 'lighter';
        line(c, [P(26, 52), P(36, 62), P(32, 76)], 2.4, css(0xff8a2a));
        line(c, [P(36, 62), P(52, 58)], 2.2, css(0xff8a2a));
        c.restore();
      });
    },
    opts: { over: (c) => glow(c, P(38, 62), 30, 0xff6020, 0.45) },
  },
  blizzard: {
    draw: (c) => {
      const ct = tone(0xdceaf8, { light: 0.4 });
      celI(c, () => cloudPath(c, 48, 32, 1.2), ct, { band: 3, hi: 1.2 });
      const it = tone(0xaee8ff, { light: 0.5 });
      for (const [x, y] of [[26, 60], [44, 70], [62, 58], [76, 74], [34, 84]] as const) {
        celI(c, () => polyPath(c, [P(x - 3, y - 10), P(x + 3, y - 10), P(x - 2, y + 8)]), it, { band: 1, hi: 0.4, stroke: 1 });
      }
    },
    opts: { over: (c) => { snowflake(c, 18, 74, 6); snowflake(c, 56, 86, 5); snowflake(c, 82, 56, 5.5); } },
  },
  ice_armor: {
    draw: (c) => {
      c.save();
      c.translate(48, 50);
      c.scale(0.9, 0.9);
      c.translate(-48, -50);
      const it = tone(0x8ad8ff, { light: 0.55 });
      celI(c, () => torsoPath(c), it, { band: 3.6, hi: 1.5 });
      clipTo(c, () => torsoPath(c), () => {
        c.strokeStyle = 'rgba(255,255,255,0.8)';
        c.lineWidth = 1.4;
        for (const pts of [[P(48, 20), P(38, 44), P(48, 62), P(60, 42), P(48, 20)], [P(38, 44), P(24, 60), P(30, 86)], [P(60, 42), P(72, 62), P(66, 86)], [P(48, 62), P(48, 90)]]) line(c, pts, 1.4, 'rgba(255,255,255,0.75)');
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath(); polyPath(c, [P(48, 20), P(38, 44), P(48, 62)]); c.fill();
      });
      for (const [x, s] of [[20, -1], [76, 1]] as const) celI(c, () => polyPath(c, [P(x - 8, 26), P(x + s * 6, 2), P(x + 8, 26)]), it, { band: 1.2, hi: 0.5 });
      c.restore();
    },
    opts: { over: (c) => { sparkle(c, 36, 30, 6); sparkle(c, 64, 70, 4.5); } },
  },
  chain_lightning: {
    draw: (c) => {
      const nodes = [P(20, 20), P(48, 54), P(78, 30), P(70, 80)];
      bolt(c, [nodes[0], P(34, 30), P(30, 40), P(48, 54)], 5);
      bolt(c, [nodes[1], P(58, 44), P(62, 40), nodes[2]], 4);
      bolt(c, [nodes[1], P(56, 64), P(60, 68), nodes[3]], 3.6);
      for (const n of nodes) celI(c, () => c.arc(n.x, n.y, 5.5, 0, Math.PI * 2), tone(0xe8e0ff, { light: 0.6 }), { band: 1, hi: 0.4, stroke: 1 });
    },
    opts: { over: (c) => { for (const n of [P(20, 20), P(48, 54), P(78, 30), P(70, 80)]) glow(c, n, 14, 0xc0b0ff, 0.6); } },
  },
  mana_shield: {
    draw: (c) => {
      const r = 34;
      const g = c.createRadialGradient(40, 38, 4, 48, 48, r);
      g.addColorStop(0, 'rgba(230,200,255,0.55)');
      g.addColorStop(0.7, 'rgba(160,110,255,0.4)');
      g.addColorStop(1, 'rgba(120,70,230,0.85)');
      c.beginPath(); c.arc(48, 48, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
      clipTo(c, () => c.arc(48, 48, r, 0, Math.PI * 2), () => {
        c.strokeStyle = 'rgba(240,220,255,0.6)';
        c.lineWidth = 1.2;
        for (let row = -4; row <= 4; row++) for (let col = -4; col <= 4; col++) {
          const x = 48 + col * 12 + (row % 2 ? 6 : 0);
          const y = 48 + row * 10.4;
          c.beginPath();
          for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i / 6) * Math.PI * 2; const px = x + Math.cos(a) * 6.9; const py = y + Math.sin(a) * 6.9; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); }
          c.closePath();
          c.stroke();
        }
      });
      c.beginPath(); c.arc(48, 48, r, 0, Math.PI * 2); c.strokeStyle = css(0xe8d0ff); c.lineWidth = 2.4; c.stroke();
      celI(c, () => starPath(c, 48, 48, 4, 13, 4.4), tone(0x9ad0ff, { light: 0.6 }), { band: 1.2, hi: 0.5 });
      streak(c, [P(22, 44), P(26, 28), P(40, 18)], 3, 'rgba(255,255,255,0.8)');
    },
    opts: { over: (c) => glow(c, P(48, 48), 20, 0x9ad0ff, 0.5) },
  },
  fire_wall: {
    draw: (c) => {
      const gt = tone(0x5a2a1a);
      celI(c, () => ellipsePath(c, P(48, 78), 42, 9), gt, { band: 1.6, hi: 0.6 });
      flame(c, 18, 76, 40, 11, -0.1);
      flame(c, 78, 76, 42, 11, 0.1);
      flame(c, 36, 80, 56, 13, -0.05);
      flame(c, 60, 80, 58, 13, 0.05);
    },
    opts: { over: (c) => glow(c, P(48, 60), 40, 0xff8030, 0.3) },
  },
  combustion: {
    draw: (c) => {
      celI(c, () => starPath(c, 48, 50, 10, 40, 18, 0.1), tone(0xe8401c, { light: 0.45 }), { band: 3, hi: 1.2 });
      celI(c, () => starPath(c, 48, 50, 10, 28, 13, 0.4), tone(0xff9a22, { light: 0.5 }), { band: 2, hi: 0.8 });
      celI(c, () => c.arc(48, 50, 12, 0, Math.PI * 2), tone(0xfff0a0, { light: 0.7 }), { band: 1.4, hi: 0.6, stroke: 0 });
      for (const [x, y] of [[14, 20], [82, 18], [86, 80], [12, 78]] as const) celI(c, () => blobPath(c, [P(x - 3, y), P(x, y - 3), P(x + 3, y), P(x, y + 3)]), tone(0x5a3028), { band: 0.8, hi: 0.3, stroke: 1 });
    },
    opts: { over: (c) => glow(c, P(48, 50), 30, 0xffd060, 0.6) },
  },
  ice_arrow: {
    draw: (c) => {
      const it = tone(0x9ae4ff, { light: 0.55 });
      for (const [x, y, s] of [[20, 76, 1], [30, 84, 0.7], [12, 64, 0.7]] as const) celI(c, () => polyPath(c, [P(x, y - 6 * s), P(x + 4 * s, y), P(x, y + 6 * s), P(x - 4 * s, y)]), it, { band: 1, hi: 0.4, stroke: 1 });
      arrow(c, P(18, 78), P(84, 14), { head: 0x9ae4ff, fletch: 0xdaf4ff, shaft: 0x7ab8e0, w: 1.4 });
      celI(c, () => polyPath(c, [P(84, 14), P(62, 22), P(70, 30), P(76, 36)]), it, { band: 1.4, hi: 0.6 });
    },
    opts: { over: (c) => { sparkle(c, 74, 20, 6); snowflake(c, 30, 60, 5); } },
  },
  freeze: {
    draw: (c) => {
      const it = tone(0x8ad8ff, { light: 0.55 });
      const crystal = (x: number, y: number, h: number, w: number, rot: number): void => {
        c.save(); c.translate(x, y); c.rotate(rot);
        celI(c, () => polyPath(c, [P(-w, 0), P(-w, -h + w), P(0, -h), P(w, -h + w), P(w, 0), P(0, w * 0.6)]), it, { band: 2, hi: 0.8 });
        line(c, [P(0, -h), P(0, w * 0.6)], 1.2, 'rgba(255,255,255,0.7)');
        c.restore();
      };
      crystal(30, 84, 44, 9, -0.4);
      crystal(66, 84, 48, 9, 0.35);
      crystal(48, 88, 66, 12, 0);
    },
    opts: { under: (c) => glow(c, P(48, 56), 40, 0xaee8ff, 0.4), over: (c) => { snowflake(c, 20, 26, 8); sparkle(c, 46, 34, 6); } },
  },
  teleport: {
    draw: (c) => {
      const pts = sample(60, (t) => { const a = t * Math.PI * 4.2; const r = 6 + t * 32; return P(48 + Math.cos(a) * r, 48 + Math.sin(a) * r * 0.9); });
      celI(c, () => ribbonPath(c, pts, (t) => 1 + t * 5), tone(0xd8a0ff, { light: 0.6 }), { band: 1, hi: 0.4, stroke: 1 });
      streak(c, pts.slice(10, 55), 1.2, 'rgba(255,255,255,0.8)');
    },
    opts: { under: (c) => glow(c, P(48, 48), 40, 0xc070ff, 0.6), over: (c) => { glow(c, P(48, 48), 12, 0xffffff, 0.8); sparkle(c, 18, 22, 5); sparkle(c, 80, 76, 4.5); sparkle(c, 82, 20, 3.5); } },
  },
  arcane_torrent: {
    draw: (c) => {
      for (const [x, y, s] of [[70, 26, 1], [52, 52, 1.15], [78, 60, 0.85], [34, 78, 0.9]] as const) {
        celI(c, () => ribbonPath(c, [P(x - 30 * s, y - 20 * s), P(x - 15 * s, y - 10 * s), P(x, y)], (t) => 0.5 + t * 5 * s), tone(0xd070ff, { light: 0.5 }), { band: 1, hi: 0.4, stroke: 1 });
        celI(c, () => c.arc(x, y, 7 * s, 0, Math.PI * 2), tone(0xf0c0ff, { light: 0.6 }), { band: 1.4 * s, hi: 0.6, stroke: 1 });
      }
    },
    opts: { over: (c) => { for (const [x, y] of [[70, 26], [52, 52], [78, 60], [34, 78]]) glow(c, P(x, y), 14, 0xe080ff, 0.6); } },
  },

  // ── Rogue ────────────────────────────────────────────────────────────
  backstab: {
    draw: (c) => {
      const st = tone(0x3a2458);
      celI(c, () => { c.moveTo(8, 92); c.bezierCurveTo(8, 66, 18, 56, 40, 54); c.bezierCurveTo(62, 56, 72, 66, 72, 92); c.closePath(); }, st, { band: 3, hi: 1.2 });
      celI(c, () => c.arc(40, 38, 15, 0, Math.PI * 2), st, { band: 2.6, hi: 1 });
      celI(c, () => { c.moveTo(24, 42); c.bezierCurveTo(22, 18, 58, 16, 56, 42); c.quadraticCurveTo(48, 58, 40, 60); c.quadraticCurveTo(30, 58, 24, 42); c.closePath(); }, tone(0x5a3c86, { light: 0.35 }), { band: 2.4, hi: 1 });
      blade(c, 'w_stiletto', true, 76, 22, Math.PI * 1.22, 1.1);
    },
    opts: { over: (c) => { c.save(); c.beginPath(); starPath(c, 52, 62, 8, 12, 4, 0); c.fillStyle = css(0xff4040); c.fill(); c.restore(); glow(c, P(52, 62), 16, 0xff4040, 0.5); sparkle(c, 76, 26, 5); } },
  },
  poison_blade: {
    draw: (c) => {
      blade(c, 'w_assassin_blade', true, 30, 72, Math.PI / 4, 1.2);
      const gt = tone(0x7be03a, { light: 0.5 });
      for (const [x, y, s] of [[60, 50, 1], [70, 66, 0.8], [52, 70, 0.7]] as const) {
        celI(c, () => { c.moveTo(x, y - 9 * s); c.quadraticCurveTo(x + 6 * s, y, x, y + 5 * s); c.quadraticCurveTo(x - 6 * s, y, x, y - 9 * s); c.closePath(); }, gt, { band: 1.2, hi: 0.5, stroke: 1 });
      }
    },
    opts: { over: (c) => { for (const [x, y, r] of [[80, 30, 3], [74, 20, 2], [84, 44, 2.2]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.strokeStyle = 'rgba(200,255,150,0.9)'; c.lineWidth = 1.2; c.stroke(); } glow(c, P(64, 34), 26, 0x7be03a, 0.35); } },
  },
  vanish: {
    draw: (c) => {
      const ct = tone(0x4a3470, { light: 0.35 });
      const hood = (): void => { c.moveTo(48, 10); c.bezierCurveTo(74, 12, 80, 40, 76, 62); c.quadraticCurveTo(70, 70, 62, 66); c.quadraticCurveTo(56, 76, 48, 70); c.quadraticCurveTo(40, 78, 32, 66); c.quadraticCurveTo(24, 70, 20, 62); c.bezierCurveTo(16, 40, 22, 12, 48, 10); c.closePath(); };
      celI(c, hood, ct, { band: 3.4, hi: 1.4 });
      c.fillStyle = '#0c0814';
      c.beginPath(); c.ellipse(48, 42, 17, 19, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = css(0xd8b0ff);
      c.beginPath(); polyPath(c, [P(36, 40), P(45, 43), P(43, 46), P(37, 44)]); c.fill();
      c.beginPath(); polyPath(c, [P(60, 40), P(51, 43), P(53, 46), P(59, 44)]); c.fill();
    },
    opts: {
      over: (c) => {
        glow(c, P(40, 43), 8, 0xd8b0ff, 0.7);
        glow(c, P(56, 43), 8, 0xd8b0ff, 0.7);
        c.save();
        c.strokeStyle = 'rgba(200,170,255,0.7)';
        c.lineCap = 'round';
        for (const [x, y, s] of [[26, 78, 1], [48, 84, -1], [70, 78, 1]] as const) {
          c.lineWidth = 3;
          c.beginPath(); c.moveTo(x, y - 8); c.bezierCurveTo(x + 8 * s, y - 2, x - 8 * s, y + 4, x, y + 10); c.stroke();
        }
        c.restore();
      },
    },
  },
  multishot: {
    draw: (c) => {
      for (const a of [-0.55, -0.28, 0, 0.28, 0.55]) {
        const ang = -Math.PI / 4 + a;
        arrow(c, P(20, 78), P(20 + Math.cos(ang) * 70, 78 + Math.sin(ang) * 70), { w: 1.05 });
      }
    },
    opts: { over: (c) => sparkle(c, 22, 76, 6) },
  },
  arrow_rain: {
    draw: (c) => {
      const d = P(Math.cos(Math.PI * 0.62), Math.sin(Math.PI * 0.62));
      for (const [x, y] of [[30, 38], [56, 30], [80, 44], [42, 66], [68, 74], [20, 82]] as const) arrow(c, P(x - d.x * 34, y - d.y * 34), P(x, y), { w: 0.95 });
    },
  },
  shadow_step: {
    draw: (c) => {
      const prints: [number, number, number, number][] = [[22, 80, -0.5, 0.45], [46, 60, -0.3, 0.7], [66, 34, -0.5, 1]];
      for (const [x, y, rot, a] of prints) {
        c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = a;
        const t = tone(0xb890ff, { light: 0.5 });
        celI(c, () => ellipsePath(c, P(0, -4), 7, 11), t, { band: 1.6, hi: 0.6 });
        celI(c, () => ellipsePath(c, P(0, 12), 5, 6), t, { band: 1.2, hi: 0.5 });
        c.restore();
      }
    },
    opts: { over: (c) => { c.save(); c.strokeStyle = 'rgba(210,180,255,0.55)'; c.lineWidth = 2.4; c.lineCap = 'round'; for (const o of [-6, 0, 6]) { c.beginPath(); c.moveTo(14 + o, 60 + o); c.quadraticCurveTo(30 + o, 30 + o, 60 + o, 16 + o); c.stroke(); } c.restore(); glow(c, P(66, 34), 16, 0xb890ff, 0.5); } },
  },
  death_mark: {
    draw: (c) => skull(c, 48, 50, 1.45, 0xff2030),
    opts: {
      under: (c) => {
        c.save();
        c.strokeStyle = css(0xff3040, 0.95);
        c.lineWidth = 3;
        c.beginPath(); c.arc(48, 50, 36, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 2;
        c.beginPath(); c.arc(48, 50, 42, 0, Math.PI * 2); c.stroke();
        for (const a of [0, 1, 2, 3]) { const an = a * Math.PI / 2; line(c, [P(48 + Math.cos(an) * 30, 50 + Math.sin(an) * 30), P(48 + Math.cos(an) * 46, 50 + Math.sin(an) * 46)], 3, css(0xff3040)); }
        c.restore();
      },
      over: (c) => { glow(c, P(38, 49), 9, 0xff2030, 0.7); glow(c, P(58, 49), 9, 0xff2030, 0.7); },
    },
  },
  piercing_arrow: {
    draw: (c) => {
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 3;
      c.beginPath(); c.ellipse(52, 44, 9, 20, Math.PI / 4, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(64, 32, 6, 13, Math.PI / 4, 0, Math.PI * 2); c.stroke();
      c.restore();
      arrow(c, P(12, 84), P(86, 10), { w: 1.35, head: 0xe8f0ff });
    },
    opts: { over: (c) => speedLines(c, [[P(10, 66), P(26, 50)], [P(28, 90), P(44, 74)]]) },
  },
  poison_arrow: {
    draw: (c) => {
      arrow(c, P(14, 82), P(80, 16), { w: 1.35, head: 0x7be03a });
      const gt = tone(0x7be03a, { light: 0.5 });
      for (const [x, y, s] of [[70, 36, 1], [62, 48, 0.75]] as const) celI(c, () => { c.moveTo(x, y - 8 * s); c.quadraticCurveTo(x + 5 * s, y, x, y + 4 * s); c.quadraticCurveTo(x - 5 * s, y, x, y - 8 * s); c.closePath(); }, gt, { band: 1, hi: 0.4, stroke: 1 });
    },
    opts: { under: (c) => { c.save(); c.strokeStyle = 'rgba(140,240,80,0.5)'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, 82); c.quadraticCurveTo(40, 64, 70, 28); c.stroke(); c.restore(); }, over: (c) => glow(c, P(78, 18), 16, 0x9aff60, 0.55) },
  },
  explosive_trap: {
    draw: (c) => {
      celI(c, () => ellipsePath(c, P(48, 78), 36, 10), tone(0x6a5238), { band: 1.6, hi: 0.6 });
      const bt = tone(0x4a4a5a, { light: 0.4 });
      celI(c, () => c.arc(46, 58, 24, 0, Math.PI * 2), bt, { band: 4, hi: 1.6 });
      celI(c, () => { roundRectPath(c, 52, 30, 12, 9, 2); }, tone(0x8a8a9a), { band: 1.2, hi: 0.5 });
      streak(c, [P(58, 32), P(66, 22), P(74, 20)], 2.4, css(0xc8a870));
      celI(c, () => polyPath(c, [P(46, 46), P(38, 62), P(46, 62), P(42, 74), P(56, 56), P(48, 56), P(52, 46)]), tone(0xffc030, { light: 0.5 }), { band: 1, hi: 0.4, stroke: 1 });
      streak(c, [P(28, 54), P(32, 42), P(42, 36)], 2.6, 'rgba(255,255,255,0.6)');
    },
    opts: { over: (c) => { c.save(); c.beginPath(); starPath(c, 75, 19, 6, 8, 3); c.fillStyle = css(0xffe070); c.fill(); c.restore(); glow(c, P(75, 19), 14, 0xffa030, 0.8); } },
  },
  poison_cloud: {
    draw: (c) => {
      const ct = tone(0x7ad040, { light: 0.45 });
      celI(c, () => cloudPath(c, 48, 60, 1.3), ct, { band: 3.4, hi: 1.4 });
      celI(c, () => cloudPath(c, 44, 40, 0.8), tone(0x9ae060, { light: 0.45 }), { band: 2.4, hi: 1 });
      skull(c, 48, 60, 0.75, 0x1a3008, 0xe8f8c8);
    },
    opts: { over: (c) => { for (const [x, y, r] of [[18, 24, 3], [80, 28, 3.6], [74, 84, 2.6], [22, 86, 2.2]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.strokeStyle = 'rgba(210,255,160,0.9)'; c.lineWidth = 1.4; c.stroke(); } } },
  },
  slow_trap: {
    draw: (c) => {
      const gt = tone(GOLD, { light: 0.5 });
      const glass = (): void => { c.moveTo(30, 20); c.lineTo(66, 20); c.quadraticCurveTo(66, 40, 50, 48); c.quadraticCurveTo(66, 56, 66, 76); c.lineTo(30, 76); c.quadraticCurveTo(30, 56, 46, 48); c.quadraticCurveTo(30, 40, 30, 20); c.closePath(); };
      c.beginPath(); glass(); c.fillStyle = 'rgba(200,235,255,0.35)'; c.fill();
      clipTo(c, glass, () => {
        c.fillStyle = css(0x6ac8ff);
        c.beginPath(); c.moveTo(34, 76); c.quadraticCurveTo(48, 58, 62, 76); c.closePath(); c.fill();
        c.fillRect(33, 26, 30, 8);
        c.fillRect(47, 34, 2.4, 40);
      });
      c.beginPath(); glass(); c.strokeStyle = css(0xdaf0ff); c.lineWidth = 1.8; c.stroke();
      streak(c, [P(35, 26), P(37, 38)], 2, 'rgba(255,255,255,0.8)');
      for (const y of [14, 76]) celI(c, () => roundRectPath(c, 22, y, 52, 7, 3), gt, { band: 1.4, hi: 0.6 });
      for (const x of [24, 69]) celI(c, () => roundRectPath(c, x, 20, 3.6, 56, 1.5), tone(WOOD), { band: 0.8, hi: 0.3, stroke: 1 });
    },
    opts: { under: (c) => { c.save(); c.strokeStyle = 'rgba(150,220,255,0.7)'; c.lineWidth = 2.4; c.beginPath(); c.arc(48, 48, 40, Math.PI * 0.2, Math.PI * 0.9); c.stroke(); c.beginPath(); c.arc(48, 48, 40, Math.PI * 1.2, Math.PI * 1.9); c.stroke(); c.restore(); } },
  },
  chain_trap: {
    draw: (c) => {
      const st = tone(0x9aa4b4, { light: 0.5 });
      // chain
      for (let i = 0; i < 6; i++) {
        const x = 10 + i * 7;
        const y = 84 - i * 3.5;
        celI(c, () => ellipsePath(c, P(x, y), i % 2 ? 4.4 : 2.6, i % 2 ? 2.6 : 4.4, -0.4), st, { band: 0.8, hi: 0.3, stroke: 1 });
      }
      celI(c, () => ellipsePath(c, P(56, 72), 30, 10), tone(0x4a4a58), { band: 1.6, hi: 0.6 });
      // jaws with teeth
      for (const s of [-1, 1]) {
        c.save();
        c.translate(56, 68);
        c.scale(1, s);
        celI(c, () => { c.moveTo(-28, 0); c.quadraticCurveTo(-26, -34, 0, -36); c.quadraticCurveTo(26, -34, 28, 0); c.lineTo(22, 0); c.quadraticCurveTo(20, -26, 0, -28); c.quadraticCurveTo(-20, -26, -22, 0); c.closePath(); }, st, { band: 1.6, hi: 0.6 });
        for (let i = 0; i < 6; i++) {
          const a = Math.PI * (1.1 + i * 0.16);
          const px = Math.cos(a) * 22;
          const py = Math.sin(a) * 27;
          celI(c, () => polyPath(c, [P(px - 2.6, py), P(px * 0.82, py * 0.72), P(px + 2.6, py)]), tone(0xe0e8f0, { light: 0.5 }), { band: 0.6, hi: 0.3, stroke: 0.8 });
        }
        c.restore();
      }
    },
    opts: { scale: 0.88 },
  },
};

function rivetDot(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fillStyle = '#e8eef4'; c.fill();
}

function genericMotif(el: Element): Motif {
  switch (el) {
    case 'fire': return { draw: (c) => flame(c, 48, 84, 70, 22, 0) };
    case 'ice': return { draw: (c) => facetGem(c, 48, 48, gemCut('marquise', 34), 0x9ae4ff, { sparkles: 2 }), opts: { over: (c) => snowflake(c, 24, 24, 8) } };
    case 'lightning': return { draw: (c) => bolt(c, [P(60, 8), P(36, 46), P(56, 48), P(34, 90)], 8) };
    case 'poison': return { draw: (c) => celI(c, () => { c.moveTo(48, 12); c.quadraticCurveTo(76, 52, 64, 72); c.quadraticCurveTo(48, 90, 32, 72); c.quadraticCurveTo(20, 52, 48, 12); c.closePath(); }, tone(0x7be03a, { light: 0.5 }), { band: 3, hi: 1.2 }) };
    case 'arcane': return { draw: (c) => celI(c, () => starPath(c, 48, 48, 4, 36, 12), tone(0xe0a0ff, { light: 0.55 }), { band: 3, hi: 1.2 }) };
    default: return { draw: (c) => blade(c, 'w_short_sword', false, 32, 68, Math.PI / 4, 1.1) };
  }
}

/** Every skill id with a hand-painted motif. */
export const SKILL_MOTIF_IDS: readonly string[] = Object.keys(MOTIFS);
