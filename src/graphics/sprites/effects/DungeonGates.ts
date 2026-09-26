// src/graphics/sprites/effects/DungeonGates.ts
//
// Interactive gateways into instanced content:
//   dungeon_portal       — the Abyss Labyrinth gate in Abyss Rift (crimson)
//   subdungeon_mine      — abandoned dwarf mine shaft (Anvil Mountains)
//   subdungeon_altar     — sunken demon-altar ring gate (Abyss Rift)
// Each loops a swirl/flicker over GATE_FRAMES frames (`<key>_anim`).
// Displayed with origin (0.5, anchorY) on the entrance tile's ground point.
import {
  defineDecor, contactShadow, shade, tone, polyP, blobP, line, glow, flat, ellipseP, limbP,
  rgbaHex, rng, hashKey, type DecorDrawer, type Rand,
} from '../decorations/DecorKit';
import { drawRock } from '../decorations/Rock';
import { block } from '../decorations/Stonework';
import { drawFlame } from '../decorations/CampProps';

export const GATE_FRAMES = 6;

type Ctx = CanvasRenderingContext2D;

interface VortexPalette { rim: number; mid: number; core: number; arm: string; arm2: string }

/**
 * Standing swirl in an upright oval centred on (x, y). `phase` (0..1) turns
 * the spiral arms so a sequence of frames reads as rotation.
 */
function vortex(ctx: Ctx, x: number, y: number, rx: number, ry: number, phase: number, p: VortexPalette): void {
  glow(ctx, { x, y }, Math.max(rx, ry) * 1.35, p.mid, 0.45);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx / ry, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  g.addColorStop(0, rgbaHex(p.core, 1));
  g.addColorStop(0.3, rgbaHex(p.mid, 0.95));
  g.addColorStop(0.85, rgbaHex(p.rim, 0.95));
  g.addColorStop(1, rgbaHex(p.rim, 1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, ry, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.lineCap = 'round';
  const arms = 4;
  for (let i = 0; i < arms; i++) {
    const a0 = i * ((Math.PI * 2) / arms) + phase * ((Math.PI * 2) / arms);
    ctx.beginPath();
    for (let k = 0; k <= 22; k++) {
      const t = k / 22;
      const rr = ry * 0.95 * (1 - t * 0.88);
      const a = a0 + t * Math.PI * 1.7;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = i % 2 ? p.arm : p.arm2;
    ctx.lineWidth = 2.4 - (i % 2) * 0.7;
    ctx.stroke();
  }
  ctx.restore();
  // Hot core.
  glow(ctx, { x, y }, ry * 0.45, p.core, 0.8);
}

/** Motes drifting up and around a gate; `phase` 0..1 advances them. */
function motes(ctx: Ctx, x: number, y: number, spread: number, rise: number, n: number, phase: number, col: string, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const ox = (r() - 0.5) * spread;
    const t = (r() + phase) % 1;
    const s = 0.5 + (1 - t) * 0.9;
    flat(ctx, ellipseP(ctx, x + ox + Math.sin((t + i) * 6) * 1.5, y - t * rise, s, s), col);
  }
}

/** Cracked ground ring with glowing seams (lava / arcane). */
function crackedRing(ctx: Ctx, x: number, y: number, rx: number, col: number, seam: string, r: Rand): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.42);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgbaHex(col, 0.55));
  g.addColorStop(0.65, rgbaHex(col, 0.22));
  g.addColorStop(1, rgbaHex(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4;
    const r0 = rx * 0.35, r1 = rx * (0.75 + r() * 0.2);
    const mx = (r0 + r1) / 2;
    line(ctx, [
      [x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.42],
      [x + Math.cos(a + 0.18) * mx, y + Math.sin(a + 0.18) * mx * 0.42],
      [x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.42],
    ], seam, 1);
  }
}

// ── Abyss Labyrinth gate ──────────────────────────────────────────────────

