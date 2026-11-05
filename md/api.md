# HTTP API

Общие правила HTTP-контракта и навигация по группам endpoints. Предметное поведение находится на страницах фич; здесь описаны запросы, ответы и права.

## Разделы

| Страница | Содержание |
| --- | --- |
| [API: авторизация и аккаунт](api/account.md) | Сессии пользователя, настройки аккаунта, обучение и инструменты мастера. |
| [API: персонажи](api/characters.md) | Шаблоны, создание и чтение листа, журнал, иконки и сохранение документа. |
| [API: справочник и MCP](api/handbook.md) | Источники, записи, словари, видимость, совместимость редакций и HTTP-вход MCP. |
| [API: игровые карты](api/maps.md) | Библиотека, сессионные 3D/2D-карты, модели и публичные проекции. |
| [API: сессии и сцены](api/sessions.md) | Основной контракт сессии, сущности сюжета, публичный экран и настройки видимости. |
| [API: обмен и общение](api/interactions.md) | Вещи, деньги, использование расходников, переписка, вызовы и инвентарь сессии. |
| [API: магия и действия хроники](api/session-actions.md) | Концентрация, цели, сохранённые броски, шаги атак и создание предметов. |

## Общие правила

- JSON keys — camelCase. Успешный JSON-ответ без значения сериализуется как `null`;
  ответы HTTP 204/304 остаются без тела.
- Ошибка — JSON `{ "type": "...", "desc": "..." }`.
- Session auth — cookies `sylvieshare-session-id` и
  `sylvieshare-session-uuid`; обе cookie имеют `HttpOnly`, `SameSite=Lax` и
  `Max-Age=2592000` (30 дней). Сервер также отклоняет `users_session` старше
  30 дней.
- `shared/api/http.js` считает любой non-2xx ошибкой.
- Старые route aliases и DTO fields не поддерживаются.
- Health: `GET /api/health` возвращает status, DB state и build `commitSha`.

## Игровые карты

[Endpoints, форматы tiles/image, публичные проекции и поля моделей](api/maps.md).

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
