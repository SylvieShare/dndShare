# API: справочник и MCP

Источники, записи, словари, видимость, совместимость редакций и HTTP-вход MCP.

← [HTTP API](../api.md)

## Видимость items

DTO item содержит `hidden: boolean`. `POST /api/items`, `PUT /api/items/{id}` и
MCP `handbook_item_create/update` принимают этот флаг; при создании он по умолчанию
`false`, при обновлении отсутствие поля сохраняет прежнее значение. Права те же,
что у редактирования записи. `/api/items`, `/search`, `/search-multi` и `/children`
не возвращают скрытые записи; `/api/items/by-ids` продолжает возвращать их в рамках
обычного доступа владельца/публичной записи. Скрытие не является ограничением доступа.

API реализован Go `net/http` в `internal/web`. Feature-файл регистрирует routes
через `registerRoutes`; список ниже описывает текущий публичный контракт.

## Источники и справочник

Item DTO содержит `changedAt` (серверное время изменения) и `deleted`.
Обычные reads исключают удалённые записи, в том числе lookup по ID.
`DELETE /api/items/{id}` устанавливает `deleted=true`; строка, связи и ссылки
на медиа сохраняются. Повторное удаление возвращает отсутствие записи.

## Синхронизация локального справочника

`GET /api/handbook/sync?sourceId=<system>&limit=200&cursor=<opaque>` требует
авторизацию. `sourceId` обязателен; размер страницы ограничен 1–250.
Отсутствующий cursor начинает полную загрузку публичных и собственных записей
выбранной игровой системы. Редакция фильтруется клиентом по `compatibility`.

Ответ содержит `protocol:1`, `entries`, `full`, `hasMore`, `serverTime`.
Элемент `entries` имеет `{id,revision,changedAt,deleted,item?}`; tombstone
при `deleted:true` передаёт только идентификатор и метаданные изменения.
В первой странице раунда `metadata` содержит `types`, `suggestTypes`,
`suggests` (map по type ID) и `books`. Эти небольшие таблицы обновляются целиком.
Встроенные SVG исключены; URL изображений передаются без загрузки файлов.

Пока `hasMore=true`, следующий запрос передаёт `nextCursor`. Последняя страница
возвращает `cursor` для следующего раунда и `visibleIds`: окончательный список
доступных ID системы. Клиент удаляет из локальной базы отсутствующие ID, включая
записи, перенесённые к другому владельцу или в другую систему. Чужой личный
контент не передаётся. Пустой delta может вернуть прежний cursor.

Курсор привязан к пользователю, системе, версии протокола и границам страницы.
Несовместимый или опережающий сервер курсор даёт HTTP 409
`SYNC_RESET_REQUIRED`: клиент начинает полную загрузку и сохраняет пригодную
локальную копию до успешного применения страниц. Ответы имеют `Cache-Control:no-store`.

Порог следующего раунда — серверная committed-ревизия начала текущего.
Новые изменения во время обхода могут попасть в текущую страницу и безопасно
повториться в следующем раунде. Дата устройства не участвует в отборе; время
`serverTime` предназначено для отображения. Страница и её cursor сохраняются
на устройстве одной транзакцией, поэтому прерванная загрузка возобновляется.

## Операции со справочником

- `GET /api/sources` → systems с `versions:[{id,sourceId,version}]`.
  Одинарного `source.version` нет.
- `GET /api/content-sources?sourceId=&sourceVersionId=` возвращает публикации с
  `kind`: `core`, `supplement`, `setting`, `adventure`, `playtest` или
  `third_party`;
- `GET /api/item-types` → типы с `fields` для справочного `item.data`,
  `instanceFields` для типизированного `params` конкретного экземпляра и
  nullable `iconImageId`/`iconImageUrl`, `coverImageId`/`coverImageUrl`;
  прежнего поля `svg` у item type нет. Для типа 18 («Сюжетные способности»)
  `countItems`/`count` считаются по публичным и собственным записям пользователя;
  при нуле UI скрывает каталог в навигации, сохраняя доступ к его picker;
