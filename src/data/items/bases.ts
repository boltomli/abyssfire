import type { WeaponBase, ArmorBase, AccessoryBase, ItemBase } from '../types';

export const Weapons: WeaponBase[] = [
  { id: 'w_rusty_sword', name: '生锈的剑', nameEn: 'Rusty Sword', description: '一把破旧的铁剑', type: 'weapon', slot: 'weapon', icon: 'w_sword', levelReq: 1, sellPrice: 5, stackable: false, maxStack: 1, baseDamage: [3, 7], attackSpeed: 1000, weaponType: 'sword', sockets: 0 },
  { id: 'w_short_sword', name: '短剑', nameEn: 'Short Sword', description: '轻便的短剑', type: 'weapon', slot: 'weapon', icon: 'w_sword', levelReq: 3, sellPrice: 15, stackable: false, maxStack: 1, baseDamage: [5, 10], attackSpeed: 900, weaponType: 'sword', sockets: 1 },
  { id: 'w_broad_sword', name: '阔剑', nameEn: 'Broad Sword', description: '厚重的双刃剑', type: 'weapon', slot: 'weapon', icon: 'w_sword', levelReq: 8, sellPrice: 40, stackable: false, maxStack: 1, baseDamage: [10, 18], attackSpeed: 1100, weaponType: 'sword', sockets: 1 },
  { id: 'w_battle_axe', name: '战斧', nameEn: 'Battle Axe', description: '沉重的双手战斧', type: 'weapon', slot: 'weapon', icon: 'w_axe', levelReq: 10, sellPrice: 55, stackable: false, maxStack: 1, baseDamage: [14, 22], attackSpeed: 1300, weaponType: 'axe', sockets: 1 },
  { id: 'w_dagger', name: '匕首', nameEn: 'Dagger', description: '小巧锋利的匕首', type: 'weapon', slot: 'weapon', icon: 'w_dagger', levelReq: 1, sellPrice: 8, stackable: false, maxStack: 1, baseDamage: [2, 6], attackSpeed: 700, weaponType: 'dagger', sockets: 0 },
  { id: 'w_stiletto', name: '细剑', nameEn: 'Stiletto', description: '精致的刺杀用匕首', type: 'weapon', slot: 'weapon', icon: 'w_dagger', levelReq: 6, sellPrice: 30, stackable: false, maxStack: 1, baseDamage: [4, 10], attackSpeed: 650, weaponType: 'dagger', sockets: 1 },
  { id: 'w_short_bow', name: '短弓', nameEn: 'Short Bow', description: '简单的木弓', type: 'weapon', slot: 'weapon', icon: 'w_bow', levelReq: 1, sellPrice: 10, stackable: false, maxStack: 1, baseDamage: [3, 8], attackSpeed: 1100, weaponType: 'bow', sockets: 0 },
  { id: 'w_long_bow', name: '长弓', nameEn: 'Long Bow', description: '强力的长弓', type: 'weapon', slot: 'weapon', icon: 'w_bow', levelReq: 10, sellPrice: 50, stackable: false, maxStack: 1, baseDamage: [8, 16], attackSpeed: 1200, weaponType: 'bow', sockets: 1 },
  { id: 'w_oak_staff', name: '橡木法杖', nameEn: 'Oak Staff', description: '蕴含微弱魔力的法杖', type: 'weapon', slot: 'weapon', icon: 'w_staff', levelReq: 1, sellPrice: 10, stackable: false, maxStack: 1, baseDamage: [4, 9], attackSpeed: 1200, weaponType: 'staff', sockets: 0 },
  { id: 'w_arcane_staff', name: '奥术法杖', nameEn: 'Arcane Staff', description: '闪烁着奥术光芒的法杖', type: 'weapon', slot: 'weapon', icon: 'w_staff', levelReq: 8, sellPrice: 45, stackable: false, maxStack: 1, baseDamage: [8, 16], attackSpeed: 1300, weaponType: 'staff', sockets: 2 },
  { id: 'w_wooden_shield', name: '木盾', nameEn: 'Wooden Shield', description: '简单的木质盾牌', type: 'weapon', slot: 'offhand', icon: 'w_shield', levelReq: 1, sellPrice: 8, stackable: false, maxStack: 1, baseDamage: [0, 0], attackSpeed: 0, weaponType: 'shield', sockets: 0 },
  { id: 'w_iron_shield', name: '铁盾', nameEn: 'Iron Shield', description: '坚固的铁盾', type: 'weapon', slot: 'offhand', icon: 'w_shield', levelReq: 8, sellPrice: 35, stackable: false, maxStack: 1, baseDamage: [0, 0], attackSpeed: 0, weaponType: 'shield', sockets: 1 },
  // Higher level weapons
  { id: 'w_claymore', name: '双手巨剑', nameEn: 'Claymore', description: '沉重而致命的巨剑', type: 'weapon', slot: 'weapon', icon: 'w_sword', levelReq: 20, sellPrice: 150, stackable: false, maxStack: 1, baseDamage: [22, 38], attackSpeed: 1400, weaponType: 'sword', sockets: 2 },
  { id: 'w_assassin_blade', name: '刺客之刃', nameEn: 'Assassin Blade', description: '涂毒的弯刀', type: 'weapon', slot: 'weapon', icon: 'w_dagger', levelReq: 20, sellPrice: 140, stackable: false, maxStack: 1, baseDamage: [12, 22], attackSpeed: 600, weaponType: 'dagger', sockets: 2 },
  { id: 'w_war_bow', name: '战争之弓', nameEn: 'War Bow', description: '强力的复合弓', type: 'weapon', slot: 'weapon', icon: 'w_bow', levelReq: 20, sellPrice: 145, stackable: false, maxStack: 1, baseDamage: [16, 28], attackSpeed: 1100, weaponType: 'bow', sockets: 2 },
  { id: 'w_elder_staff', name: '长老法杖', nameEn: 'Elder Staff', description: '蕴含强大魔力', type: 'weapon', slot: 'weapon', icon: 'w_staff', levelReq: 20, sellPrice: 155, stackable: false, maxStack: 1, baseDamage: [18, 32], attackSpeed: 1300, weaponType: 'staff', sockets: 2 },
  { id: 'w_demon_blade', name: '恶魔之刃', nameEn: 'Demon Blade', description: '散发着黑暗气息', type: 'weapon', slot: 'weapon', icon: 'w_sword', levelReq: 35, sellPrice: 350, stackable: false, maxStack: 1, baseDamage: [35, 55], attackSpeed: 1200, weaponType: 'sword', sockets: 3 },
  { id: 'w_abyssal_staff', name: '深渊法杖', nameEn: 'Abyssal Staff', description: '深渊之力凝聚', type: 'weapon', slot: 'weapon', icon: 'w_staff', levelReq: 35, sellPrice: 360, stackable: false, maxStack: 1, baseDamage: [30, 50], attackSpeed: 1300, weaponType: 'staff', sockets: 3 },
];

