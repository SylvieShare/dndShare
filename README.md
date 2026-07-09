# dndShare (Go)

Веб-приложение для ведения D&D: листы персонажей, справочник (dictionary/items),
игровые сессии, музыкальная библиотека. **Единый дом проекта**: Go-бэкенд + Vue-фронт + вики.

Бэкенд на Go — один статический бинарь с вшитым фронтом (`go:embed`), мгновенный старт.
Фронт (Vue 3) собирается и вшивается в бинарь при деплое. Прежняя Kotlin/Spring-версия
заморожена как архив в `../dndShare-kotlin`.

## Стек
- Go (stdlib `net/http` + `ServeMux` с method/patterns, без веб-фреймворка)
- Postgres через [pgx](https://github.com/jackc/pgx) (`pgxpool`, simple-протокол под пулер YC :6432)
- S3-совместимое хранилище через [aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2)
- Пароли — собственный формат `$31$` поверх PBKDF2WithHmacSHA1 (совместим с прежними хэшами)
- MCP-сервер справочника на `/mcp` (JSON-RPC, bearer-токен)

## Паритет с прежней (Spring) версией
- **API идентичен** — те же роуты, JSON-ключи (camelCase), коды ответов, тело ошибок
  `{"type":..,"desc":..}`. Фронт не меняется.
- **Аутентификация** — две cookie `sylvieshare-session-id` + `sylvieshare-session-uuid`
  (серверный стор — таблица `users_session`).
- **Схема БД** — накатывается на старте идемпотентно (`internal/store/schema.sql`); существующие
  данные не трогаются. Всё в схеме `dndshare`.

## Раскладка
```
main.go                     запуск, graceful shutdown
internal/config             env → Config (JDBC-URL → DSN pgx; S3; MCP)
internal/store              pgx-пул, идемпотентная схема, запросы по фичам
internal/storage            S3-клиент
internal/web                роутинг + middleware + хендлеры по фичам (+ admin-джобы, MCP)
internal/assets             go:embed собранного фронта (dist)
frontend/                   Vue 3, Pinia, vue-router, Vite
md/                         вики. deploy/ — деплой на VM (systemd/Lockbox)
```

## Локально
```
cd frontend && npm install && npm run dev          # vite :5173 → проксирует /api,/mcp на :8080
# в другом терминале, env как в .env.example:
set -a; source .env; set +a; go run .              # http://localhost:8080
```

## Проверка
```
go build ./...
go vet ./...
cd frontend && npm run build
```

## Сборка и деплой
```
./deploy/deploy.sh          # см. комментарии в скрипте
```
