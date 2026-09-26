// src/graphics/sprites/decorations/CampProps.ts
// Camp furniture (tents, campfire, torches, well, barrels, crates, banners)
// plus the animated flame sheet used by campfires and torches.
import {
  defineDecor, contactShadow, shade, tone, polyP, line, glow, flat, ellipseP, limbP, curve,
  type DecorDrawer,
} from './DecorKit';
import { drawRock } from './Rock';

function hex(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

function mixHex(a: number, b: number, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
}

function flameShape(ctx: CanvasRenderingContext2D, x: number, by: number, w: number, h: number, sway: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, by - h * 0.18);
  ctx.bezierCurveTo(x - w / 2, by - h * 0.55, x + sway * 0.4 - w * 0.25, by - h * 0.7, x + sway, by - h);
  ctx.bezierCurveTo(x + sway * 0.4 + w * 0.3, by - h * 0.62, x + w / 2, by - h * 0.5, x + w / 2, by - h * 0.18);
  ctx.bezierCurveTo(x + w / 2, by + h * 0.04, x - w / 2, by + h * 0.04, x - w / 2, by - h * 0.18);
  ctx.closePath();
}

/**
 * Layered cartoon flame (outer → core). `phase` in radians animates sway,
 * height and the licking side tongues; `col` tints the outer layer.
 */
export function drawFlame(ctx: CanvasRenderingContext2D, x: number, by: number, w: number, h: number, phase: number, col = 0xff7a1a): void {
  const s1 = Math.sin(phase);
  const s2 = Math.sin(phase * 2 + 1.3);
  const hk = 1 + 0.08 * s2;
  glow(ctx, { x, y: by - h * 0.4 }, w * 1.5, col, 0.45);
  const outer = mixHex(col, 0xb01810, 0.25);
  const mid = mixHex(col, 0xffb030, 0.55);
  const inner = mixHex(col, 0xfff0a0, 0.85);
  // Side tongues.
  ctx.fillStyle = outer;
  flameShape(ctx, x - w * 0.28, by - h * 0.05, w * 0.42, h * (0.55 + 0.12 * s2), -w * 0.2 + s1 * w * 0.1);
  ctx.fill();
  flameShape(ctx, x + w * 0.28, by - h * 0.05, w * 0.4, h * (0.5 - 0.12 * s2), w * 0.2 + s1 * w * 0.1);
  ctx.fill();
  flameShape(ctx, x, by, w, h * hk, s1 * w * 0.22);
  ctx.fill();
  ctx.strokeStyle = mixHex(col, 0x400808, 0.5);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.fillStyle = mid;
  flameShape(ctx, x + w * 0.04, by, w * 0.68, h * 0.74 * hk, s1 * w * 0.18 + s2 * w * 0.05);
  ctx.fill();
  ctx.fillStyle = inner;
  flameShape(ctx, x + w * 0.06, by, w * 0.36, h * 0.44 * (1 + 0.1 * s1), s1 * w * 0.1);
  ctx.fill();
}

export const FLAME_FRAMES = 6;

/** Animated flame sheet (6 frames). Displayed at the flame's base (anchorY). */
export function makeFlameDrawer(key: string, col: number): DecorDrawer {
  return defineDecor({
    key,
    w: 36,
    h: 52,
    ground: 46,
    frames: FLAME_FRAMES,
    draw(ctx, { cx, gy }, frame) {
      const phase = (frame / FLAME_FRAMES) * Math.PI * 2;
      drawFlame(ctx, cx, gy, 17, 34, phase, col);
      // A couple of embers rising.
      for (let i = 0; i < 2; i++) {
        const t = ((frame / FLAME_FRAMES) + i * 0.5) % 1;
        const ex = cx + (i ? 5 : -4) + Math.sin(phase + i) * 2;
        const ey = gy - 20 - t * 22;
        flat(ctx, ellipseP(ctx, ex, ey, 0.9 * (1 - t) + 0.3, 0.9 * (1 - t) + 0.3), mixHex(col, 0xfff0a0, 0.7));
      }
    },
  });
}

