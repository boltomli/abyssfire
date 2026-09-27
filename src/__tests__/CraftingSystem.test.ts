import { describe, it, expect } from 'vitest';
import {
  CraftingSystem, craftCost, craftGoldUnit, salvageYield, itemSocketCapacity, countMaterial,
  makeMaterial, lootCraftRoller, upgradeTarget, MATERIAL_IDS, type CraftRoller, type CraftBag,
} from '../systems/CraftingSystem';
import { LootSystem } from '../systems/LootSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { getItemBase, Materials } from '../data/items/bases';
import type { ItemInstance, ItemQuality } from '../data/types';
import zhCN from '../i18n/locales/zh-CN';
import en from '../i18n/locales/en';

let n = 0;
function item(baseId: string, quality: ItemQuality, level = 10, extra: Partial<ItemInstance> = {}): ItemInstance {
  return {
    uid: `t${n++}`, baseId, name: getItemBase(baseId)?.name ?? baseId, quality, level,
    affixes: [], sockets: [], identified: true, quantity: 1, stats: {}, ...extra,
  };
}

/** Deterministic roller: appends affixes named r0, r1, … and records calls. */
function fakeRoller(): CraftRoller & { calls: [number, number, number][] } {
  let k = 0;
  const calls: [number, number, number][] = [];
  return {
    calls,
    rollAffixes(it, level, min, max) {
      calls.push([level, min, max]);
      for (let i = 0; i < max; i++) it.affixes.push({ affixId: `r${k}`, name: `r${k}`, stat: 'str', value: ++k });
    },
    finalize(it) {
      const s: Record<string, number> = {};
      for (const a of it.affixes) s[a.stat] = (s[a.stat] ?? 0) + a.value;
      it.stats = s;
      it.name = `forged:${it.baseId}`;
    },
  };
}

function bagWith(...items: ItemInstance[]): CraftBag {
  return { inventory: [...items] };
}

function mats(scrap = 0, dust = 0, essence = 0): ItemInstance[] {
  const out: ItemInstance[] = [];
  if (scrap) out.push(makeMaterial('m_scrap', scrap));
  if (dust) out.push(makeMaterial('m_dust', dust));
  if (essence) out.push(makeMaterial('m_essence', essence));
  return out;
}

describe('CraftingSystem — data', () => {
  it('materials are stackable material bases with icons and i18n names', () => {
    for (const id of MATERIAL_IDS) {
      const base = getItemBase(id);
      expect(base?.type).toBe('material');
      expect(base?.stackable).toBe(true);
      expect(base?.maxStack).toBeGreaterThan(1);
      expect(base?.icon).toBe(id);
      expect((zhCN as Record<string, string>)[`data.item.${id}.name`]).toBeTruthy();
      expect((en as Record<string, string>)[`data.item.${id}.name`]).toBeTruthy();
    }
    expect(Materials.map(m => m.id)).toEqual([...MATERIAL_IDS]);
  });

  it('every ui.forge key exists in both locales', () => {
    const zh = Object.keys(zhCN).filter(k => k.startsWith('ui.forge.'));
    const enKeys = Object.keys(en).filter(k => k.startsWith('ui.forge.'));
    expect(zh.length).toBeGreaterThan(10);
    expect(new Set(enKeys)).toEqual(new Set(zh));
  });
});

describe('CraftingSystem — costs', () => {
  it('gold scales with item level', () => {
    expect(craftGoldUnit(1)).toBe(36);
    expect(craftGoldUnit(40)).toBe(270);
    const lo = craftCost('reforge', item('w_short_sword', 'magic', 5))!;
    const hi = craftCost('reforge', item('w_short_sword', 'magic', 35))!;
    expect(hi.gold).toBeGreaterThan(lo.gold * 3);
  });

  it('rare work costs more than magic work, upgrades more than rerolls', () => {
    const m = craftCost('reforge', item('w_short_sword', 'magic', 20))!;
    const r = craftCost('reforge', item('w_short_sword', 'rare', 20))!;
    const up = craftCost('upgrade', item('w_short_sword', 'magic', 20))!;
    expect(r.gold).toBeGreaterThan(m.gold);
    expect(up.gold).toBeGreaterThan(r.gold);
    expect(r.materials.m_essence).toBe(1);
  });

  it('actions only apply to fitting qualities / types', () => {
    expect(craftCost('reforge', item('w_short_sword', 'normal'))).toBeNull();
    expect(craftCost('reforge', item('w_short_sword', 'legendary'))).toBeNull();
    expect(craftCost('upgrade', item('w_short_sword', 'rare'))).toBeNull();
    expect(craftCost('socket', item('j_copper_ring', 'magic'))).toBeNull();
    expect(craftCost('salvage', item('c_hp_potion_s', 'normal'))).toBeNull();
    expect(craftCost('salvage', item('j_copper_ring', 'rare'))).toEqual({ gold: 0, materials: {} });
    expect(upgradeTarget('normal')).toBe('magic');
    expect(upgradeTarget('magic')).toBe('rare');
    expect(upgradeTarget('rare')).toBeNull();
  });

  it('costs stay a few kills of gold at each zone (balance guard)', () => {
    // Avg monster gold: ~3 (lv1) … ~80 (lv40). Keep a magic reroll under ~15 kills.
    const perKill = (L: number) => Math.max(3, L * 1.9);
    for (const L of [1, 10, 20, 30, 40]) {
      const c = craftCost('reforge', item('w_short_sword', 'magic', L))!;
      expect(c.gold / perKill(L)).toBeLessThan(15);
    }
  });
});

