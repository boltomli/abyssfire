import type { EntityDrawer } from '../types';
import { defineDecor, contactShadow, shade, tone, polyP, line, glow, flat, ellipseP, limbP, shard, rgbaHex } from './DecorKit';
import { block } from './Stonework';
import { drawRock } from './Rock';
import { drawFlame } from './CampProps';

type EventPropKind =
  | 'rune_pillar'
  | 'root_altar'
  | 'gem_lock'
  | 'sundial'
  | 'abyss_array'
  | 'defend_campfire'
  | 'defend_abyss_seal';

type Ctx = CanvasRenderingContext2D;

function groundGlow(ctx: Ctx, x: number, y: number, rr: number, col: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.4);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
  g.addColorStop(0, rgbaHex(col, a));
  g.addColorStop(1, rgbaHex(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const DRAW: Record<EventPropKind, (ctx: Ctx, cx: number, gy: number, r: () => number) => void> = {
  rune_pillar(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 3, gy, 22, 6, 0.42);
    block(ctx, cx - 17, gy, 32, 8, 8, 0x5a6664, r, false);
    const t = tone(0x6f7c7a, { light: 0.35 });
    shade(ctx, polyP(ctx, [[cx - 11, gy - 8], [cx - 9, gy - 50], [cx - 2, gy - 58], [cx + 7, gy - 52], [cx + 9, gy - 8]]), t, { band: 5, hi: 1.2 });
    glow(ctx, { x: cx - 1, y: gy - 32 }, 18, 0x72d8ff, 0.5);
    const rune: [number, number][] = [[cx, gy - 48], [cx - 5, gy - 40], [cx + 4, gy - 32], [cx - 1, gy - 22], [cx + 3, gy - 14]];
    line(ctx, rune, '#2a9ad8', 2.2);
    line(ctx, rune, '#dff8ff', 0.8);
  },
  root_altar(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 3, gy, 24, 6, 0.42);
    const bark = tone(0x5a4232);
    for (const [ox, h] of [[-14, 40], [0, 50], [13, 38]] as const) {
      shade(ctx, limbP(ctx, [cx + ox, gy], [cx + ox * 0.4, gy - h * 0.55], [cx + ox * 0.2, gy - h], 4, 1.5), bark, { band: 2.5, hi: 0.6 });
    }
    drawRock(ctx, cx, gy + 1, 30, 16, 0x7a8a6a, r, 1);
    const moss = tone(0x6a9a3c);
    shade(ctx, ellipseP(ctx, cx - 2, gy - 15, 13, 3.5), moss, { band: 1.5, hi: 0.6 });
    for (const ox of [-8, 0, 8]) {
      glow(ctx, { x: cx + ox, y: gy - 20 }, 6, 0x9ee26d, 0.6);
      flat(ctx, ellipseP(ctx, cx + ox, gy - 20, 2.2, 2.2), '#d8ffa8', '#4a8a2a', 0.5);
    }
  },
  gem_lock(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 3, gy, 26, 7, 0.42);
    block(ctx, cx - 24, gy, 44, 16, 9, 0x5e5f6a, r, false);
    block(ctx, cx - 18, gy - 16, 32, 16, 7, 0x6e6f7c, r);
    const gems = [0xe0484a, 0x4ac870, 0x4a80e0];
    gems.forEach((g, i) => {
      const gx = cx - 10 + i * 10;
      glow(ctx, { x: gx, y: gy - 25 }, 7, g, 0.5);
      shade(ctx, polyP(ctx, [[gx, gy - 31], [gx + 4, gy - 25], [gx, gy - 19], [gx - 4, gy - 25]]), tone(g, { light: 0.5 }), { band: 2, hi: 0.8, stroke: 0.5 });
      flat(ctx, ellipseP(ctx, gx - 1.2, gy - 27, 0.8, 1.2), '#ffffff');
    });
  },
  sundial(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 3, gy, 26, 7, 0.4);
    block(ctx, cx - 10, gy, 18, 16, 6, 0xc8a878, r, false);
    const stone = tone(0xd8bc88, { light: 0.35 });
    shade(ctx, ellipseP(ctx, cx - 1, gy - 18, 22, 8), stone, { band: 3, hi: 1 });
    ctx.beginPath();
    ctx.ellipse(cx - 1, gy - 18, 17, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = stone.shade;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(ctx, [[cx - 1 + Math.cos(a) * 14, gy - 18 + Math.sin(a) * 5], [cx - 1 + Math.cos(a) * 17, gy - 18 + Math.sin(a) * 6]], stone.line, 0.7);
    }
    line(ctx, [[cx - 1, gy - 18], [cx + 16, gy - 12]], 'rgba(40,24,40,0.45)', 3);
    shade(ctx, polyP(ctx, [[cx - 3, gy - 18], [cx + 1, gy - 42], [cx + 5, gy - 18]]), tone(0x7a5a3a), { band: 1.5, hi: 0.6 });
    glow(ctx, { x: cx + 1, y: gy - 42 }, 6, 0x3fd0c8, 0.6);
    flat(ctx, ellipseP(ctx, cx + 1, gy - 42, 1.8, 1.8), '#9ffff4');
  },
  abyss_array(ctx, cx, gy) {
    groundGlow(ctx, cx, gy - 8, 30, 0x60e1e6, 0.5);
    ctx.save();
    ctx.translate(cx, gy - 8);
    ctx.scale(1, 0.42);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,10,40,0.6)';
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#68dce1';
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 0.8;
      if (i === 0) ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); else ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
    }
    ctx.stroke();
    ctx.restore();
    for (const [ox, oy, h] of [[-18, -6, 16], [18, -6, 14], [0, -16, 12], [0, 2, 10]] as const) {
      shard(ctx, cx + ox, gy + oy, h, 6, 0, 0x8a6ae0);
    }
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * 9, y = gy - 34 - (i % 2) * 7;
      glow(ctx, { x, y }, 6, 0xb48cff, 0.6);
      flat(ctx, ellipseP(ctx, x, y, 1.8, 1.8), '#eadcff');
    }
  },
  defend_campfire(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 2, gy, 26, 7, 0.45);
    groundGlow(ctx, cx, gy - 4, 30, 0xff9a3a, 0.4);
    const stone = tone(0x6a6e78, { light: 0.3 });
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      shade(ctx, ellipseP(ctx, cx + Math.cos(a) * 17, gy - 6 + Math.sin(a) * 5.5, 4.5, 3), stone, { band: 1.4, hi: 0.6 });
    }
    const log = tone(0x6a4028);
    shade(ctx, limbP(ctx, [cx - 16, gy - 4], [cx, gy - 8], [cx + 14, gy - 12], 3, 2.6), log, { band: 1.5, hi: 0.6 });
    shade(ctx, limbP(ctx, [cx + 16, gy - 3], [cx, gy - 7], [cx - 14, gy - 12], 3, 2.6), log, { band: 1.5, hi: 0.6 });
    drawFlame(ctx, cx, gy - 7, 15, 32, 0, 0xff8a2a);
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI;
      shade(ctx, ellipseP(ctx, cx + Math.cos(a) * 17, gy - 6 + Math.sin(a) * 5.5, 4.5, 3), stone, { band: 1.4, hi: 0.6 });
    }
    void r;
  },
  defend_abyss_seal(ctx, cx, gy, r) {
    contactShadow(ctx, cx + 3, gy, 24, 7, 0.45);
    groundGlow(ctx, cx, gy - 4, 30, 0x5fe1e3, 0.45);
    block(ctx, cx - 18, gy, 32, 8, 8, 0x2e2a3e, r, false);
    const t = tone(0x3a3650, { light: 0.35 });
    shade(ctx, polyP(ctx, [[cx - 1, gy - 60], [cx + 13, gy - 16], [cx + 8, gy - 8], [cx - 10, gy - 8], [cx - 15, gy - 16]]), t, { band: 5, hi: 1.4 });
    glow(ctx, { x: cx - 1, y: gy - 32 }, 20, 0x67dce2, 0.55);
    const rune: [number, number][] = [[cx - 1, gy - 50], [cx - 7, gy - 38], [cx + 6, gy - 28], [cx - 1, gy - 14]];
    line(ctx, rune, '#1a9aa8', 2.4);
    line(ctx, rune, '#dffcff', 0.8);
    for (const s of [-1, 1]) {
      line(ctx, [[cx + s * 20, gy - 46], [cx + s * 14, gy - 24]], '#7d629f', 2.2);
      glow(ctx, { x: cx + s * 20, y: gy - 46 }, 5, 0xb48cff, 0.6);
    }
  },
};

