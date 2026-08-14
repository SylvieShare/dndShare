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
icon-labelled view action and a DM-only kick action; bulk participant selection
is not part of the rail. Every participant trigger fills the rail width. A dashed `+` action
beside the `ИГРОКИ` heading opens character creation and invite code/link copy
actions; the rail has no separate invitation tile.

The session page is a campaign workspace rather than a stack of content tabs.
The chapter canvas fills all available width below `AppHeader`; the participant
rail floats above its left edge and the dice/events/music tiles float above its right
edge. CSS safe-area variables keep focus, zoom and newly created nodes in the
uncovered part of the canvas and leave a 28px gap between the central workspace
and either floating rail. The right rail disappears first on narrow screens,
then the participant rail.

Панели кубиков, событий и музыки в правом rail сворачиваются независимо.
`SessionEventsPanel` занимает свободную высоту между соседними инструментами и
прокручивает только собственную хронику. `stores/sessionEvents.js` загружает
последние 50 записей, затем получает новые по cursor polling и устраняет
дубликаты по серверному id.

## Session timeline

`session_event` stores semantic gameplay actions rather than arbitrary sheet
JSON changes. The current producers are dice rolls, short/long rests, resource
use, potion/inventory spending and replenishment, spell use, session status,
current chapter and encounter start/finish. Regular editing, drag ordering,
music controls and manual configuration do not create timeline noise.

The server authenticates every timeline read/write as either the session DM or
a participant. An `actorCharUuid` is resolved only for a player who owns that
session participant; DM actions stay attributed to the DM even when performed
from an opened participant sheet. Character pages select their event context
from the explicit `?session=<uuid>` query, falling back only to a live/active
session. Player session cards open that character context instead of the DM
workspace.

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
edge of the canvas; its top edge uses a gradient backdrop blur so scrolled tiles
fade beneath the fixed header instead of being clipped abruptly.

In contextual mode `SceneTab.vue` hides redundant arc/chapter selectors and
restores the last scene or opens the first scene on initial entry. The same
component still supports the full arc-first/chapter-second selector contract
when used outside that context. Combat uses the same canvas layer from the
command bar and focuses the current chapter. Its standalone combat header sits
to the right of that node; combatants remain independent tiles below it rather
than being wrapped in one central card. Scene CRUD remains in
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

The encounter workspace has no shared backing surface. Its header and every
combatant row are separate `BaseTile` surfaces. In the chapter canvas the header
is fixed beside the focused chapter while only the rows area scrolls. Row strips use the current
encounter section color (combat, NPC reserve, player reserve or graveyard), so
moving a row also updates its spatial accent. Session dice pass the default
accent color explicitly to every `SystemDie`.

Canonical combatants:

- player row references the session participant/character;
- NPC row stores `itemId` for the bestiary item and optional `override` for
  encounter-local name/AC/max HP/other edits;
- transient current HP, temp HP, initiative and state live in the combatant
  encounter record.

The encounter never embeds `itemRaw` and does not read denormalized NPC fields.
Startup SQL converts previous records to `itemId + override`; frontend only
batch-loads referenced handbook items through `/api/items/by-ids`.

Player display and HP come through `participantView`. HP writes use the
accessor's canonical `hpPath`; current/temp HP and death saves are patched back
to the character only when the current user may perform the action.

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
