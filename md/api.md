# API Conventions

> **Порт на Go.** Бэкенд теперь на Go (`internal/web`), но контракт API идентичен прежней
> Spring-версии: те же роуты, camelCase-ключи JSON, коды ответов, тело ошибок `{"type":..,"desc":..}`,
> cookie-сессия (`sylvieshare-session-id`/`-uuid`). Фронт не менялся.

Use `shared/api/http.js` for low-level calls:

- `fetchGet(url)`
- `fetchPost(url, body)`
- `fetchPut(url, body)`
- `fetchPatch(url, body)`
- `fetchDelete(url)`

Prefer feature clients for new code:

- `shared/api/itemsApi.js`
- `shared/api/suggestApi.js`
- `shared/api/charactersApi.js`

Do not spread endpoint strings directly through components when adding new behavior. Add or reuse a feature API client.

## Suggest Routes

- `GET /api/suggest/{typeId}`
- `GET /api/suggest/{typeId}/items?ids=1,2,3` — fetch specific suggests by id ignoring the user-ownership filter. Used by `suggestStore.ensureItems(typeId, ids)` to resolve labels for custom suggests that belong to other users (e.g. an NPC item authored by another player references their custom `creature_type`).
- `POST /api/suggest/{typeId}`
- `PUT /api/suggest/{typeId}/{id}`
- `DELETE /api/suggest/{typeId}/{id}`
- `POST /api/suggest/{typeId}/{id}/make-base`

## Character Routes

- `GET /api/chars`, `POST /api/chars`, `GET /api/char/{uuid}`, `PUT /api/char/{uuid}/data`, `PUT /api/char/{uuid}/public`, `DELETE /api/char/{uuid}`, `POST /api/char/{uuid}/clone`, `POST /api/chars/poll` — standard CRUD and full-data save. `POST /api/chars` accepts `sourceVersionId` alongside `templateId` and `data`; old clients get the known D&D/VTM edition inferred from the template. Character list/detail objects expose `sourceVersionId`, `sourceId`, `sourceName`, and `sourceVersion`. `POST /api/chars` returns `{ uuid, charId }` (the numeric id lets the session add the new character via `/join`). `PUT /api/char/{uuid}/data` (full-data save) is authorized for the character owner OR the DM of a session containing this character (same `isCharInSessionOwnedBy` check as `data-patch`), so the DM can edit a participant's sheet from `CharacterSheetModal`.
- `PATCH /api/char/{uuid}/data-patch` — partial path-based update. Body: `{ updates: [{ path: "hp.current", value: 12 }, ...] }`. Each `path` is a dotted JSON path (e.g. `hp.current`). Applied via Postgres `jsonb_set` (creates missing intermediate objects). Increments `version` and `changed_at`. Authorized for: character owner, OR the DM of a session that contains this character (`session.owner_user_id == userId` and the char is in `session_participant`). Used by the encounter HP modal so the DM can edit player HP without owning the character. The poll loop (2s) picks up the version bump and refreshes participant data.

## Source Routes

- `GET /api/sources` — systems with their editions: `{ sources: [{ id, name, versions: [{ id, sourceId, version }], version?, countItems }] }`. The singular `version` is a compatibility alias for the first edition; new consumers use `versions`.
- `GET /api/content-sources?sourceVersionId=...` — publications compatible with a concrete rules edition. Each source includes its native edition, description, kind, default flag and effective `compatibilityStatus`. `sourceId=...` lists the whole publication catalogue for handbook editing.

## Item Object Routes

- `GET /api/item-types`
- `GET /api/items?typeId=...` — also accepts `contentSourceIds=1,2`, `sourceVersionId=...`, and `allowLegacy=true`; filtering happens before pagination.
- `GET /api/items/search?typeId=...&q=...` — accepts the same content-source scope.
- `GET /api/items/by-ids?ids=...`
- `POST /api/items` — accepts common item metadata `contentSourceIds`.
- `PUT /api/items/{id}` — accepts common item metadata `contentSourceIds`.
- `DELETE /api/items/{id}`
- `POST /api/items/{id}/make-base`

Item responses expose `contentSourceIds` plus compact `contentSources`. User-authored and not-yet-classified items remain visible in scoped lists; `by-ids` intentionally ignores the scope so existing character references always resolve.

## Page Error Report Routes

- `POST /api/error-reports` — public/optional-auth submit endpoint. Body: `{ description, pageUrl, element, screenshot?, viewportScreenshot?, title? }`; the current UI omits nullable `title`, which is filled later by the AI. `element` contains at least `selector` and can include the chosen screenshot context. A signed-in reporter is attached automatically; guests store `userId = null`.
- `GET /api/error-report-review/reports?limit=500` — `ERROR_REPORT_REVIEWER` or `ADMIN`; non-archived reviewer inbox.
- `GET /api/error-report-review/reports/{id}/screenshot` — `ERROR_REPORT_REVIEWER` or `ADMIN`; raw selected-element crop for a non-archived report.
- `GET /api/error-report-review/reports/{id}/viewport-screenshot` — `ERROR_REPORT_REVIEWER` or `ADMIN`; raw page-context screenshot for a non-archived report.
- `POST /api/error-report-review/reports/{id}/messages` — `ERROR_REPORT_REVIEWER` or `ADMIN`; answer a pending AI question.
- `POST /api/error-report-review/reports/{id}/archive` — `ERROR_REPORT_REVIEWER` or `ADMIN`; archive a finished report.
- `POST /api/error-report-review/reports/{id}/serious-approval` — `ADMIN` only; confirm a pending serious change.
- `GET /api/admin-panel/error-reports?limit=200&offset=0` — `ADMIN` list, newest first.
- `GET /api/admin-panel/error-reports/{id}/screenshot` — `ADMIN` raw selected-element crop.
- `GET /api/admin-panel/error-reports/{id}/viewport-screenshot` — `ADMIN` raw visible-page screenshot.
- `PATCH /api/admin-panel/error-reports/{id}/approval` — `ADMIN` sets `{ approved: boolean }`, controlling MCP visibility.
- `POST /api/admin-panel/error-reports/{id}/messages` — `ADMIN` answers the latest AI question with `{ message }`; the report becomes actionable through MCP again.
- `POST /api/admin-panel/error-reports/{id}/reopen` — `ADMIN` returns an archived report to the active queue and clears its resolution metadata.
- `DELETE /api/admin-panel/error-reports/{id}` — `ADMIN` permanently deletes one report and its conversation; normal MCP completion archives instead.

See `md/features/error-reports.md` for the selector payload and validation limits.

## Health Route

- `GET /api/health` — public readiness check. Returns `{ status, commitSha }`; HTTP 200 means the database is reachable and HTTP 503 means the instance is not ready. Production builds inject the deployed Git SHA into `commitSha`.

## MCP Endpoint (agent channel)

`POST /mcp` — embedded MCP server exposing handbook tools and page-error-report tools to AI agents. Bearer-token auth (not the user session cookies), write tools gated by a flag. Not for the Vue frontend. See `md/features/mcp.md`.
