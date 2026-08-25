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
находятся в коде. `users.source_version_id` — обязательный FK глобально
выбранной игроком редакции. Система определяется через `source_version → source`
и не дублируется в `users`. Startup migration и trigger назначают DND5e 2014
существующим и новым аккаунтам до первого пользовательского выбора.

### Персонажи

`char_template` содержит только `id` и `name`. `char` хранит владельца,
template id, `source_version_id`, JSON документа, public/deleted flags,
техническую `version`, timestamps и nullable `icon_image_id → storage_image`.
Иконка является отдельным квадратным представлением персонажа для компактных
списков; основной портрет остаётся в каноническом JSON `values.ava`.

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
- `abilities_race`, `abilities_class`, `abilities_feats` — item-reference arrays
  with the available usage counter in `count`; a manual per-character maximum is
  present only when the handbook item enables `manual_size`.

Startup data correction переводит прежние значения в этот вид и удаляет старые
ключи. Vue-компоненты знают только этот контракт.

### Справочник

`source` — игровая система, `source_version` — редакция правил.
`content_source` — книга/публикация, а
`content_source_compatibility` задаёт её доступность для редакции.
`content_source.kind` хранит одну каталоговую категорию: `core`, `supplement`,
`setting`, `adventure`, `playtest` или `third_party`. Постоянная SQL-функция
`classify_content_source_kind(code)` является единым правилом для startup-
нормализации и импорта новых источников; неизвестный код получает
`supplement`, пока не будет классифицирован явно.
`item_version_compatibility` может переопределить статус отдельного item.

