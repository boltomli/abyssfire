/**
 * QuestWorld — the in-world side of quests: gatherable quest nodes, quest item
 * pickups that fly to the player, and the guide arrow around the player that
 * points at the tracked quest's next step.
 */
import Phaser from 'phaser';
import { NPCDefinitions } from '../data/npcs';
import type { MapData, QuestObjective } from '../data/types';
import { ensureQuestItemIcon, type QuestItemKind } from '../graphics/icons/QuestItemIcons';
import { FxEngine } from '../graphics/vfx/FxEngine';
import { tileToWorld } from '../utils/IsometricUtils';
import { EventBus, GameEvents } from '../utils/EventBus';
import { computeGuideTarget, type GuideTarget, type GuideWorld, type TilePoint } from './QuestGuide';
import type { QuestSystem } from './QuestSystem';
import { isCollectObjective, resolveGatherSpots } from './QuestRewards';
import { DPR } from '../config';
import { t } from '../i18n';
import { getQuestTargetName } from '../i18n/gameAccessors';

interface WorldEntity { tileCol: number; tileRow: number }
interface WorldMonster extends WorldEntity { definition: { id: string }; isAlive(): boolean }
interface WorldNpc extends WorldEntity { definition: { id: string } }

export interface QuestWorldDeps {
  scene: Phaser.Scene;
  quests: QuestSystem;
  mapId: string;
  mapData: MapData;
  player: () => WorldEntity & { sprite: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth };
  monsters: () => readonly WorldMonster[];
  npcs: () => readonly WorldNpc[];
  /** Tile of the escorted NPC, if one is out. */
  escortTile?: () => TilePoint | null;
}

interface GatherNode {
  key: string;
  questId: string;
  objectiveIndex: number;
  spotIndex: number;
  col: number;
  row: number;
  container: Phaser.GameObjects.Container;
}

/** Gather radius in tiles. */
const GATHER_RANGE = 1.3;
/** A clue is examined from this close (tiles). */
const CLUE_RANGE = 2;
const CLUE_KEY = 'quest_clue_mark';

interface ClueMark {
  key: string;
  questId: string;
  objectiveIndex: number;
  col: number;
  row: number;
  container: Phaser.GameObjects.Container;
}

/** Nearest walkable tile to (col, row), searching outward ring by ring. */
export function nearestWalkable(col: number, row: number, walkable: (c: number, r: number) => boolean, maxRing = 8): TilePoint | null {
  if (walkable(col, row)) return { col, row };
  for (let ring = 1; ring <= maxRing; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        if (walkable(col + dc, row + dr)) return { col: col + dc, row: row + dr };
      }
    }
  }
  return null;
}
/** The guide hides when the target is this close (tiles). */
const GUIDE_NEAR = 2.5;
const GUIDE_RADIUS = 44;
const ARROW_KEY = 'quest_guide_arrow';

/** Default look for known quest materials when an objective sets no itemKind. */
const KIND_BY_TARGET: Record<string, QuestItemKind> = {
  mat_slime_gel: 'gel', mat_herb: 'herb', mat_pendant: 'pendant', mat_mushroom: 'mushroom',
  mat_ancient_relic: 'relic', mat_moonlight_herb: 'moon_herb', mat_dwarf_ingot: 'ingot',
  mat_rune_fragment: 'rune', mat_mithril_core: 'mithril', mat_crystal: 'crystal',
  mat_dragon_scale: 'scale', mat_water: 'water', mat_venom: 'venom', mat_demon_essence: 'essence',
  mat_seal_fragment: 'seal', mat_void_crystal: 'void_crystal', mat_wolf_pelt: 'pelt',
  mat_spider_silk: 'silk', mat_fang: 'fang', mat_ash: 'ash', mat_bone: 'bone', mat_letter: 'letter',
};

export function questItemKindOf(obj: QuestObjective): QuestItemKind {
  return (obj.itemKind as QuestItemKind | undefined) ?? KIND_BY_TARGET[obj.targetId] ?? 'relic';
}

/** Quest id → NPC who offers it. */
const GIVER_BY_QUEST = new Map<string, string>();
for (const def of Object.values(NPCDefinitions)) {
  for (const q of def.quests ?? []) if (!GIVER_BY_QUEST.has(q)) GIVER_BY_QUEST.set(q, def.id);
}
export function questGiverOf(questId: string): string | null {
  return GIVER_BY_QUEST.get(questId) ?? null;
}

