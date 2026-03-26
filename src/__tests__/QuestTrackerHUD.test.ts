import { describe, it, expect, vi } from 'vitest';
import {
  buildProgressSummary,
  formatTrackerObjective,
  buildTrackerEntry,
  buildTrackerState,
  buildTrackerSignature,
  MAX_VISIBLE_QUESTS,
} from '../ui/QuestTrackerHUD';
import type { QuestDefinition, QuestProgress, QuestObjective } from '../data/types';

// Mock Phaser EventBus (required by QuestSystem import through QUEST_TYPE_LABELS)
vi.mock('../utils/EventBus', () => ({
  EventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  GameEvents: {
    QUEST_COMPLETED: 'quest:completed',
    QUEST_FAILED: 'quest:failed',
    LOG_MESSAGE: 'log:message',
  },
}));

// ─── Test Fixtures ──────────────────────────────────────────────

function makeQuest(overrides: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    id: 'test_quest_1',
    name: '测试任务',
    description: '这是一个测试任务。',
    zone: 'emerald_plains',
    type: 'kill',
    category: 'main',
    objectives: [
      { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 10, current: 0 },
    ],
    rewards: { exp: 100, gold: 50 },
    level: 1,
    ...overrides,
  };
}

function makeProgress(
  questId: string,
  status: QuestProgress['status'],
  objectives: { current: number }[],
): QuestProgress {
  return { questId, status, objectives };
}

// ═══════════════════════════════════════
// buildProgressSummary
// ═══════════════════════════════════════

describe('QuestTrackerHUD — buildProgressSummary', () => {
  it('returns turn-in hint when quest is completed', () => {
    const quest = makeQuest();
    const progress = makeProgress('test_quest_1', 'completed', [{ current: 10 }]);
    expect(buildProgressSummary(quest, progress)).toBe('已完成 - 返回NPC交付');
  });

  it('shows single objective progress with type label', () => {
    const quest = makeQuest();
    const progress = makeProgress('test_quest_1', 'active', [{ current: 3 }]);
    expect(buildProgressSummary(quest, progress)).toBe('猎杀 3/10');
  });

  it('shows single collect objective progress', () => {
    const quest = makeQuest({
      type: 'collect',
      objectives: [{ type: 'collect', targetId: 'herb', targetName: '草药', required: 5, current: 0 }],
    });
    const progress = makeProgress('test_quest_1', 'active', [{ current: 2 }]);
    expect(buildProgressSummary(quest, progress)).toBe('收集 2/5');
  });

  it('shows single explore objective progress', () => {
    const quest = makeQuest({
      type: 'explore',
      objectives: [{ type: 'explore', targetId: 'cave', targetName: '洞穴', required: 1, current: 0 }],
    });
    const progress = makeProgress('test_quest_1', 'active', [{ current: 0 }]);
    expect(buildProgressSummary(quest, progress)).toBe('探索 0/1');
  });

  it('shows aggregate progress for multi-objective quests', () => {
    const quest = makeQuest({
      objectives: [
        { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 5, current: 0 },
        { type: 'collect', targetId: 'gem', targetName: '宝石', required: 3, current: 0 },
        { type: 'explore', targetId: 'cave', targetName: '洞穴', required: 1, current: 0 },
      ],
    });
    const progress = makeProgress('test_quest_1', 'active', [
      { current: 5 }, // done
      { current: 1 }, // in progress
      { current: 1 }, // done
    ]);
    expect(buildProgressSummary(quest, progress)).toBe('2/3 完成');
  });

  it('shows 0/N for multi-objective quests with no progress', () => {
    const quest = makeQuest({
      objectives: [
        { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 5, current: 0 },
        { type: 'explore', targetId: 'cave', targetName: '洞穴', required: 1, current: 0 },
      ],
    });
    const progress = makeProgress('test_quest_1', 'active', [
      { current: 0 },
      { current: 0 },
    ]);
    expect(buildProgressSummary(quest, progress)).toBe('0/2 完成');
  });

  it('handles escort objective type correctly', () => {
    const quest = makeQuest({
      type: 'escort',
      objectives: [{ type: 'escort', targetId: 'npc', targetName: '商人', required: 1, current: 0 }],
    });
    const progress = makeProgress('test_quest_1', 'active', [{ current: 0 }]);
    expect(buildProgressSummary(quest, progress)).toBe('护送 0/1');
  });

  it('handles defend_wave objective type correctly', () => {
    const quest = makeQuest({
      type: 'defend',
      objectives: [{ type: 'defend_wave', targetId: 'camp', targetName: '营地', required: 3, current: 0 }],
    });
    const progress = makeProgress('test_quest_1', 'active', [{ current: 1 }]);
    expect(buildProgressSummary(quest, progress)).toBe('防守 1/3');
  });

  it('handles investigate_clue objective type correctly', () => {
    const quest = makeQuest({
      type: 'investigate',
      objectives: [{ type: 'investigate_clue', targetId: 'clue1', targetName: '线索', required: 3, current: 0 }],
    });
    const progress = makeProgress('test_quest_1', 'active', [{ current: 2 }]);
    expect(buildProgressSummary(quest, progress)).toBe('调查 2/3');
  });

  it('handles craft sub-type objectives correctly', () => {
    const quest = makeQuest({
      type: 'craft',
      objectives: [
        { type: 'craft_collect', targetId: 'ore', targetName: '矿石', required: 5, current: 0 },
        { type: 'craft_craft', targetId: 'sword', targetName: '剑', required: 1, current: 0 },
        { type: 'craft_deliver', targetId: 'npc', targetName: '铁匠', required: 1, current: 0 },
      ],
    });
    const progress = makeProgress('test_quest_1', 'active', [
      { current: 5 },
      { current: 0 },
      { current: 0 },
    ]);
    expect(buildProgressSummary(quest, progress)).toBe('1/3 完成');
  });

  it('handles missing progress objectives gracefully', () => {
    const quest = makeQuest();
    const progress = makeProgress('test_quest_1', 'active', []);
    // Should not throw, falls back to 0
    expect(buildProgressSummary(quest, progress)).toBe('猎杀 0/10');
  });
});