`item_type` хранит schema fields типа, `item` — контент, `suggest_type/suggest`
— словари. `item_type.parent_type_id` образует иерархию коллекций: «Оружие»,
«Зелья», «Доспехи», «Транспорт» и «Инструменты» являются прямыми
подразделами «Вещей». Корневая коллекция может включать предметы всех дочерних
типов в picker, не смешивая сами справочные записи. `item.parent_id` — отдельная
связь между записями для подрасы, подкласса и других вариантов.
Типы 3, 4 и 7 описывают использования единым ресурсным контрактом. Фиксированный
максимум задаётся `max_use`; формула от характеристики использует
`max_use_stat`, `max_use_stat_multiplier`, `max_use_bonus` и `max_use_min`;
формула от уровня класса — `max_use_level_multiplier`; флаг `max_use_scaling`
берёт актуальное `uses` из `scaling` (`uses: 0` означает, что с этого уровня
ресурс стал неограниченным и его строка больше не нужна). `use_resources` содержит несколько
независимых счётчиков одной способности с собственными названиями, порогами
уровня и правилами отдыха. `rollback_short_rest_level` включает восстановление
на коротком отдыхе с указанного уровня, а пара `short_rest_recovery` /
`short_rest_recovery_level` описывает частичное восстановление. Startup section
`32_ability_resources.sql` и последующие дополнения идемпотентно поддерживают эти
поля в schema `item_type`; вычисленный максимум в JSON персонажа не дублируется.
Class/subclass items use `caster_progression` (`full`, `half`, `halfup`,
`third`, `pact`) as the canonical spell-slot contribution. Nested
`spellcasting` data may additionally contain `list_class`,
`known_progression`, `allowed_schools` and `unrestricted_progression` for
known-spell pickers. Ability choices may combine dictionaries through
`suggest_sources`, require an owned proficiency and exclude an already reached
rank. `display_scaling [{level,label}]` is presentation data resolved against
the owning class level.
`weapon_damage` describes optional damage rolls contributed by abilities, race
traits or feats: eligible weapon kind, damage die, fixed or level-scaled count,
critical multiplication and menu labels. Section
`47_weapon_damage_actions.sql` publishes Sneak Attack through this contract;
the sheet derives its current d6 count from the owning Rogue level.
`sheet_widgets` publishes prominent ability-owned panels without class or item-id
checks. Widget definitions select metric/toggle/note presentation, a value source,
resource binding, tone and shared panel key. Section
`48_feature_sheet_widgets.sql` adds the contract and configures Sneak Attack and
Rage as its first consumers. A toggle may bind to `status_effect_key`; that
effect instance, rather than `widget_states`, is the canonical active state.
`49_roll_adjustments.sql` adds source-owned automatic d20 adjustments to race,
class ability and feat schemas. Reliable Talent declares a level-11
`minimum_natural` adjustment for ability checks with at least full proficiency;
runtime matching uses the structured scope and proficiency rank rather than the
feature title or item id.
`50_feature_actions.sql` adds the generic `feature_actions` object-array field
to class abilities, racial abilities and feats. Each row describes action
economy, display text, read-only requirements, level and priority, and may bind
the action to the source ability resource or reference standard combat actions
by their stable suggest type-24 codes. The startup catalog configuration
locates the initial Rogue consumers by stable English identity; runtime only
reads the structured rows. Character-created actions are stored separately in
`char.values.actions` and remain editable.
`51_status_effects.sql` creates item type 15 (`Эффекты`) and the generic
`status_effects` link array on abilities, racial abilities, feats and spells.
Catalogue items keep polarity, stacking, duration, concentration, derived
bonuses and defenses. Character `values.states` contains source-owned runtime
instances with bound parameters; legacy suggest-type-9 state ids and active
Rage widget flags are migrated to that format. Rage and Shield of Faith are the
initial automatic consumers, while all former condition suggests are imported
as negative effect items for manual selection.
`52_status_effect_levels.sql` adds optional `level` presentation metadata to
effect catalogue items. The live exhaustion value stays in its rules-owned
character field, but the sheet presents it through the same level-aware effect
cell without duplicating rest or exhaustion mechanics.
Section `34_ability_resource_catalog_fixes.sql` задаёт структурированные правила
Харизмы для «Вдохновения барда» и Мудрости для «Гнева бури», удаляет прежний
ручной максимум вдохновения и переводит его полные старые character entries на
живой максимум без искусственной траты новых зарядов.
Section `35_ability_resource_catalog_audit.sql` канонизирует все ограниченные
отдыхом расовые и классовые способности и черты PHB в каталоге. Он добавляет
уровневые формулы, независимые заклинательные ресурсы и поздние правила
восстановления, а старые character entries переводит на формат с
`resource_version: 1`, сохраняя реально потраченные заряды. Ограничения «раз в
ход» и способности с особыми календарными откатами ресурсами отдыха не являются.
Section `36_ability_resource_colors.sql` задаёт тематический `resource_color`
каждой системной способности и отдельным счётчикам внутри `use_resources`.
Поле доступно в schema типов 3, 4 и 7; пользовательские способности без цвета
получают стабильный цвет из клиентской палитры.
Section `37_ability_spell_grants.sql` добавляет типам 3, 4 и 7 массив
`granted_spells` с заклинанием, уровнем открытия, заклинательной характеристикой
и флагом применения без ячейки. Он заполняет фиксированные расовые и классовые
источники из PHB; лист сохраняет источник в `granted_by` и использует
переопределённую характеристику только для конкретного заклинания.
Section `38_equipped_armor.sql` удаляет прежний снимок базового КД и щита из
JSON персонажа, сохраняя только ручные `armor.bonuses`. Правила КД и ограничения
берутся из записей типа 12 в `items.equipped`; для магического экземпляра
доспеха или щита тип 12 предоставляет `params.magic_bonus`.
Section `39_character_defenses_and_racial_grants.sql` добавляет общий массив
`defenses`, подключает безусловные расовые сопротивления и переносит одноразовые
языки/навыки/владения в данные рас. Она также исправляет недостающие связи
тифлинга, полуорка и гномьих подрас и мигрирует уже созданных персонажей.
Section `40_ability_spell_cast_level.sql` расширяет дарованные заклинания
фиксированным `cast_level`; в частности, «Адское возмездие» из «Дьявольского
наследия» сотворяется 2-м уровнем без хардкода в карточке заклинания.
Section `41_ability_choices.sql` переводит типы 3 и 4 на тот же массив
`choices`, который используют черты: стабильный ключ, количество и источник
вариантов (`inline`, `suggest` или другой тип item). Старые одиночные `choice`
переносятся в `choices[{key:'choice'}]`, а сохранённые `feature_choices`
копируются в `choices` конкретной записи способности персонажа. Плоская карта
остаётся как индекс совместимости для зависимых от выбранного варианта
заклинаний; новым источником истины является запись способности.
Section `42_racial_automation.sql` добавляет типам 3, 4 и 7 декларативные
`hp_bonuses`, `passive_effects`, `roll_triggers`, `critical_damage` и
`choice_defenses`, переводит числовой максимум хитов персонажа в
`{base,bonuses}` и заполняет механические расовые правила PHB. «Везучий»
объявляет переброс натуральной 1, «Свирепые атаки» — дополнительную кость
рукопашного оружия на критическом уроне, «Дварфская стойкость» — бонус хитов за
уровень. Заговор высшего эльфа выбирается из заговоров волшебника и получает
Интеллект, а единый выбор драконьего наследия определяет сопротивление урону.
Три прежние псевдоспособности создания удаляются после миграции их грантов в
данные рас.
`item_content_source` связывает item с публикациями. Каждая встроенная
предыстория (тип 11) хранит владения инструментами в `tool_items`, а физически
выдаваемое стартовое снаряжение — в `equipment_items`; оба массива содержат
`item_id`, монеты лежат в `starting_coins`.
startup section `27_background_equipment.sql` заменяет прежнее текстовое поле
`equipment`, создаёт справочные карточки для сюжетных предметов и связывает их
с PHB 2014. Механический выбор хранится в массиве `item_choices`: стабильный
`key`, подпись, `option_item_ids`, признаки выдачи владения/инструмента/предмета
и идентификаторы заменяемых общих грантов. Поэтому один формат обслуживает
игровые наборы, музыкальные и ремесленные инструменты, священные символы и
прочие варианты, а конкретный выбор сохраняется на персонаже, не размножая
справочные записи предысторий. Признак владения и выдача предмета независимы:
одна опция может дать только владение либо владение вместе с физическим
инструментом. Каждая встроенная
коллекция имеет растровую эмблему через
`item_type.icon_image_id → storage_image`; строки типа `item_type_icon` указывают
на прозрачные PNG, встроенные во frontend под `/static/handbook-types/`.
Startup section `24_handbook_type_icons.sql` идемпотентно назначает эмблемы
типам 1–13 и удаляет прежний runtime-контракт `item_type.svg_id`; тип 14
«Инструменты» наследует визуальную эмблему родительских «Вещей» при создании.
Независимая `item_type.cover_image_id → storage_image/S3` хранит типовую
обложку-заглушку коллекции. Item-level `cover_image_id` имеет приоритет, поэтому
типовой визуал не копируется в каждую строку item и автоматически обслуживает
новый контент без собственной обложки.
Иконка item
задаётся не более чем одной из колонок: `icon_svg_id → svg_storage` или
`icon_image_id → storage_image/S3`; обе ссылки не являются частью `item.data`.
Панорамная обложка хранится независимо в
`cover_image_id → storage_image/S3` и поэтому может сосуществовать с любым
форматом иконки. Ограничение `item_single_icon_check` обложку намеренно не
включает; FK использует `ON DELETE SET NULL`.
Фильтры справочника задаются metadata `filter` в `item_type.fields`. Для
бестиария startup schema поддерживает фильтры по типу, размеру, среде,
легендарности, именованному NPC и CR; точные варианты CR лежат в
`filter_values`, поэтому UI может показать фильтр без дополнительного словаря.
Новые системные изображения, установленные через MCP, используют
content-addressed ключи `system-item-media/v1/items/{itemId}/{slot}/{sha256}`
для item и `system-item-media/v1/item-types/{typeId}/{slot}/{sha256}` для типов.
Частичный unique index действует только на этот namespace и строки с
`user_id IS NULL`, поэтому повторная установка тех же байтов переиспользует
одну `storage_image`, не меняя правила пользовательских загрузок и прежних
deploy-каталогов. Назначение блокирует и проверяет системный item или тип в транзакции;
для иконки очищается альтернативный `icon_svg_id`, а обложка остаётся
независимой. MCP-флаг `preservePrevious=true` меняет только последующую очистку:
прежняя непривязанная строка `storage_image` остаётся активной вместе с S3-
объектом, хотя item уже указывает на новую картинку.
Импортированные изображения существ также используют `icon_image_id`; внешний
URL хранится в системной строке `storage_image`, а не в `item.data`.
Прежние иллюстрации рас используют независимый контракт обложки: системные
строки `storage_image(type='item_cover')` с ключами
`system-race-images/v1/*` назначаются item типа 8 через `cover_image_id`.
Компактные прозрачные WebP используют отдельные ключи
`system-race-icons/v1/*` и `icon_image_id`. Startup seed идемпотентно переносит
старую ссылку из иконки в обложку, не затирая уже назначенную новую иконку, а
ручной legacy-sync проверяет и загружает фактические файлы в S3; frontend-дублей нет.
Startup schema переименовывает прежний `item.svg_id` в `icon_svg_id` без
runtime alias. Sections `schema/06_item_icons.sql` и
`schema/07_feature_icons.sql` идемпотентно создают SVG для базового оружия,
обычного снаряжения, черт, расовых и классовых способностей PHB 2014. Черты и
расовые способности получают собственные рисунки, родственные классовые
способности используют общие семантические символы. Назначение выполняется
только базовым item без иконки, поэтому заданные вручную и пользовательские
данные не заменяются.

