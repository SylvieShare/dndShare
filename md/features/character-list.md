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

**Steps (dynamic):** Версия → Раса → Класс → Характеристики → Навыки → [Выборы] → [Магия] → Обзор. First step picks the ruleset (`StepVersion`; **2014** active, **2024** a disabled "Скоро" stub → `state.version`). Race/class are separate card-grid steps; subrace/subclass appear inline (subclass only when `subclass_level ≤ 1`, else a note). `CreatePreview` (always visible on desktop) shows the growing character: editable name (+ 🎲 random), monogram medallion, race·class·level, live ability **modifiers** + HP/AC/initiative/spell-DC, and a "Вы получите" list.

**Racial bonus display:** `CreatePreview` shows two clearly-distinct modes so a bonus never reads as a modifier. Before scores are entered: a "Бонусы расы к значению" grid of `+N` / `—` badges (accent when positive). Once scores are set: a "Характеристики" grid showing the **final score** (big) with its **modifier** (small, signed, coloured) beneath — score and mod are visually separate, never conflated.

**"Что получаете" — per-step breakdown:** below the stats, the preview lists **every** accrued bonus grouped by the wizard step that grants it (`sections` computed): **Раса** (fixed ASI, chosen floating ASI, speed, size, fixed + chosen languages, chosen race skills, chosen feat, race proficiencies, racial features), **Класс** (hit die, saves, class proficiencies, spellcasting, class features), **Навыки** (chosen skill proficiencies), **Магия** (chosen spells). Proficiencies are read **directly off each item's `data`** (`itemProfs`) so they're attributed to their real source (race vs class), not the merged `grants`. This makes it easy to see what each choice adds and to spot leftovers after a change/rollback. `featPool` is exported from the composable for feat-name resolution.

**Base list vs children:** `load()` filters races/classes to base items (`!item.parentId`) — subraces/subclasses are children (fetched per-parent via `/items/children`), so they never leak into the top-level Раса/Класс grids.

**Race choices live on the Race step** (`StepRace`, under Происхождение, in the "Выборы расы" block — shown when `hasRaceChoices`). All are read from the race/subrace item `data` and merged in `extractGrants(..., raceVariant)`:
- **Floating ASI** `asi_choice = { count, bonus }` → `grants.asiChoice`; a chip picker (`toggleAsiChoice`, `asiChoiceComplete`) choosing `count` abilities for +`bonus`. Half-Elf (`+2 CHA` + `asi_choice {count:2}`).
- **Named variants** `variants: [{ value, label, desc, asi?, asi_choice?, feat_choice? }]` → `grants.raceVariants`; a "pick one" whose chosen option's offers merge into grants. Human has **no subraces** — instead two variants: **Стандартный** (`asi` +1 to all six) and **Одарённый** (`asi_choice {count:2}` + `feat_choice {count:1}` → reveals a floating-ASI picker and a feat picker). `state.raceVariant` → `values.race_variant`.
- **Extra skills** `skill_choice = { count, from? }` → `grants.raceSkillChoice`; chip picker over `from` skill ids or (empty `from`) all suggest-15 skills → `state.raceSkillIds` → skill proficiencies. Half-Elf `{count:2}` (any two).
- **Extra language** `lang_choice = { count, from? }` → `grants.langChoice`; chip picker → `state.raceLangIds` → Языки proficiencies. Half-Elf carries a curated standard-language `from` list (Общий/Эльфийский excluded — already known).
- **Feat** `feat_choice = { count }` → `grants.featChoice`; Gifted Human. The picker is the shared **`ItemPickerModal`** (a searchable modal window with list + detail, server-backed `/items/search` over **type 7** — so it browses the *full* feat roster, not a preloaded subset). `StepRace` shows chosen feats as removable chips + a "Выбрать черту" button (hidden at the limit); `onFeatPick` → `toggleFeat(item.id)` (respects `featLimit`), `exclude-items` = `state.featIds`. Chip names resolve via the exported `featPool`. Picks → `state.featIds` → the sheet's `values.abilities_feats = [{id}]` block. ~40 PHB feats seeded (type 7).

All feed `finalScores`/proficiencies via `buildCharacterData({ raceVariant, asiChoice, raceSkillIds, raceLangIds, featIds })`. Completeness computeds (`raceVariantsComplete`, `asiChoiceComplete`, `raceSkillsComplete`, `raceLangsComplete`, `featComplete`) gate the Race step and the rail. The `asi_choice`/`skill_choice`/`lang_choice` fields are in the type-8 schema seed (`variants`/`feat_choice` are data-only); `ON CONFLICT DO NOTHING` → fresh DBs only, prod carries data via MCP.

