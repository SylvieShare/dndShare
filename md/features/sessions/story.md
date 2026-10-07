# Подготовка сюжета и материалы

Локации, NPC, главы, сценарии, граф блоков и материалы для игроков.

← [Игровые сессии](../sessions.md)

## Подготовленные локации и NPC

`Локации`, `NPC`, `Задания` and `Материалы` are DM-only primary central workspaces, not extra permanent
side panels. Their surfaces sit over the same tokenized dot field as the story
canvas. The selected mode is stored per session in local storage; `view`,
`location`, `npc`, `material` and `quest` query parameters preserve a shareable selection. Combat is
still a temporary overlay. Opening it from either world workspace keeps that
workspace mounted underneath and closing combat returns to the same mode and
selected entity. All four catalogues render the selected record through one
`SessionEntityDetail` header and body shell. `SessionEntityForm` owns one draft
shared by its header, visual and body components. There is no general
`Редактировать` button in the detail header. Borderless pencils without a
background sit next to each editable value. The location kind, NPC race and
role and color, quest status, and material type and note style are edited in the header
alongside the name; they are not repeated as cards below it. Full edit flows
(such as creation, the location tree edit action and changing a material type)
expand those same header values into inputs in place. Text and enum header fields
use the shared `InlineEdit`: row height stays fixed, and confirm/cancel sit inside
the input on the right. Width follows the current text or selected enum label,
with a 120px minimum and room reserved for both buttons, capped by the container.
Creation fields show descriptive placeholders without pre-filling saved data. NPCs without a race show `Раса не выбрана`; their color
uses the shared `ColorPresetPicker` popover in the header.
Clicking a location or NPC header image opens an action menu: add/replace opens
the catalogue directly, while clear saves `imageId: null`. Both entities support
an empty image and then show their type icon. The image catalogue stays open if
saving fails. A location required as a scenario's only visual source cannot be
deleted until the scenario is given another source. Material assets are changed
through their header icon. Locations and NPCs have no separate image card in the body.
The NPC bestiary reference appears below its description as a `HandbookListItem`;
clicking it opens `ItemViewModal`. Nested locations (`Внутри`) also appear directly
below the location description, before universal relations.
Materials keep their full image/video or styled text preview in the body when
viewed; full editing does not duplicate the preview. A material type change
opens the full form so dependent contents or assets can be supplied together.
Single-field saves use current entity data to preserve other fields, and failed
saves keep the draft open for retry. Quest goal, condition, reward, consequences
and notes keep separate cards with semantic icons.

Opening a location, NPC, quest or material from `UniversalRelationList` pushes
the current entity into a per-session navigation stack. The detail header then
shows `Назад к «…»`; returning pops one level without creating a new entry. The
ten newest relation transitions are persisted in local storage. Direct sidebar,
tree and search-result selection starts a fresh chain, and scenario canvas links
remain outside this entity stack.

The four catalogue sidebars share keyboard navigation: `↑` and `↓` select the
previous or next currently visible row and keep it inside the scroll viewport.
Navigation follows the filtered result order; the location tree additionally
skips descendants hidden by collapsed parents. At either edge the selection
stops instead of wrapping. The arrows also navigate search results while the
catalogue search field is focused, and the compact mapping is shown there when
contextual shortcut hints are enabled.

Locations deliberately use a hierarchy instead of another graph canvas. The
left part of the central workspace is a searchable tree, while the selected
location owns the detail area with its image, breadcrumb, description, children,
relations and read-only canvas usage. Expanded tree rows are stored per session in local storage.
The DM drags the whole row: dropping into the upper or lower part places it
before or after a sibling, while dropping into the middle makes it a child of
the target. The server validates session ownership and rejects self/descendant
cycles. Root dropping returns a location to the top level. There are no
location-to-location graph edges or geographic canvas state.

A location stores a semantic kind, shared-catalogue image, description, parent
and sibling order. Scenarios are not universal relation targets. The location
form has no `Внутри локации` field: hierarchy is changed through the location
tree. Editing other fields preserves the parent. Deletion is blocked until
direct children are moved or deleted.