Обычные готовые наборы снаряжения типа 2 имеют
`data.equipment_category='pack'` и структурированный `data.contents` — массив
`{item_id,count,params}` со ссылками на другие базовые вещи типа 2. Startup schema
восстанавливает все семь составов PHB 2014 идемпотентно; строковые копии состава
и runtime fallback не используются.

Инструменты являются самостоятельным типом 14 с категориями `artisan`,
`gaming`, `musical` и `kit`. Startup section `30_item_type_hierarchy.sql`
идемпотентно переносит прежние вещи с `equipment_category='tool'` в этот тип и
возвращает экземпляры из временного `values.tools` в первую секцию обычного
инвентаря. Владение при этом остаётся независимым значением в
`values.proficiencies['Инструменты']`: наличие предмета его не добавляет и не
удаляет. Поле item `required_tool_proficiencies` содержит ссылки на suggest-тип
5 с семантикой `match='any'`. Для конкретных ремесленных, игровых и музыкальных
инструментов массив включает точное владение и общее владение категории, для
особых наборов — точное владение. Startup section
`31_tool_proficiency_catalog.sql` дополняет словарь конкретными владениями и
связывает с ними все встроенные инструменты. Реквизит шарлатана для выбранной
мошеннической схемы остаётся обычной вещью: отдельного владения этим реквизитом
в правилах нет.

