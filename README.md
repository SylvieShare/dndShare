# dndShare

D&D-мастерская: менеджер листов персонажей, справочник, игровые сессии и
музыка. Production artifact — один статический Go-бинарь с вшитым Vue 3
frontend, PostgreSQL и S3-compatible object storage.

Прежняя Kotlin/Spring-версия не является runtime-зависимостью или контрактом
совместимости. Актуальны только Go API, Vue frontend и данные текущего формата.

Этот файл — основной источник проектных инструкций для разработчиков и
автоматизированных агентов. `AGENTS.md` и `CLAUDE.md` должны только направлять
сюда, чтобы правила не расходились между несколькими файлами.

## Документация и wiki

- `md/` — актуальная wiki проекта: общая frontend-архитектура находится в
  `md/frontend.md`, CSS-токены — в `md/css-variables.md`, документация фич — в
  `md/features/*`.
- `md/api.md`, `md/database.md` и `md/deploy.md` описывают контракт API, схему
  БД и процесс деплоя; лимиты размера исходных файлов описаны в
  `md/file-size-rules.md`.
- `md/error-report-automation.md` — runbook регулярной обработки одобренных
  заявок «Ошибки на страницах» после успешного захвата очереди через MCP.
- При любом изменении архитектуры, поведения, UX, API, схемы или формата данных
  нужно проверить связанные страницы `md/` и актуализировать их в том же
  коммите. Изменение не считается завершённым, если wiki описывает прежнее
  поведение.
- Если правка не требует изменения текста wiki, всё равно нужно убедиться, что
  существующее описание остаётся корректным. Не хранить в wiki удалённые API,
  fallback-поведение, планы вместо реализованного состояния или устаревшие
  примеры.
- Общие frontend-компоненты и правила выбора между ними документируются в
  `md/frontend.md`. Новый локальный аналог общего компонента допустим только
  при отдельной UX-причине, которая отражена в документации.
- Задача в DnD Share разрешает без отдельного согласования редактировать,
  проверять, выпускать и обновлять соседний `../share-ui`, если общее изменение
  необходимо для её завершения. Не копировать примитив и не обходить нехватку
  API локальным базовым CSS. Полный процесс и границы разрешения — в
  [maintainer-runbook share-ui](https://github.com/SylvieShare/share-ui/blob/main/MAINTAINING.md),
  consumer-правила — в `md/frontend.md`.

## Стек

### Backend (`internal/`)

- stdlib `net/http` + `ServeMux` с method/pattern-роутингом (Go 1.22+), без
  веб-фреймворка;
- PostgreSQL через pgx (`pgxpool`, simple protocol для пулера YC `:6432`);
- S3-compatible хранилище через aws-sdk-go-v2 и порт
  `ObjectStorageService`;
- пароли в существующем формате `$31$` поверх `PBKDF2WithHmacSHA1`: параметры
  нельзя менять, чтобы не нарушить совместимость сохранённых хэшей;
- frontend встраивается через `go:embed all:dist` в `internal/assets`.

### Frontend (`frontend/`)

- Vue 3 и Composition API;
- Pinia;
- vue-router;
- Vite;
- `@sylvieshare/share-ui` — фиксируемая по Git release tag общая дизайн-система
  DnD Share, HavenShare и TrenchShare.

Приложение также предоставляет JSON-RPC MCP endpoint `/mcp`.

## Структура проекта

```text
main.go             запуск, graceful shutdown, остановка зависших jobs на старте
internal/config     env → Config, JDBC URL → pgx DSN, S3 и MCP
internal/store      pgx pool, атомарная startup-схема из schema/*.sql и запросы фич
internal/storage    S3-клиент: upload, presign и delete
internal/web        routes, session/CORS/recover middleware, jobs и MCP
internal/assets     go:embed собранного frontend (dist)
frontend            Vue 3 application
md                  актуальная project wiki (as built)
deploy              сборка и deploy на VM через systemd/Lockbox
scripts             исполняемые project guardrails для автоматизированных агентов
```

## Ключевые правила backend

- Схема БД накатывается на старте идемпотентно из упорядоченных файлов
  `internal/store/schema/*.sql` (`CREATE ... IF NOT EXISTS`,
  `ON CONFLICT DO NOTHING`). `schema.go` встраивает их и выполняет одной
  транзакцией, без Liquibase. Всё находится в схеме `dndshare`.
- На существующей БД startup-схема также приводит данные к единственному
  актуальному формату и удаляет старые колонки и JSON-ключи.
- Runtime читает только текущую схему. Ломающее изменение сопровождается
  startup data migration в соответствующем `schema/*.sql`; старые поля,
  aliases, fallback-ветки и временные admin jobs после этого удаляются.
  Обратная совместимость со старыми форматами не поддерживается.
- `jsonb` записывается как `json.RawMessage` через `CAST($n AS jsonb)`; `uuid`
  читается как `col::text` и записывается как `$n::uuid`.
- Отсутствующая строка возвращается как `store.ErrNotFound`.
- Аутентификация использует cookie `sylvieshare-session-id` (`userId`) и
  `sylvieshare-session-uuid` (`uuid`), серверное состояние хранится в
  `users_session`; обе cookie сохраняются браузером 30 дней.
- Роли: `ADMIN`, `HANDBOOK_ADMIN`, `ERROR_REPORT_AUTO_APPROVE`,
  `ERROR_REPORT_REVIEWER`.
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

### Добавление HTTP routes

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

## Локальная разработка

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend в другом терминале:

```bash
set -a
source .env
set +a
go run .
```

Vite работает на `:5173` и проксирует `/api` и `/mcp` на Go-сервис `:8080`.
Чтобы Go-бинарь самостоятельно отдавал frontend, выполните
`cd frontend && npm run build`: Vite положит результат в
`frontend/target/dist`, после чего deploy встроит его в `internal/assets/dist`.

## Проверки

```bash
GOCACHE=/private/tmp/dndshare-go-cache go test ./...
GOCACHE=/private/tmp/dndshare-go-cache go build ./...
GOCACHE=/private/tmp/dndshare-go-cache go vet ./...
cd frontend && npm test -- --run && npm run build
```

## Деплой завершённого изменения

Законченное осмысленное изменение не нужно накапливать локально. Пользователь
разрешил без дополнительного согласования отправлять завершённые изменения в
`origin/main` и запускать штатный deploy. Повторно запрашивать разрешение перед
push или deploy не нужно.

1. Проверить backend и затронутые frontend-тесты; для frontend также выполнить
   production build.
2. Проверить и при необходимости обновить связанную wiki в `md/`.
3. Выполнить `git add -A`, создать содержательный commit с сообщением на
   русском и отправить `git push origin main`. SSH-ключ уже задан в
   `core.sshCommand`.
4. Запустить `./deploy/deploy.sh`. Скрипт собирает frontend, встраивает его,
   кросс-компилирует бинарь, загружает его на VM, перезапускает systemd-сервис и
   проверяет readiness.

При грязном worktree deploy выполняется из чистой копии целевого commit, чтобы
не захватить посторонние незакоммиченные изменения. Стенд должен отражать
последнее завершённое изменение. Визуальную проверку после deploy выполняет
пользователь; отдельные скриншоты или симуляция UI не требуются.
