# MCP endpoint

MCP реализован в `internal/web/mcp*.go` как JSON-RPC 2.0 over `POST /mcp`.
`mcp.go` содержит transport/dispatch, а tool schemas, аргументы и mutations
вынесены в тематические файлы. GET/SSE transport и Spring AI отсутствуют.

## Access

- Authorization: `Bearer $MCP_AUTH_TOKEN`.
- Read tools доступны при корректном token.
- Write tools дополнительно требуют `MCP_WRITE_ENABLED=true`.
- Protocol methods: `initialize`, `ping`, `tools/list`, `tools/call`.

Ошибки transport/protocol возвращаются как JSON-RPC errors; tool-level ошибка
возвращается в tool result. Имена аргументов являются частью текущего контракта:
aliases для прежних имён не поддерживаются.

## Handbook tools

Read:

- `handbook_sources`;
- `handbook_item_types`;
- `handbook_items`, `handbook_items_search`, `handbook_items_get`;
- `handbook_suggest_types`, `handbook_suggests`,
  `handbook_suggests_search`.

Write:

- `handbook_item_create`, `handbook_item_update`, `handbook_item_delete`;
- `handbook_item_set_content_sources`;
- `handbook_item_set_system_image`;
- `handbook_item_type_set_system_image`;
- `inventory_icon_preset_set_image`;
- `handbook_bestiary_migrate_icons_to_covers`;
- `handbook_suggest_create`, `handbook_suggest_update`,
  `handbook_suggest_set_svg`, `handbook_suggest_delete`.

Tool schemas должны совпадать с текущей item/suggest model. При обновлении item
передаются все поля данных, которые нужно сохранить. Источники книг меняются
отдельно через `handbook_item_set_content_sources(id, contentSourceIds)`: этот
write-tool транзакционно заменяет только source links, проверяет принадлежность
источников системе item и возвращает обновлённую запись. Данные item и медиа
остаются прежними.

### Установка системных изображений

`handbook_item_set_system_image` — основной runtime-путь для установки и
замены новых изображений базовых item. Tool принимает `itemId`, `slot`
(`icon` или `cover`), `fileName`, точный `mimeType`, `dataBase64` и опциональный
`preservePrevious`. В
`dataBase64` передаётся обычный standard base64 без `data:`-префикса.

- tool требует `MCP_WRITE_ENABLED=true` и принимает только item с
  `user_id IS NULL`; пользовательский контент через него изменить нельзя;
- иконка может быть PNG/WebP размером до 5 МБ, обложка — JPEG/PNG/WebP до
  10 МБ; MIME сверяется с сигнатурой фактических байтов;
- объект загружается в S3 по content-addressed ключу
  `system-item-media/v1/items/{itemId}/{slot}/{sha256}.{ext}`;
- запись `storage_image` создаётся или активируется идемпотентно, после чего
  выбранная ссылка item меняется в одной DB-транзакции. Для `icon` также
  очищается прежний `icon_svg_id`, `cover` остаётся независимым;
- по умолчанию прежняя непривязанная картинка помечается удалённой и её
  S3-объект удаляется. `preservePrevious=true` оставляет прежнюю строку активной
  и сохраняет S3-объект для возврата или будущего стилевого набора;
  повторная установка тех же байтов использует тот же ключ и строку;
- ответ содержит обновлённый item и метаданные установленного изображения.

`handbook_item_type_set_system_image` использует тот же контракт байтов,
слотов, MIME, лимитов и `preservePrevious`, но принимает `typeId`, назначает
медиа в `item_type.icon_image_id` или `item_type.cover_image_id` и возвращает
обновлённый `itemType`. Его content-addressed namespace —
`system-item-media/v1/item-types/{typeId}/{slot}/{sha256}.{ext}`. Типовая
обложка является fallback: собственная обложка item всегда имеет приоритет.

`inventory_icon_preset_set_image` publishes a named inventory preset using
`typeId`, stable lowercase `code`, `name`, `purpose` (`item`/`empty_cell`), optional
`sortOrder` (0–10000) and the standard icon `fileName`, `mimeType`, `dataBase64`,
`preservePrevious` contract. It requires MCP writes, accepts PNG/WebP up to 5 MB,
and atomically upserts the preset plus system storage row. Repeating `(typeId,code)`
retains the preset ID; repeating bytes reuses the image. It returns `{preset,
objectKey,fileSize}`. Empty-cell art is separate from selectable icons.