Классы типа 9 могут хранить выбор владений инструментами в
`tool_prof_choice {count,from}`, где `from` содержит suggest-ID типа 5. Startup
section `33_class_tool_choices.sql` заменяет у барда статическое общее владение
`Музыкальные инструменты` обязательным выбором трёх конкретных музыкальных
инструментов.

`item_type.instance_fields` описывает типизированные параметры конкретного
экземпляра, которые хранятся на ссылке владения, а не в `item.data`. Инвентарь
(включая инструменты) и зелья используют `{uid,item_id,count,params,override}`, оружие —
`item_id` и тот же `params` рядом со своими боевыми настройками. Startup section
`28_item_instance_params.sql` переводит прежние `id` и `magic_up`, добавляет
явные пустые параметры остальным экземплярам и назначает существующим верёвкам
`length_ft=50`. Справочные пеньковая и шёлковая верёвки не содержат длину в
названии; их `measurement`, `unit_cost_copper` и `unit_weight` задают только
правила измерения и расчёта экземпляра.

Startup section `29_item_catalog_fixes.sql` исправляет прежнюю повторную
нормализацию: ID 423 остаётся пеньковой верёвкой, а единственной справочной
шёлковой верёвкой становится ID 424; ссылки со старого дубля ID 1428 переносятся
на неё до удаления дубля. Магические `Rope of Climbing` и
`Rope of Entanglement` относятся к DMG 2014, а PHB-предмет `Climber's Kit`
хранится под каноническим русским названием «Комплект для лазания».