export class QuestWorld {
  private readonly d: QuestWorldDeps;
  private readonly nodes = new Map<string, GatherNode>();
  private readonly clues = new Map<string, ClueMark>();
  /** Spots already gathered, per `${questId}:${objectiveIndex}`. */
  private readonly gathered = new Map<string, Set<number>>();
  private arrow: Phaser.GameObjects.Image | null = null;
  private guideTimer = 0;
  private pulse = 0;
  /** Where the guide currently points (read by the minimap). */
  guideTarget: GuideTarget | null = null;
  private readonly onQuestChanged = (): void => { this.sync(); this.guideTimer = 0; };

  constructor(deps: QuestWorldDeps) {
    this.d = deps;
    EventBus.on(GameEvents.QUEST_ACCEPTED, this.onQuestChanged);
    EventBus.on(GameEvents.QUEST_TURNED_IN, this.onQuestChanged);
    EventBus.on(GameEvents.QUEST_FAILED, this.onQuestChanged);
    EventBus.on(GameEvents.QUEST_COMPLETED, this.onQuestChanged);
    EventBus.on(GameEvents.QUEST_TRACKED_CHANGED, this.onQuestChanged);
    this.sync();
  }

  // ── Gather nodes ────────────────────────────────────────────

  /** Create/remove gather nodes to match the active quests in this zone. */
  sync(): void {
    const wanted = new Set<string>();
    for (const { quest, progress } of this.d.quests.getActiveQuests()) {
      if (progress.status !== 'active' || quest.zone !== this.d.mapId) continue;
      quest.objectives.forEach((obj, i) => {
        if (!isCollectObjective(obj) || obj.source?.kind !== 'gather') return;
        if ((progress.objectives[i]?.current ?? 0) >= obj.required) return;
        const done = this.gathered.get(`${quest.id}:${i}`);
        this.spotsFor(quest.id, i, obj.source.area, obj.source.count).forEach((spot, s) => {
          if (done?.has(s)) return;
          const key = `${quest.id}:${i}:${s}`;
          wanted.add(key);
          if (!this.nodes.has(key)) this.nodes.set(key, this.createNode(key, quest.id, i, s, spot, questItemKindOf(obj)));
        });
      });
    }
    for (const [key, node] of this.nodes) {
      if (!wanted.has(key)) { node.container.destroy(); this.nodes.delete(key); }
    }
    this.syncClues();
  }

  // ── Clues ───────────────────────────────────────────────────

  /** One glinting mark per unexamined clue of the active quests in this zone. */
  private syncClues(): void {
    const wanted = new Set<string>();
    const { collisions } = this.d.mapData;
    for (const { quest, progress } of this.d.quests.getActiveQuests()) {
      if (progress.status !== 'active' || quest.zone !== this.d.mapId) continue;
      quest.objectives.forEach((obj, i) => {
        if (obj.type !== 'investigate_clue' || !obj.location) return;
        if ((progress.objectives[i]?.current ?? 0) >= obj.required) return;
        const key = `${quest.id}:${i}`;
        wanted.add(key);
        if (this.clues.has(key)) return;
        const spot = nearestWalkable(obj.location.col, obj.location.row, (c, r) => !!collisions[r]?.[c]);
        if (spot) this.clues.set(key, this.createClue(key, quest.id, i, spot));
      });
    }
    for (const [key, clue] of this.clues) {
      if (!wanted.has(key)) { clue.container.destroy(); this.clues.delete(key); }
    }
  }

  /** Where each open clue actually sits (it may be nudged off a wall). */
  clueTile(questId: string, objectiveIndex: number): TilePoint | null {
    const c = this.clues.get(`${questId}:${objectiveIndex}`);
    return c ? { col: c.col, row: c.row } : null;
  }

