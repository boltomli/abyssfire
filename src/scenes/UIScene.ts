import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import { getItemBase } from '../data/items/bases';
import { AllMaps, MapOrder } from '../data/maps/index';
import type { Player } from '../entities/Player';
import type { ZoneScene } from './ZoneScene';

const LOG_MAX_LINES = 8;

export class UIScene extends Phaser.Scene {
  private player!: Player;
  private zone!: ZoneScene;

  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private manaBar!: Phaser.GameObjects.Rectangle;
  private manaText!: Phaser.GameObjects.Text;
  private expBar!: Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private autoCombatText!: Phaser.GameObjects.Text;
  private skillSlots: Phaser.GameObjects.Container[] = [];
  private skillCooldownOverlays: Phaser.GameObjects.Rectangle[] = [];
  private logTexts: Phaser.GameObjects.Text[] = [];
  private logMessages: { text: string; type: string }[] = [];
  private questTracker!: Phaser.GameObjects.Text;
  private zoneLabel!: Phaser.GameObjects.Text;

  // Panels
  private inventoryPanel: Phaser.GameObjects.Container | null = null;
  private shopPanel: Phaser.GameObjects.Container | null = null;
  private mapPanel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: { player: Player; zone: ZoneScene }): void {
    this.player = data.player;
    this.zone = data.zone;
  }

  create(): void {
    this.createHPManaBar();
    this.createExpBar();
    this.createSkillBar();
    this.createLogPanel();
    this.createInfoDisplay();
    this.createQuestTracker();
    this.setupEventListeners();
  }

  private createHPManaBar(): void {
    const x = 15, barW = 160, barH = 14;
    const portrait = this.add.rectangle(x + 15, 20, 30, 30, 0x2c3e50).setStrokeStyle(2, 0x3498db).setDepth(3000);
    const classLetter = this.player.classData.id === 'warrior' ? 'W' : this.player.classData.id === 'mage' ? 'M' : 'R';
    this.add.text(x + 15, 20, classLetter, { fontSize: '14px', color: '#3498db', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3001);

    const hpX = x + 38, hpY = 12;
    this.add.rectangle(hpX, hpY, barW, barH, 0x333333).setOrigin(0, 0.5).setDepth(3000);
    this.hpBar = this.add.rectangle(hpX, hpY, barW, barH, 0xe74c3c).setOrigin(0, 0.5).setDepth(3001);
    this.hpText = this.add.text(hpX + barW / 2, hpY, '', { fontSize: '10px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(3002);

    const manaY = hpY + barH + 3;
    this.add.rectangle(hpX, manaY, barW, barH, 0x333333).setOrigin(0, 0.5).setDepth(3000);
    this.manaBar = this.add.rectangle(hpX, manaY, barW, barH, 0x3498db).setOrigin(0, 0.5).setDepth(3001);
    this.manaText = this.add.text(hpX + barW / 2, manaY, '', { fontSize: '10px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(3002);
  }

  private createExpBar(): void {
    const barW = GAME_WIDTH - 30, barH = 6, y = GAME_HEIGHT - 8;
    this.add.rectangle(15, y, barW, barH, 0x333333).setOrigin(0, 0.5).setDepth(3000);
    this.expBar = this.add.rectangle(15, y, 0, barH, 0x9b59b6).setOrigin(0, 0.5).setDepth(3001);
    this.levelText = this.add.text(15, y - 10, '', { fontSize: '10px', color: '#9b59b6', fontFamily: 'monospace' }).setOrigin(0, 0.5).setDepth(3002);
  }

  private createSkillBar(): void {
    const slotSize = 36, gap = 4;
    const skills = this.player.classData.skills;
    const totalW = skills.length * (slotSize + gap) - gap;
    const startX = (GAME_WIDTH - totalW) / 2 - 30;
    const y = GAME_HEIGHT - 48;

    this.skillSlots = [];
    this.skillCooldownOverlays = [];

    for (let i = 0; i < skills.length; i++) {
      const x = startX + i * (slotSize + gap);
      const skill = skills[i];
      const container = this.add.container(x + slotSize / 2, y).setDepth(3000);
      const bg = this.add.rectangle(0, 0, slotSize, slotSize, 0x2c3e50).setStrokeStyle(2, 0x555555);
      container.add(bg);
      container.add(this.add.text(0, -4, skill.name.substring(0, 2), { fontSize: '12px', color: '#fff', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5));
      container.add(this.add.text(0, 12, `${i + 1}`, { fontSize: '9px', color: '#95a5a6', fontFamily: 'monospace' }).setOrigin(0.5));
      const cdOverlay = this.add.rectangle(0, 0, slotSize, slotSize, 0x000000, 0.6).setVisible(false);
      container.add(cdOverlay);
      this.skillCooldownOverlays.push(cdOverlay);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => EventBus.emit(GameEvents.UI_SKILL_CLICK, { index: i, skillId: skill.id }));
      this.skillSlots.push(container);
    }

    // Auto combat button
    const acX = startX + totalW + gap + 20;
    const acBg = this.add.rectangle(acX, y, 44, slotSize, 0x2c3e50).setStrokeStyle(2, 0x555555).setInteractive({ useHandCursor: true }).setDepth(3000);
    this.autoCombatText = this.add.text(acX, y, 'AUTO\nOFF', { fontSize: '9px', color: '#95a5a6', fontFamily: 'monospace', align: 'center' }).setOrigin(0.5).setDepth(3001);
    acBg.on('pointerdown', () => {
      this.player.autoCombat = !this.player.autoCombat;
      EventBus.emit(GameEvents.LOG_MESSAGE, { text: `自动战斗: ${this.player.autoCombat ? '开启' : '关闭'}`, type: 'system' });
    });

    // Inventory button
    const invX = acX + 50;
    const invBg = this.add.rectangle(invX, y, 44, slotSize, 0x2c3e50).setStrokeStyle(2, 0x8e44ad).setInteractive({ useHandCursor: true }).setDepth(3000);
    this.add.text(invX, y, '背包\n(I)', { fontSize: '9px', color: '#8e44ad', fontFamily: 'monospace', align: 'center' }).setOrigin(0.5).setDepth(3001);
    invBg.on('pointerdown', () => this.toggleInventory());
  }

  private createLogPanel(): void {
    const panelW = 260, panelH = 120, x = 10, y = GAME_HEIGHT - 190;
    this.add.rectangle(x, y, panelW, panelH, 0x000000, 0.6).setOrigin(0, 0).setDepth(2999);
    this.add.text(x + 5, y + 2, '[ 战斗日志 ]', { fontSize: '9px', color: '#f39c12', fontFamily: 'monospace' }).setDepth(3000);
    for (let i = 0; i < LOG_MAX_LINES; i++) {
      this.logTexts.push(
        this.add.text(x + 5, y + 14 + i * 13, '', { fontSize: '9px', color: '#ccc', fontFamily: 'monospace', wordWrap: { width: panelW - 10 } }).setDepth(3000)
      );
    }
  }

  private createInfoDisplay(): void {
    this.goldText = this.add.text(GAME_WIDTH - 15, 15, '', { fontSize: '12px', color: '#f1c40f', fontFamily: 'monospace' }).setOrigin(1, 0).setDepth(3000);
    this.zoneLabel = this.add.text(GAME_WIDTH - 15, 30, '', { fontSize: '10px', color: '#95a5a6', fontFamily: 'monospace' }).setOrigin(1, 0).setDepth(3000);
  }

  private createQuestTracker(): void {
    this.questTracker = this.add.text(GAME_WIDTH - 15, 50, '', {
      fontSize: '9px', color: '#f39c12', fontFamily: 'monospace', align: 'right', wordWrap: { width: 200 },
    }).setOrigin(1, 0).setDepth(3000);
  }

  private setupEventListeners(): void {
    EventBus.on(GameEvents.LOG_MESSAGE, (data: { text: string; type: string }) => {
      this.logMessages.push(data);
      if (this.logMessages.length > LOG_MAX_LINES) this.logMessages.shift();
      this.updateLogDisplay();
    });

    EventBus.on(GameEvents.SHOP_OPEN, (data: { npcId: string; shopItems: string[]; type: string }) => {
      this.openShop(data);
    });

    EventBus.on(GameEvents.UI_TOGGLE_PANEL, (data: { panel: string }) => {
      if (data.panel === 'inventory') this.toggleInventory();
      if (data.panel === 'map') this.toggleMap();
    });

    EventBus.on('ui:refresh', (data: { player: Player; zone: ZoneScene }) => {
      this.player = data.player;
      this.zone = data.zone;
    });
  }

  private updateLogDisplay(): void {
    const colors: Record<string, string> = { system: '#f39c12', combat: '#e74c3c', loot: '#2ecc71', info: '#3498db' };
    for (let i = 0; i < LOG_MAX_LINES; i++) {
      if (i < this.logMessages.length) {
        this.logTexts[i].setText(this.logMessages[i].text).setColor(colors[this.logMessages[i].type] ?? '#ccc');
      } else {
        this.logTexts[i].setText('');
      }
    }
  }

  // --- Inventory Panel ---
  private toggleInventory(): void {
    if (this.inventoryPanel) { this.inventoryPanel.destroy(); this.inventoryPanel = null; return; }
    this.closeAllPanels();
    const pw = 350, ph = 400, px = (GAME_WIDTH - pw) / 2, py = 30;
    this.inventoryPanel = this.add.container(px, py).setDepth(4000);
    const bg = this.add.rectangle(0, 0, pw, ph, 0x1a1a2e, 0.95).setOrigin(0, 0).setStrokeStyle(2, 0x3498db);
    this.inventoryPanel.add(bg);
    this.inventoryPanel.add(this.add.text(pw / 2, 10, '背包', { fontSize: '14px', color: '#fff', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5, 0));

    // Close button
    const closeBtn = this.add.text(pw - 15, 8, 'X', { fontSize: '14px', color: '#e74c3c', fontFamily: 'monospace' }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleInventory());
    this.inventoryPanel.add(closeBtn);

    // Equipment slots
    const equipSlots = ['helmet', 'armor', 'gloves', 'boots', 'weapon', 'offhand', 'necklace', 'ring1', 'ring2', 'belt'];
    const slotNames = ['头盔', '铠甲', '手套', '鞋子', '武器', '副手', '项链', '戒指1', '戒指2', '腰带'];
    const slotSize = 28;
    equipSlots.forEach((slot, i) => {
      const sx = 10 + (i % 5) * (slotSize + 4);
      const sy = 32 + Math.floor(i / 5) * (slotSize + 14);
      const eq = this.zone.inventorySystem.equipment[slot as keyof typeof this.zone.inventorySystem.equipment];
      const slotBg = this.add.rectangle(sx + slotSize / 2, sy + slotSize / 2, slotSize, slotSize, eq ? this.getQualityColorNum(eq.quality) : 0x333333).setStrokeStyle(1, 0x555555);
      this.inventoryPanel!.add(slotBg);
      this.inventoryPanel!.add(this.add.text(sx + slotSize / 2, sy + slotSize + 2, slotNames[i], { fontSize: '7px', color: '#999', fontFamily: 'monospace' }).setOrigin(0.5, 0));
      if (eq) {
        this.inventoryPanel!.add(this.add.text(sx + slotSize / 2, sy + slotSize / 2, eq.name.charAt(0), { fontSize: '10px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5));
      }
    });

    // Inventory grid
    const inv = this.zone.inventorySystem.inventory;
    const gridStartY = 100;
    const cols = 8;
    inv.forEach((item, i) => {
      const ix = 10 + (i % cols) * (slotSize + 4);
      const iy = gridStartY + Math.floor(i / cols) * (slotSize + 4);
      const itemBg = this.add.rectangle(ix + slotSize / 2, iy + slotSize / 2, slotSize, slotSize, this.getQualityColorNum(item.quality))
        .setStrokeStyle(1, 0x777).setInteractive({ useHandCursor: true });
      this.inventoryPanel!.add(itemBg);
      this.inventoryPanel!.add(this.add.text(ix + slotSize / 2, iy + slotSize / 2, item.name.charAt(0), { fontSize: '10px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5));
      if (item.quantity > 1) {
        this.inventoryPanel!.add(this.add.text(ix + slotSize - 2, iy + slotSize - 2, `${item.quantity}`, { fontSize: '8px', color: '#ff0', fontFamily: 'monospace' }).setOrigin(1, 1));
      }

      // Click to equip/use
      itemBg.on('pointerdown', () => {
        const base = getItemBase(item.baseId);
        if (base && base.slot) {
          this.zone.inventorySystem.equip(item.uid);
        } else if (base && (base.type === 'consumable' || base.type === 'scroll')) {
          const result = this.zone.inventorySystem.useConsumable(item.uid);
          if (result) {
            if (result.effect === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + result.value);
            if (result.effect === 'mana') this.player.mana = Math.min(this.player.maxMana, this.player.mana + result.value);
          }
        }
        this.toggleInventory(); this.toggleInventory(); // Refresh
      });
    });

    // Stats summary
    const statsY = gridStartY + Math.ceil(inv.length / cols) * (slotSize + 4) + 10;
    const eqStats = this.zone.inventorySystem.getEquipmentStats();
    const statText = Object.entries(eqStats).map(([k, v]) => `${k}: +${v}`).join('  ');
    this.inventoryPanel.add(this.add.text(10, Math.min(statsY, ph - 30), `装备加成: ${statText || '无'}`, { fontSize: '8px', color: '#aaa', fontFamily: 'monospace', wordWrap: { width: pw - 20 } }));
  }

  // --- Shop Panel ---
  private openShop(data: { npcId: string; shopItems: string[]; type: string }): void {
    this.closeAllPanels();
    const pw = 300, ph = 350, px = (GAME_WIDTH - pw) / 2, py = 50;
    this.shopPanel = this.add.container(px, py).setDepth(4000);
    const bg = this.add.rectangle(0, 0, pw, ph, 0x1a1a2e, 0.95).setOrigin(0, 0).setStrokeStyle(2, 0xf39c12);
    this.shopPanel.add(bg);
    const title = data.type === 'blacksmith' ? '铁匠铺' : '商店';
    this.shopPanel.add(this.add.text(pw / 2, 10, title, { fontSize: '14px', color: '#f39c12', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5, 0));
    const closeBtn = this.add.text(pw - 15, 8, 'X', { fontSize: '14px', color: '#e74c3c', fontFamily: 'monospace' }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { this.shopPanel?.destroy(); this.shopPanel = null; });
    this.shopPanel.add(closeBtn);

    data.shopItems.forEach((itemId, i) => {
      const base = getItemBase(itemId);
      if (!base) return;
      const iy = 35 + i * 24;
      if (iy > ph - 30) return;

      const buyPrice = base.sellPrice * 3;
      const canAfford = this.player.gold >= buyPrice;
      const row = this.add.text(10, iy, `${base.name}`, { fontSize: '10px', color: canAfford ? '#fff' : '#666', fontFamily: 'monospace' });
      const price = this.add.text(pw - 10, iy, `${buyPrice}G`, { fontSize: '10px', color: canAfford ? '#f1c40f' : '#666', fontFamily: 'monospace' }).setOrigin(1, 0);
      this.shopPanel!.add(row);
      this.shopPanel!.add(price);

      if (canAfford) {
        const buyBtn = this.add.text(pw - 50, iy, '[买]', { fontSize: '10px', color: '#2ecc71', fontFamily: 'monospace' }).setInteractive({ useHandCursor: true });
        buyBtn.on('pointerdown', () => {
          if (this.player.gold >= buyPrice) {
            this.player.gold -= buyPrice;
            const item = this.zone.lootSystem.createItem(itemId, this.player.level, 'normal');
            if (item) { item.identified = true; this.zone.inventorySystem.addItem(item); }
            this.shopPanel?.destroy(); this.shopPanel = null;
            this.openShop(data); // Refresh
          }
        });
        this.shopPanel!.add(buyBtn);
      }
    });

    this.shopPanel.add(this.add.text(10, ph - 20, `金币: ${this.player.gold}G`, { fontSize: '10px', color: '#f1c40f', fontFamily: 'monospace' }));
  }

  // --- World Map Panel ---
  private toggleMap(): void {
    if (this.mapPanel) { this.mapPanel.destroy(); this.mapPanel = null; return; }
    this.closeAllPanels();
    const pw = 400, ph = 200, px = (GAME_WIDTH - pw) / 2, py = 100;
    this.mapPanel = this.add.container(px, py).setDepth(4000);
    this.mapPanel.add(this.add.rectangle(0, 0, pw, ph, 0x1a1a2e, 0.95).setOrigin(0, 0).setStrokeStyle(2, 0x2ecc71));
    this.mapPanel.add(this.add.text(pw / 2, 10, '暗烬大陆', { fontSize: '14px', color: '#2ecc71', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5, 0));
    const closeBtn = this.add.text(pw - 15, 8, 'X', { fontSize: '14px', color: '#e74c3c', fontFamily: 'monospace' }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleMap());
    this.mapPanel.add(closeBtn);

    MapOrder.forEach((mapId, i) => {
      const map = AllMaps[mapId];
      const x = 30 + i * 75, y = 60;
      const isExplored = true; // Simplified
      const isCurrent = (this.zone as any).currentMapId === mapId;
      const color = isCurrent ? 0x2ecc71 : isExplored ? 0x2c3e50 : 0x111111;
      this.mapPanel!.add(this.add.rectangle(x, y, 60, 40, color).setStrokeStyle(isCurrent ? 2 : 1, isCurrent ? 0x2ecc71 : 0x555555));
      this.mapPanel!.add(this.add.text(x, y, map.name.substring(0, 4), { fontSize: '10px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5));
      this.mapPanel!.add(this.add.text(x, y + 25, `Lv.${map.levelRange[0]}-${map.levelRange[1]}`, { fontSize: '8px', color: '#999', fontFamily: 'monospace' }).setOrigin(0.5));
      // Connection line
      if (i < MapOrder.length - 1) {
        this.mapPanel!.add(this.add.text(x + 38, y, '→', { fontSize: '12px', color: '#555', fontFamily: 'monospace' }).setOrigin(0.5));
      }
    });

    this.mapPanel.add(this.add.text(pw / 2, ph - 20, '按 M 关闭', { fontSize: '9px', color: '#666', fontFamily: 'monospace' }).setOrigin(0.5));
  }

  private closeAllPanels(): void {
    if (this.inventoryPanel) { this.inventoryPanel.destroy(); this.inventoryPanel = null; }
    if (this.shopPanel) { this.shopPanel.destroy(); this.shopPanel = null; }
    if (this.mapPanel) { this.mapPanel.destroy(); this.mapPanel = null; }
  }

  private getQualityColorNum(quality: string): number {
    switch (quality) { case 'magic': return 0x3498db; case 'rare': return 0xf1c40f; case 'legendary': return 0xe67e22; case 'set': return 0x2ecc71; default: return 0x555555; }
  }

  update(time: number): void {
    if (!this.player) return;
    const hpR = this.player.hp / this.player.maxHp;
    this.hpBar.scaleX = Math.max(0, hpR);
    this.hpText.setText(`${Math.ceil(this.player.hp)}/${this.player.maxHp}`);
    const manaR = this.player.mana / this.player.maxMana;
    this.manaBar.scaleX = Math.max(0, manaR);
    this.manaText.setText(`${Math.ceil(this.player.mana)}/${this.player.maxMana}`);
    const expN = this.player.expToNextLevel();
    this.expBar.width = (GAME_WIDTH - 30) * (this.player.exp / expN);
    this.levelText.setText(`Lv.${this.player.level} (${this.player.exp}/${expN})`);
    this.goldText.setText(`${this.player.gold} G`);
    this.autoCombatText.setText(`AUTO\n${this.player.autoCombat ? 'ON' : 'OFF'}`).setColor(this.player.autoCombat ? '#2ecc71' : '#95a5a6');

    // Zone label
    if (this.zone && (this.zone as any).currentMapId) {
      const map = AllMaps[(this.zone as any).currentMapId];
      if (map) this.zoneLabel.setText(map.name);
    }

    // Skill cooldowns
    const skills = this.player.classData.skills;
    for (let i = 0; i < Math.min(skills.length, this.skillCooldownOverlays.length); i++) {
      const cd = this.player.skillCooldowns.get(skills[i].id) ?? 0;
      this.skillCooldownOverlays[i].setVisible(time < cd);
    }

    // Quest tracker
    if (this.zone?.questSystem) {
      const active = this.zone.questSystem.getActiveQuests();
      const lines = active.slice(0, 3).map(({ quest, progress }) => {
        const obj = quest.objectives[0];
        const cur = progress.objectives[0]?.current ?? 0;
        const status = progress.status === 'completed' ? '[完成]' : `(${cur}/${obj.required})`;
        return `${quest.name} ${status}`;
      });
      this.questTracker.setText(lines.join('\n'));
    }
  }
}
