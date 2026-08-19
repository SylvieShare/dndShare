# Sessions

Frontend: `frontend/src/features/sessions`. Backend:
`internal/web/sessions.go`, `session_scenes.go`, `session_world.go`, `music.go`
and matching store files.

## Pages and access

- `/sessions` — campaigns available to the user.
- `/sessions/:uuid` — session workspace.
- `/join/:code` — invitation flow.

A session has DM/participant permissions, current chapter, participants,
encounter and synchronized music state. Owner-only actions are checked on the
server, not only hidden in UI.

`GET /api/sessions` returns session cards with participant briefs and current
chapter, including that chapter's image URL and focal point. The list renders
each campaign as a full-width tile: the current chapter image and label form the
cover, while the campaign name, description, system, user role, participants
and last-change time stay in the content area. Without a selected chapter the
cover uses the campaign initial; on narrow screens it moves above the content.
For sessions where the current user is a participant, the response also
includes the owner's login and the tile shows it as the DM name.
Participant avatar for the list is read from the canonical character data;
`char_template.path_values_for_list` does not exist.

## Participant display

`lib/participantView.js` is the only participant adapter. It resolves the
setting from `templateId` and delegates name/avatar/subtitle/level/HP/AC to the
same accessors used by character cards and the sheet. Entry contract is
`{templateId,data}`. If the setting is not registered, there is no path-map
fallback.

`ViewSession` and join pages ensure the template store before rendering. In the
session workspace, `CharacterCreateWizardModal` presents the full D&D creation
wizard as a fullscreen modal. Its result carries an explicit rules
`sourceVersionId`, is attached to the current session and refreshes the
participant rail; the modal then closes without opening the new sheet or
changing the route. The invitation flow continues to use the compact
`CharacterCreateModal` and opens the joined character after creation. One
character can belong to at most one session. Both invitation entry points show
a confirmation naming the previous session before a transfer; confirmation
sends an explicit replacement flag, and the backend atomically removes the old
membership before creating the new one. A database unique constraint on
`session_participant.char_id` enforces the rule for every caller.

The session participant rail has no shared backing surface: each participant is
an individual interactive `BaseTile`. Clicking it opens `RowActionMenu` with an
icon-labelled `Открыть лист` action plus DM-only color and confirmed kick
actions; bulk participant selection is not part of the rail. A DM reorders
players by holding and dragging any non-interactive area of the participant
tile; buttons and combat controls remain regular click targets. The shared
`useSortable` interaction suppresses the menu click after an actual drag and
persists the complete order in `session_participant.sort_order`; a failed save
restores the previous order. The color is stored on the participant's
session membership and renders as the same diagonal `BaseTile` mark in the rail
and on that player's encounter rows. Color palettes, encounter cloning and the
chapter status/arc choices use `RowActionSubmenu`: a separate adjacent popover
on desktop and an inline section with a left accent boundary on mobile. Every participant trigger fills the rail width. A dashed `+` action
beside the `ИГРОКИ` heading opens character creation and invite code/link copy
actions; the rail has no separate invitation tile. A separate header control
switches the rail between its normal width and a compact avatar-only mode. The
choice is stored per session in `localStorage`. Combat is the third visual
state: it temporarily expands the same rail for initiative and selection
controls, then returns to the user's saved normal or compact state when combat
closes. Width, tile height and text visibility use one coordinated transition;
compact avatars retain the participant menu, tooltip and hold-to-reorder input.
The left rail's hit area and height end with its rendered heading, players and
error message (up to the
viewport max-height), so the uncovered canvas below a short player list remains
available for pan and node dragging.

The session page is a campaign workspace rather than a stack of independent
content pages. Its semantic header centers the switch between `Сюжет`, `Бой`,
`Локации`, `NPC`, `Задания`, `Материалы` and `Музыка` independently of the title/arc and tool groups. `Сюжет` and `Бой`
form the first navigation group and a vertical divider separates them from the
four world catalogues; a second divider separates the final music-library tab. The
participant rail remains on the left and the
dice/events/music tools remain in a 328px right rail, wide enough for the full
three-option dice mode switch without label clipping. In `Сюжет` the chapter canvas fills
all available width below `AppHeader`. CSS safe-area variables keep focus, zoom
and newly created nodes in the uncovered part of the canvas. The catalogue
workspaces start 8px after the visible participant rail and use an 8px internal gap,
so their list column remains visually attached without sliding underneath the
players. Only rendered right-side
tiles receive pointer events: transparent space below a shorter stack remains
available for canvas pan, selection and node dragging. When all three tiles are
hidden, the right safe area collapses and canvas create actions move to the
viewport edge. At widths up to `1360px` the right tool rail is hidden so the
split location/NPC workspaces retain a useful detail width; the participant rail
disappears only on mobile.

