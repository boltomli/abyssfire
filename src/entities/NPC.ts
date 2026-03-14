import Phaser from 'phaser';
import { cartToIso } from '../utils/IsometricUtils';
import type { NPCDefinition } from '../data/types';

export class NPC {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Container;
  definition: NPCDefinition;
  tileCol: number;
  tileRow: number;
  nameLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, definition: NPCDefinition, col: number, row: number) {
    this.scene = scene;
    this.definition = definition;
    this.tileCol = col;
    this.tileRow = row;

    const worldPos = cartToIso(col, row);
    this.sprite = scene.add.container(worldPos.x, worldPos.y);
    this.sprite.setDepth(worldPos.y + 80);

    const color = this.getNPCColor();
    const body = scene.add.rectangle(0, -12, 18, 22, color);
    body.setStrokeStyle(1, 0x000000);
    this.sprite.add(body);

    // Hat/identifier
    const hat = scene.add.rectangle(0, -25, 12, 6, this.getHatColor());
    this.sprite.add(hat);

    // Shadow
    const shadow = scene.add.ellipse(0, 2, 18, 7, 0x000000, 0.3);
    this.sprite.add(shadow);
    this.sprite.sendToBack(shadow);

    // Exclamation mark for quest NPCs
    if (definition.type === 'quest') {
      const marker = scene.add.text(0, -34, '!', {
        fontSize: '14px',
        color: '#f1c40f',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.sprite.add(marker);
    }

    // Name label
    this.nameLabel = scene.add.text(0, 6, definition.name, {
      fontSize: '8px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.sprite.add(this.nameLabel);
  }

  private getNPCColor(): number {
    switch (this.definition.type) {
      case 'blacksmith': return 0x8b4513;
      case 'merchant': return 0x2e86c1;
      case 'quest': return 0xf1c40f;
      case 'stash': return 0x7d3c98;
      default: return 0x95a5a6;
    }
  }

  private getHatColor(): number {
    switch (this.definition.type) {
      case 'blacksmith': return 0x6c3483;
      case 'merchant': return 0x1abc9c;
      case 'quest': return 0xe67e22;
      case 'stash': return 0x5b2c6f;
      default: return 0x7f8c8d;
    }
  }

  isNearPlayer(playerCol: number, playerRow: number, range = 2): boolean {
    const dist = Math.sqrt((this.tileCol - playerCol) ** 2 + (this.tileRow - playerRow) ** 2);
    return dist <= range;
  }
}
