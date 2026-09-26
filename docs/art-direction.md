# Abyssfire Art Direction

The reference is the rigged character art in `src/graphics/sprites/players/*` and
`src/graphics/sprites/monsters/*`, built on `src/graphics/sprites/rig/`. Everything
else — terrain, props, effects, icons, UI — must look like it belongs next to them.

## Rendering facts

- Isometric tiles 64×32 world px. Game camera zoom is 1.8. Procedural textures are
  drawn at `TEXTURE_SCALE` (3×) and displayed at 1/3, so one texture pixel is ~0.6
  screen px: details under ~2 texture px vanish, anything at 4+ reads.
- Light comes from the upper left. Shadows lean cool (purple/blue), highlights warm.
- Canvas work happens once at load (sheet/tile generation). Keep per-frame work to
  cheap sprite/tween operations. A zone should not take more than ~0.5 s longer to
  load because of art.
- Use the rig helpers for cel shading: `tone()` builds base/shade/light/line from
  one colour; `cel(ctx, path, tone)` fills a shape with a shade band (lower right),
  light band (upper left) and coloured line art. `glow()` for emissive light.

## Style rules

- **Cel-shaded cartoon**: 2–3 tones per material, coloured (not black) line art,
  crisp silhouettes, no noisy per-pixel texture. Suggest material with a few
  confident strokes (planks, cracks, blades of grass) rather than noise.
- **Value hierarchy**: characters (inked, saturated) > interactive props (loot,
  portals, NPC props: softer ink) > decorations (thin line art, no heavy outline)
  > ground (lowest contrast, no outlines). The player must always pop.
- **Readable at a glance**: every object needs a clear silhouette and one focal
  accent (glow, colour pop) at most.
- **Palette per zone** (ground / accent):
  - Emerald Plains 翡翠平原 — warm sunlit greens, ochre paths, golden highlights.
  - Twilight Forest 暮色森林 — cool violet-teal moss, dark roots, cyan/violet
    bioluminescent accents.
  - Anvil Mountains 铁砧山脉 — slate blue-grey rock, patches of snow/scree, forge
    orange accents.
  - Scorching Desert 灼热荒漠 — warm pale sand with wind ripples, sun-bleached
    sandstone, turquoise accents.
  - Abyss Rift 深渊裂谷 — charred black-violet basalt, crimson/magenta glowing
    fissures, lava.
- **UI**: dark-fantasy ARPG in the same cartoon language — opaque panels with
  carved dark-iron frames, gold filigree accents, warm parchment-coloured headings,
  clear hierarchy, no see-through panels over the game world. Quality colours:
  normal #c8c8c8, magic #4f8cff, rare #ffd84a, legendary #ff8a2a, set #3ecf6a.

## Engineering rules

- All player-facing text goes through `t()` with keys in both `zh-CN` and `en`
  locales (the i18n tests enforce this).
- Keep texture keys and public function signatures stable unless you update
  every caller.
- Preview procedural art with the harness before wiring it in; review at full
  texture scale and at in-game scale (~0.5).
