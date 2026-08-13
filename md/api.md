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
- CRUD scenes and scene items, including explicit items-order endpoint.

Arc, chapter and transition mutations are owner-only. Chapter `number` is a
string. A chapter mutation uses `{arcId,number,name,description,status,
imagePresetKey,customImageId,imageFocalX,imageFocalY,positionX,positionY}`.
Every chapter returned by graph/chapter reads also has the derived integer
`sceneCount`; it is not accepted as mutation input.
Transitions use `{arcId,fromChapterId,toChapterId,label}` and may only connect
chapters from the same arc. Reordering arcs accepts `{ids:[...]}` containing
every arc exactly once; response order becomes the new automatic numbering.

Точные routes находятся в `internal/web/sessions.go` и
`internal/web/session_scenes.go`; graph validation is in
`sessions_chapters.go` and `sessions_graph_actions.go`. Encounter принимает
только canonical combatants (`itemId` + `override` для NPC); embedded item
payload не является контрактом.

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