/** Jagged obsidian monolith with a glowing fissure. */
function obsidianSpire(ctx: Ctx, x: number, gy: number, h: number, w: number, lean: number): void {
  const t = tone(0x3a2e44, { light: 0.35, shadow: 0.45 });
  const pts: [number, number][] = [
    [x - w / 2, gy + 1],
    [x - w / 2 + 1, gy - h * 0.55],
    [x - w * 0.3 + lean * 0.7, gy - h * 0.85],
    [x + lean, gy - h],
    [x + w * 0.3 + lean * 0.8, gy - h * 0.78],
    [x + w / 2, gy - h * 0.4],
    [x + w / 2 - 0.5, gy + 1],
  ];
  shade(ctx, polyP(ctx, pts), t, { band: w * 0.4, hi: 1.2, stroke: 0.9 });
  // Lit facet.
  flat(ctx, polyP(ctx, [[x - w / 2 + 1, gy - h * 0.55], [x - w * 0.3 + lean * 0.7, gy - h * 0.85], [x + lean, gy - h], [x - w * 0.08 + lean * 0.5, gy - h * 0.6]]), t.light);
  const fis: [number, number][] = [[x + lean * 0.3, gy - h * 0.72], [x - 1 + lean * 0.2, gy - h * 0.5], [x + 1.5, gy - h * 0.32], [x - 0.5, gy - h * 0.12]];
  glow(ctx, { x, y: gy - h * 0.42 }, w * 0.8, 0xff3a2a, 0.35);
  line(ctx, fis, '#d82a1a', 1.6);
  line(ctx, fis, '#ffc080', 0.6);
}

const ABYSS_VORTEX: VortexPalette = { rim: 0x3a0612, mid: 0xd8321a, core: 0xffd070, arm: 'rgba(255,200,120,0.85)', arm2: 'rgba(255,90,40,0.8)' };

export const DungeonPortalDrawer = defineDecor({
  key: 'dungeon_portal',
  w: 100,
  h: 112,
  ground: 90,
  frames: GATE_FRAMES,
  loop: { frames: GATE_FRAMES, fps: 9 },
  draw(ctx, { cx, gy }, frame) {
    const r = rng(hashKey('dungeon_portal'));
    const phase = frame / GATE_FRAMES;
    contactShadow(ctx, cx + 3, gy, 42, 11, 0.5);
    crackedRing(ctx, cx, gy - 2, 44, 0xff4a1a, '#ff7a2a', r);
    // Vortex, set back between the spires.
    const vy = gy - 34;
    vortex(ctx, cx, vy, 17, 27, phase, ABYSS_VORTEX);
    // Broken arch lintel of stacked basalt over the vortex.
    const arch = tone(0x40344c, { light: 0.32, shadow: 0.45 });
    shade(ctx, () => {
      ctx.moveTo(cx - 26, gy - 52);
      ctx.quadraticCurveTo(cx, gy - 78, cx + 26, gy - 52);
      ctx.lineTo(cx + 20, gy - 50);
      ctx.quadraticCurveTo(cx, gy - 70, cx - 20, gy - 50);
      ctx.closePath();
    }, arch, { band: 2.2, hi: 1, stroke: 0.9 });
    // Keystone with a glowing eye (focal accent).
    shade(ctx, polyP(ctx, [[cx - 5, gy - 69], [cx + 5, gy - 69], [cx + 4, gy - 60], [cx, gy - 57], [cx - 4, gy - 60]]), tone(0x4a3c58, { light: 0.35 }), { band: 1.4, hi: 0.6, stroke: 0.8 });
    const eye = 0.75 + 0.25 * Math.sin(phase * Math.PI * 2);
    glow(ctx, { x: cx, y: gy - 63.5 }, 8, 0xff5a2a, 0.6 * eye);
    flat(ctx, ellipseP(ctx, cx, gy - 63.5, 2.6, 1.4), '#ffb060', '#8a1a0a', 0.5);
    flat(ctx, ellipseP(ctx, cx, gy - 63.5, 0.7, 1.3), '#3a0808');
    // Horns sweeping off the arch.
    for (const s of [-1, 1]) {
      const horn = tone(0xd8c8b0, { light: 0.35, shadow: 0.45 });
      shade(ctx, limbP(ctx, [cx + s * 22, gy - 58], [cx + s * 34, gy - 66], [cx + s * 33, gy - 80], 3.4, 0.4), horn, { band: 1.6, hi: 0.6, stroke: 0.8 });
    }
    // Flanking spires.
    obsidianSpire(ctx, cx - 27, gy + 2, 62, 14, -2);
    obsidianSpire(ctx, cx + 27, gy + 2, 58, 14, 2);
    drawRock(ctx, cx - 38, gy + 6, 12, 7, 0x3a3044, r, 1);
    drawRock(ctx, cx + 39, gy + 5, 10, 6, 0x3a3044, r, 0);
    // Rubble step in front of the vortex.
    block(ctx, cx - 14, gy + 3, 24, 5, 6, 0x4a3e56, r, true);
    motes(ctx, cx, gy - 10, 44, 60, 9, phase, 'rgba(255,190,110,0.9)', 77);
  },
});

