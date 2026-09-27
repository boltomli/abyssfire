import Phaser from 'phaser';
import { detectRenderScale } from './rendering/RenderScale';

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const MAP_COLS = 80;
export const MAP_ROWS = 80;

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
/** Phaser world/UI coordinates are always expressed in logical pixels. */
export const DPR = 1;

/**
 * Render scale: the canvas is GAME_WIDTH×GAME_HEIGHT × RENDER_SCALE backing
 * pixels and every camera is zoomed by the same factor, so game code keeps
 * working in 1280×720 logical pixels while high-DPI / large windows get a
 * sharp image instead of a stretched 1280×720 one. 1, 1.5 or 2 — capped by
 * the render quality (phones and weak machines stay at 1). See RenderScale.ts.
 */
export const RENDER_SCALE = detectRenderScale(GAME_WIDTH, GAME_HEIGHT);

/** Character/prop sheets are drawn at this many texels per world pixel (zone camera zoom is 1.8 × RENDER_SCALE). */
export const TEXTURE_SCALE = RENDER_SCALE >= 1.5 ? 3 : 2;

/** A pointer's position in logical (1280×720) screen pixels, for screen-fixed UI. */
export function logicalPointer(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x / RENDER_SCALE, y: p.y / RENDER_SCALE };
}

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  pixelArt: false,
  antialias: true,
  backgroundColor: '#0f0f1a',
  input: {
    gamepad: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};