// ═══════════════════════════════════════
// formatTrackerObjective
// ═══════════════════════════════════════

describe('QuestTrackerHUD — formatTrackerObjective', () => {
  it('formats incomplete objective', () => {
    const obj: QuestObjective = { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 10, current: 0 };
    const result = formatTrackerObjective(obj, 3);
    expect(result.label).toBe('猎杀 哥布林');
    expect(result.progress).toBe('3/10');
    expect(result.done).toBe(false);
  });

  it('formats completed objective with checkmark', () => {
    const obj: QuestObjective = { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 10, current: 0 };
    const result = formatTrackerObjective(obj, 10);
    expect(result.progress).toBe('✓');
    expect(result.done).toBe(true);
  });

  it('formats over-completed objective as done', () => {
    const obj: QuestObjective = { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 5, current: 0 };
    const result = formatTrackerObjective(obj, 8);
    expect(result.progress).toBe('✓');
    expect(result.done).toBe(true);
  });

  it('formats explore objective', () => {
    const obj: QuestObjective = { type: 'explore', targetId: 'cave', targetName: '洞穴', required: 1, current: 0 };
    const result = formatTrackerObjective(obj, 0);
    expect(result.label).toBe('探索 洞穴');
    expect(result.progress).toBe('0/1');
    expect(result.done).toBe(false);
  });

  it('formats craft_collect objective', () => {
    const obj: QuestObjective = { type: 'craft_collect', targetId: 'ore', targetName: '矿石', required: 5, current: 0 };
    const result = formatTrackerObjective(obj, 2);
    expect(result.label).toBe('采集 矿石');
    expect(result.progress).toBe('2/5');
    expect(result.done).toBe(false);
  });
});

// ═══════════════════════════════════════
// buildTrackerEntry
// ═══════════════════════════════════════