// ── Abandoned dwarf mine ─────────────────────────────────────────────────

export const SubDungeonMineDrawer = defineDecor({
  key: 'subdungeon_mine',
  w: 96,
  h: 88,
  ground: 72,
  frames: GATE_FRAMES,
  loop: { frames: GATE_FRAMES, fps: 8 },
  draw(ctx, { cx, gy }, frame) {
    const r = rng(hashKey('subdungeon_mine'));
    const phase = frame / GATE_FRAMES;
    contactShadow(ctx, cx + 4, gy, 44, 11, 0.45);
    // Rock outcrop the shaft is cut into.
    const rock = tone(0x6a7688, { light: 0.35, shadow: 0.45 });
    const hill = blobP(ctx, [[cx - 44, gy + 1], [cx - 38, gy - 30], [cx - 18, gy - 52], [cx + 6, gy - 58], [cx + 28, gy - 46], [cx + 42, gy - 22], [cx + 44, gy + 1], [cx, gy + 4]]);
    shade(ctx, hill, rock, { band: 7, hi: 1.6, stroke: 0.9 });
    // Snow cap on the lit shoulder.
    const snow = tone(0xeef4ff, { light: 0.2, shadow: 0.25 });
    shade(ctx, blobP(ctx, [[cx - 30, gy - 40], [cx - 16, gy - 53], [cx + 6, gy - 58], [cx + 18, gy - 52], [cx + 4, gy - 49], [cx - 10, gy - 46], [cx - 22, gy - 38]]), snow, { band: 1.6, hi: 0, stroke: 0.6 });
    line(ctx, [[cx + 26, gy - 36], [cx + 31, gy - 28], [cx + 29, gy - 20]], rock.line, 0.7);
    line(ctx, [[cx - 34, gy - 18], [cx - 30, gy - 12]], rock.line, 0.7);
    // Dark tunnel mouth with a faint eerie glow deep inside.
    const mouth = () => {
      ctx.moveTo(cx - 14, gy + 1);
      ctx.lineTo(cx - 14, gy - 24);
      ctx.quadraticCurveTo(cx, gy - 34, cx + 14, gy - 24);
      ctx.lineTo(cx + 14, gy + 1);
      ctx.closePath();
    };
    flat(ctx, mouth, '#140e1c');
    ctx.save();
    ctx.beginPath();
    mouth();
    ctx.clip();
    const pulse = 0.7 + 0.3 * Math.sin(phase * Math.PI * 2);
    glow(ctx, { x: cx + 1, y: gy - 12 }, 16, 0x9a5aff, 0.55 * pulse);
    ctx.restore();
    // Timber frame (posts + lintel).
    const wood = tone(0x8a5a32, { light: 0.32, shadow: 0.42 });
    for (const s of [-1, 1]) {
      shade(ctx, polyP(ctx, [[cx + s * 14 - 2.4, gy + 1.5], [cx + s * 14 - 2.4, gy - 26], [cx + s * 14 + 2.4, gy - 26], [cx + s * 14 + 2.4, gy + 1.5]]), wood, { band: 1.6, hi: 0.6, stroke: 0.8 });
      line(ctx, [[cx + s * 14 - 0.6, gy - 3], [cx + s * 14 - 0.6, gy - 23]], wood.shade, 0.6);
    }
    shade(ctx, polyP(ctx, [[cx - 19, gy - 25], [cx + 19, gy - 25], [cx + 18, gy - 30.5], [cx - 18, gy - 30.5]]), wood, { band: 1.6, hi: 0.7, stroke: 0.8 });
    for (const bx of [cx - 13, cx + 13]) flat(ctx, ellipseP(ctx, bx, gy - 27.8, 0.8, 0.8), '#3a2a1a');
    // Mine-cart rails running out of the shaft.
    const rail = '#4a4a58';
    line(ctx, [[cx - 7, gy - 1], [cx - 12, gy + 12]], rail, 1.1);
    line(ctx, [[cx + 5, gy - 1], [cx + 6, gy + 12]], rail, 1.1);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      line(ctx, [[cx - 8.5 - t * 4.5, gy + 1 + t * 10], [cx + 6 + t * 1.2, gy + 1 + t * 10]], '#6a4a2a', 1.4);
    }
    // Leaning pickaxe.
    shade(ctx, limbP(ctx, [cx + 22, gy + 2], [cx + 21, gy - 8], [cx + 20, gy - 18], 1, 0.9), wood, { band: 0.6, hi: 0, stroke: 0.6 });
    shade(ctx, () => {
      ctx.moveTo(cx + 13, gy - 15);
      ctx.quadraticCurveTo(cx + 20, gy - 21, cx + 28, gy - 17);
      ctx.lineTo(cx + 27.5, gy - 16);
      ctx.quadraticCurveTo(cx + 20, gy - 18.5, cx + 13.5, gy - 14);
      ctx.closePath();
    }, tone(0x9aa4b4, { light: 0.4 }), { band: 0.6, hi: 0.3, stroke: 0.6 });
    // Hanging lantern with a flickering forge-orange flame (focal accent).
    line(ctx, [[cx - 20, gy - 29], [cx - 20, gy - 22]], '#3a2a1a', 0.7);
    const lx = cx - 20, ly = gy - 16;
    glow(ctx, { x: lx, y: ly }, 14 + 2 * Math.sin(phase * Math.PI * 4), 0xffa040, 0.55);
    flat(ctx, polyP(ctx, [[lx - 3.4, ly - 5], [lx + 3.4, ly - 5], [lx + 2.6, ly + 4], [lx - 2.6, ly + 4]]), '#ffd890', '#5a3a1a', 0.8);
    drawFlame(ctx, lx, ly + 2.5, 3, 5.5, phase * Math.PI * 2, 0xff8a20);
    line(ctx, [[lx - 3.8, ly - 5.4], [lx + 3.8, ly - 5.4]], '#5a3a1a', 1.2);
    line(ctx, [[lx - 3, ly + 4.4], [lx + 3, ly + 4.4]], '#5a3a1a', 1.2);
    drawRock(ctx, cx - 30, gy + 4, 12, 7, 0x6a7688, r, 1);
    drawRock(ctx, cx + 34, gy + 3, 9, 5, 0x6a7688, r, 0);
    motes(ctx, cx + 1, gy - 6, 18, 20, 4, phase, 'rgba(210,180,255,0.8)', 31);
  },
});

