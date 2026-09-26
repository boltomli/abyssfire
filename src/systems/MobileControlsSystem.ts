import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import type { Player } from '../entities/Player';
import { t } from '../i18n';
import { getSkillName } from '../i18n/gameAccessors';
import { getLearnedSkillLoadout } from './SkillProgressionSystem';
import { addButton, joystickTextures, medallionTexture, skillSlotTexture, keyBadgeTexture, type UiButton } from '../ui/UiKit';

const FONT = '"Noto Sans SC", sans-serif';

/** Detect touch-capable mobile/tablet devices */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  // Consider tablets too: small screen or mobile UA with touch
  const isSmallScreen = window.innerWidth <= 1024;
  return isTouchDevice && (isMobileUA || isSmallScreen);
}

interface JoystickState {
  active: boolean;
  pointerId: number;
  dx: number;
  dy: number;
}

export class MobileControlsSystem {
  private scene: Phaser.Scene;
  private player: Player;

  // Joystick elements
  private joystickBase!: Phaser.GameObjects.Image;
  private joystickThumb!: Phaser.GameObjects.Image;
  private joystickContainer!: Phaser.GameObjects.Container;
  private joystickState: JoystickState = { active: false, pointerId: -1, dx: 0, dy: 0 };
  private joystickRadius: number;
  private joystickCenterX = 0;
  private joystickCenterY = 0;

  // Skill buttons
  private skillLoadout: Player['classData']['skills'] = [];
  private skillButtons: Phaser.GameObjects.Container[] = [];
  private skillCdOverlays: Phaser.GameObjects.Rectangle[] = [];

  // Panel buttons
  private panelButtons: Phaser.GameObjects.Container[] = [];

  // Auto-combat button
  private autoCombatBtn!: UiButton;
  private autoCombatLabel!: Phaser.GameObjects.Text;
  private dodgeBtn!: Phaser.GameObjects.Container;
  private targetBtn!: Phaser.GameObjects.Container;

  /**
   * Root container for every touch control. The gameplay camera is zoomed, and
   * scroll-factor-0 objects are still scaled around the camera centre, so the
   * root counter-scales by 1/zoom to keep controls at their screen positions.
   */
  private root!: Phaser.GameObjects.Container;
  private appliedZoom = 0;

