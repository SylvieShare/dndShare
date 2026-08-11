# Database and startup migrations

PostgreSQL принадлежит Go-бэкенду. Единственный источник структуры —
упорядоченные файлы `internal/store/schema/*.sql`. `schema.go` встраивает их в
бинарь и выполняет одной транзакцией при каждом старте до регистрации
HTTP-сервиса. Liquibase и отдельного Kotlin backend в проекте нет.

## Правила

- Все объекты находятся в схеме `dndshare`.
- DDL и data correction должны быть идемпотентны: `IF NOT EXISTS`, проверяемый
  `UPDATE`, `ON CONFLICT` или временная функция, которую в конце удаляют.
- Приложение работает только с финальной схемой. Временные колонки можно
  добавить для чтения старых данных внутри соответствующего `schema/*.sql`, но
  после переноса их нужно удалить в том же startup script.
- Read-time миграции, fallback на старые JSON-ключи и постоянные one-shot admin
  jobs запрещены.
- `jsonb` читается как `json.RawMessage`, при записи используется явный cast в
  `jsonb`. UUID читается как text и записывается с `::uuid`.
- Для внешнего ключа добавляется индекс на child-column; PostgreSQL не создаёт
  его автоматически.

Изменение, которое нарушает совместимость, не требует поддержки старого
клиента. Требуется преобразовать хранящиеся данные к новому контракту и удалить
старый контракт.

## Основные области

### Пользователи

`users`, `role`, `users_role`, `users_session`. Актуальные роли:
`ADMIN`, `HANDBOOK_ADMIN`, `ERROR_REPORT_AUTO_APPROVE`,
`ERROR_REPORT_REVIEWER`. Роли редактора шаблонов нет, потому что шаблоны
находятся в коде.

### Персонажи

`char_template` содержит только `id` и `name`. `char` хранит владельца,
template id, `source_version_id`, JSON документа, public/deleted flags,
техническую `version` и timestamps.

Игровая система определяется через `source_version → source`. Создание
персонажа требует конкретный `source_version_id`; сервер не подставляет версию
по умолчанию.

Канонический D&D JSON:

- `values.race/subrace` — `{id,name}`;
- `values.classes` — `[{id,name,level,subclass}]`; отдельных зеркал
  `class/subclass` нет;
- `values.lvl` — `{level,exp}`;
- `STR..CHA.value` — `{base,bonuses}`;
- `speed` — `{base,bonuses}`;
- `initiative` — `{base,bonuses,use_dex}`;
- `ava` — `{url,upload_id?}`;
- `hp.hitDice` — `[{die,total,used}]`;
- `spells` — `{stat_path,save_bonus,attack_bonus,slots_rest,preparation,spells,slots}`;
- `items` — `{equipped,sections}`;
- `money` — `{order,amounts}`.

Startup data correction переводит прежние значения в этот вид и удаляет старые
ключи. Vue-компоненты знают только этот контракт.

### Справочник

`source` — игровая система, `source_version` — редакция правил.
`content_source` — книга/публикация, а
`content_source_compatibility` задаёт её доступность для редакции.
`item_version_compatibility` может переопределить статус отдельного item.

`item_type` хранит schema fields типа, `item` — контент, `suggest_type/suggest`
— словари. `item.parent_id` — единая связь для подрасы, подкласса и других
вариантов. `item_content_source` связывает item с публикациями.

Кубики не являются словарём: поля схемы используют `type:"dice"`, а сохранённое
значение — строка `"d4"`, `"d6"`, `"d8"`, `"d10"`, `"d12"`, `"d20"` или
`"d100"`. Startup-схема переводит поля бывшего suggest type 11 на системный тип,
конвертирует его последовательные id `1..7` в эти строки и удаляет строки
устаревшего справочника.

Персональное происхождение контента хранится отдельно от этих двух понятий:
`custom_item_source` принадлежит пользователю и описывает его набор собственных
материалов, а `item.custom_source_id` является явным FK. Для каждого пользователя
есть ровно один default source «Мои материалы»; частичный unique index не мешает
добавить несколько non-default sources в будущем. Составной FK
`(custom_source_id,user_id)` запрещает привязать item к источнику другого
пользователя. У базовых item оба поля равны `NULL`.

Startup migration идемпотентно создаёт default source существующим пользователям,
проставляет его всем сохранённым пользовательским item и удаляет прежние
`customSourceId`/`custom_source_id` из JSON. Новые item получают default source
атомарно при `INSERT`; runtime не читает JSON fallback. При make-base сервер
одновременно очищает `user_id` и `custom_source_id`.

Новые `suggest.id` выдаёт общая sequence, поэтому конкурентные вставки разных
пользователей не пересекаются и не используют `MAX(id)+1`. Существующий API
по-прежнему идентифицирует suggest парой `(type_id,id)`, так что явные id базовых
suggest остаются валидны; составной primary key обеспечивает этот контракт.

Актуальные связи:

- способности рас/классов используют только массивы `race_ids`,
  `subrace_ids`, `class_ids`, `subclass_ids`;
- заклинания используют `classes: [{id: classItemId}]`;
- черты используют `description`, `prerequisite_groups`, `choices`;
- стоимость `int_by_suggest` хранится как `{value,suggest_id}`.

При старте `schema/02_handbook.sql` переносит старые одинарные bindings, spell
class ids, ключи черт и source metadata, затем удаляет исходные поля. Отдельных
`migrate-ability-binding`, `migrate-spell-classes` и подобных admin jobs нет.

### Сессии

`session`, `session_participant`, главы, сцены, encounters, events и состояние
музыки находятся в одной схеме. Participant brief читает аватар по
каноническому D&D пути; полей template path map нет.

Encounter combatant хранит ссылку `itemId` и пользовательский `override`.
Старые embedded `itemRaw` и денормализованные name/ac/hp поля переносятся в
startup migration и не обрабатываются во frontend.

### Музыка и storage

`music_track`, `music_album`, `music_tag` и link tables хранят metadata и
порядок; аудио лежит в object storage. Изображения справочника и персонажей
используют `storage_image`/S3, SVG справочника — `svg_storage`.

### Error reports and jobs

`error_report` хранит lifecycle `OPEN → IN_PROGRESS → RESOLVED → ARCHIVED`,
lease metadata, screenshots, serious-change approval и resolution.
`error_report_message` — диалог AI/reviewer;
`error_report_automation_lock` — singleton lease автоматизации.

`job_run` хранит историю фоновых операций. В реестре остаются регулярный
пересчёт counters и импорт бестиария; преобразование форматов данных выполняет
startup schema, а не job registry.

## Как менять схему

1. Добавить финальное DDL в логический файл `internal/store/schema/*.sql`:
   foundation, handbook, characters, sessions или seed. Порядок файлов задаёт
   зависимости и не должен меняться неявно.
2. Если есть старые данные, перед удалением старого поля выполнить
   идемпотентный `UPDATE`/временную функцию.
3. Удалить старую колонку/JSON key и runtime fallback в том же изменении.
4. Обновить читаемый schema-файл в `resources/items/`, если менялись fields
   item type.
5. Запустить `go test ./...`, `go build ./...`, `go vet ./...` и frontend tests.
6. Деплой является фактической проверкой SQL на production schema; readiness
   должен подтвердить новый commit SHA.
