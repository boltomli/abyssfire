// src/graphics/sprites/decorations/TreasureChest.ts
//
// Interactive treasure chest (hidden-area rewards, treasure-cache events).
// Frames 0..CHEST_LOOP_FRAMES-1 are the closed chest with a travelling glint
// (registered as `decor_treasure_chest_anim`); frame CHEST_OPEN_FRAME is the
// opened chest spilling light. Displayed with origin (0.5, anchorY) on the
// tile's ground point.
import { defineDecor, contactShadow, shade, tone, polyP, line, glow, flat, ellipseP, rgbaHex, rng, type Rand } from './DecorKit';

export const CHEST_LOOP_FRAMES = 8;
export const CHEST_OPEN_FRAME = CHEST_LOOP_FRAMES;

type Ctx = CanvasRenderingContext2D;

/** Four-point sparkle star (the "something valuable here" glint). */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, alpha = 1): void {
  glow(ctx, { x, y }, r * 1.6, 0xfff4c0, 0.55 * alpha);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r * 0.7, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r * 0.7, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
  ctx.fillStyle = '#fffbe8';
  ctx.fill();
  ctx.restore();
}

const WOOD = 0x8a4e2a;
const BRASS = 0xe0aa3a;

interface Box { x0: number; x1: number; gy: number; top: number; dx: number; dy: number }

function drawBody(ctx: Ctx, b: Box, r: Rand): void {
  const wood = tone(WOOD, { light: 0.32, shadow: 0.4 });
  const brass = tone(BRASS, { light: 0.5, shadow: 0.35 });
  const { x0, x1, gy, top, dx, dy } = b;
  // Side face (receding up-right, in shadow).
  flat(ctx, polyP(ctx, [[x1, gy], [x1, top], [x1 + dx, top - dy], [x1 + dx, gy - dy]]), wood.shade, wood.line, 0.8);
  line(ctx, [[x1 + dx * 0.5, top - dy * 0.5 + 1], [x1 + dx * 0.5, gy - dy * 0.5 - 1]], wood.line, 0.5);
  // Front face with planks.
  shade(ctx, polyP(ctx, [[x0, gy], [x0, top], [x1, top], [x1, gy]]), wood, { band: 2.6, hi: 0.9, stroke: 0.9 });
  const planks = 3;
  for (let i = 1; i < planks; i++) {
    const y = top + ((gy - top) * i) / planks;
    line(ctx, [[x0 + 1, y + (r() - 0.5) * 0.4], [x1 - 1, y]], wood.shade, 0.6);
  }
  // Brass corner straps (front) + side strap.
  for (const bx of [x0, x1 - 3.2]) {
    shade(ctx, polyP(ctx, [[bx, gy + 0.3], [bx, top], [bx + 3.2, top], [bx + 3.2, gy + 0.3]]), brass, { band: 0.9, hi: 0.5, stroke: 0.6 });
    for (const ry of [top + 2.5, gy - 2.5]) flat(ctx, ellipseP(ctx, bx + 1.6, ry, 0.7, 0.7), brass.line);
  }
  flat(ctx, polyP(ctx, [[x1 + dx - 2.4, gy - dy], [x1 + dx - 2.4, top - dy + 0.6], [x1 + dx, top - dy], [x1 + dx, gy - dy]]), brass.shade, brass.line, 0.5);
  // Rim band where the lid meets the body.
  shade(ctx, polyP(ctx, [[x0 - 0.6, top + 2.2], [x0 - 0.6, top - 0.4], [x1 + 0.4, top - 0.4], [x1 + 0.4, top + 2.2]]), brass, { band: 0.8, hi: 0.5, stroke: 0.6 });
  flat(ctx, polyP(ctx, [[x1 + 0.4, top + 2.2], [x1 + 0.4, top - 0.4], [x1 + dx, top - dy - 0.4], [x1 + dx, top - dy + 2.2]]), brass.shade, brass.line, 0.5);
}

function drawLock(ctx: Ctx, cx: number, y: number): void {
  const brass = tone(0xf0c050, { light: 0.55, shadow: 0.35 });
  shade(ctx, polyP(ctx, [[cx - 3.6, y - 3], [cx + 3.6, y - 3], [cx + 3.6, y + 2.6], [cx, y + 5], [cx - 3.6, y + 2.6]]), brass, { band: 1.2, hi: 0.6, stroke: 0.7 });
  flat(ctx, ellipseP(ctx, cx, y, 1.1, 1.1), '#3a1e0c');
  flat(ctx, polyP(ctx, [[cx - 0.6, y + 0.4], [cx + 0.6, y + 0.4], [cx + 0.9, y + 2.6], [cx - 0.9, y + 2.6]]), '#3a1e0c');
}