The primary switch remains active at every story depth. `Музыка` opens the
central session library while the compact right-rail music tile remains the
current-track player. There is no fullscreen library modal or local open/close
state. Combat is represented
as a real tab next to Story rather than a tool icon: selecting `Бой` opens the
existing animated workspace, and selecting `Сюжет` runs the same closing
transition back to the preserved chapter/scenario context. Selecting a world
catalogue closes the combat workspace without stopping an active encounter;
its red live marker therefore remains visible on the inactive `Бой` tab. Each
catalogue selection stays in its own query key, so
returning to a catalogue restores the previously selected location, NPC, quest
or material. The settings control is visually separated from the dice, music
and log group by its own vertical divider.

Постоянные icon-кнопки в командной шапке независимо открывают и закрывают
целые панели кубиков, музыки и событий. Выбранная видимость сохраняется в
`localStorage` и восстанавливается при следующем открытии страницы; состояние
самих смонтированных панелей при временном скрытии также сохраняется. Внутренних
кнопок сворачивания у панелей нет.
Отдельная master-only кнопка `Таймеры` открывает компактную форму с описанием,
минутами/секундами и быстрыми пресетами. Каждый запущенный таймер появляется
как стеклянная карточка справа под шапкой; при открытой колонке инструментов
стек сдвигается влево и не перекрывает её. Карточка показывает серверно
синхронизированный отсчёт и прогресс, позволяет поставить таймер на паузу,
продолжить и добавить одну или пять минут. После нуля она получает заметное
завершённое состояние и кнопку `Убрать`; добавление времени запускает её снова.
Таймеры сохраняются в PostgreSQL, поэтому переживают перезагрузку страницы и
сон браузера. Они видны только мастеру в рабочем пространстве сессии и никогда
не попадают на анонимный экран трансляции.
Заголовок music panel не дублирует название выбранного альбома; текущий трек
остаётся в основном playback-блоке.
`SessionEventsPanel` расположен под музыкой, занимает свободную высоту и
прокручивает только собственную хронику по вертикали; длинные имена, описания и
результаты бросков переносятся без горизонтального скролла. Новые записи находятся сверху и
группируются сначала по минуте, затем по последовательному субъекту действия.
Шапка показывает состояние синхронизации, число видимых записей и открывает
`BasePopover` фильтров. Автор выбирается как все / владелец / игроки через
`MultiToggle`, субъект — из реально присутствующих в загруженной хронике
персонажей, существ и системных событий, тип — независимыми категориями
«Броски», «Персонаж», «Бой» и «Сюжет». Активные фильтры остаются чипами под
шапкой, снимаются по одному или общим сбросом; пустая фильтрованная выдача не
выглядит как пустая сессия и предлагает вернуться ко всей хронике. Фильтрация
применяется локально к загруженным событиям и не меняет серверный журнал.
В событии броска итог расположен в строке заголовка справа и отделён от названия
растягивающейся горизонтальной линией; отдельные значения кубиков остаются ниже.
Время показывается один раз слева, а заголовок субъекта и вертикальная линия
через маркеры объединяют его соседние события, не выходя за первое и последнее.
Сами события не имеют фона и рамки; тонкая рамка без заливки окружает их
иконки-маркеры. Имя субъекта берётся из сохранённого `actorName`: для игрока это
имя его персонажа, для мастера — персонаж или существо, от которого выполнено
действие. Системные записи вроде начала боя не имеют субъекта и выводятся без
пустого заголовка. Логин и флаг `authorIsSessionOwner` в визуальной хронике не
показываются как отдельная строка; события владельца получают компактную метку
в заголовке субъекта, а сам флаг присутствует в каждом событии для фильтрации и
другой клиентской логики.
`stores/sessionEvents.js` загружает последние 50 записей, затем получает новые
по cursor только после invalidation из общего SSE-потока страницы сессии и
устраняет дубликаты по серверному id. При восстановлении потока выполняется
catch-up запрос, поэтому coalescing, разрыв соединения или рестарт процесса не
теряют записи. Когда на странице сессии открыт модальный лист,
контекст бросков временно получает uuid этого персонажа; закрытие листа
возвращает общий контекст мастера.