export const CampfireDrawer = defineDecor({
  key: 'camp_campfire',
  w: 60,
  h: 36,
  ground: 28,
  flat: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 2, gy, 27, 8, 0.45);
    // Warm scorched ground + ember bed.
    ctx.save();
    ctx.translate(cx, gy - 3);
    ctx.scale(1, 0.4);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    g.addColorStop(0, 'rgba(255,150,60,0.7)');
    g.addColorStop(0.5, 'rgba(120,40,20,0.6)');
    g.addColorStop(1, 'rgba(40,20,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const stoneCol = 0x7a7e88;
    const ring = (from: number, to: number) => {
      for (let i = from; i <= to; i++) {
        const a = (i / 10) * Math.PI * 2;
        drawRock(ctx, cx + Math.cos(a) * 20, gy - 3 + Math.sin(a) * 7 + 3, 8, 5, stoneCol, r, 0);
      }
    };
    ring(5, 10); // back half
    const log = tone(0x7a4a2a, { light: 0.3 });
    shade(ctx, limbP(ctx, [cx - 15, gy - 1], [cx, gy - 5], [cx + 12, gy - 9], 3, 2.6), log, { band: 1.6, hi: 0.6 });
    shade(ctx, limbP(ctx, [cx + 15, gy], [cx, gy - 4], [cx - 12, gy - 9], 3, 2.6), log, { band: 1.6, hi: 0.6 });
    for (const [x, y] of [[-12, -9], [12, -9]] as const) flat(ctx, ellipseP(ctx, cx + x, gy + y, 1.8, 2.4), '#e8b070', log.line, 0.5);
    for (let i = 0; i < 6; i++) flat(ctx, ellipseP(ctx, cx + (r() - 0.5) * 18, gy - 3 + (r() - 0.5) * 4, 1.3, 0.8), i % 2 ? '#ffd080' : '#ff7a2a');
    ring(0, 4); // front half
  },
});

export const TorchDrawer = defineDecor({
  key: 'camp_torch',
  w: 24,
  h: 76,
  ground: 72,
  tall: true,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 2, gy, 7, 2.5, 0.45);
    const wood = tone(0x6e4a30, { light: 0.3 });
    shade(ctx, limbP(ctx, [cx, gy + 1], [cx, gy - 30], [cx, gy - 56], 2.4, 1.8), wood, { band: 1.5, hi: 0.5 });
    for (const y of [gy - 20, gy - 40]) line(ctx, [[cx - 2.2, y], [cx + 2.2, y + 1]], '#c8a870', 0.8);
    // Iron cresset.
    const iron = tone(0x5a5a68, { light: 0.4 });
    shade(ctx, polyP(ctx, [[cx - 6, gy - 62], [cx + 6, gy - 62], [cx + 3.5, gy - 55], [cx - 3.5, gy - 55]]), iron, { band: 1.5, hi: 0.6 });
    shade(ctx, ellipseP(ctx, cx, gy - 62, 6, 1.6), tone(0x3a2a24), { band: 0.6, hi: 0, stroke: 0.5 });
    flat(ctx, ellipseP(ctx, cx, gy - 62.3, 4, 1), '#ff9a3a');
  },
});