describe('CraftingSystem — salvage', () => {
  it('yields grow with quality and level', () => {
    expect(salvageYield(item('w_dagger', 'normal', 1))).toEqual({ m_scrap: 2 });
    expect(salvageYield(item('w_dagger', 'magic', 5))).toEqual({ m_scrap: 1, m_dust: 1 });
    expect(salvageYield(item('w_dagger', 'rare', 25))).toEqual({ m_scrap: 3, m_dust: 2, m_essence: 1 });
    const leg = salvageYield(item('w_dagger', 'legendary', 40));
    expect(leg.m_essence).toBeGreaterThanOrEqual(3);
  });

  it('destroys the item, stacks materials and returns socketed gems', () => {
    const sys = new CraftingSystem(fakeRoller());
    const gear = item('w_short_sword', 'rare', 12, {
      sockets: [{ gemId: 'g_ruby_1', name: '碎裂红宝石', stat: 'str', value: 5, tier: 1 }],
    });
    const existing = makeMaterial('m_scrap', 3);
    const bag = bagWith(gear, existing);
    const wallet = { gold: 0 };
    const res = sys.perform('salvage', gear, bag, wallet);
    expect(res.ok).toBe(true);
    expect(bag.inventory.includes(gear)).toBe(false);
    expect(existing.quantity).toBe(3 + 2); // stacked into the existing pile
    expect(countMaterial(bag, 'm_dust')).toBe(1);
    expect(countMaterial(bag, 'm_essence')).toBe(1);
    expect(bag.inventory.some(i => i.baseId === 'g_ruby_1')).toBe(true);
    expect(res.gems?.length).toBe(1);
    expect(wallet.gold).toBe(0);
  });

  it('refuses when the bag cannot hold the output', () => {
    const sys = new CraftingSystem(fakeRoller(), Math.random, 3);
    const gear = item('w_short_sword', 'rare', 12);
    const bag = bagWith(gear, item('w_dagger', 'normal'), item('w_dagger', 'normal'));
    const c = sys.check('salvage', gear, bag, { gold: 0 });
    expect(c.ok).toBe(false);
    expect(c.reason).toBe('bagFull');
  });

  it('refuses items that are not in the bag', () => {
    const sys = new CraftingSystem(fakeRoller());
    const gear = item('w_short_sword', 'magic');
    expect(sys.check('salvage', gear, bagWith(), { gold: 0 }).reason).toBe('notInBag');
  });
});

