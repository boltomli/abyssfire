/**
 * Phaser side of the render scale (see RenderScale.ts / config RENDER_SCALE).
 */
import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';

/**
 * Screen-fixed scenes (boot, menu, HUD, story) keep drawing in 1280×720
 * logical pixels: zooming from the top-left corner maps them onto the larger
 * canvas one-to-one.
 */
export function applyScreenCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setOrigin(0, 0).setZoom(RENDER_SCALE);
}

let textPatched = false;

/**
 * Text is rasterised to its own canvas at resolution 1 by default, so any
 * camera zoom enlarges a blurry bitmap. Render each text at the pixel density
 * it is shown at: the render scale for screen UI, and the zone camera's zoom
 * (1.8 × render scale, capped) for world text such as names and damage numbers.
 */
export function installTextResolution(): void {
  if (textPatched) return;
  textPatched = true;
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (this: Phaser.GameObjects.GameObjectFactory, ...args: unknown[]) => Phaser.GameObjects.Text;
    scene: Phaser.Scene;
  };
  const original = factory.text;
  factory.text = function (this: Phaser.GameObjects.GameObjectFactory, ...args: unknown[]): Phaser.GameObjects.Text {
    const text = original.apply(this, args);
    const world = this.scene.sys.settings.key === 'ZoneScene';
    const resolution = world ? Math.min(3, RENDER_SCALE * 1.8) : RENDER_SCALE;
    if (resolution > 1) text.setResolution(resolution);
    return text;
  };
}