## Session timeline

`session_event` stores semantic gameplay actions rather than arbitrary sheet
JSON changes. The current producers are dice rolls, short/long rests, resource
use, potion/inventory spending and replenishment, spell use,
current chapter, encounter start/finish and `entry_added` for inventory items,
weapons, potions, spells, feats and abilities. Direct picker/manual additions
and level-up grants use the same event. Regular editing, drag ordering, music
controls and manual configuration do not create timeline noise.

Each event stores `actorName` and `action` independently. `actorName` is a
snapshot, so renaming a character does not rewrite history; `actorCharUuid`
keeps the optional structural link used for permissions and character context.
The server authenticates every timeline read/write as either the session DM or
a participant. Players can reference only their own participant and the server
derives that character's name. The DM can reference any participant or supply a
standalone creature name when no character UUID exists. Events that describe
the session itself have neither actor field. Character pages select their event
context from the explicit `?session=<uuid>` query, falling back to the
character's attached session. Player session cards open that character context instead
of the DM workspace.

State-changing character actions are queued by the sheet and sent in the next
`PUT /char/{uuid}/data`; backend character data and its events commit in one
transaction. A cantrip still schedules this semantic save, but the character
version is not bumped when JSON data is unchanged. Dice rolls use the direct
event endpoint because they do not mutate character state. Pending debounced
character saves are flushed on page unmount instead of dropping their events.
Encounter initiative, HP and challenge rolls pass an explicit actor override,
so they are not attributed to an unrelated sheet left open by the DM. NPC actor
names include their encounter marker (`Кобольд A`), including rolls made from a
creature card opened from the encounter.

## Locations and prepared NPCs

`Локации`, `NPC`, `Задания` and `Материалы` are DM-only primary central workspaces, not extra permanent
side panels. Their surfaces sit over the same tokenized dot field as the story
canvas. The selected mode is stored per session in local storage; `view`,
`location`, `npc`, `material` and `quest` query parameters preserve a shareable selection. Combat is
still a temporary overlay. Opening it from either world workspace keeps that
workspace mounted underneath and closing combat returns to the same mode and
selected entity. All four catalogues render the selected record through one
`SessionEntityDetail` header and body shell. It owns the shared title,
visual/accent, metadata, action layout and labelled `Редактировать` button;
each catalogue supplies only its domain-specific visual, secondary actions and
content sections.

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
editor excludes itself and all descendants from its parent picker,
and deletion is blocked until direct children are moved or deleted.

Prepared NPCs live in one searchable session catalogue. A record has a name,
an optional race item, optional role and description, card color and a portrait.
The portrait may come from an independent NPC preset catalogue or an uploaded
storage image; it is not mixed with chapter/location backgrounds. The race picker reads type `8`
handbook items, including subraces; the stored nullable FK is cleared if that
item is removed. The name field has an explicit dice action backed by the same
race-aware generator as the D&D character wizard. Standard race profiles combine
at least 80 given-name/family-name variants each, while an unknown custom race
uses a broad fantasy fallback. Locations, NPCs, materials and quests use one
symmetric relation model. Every entity can link to any entity of those four
types, including another entity of its own type, with an optional private note.
`Добавить связь` opens one picker: the DM can search across the complete
catalogue or filter a type. Editors show only current links with remove actions,
while detail views sort them and split them into type sections with readable 44–48 px previews
and full-size primary/secondary text. Editors use the
shared `ColorPresetPicker`, `SessionImagePicker`, form controls and modal frame.
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

## Chapters, scenarios and blocks

### Materials and the player screen

The previous fight-only TV page is now the session's anonymous player display
at `/screen/:uuid`. Its live state is one of `idle`, `material` or `combat` and
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
shows live state, opens the standalone display and provides contextual
materials, blackout/reveal/clear actions and the player-only effect selector.
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

A scenario participates in universal relations and edits them in its main
editor. Opening a scenario relation navigates directly to its block canvas.
Scenarios themselves are not a player-display mode: the master broadcasts a
specific material from the header library or a scenario block. The third-level `image` block
references an existing contextual image or map material rather than duplicating its asset;
its leading action broadcasts that material immediately. All uploaded material
assets continue to use the ownership-aware `storage_image` registry and S3 URLs;
video uploads are limited to 100 MB, while text and note bodies remain database
content.

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