Системный suggest type 24 «Действия в бою» содержит короткий переиспользуемый
перечень действий редакции 2014. Канонический порядок задаётся стабильными
`suggest.code`; startup seed идемпотентно добавляет или актуализирует только
базовые строки. Полные статьи правил, формулы и примеры в БД не хранятся.

Rich descriptions остаются HTML-строками внутри соответствующего единственного
поля item data. Встроенные предметные ссылки используют только атомарный
`span[data-rich-node][data-rich-payload]`; payload — JSON object, закодированный
для HTML attribute. После SQL-схемы атомарная startup migration рекурсивно
обходит строковые значения `item.data` и переводит импортированные
`dice-roller` и `detail-tooltip` в текущий контракт. Ссылки на заклинания,
существ и вещи разрешаются через базовые `item.name_en`, известные состояния,
навыки, свойства оружия и типы урона — через базовые suggest. Неизвестные
внутренние ссылки становятся абсолютными нативными ссылками на исходный
справочник; внешний текст и неизвестная HTML-разметка сохраняются. Повторный
запуск не меняет уже мигрированные документы.

Для девяти базовых рас startup seed поддерживает два самостоятельных текстовых
поля: `data.short_description` — короткий атмосферный текст карточки без игровой
механики, `data.description` — авторская статья из трёх HTML-абзацев для раскрытого
шага выбора. Механические бонусы остаются в структурированных полях race item и
не дублируются в этих текстах.

Иллюстрации девяти базовых рас и девяти встроенных подрас первоначально
загружаются ручным legacy-синхронизатором по стабильным ключам
`system-race-images/v1/...`. Для каждой
создаётся системная строка `storage_image(type='item_cover')`; базовые расы
связываются только с item без `parent_id`, а подрасы — только с дочерними item
типа 8 через `item.cover_image_id`. Отдельный синхронизатор загружает их
геральдические иконки по ключам `system-race-icons/v1/...`, создаёт
`storage_image(type='item_icon')` и назначает через `item.icon_image_id` с тем
же разделением base/subrace.

Пятнадцать встроенных базовых классов используют параллельный namespace
`system-class-images/v1/*`. Startup seed создаёт системные
`storage_image(type='item_icon')` и назначает их только системным item типа 9 без
`parent_id`, у которых иконка отсутствует или всё ещё указывает в этот legacy-
namespace; MCP-иконки `system-item-media/v1/*` startup и ручной sync не
перезаписывают. Дочерние подклассы не затрагиваются. Ручной legacy-синхронизатор
сверяет размер и SHA-256 встроенных JPEG перед загрузкой в S3.

Для тех же классов startup seed поддерживает `data.short_description` как
короткий атмосферный текст карточки и `data.description` как отдельную авторскую
статью из трёх HTML-абзацев под выбранной карточкой. Игровые параметры остаются в
структурированных полях class item и в эти тексты не дублируются.

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
одновременно очищает `user_id` и `custom_source_id`, а у связанной растровой
иконки также очищает `storage_image.user_id`.

Старая пользовательская копия классовой способности «Ликвидация» не становится
вторым системным item: startup migration переводит сохранённые ссылки на
канонический системный `Assassinate`, сохраняет данные экземпляра способности и
удаляет дубликат. Каноническая карточка использует русское название
«Ликвидация»; runtime-автоматика по-прежнему опирается на структурированные
поля, а английское имя используется только для поиска цели миграции каталога.

Новые `suggest.id` выдаёт общая sequence, поэтому конкурентные вставки разных
пользователей не пересекаются и не используют `MAX(id)+1`. Существующий API
по-прежнему идентифицирует suggest парой `(type_id,id)`, так что явные id базовых
suggest остаются валидны; составной primary key обеспечивает этот контракт.

Актуальные связи:

