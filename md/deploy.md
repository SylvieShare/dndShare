# Deploy and secrets

Production — один статический Go-бинарь с вшитым Vue frontend. Он работает на
VM под systemd; Docker, JAR и Maven в production path не используются.

## Обязательный workflow

После законченного изменения:

1. `GOCACHE=/private/tmp/dndshare-go-cache go test ./...`
2. `GOCACHE=/private/tmp/dndshare-go-cache go build ./...`
3. `GOCACHE=/private/tmp/dndshare-go-cache go vet ./...`
4. `cd frontend && npm test -- --run && npm run build`
5. commit в `main` с сообщением по-русски и `git push origin main`.
6. `./deploy/deploy.sh`.

Не оставлять завершённое изменение только локально, если пользователь явно не
попросил не пушить/не выкатывать.

## Что делает `deploy/deploy.sh`

Скрипт можно запускать из любого cwd. Он:

1. устанавливает frontend dependencies только если Vite отсутствует;
2. запускает `npm run build` в `frontend/`;
3. копирует `frontend/target/dist` в `internal/assets/dist`;
4. собирает статический `linux/amd64` бинарь с текущим Git SHA в
   `internal/web.BuildCommit`;
5. копирует бинарь, `deploy/dndshare.service` и
   `deploy/dndshare-run.sh` на VM;
6. атомарно заменяет бинарь и перезапускает systemd unit;
7. до 30 секунд опрашивает `GET /api/health`;
8. считает deploy успешным только если ответ содержит `status=ok` и точный
   `commitSha` выкатываемого commit;
9. печатает systemd status и хвост `~/dndshare-log.txt`.

Если startup SQL не применился или БД недоступна, сервис не проходит readiness,
а deploy завершается с ошибкой.

## Файлы

- `deploy/deploy.sh` — local build/upload/readiness.
- `deploy/dndshare.service` — актуальный systemd unit.
- `deploy/dndshare-run.sh` — VM wrapper: получает secrets, экспортирует env и
  делает `exec ~/dndshare`.
- `deploy/fetch-secrets.sh` — получает payload Yandex Lockbox в
  `~/dndshare.env` с mode 600.
- `deploy/setup-vm.sh` и `deploy/bootstrap-vm.sh` — одноразовая подготовка VM.

## Secrets and environment

Секреты не хранятся в репозитории и не передаются с dev-машины. При каждом
старте `dndshare-run.sh` вызывает `fetch-secrets.sh`, затем загружает env.

Основные переменные:

- `DB_URL`, `DB_USER`, `DB_PASSWORD`;
- `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`,
  `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_PUBLIC_URL`,
  `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`;
- `MCP_AUTH_TOKEN`, `MCP_WRITE_ENABLED`;
- `SESSION_SECURE_COOKIE`;
- `PORT`.

В `dndshare.service` находятся только несекретные параметры и id Lockbox.
`DB_PASSWORD`, storage credentials и MCP token приходят из Lockbox. Для ротации
секрета обновить payload и перезапустить unit: wrapper всегда получает свежую
версию.

## Local run

```bash
cp .env.example .env
set -a
source .env
set +a
go run .
```

Frontend dev server запускается отдельно через `cd frontend && npm run dev`.