`ChapterGraphToolbar` is the semantic session header with its own background and
bottom divider, not a `BaseTile`. It combines the editable session name, the
four primary workspace choices, story-only arc switcher and ordering,
accessible icon-only combat launcher, and the dice,
music and timeline panel toggles. Current-chapter focus and zoom are canvas interactions
rather than toolbar controls. Creation is contextual and lives on the canvas
in a top-right vertical action dock, immediately left of the right tools rail;
there is no chapter/scenario/block creation button in the header. There is no
second nested switcher or session title bar. `SessionGraphCanvas` keeps one
physical `NestedGraphCanvas` mounted for all narrative levels. The session name is
the largest text in the command bar. The unframed arc trigger reads
`АРКА <Roman number> <name>` with the original muted uppercase label and a
bold UI-font accent-colored Roman number, gains a quiet background only on
hover/open, and opens the complete arc list with the shared action-menu motion.
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
under their header tabs, panel hints under the dice/music/log buttons, dice-roll
hints inside the corresponding dice, and canvas-only hints remain over the
bottom-left of the canvas safe area, beside the participant rail. If the dice panel is closed, its header button
temporarily shows the compact `1…7 · d4…d100` mapping instead. `Esc` hides the hints while preserving its
existing canvas action. The contextual help is hidden on touch and mobile
layouts.

Session-wide shortcuts use physical key codes and therefore do not depend on
the current keyboard language. `Alt`/`Option` + `1…6` opens Story, Locations,
NPCs, Quests, Materials and Music; `Shift` + `D`, `M` or `L` toggles the dice,
music or session-log panel without conflicting with browser address-bar
shortcuts. `Alt`/`Option` + `Shift` + `1…7` rolls d4, d6, d8,
d10, d12, d20 or d100 using the currently selected normal/advantage/disadvantage
mode. Dice rolling works while the dice panel is closed because its controller
remains mounted. Section switching is DM-only, matching the visible navigation;
panel and dice shortcuts are available to every session participant. Global
shortcuts ignore key repeats, text inputs, content-editable fields, open dialogs
and popovers. The only text-input exception is `↑` / `↓` in a session catalogue
search field, where the keys navigate the currently filtered rows.

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
Combat still overlaps its content reveal with the chapter movement; the
participant rail width uses the same duration and easing as that movement, both
on entry and exit. Reduced-motion users skip the delay.
A regular node click opens its action popover: its first action explicitly opens the chapter scenarios, then it can mark
it as `Сейчас здесь`, change status, edit, start a transition, move to another
arc or delete.
Status choices use the same configured semantic colors as the status badge on
the chapter node. While scenarios or blocks are open, clicking the pinned
chapter preview opens a reduced chapter menu with return-to-chapters, status
change and edit actions; double click remains a direct return shortcut.
Double-clicking a chapter opens its scenario canvas directly.
Moving a node to another arc removes its old transitions after confirmation
because a transition cannot cross arc boundaries.

The chapter illustration covers the complete node. Number, title and optional
scene count sit on a blurred translucent overlay above the image; lifecycle and
`Сейчас здесь` markers remain at the top. The neutral `none` lifecycle marker
is omitted. `sceneCount` is derived by the graph
read API, not stored on `session_chapter`, and is updated optimistically when
contextual scene CRUD changes the count.

Chapter transitions are directed edges inside one arc. They may have a short
optional label; clicking either the curve or label opens edit/reverse/delete
actions. The graph API validates that both ends and the edge belong to the same
arc and session.

The built-in story image catalogue is shared by chapters, scenarios and locations
and served by `GET /api/session-images?scope=story`. The picker first selects one of
four categories — settlements, wilderness, adventure or story — and then an
image inside it. Story adds battle, investigation, negotiation, chase, puzzle
and discovery covers to the original location catalogue. A chapter may instead
use an image uploaded through the normal storage endpoint and adjust its focal
point. Every entity stores the same `imageId` contract, and both catalogue and
custom files resolve through `storage_image` in S3.

