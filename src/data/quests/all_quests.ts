import type { QuestDefinition } from '../types';

export const AllQuests: QuestDefinition[] = [
  // ═══════════════════════════════════════
  // Zone 1: Emerald Plains (Lv 1-10)
  // ═══════════════════════════════════════
  {
    id: 'q_kill_slimes',
    name: '史莱姆之灾',
    description: '翡翠平原上的史莱姆正在侵蚀农田，请消灭它们以保护村庄。',
    zone: 'emerald_plains',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'slime_green', targetName: '绿色史莱姆', required: 10, current: 0 },
    ],
    rewards: { exp: 120, gold: 25 },
    level: 1,
  },
  {
    id: 'q_collect_slime_gel',
    name: '史莱姆凝胶',
    description: '商人需要史莱姆凝胶来调制药水，帮他收集一些吧。',
    zone: 'emerald_plains',
    type: 'collect',
    objectives: [
      { type: 'collect', targetId: 'mat_slime_gel', targetName: '史莱姆凝胶', required: 8, current: 0 },
    ],
    rewards: { exp: 80, gold: 30, items: ['c_hp_potion_s'] },
    level: 2,
  },
  {
    id: 'q_kill_goblins',
    name: '哥布林猎杀',
    description: '哥布林部落越来越嚣张了，消灭一批哥布林以震慑它们。',
    zone: 'emerald_plains',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 15, current: 0 },
    ],
    rewards: { exp: 200, gold: 40 },
    prereqQuests: ['q_kill_slimes'],
    level: 3,
  },
  {
    id: 'q_find_goblin_chief',
    name: '首领之首',
    description: '哥布林首领藏身于平原深处，找到并击败它！',
    zone: 'emerald_plains',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'goblin_chief', targetName: '哥布林首领', required: 1, current: 0 },
    ],
    rewards: { exp: 500, gold: 80, items: ['w_short_sword'] },
    prereqQuests: ['q_kill_goblins'],
    level: 5,
  },

  // ═══════════════════════════════════════
  // Zone 2: Twilight Forest (Lv 10-20)
  // ═══════════════════════════════════════
  {
    id: 'q_explore_forest',
    name: '暮色侦察',
    description: '暮色森林中有不祥的气息，前去侦察森林的各个区域。',
    zone: 'twilight_forest',
    type: 'explore',
    objectives: [
      { type: 'explore', targetId: 'zone_forest_north', targetName: '森林北部', required: 1, current: 0 },
      { type: 'explore', targetId: 'zone_forest_graveyard', targetName: '废弃墓地', required: 1, current: 0 },
      { type: 'explore', targetId: 'zone_forest_ruins', targetName: '古老遗迹', required: 1, current: 0 },
    ],
    rewards: { exp: 600, gold: 60 },
    level: 10,
  },
  {
    id: 'q_kill_undead',
    name: '亡灵净化',
    description: '不死生物在暮色森林中游荡，将它们送回安息之所。',
    zone: 'twilight_forest',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'skeleton', targetName: '骷髅战士', required: 12, current: 0 },
      { type: 'kill', targetId: 'zombie', targetName: '腐尸', required: 8, current: 0 },
    ],
    rewards: { exp: 800, gold: 75, items: ['c_hp_potion_m'] },
    prereqQuests: ['q_explore_forest'],
    level: 12,
  },
  {
    id: 'q_talk_hermit',
    name: '隐士的智慧',
    description: '森林深处住着一位隐士，他或许知道亡灵为何复苏。',
    zone: 'twilight_forest',
    type: 'talk',
    objectives: [
      { type: 'talk', targetId: 'npc_forest_hermit', targetName: '森林隐士', required: 1, current: 0 },
    ],
    rewards: { exp: 400, gold: 50 },
    prereqQuests: ['q_kill_undead'],
    level: 14,
  },
  {
    id: 'q_kill_werewolf_alpha',
    name: '狼王之祸',
    description: '一只凶猛的狼人首领统治着森林的黑暗深处，必须消灭它。',
    zone: 'twilight_forest',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'werewolf', targetName: '狼人', required: 6, current: 0 },
      { type: 'kill', targetId: 'werewolf_alpha', targetName: '狼人首领', required: 1, current: 0 },
    ],
    rewards: { exp: 1500, gold: 120, items: ['w_battle_axe'] },
    prereqQuests: ['q_talk_hermit'],
    level: 18,
  },

  // ═══════════════════════════════════════
  // Zone 3: Anvil Mountains (Lv 20-30)
  // ═══════════════════════════════════════
  {
    id: 'q_explore_dwarf_ruins',
    name: '矮人遗迹',
    description: '铁砧山脉中隐藏着古老的矮人遗迹，前去探索其秘密。',
    zone: 'anvil_mountains',
    type: 'explore',
    objectives: [
      { type: 'explore', targetId: 'zone_mine_entrance', targetName: '矿洞入口', required: 1, current: 0 },
      { type: 'explore', targetId: 'zone_forge_hall', targetName: '锻造大厅', required: 1, current: 0 },
      { type: 'explore', targetId: 'zone_throne_room', targetName: '矮人王座', required: 1, current: 0 },
    ],
    rewards: { exp: 1800, gold: 150 },
    level: 20,
  },
  {
    id: 'q_kill_gargoyles',
    name: '石翼之灾',
    description: '石像鬼盘踞在山脉的高处，威胁着所有过往的旅人。',
    zone: 'anvil_mountains',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'gargoyle', targetName: '石像鬼', required: 15, current: 0 },
    ],
    rewards: { exp: 2200, gold: 180 },
    prereqQuests: ['q_explore_dwarf_ruins'],
    level: 22,
  },
  {
    id: 'q_collect_dwarf_relics',
    name: '矮人遗物',
    description: '收集散落在遗迹中的矮人工艺品，也许铁匠可以利用它们。',
    zone: 'anvil_mountains',
    type: 'collect',
    objectives: [
      { type: 'collect', targetId: 'mat_dwarf_ingot', targetName: '矮人秘银锭', required: 5, current: 0 },
      { type: 'collect', targetId: 'mat_rune_fragment', targetName: '符文碎片', required: 10, current: 0 },
    ],
    rewards: { exp: 2500, gold: 200, items: ['w_claymore'] },
    prereqQuests: ['q_kill_gargoyles'],
    level: 25,
  },
  {
    id: 'q_kill_stone_guardian',
    name: '石之守卫',
    description: '矮人遗迹最深处的石之守卫依然忠诚地守护着宝藏，击败它。',
    zone: 'anvil_mountains',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'stone_guardian', targetName: '石之守卫', required: 1, current: 0 },
    ],
    rewards: { exp: 3500, gold: 300, items: ['a_plate_armor'] },
    prereqQuests: ['q_collect_dwarf_relics'],
    level: 28,
  },

  // ═══════════════════════════════════════
  // Zone 4: Scorching Desert (Lv 30-40)
  // ═══════════════════════════════════════
  {
    id: 'q_talk_desert_nomad',
    name: '沙漠向导',
    description: '找到沙漠游牧民，了解在灼热沙漠中生存的方法。',
    zone: 'scorching_desert',
    type: 'talk',
    objectives: [
      { type: 'talk', targetId: 'npc_desert_nomad', targetName: '沙漠游牧民', required: 1, current: 0 },
    ],
    rewards: { exp: 2800, gold: 200 },
    level: 30,
  },
  {
    id: 'q_kill_fire_elementals',
    name: '烈焰之心',
    description: '火焰元素在沙丘间肆虐，消灭它们并收集火焰之心。',
    zone: 'scorching_desert',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'fire_elemental', targetName: '火焰元素', required: 12, current: 0 },
    ],
    rewards: { exp: 3800, gold: 250, items: ['g_ruby_2'] },
    prereqQuests: ['q_talk_desert_nomad'],
    level: 32,
  },
  {
    id: 'q_kill_sandworms',
    name: '沙虫巢穴',
    description: '巨大的沙虫正在吞噬商路，找到它们的巢穴并清除威胁。',
    zone: 'scorching_desert',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'sandworm', targetName: '沙虫', required: 8, current: 0 },
      { type: 'kill', targetId: 'sandworm_queen', targetName: '沙虫女王', required: 1, current: 0 },
    ],
    rewards: { exp: 5000, gold: 350, items: ['w_demon_blade'] },
    prereqQuests: ['q_kill_fire_elementals'],
    level: 36,
  },

  // ═══════════════════════════════════════
  // Zone 5: Abyss Rift (Lv 40-50)
  // ═══════════════════════════════════════
  {
    id: 'q_explore_abyss',
    name: '深渊之门',
    description: '深渊裂隙已经开启，勇士必须探索这片被恶魔污染的领域。',
    zone: 'abyss_rift',
    type: 'explore',
    objectives: [
      { type: 'explore', targetId: 'zone_rift_entrance', targetName: '裂隙入口', required: 1, current: 0 },
      { type: 'explore', targetId: 'zone_demon_spire', targetName: '恶魔尖塔', required: 1, current: 0 },
      { type: 'explore', targetId: 'zone_throne_of_chaos', targetName: '混沌王座', required: 1, current: 0 },
    ],
    rewards: { exp: 6000, gold: 400 },
    level: 40,
  },
  {
    id: 'q_kill_demons',
    name: '恶魔驱逐',
    description: '深渊中的恶魔必须被消灭，否则它们将涌入凡间。',
    zone: 'abyss_rift',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'imp', targetName: '小恶魔', required: 20, current: 0 },
      { type: 'kill', targetId: 'demon_knight', targetName: '恶魔骑士', required: 10, current: 0 },
    ],
    rewards: { exp: 8000, gold: 500, items: ['w_abyssal_staff'] },
    prereqQuests: ['q_explore_abyss'],
    level: 43,
  },
  {
    id: 'q_collect_demon_essence',
    name: '恶魔精华',
    description: '收集恶魔精华来封印深渊裂隙，阻止更多恶魔入侵。',
    zone: 'abyss_rift',
    type: 'collect',
    objectives: [
      { type: 'collect', targetId: 'mat_demon_essence', targetName: '恶魔精华', required: 15, current: 0 },
    ],
    rewards: { exp: 7500, gold: 450, items: ['a_demon_helm'] },
    prereqQuests: ['q_kill_demons'],
    level: 45,
  },
  {
    id: 'q_kill_abyss_lord',
    name: '深渊领主',
    description: '深渊领主是一切灾厄的根源，击败它来拯救这个世界！',
    zone: 'abyss_rift',
    type: 'kill',
    objectives: [
      { type: 'kill', targetId: 'abyss_lord', targetName: '深渊领主', required: 1, current: 0 },
    ],
    rewards: { exp: 15000, gold: 1000, items: ['a_dragon_armor'] },
    prereqQuests: ['q_collect_demon_essence'],
    level: 50,
  },
];
