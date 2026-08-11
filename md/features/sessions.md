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
an individual interactive `BaseTile`. Clicking it opens `RowActionMenu` with a
view action and a DM-only kick action; bulk participant selection is not part of
the rail. Every participant trigger fills the rail width. A dashed `+` action
beside the `ИГРОКИ` heading opens character creation and invite code/link copy
actions; the rail has no separate invitation tile.

The desktop session toolbar keeps the editable session name and current campaign
location in the main row. The location is written as
`Арка <roman> › Глава <number> <name>` and opens the chapter map. For the DM, a
right-aligned three-bar action menu owns session status changes; non-DM
participants do not receive the mutation menu.

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

The `Главы` tab is the default session workspace. `ChapterGraphToolbar` is the
only backed tile in that tab; `ChapterGraphCanvas` is transparent, supports
pan/zoom and stores the viewport per arc in local storage. Nodes can be dragged.
A regular node click opens its action popover: make current, change status,
edit, start a transition, open scenes, move to another arc or delete. Moving a
node to another arc removes its old transitions after confirmation because a
transition cannot cross arc boundaries.

Chapter transitions are directed edges inside one arc. They may have a short
optional label; clicking either the curve or label opens edit/reverse/delete
actions. The graph API validates that both ends and the edge belong to the same
arc and session.

The built-in chapter image catalogue is served from
`frontend/public/static/chapter-presets`: city, village, camp, road, forest,
cave, ruins, castle, tavern, dungeon, mountains and coast. A DM may instead
upload an image through the normal storage image endpoint and adjust its focal
point. A chapter stores exactly one image source.

Scenes belong to chapters and contain ordered scene items. `SceneTab.vue`
switches arc first and then chapter; scene CRUD remains in
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

The encounter workspace has no shared backing surface. Its sticky toolbar and
every combatant row are separate `BaseTile` surfaces. Row strips use the current
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
