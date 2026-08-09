# Items

Read this before touching `features/items`.

Custom item renderers live in:

```text
features/items/detail-components/
```

Current renderers cover item types:

- `1` weapon
- `2` item
- `3` racial ability
- `4` class ability
- `5` spell
- `6` enemy (bestiary)

If an object has a custom renderer, the handbook uses it. Otherwise it falls back to schema-based field rendering.

Item type `10` **Зелье** (potion) is a first-class type (schema `resources/items/item_10_shema.json`, seeded by `v3-character-creation/07-item-type-potion.sql`, rarity field + data migration by `08-potion-rarity.sql`). Fields: `desc`, `color` (vial liquid color — see "color field type"), `rarity` (`suggest`, dict type 23), `cost`, `weight`. Custom handbook renderers: `PotionListItem.vue` (list) + `PotionDetailContent.vue` (detail). Existing potions used to live as generic items (type 2) tagged `data.type = 'зелье'` with integer `data.rarity` 0–4; `08` migrates them to type 10 (same ids, so character inventories keep resolving), strips the `type` marker, and derives `data.color` from description keywords.

## The shared vial: `PotionVial.vue`

`features/items/components/PotionVial.vue` is the single source of vial visuals, reused by the shelf, the handbook list, and the handbook detail. Props: `color` (liquid hex), `rarity` (0–5 id), `size` (`sm`/`md`/`lg`). It renders cork + glass + colored liquid + shine + bubbles, plus **per-rarity ornaments driven by `features/items/lib/potionRarity.js`** (`POTION_RARITY`/`rarityOf`): common (plain) → uncommon (green rim glow) → rare (blue glow + cork gem) → very rare (purple aura + frame + gem) → legendary (gold pulse + sparkles + wax cork) → artifact (crimson pulse + frame + runes + gem). Rarity id maps 1:1 to the suggest dict ids (0–5), so the integer already stored in `data.rarity` indexes both. The liquid color is exposed as the `--pv-lc` CSS var so liquid, glow and the drink wisp all share it. Sizing uses a `.pv-scale` wrapper (`transform: scale(var(--s))`) so the drink tilt/vanish transforms on `.pv-inner` don't fight the size scale.

**Drink animation (imperative).** A potion in D&D is consumed whole, so "use" empties the vial completely — there is no sip. `PotionVial` exposes `playDrain()`/`playRefill()`/`playSpent()`/`resetAnim()` via `defineExpose` (each toggles an internal `anim` state → `pv-draining`/`pv-refill`/`pv-spent` class; the promise-returning ones resolve after the phase). Phases: **drain** = liquid drops to 0 + tilt + cork lift + glow flash + a colored magic **wisp** rising from the neck (the chosen signature effect); **refill** = a fresh full bottle swaps in (liquid pours back, glass flash) when stock remains; **spent** = empty + fade-away on the last dose. The one-shot glow flash CSS is placed after the rarity-aura rules so it overrides the continuous pulse during the gulp. The effect does **not** scale with rarity.

## Spell-slot cell: `SpellSlotSphere.vue`

`features/items/components/SpellSlotSphere.vue` is the spell-slot visual, consumed by `SpellSlotsBar.vue` (see `md/features/character-editor.md`). It is a **pure-CSS round flask (a neckless potion bottle)** that **reuses `PotionVial`'s exact glass treatment** — same dark `#0d0e15` fill + thin `#3a3d4d` border, same glowing liquid (`var(--ss-c)` + `box-shadow` glow + bright white meniscus `border-top`), same faint vertical shine streak (`rgba(255,255,255,.12)`) and white bubbles. The "thick glass" look is reproduced with a **two-layer structure**: an outer `.ss-flask` circle (glass) and an inner `.ss-well` inset by the glass thickness (`inset: 3px·k`), so a dark glass rim shows around the liquid exactly like the vial (whose liquid is inset 3px). It is **not** item/handbook UI — it lives next to `PotionVial` only because it reuses that look. Props: `spent` (bool — `true` = used/empty), `level` (1–9), `size` (px, default 30), `color` (override hex; defaults to the `--accent` token), `interactive` (bool — cursor/hover gate; the parent still owns the click + `toggle-slot` emit). Color flows through the `--ss-c` CSS var (defaults to `var(--accent)`). All px geometry scales off `--ss-k = size/58` (the prototype base size) so the glass inset / shine / glow / bubble-rise track the cell size.

