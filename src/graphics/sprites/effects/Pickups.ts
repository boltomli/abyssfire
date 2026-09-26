// src/graphics/sprites/effects/Pickups.ts
//
// Small world pickups and markers: health / mana potion drops and the crown
// that floats over elite monsters. Displayed with origin (0.5, anchorY).
import { defineDecor, contactShadow, shade, tone, polyP, line, glow, flat, ellipseP, type DecorDrawer } from '../decorations/DecorKit';

function makePotionDrawer(key: string, liquid: number, glowCol: number): DecorDrawer {
  return defineDecor({
    key,
    w: 22,
    h: 28,
    ground: 25,
    draw(ctx, { cx, gy }) {
      contactShadow(ctx, cx + 1, gy, 7, 2.2, 0.45);
      glow(ctx, { x: cx, y: gy - 7 }, 10, glowCol, 0.45);
      const glass = tone(0xdfe8f4, { light: 0.5, shadow: 0.3 });
      const liq = tone(liquid, { light: 0.45, shadow: 0.4 });
      const bulb = ellipseP(ctx, cx, gy - 6.5, 6.6, 6.4);
      // Glass bulb.
      shade(ctx, bulb, glass, { band: 1.2, hi: 0.6, stroke: 0 });
      // Liquid (lower two thirds of the bulb).
      ctx.save();
      ctx.beginPath();
      bulb();
      ctx.clip();
      shade(ctx, () => ctx.rect(cx - 8, gy - 8.5, 16, 10), liq, { band: 2, hi: 0, stroke: 0 });
      line(ctx, [[cx - 6.4, gy - 8.5], [cx + 6.4, gy - 8.5]], liq.light, 0.9);
      ctx.restore();
      ctx.beginPath();
      bulb();
      ctx.strokeStyle = liq.line;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      // Neck + lip.
      shade(ctx, polyP(ctx, [[cx - 2.2, gy - 12.2], [cx - 2.2, gy - 16.5], [cx + 2.2, gy - 16.5], [cx + 2.2, gy - 12.2]]), glass, { band: 0.8, hi: 0.4, stroke: 0.8, line: liq.line });
      shade(ctx, ellipseP(ctx, cx, gy - 16.8, 3.2, 1.2), glass, { band: 0.5, hi: 0, stroke: 0.7, line: liq.line });
      // Cork.
      shade(ctx, polyP(ctx, [[cx - 1.9, gy - 17], [cx - 1.6, gy - 20.5], [cx + 1.6, gy - 20.5], [cx + 1.9, gy - 17]]), tone(0xb07a44, { light: 0.3 }), { band: 0.8, hi: 0.3, stroke: 0.6 });
      // Specular glint on the glass (focal).
      flat(ctx, () => ctx.ellipse(cx - 3, gy - 9, 1.1, 2.3, 0.5, 0, Math.PI * 2), 'rgba(255,255,255,0.9)');
      flat(ctx, ellipseP(ctx, cx + 3.4, gy - 3.4, 0.7, 0.7), 'rgba(255,255,255,0.6)');
    },
  });
}

export const PotionHpDrawer = makePotionDrawer('potion_drop_hp', 0xe0283a, 0xff4a4a);
export const PotionMpDrawer = makePotionDrawer('potion_drop_mp', 0x2a5ae8, 0x4a8aff);

/** Small gold crown floating above elite monsters. */
export const EliteCrownDrawer = defineDecor({
  key: 'elite_crown',
  w: 20,
  h: 16,
  ground: 13,
  draw(ctx, { cx, gy }) {
    glow(ctx, { x: cx, y: gy - 5 }, 9, 0xffd040, 0.4);
    const gold = tone(0xf2b72e, { light: 0.5, shadow: 0.35 });
    shade(ctx, polyP(ctx, [
      [cx - 7, gy], [cx - 8, gy - 8], [cx - 4, gy - 4.5], [cx, gy - 10], [cx + 4, gy - 4.5], [cx + 8, gy - 8], [cx + 7, gy],
    ]), gold, { band: 1.6, hi: 0.7, stroke: 0.9 });
    line(ctx, [[cx - 6.6, gy - 2], [cx + 6.6, gy - 2]], gold.shade, 0.7);
    for (const [x, y] of [[cx - 8, gy - 8], [cx, gy - 10], [cx + 8, gy - 8]] as const) {
      flat(ctx, ellipseP(ctx, x, y, 1.1, 1.1), gold.light, gold.line, 0.5);
    }
    flat(ctx, polyP(ctx, [[cx - 1.5, gy - 4], [cx, gy - 6], [cx + 1.5, gy - 4], [cx, gy - 2.4]]), '#ff3a4a', '#7a1020', 0.5);
  },
});

export const PICKUP_DRAWERS: readonly DecorDrawer[] = [PotionHpDrawer, PotionMpDrawer, EliteCrownDrawer];