export const Armors: ArmorBase[] = [
  { id: 'a_cloth_cap', name: '布帽', nameEn: 'Cloth Cap', description: '简单的布帽', type: 'armor', slot: 'helmet', icon: 'a_helm', levelReq: 1, sellPrice: 3, stackable: false, maxStack: 1, baseDefense: 2, sockets: 0 },
  { id: 'a_leather_helm', name: '皮盔', nameEn: 'Leather Helm', description: '皮革头盔', type: 'armor', slot: 'helmet', icon: 'a_helm', levelReq: 5, sellPrice: 15, stackable: false, maxStack: 1, baseDefense: 5, sockets: 0 },
  { id: 'a_iron_helm', name: '铁盔', nameEn: 'Iron Helm', description: '铸铁头盔', type: 'armor', slot: 'helmet', icon: 'a_helm', levelReq: 10, sellPrice: 35, stackable: false, maxStack: 1, baseDefense: 10, sockets: 1 },
  { id: 'a_quilted_armor', name: '绗缝甲', nameEn: 'Quilted Armor', description: '简单的布甲', type: 'armor', slot: 'armor', icon: 'a_armor', levelReq: 1, sellPrice: 5, stackable: false, maxStack: 1, baseDefense: 4, sockets: 0 },
  { id: 'a_leather_armor', name: '皮甲', nameEn: 'Leather Armor', description: '柔韧的皮甲', type: 'armor', slot: 'armor', icon: 'a_armor', levelReq: 5, sellPrice: 20, stackable: false, maxStack: 1, baseDefense: 8, sockets: 0 },
  { id: 'a_chain_mail', name: '锁子甲', nameEn: 'Chain Mail', description: '链环编织的铠甲', type: 'armor', slot: 'armor', icon: 'a_armor', levelReq: 10, sellPrice: 50, stackable: false, maxStack: 1, baseDefense: 15, sockets: 1 },
  { id: 'a_plate_armor', name: '板甲', nameEn: 'Plate Armor', description: '厚重的全身板甲', type: 'armor', slot: 'armor', icon: 'a_armor', levelReq: 20, sellPrice: 120, stackable: false, maxStack: 1, baseDefense: 25, sockets: 2 },
  { id: 'a_leather_gloves', name: '皮手套', nameEn: 'Leather Gloves', description: '皮革手套', type: 'armor', slot: 'gloves', icon: 'a_gloves', levelReq: 1, sellPrice: 3, stackable: false, maxStack: 1, baseDefense: 1, sockets: 0 },
  { id: 'a_chain_gloves', name: '锁链手套', nameEn: 'Chain Gloves', description: '链甲手套', type: 'armor', slot: 'gloves', icon: 'a_gloves', levelReq: 10, sellPrice: 25, stackable: false, maxStack: 1, baseDefense: 5, sockets: 1 },
  { id: 'a_leather_boots', name: '皮靴', nameEn: 'Leather Boots', description: '轻便的皮靴', type: 'armor', slot: 'boots', icon: 'a_boots', levelReq: 1, sellPrice: 3, stackable: false, maxStack: 1, baseDefense: 1, sockets: 0 },
  { id: 'a_chain_boots', name: '锁链靴', nameEn: 'Chain Boots', description: '链甲靴子', type: 'armor', slot: 'boots', icon: 'a_boots', levelReq: 10, sellPrice: 25, stackable: false, maxStack: 1, baseDefense: 4, sockets: 0 },
  { id: 'a_leather_belt', name: '皮带', nameEn: 'Leather Belt', description: '简单的皮带', type: 'armor', slot: 'belt', icon: 'a_belt', levelReq: 1, sellPrice: 2, stackable: false, maxStack: 1, baseDefense: 1, sockets: 0 },
  { id: 'a_heavy_belt', name: '重型腰带', nameEn: 'Heavy Belt', description: '宽厚的腰带', type: 'armor', slot: 'belt', icon: 'a_belt', levelReq: 10, sellPrice: 20, stackable: false, maxStack: 1, baseDefense: 3, sockets: 0 },
  // Higher tier
  { id: 'a_demon_helm', name: '恶魔头冠', nameEn: 'Demon Crown', description: '恶魔角装饰的头冠', type: 'armor', slot: 'helmet', icon: 'a_helm', levelReq: 30, sellPrice: 200, stackable: false, maxStack: 1, baseDefense: 22, sockets: 2 },
  { id: 'a_dragon_armor', name: '龙鳞甲', nameEn: 'Dragon Scale', description: '龙鳞打造的铠甲', type: 'armor', slot: 'armor', icon: 'a_armor', levelReq: 35, sellPrice: 350, stackable: false, maxStack: 1, baseDefense: 40, sockets: 3 },
];