export function makeTentDrawer(key: string, color: string): DecorDrawer {
  const col = parseInt(color.replace('#', ''), 16);
  return defineDecor({
    key,
    w: 104,
    h: 90,
    ground: 82,
    tall: true,
    draw(ctx, { cx, gy }) {
      contactShadow(ctx, cx + 6, gy, 46, 11, 0.42);
      const canvas = tone(col, { light: 0.35, shadow: 0.4 });
      const side = tone(col, { light: 0.2, shadow: 0.5 });
      const apex: [number, number] = [cx - 2, gy - 66];
      const ridgeBack: [number, number] = [cx + 22, gy - 76];
      // Side roof (receding to the upper right).
      shade(ctx, polyP(ctx, [apex, ridgeBack, [cx + 50, gy - 12], [cx + 32, gy]]), side, { band: 8, hi: 0, stroke: 0.8 });
      // Front gable.
      shade(ctx, polyP(ctx, [apex, [cx + 32, gy], [cx - 38, gy]]), canvas, { band: 6, hi: 1.6, stroke: 0.8 });
      // Door flaps.
      const dark = tone(0x2a1a22);
      flat(ctx, polyP(ctx, [[cx - 3, gy - 44], [cx + 10, gy], [cx - 15, gy]]), dark.base);
      shade(ctx, polyP(ctx, [[cx - 3, gy - 44], [cx - 9, gy], [cx - 17, gy], [cx - 5, gy - 30]]), canvas, { band: 2, hi: 0.8, stroke: 0.6 });
      shade(ctx, polyP(ctx, [[cx - 3, gy - 44], [cx + 3, gy - 26], [cx + 12, gy], [cx + 5, gy]]), canvas, { band: 2, hi: 0, stroke: 0.6 });
      // Seams + trim stripe.
      line(ctx, [[cx - 2, gy - 66], [cx - 22, gy]], canvas.shade, 0.6);
      line(ctx, [[cx - 2, gy - 66], [cx + 18, gy]], canvas.shade, 0.6);
      line(ctx, [[cx - 34, gy - 8], [cx + 29, gy - 8]], canvas.light, 1.2);
      line(ctx, [[cx + 32, gy - 8], [cx + 47, gy - 18]], side.light, 1);
      // Pole + pennant.
      const wood = tone(0x7a5238);
      shade(ctx, limbP(ctx, [apex[0], apex[1] + 2], [apex[0], apex[1] - 6], [apex[0], apex[1] - 12], 1.2, 1), wood, { band: 0.8, hi: 0 });
      flat(ctx, polyP(ctx, [[apex[0], apex[1] - 12], [apex[0] + 9, apex[1] - 9.5], [apex[0], apex[1] - 7]]), '#d8b04a', '#6a4a1a', 0.5);
      // Guy ropes + pegs.
      curve(ctx, [cx - 30, gy - 16], [cx - 40, gy - 6], [cx - 46, gy + 3], '#c8b088', 0.6);
      curve(ctx, [cx + 44, gy - 20], [cx + 50, gy - 6], [cx + 52, gy + 1], '#c8b088', 0.6);
      flat(ctx, ellipseP(ctx, cx - 46, gy + 3, 1.3, 0.8), '#5a3a22');
      flat(ctx, ellipseP(ctx, cx + 52, gy + 1, 1.3, 0.8), '#5a3a22');
    },
  });
}

