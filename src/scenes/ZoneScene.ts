import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { cartToIso, worldToTile, euclideanDistance } from '../utils/IsometricUtils';
import { randomInt } from '../utils/MathUtils';
import { EventBus, GameEvents } from '../utils/EventBus';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { PathfindingSystem } from '../systems/PathfindingSystem';
import { FogOfWarSystem } from '../systems/FogOfWarSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { WarriorClass } from '../data/classes/warrior';
import { EmeraldPlainsMap } from '../data/maps/emerald_plains';
import { EmeraldPlainsMonsters } from '../data/monsters/emerald_plains';
import type { MapData, ClassDefinition, MonsterDefinition } from '../data/types';

const TILE_KEYS = ['tile_grass', 'tile_dirt', 'tile_stone', 'tile_water', 'tile_wall', 'tile_camp'];

export class ZoneScene extends Phaser.Scene {
  private player!: Player;
  private monsters: Monster[] = [];
  private mapData!: MapData;
  private pathfinding!: PathfindingSystem;
  private fogOfWar!: FogOfWarSystem;
  private combatSystem!: CombatSystem;
  private mapLayer!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private damageTexts: Phaser.GameObjects.Text[] = [];
  private campPositions: { col: number; row: number }[] = [];

  constructor() {
    super({ key: 'ZoneScene' });
  }

  init(data: { classId: string; mapId: string }): void {
    this.mapData = EmeraldPlainsMap;
    this.campPositions = this.mapData.camps.map(c => ({ col: c.col, row: c.row }));
  }

  create(data: { classId: string; mapId: string }): void {
    this.combatSystem = new CombatSystem();

    // Create map
    this.mapLayer = this.add.container(0, 0);
    this.renderMap();

    // Create player
    const classData = this.getClassData(data.classId);
    this.player = new Player(
      this,
      classData,
      this.mapData.playerStart.col,
      this.mapData.playerStart.row,
    );
    this.player.recalcDerived();

    // Setup pathfinding
    this.pathfinding = new PathfindingSystem(
      this.mapData.collisions,
      this.mapData.cols,
      this.mapData.rows,
    );

    // Setup fog of war
    this.fogOfWar = new FogOfWarSystem(this, this.mapData.cols, this.mapData.rows, 6);
    this.fogOfWar.update(this.player.tileCol, this.player.tileRow);

    // Spawn monsters
    this.spawnMonsters();

    // Camera setup
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.5);

    // Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        ONE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        TWO: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        THREE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        TAB: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
      };
    }

    // Click to move
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;
      const tile = worldToTile(worldX, worldY);

      // Check if clicked on a monster
      const clickedMonster = this.findMonsterAt(tile.col, tile.row);
      if (clickedMonster && clickedMonster.isAlive()) {
        this.player.attackTarget = clickedMonster.id;
        const path = this.pathfinding.findPath(
          Math.round(this.player.tileCol),
          Math.round(this.player.tileRow),
          Math.round(clickedMonster.tileCol),
          Math.round(clickedMonster.tileRow),
        );
        this.player.setPath(path);
        return;
      }

      if (tile.col >= 0 && tile.col < this.mapData.cols &&
          tile.row >= 0 && tile.row < this.mapData.rows) {
        const path = this.pathfinding.findPath(
          Math.round(this.player.tileCol),
          Math.round(this.player.tileRow),
          tile.col,
          tile.row,
        );
        if (path.length > 0) {
          this.player.setPath(path);
          this.player.attackTarget = null;
        }
      }
    });

    // Start UI scene
    this.scene.launch('UIScene', { player: this.player });

    // Listen for player death
    EventBus.on(GameEvents.PLAYER_DIED, () => {
      this.time.delayedCall(2000, () => {
        const camp = this.campPositions[0];
        this.player.respawnAtCamp(camp.col, camp.row);
      });
    });

    EventBus.emit(GameEvents.LOG_MESSAGE, {
      text: `欢迎来到${this.mapData.name}! 点击移动，按1-3使用技能。`,
      type: 'system',
    });
    EventBus.emit(GameEvents.LOG_MESSAGE, {
      text: `按TAB切换自动战斗模式。`,
      type: 'system',
    });
  }

  update(time: number, delta: number): void {
    this.handleKeyboardMovement(delta);
    this.handleSkillInput(time);
    this.player.update(time, delta);

    // Update monsters
    for (const monster of this.monsters) {
      if (monster.isAlive()) {
        monster.update(
          time,
          delta,
          this.player.tileCol,
          this.player.tileRow,
          this.mapData.collisions,
        );
      }
    }

    // Handle combat
    this.handleCombat(time);

    // Auto combat
    if (this.player.autoCombat) {
      this.handleAutoCombat(time);
    }

    // Fog update (throttled)
    if (Math.floor(time / 200) !== Math.floor((time - delta) / 200)) {
      this.fogOfWar.update(
        Math.round(this.player.tileCol),
        Math.round(this.player.tileRow),
      );
    }

    // Update HUD data
    EventBus.emit(GameEvents.PLAYER_HEALTH_CHANGED, {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
    });
    EventBus.emit(GameEvents.PLAYER_MANA_CHANGED, {
      mana: this.player.mana,
      maxMana: this.player.maxMana,
    });
  }

  private handleKeyboardMovement(delta: number): void {
    if (!this.cursors || !this.wasd) return;

    let dx = 0;
    let dy = 0;

    if (this.cursors.up.isDown || this.wasd.W.isDown) { dx -= 1; dy -= 1; }
    if (this.cursors.down.isDown || this.wasd.S.isDown) { dx += 1; dy += 1; }
    if (this.cursors.left.isDown || this.wasd.A.isDown) { dx -= 1; dy += 1; }
    if (this.cursors.right.isDown || this.wasd.D.isDown) { dx += 1; dy -= 1; }

    if (dx !== 0 || dy !== 0) {
      // Cancel pathfinding when using keyboard
      this.player.path = [];

      const speed = this.player.moveSpeed * (delta / 1000) * 0.015;
      const len = Math.sqrt(dx * dx + dy * dy);
      const newCol = this.player.tileCol + (dx / len) * speed;
      const newRow = this.player.tileRow + (dy / len) * speed;

      const checkCol = Math.round(newCol);
      const checkRow = Math.round(newRow);

      if (checkCol >= 0 && checkCol < this.mapData.cols &&
          checkRow >= 0 && checkRow < this.mapData.rows &&
          this.mapData.collisions[checkRow][checkCol]) {
        this.player.moveTo(newCol, newRow);
      }
    }
  }

  private handleSkillInput(time: number): void {
    if (!this.wasd) return;

    if (Phaser.Input.Keyboard.JustDown(this.wasd.TAB)) {
      this.player.autoCombat = !this.player.autoCombat;
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `自动战斗: ${this.player.autoCombat ? '开启' : '关闭'}`,
        type: 'system',
      });
    }

    const skillKeys = [this.wasd.ONE, this.wasd.TWO, this.wasd.THREE];
    const skills = this.player.classData.skills;

    for (let i = 0; i < Math.min(skillKeys.length, skills.length); i++) {
      if (Phaser.Input.Keyboard.JustDown(skillKeys[i])) {
        this.tryUseSkill(skills[i].id, time);
      }
    }
  }

  private tryUseSkill(skillId: string, time: number): void {
    const skill = this.player.getSkill(skillId);
    if (!skill) return;

    if (!this.player.isSkillReady(skillId, time)) {
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `${skill.name} 冷却中...`,
        type: 'combat',
      });
      return;
    }

    if (this.player.mana < skill.manaCost) {
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `法力不足!`,
        type: 'combat',
      });
      return;
    }

    // Find target
    const target = this.findNearestAliveMonster();
    if (!target) return;

    const dist = euclideanDistance(
      this.player.tileCol, this.player.tileRow,
      target.tileCol, target.tileRow,
    );

    if (dist > skill.range + 1) {
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `目标太远!`,
        type: 'combat',
      });
      return;
    }

    this.player.useSkill(skillId, time);
    const level = this.player.getSkillLevel(skillId);

    // Handle buff skills
    if (skill.buff) {
      this.player.buffs.push({
        stat: skill.buff.stat,
        value: skill.buff.value + level * 0.02,
        duration: skill.buff.duration,
        startTime: time,
      });
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `${skill.name} 激活!`,
        type: 'combat',
      });
      this.showSkillEffect(this.player.sprite.x, this.player.sprite.y, 0x3498db);
      return;
    }

    // AOE skill
    if (skill.aoe && skill.aoeRadius) {
      const targets = this.monsters.filter(m =>
        m.isAlive() &&
        euclideanDistance(this.player.tileCol, this.player.tileRow, m.tileCol, m.tileRow) <= skill.aoeRadius!
      );
      for (const t of targets) {
        const result = this.combatSystem.calculateDamage(
          this.player.toCombatEntity(),
          t.toCombatEntity(),
          skill,
          level,
        );
        t.takeDamage(result.damage);
        this.showDamageText(t.sprite.x, t.sprite.y, result.damage, result.isCrit);
        if (!t.isAlive()) {
          this.onMonsterKilled(t);
        }
      }
      this.showSkillEffect(this.player.sprite.x, this.player.sprite.y, 0xe74c3c);
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `${skill.name} 命中 ${targets.length} 个目标!`,
        type: 'combat',
      });
    } else {
      // Single target
      const result = this.combatSystem.calculateDamage(
        this.player.toCombatEntity(),
        target.toCombatEntity(),
        skill,
        level,
      );
      target.takeDamage(result.damage);
      this.showDamageText(target.sprite.x, target.sprite.y, result.damage, result.isCrit);
      if (!target.isAlive()) {
        this.onMonsterKilled(target);
      }
      this.showSkillEffect(target.sprite.x, target.sprite.y, 0xf39c12);
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `${skill.name} 造成 ${result.damage} 点伤害${result.isCrit ? ' (暴击!)' : ''}`,
        type: 'combat',
      });
    }
  }

  private handleCombat(time: number): void {
    // Update player buffs
    this.combatSystem.updateBuffs(
      { buffs: this.player.buffs } as any,
      time,
    );
    this.player.buffs = this.player.buffs.filter(b => time - b.startTime < b.duration);

    // Monster attacks
    for (const monster of this.monsters) {
      if (!monster.isAlive() || monster.state !== 'attack') continue;

      if (time - monster.lastAttackTime >= monster.definition.attackSpeed) {
        monster.lastAttackTime = time;
        const result = this.combatSystem.calculateDamage(
          monster.toCombatEntity(),
          this.player.toCombatEntity(),
        );

        if (result.isDodged) {
          this.showDamageText(this.player.sprite.x, this.player.sprite.y, 0, false, true);
          EventBus.emit(GameEvents.LOG_MESSAGE, {
            text: `${monster.definition.name} 的攻击被闪避!`,
            type: 'combat',
          });
        } else {
          this.player.hp = Math.max(0, this.player.hp - result.damage);
          this.showDamageText(
            this.player.sprite.x,
            this.player.sprite.y,
            result.damage,
            result.isCrit,
            false,
            true,
          );

          if (this.player.hp <= 0) {
            this.player.die();
          }
        }
      }
    }

    // Player auto-attack nearest aggro'd monster
    const target = this.player.attackTarget
      ? this.monsters.find(m => m.id === this.player.attackTarget && m.isAlive())
      : this.findNearestAggroMonster();

    if (target && target.isAlive()) {
      const dist = euclideanDistance(
        this.player.tileCol, this.player.tileRow,
        target.tileCol, target.tileRow,
      );

      if (dist <= this.player.attackRange && time - this.player.lastAttackTime >= this.player.attackSpeed) {
        this.player.lastAttackTime = time;
        const result = this.combatSystem.calculateDamage(
          this.player.toCombatEntity(),
          target.toCombatEntity(),
        );
        target.takeDamage(result.damage);
        this.showDamageText(target.sprite.x, target.sprite.y, result.damage, result.isCrit);

        if (!target.isAlive()) {
          this.onMonsterKilled(target);
          this.player.attackTarget = null;
        }
      }
    }
  }

  private handleAutoCombat(time: number): void {
    // Auto-target nearest monster
    if (!this.player.attackTarget) {
      const nearest = this.findNearestAliveMonster();
      if (nearest) {
        const dist = euclideanDistance(
          this.player.tileCol, this.player.tileRow,
          nearest.tileCol, nearest.tileRow,
        );
        if (dist <= nearest.definition.aggroRange) {
          this.player.attackTarget = nearest.id;
          if (dist > this.player.attackRange) {
            const path = this.pathfinding.findPath(
              Math.round(this.player.tileCol),
              Math.round(this.player.tileRow),
              Math.round(nearest.tileCol),
              Math.round(nearest.tileRow),
            );
            this.player.setPath(path);
          }
        }
      }
    }

    // Auto use skills by priority
    for (const skillId of this.player.autoSkillPriority) {
      const skill = this.player.getSkill(skillId);
      if (!skill) continue;
      if (this.player.isSkillReady(skillId, time) && this.player.mana >= skill.manaCost) {
        const target = this.findNearestAliveMonster();
        if (target) {
          const dist = euclideanDistance(
            this.player.tileCol, this.player.tileRow,
            target.tileCol, target.tileRow,
          );
          if (dist <= skill.range + 1) {
            this.tryUseSkill(skillId, time);
            break;
          }
        }
      }
    }
  }

  private onMonsterKilled(monster: Monster): void {
    const exp = monster.definition.expReward;
    const gold = randomInt(monster.definition.goldReward[0], monster.definition.goldReward[1]);
    this.player.addExp(exp);
    this.player.gold += gold;

    EventBus.emit(GameEvents.LOG_MESSAGE, {
      text: `击杀 ${monster.definition.name}! +${exp}经验 +${gold}金币`,
      type: 'loot',
    });
    EventBus.emit(GameEvents.MONSTER_DIED, {
      id: monster.id,
      name: monster.definition.name,
    });

    // Respawn after delay
    this.time.delayedCall(15000, () => {
      this.respawnMonster(monster);
    });
  }

  private respawnMonster(deadMonster: Monster): void {
    const idx = this.monsters.indexOf(deadMonster);
    if (idx === -1) return;

    const spawnCol = deadMonster.spawnCol + randomInt(-1, 1);
    const spawnRow = deadMonster.spawnRow + randomInt(-1, 1);

    const newMonster = new Monster(this, deadMonster.definition, spawnCol, spawnRow);
    this.monsters[idx] = newMonster;
  }

  private renderMap(): void {
    for (let row = 0; row < this.mapData.rows; row++) {
      for (let col = 0; col < this.mapData.cols; col++) {
        const tileType = this.mapData.tiles[row][col];
        const tileKey = TILE_KEYS[tileType] || 'tile_grass';
        const pos = cartToIso(col, row);

        const tile = this.add.image(pos.x, pos.y, tileKey);
        tile.setDepth(pos.y);
        this.mapLayer.add(tile);

        // Camp indicator
        if (tileType === 5) {
          const campFlag = this.add.rectangle(pos.x, pos.y - 16, 4, 12, 0xf1c40f);
          campFlag.setDepth(pos.y + 1);
          this.mapLayer.add(campFlag);
        }
      }
    }
  }

  private spawnMonsters(): void {
    for (const spawn of this.mapData.spawns) {
      const def = EmeraldPlainsMonsters.find(m => m.id === spawn.monsterId);
      if (!def) continue;
      for (let i = 0; i < spawn.count; i++) {
        const col = spawn.col + randomInt(-2, 2);
        const row = spawn.row + randomInt(-2, 2);
        // Make sure spawn is walkable
        const c = Math.max(1, Math.min(this.mapData.cols - 2, col));
        const r = Math.max(1, Math.min(this.mapData.rows - 2, row));
        if (this.mapData.collisions[r][c]) {
          const monster = new Monster(this, def, c, r);
          this.monsters.push(monster);
        }
      }
    }
  }

  private findNearestAliveMonster(): Monster | null {
    let nearest: Monster | null = null;
    let nearestDist = Infinity;
    for (const m of this.monsters) {
      if (!m.isAlive()) continue;
      const dist = euclideanDistance(
        this.player.tileCol, this.player.tileRow,
        m.tileCol, m.tileRow,
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = m;
      }
    }
    return nearest;
  }

  private findNearestAggroMonster(): Monster | null {
    let nearest: Monster | null = null;
    let nearestDist = Infinity;
    for (const m of this.monsters) {
      if (!m.isAlive() || !m.isAggro()) continue;
      const dist = euclideanDistance(
        this.player.tileCol, this.player.tileRow,
        m.tileCol, m.tileRow,
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = m;
      }
    }
    return nearest;
  }

  private findMonsterAt(col: number, row: number): Monster | null {
    for (const m of this.monsters) {
      if (!m.isAlive()) continue;
      if (Math.abs(m.tileCol - col) < 1.5 && Math.abs(m.tileRow - row) < 1.5) {
        return m;
      }
    }
    return null;
  }

  private showDamageText(
    x: number,
    y: number,
    damage: number,
    isCrit: boolean,
    isDodged = false,
    isPlayerDamage = false,
  ): void {
    let text: string;
    let color: string;
    let size = '14px';

    if (isDodged) {
      text = 'MISS';
      color = '#95a5a6';
    } else if (isPlayerDamage) {
      text = `-${damage}`;
      color = isCrit ? '#ff6b6b' : '#e74c3c';
      if (isCrit) size = '18px';
    } else {
      text = `${damage}`;
      color = isCrit ? '#f1c40f' : '#ffffff';
      if (isCrit) size = '18px';
    }

    const dmgText = this.add.text(x + randomInt(-10, 10), y - 20, text, {
      fontSize: size,
      color,
      fontFamily: 'monospace',
      fontStyle: isCrit ? 'bold' : 'normal',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2000);

    this.tweens.add({
      targets: dmgText,
      y: dmgText.y - 40,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => dmgText.destroy(),
    });
  }

  private showSkillEffect(x: number, y: number, color: number): void {
    const circle = this.add.circle(x, y - 10, 5, color, 0.8);
    circle.setDepth(1500);
    this.tweens.add({
      targets: circle,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => circle.destroy(),
    });
  }

  private getClassData(classId: string): ClassDefinition {
    // For Phase 1, only warrior is fully implemented
    // TODO: Add MageClass and RogueClass
    return WarriorClass;
  }
}
