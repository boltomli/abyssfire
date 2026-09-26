/**
 * QuestGuide — where the quest guide arrow should point.
 *
 * Pure (no Phaser): the scene supplies positions through `GuideWorld`, so the
 * routing rules are unit-testable.
 */
import type { QuestDefinition, QuestObjective, QuestProgress } from '../data/types';

export interface TilePoint { col: number; row: number }

export interface GuideWorld {
  /** Player tile. */
  player: TilePoint;
  /** Tile of an NPC standing in this zone, or null if it isn't here. */
  npcTile(npcId: string): TilePoint | null;
  /** Living monsters of the given ids in this zone. */
  monsters(ids: readonly string[]): TilePoint[];
  /** Spawn points of the given monster ids in this zone. */
  spawns(ids: readonly string[]): TilePoint[];
  /** Ungathered node tiles for an objective (gather sources only). */
  gatherSpots(questId: string, objectiveIndex: number): TilePoint[];
  /** NPC who gave this quest. */
  giverOf(questId: string): string | null;
  /** Where the escorted NPC is (null when none is out). */
  escortTile?(): TilePoint | null;
}

export type GuideReason = 'turn_in' | 'objective';

export interface GuideTarget extends TilePoint {
  reason: GuideReason;
  /** Objective index the guide is leading to (turn-in: -1). */
  objectiveIndex: number;
}

function nearest(from: TilePoint, pts: readonly TilePoint[]): TilePoint | null {
  let best: TilePoint | null = null;
  let bestD = Infinity;
  for (const p of pts) {
    const d = (p.col - from.col) ** 2 + (p.row - from.row) ** 2;
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}

/** Monster ids an objective is satisfied by (kill targets, or drop sources). */
export function objectiveMonsters(obj: QuestObjective): string[] {
  if (obj.type === 'kill') return [obj.targetId];
  if ((obj.type === 'collect' || obj.type === 'craft_collect') && obj.source?.kind === 'drop') return obj.source.monsters;
  return [];
}

function objectiveTarget(
  quest: QuestDefinition,
  obj: QuestObjective,
  index: number,
  world: GuideWorld,
): TilePoint | null {
  if (obj.type === 'escort') {
    // Fetch the charge first; once they're following, lead to the destination.
    const e = world.escortTile?.();
    if (e && Math.hypot(e.col - world.player.col, e.row - world.player.row) > 4) return e;
  }
  if (obj.location) return { col: obj.location.col, row: obj.location.row };
  switch (obj.type) {
    case 'talk':
      return world.npcTile(obj.targetId);
    case 'defend_wave':
      return quest.defendTarget ? { col: quest.defendTarget.col, row: quest.defendTarget.row } : null;
    case 'escort':
      return quest.escortNpc ? { col: quest.escortNpc.startCol, row: quest.escortNpc.startRow } : null;
    case 'craft_craft':
      return quest.craftPhases ? world.npcTile(quest.craftPhases.craftNpc) : null;
    case 'craft_deliver':
      return quest.craftPhases ? world.npcTile(quest.craftPhases.deliverNpc) : null;
    case 'collect':
    case 'craft_collect':
      if (obj.source?.kind === 'gather') {
        return nearest(world.player, world.gatherSpots(quest.id, index))
          ?? { col: obj.source.area.col, row: obj.source.area.row };
      }
      break;
    default:
      break;
  }
  const ids = objectiveMonsters(obj);
  if (ids.length === 0) return quest.questArea ? { col: quest.questArea.col, row: quest.questArea.row } : null;
  return nearest(world.player, world.monsters(ids))
    ?? nearest(world.player, world.spawns(ids))
    ?? (quest.questArea ? { col: quest.questArea.col, row: quest.questArea.row } : null);
}

/**
 * Next place to go for a quest: the giver once it is complete, otherwise the
 * nearest target of its first unfinished objective (craft quests follow their
 * collect → craft → deliver order because unfinished earlier phases come first).
 */
export function computeGuideTarget(
  quest: QuestDefinition,
  progress: QuestProgress,
  world: GuideWorld,
): GuideTarget | null {
  if (progress.status === 'completed') {
    const giver = world.giverOf(quest.id);
    const tile = giver ? world.npcTile(giver) : null;
    return tile ? { ...tile, reason: 'turn_in', objectiveIndex: -1 } : null;
  }
  if (progress.status !== 'active') return null;
  for (let i = 0; i < quest.objectives.length; i++) {
    const obj = quest.objectives[i];
    if ((progress.objectives[i]?.current ?? 0) >= obj.required) continue;
    const tile = objectiveTarget(quest, obj, i, world);
    if (tile) return { ...tile, reason: 'objective', objectiveIndex: i };
  }
  return null;
}
