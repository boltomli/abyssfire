import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DPR } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import { DisposableScope } from '../utils/DisposableScope';
import { getItemBase, GEM_STAT_MAP } from '../data/items/bases';
import { STAT_DISPLAY } from '../data/items/affixes';
import { SetDefinitions } from '../data/items/sets';
import { DUNGEON_EXCLUSIVE_SETS } from '../data/dungeonData';
import { AllMaps, MapOrder } from '../data/maps/index';
import { getSkillManaCost, getSkillCooldown, getSkillDamageMultiplier, getSkillBuffValue, getSkillBuffDuration, getSkillAoeRadius } from '../systems/CombatSystem';
import { NPCDefinitions } from '../data/npcs';
import { audioManager } from '../systems/audio/AudioManager';
import type { Player } from '../entities/Player';
import type { ZoneScene } from './ZoneScene';
import type { ItemInstance, WeaponBase, ArmorBase, DialogueTree, DialogueNode, DialogueChoice, EquipSlot } from '../data/types';
import { MercenarySystem, MERCENARY_DEFS, MERCENARY_TYPES } from '../systems/MercenarySystem';
import {
  getLearnedSkillLoadout,
  getSkillInvestmentState,
  investSkillPoint,
  type SkillInvestmentState,
} from '../systems/SkillProgressionSystem';
import { QUEST_TYPE_LABELS } from '../systems/QuestSystem';
import { gatherNpcQuests, buildQuestCardData, formatRewardSummary, buildToastMessage } from '../ui/QuestCardUI';
import { buildTrackerState, buildTrackerSignature, MAX_VISIBLE_QUESTS } from '../ui/QuestTrackerHUD';
import type { TrackerQuestEntry, TrackerState } from '../ui/QuestTrackerHUD';
import type { NpcQuestEntry, QuestCardData } from '../ui/QuestCardUI';
import type { MercenaryState } from '../systems/MercenarySystem';
import { LoreByZone, AllLoreEntries, getLoreCountByZone } from '../data/loreCollectibles';
import type { LoreEntry } from '../data/loreCollectibles';
import { t, getLocale } from '../i18n';
import { isMobileDevice } from '../systems/MobileControlsSystem';
import { ensureItemIcon, ensureItemIconFor } from '../graphics/icons/ItemIcons';
import {
  addFrame, addCloseButton, addButton, addTitleFlourishes, addDivider, addVDivider, addSectionHeader,
  addSlot, wireSlotHover, frameTexture, drawCard, drawWell, drawBarFill, tabTexture, backdropTexture, orbTextures,
  skillSlotTexture, keyBadgeTexture, hudPlateTexture, minimapFrameTexture, coinTexture, pipTexture,
  barFrameTexture, barFillTexture, barTicksTexture, qualityHex, qualityNum, UI_COLORS,
  type UiButton, type ButtonOptions, type CardStyle,
} from '../ui/UiKit';
import { getItemDisplayName, getItemBaseName, getItemBaseDesc, getAffixName, getStatLabel, isStatPercent, getQualityLabel, getSetName, getSetBonusDesc, getClassName, getDirection as getLocalizedDirection, getSkillName, getSkillDesc, getSkillTreeName, getDamageTypeName, getQuestName, getQuestDesc, getZoneName, getMercenaryName, getMercenaryDesc, getMercenaryTypeLabel, getBuildingName, getBuildingDesc, getPetName, getPetDesc, getAchievementName, getAchievementDesc, getAchievementTitle, getLoreName, getLoreText, getNpcName, getQuestTargetName, getPetStatLabel } from '../i18n/gameAccessors';

const FONT = '"Noto Sans SC", sans-serif';
const TITLE_FONT = '"Cinzel", "Noto Sans SC", serif';
const LOG_MAX_LINES = 8;
const GLOBE_R = Math.round(44 * DPR);

/** Unified panel styling config used by ALL panels for visual consistency. */
const PANEL_STYLE = {
  /** Panel background (opaque — frames are baked by UiKit) */
  bg: { color: 0x141116, alpha: 1 },
  /** Panel border — same for all panels */
  border: { color: 0xd4a54a, width: 2, radius: 7 },
  /** Header area */
  header: {
    height: 36,
    font: TITLE_FONT,
    fontSize: 18,
    color: '#f0dcae',
  },
  /** Close button */
  close: {
    fontSize: 16,
    color: '#e74c3c',
    hoverColor: '#ff6666',
  },
  /** Depth layering */
  depth: {
    backdrop: 3999,
    panel: 4000,
    subPanel: 4001,
    tooltip: 5000,
    contextMenu: 5001,
    confirmDialog: 5002,
    toast: 6000,
  },
  /** Tooltip styling */
  tooltip: {
    bg: { color: 0x141116, alpha: 1 },
    border: { color: 0xd4a54a, width: 1.5 },
    font: FONT,
    titleSize: 13,
    bodySize: 11,
    lineSpacing: 2,
    padding: 10,
  },
} as const;

/** Item quality text colours (art-direction.md). */
const QUALITY_TEXT = {
  normal: '#c8c8c8', magic: '#4f8cff', rare: '#ffd84a', legendary: '#ff8a2a', set: '#3ecf6a',
} as const;

const W = GAME_WIDTH * DPR;
const H = GAME_HEIGHT * DPR;

function fs(basePx: number): string {
  return `${Math.round(basePx * DPR)}px`;
}

const px = (n: number) => Math.round(n * DPR);

/** Plate-variant frame texture key (frame margin is 8px on every side). */
function frameTextureKey(scene: Phaser.Scene, w: number, h: number, alpha = 1): string {
  return frameTexture(scene, w, h, { variant: 'plate', alpha }).key;
}

const MINIMAP_SIZE = px(104);
/** Mobile shows a row of panel buttons along the top-right edge; push the HUD cluster below it. */
const IS_MOBILE = isMobileDevice();
const TOP_RIGHT_OFFSET = IS_MOBILE ? px(48) : 0;

/** Fixed HUD layout (logical px). */
const HUD = (() => {
  const slot = px(44), gap = px(6);
  const utilW = px(50), utilGap = px(5), utilCount = 3, sepGap = px(12);
  const skillsW = 6 * slot + 5 * gap;
  const utilsW = utilCount * utilW + (utilCount - 1) * utilGap;
  const barW = skillsW + sepGap + utilsW;
  const startX = Math.round((W - barW) / 2);
  const rowY = H - px(44);
  const plateL = startX - px(18), plateR = startX + barW + px(18);
  const plateTop = rowY - slot / 2 - px(26);
  const orbY = H - px(52);
  const spiritH = px(6);
  const infoW = px(210), infoH = px(46);
  const info = { x: W - px(12) - infoW, y: px(12) + TOP_RIGHT_OFFSET, w: infoW, h: infoH };
  const mmPad = px(9);
  const minimap = { x: W - px(12) - mmPad - MINIMAP_SIZE, y: info.y + infoH + px(10) + mmPad };
  return {
    slot, gap, startX, rowY, barW,
    utilX: startX + skillsW + sepGap, utilW, utilGap,
    plateL, plateR, plateTop,
    orbY, hpX: plateL - GLOBE_R + px(16), mpX: plateR + GLOBE_R - px(16),
    spiritX: startX + px(40), spiritW: skillsW - px(40), spiritH, spiritY: rowY - slot / 2 - px(12),
    expX: startX, expW: barW, expH: px(8), expY: H - px(11),
    // On touch devices the joystick owns the bottom-left corner, so the log moves up
    log: { x: px(12), y: IS_MOBILE ? H - px(330) : H - px(12) - px(150), w: px(290), h: px(150) },
    info,
    minimap,
    tracker: { x: W - px(222), y: minimap.y + MINIMAP_SIZE + mmPad + px(14) },
    loot: IS_MOBILE
      ? { x: Math.round(W / 2 - px(118)), y: plateTop - px(44) }
      : { x: W - px(12) - px(236), y: H - px(12) - px(34) },
  };
})();

/** Strip legacy "[...]" decoration from labels that now render as framed buttons. */
function btnLabel(s: string): string {
  return s.replace(/^\s*[\[【]\s*/, '').replace(/\s*[\]】]\s*$/, '');
}

function getDirection(dc: number, dr: number): string {
  return getLocalizedDirection(dc, dr);
}

export class UIScene extends Phaser.Scene {
  private subscriptions = new DisposableScope();
  private player!: Player;
  private zone!: ZoneScene;

  private hpBar!: Phaser.GameObjects.TileSprite;
  private hpText!: Phaser.GameObjects.Text;
  private manaBar!: Phaser.GameObjects.TileSprite;
  private manaText!: Phaser.GameObjects.Text;
  /** Smoothed orb fill levels (0..1). */
  private hpLevel = 1;
  private manaLevel = 1;
  private orbSurfaceOffset = 7;
  private spiritBar!: Phaser.GameObjects.Image;
  private spiritBarBg!: Phaser.GameObjects.Image;
  private spiritShown = -1;
  private spiritLabel!: Phaser.GameObjects.Text;
  private spiritText!: Phaser.GameObjects.Text;
  private resonanceText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private targetFrame!: Phaser.GameObjects.Container;
  private targetHpFill!: Phaser.GameObjects.Image;
  private targetHpW = 0;
  private targetHpShown = -1;
  private nextTargetRefreshAt = 0;
  private currentTargetId: string | null = null;
  private currentTargetName: string | null = null;
  private dodgeText!: Phaser.GameObjects.Text;
  private dodgeDot!: Phaser.GameObjects.Arc;
  private expBar!: Phaser.GameObjects.Image;
  private expShown = -1;
  private levelText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private autoCombatText!: Phaser.GameObjects.Text;
  private skillLoadout: Player['classData']['skills'] = [];
  private skillSlots: Phaser.GameObjects.Container[] = [];
  private skillCooldownOverlays: Phaser.GameObjects.Graphics[] = [];
  private skillCooldownTexts: Phaser.GameObjects.Text[] = [];
  private skillReadyFlash: Phaser.GameObjects.Rectangle[] = [];
  private skillCdLastFrac: number[] = [];
  private skillCdActive: boolean[] = [];
  private lootNotices: Phaser.GameObjects.Container[] = [];
  private logTexts: Phaser.GameObjects.Text[] = [];
  private logMessages: { text: string; type: string }[] = [];
  private questTracker!: Phaser.GameObjects.Container;
  private questTrackerTexts: Phaser.GameObjects.Text[] = [];
  /** Set of quest IDs that the player has expanded in the tracker. */
  private questTrackerExpanded: Set<string> = new Set();
  /** Scroll offset for the tracker (when > MAX_VISIBLE_QUESTS). */
  private questTrackerScrollOffset = 0;
  /** Cached tracker state for scroll-indicator rendering. */
  private questTrackerState: TrackerState | null = null;
  /** Background rectangle for the tracker panel. */
  private questTrackerBg: Phaser.GameObjects.Image | null = null;
  /** Scroll indicator text (e.g. "▼ 3 more quests"). */
  private questTrackerScrollText: Phaser.GameObjects.Text | null = null;
  private zoneLabel!: Phaser.GameObjects.Text;

