# Sessions

Read this before touching `features/sessions`.

`features/sessions/pages/ViewSessions.vue` lists sessions. `pages/ViewSession.vue` is the single-session shell — a tiled layout (see "ViewSession layout" below) with a left participants tile, a top toolbar tile, a middle tabbed tile (Бой / Сцена / Заметки), and a right column of dice + music tiles.

## Scenes

The middle area has a "Сцена" tab next to "Бой" / "Заметки". `SceneTab.vue` is its content:

- A chapter pill row at the top mirrors `props.chapters` and highlights the active chapter. Chapter rename/create lives in the session toolbar (not duplicated here).
- The current-scene trigger shows "<chapter-roman>·<scene-index>" + name (or "Сцена не выбрана") with a chevron. Trigger is capped at `max-width: 400px`. To the right of the trigger live two action buttons (DM, only when a scene is selected): pencil "Переименовать" (opens a small Teleport rename modal pre-filled with the current name) and trash "Удалить сцену" (opens a Teleport confirmation modal; on confirm calls `apiDeleteScene` and clears the current selection / `chapterSceneCount`). Clicking the trigger opens a Teleport-less popover anchored under the trigger: search input + scrollable list + "+ Новая сцена" row. Search is local-substring; the create row picks up the current search as the seed.
- Creating a scene opens a small Teleport modal (focused on mount, Enter submits, Esc cancels). The rename/delete confirmation modals reuse the same dialog styles.
- The selected scene renders an editable title plus a list of `SceneItemTile` cards. Each card has:
  - A thin 3px color strip on the left edge, inset 10px top/bottom so it does not reach the rounded corners (`border-radius: 0 2px 2px 0`).
  - A type-icon chip (dark background, colored SVG — lines for text, bullets for list) positioned before the title in the head row.
  - An editable title, and a `…` menu (`shared/ui/RowActionMenu.vue`) with "Редактировать", a color palette, "Удалить плитку".
  - Body content left-aligned with the type-icon column (offset of drag handle + gap = 22px left padding).
- Tiles default to view mode. The `…` menu has "Редактировать" — switches to edit mode, bottom-right shows "Отмена" / "Сохранить". Newly created tiles open in edit mode (`startInEdit` prop is driven by `newlyCreatedId`). Saving emits a full `{ title, data, dataChanged, color, colorChanged }` patch.
- Item types:
  - `text` — `data: { text }`. In edit mode uses the shared `InputDescription` (from `shared/ui/`) — the tile `provide`s a synthetic `charCtx` with `editMode: true` and passes a stub `block` (`{ id, content.placeholder }`). The view mode renders `data.text` via `v-html` so HTML produced by the editor displays correctly.
  - `list` — `data: { rows: [{ left, right }] }`. Edit mode uses a `0.45fr / 1fr` grid for input alignment. View mode uses `max-content / 1fr` so the left key column shrinks to its content width.
- Drag-and-drop: each tile has a 6-dot drag handle (DM-only). `SceneTab` uses `shared/composables/useSortable.js` (single `items` group). On drop, the array is re-spliced and `PATCH /scenes/{id}/items-order` writes the new sequence (`MAX(order) + 1` would conflict; the controller walks the request `ids` and sets `order = idx + 1` for each item that belongs to the scene). The dragged tile uses `.scene-item--placeholder` (dashed purple outline, content hidden).
- The bottom "Добавить блок" bar has two icon buttons — "Текст" (lined icon) and "Список" (bullets icon). Click immediately creates an empty tile (no title) appended to the scene; the new tile auto-enters edit mode and focuses the title input via `nextTick`, so the user types the name right after creation. Each new tile is assigned a random color from `SCENE_PALETTE` (see `features/sessions/lib/scenePalette.js`); the same palette feeds the per-tile color picker.
- Last opened scene is remembered per chapter in `localStorage` under `scene:last:<sessionUuid>:<chapterId>`. `loadScenes` restores it after fetching the chapter's scene list, so on full page reloads the previously viewed scene reopens. Within a single page session the tab is kept alive (see "Tab persistence" below), so the in-memory state survives tab switches without refetching.

Backend (`SessionSceneController.kt`):

- `GET /api/sessions/{uuid}/chapters/{chapterId}/scenes` — list scenes in a chapter (members read).
- `POST /api/sessions/{uuid}/chapters/{chapterId}/scenes` `{ name }` — DM only.
- `GET /api/sessions/{uuid}/scenes/{sceneId}` — scene + items.
- `PATCH /api/sessions/{uuid}/scenes/{sceneId}` `{ name }` — rename, DM only.
- `DELETE /api/sessions/{uuid}/scenes/{sceneId}` — cascades the items.
- `POST /api/sessions/{uuid}/scenes/{sceneId}/items` `{ type, title, data?, color? }` — auto-orders via `MAX(order) + 1` per scene.
- `PATCH /api/sessions/{uuid}/scenes/{sceneId}/items/{itemId}` accepts partial `{ title?, data?, dataChanged?, color?, colorChanged?, order? }`. The `Changed` flags are required because both `data` and `color` are nullable in the DB and you may want to write `null`.
- `PATCH /api/sessions/{uuid}/scenes/{sceneId}/items-order` `{ ids }` — bulk-rewrites `order` for each item in `ids` to `index + 1`. DM only.
- `DELETE /api/sessions/{uuid}/scenes/{sceneId}/items/{itemId}`.

All write endpoints require the session owner; the helpers `requireDm` and `requireSceneInSession` enforce ownership and that the scene belongs to a chapter of the requested session.

## Chapters

`session.current_chapter_id` references rows in `session_chapter (id, session_id, number, name)`. The session toolbar shows only the session name (description is in the edit modal); after a vertical divider comes a minimal chapter trigger:

- The trigger is a transparent-background bordered pill containing a purple chip with the chapter number in Roman numerals (`romanNum(currentChapter.number)`, display-font for the chip), followed by the chapter name and (for DM) a chevron. No "Глава" prefix in the trigger.
- DM sees the bordered pill as clickable; click opens a dropdown listing chapters via `GET /api/sessions/{uuid}/chapters`. Each row in the dropdown shows a roman-numeral chip (outlined for inactive rows, filled purple for the active row), the full "Глава N · name" label, and a pencil edit button on the right. The active row has a purple border + tint. The bottom row is a dashed "+ Новая глава…" entry with a purple "+" chip and a borderless input. Each row has a pencil button that turns the name into an inline input (Enter saves via `PATCH /api/sessions/{uuid}/chapters/{id}`, Esc cancels). The bottom of the dropdown has an input that creates a new chapter via `POST /api/sessions/{uuid}/chapters` (auto-numbered as `MAX(number) + 1` per session, immediately set as the current chapter).
- Players see the chapter title as plain text.
- Picking a chapter calls `PATCH /api/sessions/{uuid}/current-chapter { chapterId }`.
- `POST /api/sessions` automatically creates a chapter "Вступление" and sets it as the current chapter.

