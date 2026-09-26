// src/graphics/sprites/decorations/SkeletalRemains.ts
import { defineDecor, contactShadow, shade, tone, limbP, line, polyP } from './DecorKit';
import { bone, skull } from './Bones';

/** A fallen adventurer: skeleton slumped with a rusted shield and broken sword. */
export const SkeletalRemainsDrawer = defineDecor({
  key: 'decor_skeletal_remains',
  w: 72,
  h: 44,
  ground: 38,
  flat: true,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx, gy, 30, 6, 0.35);
    // Shield (behind).
    const shield = tone(0x7a5a3a);
    shade(ctx, () => ctx.ellipse(cx + 18, gy - 8, 10, 7, 0.2, 0, Math.PI * 2), shield, { band: 3, hi: 1 });
    shade(ctx, () => ctx.ellipse(cx + 18, gy - 8, 3, 2.2, 0.2, 0, Math.PI * 2), tone(0x8a8e98), { band: 1, hi: 0.6 });
    // Ribcage.
    const b = tone(0xe6dcc0);
    for (let i = 0; i < 4; i++) {
      line(ctx, [[cx - 6 + i * 4, gy - 4], [cx - 8 + i * 4, gy - 12], [cx - 3 + i * 4, gy - 15]], b.line, 2.2);
      line(ctx, [[cx - 6 + i * 4, gy - 4], [cx - 8 + i * 4, gy - 12], [cx - 3 + i * 4, gy - 15]], b.base, 1.2);
    }
    shade(ctx, limbP(ctx, [cx - 8, gy - 8], [cx + 2, gy - 10], [cx + 10, gy - 8], 1.2, 1.2), b, { band: 0.6, hi: 0 });
    bone(ctx, cx + 8, gy - 2, cx + 22, gy + 1, 2.2);
    bone(ctx, cx + 4, gy + 1, cx + 16, gy + 4, 2);
    bone(ctx, cx - 14, gy - 6, cx - 24, gy + 1, 1.8);
    skull(ctx, cx - 14, gy - 10, 1.1);
    // Broken sword.
    const steel = tone(0x9aa4ae, { light: 0.45 });
    shade(ctx, polyP(ctx, [[cx - 30, gy - 1], [cx - 14, gy + 3], [cx - 13, gy + 5], [cx - 29, gy + 1.5]]), steel, { band: 1, hi: 0.5 });
    shade(ctx, polyP(ctx, [[cx - 13, gy + 1], [cx - 11, gy + 1.5], [cx - 12.5, gy + 7.5], [cx - 14.5, gy + 7]]), tone(0x6a4a2e), { band: 0.6, hi: 0 });
  },
});
