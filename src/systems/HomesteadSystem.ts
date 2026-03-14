import { EventBus, GameEvents } from '../utils/EventBus';
import type { HomesteadBuilding, PetDefinition } from '../data/types';

const BUILDINGS: HomesteadBuilding[] = [
  {
    id: 'herb_garden', name: '药草园', description: '自动产出药水材料',
    maxLevel: 5,
    costPerLevel: [{ gold: 100 }, { gold: 250 }, { gold: 500 }, { gold: 1000 }, { gold: 2000 }],
    bonusPerLevel: [{ stat: 'potionDiscount', value: 5 }],
  },
  {
    id: 'training_ground', name: '训练场', description: '离线经验获取',
    maxLevel: 5,
    costPerLevel: [{ gold: 150 }, { gold: 350 }, { gold: 700 }, { gold: 1400 }, { gold: 2800 }],
    bonusPerLevel: [{ stat: 'expBonus', value: 1 }],
  },
  {
    id: 'gem_workshop', name: '宝石工坊', description: '合成/升级宝石',
    maxLevel: 5,
    costPerLevel: [{ gold: 200 }, { gold: 450 }, { gold: 900 }, { gold: 1800 }, { gold: 3500 }],
    bonusPerLevel: [{ stat: 'gemBonus', value: 2 }],
  },
  {
    id: 'pet_house', name: '宠物小屋', description: '饲养宠物',
    maxLevel: 3,
    costPerLevel: [{ gold: 300 }, { gold: 800 }, { gold: 2000 }],
    bonusPerLevel: [{ stat: 'petSlots', value: 1 }],
  },
  {
    id: 'warehouse', name: '仓库', description: '扩展存储空间',
    maxLevel: 5,
    costPerLevel: [{ gold: 100 }, { gold: 200 }, { gold: 400 }, { gold: 800 }, { gold: 1600 }],
    bonusPerLevel: [{ stat: 'stashSlots', value: 10 }],
  },
  {
    id: 'altar', name: '祭坛', description: '临时Buff',
    maxLevel: 3,
    costPerLevel: [{ gold: 500 }, { gold: 1500 }, { gold: 4000 }],
    bonusPerLevel: [{ stat: 'altarBonus', value: 3 }],
  },
];

const PETS: PetDefinition[] = [
  { id: 'pet_sprite', name: '小精灵', description: '可爱的精灵，增加经验获取', rarity: 'common', bonusStat: 'expBonus', bonusValue: 3, bonusPerLevel: 0.5, maxLevel: 20, feedItem: 'c_hp_potion_s' },
  { id: 'pet_dragon', name: '小火龙', description: '火龙幼崽，增加攻击力', rarity: 'rare', bonusStat: 'damage', bonusValue: 5, bonusPerLevel: 1, maxLevel: 20, feedItem: 'c_mp_potion_s' },
  { id: 'pet_owl', name: '猫头鹰', description: '智慧的猫头鹰，增加掉宝率', rarity: 'common', bonusStat: 'magicFind', bonusValue: 5, bonusPerLevel: 1, maxLevel: 20, feedItem: 'c_hp_potion_s' },
  { id: 'pet_cat', name: '暗影猫', description: '神秘的黑猫，增加暴击率', rarity: 'rare', bonusStat: 'critRate', bonusValue: 2, bonusPerLevel: 0.3, maxLevel: 20, feedItem: 'c_mp_potion_s' },
  { id: 'pet_phoenix', name: '凤凰雏', description: '凤凰之子，增加生命回复', rarity: 'epic', bonusStat: 'hpRegen', bonusValue: 3, bonusPerLevel: 0.8, maxLevel: 20, feedItem: 'c_hp_potion_m' },
];

export interface PetInstance {
  petId: string;
  level: number;
  exp: number;
}

export class HomesteadSystem {
  buildings: Record<string, number> = {};
  pets: PetInstance[] = [];
  activePet: string | null = null;

  getBuildingDef(id: string): HomesteadBuilding | undefined {
    return BUILDINGS.find(b => b.id === id);
  }

  getAllBuildings(): HomesteadBuilding[] { return BUILDINGS; }
  getAllPets(): PetDefinition[] { return PETS; }

  getBuildingLevel(id: string): number {
    return this.buildings[id] ?? 0;
  }

  canUpgrade(id: string, gold: number): boolean {
    const def = this.getBuildingDef(id);
    if (!def) return false;
    const currentLevel = this.getBuildingLevel(id);
    if (currentLevel >= def.maxLevel) return false;
    return gold >= def.costPerLevel[currentLevel].gold;
  }

  upgrade(id: string): number {
    const def = this.getBuildingDef(id);
    if (!def) return 0;
    const currentLevel = this.getBuildingLevel(id);
    if (currentLevel >= def.maxLevel) return 0;
    const cost = def.costPerLevel[currentLevel].gold;
    this.buildings[id] = currentLevel + 1;
    EventBus.emit(GameEvents.HOMESTEAD_UPGRADED, { buildingId: id, level: currentLevel + 1 });
    EventBus.emit(GameEvents.LOG_MESSAGE, {
      text: `${def.name} 升级到 Lv.${currentLevel + 1}!`,
      type: 'system',
    });
    return cost;
  }

  getTotalBonuses(): Record<string, number> {
    const bonuses: Record<string, number> = {};
    for (const [id, level] of Object.entries(this.buildings)) {
      const def = this.getBuildingDef(id);
      if (!def) continue;
      for (const bonus of def.bonusPerLevel) {
        bonuses[bonus.stat] = (bonuses[bonus.stat] ?? 0) + bonus.value * level;
      }
    }
    // Active pet bonus
    if (this.activePet) {
      const pet = this.pets.find(p => p.petId === this.activePet);
      if (pet) {
        const def = PETS.find(p => p.id === pet.petId);
        if (def) {
          bonuses[def.bonusStat] = (bonuses[def.bonusStat] ?? 0) + def.bonusValue + def.bonusPerLevel * pet.level;
        }
      }
    }
    return bonuses;
  }

  addPet(petId: string): boolean {
    if (this.pets.find(p => p.petId === petId)) return false;
    const maxSlots = 1 + (this.buildings['pet_house'] ?? 0);
    if (this.pets.length >= maxSlots) {
      EventBus.emit(GameEvents.LOG_MESSAGE, { text: '宠物小屋已满!', type: 'system' });
      return false;
    }
    this.pets.push({ petId, level: 1, exp: 0 });
    const def = PETS.find(p => p.id === petId);
    EventBus.emit(GameEvents.LOG_MESSAGE, {
      text: `获得宠物: ${def?.name ?? petId}!`,
      type: 'system',
    });
    if (!this.activePet) this.activePet = petId;
    return true;
  }

  feedPet(petId: string): boolean {
    const pet = this.pets.find(p => p.petId === petId);
    if (!pet) return false;
    const def = PETS.find(p => p.id === petId);
    if (!def || pet.level >= def.maxLevel) return false;
    pet.exp += 10;
    const needed = pet.level * 20;
    if (pet.exp >= needed) {
      pet.exp -= needed;
      pet.level++;
      EventBus.emit(GameEvents.LOG_MESSAGE, {
        text: `${def.name} 升级到 Lv.${pet.level}!`,
        type: 'system',
      });
    }
    return true;
  }

  setActivePet(petId: string | null): void {
    this.activePet = petId;
  }
}