`GET /api/sessions/{uuid}` embeds `currentChapter: SessionChapter | null` alongside `session.currentChapterId` so the toolbar can render without a second request.

## File layout

```
features/sessions/
  pages/
    ViewSessions.vue        ← session list + create/join modals
    ViewSession.vue         ← single session shell, three columns, polling
  components/
    SessionCard.vue
    SessionHero.vue
    SessionTopBar.vue            ← top bar: back link, status badge+dropdown, session-info, chapter trigger+dropdown
    SessionCreateModal.vue
    SessionJoinModal.vue
    SessionParticipantCard.vue   ← left-column participant tile (multi-select)
    EncounterTab.vue             ← thin orchestrator for the "Бой" tab
    EncounterRow.vue             ← combatant row shell (whole-row drag, init input, name/badge, side popover, note dialog)
    EncounterAvatar.vue          ← creature/player art (frameless, bottom-pinned): player photo / NPC item `svg` art / letter fallback
    EncounterHpBar.vue           ← HP bar + temp overlay + DS pips (player) / skull+graveyard (npc); HP click → open calc/edit
    EncounterRowMenu.vue         ← RowActionMenu contents (states/note/clone count/colors/revive/delete)
    NpcPickerModal.vue           ← bestiary picker modal
    SceneTab.vue                 ← scenes tab content (chapters + scene tiles)
    SceneItemTile.vue            ← scene item card (color strip, type icon, rich-text body)
    DicePanel.vue                ← dice tray (see md/features/dice.md)
    MusicPanel.vue               ← per-session music player (see md/features/music.md)
    MusicLibraryModal.vue        ← music library / track browser
    MusicTrackRow.vue            ← single track row used by the library
  composables/
    useEncounter.js              ← facade: state, load/save, computed groups, sortable, view helpers
    useEncounterFlow.js          ← combat lifecycle: toggle/next/prev turn, send-to-group, graveyard/revive, drop reorder
    useEncounterHp.js            ← HP parts/percent/color/label, calc & edit modals, player/NPC HP & death-save handlers
    useEncounterInitiative.js    ← initiativeBonus + rollInitiativeFor
    useEncounterNpcData.js       ← bestiary item cache + resolvers (itemId+override model), legacy migration
    useEncounterNpcs.js          ← addNpc/addSimpleNpc/cloneNpc/removeNpc, detailNpc + showNpcPicker/showSimpleForm
    useEncounterPlayers.js       ← findParticipant + name/ava/ac/hp/subtitle lookups, applyLocalPatches, mergeParticipants
    useEncounterSelection.js     ← selectedUids + toggle/clear/selectAll/counts
    useEncounterStates.js        ← statesBlock/Value/setStates + setNote
    useTrackUpload.js            ← drag-and-drop + file picker + upload progress for MusicLibraryModal
    useParticipantPolling.js     ← 2s poll loop refreshing participant data (HP/version) for the DM
    useSessionChapters.js        ← chapter list + create/rename/setCurrent (also exports `romanNum`)
    useSessionSelection.js       ← participant multi-select (selectedIds Set, selectionMode, toggle/clear)
    useSessionStatus.js          ← session status badge state + `STATUS_CFG`/`STATUS_OPTIONS`
  lib/
    encounterHelpers.js          ← pure helpers (makeUid, getByPath, setDeep, nextTieBreak, matchesGroup) + SIDE_/ICON_COLOR_ constants
    musicLibrary.js              ← pure music helpers (fmtTime, probeDuration)
    scenePalette.js
```

## Tab persistence

`ViewSession` keeps tab components alive once visited. The `tabsLoaded` reactive map (`{ combat: true, scene: false, notes: false }`) gates `v-if` on each tab — flipped to `true` the first time the user activates a tab — and `v-show="activeTab === '<tab>'"` toggles visibility. Once a tab is rendered, switching away just hides the DOM; switching back skips re-init, re-fetch, and component lifecycle hooks.

## DM-only access

`GET /api/sessions/{uuid}` is restricted to the session owner — non-owners get a 403, and `ViewSession` catches the failure to `router.replace('/sessions')`. Players see their sessions only on the list page.

On the list page (`ViewSessions`), player-role cards are rendered with the `s-card--readonly` modifier — no hover ring and no navigation on click. The role label and `…` menu still work, so players can leave or inspect the chapter/avatars; entering the session shell is DM-only. `SessionHero` mirrors this: it hides the "Войти в сессию →" button when `session.myRole !== 'gm'`.

## Session list cards

`GET /api/sessions` returns enriched items: `participants: [{ charUuid, avaUrl }]`, `currentChapter: { number, name } | null`, plus the existing `myRole` and `myCharUuid`. `GameSessionRepository.getParticipantsBrief` joins `session_participant + char + char_template`, parses `char_template.path_values_for_list` (JSON), and resolves `data.<pathValues.ava>` server-side so the list endpoint stays one round trip. `getCurrentChapters` joins `session.current_chapter_id` to `session_chapter` for the same list.

`SessionCard` renders character avatars (image when `avaUrl` is non-empty, colored circle with the first uuid char as fallback) — a stack of up to four for the GM card, a single circle for the player's own char. The current chapter is shown as a small purple pill formatted `Глава <number>: <name>` (or just `Глава <number>` if the name is empty) below the session name. `SessionHero` shows the same chapter info as a third badge alongside status and system.

## ViewSession layout

The shell mirrors the character-page aesthetic: every region is a **tile** (`.tile` = `background: var(--surface); border-radius: var(--r-lg)`, **no borders**) floating on the `--bg` page, separated by `gap: 12px`. The page is **fixed-width**: `.layout` is `width: min(1480px, 100%); margin: 0 auto; padding: 12px` so it centers with `--bg` gutters on wide screens. Do not reintroduce the old `border-right` dividers — separation is the gap between tiles.

