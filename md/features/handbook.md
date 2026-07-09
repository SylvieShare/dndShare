# Handbook

Read this before touching `features/handbook`.

`features/handbook/pages/ViewHandbook.vue` is the handbook shell. All handbook routes (`/handbook`, `/handbook/dictionary`, `/handbook/objects`) point to this single page. The full view state is reflected in the query so a filtered/grouped view is shareable and survives reload: `?type=<id>`, `?item=<id>`, `?q=<string>`, `?group=<dotted-path>`, `?filters=<json>`. `currentQuery()` builds the query from state; the URL-sync watcher + `init()` restore state from it (guarded by `skipSearchWatch` / `skipFiltersWatch` / `skipGroupWatch` so writing the URL doesn't re-trigger fetches). Search/filter/group changes use `router.replace` (no history spam); item selection uses `push`.

## Layout

**Landing (no type selected):** `HandbookLanding.vue` — left sidebar with source list, right area with collection cards grid (important ones span 2 columns) and dictionary cards. Clicking a collection card emits `select-type` and `ViewHandbook` calls `selectType`.

**Desktop (type selected):** horizontal type bar across the top (all item types as pills + "Словари" button), then a two-panel body (left list, right detail).

**Mobile (≤520px):** three distinct full-screen panels driven by `mobilePanel` computed class:
- `panel-types` — type grid picker (when no type is selected)
- `panel-list` — item list with back button (type selected, no item)
- `panel-detail` — item detail with back button (item selected)

## Components

```
features/handbook/
  pages/
    ViewHandbook.vue        ← shell: state management, URL sync, modal
    HandbookLanding.vue     ← landing: source sidebar + collections grid + dictionaries
  components/
    HandbookTypeBar.vue        ← horizontal type pills + Словари button
    HandbookItemList.vue       ← left panel: search, collapsible filters, list
    HandbookItemDetail.vue     ← right panel: generic schema view or custom renderer
    HandbookCollectionBar.vue  ← collection picker used inside the type bar
  dictionary/
    ViewDictionary.vue
    components/
      DictItemEditor.vue
      DictItemGrid.vue
      DictItemView.vue
      DictTopBar.vue
      DictTypeSidebar.vue
  objects/
    lib/
      schemaFields.js
```

Item-type-specific list renderers live in `features/items/list-components/`:
- `WeaponListItem.vue` (type 1)
- `ItemListItem.vue` (type 2)
- `SpellListItem.vue` (type 5)
- `EnemyListItem.vue` (type 6) — shows CR badge, name, ★ ЛЕГ, creature type

Item-type-specific detail renderers live in `features/items/detail-components/`:
- `WeaponDetailContent.vue` (type 1)
- `ItemDetailContent.vue` (type 2)
- `AbilityDetailContent.vue` (types 3 & 4)
- `SpellDetailContent.vue` (type 5)
- `EnemyDetailContent.vue` (type 6) — hero area, tags, stat blocks, ability scores

The `CUSTOM_RENDERERS` map in `HandbookItemDetail.vue` maps type id → component. Types without a custom renderer fall back to the generic schema-based display.

## item_type fields

`item_type` objects returned from `/api/item-types` (supports optional `?sourceId=`) now include:
- `svg` — URL of the type's icon (`/api/svg/{svgId}`, computed from `svg_id`)
- `svgId` — raw id from `svg_storage` table
- `color` — hex accent color for the type pill
- `count` / `countItems` — number of items in this type
- `important` — bool; important types span 2 columns in the landing grid
- `description` — short description shown on the landing card
- `sourceId` / `sourceName` — linked source

`suggest_type` objects returned from `/api/suggest/types` (supports optional `?sourceId=`) now include:
- `svgId` — raw id from `svg_storage`
- `color` — hex accent color

## API endpoints (handbook-related)

- `GET /api/sources` — list all sources (`id`, `name`, `version`, `countItems`)
- `GET /api/item-types?sourceId=` — list item types, optionally filtered by source
- `GET /api/suggest/types?sourceId=` — list suggest types, optionally filtered by source
- `GET /api/svg/{id}` — returns raw SVG content from `svg_storage` as `image/svg+xml`
- `GET /api/items/children?parentId=` — base item's variants/sub-entities (subraces of a race, subclasses of a class) via `item.parent_id`

Handbook items and suggests are also exposed to AI agents over MCP at `POST/GET /mcp` (read + admin write, base records only). See `md/features/mcp.md`.

## Item schema extensions

### `tag: true`

Any schema field can be annotated with `tag: true`. In `EnemyDetailContent.vue`, tagged fields are displayed as small badge chips above the creature name. Example (in `item_6_enemy.json`): `creature_type`, `size`, `alignment`, `is_legendary`.

### `filter: true`

Fields with `filter: true` appear in the filter popover in `HandbookCollectionBar.vue` — the panel uses `shared/ui/BasePopover` (closes on outside-click/Escape/scroll, so clicking a list item dismisses it). When a search/filter is active the collection count in the bar shows `<loaded>[+] из <total>` (driven by `result-count`/`has-more`/`filtered` props from `ViewHandbook`). **Filterable fields are discovered recursively** — fields inside `object` containers (e.g. `combat.cr`, `identity.is_legendary` in the bestiary schema) are included. The filter UI supports:
- Boolean / bool fields → tri-state `MultiToggle` (`Не важно` / `Да` / `Нет`); `Не важно` removes the filter, `Да`/`Нет` sends literal `true`/`false`.
- Fields with `filter_values` array → chip buttons.
- `suggest` / `suggest_array` fields → chip buttons from suggest data.

The filter key sent to the backend is the **dotted data path** (e.g. `combat.cr`), not the bare field key. `walkFieldsWithPath` (`features/handbook/objects/lib/schemaFields.js`) yields `{ field, path }` for every field in the schema; `ViewHandbook` builds the `filterFields` array from this walk. Likewise `groupBy` is now a path string.

Backend (`ItemRepository.searchItems`) parses the dotted key into segments (validated against `^[A-Za-z_][A-Za-z0-9_]*$`) and builds:
- For text/scalar IN checks: `data #>> '{a,b}'` (or `data ->> 'a'` when single segment).
- For jsonb array-contains: `data @> '{"a":{"b":[val]}}'::jsonb` via `nestedSingletonJson(path, [val])`.
- For booleans: `COALESCE((<extract>)::boolean, false) = :value`.

Grouping (`HandbookItemList.groupedItems`) reads the value via `getByPath(item.data, groupBy)` and resolves the field with `findFieldByPath(type.fields, groupBy)`.

### Race (8) / Class (9) item types

Race and class **content** are first-class handbook items, not suggests:

- **Type 8 «Расы»** (`resources/items/item_8_shema.json`): `suggest_id` (bridge to
  suggest type 1), `size`, `speed`, `asi` (object_array of `{ ability(16), bonus }`),
  `languages`/`armor_prof`/`weapon_prof`/`tool_prof` (suggest_arrays), `description`.
- **Type 9 «Классы»** (`resources/items/item_9_shema.json`): `suggest_id` (bridge to
  suggest type 2), `hit_die` (suggest 11), `primary_abilities`/`saves` (suggest 16),
  `armor_prof`/`weapon_prof`/`tool_prof`, `skill_choice` (`{ count, from(15) }`),
  `spellcasting` (`{ ability(16), cantrips_known, spells_known, prepares, note }`),
  `subclass_level`, `asi_levels`, `starting_equipment`, `description`.

**Subraces/subclasses** are separate items of the **same type** linked to their base
via `item.parent_id` (see `md/database.md`). Base ⇔ `parent_id IS NULL`. Fetch a
base's variants with `GET /api/items/children?parentId=`. Create/link via the MCP
`handbook_item_create`/`update` `parentId` param.

There are **no custom detail renderers** for types 8/9 yet — they fall back to the
generic schema-based display in `HandbookItemDetail`. Custom `RaceDetailContent` /
`ClassDetailContent` are deferred to the create-flow polish phase.

### Potion (10) item type

Type 10 «Зелья» (`resources/items/item_10_shema.json`, seeded by
`v3-character-creation/07-item-type-potion.sql`, rarity + migration by `08`): `desc`,
`color` (**`color` field type** — hex, drives the vial liquid color), `rarity`
(`suggest`, dict type 23 «Редкость»), `cost` (int_by_suggest 17), `weight`. Custom
renderers: `PotionListItem` (list, type 10) + `PotionDetailContent` (detail, in
`CUSTOM_RENDERERS`), both built on the shared `PotionVial` (see
`md/features/items.md`). The vial ornaments key off rarity id 0–5 = dict ids 0–5.

**Rarity dictionary (suggest type 23).** Seeded by `08-potion-rarity.sql` with ids
0–5 deliberately matching the legacy integer `data.rarity` (0 Обычное … 5 Артефакт),
each carrying a `code` (`common`…`artifact`) and `color`. Because the ids line up, no
per-item rarity remap was needed in the migration.

The **`color` field type** (`{ "type": "color" }`) is rendered by `ItemEditModal`
(native picker + hex + swatches) — see `md/features/items.md` "color field type".

### Item-id binding on abilities (3/4) and spells (5)

Race/class abilities and spells bind to race/class by **item id**, not suggest:

- **Race ability (3)**: `race_ids`/`subrace_ids` — `object_array` of `{ id: item }`
  (→ type 8), plus `level`.
- **Class ability (4)**: `class_ids`/`subclass_ids` — `object_array` of `{ id: item }`
  (→ type 9), plus `level`.
- **Owners are arrays** so a feature shared by several (Тёмное зрение across 4
  races, Дополнительная атака / Боевой стиль across classes) is **one item with
  several owners** — never duplicate the ability per class/race; add the owner to
  the array. `progression.abilityMatchesBinding` matches if the chosen id is among
  the owners (it still tolerates a legacy single `class_id`/`race_id` via union).
  The single fields were dropped from the editor schema
  (`06-ability-binding-arrays-only.sql`); existing item DATA is migrated
  single→array by the `migrate-ability-binding` admin job.
- **Spell (5)**: `classes` — `object_array` of `{ id: <classItemId> }`. The legacy
  `classIds` (suggest-id array) stays until `MigrateSpellClassesJob` backfills.

These reference fields use the **`item` field type** (`{ "type": "item", "item_type": <N>, ... }`)
— a reference to another handbook item, storing a single numeric item id (or `null`) in
`item.data[key]`. `race_id`/`subrace_id` → type 8, `class_id`/`subclass_id` → type 9, and the
spell `classes` `object_array` inner `id` → type 9. `level`, `race_id`, `class_id`,
and spell `classes` are `filter: true`, so "what does class/race X grant at level N"
is a handbook query. This is the single progression source — the same query powers
the create-flow grants panel and the future level-up feature.

**Level scaling.** Abilities (3/4) also carry an optional `scaling` (`object_array`)
— per-level breakpoints for features whose values grow (Sneak Attack dice, Rage
uses/damage, Bardic die, Channel Divinity uses, …). Each breakpoint is a **full
snapshot** `{ level, value?, uses?, note? }`; consumers take the **last breakpoint
with `level <= character level`**. Level-gating text stays out of `desc` — `level`
owns "when gained", `scaling` owns "how it grows". Added to the editor schema by
`v3-character-creation/03-ability-scaling.sql`.

**Conditions** (pulled OUT of `desc`). Abilities (3/4) carry up to three optional
typed `object` fields — the type is implicit in the field name, and a feature may
have more than one at once:
- `prereq` `{ text, min_stats[{ ability(16), value }] }` — requirement to gain.
- `usage` `{ text, not_armor[suggest3], requires_armor[suggest3] }` — when it works
  (armor categories: Лёгкие/Средние/Тяжёлые/Щиты). `text` carries non-structurable
  clauses like "first attack of the turn".
- `choice` `{ text, count, from_suggest_id?, options? }` — pick `count` from a
  suggest dictionary (`from_suggest_id`, e.g. 15 skills / 6 languages) **or** from
  named inline `options[{ label, desc }]` (fighting styles, pact boons). With
  neither, it's a display-only hint. (The create-flow/level-up picker that renders
  this is separate wizard work — not built yet.)

