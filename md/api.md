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
- join/leave/kick participant and update session status;
- `PATCH /api/sessions/{uuid}/participants/{charId}/color` assigns or clears
  (`{"color":null}`) the participant's session-local `#RRGGBB` marker; owner-only;
- `GET /api/sessions/{uuid}/chapter-graph` returns `{arcs,chapters,edges}`;
- `POST /api/sessions/{uuid}/arcs`, `PATCH|DELETE
  /api/sessions/{uuid}/arcs/{arcId}` and `PATCH
  /api/sessions/{uuid}/arcs-order`;
- `GET|POST /api/sessions/{uuid}/chapters`, `PATCH|DELETE
  /api/sessions/{uuid}/chapters/{chapterId}`, plus `/position` and `/arc`
  PATCH actions;
- `PATCH /api/sessions/{uuid}/current-chapter`;
- `POST /api/sessions/{uuid}/chapter-edges` and `PATCH|DELETE
  /api/sessions/{uuid}/chapter-edges/{edgeId}`;
- read/write encounter and music state;
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
  `PATCH|DELETE .../scenes/{sceneId}` and `PATCH .../scenes/{sceneId}/position`;
- `POST /api/sessions/{uuid}/scene-edges` and
  `DELETE /api/sessions/{uuid}/scene-edges/{edgeId}` manage directed links
  inside one chapter;
- `GET /api/sessions/{uuid}/scenes/{sceneId}/block-graph` returns
  `{scene,items,edges}`. Blocks use `POST .../scenes/{sceneId}/items` and
  `PATCH|DELETE .../scenes/{sceneId}/items/{itemId}`; position is part of the
  item PATCH contract;
- `POST /api/sessions/{uuid}/block-edges` and
  `DELETE /api/sessions/{uuid}/block-edges/{edgeId}` manage directed links
  inside one scenario.

Arc, chapter and transition mutations are owner-only. Chapter `number` is a
string. A chapter mutation uses `{arcId,number,name,description,status,
imagePresetKey,customImageId,imageFocalX,imageFocalY,positionX,positionY}`.
Every chapter returned by graph/chapter reads also has the derived integer
`sceneCount`; it is not accepted as mutation input.
Chapter transitions use `{arcId,fromChapterId,toChapterId,label}`, scenario
transitions use `{chapterId,fromSceneId,toSceneId,label}`, and block transitions
use `{sceneId,fromItemId,toItemId,label}`. Each transition may only connect
nodes of one parent canvas. Reordering arcs accepts `{ids:[...]}` containing
every arc exactly once; response order becomes the new automatic numbering.

Точные routes находятся в `internal/web/sessions.go` и
`internal/web/session_scenes.go` and `internal/web/session_scene_graph.go`;
graph validation is in
`sessions_chapters.go` and `sessions_graph_actions.go`. Encounter принимает
только canonical combatants (`itemId` + `override` и уникальный
`markerLetter` для NPC); embedded item payload не является контрактом. Текущее
групповое испытание сохраняется в опциональном верхнеуровневом поле
`challenge: {ability,savingThrow,results}`, где результаты индексируются по UID
combatant и содержат `{roll,bonus,total,rolls?,dropped?,revision?}`. Опциональные
`rolls`/`dropped` описывают дополнительный d20, а `revision` нужна только для
повторной UI-анимации.

## Music and storage

`/api/music` предоставляет CRUD tracks/albums/tags, track-to-album/tag links,
album order и signed playback URLs. Image upload: `POST
/api/storage/images`; item icons используют item-специфичный маршрут выше.
SVG read: `GET /api/svg/{id}`.

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
