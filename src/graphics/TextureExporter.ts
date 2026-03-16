import { buildFrameSizeRegistry } from './sprites/types';

export class TextureExporter {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  exportAll(): void {
    const registry = buildFrameSizeRegistry();
    const keys = Object.keys(registry);

    const decorKeys = ['decor_tree', 'decor_bush', 'decor_rock', 'decor_flower',
      'decor_mushroom', 'decor_cactus', 'decor_boulder', 'decor_crystal', 'decor_bones'];
    const effectKeys = ['loot_bag', 'exit_portal'];
    const allKeys = [...keys, ...decorKeys, ...effectKeys];

    const links: string[] = [];

    for (const key of allKeys) {
      if (!this.scene.textures.exists(key)) continue;
      const tex = this.scene.textures.get(key);
      const source = tex.getSourceImage() as HTMLCanvasElement;
      if (!(source instanceof HTMLCanvasElement)) continue;

      const dataUrl = source.toDataURL('image/png');
      const filename = this.keyToFilename(key);
      links.push(`<a href="${dataUrl}" download="${filename}">${key} (${source.width}x${source.height})</a>`);
    }

    const html = `<!DOCTYPE html><html><head><title>Texture Export</title>
      <style>body{background:#1a1a2e;color:#c0934a;font-family:monospace;padding:20px}
      a{color:#5aaa8a;display:block;margin:4px 0}</style></head>
      <body><h1>Exported Textures (${links.length})</h1>
      <p>Right-click → Save As to download individual sprites.</p>
      ${links.join('\n')}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob));
  }

  private keyToFilename(key: string): string {
    if (key.startsWith('player_')) return `sprites-players-${key}.png`;
    if (key.startsWith('monster_')) return `sprites-monsters-${key}.png`;
    if (key.startsWith('npc_')) return `sprites-npcs-${key}.png`;
    if (key.startsWith('decor_')) return `sprites-decorations-${key}.png`;
    return `sprites-effects-${key}.png`;
  }
}