Separate typed objects (not one `conditions` array) keep the editor on proven
nesting (`suggest_array`-in-`object` like bestiary `identity`, `object_array`-in-
`object` like spell `damage.dices`) and avoid a `type` discriminator. Editor
schema: `v3-character-creation/04-ability-condition.sql`.

### `item` field type

`{ "type": "item", "item_type": <typeId>, "key": "...", "name": "..." }` stores one numeric
item id in `item.data[key]`. Works at top level, inside `object`, and inside `object_array` rows.

- **Editor** (`features/character-editor/components/ItemEditModal.vue`): renders a button showing
  the referenced item's name; clicking opens `ItemPickerModal` scoped to `[field.item_type]`; on
  `pick` stores `item.id`; a `×` button clears it to `null`.
- **Detail** (`HandbookItemDetail.vue`): shows the referenced item's name (also via `formatSubValue`
  for nested `object`/`object_array`).
- **Name resolution**: `features/handbook/objects/lib/itemNames.js` (`ensureItemNames(ids)` +
  `itemName(id)`) — module-level reactive cache backed by `GET /api/items/by-ids?ids=`. Editor and
  detail prefetch all stored ids on mount/item-change.
- **schemaFields.js**: `defaultDataForFields` defaults an `item` field to `null`;
  `normalizeDataForSave` coerces it to number/`null`.