function drawClosedLid(ctx: Ctx, b: Box): void {
  const wood = tone(WOOD, { light: 0.34, shadow: 0.4 });
  const brass = tone(BRASS, { light: 0.5, shadow: 0.35 });
  const { x0, x1, top, dx, dy } = b;
  const lh = 9;
  // Lid side (curved gable, in shadow).
  flat(ctx, () => {
    ctx.moveTo(x1, top);
    ctx.bezierCurveTo(x1, top - lh * 1.3, x1 + dx, top - dy - lh * 1.3, x1 + dx, top - dy);
    ctx.closePath();
  }, wood.shade, wood.line, 0.8);
  // Lid front (barrel dome).
  const dome = () => {
    ctx.moveTo(x0, top);
    ctx.bezierCurveTo(x0, top - lh * 1.3, x1, top - lh * 1.3, x1, top);
    ctx.closePath();
  };
  shade(ctx, dome, wood, { band: 2.2, hi: 1.1, stroke: 0.9 });
  // Top surface of the barrel lid receding to the back.
  flat(ctx, () => {
    ctx.moveTo(x0 + (x1 - x0) * 0.18, top - lh * 0.86);
    ctx.lineTo(x0 + (x1 - x0) * 0.82, top - lh * 0.86);
    ctx.lineTo(x0 + (x1 - x0) * 0.82 + dx, top - lh * 0.86 - dy);
    ctx.lineTo(x0 + (x1 - x0) * 0.18 + dx, top - lh * 0.86 - dy);
    ctx.closePath();
  }, wood.light, wood.line, 0.6);
  // Plank seams on the dome.
  line(ctx, [[x0 + 3, top - 5], [x1 - 3, top - 5]], wood.shade, 0.55);
  // Brass straps over the lid.
  for (const bx of [x0, x1 - 3.2]) {
    shade(ctx, () => {
      ctx.moveTo(bx, top);
      ctx.bezierCurveTo(bx + (bx < x0 + 1 ? 0.5 : 2), top - lh * 1.05, bx + 1.6, top - lh * 1.12, bx + 1.6, top - lh * 1.12);
      ctx.lineTo(bx + 3.2, top - lh * 1.1);
      ctx.bezierCurveTo(bx + 3.2, top - lh * 0.9, bx + 3.2, top - 2, bx + 3.2, top);
      ctx.closePath();
    }, brass, { band: 0.8, hi: 0.5, stroke: 0.6 });
  }
}

function drawOpenLid(ctx: Ctx, b: Box): void {
  const wood = tone(WOOD, { light: 0.3, shadow: 0.45 });
  const brass = tone(BRASS, { light: 0.5, shadow: 0.35 });
  const { x0, x1, top, dx, dy } = b;
  const bx0 = x0 + dx, bx1 = x1 + dx, by = top - dy;
  const lh = 13;
  // Inside of the lid, tipped back (dark wood, lit by the treasure).
  const inner = () => {
    ctx.moveTo(bx0, by);
    ctx.lineTo(bx0 + 2, by - lh);
    ctx.bezierCurveTo(bx0 + 4, by - lh - 6, bx1, by - lh - 6, bx1 + 1.5, by - lh);
    ctx.lineTo(bx1, by);
    ctx.closePath();
  };
  shade(ctx, inner, tone(0x5a3220, { light: 0.25, shadow: 0.4 }), { band: 2, hi: 0, stroke: 0.9, line: wood.line });
  line(ctx, [[bx0 + 1.4, by - lh * 0.5], [bx1 + 0.8, by - lh * 0.5]], wood.line, 0.5);
  for (const sx of [bx0 + 0.6, bx1 - 3]) {
    flat(ctx, polyP(ctx, [[sx, by], [sx + 1.6, by - lh - 1], [sx + 4.2, by - lh - 1], [sx + 3, by]]), brass.shade, brass.line, 0.5);
  }
}