`handbook_bestiary_migrate_icons_to_covers` переносит уже существующие
растровые изображения базовых существ из `icon_image_id` в `cover_image_id`,
не загружая и не удаляя S3-объекты. Занятые обложки никогда не
перезаписываются, пользовательские item не затрагиваются, а переданные
`excludeItemIds` остаются без изменений. По умолчанию tool выполняет dry-run и
возвращает `candidateCount`; применение требует `apply=true`, включённых write
operations и точного `expectedCandidateCount` из последнего dry-run. У
перенесённых `storage_image` тип нормализуется в `item_cover`.

Общий JSON body `/mcp` ограничен 16 МБ: этого достаточно для 10 МБ бинарной
обложки после base64-кодирования и JSON envelope. Встроенные каталоги, уже
закреплённые ручными manifest-driven sync-командами, остаются воспроизводимым bootstrap;
для новых сгенерированных изображений отдельный sync-бинарь не требуется.

## Tool results

JSON-returning tools expose the typed value as `structuredContent.result`
and keep the serialized value in the text content block. Clients should
validate the typed value when `structuredContent` is available.

## Changing MCP

When adding or changing a tool, update together:

1. dispatch in `internal/web/mcp.go`;
2. `tools/list` schema in `internal/web/mcp_tool_defs.go`;
3. argument validation in `internal/web/mcp_args.go` and permission checks;
4. smoke/contract tests in `internal/web`;
5. this page and any feature-specific documentation.

Do not leave deprecated tool names or argument aliases after the caller/data
migration is complete.

## Импорт и совместимость редакций

`handbook_item_create/update` принимают `compatibility`, `derivedFromItemId` и
`derivationKind`. Все каталожные list/search/children и type counts принимают
тот же edition/publication scope, что HTTP. Личная адаптация создаётся через HTTP `/api/items/{id}/variant`; `handbook_publication_compatibility_review` предоставляет
preview/apply для ещё не размеченных записей книги.

`handbook_edition_import` атомарно публикует конкретные версии со стабильными
ключами и символическими ссылками. Preview проверяет реальный путь записи с
rollback; apply требует точный token и включённые MCP writes. Повтор не
перезаписывает ручные изменения. Формат и процесс: [редакции D&D](rules-editions.md).

Новые записи не получают редакцию по названию или публикации. При создании
передавайте явный `compatibility`; отсутствие решения оставляет объект вне
редакционного выбора. Для создаваемых заклинаниями предметов проверенный импорт
использует native-редакцию конкретного заклинания, не его legacy/compatible
связи с другими редакциями.

## Плитки 3D-редактора

Каталог и передача файлов поддерживаются отдельными tools:

- `map_tile_models_list`: метаданные и assets, опциональный фильтр collection.
- `map_tile_model_get`: одна версия по UUID.
- `map_tile_asset_prepare_upload`: kind, fileName, SHA-256 и size; возвращает
  временный S3 uploadKey, подписанный PUT URL на 15 минут и необходимые headers.
- `map_tile_asset_complete_upload`: тот же descriptor и uploadKey. Сервер читает
  S3-объект, проверяет размер, SHA-256 и формат, копирует его в постоянный
  content-addressed key и удаляет временный объект. Прежние версии не заменяются.
- `map_tile_model_register`: полный model object с именами, sourceCode, версией,
  типом, местностью, схемой стен, геометрией и assets render/lod/shadow/preview/source. Если shadow не указан,
  наследует его от совместимой версии или назначает загруженный LOD. Проверяет наличие
  и SHA-256 всех файлов; идентичный повтор идемпотентен. Изменение требует нового
  UUID и номера версии.

- `map_tile_model_register_shadow`: id существующей модели, expectedLodSHA256
  и asset, полученный после complete_upload. Проверяет только новый shadow GLB
  и добавляет совместимую неизменяемую версию; остальные assets и параметры
  сохраняются. Номер версии выделяется под блокировкой семейства. При смене LOD
  или несовместимой правке возвращает конфликт; одинаковая геометрия идемпотентна.

