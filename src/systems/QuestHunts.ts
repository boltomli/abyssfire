/**
 * QuestHunts — named quest monsters (bounties, lair beasts, ambushers).
 *
 * Pure helpers: which hunts should be in the world right now, and the
 * monster definition a hunt spawns as. ZoneScene does the actual spawning.
 */
import type { MonsterDefinition, QuestDefinition, QuestHunt, QuestProgress } from '../data/types';

export interface OpenQuest {
  quest: QuestDefinition;
  progress: QuestProgress;
}

/** Index of the kill objective that targets this hunt, or -1. */
export function huntObjectiveIndex(quest: QuestDefinition, hunt: QuestHunt): number {
  return quest.objectives.findIndex(o => o.type === 'kill' && o.targetId === hunt.huntId);
}

/** True when the hunt's target is still owed and (if gated) has been tracked down. */
export function isHuntDue(quest: QuestDefinition, progress: QuestProgress, hunt: QuestHunt): boolean {
  if (progress.status !== 'active') return false;
  const idx = huntObjectiveIndex(quest, hunt);
  if (idx < 0) return false;
  const obj = quest.objectives[idx];
  if ((progress.objectives[idx]?.current ?? 0) >= obj.required) return false;
  if (hunt.revealAfterPrevious) {
    for (let i = 0; i < idx; i++) {
      if ((progress.objectives[i]?.current ?? 0) < quest.objectives[i].required) return false;
    }
  }
  return true;
}

/** Hunts that should be alive in `zoneId` but are not in `present`. */
export function huntsToSpawn(open: OpenQuest[], zoneId: string, present: ReadonlySet<string>): { quest: QuestDefinition; hunt: QuestHunt }[] {
  const out: { quest: QuestDefinition; hunt: QuestHunt }[] = [];
  for (const { quest, progress } of open) {
    if (quest.zone !== zoneId || !quest.hunts) continue;
    for (const hunt of quest.hunts) {
      if (present.has(hunt.huntId)) continue;
      if (isHuntDue(quest, progress, hunt)) out.push({ quest, hunt });
    }
  }
  return out;
}

/** The monster a hunt spawns as: the base monster, renamed, tougher and elite. */
export function makeHuntDefinition(base: MonsterDefinition, hunt: QuestHunt, name: string): MonsterDefinition {
  const hpMul = hunt.hpMul ?? 4;
  const dmgMul = hunt.dmgMul ?? 1.5;
  return {
    ...base,
    id: hunt.huntId,
    name,
    hp: Math.round(base.hp * hpMul),
    damage: Math.round(base.damage * dmgMul),
    defense: Math.round(base.defense * 1.2),
    expReward: Math.round(base.expReward * Math.max(3, hpMul)),
    goldReward: [base.goldReward[0] * 3, base.goldReward[1] * 3],
    aggroRange: Math.max(base.aggroRange, 7),
    elite: true,
    // Mini-boss loot floor: at least one magic+ piece.
    isMiniBoss: true,
  };
}