Prepared NPCs live in one searchable session catalogue. A record has a name,
an optional race item, optional role and description, card color and a portrait.
The NPC editor can also link one existing type `6` bestiary creature without
copying its stat block. Removing that handbook item clears the optional link.
The portrait may come from an independent NPC preset catalogue or an uploaded
storage image; it is not mixed with chapter/location backgrounds. The race picker
combines base races from handbook type `8` and subraces from the separate type
`16`, labelling a variant together with its linked `data.race`; the stored nullable FK is cleared if that
item is removed. The name field has an explicit dice action backed by the same
race-aware generator as the D&D character wizard. Standard race profiles combine
at least 80 given-name/family-name variants each, while an unknown custom race
uses a broad fantasy fallback. Locations, NPCs, materials and quests use one
symmetric relation model. Every entity can link to any entity of those four
types, including another entity of its own type, with an optional private note.
`Добавить связь` opens one picker: the DM can search across the complete
catalogue or filter a type. The shared relation list groups links by type in both
modes, with a dashed plus immediately beside the `Связи` heading and a trash button
in each link card's corner. These actions save immediately in view mode and
change the draft in full edit mode. The source and existing links are excluded
from the picker. Link notes have their own pencils and are expanded during full
editing. The trash action is separate from card navigation. Editors use the
shared `ColorPresetPicker`, `SessionImagePicker` and form controls.
Each detail view has a separate read-only `На холстах сценариев` section. It is
derived from actual reference/material blocks, deduplicates scenarios, shows a
block count and opens the selected scenario. It cannot be edited from an entity
editor. Materials remain available from every scenario; placing one on a canvas
updates this derived usage instead of creating a relation.
`SessionImagePicker` keeps only the current image and `Сменить` in the parent
editor. Its modal renders every preset in one grouped scroll, with category
shortcuts that jump to section dividers; upload, when supported, is an action in
that modal. Picker tiles preserve each source image's aspect ratio: their width
follows the responsive grid while the complete image determines the tile height,
without centre-cropping. The NPC catalogue includes balanced female and male
portraits for villagers, city trades, guards, travellers and cultists, including
weathered everyday characters rather than only idealized adventurers.
World data is loaded lazily as one aggregate through `useSessionWorld`, then a
successful mutation replaces that aggregate so every reverse association stays
consistent.

The quest workspace is a searchable journal built on the same library shell.
A quest stores a name, separate goal, condition, reward, consequences and
master notes, status (`Запланировано`, `В процессе`, `Выполнено`, `Провалено`)
and universal relations. The detail view emphasizes the goal and shows the
remaining filled sections as compact cards; search covers every field. Its
selected id is deep-linked through `quest` just like locations and NPCs.

## Главы, сценарии, материалы и экран игроков

The previous fight-only TV page is now the session's anonymous player display
at `/screen/:code`. Its live state is one of `idle`, `material` or `combat` and
is kept separately from encounter JSON. Starting and finishing
combat switches this state automatically. A blackout hides current content
without discarding it, so the header control can reveal it again; `cut` and
`fade` are the deliberately small transition set. Rain, fog, embers, snow and
storm are visual layers rendered only by the player display. `Очистить` returns
the display to a visible idle state with the same dotted canvas background;
`Затемнить` remains the explicit action that covers the player screen in black.
The screen title and session name are rendered only for that idle state. During
material playback the asset occupies the whole viewport without a card frame or
metadata column; images, maps and video use contain scaling. The connection chip
is hidden while synchronization is healthy and appears only after an update
failure. The screen opens an SSE invalidation stream for immediate updates,
performs a control sync every 45 seconds and temporarily falls back to jittered
polling with exponential backoff while SSE is disconnected. Each event reloads
the latest database snapshot, so coalesced or missed events cannot lose state.