  private inventoryPanel: Phaser.GameObjects.Container | null = null;
  private shopPanel: Phaser.GameObjects.Container | null = null;
  private shopNpcId: string | null = null;
  private mapPanel: Phaser.GameObjects.Container | null = null;
  private skillPanel: Phaser.GameObjects.Container | null = null;
  private charPanel: Phaser.GameObjects.Container | null = null;
  private homesteadPanel: Phaser.GameObjects.Container | null = null;
  private dialoguePanel: Phaser.GameObjects.Container | null = null;
  private dialogueBackdrop: Phaser.GameObjects.Image | null = null;
  private questLogPanel: Phaser.GameObjects.Container | null = null;
  private questLogTab: 'active' | 'completed' = 'active';
  private questLogPage = 0;
  private questLogSelectedIndex = 0;
  private minimap!: Phaser.GameObjects.Graphics;
  private tooltipContainer: Phaser.GameObjects.Container | null = null;
  private inventoryPage = 0;
  private shopInventoryPage = 0;
  private autoLootText!: Phaser.GameObjects.Text;
  private contextPopup: Phaser.GameObjects.Container | null = null;
  private audioPanel: Phaser.GameObjects.Container | null = null;
  private audioPanelInputCleanup: Array<() => void> = [];
  private companionPanel: Phaser.GameObjects.Container | null = null;
  private socketPanel: Phaser.GameObjects.Container | null = null;
  private socketPanelSlot: string | null = null;
  private achievementPanel: Phaser.GameObjects.Container | null = null;
  private nextMinimapRefreshAt = 0;
  private nextQuestTrackerRefreshAt = 0;
  private lastQuestTrackerSignature = '';
  /** Dialogue tree state: visited nodes and choices per NPC. */
  private dialogueTreeState: Record<string, { visitedNodes: string[]; choicesMade: Record<string, string> }> = {};
  /** Current dialogue tree scroll offset for long text. */
  private dialogueScrollY = 0;
  /** Mini-boss cinematic dialogue panel. */
  private miniBossDialoguePanel: Phaser.GameObjects.Container | null = null;
  private miniBossDialogueBackdrop: Phaser.GameObjects.Image | null = null;
  /** Lore text popup panel. */
  private loreTextPanel: Phaser.GameObjects.Container | null = null;
  private loreTextBackdrop: Phaser.GameObjects.Image | null = null;
  /** Lore log sub-tab in quest log. */
  private questLogLoreTab = false;
  /** Compact quest card panel. */
  private questCardPanel: Phaser.GameObjects.Container | null = null;
  private questCardBackdrop: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: { player: Player; zone: ZoneScene }): void {
    this.player = data.player;
    this.zone = data.zone;
    this.refreshSkillLoadout();
  }

  create(): void {
    this.subscriptions = new DisposableScope();
    this.skillSlots = [];
    this.skillCooldownOverlays = [];
    this.skillCooldownTexts = [];
    this.skillReadyFlash = [];
    this.skillCdLastFrac = [];
    this.skillCdActive = [];
    this.lootNotices = [];
    this.hpLevel = 1;
    this.manaLevel = 1;
    this.spiritShown = -1;
    this.expShown = -1;
    this.targetHpShown = -1;
    this.logTexts = [];
    this.logMessages = [];
    this.questTrackerTexts = [];
    this.questTrackerExpanded = new Set();
    this.questTrackerScrollOffset = 0;
    this.questTrackerState = null;
    this.questTrackerBg = null;
    this.questTrackerScrollText = null;
    this.nextMinimapRefreshAt = 0;
    this.nextQuestTrackerRefreshAt = 0;
    this.lastQuestTrackerSignature = '';
    this.createHPManaBar();
    this.createCombatFeedback();
    this.createExpBar();
    this.createSkillBar();
    this.createLogPanel();
    this.createInfoDisplay();
    this.createQuestTracker();
    this.createMinimap();
    this.setupEventListeners();
    this.events.once('shutdown', this.shutdown, this);
  }

  private createHPManaBar(): void {
    // Carved plate behind the skill row / spirit bar / exp bar, bridging both orbs
    this.add.image(HUD.plateL, HUD.plateTop, hudPlateTexture(this, HUD.plateR - HUD.plateL, H - HUD.plateTop + px(4)))
      .setOrigin(0, 0).setDepth(2998);

    // HP Globe (left)
    const hp = this.createGlobe(HUD.hpX, HUD.orbY, GLOBE_R, 'hp', 0xc0281e);
    this.hpBar = hp.fill;
    this.hpText = hp.text;

    // Mana Globe (right)
    const mp = this.createGlobe(HUD.mpX, HUD.orbY, GLOBE_R, 'mp', 0x2a5fd6);
    this.manaBar = mp.fill;
    this.manaText = mp.text;
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

  /** Glass liquid orb: dark back, masked wavy liquid (TileSprite), glass shine, ornate rim. */
  private createGlobe(
    cx: number, cy: number, radius: number,
    name: string, liquidColor: number,
  ): { fill: Phaser.GameObjects.TileSprite; text: Phaser.GameObjects.Text } {
    const d = 3000;
    const tex = orbTextures(this, radius, name, liquidColor);
    this.orbSurfaceOffset = tex.surface;

    this.add.image(cx, cy, tex.back).setDepth(d - 1);

    const maskGfx = this.make.graphics({});
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillCircle(cx, cy, radius - 1);
    const mask = maskGfx.createGeometryMask();

    const fill = this.add.tileSprite(cx, cy + radius, radius * 2, tex.liquidH, tex.liquid)
      .setOrigin(0.5, 0).setDepth(d);
    fill.setMask(mask);

    this.add.image(cx, cy, tex.glass).setDepth(d + 1);
    this.add.image(cx, cy, tex.rim).setDepth(d + 2);

    const text = this.add.text(cx, cy + px(2), '', {
      fontSize: fs(13), color: '#ffffff', fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0.5).setDepth(d + 3);

    return { fill, text };
  }

  private createExpBar(): void {
    const { key, pad } = barFrameTexture(this, HUD.expW, HUD.expH);
    this.add.image(HUD.expX - pad, HUD.expY - HUD.expH / 2 - pad, key).setOrigin(0, 0).setDepth(3000);
    this.expBar = this.add.image(HUD.expX, HUD.expY - HUD.expH / 2, barFillTexture(this, HUD.expW, HUD.expH, 0x9b4fd0))
      .setOrigin(0, 0).setDepth(3001);
    this.expBar.setCrop(0, 0, 0, HUD.expH);
    this.add.image(HUD.expX, HUD.expY - HUD.expH / 2, barTicksTexture(this, HUD.expW, HUD.expH, 10))
      .setOrigin(0, 0).setDepth(3002);
    this.levelText = this.add.text(W / 2, HUD.expY, '', {
      fontSize: fs(10), color: '#ecd9ff', fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0.5, 0.5).setDepth(3003);
  }

  private createCombatFeedback(): void {
    // Spirit bar — sits on the HUD plate directly above the skill slots
    const barX = HUD.spiritX;
    const barY = HUD.spiritY;
    this.spiritLabel = this.add.text(HUD.startX, barY, t('ui.hud.spirit'), {
      fontSize: fs(10),
      color: '#f0b060',
      fontFamily: FONT,
      fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0, 0.5).setDepth(3002);
    const { key, pad } = barFrameTexture(this, HUD.spiritW, HUD.spiritH);
    this.spiritBarBg = this.add.image(barX - pad, barY - HUD.spiritH / 2 - pad, key).setOrigin(0, 0).setDepth(3000);
    this.spiritBar = this.add.image(
      barX, barY - HUD.spiritH / 2,
      barFillTexture(this, HUD.spiritW, HUD.spiritH, this.player.spirit.profile.visualColor),
    ).setOrigin(0, 0).setDepth(3001);
    this.spiritBar.setCrop(0, 0, 0, HUD.spiritH);
    this.spiritText = this.add.text(barX + HUD.spiritW + px(8), barY, '', {
      fontSize: fs(10),
      color: '#f0c080',
      fontFamily: FONT,
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0, 0.5).setDepth(3002);
    this.resonanceText = this.add.text(barX + HUD.spiritW / 2, barY - px(14), '', {
      fontSize: fs(11),
      color: '#ffd27a',
      fontFamily: FONT,
      fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0.5, 0.5).setDepth(3002);

    // Target frame (top centre) — hidden until something is targeted
    const tfW = px(280), tfH = px(44);
    this.targetFrame = this.add.container(W / 2, px(10)).setDepth(3000).setVisible(false);
    this.targetFrame.add(addFrame(this, -tfW / 2, 0, tfW, tfH, { variant: 'plate', accent: 0xc0503c }));
    this.targetText = this.add.text(0, px(13), t('ui.hud.targetNone'), {
      fontSize: fs(12),
      color: '#777788',
      fontFamily: FONT,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0.5, 0.5);
    this.targetFrame.add(this.targetText);
    const thW = tfW - px(36), thH = px(8);
    const thFrame = barFrameTexture(this, thW, thH);
    this.targetFrame.add(this.add.image(-thW / 2 - thFrame.pad, px(29) - thH / 2 - thFrame.pad, thFrame.key).setOrigin(0, 0));
    this.targetHpFill = this.add.image(-thW / 2, px(29) - thH / 2, barFillTexture(this, thW, thH, 0xc0281e)).setOrigin(0, 0);
    this.targetHpW = thW;
    this.targetHpFill.setCrop(0, 0, thW, thH);
    this.targetFrame.add(this.targetHpFill);

    // Dodge indicator (top-left plate)
    const dpW = px(158), dpH = px(26);
    this.add.image(0, 0, frameTextureKey(this, dpW, dpH)).setOrigin(0, 0)
      .setPosition(px(12) - px(8), px(12) - px(8)).setDepth(2999);
    this.dodgeText = this.add.text(px(24), px(12) + dpH / 2, t('ui.hud.dodgeReady'), {
      fontSize: fs(11),
      color: '#9bd7ff',
      fontFamily: FONT,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0, 0.5).setDepth(3000);
    this.dodgeDot = this.add.circle(px(17), px(12) + dpH / 2, px(3), 0x9bd7ff).setDepth(3000);
  }

  private createSkillBar(): void {
    const slotSize = HUD.slot, gap = HUD.gap;
    const skills = this.getSkillLoadout();
    const startX = HUD.startX;
    const y = HUD.rowY;

    this.skillSlots = [];
    this.skillCooldownOverlays = [];
    this.skillCooldownTexts = [];
    this.skillReadyFlash = [];
    this.skillCdLastFrac = [];
    this.skillCdActive = [];

    const badge = keyBadgeTexture(this, px(14), px(13));
    for (let i = 0; i < 6; i++) {
      const x = startX + i * (slotSize + gap);
      const skill = skills[i];
      const container = this.add.container(x + slotSize / 2, y).setDepth(3000);
      const normalKey = skillSlotTexture(this, slotSize, skill ? 'normal' : 'empty').key;
      const bg = this.add.image(0, 0, normalKey);
      container.add(bg);
      if (!skill) {
        container.add(this.add.text(slotSize / 2 - px(9), slotSize / 2 - px(8), `${i + 1}`, {
          fontSize: fs(9), color: '#4a4450', fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0.5));
        this.skillSlots.push(container);
        continue;
      }
      const iconKey = `skill_icon_${skill.id}`;
      if (this.textures.exists(iconKey)) {
        container.add(this.add.image(0, 0, iconKey)
          .setDisplaySize(slotSize - px(8), slotSize - px(8)));
      } else {
        container.add(this.add.text(0, 0, getSkillName(skill.id, skill.name).substring(0, 2), {
          fontSize: fs(15), color: '#e0d8cc', fontFamily: FONT, fontStyle: 'bold',
          stroke: '#000000', strokeThickness: Math.round(2 * DPR),
        }).setOrigin(0.5));
      }
      const cdOverlay = this.add.graphics();
      container.add(cdOverlay);
      this.skillCooldownOverlays.push(cdOverlay);
      this.skillCdLastFrac.push(-1);
      this.skillCdActive.push(false);
      const flash = this.add.rectangle(0, 0, slotSize - px(6), slotSize - px(6), 0xfff0c0, 0).setBlendMode(Phaser.BlendModes.ADD);
      container.add(flash);
      this.skillReadyFlash.push(flash);
      container.add(this.add.image(slotSize / 2 - px(9), slotSize / 2 - px(8), badge));
      container.add(this.add.text(slotSize / 2 - px(9), slotSize / 2 - px(8), `${i + 1}`, {
        fontSize: fs(9), color: '#f0dcae', fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(0.5));
      const cdText = this.add.text(0, 0, '', {
        fontSize: fs(15), color: '#ffffff', fontFamily: FONT, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: Math.round(3 * DPR),
      }).setOrigin(0.5).setVisible(false);
      container.add(cdText);
      this.skillCooldownTexts.push(cdText);
      const hoverKey = skillSlotTexture(this, slotSize, 'hover').key;
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setTexture(hoverKey));
      bg.on('pointerout', () => bg.setTexture(normalKey));
      bg.on('pointerdown', () => EventBus.emit(GameEvents.UI_SKILL_CLICK, { index: i, skillId: skill.id }));
      this.skillSlots.push(container);
    }

    // Utility buttons — evenly spaced after skill slots
    const utilStartX = HUD.utilX;
    const utilW = HUD.utilW, utilGap = HUD.utilGap;

    // Auto combat button
    const acBtn = this.makeButton(utilStartX + utilW / 2, y, utilW, slotSize, t('ui.hud.autoCombat.off'), () => {
      this.player.autoCombat = !this.player.autoCombat;
      EventBus.emit(GameEvents.LOG_MESSAGE, { text: this.player.autoCombat ? t('ui.hud.autoCombatLog.on') : t('ui.hud.autoCombatLog.off'), type: 'system' });
    }, { fontSize: 10, color: '#b0a8b4' });
    acBtn.setDepth(3000);
    this.autoCombatText = acBtn.label;

    // Auto-loot button
    const alBtn = this.makeButton(utilStartX + utilW * 1.5 + utilGap, y, utilW, slotSize, t('ui.hud.autoLoot.off'), () => {
      const modes: Array<'off' | 'all' | 'magic' | 'rare' | 'legendary'> = ['off', 'all', 'magic', 'rare', 'legendary'];
      const idx = modes.indexOf(this.player.autoLootMode);
      this.player.autoLootMode = modes[(idx + 1) % modes.length];
    }, { fontSize: 10, color: '#b0a8b4' });
    alBtn.setDepth(3000);
    this.autoLootText = alBtn.label;

    // Inventory button
    const invBtn = this.makeButton(utilStartX + utilW * 2.5 + utilGap * 2, y, utilW, slotSize, t('ui.hud.inventoryBtn'), () => this.toggleInventory(), {
      fontSize: 10, variant: 'primary', bold: true,
    });
    invBtn.setDepth(3000);
  }

  private createLogPanel(): void {
    this.logTexts = [];
    const { x, y, w, h } = HUD.log;
    this.add.image(0, 0, frameTextureKey(this, w, h, 0.9)).setOrigin(0, 0)
      .setPosition(x - px(8), y - px(8)).setDepth(2999);
    const header = addSectionHeader(this, x + px(10), y + px(12), w - px(20), t('ui.hud.combatLog'));
    for (const o of header) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(3000);
    for (let i = 0; i < LOG_MAX_LINES; i++) {
      this.logTexts.push(
        this.add.text(x + px(10), y + px(24) + i * px(14), '', {
          fontSize: fs(12), color: '#aaa', fontFamily: FONT, lineSpacing: px(1),
          wordWrap: { width: w - px(20), useAdvancedWrap: true },
          stroke: '#000000', strokeThickness: Math.round(2 * DPR),
        }).setDepth(3000)
      );
    }
  }

  private createInfoDisplay(): void {
    const { x, y, w, h } = HUD.info;
    this.add.image(0, 0, frameTextureKey(this, w, h)).setOrigin(0, 0)
      .setPosition(x - px(8), y - px(8)).setDepth(2999);
    this.zoneLabel = this.add.text(x + w / 2, y + px(14), '', {
      fontSize: fs(13), color: UI_COLORS.parchment, fontFamily: TITLE_FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0.5, 0.5).setDepth(3000);
    this.add.image(x + w / 2 - px(34), y + px(33), coinTexture(this, px(13))).setDepth(3000);
    this.goldText = this.add.text(x + w / 2 - px(24), y + px(33), '', {
      fontSize: fs(13), color: '#ffd35a', fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0, 0.5).setDepth(3000);
  }

  private createQuestTracker(): void {
    this.questTrackerTexts = [];
    this.lastQuestTrackerSignature = '';
    // Position on right side, below the minimap frame
    const trackerX = HUD.tracker.x;
    const trackerY = HUD.tracker.y;
    this.questTracker = this.add.container(trackerX, trackerY).setDepth(3000);

    // Framed background (re-baked only when the tracker's height changes)
    this.questTrackerBg = this.add.image(0, 0, frameTextureKey(this, px(218), px(24), 0.9))
      .setOrigin(0, 0).setDepth(2999);
    this.questTrackerBg.setVisible(false);

    // Header text
    const header = this.add.text(0, 0, t('ui.questTracker.header'), {
      fontFamily: TITLE_FONT, fontSize: fs(12), color: UI_COLORS.heading, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0, 0);
    this.questTracker.add(header);

    // Scroll indicator text (hidden by default)
    this.questTrackerScrollText = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: fs(10), color: '#888888',
    }).setOrigin(0, 0).setVisible(false);
    this.questTracker.add(this.questTrackerScrollText);
  }

  /** Loot pickup notices (icon + quality-coloured name), stacked bottom-right. */
  private handleItemPicked(data: { item?: ItemInstance }): void {
    const item = data?.item;
    if (!item) return;
    const nW = px(236), nH = px(34);
    const notice = this.add.container(HUD.loot.x, HUD.loot.y).setDepth(3050).setAlpha(0);
    notice.add(addFrame(this, 0, 0, nW, nH, { variant: 'tooltip', accent: qualityNum(item.quality) }));
    const slot = this.createItemSlot(px(18), nH / 2, px(26), item, { interactive: false, showCount: false });
    notice.add(slot.objects);
    const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
    const label = this.add.text(px(38), nH / 2, `${getItemDisplayName(item)}${qty}`, {
      fontSize: fs(12), color: qualityHex(item.quality), fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0, 0.5);
    if (label.width > nW - px(46)) label.setScale((nW - px(46)) / label.width, 1);
    notice.add(label);
    this.lootNotices.unshift(notice);
    while (this.lootNotices.length > 4) {
      const old = this.lootNotices.pop();
      old?.destroy();
    }
    this.layoutLootNotices();
    notice.x += px(24);
    this.tweens.add({ targets: notice, alpha: 1, x: HUD.loot.x, duration: 220, ease: 'Cubic.easeOut' });
    this.time.delayedCall(3200, () => {
      if (!notice.active) return;
      this.tweens.add({
        targets: notice, alpha: 0, duration: 400,
        onComplete: () => {
          this.lootNotices = this.lootNotices.filter(n => n !== notice);
          notice.destroy();
        },
      });
    });
  }

  private layoutLootNotices(): void {
    this.lootNotices.forEach((n, i) => {
      const targetY = HUD.loot.y - i * px(40);
      if (i === 0) n.y = targetY;
      else this.tweens.add({ targets: n, y: targetY, duration: 150 });
    });
  }

  private setupEventListeners(): void {
    this.subscriptions.on(EventBus, GameEvents.LOG_MESSAGE, this.handleLogMessage, this);
    this.subscriptions.on(EventBus, GameEvents.SHOP_OPEN, this.handleShopOpen, this);
    this.subscriptions.on(EventBus, GameEvents.NPC_INTERACT, this.handleNpcInteract, this);
    this.subscriptions.on(EventBus, GameEvents.UI_TOGGLE_PANEL, this.handlePanelToggle, this);
    this.subscriptions.on(EventBus, GameEvents.MINIBOSS_DIALOGUE, this.handleMiniBossDialogue, this);
    this.subscriptions.on(EventBus, GameEvents.LORE_COLLECTED, this.handleLoreCollected, this);
    this.subscriptions.on(EventBus, GameEvents.ACHIEVEMENT_UNLOCKED, this.handleAchievementUnlocked, this);
    this.subscriptions.on(EventBus, GameEvents.TARGET_CHANGED, this.handleTargetChanged, this);
    this.subscriptions.on(EventBus, GameEvents.ITEM_PICKED, this.handleItemPicked, this);
    this.subscriptions.on(EventBus, GameEvents.SKILL_LEVEL_CHANGED, this.handleSkillLevelChanged, this);
    this.subscriptions.on(EventBus, 'ui:refresh', this.handleUiRefresh, this);
    this.subscriptions.on(EventBus, GameEvents.LOCALE_CHANGED, this.handleLocaleChanged, this);
    // Quest events — force immediate tracker refresh
    this.subscriptions.on(EventBus, GameEvents.QUEST_ACCEPTED, this.handleQuestTrackerDirty, this);
    this.subscriptions.on(EventBus, GameEvents.QUEST_COMPLETED, this.handleQuestTrackerDirty, this);
    this.subscriptions.on(EventBus, GameEvents.QUEST_TURNED_IN, this.handleQuestTrackerDirty, this);
    this.subscriptions.on(EventBus, GameEvents.QUEST_FAILED, this.handleQuestTrackerDirty, this);
  }

  private handleLogMessage(data: { text: string; type: string }): void {
    this.logMessages.push(data);
    if (this.logMessages.length > LOG_MAX_LINES) this.logMessages.shift();
    this.updateLogDisplay();
  }

  private handleTargetChanged(data: { targetId: string | null; targetName?: string | null }): void {
    this.currentTargetId = data.targetId;
    this.currentTargetName = data.targetName ?? null;
    this.targetText.setText(
      data.targetId
        ? t('ui.hud.target', { targetName: this.currentTargetName ?? data.targetId })
        : t('ui.hud.targetNone'),
    );
    this.targetText.setColor(data.targetId ? '#ffb09a' : '#777788');
    this.targetFrame?.setVisible(!!data.targetId);
    this.targetHpShown = -1;
    this.nextTargetRefreshAt = 0;
  }

  private handleSkillLevelChanged(data: { level?: number }): void {
    this.refreshSkillLoadout();
    if (data.level !== 1) return;
    this.time.delayedCall(0, () => {
      if (this.scene.isActive()) {
        this.scene.restart({ player: this.player, zone: this.zone });
      }
    });
  }

  private handleShopOpen(data: { npcId: string; shopItems: string[]; type: string }): void {
    this.openShop(data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleNpcInteract(data: any): void {
    if (data.dialogueTree && data.questSystem) {
      // Try compact quest card first — show if there are available or turn-in quests
      const questSystem = data.questSystem;
      const npcDef = NPCDefinitions[data.npcId];
      const npcQuestIds = npcDef?.quests ?? [];
      if (npcQuestIds.length > 0) {
        const entries = gatherNpcQuests(
          npcQuestIds,
          questSystem.quests,
          questSystem.progress,
          data.player?.level ?? 1,
        );
        if (entries.length > 0) {
          this.openQuestCard(entries, data.npcName, !!data.dialogueTree, data);
          return;
        }
      }
      // No actionable quests — fall through to dialogue tree for story/lore
      this.openDialogueTree(data);
    } else if (data.dialogueTree) {
      this.openDialogueTree(data);
    } else {
      this.openDialogue(data);
    }
  }

  private handlePanelToggle(data: { panel: string }): void {
    if (data.panel === 'inventory') this.toggleInventory();
    if (data.panel === 'map') this.toggleMap();
    if (data.panel === 'skills') this.toggleSkillTree();
    if (data.panel === 'character') this.toggleCharacter();
    if (data.panel === 'homestead') this.toggleHomestead();
    if (data.panel === 'quest') this.toggleQuestLog();
    if (data.panel === 'audio') this.toggleAudioSettings();
    if (data.panel === 'companion') this.toggleCompanion();
    if (data.panel === 'achievement') this.toggleAchievement();
  }

  private handleUiRefresh(data: { player: Player; zone: ZoneScene }): void {
    this.player = data.player;
    this.zone = data.zone;
    this.refreshSkillLoadout();
    this.handleTargetChanged({ targetId: null, targetName: null });
    this.nextMinimapRefreshAt = 0;
    this.nextQuestTrackerRefreshAt = 0;
    this.lastQuestTrackerSignature = '';
  }

  /** Force an immediate tracker refresh on next update tick. */
  private handleQuestTrackerDirty(): void {
    this.nextQuestTrackerRefreshAt = 0;
    this.lastQuestTrackerSignature = '';
  }

  /** Handle locale change: refresh all open panels so text updates in-place. */
  private handleLocaleChanged(): void {
    this.spiritLabel.setText(t('ui.hud.spirit'));
    this.handleTargetChanged({
      targetId: this.currentTargetId,
      targetName: this.currentTargetName,
    });
    // Refresh inventory panel if open
    if (this.inventoryPanel) { this.refreshInventory(); }
    // Refresh character panel if open
    if (this.charPanel) { this.toggleCharacter(); this.toggleCharacter(); }
    // Refresh quest tracker
    this.lastQuestTrackerSignature = '';
    this.nextQuestTrackerRefreshAt = 0;
    // Refresh skill tree panel if open (toggle off then on)
    if (this.skillPanel) { this.toggleSkillTree(); this.toggleSkillTree(); }
    // Refresh homestead panel if open
    if (this.homesteadPanel) { this.toggleHomestead(); this.toggleHomestead(); }
    // Refresh quest log panel if open
    if (this.questLogPanel) { this.toggleQuestLog(); this.toggleQuestLog(); }
    // Refresh companion panel if open
    if (this.companionPanel) { this.toggleCompanion(); this.toggleCompanion(); }
    // Refresh achievement panel if open
    if (this.achievementPanel) { this.toggleAchievement(); this.toggleAchievement(); }
    // Refresh socket panel if open (close — needs equipped item context)
    if (this.socketPanel) {
      this.socketPanel.destroy();
      this.socketPanel = null;
    }
    // Refresh audio panel if open
    if (this.audioPanel) { this.toggleAudioSettings(); this.toggleAudioSettings(); }
    // Refresh map panel if open
    if (this.mapPanel) { this.toggleMap(); this.toggleMap(); }
    // Refresh dialogue panel if open (close since it needs NPC context)
    if (this.dialoguePanel) {
      this.dialoguePanel.destroy();
      this.dialoguePanel = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMiniBossDialogue(data: any): void {
    this.showMiniBossDialogue(data.bossName, data.dialogueTree, data.onDismiss);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleLoreCollected(data: any): void {
    this.showLoreText(data.entry);
  }

  private cleanupAudioPanelInputHandlers(): void {
    for (const cleanup of this.audioPanelInputCleanup) cleanup();
    this.audioPanelInputCleanup = [];
  }

  private updateLogDisplay(): void {
    const colors: Record<string, string> = { system: '#e8c77a', combat: '#ff8a72', loot: '#7ed36a', info: '#7fb6ff' };
    // Newest message sits at the bottom; older ones stack upward and wrapped lines
    // push earlier entries up instead of overlapping them.
    const top = HUD.log.y + px(22);
    let bottom = HUD.log.y + HUD.log.h - px(6);
    const msgs = this.logMessages;
    for (let i = 0; i < LOG_MAX_LINES; i++) {
      const txt = this.logTexts[i];
      if (!txt || !txt.active) continue;
      const msg = msgs[msgs.length - 1 - i];
      if (!msg) { if (txt.text !== '') txt.setText(''); txt.setVisible(false); continue; }
      txt.setText(msg.text).setColor(colors[msg.type] ?? '#b8b0a4');
      const y = bottom - txt.height;
      if (y < top) { txt.setVisible(false); bottom = top; continue; }
      txt.setY(y).setVisible(true).setAlpha(i === 0 ? 1 : Math.max(0.55, 1 - i * 0.07));
      bottom = y - px(1);
    }
  }

  // --- Inventory Panel ---
  private toggleInventory(): void {
    if (this.inventoryPanel) { this.inventoryPanel.destroy(); this.inventoryPanel = null; this.hideItemTooltip(); this.hideContextPopup(); return; }
    this.closeAllPanels();
    audioManager.playSFX('click');
    const pw = px(740), ph = px(450), panelX = (W - pw) / 2, panelY = px(12);
    const inv = this.zone.inventorySystem.inventory;
    const itemsPerPage = 50;
    const totalPages = Math.max(1, Math.ceil(inv.length / itemsPerPage));
    if (this.inventoryPage >= totalPages) this.inventoryPage = totalPages - 1;

    const panel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    this.inventoryPanel = panel;
    this.animatePanelOpen(panel);
    panel.add(this.createPanelBg(pw, ph));
    panel.add(this.createPanelTitle(pw, t('ui.inventory.title', { count: String(inv.length), max: '100' })));
    panel.add(this.createPanelCloseBtn(pw, () => this.toggleInventory()));

    // ── Left: equipment paper-doll ──
    const leftX = px(18), leftW = px(236);
    const dollCx = leftX + leftW / 2;
    panel.add(addVDivider(this, leftX + leftW + px(9), px(46), ph - px(62)));
    panel.add(addSectionHeader(this, leftX, px(52), leftW, t('ui.inventory.equipment')));

    const eqSlotSize = px(44);
    const colGap = px(70), rowPitch = px(64);
    const rowTop = px(92);
    const layout: { slot: EquipSlot; key: string; col: number; row: number; ghost: string }[] = [
      { slot: 'helmet', key: 'ui.inventory.slot.helmet', col: 0, row: 0, ghost: 'a_helm' },
      { slot: 'weapon', key: 'ui.inventory.slot.weapon', col: -1, row: 1, ghost: 'w_sword' },
      { slot: 'armor', key: 'ui.inventory.slot.armor', col: 0, row: 1, ghost: 'a_armor' },
      { slot: 'offhand', key: 'ui.inventory.slot.offhand', col: 1, row: 1, ghost: 'w_shield' },
      { slot: 'gloves', key: 'ui.inventory.slot.gloves', col: -1, row: 2, ghost: 'a_gloves' },
      { slot: 'belt', key: 'ui.inventory.slot.belt', col: 0, row: 2, ghost: 'a_belt' },
      { slot: 'boots', key: 'ui.inventory.slot.boots', col: 1, row: 2, ghost: 'a_boots' },
      { slot: 'ring1', key: 'ui.inventory.slot.ring1', col: -1, row: 3, ghost: 'j_ring' },
      { slot: 'necklace', key: 'ui.inventory.slot.necklace', col: 0, row: 3, ghost: 'j_amulet' },
      { slot: 'ring2', key: 'ui.inventory.slot.ring2', col: 1, row: 3, ghost: 'j_ring' },
    ];
    // faint silhouette plinth behind the doll
    const plinth = this.add.graphics();
    plinth.fillStyle(0xd4a54a, 0.05);
    plinth.fillEllipse(dollCx, rowTop + rowPitch * 1.5, leftW * 0.9, rowPitch * 4.2);
    plinth.lineStyle(1, 0xd4a54a, 0.12);
    plinth.strokeEllipse(dollCx, rowTop + rowPitch * 1.5, leftW * 0.9, rowPitch * 4.2);
    panel.add(plinth);

    for (const def of layout) {
      const cx = dollCx + def.col * colGap;
      const cy = rowTop + def.row * rowPitch;
      const eq = this.zone.inventorySystem.equipment[def.slot as keyof typeof this.zone.inventorySystem.equipment] as ItemInstance | null | undefined;
      const { slot: slotBg, objects } = this.createItemSlot(cx, cy, eqSlotSize, eq ?? null, { interactive: !!eq });
      panel.add(objects);
      if (!eq) {
        panel.add(this.add.image(cx, cy, ensureItemIcon(this, def.ghost))
          .setDisplaySize(eqSlotSize - px(12), eqSlotSize - px(12)).setTint(0x6a6070).setAlpha(0.28));
      }
      panel.add(this.add.text(cx, cy + eqSlotSize / 2 + px(3), t(def.key), {
        fontSize: fs(10), color: eq ? UI_COLORS.textSoft : UI_COLORS.dim, fontFamily: FONT,
      }).setOrigin(0.5, 0));
      if (eq) {
        // Socket indicator: small diamond on items with sockets
        const maxSock = this.zone.inventorySystem.getMaxSockets(def.slot as any);
        if (maxSock > 0) {
          const sockLabel = `◆${eq.sockets.length}/${maxSock}`;
          panel.add(this.add.text(cx + eqSlotSize / 2 - px(2), cy - eqSlotSize / 2 + px(1), sockLabel, {
            fontSize: fs(9), color: '#8be9fd', fontFamily: FONT, fontStyle: 'bold',
            stroke: '#000000', strokeThickness: Math.round(2 * DPR),
          }).setOrigin(1, 0));
        }
        const slot = def.slot;
        slotBg.on('pointerover', (pointer: Phaser.Input.Pointer) => {
          this.showItemTooltip(eq, pointer.x, pointer.y);
        });
        slotBg.on('pointerout', () => this.hideItemTooltip());
        slotBg.on('pointerdown', () => {
          const ms = this.zone.inventorySystem.getMaxSockets(slot as any);
          if (ms > 0) {
            this.hideItemTooltip();
            this.openSocketPanel(slot as any);
          } else {
            this.zone.inventorySystem.unequip(slot as any);
            this.zone.invalidateEquipStats();
            this.refreshInventory();
          }
        });
      }
    }

    // Gold + hint under the doll
    const goldY = rowTop + 3 * rowPitch + px(52);
    panel.add(addDivider(this, dollCx, goldY - px(12), leftW - px(20)));
    panel.add(this.add.image(dollCx - px(40), goldY + px(8), coinTexture(this, px(14))));
    panel.add(this.add.text(dollCx - px(30), goldY + px(8), `${this.player.gold}`, {
      fontSize: fs(14), color: '#ffd35a', fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0, 0.5));
    panel.add(this.add.text(dollCx, goldY + px(30), t('ui.inventory.equipHint'), {
      fontSize: fs(10), color: UI_COLORS.dim, fontFamily: FONT, align: 'center',
      wordWrap: { width: leftW - px(8), useAdvancedWrap: true },
    }).setOrigin(0.5, 0));

    // ── Right: backpack grid ──
    const gridX = leftX + leftW + px(20);
    const gridW = pw - gridX - px(18);
    const cols = 10;
    const gap = px(4);
    const slotSize = Math.floor((gridW - gap * (cols - 1)) / cols);
    panel.add(addSectionHeader(this, gridX, px(52), gridW, t('ui.inventory.bag')));
    const gridStartY = px(66);
    const pageItems = inv.slice(this.inventoryPage * itemsPerPage, (this.inventoryPage + 1) * itemsPerPage);
    for (let i = 0; i < itemsPerPage; i++) {
      const cx = gridX + (i % cols) * (slotSize + gap) + slotSize / 2;
      const cy = gridStartY + Math.floor(i / cols) * (slotSize + gap) + slotSize / 2;
      const item = pageItems[i];
      if (!item) {
        panel.add(addSlot(this, cx, cy, slotSize, null).setAlpha(0.7));
        continue;
      }
      const { slot: itemBg, objects } = this.createItemSlot(cx, cy, slotSize, item);
      panel.add(objects);
      itemBg.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        this.showItemTooltip(item, pointer.x, pointer.y);
      });
      itemBg.on('pointerout', () => this.hideItemTooltip());
      itemBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.hideItemTooltip();
        this.showContextPopup(item, pointer.x, pointer.y);
      });
    }

    // Toolbar: pagination (left) + sort / destroy (right)
    const barY = gridStartY + 5 * (slotSize + gap) + px(16);
    if (totalPages > 1) {
      const pgCx = gridX + px(110);
      panel.add(this.makeButton(pgCx - px(70), barY, px(56), px(24), t('ui.inventory.prevPage'), () => { this.inventoryPage--; this.refreshInventory(); }, { disabled: this.inventoryPage <= 0 }));
      panel.add(this.add.text(pgCx, barY, t('ui.inventory.pageLabel', { current: String(this.inventoryPage + 1), total: String(totalPages) }), {
        fontSize: fs(12), color: UI_COLORS.textSoft, fontFamily: FONT,
      }).setOrigin(0.5));
      panel.add(this.makeButton(pgCx + px(70), barY, px(56), px(24), t('ui.inventory.nextPage'), () => { this.inventoryPage++; this.refreshInventory(); }, { disabled: this.inventoryPage >= totalPages - 1 }));
    }
    panel.add(this.makeButton(gridX + gridW - px(142), barY, px(76), px(26), btnLabel(t('ui.inventory.sort')), () => {
      this.zone.inventorySystem.sortInventory();
      this.refreshInventory();
    }, { variant: 'secondary' }));
    panel.add(this.makeButton(gridX + gridW - px(46), barY, px(92), px(26), btnLabel(t('ui.inventory.destroy')), () => {
      this.zone.inventorySystem.destroyNormalItems();
      this.inventoryPage = 0;
      this.refreshInventory();
    }, { variant: 'danger' }));

    // Equipment stats
    const eqStats = this.zone.inventorySystem.getEquipmentStats();
    const statText = Object.entries(eqStats)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => {
        const label = getStatLabel(k);
        const suffix = isStatPercent(k) ? '%' : '';
        return `${label} +${v}${suffix}`;
      }).join('   ');
    const statsY = barY + px(26);
    panel.add(addSectionHeader(this, gridX, statsY, gridW, t('ui.inventory.bonusHeader')));
    panel.add(this.add.text(gridX + px(2), statsY + px(12), statText || t('ui.inventory.bonusNone'), {
      fontSize: fs(11), color: statText ? '#9fd4ff' : UI_COLORS.dim, fontFamily: FONT, lineSpacing: px(3),
      wordWrap: { width: gridW - px(4), useAdvancedWrap: true }, maxLines: 5,
    }));
  }

  // --- Shop Panel (Diablo-style split) ---
  private reopenShop(data: { npcId: string; shopItems: string[]; type: string }): void {
    this.shopPanel?.destroy(); this.shopPanel = null;
    if (this.dialogueBackdrop) { this.dialogueBackdrop.destroy(); this.dialogueBackdrop = null; }
    this.openShop(data, true);
  }

  private openShop(data: { npcId: string; shopItems: string[]; type: string }, keepPage = false): void {
    this.closeAllPanels();
    this.shopNpcId = data.npcId;
    audioManager.playSFX('click');
    if (!keepPage) this.shopInventoryPage = 0;

    // Backdrop for outside-click dismiss
    this.dialogueBackdrop = this.createBackdrop(0.6);
    this.dialogueBackdrop.on('pointerdown', () => {
      this.hideItemTooltip();
      if (this.shopPanel) { const closedNpcId = this.shopNpcId; this.shopPanel.destroy(); this.shopPanel = null; this.shopNpcId = null; EventBus.emit(GameEvents.SHOP_CLOSE, { npcId: closedNpcId }); }
      if (this.dialogueBackdrop) { this.dialogueBackdrop.destroy(); this.dialogueBackdrop = null; }
    });

    const pw = px(780), ph = px(480), panelX = (W - pw) / 2, panelY = px(40);
    const dividerX = px(356);
    this.shopPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    const shop = this.shopPanel;
    this.animatePanelOpen(shop);
    shop.add(this.createPanelBg(pw, ph));
    const title = data.type === 'blacksmith' ? t('ui.shop.blacksmith') : t('ui.shop.shop');
    shop.add(this.createPanelTitle(pw, title));
    shop.add(this.createPanelCloseBtn(pw, () => {
      this.hideItemTooltip();
      if (this.shopPanel) { const closedNpcId = this.shopNpcId; this.shopPanel.destroy(); this.shopPanel = null; this.shopNpcId = null; EventBus.emit(GameEvents.SHOP_CLOSE, { npcId: closedNpcId }); }
      if (this.dialogueBackdrop) { this.dialogueBackdrop.destroy(); this.dialogueBackdrop = null; }
    }));

    // Divider
    shop.add(addVDivider(this, dividerX, px(46), ph - px(62)));

    // --- LEFT: Merchant items ---
    const leftX = px(18), leftW = dividerX - px(34);
    shop.add(addSectionHeader(this, leftX, px(54), leftW, t('ui.shop.itemList')));
    const rowH = px(40), rowStart = px(68);
    const iconSz = px(32);
    const listBottom = ph - px(54);

    data.shopItems.forEach((itemId, i) => {
      const base = getItemBase(itemId);
      if (!base) return;
      const iy = rowStart + i * rowH;
      if (iy + rowH > listBottom) return;
      const buyPrice = base.sellPrice * 3;
      const canAfford = this.player.gold >= buyPrice;
      const card = this.add.graphics();
      drawCard(card, leftX, iy, leftW, rowH - px(4), { border: canAfford ? 0x4a4250 : 0x2e2a32 });
      shop.add(card);
      const cy = iy + (rowH - px(4)) / 2;
      shop.add(addSlot(this, leftX + px(6) + iconSz / 2, cy, iconSz, 'normal'));
      shop.add(this.add.image(leftX + px(6) + iconSz / 2, cy, ensureItemIcon(this, base.icon ?? 'c_hp'))
        .setDisplaySize(iconSz - px(4), iconSz - px(4)).setAlpha(canAfford ? 1 : 0.5));
      shop.add(this.add.text(leftX + iconSz + px(14), cy, getItemBaseName(itemId), {
        fontSize: fs(13), color: canAfford ? UI_COLORS.text : UI_COLORS.dim, fontFamily: FONT,
      }).setOrigin(0, 0.5));
      shop.add(this.add.image(leftX + leftW - px(116), cy, coinTexture(this, px(12))).setAlpha(canAfford ? 1 : 0.5));
      shop.add(this.add.text(leftX + leftW - px(108), cy, `${buyPrice}`, {
        fontSize: fs(12), color: canAfford ? '#ffd35a' : UI_COLORS.dim, fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      shop.add(this.makeButton(leftX + leftW - px(34), cy, px(52), px(24), btnLabel(t('ui.shop.buy')), () => {
        if (this.player.gold >= buyPrice) {
          this.player.gold -= buyPrice;
          audioManager.playSFX('click');
          const item = this.zone.lootSystem.createItem(itemId, this.player.level, 'normal');
          if (item) { item.identified = true; this.zone.inventorySystem.addItem(item); }
          this.reopenShop(data);
        }
      }, { variant: 'success', disabled: !canAfford }));
    });

    // --- Buyback section ---
    const buybackItems = this.zone.inventorySystem.buybackItems;
    if (buybackItems.length > 0) {
      const buybackStartY = rowStart + data.shopItems.length * rowH + px(12);
      shop.add(addSectionHeader(this, leftX, buybackStartY, leftW, t('ui.shop.buyback')));
      buybackItems.forEach((entry, i) => {
        const by = buybackStartY + px(12) + i * px(32);
        if (by + px(30) > listBottom) return;
        const canAfford = this.player.gold >= entry.buybackPrice;
        const qualColor = this.getQualityTextColor(entry.item.quality);
        const cy = by + px(14);
        const slot = this.createItemSlot(leftX + px(14), cy, px(26), entry.item, { showCount: false });
        shop.add(slot.objects);
        slot.slot.on('pointerover', (pointer: Phaser.Input.Pointer) => this.showItemTooltip(entry.item, pointer.x, pointer.y));
        slot.slot.on('pointerout', () => this.hideItemTooltip());
        const nameT = this.add.text(leftX + px(34), cy, getItemDisplayName(entry.item), {
          fontSize: fs(12), color: canAfford ? qualColor : UI_COLORS.dim, fontFamily: FONT,
        }).setOrigin(0, 0.5);
        const maxNameW = leftW - px(34) - px(170);
        if (nameT.width > maxNameW) nameT.setScale(maxNameW / nameT.width, 1);
        shop.add(nameT);
        shop.add(this.add.image(leftX + leftW - px(128), cy, coinTexture(this, px(12))).setAlpha(canAfford ? 1 : 0.5));
        shop.add(this.add.text(leftX + leftW - px(120), cy, `${entry.buybackPrice}`, {
          fontSize: fs(12), color: canAfford ? '#e8a040' : UI_COLORS.dim, fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0, 0.5));
        shop.add(this.makeButton(leftX + leftW - px(34), cy, px(60), px(24), btnLabel(t('ui.shop.buybackBtn')), () => {
          if (this.player.gold >= entry.buybackPrice) {
            const result = this.zone.inventorySystem.buybackItem(i);
            if (result) {
              this.player.gold -= result.cost;
              audioManager.playSFX('click');
              EventBus.emit(GameEvents.LOG_MESSAGE, { text: t('ui.shop.buybackLog', { name: getItemDisplayName(result.item) }), type: 'loot' });
            }
            this.reopenShop(data);
          }
        }, { variant: 'primary', disabled: !canAfford, fontSize: 11 }));
      });
    }

    // Gold (bottom-left)
    shop.add(addDivider(this, leftX + leftW / 2, ph - px(40), leftW));
    shop.add(this.add.image(leftX + px(8), ph - px(22), coinTexture(this, px(14))));
    shop.add(this.add.text(leftX + px(20), ph - px(22), t('ui.shop.gold', { gold: String(this.player.gold) }), {
      fontSize: fs(13), color: '#ffd35a', fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0, 0.5));

    // --- RIGHT: Player inventory for selling ---
    const rightX = dividerX + px(16);
    const rightW = pw - rightX - px(18);
    shop.add(addSectionHeader(this, rightX, px(54), rightW, t('ui.shop.yourBag')));

    const inv = this.zone.inventorySystem.inventory;
    const shopCols = 8;
    const shopGap = px(5);
    const shopSlotSize = Math.floor((rightW - shopGap * (shopCols - 1)) / shopCols);
    const shopItemsPerPage = 40;
    const shopTotalPages = Math.max(1, Math.ceil(inv.length / shopItemsPerPage));
    if (this.shopInventoryPage >= shopTotalPages) this.shopInventoryPage = shopTotalPages - 1;
    const shopPageItems = inv.slice(this.shopInventoryPage * shopItemsPerPage, (this.shopInventoryPage + 1) * shopItemsPerPage);
    const shopGridY = px(68);

    for (let i = 0; i < shopItemsPerPage; i++) {
      const cx = rightX + (i % shopCols) * (shopSlotSize + shopGap) + shopSlotSize / 2;
      const cy = shopGridY + Math.floor(i / shopCols) * (shopSlotSize + shopGap) + shopSlotSize / 2;
      const item = shopPageItems[i];
      if (!item) { shop.add(addSlot(this, cx, cy, shopSlotSize, null).setAlpha(0.7)); continue; }
      const { slot: itemBg, objects } = this.createItemSlot(cx, cy, shopSlotSize, item);
      shop.add(objects);
      itemBg.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        this.showItemTooltip(item, pointer.x, pointer.y);
      });
      itemBg.on('pointerout', () => this.hideItemTooltip());
      itemBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.hideItemTooltip();
        const isRightClick = pointer.rightButtonDown();
        const isHighValue = item.quality === 'legendary' || item.quality === 'set';

        if (isRightClick && !isHighValue) {
          // Right-click quick-sell for rare and below
          const gold = this.zone.inventorySystem.sellItem(item.uid);
          this.player.gold += gold;
          audioManager.playSFX('click');
          this.reopenShop(data);
        } else if (isHighValue) {
          this.showSellConfirm(item, data);
        } else {
          // Left-click on normal/magic — also sell directly
          const gold = this.zone.inventorySystem.sellItem(item.uid);
          this.player.gold += gold;
          audioManager.playSFX('click');
          this.reopenShop(data);
        }
      });
    }

    // Shop inventory pagination
    const pageY = shopGridY + 5 * (shopSlotSize + shopGap) + px(14);
    if (shopTotalPages > 1) {
      const pgCx = rightX + rightW / 2;
      shop.add(this.makeButton(pgCx - px(70), pageY, px(64), px(24), t('ui.shop.prevPage'), () => {
        this.shopInventoryPage--;
        this.reopenShop(data);
      }, { disabled: this.shopInventoryPage <= 0 }));
      shop.add(this.add.text(pgCx, pageY, `${this.shopInventoryPage + 1}/${shopTotalPages}`, {
        fontSize: fs(12), color: UI_COLORS.textSoft, fontFamily: FONT,
      }).setOrigin(0.5));
      shop.add(this.makeButton(pgCx + px(70), pageY, px(64), px(24), t('ui.shop.nextPage'), () => {
        this.shopInventoryPage++;
        this.reopenShop(data);
      }, { disabled: this.shopInventoryPage >= shopTotalPages - 1 }));
    }

    // Hint for right-click selling
    shop.add(addDivider(this, rightX + rightW / 2, ph - px(40), rightW));
    shop.add(this.add.text(rightX + rightW / 2, ph - px(22), t('ui.shop.sellHint'), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5, 0.5));
  }

  private showSellConfirm(item: ItemInstance, shopData: { npcId: string; shopItems: string[]; type: string }): void {
    this.hideContextPopup();
    const base = getItemBase(item.baseId);
    const sellPrice = base ? base.sellPrice * item.quantity : 1;
    const popW = px(280);
    this.contextPopup = this.add.container(0, 0).setDepth(PANEL_STYLE.depth.confirmDialog);
    const msg = this.add.text(popW / 2, px(20), t('ui.shop.sellConfirm', { name: getItemDisplayName(item), price: String(sellPrice) }), {
      fontSize: fs(13), color: UI_COLORS.text, fontFamily: FONT, align: 'center',
      wordWrap: { width: popW - px(36), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    const popH = msg.y + msg.height + px(56);
    this.contextPopup.setPosition((W - popW) / 2, (H - popH) / 2);
    this.contextPopup.add(addFrame(this, 0, 0, popW, popH, { variant: 'tooltip', accent: qualityNum(item.quality) }));
    this.contextPopup.add(msg);
    this.contextPopup.add(this.makeButton(popW / 2 - px(62), popH - px(26), px(100), px(28), btnLabel(t('ui.shop.confirm')), () => {
      const gold = this.zone.inventorySystem.sellItem(item.uid);
      this.player.gold += gold;
      audioManager.playSFX('click');
      this.hideContextPopup();
      this.reopenShop(shopData);
    }, { variant: 'primary', fontSize: 13 }));
    this.contextPopup.add(this.makeButton(popW / 2 + px(62), popH - px(26), px(100), px(28), btnLabel(t('ui.shop.cancel')), () => this.hideContextPopup(), { fontSize: 13 }));
  }

  // --- World Map ---
  private toggleMap(): void {
    if (this.mapPanel) { this.mapPanel.destroy(); this.mapPanel = null; return; }
    this.closeAllPanels();
    const nodeW = px(98), nodeH = px(70), nodeGap = px(22);
    const count = MapOrder.length;
    const pw = Math.max(px(480), count * nodeW + (count - 1) * nodeGap + px(56)), ph = px(236);
    const panelX = (W - pw) / 2, panelY = px(80);
    this.mapPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    const panel = this.mapPanel;
    this.animatePanelOpen(panel);
    panel.add(this.createPanelBg(pw, ph));
    panel.add(this.createPanelTitle(pw, t('ui.worldMap.title')));
    panel.add(this.createPanelCloseBtn(pw, () => this.toggleMap()));

    const startX = (pw - (count * nodeW + (count - 1) * nodeGap)) / 2;
    const y = px(62);
    const road = this.add.graphics();
    panel.add(road);
    MapOrder.forEach((mapId, i) => {
      const map = AllMaps[mapId];
      const x = startX + i * (nodeW + nodeGap);
      const isCurrent = (this.zone as any).currentMapId === mapId;
      if (i < count - 1) {
        // gold-studded road to the next zone
        const rx0 = x + nodeW + px(2), rx1 = x + nodeW + nodeGap - px(2), ry = y + nodeH / 2;
        road.lineStyle(px(3), 0x000000, 0.6);
        road.lineBetween(rx0, ry + 1, rx1, ry + 1);
        road.lineStyle(px(2), 0xd4a54a, 0.75);
        road.lineBetween(rx0, ry, rx1, ry);
        road.fillStyle(0xffd98a, 1);
        road.fillTriangle(rx1, ry, rx1 - px(6), ry - px(4), rx1 - px(6), ry + px(4));
      }
      const card = this.add.graphics();
      drawCard(card, x, y, nodeW, nodeH, isCurrent
        ? { fill: 0x2a2114, border: 0xffd98a, borderWidth: 2, glow: 0xffc860 }
        : { border: 0x4a4250 });
      panel.add(card);
      const nameT = this.add.text(x + nodeW / 2, y + px(22), getZoneName(mapId, map.name), {
        fontSize: fs(12), color: isCurrent ? UI_COLORS.goldBright : UI_COLORS.text, fontFamily: FONT, fontStyle: 'bold', align: 'center',
        wordWrap: { width: nodeW - px(10), useAdvancedWrap: true },
      }).setOrigin(0.5);
      if (nameT.height > px(30)) nameT.setFontSize(fs(11));
      panel.add(nameT);
      panel.add(this.add.text(x + nodeW / 2, y + nodeH - px(14), `Lv.${map.levelRange[0]}-${map.levelRange[1]}`, {
        fontSize: fs(11), color: isCurrent ? '#e8c77a' : UI_COLORS.muted, fontFamily: FONT,
      }).setOrigin(0.5));
      if (isCurrent) {
        const pin = this.add.graphics();
        pin.fillStyle(0x000000, 0.6);
        pin.fillTriangle(x + nodeW / 2, y - px(2), x + nodeW / 2 - px(7), y - px(14), x + nodeW / 2 + px(7), y - px(14));
        pin.fillStyle(0xffd98a, 1);
        pin.fillTriangle(x + nodeW / 2, y - px(4), x + nodeW / 2 - px(6), y - px(15), x + nodeW / 2 + px(6), y - px(15));
        panel.add(pin);
        this.tweens.add({ targets: pin, y: px(-3), duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    });
    panel.add(addDivider(this, pw / 2, ph - px(40), pw - px(80)));
    panel.add(this.add.text(pw / 2, ph - px(22), t('ui.worldMap.closeHint'), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5));
  }

  // --- Skill Tree Panel (K) ---
  /** Active skill tree tab index (persists across panel reopens within session). */
  private skillTreeActiveTab = 0;
  /** Scroll offset per tab for skill tree overflow content. */
  private skillTreeScrollY: number[] = [];
  /** Wheel handler cleanup for skill tree panel. */
  private skillTreeWheelHandler: ((e: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], dx: number, dy: number) => void) | null = null;

  private skillTooltip: Phaser.GameObjects.Container | null = null;

  private getSkillLockText(state: SkillInvestmentState): string {
    switch (state.reason) {
      case 'player_level':
        return t('ui.skillTree.lock.playerLevel', {
          level: state.requiredPlayerLevel,
        });
      case 'tree_points':
        return t('ui.skillTree.lock.treePoints', {
          current: state.investedTreePoints,
          required: state.requiredTreePoints,
        });
      case 'previous_tier':
        return t('ui.skillTree.lock.previousTier');
      case 'no_points':
        return t('ui.skillTree.lock.noPoints');
      default:
        return '';
    }
  }

  private toggleSkillTree(): void {
    if (this.skillPanel) {
      if (this.skillTreeWheelHandler) {
        this.input.off('wheel', this.skillTreeWheelHandler);
        this.skillTreeWheelHandler = null;
      }
      this.skillPanel.destroy(); this.skillPanel = null; this.skillTooltip?.destroy(); this.skillTooltip = null; return;
    }
    this.closeAllPanels();
    const TREE_NAMES: Record<string, string> = {
      combat_master: getSkillTreeName('combat_master', '战斗大师'), guardian: getSkillTreeName('guardian', '守护者'), berserker: getSkillTreeName('berserker', '狂战士'),
      fire: getSkillTreeName('fire', '烈焰'), frost: getSkillTreeName('frost', '冰霜'), arcane: getSkillTreeName('arcane', '奥术'),
      assassination: getSkillTreeName('assassination', '刺杀'), archery: getSkillTreeName('archery', '箭术'), traps: getSkillTreeName('traps', '陷阱'),
    };
    const TREE_COLORS: Record<string, number> = {
      combat_master: 0xd4a017, guardian: 0xf1c40f, berserker: 0xcc3333,
      fire: 0xe74c3c, frost: 0x5dade2, arcane: 0x8e44ad,
      assassination: 0x27ae60, archery: 0xcc8844, traps: 0xff6600,
    };
    const DMG_COLORS: Record<string, number> = {
      physical: 0xcccccc, fire: 0xff6633, ice: 0x66ccff,
      lightning: 0x5dade2, poison: 0x33cc33, arcane: 0xbb77ff,
    };
    const DMG_NAMES: Record<string, string> = {
      physical: getDamageTypeName('physical'), fire: getDamageTypeName('fire'), ice: getDamageTypeName('ice'),
      lightning: getDamageTypeName('lightning'), poison: getDamageTypeName('poison'), arcane: getDamageTypeName('arcane'),
    };

    const pw = px(660), ph = px(520);
    const panelX = (W - pw) / 2, panelY = px(5);
    this.skillPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    this.animatePanelOpen(this.skillPanel);

    // Background with unified style
    this.skillPanel.add(this.createPanelBg(pw, ph));
    const headerH = px(PANEL_STYLE.header.height);

    this.skillPanel.add(this.createPanelTitle(pw, t('ui.skillTree.title')));
    const spColor = this.player.freeSkillPoints > 0 ? UI_COLORS.goldBright : UI_COLORS.muted;
    this.skillPanel.add(this.add.text(pw / 2, headerH + px(12), t('ui.skillTree.skillPoints', { className: getClassName(this.player.classData.id ?? 'warrior'), points: String(this.player.freeSkillPoints) }), {
      fontSize: fs(13), color: spColor, fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0.5, 0.5));

    // Close button
    this.skillPanel.add(this.createPanelCloseBtn(pw, () => this.toggleSkillTree()));

    // Gather trees
    const treeNames: string[] = [];
    const treeSkillsMap = new Map<string, typeof this.player.classData.skills>();
    for (const skill of this.player.classData.skills) {
      if (!treeSkillsMap.has(skill.tree)) { treeSkillsMap.set(skill.tree, []); treeNames.push(skill.tree); }
      treeSkillsMap.get(skill.tree)!.push(skill);
    }

    const treeCount = treeNames.length;
    if (this.skillTreeScrollY.length !== treeCount) {
      this.skillTreeScrollY = new Array(treeCount).fill(0);
    }
    if (this.skillTreeActiveTab >= treeCount) this.skillTreeActiveTab = 0;

    // === Tabs ===
    const tabH = px(30);
    const tabY = headerH + px(26);
    const tabMargin = px(16);
    const tabGap = px(4);
    const tabTotalW = pw - tabMargin * 2;
    const tabW = Math.floor((tabTotalW - tabGap * (treeCount - 1)) / treeCount);

    // Content area dimensions
    const contentTop = tabY + tabH + px(8);
    const contentH = ph - contentTop - px(30);
    const contentInnerW = pw - px(24);

    // Card dimensions — uniform for all trees
    const cardW = Math.min(contentInnerW - px(20), px(600));
    const cardH = px(72);
    const iconSize = px(42);
    const cardGap = px(12);

    // Scrollable content container
    const scrollContainer = this.add.container(0, 0);
    this.skillPanel.add(scrollContainer);

    // Clip mask for scroll area
    const clipMask = this.make.graphics({});
    clipMask.fillStyle(0xffffff);
    clipMask.fillRect(panelX + px(10), panelY + contentTop, pw - px(20), contentH);
    const mask = clipMask.createGeometryMask();
    scrollContainer.setMask(mask);

    // Render active tab content
    const renderTab = (tabIndex: number) => {
      scrollContainer.removeAll(true);
      this.skillTooltip?.destroy(); this.skillTooltip = null;

      const treeName = treeNames[tabIndex];
      const treeSkills = treeSkillsMap.get(treeName) ?? [];
      const treeColor = TREE_COLORS[treeName] ?? 0x888888;
      const sortedSkills = [...treeSkills].sort((a, b) => a.tier - b.tier);

      const scrollY = this.skillTreeScrollY[tabIndex] ?? 0;
      const totalContentH = sortedSkills.length * (cardH + cardGap) + px(30);
      const maxScrollY = Math.max(0, totalContentH - contentH);

      // Scrollbar
      if (totalContentH > contentH) {
        const sbX = pw - px(16);
        const sbTrackH = contentH - px(8);
        const sbTrackY = contentTop + px(4);
        const sbTrack = this.add.graphics();
        sbTrack.fillStyle(0x060508, 1);
        sbTrack.fillRoundedRect(sbX, sbTrackY, px(6), sbTrackH, px(3));
        sbTrack.lineStyle(1, 0x4a4250, 1);
        sbTrack.strokeRoundedRect(sbX, sbTrackY, px(6), sbTrackH, px(3));
        scrollContainer.add(sbTrack);

        const thumbRatio = Math.min(1, contentH / totalContentH);
        const thumbH = Math.max(px(20), sbTrackH * thumbRatio);
        const thumbY = sbTrackY + (maxScrollY > 0 ? (scrollY / maxScrollY) * (sbTrackH - thumbH) : 0);
        const sbThumb = this.add.graphics();
        sbThumb.fillStyle(0xd4a54a, 0.85);
        sbThumb.fillRoundedRect(sbX + px(1), thumbY, px(4), thumbH, px(2));
        scrollContainer.add(sbThumb);
      }

      // Prerequisite lines (behind cards)
      const skillStartY = contentTop + px(10);
      const cardStartX = (pw - cardW) / 2;

      for (let si = 0; si < sortedSkills.length - 1; si++) {
        const curLevel = this.player.getSkillLevel(sortedSkills[si].id);
        const isLearned = curLevel > 0;
        const lineGfx = this.add.graphics();
        const lineAlpha = isLearned ? 0.6 : 0.15;
        const lineColor = isLearned ? treeColor : 0x3a3a4e;

        const cx = cardStartX + cardW / 2;
        const curCardY = skillStartY + si * (cardH + cardGap) - scrollY;
        const nextCardY = skillStartY + (si + 1) * (cardH + cardGap) - scrollY;
        const startLineY = curCardY + cardH;
        const endLineY = nextCardY;

        if (endLineY > startLineY) {
          lineGfx.lineStyle(Math.round(2 * DPR), lineColor, lineAlpha);
          lineGfx.beginPath();
          lineGfx.moveTo(cx, startLineY);
          lineGfx.lineTo(cx, endLineY);
          lineGfx.strokePath();
          // Arrow head
          lineGfx.fillStyle(lineColor, lineAlpha);
          lineGfx.fillTriangle(cx, endLineY, cx - px(5), endLineY - px(7), cx + px(5), endLineY - px(7));
          // Glow for learned
          if (isLearned) {
            lineGfx.lineStyle(Math.round(4 * DPR), treeColor, 0.08);
            lineGfx.beginPath();
            lineGfx.moveTo(cx, startLineY);
            lineGfx.lineTo(cx, endLineY);
            lineGfx.strokePath();
          }
        }
        scrollContainer.add(lineGfx);
      }

      // Render skill cards
      sortedSkills.forEach((skill, si) => {
        const level = this.player.getSkillLevel(skill.id);
        const investmentState = getSkillInvestmentState(
          skill,
          this.player.classData.skills,
          this.player.skillLevels,
          this.player.level,
          this.player.freeSkillPoints,
        );
        const canLevel = investmentState.canInvest;
        const isLearned = level > 0;
        const isMaxed = level >= skill.maxLevel;
        const cardX = cardStartX;
        const cardY = skillStartY + si * (cardH + cardGap) - scrollY;
        const dmgColor = DMG_COLORS[skill.damageType] ?? 0xcccccc;
        const dmgColorHex = '#' + dmgColor.toString(16).padStart(6, '0');

        // === Card background with 4 distinct states ===
        const cardGfx = this.add.graphics();
        let cardStyle: CardStyle;
        if (isMaxed) {
          cardStyle = { fill: 0x2a2114, border: 0xffd98a, borderWidth: 2, glow: 0xffc860, strip: 0xffd98a };
        } else if (isLearned) {
          cardStyle = { fill: 0x1f1b24, border: treeColor, borderWidth: 1.5, strip: treeColor };
        } else if (canLevel) {
          cardStyle = { fill: 0x18201a, border: 0x6fd35a, borderWidth: 1.5, glow: 0x6fd35a };
        } else {
          cardStyle = { fill: 0x121015, border: 0x2e2a32 };
        }
        const hoverStyle: CardStyle = { ...cardStyle, fill: isLearned || isMaxed ? 0x2a2430 : (canLevel ? 0x1f2a22 : 0x19161c), border: isLearned || canLevel || isMaxed ? cardStyle.border : 0x5a5060, borderWidth: 2 };
        drawCard(cardGfx, cardX, cardY, cardW, cardH, cardStyle);
        scrollContainer.add(cardGfx);

        // State badge (top-right)
        const badgeGfx = this.add.graphics();
        const badgeX = cardX + cardW - px(12);
        const badgeY = cardY + px(12);
        if (isMaxed) {
          badgeGfx.fillStyle(0xf1c40f, 0.9);
          badgeGfx.fillCircle(badgeX, badgeY, px(3));
          for (let i = 0; i < 5; i++) {
            const a = Phaser.Math.DegToRad(-90 + i * 72);
            badgeGfx.fillCircle(badgeX + Math.cos(a) * px(6), badgeY + Math.sin(a) * px(6), px(1.5));
          }
        } else if (isLearned) {
          badgeGfx.fillStyle(treeColor, 0.7);
          badgeGfx.fillCircle(badgeX, badgeY, px(4));
        } else if (canLevel) {
          badgeGfx.fillStyle(0x44dd44, 0.5);
          badgeGfx.fillCircle(badgeX, badgeY, px(5));
          badgeGfx.fillStyle(0x44dd44, 0.8);
          badgeGfx.fillCircle(badgeX, badgeY, px(3));
        }
        scrollContainer.add(badgeGfx);

        // === Icon area (recessed well framed in the damage colour) ===
        const iconX = cardX + px(12);
        const iconY = cardY + (cardH - iconSize) / 2;
        const iconGfx = this.add.graphics();
        drawWell(iconGfx, iconX - px(2), iconY - px(2), iconSize + px(4), iconSize + px(4), px(4), isLearned ? dmgColor : 0x3a343f);
        scrollContainer.add(iconGfx);

        // Skill icon texture
        const iconKey = `skill_icon_${skill.id}`;
        const iconCx = iconX + iconSize / 2;
        const iconCy = iconY + iconSize / 2;
        if (this.textures.exists(iconKey)) {
          const iconImg = this.add.image(iconCx, iconCy, iconKey)
            .setDisplaySize(iconSize - px(2), iconSize - px(2))
            .setAlpha(isLearned ? 1 : (canLevel ? 0.75 : 0.35));
          if (!isLearned && !canLevel) iconImg.setTint(0x8a8290);
          scrollContainer.add(iconImg);
        } else {
          iconGfx.fillStyle(dmgColor, isLearned ? 0.5 : 0.12);
          const dR = px(8);
          iconGfx.fillTriangle(iconCx, iconCy - dR, iconCx + dR, iconCy, iconCx, iconCy + dR);
          iconGfx.fillTriangle(iconCx, iconCy - dR, iconCx - dR, iconCy, iconCx, iconCy + dR);
          scrollContainer.add(this.add.text(iconCx, iconCy, `T${skill.tier}`, {
            fontSize: fs(10), color: isLearned ? '#ccc' : '#444', fontFamily: FONT, fontStyle: 'bold',
          }).setOrigin(0.5));
        }

        // === Text area ===
        const textX = iconX + iconSize + px(14);

        // Skill name
        const nameColor = isMaxed ? UI_COLORS.goldBright : (isLearned ? '#f0e8d8' : (canLevel ? '#c8e8c0' : '#6e665c'));
        const nameText = this.add.text(textX, cardY + px(8), getSkillName(skill.id, skill.name), {
          fontSize: fs(14), color: nameColor, fontFamily: FONT, fontStyle: 'bold',
          stroke: '#000000', strokeThickness: Math.round(2 * DPR),
        });
        scrollContainer.add(nameText);

        // English name (inline after the localized name; skipped when identical)
        if (skill.nameEn && skill.nameEn !== nameText.text) {
          scrollContainer.add(this.add.text(textX + nameText.width + px(8), cardY + px(12), skill.nameEn, {
            fontSize: fs(10), color: '#6e665c', fontFamily: FONT, fontStyle: 'italic',
          }));
        }

        // Level pips (diamonds)
        const pipY = cardY + px(36);
        const pipGap = px(10);
        const maxPips = Math.min(skill.maxLevel, 20);
        const pipStartX = textX + px(4);
        const pipOn = pipTexture(this, px(8), isMaxed ? 0xffd98a : treeColor);
        const pipOff = pipTexture(this, px(8), null);
        let pipsShown = 0;
        for (let p = 0; p < maxPips; p++) {
          const pipX = pipStartX + p * pipGap;
          if (pipX + px(6) > cardX + cardW - px(80)) break;
          scrollContainer.add(this.add.image(pipX, pipY, p < level ? pipOn : pipOff));
          pipsShown++;
        }
        // Level text
        const lvColor = isMaxed ? UI_COLORS.goldBright : (isLearned ? '#d8d0e8' : '#6e665c');
        scrollContainer.add(this.add.text(pipStartX + pipsShown * pipGap + px(2), pipY, `${level}/${skill.maxLevel}`, {
          fontSize: fs(11), color: lvColor, fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0, 0.5));

        // Stats row
        const displayLevel = Math.max(1, level);
        const scaledDmg = getSkillDamageMultiplier(skill, displayLevel);
        const scaledMana = getSkillManaCost(skill, displayLevel);
        const scaledCD = getSkillCooldown(skill, displayLevel);
        const statsY = cardY + px(48);
        let statsStr = !isLearned && !canLevel
          ? this.getSkillLockText(investmentState)
          : '';
        const dmgName = DMG_NAMES[skill.damageType] ?? '';
        if (!statsStr) {
          if (skill.damageMultiplier > 0) statsStr += `${Math.round(scaledDmg * 100)}%`;
          statsStr += `  MP${scaledMana}  CD${(scaledCD / 1000).toFixed(1)}s`;
          if (dmgName) statsStr += `  ${dmgName}`;
        }
        scrollContainer.add(this.add.text(textX, statsY, statsStr, {
          fontSize: fs(11),
          color: !isLearned && !canLevel ? '#c07a6a' : '#a89c8a',
          fontFamily: FONT,
        }));

        // Synergy badge
        if (skill.synergies && skill.synergies.length > 0 && isLearned) {
          let hasActiveSyn = false;
          for (const syn of skill.synergies) {
            if (this.player.getSkillLevel(syn.skillId) > 0) { hasActiveSyn = true; break; }
          }
          if (hasActiveSyn) {
            const synBadge = this.add.graphics();
            synBadge.fillStyle(0x2a2340, 1);
            synBadge.fillRoundedRect(cardX + cardW - px(52), cardY + cardH - px(22), px(44), px(16), px(4));
            synBadge.lineStyle(1, 0x9a88ee, 0.9);
            synBadge.strokeRoundedRect(cardX + cardW - px(52), cardY + cardH - px(22), px(44), px(16), px(4));
            scrollContainer.add(synBadge);
            scrollContainer.add(this.add.text(cardX + cardW - px(30), cardY + cardH - px(14), t('ui.skillTree.synergy'), {
              fontSize: fs(10), color: '#c8bcff', fontFamily: FONT, fontStyle: 'bold',
            }).setOrigin(0.5));
          }
        }

        // Hover area for tooltip
        const cardHit = this.add.rectangle(cardX + cardW / 2, cardY + cardH / 2, cardW, cardH, 0x000000, 0)
          .setInteractive({ useHandCursor: false });
        cardHit.on('pointerover', () => {
          cardGfx.clear();
          drawCard(cardGfx, cardX, cardY, cardW, cardH, hoverStyle);
          this.showSkillTooltip(skill, panelX + cardX, panelY + cardY, cardW, DMG_NAMES, TREE_NAMES);
        });
        cardHit.on('pointerout', () => {
          cardGfx.clear();
          drawCard(cardGfx, cardX, cardY, cardW, cardH, cardStyle);
          this.skillTooltip?.destroy(); this.skillTooltip = null;
        });
        scrollContainer.add(cardHit);

        // + Button
        if (canLevel) {
          const btnSize = px(26);
          const plusBtn = this.makeButton(cardX + cardW - btnSize / 2 - px(10), cardY + btnSize / 2 + px(8), btnSize, btnSize, '+', () => {
            const result = investSkillPoint(
              skill,
              this.player.classData.skills,
              this.player.skillLevels,
              this.player.level,
              this.player.freeSkillPoints,
            );
            if (result.invested) {
              this.player.freeSkillPoints = result.freeSkillPoints;
              this.player.skillLevels = result.skillLevels;
              EventBus.emit(GameEvents.SKILL_LEVEL_CHANGED, {
                skillId: skill.id,
                level: this.player.getSkillLevel(skill.id),
              });
              this.toggleSkillTree(); this.toggleSkillTree();
            }
          }, { variant: 'success', fontSize: 17, bold: true });
          scrollContainer.add(plusBtn);
        }
      });
    };

    // Draw tab buttons
    const tabContainer = this.add.container(0, 0);
    this.skillPanel.add(tabContainer);

    const drawTabs = () => {
      tabContainer.removeAll(true);
      treeNames.forEach((treeName, ti) => {
        const treeColor = TREE_COLORS[treeName] ?? 0x888888;
        const treeColorHex = '#' + treeColor.toString(16).padStart(6, '0');
        const displayName = TREE_NAMES[treeName] ?? treeName;
        const isActive = ti === this.skillTreeActiveTab;
        const tx = tabMargin + ti * (tabW + tabGap);

        tabContainer.add(this.add.image(tx, tabY, tabTexture(this, tabW, tabH, isActive, treeColor)).setOrigin(0, 0));

        const treeSkills = treeSkillsMap.get(treeName) ?? [];
        const learnedCount = treeSkills.filter(s => this.player.getSkillLevel(s.id) > 0).length;

        const tabLabel = this.add.text(tx + tabW / 2, tabY + tabH / 2 - px(1), displayName, {
          fontSize: fs(13), color: isActive ? UI_COLORS.parchment : '#8a8290', fontFamily: FONT, fontStyle: 'bold',
          stroke: '#000000', strokeThickness: Math.round(2 * DPR),
        }).setOrigin(0.5);
        tabContainer.add(tabLabel);

        if (learnedCount > 0) {
          const badge = this.add.text(tx + tabW - px(12), tabY + tabH / 2 - px(1), `${learnedCount}`, {
            fontSize: fs(10), color: isActive ? treeColorHex : '#6e665c', fontFamily: FONT, fontStyle: 'bold',
          }).setOrigin(0.5, 0.5);
          tabContainer.add(badge);
        }

        const tabHit = this.add.rectangle(tx + tabW / 2, tabY + tabH / 2, tabW, tabH, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        tabHit.on('pointerdown', () => {
          if (this.skillTreeActiveTab !== ti) {
            this.skillTreeActiveTab = ti;
            drawTabs();
            renderTab(ti);
          }
        });
        tabContainer.add(tabHit);
      });
    };

    // Wheel scroll handler
    this.skillTreeWheelHandler = (_pointer: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      if (!this.skillPanel) return;
      const tabIndex = this.skillTreeActiveTab;
      const treeSkills = treeSkillsMap.get(treeNames[tabIndex]) ?? [];
      const totalContentH = treeSkills.length * (cardH + cardGap) + px(30);
      const maxScrollY = Math.max(0, totalContentH - contentH);
      const scroll = this.skillTreeScrollY[tabIndex] ?? 0;
      const newScroll = Phaser.Math.Clamp(scroll + dy * 0.5, 0, maxScrollY);
      if (newScroll !== scroll) {
        this.skillTreeScrollY[tabIndex] = newScroll;
        renderTab(tabIndex);
      }
    };
    this.input.on('wheel', this.skillTreeWheelHandler);

    drawTabs();
    renderTab(this.skillTreeActiveTab);

    // Footer
    this.skillPanel.add(this.add.text(pw / 2, ph - px(16), t('ui.skillTree.footer'), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5));
  }

  /** Show skill tooltip — extracted helper method */
  private showSkillTooltip(
    skill: typeof this.player.classData.skills[0],
    cardWorldX: number, cardWorldY: number, cardW: number,
    DMG_NAMES: Record<string, string>, _TREE_NAMES: Record<string, string>,
  ): void {
    this.skillTooltip?.destroy();
    const level = this.player.getSkillLevel(skill.id);
    const scaledDmg = getSkillDamageMultiplier(skill, level);
    const scaledMana = getSkillManaCost(skill, level);
    const scaledCD = getSkillCooldown(skill, level);
    const scaledAoe = getSkillAoeRadius(skill, level);
    const dmgName = DMG_NAMES[skill.damageType] ?? skill.damageType;

    const lines: string[] = [];
    lines.push(getSkillDesc(skill.id, skill.description));
    lines.push('');
    if (skill.damageMultiplier > 0) lines.push(t('ui.skillTree.tooltip.damage', { value: String(Math.round(scaledDmg * 100)), type: dmgName }));
    lines.push(t('ui.skillTree.tooltip.cost', { value: String(scaledMana) }));
    lines.push(t('ui.skillTree.tooltip.cooldown', { value: (scaledCD / 1000).toFixed(1) }));
    lines.push(t('ui.skillTree.tooltip.range', { value: String(skill.range) }));
    if (skill.aoe && scaledAoe > 0) lines.push(t('ui.skillTree.tooltip.aoeRadius', { value: scaledAoe.toFixed(1) }));
    if (skill.critBonus) lines.push(t('ui.skillTree.tooltip.critBonus', { value: String(skill.critBonus) }));
    if (skill.stunDuration) lines.push(t('ui.skillTree.tooltip.stun', { value: (skill.stunDuration / 1000).toFixed(1) }));
    if (skill.buff) {
      const buffVal = getSkillBuffValue(skill, level);
      const buffDur = getSkillBuffDuration(skill, level);
      lines.push(t('ui.skillTree.tooltip.buff', { stat: skill.buff.stat, value: String(Math.round(buffVal * 100)), duration: (buffDur / 1000).toFixed(0) }));
    }

    if (skill.synergies && skill.synergies.length > 0) {
      lines.push('');
      lines.push(t('ui.skillTree.tooltip.synergyHeader'));
      for (const syn of skill.synergies) {
        const synSkill = this.player.classData.skills.find(s => s.id === syn.skillId);
        const synLv = this.player.getSkillLevel(syn.skillId);
        if (synSkill) {
          const bonus = Math.round(syn.damagePerLevel * synLv * 100);
          lines.push(t('ui.skillTree.tooltip.synergyLine', { name: getSkillName(synSkill.id, synSkill.name), perLevel: String(syn.damagePerLevel * 100), bonus: String(bonus) }));
        }
      }
    }

    if (level < skill.maxLevel) {
      lines.push('');
      lines.push(t('ui.skillTree.tooltip.nextLevel', { level: String(level + 1) }));
      const nextDmg = getSkillDamageMultiplier(skill, level + 1);
      const nextMana = getSkillManaCost(skill, level + 1);
      const nextCD = getSkillCooldown(skill, level + 1);
      if (skill.damageMultiplier > 0) {
        const delta = Math.round((nextDmg - scaledDmg) * 100);
        lines.push(t('ui.skillTree.tooltip.damage', { value: String(Math.round(nextDmg * 100)), type: `(+${delta}%)` }));
      }
      if (nextMana !== scaledMana) lines.push(t('ui.skillTree.tooltip.cost', { value: String(nextMana) }));
      if (nextCD !== scaledCD) lines.push(t('ui.skillTree.tooltip.cooldown', { value: (nextCD / 1000).toFixed(1) }));
    }

    const tipW = px(280);
    const tipPad = px(PANEL_STYLE.tooltip.padding);
    const wrapW = tipW - tipPad * 2;
    const tipText = lines.join('\n');

    const localizedSkillName = getSkillName(skill.id, skill.name);
    const tipHeader = this.add.text(0, 0, skill.nameEn && skill.nameEn !== localizedSkillName ? `${localizedSkillName} (${skill.nameEn})` : localizedSkillName, {
      fontSize: fs(PANEL_STYLE.tooltip.titleSize + 1), color: UI_COLORS.parchment, fontFamily: PANEL_STYLE.tooltip.font, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
      wordWrap: { width: wrapW, useAdvancedWrap: true },
    });
    const headerHeight = tipHeader.height;
    const headerBottom = tipPad + headerHeight + px(10);

    const textObj = this.add.text(tipPad, headerBottom, tipText, {
      fontSize: fs(PANEL_STYLE.tooltip.bodySize), color: '#ddd8cc', fontFamily: PANEL_STYLE.tooltip.font, lineSpacing: px(PANEL_STYLE.tooltip.lineSpacing),
      wordWrap: { width: wrapW, useAdvancedWrap: true },
    });

    const finalH = textObj.y + textObj.height + tipPad;

    let tipX = cardWorldX + cardW + px(8);
    if (tipX + tipW > W) tipX = cardWorldX - tipW - px(8);
    let tipY = cardWorldY;
    if (tipY + finalH > H) tipY = H - finalH - px(4);
    if (tipY < px(4)) tipY = px(4);

    this.skillTooltip = this.add.container(tipX, tipY).setDepth(PANEL_STYLE.depth.tooltip);
    this.skillTooltip.add(addFrame(this, 0, 0, tipW, finalH, { variant: 'tooltip' }));
    tipHeader.setPosition(tipW / 2, tipPad).setOrigin(0.5, 0);
    this.skillTooltip.add(tipHeader);
    this.skillTooltip.add(addDivider(this, tipW / 2, headerBottom - px(3), tipW - tipPad * 2));
    this.skillTooltip.add(textObj);
  }

  // --- Character Stats Panel (C) ---
  private toggleCharacter(): void {
    if (this.charPanel) { this.charPanel.destroy(); this.charPanel = null; return; }
    this.closeAllPanels();
    const pw = px(380), ph = px(512), panelX = (W - pw) / 2, panelY = px(14);
    this.charPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    const panel = this.charPanel;
    this.animatePanelOpen(panel);
    panel.add(this.createPanelBg(pw, ph));
    panel.add(this.createPanelTitle(pw, t('ui.character.title', { className: getClassName(this.player.classData.id ?? 'warrior') })));
    panel.add(this.createPanelCloseBtn(pw, () => this.toggleCharacter()));
    // Subtitle sits below the header band (it used to overlap the title)
    panel.add(this.add.text(pw / 2, px(52), t('ui.character.subtitle', { level: String(this.player.level), points: String(this.player.freeStatPoints) }), {
      fontSize: fs(13), color: this.player.freeStatPoints > 0 ? UI_COLORS.goldBright : UI_COLORS.textSoft, fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0.5, 0.5));

    const statKeys: [string, keyof typeof this.player.stats, string][] = [
      [t('ui.character.stat.str'), 'str', t('ui.character.stat.str.desc')],
      [t('ui.character.stat.dex'), 'dex', t('ui.character.stat.dex.desc')],
      [t('ui.character.stat.vit'), 'vit', t('ui.character.stat.vit.desc')],
      [t('ui.character.stat.int'), 'int', t('ui.character.stat.int.desc')],
      [t('ui.character.stat.spi'), 'spi', t('ui.character.stat.spi.desc')],
      [t('ui.character.stat.lck'), 'lck', t('ui.character.stat.lck.desc')],
    ];
    const eqStatsRaw = this.zone.inventorySystem.getEquipmentStats();
    const statRowH = px(42);
    const rowX = px(18), rowW = pw - px(36);
    const firstRowY = px(70);
    statKeys.forEach(([label, key, desc], i) => {
      const sy = firstRowY + i * statRowH;
      const base = this.player.stats[key];
      const bonus = eqStatsRaw[key] ?? 0;
      const card = this.add.graphics();
      drawCard(card, rowX, sy, rowW, statRowH - px(5), { border: 0x3f3845 });
      panel.add(card);
      panel.add(this.add.text(rowX + px(12), sy + px(5), label, {
        fontSize: fs(13), color: UI_COLORS.text, fontFamily: FONT, fontStyle: 'bold',
      }));
      panel.add(this.add.text(rowX + px(12), sy + px(21), desc, {
        fontSize: fs(10), color: UI_COLORS.muted, fontFamily: FONT,
      }));
      const valStr = bonus > 0 ? `${base} (+${bonus})` : `${base}`;
      panel.add(this.add.text(rowX + rowW - px(50), sy + (statRowH - px(5)) / 2, valStr, {
        fontSize: fs(15), color: bonus > 0 ? '#8be9fd' : '#ffffff', fontFamily: FONT, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: Math.round(2 * DPR),
      }).setOrigin(1, 0.5));
      if (this.player.freeStatPoints > 0) {
        panel.add(this.makeButton(rowX + rowW - px(22), sy + (statRowH - px(5)) / 2, px(26), px(26), '+', () => {
          if (this.player.freeStatPoints > 0) {
            this.player.freeStatPoints--;
            this.player.stats[key]++;
            this.player.recalcDerived();
            this.toggleCharacter(); this.toggleCharacter();
          }
        }, { variant: 'success', fontSize: 17, bold: true }));
      }
    });

    const dividerY = firstRowY + statKeys.length * statRowH + px(10);
    panel.add(addSectionHeader(this, rowX, dividerY, rowW, t('ui.character.derivedHeader')));

    const dy = dividerY + px(14);
    const eqStats = this.zone.inventorySystem.getEquipmentStats();
    const effectiveDex = this.player.stats.dex + (eqStats['dex'] ?? 0);
    const effectiveLck = this.player.stats.lck + (eqStats['lck'] ?? 0);
    const critPct = (effectiveDex * 0.2 + effectiveLck * 0.5 + (eqStats['critRate'] ?? 0)).toFixed(1);
    const derived: [string, string, string][] = [
      ['HP', `${Math.ceil(this.player.hp)}/${this.player.maxHp}`, '#ff8a72'],
      ['MP', `${Math.ceil(this.player.mana)}/${this.player.maxMana}`, '#7fb6ff'],
      [t('ui.character.computed.attack'), `${Math.floor(this.player.baseDamage)}${eqStats['damage'] ? ` (+${eqStats['damage']})` : ''}${eqStats['damagePercent'] ? ` +${eqStats['damagePercent']}%` : ''}`, UI_COLORS.text],
      [t('ui.character.computed.defense'), `${Math.floor(this.player.defense)}${eqStats['defense'] ? ` (+${eqStats['defense']})` : ''}`, UI_COLORS.text],
      [t('ui.character.computed.critRate'), `${critPct}%`, UI_COLORS.text],
      [t('ui.character.computed.critDamage'), `${150 + (eqStats['critDamage'] ?? 0)}%`, UI_COLORS.text],
      [t('ui.character.computed.gold'), `${this.player.gold}G`, '#ffd35a'],
    ];
    const well = this.add.graphics();
    drawWell(well, rowX, dy, rowW, derived.length * px(19) + px(10), px(4));
    panel.add(well);
    derived.forEach(([label, value, color], i) => {
      const ly = dy + px(14) + i * px(19);
      panel.add(this.add.text(rowX + px(12), ly, label, {
        fontSize: fs(12), color: UI_COLORS.muted, fontFamily: FONT,
      }).setOrigin(0, 0.5));
      panel.add(this.add.text(rowX + rowW - px(12), ly, value, {
        fontSize: fs(12), color, fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(1, 0.5));
    });
  }

  // --- Homestead Panel (H) ---
  /** Building icon drawing helpers keyed by building id */
  private static readonly BUILDING_ICONS: Record<string, (g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number, level: number, maxLevel: number) => void> = {
    herb_garden: (g, cx, cy, s, level, maxLevel) => {
      // Pot/garden — evolves from bare pot to lush garden
      const potW = s * 0.6, potH = s * 0.35;
      g.fillStyle(0x8B4513, 0.9);
      g.fillRoundedRect(cx - potW / 2, cy + s * 0.1, potW, potH, s * 0.06);
      g.fillStyle(0x553311, 0.8);
      g.fillRect(cx - potW * 0.55 / 2, cy + s * 0.06, potW * 0.55, s * 0.06);
      // Plants grow with level
      const plantCount = Math.max(1, Math.ceil(level / maxLevel * 5));
      for (let i = 0; i < plantCount; i++) {
        const px = cx - potW / 2 + (i + 0.5) * (potW / plantCount);
        const ph = s * 0.15 + (level / maxLevel) * s * 0.25;
        g.fillStyle(0x27ae60, 0.9);
        g.fillTriangle(px, cy + s * 0.1 - ph, px - s * 0.06, cy + s * 0.1, px + s * 0.06, cy + s * 0.1);
        if (level >= 3) {
          g.fillStyle(0xff6b6b, 0.8);
          g.fillCircle(px, cy + s * 0.1 - ph + s * 0.02, s * 0.03);
        }
      }
    },
    training_ground: (g, cx, cy, s, level, maxLevel) => {
      // Training dummy — evolves from simple post to armored dummy
      g.fillStyle(0x8B7355, 0.9);
      g.fillRect(cx - s * 0.04, cy - s * 0.1, s * 0.08, s * 0.4);
      // Cross arm
      g.fillRect(cx - s * 0.2, cy - s * 0.05, s * 0.4, s * 0.06);
      // Head
      const headR = s * (0.08 + level / maxLevel * 0.04);
      g.fillStyle(0xDEB887, 0.9);
      g.fillCircle(cx, cy - s * 0.2, headR);
      // Armor at higher levels
      if (level >= 2) {
        g.fillStyle(0x888888, 0.6);
        g.fillRect(cx - s * 0.1, cy - s * 0.1, s * 0.2, s * 0.2);
      }
      if (level >= 4) {
        g.lineStyle(2, 0xc0934a, 0.8);
        g.strokeCircle(cx, cy - s * 0.2, headR + s * 0.03);
      }
    },
    gem_workshop: (g, cx, cy, s, level, maxLevel) => {
      // Gem/anvil — evolves from simple anvil to glowing gem station
      g.fillStyle(0x555555, 0.9);
      g.fillRect(cx - s * 0.2, cy + s * 0.05, s * 0.4, s * 0.15);
      g.fillRect(cx - s * 0.15, cy - s * 0.1, s * 0.3, s * 0.15);
      // Gems on top, count increases with level
      const gemColors = [0xff4444, 0x4488ff, 0x44ff44, 0xffcc44];
      const gemCount = Math.min(gemColors.length, Math.max(1, Math.ceil(level / maxLevel * 4)));
      for (let i = 0; i < gemCount; i++) {
        const gx = cx - s * 0.12 + i * s * 0.08;
        g.fillStyle(gemColors[i], 0.9);
        const gr = s * 0.04;
        g.fillTriangle(gx, cy - s * 0.2, gx - gr, cy - s * 0.12, gx + gr, cy - s * 0.12);
        g.fillRect(gx - gr, cy - s * 0.12, gr * 2, gr);
      }
      // Sparkle at high levels
      if (level >= 3) {
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(cx + s * 0.15, cy - s * 0.22, s * 0.02);
        g.fillCircle(cx - s * 0.1, cy - s * 0.18, s * 0.015);
      }
    },
    pet_house: (g, cx, cy, s, level, maxLevel) => {
      // Pet house — evolves from small hut to grand shelter
      const houseW = s * (0.4 + level / maxLevel * 0.2);
      const houseH = s * (0.25 + level / maxLevel * 0.1);
      g.fillStyle(0x8B6914, 0.9);
      g.fillRect(cx - houseW / 2, cy, houseW, houseH);
      // Roof
      g.fillStyle(0xA0522D, 0.9);
      g.fillTriangle(cx, cy - s * 0.2, cx - houseW / 2 - s * 0.05, cy + s * 0.02, cx + houseW / 2 + s * 0.05, cy + s * 0.02);
      // Door
      g.fillStyle(0x553311, 0.9);
      g.fillRect(cx - s * 0.04, cy + houseH * 0.3, s * 0.08, houseH * 0.7);
      // Paw prints at higher levels
      if (level >= 2) {
        g.fillStyle(0xDEB887, 0.5);
        g.fillCircle(cx + houseW / 2 + s * 0.08, cy + houseH - s * 0.02, s * 0.025);
        g.fillCircle(cx + houseW / 2 + s * 0.12, cy + houseH - s * 0.06, s * 0.015);
      }
    },
    warehouse: (g, cx, cy, s, level, maxLevel) => {
      // Warehouse/crate — evolves from small crate to stacked warehouse
      const crateCount = Math.max(1, Math.ceil(level / maxLevel * 3));
      for (let i = 0; i < crateCount; i++) {
        const crateW = s * 0.25;
        const crateH = s * 0.2;
        const ox = (i - (crateCount - 1) / 2) * s * 0.15;
        const oy = -i * s * 0.12;
        g.fillStyle(0x8B7355, 0.9);
        g.fillRect(cx - crateW / 2 + ox, cy + oy, crateW, crateH);
        g.lineStyle(1, 0x664422, 0.7);
        g.strokeRect(cx - crateW / 2 + ox, cy + oy, crateW, crateH);
        // Cross planks
        g.lineStyle(1, 0x664422, 0.5);
        g.beginPath();
        g.moveTo(cx - crateW / 2 + ox, cy + oy);
        g.lineTo(cx + crateW / 2 + ox, cy + oy + crateH);
        g.moveTo(cx + crateW / 2 + ox, cy + oy);
        g.lineTo(cx - crateW / 2 + ox, cy + oy + crateH);
        g.strokePath();
      }
    },
    altar: (g, cx, cy, s, level, maxLevel) => {
      // Mystical altar — evolves with glow intensity
      g.fillStyle(0x555566, 0.9);
      g.fillRect(cx - s * 0.15, cy + s * 0.05, s * 0.3, s * 0.2);
      g.fillRect(cx - s * 0.2, cy + s * 0.2, s * 0.4, s * 0.06);
      // Crystal on top
      const crystalH = s * (0.15 + level / maxLevel * 0.1);
      g.fillStyle(0x8e44ad, 0.8);
      g.fillTriangle(cx, cy + s * 0.05 - crystalH, cx - s * 0.06, cy + s * 0.05, cx + s * 0.06, cy + s * 0.05);
      // Glow intensifies with level
      const glowAlpha = 0.1 + (level / maxLevel) * 0.3;
      g.fillStyle(0xbb77ff, glowAlpha);
      g.fillCircle(cx, cy - s * 0.05, s * 0.15 + level * s * 0.02);
      // Runes at higher levels
      if (level >= 2) {
        g.fillStyle(0xbb77ff, 0.5);
        g.fillCircle(cx - s * 0.12, cy + s * 0.15, s * 0.02);
        g.fillCircle(cx + s * 0.12, cy + s * 0.15, s * 0.02);
      }
    },
  };

  /** Pet rarity colors */
  private static readonly PET_RARITY_COLORS: Record<string, number> = {
    common: 0x888888,
    rare: 0x2471a3,
    epic: 0xd35400,
  };

  /** Pet bonus stat icon emojis (display text) — now resolved via locale */
  private static readonly PET_STAT_LABELS: Record<string, string> = {
    expBonus: 'expBonus',
    damage: 'damage',
    magicFind: 'magicFind',
    critRate: 'critRate',
    hpRegen: 'hpRegen',
    attackSpeed: 'attackSpeed',
    defense: 'defense',
    manaRegen: 'manaRegen',
  };

  private toggleHomestead(): void {
    if (this.homesteadPanel) { this.homesteadPanel.destroy(); this.homesteadPanel = null; return; }
    this.closeAllPanels();
    const pw = px(520), ph = px(560), panelX = (W - pw) / 2, panelY = px(8);
    this.homesteadPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    const panel = this.homesteadPanel;
    this.animatePanelOpen(panel);
    panel.add(this.createPanelBg(pw, ph));
    panel.add(this.createPanelTitle(pw, t('ui.homestead.title')));
    panel.add(this.createPanelCloseBtn(pw, () => this.toggleHomestead()));

    const hs = this.zone.homesteadSystem;
    const buildings = hs.getAllBuildings();
    const rowX = px(16), rowW = pw - px(32);

    // === Buildings Section ===
    const sectionHeaderY = px(52);
    panel.add(addSectionHeader(this, rowX, sectionHeaderY, rowW, t('ui.homestead.buildingsHeader')));

    const buildingStartY = sectionHeaderY + px(12);
    const buildingH = px(52);
    const buildingGap = px(5);
    const iconAreaSize = px(40);

    buildings.forEach((b, i) => {
      const sy = buildingStartY + i * (buildingH + buildingGap);
      const lv = hs.getBuildingLevel(b.id);
      const maxed = lv >= b.maxLevel;
      const cost = maxed ? 0 : b.costPerLevel[lv]?.gold ?? 0;
      const canUpgrade = !maxed && this.player.gold >= cost;

      // Building card background
      const cardGfx = this.add.graphics();
      drawCard(cardGfx, rowX, sy, rowW, buildingH, maxed
        ? { fill: 0x241d12, border: 0xd4a54a, strip: 0xd4a54a }
        : { border: 0x3f3845 });
      panel.add(cardGfx);

      // Building icon area
      const iconX = rowX + px(10);
      const iconY = sy + (buildingH - iconAreaSize) / 2;
      const iconGfx = this.add.graphics();
      drawWell(iconGfx, iconX, iconY, iconAreaSize, iconAreaSize, px(4), maxed ? 0xd4a54a : 0x4a4250);
      panel.add(iconGfx);

      // Draw building icon (procedural illustration)
      const iconDrawer = UIScene.BUILDING_ICONS[b.id];
      if (iconDrawer) {
        const buildingIconGfx = this.add.graphics();
        iconDrawer(buildingIconGfx, iconX + iconAreaSize / 2, iconY + iconAreaSize / 2, iconAreaSize, lv, b.maxLevel);
        panel.add(buildingIconGfx);
      }

      // Text area
      const textX = iconX + iconAreaSize + px(12);
      const textMaxW = rowW - (textX - rowX) - px(104);
      panel.add(this.add.text(textX, sy + px(6), getBuildingName(b.id, b.name), {
        fontSize: fs(13), color: maxed ? UI_COLORS.goldBright : UI_COLORS.text, fontFamily: FONT, fontStyle: 'bold',
      }));
      const descT = this.add.text(textX, sy + px(23), getBuildingDesc(b.id, b.description), {
        fontSize: fs(10), color: UI_COLORS.muted, fontFamily: FONT,
      });
      if (descT.width > textMaxW) descT.setScale(textMaxW / descT.width, 1);
      panel.add(descT);

      // Level progress pips
      const pipY = sy + px(41);
      const pipGapH = px(11);
      const on = pipTexture(this, px(8), maxed ? 0xffd98a : 0x6fd35a);
      const off = pipTexture(this, px(8), null);
      for (let p = 0; p < b.maxLevel; p++) {
        panel.add(this.add.image(textX + px(4) + p * pipGapH, pipY, p < lv ? on : off));
      }
      // Level text
      panel.add(this.add.text(textX + b.maxLevel * pipGapH + px(4), pipY, `Lv.${lv}/${b.maxLevel}`, {
        fontSize: fs(10), color: maxed ? UI_COLORS.goldBright : UI_COLORS.muted, fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      // Upgrade button (global style) / max badge
      const btnCx = rowX + rowW - px(52);
      const btnCy = sy + buildingH / 2;
      if (maxed) {
        const badgeGfx = this.add.graphics();
        badgeGfx.fillStyle(0x3a2a10, 1);
        badgeGfx.fillRoundedRect(btnCx - px(34), btnCy - px(11), px(68), px(22), px(11));
        badgeGfx.lineStyle(1.5, 0xffd98a, 1);
        badgeGfx.strokeRoundedRect(btnCx - px(34), btnCy - px(11), px(68), px(22), px(11));
        panel.add(badgeGfx);
        panel.add(this.add.text(btnCx, btnCy, t('ui.homestead.maxLevel'), {
          fontSize: fs(11), color: UI_COLORS.goldBright, fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0.5));
      } else {
        panel.add(this.makeButton(btnCx, btnCy, px(84), px(28), t('ui.homestead.upgrade', { cost: String(cost) }), () => {
          const actualCost = hs.upgrade(b.id);
          this.player.gold -= actualCost;
          this.toggleHomestead(); this.toggleHomestead();
        }, { variant: 'success', disabled: !canUpgrade, fontSize: 11 }));
      }
    });

    // === Pets Section ===
    const petSectionY = buildingStartY + buildings.length * (buildingH + buildingGap) + px(14);
    panel.add(addSectionHeader(this, rowX, petSectionY, rowW, t('ui.homestead.petsHeader', { count: String(hs.pets.length) })));

    const pets = hs.pets;
    const petStartY = petSectionY + px(12);
    const petCardH = px(46);
    const petGap = px(5);
    const petIconSize = px(34);
    const footerY = ph - px(18);

    if (pets.length === 0) {
      panel.add(this.add.text(pw / 2, petStartY + px(14), t('ui.homestead.noPets'), {
        fontSize: fs(11), color: UI_COLORS.dim, fontFamily: FONT, align: 'center',
        wordWrap: { width: rowW - px(20), useAdvancedWrap: true },
      }).setOrigin(0.5, 0));
    }

    pets.forEach((p, i) => {
      const pd = hs.getAllPets().find(d => d.id === p.petId);
      if (!pd) return;
      const isActive = hs.activePet === p.petId;
      const py = petStartY + i * (petCardH + petGap);
      if (py + petCardH > footerY - px(10)) return; // keep inside the panel
      const rarityColor = UIScene.PET_RARITY_COLORS[pd.rarity] ?? 0x888888;

      // Pet card bg
      const petCard = this.add.graphics();
      drawCard(petCard, rowX, py, rowW, petCardH, isActive
        ? { fill: 0x172414, border: 0x6fd35a, glow: 0x6fd35a, strip: 0x6fd35a }
        : { border: rarityColor, borderAlpha: 0.7 });
      panel.add(petCard);

      // Pet icon area with rarity-colored border
      const petIconX = rowX + px(10);
      const petIconY = py + (petCardH - petIconSize) / 2;
      const petIconGfx = this.add.graphics();
      drawWell(petIconGfx, petIconX, petIconY, petIconSize, petIconSize, px(4), rarityColor);
      // Simple procedural pet icon based on petId
      const pcx = petIconX + petIconSize / 2;
      const pcy = petIconY + petIconSize / 2;
      petIconGfx.fillStyle(rarityColor, 0.8);
      petIconGfx.fillCircle(pcx, pcy + petIconSize * 0.08, petIconSize * 0.24);
      petIconGfx.fillCircle(pcx, pcy - petIconSize * 0.14, petIconSize * 0.18);
      petIconGfx.fillTriangle(pcx - petIconSize * 0.2, pcy - petIconSize * 0.2, pcx - petIconSize * 0.1, pcy - petIconSize * 0.38, pcx - petIconSize * 0.04, pcy - petIconSize * 0.24);
      petIconGfx.fillTriangle(pcx + petIconSize * 0.2, pcy - petIconSize * 0.2, pcx + petIconSize * 0.1, pcy - petIconSize * 0.38, pcx + petIconSize * 0.04, pcy - petIconSize * 0.24);
      petIconGfx.fillStyle(0xffffff, 0.9);
      petIconGfx.fillCircle(pcx - petIconSize * 0.06, pcy - petIconSize * 0.16, petIconSize * 0.04);
      petIconGfx.fillCircle(pcx + petIconSize * 0.06, pcy - petIconSize * 0.16, petIconSize * 0.04);
      panel.add(petIconGfx);

      // Pet name + evolution suffix
      const evolvedStages = hs.getEvolutionStages();
      let displayName = getPetName(pd.id, pd.name);
      if (p.evolved > 0 && evolvedStages[p.evolved - 1]) {
        displayName += evolvedStages[p.evolved - 1].nameSuffix;
      }
      const rarityHex = '#' + rarityColor.toString(16).padStart(6, '0');

      const petTextX = petIconX + petIconSize + px(10);
      panel.add(this.add.text(petTextX, py + px(5), displayName, {
        fontSize: fs(12), color: isActive ? '#8ff07a' : rarityHex, fontFamily: FONT, fontStyle: 'bold',
      }));

      // Bonus stat label
      const statLabel = getPetStatLabel(pd.bonusStat);
      const currentBonus = pd.bonusValue + pd.bonusPerLevel * p.level;
      panel.add(this.add.text(rowX + rowW - px(40), py + px(6), `${statLabel} +${currentBonus.toFixed(1)}`, {
        fontSize: fs(11), color: UI_COLORS.textSoft, fontFamily: FONT,
      }).setOrigin(1, 0));

      // Exp bar
      const expBarX = petTextX;
      const expBarY = py + px(28);
      const expBarW = px(140);
      const expBarH = px(7);
      const expThreshold = p.level * 20;
      const expRatio = expThreshold > 0 ? Math.min(1, p.exp / expThreshold) : 1;
      const expBarGfx = this.add.graphics();
      drawWell(expBarGfx, expBarX, expBarY, expBarW, expBarH, px(3));
      drawBarFill(expBarGfx, expBarX + 1, expBarY + 1, Math.round((expBarW - 2) * expRatio), expBarH - 2, isActive ? 0x6fd35a : rarityColor);
      panel.add(expBarGfx);

      // Level text
      const isMaxLevel = p.level >= pd.maxLevel;
      panel.add(this.add.text(expBarX + expBarW + px(8), expBarY + expBarH / 2, isMaxLevel ? `Lv.${p.level} MAX` : `Lv.${p.level} (${p.exp}/${expThreshold})`, {
        fontSize: fs(10), color: isMaxLevel ? UI_COLORS.goldBright : UI_COLORS.muted, fontFamily: FONT,
      }).setOrigin(0, 0.5));

      // Active indicator badge
      if (isActive) {
        panel.add(this.add.text(rowX + rowW - px(18), py + petCardH / 2, '✦', {
          fontSize: fs(16), color: '#8ff07a', fontFamily: FONT,
        }).setOrigin(0.5));
      }
    });

    // Footer
    panel.add(this.add.text(pw / 2, footerY, t('ui.homestead.footer'), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5));
  }

  // --- Minimap ---
  private createMinimap(): void {
    const size = MINIMAP_SIZE;
    const { x, y } = HUD.minimap;
    this.add.rectangle(x + size / 2, y + size / 2, size, size, 0x07060a, 1).setDepth(2999);
    this.minimap = this.add.graphics().setDepth(3000);
    this.minimap.setPosition(x, y);
    const frame = minimapFrameTexture(this, size);
    this.add.image(x - frame.pad, y - frame.pad, frame.key).setOrigin(0, 0).setDepth(3001);
  }

  private updateMinimap(): void {
    if (!this.minimap || !this.zone) return;
    this.minimap.clear();
    // Use AllMaps for regular zones; fall back to scene's mapData for dungeons/sub-dungeons
    const mapData = AllMaps[(this.zone as any).currentMapId] ?? (this.zone as any).mapData;
    if (!mapData) return;
    const size = MINIMAP_SIZE;
    const sx = size / mapData.cols, sy = size / mapData.rows;
    const tileColors: Record<number, number> = {
      0: 0x4a8c3f, 1: 0x8b7355, 2: 0x6a6a6a, 3: 0x1a5276, 4: 0x4a4a4a, 5: 0x9e7c52,
    };
    for (let r = 0; r < mapData.rows; r++) {
      for (let c = 0; c < mapData.cols; c++) {
        const color = tileColors[mapData.tiles[r][c]] ?? 0x222222;
        this.minimap.fillStyle(color, 0.75);
        this.minimap.fillRect(c * sx, r * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    // Player dot (drawn with a dark ring so it reads on any terrain)
    this.minimap.fillStyle(0x000000, 0.8);
    this.minimap.fillCircle(this.player.tileCol * sx, this.player.tileRow * sy, 4 * DPR);
    this.minimap.fillStyle(0x7fd4ff);
    this.minimap.fillCircle(this.player.tileCol * sx, this.player.tileRow * sy, 2.8 * DPR);
    // Exits
    // Exits
    for (const exit of mapData.exits) {
      this.minimap.fillStyle(0x00e676);
      this.minimap.fillRect(exit.col * sx - 1.5 * DPR, exit.row * sy - 1.5 * DPR, 4 * DPR, 4 * DPR);
    }

    // Dungeon portal marker (red-orange diamond) — only in abyss_rift
    if ((this.zone as any).currentMapId === 'abyss_rift' && !(this.zone as any).isInDungeon) {
      const dpCol = 60, dpRow = 60; // DungeonSystem portal position
      this.minimap.fillStyle(0xFF6600, 0.9);
      this.minimap.fillCircle(dpCol * sx, dpRow * sy, 3 * DPR);
      this.minimap.lineStyle(1 * DPR, 0xFF3300, 0.8);
      this.minimap.strokeCircle(dpCol * sx, dpRow * sy, 4 * DPR);
    }

    // Quest NPC markers on minimap
    if (this.zone?.questSystem) {
      for (const camp of mapData.camps) {
        for (const npcId of camp.npcs) {
          const npcDef = NPCDefinitions[npcId];
          if (!npcDef || npcDef.type !== 'quest' || !npcDef.quests) continue;
          let hasAvailable = false;
          let hasCompleted = false;
          for (const qid of npcDef.quests) {
            const prog = this.zone.questSystem.progress.get(qid);
            if (prog && prog.status === 'completed') hasCompleted = true;
          }
          if (!hasCompleted) {
            const avail = this.zone.questSystem.getAvailableQuests(npcDef.quests, this.player.level);
            for (const q of avail) {
              const qProg = this.zone.questSystem.progress.get(q.id);
              if (!qProg || (qProg.status === 'failed' && q.reacceptable)) { hasAvailable = true; break; }
            }
          }
          if (hasCompleted || hasAvailable) {
            const color = hasCompleted ? 0xf1c40f : 0xf1c40f;
            this.minimap.fillStyle(color);
            this.minimap.fillCircle(camp.col * sx, camp.row * sy, 2.5 * DPR);
          }
        }
      }

      // Monster dots on minimap (red = aggro, orange = nearby)
      const monsters = (this.zone as any).monsters as { tileCol: number; tileRow: number; isAlive: () => boolean; isAggro: () => boolean }[];
      if (monsters) {
        for (const m of monsters) {
          if (!m.isAlive()) continue;
          const color = m.isAggro() ? 0xff4444 : 0xcc6644;
          const alpha = m.isAggro() ? 0.9 : 0.5;
          this.minimap.fillStyle(color, alpha);
          this.minimap.fillCircle(m.tileCol * sx, m.tileRow * sy, m.isAggro() ? 2 * DPR : 1.5 * DPR);
        }
      }

      // Active quest target area markers
      const activeQuests = this.zone.questSystem.getActiveQuests();
      for (const { quest, progress } of activeQuests) {
        if (progress.status !== 'active') continue;
        if (quest.zone !== (this.zone as any).currentMapId) continue;

        // Quest area marker
        if (quest.questArea) {
          const qa = quest.questArea;
          const qColor = quest.category === 'main' ? 0xf1c40f : 0x95a5a6;
          this.minimap.fillStyle(qColor, 0.25);
          this.minimap.fillCircle(qa.col * sx, qa.row * sy, qa.radius * sx);
          this.minimap.lineStyle(1 * DPR, qColor, 0.6);
          this.minimap.strokeCircle(qa.col * sx, qa.row * sy, qa.radius * sx);
        }
        // Explore objective markers
        for (let i = 0; i < quest.objectives.length; i++) {
          const obj = quest.objectives[i];
          if (obj.type === 'explore' && obj.location && progress.objectives[i].current < obj.required) {
            this.minimap.fillStyle(0xf39c12, 0.5);
            this.minimap.fillRect(obj.location.col * sx - 1.5 * DPR, obj.location.row * sy - 1.5 * DPR, 3 * DPR, 3 * DPR);
          }
          // Investigate clue markers (purple)
          if (obj.type === 'investigate_clue' && obj.location && progress.objectives[i].current < obj.required) {
            this.minimap.fillStyle(0x9b59b6, 0.6);
            this.minimap.fillRect(obj.location.col * sx - 1.5 * DPR, obj.location.row * sy - 1.5 * DPR, 3 * DPR, 3 * DPR);
          }
          // Escort destination marker (orange)
          if (obj.type === 'escort' && obj.location && progress.objectives[i].current < obj.required) {
            this.minimap.fillStyle(0xe67e22, 0.6);
            this.minimap.fillRect(obj.location.col * sx - 2 * DPR, obj.location.row * sy - 2 * DPR, 4 * DPR, 4 * DPR);
          }
        }

        // Defend target marker (red)
        if (quest.type === 'defend' && quest.defendTarget && progress.status === 'active') {
          const dt = quest.defendTarget;
          this.minimap.fillStyle(0xe74c3c, 0.5);
          this.minimap.fillCircle(dt.col * sx, dt.row * sy, 3 * DPR);
          this.minimap.lineStyle(1 * DPR, 0xe74c3c, 0.8);
          this.minimap.strokeCircle(dt.col * sx, dt.row * sy, 4 * DPR);
        }

        // Escort NPC start marker (orange)
        if (quest.type === 'escort' && quest.escortNpc && progress.status === 'active') {
          const en = quest.escortNpc;
          this.minimap.fillStyle(0xe67e22, 0.5);
          this.minimap.fillCircle(en.startCol * sx, en.startRow * sy, 2 * DPR);
        }
      }
    }
  }

  // --- NPC Dialogue Panel ---
  private openDialogue(data: { npcName: string; dialogue: string; actions: { label: string; callback: () => void }[] }): void {
    this.closeDialogue();
    this.closeAllPanels();
    audioManager.playSFX('click');

    // Full-screen transparent backdrop to catch outside clicks
    this.dialogueBackdrop = this.createBackdrop(0.6);
    this.dialogueBackdrop.on('pointerdown', () => this.closeDialogue());

    const pw = px(400);
    const bodyText = this.add.text(pw / 2, px(PANEL_STYLE.header.height) + px(14), data.dialogue, {
      fontSize: fs(14), color: UI_COLORS.text, fontFamily: FONT, align: 'center', lineSpacing: px(3),
      wordWrap: { width: pw - px(44), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    const btnH = px(32), btnGap = px(8);
    const btnStartY = bodyText.y + bodyText.height + px(16);
    const ph = btnStartY + data.actions.length * (btnH + btnGap) + px(34);
    const panelX = (W - pw) / 2, panelY = H / 2 - ph / 2;
    this.dialoguePanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    const panel = this.dialoguePanel;
    this.animatePanelOpen(panel);
    panel.add(this.createPanelBg(pw, ph));

    // NPC name
    panel.add(this.createPanelTitle(pw, data.npcName));
    panel.add(this.createPanelCloseBtn(pw, () => this.closeDialogue()));

    // Dialogue text
    panel.add(bodyText);

    // Action buttons
    data.actions.forEach((action, i) => {
      const by = btnStartY + i * (btnH + btnGap) + btnH / 2;
      panel.add(this.makeButton(pw / 2, by, pw - px(64), btnH, action.label, () => {
        action.callback();
        this.closeDialogue();
      }, { variant: i === 0 ? 'primary' : 'secondary', fontSize: 14 }));
    });

    // Close hint
    panel.add(this.add.text(pw / 2, ph - px(18), t('ui.dialogue.closeHint'), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5));
  }

  private closeDialogue(): void {
    EventBus.emit(GameEvents.DIALOGUE_CLOSE);
    if (this.dialogueBackdrop) { this.dialogueBackdrop.destroy(); this.dialogueBackdrop = null; }
    if (this.dialoguePanel) { this.dialoguePanel.destroy(); this.dialoguePanel = null; }
  }

  // --- Compact Quest Card ---

  private closeQuestCard(): void {
    if (this.questCardBackdrop) { this.questCardBackdrop.destroy(); this.questCardBackdrop = null; }
    if (this.questCardPanel) { this.questCardPanel.destroy(); this.questCardPanel = null; }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private openQuestCard(entries: NpcQuestEntry[], npcName: string, hasDialogueTree: boolean, rawData: any): void {
    this.closeDialogue();
    this.closeQuestCard();
    this.closeAllPanels();
    audioManager.playSFX('click');

    let currentIndex = 0;
    const total = entries.length;

    const renderCard = () => {
      // Clean previous card (but keep backdrop)
      if (this.questCardPanel) { this.questCardPanel.destroy(); this.questCardPanel = null; }

      const cardData = buildQuestCardData(entries[currentIndex], hasDialogueTree);
      const pw = px(420), headerH = px(40);

      // Backdrop (only create once)
      if (!this.questCardBackdrop) {
        this.questCardBackdrop = this.createBackdrop(0.7);
        this.questCardBackdrop.on('pointerdown', () => this.closeQuestCard());
      }

      this.questCardPanel = this.add.container(0, 0).setDepth(PANEL_STYLE.depth.panel);
      const card = this.questCardPanel;
      const isMain = cardData.category === 'main';

      // ── Header: quest name in the band ──
      const nameT = this.add.text(pw / 2, headerH / 2 + px(1), cardData.name, {
        fontSize: fs(16), color: isMain ? UI_COLORS.goldBright : UI_COLORS.parchment, fontFamily: PANEL_STYLE.header.font, fontStyle: 'bold',
        stroke: '#120b04', strokeThickness: Math.round(3 * DPR),
      }).setOrigin(0.5);
      if (nameT.width > pw - px(90)) nameT.setScale((pw - px(90)) / nameT.width);
      card.add(nameT);
      card.add(this.createPanelCloseBtn(pw, () => this.closeQuestCard()));

      // Badges row: category (left) · NPC (centre) · type (right)
      const badgeY = headerH + px(16);
      const catBadge = btnLabel(isMain ? t('ui.questCard.mainBadge') : t('ui.questCard.sideBadge'));
      const catT = this.add.text(px(26), badgeY, catBadge, {
        fontSize: fs(11), color: isMain ? '#ffe7a0' : '#d0d0d0', fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const pill = this.add.graphics();
      pill.fillStyle(isMain ? 0x5a3f12 : 0x2e2b33, 1);
      pill.fillRoundedRect(px(18), badgeY - px(10), catT.width + px(16), px(20), px(10));
      pill.lineStyle(1, isMain ? 0xffd98a : 0x7a7280, 1);
      pill.strokeRoundedRect(px(18), badgeY - px(10), catT.width + px(16), px(20), px(10));
      card.add(pill);
      card.add(catT);
      card.add(this.add.text(pw - px(20), badgeY, cardData.typeBadge, {
        fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
      }).setOrigin(1, 0.5));
      card.add(this.add.text(pw / 2, badgeY, `─ ${npcName} ─`, {
        fontSize: fs(11), color: UI_COLORS.textSoft, fontFamily: FONT,
      }).setOrigin(0.5, 0.5));

      // ── Description (measured, so long text never overlaps the objectives) ──
      let curY = badgeY + px(16);
      const descT = this.add.text(px(20), curY, cardData.description, {
        fontSize: fs(12), color: '#c8bca8', fontFamily: FONT, lineSpacing: px(2),
        wordWrap: { width: pw - px(40), useAdvancedWrap: true },
      });
      card.add(descT);
      curY += descT.height + px(14);

      // ── Objectives ──
      card.add(addSectionHeader(this, px(20), curY, pw - px(40), btnLabel(t('ui.questCard.objectives')).replace(/[:：]\s*$/, '')));
      curY += px(14);
      const objWell = this.add.graphics();
      card.add(objWell);
      const objTop = curY;
      curY += px(6);
      for (const obj of cardData.objectives) {
        const checkMark = obj.done ? '✓' : '○';
        const objColor = obj.done ? '#8ff07a' : UI_COLORS.text;
        card.add(this.add.text(px(30), curY, `${checkMark} ${obj.label}`, {
          fontSize: fs(12), color: objColor, fontFamily: FONT,
        }));
        card.add(this.add.text(pw - px(30), curY, obj.progress, {
          fontSize: fs(12), color: obj.done ? '#8ff07a' : '#e8c77a', fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(1, 0));
        curY += px(20);
      }
      curY += px(4);
      drawWell(objWell, px(20), objTop, pw - px(40), curY - objTop, px(4));
      curY += px(12);

      // ── Rewards ──
      const rewardText = formatRewardSummary(entries[currentIndex].quest.rewards);
      const rwLabel = this.add.text(px(20), curY, t('ui.questCard.rewards'), {
        fontSize: fs(12), color: UI_COLORS.heading, fontFamily: FONT, fontStyle: 'bold',
      });
      card.add(rwLabel);
      const rwText = this.add.text(px(20) + rwLabel.width + px(8), curY, rewardText, {
        fontSize: fs(12), color: '#ffd35a', fontFamily: FONT,
        wordWrap: { width: pw - px(48) - rwLabel.width, useAdvancedWrap: true },
      });
      card.add(rwText);
      curY += Math.max(rwLabel.height, rwText.height) + px(12);

      // ── Navigation (multiple quests) ──
      if (total > 1) {
        const navY = curY + px(12);
        card.add(this.makeButton(px(60), navY, px(44), px(26), '◀', () => { currentIndex--; renderCard(); }, { disabled: currentIndex <= 0, fontSize: 12 }));
        card.add(this.add.text(pw / 2, navY, `${currentIndex + 1}/${total}`, {
          fontSize: fs(12), color: UI_COLORS.textSoft, fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0.5));
        card.add(this.makeButton(pw - px(60), navY, px(44), px(26), '▶', () => { currentIndex++; renderCard(); }, { disabled: currentIndex >= total - 1, fontSize: 12 }));
        curY += px(34);
      }

      // ── Action Button ──
      const isAccept = cardData.cardAction === 'accept';
      const btnLabelText = isAccept ? t('ui.questCard.accept') : t('ui.questCard.turnIn');
      const bW = px(180), bH = px(36);
      const actionBtn = this.makeButton(pw / 2, curY + bH / 2, bW, bH, btnLabelText, () => undefined, {
        variant: isAccept ? 'success' : 'primary', fontSize: 15, bold: true,
      });
      const actionBg = actionBtn.bg;
      card.add(actionBtn);
      curY += bH + px(10);

      actionBg.on('pointerdown', () => {
        const entry = entries[currentIndex];
        const questSystem = rawData.questSystem;

        if (entry.cardAction === 'accept') {
          questSystem.acceptQuest(entry.quest.id);
        } else {
          // Turn-in: grant rewards via ZoneScene approach
          const reward = questSystem.turnInQuest(entry.quest.id);
          if (reward) {
            const player = rawData.player;
            if (player) {
              player.addExp(reward.exp);
              player.gold += reward.gold;
            }
            // Grant item rewards
            if (reward.items && reward.items.length > 0 && this.zone) {
              for (const itemId of reward.items) {
                const item = this.zone.lootSystem.createItem(itemId, player?.level ?? 1, 'normal');
                if (item) {
                  item.identified = true;
                  this.zone.inventorySystem.addItem(item);
                }
              }
            }
            if (reward.petReward && rawData.homesteadSystem) {
              rawData.homesteadSystem.addPet(reward.petReward);
            }
            if (rawData.achievementSystem) {
              rawData.achievementSystem.update('quest');
            }
          }
        }

        // Toast confirmation
        const toastMsg = buildToastMessage(entry.cardAction, entry.quest.name);
        this.showQuestToast(toastMsg, entry.cardAction);

        // Auto-dismiss
        this.closeQuestCard();
      });

      // ── View Lore Button (optional) ──
      if (hasDialogueTree) {
        card.add(this.makeButton(pw / 2, curY + px(13), px(140), px(26), t('ui.questCard.viewStory'), () => {
          this.closeQuestCard();
          this.openDialogueTree(rawData);
        }, { variant: 'ghost', fontSize: 11 }));
        curY += px(32);
      }

      const ph = curY + px(12);
      card.addAt(this.createPanelBg(pw, ph, headerH), 0);
      card.setPosition((W - pw) / 2, Math.max(px(10), (H - ph) / 2));
      this.animatePanelOpen(card);
    };

    renderCard();
  }

  /** Show a brief quest toast at the top of the screen. */
  private showQuestToast(message: string, action: 'accept' | 'turn_in'): void {
    const toastW = px(320), toastH = px(42);
    const toastX = (W - toastW) / 2, toastY = px(60);
    const toast = this.add.container(toastX, toastY).setDepth(PANEL_STYLE.depth.toast).setAlpha(0);

    const borderColor = action === 'accept' ? 0x6fd35a : 0xffd98a;
    const textColor = action === 'accept' ? '#a8f090' : '#ffe7a0';
    const icon = action === 'accept' ? '✦' : '✓';

    toast.add(addFrame(this, 0, 0, toastW, toastH, { variant: 'tooltip', accent: borderColor }));

    toast.add(this.add.text(px(18), toastH / 2, icon, {
      fontSize: fs(17), color: textColor, fontFamily: FONT,
      stroke: '#000000', strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0, 0.5));

    const msgT = this.add.text(px(40), toastH / 2, message, {
      fontSize: fs(13), color: textColor, fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0, 0.5);
    if (msgT.width > toastW - px(54)) msgT.setScale((toastW - px(54)) / msgT.width, 1);
    toast.add(msgT);

    // Animate in
    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: toastY + px(10),
      duration: 400,
      ease: 'Back.easeOut',
    });

    // Auto-dismiss after 2s
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        y: toastY - px(20),
        duration: 300,
        ease: 'Power2',
        onComplete: () => toast.destroy(),
      });
    });
  }

  // --- Branching Dialogue Tree Panel ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private openDialogueTree(data: any): void {
    const tree: DialogueTree = data.dialogueTree;
    const npcId: string = data.npcId;
    const npcName: string = data.npcName;
    const completedQuests: string[] = data.completedQuests ?? [];
    const questSystem = data.questSystem;
    const player = data.player;
    const homesteadSystem = data.homesteadSystem;
    const achievementSystem = data.achievementSystem;
    const turnedIn: string[] = data.turnedIn ?? [];

    // Initialize dialogue state for this NPC if not exists
    if (!this.dialogueTreeState[npcId]) {
      this.dialogueTreeState[npcId] = { visitedNodes: [], choicesMade: {} };
    }
    const state = this.dialogueTreeState[npcId];

    // Show turn-in text first if any quests were turned in
    if (turnedIn.length > 0) {
      this.renderDialogueTreeNode(tree, tree.nodes[tree.startNodeId], npcId, npcName, completedQuests, questSystem, player, homesteadSystem, achievementSystem, state, t('ui.dialogue.turnInPrefix'));
    } else {
      this.renderDialogueTreeNode(tree, tree.nodes[tree.startNodeId], npcId, npcName, completedQuests, questSystem, player, homesteadSystem, achievementSystem, state);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderDialogueTreeNode(
    tree: DialogueTree,
    node: DialogueNode,
    npcId: string,
    npcName: string,
    completedQuests: string[],
    questSystem: any,
    player: any,
    homesteadSystem: any,
    achievementSystem: any,
    state: { visitedNodes: string[]; choicesMade: Record<string, string> },
    prefixText?: string,
  ): void {
    this.closeDialogue();
    this.closeAllPanels();
    audioManager.playSFX('click');
    this.dialogueScrollY = 0;

    // Mark node as visited
    if (!state.visitedNodes.includes(node.id)) {
      state.visitedNodes.push(node.id);
    }

    // Full-screen transparent backdrop
    this.dialogueBackdrop = this.createBackdrop(0.7);

    const pw = px(480), maxPh = px(520);
    const headerH = px(60);
    const footerH = px(26);

    // Determine display text
    const displayText = prefixText ? `${prefixText}\n\n${node.text}` : node.text;

    // Filter choices by prerequisites
    const visibleChoices: DialogueChoice[] = [];
    if (node.choices && node.choices.length > 0) {
      for (const choice of node.choices) {
        if (choice.prereqQuests && choice.prereqQuests.length > 0) {
          const meetsPrereqs = choice.prereqQuests.every(qid => completedQuests.includes(qid));
          if (!meetsPrereqs) continue;
        }
        // Hide choices only when quest is already handled AND the target is a dead-end
        if (choice.questTrigger && questSystem) {
          const prog = questSystem.progress.get(choice.questTrigger);
          if (prog && (prog.status === 'active' || prog.status === 'turned_in')) {
            const targetNode = tree.nodes[choice.nextNodeId];
            if (targetNode && targetNode.isEnd) continue;
          }
        }
        visibleChoices.push(choice);
      }
    }

    // Measure text height
    const textMeasure = this.add.text(0, 0, displayText, {
      fontSize: fs(13), color: '#e0d8cc', fontFamily: FONT,
      wordWrap: { width: pw - px(36), useAdvancedWrap: true },
      lineSpacing: px(3),
    });
    const textHeight = textMeasure.height;
    textMeasure.destroy();

    // Calculate button area height
    const btnH = px(32);
    const btnGap = px(7);
    const choicesToShow = visibleChoices.length > 0 ? visibleChoices : [];
    // When all choices were filtered out on a non-root branching node, offer a "go back" button
    const allChoicesFiltered = node.choices && node.choices.length > 0 && choicesToShow.length === 0 && !node.isEnd;
    const showBackToRoot = allChoicesFiltered && node.id !== tree.startNodeId;
    const hasEndBtn = node.isEnd || (choicesToShow.length === 0 && !node.nextNodeId && !showBackToRoot);
    const numBtns = choicesToShow.length + (hasEndBtn ? 1 : 0) + (showBackToRoot ? 1 : 0) + (node.nextNodeId && !node.isEnd && choicesToShow.length === 0 && !showBackToRoot ? 1 : 0);
    const btnAreaH = numBtns * (btnH + btnGap) + px(10);

    // Calculate panel height
    const contentH = textHeight + px(20);
    const maxScrollArea = maxPh - headerH - btnAreaH - footerH;
    const needsScroll = contentH > maxScrollArea;
    const scrollAreaH = needsScroll ? maxScrollArea : contentH;
    const ph = headerH + scrollAreaH + btnAreaH + footerH;
    const panelX = (W - pw) / 2, panelY = Math.max(px(20), (H - ph) / 2);

    this.dialoguePanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    this.animatePanelOpen(this.dialoguePanel);

    // Background
    this.dialoguePanel.add(this.createPanelBg(pw, ph));

    // NPC name
    this.dialoguePanel.add(this.createPanelTitle(pw, npcName));
    this.dialoguePanel.add(this.createPanelCloseBtn(pw, () => this.closeDialogue()));

    // NPC type subtitle
    this.dialoguePanel.add(this.add.text(pw / 2, px(47), t('ui.dialogue.subtitle'), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT, fontStyle: 'italic',
    }).setOrigin(0.5, 0.5));

    // Scrollable text area with mask
    const textAreaY = headerH + px(4);
    const textAreaH = scrollAreaH;

    // Create a mask for scrolling text
    const maskGraphics = this.make.graphics({});
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(panelX + px(14), panelY + textAreaY, pw - px(28), textAreaH);
    const textMask = maskGraphics.createGeometryMask();

    const textContainer = this.add.container(px(18), textAreaY + px(4));
    textContainer.setMask(textMask);
    this.dialoguePanel.add(textContainer);

    const npcText = this.add.text(0, -this.dialogueScrollY, displayText, {
      fontSize: fs(13), color: UI_COLORS.text, fontFamily: FONT,
      wordWrap: { width: pw - px(36), useAdvancedWrap: true },
      lineSpacing: px(3),
    });
    textContainer.add(npcText);

    // Scroll indicators
    if (needsScroll) {
      const scrollHint = this.add.text(pw - px(24), textAreaY + textAreaH - px(14), '▼', {
        fontSize: fs(12), color: '#e8c77a', fontFamily: FONT,
      }).setOrigin(0.5);
      this.dialoguePanel.add(scrollHint);
      this.tweens.add({
        targets: scrollHint, alpha: 0.3, duration: 600,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      // Mouse wheel scrolling
      const maxScroll = Math.max(0, contentH - textAreaH + px(8));
      const scrollHandler = (_pointer: Phaser.Input.Pointer, _gx: unknown[], _gy: unknown, _gz: unknown, event: WheelEvent) => {
        this.dialogueScrollY = Math.max(0, Math.min(maxScroll, this.dialogueScrollY + (event.deltaY > 0 ? px(30) : -px(30))));
        npcText.y = -this.dialogueScrollY;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.input.on('wheel', scrollHandler as any);
      // Cleanup on panel destroy
      const originalDestroy = this.dialoguePanel.destroy.bind(this.dialoguePanel);
      this.dialoguePanel.destroy = (...args: Parameters<typeof originalDestroy>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.input.off('wheel', scrollHandler as any);
        maskGraphics.destroy();
        return originalDestroy(...args);
      };
    } else {
      // No scrolling needed: drop the mask before destroying its geometry
      // (destroying a live mask's geometry used to hide the NPC text entirely).
      textContainer.clearMask(true);
      maskGraphics.destroy();
    }

    // Choice buttons area
    const btnStartY = textAreaY + textAreaH + px(6);
    let btnIdx = 0;

    // Render visible choices
    for (const choice of choicesToShow) {
      const by = btnStartY + btnIdx * (btnH + btnGap);

      // Dim choices whose quest is already active (navigation-only)
      let questAlreadyActive = false;
      if (choice.questTrigger && questSystem) {
        const prog = questSystem.progress.get(choice.questTrigger);
        if (prog && (prog.status === 'active' || prog.status === 'turned_in')) questAlreadyActive = true;
      }
      const labelText = questAlreadyActive ? `${choice.text}${t('ui.dialogue.inProgress')}` : choice.text;

      const choiceBtn = this.makeButton(pw / 2, by + btnH / 2, pw - px(48), btnH, labelText, () => undefined, {
        variant: questAlreadyActive ? 'ghost' : 'success', fontSize: 13,
      });
      const btnBg = choiceBtn.bg;
      const btnText = choiceBtn.label;

      // Wrap / shrink long choice text so it stays inside the button
      if (btnText.width > pw - px(72)) {
        btnText.setStyle({ wordWrap: { width: pw - px(72), useAdvancedWrap: true } });
        if (btnText.height > btnH - px(4)) btnText.setScale((btnH - px(4)) / btnText.height);
      }

      btnBg.on('pointerdown', () => {
        // Record choice
        state.choicesMade[node.id] = choice.nextNodeId;

        // Apply quest trigger
        if (choice.questTrigger && questSystem) {
          const prog = questSystem.progress.get(choice.questTrigger);
          if (!prog || (prog.status === 'failed')) {
            questSystem.acceptQuest(choice.questTrigger);
          }
        }

        // Apply reward
        if (choice.reward) {
          if (choice.reward.gold && player) {
            player.gold += choice.reward.gold;
            EventBus.emit(GameEvents.LOG_MESSAGE, { text: t('ui.dialogue.gotGold', { gold: String(choice.reward.gold) }), type: 'loot' });
          }
          if (choice.reward.exp && player) {
            player.addExp(choice.reward.exp);
            EventBus.emit(GameEvents.LOG_MESSAGE, { text: t('ui.dialogue.gotExp', { exp: String(choice.reward.exp) }), type: 'loot' });
          }
          if (choice.reward.items && this.zone) {
            for (const itemId of choice.reward.items) {
              const item = this.zone.lootSystem.createItem(itemId, player?.level ?? 1, 'normal');
              if (item) {
                item.identified = true;
                this.zone.inventorySystem.addItem(item);
                EventBus.emit(GameEvents.LOG_MESSAGE, { text: t('ui.dialogue.gotItem', { name: item.name }), type: 'loot' });
              }
            }
          }
        }

        // Navigate to next node
        const nextNode = tree.nodes[choice.nextNodeId];
        if (nextNode) {
          this.renderDialogueTreeNode(tree, nextNode, npcId, npcName, completedQuests, questSystem, player, homesteadSystem, achievementSystem, state);
        } else {
          this.closeDialogue();
        }
      });

      this.dialoguePanel!.add(choiceBtn);
      btnIdx++;
    }

    // Auto-continue button (for nodes with nextNodeId but no choices)
    if (node.nextNodeId && !node.isEnd && choicesToShow.length === 0 && !showBackToRoot) {
      const by = btnStartY + btnIdx * (btnH + btnGap);
      const continueBtn = this.makeButton(pw / 2, by + btnH / 2, pw - px(48), btnH, t('ui.dialogue.continue'), () => undefined, { variant: 'secondary', fontSize: 13, color: '#9fd4ff' });
      const continueBg = continueBtn.bg;
      continueBg.on('pointerdown', () => {
        const nextNode = tree.nodes[node.nextNodeId!];
        if (nextNode) {
          this.renderDialogueTreeNode(tree, nextNode, npcId, npcName, completedQuests, questSystem, player, homesteadSystem, achievementSystem, state);
        } else {
          this.closeDialogue();
        }
      });
      this.dialoguePanel!.add(continueBtn);
      btnIdx++;
    }

    // Back-to-root button when all choices filtered on a non-root node
    if (showBackToRoot) {
      const by = btnStartY + btnIdx * (btnH + btnGap);
      const backBtn = this.makeButton(pw / 2, by + btnH / 2, pw - px(48), btnH, t('ui.dialogue.back'), () => undefined, { variant: 'primary', fontSize: 13 });
      const backBg = backBtn.bg;
      backBg.on('pointerdown', () => {
        const rootNode = tree.nodes[tree.startNodeId];
        this.renderDialogueTreeNode(tree, rootNode, npcId, npcName, completedQuests, questSystem, player, homesteadSystem, achievementSystem, state);
      });
      this.dialoguePanel!.add(backBtn);
      btnIdx++;
    }

    // End/leave button
    if (hasEndBtn) {
      const by = btnStartY + btnIdx * (btnH + btnGap);
      const leaveBtn = this.makeButton(pw / 2, by + btnH / 2, pw - px(48), btnH, t('ui.dialogue.leave'), () => this.closeDialogue(), { variant: 'ghost', fontSize: 13 });
      this.dialoguePanel!.add(leaveBtn);
    }

    // Footer hint
    this.dialoguePanel.add(this.add.text(pw / 2, ph - px(16), needsScroll ? t('ui.dialogue.scrollHint') : '', {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5));

    // Backdrop click closes dialogue
    this.dialogueBackdrop!.on('pointerdown', () => this.closeDialogue());
  }

  /** Get dialogue tree state for saving. */
  getDialogueState(): Record<string, { visitedNodes: string[]; choicesMade: Record<string, string> }> {
    return this.dialogueTreeState;
  }

  /** Restore dialogue tree state from save data. */
  setDialogueState(state: Record<string, { visitedNodes: string[]; choicesMade: Record<string, string> }>): void {
    this.dialogueTreeState = state ?? {};
  }

  // --- Quest Log Panel ---
  private toggleQuestLog(): void {
    if (this.questLogPanel) {
      this.questLogPanel.destroy();
      this.questLogPanel = null;
      return;
    }
    this.closeAllPanels();
    this.createQuestLogPanel();
  }

  private createQuestLogPanel(): void {
    const pw = px(720), ph = px(520);
    const panelX = (W - pw) / 2, panelY = px(24);
    this.questLogPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    this.animatePanelOpen(this.questLogPanel);

    // Background
    this.questLogPanel.add(this.createPanelBg(pw, ph));

    // Title
    this.questLogPanel.add(this.createPanelTitle(pw, t('ui.questLog.title')));

    // Close button
    this.questLogPanel.add(this.createPanelCloseBtn(pw, () => this.toggleQuestLog()));

    // Tab buttons
    const tabY = px(46), tabW = px(140), tabH = px(28);
    const tabs: { label: string; active: boolean; accent: number; onClick: () => void }[] = [
      { label: t('ui.questLog.tab.active'), active: this.questLogTab === 'active' && !this.questLogLoreTab, accent: 0x5a9fe0, onClick: () => { this.questLogTab = 'active'; this.questLogLoreTab = false; this.questLogPage = 0; this.questLogSelectedIndex = 0; this.refreshQuestLog(); } },
      { label: t('ui.questLog.tab.completed'), active: this.questLogTab === 'completed' && !this.questLogLoreTab, accent: 0x6fd35a, onClick: () => { this.questLogTab = 'completed'; this.questLogLoreTab = false; this.questLogPage = 0; this.questLogSelectedIndex = 0; this.refreshQuestLog(); } },
      { label: t('ui.questLog.tab.lore'), active: this.questLogLoreTab, accent: 0xd4a54a, onClick: () => { this.questLogLoreTab = true; this.refreshQuestLog(); } },
    ];
    tabs.forEach((tab, i) => {
      const tx = px(18) + i * (tabW + px(6));
      const img = this.add.image(tx, tabY, tabTexture(this, tabW, tabH, tab.active, tab.accent)).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      img.on('pointerdown', tab.onClick);
      this.questLogPanel!.add(img);
      this.questLogPanel!.add(this.add.text(tx + tabW / 2, tabY + tabH / 2, tab.label, {
        fontSize: fs(13), color: tab.active ? UI_COLORS.parchment : '#8a8290', fontFamily: FONT, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: Math.round(2 * DPR),
      }).setOrigin(0.5));
    });
    // rule under the tabs
    const rule = this.add.graphics();
    rule.fillStyle(0x4a4250, 1);
    rule.fillRect(px(14), tabY + tabH, pw - px(28), 1);
    this.questLogPanel.add(rule);

    // Render content based on active tab
    if (this.questLogLoreTab) {
      this.renderLoreLogContent();
    } else {
      this.renderQuestLogContent();
    }
  }

  private refreshQuestLog(): void {
    if (!this.questLogPanel) return;
    this.questLogPanel.destroy();
    this.questLogPanel = null;
    this.createQuestLogPanel();
  }

  private renderQuestLogContent(): void {
    if (!this.questLogPanel || !this.zone?.questSystem) return;

    const listX = px(16), listW = px(250), detailX = px(282), detailW = px(420);
    const listStartY = px(86), itemH = px(28), maxItems = 13;

    // Get quest list
    let quests: { quest: import('../data/types').QuestDefinition; progress: import('../data/types').QuestProgress }[];
    if (this.questLogTab === 'active') {
      quests = this.zone.questSystem.getActiveQuests();
    } else {
      quests = [];
      for (const [id, prog] of this.zone.questSystem.progress.entries()) {
        if (prog.status === 'turned_in') {
          const q = this.zone.questSystem.quests.get(id);
          if (q) quests.push({ quest: q, progress: prog });
        }
      }
    }

    // Sort: main first
    quests.sort((a, b) => {
      if (a.quest.category === 'main' && b.quest.category !== 'main') return -1;
      if (a.quest.category !== 'main' && b.quest.category === 'main') return 1;
      return a.quest.level - b.quest.level;
    });

    const totalPages = Math.max(1, Math.ceil(quests.length / maxItems));
    const pageQuests = quests.slice(this.questLogPage * maxItems, (this.questLogPage + 1) * maxItems);

    // Divider line
    this.questLogPanel.add(addVDivider(this, listX + listW + px(8), listStartY, px(420)));

    // Quest list
    pageQuests.forEach((entry, i) => {
      const y = listStartY + i * itemH;
      const isSelected = i === this.questLogSelectedIndex;
      const rowG = this.add.graphics();
      drawCard(rowG, listX, y, listW, itemH - px(3), isSelected
        ? { fill: 0x2a2230, border: 0xd4a54a, strip: entry.quest.category === 'main' ? 0xffd98a : 0x9aa5a6 }
        : { fill: 0x16131a, border: 0x2e2a32, strip: entry.quest.category === 'main' ? 0x8a6a2a : 0x4a5050 });
      this.questLogPanel!.add(rowG);
      const listBg = this.add.rectangle(listX, y, listW, itemH - px(3), 0x000000, 0).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      listBg.on('pointerdown', () => { this.questLogSelectedIndex = i; this.refreshQuestLog(); });
      this.questLogPanel!.add(listBg);

      const tagColor = entry.quest.category === 'main' ? '#e8c77a' : '#a8b4b5';
      const tag = entry.quest.category === 'main' ? t('ui.questLog.mainTag') : t('ui.questLog.sideTag');
      const tagT = this.add.text(listX + px(10), y + (itemH - px(3)) / 2, tag, {
        fontSize: fs(11), color: tagColor, fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.questLogPanel!.add(tagT);

      // Quest type label for new types
      const questTypeColors: Record<string, string> = {
        escort: '#e67e22', defend: '#e74c3c', investigate: '#9b59b6', craft: '#1abc9c',
      };
      const typeLabel = QUEST_TYPE_LABELS[entry.quest.type] ?? '';
      const hasTypeTag = ['escort', 'defend', 'investigate', 'craft'].includes(entry.quest.type);
      const typeSuffix = hasTypeTag ? ` [${typeLabel}]` : '';

      const nameColor = this.questLogTab === 'completed' ? '#7a7268' : (isSelected ? '#fff4e0' : UI_COLORS.textSoft);
      const nameX = tagT.x + tagT.width + px(6);
      const nameT = this.add.text(nameX, y + (itemH - px(3)) / 2, `${entry.quest.name} Lv.${entry.quest.level}`, {
        fontSize: fs(12), color: nameColor, fontFamily: FONT,
      }).setOrigin(0, 0.5);
      this.questLogPanel!.add(nameT);

      if (hasTypeTag) {
        const typeColor = questTypeColors[entry.quest.type] ?? '#aaa';
        const typeT = this.add.text(listX + listW - px(6), y + (itemH - px(3)) / 2, `[${typeLabel}]`, {
          fontSize: fs(10), color: typeColor, fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(1, 0.5);
        this.questLogPanel!.add(typeT);
        const maxNameW = typeT.x - typeT.width - px(4) - nameX;
        if (nameT.width > maxNameW) nameT.setScale(Math.max(0.6, maxNameW / nameT.width), 1);
      } else if (nameT.width > listX + listW - px(8) - nameX) {
        nameT.setScale(Math.max(0.6, (listX + listW - px(8) - nameX) / nameT.width), 1);
      }
    });

    // Pagination
    if (totalPages > 1) {
      const pageY = listStartY + maxItems * itemH + px(16);
      const pgCx = listX + listW / 2;
      this.questLogPanel.add(this.makeButton(pgCx - px(70), pageY, px(64), px(24), t('ui.questLog.prevPage'), () => { this.questLogPage--; this.questLogSelectedIndex = 0; this.refreshQuestLog(); }, { disabled: this.questLogPage <= 0, fontSize: 11 }));
      this.questLogPanel.add(this.add.text(pgCx, pageY, `${this.questLogPage + 1}/${totalPages}`, {
        fontSize: fs(12), color: UI_COLORS.textSoft, fontFamily: FONT,
      }).setOrigin(0.5));
      this.questLogPanel.add(this.makeButton(pgCx + px(70), pageY, px(64), px(24), t('ui.questLog.nextPage'), () => { this.questLogPage++; this.questLogSelectedIndex = 0; this.refreshQuestLog(); }, { disabled: this.questLogPage >= totalPages - 1, fontSize: 11 }));
    }

    // No quests message
    if (pageQuests.length === 0) {
      this.questLogPanel.add(this.add.text(listX + listW / 2, px(140), this.questLogTab === 'active' ? t('ui.questLog.noActive') : t('ui.questLog.noCompleted'), {
        fontSize: fs(14), color: UI_COLORS.dim, fontFamily: FONT, align: 'center',
        wordWrap: { width: listW - px(20), useAdvancedWrap: true },
      }).setOrigin(0.5, 0));
      return;
    }

    // Quest detail (right side)
    const selected = pageQuests[this.questLogSelectedIndex] ?? pageQuests[0];
    if (!selected) return;

    let dy = listStartY;

    // Quest name
    const qTitle = this.add.text(detailX + detailW / 2, dy, selected.quest.name, {
      fontSize: fs(17), color: UI_COLORS.parchment, fontFamily: TITLE_FONT, fontStyle: 'bold',
      stroke: '#120b04', strokeThickness: Math.round(3 * DPR),
    }).setOrigin(0.5, 0);
    if (qTitle.width > detailW - px(10)) qTitle.setScale((detailW - px(10)) / qTitle.width);
    this.questLogPanel.add(qTitle);
    dy += px(26);
    this.questLogPanel.add(addDivider(this, detailX + detailW / 2, dy, detailW - px(40)));
    dy += px(10);

    // Category + Level + Zone
    const catText = selected.quest.category === 'main' ? t('ui.questLog.mainQuest') : t('ui.questLog.sideQuest');
    const catColor = selected.quest.category === 'main' ? '#c0934a' : '#95a5a6';
    const questTypeLabel = QUEST_TYPE_LABELS[selected.quest.type] ?? '';
    const typeDisplay = ['escort', 'defend', 'investigate', 'craft'].includes(selected.quest.type)
      ? `  |  ${t('ui.questLog.typeLabel', { type: questTypeLabel })}` : '';
    this.questLogPanel.add(this.add.text(detailX + px(5), dy, `${catText}  |  Lv.${selected.quest.level}  |  ${getZoneName(selected.quest.zone)}${typeDisplay}`, {
      fontSize: fs(12), color: catColor, fontFamily: FONT,
    }));
    dy += px(20);

    // Description (measured so long descriptions push the rest down instead of overlapping)
    const qDesc = this.add.text(detailX + px(5), dy, getQuestDesc(selected.quest.id, selected.quest.description), {
      fontSize: fs(13), color: '#c8bca8', fontFamily: FONT, lineSpacing: px(2), wordWrap: { width: detailW - px(20), useAdvancedWrap: true },
    });
    this.questLogPanel.add(qDesc);
    dy += Math.max(px(40), qDesc.height + px(10));

    // Type-specific summary for investigate, defend, craft
    if (selected.quest.type === 'investigate') {
      const totalClues = selected.quest.objectives.filter(o => o.type === 'investigate_clue').length;
      const foundClues = selected.quest.objectives
        .map((o, i) => o.type === 'investigate_clue' && (selected.progress.objectives[i]?.current ?? 0) >= o.required ? 1 : 0)
        .reduce((a: number, b: number) => a + b, 0);
      this.questLogPanel.add(this.add.text(detailX + px(5), dy, t('ui.questLog.clueProgress', { found: String(foundClues), total: String(totalClues) }), {
        fontSize: fs(13), color: '#9b59b6', fontFamily: FONT, fontStyle: 'bold',
      }));
      dy += px(18);
    } else if (selected.quest.type === 'defend' && selected.quest.defendTarget) {
      const waveObj = selected.quest.objectives.find(o => o.type === 'defend_wave');
      const waveIdx = waveObj ? selected.quest.objectives.indexOf(waveObj) : -1;
      const curWave = waveIdx >= 0 ? (selected.progress.objectives[waveIdx]?.current ?? 0) : 0;
      this.questLogPanel.add(this.add.text(detailX + px(5), dy, t('ui.questLog.waveProgress', { current: String(curWave), total: String(selected.quest.defendTarget.totalWaves) }), {
        fontSize: fs(13), color: '#e74c3c', fontFamily: FONT, fontStyle: 'bold',
      }));
      dy += px(18);
    } else if (selected.quest.type === 'craft') {
      // Show current craft phase
      const qs = this.zone?.questSystem;
      if (qs) {
        const phaseLabel = qs.getCraftPhaseLabel(selected.quest, selected.progress);
        this.questLogPanel.add(this.add.text(detailX + px(5), dy, t('ui.questLog.craftPhase', { phase: phaseLabel }), {
          fontSize: fs(13), color: '#1abc9c', fontFamily: FONT, fontStyle: 'bold',
        }));
        dy += px(18);
      }
    }

    // Objectives header
    this.questLogPanel.add(addSectionHeader(this, detailX + px(5), dy + px(7), detailW - px(10), btnLabel(t('ui.questLog.objectives')).replace(/[:：]\s*$/, '')));
    dy += px(20);

    // Objectives with progress
    for (let i = 0; i < selected.quest.objectives.length; i++) {
      const obj = selected.quest.objectives[i];
      const cur = selected.progress.objectives[i]?.current ?? 0;
      const done = cur >= obj.required;
      const statusText = done ? '\u2713' : `${cur}/${obj.required}`;
      const objColor = done ? '#27ae60' : '#e0d8cc';

      this.questLogPanel.add(this.add.text(detailX + px(15), dy, `\u2022 ${obj.targetName}  ${statusText}`, {
        fontSize: fs(12), color: objColor, fontFamily: FONT,
      }));

      // Progress bar
      const barX = detailX + px(15), barY = dy + px(16), barW = detailW - px(40), barH = px(6);
      const objBar = this.add.graphics();
      drawWell(objBar, barX, barY, barW, barH, px(3));
      drawBarFill(objBar, barX + 1, barY + 1, Math.round(Math.min((barW - 2) * (cur / obj.required), barW - 2)), barH - 2, done ? 0x5cc04a : 0x3a7fd0);
      this.questLogPanel.add(objBar);
      dy += px(24);
    }

    dy += px(8);

    // Rewards
    this.questLogPanel.add(addSectionHeader(this, detailX + px(5), dy + px(7), detailW - px(10), btnLabel(t('ui.questLog.rewards')).replace(/[:：]\s*$/, '')));
    dy += px(20);

    const rewardParts: string[] = [];
    rewardParts.push(t('ui.questLog.rewardExp', { exp: String(selected.quest.rewards.exp) }));
    rewardParts.push(t('ui.questLog.rewardGold', { gold: String(selected.quest.rewards.gold) }));
    if (selected.quest.rewards.items) {
      rewardParts.push(t('ui.questLog.rewardItems', { count: String(selected.quest.rewards.items.length) }));
    }
    this.questLogPanel.add(this.add.text(detailX + px(15), dy, rewardParts.join('  |  '), {
      fontSize: fs(12), color: '#ffd35a', fontFamily: FONT, fontStyle: 'bold',
      wordWrap: { width: detailW - px(30), useAdvancedWrap: true },
    }));
    dy += px(20);

    // Prereqs
    if (selected.quest.prereqQuests && selected.quest.prereqQuests.length > 0) {
      dy += px(4);
      const prereqNames = selected.quest.prereqQuests.map(pid => {
        const pq = this.zone!.questSystem.quests.get(pid);
        return pq ? pq.name : pid;
      });
      this.questLogPanel.add(this.add.text(detailX + px(5), dy, t('ui.questLog.prereqs', { names: prereqNames.join(', ') }), {
        fontSize: fs(12), color: '#666', fontFamily: FONT,
      }));
    }
  }

  // --- Item Tooltip ---
  private showItemTooltip(item: ItemInstance, screenX: number, screenY: number): void {
    this.hideItemTooltip();
    const base = getItemBase(item.baseId);
    const tipW = px(256);
    const pad = px(PANEL_STYLE.tooltip.padding) + px(2);
    const qColor = QUALITY_TEXT[item.quality as keyof typeof QUALITY_TEXT] ?? QUALITY_TEXT.normal;
    type Line = { text: string; color: string; size: number; bold?: boolean } | { divider: true };
    const lines: Line[] = [];
    if (base) {
      let typeLine = t(`ui.tooltip.type.${base.type}`);
      if (typeLine === `ui.tooltip.type.${base.type}`) typeLine = base.type;
      if (base.slot) {
        const slotLabel = t(`ui.tooltip.slot.${base.slot}`);
        typeLine += ` (${slotLabel !== `ui.tooltip.slot.${base.slot}` ? slotLabel : base.slot})`;
      }
      lines.push({ text: typeLine, color: '#a89c8a', size: 11 });
      if ('baseDamage' in base) {
        const wb = base as WeaponBase;
        lines.push({ text: t('ui.tooltip.damage', { min: String(wb.baseDamage[0]), max: String(wb.baseDamage[1]) }), color: '#f4ecdc', size: 13, bold: true });
      }
      if ('baseDefense' in base) {
        const ab = base as ArmorBase;
        lines.push({ text: t('ui.tooltip.defense', { value: String(ab.baseDefense) }), color: '#f4ecdc', size: 13, bold: true });
      }
      // Base item description
      if (base.description) {
        lines.push({ text: getItemBaseDesc(item.baseId), color: '#8f8676', size: 11 });
      }
    }
    const statLines: Line[] = [];
    if (!item.identified && item.quality !== 'normal') {
      statLines.push({ text: t('ui.tooltip.unidentified'), color: '#ff6b5a', size: 12 });
    } else {
      for (const affix of item.affixes) {
        const label = getStatLabel(affix.stat);
        const suffix = isStatPercent(affix.stat) ? '%' : '';
        statLines.push({ text: `+${affix.value}${suffix} ${label}`, color: '#7fb0ff', size: 12 });
      }
    }
    if (item.legendaryEffect) {
      statLines.push({ text: item.legendaryEffect, color: QUALITY_TEXT.legendary, size: 12 });
    }
    // Gem socketing effect (when hovering a gem item)
    if (base?.type === 'gem') {
      const gemInfo = GEM_STAT_MAP[item.baseId];
      if (gemInfo) {
        const label = getStatLabel(gemInfo.stat);
        const suffix = isStatPercent(gemInfo.stat) ? '%' : '';
        statLines.push({ text: t('ui.tooltip.gemEffect', { value: String(gemInfo.value), suffix, label }), color: '#8be9fd', size: 12 });
      }
    }
    // Socketed gems
    if (item.sockets && item.sockets.length > 0) {
      statLines.push({ text: t('ui.tooltip.gemHeader'), color: '#8be9fd', size: 11 });
      for (const gem of item.sockets) {
        const label = getStatLabel(gem.stat);
        const suffix = isStatPercent(gem.stat) ? '%' : '';
        statLines.push({ text: `◆ ${gem.name}: +${gem.value}${suffix} ${label}`, color: '#8be9fd', size: 11 });
      }
    }
    // Socket count (if base has sockets)
    if (base && 'sockets' in base) {
      const maxSock = (base as WeaponBase | ArmorBase).sockets;
      if (maxSock > 0) {
        const filled = item.sockets?.length ?? 0;
        statLines.push({ text: t('ui.tooltip.socketCount', { filled: String(filled), max: String(maxSock) }), color: '#8a8290', size: 11 });
      }
    }
    if (statLines.length > 0) { lines.push({ divider: true }); lines.push(...statLines); }

    // ── Set bonus section ──
    if (item.setId) {
      const allSets = [...SetDefinitions, ...DUNGEON_EXCLUSIVE_SETS];
      const setDef = allSets.find(s => s.id === item.setId);
      if (setDef) {
        const equippedCount = this.zone.inventorySystem.getEquippedSetPieceCount(setDef.id);
        const totalPieces = setDef.pieces.length;
        lines.push({ divider: true });
        lines.push({ text: `${getSetName(setDef.id, setDef.name)} (${equippedCount}/${totalPieces})`, color: QUALITY_TEXT.set, size: 13, bold: true });
        for (let bi = 0; bi < setDef.bonuses.length; bi++) {
          const bonus = setDef.bonuses[bi];
          const isActive = equippedCount >= bonus.count;
          const prefix = isActive ? '✓' : '○';
          const color = isActive ? QUALITY_TEXT.set : '#5d5a52';
          lines.push({ text: `${prefix} (${bonus.count}) ${getSetBonusDesc(setDef.id, bi, bonus.description)}`, color, size: 11 });
        }
      }
    }

    const container = this.add.container(0, 0).setDepth(PANEL_STYLE.depth.tooltip);
    // Header: framed icon + name + quality/level
    const iconSize = px(40);
    const head = this.createItemSlot(pad + iconSize / 2, pad + iconSize / 2, iconSize, item, { interactive: false });
    container.add(head.objects);
    const textX = pad + iconSize + px(10);
    const nameText = this.add.text(textX, pad - px(1), getItemDisplayName(item), {
      fontSize: fs(14), color: qColor, fontFamily: PANEL_STYLE.tooltip.font, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
      wordWrap: { width: tipW - textX - pad, useAdvancedWrap: true },
    });
    container.add(nameText);
    const qualText = this.add.text(textX, nameText.y + nameText.height + px(2), `${getQualityLabel(item.quality)}  ·  Lv.${item.level}`, {
      fontSize: fs(11), color: '#9a8f80', fontFamily: PANEL_STYLE.tooltip.font,
    });
    container.add(qualText);
    let ly = Math.max(pad + iconSize, qualText.y + qualText.height) + px(8);
    container.add(addDivider(this, tipW / 2, ly, tipW - pad * 2));
    ly += px(8);
    for (const line of lines) {
      if ('divider' in line) {
        container.add(addDivider(this, tipW / 2, ly + px(3), tipW - pad * 4, false));
        ly += px(9);
        continue;
      }
      const txt = this.add.text(pad, ly, line.text, {
        fontSize: fs(line.size), color: line.color, fontFamily: PANEL_STYLE.tooltip.font,
        fontStyle: line.bold ? 'bold' : 'normal', lineSpacing: px(PANEL_STYLE.tooltip.lineSpacing),
        wordWrap: { width: tipW - pad * 2, useAdvancedWrap: true },
      });
      container.add(txt);
      ly += txt.height + px(3);
    }
    if (base) {
      ly += px(4);
      container.add(this.add.image(pad + px(7), ly + px(8), coinTexture(this, px(12))));
      container.add(this.add.text(pad + px(17), ly + px(8), t('ui.tooltip.sellPrice', { price: String(base.sellPrice) }), {
        fontSize: fs(11), color: '#ffd35a', fontFamily: PANEL_STYLE.tooltip.font,
      }).setOrigin(0, 0.5));
      ly += px(16);
    }
    const tipH = Math.ceil((ly + pad) / px(4)) * px(4);

    // Clamp to screen
    let tx = screenX + px(16);
    let ty = screenY - px(10);
    if (tx + tipW > W - px(4)) tx = screenX - tipW - px(16);
    if (ty + tipH > H - px(4)) ty = H - tipH - px(4);
    if (ty < px(4)) ty = px(4);
    if (tx < px(4)) tx = px(4);
    container.setPosition(tx, ty);
    container.addAt(addFrame(this, 0, 0, tipW, tipH, { variant: 'tooltip', accent: qualityNum(item.quality) }), 0);
    this.tooltipContainer = container;
  }

  private hideItemTooltip(): void {
    if (this.tooltipContainer) { this.tooltipContainer.destroy(); this.tooltipContainer = null; }
  }

  // --- Context Popup ---
  private showContextPopup(item: ItemInstance, screenX: number, screenY: number): void {
    this.hideContextPopup();
    const base = getItemBase(item.baseId);
    const actions: { label: string; callback: () => void }[] = [];
    if (base && base.slot) {
      actions.push({ label: t('ui.context.equip'), callback: () => {
        this.zone.inventorySystem.equip(item.uid);
        this.zone.invalidateEquipStats();
        this.hideContextPopup();
        this.refreshInventory();
      }});
    } else if (base && (base.type === 'consumable' || base.type === 'scroll')) {
      actions.push({ label: t('ui.context.use'), callback: () => {
        const result = this.zone.inventorySystem.useConsumable(item.uid);
        if (result) {
          if (result.effect === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + result.value);
          if (result.effect === 'mana') this.player.mana = Math.min(this.player.maxMana, this.player.mana + result.value);
        }
        this.hideContextPopup();
        this.refreshInventory();
      }});
    }
    const needsConfirm = item.quality === 'rare' || item.quality === 'legendary' || item.quality === 'set';
    actions.push({ label: t('ui.context.discard'), callback: () => {
      if (needsConfirm) {
        this.showDiscardConfirm(item);
      } else {
        this.zone.inventorySystem.discardItem(item.uid);
        this.hideContextPopup();
        this.refreshInventory();
      }
    }});

    const popW = px(108), btnH = px(28), padY = px(9);
    const popH = actions.length * btnH + padY * 2;
    let popX = screenX;
    let popY = screenY;
    if (popX + popW > W) popX = W - popW - px(4);
    if (popY + popH > H) popY = H - popH - px(4);

    this.contextPopup = this.add.container(popX, popY).setDepth(PANEL_STYLE.depth.contextMenu);
    this.contextPopup.add(addFrame(this, 0, 0, popW, popH, { variant: 'tooltip', accent: qualityNum(item.quality) }));
    actions.forEach((action, i) => {
      const by = padY + i * btnH + btnH / 2;
      const isDiscard = action.label === t('ui.context.discard');
      this.contextPopup!.add(this.makeButton(popW / 2, by, popW - px(16), btnH - px(4), action.label, () => action.callback(), {
        variant: isDiscard ? 'danger' : 'secondary', fontSize: 13,
      }));
    });
  }

  private hideContextPopup(): void {
    if (this.contextPopup) { this.contextPopup.destroy(); this.contextPopup = null; }
  }

  private showDiscardConfirm(item: ItemInstance): void {
    this.hideContextPopup();
    const popW = px(260);
    this.contextPopup = this.add.container(0, 0).setDepth(PANEL_STYLE.depth.confirmDialog);
    const title = this.add.text(popW / 2, px(20), t('ui.context.discardConfirmTitle'), {
      fontSize: fs(14), color: '#ff8a72', fontFamily: FONT, fontStyle: 'bold', align: 'center',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
      wordWrap: { width: popW - px(36), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    const nameT = this.add.text(popW / 2, title.y + title.height + px(6), getItemDisplayName(item), {
      fontSize: fs(12), color: qualityHex(item.quality), fontFamily: FONT, align: 'center',
      wordWrap: { width: popW - px(36), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    const popH = nameT.y + nameT.height + px(52);
    this.contextPopup.setPosition((W - popW) / 2, (H - popH) / 2);
    this.contextPopup.add(addFrame(this, 0, 0, popW, popH, { variant: 'tooltip', accent: 0xc0503c }));
    this.contextPopup.add([title, nameT]);
    this.contextPopup.add(this.makeButton(popW / 2 - px(56), popH - px(26), px(92), px(28), btnLabel(t('ui.context.confirmYes')), () => {
      this.zone.inventorySystem.discardItem(item.uid);
      this.hideContextPopup();
      this.refreshInventory();
    }, { variant: 'danger', fontSize: 13 }));
    this.contextPopup.add(this.makeButton(popW / 2 + px(56), popH - px(26), px(92), px(28), btnLabel(t('ui.context.confirmNo')), () => this.hideContextPopup(), { fontSize: 13 }));
  }

  // --- Socket Panel ---
  private openSocketPanel(equipSlot: EquipSlot): void {
    // Close existing socket panel
    if (this.socketPanel) { this.socketPanel.destroy(); this.socketPanel = null; this.socketPanelSlot = null; }

    const equipItem = this.zone.inventorySystem.equipment[equipSlot];
    if (!equipItem) return;

    const base = getItemBase(equipItem.baseId);
    if (!base) return;

    const maxSockets = this.zone.inventorySystem.getMaxSockets(equipSlot);
    if (maxSockets === 0) return;

    this.socketPanelSlot = equipSlot;
    audioManager.playSFX('click');

    const pw = px(400), ph = px(420), panelX = (W - pw) / 2, panelY = px(50);
    this.socketPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.subPanel);
    const panel = this.socketPanel;
    this.animatePanelOpen(panel);

    // Background
    panel.add(this.createPanelBg(pw, ph));

    // Title
    panel.add(this.createPanelTitle(pw, t('ui.socket.title')));

    // Close button
    panel.add(this.createPanelCloseBtn(pw, () => {
      if (this.socketPanel) { this.socketPanel.destroy(); this.socketPanel = null; this.socketPanelSlot = null; }
    }));

    // Item header: framed icon + name
    const head = this.createItemSlot(px(40), px(66), px(40), equipItem, { interactive: false });
    panel.add(head.objects);
    panel.add(this.add.text(px(68), px(58), getItemDisplayName(equipItem), {
      fontSize: fs(15), color: qualityHex(equipItem.quality), fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }).setOrigin(0, 0.5));
    panel.add(this.add.text(px(68), px(78), t('ui.socket.slotCount', { filled: String(equipItem.sockets.length), max: String(maxSockets) }), {
      fontSize: fs(12), color: UI_COLORS.textSoft, fontFamily: FONT,
    }).setOrigin(0, 0.5));

    // Socket slots display
    const sockStartY = px(96);
    const sockSize = px(52);
    const sockGap = px(26);
    const totalW = maxSockets * sockSize + (maxSockets - 1) * sockGap;
    const sockStartX = (pw - totalW) / 2;
    const sockWell = this.add.graphics();
    drawWell(sockWell, px(18), sockStartY, pw - px(36), sockSize + px(66), px(6));
    panel.add(sockWell);

    for (let i = 0; i < maxSockets; i++) {
      const sx = sockStartX + i * (sockSize + sockGap);
      const sy = sockStartY + px(10);
      const filled = i < equipItem.sockets.length;
      const gem = filled ? equipItem.sockets[i] : null;
      const cx = sx + sockSize / 2, cy = sy + sockSize / 2;

      // Round iron socket
      const sockG = this.add.graphics();
      sockG.fillStyle(0x000000, 0.6);
      sockG.fillCircle(cx, cy + 1.5, sockSize / 2);
      sockG.fillStyle(0x3a3540, 1);
      sockG.fillCircle(cx, cy, sockSize / 2);
      sockG.fillStyle(0x070609, 1);
      sockG.fillCircle(cx, cy, sockSize / 2 - px(5));
      sockG.lineStyle(1.5, gem ? 0x8be9fd : 0xd4a54a, gem ? 0.9 : 0.6);
      sockG.strokeCircle(cx, cy, sockSize / 2 - px(5));
      sockG.lineStyle(1, 0x000000, 1);
      sockG.strokeCircle(cx, cy, sockSize / 2);
      panel.add(sockG);

      if (gem) {
        const gemIcon = getItemBase(gem.gemId)?.icon ?? gem.gemId.replace(/_\d+$/, '');
        panel.add(this.add.image(cx, cy, ensureItemIcon(this, gemIcon)).setDisplaySize(sockSize - px(14), sockSize - px(14)));
        // Tier indicator
        panel.add(this.add.text(cx + sockSize / 2 - px(4), cy + sockSize / 2 - px(4), `T${gem.tier}`, {
          fontSize: fs(10), color: '#ffffff', fontFamily: FONT, fontStyle: 'bold',
          stroke: '#000000', strokeThickness: Math.round(3 * DPR),
        }).setOrigin(1, 1));

        // Gem name below slot
        const gemDisp = STAT_DISPLAY[gem.stat];
        const gemStatLabel = gemDisp ? gemDisp.label : gem.stat;
        const gemSuffix = gemDisp?.isPercent ? '%' : '';
        const gemT = this.add.text(cx, sy + sockSize + px(6), `${gem.name} (+${gem.value}${gemSuffix}${gemStatLabel})`, {
          fontSize: fs(10), color: '#8be9fd', fontFamily: FONT, align: 'center',
        }).setOrigin(0.5, 0);
        const maxW = sockSize + sockGap - px(4);
        if (gemT.width > maxW) gemT.setScale(maxW / gemT.width, 1);
        panel.add(gemT);

        // Remove button
        const socketIndex = i;
        panel.add(this.makeButton(cx, sy + sockSize + px(34), px(56), px(22), t('ui.socket.remove'), () => {
          this.zone.inventorySystem.unsocketGem(equipSlot, socketIndex);
          this.zone.invalidateEquipStats();
          this.refreshSocketPanel(equipSlot);
          this.refreshInventory();
        }, { variant: 'danger', fontSize: 11 }));
      } else {
        // Empty slot indicator
        panel.add(this.add.text(cx, cy, '◇', {
          fontSize: fs(20), color: '#5a5060', fontFamily: FONT,
        }).setOrigin(0.5));

        // Empty label below
        panel.add(this.add.text(cx, sy + sockSize + px(6), t('ui.socket.emptySlot'), {
          fontSize: fs(10), color: UI_COLORS.dim, fontFamily: FONT,
        }).setOrigin(0.5, 0));
      }
    }

    // Divider + available gems from inventory
    const divY = sockStartY + sockSize + px(80);
    panel.add(addSectionHeader(this, px(18), divY, pw - px(36), t('ui.socket.gemsInBag')));

    const gemsInInventory = this.zone.inventorySystem.inventory.filter(item => {
      const b = getItemBase(item.baseId);
      return b && b.type === 'gem';
    });

    const gemGridY = divY + px(14);
    const gemSlotSize = px(40);
    const gemGap = px(12);
    const gemCols = 7;
    const hasEmptySlots = equipItem.sockets.length < maxSockets;
    const gridW = gemCols * gemSlotSize + (gemCols - 1) * gemGap;
    const gridX = (pw - gridW) / 2;

    if (gemsInInventory.length === 0) {
      panel.add(this.add.text(pw / 2, gemGridY + px(26), t('ui.socket.noGems'), {
        fontSize: fs(13), color: UI_COLORS.dim, fontFamily: FONT,
      }).setOrigin(0.5));
    } else {
      gemsInInventory.forEach((gemItem, i) => {
        const gx = gridX + (i % gemCols) * (gemSlotSize + gemGap);
        const gy = gemGridY + Math.floor(i / gemCols) * (gemSlotSize + px(18));
        if (gy + gemSlotSize > ph - px(52)) return;
        const { slot: gemBg, objects } = this.createItemSlot(gx + gemSlotSize / 2, gy + gemSlotSize / 2, gemSlotSize, gemItem, { interactive: true });
        panel.add(objects);
        if (!hasEmptySlots) gemBg.setAlpha(0.6);

        // Stat label below gem slot
        const gInfo = GEM_STAT_MAP[gemItem.baseId];
        if (gInfo) {
          const gDisp = STAT_DISPLAY[gInfo.stat];
          const gLabel = gDisp ? gDisp.label : gInfo.stat;
          const gSuffix = gDisp?.isPercent ? '%' : '';
          const gT = this.add.text(gx + gemSlotSize / 2, gy + gemSlotSize + px(2), `+${gInfo.value}${gSuffix}${gLabel}`, {
            fontSize: fs(9), color: '#8be9fd', fontFamily: FONT,
          }).setOrigin(0.5, 0);
          if (gT.width > gemSlotSize + gemGap - px(2)) gT.setScale((gemSlotSize + gemGap - px(2)) / gT.width, 1);
          panel.add(gT);
        }

        // Tooltip on hover
        gemBg.on('pointerover', (pointer: Phaser.Input.Pointer) => {
          this.showItemTooltip(gemItem, pointer.x, pointer.y);
        });
        gemBg.on('pointerout', () => this.hideItemTooltip());

        // Click to socket
        if (hasEmptySlots) {
          gemBg.on('pointerdown', () => {
            this.hideItemTooltip();
            const success = this.zone.inventorySystem.socketGem(equipSlot, gemItem.uid);
            if (success) {
              this.zone.invalidateEquipStats();
              this.refreshSocketPanel(equipSlot);
              this.refreshInventory();
            }
          });
        }
      });
    }

    // Unequip button at bottom
    panel.add(this.makeButton(pw / 2, ph - px(28), px(140), px(30), t('ui.socket.unequip'), () => {
      if (this.socketPanel) { this.socketPanel.destroy(); this.socketPanel = null; this.socketPanelSlot = null; }
      this.zone.inventorySystem.unequip(equipSlot);
      this.zone.invalidateEquipStats();
      this.refreshInventory();
    }, { variant: 'danger', fontSize: 13 }));
  }

  /** Refresh the socket panel for the current slot. */
  private refreshSocketPanel(equipSlot: EquipSlot): void {
    if (this.socketPanel) {
      this.socketPanel.destroy();
      this.socketPanel = null;
      this.socketPanelSlot = null;
      this.openSocketPanel(equipSlot);
    }
  }

  private refreshInventory(): void {
    if (this.inventoryPanel) { this.inventoryPanel.destroy(); this.inventoryPanel = null; this.toggleInventory(); }
  }

  // --- Companion Panel (P) ---
  private toggleCompanion(): void {
    if (this.companionPanel) { this.companionPanel.destroy(); this.companionPanel = null; return; }
    this.closeAllPanels();
    audioManager.playSFX('click');
    this.buildCompanionPanel();
  }

  private buildCompanionPanel(): void {
    const pw = px(520), ph = px(540), panelX = (W - pw) / 2, panelY = px(10);
    this.companionPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    const panel = this.companionPanel;
    this.animatePanelOpen(panel);

    // Background
    panel.add(this.createPanelBg(pw, ph));

    // Title
    panel.add(this.createPanelTitle(pw, t('ui.companion.title')));

    // Close button
    panel.add(this.createPanelCloseBtn(pw, () => this.toggleCompanion()));

    const mercSys = this.zone?.mercenarySystem;
    if (!mercSys) return;

    const merc = mercSys.getMercenary();

    // Mercenary section header
    panel.add(addSectionHeader(this, px(18), px(54), pw - px(36), t('ui.companion.mercHeader')));
    const mercCard = this.add.graphics();
    drawCard(mercCard, px(18), px(66), pw - px(36), px(36), merc
      ? { border: merc.alive ? 0x4a4250 : 0xc0503c, strip: merc.alive ? 0x6fd35a : 0xc0503c }
      : { border: 0x2e2a32 });
    panel.add(mercCard);

    if (!merc) {
      // No mercenary — compact hire hint
      panel.add(this.add.text(px(30), px(84), t('ui.companion.noMerc'), {
        fontSize: fs(12), color: UI_COLORS.muted, fontFamily: FONT,
        wordWrap: { width: pw - px(60), useAdvancedWrap: true },
      }).setOrigin(0, 0.5));
    } else {
      // Has mercenary — show compact info
      const def = MERCENARY_DEFS[merc.type];
      const statusText = merc.alive
        ? t('ui.companion.mercStatus', { name: getMercenaryName(merc.type, def.name), type: getMercenaryTypeLabel(merc.type), level: String(merc.level), hp: String(Math.ceil(merc.hp)), maxHp: String(merc.maxHp) })
        : t('ui.companion.mercDead', { name: getMercenaryName(merc.type, def.name), type: getMercenaryTypeLabel(merc.type), level: String(merc.level) });
      panel.add(this.add.text(px(30), px(84), statusText, {
        fontSize: fs(12), color: merc.alive ? UI_COLORS.text : '#ff8a72', fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
    }

    // Pet section
    this.renderPetSection(pw, ph);

    // Footer
    panel.add(this.add.text(pw / 2, ph - px(18), t('ui.companion.footer'), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5));
  }

  private renderHirePanel(pw: number, ph: number, mercSys: MercenarySystem): void {
    if (!this.companionPanel) return;

    this.companionPanel.add(this.add.text(pw / 2, px(36), t('ui.companion.hireHeader'), {
      fontSize: fs(14), color: '#c0934a', fontFamily: FONT,
    }).setOrigin(0.5, 0));

    // Check if player is near camp
    const safeRadius = (this.zone as any)?.mapData?.safeZoneRadius ?? 9;
    const campPositions: { col: number; row: number }[] = (this.zone as any)?.campPositions ?? [];
    let isNearCamp = false;
    for (const camp of campPositions) {
      const dx = this.player.tileCol - camp.col;
      const dy = this.player.tileRow - camp.row;
      if (Math.sqrt(dx * dx + dy * dy) < safeRadius) {
        isNearCamp = true;
        break;
      }
    }

    if (!isNearCamp) {
      this.companionPanel.add(this.add.text(pw / 2, px(60), t('ui.companion.needCamp'), {
        fontSize: fs(13), color: '#888', fontFamily: FONT,
      }).setOrigin(0.5, 0));
      return;
    }

    const typeNames: Record<string, string> = {
      tank: getMercenaryTypeLabel('tank'), melee: getMercenaryTypeLabel('melee'), ranged: getMercenaryTypeLabel('ranged'), healer: getMercenaryTypeLabel('healer'), mage: getMercenaryTypeLabel('mage'),
    };
    const roleColors: Record<string, number> = {
      tank: 0x2471a3, melee: 0xc0392b, ranged: 0x27ae60, healer: 0xf1c40f, mage: 0x8e44ad,
    };

    const cardH = px(68);
    const startY = px(58);

    MERCENARY_TYPES.forEach((type, i) => {
      const def = MERCENARY_DEFS[type];
      const cy = startY + i * (cardH + px(6));
      const roleColor = roleColors[type] ?? 0x888888;
      const canAfford = this.player.gold >= def.hireCost;

      // Card bg
      const cardBg = this.add.rectangle(pw / 2, cy + cardH / 2, pw - px(24), cardH, 0x111122, 0.95)
        .setStrokeStyle(Math.round(1 * DPR), roleColor, 0.6);
      this.companionPanel!.add(cardBg);

      // Color indicator
      this.companionPanel!.add(
        this.add.rectangle(px(16), cy + cardH / 2, px(6), cardH - px(8), roleColor).setOrigin(0, 0.5)
      );

      // Type name + label
      this.companionPanel!.add(this.add.text(px(30), cy + px(6), `${getMercenaryName(type, def.name)} (${typeNames[type]})`, {
        fontSize: fs(14), color: '#e0d8cc', fontFamily: FONT, fontStyle: 'bold',
      }));

      // Description
      this.companionPanel!.add(this.add.text(px(30), cy + px(24), getMercenaryDesc(type, def.description), {
        fontSize: fs(11), color: '#888', fontFamily: FONT, wordWrap: { width: pw - px(180), useAdvancedWrap: true },
      }));

      // Stats preview
      const statsStr = t('ui.companion.statRow', { hp: String(def.baseHp), damage: String(def.baseDamage), defense: String(def.baseDefense), range: String(def.attackRange) });
      this.companionPanel!.add(this.add.text(px(30), cy + px(42), statsStr, {
        fontSize: fs(10), color: '#666', fontFamily: FONT,
      }));

      // Cost + Hire button
      this.companionPanel!.add(this.add.text(pw - px(80), cy + px(10), `${def.hireCost}G`, {
        fontSize: fs(14), color: canAfford ? '#f1c40f' : '#555', fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(0.5, 0));

      const hireBtnBg = this.add.rectangle(pw - px(80), cy + px(38), px(80), px(22), canAfford ? 0x1a3a1a : 0x1a1a1a)
        .setStrokeStyle(Math.round(1 * DPR), canAfford ? 0x27ae60 : 0x333333);
      this.companionPanel!.add(hireBtnBg);

      const hireBtnText = this.add.text(pw - px(80), cy + px(38), t('ui.companion.hire'), {
        fontSize: fs(13), color: canAfford ? '#27ae60' : '#555', fontFamily: FONT,
      }).setOrigin(0.5);
      this.companionPanel!.add(hireBtnText);

      if (canAfford) {
        hireBtnBg.setInteractive({ useHandCursor: true });
        hireBtnBg.on('pointerdown', () => {
          const result = mercSys.hire(type, this.player.gold);
          if (result.success) {
            this.player.gold -= result.cost;
            // Spawn mercenary sprite in zone
            const zoneScene = this.zone as any;
            if (zoneScene?.spawnMercenarySprite) {
              zoneScene.spawnMercenarySprite();
            }
            // Rebuild panel
            this.companionPanel?.destroy();
            this.companionPanel = null;
            this.buildCompanionPanel();
          }
        });
        hireBtnBg.on('pointerover', () => hireBtnBg.setFillStyle(0x225522));
        hireBtnBg.on('pointerout', () => hireBtnBg.setFillStyle(0x1a3a1a));
      }
    });
  }

  private renderMercenaryInfo(pw: number, ph: number, merc: MercenaryState, mercSys: MercenarySystem): void {
    if (!this.companionPanel) return;
    const def = MERCENARY_DEFS[merc.type];
    const roleColors: Record<string, number> = {
      tank: 0x2471a3, melee: 0xc0392b, ranged: 0x27ae60, healer: 0xf1c40f, mage: 0x8e44ad,
    };
    const typeNames: Record<string, string> = {
      tank: getMercenaryTypeLabel('tank'), melee: getMercenaryTypeLabel('melee'), ranged: getMercenaryTypeLabel('ranged'), healer: getMercenaryTypeLabel('healer'), mage: getMercenaryTypeLabel('mage'),
    };
    const roleColor = roleColors[merc.type] ?? 0x888888;

    // Merc name + level
    this.companionPanel.add(this.add.text(pw / 2, px(36), `${getMercenaryName(merc.type, def.name)} (${typeNames[merc.type]})`, {
      fontSize: fs(16), color: '#e0d8cc', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    // Alive/dead status
    const statusLabel = merc.alive ? t('ui.companion.alive') : t('ui.companion.dead');
    const statusText = t('ui.companion.status', { level: String(merc.level), status: statusLabel });
    const statusColor = merc.alive ? '#27ae60' : '#e74c3c';
    this.companionPanel.add(this.add.text(pw / 2, px(56), statusText, {
      fontSize: fs(13), color: statusColor, fontFamily: FONT,
    }).setOrigin(0.5, 0));

    // Description
    this.companionPanel.add(this.add.text(px(14), px(80), getMercenaryDesc(merc.type, def.description), {
      fontSize: fs(12), color: '#888', fontFamily: FONT,
    }));

    // Stats section
    let sy = px(102);
    this.companionPanel.add(this.add.text(px(14), sy, t('ui.companion.attributes'), {
      fontSize: fs(13), color: '#c0934a', fontFamily: FONT,
    }));
    sy += px(20);

    // HP/Mana bars
    const barW = px(140), barH = px(8);
    // HP bar
    this.companionPanel.add(this.add.text(px(14), sy, 'HP', {
      fontSize: fs(11), color: '#e74c3c', fontFamily: FONT,
    }));
    this.companionPanel.add(
      this.add.rectangle(px(50), sy + px(4), barW, barH, 0x1a1a1a).setOrigin(0, 0.5)
        .setStrokeStyle(Math.round(1 * DPR), 0x333333)
    );
    const hpFillW = merc.alive ? Math.max(0, barW * (merc.hp / merc.maxHp)) : 0;
    if (hpFillW > 0) {
      this.companionPanel.add(
        this.add.rectangle(px(50), sy + px(4), hpFillW, barH, 0xe74c3c).setOrigin(0, 0.5)
      );
    }
    this.companionPanel.add(this.add.text(px(200), sy, `${Math.ceil(merc.hp)}/${merc.maxHp}`, {
      fontSize: fs(11), color: '#aaa', fontFamily: FONT,
    }));
    sy += px(18);

    // Mana bar
    this.companionPanel.add(this.add.text(px(14), sy, 'MP', {
      fontSize: fs(11), color: '#2471a3', fontFamily: FONT,
    }));
    this.companionPanel.add(
      this.add.rectangle(px(50), sy + px(4), barW, barH, 0x1a1a1a).setOrigin(0, 0.5)
        .setStrokeStyle(Math.round(1 * DPR), 0x333333)
    );
    const manaFillW = merc.alive ? Math.max(0, barW * (merc.mana / merc.maxMana)) : 0;
    if (manaFillW > 0) {
      this.companionPanel.add(
        this.add.rectangle(px(50), sy + px(4), manaFillW, barH, 0x2471a3).setOrigin(0, 0.5)
      );
    }
    this.companionPanel.add(this.add.text(px(200), sy, `${Math.ceil(merc.mana)}/${merc.maxMana}`, {
      fontSize: fs(11), color: '#aaa', fontFamily: FONT,
    }));
    sy += px(18);

    // EXP
    const expNeeded = mercSys.expToNextLevel(merc.level);
    this.companionPanel.add(this.add.text(px(14), sy, t('ui.companion.exp', { exp: String(merc.exp), needed: String(expNeeded) }), {
      fontSize: fs(11), color: '#b08cce', fontFamily: FONT,
    }));
    sy += px(18);

    // Base stats
    const statRow2 = t('ui.companion.statRow', { hp: String(Math.ceil(merc.hp)), damage: String(merc.baseDamage), defense: String(merc.defense), range: String(merc.attackRange) });
    this.companionPanel.add(this.add.text(px(14), sy, statRow2, {
      fontSize: fs(11), color: '#aaa', fontFamily: FONT,
    }));
    sy += px(18);

    // Primary stats
    const primaryStats = t('ui.companion.primaryStats', { str: String(Math.floor(merc.stats.str)), dex: String(Math.floor(merc.stats.dex)), vit: String(Math.floor(merc.stats.vit)), int: String(Math.floor(merc.stats.int)), spi: String(Math.floor(merc.stats.spi)), lck: String(Math.floor(merc.stats.lck)) });
    this.companionPanel.add(this.add.text(px(14), sy, primaryStats, {
      fontSize: fs(11), color: '#888', fontFamily: FONT,
    }));
    sy += px(22);

    // Equipment section
    this.companionPanel.add(this.add.text(px(14), sy, t('ui.companion.equipment'), {
      fontSize: fs(13), color: '#c0934a', fontFamily: FONT,
    }));
    sy += px(20);

    const slotSize = px(36);

    // Weapon slot
    const weaponItem = merc.equipment.weapon;
    this.companionPanel.add(this.createItemSlot(px(14) + slotSize / 2, sy + slotSize / 2, slotSize, weaponItem ?? null, { interactive: false }).objects);
    this.companionPanel.add(this.add.text(px(14) + slotSize / 2, sy + slotSize + px(2), t('ui.companion.weapon'), {
      fontSize: fs(10), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5, 0));

    // Armor slot
    const armorItem = merc.equipment.armor;
    this.companionPanel.add(this.createItemSlot(px(14) + slotSize * 2, sy + slotSize / 2, slotSize, armorItem ?? null, { interactive: false }).objects);
    this.companionPanel.add(this.add.text(px(14) + slotSize * 2, sy + slotSize + px(2), t('ui.companion.armor'), {
      fontSize: fs(10), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5, 0));

    sy += slotSize + px(22);

    // Action buttons
    const btnY = sy + px(6);

    if (merc.alive) {
      // Dismiss button
      const dismissBg = this.add.rectangle(px(60), btnY, px(100), px(26), 0x2a1a1a)
        .setStrokeStyle(Math.round(1 * DPR), 0xc0392b).setInteractive({ useHandCursor: true });
      dismissBg.on('pointerdown', () => {
        mercSys.dismiss();
        const zoneScene = this.zone as any;
        if (zoneScene?.destroyMercenarySprite) {
          zoneScene.destroyMercenarySprite();
        }
        this.companionPanel?.destroy();
        this.companionPanel = null;
        this.buildCompanionPanel();
      });
      this.companionPanel.add(dismissBg);
      this.companionPanel.add(this.add.text(px(60), btnY, t('ui.companion.dismiss'), {
        fontSize: fs(13), color: '#e74c3c', fontFamily: FONT,
      }).setOrigin(0.5));
    } else {
      // Revive button
      const reviveCost = def.reviveCost;
      const canRevive = this.player.gold >= reviveCost;

      // Check if near camp
      const safeRadius = (this.zone as any)?.mapData?.safeZoneRadius ?? 9;
      const campPositions: { col: number; row: number }[] = (this.zone as any)?.campPositions ?? [];
      let isNearCamp = false;
      for (const camp of campPositions) {
        const dx = this.player.tileCol - camp.col;
        const dy = this.player.tileRow - camp.row;
        if (Math.sqrt(dx * dx + dy * dy) < safeRadius) {
          isNearCamp = true;
          break;
        }
      }

      if (!isNearCamp) {
        this.companionPanel.add(this.add.text(pw / 2, btnY, t('ui.companion.reviveAtCamp'), {
          fontSize: fs(12), color: '#888', fontFamily: FONT,
        }).setOrigin(0.5));
      } else {
        const reviveBg = this.add.rectangle(px(100), btnY, px(160), px(26), canRevive ? 0x1a3a1a : 0x1a1a1a)
          .setStrokeStyle(Math.round(1 * DPR), canRevive ? 0x27ae60 : 0x333333);
        this.companionPanel.add(reviveBg);
        this.companionPanel.add(this.add.text(px(100), btnY, t('ui.companion.revive', { cost: String(reviveCost) }), {
          fontSize: fs(13), color: canRevive ? '#27ae60' : '#555', fontFamily: FONT,
        }).setOrigin(0.5));

        if (canRevive) {
          reviveBg.setInteractive({ useHandCursor: true });
          reviveBg.on('pointerdown', () => {
            const result = mercSys.revive(this.player.gold);
            if (result.success) {
              this.player.gold -= result.cost;
              // Set position near player
              mercSys.setPosition(this.player.tileCol + 1, this.player.tileRow + 1);
              const zoneScene = this.zone as any;
              if (zoneScene?.spawnMercenarySprite) {
                zoneScene.spawnMercenarySprite();
              }
              this.companionPanel?.destroy();
              this.companionPanel = null;
              this.buildCompanionPanel();
            }
          });
        }
      }

      // Dismiss button (even when dead, can dismiss to hire a new one)
      const dismissBg2 = this.add.rectangle(pw - px(80), btnY, px(100), px(26), 0x2a1a1a)
        .setStrokeStyle(Math.round(1 * DPR), 0xc0392b).setInteractive({ useHandCursor: true });
      dismissBg2.on('pointerdown', () => {
        mercSys.dismiss();
        const zoneScene = this.zone as any;
        if (zoneScene?.destroyMercenarySprite) {
          zoneScene.destroyMercenarySprite();
        }
        this.companionPanel?.destroy();
        this.companionPanel = null;
        this.buildCompanionPanel();
      });
      this.companionPanel.add(dismissBg2);
      this.companionPanel.add(this.add.text(pw - px(80), btnY, t('ui.companion.dismiss'), {
        fontSize: fs(13), color: '#e74c3c', fontFamily: FONT,
      }).setOrigin(0.5));
    }
  }

  /** Render the pet section within the companion panel. */
  private renderPetSection(pw: number, ph: number): void {
    if (!this.companionPanel) return;
    const hs = this.zone?.homesteadSystem;
    if (!hs) return;
    const panel = this.companionPanel;

    const petStartY = px(122);

    panel.add(addSectionHeader(this, px(18), petStartY, pw - px(36), t('ui.companion.petHeader', { count: String(hs.pets.length) })));

    if (hs.pets.length === 0) {
      panel.add(this.add.text(px(18), petStartY + px(16), t('ui.companion.noPets'), {
        fontSize: fs(12), color: UI_COLORS.muted, fontFamily: FONT,
        wordWrap: { width: pw - px(36), useAdvancedWrap: true },
      }));
      return;
    }

    const cardH = px(58);
    const startY = petStartY + px(14);
    const allPets = hs.getAllPets();
    const cardX = px(18), cardW = pw - px(36);

    const rarityColors: Record<string, string> = {
      common: '#a8d8a0', rare: '#7fb0ff', epic: '#d08cff',
    };

    hs.pets.forEach((pet, i) => {
      const def = allPets.find(p => p.id === pet.petId);
      if (!def) return;
      const cy = startY + i * (cardH + px(6));
      if (cy + cardH > ph - px(34)) return; // Prevent overflow

      const isActive = hs.activePet === pet.petId;
      const rarityColor = rarityColors[def.rarity] ?? '#aaa';

      // Card background
      const cardG = this.add.graphics();
      drawCard(cardG, cardX, cy, cardW, cardH, isActive
        ? { fill: 0x172414, border: 0x6fd35a, glow: 0x6fd35a, strip: 0x6fd35a }
        : { border: 0x3f3845 });
      panel.add(cardG);
      const cardBg = this.add.rectangle(cardX, cy, cardW - px(120), cardH, 0x000000, 0).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      panel.add(cardBg);

      // Active indicator
      if (isActive) {
        panel.add(this.add.text(cardX + px(14), cy + px(14), '★', {
          fontSize: fs(15), color: '#ffd98a', fontFamily: FONT,
          stroke: '#000000', strokeThickness: Math.round(2 * DPR),
        }).setOrigin(0.5));
      }

      // Pet name with evolution
      const displayName = hs.getPetDisplayName(pet);
      panel.add(this.add.text(cardX + px(28), cy + px(6), `${displayName} Lv.${pet.level}`, {
        fontSize: fs(13), color: rarityColor, fontFamily: FONT, fontStyle: 'bold',
      }));

      // Description
      panel.add(this.add.text(cardX + px(28), cy + px(23), getPetDesc(pet.petId, def.description), {
        fontSize: fs(10), color: UI_COLORS.muted, fontFamily: FONT,
        wordWrap: { width: cardW - px(170), useAdvancedWrap: true }, maxLines: 1,
      }));

      // EXP bar
      const expNeeded = pet.level * 20;
      const expRatio = pet.level >= def.maxLevel ? 1 : pet.exp / expNeeded;
      const barW = px(110), barH = px(7);
      const barX = cardX + px(28), barY = cy + px(42);
      const barG = this.add.graphics();
      drawWell(barG, barX, barY, barW, barH, px(3));
      drawBarFill(barG, barX + 1, barY + 1, Math.round((barW - 2) * Math.max(0, Math.min(1, expRatio))), barH - 2, 0x9b4fd0);
      panel.add(barG);
      const expText = pet.level >= def.maxLevel ? 'MAX' : `${pet.exp}/${expNeeded}`;
      panel.add(this.add.text(barX + barW + px(6), barY + barH / 2, expText, {
        fontSize: fs(10), color: '#d0b0f0', fontFamily: FONT,
      }).setOrigin(0, 0.5));

      // Evolution badge
      if (pet.evolved > 0) {
        const evoBadge = pet.evolved >= 2 ? t('ui.companion.evoSupreme') : t('ui.companion.evoAwakened');
        panel.add(this.add.text(barX + barW + px(60), barY + barH / 2, `[${evoBadge}]`, {
          fontSize: fs(10), color: '#ffd98a', fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0, 0.5));
      }

      // Bonus stat display
      const evoMult = hs.getEvolutionMultiplier(pet);
      const baseBonus = def.bonusValue + def.bonusPerLevel * pet.level;
      const bonusVal = Math.floor(baseBonus * evoMult);
      panel.add(this.add.text(cardX + cardW - px(12), cy + px(8), `+${bonusVal} ${getPetStatLabel(def.bonusStat)}`, {
        fontSize: fs(11), color: UI_COLORS.textSoft, fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(1, 0));

      // Activate / deactivate button
      const btnY = cy + px(40);
      if (!isActive) {
        panel.add(this.makeButton(cardX + cardW - px(44), btnY, px(72), px(24), t('ui.companion.activate'), () => {
          hs.setActivePet(pet.petId);
          // Respawn pet sprite
          const zoneScene = this.zone as any;
          if (zoneScene?.spawnPetSprite) zoneScene.spawnPetSprite();
          this.companionPanel?.destroy();
          this.companionPanel = null;
          this.buildCompanionPanel();
        }, { variant: 'success', fontSize: 11 }));
      } else {
        panel.add(this.makeButton(cardX + cardW - px(44), btnY, px(72), px(24), t('ui.companion.deactivate'), () => {
          hs.setActivePet(null);
          // Remove pet sprite
          const zoneScene = this.zone as any;
          if (zoneScene?.destroyPetSprite) zoneScene.destroyPetSprite();
          this.companionPanel?.destroy();
          this.companionPanel = null;
          this.buildCompanionPanel();
        }, { fontSize: 11 }));
      }

      // Feed button
      panel.add(this.makeButton(cardX + cardW - px(122), btnY, px(72), px(24), t('ui.companion.feed'), () => {
        // Check if player has the feed item
        const inv = this.zone?.inventorySystem;
        if (!inv) return;
        const feedItemIdx = inv.inventory.findIndex(it => it.baseId === def.feedItem);
        if (feedItemIdx === -1) {
          EventBus.emit(GameEvents.LOG_MESSAGE, { text: t('ui.companion.feedNeeded', { item: def.feedItem }), type: 'system' });
          return;
        }
        // Consume feed item
        const feedItem = inv.inventory[feedItemIdx];
        if (feedItem.quantity > 1) {
          feedItem.quantity--;
        } else {
          inv.inventory.splice(feedItemIdx, 1);
        }
        hs.feedPet(pet.petId);
        // Respawn pet sprite to update name if evolved
        const zoneScene = this.zone as any;
        if (zoneScene?.spawnPetSprite && hs.activePet === pet.petId) {
          zoneScene.spawnPetSprite();
        }
        this.companionPanel?.destroy();
        this.companionPanel = null;
        this.buildCompanionPanel();
      }, { variant: 'secondary', fontSize: 11, color: '#9fd4ff', disabled: pet.level >= def.maxLevel }));

      // Click card to toggle active
      cardBg.on('pointerdown', () => {
        if (isActive) {
          hs.setActivePet(null);
          const zoneScene = this.zone as any;
          if (zoneScene?.destroyPetSprite) zoneScene.destroyPetSprite();
        } else {
          hs.setActivePet(pet.petId);
          const zoneScene = this.zone as any;
          if (zoneScene?.spawnPetSprite) zoneScene.spawnPetSprite();
        }
        this.companionPanel?.destroy();
        this.companionPanel = null;
        this.buildCompanionPanel();
      });
    });
  }

  // --- Achievement Unlock Toast ---
  private handleAchievementUnlocked(data: { achievement: import('../data/types').AchievementDefinition }): void {
    const ach = data.achievement;
    const toastW = px(360), toastH = px(62);
    const toastX = (W - toastW) / 2, toastY = px(60);
    const toast = this.add.container(toastX, toastY).setDepth(PANEL_STYLE.depth.toast).setAlpha(0);

    // Framed plate with gold accent
    toast.add(addFrame(this, 0, 0, toastW, toastH, { variant: 'tooltip', accent: 0xffd98a }));
    const medal = this.add.graphics();
    medal.fillStyle(0x000000, 0.6);
    medal.fillCircle(px(28), toastH / 2 + 1, px(16));
    medal.fillStyle(0x5a3a10, 1);
    medal.fillCircle(px(28), toastH / 2, px(15));
    medal.lineStyle(2, 0xffd98a, 1);
    medal.strokeCircle(px(28), toastH / 2, px(15));
    toast.add(medal);

    // Gold star icon
    toast.add(this.add.text(px(28), toastH / 2, '★', {
      fontSize: fs(20), color: '#ffd98a', fontFamily: FONT,
    }).setOrigin(0.5, 0.5));

    // Achievement name and description
    toast.add(this.add.text(px(52), px(10), t('ui.achievement.toastUnlock', { name: ach.name }), {
      fontSize: fs(14), color: '#ffd98a', fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: Math.round(2 * DPR),
    }));
    const rewardParts: string[] = [];
    if (ach.reward) {
      const statDisp = STAT_DISPLAY[ach.reward.stat];
      const label = statDisp ? statDisp.label : ach.reward.stat;
      rewardParts.push(`${label}+${ach.reward.value}`);
    }
    if (ach.title) rewardParts.push(t('ui.achievement.titleReward', { title: ach.title }));
    const subText = rewardParts.length > 0 ? `${ach.description}  |  ${rewardParts.join('  ')}` : ach.description;
    toast.add(this.add.text(px(52), px(32), subText, {
      fontSize: fs(11), color: UI_COLORS.text, fontFamily: FONT,
      wordWrap: { width: toastW - px(66), useAdvancedWrap: true }, maxLines: 2,
    }));

    // Animate in
    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: toastY + px(10),
      duration: 400,
      ease: 'Back.easeOut',
    });

    // Auto-dismiss after 3.5s
    this.time.delayedCall(3500, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        y: toastY - px(20),
        duration: 300,
        ease: 'Power2',
        onComplete: () => toast.destroy(),
      });
    });
  }

  // --- Achievement Panel (V) ---
  private toggleAchievement(): void {
    if (this.achievementPanel) { this.achievementPanel.destroy(); this.achievementPanel = null; return; }
    this.closeAllPanels();
    audioManager.playSFX('click');

    const pw = px(560), ph = px(540), panelX = (W - pw) / 2, panelY = px(10);
    this.achievementPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    const panel = this.achievementPanel;
    this.animatePanelOpen(panel);

    // Background
    panel.add(this.createPanelBg(pw, ph));

    // Title
    panel.add(this.createPanelTitle(pw, t('ui.achievement.title')));

    // Close button
    panel.add(this.createPanelCloseBtn(pw, () => this.toggleAchievement()));

    // Unlocked title display
    const achSystem = this.zone?.achievementSystem;
    if (!achSystem) return;
    const achievements = achSystem.getAll();
    const unlockedTitles = achievements.filter(a => a.isUnlocked && a.title).map(a => a.title!);
    const unlocked = achievements.filter(a => a.isUnlocked).length;

    // Summary line: progress bar + count (+ current title)
    const sumY = px(54);
    const sumBarW = px(200);
    const sumG = this.add.graphics();
    drawWell(sumG, px(20), sumY - px(4), sumBarW, px(8), px(4));
    drawBarFill(sumG, px(21), sumY - px(3), Math.round((sumBarW - 2) * (achievements.length ? unlocked / achievements.length : 0)), px(6), 0xd4a54a);
    panel.add(sumG);
    panel.add(this.add.text(px(20) + sumBarW + px(10), sumY, t('ui.achievement.unlocked', { count: String(unlocked), total: String(achievements.length) }), {
      fontSize: fs(12), color: UI_COLORS.textSoft, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    if (unlockedTitles.length > 0) {
      panel.add(this.add.text(pw - px(20), sumY, t('ui.achievement.currentTitle', { title: unlockedTitles[unlockedTitles.length - 1] }), {
        fontSize: fs(12), color: UI_COLORS.goldBright, fontFamily: FONT, fontStyle: 'bold',
      }).setOrigin(1, 0.5));
    }

    // Achievement list
    const listTop = px(72);
    const rowH = px(56);
    const listH = ph - listTop - px(30);
    const maxVisible = Math.floor(listH / rowH);
    const listC = this.add.container(0, 0);
    panel.add(listC);

    let scrollOffset = 0;
    const rebuildList = () => {
      listC.removeAll(true);
      const start = scrollOffset;
      const end = Math.min(start + maxVisible, achievements.length);
      for (let i = start; i < end; i++) {
        const ach = achievements[i];
        const ry = listTop + (i - start) * rowH;
        this.renderAchievementRow(ach, px(18), ry, pw - px(36), rowH - px(6), listC);
      }
      // Scroll indicator
      if (achievements.length > maxVisible) {
        listC.add(this.add.text(pw - px(20), ph - px(18), `${scrollOffset + 1}-${end}/${achievements.length}`, {
          fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
        }).setOrigin(1, 0.5));
      }
    };
    rebuildList();

    // Scroll support if more than visible
    if (achievements.length > maxVisible) {
      // Mouse wheel scroll — store handler ref for cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const achWheelHandler = (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], _gw: number, _gh: number, dy: number) => {
        if (!this.achievementPanel) return;
        if (dy > 0 && scrollOffset < achievements.length - maxVisible) { scrollOffset++; rebuildList(); }
        if (dy < 0 && scrollOffset > 0) { scrollOffset--; rebuildList(); }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.input.on('wheel', achWheelHandler as any);
      // Cleanup on panel destroy
      const originalDestroy = panel.destroy.bind(panel);
      panel.destroy = (...args: Parameters<typeof originalDestroy>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.input.off('wheel', achWheelHandler as any);
        return originalDestroy(...args);
      };
    }

    // Footer
    panel.add(this.add.text(pw / 2, ph - px(18), t('ui.achievement.footer'), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5));
  }

  private renderAchievementRow(
    ach: import('../data/types').AchievementDefinition & { current: number; isUnlocked: boolean },
    x: number, y: number, w: number, h: number,
    target: Phaser.GameObjects.Container,
  ): void {
    const isUnlocked = ach.isUnlocked;

    // Row background
    const rowBg = this.add.graphics();
    drawCard(rowBg, x, y, w, h, isUnlocked
      ? { fill: 0x241d12, border: 0xd4a54a, strip: 0xffd98a }
      : { fill: 0x141216, border: 0x2e2a32 });
    target.add(rowBg);

    // Icon area: medal
    const iconSize = px(38);
    const iconCx = x + px(12) + iconSize / 2;
    const iconCy = y + h / 2;
    const iconGfx = this.add.graphics();
    iconGfx.fillStyle(0x000000, 0.6);
    iconGfx.fillCircle(iconCx, iconCy + 1.5, iconSize / 2);
    iconGfx.fillStyle(isUnlocked ? 0x5a3a10 : 0x1a171d, 1);
    iconGfx.fillCircle(iconCx, iconCy, iconSize / 2);
    iconGfx.lineStyle(2, isUnlocked ? 0xffd98a : 0x3f3845, 1);
    iconGfx.strokeCircle(iconCx, iconCy, iconSize / 2 - 1);
    target.add(iconGfx);

    // Star icon (gold for unlocked, grey for locked)
    target.add(this.add.text(iconCx, iconCy, isUnlocked ? '★' : '☆', {
      fontSize: fs(19), color: isUnlocked ? '#ffd98a' : '#5a5060', fontFamily: FONT,
    }).setOrigin(0.5));

    // Text area
    const textX = x + px(12) + iconSize + px(12);
    const rightW = px(110);
    const textAreaW = w - (textX - x) - rightW - px(10);

    // Name
    target.add(this.add.text(textX, y + px(7), ach.name, {
      fontSize: fs(13), color: isUnlocked ? UI_COLORS.goldBright : UI_COLORS.textSoft, fontFamily: FONT, fontStyle: 'bold',
    }));

    // Description
    target.add(this.add.text(textX, y + px(25), ach.description, {
      fontSize: fs(11), color: isUnlocked ? UI_COLORS.text : UI_COLORS.muted, fontFamily: FONT,
      wordWrap: { width: textAreaW, useAdvancedWrap: true }, maxLines: 2,
    }));

    // Progress bar
    const barW = px(96), barH = px(8);
    const barX = x + w - barW - px(12);
    const barY = y + px(10);
    const progress = Math.min(ach.current / ach.required, 1);
    const barGfx = this.add.graphics();
    drawWell(barGfx, barX, barY, barW, barH, px(4));
    drawBarFill(barGfx, barX + 1, barY + 1, Math.round((barW - 2) * progress), barH - 2, isUnlocked ? 0xd4a54a : 0x6a6280);
    target.add(barGfx);

    // Progress text
    const progText = isUnlocked ? `${ach.required}/${ach.required}` : `${Math.min(ach.current, ach.required)}/${ach.required}`;
    target.add(this.add.text(barX + barW / 2, barY + barH + px(3), progText, {
      fontSize: fs(10), color: isUnlocked ? UI_COLORS.goldBright : UI_COLORS.muted, fontFamily: FONT,
    }).setOrigin(0.5, 0));

    // Reward info
    const rewardParts: string[] = [];
    if (ach.reward) {
      const statDisp = STAT_DISPLAY[ach.reward.stat];
      const label = statDisp ? statDisp.label : ach.reward.stat;
      rewardParts.push(`${label}+${ach.reward.value}`);
    }
    if (ach.title) rewardParts.push(t('ui.achievement.titleReward', { title: ach.title }));
    if (rewardParts.length > 0) {
      const rt = this.add.text(barX + barW / 2, barY + barH + px(17), rewardParts.join('  '), {
        fontSize: fs(10), color: isUnlocked ? '#8be9fd' : '#5a6a70', fontFamily: FONT,
      }).setOrigin(0.5, 0);
      if (rt.width > rightW) rt.setScale(rightW / rt.width, 1);
      target.add(rt);
    }
  }

  // --- Audio Settings Panel ---
  private toggleAudioSettings(): void {
    if (this.audioPanel) {
      this.cleanupAudioPanelInputHandlers();
      this.audioPanel.destroy();
      this.audioPanel = null;
      return;
    }
    this.closeAllPanels();
    const pw = px(420), ph = px(170), panelX = (W - pw) / 2, panelY = (H - ph) / 2;
    this.audioPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    this.animatePanelOpen(this.audioPanel);
    this.audioPanel.add(this.createPanelBg(pw, ph));
    this.audioPanel.add(this.createPanelTitle(pw, t('ui.audio.title')));

    const settings = audioManager.getSettings();
    const sliderW = px(180), sliderH = px(8), sliderX = px(96), labelX = px(22);
    const hitH = px(28); // tall hit area for easy clicking

    const makeSlider = (y: number, label: string, initial: number, muted: boolean,
      onVolume: (v: number) => void, onMute: () => boolean) => {
      const cy = y + px(6);
      this.audioPanel!.add(this.add.text(labelX, cy, label, { fontSize: fs(14), color: UI_COLORS.text, fontFamily: FONT, fontStyle: 'bold' }).setOrigin(0, 0.5));
      const track = this.add.graphics();
      drawWell(track, sliderX - px(1), cy - sliderH / 2 - px(1), sliderW + px(2), sliderH + px(2), px(4));
      const fill = this.add.rectangle(sliderX, cy, sliderW * initial, sliderH - px(2), 0xd4a54a).setOrigin(0, 0.5);
      const handle = this.add.circle(sliderX + sliderW * initial, cy, px(8), 0xe8c77a).setStrokeStyle(px(2), 0x3b2507);
      const pctText = this.add.text(sliderX + sliderW + px(12), cy, `${Math.round(initial * 100)}%`, {
        fontSize: fs(12), color: UI_COLORS.textSoft, fontFamily: FONT,
      }).setOrigin(0, 0.5);
      // Invisible hit area covering the full track height
      const hitArea = this.add.rectangle(sliderX + sliderW / 2, cy, sliderW + px(14), hitH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      this.audioPanel!.add([track, fill, handle, pctText, hitArea]);

      let dragging = false;
      const updateSlider = (pointerX: number) => {
        const localX = Math.max(0, Math.min(pointerX - panelX - sliderX, sliderW));
        const v = localX / sliderW;
        handle.x = sliderX + localX;
        fill.width = localX;
        pctText.setText(`${Math.round(v * 100)}%`);
        onVolume(v);
      };
      hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; updateSlider(p.x); });
      const pointerMoveHandler = (p: Phaser.Input.Pointer) => { if (dragging) updateSlider(p.x); };
      const pointerUpHandler = () => { dragging = false; };
      this.input.on('pointermove', pointerMoveHandler);
      this.input.on('pointerup', pointerUpHandler);
      this.audioPanelInputCleanup.push(() => this.input.off('pointermove', pointerMoveHandler));
      this.audioPanelInputCleanup.push(() => this.input.off('pointerup', pointerUpHandler));

      // Mute button
      const muteBtn = this.makeButton(pw - px(50), cy, px(64), px(24), muted ? t('ui.audio.muted') : t('ui.audio.unmuted'), () => {
        const nowMuted = onMute();
        muteBtn.setLabel(btnLabel(nowMuted ? t('ui.audio.muted') : t('ui.audio.unmuted')), nowMuted ? '#ff8a72' : '#a8f090');
      }, { fontSize: 11, color: muted ? '#ff8a72' : '#a8f090' });
      this.audioPanel!.add(muteBtn);
    };

    // BGM slider
    makeSlider(px(60), t('ui.audio.bgm'), settings.bgmVolume, settings.bgmMuted,
      (v) => audioManager.setMusicVolume(v),
      () => { audioManager.toggleMusicMute(); return audioManager.getSettings().bgmMuted; });

    // SFX slider
    makeSlider(px(108), t('ui.audio.sfx'), settings.sfxVolume, settings.sfxMuted,
      (v) => audioManager.setSFXVolume(v),
      () => { audioManager.toggleSFXMute(); return audioManager.getSettings().sfxMuted; });

    // Close button
    this.audioPanel.add(this.createPanelCloseBtn(pw, () => {
      this.cleanupAudioPanelInputHandlers();
      if (this.audioPanel) { this.audioPanel.destroy(); this.audioPanel = null; }
    }));
  }

  // ─── Mini-Boss Cinematic Dialogue ─────────────────────────────────────

  /** Show a cinematic pre-fight dialogue panel for a mini-boss. */
  private showMiniBossDialogue(bossName: string, dialogueTree: DialogueTree, onDismiss: () => void): void {
    this.closeAllPanels();
    audioManager.playSFX('click');

    // Full-screen dark backdrop
    this.miniBossDialogueBackdrop = this.createBackdrop(0.95);

    const pw = px(500), ph = px(260);
    const panelX = (W - pw) / 2, panelY = (H - ph) / 2;
    this.miniBossDialoguePanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    this.animatePanelOpen(this.miniBossDialoguePanel);

    // Background with unified style + red accent for boss encounter
    this.miniBossDialoguePanel.add(this.createPanelBg(pw, ph, px(PANEL_STYLE.header.height), { accent: 0xe0503c, gem: 0xe0503c }));

    // Boss name header
    this.miniBossDialoguePanel.add(this.createPanelTitle(pw, `⚔ ${bossName} ⚔`, '#ff8a72'));

    // Collect all dialogue lines from the tree
    const lines: string[] = [];
    let nodeId: string | undefined = dialogueTree.startNodeId;
    while (nodeId) {
      const node: DialogueNode | undefined = dialogueTree.nodes[nodeId];
      if (!node) break;
      lines.push(node.text);
      if (node.isEnd) break;
      nodeId = node.nextNodeId;
    }

    // Display lines (measured, so long lines never overlap)
    let dy = px(52);
    for (const line of lines) {
      const lt = this.add.text(px(24), dy, `“${line}”`, {
        fontSize: fs(14), color: '#f0e0d0', fontFamily: FONT, fontStyle: 'italic',
        wordWrap: { width: pw - px(48), useAdvancedWrap: true }, lineSpacing: px(3),
      });
      this.miniBossDialoguePanel.add(lt);
      dy += lt.height + px(12);
    }

    // Dismiss button
    const btnY = Math.max(ph - px(34), dy + px(20));
    this.miniBossDialoguePanel.add(this.makeButton(pw / 2, btnY, px(180), px(34), t('ui.miniBoss.fight'), () => {
      this.closeMiniBossDialogue();
      onDismiss();
    }, { variant: 'danger', fontSize: 15, bold: true }));

    // Also allow backdrop click to dismiss
    this.miniBossDialogueBackdrop.on('pointerdown', () => {
      this.closeMiniBossDialogue();
      onDismiss();
    });
  }

  private closeMiniBossDialogue(): void {
    if (this.miniBossDialoguePanel) {
      this.miniBossDialoguePanel.destroy();
      this.miniBossDialoguePanel = null;
    }
    if (this.miniBossDialogueBackdrop) {
      this.miniBossDialogueBackdrop.destroy();
      this.miniBossDialogueBackdrop = null;
    }
  }

  // ─── Lore Text Popup ─────────────────────────────────────────────────

  /** Show a lore text popup when a collectible is picked up. */
  private showLoreText(entry: LoreEntry): void {
    // Close existing lore panel if open
    if (this.loreTextPanel) { this.loreTextPanel.destroy(); this.loreTextPanel = null; }
    if (this.loreTextBackdrop) { this.loreTextBackdrop.destroy(); this.loreTextBackdrop = null; }

    audioManager.playSFX('click');

    // Semi-transparent backdrop
    this.loreTextBackdrop = this.createBackdrop(0.75);

    const pw = px(440), ph = px(240);
    const panelX = (W - pw) / 2, panelY = (H - ph) / 2;
    this.loreTextPanel = this.add.container(panelX, panelY).setDepth(PANEL_STYLE.depth.panel);
    this.animatePanelOpen(this.loreTextPanel);

    // Background
    this.loreTextPanel.add(this.createPanelBg(pw, ph));

    // Header name
    this.loreTextPanel.add(this.createPanelTitle(pw, entry.name));

    // Zone name
    this.loreTextPanel.add(this.add.text(pw / 2, px(50), getZoneName(entry.zone), {
      fontSize: fs(11), color: UI_COLORS.muted, fontFamily: FONT, fontStyle: 'italic',
    }).setOrigin(0.5, 0.5));

    // Lore text on a parchment-toned well
    const loreWell = this.add.graphics();
    drawWell(loreWell, px(18), px(64), pw - px(36), ph - px(82), px(4), 0x5a4a30);
    this.loreTextPanel.add(loreWell);
    this.loreTextPanel.add(this.add.text(px(30), px(74), entry.text, {
      fontSize: fs(13), color: '#e8dcc0', fontFamily: FONT,
      wordWrap: { width: pw - px(60), useAdvancedWrap: true }, lineSpacing: px(4),
    }));

    // Close button
    this.loreTextPanel.add(this.createPanelCloseBtn(pw, () => this.closeLoreText()));

    // Dismiss on backdrop click
    this.loreTextBackdrop.on('pointerdown', () => this.closeLoreText());

    // Auto-close after 8 seconds
    this.time.delayedCall(8000, () => this.closeLoreText());
  }

  private closeLoreText(): void {
    if (this.loreTextPanel) { this.loreTextPanel.destroy(); this.loreTextPanel = null; }
    if (this.loreTextBackdrop) { this.loreTextBackdrop.destroy(); this.loreTextBackdrop = null; }
  }

  // ─── Lore Log Panel (Sub-tab in Quest Log) ───────────────────────────

  /** Render the lore log content inside the quest log panel. */
  private renderLoreLogContent(): void {
    if (!this.questLogPanel || !this.zone) return;

    const pw = px(720), ph = px(520);
    const zoneOrder = ['emerald_plains', 'twilight_forest', 'anvil_mountains', 'scorching_desert', 'abyss_rift'];

    const collected = this.zone.getLoreCollected();

    // Two columns so all five zones fit inside the panel
    const colW = (pw - px(48)) / 2;
    const colX = [px(18), px(18) + colW + px(12)];
    const colY = [px(90), px(90)];
    const bottom = ph - px(18);

    zoneOrder.forEach((zoneId) => {
      const zoneLore = LoreByZone[zoneId] ?? [];
      if (zoneLore.length === 0) return;
      const c = colY[0] <= colY[1] ? 0 : 1;
      const x = colX[c];
      let dy = colY[c];
      if (dy > bottom - px(40)) return;

      const discoveredCount = zoneLore.filter(l => collected.has(l.id)).length;
      const totalCount = zoneLore.length;
      const zoneName = getZoneName(zoneId);
      const complete = discoveredCount >= totalCount;
      const progressColor = complete ? '#8ff07a' : UI_COLORS.heading;

      // Zone header with progress
      this.questLogPanel!.add(this.add.text(x, dy, zoneName, {
        fontSize: fs(14), color: progressColor, fontFamily: TITLE_FONT, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: Math.round(2 * DPR),
      }));
      this.questLogPanel!.add(this.add.text(x + colW, dy + px(2), t('ui.questLog.loreCollected', { count: String(discoveredCount), total: String(totalCount) }), {
        fontSize: fs(11), color: UI_COLORS.textSoft, fontFamily: FONT,
      }).setOrigin(1, 0));
      dy += px(22);

      // Progress bar
      const barG = this.add.graphics();
      drawWell(barG, x, dy, colW, px(6), px(3));
      drawBarFill(barG, x + 1, dy + 1, Math.round((colW - 2) * (discoveredCount / totalCount)), px(4), complete ? 0x5cc04a : 0xd4a54a);
      this.questLogPanel!.add(barG);
      dy += px(12);

      // Lore entries
      for (const entry of zoneLore) {
        if (dy > bottom - px(16)) break;
        const found = collected.has(entry.id);
        const icon = found ? '✦' : '?';
        const nameText = found ? entry.name : t('ui.questLog.loreUndiscovered');
        const color = found ? UI_COLORS.text : UI_COLORS.faint;

        this.questLogPanel!.add(this.add.text(x + px(8), dy, `${icon}  ${nameText}`, {
          fontSize: fs(12), color, fontFamily: FONT, fontStyle: found ? 'bold' : 'normal',
        }));

        if (found) {
          // Show truncated lore text
          const truncText = entry.text.length > 40 ? entry.text.substring(0, 40) + '...' : entry.text;
          const tt = this.add.text(x + px(24), dy + px(16), truncText, {
            fontSize: fs(10), color: UI_COLORS.muted, fontFamily: FONT,
            wordWrap: { width: colW - px(28), useAdvancedWrap: true }, maxLines: 2,
          });
          this.questLogPanel!.add(tt);
          dy += px(18) + tt.height + px(2);
        } else {
          dy += px(19);
        }
      }

      colY[c] = dy + px(12);
    });

    // No lore message
    if (collected.size === 0) {
      this.questLogPanel.add(this.add.text(pw / 2, ph - px(40), t('ui.questLog.noLore'), {
        fontSize: fs(13), color: UI_COLORS.dim, fontFamily: FONT,
      }).setOrigin(0.5, 0));
    }
  }

  /** Create the unified opaque panel frame (carved iron, gold filigree, header band). */
  private createPanelBg(pw: number, ph: number, header: number = px(PANEL_STYLE.header.height), opts: { accent?: number; gem?: number } = {}): Phaser.GameObjects.Image {
    return addFrame(this, 0, 0, pw, ph, { variant: 'panel', header, accent: opts.accent, gem: opts.gem });
  }

  /** Create a unified panel header title (centred in the header band, flanked by gold flourishes). */
  private createPanelTitle(pw: number, title: string, color: string = PANEL_STYLE.header.color): Phaser.GameObjects.Container {
    const cy = px(PANEL_STYLE.header.height) / 2 + px(1);
    const c = this.add.container(0, 0);
    const text = this.add.text(pw / 2, cy, title, {
      fontSize: fs(PANEL_STYLE.header.fontSize), color,
      fontFamily: PANEL_STYLE.header.font, fontStyle: 'bold',
      stroke: '#120b04', strokeThickness: Math.round(3 * DPR),
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5, 0.5);
    c.add(addTitleFlourishes(this, pw / 2, cy, text.width));
    c.add(text);
    return c;
  }

  /** Create a unified close button (iron medallion) at the header's top-right. */
  private createPanelCloseBtn(pw: number, onClose: () => void): Phaser.GameObjects.Image {
    return addCloseButton(this, pw - px(22), px(PANEL_STYLE.header.height) / 2 + px(1), onClose);
  }

  /** Framed button (centre at x, y). */
  private makeButton(x: number, y: number, w: number, h: number, label: string, onClick: (pointer: Phaser.Input.Pointer) => void, opts: Omit<ButtonOptions, 'onClick'> = {}): UiButton {
    return addButton(this, x, y, w, h, btnLabel(label), { fontSize: 12, ...opts, onClick });
  }

  /**
   * Item slot: quality-framed well + item icon (+ stack count). Returns the
   * interactive slot image (for hover/click wiring) and all created objects.
   */
  private createItemSlot(cx: number, cy: number, size: number, item: ItemInstance | null, opts: { interactive?: boolean; showCount?: boolean } = {}): { slot: Phaser.GameObjects.Image; objects: Phaser.GameObjects.GameObject[] } {
    const quality = item ? item.quality : null;
    const slot = addSlot(this, cx, cy, size, quality);
    const objects: Phaser.GameObjects.GameObject[] = [slot];
    if (item) {
      const iconKey = ensureItemIconFor(this, item);
      const iconSize = size - px(6);
      objects.push(this.add.image(cx, cy, iconKey).setDisplaySize(iconSize, iconSize));
      if (opts.showCount !== false && item.quantity > 1) {
        objects.push(this.add.text(cx + size / 2 - px(3), cy + size / 2 - px(2), `${item.quantity}`, {
          fontSize: fs(11), color: '#ffe7a0', fontFamily: FONT, fontStyle: 'bold',
          stroke: '#000000', strokeThickness: Math.round(3 * DPR),
        }).setOrigin(1, 1));
      }
    }
    if (opts.interactive !== false) {
      slot.setInteractive({ useHandCursor: true });
      wireSlotHover(this, slot, size, quality);
    }
    return { slot, objects };
  }

  /** Create a unified tooltip container with PANEL_STYLE tooltip styling. */
  private createTooltipContainer(
    screenX: number, screenY: number, tipW: number, tipH: number, borderColor?: number,
  ): { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Image } {
    let tx = screenX + px(16);
    let ty = screenY - px(10);
    if (tx + tipW > W - px(4)) tx = screenX - tipW - px(16);
    if (ty + tipH > H - px(4)) ty = H - tipH - px(4);
    if (ty < px(4)) ty = px(4);
    if (tx < px(4)) tx = px(4);

    const container = this.add.container(tx, ty).setDepth(PANEL_STYLE.depth.tooltip);
    const bg = addFrame(this, 0, 0, tipW, tipH, { variant: 'tooltip', accent: borderColor ?? PANEL_STYLE.tooltip.border.color });
    container.add(bg);
    return { container, bg };
  }

  /** Modal backdrop: dims + vignettes the world, catches outside clicks. */
  private createBackdrop(alpha = 1): Phaser.GameObjects.Image {
    return this.add.image(W / 2, H / 2, backdropTexture(this, W, H))
      .setDisplaySize(W, H).setAlpha(alpha).setInteractive().setDepth(PANEL_STYLE.depth.backdrop);
  }

  /** Animate a panel container opening with scale + alpha pop-in */
  private animatePanelOpen(panel: Phaser.GameObjects.Container): void {
    panel.setScale(0.92, 0.92).setAlpha(0);
    this.tweens.add({
      targets: panel,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });
  }

  private closeAllPanels(): void {
    if (this.inventoryPanel) { this.inventoryPanel.destroy(); this.inventoryPanel = null; }
    if (this.shopPanel) { const closedNpcId = this.shopNpcId; this.shopPanel.destroy(); this.shopPanel = null; this.shopNpcId = null; EventBus.emit(GameEvents.SHOP_CLOSE, { npcId: closedNpcId }); }
    if (this.mapPanel) { this.mapPanel.destroy(); this.mapPanel = null; }
    if (this.skillPanel) {
      if (this.skillTreeWheelHandler) { this.input.off('wheel', this.skillTreeWheelHandler); this.skillTreeWheelHandler = null; }
      this.skillPanel.destroy(); this.skillPanel = null;
    }
    if (this.skillTooltip) { this.skillTooltip.destroy(); this.skillTooltip = null; }
    if (this.charPanel) { this.charPanel.destroy(); this.charPanel = null; }
    if (this.homesteadPanel) { this.homesteadPanel.destroy(); this.homesteadPanel = null; }
    if (this.questLogPanel) { this.questLogPanel.destroy(); this.questLogPanel = null; }
    if (this.companionPanel) { this.companionPanel.destroy(); this.companionPanel = null; }
    if (this.socketPanel) { this.socketPanel.destroy(); this.socketPanel = null; this.socketPanelSlot = null; }
    if (this.achievementPanel) { this.achievementPanel.destroy(); this.achievementPanel = null; }
    if (this.loreTextPanel) { this.loreTextPanel.destroy(); this.loreTextPanel = null; }
    if (this.loreTextBackdrop) { this.loreTextBackdrop.destroy(); this.loreTextBackdrop = null; }
    if (this.audioPanel) {
      this.cleanupAudioPanelInputHandlers();
      this.audioPanel.destroy();
      this.audioPanel = null;
    }
    this.hideItemTooltip();
    this.hideContextPopup();
    this.closeDialogue();
    this.closeQuestCard();
  }  private getQualityColorNum(quality: string): number {
    switch (quality) {
      case 'magic': return 0x2471a3;
      case 'rare': return 0xc0934a;
      case 'legendary': return 0xd35400;
      case 'set': return 0x1e8449;
      default: return 0x222233;
    }
  }

  private getQualityTextColor(quality: string): string {
    switch (quality) {
      case 'magic': return '#5dade2';
      case 'rare': return '#f1c40f';
      case 'legendary': return '#e67e22';
      case 'set': return '#2ecc71';
      default: return '#e0d8cc';
    }
  }

  shutdown(): void {
    this.closeAllPanels();
    this.cleanupAudioPanelInputHandlers();
    this.subscriptions.dispose();
    this.skillSlots = [];
    this.skillCooldownOverlays = [];
    this.skillCooldownTexts = [];
    this.skillReadyFlash = [];
    this.skillCdLastFrac = [];
    this.skillCdActive = [];
    this.lootNotices = [];
    this.logTexts = [];
    this.questTrackerTexts = [];
    this.questTrackerExpanded = new Set();
    this.questTrackerScrollOffset = 0;
    this.questTrackerState = null;
    this.questTrackerBg = null;
    this.questTrackerScrollText = null;
    this.nextMinimapRefreshAt = 0;
    this.nextQuestTrackerRefreshAt = 0;
    this.lastQuestTrackerSignature = '';
  }

  /** Per-frame HUD sync: only cheap property updates (no static redraws). */
  update(time: number, delta: number = 16): void {
    if (!this.player) return;
    const orbBottom = HUD.orbY + GLOBE_R;
    const orbSpan = GLOBE_R * 2;
    const drift = delta * 0.012;

    const hpR = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    this.hpLevel += (hpR - this.hpLevel) * 0.15;
    this.hpBar.y = orbBottom - orbSpan * this.hpLevel - this.orbSurfaceOffset;
    this.hpBar.tilePositionX += drift;
    const hpText = `${Math.ceil(this.player.hp)}/${this.player.maxHp}`;
    if (this.hpText.text !== hpText) this.hpText.setText(hpText);
    if (hpR < 0.3 && hpR > 0) {
      const pulse = 0.6 + Math.sin(time * 0.008) * 0.4;
      this.hpBar.alpha = pulse;
    } else {
      this.hpBar.alpha = 1;
    }

    const manaR = Phaser.Math.Clamp(this.player.mana / this.player.maxMana, 0, 1);
    this.manaLevel += (manaR - this.manaLevel) * 0.15;
    this.manaBar.y = orbBottom - orbSpan * this.manaLevel - this.orbSurfaceOffset;
    this.manaBar.tilePositionX -= drift * 0.8;
    const manaText = `${Math.ceil(this.player.mana)}/${this.player.maxMana}`;
    if (this.manaText.text !== manaText) this.manaText.setText(manaText);

    const spiritRatio = Phaser.Math.Clamp(this.player.spirit.ratio, 0, 1);
    const spiritWidth = Math.round(HUD.spiritW * spiritRatio);
    if (spiritWidth !== this.spiritShown) {
      this.spiritShown = spiritWidth;
      this.spiritBar.setCrop(0, 0, spiritWidth, HUD.spiritH);
    }
    this.spiritBar.alpha = this.player.spirit.isResonating
      ? 0.82 + Math.sin(time * 0.012) * 0.18
      : 1;
    const spiritText = `${Math.floor(this.player.spirit.value)}/${this.player.spirit.maxValue}`;
    if (this.spiritText.text !== spiritText) this.spiritText.setText(spiritText);
    const resonanceText = this.player.spirit.isResonating
      ? t('ui.hud.resonance', {
        seconds: (this.player.spirit.resonanceRemainingMs / 1000).toFixed(1),
      })
      : '';
    if (this.resonanceText.text !== resonanceText) this.resonanceText.setText(resonanceText);
    if (this.resonanceText.visible !== this.player.spirit.isResonating) {
      this.resonanceText.setVisible(this.player.spirit.isResonating);
    }

    const dodgeRemaining = this.zone.getDodgeCooldownRemaining();
    const dodgeReady = dodgeRemaining <= 0;
    const dodgeText = dodgeReady
      ? t('ui.hud.dodgeReady')
      : t('ui.hud.dodgeCooldown', { seconds: (dodgeRemaining / 1000).toFixed(1) });
    if (this.dodgeText.text !== dodgeText) this.dodgeText.setText(dodgeText);
    const dodgeColor = dodgeReady ? '#9bd7ff' : '#778899';
    if (this.dodgeText.style.color !== dodgeColor) {
      this.dodgeText.setColor(dodgeColor);
      this.dodgeDot.setFillStyle(dodgeReady ? 0x9bd7ff : 0x3a4450);
    }

    // Target frame HP (sampled, not every frame)
    if (this.currentTargetId && time >= this.nextTargetRefreshAt) {
      this.nextTargetRefreshAt = time + 100;
      const monsters = (this.zone as unknown as { monsters?: { id: string; hp: number; maxHp: number }[] }).monsters;
      const m = monsters?.find(mm => mm.id === this.currentTargetId);
      const ratio = m && m.maxHp > 0 ? Phaser.Math.Clamp(m.hp / m.maxHp, 0, 1) : 0;
      const wpx = Math.round(this.targetHpW * ratio);
      if (wpx !== this.targetHpShown) {
        this.targetHpShown = wpx;
        this.targetHpFill.setCrop(0, 0, wpx, px(8));
      }
    }

    const expN = this.player.expToNextLevel();
    const expW = Math.round(HUD.expW * Phaser.Math.Clamp(this.player.exp / expN, 0, 1));
    if (expW !== this.expShown) {
      this.expShown = expW;
      this.expBar.setCrop(0, 0, expW, HUD.expH);
    }
    const levelText = `Lv.${this.player.level}  (${this.player.exp}/${expN})`;
    if (this.levelText.text !== levelText) this.levelText.setText(levelText);
    const goldText = `${this.player.gold}`;
    if (this.goldText.text !== goldText) this.goldText.setText(goldText);
    const autoCombatText = this.player.autoCombat ? t('ui.hud.autoCombat.on') : t('ui.hud.autoCombat.off');
    const autoCombatColor = this.player.autoCombat ? '#8ff07a' : '#b0a8b4';
    if (this.autoCombatText.text !== autoCombatText) this.autoCombatText.setText(autoCombatText);
    if (this.autoCombatText.style.color !== autoCombatColor) this.autoCombatText.setColor(autoCombatColor);

    // Auto-loot button update
    const alLabels: Record<string, string> = { off: t('ui.hud.autoLoot.off'), all: t('ui.hud.autoLoot.all'), magic: t('ui.hud.autoLoot.magic'), rare: t('ui.hud.autoLoot.rare'), legendary: t('ui.hud.autoLoot.legendary') };
    const alColors: Record<string, string> = { off: '#b0a8b4', all: '#e0d8cc', magic: QUALITY_TEXT.magic, rare: QUALITY_TEXT.rare, legendary: QUALITY_TEXT.legendary };
    const autoLootText = alLabels[this.player.autoLootMode] ?? t('ui.hud.autoLoot.off');
    const autoLootColor = alColors[this.player.autoLootMode] ?? '#b0a8b4';
    if (this.autoLootText.text !== autoLootText) this.autoLootText.setText(autoLootText);
    if (this.autoLootText.style.color !== autoLootColor) this.autoLootText.setColor(autoLootColor);

    if (this.zone && (this.zone as any).currentMapId) {
      const map = AllMaps[(this.zone as any).currentMapId] ?? (this.zone as any).mapData;
      const zoneName = map ? getZoneName((this.zone as any).currentMapId, map.name) : '';
      if (map && this.zoneLabel.text !== zoneName) this.zoneLabel.setText(zoneName);
    }

    const skills = this.getSkillLoadout();
    for (let i = 0; i < Math.min(skills.length, this.skillCooldownOverlays.length); i++) {
      const cd = this.player.skillCooldowns.get(skills[i].id) ?? 0;
      const remaining = cd - time;
      const onCd = remaining > 0;
      const overlay = this.skillCooldownOverlays[i];
      const cdText = this.skillCooldownTexts[i];
      if (onCd) {
        const totalCd = getSkillCooldown(skills[i], this.player.getSkillLevel(skills[i].id));
        const frac = Phaser.Math.Clamp(remaining / Math.max(1, totalCd), 0, 1);
        if (Math.abs(frac - this.skillCdLastFrac[i]) > 0.004) {
          this.skillCdLastFrac[i] = frac;
          this.drawCooldownSweep(overlay, HUD.slot, frac);
        }
        const secs = Math.ceil(remaining / 1000);
        if (cdText?.active) {
          if (!cdText.visible) cdText.setVisible(true);
          const nextText = `${secs}`;
          if (cdText.text !== nextText) cdText.setText(nextText);
        }
        this.skillCdActive[i] = true;
      } else {
        if (this.skillCdActive[i]) {
          this.skillCdActive[i] = false;
          this.skillCdLastFrac[i] = -1;
          overlay.clear();
          const flash = this.skillReadyFlash[i];
          if (flash?.active) {
            flash.setAlpha(0.55);
            this.tweens.add({ targets: flash, alpha: 0, duration: 320, ease: 'Quad.easeOut' });
          }
        }
        if (cdText?.active && cdText.visible) cdText.setVisible(false);
      }
    }

    if (time >= this.nextMinimapRefreshAt) {
      this.nextMinimapRefreshAt = time + 250;
      this.updateMinimap();
    }

    if (this.zone?.questSystem && time >= this.nextQuestTrackerRefreshAt) {
      this.nextQuestTrackerRefreshAt = time + 250;
      this.refreshQuestTracker();
    }
  }

  /** Radial cooldown sweep clipped to the square slot (remaining fraction darkened). */
  private drawCooldownSweep(g: Phaser.GameObjects.Graphics, size: number, frac: number): void {
    g.clear();
    if (frac <= 0) return;
    const half = size / 2 - px(3);
    const proj = (a: number) => {
      const c = Math.cos(a), sn = Math.sin(a);
      const m = Math.max(Math.abs(c), Math.abs(sn));
      return { x: (c / m) * half, y: (sn / m) * half };
    };
    const start = -Math.PI / 2;
    const a0 = start + (1 - frac) * Math.PI * 2;
    const a1 = start + Math.PI * 2;
    const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (let a = a0; a < a1; a += 0.1) pts.push(proj(a));
    pts.push(proj(a1));
    g.fillStyle(0x000000, 0.66);
    g.fillPoints(pts, true);
    const hand = proj(a0);
    g.lineStyle(px(1.5), 0xffd98a, 0.85);
    g.lineBetween(0, 0, hand.x, hand.y);
  }

  private refreshQuestTracker(): void {
    if (!this.zone?.questSystem) return;

    const active = this.zone.questSystem.getActiveQuests();
    const state = buildTrackerState(active);
    this.questTrackerState = state;

    // Build signature including expanded state for change detection
    const expandedSig = [...this.questTrackerExpanded].sort().join(',');
    const signature = buildTrackerSignature(state) + '|E:' + expandedSig;
    if (signature === this.lastQuestTrackerSignature) return;
    this.lastQuestTrackerSignature = signature;

    // --- Render tracker entries ---
    let textIdx = 0;
    let y = px(18); // Start below header

    for (let qi = 0; qi < state.entries.length; qi++) {
      const entry = state.entries[qi];
      const isExpanded = this.questTrackerExpanded.has(entry.questId);

      // Quest title line
      const tag = entry.category === 'main' ? t('ui.questTracker.mainTag') : t('ui.questTracker.sideTag');
      const completionMark = entry.isCompleted ? ' ✓' : '';
      const titleText = `${tag} ${entry.name}${completionMark}`;

      let titleObj = this.questTrackerTexts[textIdx];
      if (!titleObj) {
        titleObj = this.add.text(0, 0, '', { fontFamily: FONT }).setOrigin(0, 0);
        // Touch-friendly hit area: minimum px(22) height (44px physical at DPR=2)
        titleObj.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, px(200), px(22)),
          Phaser.Geom.Rectangle.Contains,
        );
        titleObj.input!.cursor = 'pointer';
        const idx = textIdx;
        titleObj.on('pointerdown', () => {
          // Find the quest ID from the text's data
          const qid = titleObj.getData('questId') as string;
          if (qid) {
            if (this.questTrackerExpanded.has(qid)) {
              this.questTrackerExpanded.delete(qid);
            } else {
              this.questTrackerExpanded.add(qid);
            }
            this.lastQuestTrackerSignature = ''; // force refresh
          }
        });
        this.questTracker.add(titleObj);
        this.questTrackerTexts.push(titleObj);
      }
      titleObj.setVisible(true);
      titleObj.setText(titleText);
      titleObj.setY(y);
      titleObj.setData('questId', entry.questId);
      titleObj.setFontSize(fs(12));
      titleObj.setFontStyle('bold');
      // Gold text for completed, gold for main, muted for side
      if (entry.isCompleted) {
        titleObj.setColor('#f1c40f');
      } else {
        titleObj.setColor(entry.category === 'main' ? '#e8c252' : '#a89060');
      }
      textIdx++;
      y += px(17);

      // Compact progress summary (always shown below title)
      let summaryObj = this.questTrackerTexts[textIdx];
      if (!summaryObj) {
        summaryObj = this.add.text(0, 0, '', { fontFamily: FONT }).setOrigin(0, 0);
        this.questTracker.add(summaryObj);
        this.questTrackerTexts.push(summaryObj);
      }
      summaryObj.setVisible(true);
      summaryObj.setText(`  ${entry.progressSummary}`);
      summaryObj.setY(y);
      summaryObj.setFontSize(fs(10));
      summaryObj.setFontStyle('');
      summaryObj.setColor(entry.isCompleted ? '#f1c40f' : '#aaaaaa');
      textIdx++;
      y += px(14);

      // Expanded: show individual objective lines
      if (isExpanded && entry.objectiveLines.length > 0) {
        for (const objLine of entry.objectiveLines) {
          let objObj = this.questTrackerTexts[textIdx];
          if (!objObj) {
            objObj = this.add.text(0, 0, '', { fontFamily: FONT }).setOrigin(0, 0);
            this.questTracker.add(objObj);
            this.questTrackerTexts.push(objObj);
          }
          objObj.setVisible(true);
          objObj.setText(`    ${objLine.label} ${objLine.progress}`);
          objObj.setY(y);
          objObj.setFontSize(fs(9));
          objObj.setFontStyle('');
          objObj.setColor(objLine.done ? '#66aa66' : '#888888');
          textIdx++;
          y += px(13);
        }
      }

      // Small gap between quests
      y += px(3);
    }

    // Scroll indicator
    if (state.hasMore && this.questTrackerScrollText) {
      const remaining = state.totalCount - state.visibleCount;
      this.questTrackerScrollText.setText(t('ui.questTracker.scrollIndicator', { count: String(remaining) }));
      this.questTrackerScrollText.setY(y);
      this.questTrackerScrollText.setVisible(true);
      y += px(14);
    } else if (this.questTrackerScrollText) {
      this.questTrackerScrollText.setVisible(false);
    }

    // Hide unused text objects
    for (let i = textIdx; i < this.questTrackerTexts.length; i++) {
      if (this.questTrackerTexts[i].visible) this.questTrackerTexts[i].setVisible(false);
    }

    // Update background size
    if (this.questTrackerBg) {
      if (state.entries.length > 0) {
        const bgH = Math.ceil((y + px(12)) / px(8)) * px(8);
        this.questTrackerBg.setVisible(true);
        this.questTracker.setVisible(true);
        this.questTrackerBg.setTexture(frameTextureKey(this, px(218), bgH, 0.9));
        this.questTrackerBg.setPosition(this.questTracker.x - px(9) - px(8), this.questTracker.y - px(7) - px(8));
      } else {
        this.questTrackerBg.setVisible(false);
        this.questTracker.setVisible(false);
      }
    }
  }
}
