# API: сессии и сцены

Основной контракт сессии, сущности сюжета, публичный экран и настройки видимости.

← [HTTP API](../api.md)

## Содержание

- [Сессии и сцены](#сессии-и-сцены)
- [Контекст событий хроники](#контекст-событий-хроники)
- [Настройки видимости в сессии](#настройки-видимости-в-сессии)

## Сессии и сцены

- `GET|POST /api/sessions`, `GET|PATCH /api/sessions/{uuid}` and session delete;
- join/leave/kick participant. `POST /api/sessions/{uuid}/join` accepts
  `{charId,replaceExisting}`; without explicit replacement it returns `409` when
  the character belongs to another session, while confirmed replacement moves
  the character atomically;
- `GET /api/sessions/{uuid}` is available to the DM and attached participants.
  It returns `myRole`, optional `myCharUuid`, the current chapter and participant
  snapshots with `publicVisible` plus a technical `version` next to each character
  payload. `GET /api/sessions/{uuid}/live` is
  the authenticated SSE invalidation stream shared by the session page. Its
  coalesced `update` events contain only changed domains:
  `{session?,participants?,characterIds?,journal?,connectedScreens?}`. Mutations remain
  ordinary REST requests, and clients reload the corresponding authoritative
  projections. Every reconnect performs a catch-up read because the in-process
  stream deliberately keeps no durable event backlog. DM access is permanent;
  participant access is revalidated after membership changes and on heartbeat;
- Session DTOs in list/detail responses include `status`: `active`, `stopped` or
  `completed`. New sessions default to `stopped`.
- `PATCH /api/sessions/{uuid}/status` accepts `{status}` and returns 204;
  owner-only, unknown values return 400. It updates only lifecycle status and
  `changed_at`, then publishes session overview invalidation through SSE.
- `PATCH /api/sessions/{uuid}/participants/{charId}/color` assigns or clears
  (`{"color":null}`) the participant's session-local `#RRGGBB` marker; owner-only;
- `PATCH /api/sessions/{uuid}/participants-order` accepts the complete ordered
  participant character-id list as `{"ids":[...]}`; owner-only;
- `GET /api/sessions/{uuid}/world` returns one aggregate
  `{locations,npcs,quests,scenes}`. Locations, NPCs and quests expose symmetric
  `relations:[{type,id,note}]`; relation types are `location`, `npc`, `material`
  and `quest`. They also expose derived
  `scenarioUsages:[{sceneId,blockCount}]`, aggregated from actual canvas blocks.
  Compact scenarios include their arc/chapter context and are not relation
  targets. The
  aggregate is owner-only because descriptions and relation notes may contain
  master secrets;
- `POST /api/sessions/{uuid}/locations`, `PATCH|DELETE
  /api/sessions/{uuid}/locations/{locationId}` create, replace or remove a
  location. The full mutation payload contains
  `{parentLocationId,name,kind,description,imageId,relations}`;
- `PATCH /api/sessions/{uuid}/locations/{locationId}/move` accepts
  `{parentLocationId,beforeLocationId}`. A null `beforeLocationId` appends to
  the target sibling group; invalid cross-session references and descendant
  cycles are rejected;
- `POST /api/sessions/{uuid}/npcs`, `PATCH|DELETE
  /api/sessions/{uuid}/npcs/{npcId}` manage prepared NPCs with
  `{name,raceItemId,bestiaryItemId,role,description,color,imageId,
  imageFocalX,imageFocalY,relations}`. Each relation contains a target
  `type`, `id` and nullable note (up to 500 characters).
  `imageId` points either to the independent NPC system catalogue or to an
  uploaded image owned by the current user. `raceItemId`
  is nullable and must reference an accessible handbook race item (type `8`).
  `bestiaryItemId` is nullable and must reference an accessible bestiary creature
  (type `6`); aggregate NPC records expose the current `raceName` and
  `bestiaryItemName`. World mutations are
  owner-only and return `{world,id}` so clients can replace every reverse
  association together;
- `POST /api/sessions/{uuid}/quests`, `PATCH|DELETE
  /api/sessions/{uuid}/quests/{questId}` manage quests with
  `{name,status,goal,condition,reward,consequences,notes,relations}`. The five
  quest detail fields are independent nullable strings up to 5000 characters.
  Status is `planned`, `active`, `completed` or `failed`; mutations return the
  refreshed world aggregate;
- `GET /api/sessions/{uuid}/chapter-graph` returns `{arcs,chapters,edges}`;
- `GET /api/session-images?scope=story|npc` returns the authorized system image
  catalogue as `{images:[{id,key,scope,categoryKey,categoryLabel,label,sortOrder,url}]}`;
- `POST /api/sessions/{uuid}/arcs`, `PATCH|DELETE
  /api/sessions/{uuid}/arcs/{arcId}` and `PATCH
  /api/sessions/{uuid}/arcs-order`;
- `GET|POST /api/sessions/{uuid}/chapters`, `PATCH|DELETE
  /api/sessions/{uuid}/chapters/{chapterId}`, plus `/position` and `/arc`
  PATCH actions;
- `POST /api/sessions/{uuid}/chapters/{chapterId}/scenes` and `PATCH
  /api/sessions/{uuid}/scenes/{sceneId}` accept a scenario card. Scenarios do
  not accept or return universal relations. Their nullable `locationId` is a
  direct link to one location from the same session;
- `PATCH /api/sessions/{uuid}/current-chapter`;
- `PATCH /api/sessions/{uuid}/graph-nodes/positions` atomically persists a
  group movement as `{level,positions:[{id,x,y}]}`; `POST
  /api/sessions/{uuid}/graph-nodes/delete` atomically deletes selected nodes as
  `{level,ids}`. `level` is `chapters`, `scenes` or `blocks`; both owner-only
  operations accept at most 200 distinct nodes. Chapter deletion rejects the
  complete request if any selected chapter still has scenarios;
- `POST /api/sessions/{uuid}/chapter-edges` and `PATCH|DELETE
  /api/sessions/{uuid}/chapter-edges/{edgeId}` use the complete edge payload
  `{arcId,fromChapterId,toChapterId,label,bidirectional}`;
- read/write encounter and music state;
  authenticated music reads additionally include `syncedAt` and `serverTime`
  millisecond timestamps so a reloaded remote controller can restore its clock;
- `GET /api/sessions/{uuid}/materials` returns the owner-only material library.
  `POST /materials` and
  `PATCH|DELETE /materials/{materialId}` manage `{name,kind,caption,content,
  noteStyle,assetId,relations}`. Every response also contains derived
  `scenarioUsages:[{sceneId,blockCount}]`. All materials are available in every
  scenario; relations provide navigation between reusable entities and never
  restrict availability. `kind` is
  `image`, `video`, `text`, `note` or `map`; asset kinds require `assetId`,
  written kinds require `content`, and notes also require one of `parchment`,
  `letter`, `dossier` or `arcane`;
- `POST /api/storage/videos` accepts an authenticated multipart `file` up to
  100 MB, stores it in S3 and returns the same `{upload_id,url,key}` shape as
  image upload. Upload bodies are spooled to bounded temporary files rather than
  copied into the Go heap; at most three S3 uploads execute concurrently;
- `GET|POST /api/sessions/{uuid}/timers` lists owner-only session timers or
  starts one from `{description,durationMs,broadcast}`. Every list response includes
  `serverTime`; timer projections contain `{id,description,durationMs,
  remainingMs,endsAt?,paused,broadcast,completed}`. `PATCH
  /api/sessions/{uuid}/timers/{timerId}` accepts `{action:"pause"|"resume"}`
  or `{action:"add",amountMs}`; `DELETE` on the same route removes a timer.
  Only timers created with `broadcast:true` are included in the anonymous
  player-screen projection;
- `GET|PUT /api/sessions/{uuid}/presentation` reads or replaces the owner-only
  live player-display state
  `{mode,visible,materialId,broadcastMusic,showHealth,healthDisplay,
  showGraveyard,displayScale,effect,transition}`. `healthDisplay` is `numbers`
  or `words`; `displayScale` is an integer percentage from 75 through 125.
  Modes are `idle`, `material`, `combat`; effects are `none`, `rain`,
  `fog`, `embers`, `snow`, `storm`; transitions are `cut` or `fade`. An explicit
  `idle,visible:true` is the cleared dotted canvas, while `visible:false` is the
  intentional blackout.
  The GET and PUT responses also include the permanent `displayCode` for the
  standalone display link.
- `GET /api/sessions/{uuid}/presentation-connections` is an owner-only,
  no-store runtime counter `{connectedScreens}` of active public SSE display
  subscriptions. It is deliberately not persisted in the database;
- `GET /api/public/sessions/{code}/presentation` is the anonymous no-store safe
  projection used by `/screen/:code`; `code` is the session's unique
  case-insensitive `ABC-123` display code (ASCII letters/digits). Its material
  projection exposes only
  `{id,kind,name,caption,content,noteStyle,assetUrl}` required for playback. It
  also returns the combat display settings, `serverTime` and only the timers
  whose individual `broadcast` flag is enabled;
- `GET /api/public/sessions/{code}/presentation/events` is the anonymous SSE
  invalidation stream. Events contain no session data: each `refresh` tells the
  display to reload its safe projections. Heartbeats prevent proxy buffering
  and idle disconnects;
- `GET /api/public/sessions/{code}/presentation/music` returns the no-store
  playback projection only while `broadcastMusic` is enabled: play/pause,
  current position, volume, crossfade, loop mode and short-lived signed current
  and queued track IDs/URLs. Personal tracks are checked against the session owner;
- `GET /api/public/sessions/{code}/encounter` is the anonymous, no-store TV
  projection of the current fight. It returns only the session name, round,
  current turn and server-ordered combatants with presentation fields,
  resolved conditions with their display `color` and optional `svg` icon, and a
  worded health band. When enabled by the presentation
  state in `numbers` mode, health also contains `current/maximum`; `graveyard`
  contains dead NPC
  groups by bestiary type. Bestiary combatants also expose `coverImageUrl` for
  the current-turn artwork. Player combatants expose the small character
  `iconImageUrl` separately from the sheet portrait `avatarUrl`, so the queue
  and active-turn card can choose the intended asset independently. Initiative values, character sheets, AC, notes and
  encounter challenge results are never returned;
- `GET|POST /api/sessions/{uuid}/events` reads and appends the session timeline.
  The read endpoint accepts `after` and `limit`. Both `events` and `updates`
  return all records to the session owner; other participants receive only
  item transfers directed to characters they own and their own messages/challenges, regardless of `visibility`.
  The write endpoint accepts
  `{type,action,data,actorCharUuid?,actorItemId?,actorName?,visibility?,clientActionId?}`. The server
  derives the author from authentication, validates DM/participant access and
  resolves `actorCharUuid` to the participant whose page produced the action.
  A linked character's `actorName` is derived and snapshotted server-side;
  only the DM may supply a standalone creature name or an accessible bestiary
  `actorItemId` without a character UUID. Character and item actors are mutually exclusive.
  Event responses expose separate `actorName`, `action`, the required boolean
  `authorIsSessionOwner`, actor character projection fields and resolved
  `actorImageUrl` / `actorSvg` artwork when available;
  `authorName` contains the author login. `sessionOwnerUserId` and optional
  `recipientUserId` are derived from session/transfer/interaction relations and support
  notification filtering; the client never treats payload fields as recipients. `clientActionId` makes
  retries idempotent. `entry_added` carries a typed `data.kind` (`item`,
  `potion`, `spell`, `feature` or `ability`) for additions to a character.
  `item_removed` records manual removal of one item or an entire stack;
  `data` stores `source` (item ID when
  available, name and instance UID), `itemId`, removed `count` and `remaining`.
  Deleting a nonempty section creates one event with `data.sectionName` and
  `data.removedEntries`, an array of those item snapshots including equipped items.
  These events commit atomically with the character data and do not apply item effects.
  `hp_changed` records damage/healing from the character HP calculator: `data`
  contains `kind` (`damage` or `heal`), requested `amount`, actual `applied`,
  temporary-HP `absorbed`, and `before`/`after` snapshots with `current`, `temp`
  and resolved `max`. It also commits atomically with the sheet save;
- `GET /api/sessions/{uuid}/occurrences` returns `{occurrences:[]}` for the DM
  and current participants. A meeting contains `{id,number,name,date?,sectionId,
  entryCount,changedAt}`. Dates are calendar-only `YYYY-MM-DD`; undated meetings
  originate from migrated free-text diary dates. `POST /occurrences` and
  `PATCH|DELETE /occurrences/{occurrenceId}` are DM-only. Creation requires
  `{number,name,date}` (number 1…1000000, nonblank name up to 160 Unicode characters,
  valid date). PATCH also requires `expectedChangedAt`; stale changes and duplicate
  numbers return 409. Creation atomically creates the campaign diary if needed
  and a linked section; deletion cascades only to that meeting's section and entries.
  Mutation responses return the complete `{occurrences:[]}` list.
- `GET|POST /api/sessions/{uuid}/journal` reads the shared campaign journal or
  creates it (creation is DM-only). `POST
  /api/sessions/{uuid}/journal/scenario-items/{itemId}` is also DM-only and
  requires `{occurrenceId}` and appends a typed entry to that meeting's section
  with an immutable block/scene snapshot. A missing or foreign meeting returns 400;
- `GET /api/journals/{journalUuid}` and the nested `POST|PATCH|DELETE` routes
  under `/sections`, `/sections/{sectionId}/entries` and `/entries/{entryId}`
  provide the common journal CRUD contract. A personal journal is writable by
  its owner; a session journal is writable by the DM and, when `playersCanEdit`
  is enabled, current participants. Responses include `canEdit` and `canManage`.
  Section creation, PATCH and DELETE are personal-only; campaign sections are
  managed through meetings (direct section mutations return 409).
  Campaign sections include `occurrenceId` and `number`; `title`, `date` and
  section `changedAt` come from the meeting, rather than duplicate metadata.
  Existing entry types cannot be changed (HTTP 400). Entry PATCH requires
  `expectedChangedAt` from the loaded entry. A stale timestamp returns HTTP 409
  without modifying the entry, its authorship or content; omission returns 400;
- Journal type `quest` stores `payload.quest: {reward, objectives: [{id, text, done}]}`.
  Up to 100 objectives are accepted; IDs must be nonempty and unique (up to
  100 bytes), text nonblank and up to 500 Unicode characters, reward up to
  2000 characters. Checklist edits use the same permissions, audit and
  `expectedChangedAt` conflict protection as other entries. Completion is derived
  from all objectives being checked (an empty checklist is not complete).
- Journal type `header` is a title-only separator in the UI. Like all existing
  entries its type is immutable, and whole-entry edits require `expectedChangedAt`.
- `PATCH /api/journals/{journalUuid}/settings` accepts `{playersCanEdit: boolean}`
  and is restricted to the campaign owner. Other users receive HTTP 403;
- Journal responses include `graph: {revision,nodes,links}`. Nodes contain
  `{id,positionX,positionY}`, links `{fromId,toId,label}`. Sections, entries and
  graph are read from one repeatable-read snapshot.
- `PUT /api/journals/{journalUuid}/sections/{sectionId}/entries/order` accepts
  `{entryIds,expectedEntryIds}`, both complete chronological ID arrays (up to
  5,000 entries). The server locks the journal first, checks editing permission
  and the section's current order, then updates positions atomically. Stale order,
  missing, duplicate or foreign entries return 409. Content, audit and stored
  graph remain unchanged. The UI displays the reverse order (newest first).
  The journal UI is a vertical timeline; graph data and endpoints remain stored
  independently and are not used to render or edit the timeline.
- `PUT /api/journals/{journalUuid}/graph` accepts
  `{expectedRevision, links?, positions?}`. `links`, when supplied, is the complete
  proposed set for this journal (including other sections); `positions` updates
  only supplied node IDs. Omitted fields remain unchanged. Limits: 20,000 links,
  5,000 positions, coordinates within ±1,000,000, labels up to 240 characters.
  Mutations lock the journal and check its revision and editing permissions.
  Stale revision returns 409; cycles, duplicate/foreign links and invalid
  coordinates return 400; read-only participants receive 403. Content and entry
  audit timestamps are not changed by arranging nodes or connecting events.
- Entry POST requires `expectedGraphRevision`, optionally `parentIds` and
  `graphPosition: {positionX,positionY}`. Creation and connections are atomic.
  Explicit `parentIds: []` creates a separate root; multiple parents create a
  merge. Omission appends to the section's sole terminal event, or creates a
  separate root if there is no unambiguous continuation. Scenario imports use
  the same terminal-event rule. Deleting an event/section removes incident links,
  preserves other events and does not automatically reconnect branches;
- `GET /api/sessions/{uuid}/chapters/{chapterId}/scene-graph` returns
  `{scenes,edges}`; scenario CRUD uses `POST .../chapters/{chapterId}/scenes`,
  `PATCH|DELETE .../scenes/{sceneId}` and `PATCH .../scenes/{sceneId}/position`.
  Create/update bodies contain `{name,status,locationId,imageId}` (creation
  additionally accepts `x/y`). `locationId` and `imageId` are nullable, but at
  least one must be set. Every scenario response carries both source ids,
  resolved `imageUrl` and optional `imageCatalogKey`: an explicit scenario
  image wins, otherwise the location image is returned;
- `POST /api/sessions/{uuid}/scene-edges` and
  `PATCH|DELETE /api/sessions/{uuid}/scene-edges/{edgeId}` manage links inside
  one chapter. PATCH accepts the complete mutable edge
  `{fromSceneId,toSceneId,label,bidirectional}` so either endpoint can move;
- `GET /api/sessions/{uuid}/scenes/{sceneId}/block-graph` returns
  `{scene,items,edges}`. Blocks use `POST .../scenes/{sceneId}/items` and
  `PATCH|DELETE .../scenes/{sceneId}/items/{itemId}`. A block has `type`
  (`text`, `list`, `combat`, `reward`, `image`, `material`, `location`, `npc` or `quest`), `title`, type-specific `data`, `positionX/Y`
  and `width` (clamped to `220..640`); position and width are part of the item
  PATCH contract. Block color is derived by the client from `type` and is not
  an API field. Combat `data.creatures` contains quantity-bearing handbook
  references `{kind:"handbook",itemId,name,count}` or simplified records
  `{kind:"simple",id,name,ac,hp,hpMax,description,count}`. Reward
  `data.items` contains handbook references `{itemId,name,count}` to things,
  weapons and equipment;
  image and material blocks carry `materialId` and reference any material
  from the same session. Image blocks accept
  only `image`/`map`; material blocks accept every material kind;
- `POST /api/sessions/{uuid}/block-edges` and
  `PATCH|DELETE /api/sessions/{uuid}/block-edges/{edgeId}` manage links inside
  one scenario. PATCH accepts
  `{fromItemId,toItemId,label,bidirectional}`.

Arc, chapter and transition mutations are owner-only. Chapter `number` is a
string. A chapter mutation uses `{arcId,number,name,description,status,
imageId,imageFocalX,imageFocalY,positionX,positionY}`.
Scenario create/update mutations use `{name,status,locationId,imageId}` plus
creation coordinates. The location must belong to the same session; a nullable
scenario image inherits the linked location image. Chapter and scenario status catalogues share canonical
keys and default to `none` (`Без статуса`).
Every chapter returned by graph/chapter reads also has the derived integer
`sceneCount`; it is not accepted as mutation input.
Bulk graph mutations use `PATCH .../graph-nodes/positions` with
`{level,positions:[{id,x,y}]}`, `POST .../graph-nodes/delete` with `{level,ids}`
and `PATCH .../graph-nodes/status` with `{level:"chapters"|"scenes",ids,status}`. Each
request accepts at most 200 distinct positive node IDs and validates ownership
as one operation; bulk status values are the same canonical narrative statuses as
single-node mutations.
Chapter transitions use `{arcId,fromChapterId,toChapterId,label}`, scenario
transitions use `{chapterId,fromSceneId,toSceneId,label}`, and block transitions
use `{sceneId,fromItemId,toItemId,label}`. Each transition may only connect
nodes of one parent canvas. Reordering arcs accepts `{ids:[...]}` containing
every arc exactly once; response order becomes the new automatic numbering.

Timer countdowns can be shortened through
`PATCH /api/sessions/{uuid}/timers/{timerId}/subtract` with `{amountMs}`; the
server clamps the remaining duration at zero.

Точные routes находятся в `internal/web/sessions.go`,
`internal/web/session_scenes.go`, `internal/web/session_scene_graph.go`,
`internal/web/session_world.go`, `internal/web/session_presentation.go`,
`internal/web/session_timers.go` и
`internal/web/session_graph_bulk.go`; graph validation is in
`sessions_chapters.go` and `sessions_graph_actions.go`. Encounter принимает
только canonical combatants (`itemId` + `override` и уникальный
`markerLetter` для NPC); embedded item payload не является контрактом. Текущее
групповое испытание сохраняется в опциональном верхнеуровневом поле
`challenge: {ability,savingThrow,results}`, где результаты индексируются по UID
combatant и содержат `{roll,bonus,total,rolls?,dropped?,revision?}`. Опциональные
`rolls`/`dropped` описывают дополнительный d20, а `revision` нужна только для
повторной UI-анимации.

## Контекст событий хроники

События сессии возвращают `authorUserId`, `authorName` (логин) и вычисляемый
`authorIsSessionOwner`. Если при записи указан `clientActionId`, чтение и
создание события возвращают его: клиент связывает SSE с уже показанным локальным
броском и не показывает дублирующее уведомление. Семантический JSON `data` может содержать `source`
(`itemId`, снимок `name`, необязательный `instanceUid`), `ability`
(`id`, `typeId`, `name`) и `resourceChanges` (массив: `key`, `name`, `delta`,
`color`, `remaining`, `total`, для магии `level`/`pool`). Отрицательный `delta`
означает расход, положительный — восстановление. `spell_slot_changed` пишет
ручные изменения и восстановление после отдыха; оплаченный `spell_used`
содержит изменение ячейки в собственной записи. `feature_action_effect`
принимает последствия зависимых действий способностей. События, меняющие
лист, сохраняются атомарно с его данными через очередь `sessionEvents`.

## Настройки видимости в сессии

`PATCH /api/sessions/{uuid}/settings` (только мастер) принимает `{key, value}`.
Ключи: `players.seeClass`, `players.seeRace`, `players.seeHp`, `players.openSheets`, `combat.autoRollNpcHp`;
`value` — обязательный boolean. Успех — 204 и SSE `session`. Значения возвращаются
в структурированном `session.settings`: разделы `players` и `combat`.
Обновляется только выбранный путь JSON; остальные поля сохраняются. Ответ сессии содержит `participants[].canOpenSheet`; чужие
данные игроков ограничены разрешёнными полями состава группы. `/chars/poll`
не предоставляет доступ к приватному листу на основании участия в одной группе.
Подробнее: [настройки сессии](../features/sessions/display.md#настройки-видимости-игроков).

## Связанные страницы

[Оглавление wiki](../README.md) · [HTTP API](../api.md) · [Игровые сессии](../features/sessions.md) · [БД: сессии и игровые события](../database/sessions.md)
