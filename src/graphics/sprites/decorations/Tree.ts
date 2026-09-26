// src/graphics/sprites/decorations/Tree.ts
// Trees, scaled against a ~66 px tall player: 2–2.5× player height.
import {
  defineDecor, contactShadow, canopy, trunk, shade, tone, limbP, glow, flat, ellipseP,
  curve, blade, polyP, blobP, type Rand,
} from './DecorKit';

function branches(ctx: CanvasRenderingContext2D, bark: number, limbs: readonly [number, number, number, number, number, number, number][]): void {
  const t = tone(bark, { shadow: 0.45, light: 0.25 });
  for (const [ax, ay, cx, cy, bx, by, w] of limbs) {
    shade(ctx, limbP(ctx, [ax, ay], [cx, cy], [bx, by], w, w * 0.45), t, { band: w * 0.55, hi: 0, stroke: 0.7 });
  }
}

/** Emerald Plains — broad sunlit oak. */
export const TreeDrawer = defineDecor({
  key: 'decor_tree',
  w: 128,
  h: 170,
  ground: 164,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 10, gy, 46, 14, 0.42);
    trunk(ctx, cx, gy, gy - 74, 22, 12, 0x80573a, r, 2);
    branches(ctx, 0x80573a, [
      [cx - 1, gy - 62, cx - 12, gy - 78, cx - 26, gy - 92, 4],
      [cx + 3, gy - 66, cx + 14, gy - 80, cx + 28, gy - 96, 4],
    ]);
    canopy(ctx, [
      [cx - 32, gy - 100, 26, 21],
      [cx + 30, gy - 104, 27, 22],
      [cx + 2, gy - 136, 32, 25],
      [cx - 22, gy - 118, 29, 24],
      [cx + 20, gy - 122, 29, 24],
      [cx - 4, gy - 97, 30, 19],
      [cx + 2, gy - 143, 22, 17],
    ], { leaf: 0x62a23c, back: 0x3c7040, accent: '#d6ec86' }, r, 3);
  },
});

/** Emerald Plains — smaller round fruit tree. */
export const TreeRoundDrawer = defineDecor({
  key: 'decor_tree_round',
  w: 100,
  h: 136,
  ground: 130,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 8, gy, 34, 11, 0.4);
    trunk(ctx, cx, gy, gy - 64, 17, 9, 0x8a6040, r, -1);
    canopy(ctx, [
      [cx - 20, gy - 82, 22, 19],
      [cx + 20, gy - 86, 22, 19],
      [cx, gy - 105, 26, 20],
      [cx - 12, gy - 92, 24, 21],
      [cx + 12, gy - 96, 24, 21],
      [cx, gy - 112, 17, 13],
    ], { leaf: 0x7fb13f, back: 0x4d8343, accent: '#eef29a' }, r, 3);
    // Focal accent: a few ripe fruit.
    const fruit = tone(0xd8502e, { light: 0.45 });
    for (const [fx, fy] of [[-18, -84], [8, -80], [20, -98], [-6, -104], [-24, -98]] as const) {
      shade(ctx, ellipseP(ctx, cx + fx, gy + fy, 2.6, 2.6), fruit, { band: 1.2, hi: 0.8, stroke: 0.5 });
    }
  },
});

/** Twilight Forest — gnarled violet-teal tree with glowing seed pods. */
export const ForestTreeDrawer = defineDecor({
  key: 'decor_tree_forest',
  w: 132,
  h: 180,
  ground: 174,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 10, gy, 48, 15, 0.5);
    const bark = 0x4c3a58;
    // Exposed roots.
    const rootT = tone(bark, { shadow: 0.45, light: 0.2 });
    for (const [bx, by, w] of [[-26, 3, 4], [24, 2, 4], [-12, 5, 3]] as const) {
      shade(ctx, limbP(ctx, [cx + bx * 0.25, gy - 6], [cx + bx * 0.7, gy - 3], [cx + bx, gy + by], w, 1), rootT, { band: 2, hi: 0, stroke: 0.6 });
    }
    trunk(ctx, cx, gy, gy - 84, 24, 12, bark, r, -5);
    branches(ctx, bark, [
      [cx - 6, gy - 72, cx - 20, gy - 82, cx - 34, gy - 96, 4.5],
      [cx - 3, gy - 78, cx + 14, gy - 86, cx + 32, gy - 102, 4.5],
    ]);
    const pal = { leaf: 0x2f7f7e, back: 0x40386e, accent: '#8ff3e2' };
    canopy(ctx, [
      [cx - 36, gy - 106, 28, 21],
      [cx + 34, gy - 110, 28, 22],
      [cx - 2, gy - 146, 32, 24],
      [cx - 24, gy - 124, 30, 24],
      [cx + 20, gy - 128, 30, 24],
      [cx - 4, gy - 104, 30, 19],
    ], pal, r, 3);
    // Hanging moss strands.
    const moss = tone(0x3f8c78);
    for (const [mx, my, len] of [[-44, -100, 26], [-18, -92, 20], [30, -96, 24], [44, -104, 16], [6, -90, 14]] as const) {
      const x0 = cx + mx, y0 = gy + my;
      blade(ctx, [x0, y0], [x0 + 2, y0 + len * 0.5], [x0 - 1, y0 + len], 1.3, moss.base, moss.line);
    }
    // Bioluminescent pods (focal accent).
    for (const [px, py] of [[-18, -88], [30, -92], [-40, -96], [8, -118]] as const) {
      const x = cx + px, y = gy + py;
      glow(ctx, { x, y }, 9, 0x6ff0ff, 0.55);
      flat(ctx, ellipseP(ctx, x, y, 2.6, 3.2), '#b9fff6', '#3aa6b8', 0.5);
      flat(ctx, ellipseP(ctx, x - 0.8, y - 1, 0.9, 1.1), '#ffffff');
    }
  },
});

