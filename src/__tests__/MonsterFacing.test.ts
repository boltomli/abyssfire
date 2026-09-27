import { describe, expect, it, vi } from 'vitest';

// Minimal Phaser stand-in: the animator only needs to recognise its sprite.
vi.mock('phaser', () => {
  class Sprite {
    x = 0;
    y = 0;
    scaleX = 1;
    scaleY = 1;
    angle = 0;
    flipX = false;
    played: string[] = [];
    anims = {
      timeScale: 1,
      isPlaying: true,
      isPaused: false,
      currentAnim: null as { key: string } | null,
      currentFrame: { index: 1 },
      pause: () => undefined,
    };
    setFlipX(v: boolean): this { this.flipX = v; return this; }
    setAlpha(): this { return this; }
    play(cfg: string | { key: string }): this {
      const key = typeof cfg === 'string' ? cfg : cfg.key;
      this.played.push(key);
      this.anims.currentAnim = { key };
      return this;
    }
  }
  class EventEmitter {
    on(): this { return this; }
    off(): this { return this; }
    once(): this { return this; }
    emit(): boolean { return false; }
    removeAllListeners(): this { return this; }
  }
  const P = {
    AUTO: 0,
    WEBGL: 2,
    Scale: { FIT: 0, CENTER_BOTH: 0, RESIZE: 0, NONE: 0 },
    Events: { EventEmitter },
    GameObjects: { Sprite },
    Math: { Clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)), Between: (a: number) => a },
  };
  return { default: P, ...P };
});

import Phaser from 'phaser';
import { CharacterAnimator, getAnimConfig, resolveFacing, type Facing } from '../systems/CharacterAnimator';
import { Monster, tileDeltaToScreen } from '../entities/Monster';
import {
  MAX_SHEET_DIMENSION,
  PLAYER_VIEWS,
  computeSheetGrid,
  type EntityDrawer,
} from '../graphics/sprites/types';
import { MONSTER_FRAME_COUNTS } from '../graphics/sprites/rig/MonsterKit';

const SE_RIGHT: Facing = { view: 'se', left: false };

describe('monster heading → 3/4 view', () => {
  it.each([
    // tile delta, expected view, mirrored
    [1, 0, 'se', false], // +col: screen right-down
    [0, 1, 'se', true], // +row: screen left-down
    [0, -1, 'ne', false], // −row: screen right-up
    [-1, 0, 'ne', true], // −col: screen left-up
  ] as const)('dCol=%s dRow=%s → %s (left=%s)', (dc, dr, view, left) => {
    const v = tileDeltaToScreen(dc, dr);
    expect(resolveFacing(v.x, v.y, SE_RIGHT)).toEqual({ view, left });
  });

  it('treats straight screen-horizontal chases as ambiguous (keeps the view)', () => {
    const v = tileDeltaToScreen(1, -1); // due screen-right
    expect(v.y).toBeCloseTo(0, 6);
    expect(resolveFacing(v.x, v.y, { view: 'ne', left: true })).toEqual({ view: 'ne', left: false });
  });
});

// ── Monster.update wiring ───────────────────────────────────────────────

type FakeMonster = Monster & { faced: [number, number][] };

function fakeMonster(state: 'chase' | 'attack', col: number, row: number): FakeMonster {
  const m = Object.create(Monster.prototype) as FakeMonster;
  m.faced = [];
  Object.assign(m, {
    state,
    tileCol: col,
    tileRow: row,
    spawnCol: col,
    spawnRow: row,
    leashRange: 99,
    patrolTimer: 0,
    currentMoveSpeed: 0,
    moveAccel: 6,
    definition: { aggroRange: 20, attackRange: 1.5, speed: 60 },
    sprite: { x: 0, y: 0, setPosition() { return this; }, setDepth() { return this; } },
    animator: {
      faceToward: (dx: number, dy: number) => { m.faced.push([dx, dy]); },
      setIdle: () => undefined,
      setWalk: () => undefined,
      update: () => undefined,
    },
  });
  return m;
}

