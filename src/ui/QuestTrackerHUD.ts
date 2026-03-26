/**
 * QuestTrackerHUD — Pure utility functions for the quest tracker HUD overlay.
 *
 * These functions compute display data from QuestSystem state.  They are free
 * of Phaser dependencies so they can be unit-tested with Vitest directly.
 */

import { QUEST_TYPE_LABELS } from '../systems/QuestSystem';
import type { QuestDefinition, QuestProgress, QuestObjective } from '../data/types';

// ─── Display Types ──────────────────────────────────────────────

/** A single quest entry in the tracker. */
export interface TrackerQuestEntry {
  questId: string;
  name: string;
  category: 'main' | 'side';
  /** True when all objectives are done (status === 'completed'). */
  isCompleted: boolean;
  /** Compact one-line summary, e.g. '杀敌 3/10' or '已完成'. */
  progressSummary: string;
  /** Full objective detail lines (shown in expanded view). */
  objectiveLines: TrackerObjectiveLine[];
}

export interface TrackerObjectiveLine {
  label: string;       // e.g. '猎杀 哥布林'
  progress: string;    // e.g. '3/10' or '✓'
  done: boolean;
}

/** The overall tracker state for rendering. */
export interface TrackerState {
  entries: TrackerQuestEntry[];
  /** How many entries to display (capped by MAX_VISIBLE_QUESTS). */
  visibleCount: number;
  /** True when there are more entries than visible. */
  hasMore: boolean;
  /** Total active quest count. */
  totalCount: number;
}

// ─── Constants ──────────────────────────────────────────────────

export const MAX_VISIBLE_QUESTS = 5;

// ─── Objective Labels ───────────────────────────────────────────

const OBJECTIVE_TYPE_LABELS: Record<string, string> = {
  ...QUEST_TYPE_LABELS,
  defend_wave: '防守',
  investigate_clue: '调查',
  craft_collect: '采集',
  craft_craft: '制作',
  craft_deliver: '交付',
};

// ─── Core Logic ─────────────────────────────────────────────────

/**
 * Build a compact progress summary for a quest.
 *
 * If all objectives are complete → '已完成 - 返回NPC交付'
 * If single objective → '猎杀 3/10'
 * If multiple objectives → '2/4 完成'
 */
export function buildProgressSummary(
  quest: QuestDefinition,
  progress: QuestProgress,
): string {
  if (progress.status === 'completed') {
    return '已完成 - 返回NPC交付';
  }

  const objs = quest.objectives;
  if (objs.length === 1) {
    const obj = objs[0];
    const cur = progress.objectives[0]?.current ?? 0;
    const typeLabel = OBJECTIVE_TYPE_LABELS[obj.type] ?? obj.type;
    return `${typeLabel} ${cur}/${obj.required}`;
  }

  // Multiple objectives — show how many are done
  let doneCount = 0;
  for (let i = 0; i < objs.length; i++) {
    if ((progress.objectives[i]?.current ?? 0) >= objs[i].required) {
      doneCount++;
    }
  }
  return `${doneCount}/${objs.length} 完成`;
}

/**
 * Format a single objective line for the expanded tracker view.
 */
export function formatTrackerObjective(
  obj: QuestObjective,
  current: number,
): TrackerObjectiveLine {
  const typeLabel = OBJECTIVE_TYPE_LABELS[obj.type] ?? obj.type;
  const done = current >= obj.required;
  return {
    label: `${typeLabel} ${obj.targetName}`,
    progress: done ? '✓' : `${current}/${obj.required}`,
    done,
  };
}

/**
 * Build a single TrackerQuestEntry from quest + progress data.
 */
export function buildTrackerEntry(
  quest: QuestDefinition,
  progress: QuestProgress,
): TrackerQuestEntry {
  const isCompleted = progress.status === 'completed';
  const objectiveLines = quest.objectives.map((obj, i) =>
    formatTrackerObjective(obj, progress.objectives[i]?.current ?? 0),
  );

  return {
    questId: quest.id,
    name: quest.name,
    category: quest.category,
    isCompleted,
    progressSummary: buildProgressSummary(quest, progress),
    objectiveLines,
  };
}

/**
 * Build the full tracker state from the QuestSystem data.
 *
 * Sorts: main quests first, then by completion status (incomplete first),
 * caps at MAX_VISIBLE_QUESTS.
 */
export function buildTrackerState(
  activeQuests: { quest: QuestDefinition; progress: QuestProgress }[],
): TrackerState {
  // Sort: main first, then incomplete before complete
  const sorted = [...activeQuests].sort((a, b) => {
    // Main quests first
    if (a.quest.category === 'main' && b.quest.category !== 'main') return -1;
    if (a.quest.category !== 'main' && b.quest.category === 'main') return 1;
    // Incomplete before completed
    if (a.progress.status !== 'completed' && b.progress.status === 'completed') return -1;
    if (a.progress.status === 'completed' && b.progress.status !== 'completed') return 1;
    return 0;
  });

  const entries = sorted.map(({ quest, progress }) =>
    buildTrackerEntry(quest, progress),
  );

  const totalCount = entries.length;
  const visibleCount = Math.min(totalCount, MAX_VISIBLE_QUESTS);
  const hasMore = totalCount > MAX_VISIBLE_QUESTS;

  return {
    entries: entries.slice(0, visibleCount),
    visibleCount,
    hasMore,
    totalCount,
  };
}

/**
 * Build a signature string for change detection.
 * Avoids re-rendering the tracker when nothing changed.
 */
export function buildTrackerSignature(state: TrackerState): string {
  return state.entries
    .map(e => `${e.questId}|${e.isCompleted ? 1 : 0}|${e.progressSummary}`)
    .join('\n');
}