- **States (class-driven, `ss-on`/`ss-off`):** charged = flask **filled to 100%** with colored liquid (accent-tinted border, round specular highlight) and rising bubbles — **no glow halo** in the steady state; spent = flask **fully empty** (liquid height 0) — no dreg.
- **`level` drives intensity, not color** — `i01 = (level-1)/8` scales glow strength (`--ss-g`) and bubble count (2 → 4). Bubbles are generated once per instance from a per-mount seed (module `uid` + level) for stable variety.
- **Animations (class one-shots, auto-played off `spent`).** Exposes `playCast()` / `playRecharge()` via `defineExpose`, and a `watch(spent)` auto-plays them after mount (`false→true` = cast/`ss-draining` ~600 ms, `true→false` = recharge/`ss-charging` ~520 ms). **Drain:** liquid level falls to 0 + a glow flash + a colored **wisp** rising off the top (the potion's drink signature). **Charge:** liquid pours back to full + a bright glass **swap** flash. The liquid-height `transition` is gated behind an `ss-ready` class added on the next tick after mount, so cells don't animate their fill on initial page load. Glow only ever appears as these transient cast/recharge flashes — the charged idle state has no halo. `prefers-reduced-motion` disables the idle bubble loop.
- **Performance:** no rAF, no canvas — idle states are static CSS, animations are short keyframe one-shots, so any number of cells is cheap.

## Potions block (type 10) — `DND_POTIONS`

Potions are a **standalone block** (`blocks/dnd/DndPotions.vue`, registered as `DND_POTIONS`), **not** part of the inventory. It owns its own value — a flat list of `{ uid, id, count, override? }` entries stored under its block id (`potions` in `settings/dnd/blocks.json`) — decoupled from `DndItems`. It is **view-only**: there is no edit mode. Placement is in the schema layout — both desktop and mobile put it inside the "Снаряжение"/items tab. That tab now **leads with a counters + wallet row**: the `counters` block (`DND_COUNTERS`, see `md/features/character-editor.md`) on the left and the `money` block (title "Кошелек") on the right — desktop is a `justify-content: space-between` row, mobile stacks `counters` above `money`. Then `potions`, then `items`. There is **no divider** between potions and items (the old `.dp-sep` full-bleed seam was removed).

The potions and items section headers use the **shared sheet-section-title look** (matching the spell-group headers, `.sheet-section-title`): `var(--text-muted)`, `12px / 650 / 0.08em`, uppercase, no display font; a filler line `rgba(91,101,126,0.42)`; a plain `#777b88` count (no pill). Do not give these blocks a bespoke larger/display-font/accent header — keep them uniform with the rest of the sheet.

- `blocks/dnd/DndPotions.vue` — shell. `entries` = the block value (array); `potionEntries` resolves each against a `catalog` (loaded via `/items/by-ids`) into `{ uid, count, name, color, rarity }`. `canUse`/`canAdd` = `charCtx.ownerMode` (so **"+ зелье" is always shown for owners**, no edit-mode gate). `onUse(uid)` decrements (removes at 0); `onPick(item, qty)` **merges into an existing stack** of the same potion (no override) else pushes a new entry; add opens an `ItemPickerModal` scoped to `[10]`. The whole block hides when empty and the viewer is not the owner.
- `blocks/dnd/components/PotionShelf.vue` — presentational wrap-row of `PotionVial` (md) + `×N` count badge + name. Props: `potions` (`[{ uid, count, name, color, rarity }]`), `canUse`, `canAdd`. Emits `use(uid)` / `add`. It keeps a `uid → PotionVial` ref map; `onUse(p)` plays `playDrain()`, then for stock>1 emits `use` and `playRefill()`, else `playSpent()` then emits `use` (parent removes the entry, so the vanish plays before unmount). A per-uid `busy` set blocks re-entry mid-animation. No shelf/rack backing — flat vials in a row. The name (`.ps-name`) is shown in full — it **wraps** under the vial (`max-width: 72px` + `overflow-wrap: anywhere`), not truncated with an ellipsis.
- `DndItems` no longer special-cases potions at all (the old `isPotionEntry`/`potionEntries`/potion picker were removed). A type-10 item that still lives in a character's inventory now renders as an ordinary item row there. **Migration note:** existing characters' potions remain inventory entries until re-added to the potions block — they are not auto-moved, but they are not lost either (they show as normal inventory rows).

## color field type

`ItemEditModal.vue` renders `{ "type": "color" }` as a native color input + hex text input + preset swatches (`COLOR_PRESETS`), storing a hex string in `data[key]`. `defaultDataForFields` already defaults it from `field.default`; `normalizeDataForSave` keeps it a string (no special-case needed). Used by the potion `color` field.

## Bestiary (enemy) schema layout

Schema source: `resources/items/item_6_enemy.json`. The DB row in `dndshare.item_type` (id = 6) holds the same JSON in its `fields` column — when you change the source file, run `resources/items/update_item_6_enemy.sql` (or paste the JSON into an `UPDATE dndshare.item_type SET fields = '[...]'::jsonb WHERE id = 6;` query) and then re-run the `bestiary-import` admin job because the data shape is **not backwards-compatible**.

Data layout (nested):

```
data = {
  identity: { creature_type, size, alignment, is_legendary, named_npc, source, environment },
  combat:   { ac, ac_note, hp, hp_formula, speed, speed_opt, cr, xp, proficiencyBonus },
  stats:    { str, dex, con, int, wis, cha },                  // raw ability scores
  saving_throws: { str?, dex?, con?, int?, wis?, cha? },        // numeric bonuses
  skills, damage_immunities, damage_resistances, condition_immunities,
  senses, languages, image_url, description,
  feats: [{ name, value }], actions: [...], reactions: [...],
  tags: [suggestId, ...]
}
```

The four top-level groups (`identity`, `combat`, `stats`, `saving_throws`) are schema `object` fields with `layout: "horizontal"` — they render as a horizontal grid in the editor.

## Bestiary (enemy) renderer

`EnemyListItem.vue` (list view): no type icon on the left; layout starts with CR number (from `combat.cr`), then name + subtitle (creature type / size / alignment from `identity.*`). When `identity.named_npc === true`, a small gold "Именной" chip is shown next to the name. HP comes from `combat.hp`.

`EnemyDetailContent.vue` (full view):
- "Именной" chip is rendered first in the top tags row when `identity.named_npc === true` (gold-tinted).
- Stats block is split into three rows: (1) primary tiles CR / КД / ХИТ / БМ (БМ when `combat.proficiencyBonus != null`); (2) speed tiles — one per `combat.speed_opt` entry, or a single СКР fallback if only `combat.speed` is set; (3) the six-ability grid.
- Ability grid (`stats.*`): big modifier + score; if `saving_throws[key] != null`, a small accent-tinted `СПАС +N` badge renders under the score.
- Vertical info-list (`.enemy-info-list`) for НАВЫКИ / ЧУВСТВА / ЯЗЫКИ / СОПР. К УРОНУ / ИММУН. К УРОНУ / ИММУН. К СОСТОЯНИЯМ (empty values filtered). Saving throws no longer appear here — they live under the stats.
- All section headers (СРЕДА ОБИТАНИЯ, ОСОБЕННОСТИ, ДЕЙСТВИЯ, РЕАКЦИИ, ОПИСАНИЕ, ТЕГИ) use the shared **`shared/ui/DetailSection.vue`** primitive (gold uppercase label with subtle underline). The «Описание» section uses `collapsible :default-open="false"` — hidden by default since it can be very long.
- Sections order from top to bottom: stats block → info-list → environment → feats → actions → reactions → description (collapsible) → **tags accordion**.
- Tags render as accordion cards at the very bottom: each tag is a clickable header with the tag name (large title) and chevron; clicking expands the description (`v-html`). Tags without descriptions are non-interactive headers.

The `walkFields` helper recursively traverses schema (`object` containers included) to collect `(field, value)` pairs — used for ensuring suggest items and computing the top tags row (`tag: true` fields can live in any depth).

### Shared DetailSection primitive

`shared/ui/DetailSection.vue` is the canonical section header for item detail renderers. Props: `label: String`, `collapsible?: Boolean`, `defaultOpen?: Boolean`. When `collapsible`, the header becomes a button with a chevron and the body is hidden until clicked. Other detail renderers (Weapon/Spell/Item/Ability) currently use their own per-component header CSS — **prefer `DetailSection` for new sections and migrate the rest opportunistically when they need cosmetic changes**.

## Item edit modal (`ItemEditModal.vue`)

The modal renders the schema with these conventions:

- Top-level fields are placed in a 2-column CSS grid (`.iem-fields-grid`). On narrow screens (≤720px) it collapses to one column.
- Short fields (`int`, `text`, `bool`, `suggest`) take one column.
- Wide fields take the full row (`grid-column: 1 / -1`): `description`, `suggest_array`, `int_by_suggest`, `object`, `object_array`, `blocks`.
- `object`, `object_array`, `blocks` render as **collapsible cards** with a clickable header (default expanded for `object`/`object_array`, collapsed for `blocks`).
- `object` with `layout: "horizontal"` lays out its sub-fields in a `repeat(auto-fit, minmax(110px, 1fr))` grid — used for `stats`, `saving_throws`, `combat`, `identity` in the enemy schema.
- `blocks` is fully editable: list of tiles with name input + rich-text body (`InputDescription`) + reorder ↑/↓ and delete buttons + "+ Добавить блок".
- `suggest` resolution everywhere goes through `getSuggestId(field)` so any of `suggest_id` / `suggest_type_id` / `suggestTypeId` in the schema works (the bestiary schema uses `suggestTypeId`).
- `suggest_array` is editable inside `object` too (chips + add-select), not only at top level.
- Other modal features (description rich text, nested `object_array`, name + EN inputs) work as before.

Character editor item searches use the shared `ItemSearch` component. When creation is enabled by the parent block, the search can open the schema-based `ItemEditModal`; the modal supports nested `object` and `object_array` fields, including `object_array` fields inside an `object`, so weapons, spells, generic items, and enemies can all be created from the same schema flow.

Spell item schema (`resources/items/item_5_shema.json`) includes optional structured `damage` and `heal` blocks. Sources are now common item metadata (`item_content_source`) shared by spells, feats, abilities, races/classes and equipment; they are edited above the schema fields in `ItemEditModal` and returned as `contentSourceIds`/`contentSources`.
- **`damage`**: `dices` rows (`count`, `dice_id` suggest 11, `type` suggest 12, `bonus`) hold the **base**; `addon` rows (same shape) hold the **per-level increment**; `scaling` (`"none"|"slot"|"cantrip"`) picks the growth axis (slot = +addon за круг ячейки, cantrip = +addon по уровню героя 5/11/17). Plus `range_attack` (spell-attack bonus pill), `save_ability`/`save_effect` (`half`/`negate`), `instances` (лучи/дротики) and `addon_instances` (+за круг). Scaling enum: `SPELL_DAMAGE_SCALING`.
- **`heal`**: `dices`/`addon` (count + dice_id), `scaling`, `add_mod` (add spellcasting modifier).

This data is populated by a **subagent enrichment pass** (not a Kotlin job): each spell's `nameEn` is its ttg.club slug — agents `POST https://5e14.ttg.club/api/v1/spells/<slug>`, parse base dice from `description` and the per-level increment from `upper`, then merge into the item via the `handbook_item_update` MCP tool. **Always pass `nameEn` on `handbook_item_update`** — omitting it nulls the `name_en` column (the ttg match key). Source links are maintained through the regular item editor/API instead of spell JSON.

Item field type `int_by_suggest` (e.g. `cost` in item types 1 and 2) stores `{ value, suggest_id }`, where `suggest_id` references an entry in the schema-declared `suggest_type_id` (coins live in suggest type 17). `ItemEditModal` renders it as a number input plus a suggest select. Legacy `cost` values (plain number or string like "5 gp") can be converted in bulk via `POST /api/admin/migrate-cost-to-int-by-suggest`.
