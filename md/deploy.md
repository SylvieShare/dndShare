# Deploy and secrets

Production — один статический Go-бинарь с вшитым Vue frontend. Он работает на
VM под systemd; Docker, JAR и Maven в production path не используются.

Для сборки требуется Go 1.27.1 или новее (`go.mod`). При стандартном
`GOTOOLCHAIN=auto` Go загрузит подходящий toolchain автоматически.
S3-клиент сохраняет path-style адресацию и использует checksum-режим
`WHEN_REQUIRED` для запросов и ответов: обновления AWS SDK не включают
необязательные checksum-заголовки и streaming trailers для Object Storage.

## Обязательный workflow

После законченного изменения:

1. `python3 scripts/check-wiki.py`.
2. `GOCACHE=/private/tmp/dndshare-go-cache go test ./...`
3. `GOCACHE=/private/tmp/dndshare-go-cache go build ./...`
4. `GOCACHE=/private/tmp/dndshare-go-cache go vet ./...`
5. `cd frontend && npm test -- --run && npm run build`
6. commit в `main` с сообщением по-русски и `git push origin main`.
7. `./deploy/deploy.sh`.

Не оставлять завершённое изменение только локально, если пользователь явно не
попросил не пушить/не выкатывать.

## Что делает `deploy/deploy.sh`

Скрипт можно запускать из любого cwd. Он:

1. устанавливает frontend dependencies только если Vite отсутствует;
2. запускает `npm run build` в `frontend/`;
3. копирует `frontend/target/dist` в `internal/assets/dist`;
4. собирает один статический `linux/amd64` бинарь с текущим Git SHA в
   `internal/web.BuildCommit`;
5. копирует основной бинарь, `deploy/dndshare.service` и
   `deploy/dndshare-run.sh` на VM;
6. атомарно заменяет основной бинарь и перезапускает systemd unit; системные
   изображения и image-sync бинарники штатный deploy не передаёт;
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

- `APP_ENV=production`, `TRUST_PROXY_HEADERS=true`;
- `DB_URL`, `DB_USER`, `DB_PASSWORD`;
- `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`,
  `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_PUBLIC_URL`,
  `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`;
- `MCP_AUTH_TOKEN`, `MCP_WRITE_ENABLED`;
- `SESSION_SECURE_COOKIE`;
- `PORT`.

В production приложение завершает запуск, если пароль БД, MCP token или S3
credentials отсутствуют/оставлены dev-значениями, либо secure cookies явно
отключены. Некорректные boolean env также считаются ошибкой конфигурации.

В `dndshare.service` находятся только несекретные параметры и id Lockbox.
`DB_PASSWORD`, storage credentials и MCP token приходят из Lockbox. Для ротации
секрета обновить payload и перезапустить unit: wrapper всегда получает свежую
версию.

Системная музыка загружается отдельно командой
`go run ./cmd/system-music-upload -source-dir /path/to/tracks`. Команда сверяет
размер и SHA-256 каждого файла с `internal/systemmusic`, после чего записывает
объекты под стабильными ключами `system-music/v1/`. В Git и Go-бинарь аудио не
включается; startup-схема хранит эти ключи в `music_track`.

Системные изображения сессий входят только в служебный бинарь
`cmd/system-image-sync`. Он остаётся ручным legacy/bootstrap-инструментом:
сверяет размер и SHA-256 с манифестом `internal/systemimages`, загружает в
`system-session-images/v1/` и обновляет URL строк `storage_image`. Штатный
deploy его не собирает, не копирует и не запускает; основной бинарь и frontend
эти JPEG не содержат.

Иллюстрации всех девяти базовых рас и девяти подрас входят только в ручной
legacy/bootstrap-бинарь `cmd/race-image-sync`. Он сверяет размер и SHA-256 с манифестом
`internal/raceimages`, загружает файлы под стабильными ключами
`system-race-images/v1/`, обновляет системные строки `storage_image` и назначает
их как legacy-обложки через `item.cover_image_id`. Повторный запуск очищает
`icon_image_id` только если он всё ещё ссылается на ту же старую иллюстрацию,
поэтому отдельная компактная иконка не теряется. Основной бинарь и frontend эти
JPEG не содержат.

Компактные иконки тех же рас входят в ручной legacy/bootstrap-инструмент
`cmd/race-icon-sync`. Манифест
`internal/raceicons` фиксирует размер и SHA-256 всех прозрачных WebP 128×128;
при ручном запуске команда загружает их в `system-race-icons/v1/` и назначает ровно одному
совпавшему race item через `item.icon_image_id`. Заменённое изображение не
удаляется, если оно продолжает использоваться как обложка. Основной бинарь и
frontend эти WebP не содержат.

