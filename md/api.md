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

Все непубличные маршруты карт требуют `ADMIN` сверх указанных ниже проверок
владельца. Публичные map/sse доступны по коду только у сессий администратора;
для сессий остальных владельцев — 404. Основная трансляция сессии не затронута.

| Endpoint | Контракт |
| --- | --- |
| `GET /api/maps/models` | ADMIN: каталог метаданных моделей, постоянный definitionId, behaviour (revision/defaultLights/transitions), textureDetail (basic/detailed) используемой визуальной версии и renderUrl/lodUrl/shadowUrl/previewUrl |
| `PUT /api/maps/models/{modelId}` | ADMIN: ModelMetadata и необязательный behaviour → новая версия с новым UUID; поведение логической модели сохраняется в той же транзакции; устаревшая версия/ревизия получает 409 |
| `GET /api/maps/models/{modelId}/{variant}` | ADMIN: source/render/lod/shadow/preview из S3; ETag и immutable cache |
| `GET /api/maps` | Свои и системные карты авторизованного пользователя |
| `POST /api/maps` | Создать `{name,document}` |
| `PUT /api/maps/{mapId}` | Заменить свой документ `{name,document,revision}` |
| `DELETE /api/maps/{mapId}` | Удалить свою карту; копии сессий сохраняются |
| `GET /api/sessions/{uuid}/maps` | Владелец: `{maps,display}` |
| `POST /api/sessions/{uuid}/maps` | Владелец: добавить независимую копию `{mapId}` |
| `PUT /api/sessions/{uuid}/maps/{mapId}` | Владелец: сохранить `{revision,state}` |
| `DELETE /api/sessions/{uuid}/maps/{mapId}` | Владелец: удалить копию и погасить её экран |
| `PUT /api/sessions/{uuid}/map-display` | Владелец: `{mapId,visible,camera,revision}` |
| `GET /api/sessions/{uuid}/map-events` | Владелец: SSE invalidations |
| `GET /api/public/sessions/{code}/map` | Публичный `{display,map}`; map=null при выключенном экране |
| `GET /api/public/sessions/{code}/map-events` | Публичный SSE отдельного экрана карты |
| `GET /api/public/sessions/{code}/map-models` | Только модели включённой карты трансляции |
| `GET /api/public/sessions/{code}/map-models/{modelId}/{variant}` | render/lod/shadow/preview текущей карты; исходник STL недоступен |
| `GET /api/public/sessions/{code}/map-background` | Фон текущей карты через origin приложения |

Документ имеет version=2. Плитка: `{id,modelId,x,y,rotation,level}`;
координаты целые, rotation=0/90/180/270, level=0–15. Верхние уровни требуют
опорных слотов под всей площадью, с учётом поворота и высоты. `modelId` ссылается
на неизменяемую версию каталога; произвольные URL моделей не принимаются.
До 4096 плиток; сервер проверяет существование, размеры и перекрытия.
Документ хранит `lightingEnabled` (первоначально false), `sun` и `lights`;
каждый источник содержит `showMarker`, управляющий сферой редактора независимо
от включения самого света. Режим и параметры сохраняются в сессионной копии.

Карта содержит `id,name,document,revision,changedAt,system`. Сессионная копия
добавляет `state`. Форматы документа `tiles`, `image-grid`, `image` описаны
в [картах](features/maps.md). Состояние содержит туман, видимость зон,
состояния объектов и жетоны; камера — `x,y,cellPixels,rotation,fit`.
URL фона с `assetId` разрешается через storage владельца. Конфликт revision
возвращает `409` и не меняет сохранённые данные; публичные маршруты не пишут.
Публичный snapshot удаляет скрытые/физические жетоны и жетоны в тумане,
ссылки на персонажей/существ и названия зон. Геометрия и фон остаются полными.
Это отдельный API от основной трансляции сессии.

## Музыка и хранение файлов

`/api/music` возвращает личные и общие `isSystem` tracks/albums, предоставляет
CRUD tracks/albums/tags, track-to-album/tag links и album order только для
личных сущностей. Файл и metadata системного трека неизменяемы, но его можно
связать с личным альбомом или тегом. В `albumIds`/`tags` ответа такие связи
фильтруются по текущему пользователю. Личное и системное аудио получает signed S3 playback URL.
Image upload: `POST
/api/storage/images`; item icons используют item-специфичный маршрут выше.
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
