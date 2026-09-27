/**
 * ItemCompare — what swapping an item in would change.
 *
 * Pure helpers for the item tooltip: which equipped item a candidate would
 * replace, and the per-stat difference (base damage / defense, affixes,
 * socketed gems). Unidentified magic+ items only compare their base.
 */
import type { EquipSlot, ItemInstance } from '../data/types';
import { getItemBase } from '../data/items/bases';

/** Pseudo-stats for the base line of weapons and armour. */
export const AVG_DAMAGE = '__avgDamage';
export const BASE_DEFENSE = '__baseDefense';

/** Every stat an item contributes, summed. */
export function itemStatTotals(item: ItemInstance): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (k: string, v: number): void => { out[k] = (out[k] ?? 0) + v; };
  const base = getItemBase(item.baseId) as { baseDamage?: [number, number]; baseDefense?: number } | undefined;
  if (base?.baseDamage) add(AVG_DAMAGE, (base.baseDamage[0] + base.baseDamage[1]) / 2);
  if (base?.baseDefense) add(BASE_DEFENSE, base.baseDefense);
  const known = item.identified || item.quality === 'normal';
  if (known) for (const a of item.affixes) add(a.stat, a.value);
  for (const g of item.sockets ?? []) add(g.stat, g.value);
  return out;
}

/** Rough worth of an item, used only to pick which ring a new ring would replace. */
function itemScore(item: ItemInstance): number {
  return Object.values(itemStatTotals(item)).reduce((s, v) => s + Math.abs(v), 0) + item.level * 0.1;
}

export interface CompareTarget {
  /** Slot the candidate goes into. */
  slot: EquipSlot;
  /** What is worn there now (undefined: the slot is empty). */
  equipped?: ItemInstance;
}

/**
 * The equipped item a candidate would be compared against, or null if the
 * candidate is not equipment or is itself worn. Rings go into a free ring
 * slot if there is one, otherwise they replace the weaker ring.
 */
export function compareTarget(item: ItemInstance, equipment: Partial<Record<EquipSlot, ItemInstance>>): CompareTarget | null {
  const base = getItemBase(item.baseId);
  const slot = base?.slot;
  if (!slot) return null;
  if (Object.values(equipment).some(e => e?.uid === item.uid)) return null;
  if (slot === 'ring1' || slot === 'ring2') {
    const r1 = equipment.ring1;
    const r2 = equipment.ring2;
    if (!r1) return { slot: 'ring1' };
    if (!r2) return { slot: 'ring2' };
    return itemScore(r1) <= itemScore(r2) ? { slot: 'ring1', equipped: r1 } : { slot: 'ring2', equipped: r2 };
  }
  return { slot, equipped: equipment[slot] };
}

export interface StatDelta {
  stat: string;
  delta: number;
}

/**
 * Per-stat change from wearing `candidate` instead of `equipped` (non-zero
 * only). Base damage and defense come first, then the rest by size of change.
 */
export function statDeltas(candidate: ItemInstance, equipped?: ItemInstance): StatDelta[] {
  const a = itemStatTotals(candidate);
  const b = equipped ? itemStatTotals(equipped) : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: StatDelta[] = [];
  for (const k of keys) {
    const d = Math.round(((a[k] ?? 0) - (b[k] ?? 0)) * 10) / 10;
    if (d !== 0) out.push({ stat: k, delta: d });
  }
  const rank = (s: string): number => (s === AVG_DAMAGE ? 0 : s === BASE_DEFENSE ? 1 : 2);
  return out.sort((x, y) => rank(x.stat) - rank(y.stat) || Math.abs(y.delta) - Math.abs(x.delta));
}
