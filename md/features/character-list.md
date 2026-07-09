# Character List

Read this before touching `features/character-list`.

Main pages:

- `features/character-list/pages/ViewListCharacters.vue` — the list.
- `features/character-list/pages/ViewCreateCharacter.vue` — the D&D create wizard page (`/chars/new`; see below).

Components:

- `features/character-list/components/CharBox.vue`
- `features/character-list/components/CharStatRadar.vue`
- `features/character-list/components/CharacterCreateModal.vue` — legacy `createForm` modal (VTM only now).
- `features/character-list/components/createFormData.js`
- `features/character-list/components/wizard/` — the create-page pieces (`SelectTile`, `CreateStepRail`, `CreatePreview`, `labels.js`, `steps/Step*.vue`).

## Card data — accessors, not `pathValues`

The list card reads its display fields through the **per-setting semantic accessors** (`settings/dnd/accessors.js`, resolved via `settingAccessors(template.schema)` from `settings/index.js`), the same source the character sheet uses — **not** the backend `pathValuesForList` column. The page resolves a char's accessors with `accessorsFor(templateId)`; `CharBox` calls `accessors.displayName/avatar/subtitle/level/abilities(data)`.

`pathValues` remains a **fallback** in `CharBox` for legacy settings (e.g. VTM) that have no accessors yet. When `accessors` is null the card uses the old `getByPath(data, pathValues.*)` reads and renders no radar. Once VTM moves onto accessors, drop the `pathValues` path and the `path_values_for_list` dependency entirely.

## Card layout

`CharBox` is a flex row, **no border**, taller + wider than before (`min-height: 124px`, grid `minmax(440px, …)`):

1. **Ability radar** (`CharStatRadar`) — on the **left**, only when `accessors.abilities` exists (D&D). Hexagon: 6 axes 60° apart from center, the value polygon shows each ability score (mapped against `max`, default 20). Each axis is labelled with the ability's **suggest icon** (suggest type 16, title ids STR=1…CHA=6 → `svg` + `color`) fixed at the **outer rim vertex** of that axis (centered on it; `GRID_R` is kept at 42 so the rim icons stay fully inside the box). No numeric values. `CharBox` `ensure(16)`s the suggest store (via a watch, because accessors arrive after the template store loads).
2. **Avatar** — `width: 96px`, `align-self: stretch` (full card height), no padding.
3. **Body** — name / subtitle (race · class) / meta chips (level, template name, relative date), and **below a divider the current session** when one exists. Level comes from `accessors.level` → `values.lvl.level` (BLOCK_LVL `{ level, exp }`).

## Sessions on the list

`GET /chars` returns `sessionsByChar: { [charUuid]: CharSessionBrief[] }` (batched in one query — `GameSessionRepository.getSessionsByCharUuids`, ordered by `session.changed_at DESC`). The page passes `topSession(uuid)` (first/most-recent brief) to `CharBox`, which shows a status dot + session name + chapter label. Status-dot colors mirror `CampaignBadge` / `CharEditorToolbar`.

## Navigation

Plain `router.push` (no morph) — see `md/frontend.md` "List ↔ character navigation (plain)". `CharBox` still seeds `charSeed.js` on click so the page renders synchronously.

## D&D create wizard — dedicated page `/chars/new`

D&D creation is a **full page**, not a modal. The "+ Новый персонаж" tile's `openCreateModal(e)` checks for a dnd5e template (`resolveSetting(t)?.system === 'dnd5e'`) and, if found, `router.push('/chars/new')`; only legacy settings (VTM `createForm`) still open the `CharacterCreateModal` morph sheet. Route: `pages/ViewCreateCharacter.vue` (`meta.prefetch` ensures the template store). The page resolves the target `templateId` itself (`templateStore.all.find(resolveSetting…dnd5e)`) and POSTs `/chars` on finish, then routes to `/char/:uuid`.

**Layout (borderless, matches the sheet look):** three columns — `CreateStepRail` (left) · step content (center) · `CreatePreview` (right). Under 920px the rail + preview hide (single column). Selection uses the `BaseTile` vocabulary: `--block-bg` fills, **no borders**, accent-tint + 3px strip for the chosen item, `.sheet-section-title` headers, `MultiToggle` for stat methods, `--font-display` for names/titles, tabular sans for numbers, `--accent-2` (teal) for the Создать button.

**Steps (dynamic):** Раса → Класс → Характеристики → Навыки → [Выборы] → [Магия] → Обзор. Race/class are separate card-grid steps; subrace/subclass appear inline (subclass only when `subclass_level ≤ 1`, else a note). `CreatePreview` (always visible on desktop) shows the growing character: editable name (+ 🎲 random), monogram medallion, race·class·level, live ability **modifiers** + HP/AC/initiative/spell-DC, and a "Вы получите" list (speed, size, hit die, saves, proficiencies, languages, features).

**State + logic:** `composables/useDndCreateWizard.js` owns everything and is **provided** (`provide('createWizard', wz)`) so step components `inject` it (no prop drilling). Beyond the base state (races/classes types 8/9, abilities 3/4, subs via `/items/children`, spells 5, `grants`, `isCaster`, `skillOptions`/`skillLimit`, `finalScores`, point-buy) it derives, for the live preview and nicer UX: `mods`, `maxHp`, `unarmoredAc`, `initiativeMod`, `spellDc`/`spellAtk`, `primaryAbilities` (★-marked stat tiles), `subclassAtCreation`/`requiresSubrace`/`requiresSubclass`, `skillStat`/`skillMod` (ability + live modifier per skill), the cantrip/1st-level **split with per-section limits** (`cantripPool`/`spell1Pool`/`cantripLimit`/`spell1Limit`/`toggleSpell(id,kind)`/`spellsComplete`), plus `randomName()` and `quickBuild()` (standard array by class priority). `STANDARD_ARRAY`, `POINT_BUY_BUDGET`, `pointCost` are exported for `StepStats`.

**Components** (`components/wizard/`): `SelectTile.vue` (reusable borderless selectable tile — monogram, strip, check), `CreateStepRail.vue`, `CreatePreview.vue`, `labels.js` (STAT_SHORT/FULL, `asiSummary`, `classSummary`, `formatMod`, `monogramOf`), and `steps/{StepRace,StepClass,StepStats,StepSkills,StepChoices,StepSpells,StepReview}.vue`. The page + steps are thin presentation; **all mechanics stay in the composable + the pure engine**.

**Character assembly** is still the pure, unit-tested engine under `settings/dnd/` (`newCharacter.js`, `creation/{grants,progression,buildCharacter}.js`; see `md/features/character-editor.md`). `buildCharacterData(selections)` produces `{ values }`: blank preset → grants → scores + racial ASI → HP (hit die + CON) → skill proficiencies → spells → race/class stored as `{ id, name }` refs.

**Legacy:** `CharacterCreateModal.vue` (MorphSheet) + `createFormData.js` remain for non-D&D `createForm` settings (VTM). The old `components/wizard/DndCreateWizard.vue` + `DndStatAssign.vue` (single-modal wizard) are **superseded** by the page and no longer reached for D&D — safe to delete once VTM is confirmed unused.