- способности рас/классов используют только массивы `race_ids`,
  `subrace_ids`, `class_ids`, `subclass_ids` и общий массив `choices`;
- заклинания используют `classes: [{id: classItemId}]`;
- черты используют `description`, `prerequisite_groups` и тот же `choices`;
- стоимость `int_by_suggest` хранится как `{value,suggest_id}`.

При старте `schema/02_handbook.sql` переносит старые одинарные bindings, spell
class ids, ключи черт и source metadata, затем удаляет исходные поля. Отдельных
`migrate-ability-binding`, `migrate-spell-classes` и подобных admin jobs нет.

### Сессии

`session`, `session_participant`, главы, сцены, encounters, events и состояние
музыки находятся в одной схеме. Participant brief читает аватар по
каноническому D&D пути; полей template path map нет.
У самой `session` нет lifecycle-статуса: ход кампании выражают статусы глав и
единственная ссылка `current_chapter_id` («Сейчас здесь»).
`session_participant.color` хранит необязательный `#RRGGBB`-цвет участника в
рамках конкретной сессии; это UI-маркер и он не записывается в данные персонажа
или encounter JSON. `session_participant.sort_order` хранит уникальную внутри
сессии позицию игрока; при добавлении назначается следующая позиция, а
перетаскивание переписывает полный порядок в непрерывные `1..N`.
`session_participant.char_id` уникален глобально, поэтому персонаж может быть
привязан не более чем к одной сессии. При обновлении старых данных сохраняется
самая поздняя связь по `joined_at`, а подтверждённый перенос выполняется одной
транзакцией.

Мир сессии хранится отдельно от сюжетных графов:

- `session_location` образует дерево через nullable `parent_location_id` и
  хранит `kind`, описание, `image_id` и `sort_order` внутри группы
  соседей. Self-parent запрещён constraint-ом, а runtime также запрещает
  перенос под любого потомка. `ON DELETE RESTRICT` не даёт неявно удалить
  вложенные места;
- `session_npc` — единый каталог заготовленных NPC с именем, ролью, описанием,
  цветом, стабильным порядком и `image_id` портрета из независимого системного
  каталога или пользовательских `storage_image`. Nullable `race_item_id` ссылается на
  доступный item расы (type `8`) и использует `ON DELETE SET NULL`;
- `session_quest` — упорядоченный журнал заданий с названием, отдельными
  полями цели, условия, награды, последствий и заметок, а также
  lifecycle-статусом `planned/active/completed/failed`. Старое общее описание
  при обновлении переносится в заметки и удаляется из актуальной схемы;
- `session_entity_relation` хранит одну неориентированную связь между любыми
  двумя локациями, NPC, материалами или заданиями. Пара `(type,id)` приводится
  к каноническому порядку, поэтому обратный дубль невозможен; у связи есть одна
  nullable-заметка. Полиморфные стороны проверяются runtime по `session_id`, а
  удаление сущности очищает обе стороны. Сценарий не является допустимой
  стороной универсальной связи: участие объекта вычисляется по его блокам на
  холсте. Старые специализированные связи со сценариями удаляются; их заметка
  переносится в уже существующий подходящий блок, но новые блоки миграция не
  создаёт. Старые связи материалов к главам также удаляются. Отдельной
  таблицы рёбер между локациями нет: география выражается только деревом.

`session_event` — append-only хроника осмысленных игровых действий. Автор
хранится в `author_user_id`; `action` содержит готовое краткое описание
действия, а nullable `actor_name` — неизменяемый снимок имени действующего.
`actor_char_id` дополнительно связывает запись с персонажем, если действие
выполнено из его листа. Игрок может указывать только своего подключённого
персонажа, и его имя определяет сервер; мастер — любого участника сессии либо
произвольное существо без `actor_char_id`. У событий уровня сессии
`actor_name IS NULL`. Обязательный API-флаг `authorIsSessionOwner` вычисляется
при чтении сравнением автора с владельцем сессии и не принимается от клиента.
`visibility` различает
общие и DM-only записи; `(session_id,client_action_id)` защищает повторную
отправку от дубликатов. Типизированные детали события находятся в `data`, а
выдача идёт по монотонному курсору `id`.