`.layout` is a flex row:
- `col-left` tile (260px participants, full height, `overflow-y: auto`).
- optional `col-actions` tile (140px, slides in while `selectionMode` is on via the `action-panel` width/opacity transition).
- `main-area` (flex column, `gap: 12px`, `flex: 1`):
  - `toolbar-tile` — wraps `SessionTopBar` (back link, status, session name, chapter trigger). Lives here now, not above the layout, so it sits as a tile on top of the content.
  - `main-row` (flex row, `gap: 12px`, `flex: 1`):
    - `col-middle` — a **transparent** flex column (not a tile). Mirrors the character sheet's `inner-tabs`: the tab bar (`shared/ui/SlidingTabs`, the shared sliding-underline switcher) sits transparent above the content, and **`tab-content` is the filled tile** (`--surface` + `--r-lg`). So the nav reads as transparent on the page and the content is the rounded card — same as the character page (do not put the tile background on the nav). **`tab-content` does NOT scroll itself** — it's `display: flex; flex-direction: column`, and the active tab child (`.enc-wrap` / `.scene-tab`) is the scroll container (`.tab-content > * { flex: 1; min-height: 0; overflow-y: auto }`). This is deliberate: a **rounded** (`border-radius`) scroll container disables `backdrop-filter` blur on its sticky descendants (the encounter toolbar), so the rounded tile must not be the scroller. `ViewSession` owns `tabItems` (`combat/scene/notes`) and `selectTab` (which routes `scene` through `onActivateScene` for lazy chapter loading).
    - `col-right` (300px, hidden under 900px) — a flex column of two `.side-tile` tiles wrapping `DicePanel` (see `md/features/dice.md`) and `MusicPanel` (see `md/features/music.md`). `overflow-y: auto` so both scroll together when the viewport is short.

`DicePanel` / `MusicPanel` provide their own padding only — the surrounding `.tile` wrapper in `ViewSession` gives them the block-bg + radius. `MusicLibraryModal` opens from a link inside `MusicPanel`.

### Participant column: open sheet vs. action selection

`SessionParticipantCard` is a **backgroundless** row (no tile bg, no border, no radius) — full column width, separated from its neighbours by a `border-bottom: 1px solid var(--border)` divider applied from `ViewSession`'s `.participants-list :deep(.p-card:not(:last-child))` (the list itself uses `gap: 0`). Hover/selected add only a faint `color-mix` tint. It has no internal menu. The column has two modes, tracked in `useSessionSelection` (`selectionMode: ref(false)`):

**Name/avatar/HP resolution.** The card reads its display fields through `participantView.js` (`pvName/pvAvatar/pvSubtitle/pvHp`), which resolve the per-setting **accessors** from the participant's `templateId` via the template store. `ViewSession` therefore calls `templateStore.ensure()` on mount — without the templates loaded, `accessorsFor(entry)` returns null and the name falls back to the (now-NULL) `path_values_for_list`, rendering "(без имени)". Keep that `ensure()` call.

- **Default (not selection mode):** clicking a tile opens that participant's character sheet in `CharacterSheetModal` (`ViewSession.onTileClick` sets `sheetUuid` to the participant's `charUuid`). Tiles render **no** checkbox (`SessionParticipantCard` shows the `.p-check` box and selected highlight only when `selection-mode` is true). Below the list a single `Выбрать игроков для действия` button (`.pick-btn`) calls `enterSelectionMode()`.
- **Selection mode:** `enterSelectionMode()` flips `selectionMode` on and selects all (`selectAll`). Tiles show checkboxes and toggle selection on click. Everything stays **inside the left column** — there is no separate slide-in `col-actions` column anymore. Below the list:
  - `.sel-controls` row: `Выбрать всех` (`selectAll`) and a second `.sel-btn` that is `Сбросить` (`clearSelection`) when something is selected, or **`Отмена`** (`exitSelectionMode`) when the selection is empty.
  - `.sel-actions` block beneath it lists the action buttons (currently just `Выгнать (N)` → `kickSelected`, which exits selection mode after kicking). No `Отмена` button here — cancel lives in the controls row above.
- **Left-column button styling:** all of these are **borderless with a backing** (`--surface-raised` default / `--surface-active` hover; `.pick-btn` uses an `--accent` tint; `.action-btn--danger` uses a `--danger` tint). The bottom **invite block** (`.invite-section`: create-character button + invite code) sits on a recessed `var(--bg)` panel (`--r-md`), and the invite-code row uses `--surface` + `--border` to read against it.

`selectedIds` is a `ref(new Set())` of `charId`s; toggling rebuilds the set so reactivity triggers.

### Character sheet modal

`features/sessions/components/CharacterSheetModal.vue` renders a full character sheet inside a fullscreen `AppModal` (`fullscreen` prop — `min(1400px,96vw) × 92vh`, zero padding, built-in ✕ hidden). Props: `uuid`, `isDm`, `zIndex`. It reuses the editor composables (`useCharacterData`, `useSaveDebounce`), `CharEditorToolbar` (in `modal` mode — back button becomes a ✕ that emits `close`, session badge hidden, public toggle gated by `canTogglePublic`), and renders desktop tabs via `TemplateBlockInner` (no mobile swipe — sessions are desktop). `canEdit = isOwner || isDm`, so the DM can flip edit mode and edit any participant's sheet. Edits save through the editor's debounced `PUT /char/{uuid}/data`, which now allows the session owner (DM) in addition to the char owner (see backend note).

### Invite link / join landing

The session left column's invite block has **two** copy buttons next to the code: the original "Скопировать код" (copies just the invite code) and "Скопировать ссылку" (copies `${origin}/join/<inviteCode>`). Both swap to a check-mark glyph for ~1.5s on copy.

`/join/:code` → `features/sessions/pages/ViewJoinSession.vue` is the public landing for the invite link:

- On mount: `accountStore.checkAuth()` — if not signed in, render an "🔒 Нужно войти" card with a link home. Then `GET /api/sessions/by-code/{code}` (`SessionByCodeResponse` was extended to include `description`, `status`, `systemName`, `chapterNumber`, `chapterName` so the landing renders without a second request). Missing/invalid code → "🗺️ Сессия не найдена" card.
- Hero block: status pill (color from `STATUS_CFG`), big session name, optional chapter chip (`romanNum(chapterNumber) · chapterName`), system chip, description. A purple radial glow in the top-right corner.
- "Выбери персонажа для вступления": grid of the user's characters (same `pathValues`-based name/avatar/who/lvl as `SessionJoinModal`) — click → `joinSession(uuid, char.id)` → `router.push('/char/' + char.uuid)`. Last grid tile is "+ Создать нового" (dashed), opening `CharacterCreateModal`; on create, the new character is auto-joined to the session and the user lands on their sheet.

### Create character from the session

Above the invite block in the left column, `Создать персонажа` opens `CharacterCreateModal` (from `character-list`, fed `templateStore.all`). On submit `ViewSession.createChar` does `POST /chars` → the response now includes `charId`; it then `joinSession(uuid, charId)`, refetches participants via `getSession`, closes the create modal, and opens the new character's sheet in `CharacterSheetModal`.