function drawTreasureInside(ctx: Ctx, b: Box, r: Rand): void {
  const { x0, x1, top, dx, dy } = b;
  // Opening (dark interior).
  flat(ctx, polyP(ctx, [[x0 + 0.6, top], [x1 - 0.6, top], [x1 + dx - 0.6, top - dy], [x0 + dx + 0.6, top - dy]]), '#2a160c');
  // Heaped coins catching the light.
  const gold = tone(0xf4c040, { light: 0.55, shadow: 0.3 });
  const mx = (x0 + x1 + dx) / 2;
  shade(ctx, () => {
    ctx.moveTo(x0 + 1.2, top - 0.2);
    ctx.quadraticCurveTo(mx - 6, top - dy - 5, mx, top - dy - 5.5);
    ctx.quadraticCurveTo(mx + 7, top - dy - 5, x1 + dx - 1.2, top - dy + 0.4);
    ctx.lineTo(x1 - 0.6, top);
    ctx.closePath();
  }, gold, { band: 1.6, hi: 0.8, stroke: 0.6 });
  for (let i = 0; i < 7; i++) {
    const x = x0 + 3 + r() * (x1 - x0 + dx - 6);
    const y = top - 1.5 - r() * 4;
    flat(ctx, ellipseP(ctx, x, y, 1.6, 0.9), gold.light, gold.line, 0.4);
  }
  // A gem as the focal pop.
  flat(ctx, polyP(ctx, [[mx - 2.4, top - dy - 5], [mx, top - dy - 8], [mx + 2.4, top - dy - 5], [mx, top - dy - 3]]), '#ff5a7a', '#8a1a3a', 0.5);
  flat(ctx, polyP(ctx, [[mx - 1.2, top - dy - 5.4], [mx, top - dy - 7.2], [mx + 0.3, top - dy - 5.4]]), '#ffd0dc');
}

export const TreasureChestDrawer = defineDecor({
  key: 'decor_treasure_chest',
  w: 48,
  h: 50,
  ground: 42,
  frames: CHEST_LOOP_FRAMES + 1,
  loop: { frames: CHEST_LOOP_FRAMES, fps: 8 },
  draw(ctx, { cx, gy }, frame) {
    // Same seed on every frame so the loop doesn't jitter.
    const r = rng(0xc4e57);
    const open = frame === CHEST_OPEN_FRAME;
    const b: Box = { x0: cx - 15, x1: cx + 9, gy, top: gy - 13, dx: 6, dy: 4 };
    contactShadow(ctx, cx + 3, gy - 1, 20, 5, 0.45);
    if (open) {
      glow(ctx, { x: cx + 1, y: b.top - 8 }, 22, 0xffd870, 0.55);
      drawOpenLid(ctx, b);
      drawBody(ctx, b, r);
      drawTreasureInside(ctx, b, r);
      // Light spilling up out of the chest.
      ctx.save();
      const g = ctx.createLinearGradient(0, b.top, 0, b.top - 26);
      g.addColorStop(0, rgbaHex(0xfff0b0, 0.55));
      g.addColorStop(1, rgbaHex(0xfff0b0, 0));
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(b.x0 + 2, b.top);
      ctx.lineTo(b.x0 - 2, b.top - 26);
      ctx.lineTo(b.x1 + b.dx + 3, b.top - 26);
      ctx.lineTo(b.x1 + b.dx - 1, b.top - b.dy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawLock(ctx, (b.x0 + b.x1) / 2, b.top + 3.5);
      sparkle(ctx, cx - 7, b.top - 14, 3.2);
      sparkle(ctx, cx + 10, b.top - 19, 2.2, 0.8);
      return;
    }
    drawBody(ctx, b, r);
    drawClosedLid(ctx, b);
    // Warm light leaking from the lid seam — the chest's focal accent.
    const seam = 0.55 + 0.25 * Math.sin((frame / CHEST_LOOP_FRAMES) * Math.PI * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    line(ctx, [[b.x0 + 3.5, b.top - 0.3], [b.x1 - 3.5, b.top - 0.3]], rgbaHex(0xffe080, seam), 1.1);
    ctx.restore();
    drawLock(ctx, (b.x0 + b.x1) / 2, b.top + 1.5);
    glow(ctx, { x: (b.x0 + b.x1) / 2, y: b.top + 1 }, 7, 0xffd870, 0.35 + 0.2 * seam);
    // Travelling glint: sweeps across the lid in the last frames of the loop.
    const g = frame - (CHEST_LOOP_FRAMES - 3);
    if (g >= 0) {
      const t = g / 2;
      sparkle(ctx, b.x0 + 3 + t * (b.x1 - b.x0 - 6), b.top - 9 - Math.sin(t * Math.PI) * 2, 2.6 + (g === 1 ? 1.2 : 0), g === 1 ? 1 : 0.75);
    }
  },
});