- **Filters**: top-level `item` fields are **skipped** in `ViewHandbook.filterFields` (not offered as
  filter chips yet) — they don't crash the filter popover but binding-by-item-id filtering in the UI
  is deferred.

## item_6_enemy.json (Bestiary schema)

Key fields: `creature_type`, `size`, `alignment` (tag: true), `is_legendary` (tag: true, bool), `source`, `source_page`, `environment`, `ac`, `ac_note`, `hp`, `hp_formula`, `speed`, `cr`, `xp`, `str`, `dex`, `con`, `int`, `wis`, `cha`, `saving_throws`, `skills`, `damage_immunities`, `damage_resistances`, `condition_immunities`, `senses`, `languages`, `description` (description), `lore` (description).

## Schema helpers

`features/handbook/objects/lib/schemaFields.js` — pure helpers (numberOrNull, isBooleanField, isFieldVisible, defaultDataForFields, normalizeDataForSave, collectSuggestIds, collectFieldKeys). Used by `HandbookItemDetail.vue` and `ItemEditModal`.

## Edit flow

"Редактировать" button in `HandbookItemDetail` emits `edit(item)` → `ViewHandbook` opens `ItemEditModal`. After save, `onItemSaved` updates `items` and `selectedItem` in place.

## Suggest create/edit modal