### Polling

`ViewSession` polls character data every 2s via `pollChars` (sessionsApi). Per-char versions tracked in `versions`. Changed entries get spliced into `participants` and the poll indicator dot pulses (`changed` / `error` classes).

**Optimistic local patches.** When the DM changes a player's data from the encounter UI (HP via `onPlayerHpChange` / `onPlayerDsChange`, statuses via `setStates`), `useEncounter` calls a shared `applyLocalPatches(charId, patches)` helper *before* awaiting `charactersApi.patchData(...)`. The helper walks each patch path and mutates `participant.data` in place via `setDeep`, so the row's HP bar / status chips re-render instantly. The next 2s poll cycle still runs; if the server returns a newer version, the freshly fetched `data` replaces the optimistic one, so any server-side merges or concurrent edits eventually win.

## Encounter tab (Бой)

The encounter tab is split into:
- orchestrator `EncounterTab.vue`,
- row shell `EncounterRow.vue` (whole-row drag, init input, name+badge, side popover, note dialog, states editor),
- row sub-components: `EncounterAvatar.vue`, `EncounterHpBar.vue`, `EncounterRowMenu.vue`,
- composable `useEncounter` (see layer table below).

Each row sub-component `inject('encounter')` and takes `combatant` (+ `section` where needed) as props. `EncounterRowMenu` emits `edit-states` / `edit-note` for dialogs that live in the parent row. Keep them in sync — adding state should normally only touch the relevant composable layer, not the row shell.

### `useEncounter({ sessionUuid, participants, canEditPlayers })`

Public facade composable. `participants` must be a `Ref<Array>` so participant lookups stay reactive. Returns plain refs/computeds/functions; the consumer is expected to wrap with `reactive()` before providing.

Internally split into focused sub-composables — touch the right one when adding behaviour:

| Layer | File | Owns |
| --- | --- | --- |
| facade | `useEncounter.js` | `encounter` ref, `load`/`scheduleSave`, computed groups (`inCombat`, `reserveNpcs`, `reservePlayers`, `deadCombatants`), `sortable`, creature-type resolution, view helpers (`subtitle`, `avatarStyle`, `tileColor`, `badgeClass`/`badgeLabel`) |
| selection | `useEncounterSelection.js` | `selectedUids` set, `isSelected`/`toggleSelected`/`clearSelection`/`selectAllInGroup`/`selectedCountInGroup`/`selectedNpcCount`/`selectedRerollCount`, plus internal `unselect`/`pruneToExisting` |
| players | `useEncounterPlayers.js` | `findParticipant`, `getPlayerAva/Ac/Hp`, `playerDisplayName`, `participantSubtitle`, `applyLocalPatches`, `mergeParticipants` |
| hp | `useEncounterHp.js` | `hpCalcNpc/Player`, `hpEditNpc` refs; `hpParts/Percent/TempPercent/Color/Label/playerHpLabel/hpTempValue`, `displayAc`, `npcHpObj/playerHpObj/npcDsHp/playerDsHp`, `openHpCalc`/`closeHpCalc(Player)`/`open/closeNpcHpEdit`/`setNpcHpField`, `onNpc/PlayerHpChange`, `onNpc/PlayerDsChange`, `npcHpFormula`, `rollNpcHpFromFormula`, `canEditPlayerHp` |
| initiative | `useEncounterInitiative.js` | `initiativeBonus(c)`, `rollInitiativeFor(c)` |
| states | `useEncounterStates.js` | `statesBlock(c)`, `statesValue(c)`, `setStates(c, ids)`, `setNote(c, text)` |
| npc data | `useEncounterNpcData.js` | `npcItemCache`, `cacheItem`, `ensureNpcItems`, resolvers `npcItem/npcData/npcName/npcAc/npcHpMax/npcDex/npcHpFormula`, `migrateCombatant` |
| npcs | `useEncounterNpcs.js` | `showNpcPicker`, `showSimpleForm`, `detailNpc`, `openNpcDetail`/`closeNpcDetail`, `addNpc`/`addSimpleNpc`/`cloneNpc`/`removeNpc`/`removeSelectedNpcs` |
| flow | `useEncounterFlow.js` | `setInitiative`/`toggleSurprised`/`toggleSide`/`setSide`/`setIconColor`, `rerollSelectedInitiative`, `toggleCombat`, `nextTurn`/`prevTurn`, `willMoveToGroup`/`selectedToMoveTo`/`sendSelectedTo`, `sendToGraveyard`/`reviveCombatant`, `performSortDrop` |

Pure helpers and constants (`makeUid`, `getByPath`, `setDeep`, `nextTieBreak`, `initRank`, `matchesGroup`, `sideOf`, `SIDE_COLOR`/`SIDE_LABEL`/`SIDE_OPTIONS`, `ICON_COLOR_SWATCHES`, `BESTIARY_TYPE_ID`, `SAVE_DEBOUNCE_MS`, `ensureBestiaryType`/`bestiaryTypeRef`) live in `features/sessions/lib/encounterHelpers.js` and are imported wherever needed.

The facade composes layers explicitly: each sub-composable receives only the refs/functions it actually needs (no shared `this`). Two coordination helpers stay in the facade: `getCombatant(uid)` and `mutate(fn)` — they're passed into layers that need to mutate the encounter array.

**Persisted state** (saved to `/api/sessions/{uuid}/encounter` as JSONB, debounced 500ms):
```ts
{
  active: boolean       // combat in progress
  round: number         // 0 during surprise round, 1+ during normal play
  turnIndex: number     // index into `inCombat` of whose turn it is
  combatants: Combatant[]
}
```

**Combatant shape:**
```ts
{
  uid: string                                                    // 'p-<charId>' for players, random for NPCs
  type: 'player' | 'npc'
  position: 'combat' | 'reserve'
  initiative: number | null
  surprised: boolean
  tieBreak: number                                               // secondary sort key for equal initiative
  side?: 'enemy' | 'ally' | 'neutral' | 'minion'                 // NPCs only; chosen via badge popover
  iconColor?: string                                             // NPCs only; DM-chosen avatar border color, takes precedence over the side color
  // player-only
  charId, charUuid, name
  // npc-only
  itemId: number | null            // bestiary item id; null for ad-hoc "simplified" creatures
  override: { name?, ac?, hp?, cr?, creature_type?, dex?, hp_formula?, description? }  // sparse overrides of item.data + name
  hpCurrent, hpTemp, hpDsSuccess, hpDsFailure   // runtime combat state (NOT item data)
}
```

