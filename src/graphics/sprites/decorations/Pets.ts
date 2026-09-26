import type { EntityDrawer } from '../types';
import { defineDecor, contactShadow, shade, tone, polyP, ellipseP, flat, glow, line, limbP, blobP } from './DecorKit';
import { drawFlame } from './CampProps';

type PetKind = 'sprite' | 'dragon' | 'owl' | 'cat' | 'phoenix' | 'storm_wolf' | 'jade_tortoise' | 'void_butterfly';
type Ctx = CanvasRenderingContext2D;

function eye(ctx: Ctx, x: number, y: number, r: number, iris = '#1e1a28'): void {
  flat(ctx, ellipseP(ctx, x, y, r, r * 1.15), '#ffffff', '#2a1e2a', 0.4);
  flat(ctx, ellipseP(ctx, x + r * 0.2, y + r * 0.1, r * 0.62, r * 0.75), iris);
  flat(ctx, ellipseP(ctx, x - r * 0.1, y - r * 0.35, r * 0.28, r * 0.28), '#ffffff');
}

const DRAW: Record<PetKind, (ctx: Ctx, cx: number, gy: number) => void> = {
  sprite(ctx, cx, gy) {
    const y = gy - 18;
    glow(ctx, { x: cx, y }, 16, 0x8ff0c0, 0.5);
    const wing = tone(0xb8f8e0, { light: 0.4 });
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (const s of [-1, 1]) shade(ctx, ellipseP(ctx, cx + s * 8, y - 5, 7, 4, s * -0.6), wing, { band: 1.5, hi: 0.5, stroke: 0.5 });
    ctx.restore();
    const body = tone(0x6ad8a0, { light: 0.4 });
    shade(ctx, polyP(ctx, [[cx, y - 12], [cx + 6, y], [cx, y + 9], [cx - 6, y]]), body, { band: 2.5, hi: 0.8 });
    eye(ctx, cx - 2.2, y - 1, 1.5);
    eye(ctx, cx + 2.2, y - 1, 1.5);
  },
  dragon(ctx, cx, gy) {
    const b = tone(0xe0602e, { light: 0.4 });
    const belly = tone(0xf8c070);
    for (const s of [-1, 1]) shade(ctx, polyP(ctx, [[cx + s * 4, gy - 22], [cx + s * 17, gy - 30], [cx + s * 15, gy - 20], [cx + s * 13, gy - 14]]), tone(0xf0a040), { band: 2, hi: 0.5 });
    shade(ctx, limbP(ctx, [cx + 7, gy - 5], [cx + 16, gy - 4], [cx + 17, gy - 12], 2.4, 0.8), b, { band: 1, hi: 0 });
    shade(ctx, ellipseP(ctx, cx, gy - 10, 9, 8), b, { band: 3, hi: 1 });
    shade(ctx, ellipseP(ctx, cx - 1, gy - 8, 5, 5), belly, { band: 1.5, hi: 0 });
    shade(ctx, ellipseP(ctx, cx, gy - 23, 8, 7), b, { band: 2.5, hi: 1 });
    for (const s of [-1, 1]) flat(ctx, polyP(ctx, [[cx + s * 4, gy - 28], [cx + s * 6, gy - 34], [cx + s * 7, gy - 27]]), '#f8e0a0', '#6a3020', 0.4);
    eye(ctx, cx - 3, gy - 24, 1.8);
    eye(ctx, cx + 3, gy - 24, 1.8);
  },
  owl(ctx, cx, gy) {
    const b = tone(0x9a7456, { light: 0.35 });
    shade(ctx, ellipseP(ctx, cx, gy - 13, 11, 13), b, { band: 3.5, hi: 1 });
    shade(ctx, ellipseP(ctx, cx, gy - 9, 6.5, 7), tone(0xe0cca8), { band: 2, hi: 0 });
    for (const s of [-1, 1]) flat(ctx, polyP(ctx, [[cx + s * 5, gy - 22], [cx + s * 9, gy - 30], [cx + s * 10, gy - 21]]), b.base, b.line, 0.5);
    for (const s of [-1, 1]) {
      flat(ctx, ellipseP(ctx, cx + s * 4.5, gy - 17, 4.5, 4.5), '#f0e2c4', b.line, 0.4);
      eye(ctx, cx + s * 4.5, gy - 17, 2.6, '#e0a030');
      flat(ctx, ellipseP(ctx, cx + s * 4.6, gy - 16.8, 1.2, 1.4), '#1a1420');
    }
    flat(ctx, polyP(ctx, [[cx - 1.5, gy - 14], [cx + 1.5, gy - 14], [cx, gy - 11]]), '#e0a030', '#6a4a1a', 0.4);
  },
  cat(ctx, cx, gy) {
    const b = tone(0x3a3044, { light: 0.35 });
    line(ctx, [[cx + 7, gy - 4], [cx + 15, gy - 6], [cx + 14, gy - 16]], b.line, 3.2);
    line(ctx, [[cx + 7, gy - 4], [cx + 15, gy - 6], [cx + 14, gy - 16]], b.base, 2);
    shade(ctx, ellipseP(ctx, cx + 1, gy - 8, 9, 7), b, { band: 3, hi: 1 });
    shade(ctx, blobP(ctx, [[cx - 9, gy - 16], [cx - 8, gy - 29], [cx - 3, gy - 24], [cx + 3, gy - 24], [cx + 8, gy - 29], [cx + 9, gy - 16], [cx, gy - 12]]), b, { band: 2.5, hi: 1 });
    eye(ctx, cx - 3.5, gy - 19, 2, '#b080ff');
    eye(ctx, cx + 3.5, gy - 19, 2, '#b080ff');
    flat(ctx, polyP(ctx, [[cx - 0.8, gy - 16], [cx + 0.8, gy - 16], [cx, gy - 15]]), '#e890b0');
  },
  phoenix(ctx, cx, gy) {
    drawFlame(ctx, cx, gy - 2, 18, 30, 0.8, 0xff6a2a);
    const b = tone(0xffc050, { light: 0.4 });
    shade(ctx, ellipseP(ctx, cx, gy - 14, 6, 8), b, { band: 2, hi: 0.8 });
    shade(ctx, ellipseP(ctx, cx, gy - 24, 5, 5), b, { band: 2, hi: 0.8 });
    flat(ctx, polyP(ctx, [[cx + 4, gy - 25], [cx + 8, gy - 23], [cx + 4, gy - 22]]), '#f0802a', '#6a2a10', 0.4);
    eye(ctx, cx + 1.5, gy - 25, 1.4);
  },
  storm_wolf(ctx, cx, gy) {
    const b = tone(0x5a86b8, { light: 0.4 });
    glow(ctx, { x: cx, y: gy - 16 }, 18, 0x9be8ff, 0.3);
    shade(ctx, ellipseP(ctx, cx + 2, gy - 9, 11, 7), b, { band: 3, hi: 1 });
    shade(ctx, blobP(ctx, [[cx - 11, gy - 14], [cx - 11, gy - 30], [cx - 5, gy - 24], [cx + 2, gy - 25], [cx + 6, gy - 31], [cx + 7, gy - 16], [cx + 1, gy - 10], [cx - 6, gy - 10]]), b, { band: 2.5, hi: 1 });
    shade(ctx, ellipseP(ctx, cx - 2, gy - 13, 4, 3), tone(0xd8eeff), { band: 1, hi: 0 });
    eye(ctx, cx - 6, gy - 20, 1.7, '#40c8ff');
    eye(ctx, cx + 2, gy - 20, 1.7, '#40c8ff');
    line(ctx, [[cx + 12, gy - 18], [cx + 15, gy - 12], [cx + 12, gy - 10], [cx + 15, gy - 4]], '#c8f4ff', 1);
  },
  jade_tortoise(ctx, cx, gy) {
    const skin = tone(0x8dcf72, { light: 0.35 });
    shade(ctx, ellipseP(ctx, cx + 13, gy - 9, 5, 4.5), skin, { band: 1.5, hi: 0.6 });
    for (const x of [-9, 7]) shade(ctx, ellipseP(ctx, cx + x, gy - 2, 3, 2.4), skin, { band: 1, hi: 0 });
    const shell = tone(0x3d8b62, { light: 0.4 });
    shade(ctx, () => { ctx.moveTo(cx - 13, gy - 4); ctx.bezierCurveTo(cx - 13, gy - 22, cx + 11, gy - 22, cx + 11, gy - 4); ctx.closePath(); }, shell, { band: 4, hi: 1.2 });
    for (const [x, y] of [[-6, -10], [3, -11], [-1, -15]] as const) flat(ctx, polyP(ctx, [[cx + x - 3, gy + y], [cx + x, gy + y - 2.5], [cx + x + 3, gy + y], [cx + x, gy + y + 2.5]]), '#9de08a', shell.line, 0.4);
    eye(ctx, cx + 14, gy - 10, 1.3);
  },
  void_butterfly(ctx, cx, gy) {
    const y = gy - 18;
    glow(ctx, { x: cx, y }, 16, 0xb48cff, 0.45);
    const w = tone(0x6a3ab8, { light: 0.45 });
    for (const s of [-1, 1]) {
      shade(ctx, blobP(ctx, [[cx, y], [cx + s * 14, y - 12], [cx + s * 16, y - 2], [cx + s * 6, y + 2]]), w, { band: 2.5, hi: 1 });
      shade(ctx, blobP(ctx, [[cx, y + 1], [cx + s * 11, y + 4], [cx + s * 8, y + 11], [cx + s * 2, y + 6]]), w, { band: 2, hi: 0.8 });
      flat(ctx, ellipseP(ctx, cx + s * 9, y - 5, 2.2, 2.2), '#e8d0ff');
    }
    shade(ctx, ellipseP(ctx, cx, y + 1, 1.6, 6), tone(0x2a1840), { band: 0.8, hi: 0 });
    line(ctx, [[cx - 0.5, y - 5], [cx - 3, y - 10]], '#2a1840', 0.6);
    line(ctx, [[cx + 0.5, y - 5], [cx + 3, y - 10]], '#2a1840', 0.6);
  },
};

function createPetDrawer(key: string, kind: PetKind): EntityDrawer {
  return defineDecor({
    key,
    w: 40,
    h: 40,
    ground: 36,
    draw(ctx, { cx, gy }) {
      contactShadow(ctx, cx + 1, gy, 11, 3, 0.4);
      DRAW[kind](ctx, cx, gy);
    },
  });
}

export const PetSpriteDrawers: readonly EntityDrawer[] = [
  createPetDrawer('decor_pet_pet_sprite', 'sprite'),
  createPetDrawer('decor_pet_pet_dragon', 'dragon'),
  createPetDrawer('decor_pet_pet_owl', 'owl'),
  createPetDrawer('decor_pet_pet_cat', 'cat'),
  createPetDrawer('decor_pet_pet_phoenix', 'phoenix'),
  createPetDrawer('decor_pet_pet_storm_wolf', 'storm_wolf'),
  createPetDrawer('decor_pet_pet_jade_tortoise', 'jade_tortoise'),
  createPetDrawer('decor_pet_pet_void_butterfly', 'void_butterfly'),
];
