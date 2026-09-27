import { describe, expect, it } from 'vitest';
import { FACING_HYSTERESIS, resolveFacing, type Facing } from '../systems/CharacterAnimator';
import {
  MAX_SHEET_DIMENSION,
  PLAYER_ACTION_ORDER,
  PLAYER_SHEET_FRAMES,
  PLAYER_TOTAL_FRAMES,
  PLAYER_VIEWS,
  computeSheetGrid,
  getPlayerActionFrameRange,
  getPlayerViewFrameRange,
  playerAnimKey,
} from '../graphics/sprites/types';
import { ViewRig } from '../graphics/sprites/rig/HumanView';
import { CENTER_X, GROUND_Y } from '../graphics/sprites/rig/Rig';

const SE_RIGHT: Facing = { view: 'se', left: false };

describe('resolveFacing (screen dx/dy → 3/4 view + mirroring)', () => {
  it.each([
    // dx, dy, view, left
    [1, 0.5, 'se', false], // screen right-down
    [-1, 0.5, 'se', true], // left-down  → sw = se mirrored
    [1, -0.5, 'ne', false], // right-up
    [-1, -0.5, 'ne', true], // left-up   → nw = ne mirrored
  ] as const)('dx=%s dy=%s → %s (left=%s)', (dx, dy, view, left) => {
    expect(resolveFacing(dx, dy, SE_RIGHT)).toEqual({ view, left });
    expect(resolveFacing(dx, dy, { view: 'ne', left: true })).toEqual({ view, left });
  });

  it('keeps the front/back view on near-horizontal moves (hysteresis)', () => {
    const back: Facing = { view: 'ne', left: false };
    expect(resolveFacing(1, 0, back)).toEqual({ view: 'ne', left: false });
    expect(resolveFacing(1, 0.2, back).view).toBe('ne');
    expect(resolveFacing(-1, -0.1, SE_RIGHT)).toEqual({ view: 'se', left: true });
    // Past the threshold the view follows the vertical component.
    expect(resolveFacing(1, FACING_HYSTERESIS + 0.05, back).view).toBe('se');
  });

  it('keeps the mirroring on near-vertical moves', () => {
    const left: Facing = { view: 'se', left: true };
    expect(resolveFacing(0, -1, left)).toEqual({ view: 'ne', left: true });
    expect(resolveFacing(0.1, 1, left)).toEqual({ view: 'se', left: true });
    expect(resolveFacing(0.5, 1, left)).toEqual({ view: 'se', left: false });
  });

  it('ignores zero/sub-threshold vectors and returns the same object when unchanged', () => {
    expect(resolveFacing(0, 0, SE_RIGHT)).toBe(SE_RIGHT);
    expect(resolveFacing(0.001, -0.001, SE_RIGHT)).toBe(SE_RIGHT);
    expect(resolveFacing(2, 1, SE_RIGHT)).toBe(SE_RIGHT);
  });
});

describe('player sheet views', () => {
  it('lays every view out as a full copy of the action table (view-major)', () => {
    expect(PLAYER_SHEET_FRAMES).toBe(PLAYER_TOTAL_FRAMES * PLAYER_VIEWS.length);
    PLAYER_VIEWS.forEach((view, v) => {
      for (const action of PLAYER_ACTION_ORDER) {
        const base = getPlayerActionFrameRange(action);
        const range = getPlayerViewFrameRange(view, action);
        expect(range.start).toBe(base.start + v * PLAYER_TOTAL_FRAMES);
        expect(range.end - range.start).toBe(base.end - base.start);
        expect(range.end).toBeLessThan(PLAYER_SHEET_FRAMES);
      }
    });
  });

  it('keeps the default view on the legacy animation keys', () => {
    expect(playerAnimKey('player_mage', 'se', 'idle')).toBe('player_mage_idle');
    expect(playerAnimKey('player_mage', 'ne', 'attack')).toBe('player_mage_ne_attack');
  });

  it.each([2, 3])('fits the two-view sheet inside the texture limit at TEXTURE_SCALE %s', scale => {
    const grid = computeSheetGrid(96 * scale, 96 * scale, PLAYER_SHEET_FRAMES);
    expect(grid.width).toBeLessThanOrEqual(MAX_SHEET_DIMENSION);
    expect(grid.height).toBeLessThanOrEqual(MAX_SHEET_DIMENSION);
    expect(grid.cols * grid.rows).toBeGreaterThanOrEqual(PLAYER_SHEET_FRAMES);
  });
});

describe('ViewRig projection', () => {
  const root = { x: CENTER_X, y: 65 };

  it('steps forward along the screen diagonal: down-right in se, up-right in ne', () => {
    const se = new ViewRig('se', 0, root, root.x);
    const ne = new ViewRig('ne', 0, root, root.x);
    const a = se.pt(CENTER_X + 10, GROUND_Y);
    const b = ne.pt(CENTER_X + 10, GROUND_Y);
    expect(a.x).toBeGreaterThan(CENTER_X);
    expect(a.y).toBeGreaterThan(GROUND_Y);
    expect(b.x).toBeGreaterThan(CENTER_X);
    expect(b.y).toBeLessThan(GROUND_Y);
    // 2:1 iso ground: the stride's screen slope matches the tile diagonal.
    expect((a.y - GROUND_Y) / (a.x - CENTER_X)).toBeCloseTo(0.5, 5);
    expect((GROUND_Y - b.y) / (b.x - CENTER_X)).toBeCloseTo(0.5, 5);
  });

  it('turns the chest to the camera in se and the back in ne', () => {
    const se = new ViewRig('se', 0, root, root.x);
    const ne = new ViewRig('ne', 0, root, root.x);
    expect(se.facing(1, 0, 0)).toBeGreaterThan(0);
    expect(ne.facing(1, 0, 0)).toBeLessThan(0);
    expect(ne.facing(-1, 0, 0)).toBeGreaterThan(0);
    // The near (right) side stays nearer the camera in both views.
    expect(se.depth(CENTER_X, 60, 3)).toBeGreaterThan(se.depth(CENTER_X, 60, -3));
    expect(ne.depth(CENTER_X, 60, 3)).toBeGreaterThan(ne.depth(CENTER_X, 60, -3));
  });

  it('keeps the pelvis ground point anchored however far the root moves', () => {
    const rig = new ViewRig('se', 0, { x: CENTER_X + 6, y: 65 }, CENTER_X + 6);
    expect(rig.pt(CENTER_X + 6, GROUND_Y).y).toBeCloseTo(GROUND_Y, 5);
  });
});
