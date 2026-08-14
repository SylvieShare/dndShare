# Sessions

Frontend: `frontend/src/features/sessions`. Backend:
`internal/web/sessions.go`, `session_scenes.go`, `music.go` and matching store
files.

## Pages and access

- `/sessions` — campaigns available to the user.
- `/sessions/:uuid` — session workspace.
- `/join/:code` — invitation flow.

A session has DM/participant permissions, status, current chapter, participants,
encounter and synchronized music state. Owner-only actions are checked on the
server, not only hidden in UI.

`GET /api/sessions` returns session cards with participant briefs and current
chapter. Participant avatar for the list is read from the canonical character
data; `char_template.path_values_for_list` does not exist.

## Participant display

`lib/participantView.js` is the only participant adapter. It resolves the
setting from `templateId` and delegates name/avatar/subtitle/level/HP/AC to the
same accessors used by character cards and the sheet. Entry contract is
`{templateId,data}`. If the setting is not registered, there is no path-map
fallback.

`ViewSession` and join pages ensure the template store before rendering. A new
character created inside a join/session flow uses `CharacterCreateModal`, gets
an explicit rules `sourceVersionId`, then is joined and opened.

The session participant rail has no shared backing surface: each participant is
an individual interactive `BaseTile`. Clicking it opens `RowActionMenu` with an
icon-labelled view action plus DM-only color and confirmed kick actions; bulk participant
selection is not part of the rail. The color is stored on the participant's
session membership and renders as the same diagonal `BaseTile` mark in the rail
and on that player's encounter rows. Color palettes, encounter cloning and the
chapter status/arc choices use `RowActionSubmenu`: a separate adjacent popover
on desktop and an inline section with a left accent boundary on mobile. Every participant trigger fills the rail width. A dashed `+` action
beside the `ИГРОКИ` heading opens character creation and invite code/link copy
actions; the rail has no separate invitation tile.

The session page is a campaign workspace rather than a stack of content tabs.
The chapter canvas fills all available width below `AppHeader`; the participant
rail floats above its left edge and the dice/events/music tiles float above its right
edge. CSS safe-area variables keep focus, zoom and newly created nodes in the
uncovered part of the canvas and leave a 28px gap between the central workspace
and either floating rail. The right rail disappears first on narrow screens,
then the participant rail.

Панели кубиков, музыки и событий в правом rail сворачиваются независимо.
`SessionEventsPanel` расположен под музыкой, занимает свободную высоту и
прокручивает только собственную хронику по вертикали; длинные имена, описания и
результаты бросков переносятся без горизонтального скролла. Новые записи находятся сверху и
группируются сначала по минуте, затем по последовательному субъекту действия.
В событии броска итог расположен в строке заголовка справа и отделён от названия
растягивающейся горизонтальной линией; отдельные значения кубиков остаются ниже.
Время показывается один раз слева, а заголовок субъекта и вертикальная линия
через маркеры объединяют его соседние события, не выходя за первое и последнее.
Сами события не имеют фона и рамки; тонкая рамка без заливки окружает их
иконки-маркеры. `Мастер` в сессии и
`Имя персонажа (мастер)` в
листе — разные ключи группировки; для игрока используется имя персонажа. Логин
пользователя не показывается.
`stores/sessionEvents.js` загружает
последние 50 записей, затем получает новые по cursor polling и устраняет
дубликаты по серверному id. Когда на странице сессии открыт модальный лист,
контекст бросков временно получает uuid этого персонажа; закрытие листа
возвращает общий контекст мастера.

## Session timeline

`session_event` stores semantic gameplay actions rather than arbitrary sheet
JSON changes. The current producers are dice rolls, short/long rests, resource
use, potion/inventory spending and replenishment, spell use, session status,
current chapter, encounter start/finish and `entry_added` for inventory items,
weapons, potions, spells, feats and abilities. Direct picker/manual additions
and level-up grants use the same event. Regular editing, drag ordering, music
controls and manual configuration do not create timeline noise.

The server authenticates every timeline read/write as either the session DM or
a participant. An `actorCharUuid` identifies the character page that produced
the action: players can reference only their own participant, while the DM can
reference any participant in the session. Character pages select their event
context from the explicit `?session=<uuid>` query, falling back only to a
live/active session. Player session cards open that character context instead
of the DM workspace.

State-changing character actions are queued by the sheet and sent in the next
`PUT /char/{uuid}/data`; backend character data and its events commit in one
transaction. A cantrip still schedules this semantic save, but the character
version is not bumped when JSON data is unchanged. Dice rolls use the direct
event endpoint because they do not mutate character state. Pending debounced
character saves are flushed on page unmount instead of dropping their events.

## Chapters and scenes

Every session has at least one ordered arc. Arc order is the canonical campaign
order; the UI renders it as a Roman number and rewrites `1..N` atomically after
reordering. Arcs do not have a status. Each arc owns an independent chapter
canvas and its transitions.