- `GET /api/items` (`typeId`, pagination, publication scope and schema
  `filters`; например, подрасы: `typeId=16&filters={"race":123}`,
  подклассы: `typeId=17&filters={"class":456}`). Для типа 15 фильтр
  `effect_source` принимает массив `basic`, `magic_item`, `spell` (объединение
  по OR): базовые состояния/истощение/вдохновение или эффекты, связанные
  с доступными читателю магическими предметами и заклинаниями.
- `GET /api/items/by-ids?ids=`
- `GET /api/items/{id}/model` — основная 3D-модель публичного нескрытого итема:
  `{id,renderUrl,lodUrl,assetBytes:{render,lod},size,referenceDiameter,base?}`, `Cache-Control: no-store`.
  Необязательная `base` содержит visual-поля, собственный `referenceDiameter` и
  `surfaceHeight`: стабильная первая по UUID подставка `creature-base`
  размера `size`. Для существ size вычисляется по кодам словаря identity.size,
  для остальных итемов равен 1. Она загружается через
  `GET /api/items/{id}/model/base/render` или `/lod` с повторной проверкой
  видимости итема и основной привязки; произвольный UUID передать нельзя.
  `GET /api/items/{id}/model/render` и `/lod` отдают GLB без авторизации,
  после повторной проверки видимости и привязки. URL содержит `sha`; несовпадение
  текущей версии даёт 404. Ответы используют ETag/304 и immutable-cache для URL
  с актуальным SHA; ошибки хранения не кешируются. Личные, скрытые и непривязанные
  итемы дают 404; source/shadow и произвольные UUID моделей здесь недоступны.
- `GET /api/items/children?parentId=` — generic legacy-friendly traversal по
  `item.parent_id`; runtime выбора происхождения использует отдельные типы и
  schema-фильтры выше;
- `GET /api/items/search`, `GET /api/items/search-multi`; оба принимают
  publication scope, включая `sourceVersionId`, и ищут case-insensitive
  подстроку одновременно в русском `name` и английском `nameEn`.
