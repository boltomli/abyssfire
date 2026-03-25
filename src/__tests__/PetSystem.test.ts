import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser before importing modules that depend on it
vi.mock('phaser', () => ({
  default: {
    Events: {
      EventEmitter: class MockEventEmitter {
        private handlers = new Map<string, Function[]>();
        on(event: string, fn: Function) {
          if (!this.handlers.has(event)) this.handlers.set(event, []);
          this.handlers.get(event)!.push(fn);
          return this;
        }
        off(event: string, fn: Function) {
          const fns = this.handlers.get(event);
          if (fns) this.handlers.set(event, fns.filter(f => f !== fn));
          return this;
        }
        emit(event: string, ...args: any[]) {
          const fns = this.handlers.get(event);
          if (fns) fns.forEach(fn => fn(...args));
          return true;
        }
      }
    }
  }
}));

import { HomesteadSystem, type PetInstance } from '../systems/HomesteadSystem';
import type { PetDefinition } from '../data/types';

describe('PetSystem', () => {
  let hs: HomesteadSystem;

  beforeEach(() => {
    hs = new HomesteadSystem();
  });

  // ═══ Pet Definitions ════════════════════════════════════════════════

  describe('Pet Definitions', () => {
    it('has 5 original pets retained', () => {
      const pets = hs.getAllPets();
      const originalIds = ['pet_sprite', 'pet_dragon', 'pet_owl', 'pet_cat', 'pet_phoenix'];
      for (const id of originalIds) {
        expect(pets.find(p => p.id === id)).toBeDefined();
      }
    });

    it('has 3 new rare/epic pets', () => {
      const pets = hs.getAllPets();
      const newIds = ['pet_storm_wolf', 'pet_jade_tortoise', 'pet_void_butterfly'];
      for (const id of newIds) {
        const def = pets.find(p => p.id === id);
        expect(def).toBeDefined();
        expect(def!.rarity).toBe('epic');
      }
    });

    it('has 8 total pets', () => {
      expect(hs.getAllPets().length).toBe(8);
    });

    it('all pets have unique bonusStat among new pets', () => {
      const newPets = hs.getAllPets().filter(p =>
        ['pet_storm_wolf', 'pet_jade_tortoise', 'pet_void_butterfly'].includes(p.id)
      );
      const stats = newPets.map(p => p.bonusStat);
      expect(new Set(stats).size).toBe(3);
      expect(stats).toContain('attackSpeed');
      expect(stats).toContain('defense');
      expect(stats).toContain('manaRegen');
    });

    it('all pets have maxLevel 20', () => {
      for (const pet of hs.getAllPets()) {
        expect(pet.maxLevel).toBe(20);
      }
    });

    it('all pets have valid feedItem', () => {
      for (const pet of hs.getAllPets()) {
        expect(pet.feedItem).toBeTruthy();
        expect(typeof pet.feedItem).toBe('string');
      }
    });
  });

  // ═══ Pet Acquisition ════════════════════════════════════════════════

  describe('Pet Acquisition', () => {
    it('adds a pet successfully when capacity available', () => {
      const result = hs.addPet('pet_sprite');
      expect(result).toBe(true);
      expect(hs.pets.length).toBe(1);
      expect(hs.pets[0].petId).toBe('pet_sprite');
      expect(hs.pets[0].level).toBe(1);
      expect(hs.pets[0].exp).toBe(0);
      expect(hs.pets[0].evolved).toBe(0);
    });

    it('auto-activates first pet', () => {
      hs.addPet('pet_sprite');
      expect(hs.activePet).toBe('pet_sprite');
    });

    it('prevents duplicate pets', () => {
      hs.addPet('pet_sprite');
      const result = hs.addPet('pet_sprite');
      expect(result).toBe(false);
      expect(hs.pets.length).toBe(1);
    });

    it('blocks duplicate pets', () => {
      hs.addPet('pet_sprite');
      const result = hs.addPet('pet_sprite');
      expect(result).toBe(false);
      expect(hs.pets.length).toBe(1);
    });

    it('allows all 8 unique pets without capacity limit', () => {
      const allPetIds = hs.getAllPets().map(p => p.id);
      expect(allPetIds.length).toBe(8);
      for (const id of allPetIds) {
        expect(hs.addPet(id)).toBe(true);
      }
      expect(hs.pets.length).toBe(8);
    });

    it('pet_house provides pet EXP bonus instead of capacity', () => {
      expect(hs.getPetExpBonus()).toBe(1); // no pet_house
      hs.buildings['pet_house'] = 1;
      expect(hs.getPetExpBonus()).toBeCloseTo(1.1);
      hs.buildings['pet_house'] = 3;
      expect(hs.getPetExpBonus()).toBeCloseTo(1.3);
      hs.buildings['pet_house'] = 5;
      expect(hs.getPetExpBonus()).toBeCloseTo(1.5);
    });
  });

  // ═══ Feeding and Leveling ═══════════════════════════════════════════

  describe('Feeding and Leveling', () => {
    beforeEach(() => {
      hs.addPet('pet_sprite');
    });

    it('feedPet grants exp', () => {
      hs.feedPet('pet_sprite');
      expect(hs.pets[0].exp).toBe(10);
    });

    it('pet levels up at threshold (level * 20)', () => {
      // Level 1 needs 20 exp
      hs.feedPet('pet_sprite'); // +10 => 10
      hs.feedPet('pet_sprite'); // +10 => 20 => level up, exp resets
      expect(hs.pets[0].level).toBe(2);
      expect(hs.pets[0].exp).toBe(0);
    });

    it('pet levels up correctly at level 2 (needs 40 exp)', () => {
      // Get to level 2
      hs.feedPet('pet_sprite');
      hs.feedPet('pet_sprite');
      expect(hs.pets[0].level).toBe(2);
      // Level 2 needs 40 exp
      for (let i = 0; i < 4; i++) hs.feedPet('pet_sprite');
      expect(hs.pets[0].level).toBe(3);
    });

    it('max level (20) prevents further leveling', () => {
      hs.pets[0].level = 20;
      const result = hs.feedPet('pet_sprite');
      expect(result).toBe(false);
      expect(hs.pets[0].level).toBe(20);
    });

    it('feedPet returns false for unknown pet', () => {
      expect(hs.feedPet('nonexistent')).toBe(false);
    });

    it('feedPet returns false for non-owned pet', () => {
      expect(hs.feedPet('pet_dragon')).toBe(false);
    });
  });

  // ═══ Evolution System ═══════════════════════════════════════════════

  describe('Evolution', () => {
    beforeEach(() => {
      hs.addPet('pet_sprite');
    });

    it('pet evolves at level 10 (stage 1: 觉醒)', () => {
      hs.pets[0].level = 9;
      hs.pets[0].exp = 9 * 20 - 10; // near level up (need 180, have 170)
      hs.feedPet('pet_sprite'); // +10 => 180 => level up to 10
      expect(hs.pets[0].level).toBe(10);
      expect(hs.pets[0].evolved).toBe(1);
    });

    it('pet evolves at level 20 (stage 2: 至尊)', () => {
      hs.pets[0].level = 19;
      hs.pets[0].exp = 19 * 20 - 10;
      hs.feedPet('pet_sprite');
      expect(hs.pets[0].level).toBe(20);
      expect(hs.pets[0].evolved).toBe(2);
    });

    it('evolution multiplier is 1.0 at stage 0', () => {
      expect(hs.getEvolutionMultiplier(hs.pets[0])).toBe(1.0);
    });

    it('evolution multiplier is 1.5 at stage 1', () => {
      hs.pets[0].evolved = 1;
      expect(hs.getEvolutionMultiplier(hs.pets[0])).toBe(1.5);
    });

    it('evolution multiplier is 2.0 at stage 2', () => {
      hs.pets[0].evolved = 2;
      expect(hs.getEvolutionMultiplier(hs.pets[0])).toBe(2.0);
    });

    it('display name includes evolution suffix', () => {
      expect(hs.getPetDisplayName(hs.pets[0])).toBe('小精灵');
      hs.pets[0].evolved = 1;
      expect(hs.getPetDisplayName(hs.pets[0])).toBe('小精灵·觉醒');
      hs.pets[0].evolved = 2;
      expect(hs.getPetDisplayName(hs.pets[0])).toBe('小精灵·至尊');
    });

    it('evolution boosts stat bonuses via getTotalBonuses', () => {
      hs.activePet = 'pet_sprite';
      hs.pets[0].level = 10;
      hs.pets[0].evolved = 0;
      const bonusesBase = hs.getTotalBonuses();
      const baseVal = bonusesBase['expBonus'] ?? 0;

      hs.pets[0].evolved = 1;
      const bonusesEvolved = hs.getTotalBonuses();
      const evolvedVal = bonusesEvolved['expBonus'] ?? 0;

      expect(evolvedVal).toBeGreaterThan(baseVal);
      // Should be ~1.5x
      expect(evolvedVal / baseVal).toBeCloseTo(1.5, 0);
    });
  });

  // ═══ Active Pet Bonuses ═════════════════════════════════════════════

  describe('Active Pet Bonuses', () => {
    beforeEach(() => {
      hs.addPet('pet_sprite');
    });

    it('active pet bonus included in getTotalBonuses', () => {
      hs.activePet = 'pet_sprite';
      const bonuses = hs.getTotalBonuses();
      expect(bonuses['expBonus']).toBeGreaterThan(0);
    });

    it('deactivating pet removes bonus', () => {
      hs.activePet = 'pet_sprite';
      const withPet = hs.getTotalBonuses();
      hs.activePet = null;
      const withoutPet = hs.getTotalBonuses();
      expect(withPet['expBonus']).toBeGreaterThan(withoutPet['expBonus'] ?? 0);
    });

    it('changing active pet changes bonus', () => {
      hs.addPet('pet_dragon');
      hs.activePet = 'pet_sprite';
      const spriteBonus = hs.getTotalBonuses();
      hs.activePet = 'pet_dragon';
      const dragonBonus = hs.getTotalBonuses();
      expect(spriteBonus['expBonus']).toBeGreaterThan(0);
      expect(dragonBonus['damage']).toBeGreaterThan(0);
      expect(spriteBonus['damage'] ?? 0).toBe(0);
    });
  });

  // ═══ Pet Combat Damage ═════════════════════════════════════════════

  describe('Pet Combat Damage', () => {
    beforeEach(() => {
      hs.addPet('pet_sprite');
      hs.activePet = 'pet_sprite';
    });

    it('calculates pet damage as 5% at level 1', () => {
      const dmg = hs.calculatePetDamage(100);
      expect(dmg).toBe(5); // 5% + 1*0.5% = 5.5% => floor(5.5) = 5
    });

    it('pet damage scales with level', () => {
      hs.pets[0].level = 10;
      const dmg = hs.calculatePetDamage(100);
      // 5% + 10*0.5% = 10%
      expect(dmg).toBe(10);
    });

    it('pet damage caps at 15% at level 20', () => {
      hs.pets[0].level = 20;
      const dmg = hs.calculatePetDamage(100);
      // 5% + 20*0.5% = 15% => capped at 15%
      expect(dmg).toBe(15);
    });

    it('evolution boosts pet combat damage', () => {
      hs.pets[0].level = 10;
      hs.pets[0].evolved = 0;
      const base = hs.calculatePetDamage(100);
      hs.pets[0].evolved = 1;
      const evolved = hs.calculatePetDamage(100);
      expect(evolved).toBeGreaterThan(base);
      // 10% * 1.5 = 15%
      expect(evolved).toBe(15);
    });

    it('returns 0 when no active pet', () => {
      hs.activePet = null;
      expect(hs.calculatePetDamage(100)).toBe(0);
    });

    it('minimum damage is 1 for reasonable player damage', () => {
      const dmg = hs.calculatePetDamage(20);
      expect(dmg).toBeGreaterThanOrEqual(1);
    });

    it('canPetAttack respects interval', () => {
      expect(hs.canPetAttack(0)).toBe(true);
      hs.recordPetAttack(0);
      expect(hs.canPetAttack(1000)).toBe(false);
      expect(hs.canPetAttack(3000)).toBe(true);
    });
  });

  // ═══ Homestead Integration ═════════════════════════════════════════

  describe('Homestead Integration', () => {
    it('pet_house building provides pet EXP bonus', () => {
      expect(hs.getPetExpBonus()).toBe(1);
      hs.buildings['pet_house'] = 3;
      expect(hs.getPetExpBonus()).toBeCloseTo(1.3);
    });

    it('training_ground provides mercenary exp bonus', () => {
      expect(hs.getTrainingGroundBonus()).toBe(0);
      hs.buildings['training_ground'] = 3;
      expect(hs.getTrainingGroundBonus()).toBe(15); // 3 * 5%
    });

    it('pet_house has maxLevel 5', () => {
      const def = hs.getBuildingDef('pet_house');
      expect(def).toBeDefined();
      expect(def!.maxLevel).toBe(5);
    });

    it('training_ground emits mercExpBonus not expBonus', () => {
      hs.buildings['training_ground'] = 2;
      const bonuses = hs.getTotalBonuses();
      expect(bonuses['mercExpBonus']).toBe(10);
      expect(bonuses['expBonus'] ?? 0).toBe(0);
    });
  });

  // ═══ Save/Load ═════════════════════════════════════════════════════

  describe('Save/Load', () => {
    it('pet state round-trips correctly', () => {
      hs.buildings['pet_house'] = 3;
      hs.addPet('pet_sprite');
      hs.addPet('pet_dragon');
      hs.pets[0].level = 10;
      hs.pets[0].exp = 50;
      hs.pets[0].evolved = 1;
      hs.activePet = 'pet_dragon';

      // Simulate save
      const saveData = {
        buildings: { ...hs.buildings },
        pets: hs.pets.map(p => ({ ...p })),
        activePet: hs.activePet ?? undefined,
      };

      // Create fresh system and restore
      const hs2 = new HomesteadSystem();
      hs2.buildings = saveData.buildings;
      hs2.pets = saveData.pets.map(p => ({
        petId: p.petId,
        level: p.level,
        exp: p.exp,
        evolved: p.evolved ?? 0,
      }));
      hs2.activePet = saveData.activePet ?? null;

      expect(hs2.pets.length).toBe(2);
      expect(hs2.pets[0].level).toBe(10);
      expect(hs2.pets[0].evolved).toBe(1);
      expect(hs2.activePet).toBe('pet_dragon');
      expect(hs2.getPetExpBonus()).toBeCloseTo(1.3); // pet_house level 3
    });

    it('old saves without evolved field default to 0', () => {
      const oldPet = { petId: 'pet_sprite', level: 5, exp: 10 } as any;
      const restored = {
        petId: oldPet.petId,
        level: oldPet.level,
        exp: oldPet.exp,
        evolved: oldPet.evolved ?? 0,
      };
      expect(restored.evolved).toBe(0);
    });
  });

  // ═══ Clean State on New Game ═══════════════════════════════════════

  describe('Clean State', () => {
    it('resetState clears everything', () => {
      hs.buildings['pet_house'] = 3;
      hs.addPet('pet_sprite');
      hs.activePet = 'pet_sprite';
      hs.petLastAttackTime = 5000;

      hs.resetState();

      expect(hs.buildings).toEqual({});
      expect(hs.pets).toEqual([]);
      expect(hs.activePet).toBeNull();
      expect(hs.petLastAttackTime).toBe(-Infinity);
    });

    it('default state has no pets, no active pet', () => {
      const fresh = new HomesteadSystem();
      expect(fresh.pets).toEqual([]);
      expect(fresh.activePet).toBeNull();
      expect(fresh.getPetExpBonus()).toBe(1);
    });
  });

  // ═══ Edge Cases ════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('getPetDef returns undefined for unknown pet', () => {
      expect(hs.getPetDef('nonexistent')).toBeUndefined();
    });

    it('getActivePetInstance returns undefined when no active pet', () => {
      expect(hs.getActivePetInstance()).toBeUndefined();
    });

    it('getPetDisplayName handles unknown pet gracefully', () => {
      const fakePet: PetInstance = { petId: 'unknown', level: 1, exp: 0, evolved: 0 };
      expect(hs.getPetDisplayName(fakePet)).toBe('unknown');
    });

    it('calculating damage with 0 player damage returns 0', () => {
      hs.addPet('pet_sprite');
      hs.activePet = 'pet_sprite';
      // With 0 base damage but minimum 1
      const dmg = hs.calculatePetDamage(0);
      expect(dmg).toBe(0);
    });

    it('multiple pets with different activation', () => {
      hs.addPet('pet_sprite');
      hs.addPet('pet_dragon');
      hs.addPet('pet_owl');

      hs.setActivePet('pet_owl');
      expect(hs.activePet).toBe('pet_owl');
      const bonuses = hs.getTotalBonuses();
      expect(bonuses['magicFind']).toBeGreaterThan(0);
    });

    it('feedPet at level 19 levels up and evolves to 20 (dual evolution)', () => {
      hs.addPet('pet_sprite');
      hs.pets[0].level = 9;
      hs.pets[0].exp = 9 * 20 - 10; // Will level up to 10 on feed
      hs.feedPet('pet_sprite');
      expect(hs.pets[0].level).toBe(10);
      expect(hs.pets[0].evolved).toBe(1);

      // Now get to level 20
      hs.pets[0].level = 19;
      hs.pets[0].exp = 19 * 20 - 10;
      hs.feedPet('pet_sprite');
      expect(hs.pets[0].level).toBe(20);
      expect(hs.pets[0].evolved).toBe(2);
    });
  });
});
