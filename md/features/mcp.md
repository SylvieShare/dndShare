# MCP Server (handbook tools)

> **Порт на Go.** Реализация теперь в `internal/web/mcp.go` (JSON-RPC 2.0 поверх `POST /mcp`,
> bearer-токен `MCP_AUTH_TOKEN`, флаг записи `MCP_WRITE_ENABLED`). Набор инструментов и их контракт
> идентичны прежней Spring-AI версии, описанной ниже.

The backend embeds an MCP (Model Context Protocol) server so an AI agent can read and edit handbook data (items and suggests) directly. It is a thin wrapper over the existing repositories — there is no separate process and no separate deploy; it ships inside the Go backend.

## Stack

- Spring AI `spring-ai-starter-mcp-server-webmvc`, version pinned by the `spring-ai-bom` (`spring-ai.version` property in `backend/pom.xml`). Requires Spring Boot 4.x.
- Transport: **Streamable HTTP**, exposed at **`POST/GET /mcp`** (Spring AI default).
- Config in `application.yml` under `spring.ai.mcp.server` (`protocol: STREAMABLE`, `type: SYNC`).

## Tools

Defined in `backend/.../mcp/HandbookMcpTools.kt` as a `@Component` whose methods are annotated `@McpTool` (params `@McpToolParam`). Spring Boot auto-detects and registers them — no provider bean needed. Each tool calls a repository directly.

Read tools (always on):
- `handbook_sources` — list sources.
- `handbook_item_types(sourceId?)` — item types; the `fields` array is the **schema** for an item's `data`. Read this before creating/updating items.
- `handbook_items(typeId, limit?, offset?)` — base items of a type.
- `handbook_items_search(typeId, q, limit?)` — base items by name.
- `handbook_items_get(ids)` — items by id (any owner).
- `handbook_suggest_types(sourceId?)` — suggest types.
- `handbook_suggests(typeId)` — base suggests of a type.
- `handbook_suggests_search(q, limit?)` — base suggests by value.

Write tools (gated, see below):
- `handbook_item_create(typeId, name, nameEn, data, parentId?)` — `data` is a JSON object string; creates a **base** item (`user_id = NULL`) via `ItemRepository.createBase`. `parentId` links a variant/sub-entity (subrace → race item, subclass → class item).
- `handbook_item_update(id, name, nameEn?, data, parentId?)` — admin update by id. `parentId`: set to relink, `-1` to clear, omit to leave the link unchanged.
- `handbook_item_delete(id)` — admin delete by id.
- `handbook_suggest_create(typeId, value, code?, color?, desc?)` — base suggest via `SuggestRepository.addBase`.
- `handbook_suggest_update(typeId, id, value, code?, color?, desc?)` — admin update; preserves existing svg.
- `handbook_suggest_set_svg(typeId, id, svg)` — admin set/replace the suggest icon. `svg` is raw `<svg>` markup (empty string clears it); stores it in `svg_storage`, repoints `suggest.svg_id`, deletes the old svg row. Validates `<svg>` presence and 512 KB max.
- `handbook_suggest_delete(typeId, id)` — admin delete.

Writes run as a synthetic `HANDBOOK_ADMIN` (repositories called with `isAdmin = true`, `userId = 0`). Creates always produce **base** records (`user_id = NULL`).

## Auth

The `/mcp` endpoint is a machine channel, not a user session — it does **not** use the `sylvieshare-session-*` cookies. `mcp/McpAuthInterceptor.kt` checks `Authorization: Bearer <token>` (constant-time) against `mcp.auth.token`, registered for `/mcp` + `/mcp/**` in `base/resolvers/MvcConfig.addInterceptors`. Missing/wrong token → 401.

Config (`application.yml`):
- `mcp.auth.token` — `${MCP_AUTH_TOKEN:...}`. In prod set `MCP_AUTH_TOKEN` to a long random secret via env (same pattern as the storage keys).
- `mcp.write.enabled` — `${MCP_WRITE_ENABLED:false}`. Write tools throw unless this is `true`. Keep it off until reads are verified; enable per-deploy.

## Connecting

`claude mcp add --transport http dndshare https://<host>/mcp --header "Authorization: Bearer <token>"`

Works from Claude Code, Claude Desktop, and Claude.ai (web), since the transport is HTTP.

## Adding a tool

Add a method to `HandbookMcpTools` annotated `@McpTool(name, description)`, annotate each param with `@McpToolParam(description, required)`, and call the relevant repository. Gate any new write tool behind `requireWrite()`. No registration wiring is needed.
