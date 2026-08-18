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
   `internal/web.BuildCommit` и служебные sync-бинарники, включая
   `session-image-sync`, `race-image-sync`, `race-icon-sync` и
   `class-image-sync`;
5. копирует бинарники, `deploy/dndshare.service` и
   `deploy/dndshare-run.sh` на VM;
6. проверяет и загружает системные JPEG под стабильными S3-ключами, регистрирует
   их в БД, затем атомарно заменяет основной бинарь и перезапускает systemd unit;
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

Системная музыка загружается отдельно командой
`go run ./cmd/system-music-upload -source-dir /path/to/tracks`. Команда сверяет
размер и SHA-256 каждого файла с `internal/systemmusic`, после чего записывает
объекты под стабильными ключами `system-music/v1/`. В Git и Go-бинарь аудио не
включается; startup-схема хранит эти ключи в `music_track`.

Системные изображения сессий, напротив, входят только в служебный бинарь
`cmd/system-image-sync`. Deploy сверяет их размер и SHA-256 с манифестом
`internal/systemimages`, загружает в `system-session-images/v1/` и обновляет
URL строк `storage_image` до запуска новой версии приложения. Основной бинарь
и frontend эти JPEG не содержат.

Иллюстрации всех девяти базовых рас и девяти подрас входят только в служебный
бинарь `cmd/race-image-sync`. Deploy сверяет размер и SHA-256 с манифестом
`internal/raceimages`, загружает файлы под стабильными ключами
`system-race-images/v1/`, обновляет системные строки `storage_image` и назначает
их как legacy-обложки через `item.cover_image_id`. Повторный запуск очищает
`icon_image_id` только если он всё ещё ссылается на ту же старую иллюстрацию,
поэтому отдельная компактная иконка не теряется. Основной бинарь и frontend эти
JPEG не содержат.

Компактные иконки тех же рас входят только в `cmd/race-icon-sync`. Манифест
`internal/raceicons` фиксирует размер и SHA-256 всех прозрачных WebP 128×128;
deploy загружает их в `system-race-icons/v1/` и назначает ровно одному
совпавшему race item через `item.icon_image_id`. Заменённое изображение не
удаляется, если оно продолжает использоваться как обложка. Основной бинарь и
frontend эти WebP не содержат.

Иллюстрации базовых классов входят только в `cmd/class-image-sync`. Манифест
`internal/classimages` фиксирует размер и SHA-256 для всех пятнадцати JPEG;
deploy загружает их в `system-class-images/v1/`, обновляет системные строки
`storage_image` и назначает через `item.icon_image_id` только базовым class item.
Основной бинарь и frontend эти JPEG не содержат.

Статичные руны выбранных заклинаний входят только в `cmd/spell-rune-sync`.
Манифест `internal/spellimages` фиксирует размер и SHA-256 прозрачных WebP
128×128; deploy загружает их в `system-spell-runes/v1/`, назначает совпавшим
базовым spell item через `item.icon_image_id`, помечает заменённые растровые
иконки удалёнными и удаляет их прежние S3-объекты. Основной бинарь и frontend
эти WebP не содержат.

Панорамные обложки предметов входят только в `cmd/item-cover-sync`. Манифест
`internal/itemcovers` фиксирует размер и SHA-256 непрозрачных WebP 1536×384;
deploy загружает их под стабильными ключами `system-item-covers/v1/`, создаёт
`storage_image(type='item_cover')` и назначает совпавшим системным item через
`item.cover_image_id`. Заменённые непривязанные обложки помечаются удалёнными,
после чего их прежние S3-объекты удаляются. Основной бинарь и frontend эти WebP
не содержат.

Эти sync-команды сохраняются как воспроизводимый bootstrap уже встроенных
наборов. Новые и замещающие изображения системных item можно устанавливать без
нового deploy-манифеста через MCP `handbook_item_set_system_image`: tool
проверяет системного владельца, MIME и размер, кладёт байты в S3 под
content-addressed `system-item-media/v1/` ключом и обновляет `storage_image` и
ссылку item. Для вызова production MCP должны быть заданы `MCP_AUTH_TOKEN` и
`MCP_WRITE_ENABLED=true`.

Deploy также запускает `cmd/bestiary-image-sync`. Команда выбирает только
старые системные картинки бестиария без S3 object key, копирует их по стабильным
ключам `bestiary/v1/` и заменяет внешний URL в `storage_image`; повторный запуск
ничего не перезаливает. Недоступные upstream-файлы теряют мёртвую ссылку и
переходят на иконку типа. Новый импорт бестиария сразу использует тот же путь.

## Local run

```bash
cp .env.example .env
set -a
source .env
set +a
go run .
```

Frontend dev server запускается отдельно через `cd frontend && npm run dev`.
