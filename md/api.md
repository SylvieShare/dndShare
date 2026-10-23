# HTTP API

Общие правила HTTP-контракта и навигация по группам endpoints. Предметное поведение находится на страницах фич; здесь описаны запросы, ответы и права.

## Разделы

| Страница | Содержание |
| --- | --- |
| [API: авторизация и аккаунт](api/account.md) | Сессии пользователя, настройки аккаунта, обучение и инструменты мастера. |
| [API: персонажи](api/characters.md) | Шаблоны, создание и чтение листа, журнал, иконки и сохранение документа. |
| [API: справочник и MCP](api/handbook.md) | Источники, записи, словари, видимость, совместимость редакций и HTTP-вход MCP. |
| [API: сессии и сцены](api/sessions.md) | Основной контракт сессии, сущности сюжета, публичный экран и настройки видимости. |
| [API: обмен и общение](api/interactions.md) | Вещи, деньги, использование расходников, переписка, вызовы и инвентарь сессии. |
| [API: магия и действия хроники](api/session-actions.md) | Концентрация, цели, сохранённые броски, шаги атак и создание предметов. |

## Общие правила

- JSON keys — camelCase.
- Ошибка — JSON `{ "type": "...", "desc": "..." }`.
- Session auth — cookies `sylvieshare-session-id` и
  `sylvieshare-session-uuid`; обе cookie имеют `HttpOnly`, `SameSite=Lax` и
  `Max-Age=2592000` (30 дней). Сервер также отклоняет `users_session` старше
  30 дней.
- `shared/api/http.js` считает любой non-2xx ошибкой.
- Старые route aliases и DTO fields не поддерживаются.
- Health: `GET /api/health` возвращает status, DB state и build `commitSha`.

## Игровые карты

Непубличные маршруты карт требуют входа. Личные карты и превью проверяют
владельца; сессионные карты доступны ведущему — владельцу сессии, без требования
`ADMIN`. Изменение общего справочника моделей требует `ADMIN`. Публичные map/SSE
доступны без входа по коду трансляции любой сессии.

| Endpoint | Контракт |
| --- | --- |
| `GET /api/maps/models` | Авторизованный пользователь: каталог метаданных моделей, постоянный id, code/name, постоянный UUID uuid, behaviour (revision/defaultLights/transitions/waterAnimation?), textureDetail (basic/detailed) текущей модели, itemIds (основные привязки итемов) и renderUrl/lodUrl/shadowUrl/previewUrl; assetBytes {render,lod,shadow,preview} — размеры файлов в байтах для плана загрузки; previewSignature — подпись визуальных данных модели для локальной сверки при создании снимка |
| `PUT /api/maps/models/{modelId}` | ADMIN: поля каталога с id/uuid, редактируемый code и необязательный behaviour → обновление текущей модели с прежним UUID во всех картах; поведение сохраняется в той же транзакции; устаревшая behaviour.revision получает 409 |
| `GET /api/maps/models/{modelId}/{variant}` | Авторизованный пользователь: source/render/lod/shadow/preview из S3; ETag и immutable cache |
| `GET /api/maps` | Компактный список карт: scope=own/subscriptions/catalogue |
| `POST /api/maps` | Создать `{name,document}` |
| `GET /api/maps/{mapId}/preview-context` | Авторизованный пользователь: доступный документ, актуальные используемые модели, SHA-256 подписи сцены и modelsSignature; previewUrl, если снимок этой подписи уже готов; нужен при отсутствии локального контекста или конфликте |
| `POST /api/maps/{mapId}/preview?signature=...` | Авторизованный пользователь: WebP 64–1024 px, до 1 МБ → сохранённый в S3 снимок; устаревшая сцена получает 409 |
| `GET /api/maps/{mapId}/preview?signature=...` | Авторизованный пользователь: сохранённый WebP из S3; проверка владельца и подписи, immutable cache |
| `PATCH /api/maps/{mapId}` | Пакет `{baseVersion,mutationId,patches,metadata?}` своего документа |
| `GET /api/maps/{mapId}/changes?after=N` | Патчи после версии или текущий снимок |
| `DELETE /api/maps/{mapId}` | Удалить свою карту; копии сессий сохраняются |
| `GET /api/sessions/{uuid}/maps` | Владелец: `{maps,display}` |
| `POST /api/sessions/{uuid}/map-images` | Владелец: `{name,imageId,width}` → 2D карта из собственного storage image |
| `GET /api/sessions/{uuid}/map-images/{mapId}` | Владелец сессии: исходное изображение карты из S3 |
| `GET /api/public/sessions/{code}/map-images/{mapId}` | Только активное изображение транслируемой карты |
| `POST /api/sessions/{uuid}/maps` | Владелец: добавить независимую копию `{mapId}` |
| `PATCH /api/sessions/{uuid}/maps/{mapId}` | Владелец: атомарно применить общий пакет к `{name,document,state}` и ссылкам моделей |
| `GET /api/sessions/{uuid}/maps/{mapId}/changes?after=N` | Владелец: патчи после версии или снимок |
| `DELETE /api/sessions/{uuid}/maps/{mapId}` | Владелец: удалить копию и погасить её экран |
| `PUT /api/sessions/{uuid}/map-display` | Владелец: `{mapId,visible,camera,revision}`; camera.sceneId выбирает камеру документа, camera.view фиксирует ракурс (position/target/up/width/aspect) |
| `GET /api/sessions/{uuid}/map-events` | Владелец: SSE invalidations |
| `GET /api/public/sessions/{code}/map` | Публичный `{display,map}`; map=null при выключенном экране |
| `GET /api/public/sessions/{code}/map-events` | Публичный SSE отдельного экрана карты |
| `GET /api/public/sessions/{code}/map-models` | Только модели включённой карты и видимых существ; скрытые/физические жетоны и туман не раскрывают ресурсы |
| `GET /api/public/sessions/{code}/map-models/{modelId}/{variant}` | render/lod/shadow/preview текущей карты; исходник STL недоступен |

