import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import type { Player } from '../entities/Player';

const LOG_MAX_LINES = 8;

export class UIScene extends Phaser.Scene {
  private player!: Player;

  // HUD elements
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private manaBar!: Phaser.GameObjects.Rectangle;
  private manaBarBg!: Phaser.GameObjects.Rectangle;
  private manaText!: Phaser.GameObjects.Text;
  private expBar!: Phaser.GameObjects.Rectangle;
  private expBarBg!: Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private autoCombatText!: Phaser.GameObjects.Text;

  // Skill bar
  private skillSlots: Phaser.GameObjects.Container[] = [];
  private skillCooldownOverlays: Phaser.GameObjects.Rectangle[] = [];

  // Log window (MUD style)
  private logPanel!: Phaser.GameObjects.Rectangle;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private logMessages: { text: string; type: string }[] = [];

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: { player: Player }): void {
    this.player = data.player;
  }

  create(): void {
    this.createHPManaBar();
    this.createExpBar();
    this.createSkillBar();
    this.createLogPanel();
    this.createInfoDisplay();
    this.setupEventListeners();
  }

  private createHPManaBar(): void {
    const x = 15;
    const barW = 160;
    const barH = 14;

    // Portrait placeholder
    const portrait = this.add.rectangle(x + 15, 20, 30, 30, 0x2c3e50);
    portrait.setStrokeStyle(2, 0x3498db);
    portrait.setScrollFactor(0).setDepth(3000);

    const classIcon = this.add.text(x + 15, 20, 'W', {
      fontSize: '14px',
      color: '#3498db',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);

    // HP bar
    const hpX = x + 38;
    const hpY = 12;
    this.hpBarBg = this.add.rectangle(hpX, hpY, barW, barH, 0x333333)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(3000);
    this.hpBar = this.add.rectangle(hpX, hpY, barW, barH, 0xe74c3c)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(3001);
    this.hpText = this.add.text(hpX + barW / 2, hpY, '', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

    // Mana bar
    const manaY = hpY + barH + 3;
    this.manaBarBg = this.add.rectangle(hpX, manaY, barW, barH, 0x333333)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(3000);
    this.manaBar = this.add.rectangle(hpX, manaY, barW, barH, 0x3498db)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(3001);
    this.manaText = this.add.text(hpX + barW / 2, manaY, '', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
  }

  private createExpBar(): void {
    const barW = GAME_WIDTH - 30;
    const barH = 6;
    const y = GAME_HEIGHT - 8;

    this.expBarBg = this.add.rectangle(15, y, barW, barH, 0x333333)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(3000);
    this.expBar = this.add.rectangle(15, y, 0, barH, 0x9b59b6)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(3001);

    this.levelText = this.add.text(15, y - 10, '', {
      fontSize: '10px',
      color: '#9b59b6',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(3002);
  }

  private createSkillBar(): void {
    const slotSize = 40;
    const gap = 6;
    const skills = this.player.classData.skills;
    const totalW = skills.length * (slotSize + gap) - gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const y = GAME_HEIGHT - 55;

    for (let i = 0; i < skills.length; i++) {
      const x = startX + i * (slotSize + gap);
      const skill = skills[i];

      const container = this.add.container(x + slotSize / 2, y);
      container.setScrollFactor(0).setDepth(3000);

      // Slot bg
      const bg = this.add.rectangle(0, 0, slotSize, slotSize, 0x2c3e50);
      bg.setStrokeStyle(2, 0x555555);
      container.add(bg);

      // Skill label
      const label = this.add.text(0, -5, skill.name.charAt(0), {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(label);

      // Key hint
      const keyHint = this.add.text(0, 12, `${i + 1}`, {
        fontSize: '10px',
        color: '#95a5a6',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      container.add(keyHint);

      // Cooldown overlay
      const cdOverlay = this.add.rectangle(0, 0, slotSize, slotSize, 0x000000, 0.6);
      cdOverlay.setVisible(false);
      container.add(cdOverlay);
      this.skillCooldownOverlays.push(cdOverlay);

      // Make clickable for mobile
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        EventBus.emit('ui:skill_click', { index: i, skillId: skill.id });
      });

      this.skillSlots.push(container);
    }

    // Auto combat button
    const acX = startX + totalW + gap + 25;
    const acBg = this.add.rectangle(acX, y, 50, slotSize, 0x2c3e50)
      .setStrokeStyle(2, 0x555555)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0).setDepth(3000);

    this.autoCombatText = this.add.text(acX, y, 'AUTO\nOFF', {
      fontSize: '10px',
      color: '#95a5a6',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);

    acBg.on('pointerdown', () => {
      this.player.autoCombat = !this.player.autoCombat;
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `自动战斗: ${this.player.autoCombat ? '开启' : '关闭'}`,
        type: 'system',
      });
    });
  }

  private createLogPanel(): void {
    const panelW = 280;
    const panelH = 130;
    const x = 10;
    const y = GAME_HEIGHT - 200;

    this.logPanel = this.add.rectangle(x, y, panelW, panelH, 0x000000, 0.6)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(2999);

    // Title
    this.add.text(x + 5, y + 2, '[ 战斗日志 ]', {
      fontSize: '10px',
      color: '#f39c12',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(3000);

    for (let i = 0; i < LOG_MAX_LINES; i++) {
      const logText = this.add.text(x + 5, y + 16 + i * 14, '', {
        fontSize: '10px',
        color: '#cccccc',
        fontFamily: 'monospace',
        wordWrap: { width: panelW - 10 },
      }).setScrollFactor(0).setDepth(3000);
      this.logTexts.push(logText);
    }
  }

  private createInfoDisplay(): void {
    this.goldText = this.add.text(GAME_WIDTH - 15, 15, '', {
      fontSize: '12px',
      color: '#f1c40f',
      fontFamily: 'monospace',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(3000);
  }

  private setupEventListeners(): void {
    EventBus.on(GameEvents.LOG_MESSAGE, (data: { text: string; type: string }) => {
      this.addLogMessage(data.text, data.type);
    });
  }

  private addLogMessage(text: string, type: string): void {
    this.logMessages.push({ text, type });
    if (this.logMessages.length > LOG_MAX_LINES) {
      this.logMessages.shift();
    }
    this.updateLogDisplay();
  }

  private updateLogDisplay(): void {
    for (let i = 0; i < LOG_MAX_LINES; i++) {
      if (i < this.logMessages.length) {
        const msg = this.logMessages[i];
        this.logTexts[i].setText(msg.text);
        this.logTexts[i].setColor(this.getLogColor(msg.type));
      } else {
        this.logTexts[i].setText('');
      }
    }
  }

  private getLogColor(type: string): string {
    switch (type) {
      case 'system': return '#f39c12';
      case 'combat': return '#e74c3c';
      case 'loot': return '#2ecc71';
      case 'info': return '#3498db';
      default: return '#cccccc';
    }
  }

  update(time: number): void {
    // Update HP bar
    const hpRatio = this.player.hp / this.player.maxHp;
    this.hpBar.scaleX = Math.max(0, hpRatio);
    this.hpText.setText(`${Math.ceil(this.player.hp)}/${this.player.maxHp}`);

    // Update Mana bar
    const manaRatio = this.player.mana / this.player.maxMana;
    this.manaBar.scaleX = Math.max(0, manaRatio);
    this.manaText.setText(`${Math.ceil(this.player.mana)}/${this.player.maxMana}`);

    // Update EXP bar
    const expNeeded = this.player.expToNextLevel();
    const expRatio = this.player.exp / expNeeded;
    this.expBar.width = (GAME_WIDTH - 30) * expRatio;
    this.levelText.setText(`Lv.${this.player.level} (${this.player.exp}/${expNeeded})`);

    // Update gold
    this.goldText.setText(`${this.player.gold} G`);

    // Update auto combat indicator
    this.autoCombatText.setText(`AUTO\n${this.player.autoCombat ? 'ON' : 'OFF'}`);
    this.autoCombatText.setColor(this.player.autoCombat ? '#2ecc71' : '#95a5a6');

    // Update skill cooldowns
    const skills = this.player.classData.skills;
    for (let i = 0; i < skills.length; i++) {
      const cd = this.player.skillCooldowns.get(skills[i].id) ?? 0;
      const onCooldown = time < cd;
      this.skillCooldownOverlays[i].setVisible(onCooldown);
    }
  }
}