// ── Demon altar ring gate ────────────────────────────────────────────────

const ALTAR_VORTEX: VortexPalette = { rim: 0x1e0a34, mid: 0x9a3ae8, core: 0xffc8ff, arm: 'rgba(255,190,255,0.85)', arm2: 'rgba(190,90,255,0.85)' };

export const SubDungeonAltarDrawer = defineDecor({
  key: 'subdungeon_altar',
  w: 92,
  h: 100,
  ground: 82,
  frames: GATE_FRAMES,
  loop: { frames: GATE_FRAMES, fps: 9 },
  draw(ctx, { cx, gy }, frame) {
    const r = rng(hashKey('subdungeon_altar'));
    const phase = frame / GATE_FRAMES;
    contactShadow(ctx, cx + 3, gy, 40, 10, 0.5);
    crackedRing(ctx, cx, gy - 2, 40, 0xc040ff, '#d070ff', r);
    // Two-step dais.
    block(ctx, cx - 30, gy + 3, 56, 6, 10, 0x40344e, r, false);
    block(ctx, cx - 22, gy - 3, 40, 5, 8, 0x4c405c, r, false);
    // Stone ring (front half drawn after the vortex).
    const ringC = { x: cx, y: gy - 34 };
    const stone = tone(0x4a3c5a, { light: 0.33, shadow: 0.45 });
    vortex(ctx, ringC.x, ringC.y, 17, 24, phase, ALTAR_VORTEX);
    const ring = () => {
      ctx.ellipse(ringC.x, ringC.y, 24, 31, 0, 0, Math.PI * 2);
      ctx.ellipse(ringC.x, ringC.y, 17, 24, 0, 0, Math.PI * 2, true);
    };
    shade(ctx, ring, stone, { band: 2.6, hi: 1.1, stroke: 0.9 });
    // Rune studs around the ring (glow pulses round with the swirl).
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const px = ringC.x + Math.cos(a) * 20.5;
      const py = ringC.y + Math.sin(a) * 27.5;
      const lit = ((i / 8 - phase) % 1 + 1) % 1 < 0.3;
      if (lit) glow(ctx, { x: px, y: py }, 5, 0xe070ff, 0.6);
      flat(ctx, ellipseP(ctx, px, py, 1.4, 1.4), lit ? '#ffd8ff' : '#b070e0', '#3a1a5a', 0.4);
    }
    // Horned crest on top of the ring.
    const horn = tone(0xd0c0b0, { light: 0.35, shadow: 0.45 });
    for (const s of [-1, 1]) {
      shade(ctx, limbP(ctx, [cx + s * 6, gy - 63], [cx + s * 14, gy - 72], [cx + s * 11, gy - 82], 2.8, 0.4), horn, { band: 1.2, hi: 0.5, stroke: 0.8 });
    }
    shade(ctx, polyP(ctx, [[cx - 7, gy - 66], [cx + 7, gy - 66], [cx + 4, gy - 60], [cx - 4, gy - 60]]), stone, { band: 1.2, hi: 0.5, stroke: 0.8 });
    // Braziers with magenta flame either side.
    for (const s of [-1, 1]) {
      const bx = cx + s * 32;
      const bgy = gy + 2;
      const iron = tone(0x3a3440, { light: 0.35 });
      shade(ctx, polyP(ctx, [[bx - 1.4, bgy], [bx - 1, bgy - 14], [bx + 1, bgy - 14], [bx + 1.4, bgy]]), iron, { band: 0.8, hi: 0, stroke: 0.6 });
      shade(ctx, () => {
        ctx.moveTo(bx - 5, bgy - 16);
        ctx.quadraticCurveTo(bx, bgy - 11, bx + 5, bgy - 16);
        ctx.closePath();
      }, iron, { band: 1, hi: 0.4, stroke: 0.7 });
      drawFlame(ctx, bx, bgy - 15.5, 6, 11, (phase + (s > 0 ? 0.5 : 0)) * Math.PI * 2, 0xd040ff);
    }
    motes(ctx, cx, gy - 12, 36, 52, 7, phase, 'rgba(240,190,255,0.9)', 53);
  },
});

/** Map a sub-dungeon id to its entrance art. */
export function subDungeonGateKey(targetSubDungeon: string): string {
  return targetSubDungeon.includes('mine') ? 'subdungeon_mine' : 'subdungeon_altar';
}

export const DUNGEON_GATE_DRAWERS: readonly DecorDrawer[] = [DungeonPortalDrawer, SubDungeonMineDrawer, SubDungeonAltarDrawer];
