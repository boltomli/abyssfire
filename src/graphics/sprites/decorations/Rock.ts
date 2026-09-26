// src/graphics/sprites/decorations/Rock.ts
import { defineDecor, contactShadow, shade, tone, polyP, line, tuft, type Rand } from './DecorKit';

/**
 * Faceted cartoon rock: silhouette cel-shaded, a lit top plane on the
 * upper-left and one or two crack strokes.
 */
export function drawRock(ctx: CanvasRenderingContext2D, x: number, gy: number, w: number, h: number, col: number, r: Rand, cracks = 1): void {
  const t = tone(col, { shadow: 0.42, light: 0.35 });
  const pts: [number, number][] = [
    [x - w * 0.5, gy],
    [x - w * 0.48, gy - h * (0.45 + r() * 0.15)],
    [x - w * (0.28 + r() * 0.08), gy - h * (0.88 + r() * 0.12)],
    [x + w * (0.02 + r() * 0.1), gy - h],
    [x + w * (0.34 + r() * 0.06), gy - h * (0.78 + r() * 0.12)],
    [x + w * 0.5, gy - h * (0.3 + r() * 0.15)],
    [x + w * 0.44, gy + h * 0.04],
    [x, gy + h * 0.08],
  ];
  shade(ctx, polyP(ctx, pts), t, { band: Math.max(2, w * 0.2), hi: 1.2, stroke: 0.75 });
  // Lit top plane.
  const top: [number, number][] = [
    pts[1], pts[2], pts[3], pts[4],
    [x + w * 0.12, gy - h * 0.55],
    [x - w * 0.22, gy - h * 0.5],
  ];
  ctx.save();
  ctx.beginPath();
  polyP(ctx, pts)();
  ctx.clip();
  ctx.beginPath();
  polyP(ctx, top)();
  ctx.fillStyle = t.light;
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.restore();
  line(ctx, [[top[4][0], top[4][1]], [top[5][0], top[5][1]]], t.shade, 0.6);
  for (let i = 0; i < cracks; i++) {
    const cx0 = x + (r() - 0.3) * w * 0.4;
    const cy0 = gy - h * (0.4 + r() * 0.2);
    line(ctx, [[cx0, cy0], [cx0 + 2, cy0 + h * 0.15], [cx0 + 0.5, cy0 + h * 0.3]], t.line, 0.6);
  }
}

function rockCluster(key: string, col: number, grass: [string, string] | null) {
  return defineDecor({
    key,
    w: 44,
    h: 32,
    ground: 27,
    draw(ctx, { cx, gy, r }) {
      contactShadow(ctx, cx + 3, gy, 19, 6, 0.4);
      drawRock(ctx, cx - 3, gy, 24, 17, col, r);
      drawRock(ctx, cx + 11, gy + 1, 13, 9, col, r, 0);
      drawRock(ctx, cx - 15, gy + 2, 8, 5, col, r, 0);
      if (grass) tuft(ctx, cx + 3, gy + 2, 6, 4, grass[0], grass[1], r);
    },
  });
}

export const RockDrawer = rockCluster('decor_rock', 0x8a8e98, ['#4f8a3a', '#8cc24f']);
export const RockMossDrawer = rockCluster('decor_rock_moss', 0x6a7a86, ['#2f7a6e', '#5fc0a8']);
export const RockSandDrawer = rockCluster('decor_rock_sand', 0xc9a06a, null);
export const RockSlateDrawer = rockCluster('decor_rock_slate', 0x6f7f96, null);
export const RockBasaltDrawer = rockCluster('decor_rock_basalt', 0x3e3446, null);
