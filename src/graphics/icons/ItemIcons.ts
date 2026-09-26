/**
 * Procedural item icons.
 *
 * Contract (used by UIScene and anything else that shows items):
 *   ensureItemIcon(scene, iconId) -> texture key, generated on first use.
 *   ensureItemIconFor(scene, item) -> resolves the item's base icon id.
 * Icons are ITEM_ICON_SIZE × ITEM_ICON_SIZE textures with a transparent
 * background; quality framing (border colour, glow) is the caller's job.
 */
import Phaser from 'phaser';
import type { ItemInstance } from '../../data/types';
import { getItemBase } from '../../data/items/bases';

/** Texture edge in pixels (already hi-res; display at ~36–48 px). */
export const ITEM_ICON_SIZE = 96;

export function itemIconKey(iconId: string): string {
  return `item_icon_${iconId}`;
}

/** Fallback icon id by item type when a base has no icon. */
function fallbackIconId(item: ItemInstance): string {
  const base = getItemBase(item.baseId);
  switch (base?.type) {
    case 'weapon': return 'w_sword';
    case 'armor': return 'a_armor';
    case 'accessory': return 'j_ring';
    case 'gem': return 'g_ruby';
    case 'scroll': return 'c_scroll';
    default: return 'c_hp';
  }
}

export function iconIdFor(item: ItemInstance): string {
  return getItemBase(item.baseId)?.icon ?? fallbackIconId(item);
}

export function ensureItemIcon(scene: Phaser.Scene, iconId: string): string {
  const key = itemIconKey(iconId);
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = ITEM_ICON_SIZE;
  canvas.height = ITEM_ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  drawItemIcon(ctx, iconId, ITEM_ICON_SIZE);
  scene.textures.addCanvas(key, canvas);
  return key;
}

export function ensureItemIconFor(scene: Phaser.Scene, item: ItemInstance): string {
  return ensureItemIcon(scene, iconIdFor(item));
}

/** Placeholder art — replaced by the icon pass. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, iconId: string, size: number): void {
  ctx.fillStyle = '#8a7a5a';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(size * 0.3)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(iconId.charAt(0).toUpperCase(), size / 2, size / 2);
}