Документ имеет version=2. Плитка: `{id,modelId,x,y,rotation,level}`;
координаты целые, rotation=0/90/180/270, level=0–15. Верхние уровни требуют
опорных слотов под всей площадью, с учётом поворота и высоты. `modelId` ссылается
на текущую модель каталога; произвольные URL моделей не принимаются.
До 4096 плиток; сервер проверяет существование, размеры и перекрытия.
Документ хранит `lightingEnabled` (первоначально false), `sun` и `lights`;
каждый источник содержит `showMarker`, управляющий сферой редактора независимо
от включения самого света. Режим и параметры сохраняются в сессионной копии.
Встроенный источник имеет `builtinKey` и фиксированный anchor; необязательный
`overrides: {color,height,intensity,radius,flicker,showMarker,shadows}` хранит
изменения конкретного экземпляра (включая false/0). Отсутствующие поля берутся
из текущего шаблона. Высота override — мировая; имя/тип/XY/привязка задаются
шаблоном. Overrides у ручного источника запрещён. Число источников с тенями не
ограничено двумя; сохраняются до 32 ручных источников плюс встроенные.

Полная карта содержит `id,name,document,revision,changedAt,owned,publishedAt,previewSignature,previewModelsSignature` и
`previewUrl`, если сохранён снимок. Устаревший снимок сохраняет URL своей подписи и
получает `previewStale: true`, пока готовится замена; `previewSignature` описывает
текущую сцену. previewModelsSignature позволяет сверить уже загруженные модели
локально и отправить WebP одним POST без предварительного preview-context.
Названия, теги, зоны и служебные маркеры не сбрасывают снимок.
Сессионная копия
добавляет `state` и неизменяемый `source: {id,name,system}`. Единственный формат документа `tiles` описан
в [картах](features/maps.md). Состояние содержит туман, видимость зон,
состояния объектов и жетоны; камера — `x,y,cellPixels,rotation,fit`.
`document.tags` хранит до 32 строк по 64 символа; пробелы и дубликаты без учёта регистра нормализуются. Изображения карт больше не принимаются. Конфликт revision
возвращает `409` и не меняет сохранённые данные; публичные маршруты не пишут.
Публичный snapshot удаляет скрытые/физические жетоны, жетоны в тумане (включая
плитки областей с `fog: true`), ссылки на персонажей/существ, названия зон и теги
карты. Геометрия остаётся полной. `document.areas[].fog` — сохраняемый bool
тумана области, независимый от `hidden` и сессионных зон. Поле выбора версии тумана удалено; bool `fog` включает объёмное отображение.
Подпись превью содержит маркер рендера `map-scene-fog-stable-grid`, поэтому прежние
снимки обновляются при обращении к библиотеке карт.
Это отдельный API от основной трансляции сессии.

