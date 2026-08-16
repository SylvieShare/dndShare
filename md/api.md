# HTTP API

API реализован Go `net/http` в `internal/web`. Feature-файл регистрирует routes
через `registerRoutes`; список ниже описывает текущий публичный контракт.

## Common behavior

- JSON keys — camelCase.
- Ошибка — JSON `{ "type": "...", "desc": "..." }`.
- Session auth — cookies `sylvieshare-session-id` и
  `sylvieshare-session-uuid`.
- `shared/api/http.js` считает любой non-2xx ошибкой.
- Старые route aliases и DTO fields не поддерживаются.
- Health: `GET /api/health` возвращает status, DB state и build `commitSha`.

## Auth

- `POST /api/user/auth`
- `GET /api/user/checkAuth`
- `GET /api/user/logout`
- `POST /api/user/registration`

## Player account

- `PUT /api/account/password` принимает
  `{currentPassword,newPassword}`, проверяет текущий пароль и заменяет его
  PBKDF2-хэшем; ответ без тела — `204`.
- `GET /api/account/storage` возвращает личное использование пространства:
  `{usedBytes,fileCount,unknownFileCount,breakdown,files}`. Breakdown содержит
  `kind`, локализованную `label`, `bytes` и `count`; файл содержит
  `source,id,kind,name,fileSize?,mimeType?,url?,createdAt`.

Для старых S3-объектов без сохранённого размера endpoint выполняет `HEAD` с
ограниченным параллелизмом и записывает найденный byte-size в БД. Неизвестный
размер не считается нулевым и отдельно отражается в `unknownFileCount`.

## Characters and templates

- `GET /api/templates` → `{templates:[{id,name}]}`. Template schema/create
  form/path maps не возвращаются.
- `GET /api/chars` → `{chars,sessionsByChar}`.
- `POST /api/chars` принимает `{templateId,sourceVersionId,data}`.
  `sourceVersionId` обязателен и должен существовать.
- `POST /api/chars/poll`
- `GET /api/char/{uuid}` → template/source metadata, data, visibility,
  owner id и technical version. DB template JSON в ответ не включается.
- `GET /api/char/{uuid}/version`
- `GET /api/char/{uuid}/sessions`
- `PUT /api/char/{uuid}/data`
- `PATCH /api/char/{uuid}/data-patch`
- `PUT /api/char/{uuid}/public`
- `POST /api/char/{uuid}/clone`
- `DELETE /api/char/{uuid}`

Editor определяет schema по `templateName` через frontend setting registry.
`PUT /api/char/{uuid}/data` accepts `{data,events?}`. Each optional event has
`{sessionUuid,type,title,data,visibility,clientActionId}`; the character update
and authorized timeline inserts commit in one database transaction. For a
participant the route binds the actor to this owned session character; for a
DM editing a participant sheet it binds that character while retaining the DM
as the event author.

## Sources and handbook

- `GET /api/sources` → systems с `versions:[{id,sourceId,version}]`.
  Одинарного `source.version` нет.
- `GET /api/content-sources?sourceId=&sourceVersionId=`
- `GET /api/item-types`
- `GET /api/items`
- `GET /api/items/by-ids?ids=`
- `GET /api/items/children?parentId=`
- `GET /api/items/search`, `GET /api/items/search-multi`
- `POST /api/items`, `PUT /api/items/{id}`
- `POST /api/items/{id}/make-base`
- `POST /api/items/{id}/icon-image` (multipart PNG/WebP, максимум 5 МБ)
- `DELETE /api/items/{id}/icon`
- `DELETE /api/items/{id}`

Item DTO содержит `customSourceId` только у пользовательского контента. При
`POST /api/items` сервер в одной транзакции получает/создаёт default
`custom_item_source` владельца и записывает FK; клиент не передаёт ownership в
JSON `data`. `contentSourceIds` остаётся отдельной метаданной публикаций и не
заменяет персональный источник.

Все item reads по id/parent и suggest reads по ids возвращают только базовые
строки и строки текущего пользователя; анонимный и MCP catalogue read видит
только базовые. Update/delete владельца не может затронуть чужую строку,
HANDBOOK_ADMIN сохраняет явный административный доступ. Make-base очищает
персональную связь источника и систематизирует владельца растровой иконки.

Item reads проецируют иконку как `iconSvgId` + `svg` либо как `iconImageId` +
`iconImageUrl`. Upload атомарно регистрирует объект в `storage_image`, связывает
его с item и заменяет прежний формат; clear удаляет любую иконку. Системная
иконка имеет `storage_image.user_id = NULL`, пользовательская принадлежит
владельцу item.

Любая новая пользовательская загрузка сохраняет владельца, фактический размер,
исходное имя и MIME: это относится к общим изображениям/видео, item icon,
музыкальным трекам и SVG подсказок. Системные объекты остаются без владельца и
не включаются в статистику аккаунта.

Item list/search поддерживает publication scope через `contentSourceIds`,
`sourceVersionId` и `allowLegacy`. Здесь Legacy — статус контента конкретной
редакции правил, а не поддержка старого API/формата данных.