export const Accessories: AccessoryBase[] = [
  { id: 'j_copper_ring', name: '铜戒指', nameEn: 'Copper Ring', description: '铜制戒指', type: 'accessory', slot: 'ring1', icon: 'j_ring', levelReq: 1, sellPrice: 5, stackable: false, maxStack: 1 },
  { id: 'j_silver_ring', name: '银戒指', nameEn: 'Silver Ring', description: '银制戒指', type: 'accessory', slot: 'ring1', icon: 'j_ring', levelReq: 10, sellPrice: 25, stackable: false, maxStack: 1 },
  { id: 'j_gold_ring', name: '金戒指', nameEn: 'Gold Ring', description: '金制戒指', type: 'accessory', slot: 'ring1', icon: 'j_ring', levelReq: 20, sellPrice: 60, stackable: false, maxStack: 1 },
  { id: 'j_bone_amulet', name: '骨项链', nameEn: 'Bone Amulet', description: '骨制项链', type: 'accessory', slot: 'necklace', icon: 'j_amulet', levelReq: 1, sellPrice: 8, stackable: false, maxStack: 1 },
  { id: 'j_jade_amulet', name: '翡翠项链', nameEn: 'Jade Amulet', description: '翡翠项链', type: 'accessory', slot: 'necklace', icon: 'j_amulet', levelReq: 15, sellPrice: 45, stackable: false, maxStack: 1 },
];

