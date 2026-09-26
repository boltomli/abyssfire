// src/graphics/sprites/decorations/LoreProps.ts
//
// Lore collectibles (src/data/loreCollectibles.ts): one prop per
// `spriteType`, keyed `decor_lore_<spriteType>`. Interactive props sit
// between characters and decorations in the value hierarchy: soft coloured
// ink, a clear silhouette and one glowing focal accent (the lore itself).
// Displayed with origin (0.5, anchorY) on the tile's ground point.
import {
  defineDecor, contactShadow, shade, tone, polyP, blobP, line, curve, glow, flat, ellipseP, shard, tuft,
  rgbaHex, type DecorDrawer, type Rand,
} from './DecorKit';
import { drawRock } from './Rock';
import { sparkle } from './TreasureChest';

type Ctx = CanvasRenderingContext2D;

export type LoreSpriteType = 'ancient_tablet' | 'old_scroll' | 'crystal_shard' | 'carved_stone' | 'torn_journal' | 'rune_pillar';

/** Soft elliptical pool of light on the ground under a magical prop. */
function groundPool(ctx: Ctx, x: number, y: number, rx: number, col: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.38);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgbaHex(col, a));
  g.addColorStop(1, rgbaHex(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Glowing glyph stroke: a coloured under-stroke with a pale hot core. */
function glyph(ctx: Ctx, pts: readonly (readonly [number, number])[], col: string, core: string, w = 1.6): void {
  line(ctx, pts, col, w);
  line(ctx, pts, core, w * 0.4);
}

const DRAW: Record<LoreSpriteType, (ctx: Ctx, cx: number, gy: number, r: Rand) => void> = {
  // Weathered sandstone stele with glowing golden script.
  ancient_tablet(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 3, gy, 16, 4.5, 0.42);
    groundPool(ctx, cx, gy, 18, 0xffc850, 0.35);
    const stone = tone(0xb89a70, { light: 0.35, shadow: 0.42 });
    // Side thickness.
    flat(ctx, polyP(ctx, [[cx + 9, gy], [cx + 9, gy - 26], [cx + 12, gy - 28], [cx + 12, gy - 2]]), stone.shade, stone.line, 0.7);
    const face = () => {
      ctx.moveTo(cx - 10, gy + 0.5);
      ctx.lineTo(cx - 10, gy - 25);
      ctx.bezierCurveTo(cx - 10, gy - 35, cx + 9, gy - 35, cx + 9, gy - 25);
      ctx.lineTo(cx + 9, gy + 0.5);
      ctx.closePath();
    };
    shade(ctx, face, stone, { band: 2.6, hi: 1.1, stroke: 0.9 });
    // Chip and crack.
    flat(ctx, polyP(ctx, [[cx + 9, gy - 21], [cx + 6, gy - 18], [cx + 9, gy - 15]]), stone.shade, stone.line, 0.5);
    line(ctx, [[cx - 10, gy - 12], [cx - 6, gy - 10], [cx - 7, gy - 6]], stone.line, 0.6);
    // Carved border.
    line(ctx, [[cx - 7, gy - 3], [cx - 7, gy - 25]], stone.shade, 0.6);
    // Golden script (focal accent).
    glow(ctx, { x: cx - 0.5, y: gy - 17 }, 10, 0xffc850, 0.3);
    for (let i = 0; i < 4; i++) {
      const y = gy - 26 + i * 5;
      const w = 10 - (i === 3 ? 4 : 0);
      const pts: [number, number][] = [];
      for (let k = 0; k <= 4; k++) pts.push([cx - 5 + (w * k) / 4, y + (k % 2 ? -1 : 0.6) * (0.6 + r() * 0.4)]);
      glyph(ctx, pts, '#e0901a', '#fff2b0', 1.5);
    }
    tuft(ctx, cx - 10, gy + 1, 5, 4, '#4f7a2a', '#8ab84a', r);
    tuft(ctx, cx + 9, gy + 1, 4, 3, '#4f7a2a', '#8ab84a', r);
  },

  // A parchment scroll half unrolled against a mossy stone, wax seal on top.
  old_scroll(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 2, gy, 16, 4, 0.4);
    groundPool(ctx, cx, gy, 16, 0xffe0a0, 0.3);
    drawRock(ctx, cx + 5, gy, 18, 12, 0x8a8a7a, r, 1);
    const paper = tone(0xf2dcaa, { light: 0.45, shadow: 0.35 });
    const rod = tone(0x8a4a2a, { light: 0.3 });
    // Unrolled sheet leaning on the rock.
    const sheet = () => {
      ctx.moveTo(cx - 12, gy - 2);
      ctx.lineTo(cx - 5, gy - 21);
      ctx.quadraticCurveTo(cx + 2, gy - 23, cx + 8, gy - 19);
      ctx.lineTo(cx + 3, gy + 0);
      ctx.quadraticCurveTo(cx - 4, gy + 1, cx - 12, gy - 2);
      ctx.closePath();
    };
    shade(ctx, sheet, paper, { band: 2.2, hi: 0.9, stroke: 0.8 });
    for (let i = 0; i < 4; i++) {
      const t = 0.22 + i * 0.16;
      const x0 = cx - 12 + 7 * t * 2.2 + 1.5;
      const y0 = gy - 2 - 19 * t * 1.1;
      line(ctx, [[x0, y0], [x0 + 8 - i, y0 + 1.6]], '#9a7a52', 0.7);
    }
    glow(ctx, { x: cx - 2, y: gy - 12 }, 12, 0xffe6a0, 0.45);
    // Rolled top end.
    shade(ctx, () => ctx.ellipse(cx + 1.5, gy - 21, 7.5, 2.6, 0.32, 0, Math.PI * 2), paper, { band: 1, hi: 0.5, stroke: 0.7 });
    shade(ctx, ellipseP(ctx, cx - 5.6, gy - 23.4, 1.7, 2.1), rod, { band: 0.7, hi: 0, stroke: 0.6 });
    shade(ctx, ellipseP(ctx, cx + 8.6, gy - 18.6, 1.7, 2.1), rod, { band: 0.7, hi: 0, stroke: 0.6 });
    // Wax seal + ribbon (colour pop).
    line(ctx, [[cx - 3, gy - 5], [cx - 5, gy + 1]], '#b02a2a', 1.2);
    shade(ctx, ellipseP(ctx, cx - 2.5, gy - 6.5, 2.4, 2.2), tone(0xc8302a, { light: 0.4 }), { band: 0.8, hi: 0.5, stroke: 0.6 });
  },

  // A cluster of cyan crystal shards breaking out of the ground.
  crystal_shard(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 2, gy, 15, 4, 0.4);
    groundPool(ctx, cx, gy, 22, 0x66d8ff, 0.45);
    glow(ctx, { x: cx, y: gy - 14 }, 20, 0x66ccff, 0.5);
    drawRock(ctx, cx - 7, gy + 1, 12, 7, 0x6a7080, r, 0);
    shard(ctx, cx - 7, gy - 2, 13, 5, -3, 0x4fb8e8);
    shard(ctx, cx + 7, gy, 15, 6, 3, 0x4fb8e8);
    shard(ctx, cx, gy - 1, 28, 8, 1, 0x70d8ff);
    drawRock(ctx, cx + 5, gy + 2, 10, 5, 0x5a6070, r, 0);
    // Inner light core.
    flat(ctx, ellipseP(ctx, cx - 0.5, gy - 12, 1.4, 5), 'rgba(240,255,255,0.85)');
  },

  // A low boulder with a carved spiral relief glowing moon-silver.
  carved_stone(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 3, gy, 18, 5, 0.42);
    groundPool(ctx, cx, gy, 18, 0xb0d0ff, 0.3);
    const stone = tone(0x8a8e9a, { light: 0.35, shadow: 0.42 });
    const body = blobP(ctx, [[cx - 16, gy + 1], [cx - 15, gy - 10], [cx - 8, gy - 19], [cx + 3, gy - 21], [cx + 12, gy - 15], [cx + 16, gy - 5], [cx + 15, gy + 1], [cx, gy + 2.5]]);
    shade(ctx, body, stone, { band: 4, hi: 1.3, stroke: 0.9 });
    // Moss cap.
    const moss = tone(0x6a9a4a, { light: 0.3 });
    shade(ctx, blobP(ctx, [[cx - 9, gy - 17], [cx - 2, gy - 22], [cx + 7, gy - 20], [cx + 2, gy - 17], [cx - 4, gy - 16]]), moss, { band: 1, hi: 0.5, stroke: 0.6 });
    // Recessed carved panel.
    flat(ctx, ellipseP(ctx, cx - 1, gy - 9, 8.5, 6.5), stone.shade, stone.line, 0.6);
    glow(ctx, { x: cx - 1, y: gy - 9 }, 11, 0xb8d8ff, 0.55);
    // Spiral glyph.
    const pts: [number, number][] = [];
    for (let k = 0; k <= 26; k++) {
      const t = k / 26;
      const a = t * Math.PI * 3.4;
      const rr = 0.6 + t * 5.4;
      pts.push([cx - 1 + Math.cos(a) * rr, gy - 9 + Math.sin(a) * rr * 0.75]);
    }
    glyph(ctx, pts, '#7aa8e8', '#f0f8ff', 1.4);
    // A lichen fleck and cracks for material.
    line(ctx, [[cx + 10, gy - 12], [cx + 12, gy - 8], [cx + 11, gy - 4]], stone.line, 0.6);
    tuft(ctx, cx - 15, gy + 1.5, 4, 3, '#4f7a2a', '#8ab84a', r);
  },

  // A leather journal lying open with a torn page and a quill.
  torn_journal(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 2, gy - 1, 17, 4.5, 0.42);
    groundPool(ctx, cx, gy - 2, 16, 0xffe0a8, 0.3);
    const leather = tone(0x7a3e24, { light: 0.3 });
    const paper = tone(0xf0e0bc, { light: 0.45, shadow: 0.35 });
    // Cover (open, lying on the ground, seen at 3/4).
    shade(ctx, polyP(ctx, [[cx - 15, gy - 4], [cx - 2, gy + 1], [cx + 14, gy - 5], [cx + 1, gy - 10]]), leather, { band: 1.6, hi: 0.6, stroke: 0.9 });
    // Left and right pages, curling up at the spine.
    shade(ctx, () => {
      ctx.moveTo(cx - 13, gy - 5);
      ctx.lineTo(cx - 2, gy - 1);
      ctx.quadraticCurveTo(cx - 1.5, gy - 6, cx, gy - 10);
      ctx.lineTo(cx - 11, gy - 13.5);
      ctx.closePath();
    }, paper, { band: 1.4, hi: 0.6, stroke: 0.7 });
    shade(ctx, () => {
      ctx.moveTo(cx - 2, gy - 1);
      ctx.lineTo(cx + 12, gy - 6);
      ctx.lineTo(cx + 12, gy - 15);
      ctx.quadraticCurveTo(cx + 4, gy - 13, cx, gy - 10);
      ctx.quadraticCurveTo(cx - 1.5, gy - 6, cx - 2, gy - 1);
      ctx.closePath();
    }, paper, { band: 1.4, hi: 0.6, stroke: 0.7 });
    // Writing.
    for (let i = 0; i < 3; i++) {
      line(ctx, [[cx - 10 + i * 0.6, gy - 11 + i * 2.6], [cx - 3.5 + i * 0.2, gy - 8.6 + i * 2.6]], '#8a6a4a', 0.6);
      line(ctx, [[cx + 1.5, gy - 9.6 + i * 2.4], [cx + 10, gy - 12.6 + i * 2.4]], '#8a6a4a', 0.6);
    }
    glow(ctx, { x: cx, y: gy - 9 }, 12, 0xffe6a8, 0.45);
    // Torn page lifting off.
    shade(ctx, () => {
      ctx.moveTo(cx + 6, gy - 16);
      ctx.lineTo(cx + 14, gy - 21);
      ctx.lineTo(cx + 16, gy - 15.5);
      ctx.lineTo(cx + 13.5, gy - 14.5);
      ctx.lineTo(cx + 12.5, gy - 12.8);
      ctx.lineTo(cx + 9, gy - 12);
      ctx.closePath();
    }, paper, { band: 1, hi: 0.5, stroke: 0.6 });
    // Quill (colour pop).
    const feather = tone(0x3a6ab8, { light: 0.4 });
    shade(ctx, () => {
      ctx.moveTo(cx - 17, gy + 1);
      ctx.quadraticCurveTo(cx - 14, gy - 7, cx - 7, gy - 11);
      ctx.quadraticCurveTo(cx - 11, gy - 4, cx - 16, gy + 1.5);
      ctx.closePath();
    }, feather, { band: 1, hi: 0.4, stroke: 0.6 });
    curve(ctx, [cx - 18, gy + 2.5], [cx - 13, gy - 4], [cx - 7, gy - 11], '#1e2e5a', 0.5);
  },

  // A short violet obelisk etched with glowing runes.
  rune_pillar(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 3, gy, 16, 4.5, 0.42);
    groundPool(ctx, cx, gy, 20, 0xa070ff, 0.4);
    drawRock(ctx, cx - 9, gy + 1, 9, 5, 0x5a5068, r, 0);
    const stone = tone(0x4e3a78, { light: 0.35, shadow: 0.42 });
    // Side face.
    flat(ctx, polyP(ctx, [[cx + 6, gy], [cx + 5, gy - 30], [cx + 9, gy - 32], [cx + 10, gy - 2]]), stone.shade, stone.line, 0.7);
    shade(ctx, polyP(ctx, [[cx - 7, gy + 0.5], [cx - 6, gy - 30], [cx - 0.5, gy - 38], [cx + 5, gy - 30], [cx + 6, gy + 0.5]]), stone, { band: 2.4, hi: 1, stroke: 0.9 });
    // Tip cap.
    flat(ctx, polyP(ctx, [[cx - 0.5, gy - 38], [cx + 5, gy - 30], [cx + 9, gy - 32]]), stone.light, stone.line, 0.6);
    glow(ctx, { x: cx - 0.5, y: gy - 17 }, 13, 0xb07aff, 0.6);
    glyph(ctx, [[cx - 2.5, gy - 27], [cx + 2, gy - 24], [cx - 2.5, gy - 21]], '#9a5aff', '#f4e8ff', 1.6);
    glyph(ctx, [[cx - 0.5, gy - 18], [cx - 0.5, gy - 11]], '#9a5aff', '#f4e8ff', 1.6);
    glyph(ctx, [[cx - 3, gy - 14.5], [cx + 2, gy - 14.5]], '#9a5aff', '#f4e8ff', 1.4);
    glyph(ctx, [[cx - 2.5, gy - 7], [cx + 1.5, gy - 4], [cx - 2.5, gy - 2.5]], '#9a5aff', '#f4e8ff', 1.4);
    drawRock(ctx, cx + 8, gy + 2, 8, 4, 0x4a4058, r, 0);
  },
};

function makeLoreDrawer(kind: LoreSpriteType): DecorDrawer {
  return defineDecor({
    key: `decor_lore_${kind}`,
    w: 44,
    h: 48,
    ground: 42,
    draw(ctx, { cx, gy, r }) {
      DRAW[kind](ctx, cx, gy, r);
      sparkle(ctx, cx + 11, gy - 30, 2.4, 0.9);
    },
  });
}

export const LORE_PROP_DRAWERS: readonly DecorDrawer[] = (
  ['ancient_tablet', 'old_scroll', 'crystal_shard', 'carved_stone', 'torn_journal', 'rune_pillar'] as const
).map(makeLoreDrawer);
