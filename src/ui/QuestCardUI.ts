/**
 * QuestCardUI — Pure utility functions for the compact quest card.
 *
 * These functions assemble display data from QuestSystem / QuestDefinition
 * state.  They are free of Phaser dependencies so they can be unit-tested
 * with Vitest directly.
 */

import { QUEST_TYPE_LABELS } from '../systems/QuestSystem';
import type { QuestDefinition, QuestProgress, QuestReward, QuestObjective, QuestRewardChoice } from '../data/types';
import { t } from '../i18n';
import { getQuestDesc, getQuestName, getQuestStory, getQuestTargetName } from '../i18n/gameAccessors';

/**
 * Extended objective-type labels.
 *
 * QuestObjective.type can be a sub-type (e.g. 'defend_wave', 'craft_collect')
 * that doesn't appear directly in QUEST_TYPE_LABELS (which maps quest-level
 * types).  This lookup falls back through parent types so every objective
 * gets a readable Chinese label.
 */
/**
 * Get locale-aware extended objective-type labels.
 */
function getObjectiveTypeLabels(): Record<string, string> {
  return {
    ...QUEST_TYPE_LABELS,
    defend_wave: t('sys.quest.objType.defend_wave'),
    investigate_clue: t('sys.quest.objType.investigate_clue'),
    craft_collect: t('sys.quest.objType.craft_collect'),
    craft_craft: t('sys.quest.objType.craft_craft'),
    craft_deliver: t('sys.quest.objType.craft_deliver'),
  };
}

// ─── Display Types ──────────────────────────────────────────────

export interface QuestCardData {
  questId: string;
  name: string;
  description: string;
  typeBadge: string;             // Chinese badge, e.g. '猎杀'
  category: 'main' | 'side';
  objectives: QuestObjectiveDisplay[];
  rewards: QuestRewardDisplay;
  /** 'available' | 'completed' (ready for turn-in) | 'active' (in-progress, informational only) */
  cardAction: 'accept' | 'turn_in';
  /** Whether this NPC has a dialogue tree worth showing behind a lore button. */
  hasLore: boolean;
  /** What the NPC says at this moment (offer on accept, thanks on turn-in); '' if unwritten. */
  story: string;
  /** Labels of the pick-one equipment rewards, e.g. ['武器', '护甲']. */
  choiceLabels: string[];
}

export interface QuestObjectiveDisplay {
  label: string;       // e.g. '猎杀 绿色史莱姆'
  progress: string;    // e.g. '3/10'
  done: boolean;
}

export interface QuestRewardDisplay {
  exp: number;
  gold: number;
  items: string[];     // item display names (base names)
}

// ─── Quest Sorting & Prioritisation ─────────────────────────────

export interface NpcQuestEntry {
  quest: QuestDefinition;
  progress: QuestProgress | undefined;
  cardAction: 'accept' | 'turn_in';
}

/**
 * Gather and prioritise quests from an NPC.
 *
 * Turn-in quests come first, then available quests.
 * Active (in-progress, not yet completed) quests are excluded from the card
 * — the player already accepted them; the tracker handles visibility.
 */
export function gatherNpcQuests(
  npcQuestIds: string[],
  questMap: Map<string, QuestDefinition>,
  progressMap: Map<string, QuestProgress>,
  playerLevel: number,
): NpcQuestEntry[] {
  const turnIn: NpcQuestEntry[] = [];
  const available: NpcQuestEntry[] = [];

  for (const qid of npcQuestIds) {
    const quest = questMap.get(qid);
    if (!quest) continue;

    const prog = progressMap.get(qid);

    // Turn-in: completed, not yet turned in (never level-gated)
    if (prog && prog.status === 'completed') {
      turnIn.push({ quest, progress: prog, cardAction: 'turn_in' });
      continue;
    }
    if (quest.level > playerLevel + 5) continue;

    // Available: no progress yet, or failed + re-acceptable
    if (!prog) {
      // Check prereqs
      if (quest.prereqQuests) {
        const meetsPrereqs = quest.prereqQuests.every(pre => {
          const p = progressMap.get(pre);
          return p && p.status === 'turned_in';
        });
        if (!meetsPrereqs) continue;
      }
      available.push({ quest, progress: undefined, cardAction: 'accept' });
      continue;
    }

    if (prog.status === 'failed' && quest.reacceptable) {
      available.push({ quest, progress: prog, cardAction: 'accept' });
      continue;
    }

    // Already turned_in or active — skip
  }

  // Turn-in first, then available
  return [...turnIn, ...available];
}

// ─── Card Data Assembly ─────────────────────────────────────────

/**
 * Build display data for a single quest card.
 */
export function buildQuestCardData(
  entry: NpcQuestEntry,
  hasDialogueTree: boolean,
): QuestCardData {
  const { quest, progress, cardAction } = entry;

  const objectives: QuestObjectiveDisplay[] = quest.objectives.map((obj, i) => {
    const current = progress ? progress.objectives[i].current : 0;
    const done = current >= obj.required;
    return {
      label: formatObjectiveLabel(obj),
      progress: `${current}/${obj.required}`,
      done,
    };
  });

  const rewards: QuestRewardDisplay = {
    exp: quest.rewards.exp,
    gold: quest.rewards.gold,
    items: quest.rewards.items ?? [],
  };

  return {
    questId: quest.id,
    name: getQuestName(quest.id, quest.name),
    description: getQuestDesc(quest.id, quest.description),
    story: getQuestStory(quest.id, cardAction === 'accept' ? 'offer' : 'complete'),
    choiceLabels: (quest.rewards.choices ?? []).map(rewardChoiceLabel),
    typeBadge: QUEST_TYPE_LABELS[quest.type] ?? quest.type,
    category: quest.category,
    objectives,
    rewards,
    cardAction,
    hasLore: hasDialogueTree,
  };
}

// ─── Formatting Helpers ─────────────────────────────────────────

/** Format a single objective for display on the card. */
export function formatObjectiveLabel(obj: QuestObjective): string {
  const labels = getObjectiveTypeLabels();
  const typeLabel = labels[obj.type] ?? obj.type;
  return `${typeLabel} ${getQuestTargetName(obj.targetId, obj.targetName, obj.labelKey)}`;
}

/** Display label for a reward-choice slot. */
export function rewardChoiceLabel(choice: QuestRewardChoice): string {
  return t(`sys.questCard.choice.${choice}`);
}

/** Format reward summary line. */
export function formatRewardSummary(rewards: QuestReward): string {
  const parts: string[] = [];
  if (rewards.exp > 0) parts.push(t('sys.questCard.rewardExp', { exp: rewards.exp }));
  if (rewards.gold > 0) parts.push(t('sys.questCard.rewardGold', { gold: rewards.gold }));
  if (rewards.items && rewards.items.length > 0) {
    parts.push(t('sys.questCard.rewardItems', { count: rewards.items.length }));
  }
  if (rewards.choices && rewards.choices.length > 0) {
    parts.push(t('sys.questCard.rewardChoice', { count: rewards.choices.length }));
  }
  if (rewards.petReward) parts.push(t('sys.questCard.rewardPet'));
  return parts.join('  ');
}

/** Build the toast message after accept / turn-in. */
export function buildToastMessage(action: 'accept' | 'turn_in', questName: string): string {
  return action === 'accept'
    ? t('sys.questCard.accepted', { name: questName })
    : t('sys.questCard.turnedIn', { name: questName });
}
