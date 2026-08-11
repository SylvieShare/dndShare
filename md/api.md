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
персональную связь источника.

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

- list/create/get/update/delete sessions;
- join/leave/kick participant;
- create/rename/select chapter;
- update status;
- read/write encounter and music state;
- CRUD scenes and scene items, including explicit items-order endpoint.

Точные routes находятся в `internal/web/sessions.go` и
`internal/web/session_scenes.go`. Encounter принимает только canonical
combatants (`itemId` + `override` для NPC); embedded item payload не является
контрактом.

## Music and storage

`/api/music` предоставляет CRUD tracks/albums/tags, track-to-album/tag links,
album order и signed playback URLs. Image upload: `POST
/api/storage/images`. SVG read: `GET /api/svg/{id}`.

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