`Материалы` is a central DM library over the same dotted workspace background.
It uses the same `SessionLibraryWorkspace` shell, safe areas, sidebar surface
and detail geometry as locations and NPCs. A material has one of five explicit
types: image, video, plain text, styled note or map. Notes can use parchment,
letter, dossier or arcane presentation. A map currently renders as an image but
already owns its type and reserved `map_data`, so later layers and markers do
not require redefining ordinary images. Each material is stored once and may
have several universal links with an optional note. Scenario links define where
it is contextual; with no scenario links it remains available throughout the
session. Chapter attachment is not part of the model. The editor uses the same
editable universal relation list and searchable picker as locations, NPCs and
quests. The session-header display control
shows the current `Бой` / `Картинка` / `Письмо` / `Видео` / `Ничего` mode,
opens the standalone display and provides one icon toggle for blackout/reveal.
An active material has a contextual `Убрать` action; there are no generic clear
or stop actions. The player-only effect selector uses a compact illustrated icon
grid rather than plain text chips.
Its `Транслировать музыку` checkbox moves audible playback from the DM page to
the standalone display without changing the controller, queue or timeline. The
DM audio engine remains muted while it advances the clock and album queue; this
allows turning the checkbox off to restore local sound at the current position.
The display owns a two-element audio engine for volume, pause/seek, looping and
crossfade, and shows `Включить звук` only when browser autoplay policy requires
a user gesture.
The combat toolbar does not duplicate the standalone-screen launch action.

Plain text and styled-note bodies use the shared `--font-prose` reading face in
both the DM preview and standalone player presentation. Compact material-list
metadata, controls and counters remain in the UI face. Full NPC, location and
quest detail paragraphs follow the same split; their list-card snippets remain
UI text.

A scenario selects one session location through the universal relation search picker
with its type fixed to `location`; the editor shows the location path and allows
clearing the selection. This
link is separate from universal entity relations and from location reference
blocks on the scenario canvas. Scenarios themselves are not a player-display mode: the master broadcasts a
specific material from the header library or a scenario block. The third-level `image` block
references an existing contextual image or map material rather than duplicating its asset;
its leading action broadcasts that material immediately. All uploaded material
assets continue to use the ownership-aware `storage_image` registry and S3 URLs;
video uploads are limited to 100 MB, while text and note bodies remain database
content. Large media is spooled to a temporary file and uploaded with a global
three-operation concurrency limit, so concurrent videos do not accumulate in the
Go heap.

Every session has at least one ordered arc. Arc order is the canonical campaign
order; the UI renders it as a Roman number and rewrites `1..N` atomically after
reordering. Arcs do not have a status. Each arc owns an independent chapter
canvas and its transitions.

Chapters are graph nodes. A chapter has a free display number (`1`, `3A`,
`Пролог`), name, optional description, status, image and canvas coordinates.
Numbers are unique inside an arc, not across the campaign. The supported status
set is `draft`, `planned`, `ready`, `available`, `in_progress`, `paused`,
`completed`, `failed`, `skipped`, `cancelled`. The session-level chapter pointer
is shown to users as `Сейчас здесь`: assigning it to a preparatory chapter
promotes that chapter to `in_progress`, and only one chapter in the session can
carry the pointer.