Scenarios belong to chapters and form a second directed graph. A chapter action
or double click keeps the same canvas engine mounted and swaps its chapter nodes
and edges for scenario nodes and edges. The selected chapter gets a temporary
presentation transform to the safe top-left corner; normal coordinates stay
unchanged and the other nodes and edges fade out. Once the swap completes it is
rendered as a fixed ancestor card above the same canvas. The scenario graph has
its own persisted viewport, coordinates and directed edges. Its illustrated
nodes can be dragged and linked through the same right-side port pattern. The
DM creates or edits the scenario name, lifecycle status and required shared-catalogue
image, or deletes the scenario. Its optional top status chip uses the same
semantic color as the menu and bulk action and is omitted for `none`; the lower
title surface uses the same translucent treatment as a chapter and has no
redundant `Сценарий` label. A single click anywhere on a scenario card opens
its launch, open-elements, status, edit and delete actions without a separate
ellipsis trigger; double click still opens the scenario block canvas. The scene
image continues beneath the translucent lower copy surface just as it does on a
chapter card, rather than ending above an opaque footer.

Double-clicking a scenario switches the same physical canvas to the third graph.
The scenario node first moves to the top immediately to the right of its chapter
and its peers and edges fade out; then block nodes replace the graph payload.
Description, dialogue, combat, reward, image, material, location, NPC and quest blocks have independent coordinates, persisted widths,
content-sized heights and directed links. Their accent color is derived from
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
description and meeting places; quests show status and every filled goal,
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
nested level returns to chapters. Thus the visible ancestor chain is also the
level navigation and does not duplicate a breadcrumb bar or physical canvas.

`NestedGraphCanvas` owns pan, zoom, drag, link-port, edge and spotlight mechanics
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
Completing a link gesture creates an unlabelled directed edge immediately at
every level; the edge action menu remains the explicit place to add or edit a
label later.
`SceneEditorModal` is used for scenario create/edit, `ConfirmDialog` for
destructive actions, and `SceneBlockEditorModal` for block content. Scene and
block CRUD remains in `session_scenes.go`; graph reads, positions and links are
handled by `session_scene_graph.go`.

Combat still uses the same canvas layer from the command bar. Entering it from
an open block canvas preserves the visible chapter and scenario as two pinned
context cards; the standalone combat header sits to their right. The command-bar
combat action reads the same currently displayed canvas context, while a chapter-only
canvas falls back to the current chapter. Chapter and scenario ids are saved with
the active narrative level in workspace state and restored after reload. Closing
combat returns to that saved scenario or block canvas instead of resetting the
user to chapters. The pinned chapter and scenario keep their regular action
menus in combat, including keyboard activation, so the DM can update their
status or edit them without closing the encounter. Successful scenario edits
and status changes immediately replace the scene stored in combat workspace
state, including on the first entry after reload, rather than waiting for the
scene graph to be reopened. Menu navigation and double click use the same level
transitions as outside combat: the pinned scenario returns to its scenario
canvas, the pinned chapter returns to chapters, and a spotlight chapter opens
its scenarios. These transitions leave the encounter state intact. The player rail adds a
combat-only “select all” action above its cards; it selects or clears every
player combatant while preserving any NPC selection. The action is the same
compact icon-only control used above the battle scene and NPC reserve. Without a scenario context the
combat header sits immediately to the right of the focused chapter;
combatants remain independent tiles below it rather than being wrapped in one
central card. On desktop the combat workspace retains the same reserved right
boundary whether the tool rail is open or empty, so hiding all right-side tools
does not stretch the central combat column. The header groups compact icon actions for starting or ending
combat and turn navigation. Its growing secondary action row uses labelled
groups only for categories that currently contain multiple actions; single
pre-combat roll and dead-combatant actions remain direct icon
buttons without a group title or frame. Nested action components use the same
icon-button geometry and interaction states as direct toolbar buttons.

## Encounter

Encounter state is split into composables under `features/sessions/composables`:
load/save, players, NPC item cache, HP, initiative, flow, states and dice.
`useEncounter.js` composes them; row components remain presentation-only.

The encounter workspace has no shared backing surface. Its header and every NPC
row are separate `BaseTile` surfaces. In the chapter canvas the header is fixed
beside the focused chapter while only the rows area scrolls. Row strips use the
explicitly selected participant color for players or `iconColor` for NPCs; rows
without an assigned color have no strip in either combat or the NPC reserve.
NPC artwork stretches through the full 92px tile height while player portraits
retain their compact framed crop. Session dice pass the default accent color
explicitly to every `SystemDie`.

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
widens the existing left participant rail from 246px to 360px; every player tile gains the
encounter checkbox, initiative input and armor-class indicator, and the current
turn is highlighted there. These controls remain mounted inside a fixed-height
tile and slide in from behind its left edge together with the widening rail;
closing combat sends them back left instead of mounting or unmounting them.
Players that enter combat also appear in the common
initiative-ordered combat scene alongside NPCs while remaining visible in the
left rail. The common scene rows reuse the same compact initiative and
armor-class controls as the player rail. The left-rail tile and portrait keep
the same height and circular geometry in and out of combat; the larger combat-scene
portrait is circular too. Player photos use a soft alpha fade around their edges. An
assigned session color appears as the portrait frame in both representations;
player rows do not repeat a `PC` type chip. NPC artwork occupies the full row height instead of falling
back to a name initial. Every combat-scene tile has a numbered marker on its
left.
`ViewSession.vue` owns the single `useEncounter` instance shared by the rail and
`EncounterTab`, so selection and initiative always address the same encounter
record.