export const Consumables: ItemBase[] = [
  { id: 'c_hp_potion_s', name: '小型生命药水', nameEn: 'Minor HP Potion', description: '恢复50生命', type: 'consumable', icon: 'c_hp', levelReq: 1, sellPrice: 5, stackable: true, maxStack: 20 },
  { id: 'c_hp_potion_m', name: '中型生命药水', nameEn: 'HP Potion', description: '恢复150生命', type: 'consumable', icon: 'c_hp', levelReq: 10, sellPrice: 15, stackable: true, maxStack: 20 },
  { id: 'c_hp_potion_l', name: '大型生命药水', nameEn: 'Greater HP Potion', description: '恢复400生命', type: 'consumable', icon: 'c_hp', levelReq: 25, sellPrice: 40, stackable: true, maxStack: 20 },
  { id: 'c_mp_potion_s', name: '小型法力药水', nameEn: 'Minor MP Potion', description: '恢复30法力', type: 'consumable', icon: 'c_mp', levelReq: 1, sellPrice: 5, stackable: true, maxStack: 20 },
  { id: 'c_mp_potion_m', name: '中型法力药水', nameEn: 'MP Potion', description: '恢复80法力', type: 'consumable', icon: 'c_mp', levelReq: 10, sellPrice: 15, stackable: true, maxStack: 20 },
  { id: 'c_antidote', name: '解毒药水', nameEn: 'Antidote', description: '解除毒性状态', type: 'consumable', icon: 'c_antidote', levelReq: 1, sellPrice: 8, stackable: true, maxStack: 10 },
  { id: 'c_tp_scroll', name: '传送卷轴', nameEn: 'TP Scroll', description: '传送回营地', type: 'scroll', icon: 'c_scroll', levelReq: 1, sellPrice: 10, stackable: true, maxStack: 20 },
  { id: 'c_id_scroll', name: '鉴定卷轴', nameEn: 'ID Scroll', description: '鉴定未知装备', type: 'scroll', icon: 'c_scroll', levelReq: 1, sellPrice: 5, stackable: true, maxStack: 20 },
];

export const Gems: ItemBase[] = [
  { id: 'g_ruby_1', name: '碎裂红宝石', nameEn: 'Chipped Ruby', description: '+5 力量', type: 'gem', icon: 'g_ruby', levelReq: 1, sellPrice: 10, stackable: true, maxStack: 10 },
  { id: 'g_ruby_2', name: '红宝石', nameEn: 'Ruby', description: '+12 力量', type: 'gem', icon: 'g_ruby', levelReq: 15, sellPrice: 30, stackable: true, maxStack: 10 },
  { id: 'g_sapphire_1', name: '碎裂蓝宝石', nameEn: 'Chipped Sapphire', description: '+5 智力', type: 'gem', icon: 'g_sapphire', levelReq: 1, sellPrice: 10, stackable: true, maxStack: 10 },
  { id: 'g_sapphire_2', name: '蓝宝石', nameEn: 'Sapphire', description: '+12 智力', type: 'gem', icon: 'g_sapphire', levelReq: 15, sellPrice: 30, stackable: true, maxStack: 10 },
  { id: 'g_emerald_1', name: '碎裂翡翠', nameEn: 'Chipped Emerald', description: '+5 敏捷', type: 'gem', icon: 'g_emerald', levelReq: 1, sellPrice: 10, stackable: true, maxStack: 10 },
  { id: 'g_topaz_1', name: '碎裂黄玉', nameEn: 'Chipped Topaz', description: '+5% 掉宝率', type: 'gem', icon: 'g_topaz', levelReq: 1, sellPrice: 10, stackable: true, maxStack: 10 },
  { id: 'g_diamond_1', name: '碎裂钻石', nameEn: 'Chipped Diamond', description: '+3 全属性', type: 'gem', icon: 'g_diamond', levelReq: 10, sellPrice: 20, stackable: true, maxStack: 10 },
];

export const AllItemBases: (ItemBase | WeaponBase | ArmorBase | AccessoryBase)[] = [
  ...Weapons, ...Armors, ...Accessories, ...Consumables, ...Gems,
];

export function getItemBase(id: string): ItemBase | WeaponBase | ArmorBase | AccessoryBase | undefined {
  return AllItemBases.find(i => i.id === id);
}
