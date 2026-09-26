// src/graphics/sprites/decorations/Bush.ts
import { defineDecor, contactShadow, canopy, shade, tone, ellipseP, blade, tuft, glow, flat, line } from './DecorKit';

/** Emerald Plains — knee-to-waist berry bush. */
export const BushDrawer = defineDecor({
  key: 'decor_bush',
  w: 56,
  h: 44,
  ground: 39,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 3, gy, 25, 7, 0.42);
    canopy(ctx, [
      [cx - 12, gy - 12, 13, 11],
      [cx + 13, gy - 12, 12, 10],
      [cx, gy - 20, 15, 12],
      [cx - 9, gy - 13, 12, 10],
      [cx + 8, gy - 14, 13, 10],
    ], { leaf: 0x5c9c3c, back: 0x376a3c, accent: '#d2ea83' }, r, 2);
    const berry = tone(0xc8324a, { light: 0.5 });
    for (const [bx, by] of [[-12, -16], [-2, -24], [9, -18], [15, -10], [-6, -9]] as const) {
      shade(ctx, ellipseP(ctx, cx + bx, gy + by, 1.9, 1.9), berry, { band: 0.9, hi: 0.6, stroke: 0.4 });
    }
  },
});

/** Twilight Forest — curling fern cluster with a faint glow. */
export const FernDrawer = defineDecor({
  key: 'decor_fern',
  w: 56,
  h: 44,
  ground: 39,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 3, gy, 22, 6, 0.4);
    const dark = tone(0x2a6a66);
    const lite = tone(0x3f9a86);
    const fronds: [number, number, number][] = [[-1.2, 22, 0], [-0.7, 28, 1], [-0.2, 32, 0], [0.35, 30, 1], [0.8, 26, 0], [1.25, 20, 1]];
    for (const [ang, len, k] of fronds) {
      const t = k ? lite : dark;
      const tip: [number, number] = [cx + Math.sin(ang) * len, gy - 2 - Math.cos(ang) * len * 0.9];
      const mid: [number, number] = [cx + Math.sin(ang) * len * 0.4, gy - 2 - len * 0.75];
      blade(ctx, [cx, gy - 1], mid, tip, 3.2, t.base, t.line);
      // Leaflets.
      for (let i = 1; i < 5; i++) {
        const f = i / 5;
        const px = cx + (mid[0] - cx) * f * 1.6 * (1 - f) + (tip[0] - cx) * f * f;
        const py = gy - 1 + (mid[1] - gy) * f * 1.6 * (1 - f) + (tip[1] - gy) * f * f;
        line(ctx, [[px, py], [px - 2.5, py + 1.5]], t.light, 0.8);
      }
    }
    glow(ctx, { x: cx + 4, y: gy - 18 }, 8, 0x6ff0ff, 0.35);
    flat(ctx, ellipseP(ctx, cx + 4, gy - 18, 1.6, 1.6), '#c8fff8');
    void r;
  },
});

/** Scorching Desert / Anvil Mountains — dry scrub. */
export const DryShrubDrawer = defineDecor({
  key: 'decor_dry_shrub',
  w: 48,
  h: 36,
  ground: 31,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 3, gy, 18, 5, 0.38);
    const twig = tone(0x9a7048);
    for (let i = 0; i < 9; i++) {
      const a = -1.3 + (i / 8) * 2.6 + (r() - 0.5) * 0.2;
      const len = 14 + r() * 10;
      const tip: [number, number] = [cx + Math.sin(a) * len, gy - Math.cos(a) * len * 0.9];
      line(ctx, [[cx, gy], [(cx + tip[0]) / 2 + (r() - 0.5) * 4, (gy + tip[1]) / 2], tip], twig.line, 1.8);
      line(ctx, [[cx, gy], [(cx + tip[0]) / 2, (gy + tip[1]) / 2], tip], i % 2 ? twig.light : twig.base, 1.0);
    }
    tuft(ctx, cx, gy + 1, 9, 6, '#a88a44', '#d8bf6a', r);
  },
});

/** Ground cover: grass tufts (flat — drawn under characters). */
function grass(key: string, dark: string, light: string, tip?: string) {
  return defineDecor({
    key,
    w: 44,
    h: 28,
    ground: 24,
    flat: true,
    draw(ctx, { cx, gy, r }) {
      contactShadow(ctx, cx, gy, 12, 3, 0.22);
      tuft(ctx, cx - 6, gy, 17, 7, dark, light, r);
      tuft(ctx, cx + 8, gy + 1, 12, 5, dark, light, r);
      tuft(ctx, cx - 14, gy + 1, 8, 3, dark, light, r);
      if (tip) {
        for (const [x, y] of [[-9, -16], [8, -12]] as const) flat(ctx, ellipseP(ctx, cx + x, gy + y, 1.3, 1.3), tip);
      }
    },
  });
}

export const GrassDrawer = grass('decor_grass', '#3f7a33', '#8cc24f', '#f2e27a');
export const GrassForestDrawer = grass('decor_grass_forest', '#1f5a57', '#44a58f', '#9ff3ff');
export const GrassDryDrawer = grass('decor_grass_dry', '#8a7a40', '#cdb866');
export const GrassAshDrawer = grass('decor_grass_ash', '#3a2a3c', '#6a4a62', '#ff5a3a');
