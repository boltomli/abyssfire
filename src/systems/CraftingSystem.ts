/**
 * Blacksmith crafting (锻造): salvage, reforge, upgrade and socket punching.
 *
 * Pure rules — no Phaser, no EventBus. Affix rolling and name/stat rebuilding
 * are injected (`CraftRoller`, normally `lootCraftRoller(lootSystem)`) so the
 * rules are unit-testable with a deterministic roller and RNG. The UI
 * (UIScene's blacksmith "锻造" tab) only calls `check()` / `perform()`.
 *
 * Economy (item level L, gold unit U = 6 × (L + 5)):
 *   salvage   free        → scrap 1+⌊L/12⌋ (+1 if normal); magic: dust 1+⌊L/20⌋;
 *                           rare: + essence 1; legendary/set: dust 2+⌊L/20⌋, essence 2+⌊L/25⌋.
 *                           Socketed gems come back to the bag.
 *   reforge   magic 1U + 2 scrap + 1 dust · rare 2U + 2 dust + 1 essence
 *   upgrade   normal→magic 2U + 3 scrap + 1 dust · magic→rare 5U + 4 dust + 1 essence
 *   socket    3U + 4 scrap + 1 essence (weapons/armour, +1 socket per item, max 3 in total)
 * A zone-1 kill pays ~3 gold, zone 3 ~30, zone 5 ~80, so a reroll costs a handful of
 * kills while the materials — i.e. the loot you break down — are the real price.
 */
import { getItemBase } from '../data/items/bases';
import type { ItemInstance, ItemQuality, WeaponBase, ArmorBase, GemInstance } from '../data/types';

export type MaterialId = 'm_scrap' | 'm_dust' | 'm_essence';
/** Display order (cheapest first). */
export const MATERIAL_IDS: readonly MaterialId[] = ['m_scrap', 'm_dust', 'm_essence'];

export type CraftAction = 'salvage' | 'reforge' | 'upgrade' | 'socket';
export const CRAFT_ACTIONS: readonly CraftAction[] = ['salvage', 'reforge', 'upgrade', 'socket'];

export type MaterialBag = Partial<Record<MaterialId, number>>;

export interface CraftCost {
  gold: number;
  materials: MaterialBag;
}

/** Why an action is unavailable (UI maps these to `ui.forge.block.<reason>`). */
export type CraftBlock =
  | 'unknownBase' | 'notEquipment' | 'notInBag' | 'quality' | 'maxSockets' | 'gold' | 'materials' | 'bagFull';

export interface CraftCheck {
  ok: boolean;
  reason?: CraftBlock;
  /** Null when the action does not apply to this item at all. */
  cost: CraftCost | null;
}

/** The parts of InventorySystem crafting touches. */
export interface CraftBag {
  inventory: ItemInstance[];
}

/** Anything with gold (the Player). */
export interface CraftWallet {
  gold: number;
}

/** Loot callbacks (see `lootCraftRoller`). */
export interface CraftRoller {
  /** Append between min and max random affixes suited to `level` (skips affixes already on the item). */
  rollAffixes(item: ItemInstance, level: number, min: number, max: number): void;
  /** Rebuild the item's name and stats from its affixes and sockets. */
  finalize(item: ItemInstance): void;
}

export interface CraftResult {
  ok: boolean;
  reason?: CraftBlock;
  action: CraftAction;
  /** The crafted item (salvage: the destroyed item). */
  item: ItemInstance;
  cost?: CraftCost;
  /** Salvage: materials gained. */
  yields?: MaterialBag;
  /** Salvage: gems pulled out of the item's sockets (returned to the bag). */
  gems?: GemInstance[];
}

/** Hard cap on sockets per item (base + punched). */
export const MAX_ITEM_SOCKETS = 3;
/** Sockets the blacksmith may add to one item. */
export const MAX_BONUS_SOCKETS = 1;
/** Bag size (mirrors InventorySystem). */
export const CRAFT_BAG_CAPACITY = 100;

const AFFIX_RANGE: Partial<Record<ItemQuality, [number, number]>> = {
  magic: [1, 2],
  rare: [3, 4],
};

