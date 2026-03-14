# Inventory System Refactor

## Context

The current inventory system has a 40-slot capacity which causes players to hit limits in Act 1. There's no way to discard items, no auto-sort, no item tooltips on hover, and the shop UI is a basic buy-only list. This refactor addresses all three pain points: inventory management, shop UX, and auto-loot.

## Files to Modify

| File | Changes |
|------|---------|
| `src/systems/InventorySystem.ts` | Expand capacity, add sort/discard/bulk-destroy methods |
| `src/scenes/UIScene.ts` | Redesign inventory panel, shop panel, add tooltip system, auto-loot HUD button |
| `src/scenes/ZoneScene.ts` | Auto-loot logic in update loop, persist setting |
| `src/data/types.ts` | Add `autoLootMode` to SaveData settings |
| `src/utils/EventBus.ts` | Add `AUTOLOOT_CHANGED`, `ITEM_DISCARDED` events |

## Step 1: Foundation (types.ts, EventBus.ts)

**types.ts** — Add `autoLootMode: 'off' | 'all' | 'magic' | 'rare'` to `SaveData.settings`

**EventBus.ts** — Add two events:
```
AUTOLOOT_CHANGED: 'autoloot:changed'
ITEM_DISCARDED: 'item:discarded'
```

## Step 2: InventorySystem.ts

- Change `MAX_INVENTORY` from `40` to `100` (line 5)
- Add `sortInventory()` — sort by quality desc (legendary > set > rare > magic > normal), then by type (weapon > armor > accessory > consumable > gem), then by name
- Add `discardItem(uid)` — remove item permanently, emit log message + ITEM_DISCARDED event
- Add `destroyNormalItems()` — bulk-remove all normal-quality **equipment** (keep consumables/scrolls/gems), return count destroyed, emit log

## Step 3: UIScene.ts — Item Tooltip

Add `showItemTooltip(item, screenX, screenY)` and `hideItemTooltip()`:
- Floating container at depth 5000 (above all panels)
- Shows: name (quality-colored), quality label + level, type/slot, base damage/defense, affixes (or [未鉴定]), legendary effect, sell price
- Width 200px, dynamic height
- Clamp to screen edges
- Triggered by `pointerover`/`pointerout` on inventory item slots

## Step 4: UIScene.ts — Inventory Panel Redesign

Rewrite `toggleInventory()`. New panel: **520x500px**.

Layout:
```
+----------------------------------------------------+
| 背包 (1/2)                          [整理] [销毁] X |
|----------------------------------------------------|
| Equipment: 5x2 grid (36px slots)                   |
|----------------------------------------------------|
| Inventory Grid: 10 cols x 5 rows (36px, 4px gap)   |
| Shows 50 items per page                             |
|----------------------------------------------------|
| [< 上一页]    第1/2页    [下一页 >]                   |
| 装备加成: str +5 ...                                 |
+----------------------------------------------------+
```

Key behaviors:
- **Pagination**: 50 items/page, page state preserved on refresh
- **Sort button [整理]**: calls `inventorySystem.sortInventory()`, refreshes panel
- **Destroy button [销毁]**: calls `inventorySystem.destroyNormalItems()`, refreshes
- **Item click**: show context popup with actions:
  - Equipment: [装备] [丢弃]
  - Consumables: [使用] [丢弃]
  - Other: [丢弃]
  - Rare+ items: discard requires confirmation ("确定丢弃?")
- **Item hover**: show tooltip via `showItemTooltip()`
- **Equipment slots**: hover shows tooltip too; click to unequip

## Step 5: UIScene.ts — Shop Panel (Diablo-style Split)

Rewrite `openShop()`. New panel: **700x460px**.

Layout:
```
+------------------------------------------------------------------+
| 铁匠铺 / 商店                                                  X |
|------------------------------------------------------------------|
|   商品列表 (LEFT ~320px)    |    你的背包 (RIGHT ~360px)          |
|   Item1  120G  [买]         |    [i][i][i][i][i][i][i][i]        |
|   Item2  240G  [买]         |    [i][i][i][i][i][i][i][i]        |
|   ...                       |    click item → sell               |
|                              |    hover → tooltip                 |
|   金币: 1234G               |    [< 上页] 1/2 [下页 >]          |
+------------------------------------------------------------------+
```

- Left: merchant items with buy button (same pricing: `sellPrice × 3`)
- Right: player inventory grid (8 cols, 32px slots) with sell-on-click
  - Click item → `inventorySystem.sellItem(uid)` → add gold → refresh
  - Rare+ sell shows confirmation
  - Hover → tooltip
- Gold display at bottom of both sides

## Step 6: UIScene.ts — Auto-Loot Button

Insert between auto-combat and inventory buttons in `createSkillBar()`:

```
[SKILL BAR] [AUTO COMBAT] [AUTO LOOT] [INVENTORY]
```

- Button: 50x42px, same style as auto-combat
- Click cycles: OFF → 全部 → 魔法+ → 稀有+ → OFF
- Text/color by state:
  - OFF: `拾取\nOFF` grey (#666680)
  - ALL: `拾取\n全部` white (#e0d8cc)
  - Magic+: `拾取\n魔法+` blue (#2471a3)
  - Rare+: `拾取\n稀有+` gold (#c0934a)
- Emits `AUTOLOOT_CHANGED` event
- Skill bar background widens by 56px to accommodate

## Step 7: ZoneScene.ts — Auto-Loot Logic

- Add `autoLootMode` field, default `'off'`
- Listen for `AUTOLOOT_CHANGED` event to update the field
- In `update()`, throttle check every ~300ms: call `handleAutoLoot()`
- `handleAutoLoot()`: scan `lootDrops[]` for items within 2 tiles matching quality filter. Reuse existing `pickupLoot()` pattern (addItem → emit ITEM_PICKED → destroy sprite → splice from array). Stop on inventory full.
- Persist `autoLootMode` in save data settings; restore on load with `?? 'off'` fallback for old saves

## Verification

1. **Run `npm run dev`** and start a new game
2. **Inventory capacity**: Pick up items until > 40, verify no cap at 40. Verify pagination appears at 50+ items
3. **Sort**: Click [整理] — legendaries/rares should appear first, then by type
4. **Tooltips**: Hover over any inventory item — detailed stats popup should appear, positioned within screen
5. **Discard**: Click item → [丢弃] — item removed, log message shown. Try discarding a rare item — confirmation required
6. **Bulk destroy**: Click [销毁] — all normal equipment destroyed, consumables/gems/scrolls kept
7. **Shop**: Talk to blacksmith/merchant — split panel with buy (left) and sell (right). Buy an item, sell an item, verify gold updates
8. **Auto-loot toggle**: Click the button between auto-combat and inventory, verify 4 states cycle with correct labels/colors
9. **Auto-loot pickup**: Enable "全部" mode, kill monsters, verify nearby loot picked up automatically. Switch to "魔法+" and verify white items are skipped
10. **Save/load**: Save game with auto-loot on, reload — verify setting persists (or gracefully defaults to off for old saves)
