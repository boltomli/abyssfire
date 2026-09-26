// src/graphics/sprites/decorations/Cactus.ts
import { defineDecor, contactShadow, shade, tone, line, ellipseP, flat, limbP } from './DecorKit';

function ribs(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, w: number, col: string): void {
  for (const f of [-0.3, 0.2]) line(ctx, [[x + w * f, top + 3], [x + w * f, bottom - 1]], col, 0.7);
}

function column(x: number, top: number, bottom: number, w: number) {
  return (ctx: CanvasRenderingContext2D) => () => {
    ctx.moveTo(x - w / 2, bottom);
    ctx.lineTo(x - w / 2, top + w / 2);
    ctx.arc(x, top + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, bottom);
    ctx.closePath();
  };
}

/** Scorching Desert — saguaro, taller than the player. */
export const CactusDrawer = defineDecor({
  key: 'decor_cactus',
  w: 64,
  h: 100,
  ground: 95,
  tall: true,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 5, gy, 20, 6, 0.42);
    const t = tone(0x62ad6a, { shadow: 0.35, light: 0.4 });
    // Arms (elbow + upright).
    shade(ctx, limbP(ctx, [cx - 4, gy - 38], [cx - 20, gy - 38], [cx - 20, gy - 56], 4.5, 4.5), t, { band: 2.5, hi: 0.8 });
    shade(ctx, column(cx - 20, gy - 70, gy - 52, 9)(ctx), t, { band: 3, hi: 1 });
    shade(ctx, limbP(ctx, [cx + 4, gy - 50], [cx + 18, gy - 50], [cx + 18, gy - 62], 4, 4), t, { band: 2.5, hi: 0.8 });
    shade(ctx, column(cx + 18, gy - 78, gy - 58, 8)(ctx), t, { band: 3, hi: 1 });
    // Trunk.
    shade(ctx, column(cx, gy - 88, gy, 14)(ctx), t, { band: 4.5, hi: 1.4 });
    ribs(ctx, cx, gy - 88, gy, 14, t.shade);
    ribs(ctx, cx - 20, gy - 70, gy - 52, 9, t.shade);
    ribs(ctx, cx + 18, gy - 78, gy - 58, 8, t.shade);
    // Spines.
    for (let i = 0; i < 8; i++) {
      const y = gy - 12 - i * 9;
      line(ctx, [[cx - 7, y], [cx - 9.5, y - 1]], '#f0e4b8', 0.5);
      line(ctx, [[cx + 7, y + 4], [cx + 9.5, y + 3]], '#f0e4b8', 0.5);
    }
    // Focal accent: a pink bloom on top.
    const bloom = tone(0xff6f9a, { light: 0.4 });
    for (let p = 0; p < 5; p++) {
      const a = -Math.PI / 2 + (p - 2) * 0.55;
      shade(ctx, ellipseP(ctx, cx + Math.cos(a) * 2.6, gy - 88 + Math.sin(a) * 2.2, 2, 1.4, a), bloom, { band: 0.6, hi: 0, stroke: 0.4 });
    }
    flat(ctx, ellipseP(ctx, cx, gy - 87.5, 1.2, 1), '#ffe07a');
    contactShadow(ctx, cx, gy + 1, 9, 2.4, 0.35);
  },
});

/** Scorching Desert — squat barrel cactus with a turquoise-tinted bloom. */
export const BarrelCactusDrawer = defineDecor({
  key: 'decor_cactus_barrel',
  w: 40,
  h: 36,
  ground: 31,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 3, gy, 15, 4.5, 0.4);
    const t = tone(0x5aa068, { shadow: 0.4, light: 0.35 });
    shade(ctx, ellipseP(ctx, cx - 7, gy - 7, 7, 7.5), t, { band: 2.5, hi: 1 });
    shade(ctx, ellipseP(ctx, cx + 3, gy - 11, 10, 11), t, { band: 3.5, hi: 1.2 });
    for (const f of [-0.55, -0.15, 0.25, 0.6]) {
      ctx.beginPath();
      ctx.ellipse(cx + 3 + f * 10, gy - 11, Math.max(0.5, 10 * (1 - Math.abs(f)) * 0.4), 10.5, 0, -Math.PI / 2, Math.PI / 2, f > 0);
      ctx.strokeStyle = t.shade;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    const bloom = tone(0x3fd0c8, { light: 0.4 });
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      shade(ctx, ellipseP(ctx, cx + 3 + Math.cos(a) * 2.2, gy - 21 + Math.sin(a) * 1.5, 1.8, 1.2, a), bloom, { band: 0.5, hi: 0, stroke: 0.4 });
    }
    flat(ctx, ellipseP(ctx, cx + 3, gy - 21, 1, 0.9), '#fff2a0');
  },
});