- `GET /api/items/rule-references?kind=&q=` — типизированные ключи и источники
  из актуального JSON публичных и собственных предметов; поддерживает `itemId`,
  `excludeItemId`, `limit`, `offset`. Контракт и типы —
  [поиск связей](../features/ability-editor.md#поиск-связей).
- `GET /api/items/{id}/effect-sources?limit=&offset=` — обратные ссылки на эффект
  типа 15 из его сохранённого `data.application_sources`. Ответ: `{sources: [{itemId, key,
  target, condition}]}`; limit по умолчанию 40, максимум 100. Видимы только
  публичные и собственные источники; скрытый/несуществующий эффект даёт пустой
  список. Поиск читает одну запись эффекта и выбранные ID, без обхода справочников.
  Список поддерживается вручную; удалённые и недоступные источники не выводятся. Невалидный ID возвращает 400.
- `POST /api/items`, `PUT /api/items/{id}` — также принимают необязательные
  `automationStatus`, `automationNote`, `requiresPlayerInteraction` вне `data`.
  Пропущенные значения сохраняются при обновлении. Эти поля доступны в Item DTO
  и MCP `handbook_item_create/update`; [значения и ограничения](../features/item-automation.md).
- `GET /api/inventory/icon-presets` — public `{presets: [{id, itemTypeId, code, name, purpose, sortOrder, imageId, imageUrl}]}`. Only active images are returned. `purpose=item` is selectable for simplified entries; `empty_cell` is reserved for empty bag cells.
- `POST /api/items/{id}/make-base`
- `POST /api/items/{id}/icon-image` (multipart PNG/WebP, максимум 5 МБ)
- `DELETE /api/items/{id}/icon`
- `POST /api/items/{id}/cover-image` (multipart PNG/WebP/JPEG, максимум 5 МБ)
- `DELETE /api/items/{id}/cover`
- `DELETE /api/items/{id}`

Изображения меняет автор объекта или администратор справочника. Замена обложки
не меняет иконку и наоборот; снятые изображения очищаются только при отсутствии
других ссылок.

Item DTO содержит `customSourceId` только у пользовательского контента. При
`POST /api/items` сервер в одной транзакции получает/создаёт default
`custom_item_source` владельца и записывает FK; клиент не передаёт ownership в
JSON `data`. `contentSourceIds` остаётся отдельной метаданной публикаций и не
заменяет персональный источник.
Для типов 8/16 и 9/17 DTO возвращает взаимные item-ссылки в `data`:
`subraces[]`/`race` и `subclasses[]`/`class`. Обратные массивы базовой записи
readonly и пересчитываются БД; клиент изменяет обязательную связь со стороны
варианта.

Все item reads по id/parent и suggest reads по ids возвращают только базовые
строки и строки текущего пользователя; анонимный и MCP catalogue read видит
только базовые. Update/delete владельца не может затронуть чужую строку,
HANDBOOK_ADMIN сохраняет явный административный доступ. Роль ADMIN также
разрешает обновлять данные и иконку записи; автор может редактировать собственную
запись. Пользовательская форма не передаёт `contentSourceIds`, поэтому создание
не требует выбора публикации, а обновление сохраняет прежние связи. Make-base очищает
персональную связь источника и систематизирует владельца растровой иконки.

Item reads проецируют иконку как `iconSvgId` + `svg` либо как `iconImageId` +
`iconImageUrl`. Upload атомарно регистрирует объект в `storage_image`, связывает
его с item и заменяет прежний формат; clear удаляет любую иконку. Системная
иконка имеет `storage_image.user_id = NULL`, пользовательская принадлежит
владельцу item.

Независимая панорамная обложка проецируется nullable-полями `coverImageId` и
`coverImageUrl`. Она не заменяет иконку и не хранится внутри `data`; удалённая
или отсутствующая строка `storage_image` даёт штатный header fallback без URL.

Любая новая пользовательская загрузка сохраняет владельца, фактический размер,
исходное имя и MIME: это относится к общим изображениям/видео, item icon,
музыкальным трекам и SVG подсказок. Системные объекты остаются без владельца и
не включаются в статистику аккаунта.

Item list/search поддерживает publication scope через `contentSourceIds`,
`sourceVersionId` и `allowLegacy`. Здесь Legacy — статус контента конкретной
редакции правил, а не поддержка старого API/формата данных.

Item DTO дополнительно содержит `modelId`, если у публичной нескрытой записи
есть основная 3D-модель. Это проекция из `item_model`, определяемая одним запросом
на выдачу; тип итема не ограничен бестиарием. Поле не записывается в `data`.
Подробности UI и выбранной модели — [3D-модели итемов](../features/item-models.md).

Suggest API:

- `GET /api/suggest/types`, `/search`, `/batch`; `types` и `search` принимают
  `sourceId` для ограничения одной игровой системой;
- `GET /api/suggest/{typeId}` и `/{typeId}/items`;
- create/update/delete, make-base и SVG upload routes под
  `/api/suggest/{typeId}/...`.

Suggest DTO дополнительно проецирует `iconImageId` и `iconImageUrl` из общего
`storage_image`; URL отсутствует у удалённой картинки. В записи саджеста
хранится только внешний ключ `icon_image_id`. PNG/WebP для базовых саджестов
устанавливает MCP `handbook_suggest_set_system_image`: `typeId`, `id`,
`fileName`, `mimeType`, обычный `dataBase64` (до 5 MB) и необязательный
`preservePrevious`. Ответ содержит обновлённый `suggest`, `imageId`,
`objectKey`, `fileSize`, `preservedPrevious`. Обычное редактирование текста
сохраняет обе иконки; растровая имеет приоритет над SVG.

Suggest identity в HTTP — пара `(typeId,id)`. Новые id (пользовательские и
базовые) выдаются общей DB sequence конкурентно-безопасно, поэтому новые
пользовательские ids не пересекаются между владельцами; существующие базовые
пары `(typeId,id)` не перенумеровываются.

## MCP

`handbook_item_update` передаёт полное `data` записи. Для исправлений заклинаний
клиент сначала читает актуальную запись, изменяет только проверенные поля и
сверяет результат повторным чтением. Формат прогрессии и отдельных бросков
описан в [схеме справочника](../database/handbook.md#справочник).

Session authoring tools use the bearer-authenticated MCP endpoint and never
expose participant or character-sheet data:

- `sessions_list({ownerLogin})` lists active sessions owned by one exact login;
- `session_adventure_get({ownerLogin,sessionUuid})` returns the complete authored
  campaign projection: arcs, chapters, scenarios, blocks, graph edges, world
  entities and materials;
- `session_adventure_import({ownerLogin,document})` creates a session from one
  portable JSON document. The document uses stable local keys instead of
  database ids. All keys, system catalogue images and cross-references are
  resolved in one transaction; any invalid reference rolls back the entire
  import. Portable materials are limited to `text` and `note`; uploaded binary
  assets remain a separate owner-authenticated storage workflow. The mutation
  requires `MCP_WRITE_ENABLED=true`.

`POST /mcp` — bearer-authenticated JSON-RPC endpoint. Его tool contract описан
в [mcp](../features/mcp.md); он не имеет HTTP compatibility aliases.

## Явная совместимость D&D

Item DTO содержит `compatibility[]` (`sourceVersionId`, `version`, `status`,
`replacedByItemId`, `note`) и `derivedFromItemId`/`derivationKind`. Новые ссылки
в персонаже допускают только `native`/`compatible`; чтение сохранённых ID не
подменяет версию. `allowLegacy=true` добавляет просмотр `legacy` и
`requires_adaptation`, но не разрешает их выбор.

- `PUT /api/items/{id}/compatibility`: `{compatibility:[...]}`, автор или admin.
- `POST /api/items/{id}/variant`: `{sourceVersionId,kind}`, создаёт личный
  черновик revision/adaptation, возвращает Item DTO.
- `POST /api/content-sources/compatibility-review`: admin preview/apply с
  `contentSourceId`, `sourceVersionId`, `status`, `apply`, `previewToken`.
- Обычные item create/update принимают совместимость атомарно с данными;
  отсутствие поля на update сохраняет решения, пустой массив очищает их.
- Session create/read содержит `sourceVersionId`; ответы участников — редакцию
  конкретного персонажа. Разные редакции не меняют сохранённые листы.

Нарушения правил возвращают HTTP 400 с объяснением. Подробный контракт и границы
автоматизации: [редакции D&D](../features/rules-editions.md).

План применения проверяет `status_effects[].apply_on`: `cast` для сотворения
и запроса применения заклинания, `impact` для результата хроники. Запрос с
ключом эффекта другого этапа отклоняется. Содержимое самого `usable` является
самостоятельным применением расходника. Объявленный спасбросок сохраняет
фиксированную `save_dc`, когда она задана у соответствующего этапа.

Повторный спасбросок эффекта использует существующее владельческое обновление
листа или редактирование боя мастером. `dice_roll.data.effectSave` содержит
`effectUid`, `ability`, `dc`, `success`, `ended`, `note`; `result.note` — общая
подпись результата в уведомлении и хронике. Повторный бросок не является новым
сотворением и не расходует ячейку. Сл из `repeat_save` сохраняется в плане
наложения до передачи эффекта другому участнику.

## Связанные страницы

[Оглавление wiki](../README.md) · [HTTP API](../api.md) · [Handbook](../features/handbook.md) · [БД: справочник](../database/handbook.md)