describe('QuestTrackerHUD — buildTrackerEntry', () => {
  it('builds entry for active quest', () => {
    const quest = makeQuest();
    const progress = makeProgress('test_quest_1', 'active', [{ current: 3 }]);
    const entry = buildTrackerEntry(quest, progress);

    expect(entry.questId).toBe('test_quest_1');
    expect(entry.name).toBe('测试任务');
    expect(entry.category).toBe('main');
    expect(entry.isCompleted).toBe(false);
    expect(entry.progressSummary).toBe('猎杀 3/10');
    expect(entry.objectiveLines).toHaveLength(1);
    expect(entry.objectiveLines[0].label).toBe('猎杀 哥布林');
    expect(entry.objectiveLines[0].progress).toBe('3/10');
    expect(entry.objectiveLines[0].done).toBe(false);
  });

  it('builds entry for completed quest with turn-in hint', () => {
    const quest = makeQuest();
    const progress = makeProgress('test_quest_1', 'completed', [{ current: 10 }]);
    const entry = buildTrackerEntry(quest, progress);

    expect(entry.isCompleted).toBe(true);
    expect(entry.progressSummary).toBe('已完成 - 返回NPC交付');
    expect(entry.objectiveLines[0].done).toBe(true);
    expect(entry.objectiveLines[0].progress).toBe('✓');
  });

  it('builds entry for side quest', () => {
    const quest = makeQuest({ category: 'side' });
    const progress = makeProgress('test_quest_1', 'active', [{ current: 0 }]);
    const entry = buildTrackerEntry(quest, progress);

    expect(entry.category).toBe('side');
  });

  it('builds entry with multiple objectives', () => {
    const quest = makeQuest({
      objectives: [
        { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 5, current: 0 },
        { type: 'collect', targetId: 'gem', targetName: '宝石', required: 3, current: 0 },
      ],
    });
    const progress = makeProgress('test_quest_1', 'active', [
      { current: 5 },
      { current: 1 },
    ]);
    const entry = buildTrackerEntry(quest, progress);

    expect(entry.objectiveLines).toHaveLength(2);
    expect(entry.objectiveLines[0].done).toBe(true);
    expect(entry.objectiveLines[1].done).toBe(false);
    expect(entry.progressSummary).toBe('1/2 完成');
  });
});

// ═══════════════════════════════════════
// buildTrackerState
// ═══════════════════════════════════════