function createEventPropDrawer(key: string, kind: EventPropKind): EntityDrawer {
  return defineDecor({
    key,
    w: 64,
    h: 72,
    ground: 67,
    tall: true,
    draw(ctx, { cx, gy, r }) {
      DRAW[kind](ctx, cx, gy, r);
    },
  });
}

export const EventPuzzleRunePillarDrawer = createEventPropDrawer('decor_event_puzzle_rune_pillar', 'rune_pillar');
export const EventPuzzleRootAltarDrawer = createEventPropDrawer('decor_event_puzzle_root_altar', 'root_altar');
export const EventPuzzleGemLockDrawer = createEventPropDrawer('decor_event_puzzle_gem_lock', 'gem_lock');
export const EventPuzzleSundialDrawer = createEventPropDrawer('decor_event_puzzle_sundial', 'sundial');
export const EventPuzzleAbyssArrayDrawer = createEventPropDrawer('decor_event_puzzle_abyss_array', 'abyss_array');
export const DefendCampfireDrawer = createEventPropDrawer('decor_defend_campfire', 'defend_campfire');
export const DefendAbyssSealDrawer = createEventPropDrawer('decor_defend_abyss_seal', 'defend_abyss_seal');

export const EVENT_PROP_DRAWERS: readonly EntityDrawer[] = [
  EventPuzzleRunePillarDrawer,
  EventPuzzleRootAltarDrawer,
  EventPuzzleGemLockDrawer,
  EventPuzzleSundialDrawer,
  EventPuzzleAbyssArrayDrawer,
  DefendCampfireDrawer,
  DefendAbyssSealDrawer,
];
