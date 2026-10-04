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

The encounter workspace has no shared backing surface. Its header and every NPC
row are separate `BaseTile` surfaces. During active combat, the workspace uses
two columns. The left column, capped at 800px, contains the initiative queue and
NPC reserve. The sticky right column follows the current turn: bestiary NPCs
show live combat values plus their reference abilities and actions; simplified
NPCs show the encounter values and description; players show a compact combat
profile with a link to the full character sheet. Selection does not change this
preview. In the chapter canvas the header is fixed
beside the focused chapter while only the rows area scrolls. Row strips use the
explicitly selected participant color for players or `iconColor` for NPCs; rows
without an assigned color have no strip in either combat or the NPC reserve.
NPC artwork uses its native 64×64 geometry and is centered vertically while
player portraits retain their compact framed crop. Session dice pass the default accent color
explicitly to every `SystemDie`. Master rolls made from the session dice panel
enable critical presentation for d20 only: a kept natural 20 shows the shared
critical-success visual, while a kept natural 1 shows the shared critical-failure
visual, including advantage and disadvantage rolls.

Before and during combat, the DM header has a group-challenge action. It opens a
compact setup popover with one of the six D&D abilities and a saving-throw
toggle, then rolls a d20 for selected creatures on the scene or in reserve, excluding the graveyard. The action is disabled until at least one eligible creature is selected. A
normal check uses that creature's ability modifier. A saving throw also uses a
player's save proficiency and extra save bonuses, or the explicit bestiary save
bonus for an NPC; an NPC without one falls back to its ability modifier. Each
result is a fixed-size column after the creature's complete identity/HP block;
scene and reserve rows show results beside their identity/HP block; in narrow rows the result wraps below without overflowing.
It reuses `SystemDie` and the shared roll-settle animation to show the d20 face,
numeric modifier and total without a textual formula. The result block has no
backing surface or enclosing frame; only its left and right borders separate it
from the combatant details. The full check/save event
title wraps inside the embedded result. Its up/down controls keep the existing
d20 visible and roll one extra d20 beside it, then keep the higher/lower natural
value respectively. Only the new die animates; the unused die is crossed out
after the animation settles. Advantage/disadvantage rolls in the global dice
popup follow the same delayed crossed-out state. The full creature name, event
and advantage mode are still written to the session timeline. Challenge rolls
do not duplicate themselves in the global bottom-right popup stack. The same
header action is highlighted while results exist and clears them on the next
click.

Players have no separate encounter reserve section. Opening combat smoothly
widens the existing left participant rail from 264px by the checkbox strip plus the card gap (36px + 9px, total 309px); every player tile gains the
encounter checkbox with additional horizontal spacing; the current turn is
highlighted there. The tile shows the name and HP, with 14px right padding;
race/class are absent from the tile; a prepared initiative is shown as a chip beside the name while the player remains in reserve. For the DM, D&D participants show equipped AC and passive Perception/Investigation directly below HP, to the right of the portrait.
The three indicators form one row: number followed by icon, with vertical
dividers. Hover or keyboard focus opens the shared `ItemTooltip` with the
indicator name, meaning and passive calculation. Before combat starts, the combat-tab menu exposes an initiative submenu with
a numeric input and a roll action. These controls remain mounted inside a fixed-height
tile and slide in from behind its left edge together with the widening rail;
closing combat sends them back left instead of mounting or unmounting them.
Players that enter combat also appear in the common
initiative-ordered combat scene alongside NPCs while remaining visible in the
left rail. Common scene rows keep initiative on the left. AC follows the portrait in a chip: a prominent number followed by a blue shield. Tiles have a 74px minimum height around 62–64px portraits and no trailing ellipsis; clicking the tile or pressing Enter/Space while focused opens its menu. Selection squares are 20px in rows, the player rail and chronicle target selection. The left-rail tile and portrait keep
the same height and circular geometry in and out of combat; the larger combat-scene
portrait is circular too. Player photos use a soft alpha fade around their edges. An
assigned session color appears as the 2px frame of both the left-rail player tile
and the common combat-scene row; it is not repeated on the portrait or as a left
strip. Player rows do not repeat a `PC` type chip. NPC artwork keeps its centered 64×64
geometry instead of falling back to a name initial. Every combat-scene tile has a numbered marker on its
left.
`ViewSession.vue` owns the single `useEncounter` instance shared by the rail and
`EncounterTab`, so selection and initiative always address the same encounter
record.

The DM-only Settings tab persists participant visibility and automatic NPC HP
rolling in the session's structured `settings` JSONB. `combat.autoRollNpcHp`
controls independent HP rolls when adding handbook creatures and synchronizes
across browsers through the session live stream. It starts disabled; no browser
preference is used.

Each NPC also receives the nearest free Latin marker from `A` through `Z`.
The marker sits immediately to the left of the NPC name above the HP bar and is
persisted in `markerLetter`.
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