export function makeBannerDrawer(key: string, color: string, dark: string): DecorDrawer {
  const col = parseInt(color.replace('#', ''), 16);
  const trim = parseInt(dark.replace('#', ''), 16);
  return defineDecor({
    key,
    w: 40,
    h: 104,
    ground: 100,
    tall: true,
    draw(ctx, { cx, gy }) {
      contactShadow(ctx, cx + 2, gy, 9, 3, 0.42);
      const wood = tone(0x6e4a30, { light: 0.3 });
      const px = cx - 8;
      shade(ctx, limbP(ctx, [px, gy + 1], [px, gy - 45], [px, gy - 92], 2, 1.6), wood, { band: 1.2, hi: 0.5 });
      shade(ctx, limbP(ctx, [px - 2, gy - 86], [px + 8, gy - 86], [px + 20, gy - 86], 1.3, 1.3), wood, { band: 0.8, hi: 0 });
      const gold = tone(0xd8b04a, { light: 0.45 });
      shade(ctx, polyP(ctx, [[px, gy - 99], [px + 2.4, gy - 93], [px, gy - 91], [px - 2.4, gy - 93]]), gold, { band: 1, hi: 0.4, stroke: 0.5 });
      const cloth = tone(col, { light: 0.35 });
      shade(ctx, () => {
        ctx.moveTo(px + 1, gy - 85);
        ctx.lineTo(px + 20, gy - 85);
        ctx.quadraticCurveTo(px + 22, gy - 60, px + 20, gy - 40);
        ctx.lineTo(px + 10.5, gy - 47);
        ctx.lineTo(px + 1, gy - 40);
        ctx.quadraticCurveTo(px + 3, gy - 62, px + 1, gy - 85);
        ctx.closePath();
      }, cloth, { band: 3.5, hi: 1.2 });
      const tr = tone(trim, { light: 0.3 });
      line(ctx, [[px + 2, gy - 81], [px + 20, gy - 81]], tr.base, 1.6);
      // Emblem: gold sun disc.
      shade(ctx, ellipseP(ctx, px + 10.5, gy - 64, 4.5, 4.5), gold, { band: 1.4, hi: 0.6, stroke: 0.5 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        line(ctx, [[px + 10.5 + Math.cos(a) * 5.6, gy - 64 + Math.sin(a) * 5.6], [px + 10.5 + Math.cos(a) * 7.4, gy - 64 + Math.sin(a) * 7.4]], gold.base, 0.9);
      }
    },
  });
}

export const BarrelDrawer = defineDecor({
  key: 'camp_barrel',
  w: 32,
  h: 42,
  ground: 38,
  tall: true,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 2, gy, 13, 4, 0.45);
    const wood = tone(0x9a6a3e, { light: 0.35 });
    const body = () => {
      ctx.moveTo(cx - 10, gy - 2);
      ctx.quadraticCurveTo(cx - 13.5, gy - 16, cx - 10, gy - 30);
      ctx.lineTo(cx + 10, gy - 30);
      ctx.quadraticCurveTo(cx + 13.5, gy - 16, cx + 10, gy - 2);
      ctx.quadraticCurveTo(cx, gy + 1.5, cx - 10, gy - 2);
      ctx.closePath();
    };
    shade(ctx, body, wood, { band: 5, hi: 1.4 });
    for (const f of [-5, 0, 5]) curve(ctx, [cx + f * 1.05, gy - 29], [cx + f * 1.35, gy - 16], [cx + f * 1.05, gy - 1], wood.shade, 0.6);
    const iron = tone(0x5a5e6a, { light: 0.45 });
    for (const y of [gy - 8, gy - 24]) {
      ctx.beginPath();
      ctx.ellipse(cx, y, 12.6, 2.6, 0, 0, Math.PI);
      ctx.strokeStyle = iron.line;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.strokeStyle = iron.light;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    shade(ctx, ellipseP(ctx, cx, gy - 30, 10, 3), tone(0xb88a5a, { light: 0.35 }), { band: 1, hi: 0.6, stroke: 0.6 });
    line(ctx, [[cx - 6, gy - 30], [cx + 6, gy - 30]], wood.shade, 0.5);
  },
});

export const CrateDrawer = defineDecor({
  key: 'camp_crate',
  w: 40,
  h: 38,
  ground: 33,
  tall: true,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 3, gy, 16, 5, 0.45);
    const wood = tone(0xb08450, { light: 0.35 });
    const x0 = cx - 12, x1 = cx + 8, d = 7, h = 20;
    flat(ctx, polyP(ctx, [[x1, gy], [x1, gy - h], [x1 + d, gy - h - 4], [x1 + d, gy - 4]]), wood.shade, wood.line, 0.6);
    flat(ctx, polyP(ctx, [[x0, gy - h], [x0 + d, gy - h - 4], [x1 + d, gy - h - 4], [x1, gy - h]]), wood.light, wood.line, 0.6);
    shade(ctx, polyP(ctx, [[x0, gy], [x0, gy - h], [x1, gy - h], [x1, gy]]), wood, { band: 2, hi: 0.8 });
    // Frame + diagonal brace.
    const frame = tone(0x7a5230);
    for (const p of [[[x0 + 1.5, gy - 1.5], [x1 - 1.5, gy - 1.5]], [[x0 + 1.5, gy - h + 1.5], [x1 - 1.5, gy - h + 1.5]], [[x0 + 1.5, gy - 1.5], [x0 + 1.5, gy - h + 1.5]], [[x1 - 1.5, gy - 1.5], [x1 - 1.5, gy - h + 1.5]], [[x0 + 2, gy - 2], [x1 - 2, gy - h + 2]]] as const) {
      line(ctx, p as unknown as [number, number][], frame.line, 2.4);
      line(ctx, p as unknown as [number, number][], frame.base, 1.3);
    }
    line(ctx, [[x0 + d * 0.5 + 2, gy - h - 2], [x1 + d * 0.5 - 2, gy - h - 2]], wood.shade, 0.6);
  },
});

