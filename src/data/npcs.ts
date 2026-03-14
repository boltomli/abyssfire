import type { NPCDefinition } from './types';

export const NPCDefinitions: Record<string, NPCDefinition> = {
  blacksmith: {
    id: 'blacksmith',
    name: '铁匠',
    type: 'blacksmith',
    dialogue: ['欢迎来到我的铁匠铺!', '需要修理装备或者打造新武器吗？'],
    shopItems: ['w_short_sword', 'w_broad_sword', 'w_dagger', 'w_stiletto', 'w_short_bow', 'w_oak_staff', 'w_wooden_shield', 'a_leather_helm', 'a_leather_armor', 'a_leather_gloves', 'a_leather_boots', 'a_leather_belt'],
  },
  merchant: {
    id: 'merchant',
    name: '商人',
    type: 'merchant',
    dialogue: ['需要补给吗？我这里应有尽有!', '药水、卷轴、宝石，随你挑选。'],
    shopItems: ['c_hp_potion_s', 'c_hp_potion_m', 'c_mp_potion_s', 'c_mp_potion_m', 'c_antidote', 'c_tp_scroll', 'c_id_scroll', 'g_ruby_1', 'g_sapphire_1', 'g_emerald_1', 'g_topaz_1'],
  },
  stash: {
    id: 'stash',
    name: '仓库管理员',
    type: 'stash',
    dialogue: ['需要存放物品吗？', '您的仓库安全可靠。'],
  },
  quest_elder: {
    id: 'quest_elder',
    name: '村长',
    type: 'quest',
    dialogue: ['勇士，翡翠平原上的怪物越来越多了...', '请帮助我们清除这些威胁!'],
    quests: ['q_kill_slimes', 'q_kill_goblins', 'q_find_goblin_chief'],
  },
  quest_scout: {
    id: 'quest_scout',
    name: '侦察兵',
    type: 'quest',
    dialogue: ['暮色森林中有不祥的动静...', '你愿意去调查一下吗？'],
    quests: ['q_explore_forest', 'q_kill_undead'],
  },
  blacksmith_advanced: {
    id: 'blacksmith_advanced',
    name: '高级铁匠',
    type: 'blacksmith',
    dialogue: ['只有最好的材料才配得上我的手艺。'],
    shopItems: ['w_battle_axe', 'w_arcane_staff', 'w_iron_shield', 'a_chain_mail', 'a_iron_helm', 'a_chain_gloves', 'a_chain_boots', 'a_heavy_belt'],
  },
  merchant_desert: {
    id: 'merchant_desert',
    name: '沙漠商人',
    type: 'merchant',
    dialogue: ['沙漠里水比金子还贵...', '不过我有你需要的一切。'],
    shopItems: ['c_hp_potion_m', 'c_hp_potion_l', 'c_mp_potion_m', 'c_antidote', 'c_tp_scroll', 'c_id_scroll', 'g_ruby_2', 'g_sapphire_2', 'g_diamond_1'],
  },
};