**Rail forward-navigation + 4 states:** `ViewCreateCharacter` computes `maxReachable` = the first step that fails `validateStep`, or the last step when all pass. `CreateStepRail` gets it as `:reachable` and enables any step `i ≤ reachable` (not just `i ≤ current`). Each step renders in one of **four visual states**: `locked` (`i > reachable`, dimmed, disabled), `done` (`i < current`, purple check badge), `ahead` (`i > current && i ≤ reachable` — completed but past current: accent-outlined badge + a `›` jump chevron, clickable), and `active` (current, filled badge + strip). `goTo` is gated on `maxReachable`.

**Start-over:** the header carries an **Очистить** button → a `ConfirmDialog` → `reset()` (composable), which wipes `state` back to defaults, clears `spellPool`, and drops the localStorage draft.

**PHB races (type 8):** Human, Elf (High/Wood/Drow), Dwarf (Mountain/Hill), Halfling (Lightfoot/Stout), Gnome (Forest/Rock), Dragonborn, Half-Elf, **Half-Orc (Полуорк 4321)**, **Tiefling (Тифлинг 4322)** — the full core roster. A starter set of ~12 feats (type 7, ids 4323–4334) backs the feat picker.

**Persistence (localStorage `dnd-create-wizard-v1`):** the composable deep-watches `state` → `persist()`, and `restore()` (called on page mount) rehydrates it — so reload/back keeps every pick (forward selections survive going back). Restore sets a `hydrating` flag that suppresses the race/class reset watchers (and waits a `nextTick` before unlocking) so sub-selections aren't wiped. `clearPersist()` runs on successful create.

**Create anytime (empty allowed):** a **Создать** button sits next to **Дал/ее** on every step (`createNow`). If the character is incomplete (missing version/race/class/name/scores) it opens a `ConfirmDialog` ("создать как есть?"); on confirm `buildCharacterData` fills blanks with defaults (name → «Без имени», scores → 10, null race/class). `submit()` is **not** gated by step validation — only `Далее` is.

**State + logic:** `composables/useDndCreateWizard.js` owns everything and is **provided** (`provide('createWizard', wz)`) so step components `inject` it (no prop drilling). Beyond the base state (races/classes types 8/9, abilities 3/4, subs via `/items/children`, spells 5, `grants`, `isCaster`, `skillOptions`/`skillLimit`, `finalScores`, point-buy) it derives, for the live preview and nicer UX: `mods`, `maxHp`, `unarmoredAc`, `initiativeMod`, `spellDc`/`spellAtk`, `primaryAbilities` (★-marked stat tiles), `subclassAtCreation`/`requiresSubrace`/`requiresSubclass`, `skillStat`/`skillMod` (ability + live modifier per skill), the cantrip/1st-level **split with per-section limits** (`cantripPool`/`spell1Pool`/`cantripLimit`/`spell1Limit`/`toggleSpell(id,kind)`/`spellsComplete`), plus `randomName()` and `quickBuild()` (standard array by class priority). `STANDARD_ARRAY`, `POINT_BUY_BUDGET`, `pointCost` are exported for `StepStats`.

**Components** (`components/wizard/`): `SelectTile.vue` (reusable borderless selectable tile — monogram, strip, check), `CreateStepRail.vue`, `CreatePreview.vue`, `labels.js` (STAT_SHORT/FULL, `asiSummary`, `classSummary`, `formatMod`, `monogramOf`), and `steps/{StepRace,StepClass,StepStats,StepSkills,StepChoices,StepSpells,StepReview}.vue`. The page + steps are thin presentation; **all mechanics stay in the composable + the pure engine**.

**Character assembly** is still the pure, unit-tested engine under `settings/dnd/` (`newCharacter.js`, `creation/{grants,progression,buildCharacter}.js`; see `md/features/character-editor.md`). `buildCharacterData(selections)` produces `{ values }`: blank preset → grants → scores + racial ASI → HP (hit die + CON) → skill proficiencies → spells → race/class stored as `{ id, name }` refs.

**Legacy:** `CharacterCreateModal.vue` (MorphSheet) + `createFormData.js` remain for non-D&D `createForm` settings (VTM). The old `components/wizard/DndCreateWizard.vue` + `DndStatAssign.vue` (single-modal wizard) are **superseded** by the page and no longer reached for D&D — safe to delete once VTM is confirmed unused.
