/**
 * Legacy tile texture keys (`tile_grass`, `tile_grass_0`, … `tile_camp_wall`).
 *
 * Zones render with the themed textures built by ZoneTerrain. These keys are
 * kept (painted with the plains look) for external-art overrides and any code
 * that still references them; a PNG loaded under one of these keys in
 * BootScene replaces the procedural version.
 */
import type Phaser from 'phaser';
import { TEX_H, TEX_W, makeCanvas, maskDiamond } from './TerrainLattice';
import { paintGroundBase, paintGroundDetails } from './GroundPainter';
import { groundStyle, terrainTheme } from './TerrainStyles';

const NAMES = ['grass', 'dirt', 'stone', 'water', 'wall', 'camp', 'camp_wall'];

export function generateLegacyTiles(scene: Phaser.Scene, variants: number, skip: (key: string) => boolean): void {
  const theme = terrainTheme('plains');
  NAMES.forEach((name, t) => {
    const ground = t === 4 ? 0 : t === 6 ? 5 : t;
    const style = groundStyle(theme, ground);
    const seed = 101 * 17 + ground * 1231;
    const keys = t === 4 || t === 6 ? [`tile_${name}`] : [`tile_${name}`, ...Array.from({ length: variants }, (_, v) => `tile_${name}_${v}`)];
    keys.forEach((key, i) => {
      if (skip(key)) return;
      const [canvas, ctx] = makeCanvas(TEX_W, TEX_H);
      paintGroundBase(ctx, style, 0, 0, seed);
      paintGroundDetails(ctx, style, 0, 0, Math.max(0, i - 1), seed);
      maskDiamond(ctx);
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, canvas);
    });
  });
}