export const WellDrawer = defineDecor({
  key: 'camp_well',
  w: 68,
  h: 86,
  ground: 78,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 4, gy, 29, 9, 0.45);
    const wood = tone(0x7a5238, { light: 0.3 });
    // Back post.
    shade(ctx, limbP(ctx, [cx + 16, gy - 12], [cx + 16, gy - 40], [cx + 16, gy - 60], 2, 2), wood, { band: 1.2, hi: 0.5 });
    // Stone ring: body (cylinder) + rim.
    const stone = tone(0x8a8e98, { light: 0.35 });
    shade(ctx, () => {
      ctx.moveTo(cx - 20, gy - 20);
      ctx.lineTo(cx - 20, gy - 4);
      ctx.ellipse(cx, gy - 4, 20, 7, 0, Math.PI, 0, true);
      ctx.lineTo(cx + 20, gy - 20);
      ctx.closePath();
    }, stone, { band: 5, hi: 1.2 });
    for (let row = 0; row < 2; row++) {
      const y = gy - 12 - row * 8 + 4;
      ctx.beginPath();
      ctx.ellipse(cx, y, 20, 7, 0, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = stone.shade;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = 0.35 + i * 0.7 + (row ? 0.35 : 0);
        const x = cx + Math.cos(a) * 20;
        const yy = y + Math.sin(a) * 7;
        line(ctx, [[x, yy], [x, yy - 8]], stone.shade, 0.6);
      }
    }
    shade(ctx, ellipseP(ctx, cx, gy - 20, 20, 7), tone(0x9a9ea8, { light: 0.4 }), { band: 1.2, hi: 0.8 });
    flat(ctx, ellipseP(ctx, cx, gy - 20, 15, 4.8), '#1a1a28');
    flat(ctx, ellipseP(ctx, cx + 1, gy - 19, 9, 2.4), 'rgba(80,150,200,0.55)');
    // Front post + roof.
    shade(ctx, limbP(ctx, [cx - 17, gy - 14], [cx - 17, gy - 40], [cx - 17, gy - 60], 2.2, 2.2), wood, { band: 1.2, hi: 0.5 });
    shade(ctx, limbP(ctx, [cx - 19, gy - 52], [cx, gy - 52], [cx + 18, gy - 52], 1.6, 1.6), wood, { band: 1, hi: 0.4 });
    const roof = tone(0x9a4a32, { light: 0.35 });
    shade(ctx, polyP(ctx, [[cx - 28, gy - 54], [cx - 6, gy - 74], [cx + 8, gy - 74], [cx + 28, gy - 54], [cx + 22, gy - 52], [cx - 22, gy - 52]]), roof, { band: 4, hi: 1.2 });
    for (let i = 1; i < 5; i++) line(ctx, [[cx - 28 + i * 11, gy - 53], [cx - 6 + i * 3.4, gy - 73]], roof.shade, 0.6);
    // Rope + bucket.
    line(ctx, [[cx - 2, gy - 52], [cx - 2, gy - 34]], '#c8b088', 0.8);
    const bucket = tone(0x8a6a44);
    shade(ctx, polyP(ctx, [[cx - 6, gy - 34], [cx + 2, gy - 34], [cx + 1, gy - 27], [cx - 5, gy - 27]]), bucket, { band: 1.5, hi: 0.5, stroke: 0.6 });
    drawRock(ctx, cx + 24, gy + 3, 8, 5, 0x8a8e98, r, 0);
  },
});

export const STATIC_CAMP_DRAWERS: readonly DecorDrawer[] = [CampfireDrawer, TorchDrawer, BarrelDrawer, CrateDrawer, WellDrawer];
