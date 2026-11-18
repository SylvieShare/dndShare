# Бой и участники

Состав encounter, инициатива, здоровье, выбор участников и операции боя.

← [Игровые сессии](../sessions.md)

## Содержание

- [Бой](#бой)
- [Participant indicators and multi-selection](#participant-indicators-and-multi-selection)
- [Компоненты применения урона и выбора целей](#компоненты-применения-урона-и-выбора-целей)

## Бой

Encounter state is split into composables under `features/sessions/composables`:
load/save, players, NPC item cache, HP, initiative, flow, states and dice.
`useEncounter.js` composes them; row components remain presentation-only.

The combat workspace is one responsive grid under the session header. Its left
column contains the prepared or active roster. The right column contains
`EncounterControls`. The current turn is highlighted on the
participant's row, and the participant menu opens the character sheet or bestiary card.
Порядковые номера на боевой сцене показаны шрифтом Cormorant Garamond
без ведущих нулей.
Текущего участника отмечают подсветка плитки и номер на сцене. При передаче
хода обе отметки меняются плавно, а строки сохраняют положение и высоту.
При reduced motion новое состояние показывается сразу. Скринридер получает
отметку текущего участника через `aria-current`.
The chapter/scenario context is still retained for returning to the story and
importing scenario combat blocks.

Columns fit from the actual available width: RosterMin (320), its scroll gap (12),
ControlsMin (280) and Large (16). The roster grows to RosterWidth (480), controls
to ControlsMax (420); the composition is aligned with the left workspace padding. The two
columns scroll independently. Below that width, controls appear above the roster
and scroll with it in a single column in both preparation and active combat.
Resizing preserves the current turn and prepared roster. The scene heading has
a separate checkbox, «Все на сцене». «Со сцены» counts only selected scene
members. Command buttons have visible captions and accessible names.

The sidebar remains available, while map canvas/inspector are hidden in combat.
During combat, the phase header places the round beside the phase and roster
count. The turn arrows are paired and the forward action is labelled «Следующий».
«Закончить бой» is an outlined one-line action. «Бои сценария» belongs to the
combat controls. The shared selection toolbar uses the available-actions menu
and shows eligible target icons and totals per action. It stays in the sidebar
header until the collapse transition finishes. The combat card then reveals it
below a divider. «Убрать испытание» appears beside the menu after a challenge.
A combatant marked defeated keeps the home group and leaves the turn order. The
persisted `defeatedOnScene` flag keeps their row on the scene and restores scene
membership when revived. Older defeated records without the flag appear in their
home group. At 0 HP, NPC rows display crossed bones and a skull, and D&D player
rows link their death-save counters to the HP calculator.
The workspace keeps Page padding on both sides and starts after the participant
safe area, including the permanent rail on compact windows. The roster uses its
own scroll gap in the two-column layout.
Row strips use the
explicitly selected participant color for players or `iconColor` for NPCs; rows
without an assigned color have no strip in either combat or the NPC reserve. The
scene uses jagged side edges for highlight paint and its color strip. Top and
bottom remain aligned with the shared row seams.
NPC artwork normally uses 64×64 geometry and is centered vertically. If the
roster has less than its preferred 492px, avatars use TouchMin (48px), smaller
gaps and padding, retaining names beside initiative. Player
portraits retain their compact framed crop. Session dice pass the default accent color
explicitly to every `SystemDie`. Master rolls made from the session dice panel
enable critical presentation for d20 only: a kept natural 20 shows the shared
critical-success visual, while a kept natural 1 shows the shared critical-failure
visual, including advantage and disadvantage rolls.

Before and during combat, the DM header has a group-challenge action. It opens a
compact setup popover with one of the six D&D abilities and a saving-throw
toggle, then rolls a d20 for selected creatures on the scene or in reserve, excluding defeated combatants. The action appears when at least one eligible creature is selected. A
normal check uses that creature's ability modifier. A saving throw also uses a
player's save proficiency and extra save bonuses, or the explicit bestiary save
bonus for an NPC; an NPC without one falls back to its ability modifier. The shared `EncounterChallengeOverlay` slides over the right side of tiles on
the scene and in both sidebar rosters, including actors kept in reserve. Width is capped at 248px and leaves the selection strip visible; neither the tile nor the 480px roster changes size. A corner button hides the result and becomes a reopen button; new results reveal the drawer again.
It reuses `SystemDie` and the shared roll-settle animation to show the d20 face,
numeric modifier and total without a textual formula. The drawer uses the tile surface with a subtle shadow so underlying text does not show through. Its reroll and hide controls do not open the tile menu, reorder or select the combatant. The slide respects reduced motion. The full check/save event
title wraps inside the embedded result. Its up/down controls keep the existing
d20 visible and roll one extra d20 beside it, then keep the higher/lower natural
value respectively. Only the new die animates; the unused die is crossed out
after the animation settles. Advantage/disadvantage rolls in the global dice
popup follow the same delayed crossed-out state. The full creature name, event
and advantage mode are still written to the session timeline. Challenge rolls
do not duplicate themselves in the global bottom-right popup stack. The same
header action is highlighted while results exist and clears them on the next
click.

Players have no separate encounter reserve section. The persistent workspace sidebar
keeps the Players panel available on every tab. Players and NPC reserves use the
same permanent checkbox targets and shared selected UID state;
AC, HP and passive skills use the common character summary tile.
A prepared initiative remains a chip beside the name while the player is in reserve.
Selection and current-turn highlights retain the encounter commands and permissions.

The DM-only Settings tab persists participant visibility and automatic NPC HP
rolling in the session's structured `settings` JSONB. `combat.autoRollNpcHp`
controls independent HP rolls when adding handbook creatures and synchronizes
across browsers through the session live stream. It starts disabled; no browser
preference is used.

NPC relations are optional. Reserve and combat summaries have no visible enemy/ally/minion/neutral caption; the relation is available to assistive technology. Map/catalogue tiles show relations as subtle diagonal `/` stripes tiled over the entire tile (7px colored stripe followed by a 14px transparent gap, a 1:2 rhythm), with separate colors for enemy, ally, minion and neutral. There is no relation chip. Clearing the relation removes the stripes; `aria-description` retains the relation label for assistive technology. The map roster's «Отношение» submenu sets enemy, ally, minion or neutral and offers «Убрать тег». Newly added NPCs have no relation tag. Surprised status is changed from the row menu.

Each NPC also receives the nearest free Latin marker from `A` through `Z`.
The marker sits inside the avatar’s upper-right corner in reserves and combat
rows, with a dark text shadow and a translucent backing with
Badge-radius corners and 4px backdrop blur. `backdropBlurStyle` supplies both
filter properties inline so the effect survives minification. Inline markers in the timeline
retain their plain text presentation. Its
identity is persisted in `markerLetter`. The marker control is a sibling of the
portrait button, so it never nests interactive buttons.
Clicking it opens one popover with the full letter list and the marker color
palette; choosing an occupied letter swaps the two NPC markers, preserving
uniqueness. Creature artwork and the letter marker render directly on the row
without separate backing surfaces; the compact letter remains the popover
trigger.

Clicking a chapter or its transition opens an anchored shared action surface:
`BasePopover` provides positioning while every command, including status and
arc submenus, uses `RowActionItem` and `RowActionSubmenu`. There is no separate
feature-specific chapter-menu component or locally styled action button. The
anchored surfaces select the library-owned `action-menu` transition preset, so
they share enter/leave motion with other row-action menus without depending on
another component's CSS.

Dragging creatures uses the shared sortable with EncounterDragHold (350ms).
Hold a non-interactive part of the tile before moving. Motion before activation
keeps native vertical scrolling; release, cancellation and Escape clear the
hold. Completed dragging suppresses its trailing click. Initiative, markers,
HP and selection controls keep their own actions.

Clicking a non-interactive area of a combat or reserve row, or pressing
Enter/Space on the focused tile, opens its action menu below that tile,
aligned with its right edge. The shared `RowActionMenu` anchors to the actual
tile and moves the menu above it when the viewport has insufficient space
below; initiative, HP, selection, marker and other dedicated controls keep their
own click behavior. Square buttons at the top of the menu open the bestiary
card or player sheet, edit an NPC note and delete the NPC. The bestiary action
opens the standard `ItemViewModal` for catalogue creatures. Menu rows include
states, sending a combatant to reserve and rerolling formula-based NPC HP in reserve. There is no separate HP-reroll button on a row, and
the action is hidden once that NPC is on the combat scene. NPC
color is not duplicated in the row action menu and remains part of the
letter-marker popover. The combat scene stays mounted during preparation and active combat; its
select-all action lives in the command column. Sidebar groups and the command column use the same global selection with constant checkboxes. State editing uses the character setting's state
value path and suggestion dictionary (the `states` part of the combined D&D
status overview), so the same condition list is available for players and NPCs.
Starting and ending combat update scene state while home rows remain
visible. Ending keeps the complete scene roster, HP, effects and group refs,
resets turn/initiative/surprise, and returns to preparation. The scene does not
fade out during completion; removal is an explicit command. Player and NPC home
rows stay in their groups.

When the combat rail changes the canvas safe-left inset, `NarrativeGraphCanvas`
re-measures that inherited layout value after the parent DOM update. The
spotlight chapter therefore animates to the new combat boundary instead of the
normal-width player-rail position.

The skull command marks selected combatants defeated in place. They retain their
selection and can be selected again from either view. Defeated combatants are
excluded from damage, XP and entry to the scene. Both control panels can delete
selected NPCs, including defeated NPCs. Players can be revived from their rows.

`useSessionWorkspace.js` stores the open workspace per session in local
storage. Reloading the session restores combat against the current chapter or
the scenarios workspace against its previously opened chapter. Explicitly
closing a top-level workspace clears this preference before the closing
animation. Closing combat opened from a nested canvas immediately persists that
return context, so even a reload during the exit animation restores the scenario
or block canvas instead of combat.

Encounter uses the [shared patch queue](../../document-sync.md) and
`session_encounter.revision`. A failed initial GET never enables saving;
PATCH batches serialize edits and retry the same mutation after network errors.
Disjoint edits rebase, overlapping edits preserve the local draft. Pending
changes start flushing on unmount and remain in the account-scoped outbox.
`ViewSession` hydrates its participant list before loading and reconciling the
encounter, so persisted player positions and initiative survive reload just as
NPC combat state does.
The same flush starts when the tab becomes hidden or receives `pagehide`, which
keeps the debounce window from dropping the latest change during navigation.
The shared session SSE supplies authorized roster changes directly. Joining
players are added to reserve and departing players are removed from encounter
state. REST recovery only runs while the stream is disconnected.
Hydration also normalizes missing or obsolete combatant positions to `reserve`,
canonicalizes player character identifiers from the current participant list
and removes duplicate legacy player entries. This prevents combatants from
remaining outside every current group and persists the repaired state through
the normal encounter save queue.

### Sidebar selection and prepared scene

`useRosterSelection` derives one selection from canonical combatant UIDs,
shared across Players, every reserve group and the scene. Its input is deduplicated
by UID; a creature shown in two views receives damage or XP only once. Constant
leading checkboxes use 22px glyphs in a 48px-wide selection area that spans the
row except for its 4px top and bottom edges. These edges and the rest of the
row open the action menu. Vertical gestures in the selection area scroll the
list. HP and state controls stay interactive.
The sidebar shows selected actors across top-level tabs. A separate row above
All shows bare per-type icons and individual player portraits, with quantities
from two. All applies to the open roster, and «Сбросить выбор» clears the global
selection. Map and world tools also show the summary and clear control.
NPC templates group by itemId, simple creatures by name, and actors dedupe by UID.
Portraits overlap as the row narrows, and a very large selection continues on
another row. The numeric live status remains available to assistive technology.
«Все на сцене» applies to the scene roster. The same selection toolbar supports
challenges, damage, XP/IP, scene entry and deleting NPCs. The combat workspace
also shows scene exit and marking defeated in that toolbar. Tab changes animate
the mounted sidebar body, respecting reduced motion.
Damage captures explicit eligible targets for the idempotent authoritative impact
command. D&D XP/IP targets characters only and retries only unconfirmed writes.
Starting combat uses only prepared scene members. Selecting a reserve actor alone
never adds it to combat; unchecking a participant never removes it. A home group
keeps live actors even while they participate in combat. Membership, HP and states
are shared. Home tiles use a sword watermark below the clipped selection
paint instead of a membership caption. Selected watermarks increase contrast
and retain their accessible state label. The watermark takes a muted red tint
during an active encounter. The current actor has a highlighted row and order
number on the scene.
Dragging within a home group retains combat participation. Cross-view previews
exclude an already present UID before insertion. Returning an actor from the
scene keeps its home group and selection; deleting an NPC prunes its selection.

### Reserve tabs

The combat workspace uses a plain background; the story dot pattern remains
on the plot canvas. NPC reserves live in the persistent left sidebar on every
session tab, immediately below Players and above contextual map/world tools, even before opening
combat. The selected reserve and its panel stay mounted across workspace changes.
`EncounterNpcDialogs` is hosted by the session page: adding handbook/simple NPCs,
editing HP and opening NPC details work from any tab, with one shared dialog host
also used by the combat roster. A single header plus opens the handbook/simple
creature menu; creation controls are not duplicated inside the list. The first tab is always `Запас`
(`default`), with a fixed name and no delete action. The last dashed plus adds
a custom tab. Its heading pencil edits the name inline; Enter/blur saves and
Escape cancels. Deleting a custom tab returns its creatures to `Запас` without
deleting combatants or changing HP, initiative, round, positions or turn order.

Optional `reserveTabs: [{id,name}]` stores only custom tab definitions in the
existing encounter JSON. An NPC's optional `reserveTabId` selects its home;
absence or an unknown/removed ID means the permanent default. Existing documents
without metadata remain valid and loading them does not create writes. The first
custom tab adds the metadata through the usual versioned patch queue; no SQL
migration is needed. Definitions use stable IDs, names of 1–255 characters and
cannot claim the reserved `default` ID. Metadata remains private to the DM's
encounter document; public display DTOs do not include it.

The active tab scopes the All checkbox, home sorting and new creatures; individual selection remains global. Dragging
into its roster assigns that tab; the `Другой запас` row submenu moves an NPC
between tabs. Entering combat retains both the home reference and its visible home row. Graveyard actors retain the home reference but leave the live list; restoring them returns the original grouping. The sidebar tabs exist while the
combat workspace is open, including preparation before the encounter starts.

Canonical combatants:

- player row references the session participant/character;
- NPC row stores `itemId` for the bestiary item and optional `override` for
  encounter-local name/AC/max HP/other edits;
- transient current HP, temp HP, initiative, state and the NPC `markerLetter`
  live in the combatant encounter record.

The optional encounter-level `challenge` object stores `{ability,
savingThrow,results}`. `results` is keyed by combatant UID and each value is
`{roll,bonus,total,rolls?,dropped?,revision?}`. The optional roll pair and
dropped index preserve an extra advantage/disadvantage die; `revision` restarts
its embedded animation when the kept value does not change. Removing
`challenge` clears the shared result display.

The session display control links to the standalone public route `/screen/:code`
for a television or projector. Each session has a permanent unique code in
`ABC-123` format: six ASCII letters/digits with a hyphen after the third symbol.
Codes are displayed uppercase and resolve without case sensitivity. The DM's
display menu shows the code, copies `/screen/ABC-123` and opens that short link.
Existing sessions receive codes during migration; display routes use only these
codes. Session UUIDs continue to identify authenticated management routes and
invite codes continue to identify membership invitations.
It has no application navigation or authenticated
controls. Its SSE stream refreshes the presentation and, in combat mode, the
public encounter projection immediately; fallback polling and a control sync
cover reconnects, server restarts and missed in-memory signals. Returning to a
visible browser tab also requests a fresh snapshot. In combat the active player
or NPC occupies a larger `4:3` card on the left with full artwork and a blurred
lower info layer; neither it nor the queue cards stretch to the screen height.
The display is fixed to the viewport in every mode, with no page or nested
scrolling. Combat uses a 3vmin safe margin and divides its usable height (after
the gap) into 40% for the queue and 60% for the active card and graveyard.
The active card preserves 4:3 and fits the lower region. On small or short
windows the entire combat composition scales down to keep both regions inside
the viewport, including at the master's 125% scale setting. Text and note
materials shrink their type to fit the complete content and refit after resize;
very long texts therefore become smaller and should be split for TV readability.
Above it, the compact cyclic queue spans the full screen width and begins after
the active turn. Queue tiles are tightly packed squares sized to fit a smaller
full-fit creature icon and the longest worded health state below it. A compact,
ellipsized name sits between the portrait and health, while initiative remains
hidden. The queue prefers the character's small `iconImageUrl` and renders it
without an inner frame or backing; the active card prefers the sheet portrait
and falls back to that icon only when no portrait exists. Active conditions sit over the portrait edge as their colored dictionary
icons; an iconless custom condition uses a colored dot, and additional conditions
collapse into a count. The visible slot count follows the available screen width,
so a long queue reaches the right edge before overflowing into its final stack.
Below the cards, a quiet ticked scale with a right-pointing arrow labels the
direction from the next turn toward later turns.
The current round and queue count sit together below that direction scale,
aligned to its right edge. Overflow layers fan diagonally downward and right inside a reserved edge corridor;
the fan is bounded to four small offsets to the right and down, with later
entries sharing the final layer and a count indicating the remaining queue.
An NPC letter sits just inside the icon's upper-right
corner in its assigned color, clear of the tile frame. Overflow
shares the final right-hand slot as a visible stack. On turn change the
active card exits left, the next one expands, and the combatant that just acted
appears at the queue tail. NPC letters remain emphasized before names on the
active card and share the same filled badge treatment in both positions; only
their size differs. A persisted health setting can show either numeric current/max HP
or the worded bands `Здоров`, `Ранен`, `При смерти`; another flag enables a
separate graveyard. The graveyard sits at the lower right and grows upward as a
vertical list bounded by the lower region; excess groups are summarized as
`Ещё N групп`. It groups dead NPCs by bestiary type and renders each larger,
unframed row as a right-aligned name, unbacked icon and count. Health numbers are omitted from
the public DTO unless health is enabled in numeric mode. Initiative values are
not included in the public projection. A failed refresh keeps the last
successful snapshot visible and marks the connection as interrupted.

The authenticated session page owns one typed SSE invalidation stream for the
participant list, character versions, timeline and public-screen presence.
Writes remain REST mutations and the stream contains no character or timeline
payloads; it only identifies the projections that need refreshing. Bursts are
coalesced by domain and character id. On reconnect the page reloads membership,
timeline cursor and screen presence, while ordinary idle time produces no API
requests. While SSE is disconnected, a bounded exponential fallback performs
the same catch-up reads until the browser reconnects. Character refresh still
uses the version-aware batch endpoint, but
only for ids named by an invalidation. Membership snapshots include each
character's technical version.

The DM header control tracks the live number of public screens connected to that
session. Its button uses a green connected treatment whenever at least one SSE
subscriber exists, while the popover reserves its primary status row for the
current display mode and visibility. Connection state updates from the
authenticated session stream whenever a public display subscribes or
disconnects; reconnect catch-up reads the owner-only counter once.
Each public browser tab counts as one screen. This counter comes from the
in-process SSE hub rather than the database, so it
reflects current connectivity and naturally resets during a server restart;
screens reconnect automatically and reappear in the counter.

The display popover keeps the current mode, an icon-only blackout/reveal toggle,
the contextual material removal action and an illustrated visual-effect grid on
its main level. A dedicated settings button opens a nested settings level for
all persisted toggles: remote music, health and its numeric/worded mode, and the
graveyard. The same level provides a `75–125%` combat-display scale slider in
five-percent steps with a one-click reset to `100%`. The scale is stored with the
session presentation, rescales the complete combat stage around its center
(subject to the viewport fit limit) and
feeds the effective logical width back into queue capacity calculation; material
playback and fixed timer overlays retain their full-screen geometry.

The public endpoint builds a dedicated projection on the server rather than
returning raw encounter or character JSON. It may resolve the session owner's
referenced custom bestiary entries and condition suggestions, but exposes only
their display fields and condition label/color. Exact current/max HP is projected
only when the master enables health in numeric mode. Player maximum HP uses
the current sheet format: nonnegative `hp.max.base` plus signed integer
`hp.max.bonuses[].value`, clamped at zero. No login on the display is required.
Character sheets,
initiative values, AC, notes and challenge
results remain private.

The encounter never embeds `itemRaw` and does not read denormalized NPC fields.
Startup SQL converts previous records to `itemId + override`; frontend only
batch-loads referenced handbook items through `/api/items/by-ids`.

Player display and HP come through `participantView`. HP writes use the
accessor's canonical `hpPath`; current/temp HP and death saves are patched back
to the character only when the current user may perform the action. A player at
zero HP is summarized in the participant rail as `При смерти` with compact
success/failure counts instead of death-save pips. The DM can start revival from
that tile. Every player or NPC revival action first asks for the resulting HP;
player HP and cleared death saves are patched to the character, while NPC HP is
stored in encounter state.
The player color marker is read from `session_participant`, not copied into the
encounter combatant, so changing it is reflected across every encounter section.

## Participant indicators and multi-selection

`ParticipantStats` loads the participant's abilities, equipment, armor bases
and effects when the tile mounts and refreshes them when participant data changes.
`participantDefenses` uses the shared equipped
armor and derived-effect calculators. Passive Perception (Wisdom, skill 10) and
Investigation (Intelligence, skill 9) are 10 plus the skill modifier, proficiency
or expertise, manual bonuses and configured derived skill bonuses. The stored
skill mode and active roll-mode effects add 5 for advantage or subtract 5 for
disadvantage; opposing automatic modes cancel. Conditional scene modifiers are
set manually. Text-only handbook bonuses and optional extra dice are not inferred
as permanent numeric bonuses. The value's tooltip shows its calculation.
Source: [2014 passive checks](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/using-ability-scores#PassiveChecks).

`EncounterInitiativeMenu` is shared by the participant menu and creature-row
menu before combat. `rollCombatantInitiative` changes only that creature; combat
start preserves an already assigned initiative. Existing mass initiative actions
remain available.

Ctrl + click (Cmd + click on macOS) directly toggles a sidebar
player/group tile on every session tab without changing the body interaction mode. Combat rows and `SessionTargetPicker`
retain their existing Ctrl/Cmd selection. The shared
`handleCtrlSelection` consumes the gesture before menus, native checkbox
activation and drag start, including macOS's Cmd-click and Ctrl-contextmenu events. Locked or
read-only selection stays unchanged. Ordinary clicks keep their existing behavior.

Player menu statistic tooltips use the shared FloatingTooltip above the action menu (9500 vs 9300), including keyboard focus.

During active combat, a reserve player's rail menu offers «Отправить в бой» with an initiative field and «В бой». It reuses a prepared or manually entered value (including zero), or rolls when the field is empty. A sheet initiative roll carries `sheetInitiative: true`. Encounter reads project unacknowledged rolls into reserve player initiatives; saves acknowledge `sheetInitiativeCursor`. Rolls made for an active or dead combatant are acknowledged without replacing their initiative. Save projection checks the old roster before a pending move. Master-generated rolls do not carry this marker. Live journal updates flush local edits, then refresh the encounter.

Chronicle attack target controls share the roll's row on the right, with chosen targets below. Choose targets, apply to targets and roll-save buttons use the shared dashed ActionButton variant. The 680px target dialog keeps responsive viewport limits; all three flows use `loadSessionTargets`, the DM-only snapshot endpoint, hydrated equipment/effects, a common AC chip and medium HP bar. SaveFormulaPreview renders the same profile used for rolling, including extra dice and whether the higher/lower of two d20 is kept. Presentation AC and snapshots are excluded from submitted target identities.

## Компоненты применения урона и выбора целей

`DamageImpact` — общий компонент результата HP и эффектов в хронике, строке спасброска и истории NPC. `SessionImpactModal` выбирает цели/связанный эффект; `useEncounterImpacts` отправляет точечный и массовый урон одним атомарным запросом. Оба пути используют `/sessions/{uuid}/impacts`. Компоненты модального применения и истории загружаются лениво. [Описание](../session-damage.md).

В выборе целей хроники `SaveTargetName` с `iconSize=56` и `showHp` использует общий `SessionHpBar` из колонки игроков. Строки результатов сохраняют компактное отображение.

`SessionTargetPicker` — единое модальное окно выбора целей для
`SessionImpactModal`, `SessionSavingThrow` и `SessionAttackTargets`.
Оно принимает `targets`, выбранные ключи через `v-model`, блокировки, состояния
загрузки/ошибки и слоты контекста/подписи цели/кнопок. Все три сценария показывают
иконки 56 px и `SessionHpBar`, включая NPC с цветной буквой. Загрузка механик
спасброска и сохранение конкретного действия остаются в соответствующей фиче.
`SessionAttackTargets` сохраняет выбор в событии через API; цели видны в хронике мастера,
права доступа к событиям не расширяются. Сравнения атаки с КД в этом компоненте нет.

`SessionCreatureTile` remains the map/catalogue composition. Combat rows use
`SessionEncounterTile`, adapting the same `SessionPlayerTile`/`SessionNpcTile`
as sidebar lists. `SessionPlayerDeathState` is shared by both player views;
HP clicks retain the authoritative calculator commands. Sidebar creation/edit
uses the existing simple form and reserve HP fields. Player cards in
the sidebar use `SessionPlayerTile`, which composes the same `CharacterSummaryTile`
and `SheetHealth` as the character header: portrait, name, shield AC, numeric HP
with temporary HP, and two passive values for D&D participants viewed by the DM.
`SessionRosterTile` owns the shared visual composition of player and NPC-reserve
summaries: portrait, shield AC, numeric HP, states and a masked purple brush
selection underlay with fine dry scuffs and soft, uneven ink density. Texture
contrast is reduced across the name and metrics area. Rows have no radius
or external vertical gaps. Sidebar lists have no horizontal outer padding. The
rough variant of `WorkspaceRowDivider` reaches both edges without fading.
`roughRowSeam` cycles five stable contours by row position. Each row uses its
own upper contour and the following row’s contour for its lower edge, keeping
paint docked to the visible separator at different row heights. Paint is allowed
to extend across the nominal row box to follow it.
`SessionNpcTile` supplies encounter data and retains creature marker,
initiative, menus and drag ordering. Race/class remain in the sheet/menu,
not the card. Player and NPC names retain their full text: `useCreatureNameFit`
proportionally reduces the glyph size from the wrapper's token-driven base size.
It remeasures width, sibling indicators, name updates and loaded fonts, and restores
the base size when the name becomes shorter or more room appears. Names use
the shared ParticipantName role: locally packaged Cormorant Garamond, 22/26 px,
weight 500, rather than bold interface text. No ellipsis is
used. The same fitter serves the combat roster and the sidebar lists. Metrics wrap as a group.
`useParticipantDefenses` owns asynchronous hydration for both this card and the
compact encounter `ParticipantStats`; ready name and HP stay visible while numeric
mechanics show a skeleton. Passive skill math is shared with the sheet's menu table.

Player summaries have transparent resting surfaces and separators between rows.
States below participant and NPC summaries use the character header's 56px
icons, name, duration and polarity-colored parchment via `DndStatusOverviewView`.
Levels above one show an accent-colored `xN` beside the name. Tiles wrap to the
next row when space is limited. Map and catalogue strips use 32px icons.
They use the same handbook tooltip and action menu as the sheet: viewing, duration,
levels, removal and effect-specific mechanics. The menu follows its source during
panel scrolling and closes when the source leaves that panel's viewport.
The adapter retains the shared resources, defenses and versioned character-command
queue; rejected saves show an error and do not apply unconfirmed data. Status actions
do not open the participant menu, reorder the card or change combat selection.
Card height follows content; compact summaries hide their information and states.
NPC numeric conditions and effect instances retain shared menus: detailed in
reserves and combat, compact 32px in maps/catalogues.

`EncounterInitiativeMenu` remains shared with creature rows. `handleCtrlSelection`
handles Ctrl/Cmd selection in the player list, encounter rows and target picker;
macOS Ctrl-contextmenu toggles once. Drag ignores these modifiers and form controls.
`CompactCheckbox` is a permanent secondary action in sidebar and scene tiles,
with size=22 and hitSize=48. Bodies keep menu semantics while HP/state controls
remain interactive. Header selection is global, with an All checkbox scoped
to its visible list; there is no mode switch. The former floating player rail and
its independent collapsed-state preference are removed; one sidebar owns collapse.
`ArmorClassChip` and `SessionHpBar` remain the compact AC/HP presentations for
chronicle result rows and target pickers. Sidebar/scene summaries use `SheetHealth`.

## Связанные страницы

[Оглавление wiki](../../README.md) · [Игровые сессии](../sessions.md) · [API: магия и действия хроники](../../api/session-actions.md)