Иллюстрации базовых классов входят в ручной legacy/bootstrap-инструмент
`cmd/class-image-sync`. Манифест
`internal/classimages` фиксирует размер и SHA-256 для всех пятнадцати JPEG;
при ручном запуске команда загружает их в `system-class-images/v1/`, обновляет системные строки
`storage_image` и назначает через `item.icon_image_id` только базовым class item
без иконки или с прежней иконкой из того же namespace. Установленные через MCP
`system-item-media/v1/*` иконки команда не перезаписывает.
Основной бинарь и frontend эти JPEG не содержат.

Статичные руны выбранных заклинаний входят в ручной legacy/bootstrap-инструмент
`cmd/spell-rune-sync`.
Манифест `internal/spellimages` фиксирует размер и SHA-256 прозрачных WebP
128×128; при ручном запуске команда загружает их в `system-spell-runes/v1/`, назначает совпавшим
базовым spell item через `item.icon_image_id`, помечает заменённые растровые
иконки удалёнными и удаляет их прежние S3-объекты. Основной бинарь и frontend
эти WebP не содержат.

Панорамные обложки предметов входят в ручной legacy/bootstrap-инструмент
`cmd/item-cover-sync`. Манифест
`internal/itemcovers` фиксирует размер и SHA-256 непрозрачных WebP 1536×384;
при ручном запуске команда загружает их под стабильными ключами `system-item-covers/v1/`, создаёт
`storage_image(type='item_cover')` и назначает совпавшим системным item через
`item.cover_image_id`. Заменённые непривязанные обложки помечаются удалёнными,
после чего их прежние S3-объекты удаляются. Основной бинарь и frontend эти WebP
не содержат.

Все image-sync-команды сохраняются как воспроизводимый ручной bootstrap уже
встроенных наборов, но штатный `deploy/deploy.sh` их не собирает, не передаёт на
VM и не запускает. Новые и замещающие изображения системных item устанавливаются
через MCP `handbook_item_set_system_image`; типовые fallback-изображения — через
`handbook_item_type_set_system_image`. Tools проверяют цель, MIME и размер,
кладут байты в S3 под content-addressed `system-item-media/v1/` ключом и
обновляют `storage_image` с соответствующей ссылкой. Для вызова production MCP
должны быть заданы `MCP_AUTH_TOKEN` и `MCP_WRITE_ENABLED=true`.

Перенос уже зарегистрированных картинок бестиария из компактной иконки в
обложку выполняется без повторной загрузки через MCP
`handbook_bestiary_migrate_icons_to_covers`. Сначала вызывается dry-run с
`apply=false`, затем полученный `candidateCount` передаётся как
`expectedCandidateCount` вместе с `apply=true`. Нужные семейства исключаются
явным списком `excludeItemIds`; занятые обложки tool не перезаписывает.

`cmd/bestiary-image-sync` также является ручной legacy-командой. Она выбирает только
старые системные картинки бестиария без S3 object key, копирует их по стабильным
ключам `bestiary/v1/` и заменяет внешний URL в `storage_image`; повторный запуск
ничего не перезаливает. Недоступные upstream-файлы теряют мёртвую ссылку и
переходят на иконку типа. Новый импорт бестиария сразу использует тот же путь.

## Модели 3D-карт

Модели не хранятся в Git и не входят в Go-бинарь. Исходники и подготовленные
версии находятся локально в игнорируемой папке models. Встроенный
`internal/battlemap/catalogue.json` содержит только метаданные и SHA-256 файлов;
начальные строки каталога создаёт миграция 166. Перед выпуском эти объекты
должны быть загружены в S3.

Подготовка браузерных моделей:

1. Установить во временную папку инструменты glTF Transform и meshoptimizer:
   `npm install --prefix /private/tmp/dndshare-model-tools @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer`.
2. Выполнить `node scripts/maps/prepare-assets.mjs`: Meshopt-сжатие и облегчение
   геометрии с сохранением текстур. Артефакты остаются в models/prepared/runtime.
3. Создать PNG-превью локальным Blender, затем выполнить
   `python3 scripts/maps/build-catalogue.py`: WebP-превью, контуры препятствий,
   метаданные и content-addressed upload folder в models/prepared/upload.
4. Выпустить основной бинарь с MCP-инструментами плиток.
5. Локально запустить `go run ./cmd/map-model-upload -assets models/prepared/upload`
   с MCP_AUTH_TOKEN. Клиент получает подписанные PUT URL, отправляет файлы прямо
   в S3, подтверждает SHA-256/формат и регистрирует неизменяемые версии.
   Файлы моделей и вспомогательный исполняемый файл по SSH не передаются.
   PostgreSQL обновляет map_tile_model_register через MCP. Startup migration создаёт каталог и по явному
   запросу пользователя удаляет карты старого формата. Сохранённые модели
   отдаются через API приложения: CORS bucket не требуется.