Структура кампании хранится как граф с одно- и двусторонними переходами:

- `session_arc` — упорядоченный холст одной сессии. `order` уникален в сессии и
  после перестановки переписывается в непрерывные `1..N`. У арки есть название
  и описание, но намеренно нет статуса;
- `session_chapter` — узел, принадлежащий сессии и арке. Текстовый `number`
  уникален внутри арки. Здесь же хранятся описание, lifecycle-статус (по
  умолчанию `none` / «Без статуса»), один
  `image_id → storage_image`, точка фокуса и
  `position_x/y`;
- `session_chapter_edge` — переход с необязательной подписью и явным флагом
  `bidirectional`. Runtime проверяет принадлежность перехода и обоих узлов
  одной арке; уникальность не зависит от порядка концов, поэтому обратный дубль
  той же пары невозможен;
- `session.current_chapter_id` — единственный текущий узел всей кампании. Сцены
  ссылаются на главу;
- `session_scene` — узел второго уровня с собственными `position_x/y` и
  обязательным `image_id → storage_image`,
  lifecycle-статусом (также `none` по умолчанию), принадлежащий одной главе;
  `session_scene_edge` соединяет только сценарии
  этой главы и использует тот же одно-/двусторонний контракт. Старые строки
  получают нейтральную обложку `discovery`;
- `session_scene_item` — текстовый, диалоговый, боевой блок, награда,
  изображение, универсальный материал либо ссылка на локацию, NPC или задание
  третьего уровня. Блоки изображения и
  материала хранят ссылку `material_id`, а не копию файла; первый ограничен
  картинками/картами, второй может показывать любой тип материала.
  Ссылочные блоки хранят `referenceId` в `data` с runtime-проверкой сессии.
  Эти ссылки и `material_id` являются единственным источником read-only списка
  сценариев, в которых используется объект; повторные блоки агрегируются счётчиком.
  Помимо JSON-содержимого он хранит координаты и изменяемую ширину на холсте;
  цвет не сохраняется и однозначно определяется типом блока;
  `session_scene_item_edge` соединяет только блоки одного сценария и также
  хранит `bidirectional`.
- `session_material` — типизированный материал. `image`, `video` и `map`
  ссылаются через `asset_id` на общий S3
  registry `storage_image`; `text` и `note` хранят `content`, а записка также
  хранит `note_style`. Для карты зарезервирован `map_data jsonb` (сейчас `{}`)
  под будущие слои и маркеры. CHECK фиксирует допустимую нагрузку каждого типа.
  Любой материал доступен для добавления и ручного показа во всей сессии.
  Сценарии, где он уже размещён как material/image block, вычисляются по
  `session_scene_item.material_id`. Связей материала со сценариями и главами в
  актуальной модели нет; startup migration удаляет старые таблицы и
  `scope/chapter_id/scene_id`.
- `session_presentation_state` — единственное live-состояние экрана игроков на
  сессию: режим (`idle`, `material` или `combat`), видимость, материал, эффект,
  переход, флаг трансляции музыки, настройки показа здоровья числом или словами,
  кладбище, масштаб боевой трансляции в процентах и монотонную ревизию. Сам SSE
  хранит только подписчиков в
  памяти процесса; состояние и восстановление после разрыва остаются в
  PostgreSQL.
- `session_timer` — таймеры мастера на странице сессии. Запущенный таймер хранит
  абсолютный `ends_at`, а поставленный на паузу — замороженный `remaining_ms`;
  CHECK не допускает смешения этих состояний. `duration_ms` растёт при
  добавлении времени и используется для прогресса. Индивидуальный `broadcast`
  определяет, попадает ли конкретный таймер в безопасную публичную проекцию.
  Таймеры удаляются каскадно вместе с сессией.