describe('QuestTrackerHUD — buildTrackerState', () => {
  it('returns empty state when no active quests', () => {
    const state = buildTrackerState([]);
    expect(state.entries).toHaveLength(0);
    expect(state.visibleCount).toBe(0);
    expect(state.hasMore).toBe(false);
    expect(state.totalCount).toBe(0);
  });

  it('returns all quests when under MAX_VISIBLE limit', () => {
    const quests = [
      { quest: makeQuest({ id: 'q1', name: '任务一' }), progress: makeProgress('q1', 'active', [{ current: 1 }]) },
      { quest: makeQuest({ id: 'q2', name: '任务二' }), progress: makeProgress('q2', 'active', [{ current: 2 }]) },
    ];
    const state = buildTrackerState(quests);
    expect(state.entries).toHaveLength(2);
    expect(state.visibleCount).toBe(2);
    expect(state.hasMore).toBe(false);
    expect(state.totalCount).toBe(2);
  });

  it('caps visible quests at MAX_VISIBLE_QUESTS', () => {
    const quests = Array.from({ length: 8 }, (_, i) => ({
      quest: makeQuest({ id: `q${i}`, name: `任务${i}` }),
      progress: makeProgress(`q${i}`, 'active', [{ current: i }]),
    }));
    const state = buildTrackerState(quests);
    expect(state.entries).toHaveLength(MAX_VISIBLE_QUESTS);
    expect(state.visibleCount).toBe(MAX_VISIBLE_QUESTS);
    expect(state.hasMore).toBe(true);
    expect(state.totalCount).toBe(8);
  });

  it('sorts main quests before side quests', () => {
    const quests = [
      { quest: makeQuest({ id: 'side1', name: '支线任务', category: 'side' }), progress: makeProgress('side1', 'active', [{ current: 1 }]) },
      { quest: makeQuest({ id: 'main1', name: '主线任务', category: 'main' }), progress: makeProgress('main1', 'active', [{ current: 2 }]) },
    ];
    const state = buildTrackerState(quests);
    expect(state.entries[0].name).toBe('主线任务');
    expect(state.entries[1].name).toBe('支线任务');
  });

  it('sorts incomplete quests before completed quests within same category', () => {
    const quests = [
      { quest: makeQuest({ id: 'done1', name: '完成任务' }), progress: makeProgress('done1', 'completed', [{ current: 10 }]) },
      { quest: makeQuest({ id: 'active1', name: '进行中任务' }), progress: makeProgress('active1', 'active', [{ current: 3 }]) },
    ];
    const state = buildTrackerState(quests);
    expect(state.entries[0].name).toBe('进行中任务');
    expect(state.entries[1].name).toBe('完成任务');
  });

  it('sorts main incomplete > main complete > side incomplete > side complete', () => {
    const quests = [
      { quest: makeQuest({ id: 'sc', name: '支线完成', category: 'side' }), progress: makeProgress('sc', 'completed', [{ current: 10 }]) },
      { quest: makeQuest({ id: 'mc', name: '主线完成', category: 'main' }), progress: makeProgress('mc', 'completed', [{ current: 10 }]) },
      { quest: makeQuest({ id: 'sa', name: '支线进行', category: 'side' }), progress: makeProgress('sa', 'active', [{ current: 2 }]) },
      { quest: makeQuest({ id: 'ma', name: '主线进行', category: 'main' }), progress: makeProgress('ma', 'active', [{ current: 5 }]) },
    ];
    const state = buildTrackerState(quests);
    expect(state.entries.map(e => e.name)).toEqual([
      '主线进行',
      '主线完成',
      '支线进行',
      '支线完成',
    ]);
  });

  it('hasMore is false when exactly at MAX_VISIBLE_QUESTS', () => {
    const quests = Array.from({ length: MAX_VISIBLE_QUESTS }, (_, i) => ({
      quest: makeQuest({ id: `q${i}`, name: `任务${i}` }),
      progress: makeProgress(`q${i}`, 'active', [{ current: i }]),
    }));
    const state = buildTrackerState(quests);
    expect(state.hasMore).toBe(false);
    expect(state.visibleCount).toBe(MAX_VISIBLE_QUESTS);
  });
});

// ═══════════════════════════════════════
// buildTrackerSignature
// ═══════════════════════════════════════

describe('QuestTrackerHUD — buildTrackerSignature', () => {
  it('returns empty string for empty state', () => {
    const state = buildTrackerState([]);
    expect(buildTrackerSignature(state)).toBe('');
  });

  it('generates unique signature per state', () => {
    const q1 = { quest: makeQuest({ id: 'q1' }), progress: makeProgress('q1', 'active', [{ current: 3 }]) };
    const q2 = { quest: makeQuest({ id: 'q1' }), progress: makeProgress('q1', 'active', [{ current: 4 }]) };
    const sig1 = buildTrackerSignature(buildTrackerState([q1]));
    const sig2 = buildTrackerSignature(buildTrackerState([q2]));
    expect(sig1).not.toBe(sig2);
  });

  it('returns same signature for identical state', () => {
    const quests = [
      { quest: makeQuest({ id: 'q1' }), progress: makeProgress('q1', 'active', [{ current: 3 }]) },
    ];
    const sig1 = buildTrackerSignature(buildTrackerState(quests));
    const sig2 = buildTrackerSignature(buildTrackerState(quests));
    expect(sig1).toBe(sig2);
  });

  it('changes when quest completes', () => {
    const quest = makeQuest({ id: 'q1' });
    const activeSig = buildTrackerSignature(
      buildTrackerState([{ quest, progress: makeProgress('q1', 'active', [{ current: 5 }]) }]),
    );
    const completedSig = buildTrackerSignature(
      buildTrackerState([{ quest, progress: makeProgress('q1', 'completed', [{ current: 10 }]) }]),
    );
    expect(activeSig).not.toBe(completedSig);
  });
});