## Музыка и хранение файлов

`/api/music` возвращает личные и общие `isSystem` tracks/albums, предоставляет
CRUD tracks/albums/tags, track-to-album/tag links и album order только для
личных сущностей. Файл и metadata системного трека неизменяемы, но его можно
связать с личным альбомом или тегом. В `albumIds`/`tags` ответа такие связи
фильтруются по текущему пользователю. Личное и системное аудио получает signed S3 playback URL.
Image upload: `POST
/api/storage/images` (multipart `file`, до 30 МБ / 30×1024² байт).
Большие изображения разбираются через временный файл с очисткой после запроса.
Для `purpose=character_icon` сохраняются предел 5 МБ и проверка PNG/WebP
256×256. Карты мира и изображения персонажа преобразуются в WebP в браузере
перед отправкой; API хранит переданные байты. Item icons используют
item-специфичный маршрут выше.
Video upload: `POST /api/storage/videos`. SVG read: `GET /api/svg/{id}`.
Uploads пишут byte-size, исходное имя, MIME и id владельца в соответствующий
registry; эти же metadata используются `GET /api/account/storage`.

## Администрирование

Admin routes находятся под `/api/admin-panel`: users/roles/passwords, logs,
stats и jobs.

`GET /api/admin-panel/stats` требует роль `ADMIN` и вместе со счётчиками
пользователей и справочника возвращает `storage`:
`{usedBytes,fileCount,unknownFileCount,breakdown}`. Элементы breakdown содержат
`key,label,bytes,fileCount,unknownFileCount` для системных и пользовательских
изображений, видео, системной и пользовательской музыки и SVG, а также моделей карт и превью (`systemModels`). В статистику
входят активные управляемые объекты S3 и DB-backed файлы; удалённые строки и
внешние URL без собственного объекта хранилища исключаются.

## Связанные страницы

[Оглавление wiki](README.md) · [Музыка](features/music.md) · [Admin panel](features/admin.md)

Необязательное `light.effect` сохраняет параметры пламени вместе с источником
в обычной и сессионной карте. Цвет и включение берутся из света. Контракт —
[пламя источников света](features/maps-light-effects.md).

В каталоге моделей карт name/nameEn содержат русский и английский варианты,
groupName/groupNameEn — общие имена группы collection/code. category фильтрует
каталог, tileType сохраняет структурную форму. variantCode задаёт соседство
вариантов внутри раздела; пустая строка означает отсутствие семейства.
PUT метаданных требует явного variantCode и оба языка модели/группы,
возвращает текущую запись с сохранёнными UUID и assets.

Карты: три scope списка, неизменяемая публикация, подписки и рейтинг описаны
в [каталоге карт](features/maps-catalogue.md#http-и-хранение). Список отдаёт
компактные карточки; документ загружается отдельным GET по UUID.

Каталог и загрузка изображений для 3D-наложений: `GET/POST /api/maps/decals`,
публичные неизменяемые текстуры `GET /api/map-decal-images/{uuid}`.
Права, ограничения и DTO — [декали карт](features/maps-decals.md).

В документах 3D карт `tiles[].mirrored` — булев флаг локального отражения X
перед четвертьоборотом `rotation`; отсутствие означает false. T отражает в
осях карты, поэтому также меняет rotation на `-rotation mod 360`. Дополнительные
файлы геометрии и отдельная таблица для отражений не требуются.

Модели итемов связываются через MCP `item_models_list`, `item_model_bind`,
`item_model_unbind`; контракт — [модели итемов](features/item-models.md).
У жетона существа `state.tokens[].itemId` задаёт публичный итем для выбора модели.