  private ensureClueTexture(): void {
    const { scene } = this.d;
    if (scene.textures.exists(CLUE_KEY)) return;
    // A cel-shaded magnifying glass: dark ink outline, brass rim, pale lens.
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const x = c.getContext('2d')!;
    x.lineCap = 'round';
    x.strokeStyle = '#1c1208'; x.lineWidth = 12;
    x.beginPath(); x.moveTo(38, 38); x.lineTo(56, 56); x.stroke();
    x.strokeStyle = '#7a4a22'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(38, 38); x.lineTo(55, 55); x.stroke();
    x.beginPath(); x.arc(26, 26, 19, 0, Math.PI * 2);
    x.fillStyle = '#1c1208'; x.fill();
    x.beginPath(); x.arc(26, 26, 15.5, 0, Math.PI * 2);
    x.fillStyle = '#e0b04a'; x.fill();
    x.beginPath(); x.arc(26, 26, 11.5, 0, Math.PI * 2);
    const g = x.createLinearGradient(14, 14, 38, 38);
    g.addColorStop(0, '#e9fbff'); g.addColorStop(1, '#7fc6e0');
    x.fillStyle = g; x.fill();
    x.beginPath(); x.ellipse(21, 20, 5, 3, -0.8, 0, Math.PI * 2);
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.fill();
    scene.textures.addCanvas(CLUE_KEY, c);
  }

