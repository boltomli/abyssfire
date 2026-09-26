/**
 * Quest reward helpers: class-appropriate equipment choices and the quest
 * item drop rules. Pure (no Phaser) so the rules are unit-testable.
 */
import { Accessories, Armors, Weapons } from '../data/items/bases';
import type {
  ItemBase, ItemInstance, ItemQuality, QuestDefinition, QuestObjective, QuestRewardChoice, WeaponBase,
} from '../data/types';

type WeaponType = WeaponBase['weaponType'];

/** Weapon families each class is built around. */
export const CLASS_WEAPON_TYPES: Record<string, WeaponType[]> = {
  warrior: ['sword', 'axe', 'mace'],
  mage: ['staff', 'wand'],
  rogue: ['dagger', 'bow'],
};

/** Off-hand choices only make sense for shield users; others get jewelry instead. */
const SHIELD_CLASSES = new Set(['warrior']);

function candidatesFor(choice: QuestRewardChoice, classId: string): ItemBase[] {
  switch (choice) {
    case 'weapon': {
      const types = CLASS_WEAPON_TYPES[classId] ?? ['sword'];
      return Weapons.filter(w => w.slot === 'weapon' && types.includes(w.weaponType));
    }
    case 'offhand':
      return SHIELD_CLASSES.has(classId)
        ? Weapons.filter(w => w.slot === 'offhand')
        : Accessories;
    case 'jewelry':
      return Accessories;
    case 'armor':
    case 'helmet':
    case 'gloves':
    case 'boots':
    case 'belt':
      return Armors.filter(a => a.slot === choice);
  }
}

/**
 * The best-fitting base for a reward slot: among bases the player can use at
 * `level` (+2 of headroom), pick randomly from the three highest-level ones so
 * rewards feel current without always being the same item.
 */
export function pickRewardBase(
  choice: QuestRewardChoice,
  classId: string,
  level: number,
  rand: () => number = Math.random,
): ItemBase | null {
  const pool = candidatesFor(choice, classId);
  if (pool.length === 0) return null;
  const usable = pool.filter(b => b.levelReq <= level + 2);
  const ranked = (usable.length > 0 ? usable : [...pool].sort((a, b) => a.levelReq - b.levelReq).slice(0, 1))
    .slice()
    .sort((a, b) => b.levelReq - a.levelReq)
    .slice(0, 3);
  return ranked[Math.floor(rand() * ranked.length)] ?? null;
}

/** Item level for a quest's rewards: the quest level, raised toward the player's if they out-level it. */
export function rewardItemLevel(quest: QuestDefinition, playerLevel: number): number {
  return Math.max(quest.level, Math.min(playerLevel, quest.level + 5));
}

export function rewardChoiceQuality(quest: QuestDefinition): ItemQuality {
  return quest.rewards.choiceQuality ?? (quest.category === 'main' ? 'rare' : 'magic');
}

/** Build the pick-one equipment rewards for a quest (empty when it has none). */
export function generateRewardChoices(
  quest: QuestDefinition,
  classId: string,
  playerLevel: number,
  createItem: (baseId: string, level: number, quality: ItemQuality) => ItemInstance | null,
  rand: () => number = Math.random,
): ItemInstance[] {
  const out: ItemInstance[] = [];
  const level = rewardItemLevel(quest, playerLevel);
  const quality = rewardChoiceQuality(quest);
  for (const choice of quest.rewards.choices ?? []) {
    const base = pickRewardBase(choice, classId, level, rand);
    if (!base) continue;
    const item = createItem(base.id, level, quality);
    if (item) { item.identified = true; out.push(item); }
  }
  return out;
}

/** Objectives that are filled by picking items up (drops or gather nodes). */
export function isCollectObjective(obj: QuestObjective): obj is QuestObjective & { type: 'collect' | 'craft_collect' } {
  return obj.type === 'collect' || obj.type === 'craft_collect';
}

/**
 * Deterministic gather spots: `count` walkable tiles inside `area`, at least
 * two tiles apart, chosen by a hash of `seedKey` so they're stable across
 * visits and saves.
 */
export function resolveGatherSpots(
  area: { col: number; row: number; radius: number },
  count: number,
  walkable: (col: number, row: number) => boolean,
  seedKey: string,
): { col: number; row: number }[] {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) h = Math.imul(h ^ seedKey.charCodeAt(i), 16777619);
  const rand = (): number => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out: { col: number; row: number }[] = [];
  for (let attempt = 0; attempt < count * 60 && out.length < count; attempt++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * area.radius;
    const col = Math.round(area.col + Math.cos(a) * r);
    const row = Math.round(area.row + Math.sin(a) * r);
    if (!walkable(col, row)) continue;
    if (out.some(p => Math.abs(p.col - col) + Math.abs(p.row - row) < 3)) continue;
    out.push({ col, row });
  }
  return out;
}

/** Default drop chance when a collect objective has no explicit source. */
export const FALLBACK_COLLECT_CHANCE = 0.25;

/**
 * Chance that killing `monsterId` yields an item for `obj` (0 when it can't).
 * Objectives without a source keep the old behaviour: any monster, reduced odds.
 */
export function questDropChance(obj: QuestObjective, monsterId: string): number {
  if (!isCollectObjective(obj)) return 0;
  const src = obj.source;
  if (!src) return FALLBACK_COLLECT_CHANCE;
  if (src.kind !== 'drop') return 0;
  return src.monsters.includes(monsterId) ? src.chance : 0;
}