**NPCs store `itemId` + a sparse `override`, NOT a full item copy.** The bestiary item is fetched lazily and cached; display/derived fields (`name`, `ac`, `hp` (max), `cr`, `creature_type`, `dex`, `hp_formula`) are resolved as `{ ...item.data, ...override }` (override wins). Only runtime combat state (`hpCurrent`, `hpTemp`, `hpDsSuccess/Failure`, `initiative`, `position`, `surprised`, `side`, `iconColor`, `note`, `states`, `tieBreak`) lives directly on the combatant. Editing an NPC's max HP / AC / etc. writes into `override`. Ad-hoc "simplified" creatures have `itemId: null` and keep everything in `override`.

`useEncounterNpcData.js` owns this: `npcItemCache` (id→item ref), `cacheItem`, `ensureNpcItems(combatants)` (batch-fetch missing via `itemsApi.byIds`), resolvers `npcItem/npcData/npcName/npcAc/npcHpMax/npcDex/npcHpFormula`, and `migrateCombatant(c)` which upgrades legacy combatants (`itemRaw` → cache + delete; denormalized `name/ac/hpMax/cr/creatureType` → `override`). `load()` runs `migrateCombatant` per combatant then `ensureNpcItems`. The resolvers are threaded into `useEncounterHp` (AC/HP/formula), `useEncounterInitiative` (dex/name), `useEncounterFlow` (revive uses `npcHpMax`), and the facade (`subtitle`, exposed as `enc.npcItem/npcName/npcAc/npcHpMax`).

**Side / icon controls:**
- The `iconColor` field is set from the row's `…` action menu (`shared/ui/RowActionMenu.vue`) for both NPCs ("Цвет рамки") and players ("Цвет плитки"). Picking a color sets `combatant.iconColor` (or removes it for reset). The avatar itself is no longer clickable.
- The avatar is **frameless** (no border, no background). `iconColor` (NPC: `iconColor || SIDE_COLOR[side]`) now drives only the row's left-edge color strip, not an avatar border.
- `EncounterAvatar` renders, in order: the player photo (`object-fit: cover`, `object-position: center 15%`), else the NPC bestiary item's `svg` artwork (`enc.npcItem(c)?.svg` — a URL → `<img object-fit: contain; object-position: bottom center>`, or inline `<svg>` markup), else a letter fallback. NPC art is **bottom-pinned** so a standing figure keeps its feet on the row baseline.
- Badge click on an NPC opens a popover with `enc.SIDE_OPTIONS` (Враг / Союзник / Нейтрал / Приспешник). Picking a side updates `combatant.side`.
- `enc.avatarStyle(c)` returns `{ color }` = `iconColor ?? SIDE_COLOR[side]`, consumed as the letter/inline-svg tint.
- NPC detail is opened by clicking the name (the old avatar trigger was repurposed).

`tieBreak` is the source of truth for ordering equal-initiative combatants. New entries get `max(existing tieBreak) + 1`. Drag-and-drop within active combat reassigns `tieBreak` so the visual order after the drop becomes the persisted order (see `performSortDrop` below).