The DM-only session settings button in the command bar stores browser-local
preferences under the session UUID. When automatic handbook HP rolling is on,
adding a bestiary creature rolls its `hp_formula` separately for every created
copy and stores the result as an encounter override. When it is off, the
handbook average remains the starting maximum and current HP.

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

Clicking a non-interactive area of a combat or reserve row opens its action
menu; initiative, HP, selection, marker and other dedicated controls keep their
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

When the combat rail changes the canvas safe-left inset, `NestedGraphCanvas`
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
closing a top-level workspace clears this preference before the closing
animation. Closing combat opened from a nested canvas immediately persists that
return context, so even a reload during the exit animation restores the scenario
or block canvas instead of combat.

Encounter hydration and saving are fail-safe: a failed initial GET never turns
into an empty PUT, writes are snapshotted and serialized after the debounce, a
failed latest write is retried, and a pending snapshot is flushed on unmount.
The same flush starts when the tab becomes hidden or receives `pagehide`, which
keeps the debounce window from dropping the latest change during navigation.
The participant list is periodically refreshed while the page is visible;
joining players are added to the encounter reserve and players removed from the
session are removed from encounter state. Polling pauses in hidden tabs and an
in-flight request cannot restart it after unmount.

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

The session display control links to the standalone public route `/screen/:uuid`
for a television or projector. It has no application navigation or authenticated
controls. Its SSE stream refreshes the presentation and, in combat mode, the
public encounter projection immediately; fallback polling and a control sync
cover reconnects, server restarts and missed in-memory signals. Returning to a
visible browser tab also requests a fresh snapshot. The screen shows
the session name, round, current turn and the complete initiative order with
portraits, markers and resolved condition names. The current-turn panel uses a
bestiary creature's cover at full panel height against its right edge, with the
ordinary portrait remaining the fallback for players and creatures without a
cover. The cover keeps its intrinsic proportions as the viewport narrows; the
left-hand turn text layers over the artwork instead of squeezing it. Exact HP is intentionally not
part of the public DTO or UI: health is presented as `Здоров` above 50%,
`Ранен` above 25%, `Критически ранен` at 25% or below, and `Без сознания`
(player) / `Повержен` (NPC) at zero. A failed refresh keeps the last successful
snapshot visible and marks the connection as interrupted.

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

The DM header control also displays the live number of public screens connected
to that session. Its button uses a green connected treatment whenever at least
one SSE subscriber exists; the popover shows the exact connection count and
updates from the authenticated session stream whenever a public display
subscribes or disconnects; reconnect catch-up reads the owner-only counter once.
Each public browser tab counts as one screen. This counter comes from the
in-process SSE hub rather than the database, so it
reflects current connectivity and naturally resets during a server restart;
screens reconnect automatically and reappear in the counter.

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

`SessionMusicWorkspace.vue` is the central content of the `Музыка` tab; the
previous fullscreen library modal and the player-panel launch action do not
exist. Its nested tag and album dialogs use `AppModalFrame`. Album/track/tag CRUD uses shared
prompt/confirm dialogs; track ordering uses `useSortable`. Playback state
is synchronized through the session music endpoint, while track files and
signed URLs are served by `/api/music`.

The library contains albums, tags, queue/current track, volume, loop and
crossfade controls. File upload validation is part of the upload composable/API;
browser prompt/confirm is not used.

Every authenticated library also includes read-only system albums. Their tracks
can be played and queued in a session, but the UI and API reject renaming,
deletion, tagging, membership changes, and reordering. System album headers show
the source and CC0 metadata; system audio is served through signed S3 URLs.

## Data changes

Runtime accepts only current session/encounter JSON. If the encounter model
changes, add an idempotent correction to
`internal/store/schema/04_sessions.sql`, update all producers/consumers, then
remove the previous keys and any read-time converter.
