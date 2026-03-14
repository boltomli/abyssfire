import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    // Title
    this.add.text(cx, 100, 'PIXELMUD', {
      fontSize: '48px',
      color: '#e74c3c',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 155, '暗 烬 大 陆', {
      fontSize: '24px',
      color: '#f39c12',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 200, 'E M B E R V A L E', {
      fontSize: '14px',
      color: '#95a5a6',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Class selection
    this.add.text(cx, 280, '选择职业', {
      fontSize: '20px',
      color: '#ecf0f1',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const classes = [
      { id: 'warrior', name: '战士 Warrior', desc: '近战坦克 / STR+VIT', color: 0xe74c3c },
      { id: 'mage', name: '法师 Mage', desc: '远程AOE / INT+SPI', color: 0x3498db },
      { id: 'rogue', name: '盗贼 Rogue', desc: '高爆发 / DEX+LCK', color: 0x2ecc71 },
    ];

    classes.forEach((cls, i) => {
      const y = 340 + i * 70;
      const btn = this.add.rectangle(cx, y, 260, 55, 0x2c3e50)
        .setStrokeStyle(2, cls.color)
        .setInteractive({ useHandCursor: true });

      this.add.text(cx, y - 10, cls.name, {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.add.text(cx, y + 12, cls.desc, {
        fontSize: '12px',
        color: '#95a5a6',
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      btn.on('pointerover', () => btn.setFillStyle(0x34495e));
      btn.on('pointerout', () => btn.setFillStyle(0x2c3e50));
      btn.on('pointerdown', () => this.startGame(cls.id));
    });

    // Version
    this.add.text(cx, GAME_HEIGHT - 30, 'v0.5.0 - All Phases', {
      fontSize: '12px',
      color: '#555555',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  private startGame(classId: string): void {
    this.scene.start('ZoneScene', { classId, mapId: 'emerald_plains' });
  }
}