`ChapterGraphToolbar` is the semantic session header with a `--surface` background,
`--border-strong` bottom divider and a short downward shadow, not a `BaseTile`.
The desktop application sidebar uses the same surface and a short rightward
shadow throughout the application, in both expanded and collapsed states. Together
they separate navigation from the darker dotted workspace without extra margins.
`SessionToolbarIdentity` owns the editable name,
status menu and arc switcher; `SessionToolbarMusic` owns the compact player and
overflow measurement. Current-chapter focus, zoom and contextual creation stay
on the canvas. There is no second session title bar or nested switcher.
`SessionGraphCanvas` keeps one physical `NarrativeGraphCanvas` mounted for all
narrative levels. The session name is the largest text in the command bar. The
unframed arc trigger below it reads `АРКА <Roman number> <name>` and opens the
complete arc list with the shared action-menu motion.
A DM drags any non-interactive
part of a row to reorder arcs; arrow controls are not used. Each row has a
pencil but no dedicated drag-handle dots; it opens `ArcEditorModal`, whose edit mode also owns the confirmed
delete action. `SessionGraphCanvas` uses the
application-wide canvas background and dot-color tokens, supports pan/zoom and
stores a viewport per graph in local storage; its 24px base grid repositions and
scales with that viewport. Every graph constrains the camera center to the
bounding box of its cards plus `320px` horizontal and `240px` vertical world
space, using the safe frame between the side rails; saved legacy viewports,
zooming and rail resizes are clamped by the same rule. Empty graphs remain
unconstrained until their first card exists. Nodes can be dragged; during an
active drag their transform transition is disabled so the node and every
connected edge update in the same frame. Spotlight transitions remain animated
outside dragging. `Ctrl`/`Cmd` click toggles node selection within the active
graph; dragging with the modifier held, from either a node or empty space,
draws a frame and adds every intersecting node to the selection instead of
moving cards or the camera. Dragging any selected node without the modifier
moves the whole selection without changing relative offsets. Plain node clicks
retain their action menus; clicking empty canvas space without the modifier or
pressing `Esc` clears selection, and changing graph levels also resets it. Two
or more selected nodes show a bottom-center action bar inside the safe frame
with the selected count, atomic bulk deletion and clear-selection. On the
chapter canvas the bar also provides the canonical color-coded status choices
and applies the chosen status atomically to every selected chapter. The scenario
canvas exposes the equivalent action with scenario-specific labels; blocks have
no status field. Both catalogues begin with the neutral `none` / `Без статуса`
value, which is the default for newly created chapters and scenarios.
Bulk chapter deletion fails as a whole when any selected chapter still contains
scenarios; bulk scenario deletion also removes its blocks.
Desktop session pages keep only the frameless `? · Горячие клавиши` affordance
at the bottom-left. Pressing `?` or clicking it toggles contextual shortcut
hints without reserving space or moving the participant rail: section hints sit
under their header tabs, the panel hint sits under the dice button, dice-roll
hints inside the corresponding dice, and canvas-only hints remain over the
bottom-left of the canvas safe area, beside the participant rail. If the dice panel is closed, its header button
temporarily shows the compact `1…7 · d4…d100` mapping instead. `Esc` hides the hints while preserving its
existing canvas action. The contextual help is hidden on touch and mobile
layouts.

Session-wide shortcuts use physical key codes and therefore do not depend on
the current keyboard language. `Alt`/`Option` + `1…8` opens Story, Locations,
NPCs, Quests, Materials, Music, Journal (meetings and entries) and Chronicle; `Shift` + `D` toggles the dice
popover without conflicting with browser address-bar shortcuts.
`Alt`/`Option` + `Shift` + `1…7` rolls d4, d6, d8,
d10, d12, d20 or d100 using the currently selected normal/advantage/disadvantage
mode. Dice rolling works while the dice panel is closed because its controller
remains mounted. Section switching is DM-only, matching the visible navigation;
panel and dice shortcuts are available to every session participant. Global
shortcuts ignore key repeats, text inputs, content-editable fields, open dialogs
and popovers. The only text-input exception is `↑` / `↓` in a session catalogue
search field, where the keys navigate the currently filtered rows.

Master timer cards also provide `−1 мин` and `−5 мин` controls. Subtraction is
persisted on the server and clamps the remaining countdown at zero.

Combat uses the same contextual shortcut system. `Shift+B` opens or closes the
combat workspace for any participant and preserves the chapter/scenario context
of the visible story canvas. Its session-header tab represents workspace
visibility and encounter activity independently: the standard active-tab
underline means the combat workspace is open, while a red live dot and tint mean
the encounter itself is running. Those two signals produce four visibly
distinct combinations, including a running encounter whose workspace is
closed; the accessible label names both states. While that workspace is open,
DM-only commands are
`Shift+Enter` to start or end the encounter, `←` / `→` to move to the previous
or next turn, `Shift+P` to toggle all players, `Shift+N` to toggle the NPC
reserve, `Shift+A` to toggle every combatant on the battle scene, and `Shift+R`
to reroll initiative for the current selection. `Backspace` removes only the
selected NPCs, matching the existing toolbar action and never removing selected
players. The start/end shortcut calls the
same transition controller as the toolbar button and remains unavailable until
at least one participant is selected. When contextual help is enabled, each
combination appears beside its corresponding combat control. `Shift+Enter`
defers to the browser's native activation when focus is already on a button or
link, preventing one keypress from invoking two actions.

