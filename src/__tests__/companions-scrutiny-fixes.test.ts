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

import { MercenarySystem, MERCENARY_DEFS } from '../systems/MercenarySystem';
import { getItemBase } from '../data/items/bases';
import type { ItemInstance, WeaponBase, ArmorBase } from '../data/types';
import { TwilightForestMap } from '../data/maps/twilight_forest';
import { ScorchingDesertMap } from '../data/maps/scorching_desert';

// ═══════════════════════════════════════════════════════════════════════
// Issue 1: pet_void_butterfly rare spawn acquisition
// ═══════════════════════════════════════════════════════════════════════

describe('pet_void_butterfly rare spawns', () => {
  it('Twilight Forest has petSpawns defined with pet_void_butterfly', () => {
    expect(TwilightForestMap.petSpawns).toBeDefined();
    expect(TwilightForestMap.petSpawns!.length).toBeGreaterThanOrEqual(1);
    const voidButterfly = TwilightForestMap.petSpawns!.filter(s => s.petId === 'pet_void_butterfly');
    expect(voidButterfly.length).toBeGreaterThanOrEqual(1);
  });

  it('Scorching Desert has petSpawns defined with pet_void_butterfly', () => {
    expect(ScorchingDesertMap.petSpawns).toBeDefined();
    expect(ScorchingDesertMap.petSpawns!.length).toBeGreaterThanOrEqual(1);
    const voidButterfly = ScorchingDesertMap.petSpawns!.filter(s => s.petId === 'pet_void_butterfly');
    expect(voidButterfly.length).toBeGreaterThanOrEqual(1);
  });

  it('pet_void_butterfly spawn chance is low (< 0.15)', () => {
    for (const spawn of TwilightForestMap.petSpawns!) {
      if (spawn.petId === 'pet_void_butterfly') {
        expect(spawn.chance).toBeGreaterThan(0);
        expect(spawn.chance).toBeLessThan(0.15);
      }
    }
    for (const spawn of ScorchingDesertMap.petSpawns!) {
      if (spawn.petId === 'pet_void_butterfly') {
        expect(spawn.chance).toBeGreaterThan(0);
        expect(spawn.chance).toBeLessThan(0.15);
      }
    }
  });

  it('pet spawn coordinates are within map bounds', () => {
    for (const spawn of TwilightForestMap.petSpawns!) {
      expect(spawn.col).toBeGreaterThanOrEqual(1);
      expect(spawn.col).toBeLessThan(TwilightForestMap.cols - 1);
      expect(spawn.row).toBeGreaterThanOrEqual(1);
      expect(spawn.row).toBeLessThan(TwilightForestMap.rows - 1);
    }
    for (const spawn of ScorchingDesertMap.petSpawns!) {
      expect(spawn.col).toBeGreaterThanOrEqual(1);
      expect(spawn.col).toBeLessThan(ScorchingDesertMap.cols - 1);
      expect(spawn.row).toBeGreaterThanOrEqual(1);
      expect(spawn.row).toBeLessThan(ScorchingDesertMap.rows - 1);
    }
  });

  it('pet spawns are in at least 2 zones', () => {
    const zonesWithSpawns = [TwilightForestMap, ScorchingDesertMap].filter(
      m => m.petSpawns && m.petSpawns.some(s => s.petId === 'pet_void_butterfly')
    );
    expect(zonesWithSpawns.length).toBeGreaterThanOrEqual(2);
  });

  it('pet spawn points are not inside camp safe zones', () => {
    for (const map of [TwilightForestMap, ScorchingDesertMap]) {
      const safeRadius = map.safeZoneRadius ?? 9;
      for (const spawn of map.petSpawns!) {
        for (const camp of map.camps) {
          const dx = spawn.col - camp.col;
          const dy = spawn.row - camp.row;
          const dist = Math.sqrt(dx * dx + dy * dy);
          expect(dist).toBeGreaterThan(safeRadius);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Issue 2: MercenarySystem type-safe equipment checks
// ═══════════════════════════════════════════════════════════════════════

describe('MercenarySystem type-safe equipment checks', () => {
  let system: MercenarySystem;

  function makeItem(baseId: string): ItemInstance {
    return {
      uid: `test_${baseId}`,
      baseId,
      name: 'Test Item',
      quality: 'normal',
      level: 1,
      affixes: [],
      sockets: [],
      identified: true,
      quantity: 1,
      stats: {},
    };
  }

  beforeEach(() => {
    system = new MercenarySystem();
    system.hire('tank', 10000); // hire a tank mercenary with plenty of gold
  });

  it('canEquipWeapon returns true for allowed weapon types via base lookup', () => {
    // Tank allows sword and shield
    const swordItem = makeItem('w_rusty_sword'); // type: weapon, weaponType: sword
    expect(system.canEquipWeapon(swordItem)).toBe(true);
  });

  it('canEquipWeapon returns false for disallowed weapon types', () => {
    // Tank does not allow bow
    const bowItem = makeItem('w_short_bow'); // type: weapon, weaponType: bow
    expect(system.canEquipWeapon(bowItem)).toBe(false);
  });

  it('canEquipWeapon returns false for non-weapon items', () => {
    const armorItem = makeItem('a_cloth_cap'); // type: armor
    expect(system.canEquipWeapon(armorItem)).toBe(false);
  });

  it('canEquipWeapon returns false for consumable items', () => {
    const potion = makeItem('c_hp_potion_s'); // type: consumable
    expect(system.canEquipWeapon(potion)).toBe(false);
  });

  it('canEquipWeapon returns false with invalid baseId', () => {
    const invalidItem = makeItem('nonexistent_item');
    expect(system.canEquipWeapon(invalidItem)).toBe(false);
  });

  it('canEquipArmor returns true for armor items via base lookup', () => {
    const armorItem = makeItem('a_cloth_cap'); // type: armor
    expect(system.canEquipArmor(armorItem)).toBe(true);
  });

  it('canEquipArmor returns false for weapon items', () => {
    const swordItem = makeItem('w_rusty_sword'); // type: weapon
    expect(system.canEquipArmor(swordItem)).toBe(false);
  });

  it('canEquipArmor returns false for accessory items', () => {
    const accessory = makeItem('j_copper_ring'); // type: accessory
    expect(system.canEquipArmor(accessory)).toBe(false);
  });

  it('canEquipArmor returns false with invalid baseId', () => {
    const invalidItem = makeItem('nonexistent_item');
    expect(system.canEquipArmor(invalidItem)).toBe(false);
  });

  it('canEquipWeapon returns false with no active mercenary', () => {
    system.dismiss();
    const swordItem = makeItem('w_rusty_sword');
    expect(system.canEquipWeapon(swordItem)).toBe(false);
  });

  it('canEquipArmor returns false with no active mercenary', () => {
    system.dismiss();
    const armorItem = makeItem('a_cloth_cap');
    expect(system.canEquipArmor(armorItem)).toBe(false);
  });

  it('canEquipWeapon uses getItemBase for type-safe lookup (not direct property access)', () => {
    // An ItemInstance does NOT have a 'type' or 'weaponType' property — those live on the base.
    // If the method uses type-safe base lookup, it works correctly with standard ItemInstances.
    // A fabricated item with no matching base should return false (not crash or return true):
    const fabricatedItem: ItemInstance = {
      uid: 'fake_123',
      baseId: 'does_not_exist_in_bases',
      name: 'Fake Sword',
      quality: 'normal',
      level: 1,
      affixes: [],
      sockets: [],
      identified: true,
      quantity: 1,
      stats: {},
    };
    // Should return false because getItemBase returns undefined for unknown baseId
    expect(system.canEquipWeapon(fabricatedItem)).toBe(false);
    expect(system.canEquipArmor(fabricatedItem)).toBe(false);
  });

  it('getItemBase correctly resolves weapon base data', () => {
    const base = getItemBase('w_rusty_sword');
    expect(base).toBeDefined();
    expect(base!.type).toBe('weapon');
    expect((base as WeaponBase).weaponType).toBe('sword');
  });

  it('getItemBase correctly resolves armor base data', () => {
    const base = getItemBase('a_cloth_cap');
    expect(base).toBeDefined();
    expect(base!.type).toBe('armor');
    expect((base as ArmorBase).slot).toBe('helmet');
  });

  it('ranged mercenary can equip bows but not swords', () => {
    const rangedSystem = new MercenarySystem();
    rangedSystem.hire('ranged', 10000);
    const bow = makeItem('w_short_bow');
    const sword = makeItem('w_rusty_sword');
    expect(rangedSystem.canEquipWeapon(bow)).toBe(true);
    expect(rangedSystem.canEquipWeapon(sword)).toBe(false);
  });

  it('mage mercenary can equip staffs but not axes', () => {
    const mageSystem = new MercenarySystem();
    mageSystem.hire('mage', 10000);
    const staff = makeItem('w_oak_staff');
    const axe = makeItem('w_battle_axe');
    expect(mageSystem.canEquipWeapon(staff)).toBe(true);
    expect(mageSystem.canEquipWeapon(axe)).toBe(false);
  });
});