Скрипты подготовки выполняются при изменении моделей, а не при каждом deploy.
Схему новой фичи регистрируют как обычную неизменяемую миграцию. Контракт
каталога и документа — [игровые карты](features/maps.md).

## Local run

```bash
cp .env.example .env
set -a
source .env
set +a
go run .
```

Frontend dev server запускается отдельно через `cd frontend && npm run dev`.

## Статические ресурсы после обновления

Vite создаёт один JS и один CSS с хэшами содержимого и gzip-sidecar для каждого.
Динамические импорты исходников встроены в единый JS: после загрузки приложения
переходы между страницами не требуют отдельных JS/CSS-чанков.
`FRONTEND_ASSET_CACHE_DIR` в systemd указывает на `/home/sylvieshare/dndshare-frontend-assets`. Deploy перед перезапуском загружает static archive, распаковывает во временный каталог и атомарно публикует готовые файлы hardlink-ами без замены существующих хэшей.

Go сначала читает embedded текущую сборку, затем сохранённые `/static/*` по хэшу.
Архив сохраняет ресурсы предыдущих релизов, в том числе чанки сборок до перехода
на единый bundle. Уже открытые вкладки со старой сборкой нужно один раз
перезагрузить, чтобы перейти на единый JS/CSS; новый deploy не меняет код в памяти
такой вкладки. HTML отдаётся с `no-cache`, hashed static с `public, max-age=31536000, immutable`; gzip учитывает Accept-Encoding, включая `gzip;q=0`, и выставляет Vary. Неизвестный static возвращает 404, а не HTML приложения. Автоматической очистки старых хэшей нет; объём каталога контролируется при обслуживании сервера.

## Связанные страницы

[Оглавление wiki](README.md)

### Полный импорт коллекций моделей

Локальные multipart RAR распаковываются скриптом `scripts/maps/extract-collections.py`;
все варианты для печати остаются в игнорируемом `models/collections`. Для редактора
выбираются исходники без поддержек, бонусные блоки и базовые элементы. Исходные
текстовые ID и названия сохраняются; у двух разных UD-055 используются разные
версии каталога. Никакие STL, GLB, текстуры или превью не коммитятся.

`inspect-collections.py` определяет площадь, затем Blender запускает
`prepare-collections.py` для обрезки основания, облегчения, запекания цвета/normal
и превью. Структурные каркасы сохраняют геометрию. `package-collections.mjs`
выпускает Meshopt render/LOD и нормализует центр. `collection-catalogue.py`
создаёт manifest с коллекциями, центральными/боковыми стенами, стыками и слотами.
Результат — `models/collections/upload/catalogue.json` и файлы по SHA-256.
Пакет возобновляемый; готовые модели проверяются локальным тестом
`MAP_MODEL_MANIFEST=/absolute/path/catalogue.json go test ./internal/web -run TestPreparedCollectionManifest`.

После выпуска MCP-схемы модели передаются напрямую в S3 существующим
`cmd/map-model-upload -assets models/collections/upload -workers 4`; токен приходит
из `MCP_AUTH_TOKEN`. SSH используется только штатным deploy приложения, без
пересылки моделей. Уже зарегистрированные UUID пропускаются, одновременно
обрабатываются до восьми моделей.

### Цветные версии Ultimate Dungeon

`scripts/maps/paint-ultimate.py` запускается локальным Blender с
`--background --python-exit-code 1 --python`; `-- --codes UD-001 UD-010` ограничивает
пробную подготовку. Исходные STL читаются из manifest коллекций. Скрипт обрезает
монтажное основание, размечает материалы, создаёт геометрию с бюджетом
`40000 * sqrt(width*height)` (до 120000), UV и встроенные PBR-карты 1024×1024.
Цвет запекается без переноса лучами с другого объекта; нормали переносят рельеф
исходника, а некорректные попадания заменяются нейтральными. Проверяются центры
всех треугольников на чёрный цвет и перевёрнутые нормали. Превью сохраняется PNG.
Готовый report.json позволяет возобновить пакет; для повторной подготовки конкретной
модели удалить только её report и runtime render/lod, сохранив оригиналы.

`node scripts/maps/package-painted.mjs` преобразует PNG-превью в WebP 256×256,
сжимает render/LOD, уменьшает
карты текстур LOD до 512×512, нормализует центр и формирует
`models/collections/painted/upload/catalogue.json`. Метаданные размещения копируются
точно из исходного каталога, source повторно используется, версия увеличивается.
Два разных UD-055 получают разные номера, не теряя исходные имена. Все файлы
остаются вне Git. Локальная проверка manifest и загрузка выполняются существующими
тестом и MCP-клиентом с `-assets models/collections/painted/upload`.
Клиент пропускает уже зарегистрированные файлы и не передаёт STL повторно.