Chapters are graph nodes. A chapter has a free display number (`1`, `3A`,
`Пролог`), name, optional description, status, image and canvas coordinates.
Numbers are unique inside an arc, not across the campaign. The supported status
set is `draft`, `planned`, `ready`, `available`, `in_progress`, `paused`,
`completed`, `failed`, `skipped`, `cancelled`. Making a preparatory chapter
current promotes it to `in_progress`; only one chapter in the session is
current.

`ChapterGraphToolbar` is the one backed command bar in the workspace. It combines
the editable session name/status, arc switcher and ordering, chapter creation,
combat launcher, current-chapter focus and zoom. There is no second local tab
switcher or session title bar. `ChapterGraphCanvas` uses the application-wide
canvas background and dot-color tokens, supports pan/zoom and stores the
viewport per arc in local storage; its 24px base grid repositions and scales
with that viewport. Nodes can be dragged; during an active drag their transform
transition is disabled so the node and every connected edge update in the same
frame. Spotlight transitions remain animated outside dragging.
A regular node click opens its action popover: open the chapter scenarios, make
current, change status, edit, start a transition, move to another arc or delete.
Moving a node to another arc removes its old transitions after confirmation
because a transition cannot cross arc boundaries.

The chapter illustration covers the complete node. Number, title and optional
scene count sit on a blurred translucent overlay above the image; lifecycle and
current markers remain at the top. `sceneCount` is derived by the graph read API,
not stored on `session_chapter`, and is updated optimistically when contextual
scene CRUD changes the count.

Chapter transitions are directed edges inside one arc. They may have a short
optional label; clicking either the curve or label opens edit/reverse/delete
actions. The graph API validates that both ends and the edge belong to the same
arc and session.

The built-in chapter image catalogue is served from
`frontend/public/static/chapter-presets`: city, village, camp, road, forest,
cave, ruins, castle, tavern, dungeon, mountains and coast. A DM may instead
upload an image through the normal storage image endpoint and adjust its focal
point. A chapter stores exactly one image source.

Scenes belong to chapters and contain ordered scene items. A chapter action
opens them in `SessionCenterWorkspace`, a transparent fixed layer inside the
canvas safe area. The selected node gets a temporary presentation transform to
the layer's top-left corner, its normal coordinates stay unchanged, and the
other nodes and edges fade out. A separate scenarios header is aligned 16px to
the right of the node; scene item tiles start 16px below both. The layer has no
shared backed surface. While it is open, pan, zoom, node dragging, transitions,
arc changes and chapter editing are locked. Closing fades the layer and returns
the node to its saved graph position. The content viewport reaches the bottom
edge of the canvas and clips scrolled content at the fixed header boundary.

In contextual mode `SceneTab.vue` hides redundant arc/chapter selectors and
restores the last scene or opens the first scene on initial entry. The same
component still supports the full arc-first/chapter-second selector contract
when used outside that context. Combat uses the same canvas layer from the
command bar and focuses the current chapter. Its standalone combat header sits
to the right of that node; combatants remain independent tiles below it rather
than being wrapped in one central card. The header groups compact icon actions
for starting or ending combat and turn navigation. Its growing secondary action
row is divided into labelled groups for the public screen, rolls, the current
selection and dead combatants; nested action components use the same icon-button
geometry and interaction states as direct toolbar buttons. Scene CRUD remains in
`session_scenes.go`.

`SceneTab.vue` uses project standards:

- `TextPromptDialog` for create/rename;
- `ConfirmDialog` for deletion;
- `useSortable/reorderByDrop` for ordering.

It does not own local backdrop/modal or drag implementations.

## Encounter

Encounter state is split into composables under `features/sessions/composables`:
load/save, players, NPC item cache, HP, initiative, flow, states and dice.
`useEncounter.js` composes them; row components remain presentation-only.

The encounter workspace has no shared backing surface. Its header and every NPC
row are separate `BaseTile` surfaces. In the chapter canvas the header is fixed
beside the focused chapter while only the rows area scrolls. Row strips use the
explicitly selected participant color for players or `iconColor` for NPCs; rows
without an assigned color have no strip in either combat or the NPC reserve.
Session dice pass the default accent color explicitly to every `SystemDie`.

While combat is active, the DM header has a group-challenge action. It opens a
compact setup popover with one of the six D&D abilities and a saving-throw
toggle, then rolls a d20 only for selected combatants currently on the combat
scene. The action is disabled until at least one scene combatant is selected. A
normal check uses that creature's ability modifier. A saving throw also uses a
player's save proficiency and extra save bonuses, or the explicit bestiary save
bonus for an NPC; an NPC without one falls back to its ability modifier. Each
result is a fixed-size column after the creature's complete identity/HP block;
combat rows reserve its height before any roll, so results never resize tiles.
It reuses `SystemDie` and the shared roll-settle animation to show the d20 face,
numeric modifier and total without a textual formula. The full check/save event
title wraps inside the embedded result. Its up/down controls roll one extra d20
for that creature and keep the higher/lower natural value respectively. The
full creature name, event and advantage mode are still written to the session
timeline. Challenge rolls do not duplicate themselves in the global
bottom-right popup stack. The same header action is highlighted while results
exist and clears them on the next click.