/** Twilight Forest — tall slender tree with drooping violet fronds. */
export const ForestTreeTallDrawer = defineDecor({
  key: 'decor_tree_forest_tall',
  w: 96,
  h: 176,
  ground: 170,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 8, gy, 32, 11, 0.48);
    trunk(ctx, cx, gy, gy - 120, 16, 8, 0x3d3450, r, 3);
    canopy(ctx, [
      [cx - 14, gy - 112, 20, 18],
      [cx + 16, gy - 120, 20, 18],
      [cx - 6, gy - 140, 22, 20],
      [cx + 8, gy - 132, 22, 20],
      [cx - 12, gy - 116, 18, 15],
      [cx + 1, gy - 156, 15, 12],
    ], { leaf: 0x5b4f9a, back: 0x2c3f64, accent: '#c7b6ff' }, r, 3);
    const frond = tone(0x6c5bb0);
    for (const [fx, fy, len] of [[-28, -108, 22], [-12, -100, 18], [22, -108, 24], [32, -118, 16]] as const) {
      const x0 = cx + fx, y0 = gy + fy;
      blade(ctx, [x0, y0], [x0 + (fx < 0 ? -3 : 3), y0 + len * 0.5], [x0 + (fx < 0 ? -1 : 1), y0 + len], 1.6, frond.base, frond.line);
    }
    for (const [px, py] of [[-8, -104], [14, -112]] as const) {
      glow(ctx, { x: cx + px, y: gy + py }, 7, 0xb58cff, 0.5);
      flat(ctx, ellipseP(ctx, cx + px, gy + py, 1.8, 1.8), '#f0e2ff');
    }
  },
});

function pineTier(ctx: CanvasRenderingContext2D, cx: number, top: number, bottom: number, half: number, col: number, snow: number | null, r: Rand): void {
  const t = tone(col, { shadow: 0.3, light: 0.3 });
  const teeth = 6;
  const edge: [number, number][] = [];
  for (let i = 0; i <= teeth; i++) {
    const f = i / teeth;
    const x = cx + half - f * half * 2;
    const y = bottom - (i % 2 === 0 ? 0 : 6 + r() * 2) - (1 - Math.abs(f - 0.5) * 2) * 3;
    edge.push([x, y]);
  }
  const pts: [number, number][] = [[cx, top], ...edge];
  shade(ctx, polyP(ctx, pts), t, { band: half * 0.38, hi: 1.6, stroke: 0.75 });
  // Needle strokes on the lit side.
  for (let i = 0; i < 3; i++) {
    const y = top + (bottom - top) * (0.45 + i * 0.16);
    const x = cx - half * (0.2 + i * 0.16);
    curve(ctx, [x, y], [x - 3, y + 2], [x - 6, y + 1], t.light, 0.9);
  }
  if (snow !== null) {
    const sn = tone(0xeaf2fc, { shadow: 0.22, light: 0.15 });
    // Snow drifts on the exposed shoulder just below the tier above (or the tip).
    const sy = snow;
    const w = Math.max(4, (half * (sy - top)) / (bottom - top));
    const pts: [number, number][] = [
      [cx - w * 1.05, sy + 2],
      [cx - w * 0.5, sy - 4],
      [cx + w * 0.3, sy - 4],
      [cx + w * 0.85, sy + 1],
      [cx + w * 0.45, sy + 5],
      [cx + w * 0.1, sy + 3],
      [cx - w * 0.3, sy + 6],
      [cx - w * 0.7, sy + 4],
    ];
    shade(ctx, blobP(ctx, pts), sn, { band: 1.4, hi: 0, stroke: 0.5 });
  }
}

/** Anvil Mountains — snow-dusted pine. */
export const PineDrawer = defineDecor({
  key: 'decor_pine',
  w: 88,
  h: 176,
  ground: 170,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 8, gy, 30, 10, 0.45);
    trunk(ctx, cx, gy, gy - 40, 13, 8, 0x6a4a3a, r);
    const col = 0x2f6a5c;
    const tiers: [number, number, number][] = [
      [gy - 104, gy - 30, 38],
      [gy - 126, gy - 62, 31],
      [gy - 146, gy - 92, 24],
      [gy - 164, gy - 118, 16],
    ];
    tiers.forEach(([top, bottom, half], i) => {
      const above = tiers[i + 1];
      const snowY = above ? above[1] - 2 : top + (bottom - top) * 0.28;
      pineTier(ctx, cx, top, bottom, half, i === 0 ? 0x2a5f55 : col, snowY, r);
    });
  },
});

/** Abyss Rift — charred tree variant used by map scatter (story key kept in CharredTree.ts). */
export const DeadTreeDrawer = defineDecor({
  key: 'decor_dead_tree',
  w: 96,
  h: 150,
  ground: 144,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 8, gy, 30, 10, 0.45);
    const bark = 0xc2ad8c;
    trunk(ctx, cx, gy, gy - 80, 17, 7, bark, r, 4);
    branches(ctx, bark, [
      [cx + 2, gy - 60, cx - 14, gy - 76, cx - 30, gy - 108, 3.4],
      [cx + 4, gy - 76, cx + 18, gy - 92, cx + 26, gy - 122, 3],
      [cx - 18, gy - 90, cx - 22, gy - 102, cx - 36, gy - 110, 1.6],
      [cx + 4, gy - 78, cx + 2, gy - 110, cx + 6, gy - 136, 2.6],
    ]);
    curve(ctx, [cx + 20, gy - 102], [cx + 30, gy - 104], [cx + 36, gy - 98], tone(bark).line, 1.2);
  },
});