// ═══════════════════════════════════════
// Real-time update simulation
// ═══════════════════════════════════════

describe('QuestTrackerHUD — real-time update simulation', () => {
  it('tracks progress change from 0 to completion', () => {
    const quest = makeQuest({ id: 'q1', name: '猎杀哥布林' });

    // Start at 0
    let progress = makeProgress('q1', 'active', [{ current: 0 }]);
    let state = buildTrackerState([{ quest, progress }]);
    expect(state.entries[0].progressSummary).toBe('猎杀 0/10');
    expect(state.entries[0].isCompleted).toBe(false);

    // Progress to 5
    progress = makeProgress('q1', 'active', [{ current: 5 }]);
    state = buildTrackerState([{ quest, progress }]);
    expect(state.entries[0].progressSummary).toBe('猎杀 5/10');

    // Complete
    progress = makeProgress('q1', 'completed', [{ current: 10 }]);
    state = buildTrackerState([{ quest, progress }]);
    expect(state.entries[0].progressSummary).toBe('已完成 - 返回NPC交付');
    expect(state.entries[0].isCompleted).toBe(true);
  });

  it('quest disappears from tracker after turn-in', () => {
    const quest = makeQuest({ id: 'q1' });
    // getActiveQuests() only returns 'active' and 'completed' status,
    // so turned_in quests won't appear in the input
    const activeQuests = [
      { quest, progress: makeProgress('q1', 'completed', [{ current: 10 }]) },
    ];
    const state1 = buildTrackerState(activeQuests);
    expect(state1.entries).toHaveLength(1);

    // After turn-in, quest system removes it from active list
    const state2 = buildTrackerState([]);
    expect(state2.entries).toHaveLength(0);
  });

  it('new quest appears in tracker when accepted', () => {
    const state1 = buildTrackerState([]);
    expect(state1.entries).toHaveLength(0);

    const quest = makeQuest({ id: 'q1', name: '新任务' });
    const progress = makeProgress('q1', 'active', [{ current: 0 }]);
    const state2 = buildTrackerState([{ quest, progress }]);
    expect(state2.entries).toHaveLength(1);
    expect(state2.entries[0].name).toBe('新任务');
  });

  it('signature changes detect quest progress updates', () => {
    const quest = makeQuest({ id: 'q1' });
    const sigs: string[] = [];

    for (let i = 0; i <= 10; i++) {
      const progress = makeProgress('q1', i < 10 ? 'active' : 'completed', [{ current: i }]);
      const state = buildTrackerState([{ quest, progress }]);
      sigs.push(buildTrackerSignature(state));
    }

    // All signatures should be unique (each progress change produces different summary)
    const uniqueSigs = new Set(sigs);
    expect(uniqueSigs.size).toBe(sigs.length);
  });
});

// ═══════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════

describe('QuestTrackerHUD — edge cases', () => {
  it('handles quest with empty objectives array', () => {
    const quest = makeQuest({ objectives: [] });
    const progress = makeProgress('test_quest_1', 'active', []);
    const entry = buildTrackerEntry(quest, progress);
    expect(entry.objectiveLines).toHaveLength(0);
    // Single objective path won't match (length !== 1), multi-objective path: 0/0 完成
    expect(entry.progressSummary).toBe('0/0 完成');
  });

  it('handles all quest types in tracker', () => {
    const types: QuestDefinition['type'][] = ['kill', 'collect', 'explore', 'talk', 'escort', 'defend', 'investigate', 'craft'];
    for (const type of types) {
      const quest = makeQuest({ id: `q_${type}`, type });
      const progress = makeProgress(`q_${type}`, 'active', [{ current: 1 }]);
      const entry = buildTrackerEntry(quest, progress);
      expect(entry.questId).toBe(`q_${type}`);
      expect(entry.progressSummary).toBeTruthy();
    }
  });
});