When contextual canvas hints are visible, they reflect the active behavior:
`Ctrl`/`Cmd` + click toggles a node, modifier-drag adds nodes through a frame,
`Ctrl`/`Cmd` + `A` selects every node in the active graph, `Delete`/`Backspace`
opens the existing confirmed bulk deletion, `Esc` cancels the active link or
selection, `+`/`-` changes canvas zoom, and double click opens the nested
canvas. The only session-local setting in the header is automatic bestiary HP
rolling; it is stored per session in local storage.
Drilling into a narrative level waits for the 420ms spotlight movement to reach
its ancestor position, then swaps the graph identity, payload and preloaded
viewport in one render. DOM keys include the graph identity so equal numeric IDs
from different entity tables cannot reuse a node. Returning prepares the parent
viewport before its payload appears and keeps the returning node in the ancestor
position for one painted frame before animating it to its saved coordinates.
Combat appears together with the participant-rail transition and hides the
narrative canvas for the duration of the workspace. For accounts with map access,
the same map workspace occupies the field underneath the combat controls; the
initiative track and smaller current-turn preview overlay it during active combat.
The selected chapter,
scenario and narrative level remain mounted as hidden state, so closing combat
restores the same canvas without reloading or resetting it. Reduced-motion users
skip the transition.
A regular node click opens its action popover: its first action explicitly opens the chapter scenarios, then it can mark
it as `Сейчас здесь`, change status, edit, start a transition, move to another
arc or delete.
Status choices use the same configured semantic colors as the status badge on
the chapter node. While scenarios or blocks are open, clicking the pinned
chapter preview opens a reduced chapter menu with return-to-chapters, status
change and edit actions. Outside combat, a single contextual back button below
the pinned chain reads `К главам` on the scenario canvas and `К сценариям` on
the block canvas, and always returns exactly one level. Combat hides the story
canvas together with its pinned context cards and navigation controls.
Double-clicking a chapter opens its scenario canvas directly.
Moving a node to another arc removes its old transitions after confirmation
because a transition cannot cross arc boundaries.

The chapter illustration covers the complete node. Number, title and optional
scene count sit on a blurred translucent overlay above the image; lifecycle and
`Сейчас здесь` markers remain at the top. The neutral `none` lifecycle marker
is omitted. `sceneCount` is derived by the graph
read API, not stored on `session_chapter`, and is updated optimistically when
contextual scene CRUD changes the count.

Chapter transitions are one-way or bidirectional edges inside one arc. They may
have a short optional label; clicking either the curve or label opens label,
direction and delete actions. Reverse is shown only for a one-way edge. The
graph API validates that both ends and the edge belong to the same arc and
session.

The built-in story image catalogue is shared by chapters, scenarios and locations
and served by `GET /api/session-images?scope=story`. The picker first selects one of
four categories — settlements, wilderness, adventure or story — and then an
image inside it. Story adds battle, investigation, negotiation, chase, puzzle
and discovery covers to the original location catalogue. A chapter may instead
use an image uploaded through the normal storage endpoint and adjust its focal
point. Chapters and locations store an image; a scenario may leave its own image
empty and inherit the current image of its linked location. Both catalogue and
custom files resolve through `storage_image` in S3.

Scenarios belong to chapters and form a second directed graph. A chapter action
or double click keeps the same canvas engine mounted and swaps its chapter nodes
and edges for scenario nodes and edges. The selected chapter gets a temporary
presentation transform to the safe top-left corner; normal coordinates stay
unchanged and the other nodes and edges fade out. Once the swap completes it is
rendered as a fixed ancestor card above the same canvas. The scenario graph has
its own persisted viewport, coordinates and direction-aware edges. Its illustrated
nodes can be dragged and linked through the same right-side port pattern. The
DM creates or edits the scenario name, lifecycle status, optional location and
optional shared-catalogue image, or deletes the scenario. At least the location
or the image is required; an explicit image overrides the location image. Its optional top status chip uses the same
semantic color as the menu and bulk action and is omitted for `none`; the lower
title surface uses the same translucent treatment as a chapter and has no
redundant `Сценарий` label, generated scenario number or double-click hint. A single click anywhere on a scenario card opens
its launch, open-elements, status, edit and delete actions without a separate
ellipsis trigger; double click still opens the scenario block canvas. The scene
image continues beneath the translucent lower copy surface just as it does on a
chapter card, rather than ending above an opaque footer.
Deleting a linked location clears the link; a scenario that inherited its image
keeps the location's current image as its own so the card never loses its visual
source.

