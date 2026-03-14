import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Loading bar
    const { width, height } = this.cameras.main;
    const barW = 300;
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(width / 2, barY, barW, barH, 0x333333);
    bg.setStrokeStyle(1, 0x666666);
    const fill = this.add.rectangle(barX + 2, barY, 0, barH - 4, 0x3498db);
    fill.setOrigin(0, 0.5);

    const loadingText = this.add.text(width / 2, barY - 30, '加载中...', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = (barW - 4) * value;
    });

    this.load.on('complete', () => {
      loadingText.setText('加载完成!');
    });

    // We generate textures programmatically in create() since we have no external assets yet
  }

  create(): void {
    this.generatePlaceholderTextures();
    this.scene.start('MenuScene');
  }

  private generatePlaceholderTextures(): void {
    // Generate isometric tile textures
    this.generateIsoTile('tile_grass', 0x4a8c3f, 0x3d7a34);
    this.generateIsoTile('tile_dirt', 0x8B7355, 0x7A6548);
    this.generateIsoTile('tile_stone', 0x808080, 0x6e6e6e);
    this.generateIsoTile('tile_water', 0x2980b9, 0x2471a3);
    this.generateIsoTile('tile_wall', 0x555555, 0x444444);
    this.generateIsoTile('tile_camp', 0xc19a6b, 0xa8845a);
  }

  private generateIsoTile(key: string, fillColor: number, strokeColor: number): void {
    const w = 64;
    const h = 32;
    const g = this.add.graphics();

    g.fillStyle(fillColor);
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w, h / 2);
    g.lineTo(w / 2, h);
    g.lineTo(0, h / 2);
    g.closePath();
    g.fillPath();

    g.lineStyle(1, strokeColor, 0.5);
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w, h / 2);
    g.lineTo(w / 2, h);
    g.lineTo(0, h / 2);
    g.closePath();
    g.strokePath();

    g.generateTexture(key, w, h);
    g.destroy();
  }
}