Startup SQL создаёт существующим сессиям первую `Основная арка`, переносит туда
числовые главы прежнего формата, превращает их номера в текст и задаёт начальные
координаты. Для новой сессии пустая первая арка создаётся в одной транзакции с
самой сессией. Старые линейные списки сценариев и блоков однократно получают
сеточную начальную раскладку; дальнейшие координаты сохраняются явно. После
этого прежняя колонка `session_scene_item.order` удаляется: порядок блоков
задаётся только их положением и связями.
Существующие пары встречных рёбер на любом из трёх холстов startup migration
сводит в одну двустороннюю связь, сохраняя первую непустую подпись.

MCP bulk import does not add a persistence format or staging tables. Its
portable string keys are resolved to the same session, arc, chapter, scene,
world and material rows inside one PostgreSQL transaction; a failed reference
leaves no partially created session.

Encounter combatant хранит ссылку `itemId`, пользовательский `override` и
уникальную для NPC латинскую метку `markerLetter` (`A`–`Z`).
Старые embedded `itemRaw` и денормализованные name/ac/hp поля переносятся в
startup migration и не обрабатываются во frontend.
Верхнеуровневый encounter JSON может содержать текущее групповое испытание
`challenge: {ability,savingThrow,results}`; `results` сопоставляет UID участника
с его `{roll,bonus,total,rolls?,dropped?,revision?}` и удаляется целиком при
сбросе результатов. Опциональные `rolls` и `dropped` сохраняют пару d20 и индекс
неиспользуемого кубика после дополнительного броска. `revision` обновляется,
даже если выбранное значение d20 не изменилось.

### Музыка и storage

`music_track`, `music_album`, `music_tag` и link tables хранят metadata и
порядок. Личные альбомы/треки имеют `owner_user_id`; у системных
`is_system=true`, владелец отсутствует, а `system_key` обеспечивает
идемпотентный startup seed. CHECK constraints не дают совмещать
системный признак с владельцем. Личное и системное аудио лежит в object
storage; системные объекты используют стабильный префикс `system-music/v1/`.
Системный трек может участвовать в `music_album_track` личного альбома и в
`music_track_tag` с личным тегом. При чтении API такие связи фильтруются по
владельцу альбома или тега; связи с системными альбомами остаются общими.
Изображения справочника, персонажей и сессий используют `storage_image`/S3, SVG
справочника — `svg_storage`. `session_image_catalog` описывает категории и
порядок системных обложек отдельно для `story` и `npc`; главы, сценарии,
локации и NPC хранят только единый `image_id`. Системные JPEG загружаются под
стабильными ключами `system-session-images/v1/{story|npc}/`.

Личные `storage_image` хранят `user_id`, `file_size`, `file_name` и `mime_type`;
такие же upload metadata есть у пользовательских `svg_storage`, а музыка
использует эквивалентный `owner_user_id` и `file_size`. Встроенные и системные
объекты имеют `NULL`-владельца и не входят в личную статистику. Startup schema
backfill-ит размер старых DB-backed bytes/SVG; размер старых S3-объектов без
локальных bytes лениво уточняет account API и сохраняет обратно. Частичные
индексы по владельцу и времени обеспечивают список последних загрузок без
сканирования системного каталога.

Административная статистика агрегирует эти же `file_size` по всем владельцам и
системным объектам. Для `storage_image` учитываются только активные строки с S3
key или DB-backed bytes, для `music_track` — системный признак, для
`svg_storage` — фактические DB-backed записи. Поэтому внешняя иллюстрация по URL
не выдаётся за занятое место, а неизвестный размер показывается отдельным
счётчиком и не приравнивается к нулю.

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
   foundation, handbook, characters, sessions, seed, item-icons, feature-icons,
   domain automation (including racial, class and feat automation),
   session-world или session-images. Порядок файлов задаёт
   зависимости и не должен меняться неявно.
2. Если есть старые данные, перед удалением старого поля выполнить
   идемпотентный `UPDATE`/временную функцию.
3. Удалить старую колонку/JSON key и runtime fallback в том же изменении.
4. Обновить читаемый schema-файл в `resources/items/`, если менялись fields
   item type.
5. Запустить `go test ./...`, `go build ./...`, `go vet ./...` и frontend tests.
6. Деплой является фактической проверкой SQL на production schema; readiness
   должен подтвердить новый commit SHA.