Double-clicking a scenario switches the same physical canvas to the third graph.
The scenario node first moves to the top immediately to the right of its chapter
and its peers and edges fade out; then block nodes replace the graph payload.
Description, dialogue, combat, reward, image, material, location, NPC and quest blocks have independent coordinates, persisted widths,
content-sized heights and direction-aware links. Their accent color is derived from
the type instead of being user-selected or stored. Block cards use the same
dark `var(--surface)` backing and inset border as `BaseTile`, with only a quiet
type-colored hover tint and no leading color strip. Every card starts with a
separated heading group: a small type-colored block kind above a larger display
title, so the title remains the primary landmark over variable content. Every
block type also has a stable semantic icon to the left of this pair; material
blocks use the icon of their concrete material kind. Dialogue blocks store
speaker/reply rows: speaker inputs autocomplete from the unique names already
used in that dialogue, and every speaker receives one consistent distinct
color from the shared palette. Clicking the color circle beside a speaker opens
that palette; choosing a color updates every row with the same normalized
speaker key. On the canvas each row places the right-aligned speaker name,
a vertical speaker-colored divider and the unframed reply in three columns.
Every block card keeps a visible border mixed from its semantic type color;
hover strengthens the same border instead of introducing another accent.
Quest and material full previews start directly with useful
content and do not repeat another icon, entity name or material-kind header.
Clicking any non-interactive
part of a block opens its action menu; there is no separate ellipsis trigger.
The menu provides edit, copy and delete, while a double click opens
`SceneBlockEditorModal`. A combat block contains bestiary references and/or
simplified creature records with quantities. Its leading `В бой` action adds
the whole list to the encounter NPC reserve and opens the combat workspace with
that block's chapter and scenario as its visible context. Bestiary creatures
show their current handbook image or SVG in the card and editor; simplified
creatures use a stable placeholder. A reward block stores quantity-bearing
references to things, weapons and equipment and renders their current handbook
icons and names. An image block references only an image/map material. The
separate material block opens the shared searchable picker over every material
kind available in the current chapter/scenario, renders a type-aware preview
and exposes the same direct broadcast action. Reference blocks use
`SceneEntityBlockPreview` instead of a generic image/name row. Locations show
their kind, hierarchy, description and nesting; NPCs show portrait, race, role,
description and meeting places. A linked NPC also shows an `Открыть в бестиарии`
button which navigates directly to the current handbook creature; quests show status and every filled goal,
condition, reward, consequence and note; materials show their type, caption and
actual image or written content. Every reference card also resolves and renders
the current universal links, so edits to a catalogue object appear on the
scenario canvas without copying its data into the block.
Location, NPC, quest and material create actions are visually separated into an
`Объекты сессии` group. Each action first opens the universal picker locked to
that entity type; choosing a row creates the block immediately. The type header
also has a transparent dashed create action, which opens the canonical entity
editor and places the newly created object on the canvas after save. Reference
blocks have no independent title: the heading and full preview always resolve
the current catalogue name. Their editor only changes the reference and an
optional scenario-local note, which is rendered below the live preview. The
first three types store a validated entity reference and render live catalogue
data rather than copying it into the block.
Block edges are re-measured after content or width changes, and dragging the
right edge persists a width in the `220..640px` range. Clicking the pinned
scenario opens a reduced menu with return-to-scenarios, status and edit actions;
double click remains the direct return shortcut. Double-clicking the pinned chapter at either
nested level returns to chapters. Thus the visible ancestor chain and its single
contextual back button provide level navigation without duplicating a breadcrumb
bar or physical canvas.