Файлы отправляются клиентом напрямую в Object Storage; JSON-RPC переносит
только метаданные и подписанные ссылки. SSH и base64-передача моделей на VM
не нужны. Все write-tools требуют MCP_WRITE_ENABLED. Допустимые файлы:
render/lod/shadow GLB до 32 МиБ, preview WebP до 4 МиБ, source binary STL или GLB
до 256 МиБ. GLB должен содержать геометрию и встроенные ресурсы без внешних URI.
Подписанные URL и MCP-токен не следует выводить в лог. Незавершённые временные
объекты можно очищать lifecycle-правилом S3 для map-model-uploads/.

Готовый клиент `cmd/map-model-upload` проверяет локальные hashes, запрашивает
URL через MCP, выполняет PUT прямо в S3 и регистрирует модели. Нужен
MCP_AUTH_TOKEN, `-assets` указывает папку content-addressed файлов с
catalogue.json; endpoint по умолчанию https://dndshare.ru/mcp.

Каталог поддерживает единый `tileType`: `floor`, `wall-straight`, `wall-angle`,
`wall-tee`, `wall-cross`, `wall-end`, `wall-corner`, `wall-diagonal`, `stairs`, `frame`, `bridge`, `passage`, `column`, `object`.
`collection`/`collectionName` задают пак; отдельных terrainType и wallLayout нет.
Также поддерживаются `collectionName`,
`wallMode=center/edge/none`, `wallMask` и `supportSlots` с целыми координатами и
размерами, а также относительной высотой `elevation`. Слоты проверяются на выход
за площадь, пересечение и высоту. При регистрации сохраняются в PostgreSQL;
read API возвращают их в каталоге. Импортёр допускает 1–8 параллельных моделей,
пропускает уже зарегистрированные UUID и возобновляет прерванную загрузку.
Файлы с точно совпадающим asset descriptor, уже зарегистрированные в каталоге,
не передаются повторно; tool регистрации снова проверяет их наличие и SHA-256
в S3. Это позволяет цветным версиям использовать прежний source STL.
MCP возвращает неизменяемые версии как сохранены; автоматический выбор совместимой
визуальной версии выполняется только read API редактора и экрана карты.
`mountDepth` задаёт глубину монтажной части ниже корпуса в клетках. Геометрия
файла остаётся на исходном нуле; surfaceHeight/maxHeight и elevation пазов
измеряются от его низа. Глубина конечна, неотрицательна, не выше surfaceHeight;
паз находится выше основания корпуса. Для файла с нулём по корпусу используется
ноль. Поле входит в неизменяемые метаданные версии. `-snapshot /path/registry.json`
у импортёра сохраняет зарегистрированные метаданные без загрузки файлов.

`textureDetail` — обязательный уровень текстурной проработки версии:
`basic` (поверхностная) или `detailed` (детальная). Сохраняется в
`dndshare.map_model.geometry` и возвращается через MCP без подмены исторической
версии. Для детальных UD-006/009/010/013 отмечены конкретные подготовленные render
assets; остальные версии имеют `basic`. Поле не влияет на площадь, стыки, LOD
или выбор совместимой визуальной ревизии. В read API редактора/публичной карты
оно соответствует используемым render/lod/preview, а не старому UUID размещения.

`width/height` описывают занимаемые клетки основания. Декоративная геометрия
может выступать за эти клетки: UD-020 (обломанный мост) и UD-078 (арка) занимают
1×1. `placementOffset=[x,z]` сдвигает центр GLB к монтажному основанию в клетках;
смещение применяется в локальных осях модели перед поворотом. Оно сохраняется
в PostgreSQL и проверяется на конечность и диапазон −8…8. Контуры blockers
заданы в координатах занятой площади, с учётом этого смещения. Выделение и
наведение используют полную геометрию, включая свесы. Изменение привязки
несовместимо с визуальной ревизией другой привязки.

Модели объектов используют тот же MCP/S3 pipeline с tileType=object. Каждая версия
также хранит hasDecor/canStand/hidden и placementPoints [{x,y,elevation}]; точки
общие для размещения объектов и персонажей. Hidden-модели не предлагаются в
новом каталоге, но сохраняют assets и доступ для прежних документов. Новые
версии скрытого семейства остаются скрытыми.

## Связанные страницы

[Оглавление wiki](../README.md)
