// src/graphics/sprites/decorations/Mushroom.ts
import { defineDecor, contactShadow, shade, tone, ellipseP, glow, flat, tuft, type Rand } from './DecorKit';

function shroom(ctx: CanvasRenderingContext2D, x: number, gy: number, h: number, capR: number, cap: number, spots: string | null, lit: number | null, r: Rand): void {
  const stem = tone(0xe8dcc4, { shadow: 0.35 });
  const capY = gy - h;
  shade(ctx, () => {
    ctx.moveTo(x - capR * 0.28, gy);
    ctx.quadraticCurveTo(x - capR * 0.36, gy - h * 0.5, x - capR * 0.22, capY);
    ctx.lineTo(x + capR * 0.22, capY);
    ctx.quadraticCurveTo(x + capR * 0.3, gy - h * 0.5, x + capR * 0.32, gy);
    ctx.closePath();
  }, stem, { band: capR * 0.2, hi: 0.6, stroke: 0.6 });
  if (lit !== null) glow(ctx, { x, y: capY - capR * 0.2 }, capR * 2.4, lit, 0.5);
  const t = tone(cap, { light: 0.4 });
  shade(ctx, () => {
    ctx.moveTo(x - capR, capY + capR * 0.15);
    ctx.bezierCurveTo(x - capR, capY - capR * 1.05, x + capR, capY - capR * 1.05, x + capR, capY + capR * 0.15);
    ctx.quadraticCurveTo(x, capY + capR * 0.45, x - capR, capY + capR * 0.15);
    ctx.closePath();
  }, t, { band: capR * 0.35, hi: capR * 0.15, stroke: 0.65 });
  if (spots) {
    for (let i = 0; i < 3; i++) {
      const sx = x + (i - 1) * capR * 0.5 + (r() - 0.5);
      const sy = capY - capR * (0.35 + (i === 1 ? 0.2 : 0));
      flat(ctx, ellipseP(ctx, sx, sy, capR * 0.15, capR * 0.11), spots);
    }
  }
}

/** Twilight Forest / Abyss — glowing toadstool cluster. */
export const MushroomDrawer = defineDecor({
  key: 'decor_mushroom',
  w: 40,
  h: 36,
  ground: 31,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 2, gy, 15, 4.5, 0.38);
    shroom(ctx, cx - 7, gy, 14, 8, 0x7a4ab8, '#d8f8ff', 0x7ff0ff, r);
    shroom(ctx, cx + 6, gy + 1, 9, 6, 0x5a86c8, '#e8f8ff', 0x9ab8ff, r);
    shroom(ctx, cx + 13, gy + 1, 5, 3.6, 0x7a4ab8, null, null, r);
    tuft(ctx, cx - 1, gy + 1, 5, 4, '#1f5a57', '#44a58f', r);
  },
});

/** Emerald Plains — red spotted toadstools. */
export const MushroomRedDrawer = defineDecor({
  key: 'decor_mushroom_red',
  w: 36,
  h: 30,
  ground: 26,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 2, gy, 13, 4, 0.35);
    shroom(ctx, cx - 5, gy, 11, 7, 0xd2402e, '#fff4e0', null, r);
    shroom(ctx, cx + 7, gy + 1, 7, 4.5, 0xd2402e, '#fff4e0', null, r);
    tuft(ctx, cx, gy + 1, 5, 4, '#3f7a33', '#8cc24f', r);
  },
});
