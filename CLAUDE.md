# dndShare (Go)

D&D-мастерская: менеджер листов персонажей, справочник, сессии, музыка.
**Go-бэкенд (один статический бинарь с вшитым фронтом) + Vue 3 (фронт)**, Postgres, S3.
Порт прежней Kotlin/Spring-версии (`../dndShare-kotlin`, заморожена как архив). API байт-в-байт совместим —
фронт не менялся.

## Документация
- `md/` — вики проекта (в основном про фронт: `frontend.md`, `css-variables.md`, фичи в
  `md/features/*`). Держать в актуальном виде при изменениях архитектуры/поведения/API.
- `md/api.md`, `md/database.md`, `md/deploy.md` — описывают контракт API, схему БД и деплой.
  Раздел бэкенда теперь про Go (см. ниже), но контракт (роуты, ключи JSON) не изменился.

## Стек бэкенда (Go, `internal/`)
- stdlib `net/http` + `ServeMux` с method/pattern-роутингом (Go 1.22+), без веб-фреймворка.
- Postgres через **pgx** (`pgxpool`, simple-протокол — под пулер YC :6432).
- S3-совместимое хранилище (Yandex Object Storage) через **aws-sdk-go-v2** (порт ObjectStorageService).
- Пароли — собственный формат `$31$` поверх **PBKDF2WithHmacSHA1** (порт PassCryptService,
  совместим с уже существующими хэшами — параметры не менять).
- Фронт вшивается в бинарь (`go:embed all:dist` в `internal/assets`).

## Раскладка
```
main.go                     запуск, graceful shutdown, гашение зависших джоб на старте
internal/config             env → Config (JDBC-URL → DSN pgx; S3; MCP)
internal/store              pgx-пул, идемпотентная схема (schema.sql), запросы по фичам
internal/storage            S3-клиент (upload/presign/delete)
internal/web                роутинг + middleware (session/CORS/recover) + хендлеры по фичам
internal/assets             go:embed собранного фронта (dist)
frontend/                   Vue 3 (Composition API), Pinia, vue-router, Vite
md/                         вики (as built)
deploy/                     сборка + деплой на VM (systemd/Lockbox)
```

## Ключевые правила бэкенда
- **Схема БД** накатывается на старте идемпотентно (`internal/store/schema.sql`,
  `CREATE ... IF NOT EXISTS` + `ON CONFLICT DO NOTHING`), **не Liquibase**. Всё в схеме `dndshare`.
  На существующей проде — no-op; на чистой БД создаёт таблицы и v3-сиды (item_type 8/9/10,
  suggest_type 23, роли). Базовые справочники (item types 1..7 и часть словарей) исторически
  заводились только на проде — на чистой БД их нет (как и в прежней версии).
- **jsonb** — как `json.RawMessage` + `CAST($n AS jsonb)` на запись. **uuid** — `col::text` на
  чтение, `$n::uuid` на запись. `store.ErrNotFound` — когда строки нет.
- **Аутентификация** — две cookie `sylvieshare-session-id` (userId) + `sylvieshare-session-uuid`
  (uuid), серверный стор — таблица `users_session`. CSRF нет (как в оригинале). Роли: ADMIN,
  HANDBOOK_ADMIN, TEMPLATE_ADMIN, ERROR_REPORT_AUTO_APPROVE.
- **Ошибки** — тело `{"type":..,"desc":..}` (NON_NULL: null-поля опускаются), как прежний
  `ErrorResponse`/`RestResponseEntityExceptionHandler`. Необработанная паника → 500 + запись в `logs`.
- **JSON-совместимость (важно):** ключи — точный camelCase из прежних Kotlin-DTO. Nullable-поля —
  Go-указатель `*T` с `,omitempty`; non-null примитивы — обычное поле без omitempty (сериализуются
  и при 0/false/""). Срезы, которые должны быть `[]`, а не `null` — через `nonNil`.
- **Админ-джобы** — реестр в `internal/web/jobs.go` (`registerJob`), фоновый запуск в горутинах
  с прогрессом и кооперативной отменой (порт AdminJobService). Хендлеры — `jobs_handlers.go`.
- **MCP** — эндпоинт `/mcp` (JSON-RPC, bearer-токен `MCP_AUTH_TOKEN`, флаг записи
  `MCP_WRITE_ENABLED`), инструменты справочника — `internal/web/mcp.go`.

### Добавление роутов
Каждый файл-фича регистрирует свои роуты через `registerRoutes` в `init()`:
```go
func init() { registerRoutes((*Server).routesX) }
func (s *Server) routesX(mux *http.ServeMux) { mux.HandleFunc("GET /api/...", s.handleX) }
```
`server.go` трогать не надо. Auth в хендлерах: `mustUser(w,r)` / `optionalUser(r)` /
`s.requireRole(w,r,RoleAdmin)`. Ответы: `writeJSON`/`badRequest`/`notFound`/`conflict`/`serverError`.

## Локально
```
# фронт (dev): vite на :5173, проксирует /api и /mcp на бэкенд :8080
cd frontend && npm install && npm run dev
# бэкенд (env — как в .env.example):
set -a; source .env; set +a; go run .
```
Чтобы бинарь отдавал фронт сам (как на проде): `cd frontend && npm run build` — vite кладёт
сборку в `frontend/target/dist`; deploy вшивает её в `internal/assets/dist`.

## Проверка
```
go build ./... && go vet ./...   # локально БД не поднимается — проверка сборкой
cd frontend && npm run build
```

## Деплой
```
./deploy/deploy.sh   # собирает фронт, вшивает, кросс-компилит бинарь, заливает, рестартит (systemd/Lockbox)
```

## После каждой правки — сразу пуш и деплой
Закончил осмысленное изменение (фронт или бэк) — не копи правки:
Пользователь явно разрешил без дополнительного согласования пушить завершённые изменения напрямую в
`origin/main` и запускать штатный `./deploy/deploy.sh`. Повторно запрашивать разрешение перед push/deploy
не нужно. При грязном worktree деплоить из чистой копии целевого коммита, чтобы не захватить посторонние
незакоммиченные изменения.

1. Прогони проверку (`go build ./... && go vet ./...`; для фронта `npm run build`).
2. Закоммить и запушь: `git add -A && git commit && git push` (remote `origin`, ветка `main`,
   ключ уже настроен в `core.sshCommand`). Сообщение коммита — по-русски, по сути правки.
3. Задеплой на стенд: `./deploy/deploy.sh` (собирает фронт, вшивает, кросс-компилит, заливает,
   рестартит; в конце печатает хвост `~/dndshare-log.txt`). Стенд всегда отражает последнее изменение.
Визуал проверяет пользователь сам после деплоя — не тратить шаги на скриншоты/симуляцию UI.