  // Responsive sizing
  private scale: number;
  private visible: boolean = true;
  private readonly pointerMoveHandler = (pointer: Phaser.Input.Pointer): void => {
    if (this.joystickState.active && pointer.id === this.joystickState.pointerId) {
      this.updateJoystickThumb(pointer.x, pointer.y, this.joystickCenterX, this.joystickCenterY);
    }
  };
  private readonly pointerUpHandler = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id === this.joystickState.pointerId) {
      this.joystickState.active = false;
      this.joystickState.pointerId = -1;
      this.joystickState.dx = 0;
      this.joystickState.dy = 0;
      this.joystickThumb.setPosition(this.joystickCenterX, this.joystickCenterY);
    }
  };

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.scale = Math.min(GAME_WIDTH, GAME_HEIGHT) / 720;
    this.joystickRadius = 50 * this.scale;
    this.refreshSkillLoadout();

    this.root = this.scene.add.container(0, 0).setDepth(5000).setScrollFactor(0);
    this.createJoystick();
    this.createSkillButtons();
    this.createCombatButtons();
    this.createAutoCombatButton();
    this.createPanelButtons();
    this.applyCameraZoom();
  }

  /** Put an object under the root and make it (and its children) screen-fixed. */
  private attach<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.root.add(obj);
    const fix = (o: Phaser.GameObjects.GameObject) => {
      (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0);
      if (o instanceof Phaser.GameObjects.Container) o.list.forEach(fix);
    };
    fix(obj);
    return obj;
  }

  /** Counter the gameplay camera zoom so controls render at 1:1 screen coordinates. */
  private applyCameraZoom(): void {
    const cam = this.scene.cameras.main;
    const z = cam.zoom || 1;
    if (z === this.appliedZoom) return;
    this.appliedZoom = z;
    const cx = cam.width * cam.originX, cy = cam.height * cam.originY;
    this.root.setScale(1 / z);
    this.root.setPosition(cx - cx / z, cy - cy / z);
  }

  private getSkillLoadout(): typeof this.player.classData.skills {
    return this.skillLoadout;
  }

  private refreshSkillLoadout(): void {
    this.skillLoadout = getLearnedSkillLoadout(
      this.player.classData.skills,
      this.player.skillLevels,
    );
  }

  /** Current movement direction from joystick (in tile-space dx/dy) */
  getDirection(): { dx: number; dy: number } {
    if (!this.joystickState.active) return { dx: 0, dy: 0 };
    // Convert screen-space joystick direction to isometric tile-space
    // Screen right = tile (+col, -row), Screen down = tile (+col, +row)
    // Iso: screenX = (col - row) * halfW, screenY = (col + row) * halfH
    // Inverse: col = screenX/(2*halfW) + screenY/(2*halfH), row = -screenX/(2*halfW) + screenY/(2*halfH)
    const jx = this.joystickState.dx;
    const jy = this.joystickState.dy;
    const dx = jx + jy;  // maps to col direction
    const dy = -jx + jy; // maps to row direction
    return { dx, dy };
  }

  private createJoystick(): void {
    const r = this.joystickRadius;
    const cx = 30 * this.scale + r;
    const cy = GAME_HEIGHT - 30 * this.scale - r;
    this.joystickCenterX = cx;
    this.joystickCenterY = cy;

    this.joystickContainer = this.scene.add.container(0, 0);

    // Base ring + thumb knob (baked once by UiKit)
    const tex = joystickTextures(this.scene, r);
    this.joystickBase = this.scene.add.image(cx, cy, tex.base);
    this.joystickContainer.add(this.joystickBase);

    // Thumb
    this.joystickThumb = this.scene.add.image(cx, cy, tex.thumb);
    this.joystickContainer.add(this.joystickThumb);

    // Touch zone (larger invisible area for easier grab)
    const touchZone = this.scene.add.circle(cx, cy, r * 1.4, 0x000000, 0)
      .setInteractive({ draggable: false });
    this.joystickContainer.add(touchZone);

    touchZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.joystickState.active = true;
      this.joystickState.pointerId = pointer.id;
      this.updateJoystickThumb(pointer.x, pointer.y, cx, cy);
    });

    this.attach(this.joystickContainer);
    this.scene.input.on('pointermove', this.pointerMoveHandler);
    this.scene.input.on('pointerup', this.pointerUpHandler);
  }

  private updateJoystickThumb(px: number, py: number, cx: number, cy: number): void {
    const r = this.joystickRadius;
    let dx = px - cx;
    let dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > r) {
      dx = (dx / dist) * r;
      dy = (dy / dist) * r;
    }
    this.joystickThumb.setPosition(cx + dx, cy + dy);
    // Normalize to -1..1
    this.joystickState.dx = dx / r;
    this.joystickState.dy = dy / r;
  }

  private createSkillButtons(): void {
    const btnSize = 44 * this.scale;
    const gap = 6 * this.scale;
    const skills = this.getSkillLoadout();
    const count = Math.min(skills.length, 6);

    // Layout: 2 columns x 3 rows on right side
    const cols = 2;
    const rows = Math.ceil(count / cols);
    const startX = GAME_WIDTH - (cols * (btnSize + gap)) - 20 * this.scale;
    const startY = GAME_HEIGHT - (rows * (btnSize + gap)) - 20 * this.scale;

    for (let i = 0; i < count; i++) {
      const skill = skills[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (btnSize + gap) + btnSize / 2;
      const y = startY + row * (btnSize + gap) + btnSize / 2;

      const container = this.scene.add.container(x, y);

      const bg = this.scene.add.image(0, 0, skillSlotTexture(this.scene, btnSize, 'normal').key);
      container.add(bg);

      // Skill icon (painted emblem) — falls back to a short name
      const iconKey = `skill_icon_${skill.id}`;
      if (this.scene.textures.exists(iconKey)) {
        container.add(this.scene.add.image(0, 0, iconKey).setDisplaySize(btnSize - 8, btnSize - 8));
      } else {
        container.add(this.scene.add.text(0, 0, getSkillName(skill.id, skill.name).slice(0, 2), {
          fontSize: `${Math.round(11 * this.scale)}px`,
          color: '#e0d8cc',
          fontFamily: FONT,
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5));
      }

      // Cooldown overlay
      const cdOverlay = this.scene.add.rectangle(0, 0, btnSize - 6, btnSize - 6, 0x000000, 0.6).setVisible(false);
      container.add(cdOverlay);
      this.skillCdOverlays.push(cdOverlay);

      // Key badge
      container.add(this.scene.add.image(btnSize / 2 - 9, btnSize / 2 - 8, keyBadgeTexture(this.scene, 14, 13)));
      container.add(this.scene.add.text(btnSize / 2 - 9, btnSize / 2 - 8, `${i + 1}`, {
        fontSize: `${Math.round(9 * this.scale)}px`,
        color: '#f0dcae',
        fontFamily: FONT,
        fontStyle: 'bold',
      }).setOrigin(0.5));

      bg.setInteractive({ useHandCursor: false });
      bg.on('pointerdown', () => {
        EventBus.emit(GameEvents.UI_SKILL_CLICK, { index: i, skillId: skill.id });
      });

      this.attach(container);
      this.skillButtons.push(container);
    }
  }

  private createCombatButtons(): void {
    const btnSize = 44 * this.scale;
    const gap = 6 * this.scale;
    const skills = this.getSkillLoadout();
    const rows = Math.ceil(skills.length / 2);
    const skillTop = GAME_HEIGHT - (rows * (btnSize + gap)) - 20 * this.scale;
    const y = skillTop - btnSize / 2 - gap;
    const right = GAME_WIDTH - 20 * this.scale;

    this.targetBtn = this.createCombatButton(
      right - btnSize / 2,
      y,
      btnSize,
      t('sys.mobile.target'),
      0x6a2a24,
      () => EventBus.emit(GameEvents.UI_TARGET_CYCLE, {}),
    );
    this.dodgeBtn = this.createCombatButton(
      right - btnSize * 1.5 - gap,
      y,
      btnSize,
      t('sys.mobile.dodge'),
      0x1f4a6a,
      () => {
        const direction = this.getDirection();
        EventBus.emit(GameEvents.UI_DODGE_REQUEST, direction);
      },
    );
  }

  private createCombatButton(
    x: number,
    y: number,
    size: number,
    labelText: string,
    color: number,
    onPress: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const bg = this.scene.add.image(0, 0, medallionTexture(this.scene, size, color));
    const label = this.scene.add.text(0, 0, labelText, {
      fontSize: `${Math.round(10 * this.scale)}px`,
      color: '#f0e6d6',
      fontFamily: FONT,
      fontStyle: 'bold',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add([bg, label]);
    bg.setInteractive({ useHandCursor: false });
    bg.on('pointerdown', onPress);
    this.attach(container);
    return container;
  }

  private createAutoCombatButton(): void {
    const btnSize = 44 * this.scale;
    const gap = 6 * this.scale;
    // Place above skill buttons, right-aligned
    const x = GAME_WIDTH - btnSize / 2 - 20 * this.scale - (btnSize + gap);
    const rows = Math.ceil(this.getSkillLoadout().length / 2);
    const skillBlockHeight = rows * (btnSize + gap);
    // One row above the dodge / target medallions (they share the same columns)
    const y = GAME_HEIGHT - skillBlockHeight - 20 * this.scale - btnSize / 2 - gap - (btnSize + gap);

    this.autoCombatBtn = addButton(this.scene, x, y, btnSize * 2 + gap, btnSize, t('sys.mobile.autoCombat.off'), {
      variant: 'secondary',
      fontSize: Math.round(10 * this.scale),
      color: '#b0a8b4',
      onClick: () => {
        this.player.autoCombat = !this.player.autoCombat;
        EventBus.emit(GameEvents.LOG_MESSAGE, {
          text: t('sys.mobile.autoCombat.log', { state: this.player.autoCombat ? t('zone.combat.autoCombatOn') : t('zone.combat.autoCombatOff') }),
          type: 'system',
        });
      },
    });
    this.attach(this.autoCombatBtn);
    this.autoCombatLabel = this.autoCombatBtn.label;
    this.autoCombatLabel.setLineSpacing(2);
    this.autoCombatBtn.bg.setAlpha(0.9);
  }

  private createPanelButtons(): void {
    const btnSize = 36 * this.scale;
    const gap = 4 * this.scale;
    const panels: { label: string; panel: string }[] = [
      { label: t('sys.mobile.panel.inventory'), panel: 'inventory' },
      { label: t('sys.mobile.panel.character'), panel: 'character' },
      { label: t('sys.mobile.panel.skills'), panel: 'skills' },
      { label: t('sys.mobile.panel.map'), panel: 'map' },
      { label: t('sys.mobile.panel.homestead'), panel: 'homestead' },
      { label: t('sys.mobile.panel.quest'), panel: 'quest' },
    ];

    // Top-right horizontal row
    const startX = GAME_WIDTH - panels.length * (btnSize + gap) - 10 * this.scale;
    const y = 10 * this.scale + btnSize / 2;

    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      const x = startX + i * (btnSize + gap) + btnSize / 2;
      const container = addButton(this.scene, x, y, btnSize, btnSize, p.label, {
        variant: 'ghost',
        fontSize: Math.round(9 * this.scale),
        onClick: () => EventBus.emit(GameEvents.UI_TOGGLE_PANEL, { panel: p.panel }),
      });
      this.attach(container);
      container.bg.setAlpha(0.85);

      this.panelButtons.push(container);
    }
  }

  update(_time: number, _delta: number): void {
    this.applyCameraZoom();

    // Update auto-combat label
    if (this.autoCombatLabel) {
      const on = this.player.autoCombat;
      const label = on ? t('sys.mobile.autoCombat.on') : t('sys.mobile.autoCombat.off');
      const color = on ? '#8ff07a' : '#b0a8b4';
      if (this.autoCombatLabel.text !== label) this.autoCombatLabel.setText(label);
      if (this.autoCombatLabel.style.color !== color) this.autoCombatLabel.setColor(color);
    }

    // Update skill cooldown overlays
    const now = this.scene.time.now;
    const skills = this.getSkillLoadout();
    for (let i = 0; i < this.skillButtons.length; i++) {
      if (i >= skills.length) break;
      const cd = this.player.skillCooldowns.get(skills[i].id) ?? 0;
      const overlay = this.skillCdOverlays[i];
      if (overlay && overlay.visible !== now < cd) overlay.setVisible(now < cd);
    }
  }

  refreshSkills(): void {
    this.refreshSkillLoadout();
    for (const button of this.skillButtons) button.destroy();
    this.skillButtons = [];
    this.skillCdOverlays = [];
    this.autoCombatBtn.destroy();
    this.dodgeBtn.destroy();
    this.targetBtn.destroy();
    this.createSkillButtons();
    this.createCombatButtons();
    this.createAutoCombatButton();
    this.setVisible(this.visible);
  }

  refreshLocale(): void {
    this.refreshSkills();
    for (const button of this.panelButtons) button.destroy();
    this.panelButtons = [];
    this.createPanelButtons();
    this.setVisible(this.visible);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.joystickContainer.setVisible(v);
    this.autoCombatBtn.setVisible(v);
    this.dodgeBtn.setVisible(v);
    this.targetBtn.setVisible(v);
    for (const btn of this.skillButtons) btn.setVisible(v);
    for (const btn of this.panelButtons) btn.setVisible(v);
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.pointerMoveHandler);
    this.scene.input.off('pointerup', this.pointerUpHandler);
    this.joystickContainer.destroy();
    this.autoCombatBtn.destroy();
    this.dodgeBtn.destroy();
    this.targetBtn.destroy();
    for (const btn of this.skillButtons) btn.destroy();
    for (const btn of this.panelButtons) btn.destroy();
    this.root.destroy();
  }
}