Suggest API:

- `GET /api/suggest/types`, `/search`, `/batch`;
- `GET /api/suggest/{typeId}` и `/{typeId}/items`;
- create/update/delete, make-base и SVG upload routes под
  `/api/suggest/{typeId}/...`.

Suggest identity в HTTP — пара `(typeId,id)`. Новые id (пользовательские и
базовые) выдаются общей DB sequence конкурентно-безопасно, поэтому новые
пользовательские ids не пересекаются между владельцами; существующие базовые
пары `(typeId,id)` не перенумеровываются.

## Sessions and scenes

- `GET|POST /api/sessions`, `GET|PATCH /api/sessions/{uuid}` and session delete;
- join/leave/kick participant. `POST /api/sessions/{uuid}/join` accepts
  `{charId,replaceExisting}`; without explicit replacement it returns `409` when
  the character belongs to another session, while confirmed replacement moves
  the character atomically;
- `PATCH /api/sessions/{uuid}/participants/{charId}/color` assigns or clears
  (`{"color":null}`) the participant's session-local `#RRGGBB` marker; owner-only;
- `PATCH /api/sessions/{uuid}/participants-order` accepts the complete ordered
  participant character-id list as `{"ids":[...]}`; owner-only;
- `GET /api/sessions/{uuid}/world` returns one aggregate
  `{locations,npcs,quests,scenes}`. Every entity exposes symmetric
  `relations:[{type,id,note}]`; types are `location`, `npc`, `material`, `quest`
  and `scene`. Compact scenarios also include their arc/chapter context. The
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
  `{name,raceItemId,role,description,color,imageId,
  imageFocalX,imageFocalY,relations}`. Each relation contains a target
  `type`, `id` and nullable note (up to 500 characters).
  `imageId` points either to the independent NPC system catalogue or to an
  uploaded image owned by the current user. `raceItemId`
  is nullable and must reference an accessible handbook race item (type `8`);
  aggregate NPC records also expose its current `raceName`. World mutations are
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
  /api/sessions/{uuid}/scenes/{sceneId}` accept a scenario card and universal
  `relations`; deleting a scenario clears those relations;
- `PATCH /api/sessions/{uuid}/current-chapter`;
- `PATCH /api/sessions/{uuid}/graph-nodes/positions` atomically persists a
  group movement as `{level,positions:[{id,x,y}]}`; `POST
  /api/sessions/{uuid}/graph-nodes/delete` atomically deletes selected nodes as
  `{level,ids}`. `level` is `chapters`, `scenes` or `blocks`; both owner-only
  operations accept at most 200 distinct nodes. Chapter deletion rejects the
  complete request if any selected chapter still has scenarios;
- `POST /api/sessions/{uuid}/chapter-edges` and `PATCH|DELETE
  /api/sessions/{uuid}/chapter-edges/{edgeId}`;
- read/write encounter and music state;
  authenticated music reads additionally include `syncedAt` and `serverTime`
  millisecond timestamps so a reloaded remote controller can restore its clock;
- `GET /api/sessions/{uuid}/materials` returns the owner-only material library.
  `POST /materials` and
  `PATCH|DELETE /materials/{materialId}` manage `{name,kind,caption,content,
  noteStyle,assetId,relations}`. Scenario relations restrict the material to
  those scenarios; without them it is available throughout the session. Other
  relation types provide navigation without restricting availability. `kind` is
  `image`, `video`, `text`, `note` or `map`; asset kinds require `assetId`,
  written kinds require `content`, and notes also require one of `parchment`,
  `letter`, `dossier` or `arcane`;
- `POST /api/storage/videos` accepts an authenticated multipart `file` up to
  100 MB, stores it in S3 and returns the same `{upload_id,url,key}` shape as
  image upload;
- `GET|PUT /api/sessions/{uuid}/presentation` reads or replaces the owner-only
  live player-display state
  `{mode,visible,materialId,broadcastMusic,effect,transition}`.
  Modes are `idle`, `material`, `combat`; effects are `none`, `rain`,
  `fog`, `embers`, `snow`, `storm`; transitions are `cut` or `fade`. An explicit
  `idle,visible:true` is the cleared dotted canvas, while `visible:false` is the
  intentional blackout;
- `GET /api/public/sessions/{uuid}/presentation` is the anonymous no-store safe
  projection used by `/screen/:uuid`; its material projection exposes only
  `{id,kind,name,caption,content,noteStyle,assetUrl}` required for playback;
- `GET /api/public/sessions/{uuid}/presentation/events` is the anonymous SSE
  invalidation stream. Events contain no session data: each `refresh` tells the
  display to reload its safe projections. Heartbeats prevent proxy buffering
  and idle disconnects;
- `GET /api/public/sessions/{uuid}/presentation/music` returns the no-store
  playback projection only while `broadcastMusic` is enabled: play/pause,
  current position, volume, crossfade, loop mode and short-lived signed current
  and queued track IDs/URLs. Personal tracks are checked against the session owner;
- `GET /api/public/sessions/{uuid}/encounter` is the anonymous, no-store TV
  projection of the current fight. It returns only the session name, round,
  current turn and initiative-ordered combatants with presentation fields,
  resolved conditions and a worded health band. It never returns character
  sheets, exact HP, AC, notes or encounter challenge results;
- `GET|POST /api/sessions/{uuid}/events` reads and appends the session timeline.
  The read endpoint accepts `after` and `limit`; the write endpoint accepts
  `{type,title,data,actorCharUuid?,visibility?,clientActionId?}`. The server
  derives the author from authentication, validates DM/participant access and
  resolves `actorCharUuid` to the participant whose page produced the action.
  Event responses expose `authorRole` and actor character projection fields;
  user login is not part of the timeline response. `clientActionId` makes
  retries idempotent. `entry_added` carries a typed `data.kind` (`item`,
  `potion`, `spell`, `feature` or `ability`) for additions to a character;
- `GET /api/sessions/{uuid}/chapters/{chapterId}/scene-graph` returns
  `{scenes,edges}`; scenario CRUD uses `POST .../chapters/{chapterId}/scenes`,
  `PATCH|DELETE .../scenes/{sceneId}` and `PATCH .../scenes/{sceneId}/position`.
  Create/update bodies contain `{name,status,imageId,relations}` (creation
  additionally accepts `x/y`), and every scenario response carries `imageId`, resolved
  `imageUrl` and optional `imageCatalogKey`;
- `POST /api/sessions/{uuid}/scene-edges` and
  `DELETE /api/sessions/{uuid}/scene-edges/{edgeId}` manage directed links
  inside one chapter;
- `GET /api/sessions/{uuid}/scenes/{sceneId}/block-graph` returns
  `{scene,items,edges}`. Blocks use `POST .../scenes/{sceneId}/items` and
  `PATCH|DELETE .../scenes/{sceneId}/items/{itemId}`. A block has `type`
  (`text`, `list`, `combat`, `reward`, `image` or `material`), `title`, type-specific `data`, `positionX/Y`
  and `width` (clamped to `220..640`); position and width are part of the item
  PATCH contract. Block color is derived by the client from `type` and is not
  an API field. Combat `data.creatures` contains quantity-bearing handbook
  references `{kind:"handbook",itemId,name,count}` or simplified records
  `{kind:"simple",id,name,ac,hp,hpMax,description,count}`. Reward
  `data.items` contains handbook references `{itemId,name,count}` to things,
  weapons and equipment;
  image and material blocks carry `materialId` and reference a material
  available in their session/chapter/scenario context. Image blocks accept
  only `image`/`map`; material blocks accept every material kind;
- `POST /api/sessions/{uuid}/block-edges` and
  `DELETE /api/sessions/{uuid}/block-edges/{edgeId}` manage directed links
  inside one scenario.

Arc, chapter and transition mutations are owner-only. Chapter `number` is a
string. A chapter mutation uses `{arcId,number,name,description,status,
imageId,imageFocalX,imageFocalY,positionX,positionY}`.
Scenario create/update mutations use `{name,status,imageId}` plus
creation coordinates; chapter and scenario status catalogues share canonical
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

Точные routes находятся в `internal/web/sessions.go`,
`internal/web/session_scenes.go`, `internal/web/session_scene_graph.go`,
`internal/web/session_world.go`, `internal/web/session_presentation.go` и
`internal/web/session_graph_bulk.go`; graph validation is in
`sessions_chapters.go` and `sessions_graph_actions.go`. Encounter принимает
только canonical combatants (`itemId` + `override` и уникальный
`markerLetter` для NPC); embedded item payload не является контрактом. Текущее
групповое испытание сохраняется в опциональном верхнеуровневом поле
`challenge: {ability,savingThrow,results}`, где результаты индексируются по UID
combatant и содержат `{roll,bonus,total,rolls?,dropped?,revision?}`. Опциональные
`rolls`/`dropped` описывают дополнительный d20, а `revision` нужна только для
повторной UI-анимации.

## Music and storage

`/api/music` возвращает личные и общие `isSystem` tracks/albums, предоставляет
CRUD tracks/albums/tags, track-to-album/tag links и album order только для
личных сущностей. Личное и системное аудио получает signed S3 playback URL.
Image upload: `POST
/api/storage/images`; item icons используют item-специфичный маршрут выше.
Video upload: `POST /api/storage/videos`. SVG read: `GET /api/svg/{id}`.
Uploads пишут byte-size, исходное имя, MIME и id владельца в соответствующий
registry; эти же metadata используются `GET /api/account/storage`.

## Admin and error reports

Admin routes находятся под `/api/admin-panel`: users/roles/passwords, logs,
stats, jobs и error reports. Reviewer routes находятся под
`/api/error-report-review`. Public authenticated report submission:
`POST /api/error-reports`.

Physical report deletion — только ADMIN HTTP endpoint. MCP lifecycle использует
resolve/archive, см. `md/features/mcp.md`.

## MCP

`POST /mcp` — bearer-authenticated JSON-RPC endpoint. Его tool contract описан
в `md/features/mcp.md`; он не имеет HTTP compatibility aliases.
