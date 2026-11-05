# Backend: правила реализации

Статус: обязательные правила для указанной области.

- `jsonb` записывается как `json.RawMessage` через `CAST($n AS jsonb)`; `uuid`
  читается как `col::text` и записывается как `$n::uuid`.
- Отсутствующая строка возвращается как `store.ErrNotFound`.
- Аутентификация использует cookie `sylvieshare-session-id` (`userId`) и
  `sylvieshare-session-uuid` (`uuid`), серверное состояние хранится в
  `users_session`; обе cookie и серверная сессия действуют 30 дней. Смена пароля
  отзывает прежние сессии, login и registration ограничены по частоте.
- Роли: `ADMIN`, `HANDBOOK_ADMIN`.
- Ошибка API имеет тело `{"type": ..., "desc": ...}`. Необработанная паника
  возвращает HTTP 500 и записывается в `logs`.
- API DTO используют camelCase. Nullable-поля задаются Go-указателями `*T` с
  `omitempty`; срезы, которые должны сериализоваться как `[]`, а не `null`,
  нормализуются через `nonNil`.
- Админ-джобы регистрируются в `internal/web/jobs.go` через `registerJob`,
  выполняются в goroutine с прогрессом и кооперативной отменой; реализации
  хендлеров разделены по `internal/web/jobs_handlers.go` и `job_*.go`.
- MCP `/mcp` использует JSON-RPC, bearer-токен `MCP_AUTH_TOKEN` и флаг записи
  `MCP_WRITE_ENABLED`; dispatch, schemas, аргументы и mutations разделены по
  `internal/web/mcp*.go`.

## Добавление HTTP routes

Каждый файл-фича регистрирует свои routes через `registerRoutes` в `init()`:

```go
func init() { registerRoutes((*Server).routesX) }

func (s *Server) routesX(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/...", s.handleX)
}
```

`server.go` для этого менять не нужно. В handlers используются
`mustUser(w, r)`, `optionalUser(r)` и `s.requireRole(w, r, RoleAdmin)`.
Ответы отправляются через `writeJSON`, `badRequest`, `notFound`, `conflict` и
`serverError`.

## Подключение и аутентификация

PostgreSQL используется через pgxpool; для транзакционного пулера включён
`simple protocol`. При изменении подключения сверить Store и deployment config.
Формат хэшей паролей неизменяем при рефакторинге; контракт — [авторизация](features/auth.md#формат-паролей).

## Схема и данные

Структурные миграции, принятие базы, checksum и операции с данными описаны в [контракте БД](database.md). Источники версий — [go.mod](../go.mod); runtime не зависит от прежней Kotlin/Spring-версии.

## Связанные страницы

[Оглавление wiki](README.md)