`shared/ui/SuggestEditModal.vue` is the single dialog used for both creating and editing a suggest value (dictionary entry). Props:

- `typeId` (required) — suggest type id, used in both POST and PUT URLs.
- `item` (optional) — when null, the modal is in create mode and posts to `/api/suggest/{typeId}`; when set, it edits and puts to `/api/suggest/{typeId}/{id}`.
- `initialName` (optional) — seed value for the name input in create mode (used by `SuggestAdd` to carry the current search query into the new entry).
- `zIndex` (optional) — overlay z-index, passed through to `DetailModal`.

Emits `created(item)` in create mode, `saved(item)` in edit mode, and always `close`.

Fields: name (text), code (mono text), color (text input + palette swatches + native color picker), SVG icon (file upload with live preview), and description — the description uses `shared/ui/InputDescription` (rich text editor) wrapped in a synthetic `{ id: 'desc', content: { placeholder } }` block so it produces HTML that the backend stores in the suggest's `desc` field (same column used by tooltips). SVG upload happens after the suggest is saved: the file is POSTed to `/api/suggest/{typeId}/{id}/svg`, then a follow-up PUT writes the returned `svgId/svg` URL back on the suggest with `svgChanged: true`.

Callers: `SuggestAdd` (search → create from query), `SuggestMultiSelect` (compact picker), `ViewDictionary` (both edit and "+ Добавить"). The previous separate `SuggestCreateSheet.vue` and `DictItemEditModal.vue` were merged into this component.