let uidCounter = 0;
function craftUid(): string {
  return `craft_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
}

/** Base socket count of an item's base (0 for accessories / unknown bases). */
export function baseSocketCount(item: ItemInstance): number {
  const base = getItemBase(item.baseId);
  if (!base || !('sockets' in base)) return 0;
  const n = (base as WeaponBase | ArmorBase).sockets;
  return typeof n === 'number' ? n : 0;
}

/** Sockets an item can hold: its base's plus any the blacksmith punched. */
export function itemSocketCapacity(item: ItemInstance): number {
  return baseSocketCount(item) + Math.max(0, item.bonusSockets ?? 0);
}

/** True for weapons / armour / accessories (things with an equip slot). */
export function isEquipment(item: ItemInstance): boolean {
  return !!getItemBase(item.baseId)?.slot;
}

/** Gold unit for an item level. */
export function craftGoldUnit(level: number): number {
  return 6 * (Math.max(1, Math.floor(level)) + 5);
}

/** Materials a salvage of `item` yields (deterministic). */
export function salvageYield(item: ItemInstance): MaterialBag {
  const L = Math.max(1, item.level || 1);
  const out: MaterialBag = { m_scrap: 1 + Math.floor(L / 12) + (item.quality === 'normal' ? 1 : 0) };
  switch (item.quality) {
    case 'magic':
      out.m_dust = 1 + Math.floor(L / 20);
      break;
    case 'rare':
      out.m_dust = 1 + Math.floor(L / 20);
      out.m_essence = 1;
      break;
    case 'legendary':
    case 'set':
      out.m_dust = 2 + Math.floor(L / 20);
      out.m_essence = 2 + Math.floor(L / 25);
      break;
  }
  return out;
}

/** Cost of an action on an item, or null when it does not apply (wrong quality / type). */
export function craftCost(action: CraftAction, item: ItemInstance): CraftCost | null {
  if (!isEquipment(item)) return null;
  const U = craftGoldUnit(item.level);
  switch (action) {
    case 'salvage':
      return { gold: 0, materials: {} };
    case 'reforge':
      if (item.quality === 'magic') return { gold: U, materials: { m_scrap: 2, m_dust: 1 } };
      if (item.quality === 'rare') return { gold: 2 * U, materials: { m_dust: 2, m_essence: 1 } };
      return null;
    case 'upgrade':
      if (item.quality === 'normal') return { gold: 2 * U, materials: { m_scrap: 3, m_dust: 1 } };
      if (item.quality === 'magic') return { gold: 5 * U, materials: { m_dust: 4, m_essence: 1 } };
      return null;
    case 'socket': {
      const base = getItemBase(item.baseId);
      if (!base || (base.type !== 'weapon' && base.type !== 'armor')) return null;
      return { gold: 3 * U, materials: { m_scrap: 4, m_essence: 1 } };
    }
  }
}

/** Quality an upgrade produces (null when the item cannot be upgraded). */
export function upgradeTarget(quality: ItemQuality): ItemQuality | null {
  if (quality === 'normal') return 'magic';
  if (quality === 'magic') return 'rare';
  return null;
}

/** Total of one material across all bag stacks. */
export function countMaterial(bag: CraftBag, id: MaterialId): number {
  let n = 0;
  for (const it of bag.inventory) if (it.baseId === id) n += Math.max(0, it.quantity);
  return n;
}

export function materialCounts(bag: CraftBag): Record<MaterialId, number> {
  return { m_scrap: countMaterial(bag, 'm_scrap'), m_dust: countMaterial(bag, 'm_dust'), m_essence: countMaterial(bag, 'm_essence') };
}

function hasMaterials(bag: CraftBag, need: MaterialBag): boolean {
  return MATERIAL_IDS.every(id => countMaterial(bag, id) >= (need[id] ?? 0));
}

function spendMaterials(bag: CraftBag, need: MaterialBag): void {
  for (const id of MATERIAL_IDS) {
    let left = need[id] ?? 0;
    // Drain the smallest stacks first so partial stacks disappear.
    const stacks = bag.inventory.filter(i => i.baseId === id).sort((a, b) => a.quantity - b.quantity);
    for (const s of stacks) {
      if (left <= 0) break;
      const take = Math.min(left, s.quantity);
      s.quantity -= take;
      left -= take;
    }
  }
  // Drop emptied stacks in place (keeps the array the InventorySystem holds).
  const list = bag.inventory;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].quantity <= 0) list.splice(i, 1);
}

/** A fresh stack of a material. */
export function makeMaterial(id: MaterialId, quantity: number): ItemInstance {
  const base = getItemBase(id);
  return {
    uid: craftUid(), baseId: id, name: base?.name ?? id, quality: 'normal', level: 1,
    affixes: [], sockets: [], identified: true, quantity, stats: {},
  };
}

function maxStack(id: string): number {
  return getItemBase(id)?.maxStack ?? 1;
}

/** New bag slots needed to add `adds` (stacking into existing partial stacks first). */
function slotsNeeded(bag: CraftBag, adds: { baseId: string; quantity: number }[]): number {
  let slots = 0;
  for (const a of adds) {
    const cap = maxStack(a.baseId);
    let room = 0;
    for (const it of bag.inventory) if (it.baseId === a.baseId) room += Math.max(0, cap - it.quantity);
    const overflow = Math.max(0, a.quantity - room);
    slots += Math.ceil(overflow / cap);
  }
  return slots;
}

/** Add a stackable quantity, topping up existing stacks first. */
function addStacked(bag: CraftBag, baseId: string, quantity: number, make: (q: number) => ItemInstance): void {
  const cap = maxStack(baseId);
  let left = quantity;
  for (const it of bag.inventory) {
    if (left <= 0) break;
    if (it.baseId !== baseId || it.quantity >= cap) continue;
    const add = Math.min(cap - it.quantity, left);
    it.quantity += add;
    left -= add;
  }
  while (left > 0) {
    const q = Math.min(cap, left);
    bag.inventory.push(make(q));
    left -= q;
  }
}

function gemItem(gem: GemInstance): ItemInstance {
  return {
    uid: craftUid(), baseId: gem.gemId, name: gem.name, quality: 'normal', level: 1,
    affixes: [], sockets: [], identified: true, quantity: 1, stats: {},
  };
}

export class CraftingSystem {
  private roller: CraftRoller;
  private rng: () => number;
  private bagCapacity: number;

  constructor(roller: CraftRoller, rng: () => number = Math.random, bagCapacity = CRAFT_BAG_CAPACITY) {
    this.roller = roller;
    this.rng = rng;
    this.bagCapacity = bagCapacity;
  }

  /** Can `action` be done on `item` right now, and what does it cost? */
  check(action: CraftAction, item: ItemInstance, bag: CraftBag, wallet: CraftWallet): CraftCheck {
    const base = getItemBase(item.baseId);
    if (!base) return { ok: false, reason: 'unknownBase', cost: null };
    if (!base.slot) return { ok: false, reason: 'notEquipment', cost: null };
    const cost = craftCost(action, item);
    if (!cost) {
      return { ok: false, reason: action === 'socket' ? 'notEquipment' : 'quality', cost: null };
    }
    if (!bag.inventory.includes(item)) return { ok: false, reason: 'notInBag', cost };
    if (action === 'socket') {
      const cap = itemSocketCapacity(item);
      if ((item.bonusSockets ?? 0) >= MAX_BONUS_SOCKETS || cap >= MAX_ITEM_SOCKETS) {
        return { ok: false, reason: 'maxSockets', cost };
      }
    }
    if (wallet.gold < cost.gold) return { ok: false, reason: 'gold', cost };
    if (!hasMaterials(bag, cost.materials)) return { ok: false, reason: 'materials', cost };
    if (action === 'salvage') {
      const y = salvageYield(item);
      const adds = [
        ...MATERIAL_IDS.filter(id => (y[id] ?? 0) > 0).map(id => ({ baseId: id, quantity: y[id]! })),
        ...item.sockets.map(g => ({ baseId: g.gemId, quantity: 1 })),
      ];
      // The salvaged item frees its own slot.
      if (bag.inventory.length - 1 + slotsNeeded(bag, adds) > this.bagCapacity) {
        return { ok: false, reason: 'bagFull', cost };
      }
    }
    return { ok: true, cost };
  }

  perform(action: CraftAction, item: ItemInstance, bag: CraftBag, wallet: CraftWallet): CraftResult {
    const c = this.check(action, item, bag, wallet);
    if (!c.ok || !c.cost) return { ok: false, reason: c.reason, action, item };
    const cost = c.cost;
    wallet.gold -= cost.gold;
    spendMaterials(bag, cost.materials);
    switch (action) {
      case 'salvage': return this.salvage(item, bag, cost);
      case 'reforge': this.reforge(item); break;
      case 'upgrade': this.upgrade(item); break;
      case 'socket': item.bonusSockets = (item.bonusSockets ?? 0) + 1; break;
    }
    return { ok: true, action, item, cost };
  }

  private salvage(item: ItemInstance, bag: CraftBag, cost: CraftCost): CraftResult {
    const idx = bag.inventory.indexOf(item);
    if (idx !== -1) bag.inventory.splice(idx, 1);
    const yields = salvageYield(item);
    for (const id of MATERIAL_IDS) {
      const q = yields[id] ?? 0;
      if (q > 0) addStacked(bag, id, q, n => makeMaterial(id, n));
    }
    for (const g of item.sockets) addStacked(bag, g.gemId, 1, () => gemItem(g));
    return { ok: true, action: 'salvage', item, cost, yields, gems: [...item.sockets] };
  }

  /** Reroll every affix: same base, same quality, affixes suited to the item's level. */
  private reforge(item: ItemInstance): void {
    const range = AFFIX_RANGE[item.quality];
    if (!range) return;
    item.affixes = [];
    this.roller.rollAffixes(item, item.level, range[0], range[1]);
    item.identified = true;
    this.roller.finalize(item);
  }

  /** Raise quality one tier; existing affixes are kept and topped up to the new tier's count. */
  private upgrade(item: ItemInstance): void {
    const next = upgradeTarget(item.quality);
    const range = next ? AFFIX_RANGE[next] : undefined;
    if (!next || !range) return;
    item.quality = next;
    const target = range[0] + Math.floor(this.rng() * (range[1] - range[0] + 1));
    const need = Math.max(1, target - item.affixes.length);
    this.roller.rollAffixes(item, item.level, need, need);
    item.identified = true;
    this.roller.finalize(item);
  }
}

/** Minimal shape of LootSystem that crafting needs. */
export interface LootLike {
  rollAffixes(item: ItemInstance, level: number, min: number, max: number): void;
  refreshItem(item: ItemInstance): void;
}

/** Adapter: LootSystem → CraftRoller. */
export function lootCraftRoller(loot: LootLike): CraftRoller {
  return {
    rollAffixes: (item, level, min, max) => loot.rollAffixes(item, level, min, max),
    finalize: item => loot.refreshItem(item),
  };
}