`participantToPlayer` synthesizes a player combatant from a session participant; `mergeParticipants` adds any not already present (called on `load`). Player rows are derived live — `playerDisplayName`, `getPlayerAva`, `getPlayerAc`, `getPlayerHp` resolve through `features/sessions/lib/participantView.js` (`pvName/pvAvatar/pvAc/pvHp/…`), which uses the per-setting **accessors** (resolved from the participant's `templateId` schema) and falls back to the legacy `path_values_for_list` only for settings without accessors. HP write-back uses `pvHpPath` (`dndAccessors.hpPath = values.hp`). So `path_values_for_list` may be NULL for D&D.

**`armor` path shape** (PC AC computation):
```ts
{ ac: number, shield: boolean, shield_bonus: number, bonuses: number[] }
```
Total = `ac + (shield ? shield_bonus : 0) + sum(bonuses)`.

**`hp` path shape**: `{ current, max, temp?, ds_success?, ds_failure? }`.

**Derived lists:**
- `inCombat` — `combatants.filter(position==='combat')`. Sorted by initiative DESC, then `tieBreak` ASC, only when `active`. When inactive, returns raw array order so the order frozen at `toggleCombat` end-of-combat is preserved.
- `reserveNpcs`, `reservePlayers` — filtered by type+position, no sort (array order).

**Combat lifecycle:**
- A sticky top toolbar `.enc-toolbar` pinned to the top of the Бой tab: `position: sticky; top: 0`, a **frosted backdrop** — `backdrop-filter: blur(16px) saturate(1.6) brightness(1.4)` over a light `color-mix(var(--surface) 34%, transparent)` tint, no bottom border. **The `brightness(1.4)` lift is essential**: without it the blur is invisible on the dark UI (dark-content-on-dark blur just reads as a flat tint — this was a real "I only see darkening" bug). A faint inset bottom highlight adds the glass edge. Below it a `::after` pseudo-element (`top: 100%`, 24px tall) adds a **gradient-blur fade** — `backdrop-filter: blur(8px)` masked by a `linear-gradient(to bottom, #000, transparent)` — so content scrolling under the bar dissolves out. The bar's top corners are rounded (`--r-lg`) to sit flush in the tile. **Scroll container:** the encounter's own `.enc-wrap` scrolls (via `.tab-content > *`), NOT the rounded `.tab-content` tile — a rounded scroll container would kill the toolbar's `backdrop-filter` blur (leaving only the translucent tint). It spans the full width of the tab above all sections. Left side: start/end-combat button, then (during active combat) round counter + "Пред"/"След" buttons. Right side (DM only, pushed via `margin-left: auto`): "Перебросить инициативу (N)" — calls `enc.rerollSelectedInitiative()` for **all selected non-dead combatants** (works in combat and in reserves; count is `enc.selectedRerollCount`); "Удалить НПС (N)" — calls `enc.removeSelectedNpcs()` for selected NPCs (available regardless of combat state). Both disabled when their counts are zero. The "БОЕВАЯ СЦЕНА" title and "БОЙ ИДЁТ / НЕ В БОЕ" status badge live in the combat section's title row.
- Dragging a combatant **into the combat section is blocked while combat is inactive** (`canDropAt` returns false for `toGroup === 'combat'` when `encounter.active === false`). To populate the scene before combat starts, select rows in any reserve and either press "На сцену" or "Начать бой" (which auto-rolls missing initiatives).
- The combat scene is **empty when combat is inactive** — `toggleCombat()` end sends every combatant in `combat` position back to `reserve` (typed by `c.type`) and clears `initiative` and `surprised` on every combatant.
- `toggleCombat()` start: walks the current `selectedUids` set; for each selected non-dead combatant, sets `position='combat'` and rolls a `d20+initiativeBonus(c)` initiative via `useDiceStore().roll(...)` if `initiative == null`. Then sets `active=true`, `round = hasSurprised ? 0 : 1`, `turnIndex = 0`, and clears the selection.
- The "Начать бой" button is disabled when nothing is selected and shows the count: `Начать бой (N)`.
- `nextTurn`/`prevTurn` wrap around `turnOrder.length` (not `inCombat`), incrementing/decrementing `round` on wrap.

**Turn-order gating (`turnOrder` / `isActiveInTurn`).** Turn navigation and the current-turn highlight run over `turnOrder = inCombat.filter(isActiveInTurn)`, a subset of the displayed combat list:
- NPCs at `hpCurrent <= 0` (dead-in-scene, not yet sent to graveyard) never get a turn.
- During the **surprise round** (`round === 0`) only combatants with `surprised === true` act — i.e. those who caught the others off guard. Everyone else is skipped until the round wraps to 1.
- `currentTurnUid` is derived from `turnOrder[turnIndex % turnOrder.length]` and exposed by the facade (consumed by `EncounterTab`). `nextTurn` wrapping `turnOrder` is what flips `round` 0→1, after which `turnOrder` expands to the full alive list.
- `EncounterRow` adds `enc-row--skipped` (opacity 0.5) to combat rows where `enc.isActiveInTurn(c)` is false, so skipped/dead combatants read as inactive (the current row keeps full opacity).

**Selection (DM-only multi-select):**
- `selectedUids: Ref<Set<string>>` holds selected combatant uids. Not persisted (cleared on reload). **Selection survives transfers** — `sendSelectedTo` / `toggleCombat` no longer clear it.
- Each row renders an `EncCheckbox` (`shared/ui/EncCheckbox.vue`) at the very start — visible only when `canEditPlayerHp()` returns true. The visual square is 18×18 but the hit area is expanded by `padding: 9px; margin: -9px` so the click region is ~36×36 (no layout shift). Clicking toggles `enc.toggleSelected(c)`. The checkbox calls `@pointerdown.stop`, so it never starts a row drag (see "whole-row drag" below).
- Both action buttons live in `.enc-section-title-row`. "Выбрать всех / Сбросить" sits immediately to the right of the title text; "В запас / На сцену / На кладбище (N)" is pushed to the far right with `margin-left: auto`. Both are hidden in the combat block when combat is inactive.
- The send button ("В запас / На сцену / На кладбище (N)") uses `enc.sendSelectedTo(group)`. The label count comes from `enc.selectedToMoveTo(group)` — only the selected combatants that would actually change position (e.g., "В запас НПС" counts selected NPCs whose `position !== 'reserve'`; "На сцену" excludes dead and already-in-combat). Disabled when the count is zero or the viewer is not the DM. Sending to `combat` while active rolls missing initiatives; sending to `reserve-*` / `dead` clears `initiative`.
- The "+ Добавить из бестиария" button in the NPC reserve mirrors the tile form factor (`border-radius: 12px`, `padding: 10px 14px`, `min-height: 44px`) and uses the section color for its dashed border/text instead of a generic gray.

**Section visuals.** Each section is rendered as an `.enc-block` wrapper containing two siblings stacked above the card:
1. (combat only) `.enc-combat-controls` — round counter, prev/next buttons (during active combat), and the start/end-combat button.
2. `.enc-section-title-row` — dot + title + status badge (combat only), then the **"Выбрать всех / Сбросить"** button (`enc-select-btn`) immediately to the right of the title, then the **"В запас / На сцену / На кладбище (N)"** button (`enc-send-btn`, more saturated in the same section color) pushed to the far right via `margin-left: auto`. For the combat block both buttons render only while combat is active.

Spacing: `.enc-block` has `margin: 16px 0 0` — **no horizontal margin** (the tab has no inner side padding; rows/title-rows inset their own content via `padding: … 14px`), with the first block trimmed to `margin-top: 6px` so consecutive sections get a clear breathing gap; inside the block, `gap: 6px` separates the title row from the section card.

The `.enc-section` is **frameless** — no background, no border, no radius (`background: none; padding: 0`). It just stacks its rows (and the add-row / empty hint). The local `--section-color` CSS var still drives the small filled dot before the section title (`enc-section-dot`, with a soft outer glow) and the section's action-button tints.

Section colors (muted variants of the row palette):
- Боевая сцена → `#c84874` (muted pink).
- Запас НПС → `#6b4ed4` (muted accent).
- Запас игроков → `#4a93c4` (muted blue).
- Кладбище → `#a84a44` (muted red).

Section titles use `var(--text-1)` (bright) at 800 weight. **Combatant rows are frameless** — no per-row background or border; they read as full-width rows separated by a thin `border-top: 1px solid var(--border)` divider (`.enc-rows`/`.enc-reserve-list` use `gap: 0` and `:deep(.enc-row:not(:first-child))` draws the divider), mirroring the participant column. The only per-row accents are: an absolutely-positioned 3px-wide **color strip on the left edge** (inset 10px top/bottom, `border-radius: 0 2px 2px 0`; color from `enc.tileColor(c)` — NPC `iconColor || SIDE_COLOR[side]`, player `iconColor || null`), and a faint `--accent` tint on the current-turn row.

**Dead zone (Кладбище):**
- New section after the player reserve. Combatants with `position: 'dead'` appear here. The `dead` sortable group accepts both NPCs and players; dropping into it sets `position='dead'` and clears initiative.
- Row menu in the dead section has a "Воскресить" item that returns the combatant to its reserve (NPCs with `hpCurrent <= 0` get bumped back to `max(1, hpMax)`); the "Удалить" item is also available for NPCs.
- NPCs do not have death saves. When NPC `current <= 0`:
  - Encounter row replaces the death-save pip overlay with a 💀 + "На кладбище" button that calls `enc.sendToGraveyard(c)`.
  - `DndHpCalcModal` with `is-npc` hides `DndDeathSaves` and renders the same skull + "На кладбище" button, emitting `@graveyard` (the encounter tab handler routes to `sendToGraveyard` + closes the modal).

**Drag and drop** is built on the generic `shared/composables/useSortable.js` (pointer events). It is the *only* way to reorder combatants or move them between sections — there are no tie arrows or "in scene / in reserve" buttons. Three sortable groups (`combat`, `reserve-npc`, `reserve-player`) share one `useSortable` instance:
- `accepts(item, fromGroup, toGroup)` — `reserve-npc` accepts NPCs only, `reserve-player` accepts players only, `combat` accepts anything.
- `canDropAt({ item, toGroup, toIndex })` — during active combat for **any → `combat`** drop (from combat or from a reserve), the drop is allowed only if the source's initiative fits the sorted-DESC neighborhood at `toIndex`: `before.initiative >= source.initiative >= after.initiative` (with missing neighbors treated as open ends, and `null` initiative ranking as `-Infinity`). This means an item dragged in from reserve can only land at a position consistent with init-DESC ordering — a reserve item with `null` init can only drop among other nulls (typically the bottom).
- `onDrop` — delegated to `performSortDrop({ item, toGroup, toIndex })`.

`performSortDrop` is one unified path:
1. If `toGroup === 'combat'` and combat is active, pre-compute the new visual combat order: `inCombat.filter(c !== item)` with `item` inserted at `toIndex`.
2. Mutate the combatants array: set `item.position` to match the new group, splice the item out, then insert it just before the anchor item at `toIndex` in the target group's filtered list (or at end). For reserves this controls the displayed order; for combat the array order is recomputed by the init+tieBreak sort.
3. If step 1 produced a `newCombatOrder`, walk through it and assign each combatant a `tieBreak` equal to its position within its initiative tier. The persisted sort then exactly reproduces the post-drop visual order — items in their original tier keep relative order, the dropped item lands precisely where the user released it.

`npcReserveCollapsed` is true while dragging a player. The NPC reserve section gets dimmed (opacity 0.45), and its list + add-button receive `pointer-events: none`. The DOM stays in place so layout doesn't shift mid-drag.

**Empty drop zones** — every section renders a `data-sortable-container` element even when empty (combat shows the "Переместите участников" hint, both reserves show "Запас пуст" / "Все игроки в бою"). This is what makes drops into empty sections work.

### `useSortable` (shared)

Pointer-event sortable composable in `frontend/src/shared/composables/useSortable.js`. Designed to be reusable across encounter, weapons/spells/items lists, etc.

```js
const sortable = useSortable({
  groups: {
    [name]: { items: Ref<Array>, accepts?(item, fromGroup, toGroup): bool }
  },
  getKey: (item) => string|number,
  canDropAt?({ item, fromGroup, toGroup, toIndex }): bool,
  onDrop({ item, fromGroup, fromIndex, toGroup, toIndex }): void,
})
```

Returns `{ dragging, sourceItem, sourceGroup, targetGroup, targetIndex, startDrag, isSource, displayItems }`.

Wiring contract:
- Each drag handle calls `sortable.startDrag(pointerDownEvent, item, groupName, idx)`.
- Each item's root element gets `:data-sortable-key="getKey(item)"`.
- Each group's container element gets `data-sortable-container="<groupName>"`.
- Renders iterate `sortable.displayItems(groupName)` instead of the raw list — this returns the items with the source virtually moved to the current drop target.
- Items style themselves as placeholders when `sortable.isSource(item)` is true (`enc-row--placeholder` hides content via `visibility: hidden` and shows a dashed outline).

Mechanics: on `pointerdown`, pendingStart is captured but no DOM changes. After 4px movement the drag starts — the source DOM element is cloned, appended to `document.body` with `position: fixed`, and follows the cursor via `translate3d`. Hit-testing each `pointermove` uses `elementsFromPoint` to find the topmost `[data-sortable-container]`. Within that container, the insertion index is the first item whose vertical middle is below the cursor (or end-of-list). `Escape` cancels.

**Modals:**
- `openHpCalc(c)` opens `DndHpCalcModal`. For NPCs in the **combat** section `onNpcHpChange` writes `hpCurrent/hpMax/hpTemp` back to the combatant. For players, the modal opens only when the viewer is the session DM (`canEditPlayers`); `onPlayerHpChange` calls `charactersApi.patchData(charUuid, [{path,value}, ...])` against `PATCH /api/char/{uuid}/data-patch` for each `hp.*` subfield, and the 2s `pollChars` loop picks up the new version and refreshes participant data. Players viewing their own char still edit HP via the character editor.
- For NPCs in the **reserve** section, clicking the HP bar opens a simpler edit dialog (`openNpcHpEdit` → `hpEditNpc`) — a `DetailModal` with three `FormNumberInput`s (Текущие / Максимум / Временные) wired to `setNpcHpField('current'|'max'|'temp', value)`. No dice/calculator UI; reserve NPCs typically haven't rolled HP yet so direct entry is faster.

**HP bar with temp HP:** the bar renders two layers — the colored `current/max` fill and, when `temp > 0`, a blue (`#5cb0e8`) overlay starting at the current-HP edge and extending by `temp/max` (clamped so it can't exceed 100%). Players read `temp` from `pathValues.hp.temp`; NPCs from `hpTemp`. The numbers chip beside the bar appends `+<temp>` in the same blue. Composable helpers: `hpTempPercent(c)` and `hpTempValue(c)` (consumed by `EncounterRow`).

**Statuses (BLOCK_STATES) on encounter rows:**
- Active states render as `BlockStates` in `variant: 'compact'` inline in the name row (right of the side badge / "врасплох" toggle). The local `charCtx` is provided with `editMode: false`, so BlockStates renders chips only — no "+ статус" button, no inline `×`.
- Editing happens via the row's `…` action menu (`shared/ui/RowActionMenu.vue`, right-aligned three-dot trigger): the "Изменить статусы" item opens `SuggestMultiSelect` directly with `statesValue` as the active list and toggles back through `enc.setStates(combatant, ids)`. New suggests created from the picker get added to the store and immediately activated.
- For NPCs the menu additionally has "Изменить заметку" — opens a modal (Teleport overlay) with a textarea bound to a draft and saves via `enc.setNote(combatant, text)`. The note is stored on the combatant (`combatant.note: string`, serialised into the encounter JSONB) and rendered inline in the name row after the statuses as a small italic chip.
- For NPCs in the reserve, the same menu has a "Удалить" item (replacing the old `×` button). The delete action is suppressed in `combat` and for player rows.
- For NPCs the menu also has a "Копировать ×N" row with a number input (1–20) — clones the combatant N times into the reserve via `enc.cloneNpc(c, n)`. Each clone gets a fresh `uid`, `position: 'reserve'`, cleared initiative / death-save counters, and a new `tieBreak`.
- For players, `useEncounter.findStatesBlock(templateId)` walks the participant's template `schema.blocks` and finds the first `BLOCK_STATES` block. The suggest type id and the block id (data path `values.<blockId>`) come from there. Changes are persisted via `PATCH /api/char/{uuid}/data-patch`.
- For NPCs, the active state ids are stored on the combatant (`combatant.states: number[]`) and serialized into the encounter JSONB. The suggest type id is reused from the first participant template that has a `BLOCK_STATES` block.
- The `…` menu is shown only to the session DM (`enc.canEditPlayerHp()`). `RowActionMenu` enforces single-instance: opening one menu closes any other open menu in the page via a shared `window.__ramOpenRef` registry.

**Row layout (left→right):** `[checkbox?] [init pill] [AC chip] [avatar] [info] [hp-dice-btn?] [row-menu?]`. The **info column** stacks `name-row` → **HP bar** → subtitle. The CR is no longer shown anywhere on the row (`enc.subtitle` returns the creature type only).

**HP row UI:**
- Initiative pill is 64px wide, column layout: a small "иниц." label above a centered numeric input. No per-row d20 button — rerolls happen via the toolbar's "Перебросить инициативу" against selected combatants. The bonus added to the `d20` roll is `enc.initiativeBonus(combatant)`:
  - players → `values.<initiativeBlockId>.value` (the `DND_INITIATIVE` block now persists its computed total in the `value` field; older data without it falls back to `base + sum(bonuses)`). The block id is discovered by scanning the participant template schema for the first `DND_INITIATIVE` block.
  - NPCs → `floor((itemRaw.data.dex - 10) / 2)`.
  - bonus 0 → expression is just `d20`; otherwise `d20+N` / `d20-N`.
- **AC chip sits between the init pill and the avatar** (`enc.displayAc(c)`; hidden for reserve NPCs whose AC is null).
- The **HP bar lives in the info column, directly under the name** (not a fixed-width right column). It is full-width (`max-width: 340px`) and rendered by the shared **`shared/ui/StatBar`** (`size="medium"`, `:percent="enc.hpPercent"`, `:color="enc.hpColor"`, `:temp-percent`). The `+temp` and numbers sit to the right of the bar; `EncounterHpBar` still owns them plus the death-save / graveyard overlays. This is the same component the character sheet HP/LVL and the session player block use — see `md/frontend.md` "StatBar". A dice button (NPCs with `hp_formula`, reserve only) rolls the formula via `rollDiceExpression`, sets `hpMax = hpCurrent = total`, resets `hpDsSuccess/hpDsFailure`, and shows the result in the dice popup.
- When `current <= 0`, the HP bar+numbers are blurred and an overlay with death-saves pips renders on top of the HP area. Pip toggling is interactive for both NPCs (writes to combatant fields `hpDsSuccess/hpDsFailure`) and players (writes to `<hpPath>.ds_success/.ds_failure` via `PATCH /char/.../data-patch`). Filling all three success pips sets `current = 1` and clears both ds counters (mirrors `DndDeathSaves`).
- `openNpcDetail(c)` opens a `HandbookItemDetail` modal. If `c.itemRaw` is missing it fetches via `/api/items/by-ids?ids=<id>` and caches the result onto the combatant.
- `addNpc(item, count = 1)` from `NpcPickerModal` (bestiary type 6) creates `count` NPC combatants in reserve (clamped 1–20). It caches the item (`cacheItem`) and stores `itemId` + empty `override` (no item copy). `NpcPickerModal`'s footer has a `−/input/+` quantity control matching `ItemPickerModal`; the "+ Добавить в запас" button shows `×N` and emits `pick(item, qty)`.
- The NPC reserve has **two** dashed add buttons in a row: "+ Добавить из бестиария" (opens `NpcPickerModal`) and "+ Создать упрощённо" (opens `enc.showSimpleForm`). The simplified form is an `AppModal` with name / AC / current HP / max HP / description; `submitSimple` calls `enc.addSimpleNpc({ name, ac, hp, hpMax, description })`, which creates a combatant with `itemId: null` and the fields in `override` (no bestiary lookup). Simplified NPCs are not name-clickable (no `HandbookItemDetail` item) — `EncounterRow` gates the detail click on `combatant.itemId != null`.

### `EncounterTab.vue`

Thin orchestrator. Creates the composable, wraps it with `reactive()` so refs auto-unwrap, and `provide('encounter', enc)`. Renders header (status/round/turn buttons/toggle), three section containers (each is a DnD drop zone), and the three modals. Each section iterates `EncounterRow` components.

### `EncounterRow.vue`

Universal row. Injects the `encounter` API. Props (`{ combatant, section, idx, isCurrent }`):
- `combatant`, `section` (`'combat'|'reserve-npc'|'reserve-player'`)
- `idx`, `isCurrent` — combat only

There are **no** `prevInitMatch`/`nextInitMatch` props and **no** tie arrows — reordering is drag-only.

Variants by section:
- **combat** — surprised toggle (when not active) or surprised chip (round 0 only). No move buttons.
- **reserve-npc** — `×` delete button. AC chip hidden if `c.ac == null`.
- **reserve-player** — no extra controls.

**Whole-row drag (no handle).** There is no 6-dot drag handle anymore — the entire row is the drag source. `EncounterRow` binds `@pointerdown="onRowPointerDown"` on the root; the handler bails (lets the native interaction through) when `e.target.closest(DRAG_IGNORE)` matches an interactive control (`input, textarea, button, a, [role="button"], .enc-init-block, .enc-hp-area, .enc-badge, .enc-surprised-toggle, .enc-states, .enc-name--clickable`), otherwise calls `enc.sortable.startDrag($event, combatant, section, idx)`. `useSortable` only begins the drag after a 4px move, so plain clicks on non-interactive areas still register. The row root carries `:data-sortable-key="combatant.uid"` and `cursor: grab`. When `enc.sortable.isSource(combatant)` is true, the row gets `enc-row--placeholder` (dashed outline, content hidden via `visibility: hidden`).

## Backend (`/api/sessions/{uuid}/encounter`)

`SessionController.kt`:
- `GET` returns the raw JSON blob (or `{}` if empty). Content-Type forced to `application/json`.
- `PUT` accepts the raw JSON body, derives `status = active ? 'active' : 'pending'` and `round` for the encounter row, stores the body as-is in the `data` JSONB column.

## File size

Per `md/file-size-rules.md`. Current state (June 2026):
- `useEncounter.js` ~370 lines — the facade was split into 13 sub-composables (`useEncounterFlow/Hp/Initiative/NpcData/Npcs/Players/Selection/States` + session-level `useParticipantPolling/useSessionChapters/useSessionSelection/useSessionStatus/useTrackUpload`), so it is comfortably under threshold.
- `EncounterRow.vue` ~540 lines — approaching the 600 split line.
- `EncounterTab.vue` ~745 lines and `SceneTab.vue` ~900 lines are **over** the 600 "split before major changes" line. Split these before adding significant behavior: `EncounterTab` by extracting its three modals; `SceneTab` by separating the scene-item editor/grid from the tab shell.
