# API: персонажи

Шаблоны, создание и чтение листа, журнал, иконки и сохранение документа.

← [HTTP API](../api.md)

## Персонажи и шаблоны

Сохранение персонажа с удалёнными пользовательскими плитками отклоняется с
HTTP 400 и сообщением «Обновите страницу: плитки больше не поддерживаются».
Это относится к созданию, полному сохранению и изменениям по путям. Содержимое
плиток в актуальных ответах персонажа отсутствует.

`PUT /api/char/{uuid}/edition` — только владелец неудалённого персонажа.
Тело: `{ "sourceVersionId": 2, "version": 7, "confirmed": true }`.
Все поля обязательны. Редакция должна существовать и принадлежать той же системе;
неверная редакция или отсутствие подтверждения — 400, чужой/удалённый лист — 404,
устаревшая версия — 409. Операция атомарно меняет редакцию, `changed_at` и версию;
содержимое листа не конвертируется. Выбор текущей редакции не увеличивает версию.
Ответ — полный документ в формате `GET /api/char/{uuid}` с новой редакцией и
версией. Событие изменения листа уведомляет сессию, а открытые листы
с контекстом сессии обновляют и документ, и профиль расчётов через обычный
polling. Без контекста сессии устаревшее окно защищено проверкой версии при
сохранении и требует обновления страницы.

- Public `GET /api/templates` → `{templates:[{id,name}]}`. Он используется
  гостевым wizard до запроса авторизации; template schema/create form/path maps
  не возвращаются.
- `GET /api/chars` → `{chars,sessionsByChar}`; строка персонажа содержит
  nullable `iconImageId/iconImageUrl`.
- `POST /api/chars` принимает
  `{templateId,sourceVersionId,iconImageUploadId?,data}`. `sourceVersionId`
  обязателен и должен существовать. Необязательный `iconImageUploadId` должен
  указывать на активную подготовленную `character_icon` текущего пользователя;
  при создании она связывается с `char.icon_image_id`.
- `POST /api/chars/poll`
- `GET /api/char/{uuid}` → template/source metadata, data, visibility,
  owner id, technical version и nullable `iconImageId/iconImageUrl`. DB
  template JSON в ответ не включается.
- `GET /api/char/{uuid}/version`
  Чтение листа и его версии доступно анонимно для публичного листа;
  закрытый лист доступен владельцу и мастеру неудалённой сессии, в которой
  участвует этот персонаж. Для остальных запрос возвращает 401.
- `GET /api/char/{uuid}/sessions`
- `GET /api/char/{uuid}/journal` returns the selected accessible journal,
  owner-only source choices and the effective edit/source-selection flags;
- `POST /api/char/{uuid}/journals` creates the character's only personal journal
  or selects and returns it if it already exists (including all sections);
  the UI calls it automatically with an empty name on the owner's first visit
  without a selected accessible journal; the default name is `Личный дневник`.
  Reading the journal endpoint itself does not create data.
  `PUT /api/char/{uuid}/journal-source` selects an eligible personal or session
  journal by UUID. Personal choices are restricted to this character, not other
  characters of the same owner; session choices exclude deleted sessions;
- `PUT /api/char/{uuid}/data`
- `PATCH /api/char/{uuid}/data-patch`
- `PUT /api/char/{uuid}/public`
- `POST /api/char/{uuid}/icon-image` принимает PNG/WebP-иконку до 5 МБ и
  разрешением не более 256×256 от владельца персонажа либо мастера сессии, в
  которой он участвует. Сервер не масштабирует и не кадрирует изображение;
  валидная загрузка атомарно заменяет прежнюю.
- `DELETE /api/char/{uuid}/icon-image` снимает назначенную компактную иконку и
  очищает больше не используемый объект хранилища.
- `POST /api/char/{uuid}/clone` — требует входа и права просмотра исходного
  листа (владелец, публичный лист или мастер его сессии). Создаёт копию
  для текущего пользователя и возвращает `{uuid}`; сессии и запросы передач
  не копируются.
- `DELETE /api/char/{uuid}`

Owned storage images can be read through authenticated
`GET /api/storage/images/{id}`. The same-origin stream exists for browser image
editing/canvas use and does not expose another user's object. A multipart upload
to `POST /api/storage/images` with `purpose=character_icon` accepts only PNG/WebP
up to 256×256 and records a staged icon that can be consumed by character create.

Editor определяет schema по `templateName` через frontend setting registry.
`PUT /api/char/{uuid}/data` accepts `{data,version,events?}` and returns `{version}`;
`version` is the loaded technical revision. A stale full save returns HTTP 409
without modifying the document or appending events. Each optional event has
`{sessionUuid,type,action,data,visibility,clientActionId}`; the character update
and authorized timeline inserts commit in one database transaction. For a
participant the route binds the actor to this owned session character; for a
DM editing a participant sheet it binds that character while retaining the DM
as the event author. Character-sheet event types include `feature_state` for
ability toggles and `status_effect` for adding or removing linked effects.

## Связанные страницы

[Оглавление wiki](../README.md) · [HTTP API](../api.md) · [Документ персонажа и сохранение](../features/character-editor/data.md) · [БД: персонажи и инвентарь](../database/characters.md)
