import Phaser from 'phaser';

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const MAP_COLS = 20;
export const MAP_ROWS = 20;

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: '#1a1a2e',
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
