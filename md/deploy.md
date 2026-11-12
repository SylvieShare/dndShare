# Deploy and secrets

Production — один статический Go-бинарь с вшитым Vue frontend. Он работает на
VM `72.56.16.183` под systemd; пользователь `sylvieshare`, ключ
`~/.ssh/dndshare`. Docker, JAR и Maven в production path не используются.
PostgreSQL — `rc1d-t6pv758r8anrqimo.mdb.yandexcloud.net:6432`, база
`sylvieshare`, пользователь `sylvie`. Соединение использует `sslmode=verify-full`
и корневой сертификат Yandex Cloud `/etc/ssl/certs/yandex-cloud-ca.pem`.

Для сборки требуется Go 1.27.1 или новее (`go.mod`). При стандартном
`GOTOOLCHAIN=auto` Go загрузит подходящий toolchain автоматически.
S3-клиент сохраняет path-style адресацию и использует checksum-режим
`WHEN_REQUIRED` для запросов и ответов: обновления AWS SDK не включают
необязательные checksum-заголовки и streaming trailers для Object Storage.

## Обязательный workflow

Порядок коммита и разрешение на выпуск задаёт [README](../README.md#деплой-завершённого-изменения),
обязательные проверки — [единая матрица](testing.md#матрица-проверок).
Не дублировать эти списки здесь. Изменения только документации и её инструментов
не требуют пересборки и перезапуска production-бинаря.

## Чистая release-копия

Перед выпуском зафиксировать абсолютный путь checkout, ожидаемый commit SHA,
вывод `git rev-parse HEAD` и пустой `git status --porcelain --untracked-files=all`
именно в этом checkout. Проверить соответствие deploy-скрипта целевому commit.
Игнорируемые build-артефакты и установленные зависимости не являются исходными
изменениями релиза. Статус другого рабочего каталога не доказывает грязное
состояние release-копии.

В общей рабочей папке не добавлять и не коммитить чужие файлы. При параллельных
задачах использовать отдельный checkout/worktree; перед push сверить origin/main
и включить новые завершённые коммиты без потери изменений. Не запускать старый
deploy поверх более нового выпуска без явной задачи на откат. На VM flock
сериализует установку, но не выбирает правильный commit за вызывающего.

На Windows штатная команда использует Node, Go и Git Bash без WSL.
Рабочая копия `build/ui-release/windows` сохраняет зависимости и кеши между
выпусками. `npm ci` повторяется при изменении lock-файла. Локальная блокировка
сохраняется от переключения commit до конца проверки или публикации.

```powershell
# Автоматическая проверка выбранного production-сценария и публикация
.\scripts\release-windows.ps1 -Commit SHA -BrowserFile tests/navigation/action-menu-production.spec.js

# Подготовка к ручной проверке
.\scripts\release-windows.ps1 -Mode Prepare -Commit SHA
# Открыть выведенный каталог frontend, запустить npm run preview и проверить экран
.\scripts\release-windows.ps1 -Mode Publish -Commit SHA
```

Параметр `-BrowserExecutable` задаёт путь установленного браузера. Если браузер
уже настроен для Playwright, параметр можно опустить. `-PreviewPort` меняет порт
тестового preview. `Publish` проверяет `origin/main`, точный commit, хеш архива
и содержимое проверенного `frontend/target/dist`. Он использует результат
`Prepare` без запуска сборки. Квитанция и результаты браузера сохраняются в
`build/releases/<SHA>/`.

Через WSL существующий `scripts/release.py --commit SHA --web` использует
отдельную тёплую копию. Для разделения этапов в Bash используются
`deploy/deploy.sh --prepare` и `deploy/deploy.sh --publish` в одной чистой копии.
Запуск `deploy/deploy.sh` без параметров выполняет оба этапа.

## Подписанный frontend

До commit выполнить node scripts/release/versions.mjs --bump и --check.
Prepare проверяет отпечатки, собирает frontend, подписывает ZIP и встраивает
metadata/пакет в Go. Нужен закрытый ключ вне Git; настройка и совместимость —
[версии и OTA](features/client-updates.md). Публикуется только проверенный архив.

## Что делает deploy

1. `--prepare` собирает Vue, встраивает результат в Go и формирует один
   сжатый архив `build/web-release/release.tar.gz`. Сохраняет хеш архива,
   commit и контрольные суммы файлов frontend.
2. `--publish` проверяет подготовленные файлы, свободное место на VM и
   загружает один архив в уникальный staging. На VM архив проверяется по SHA-256
   перед распаковкой. Блокировка защищает активацию и откат. Если активный SHA
   успел измениться во время передачи, выкладка останавливается.
3. Установщик сохраняет хешированные ресурсы для открытых вкладок и проверяет
   конфигурацию до остановки сервиса. Перед заменой сохраняет текущий здоровый
   бинарь, скрипты запуска, их контрольные суммы и commit в
   `~/dndshare-previous.tar`.
4. После перезапуска готовность подтверждается только с ожидаемым commit.
   Windows-команда сверяет и публичный `/api/health`. При ошибке архив
   предыдущего бинаря доступен для отката.

## Быстрый откат

Для отката интерфейса или обратно совместимого runtime:

```powershell
.\scripts\release-windows.ps1 -Mode Rollback
```

В Bash та же операция выполняется через `deploy/deploy.sh --rollback`.
Она проверяет контрольные суммы предыдущего бинаря и скриптов запуска,
возвращает их под блокировкой и сверяет readiness предыдущего SHA. Хешированные
ресурсы старой версии остаются на VM. Откат бинаря не откатывает схему, данные,
секреты или инфраструктурную конфигурацию. Для изменений данных нужен свой
проверенный сценарий восстановления.

Android обновляется независимо от сайта. Для уже собранного APK используется
[установка по манифесту](../native/README.md#установка-и-обновление-телефона).

## Файлы

- `deploy/deploy.sh` — подготовка, передача архива и вызов активации.
- `deploy/activate-release.sh` — активация и откат бинаря под блокировкой VM.
- `deploy/dndshare.service` — актуальный systemd unit.
- `deploy/nginx-dndshare.conf` — HTTPS для dndshare.ru/www, HTTP redirect и ACME;
  прокси на 127.0.0.1:8080 с `proxy_buffering off` для передачи ответов без
  временных proxy-файлов на диске. Внутренний 8080 закрыт UFW; открыты SSH, 80/443.
- `deploy/nginx-dndshare-http.conf` — начальное HTTP-проксирование до выпуска
  сертификата. Deploy выбирает HTTPS-конфигурацию только при наличии сертификата;
  иначе оставляет HTTP. Production cookies всегда Secure: вход требует HTTPS.
- `deploy/journald-storage.conf` — постоянные журналы до 128 МиБ, резерв 512 МиБ
  свободного места; устанавливается в `/etc/systemd/journald.conf.d/60-dndshare-storage.conf`.
- `deploy/dndshare-run.sh` — VM wrapper: получает secrets, экспортирует env и
  делает `exec ~/dndshare`.
- `deploy/fetch-secrets.sh` и `deploy/fetch-secrets.py` — получают payload Yandex
  Lockbox в `~/dndshare.env` с mode 600. Python использует стандартную библиотеку
  и OpenSSL для подписи PS256, yc CLI и metadata не требуются.
- `deploy/setup-vm.sh` и `deploy/bootstrap-vm.sh` — одноразовая подготовка VM.
- `deploy/certbot-reload-nginx.sh` — deploy hook Certbot: проверяет nginx и
  перечитывает конфигурацию после обновления сертификата. Устанавливается при
  bootstrap и обычном deploy в `/etc/letsencrypt/renewal-hooks/deploy/dndshare-nginx`.

## Свободное место и обрывы HTTP

При включённой proxy-буферизации заполненная файловая система VM обрывает большие ответы nginx и
запись тел запросов. Симптомы: `ERR_INCOMPLETE_CHUNKED_ENCODING` при загрузке
каталога моделей и ошибки сохранения карты; в `/var/log/nginx/error.log` —
`No space left on device`. Health-check может оставаться успешным, поскольку
его ответ мал.

Проверяют `df -h /`, `journalctl --disk-usage` и размеры каталогов. Для аварийного
освобождения места в журналах: `sudo journalctl --rotate` и
`sudo journalctl --vacuum-size=128M`; удаляются только архивные журналы, текущий
журнал остаётся. Постоянный лимит journald применяется штатным deploy.
Кэш хешированных frontend-ресурсов сохраняет старые файлы для открытых вкладок.
На новую VM перенесена только текущая production-сборка. Модели GLB/STL на VM
не хранятся. Кэш APT — загруженные системные пакеты, его очищают `sudo apt-get clean`.
Карты и каталог находятся в PostgreSQL, модели — в S3; их для очистки диска VM
не удаляют. Проверка минимального места перед deploy предотвращает выпуск
на уже переполненный диск.

## Secrets and environment

Секреты приложения не хранятся в репозитории и не передаются с dev-машины.
При каждом старте `dndshare-run.sh` вызывает `fetch-secrets.sh`, затем загружает
env. Внешняя VM получает IAM-токен по авторизованному JSON-ключу сервисного
аккаунта и читает Lockbox по публичному HTTPS API.

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
версию. Адрес БД, DB user и требование Secure-cookie из unit имеют приоритет над
старыми одноимёнными записями Lockbox.

Сервисному аккаунту нужна роль `lockbox.payloadViewer` на секрете
`e6qc2l631pr9823st3lg`. Его авторизованный ключ находится только на VM в
`/etc/dndshare/lockbox-sa-key.json` (владелец `root:sylvieshare`, mode 640;
каталог mode 750). Путь задаёт `LOCKBOX_SERVICE_ACCOUNT_KEY_FILE`. На каждый
запуск создаётся JWT со сроком 5 минут, обменивается на IAM-токен, затем
получается payload. Токены и значения не печатаются. HTTP-ошибка, пустой payload
или отсутствие обязательных credentials останавливают запуск; прежний env-файл
не перезаписывается. Значения экранируются для Bash и файл заменяется атомарно.

S3 остаётся в Yandex Object Storage, endpoint `https://storage.yandexcloud.net`.
Go SDK подписывает запросы статическими ключами `OBJECT_STORAGE_ACCESS_KEY` и
`OBJECT_STORAGE_SECRET_KEY` из Lockbox. Привязка VM к YC не требуется; после
смены IP нужно учитывать возможные ограничения bucket policy.

## Подготовка новой VM

1. `./deploy/bootstrap-vm.sh` подключается под `root` (можно задать `VM_USER`),
   создаёт `sylvieshare`, устанавливает его SSH-ключ и sudo для deploy, nginx,
   certbot, OpenSSL/Python, CA для PostgreSQL и UFW с SSH/80/443.
2. Создать сервисный аккаунт, выдать ему `lockbox.payloadViewer` на секрете и
   создать авторизованный ключ. Передать JSON прямо на VM и установить через
   `install -m 640 -o root -g sylvieshare` в
   `/etc/dndshare/lockbox-sa-key.json`. JSON не включать в Git.
3. Запустить `./deploy/deploy.sh`; readiness работает через localhost даже до
   переключения DNS. HTTP через nginx позволяет проверить подготовку по IP.
4. Переключить A-записи `dndshare.ru` и `www.dndshare.ru` на `72.56.16.183`.
5. На VM выполнить `sudo certbot certonly --webroot -w /var/www/dndshare-acme
   -d dndshare.ru -d www.dndshare.ru`, затем повторить deploy: он включит HTTPS.
   Certbot timer обновляет сертификат; deploy hook заставляет nginx использовать
   обновлённые файлы. Проверка: `sudo certbot renew --dry-run --run-deploy-hooks`.

Проверка загрузчика секретов: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest
discover -s deploy -p 'test_*.py' -v`. Проверяются подпись/claims PS256,
экранирование Bash, права файла, отказ при ошибках payload и приоритет unit.

Системная музыка загружается отдельно командой
`go run ./cmd/system-music-upload -source-dir /path/to/tracks`. Команда сверяет
размер и SHA-256 каждого файла с `internal/systemmusic`, после чего записывает
объекты под стабильными ключами `system-music/v1/`. В Git и Go-бинарь аудио не
включается; `music_track` хранит эти ключи как отдельно подготовленные данные
каталога, без startup seed.

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

Прежние embedded эмблемы коллекций и изображения истощения/вдохновения
хранятся в S3 как WebP под `system-item-media/v1/static/`. Их оптимизированные
исходники и SHA-256/размеры сохранены в `scripts/static-media/manifest.json`.
`go run ./cmd/static-media-upload` проверяет локальный набор, а запуск с
`-apply` явно восстанавливает файлы в S3 и сверяет полученные байты. Команда
не меняет БД, использует штатные storage env и не печатает credentials.
Штатный deploy не запускает её и не включает эти WebP в основной бинарь.
Ссылки и общие image ID сохраняются в данных БД, миграции их не переносят.
Объекты `system-item-media/` получают годовой immutable cache-control.

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

Подготовка геометрии, материалов, превью и теней, проверки и публикация файлов
описаны в [пайплайне обработки моделей](features/maps-model-pipeline.md).
Модели публикуются непосредственно в S3 через MCP. Штатный deploy приложения
выпускает код и миграции; обработка и загрузка моделей выполняются отдельно.

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


## Уточнения контракта

Историческая [запись переноса 8 октября](reports/deploy-move-2026-10-08.md) не задаёт текущий адрес VM.

## Связанные страницы

[Оглавление wiki](README.md)