describe('Monster facing wiring', () => {
  const open = Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => true));

  it('faces up-screen (dy < 0) when chasing a player above it', () => {
    const m = fakeMonster('chase', 10, 10);
    m.update(0, 16, 10, 5, open); // player 5 rows north: screen right-up
    expect(m.faced.length).toBeGreaterThan(0);
    const [dx, dy] = m.faced[m.faced.length - 1];
    expect(dy).toBeLessThan(0);
    expect(resolveFacing(dx, dy, SE_RIGHT).view).toBe('ne');
  });

  it('faces down-screen when chasing a player below it', () => {
    const m = fakeMonster('chase', 10, 10);
    m.update(0, 16, 15, 10, open);
    const [dx, dy] = m.faced[m.faced.length - 1];
    expect(dy).toBeGreaterThan(0);
    expect(resolveFacing(dx, dy, SE_RIGHT)).toEqual({ view: 'se', left: false });
  });

  it('keeps facing the player while standing in attack range', () => {
    const m = fakeMonster('attack', 10, 10);
    m.update(0, 16, 9, 10, open); // player one column west: screen left-up
    expect(m.state).toBe('attack');
    const [dx, dy] = m.faced[m.faced.length - 1];
    expect(resolveFacing(dx, dy, SE_RIGHT)).toEqual({ view: 'ne', left: true });
  });
});

// ── Animator fallback for single-view sheets ────────────────────────────

function fakeScene(anims: string[]): Phaser.Scene {
  const set = new Set(anims);
  return { anims: { exists: (k: string) => set.has(k) } } as unknown as Phaser.Scene;
}

function animatorFor(anims: string[]): { a: CharacterAnimator; spr: { flipX: boolean; played: string[] } } {
  const SpriteCtor = (Phaser as unknown as { GameObjects: { Sprite: new () => { flipX: boolean; played: string[] } } }).GameObjects.Sprite;
  const spr = new SpriteCtor();
  const container = { list: [spr], x: 0, y: 0 } as unknown as Phaser.GameObjects.Container;
  return { a: new CharacterAnimator(fakeScene(anims), container, getAnimConfig('humanoid'), 'monster_x'), spr };
}

const ACTIONS = ['idle', 'walk', 'attack', 'hurt', 'death'];

describe('CharacterAnimator with monster sheets', () => {
  it('switches to the back view when the sheet has one', () => {
    const { a, spr } = animatorFor([...ACTIONS.map(x => `monster_x_${x}`), ...ACTIONS.map(x => `monster_x_ne_${x}`)]);
    a.faceToward(32, -16);
    expect(a.getFacing()).toEqual({ view: 'ne', left: false });
    expect(spr.played).toContain('monster_x_ne_idle');
    a.faceToward(-32, 16);
    expect(a.getFacing()).toEqual({ view: 'se', left: true });
    expect(spr.flipX).toBe(true);
  });

  it('falls back to mirroring the front view when there is no back view', () => {
    const { a, spr } = animatorFor(ACTIONS.map(x => `monster_x_${x}`));
    a.faceToward(-32, -16);
    expect(a.getFacing()).toEqual({ view: 'se', left: true });
    expect(spr.played.some(k => k.includes('_ne_'))).toBe(false);
  });
});

// ── Sheet layout ────────────────────────────────────────────────────────

const MODULES = import.meta.glob('../graphics/sprites/monsters/*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const DRAWERS: EntityDrawer[] = Object.values(MODULES)
  .flatMap(m => Object.values(m))
  .filter((v): v is EntityDrawer => !!v && typeof v === 'object' && typeof (v as EntityDrawer).drawFrame === 'function'
    && typeof (v as EntityDrawer).key === 'string' && (v as EntityDrawer).key.startsWith('monster_'));

describe('monster sheets', () => {
  const perView = Object.values(MONSTER_FRAME_COUNTS).reduce((a, b) => a + b, 0);

  it('finds every monster drawer', () => {
    expect(new Set(DRAWERS.map(d => d.key)).size).toBeGreaterThanOrEqual(28);
  });

  it('holds 20 frames per view, front view first', () => {
    expect(perView).toBe(20);
    for (const d of DRAWERS) {
      const views = d.views ?? ['se'];
      expect(d.totalFrames, d.key).toBe(perView * views.length);
      expect(views[0], d.key).toBe('se');
      for (const v of views) expect(PLAYER_VIEWS, d.key).toContain(v);
    }
  });

  it.each([2, 3])('fits every monster sheet inside the texture limit at TEXTURE_SCALE %s', scale => {
    for (const d of DRAWERS) {
      const grid = computeSheetGrid(d.frameW * scale, d.frameH * scale, d.totalFrames);
      expect(grid.width, d.key).toBeLessThanOrEqual(MAX_SHEET_DIMENSION);
      expect(grid.height, d.key).toBeLessThanOrEqual(MAX_SHEET_DIMENSION);
      expect(grid.cols * grid.rows, d.key).toBeGreaterThanOrEqual(d.totalFrames);
    }
  });
});