  private createClue(key: string, questId: string, objectiveIndex: number, spot: TilePoint): ClueMark {
    const { scene } = this.d;
    this.ensureClueTexture();
    const w = tileToWorld(spot.col, spot.row);
    const ring = scene.add.image(0, 2, 'fx_glow').setTint(0x8fe0ff).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.7, 0.32).setAlpha(0.7);
    const icon = scene.add.image(0, -18, CLUE_KEY).setDisplaySize(26, 26);
    const container = scene.add.container(w.x, w.y, [ring, icon]).setDepth(w.y + 99);
    scene.tweens.add({ targets: icon, y: -24, angle: { from: -8, to: 8 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: ring, alpha: 0.25, scaleX: 0.9, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return { key, questId, objectiveIndex, col: spot.col, row: spot.row, container };
  }

  private examine(clue: ClueMark): void {
    const quest = this.d.quests.quests.get(clue.questId);
    const obj = quest?.objectives[clue.objectiveIndex];
    this.clues.delete(clue.key);
    const { scene } = this.d;
    const { x, y } = clue.container;
    scene.tweens.killTweensOf(clue.container.list);
    scene.tweens.add({ targets: clue.container, alpha: 0, y: y - 16, duration: 380, onComplete: () => clue.container.destroy() });
    this.burst(x, y - 18);
    if (!quest || !obj) return;
    const name = getQuestTargetName(obj.targetId, obj.targetName);
    const noteKey = `data.questClue.${obj.targetId}`;
    const note = t(noteKey);
    EventBus.emit(GameEvents.LOG_MESSAGE, { text: t('zone.quest.clueFound', { targetName: name }), type: 'system' });
    if (note !== noteKey) EventBus.emit(GameEvents.LOG_MESSAGE, { text: note, type: 'system' });
    // What the hero reads off the clue, floating above it for a moment.
    const text = scene.add.text(x, y - 44, note !== noteKey ? `${name}\n${note}` : name, {
      fontSize: `${Math.round(13 * DPR)}px`, color: '#d8f4ff', align: 'center',
      stroke: '#0b1620', strokeThickness: Math.round(3 * DPR),
      wordWrap: { width: 260 * DPR, useAdvancedWrap: true },
    }).setOrigin(0.5, 1).setDepth(5000).setScale(1 / DPR).setAlpha(0);
    scene.tweens.add({ targets: text, alpha: 1, y: y - 56, duration: 300, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: text, alpha: 0, y: y - 72, delay: 3600, duration: 600, onComplete: () => text.destroy() });
    this.d.quests.updateProgress('investigate_clue', obj.targetId);
  }

  private readonly spotCache = new Map<string, TilePoint[]>();

  private spotsFor(questId: string, i: number, area: { col: number; row: number; radius: number }, count: number): TilePoint[] {
    const key = `${questId}:${i}`;
    let spots = this.spotCache.get(key);
    if (!spots) {
      const { collisions } = this.d.mapData;
      spots = resolveGatherSpots(area, count, (c, r) => !!collisions[r]?.[c], key);
      this.spotCache.set(key, spots);
    }
    return spots;
  }

  private createNode(key: string, questId: string, objectiveIndex: number, spotIndex: number, spot: TilePoint, kind: QuestItemKind): GatherNode {
    const { scene } = this.d;
    const w = tileToWorld(spot.col, spot.row);
    const glow = scene.add.image(0, 2, 'fx_glow').setTint(0xffd98a).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.55, 0.26).setAlpha(0.75);
    const icon = scene.add.image(0, -14, ensureQuestItemIcon(scene, kind)).setDisplaySize(30, 30);
    const container = scene.add.container(w.x, w.y, [glow, icon]).setDepth(w.y + 99);
    scene.tweens.add({ targets: icon, y: -20, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (spotIndex * 173) % 900 });
    scene.tweens.add({ targets: glow, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return { key, questId, objectiveIndex, spotIndex, col: spot.col, row: spot.row, container };
  }

  private gather(node: GatherNode): void {
    const quest = this.d.quests.quests.get(node.questId);
    const obj = quest?.objectives[node.objectiveIndex];
    if (!quest || !obj) return;
    const k = `${node.questId}:${node.objectiveIndex}`;
    let set = this.gathered.get(k);
    if (!set) { set = new Set(); this.gathered.set(k, set); }
    set.add(node.spotIndex);
    this.nodes.delete(node.key);
    const icon = node.container.list[1] as Phaser.GameObjects.Image;
    this.burst(node.container.x, node.container.y - 14);
    this.d.scene.tweens.killTweensOf(icon);
    this.flyTo(icon, node.container, () => node.container.destroy());
    this.d.quests.updateProgress(obj.type === 'craft_collect' ? 'craft_collect' : 'collect', obj.targetId);
  }

  // ── Pickups ─────────────────────────────────────────────────

  /** A quest item pops out of (x, y) and flies into the player. */
  dropToPlayer(x: number, y: number, obj: QuestObjective): void {
    const { scene } = this.d;
    const icon = scene.add.image(x, y - 16, ensureQuestItemIcon(scene, questItemKindOf(obj)))
      .setDisplaySize(26, 26).setDepth(4400);
    // Hop up, then home in on the player.
    scene.tweens.add({
      targets: icon, y: y - 46, duration: 220, ease: 'Quad.easeOut',
      onComplete: () => this.flyTo(icon, icon, () => icon.destroy()),
    });
  }

  private flyTo(icon: Phaser.GameObjects.Image, host: { x: number; y: number }, done: () => void): void {
    const p = this.d.player().sprite;
    const startX = host.x + (host === icon ? 0 : icon.x);
    const startY = host.y + (host === icon ? 0 : icon.y);
    if (host !== icon) {
      // Re-parent visually: move the icon to world space for the flight.
      icon.setPosition(startX, startY);
      (host as Phaser.GameObjects.Container).remove(icon);
      this.d.scene.add.existing(icon);
      icon.setDepth(4400);
    }
    const s0x = icon.scaleX, s0y = icon.scaleY;
    const counter = { t: 0 };
    this.d.scene.tweens.add({
      targets: counter, t: 1, duration: 420, ease: 'Cubic.easeIn',
      onUpdate: () => {
        const tx = p.x, ty = p.y - 30;
        icon.setPosition(startX + (tx - startX) * counter.t, startY + (ty - startY) * counter.t - Math.sin(counter.t * Math.PI) * 18);
        icon.setScale(s0x * (1 - 0.45 * counter.t), s0y * (1 - 0.45 * counter.t));
      },
      onComplete: () => { this.burst(p.x, p.y - 30); done(); },
    });
  }

  private burst(x: number, y: number): void {
    const e = FxEngine.for(this.d.scene);
    e.spawn('fx_glow', x, y, 260).color(0xffe39a).scale(0.25, 0.6).fade(0.9, 0);
    for (let i = 0; i < 6; i++) {
      e.spawn('fx_spark', x, y, 380).color(0xfff1c0).scale(0.22, 0.05).fade(1, 0).polar((i / 6) * Math.PI * 2, 70, 0.6);
    }
  }

  // ── Guide arrow ─────────────────────────────────────────────

  private guideWorld(): GuideWorld {
    const player = this.d.player();
    return {
      player: { col: player.tileCol, row: player.tileRow },
      npcTile: (id) => {
        const npc = this.d.npcs().find(n => n.definition.id === id);
        return npc ? { col: npc.tileCol, row: npc.tileRow } : null;
      },
      monsters: (ids) => this.d.monsters()
        .filter(m => m.isAlive() && ids.includes(m.definition.id))
        .map(m => ({ col: m.tileCol, row: m.tileRow })),
      spawns: (ids) => this.d.mapData.spawns.filter(s => ids.includes(s.monsterId)).map(s => ({ col: s.col, row: s.row })),
      gatherSpots: (questId, i) => [...this.nodes.values()]
        .filter(n => n.questId === questId && n.objectiveIndex === i)
        .map(n => ({ col: n.col, row: n.row })),
      giverOf: questGiverOf,
      clueTile: (questId, i) => this.clueTile(questId, i),
      escortTile: () => this.d.escortTile?.() ?? null,
    };
  }

  private ensureArrowTexture(): void {
    const { scene } = this.d;
    if (scene.textures.exists(ARROW_KEY)) return;
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.translate(24, 24);
    x.beginPath();
    x.moveTo(18, 0); x.lineTo(-10, -14); x.lineTo(-4, 0); x.lineTo(-10, 14); x.closePath();
    x.lineJoin = 'round';
    x.lineWidth = 5; x.strokeStyle = '#2a1606'; x.stroke();
    const g = x.createLinearGradient(-10, -14, 12, 10);
    g.addColorStop(0, '#fff2b8'); g.addColorStop(0.5, '#ffcf4a'); g.addColorStop(1, '#d88a1a');
    x.fillStyle = g; x.fill();
    scene.textures.addCanvas(ARROW_KEY, c);
  }

  private updateGuide(delta: number): void {
    this.guideTimer -= delta;
    if (this.guideTimer <= 0) {
      this.guideTimer = 250;
      const guided = this.d.quests.getGuidedQuest(this.d.mapId);
      this.guideTarget = guided ? computeGuideTarget(guided.quest, guided.progress, this.guideWorld()) : null;
    }
    const player = this.d.player();
    const tgt = this.guideTarget;
    const near = !tgt || Math.hypot(tgt.col - player.tileCol, tgt.row - player.tileRow) < GUIDE_NEAR;
    if (near) { this.arrow?.setVisible(false); return; }
    if (!this.arrow) {
      this.ensureArrowTexture();
      this.arrow = this.d.scene.add.image(0, 0, ARROW_KEY).setScale(0.55);
    }
    const w = tileToWorld(tgt.col, tgt.row);
    const p = player.sprite;
    const ang = Math.atan2(w.y - p.y, w.x - p.x);
    this.pulse += delta / 1000;
    const r = GUIDE_RADIUS + Math.sin(this.pulse * 5) * 3;
    this.arrow.setVisible(true)
      .setPosition(p.x + Math.cos(ang) * r, p.y - 14 + Math.sin(ang) * r * 0.6)
      .setRotation(ang)
      .setAlpha(tgt.reason === 'turn_in' ? 0.95 : 0.8)
      .setTint(tgt.reason === 'turn_in' ? 0xffffff : 0xfff2d0)
      .setDepth(p.depth + 1);
  }

  // ── Frame ───────────────────────────────────────────────────

  update(delta: number): void {
    const player = this.d.player();
    for (const node of [...this.nodes.values()]) {
      if (Math.hypot(node.col - player.tileCol, node.row - player.tileRow) <= GATHER_RANGE) this.gather(node);
    }
    for (const clue of [...this.clues.values()]) {
      if (Math.hypot(clue.col - player.tileCol, clue.row - player.tileRow) <= CLUE_RANGE) this.examine(clue);
    }
    this.updateGuide(delta);
  }

  destroy(): void {
    EventBus.off(GameEvents.QUEST_ACCEPTED, this.onQuestChanged);
    EventBus.off(GameEvents.QUEST_TURNED_IN, this.onQuestChanged);
    EventBus.off(GameEvents.QUEST_FAILED, this.onQuestChanged);
    EventBus.off(GameEvents.QUEST_COMPLETED, this.onQuestChanged);
    EventBus.off(GameEvents.QUEST_TRACKED_CHANGED, this.onQuestChanged);
    for (const n of this.nodes.values()) n.container.destroy();
    this.nodes.clear();
    for (const c of this.clues.values()) c.container.destroy();
    this.clues.clear();
    this.arrow?.destroy();
    this.arrow = null;
  }
}