Players have no separate encounter reserve section. Opening combat smoothly
widens the existing left participant rail; every player tile gains the
encounter checkbox, initiative input and armor-class indicator, and the current
turn is highlighted there. Players that enter combat also appear in the common
initiative-ordered combat scene alongside NPCs while remaining visible in the
left rail. The common scene rows reuse the same compact initiative and
armor-class controls as the player rail. Player portraits are enlarged in both
combat representations and use a soft alpha fade around their edges. An
assigned session color appears as the portrait frame in both representations;
player rows do not repeat a `PC` type chip. NPC artwork occupies the full row height instead of falling
back to a name initial. Every combat-scene tile has a numbered marker on its
left.
`ViewSession.vue` owns the single `useEncounter` instance shared by the rail and
`EncounterTab`, so selection and initiative always address the same encounter
record.

Each NPC also receives the nearest free Latin marker from `A` through `Z`.
The marker sits immediately to the left of the NPC name above the HP bar and is
persisted in `markerLetter`.
Clicking it opens one popover with the full letter list and the marker color
palette; choosing an occupied letter swaps the two NPC markers, preserving
uniqueness. Creature artwork and the letter marker render directly on the row
without separate backing surfaces; the compact letter remains the popover
trigger.

Clicking a non-interactive area of a combat or reserve row opens its action
menu; initiative, HP, selection, marker and other dedicated controls keep their
own click behavior. The shared menu can edit states for both players and NPCs,
send a combatant to reserve, reroll formula-based NPC HP while it remains in
reserve, and delete NPCs. There is no separate HP-reroll button on a row, and
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

When the combat rail changes the canvas safe-left inset, `ChapterGraphCanvas`
re-measures that inherited layout value after the parent DOM update. The
spotlight chapter therefore animates to the new combat boundary instead of the
normal-width player-rail position.

The graveyard is not a separate workspace section. A skull action in the
combat header opens a `BasePopover` with dead combatants. Selecting a combatant
reveals view, restore and (for NPCs) delete actions. The same popover can move
the current selection to the graveyard and delete all dead NPCs after a
`ConfirmDialog` confirmation.

`useSessionWorkspace.js` stores the open workspace per session in local
storage. Reloading the session restores combat against the current chapter or
the scenarios workspace against its previously opened chapter. Explicitly
closing the workspace clears this preference before the closing animation, so
a subsequent reload stays on the chapter graph.

Canonical combatants:

- player row references the session participant/character;
- NPC row stores `itemId` for the bestiary item and optional `override` for
  encounter-local name/AC/max HP/other edits;
- transient current HP, temp HP, initiative, state and the NPC `markerLetter`
  live in the combatant encounter record.

The optional encounter-level `challenge` object stores `{ability,
savingThrow,results}`. `results` is keyed by combatant UID and each value is
`{roll,bonus,total,revision?}`; `revision` restarts the embedded animation when
an extra advantage/disadvantage die keeps the same value. Removing `challenge`
clears the shared result display.

The DM combat header links to the standalone public route `/screen/:uuid` for
a television or projector. It has no application navigation or authenticated
controls and polls `GET /api/public/sessions/:uuid/encounter` every 1.5 seconds,
with an immediate refresh when the tab becomes visible again. The screen shows
the session name, round, current turn and the complete initiative order with
portraits, markers and resolved condition names. Exact HP is intentionally not
part of the public DTO or UI: health is presented as `Здоров` above 50%,
`Ранен` above 25%, `Критически ранен` at 25% or below, and `Без сознания`
(player) / `Повержен` (NPC) at zero. A lost poll keeps the last successful
snapshot visible and marks the connection as interrupted.

The public endpoint builds a dedicated projection on the server rather than
returning raw encounter or character JSON. It may resolve the session owner's
referenced custom bestiary entries and condition suggestions, but exposes only
their display name, icon and condition label/color; character sheets, exact HP,
AC, notes and challenge results remain private.

The encounter never embeds `itemRaw` and does not read denormalized NPC fields.
Startup SQL converts previous records to `itemId + override`; frontend only
batch-loads referenced handbook items through `/api/items/by-ids`.

Player display and HP come through `participantView`. HP writes use the
accessor's canonical `hpPath`; current/temp HP and death saves are patched back
to the character only when the current user may perform the action.
The player color marker is read from `session_participant`, not copied into the
encounter combatant, so changing it is reflected across every encounter section.

## Music

`MusicLibraryModal.vue` is a specialized fullscreen `AppModal`; its nested tag
and album dialogs use `AppModalFrame`. Album/track/tag CRUD uses shared
prompt/confirm dialogs; track ordering uses `useSortable`. Playback state
is synchronized through the session music endpoint, while track files and
signed URLs are served by `/api/music`.

The library contains albums, tags, queue/current track, volume, loop and
crossfade controls. File upload validation is part of the upload composable/API;
browser prompt/confirm is not used.

## Data changes

Runtime accepts only current session/encounter JSON. If the encounter model
changes, add an idempotent correction to
`internal/store/schema/04_sessions.sql`, update all producers/consumers, then
remove the previous keys and any read-time converter.