describe('CraftingSystem — reforge / upgrade / socket', () => {
  it('reforge rerolls affixes, keeps base + quality and spends gold + materials', () => {
    const roller = fakeRoller();
    const sys = new CraftingSystem(roller);
    const gear = item('w_broad_sword', 'rare', 22, {
      affixes: [{ affixId: 'old', name: 'old', stat: 'dex', value: 9 }], identified: false,
    });
    const bag = bagWith(gear, ...mats(0, 5, 2));
    const cost = craftCost('reforge', gear)!;
    const wallet = { gold: cost.gold + 7 };
    const res = sys.perform('reforge', gear, bag, wallet);
    expect(res.ok).toBe(true);
    expect(gear.baseId).toBe('w_broad_sword');
    expect(gear.quality).toBe('rare');
    expect(gear.affixes.some(a => a.affixId === 'old')).toBe(false);
    expect(roller.calls).toEqual([[22, 3, 4]]);
    expect(gear.identified).toBe(true);
    expect(gear.name).toBe('forged:w_broad_sword');
    expect(wallet.gold).toBe(7);
    expect(countMaterial(bag, 'm_dust')).toBe(3);
    expect(countMaterial(bag, 'm_essence')).toBe(1);
  });

  it('removes emptied material stacks', () => {
    const sys = new CraftingSystem(fakeRoller());
    const gear = item('w_short_sword', 'magic', 3);
    const bag = bagWith(gear, ...mats(2, 1));
    sys.perform('reforge', gear, bag, { gold: 9999 });
    expect(bag.inventory).toEqual([gear]);
  });

  it('blocks on gold, then materials', () => {
    const sys = new CraftingSystem(fakeRoller());
    const gear = item('w_short_sword', 'magic', 10);
    const bag = bagWith(gear, ...mats(2));
    expect(sys.check('reforge', gear, bag, { gold: 0 }).reason).toBe('gold');
    expect(sys.check('reforge', gear, bag, { gold: 99999 }).reason).toBe('materials');
    const wallet = { gold: 5 };
    const res = sys.perform('reforge', gear, bag, wallet);
    expect(res.ok).toBe(false);
    expect(wallet.gold).toBe(5);
    expect(countMaterial(bag, 'm_scrap')).toBe(2);
  });

  it('upgrade normal → magic → rare keeps existing affixes', () => {
    const roller = fakeRoller();
    const sys = new CraftingSystem(roller, () => 0.99);
    const gear = item('a_chain_mail', 'normal', 15);
    const bag = bagWith(gear, ...mats(10, 10, 5));
    const wallet = { gold: 100000 };
    expect(sys.perform('upgrade', gear, bag, wallet).ok).toBe(true);
    expect(gear.quality).toBe('magic');
    expect(gear.affixes.length).toBe(2); // rng 0.99 → top of 1..2
    const kept = gear.affixes.map(a => a.affixId);
    expect(sys.perform('upgrade', gear, bag, wallet).ok).toBe(true);
    expect(gear.quality).toBe('rare');
    expect(gear.affixes.length).toBe(4);
    expect(gear.affixes.slice(0, 2).map(a => a.affixId)).toEqual(kept);
    expect(sys.check('upgrade', gear, bag, wallet).reason).toBe('quality');
  });

  it('socket punching adds one socket to weapons/armour, capped at 3', () => {
    const sys = new CraftingSystem(fakeRoller());
    const rusty = item('w_rusty_sword', 'normal', 5); // base 0 sockets
    const bag = bagWith(rusty, ...mats(20, 0, 5));
    const wallet = { gold: 100000 };
    expect(itemSocketCapacity(rusty)).toBe(0);
    expect(sys.perform('socket', rusty, bag, wallet).ok).toBe(true);
    expect(itemSocketCapacity(rusty)).toBe(1);
    expect(sys.check('socket', rusty, bag, wallet).reason).toBe('maxSockets');

    const demon = item('w_demon_blade', 'magic', 35); // base 3 sockets
    bag.inventory.push(demon);
    expect(sys.check('socket', demon, bag, wallet).reason).toBe('maxSockets');

    const ring = item('j_gold_ring', 'magic', 20);
    bag.inventory.push(ring);
    expect(sys.check('socket', ring, bag, wallet).ok).toBe(false);
  });

  it('punched sockets accept gems through InventorySystem', () => {
    const inv = new InventorySystem();
    const rusty = item('w_rusty_sword', 'normal', 5, { bonusSockets: 1 });
    inv.equipment.weapon = rusty;
    inv.inventory.push(item('g_ruby_1', 'normal', 1));
    expect(inv.getMaxSockets('weapon')).toBe(1);
    expect(inv.socketGem('weapon', inv.inventory[0].uid)).toBe(true);
    expect(rusty.stats.str).toBe(5);
  });

  it('unknown bases never crash and are refused', () => {
    const sys = new CraftingSystem(fakeRoller());
    const ghost = item('x_removed_item', 'rare', 10);
    const bag = bagWith(ghost);
    expect(sys.check('reforge', ghost, bag, { gold: 1e9 })).toMatchObject({ ok: false, reason: 'unknownBase' });
    expect(sys.perform('salvage', ghost, bag, { gold: 0 }).ok).toBe(false);
    expect(itemSocketCapacity(ghost)).toBe(0);
    expect(salvageYield(ghost).m_scrap).toBeGreaterThan(0);
  });
});

describe('CraftingSystem — with the real LootSystem', () => {
  it('reforges a rare with 3-4 level-appropriate affixes and a rebuilt name', () => {
    const loot = new LootSystem();
    const sys = new CraftingSystem(lootCraftRoller(loot));
    for (let i = 0; i < 20; i++) {
      const gear = loot.createItem('w_claymore', 30, 'rare')!;
      const bag = bagWith(gear, ...mats(0, 2, 1));
      expect(sys.perform('reforge', gear, bag, { gold: 1e6 }).ok).toBe(true);
      expect(gear.affixes.length).toBeGreaterThanOrEqual(3);
      expect(gear.affixes.length).toBeLessThanOrEqual(4);
      expect(new Set(gear.affixes.map(a => a.affixId)).size).toBe(gear.affixes.length);
      const sum = gear.affixes.reduce((s, a) => s + a.value, 0);
      const statSum = Object.values(gear.stats).reduce((s: number, v) => s + (v ?? 0), 0);
      expect(statSum).toBe(sum);
    }
  });

  it('upgrading a normal item names it after its new affixes', () => {
    const loot = new LootSystem();
    const sys = new CraftingSystem(lootCraftRoller(loot));
    const gear = loot.createItem('a_chain_mail', 12, 'normal')!;
    const bag = bagWith(gear, ...mats(3, 1));
    expect(sys.perform('upgrade', gear, bag, { gold: 1e6 }).ok).toBe(true);
    expect(gear.quality).toBe('magic');
    expect(gear.affixes.length).toBeGreaterThanOrEqual(1);
    expect(gear.name).not.toBe(getItemBase('a_chain_mail')!.name);
  });
});