Clicking a non-interactive area of a combat or reserve row, or pressing
Enter/Space on the focused tile, opens its action menu below that tile,
aligned with its right edge. The shared `RowActionMenu` anchors to the actual
tile and moves the menu above it when the viewport has insufficient space
below; initiative, HP, selection, marker and other dedicated controls keep their
own click behavior. The shared menu can edit states for both players and NPCs,
send a combatant to reserve, reroll formula-based NPC HP while it remains in
reserve, and delete NPCs. Bestiary NPCs also expose `Открыть карточку`, which
opens the standard handbook `ItemViewModal`; simplified creatures omit that
action because they have no handbook record. There is no separate HP-reroll button on a row, and
the action is hidden once that NPC is on the combat scene. NPC
color is not duplicated in the row action menu and remains part of the
letter-marker popover. The combat-scene block is mounted only while combat is
active; its select-all control sits beside the section title and no duplicate
live-status chip is shown. The NPC-reserve select-all control follows the same
left-aligned title placement. State editing uses the character setting's state
value path and suggestion dictionary (the `states` part of the combined D&D
status overview), so the same condition list is available for players and NPCs.
When combat starts, selected NPC reserve rows fade out with a short stagger and
the combat-scene block then expands smoothly into the layout. Ending combat
collapses the scene and softly reveals the returned NPC reserve. Player tiles do
not move between rails. Controls stay locked for the short transition, while
reduced-motion users get the direct state change.

When the combat rail changes the canvas safe-left inset, `NarrativeGraphCanvas`
re-measures that inherited layout value after the parent DOM update. The
spotlight chapter therefore animates to the new combat boundary instead of the
normal-width player-rail position.

The graveyard is not a separate workspace section. Two icon-only actions live
directly in the combat header: the skull moves the current selection to the
graveyard, while the bone opens a `BasePopover` with dead combatants. Both keep
their text descriptions in browser tooltips and accessible labels.
Selecting a combatant reveals view, restore and (for NPCs) delete actions. The
popover can also delete all dead NPCs after a `ConfirmDialog` confirmation.

`useSessionWorkspace.js` stores the open workspace per session in local
storage. Reloading the session restores combat against the current chapter or
the scenarios workspace against its previously opened chapter. Explicitly
closing a top-level workspace clears this preference before the closing
animation. Closing combat opened from a nested canvas immediately persists that
return context, so even a reload during the exit animation restores the scenario
or block canvas instead of combat.

Encounter hydration and saving are fail-safe: a failed initial GET never turns
into an empty PUT, writes are snapshotted and serialized after the debounce, a
failed latest write is retried, and a pending snapshot is flushed on unmount.
`ViewSession` hydrates its participant list before loading and reconciling the
encounter, so persisted player positions and initiative survive reload just as
NPC combat state does.
The same flush starts when the tab becomes hidden or receives `pagehide`, which
keeps the debounce window from dropping the latest change during navigation.
The participant list is periodically refreshed while the page is visible;
joining players are added to the encounter reserve and players removed from the
session are removed from encounter state. Polling pauses in hidden tabs and an
in-flight request cannot restart it after unmount.
Hydration also normalizes missing or obsolete combatant positions to `reserve`,
canonicalizes player character identifiers from the current participant list
and removes duplicate legacy player entries. This prevents combatants from
remaining outside every current group and persists the repaired state through
the normal encounter save queue.

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

Ctrl + click (Cmd + click on macOS) toggles selection in the participant rail when combat controls are
available, in encounter rows and in `SessionTargetPicker`. The shared
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

`SessionParticipantCard` shows portrait, name and HP, with 14px right padding.
For the DM, D&D tiles also show AC and passive skills below HP in the same
information column; the action menu contains only actions.
Its combat strip contains a checkbox with wider side spacing; AC and initiative
are not rendered in that strip. The tile uses lazy `ParticipantStats` for D&D
characters viewed by the DM, backed by `participantDefenses`, the shared equipment/derived-effect
calculators, and item hydration including magic armor bases. `EncounterInitiativeMenu`
is shared with creature rows and shown before combat starts.
`handleCtrlSelection` is the shared capture handler for the participant rail,
`EncounterRow` and `SessionTargetPicker`; macOS Ctrl-contextmenu also toggles once.
Drag starts ignore Ctrl and Cmd. Disabled selection and ordinary clicks keep their behavior.

Participant tile indicators are a single row of 13px numbers and 14px icons with
vertical dividers. The compact rail hides the information column and makes it
inert, including the indicators. Hover and keyboard focus open the shared `ItemTooltip` for the name,
meaning and passive calculation. The player rail uses `--participant-rail-width`
(264px), `--participant-selection-width` (36px) and `--participant-card-gap` (9px).
Combat adds exactly the selection width plus gap; graph safe-area offsets use the
same sum. The checkbox strip has 10px left / 2px right padding, so the original
name/HP area retains its width as the rail expands.

`CompactCheckbox` from share-ui 0.24.0 exposes `size` (default 18px); encounter, participant and target-selection rows pass 20px. Base geometry stays in the library. `ItemTooltip` forwards an optional `zIndex` to FloatingTooltip, retaining 4000 by default; participant indicator descriptions use 9500 above menus and submenus.

`ArmorClassChip` is the shared session AC presentation (number then blue shield). `SessionHpBar.size` defaults to small; target pickers pass medium with decoration. `loadSessionTargets` hydrates the same character/NPC snapshots for attack, impact and saving-throw pickers and calculates AC with shared armor/effect rules. `SaveFormulaPreview` renders d20 mode, fixed bonus and extra dice from `sessionSaveProfile`; no second bonus calculation is maintained. The picker uses CompactCheckbox at 20px, including Ctrl/Cmd row selection. `ActionButton` dashed styling belongs to share-ui 0.25.0.

## Связанные страницы

[Оглавление wiki](../../README.md) · [Игровые сессии](../sessions.md) · [API: магия и действия хроники](../../api/session-actions.md)