`NarrativeGraphCanvas` owns pan, zoom, drag, link-port, edge and spotlight mechanics
for all three levels. `useSceneGraph` and `useSceneBlockGraph` own their server
state and optimistic position/width previews. `useSessionGraphNavigation` owns
the current level and selected scenario id, while `useSessionWorkspace` keeps a
single explicit `idle/opening/open/closing` phase instead of parallel boolean
flags. Drag previews are emitted at most once per animation frame, layout reads
for the safe frame occur only for the spotlight node, and viewport persistence
is debounced. Each graph key persists only its viewport in local storage; node
positions and edges are server state.
When a node drag crosses the movement threshold, the canvas emits one
`drag-start` signal and closes any chapter, scenario, block or edge action
popover before position previews begin.
Completing a link gesture creates an unlabelled one-way edge immediately at
every level; the edge action menu remains the explicit place to add or edit a
label later. During creation the temporary arrow ends exactly at the pointer.
Its source and every completed edge use the centered port on the nearest facing
side of each card, including the top and bottom sides. The same menu at all
three levels can reverse a one-way edge or toggle it to/from bidirectional;
reverse is hidden while both arrowheads are active. Dragging the enlarged hit
area along the first or last part of a hovered curve previews the existing edge
from the pointer and persists the new source or target when dropped on another
card. This keeps converging edges individually reachable before their shared
port. While creating or rewiring an edge, hovering a valid node snaps the
temporary path to the complete future port-to-port geometry and highlights the
prospective target.
`SceneEditorModal` is used for scenario create/edit, `ConfirmDialog` for
destructive actions, and `SceneBlockEditorModal` for block content. Scene and
block CRUD remains in `session_scenes.go`; graph reads, positions and links are
handled by `session_scene_graph.go`.

Combat still uses the same canvas layer from the command bar. Entering it from
an open block canvas hides the narrative canvas and lets the standalone combat
header use the full center width. The command-bar combat action reads the same
currently displayed canvas context, while a chapter-only
canvas falls back to the current chapter. Chapter and scenario ids are saved with
the active narrative level in workspace state and restored after reload. Closing
combat returns to that saved scenario or block canvas instead of resetting the
user to chapters. Chapter and scenario editing stays on the narrative canvas;
the encounter must be closed before using those controls. The player rail adds
combat-only “select all” and “move selected to combat” actions above its cards;
both operate only on players and preserve any NPC selection. With or without a
scenario context, the combat header uses the full center width;
combatants remain independent tiles below it rather than being wrapped in one
central card. The combat workspace uses the
width between the participant safe area and the right tool rail. The header uses one enlarged,
labelled primary action, “Начать бой” or “Закончить бой”, while turn navigation
remains compact and icon-only. The header has one stable composition at every
width: its scenario image keeps its native aspect ratio, scales to the width of
the complete left column and falls back to the chapter image when no scenario is
selected. The chapter and scenario names are overlaid on that image. The right
side keeps combat flow above and grouped actions below, with all controls aligned
to the left. It never hides the primary-action text or group labels. When a
scenario is selected, `Бои сценария` lazily loads its combat blocks in a popover;
choosing one imports the complete configured creature counts through the same
encounter importer without leaving the combat workspace. Secondary actions are
grouped as `Выбранные` (challenges and damage) and `Состав сцены` (scenario import, reserve, death, NPC deletion and graveyard). Initiative rerolls sit beside start/finish and turn navigation.
The combat header has no separate close control; starting and ending combat stays
with the labelled primary action. During active combat the initiative column and
the current-turn reference panel each scroll inside the same bounded workspace
height, so scrolling one column never shifts the other.
`Выбранные` contains challenges and shared damage; roster management stays in `Состав сцены`. Shared damage consumes temporary HP first, updates NPC
encounter state and persists each player character through the character API.
Nested action components use the same icon-button geometry and interaction
states as direct toolbar buttons.

## Связанные страницы

[Оглавление wiki](../../README.md) · [Игровые сессии](../sessions.md) · [API: сессии и сцены](../../api/sessions.md) · [БД: сессии и игровые события](../../database/sessions.md) · [Дневники](../journals.md)
