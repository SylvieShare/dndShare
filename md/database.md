# Database and startup migrations

## Видимость записей справочника

Миграция `122_hidden_items.sql` добавляет `item.hidden boolean NOT NULL DEFAULT false`
и первоначально скрывает базовые классы Магус и Шаман (type 9). Флаг независим от
владельца, источников и автоматизации. Списки фильтруют его до LIMIT/OFFSET,
получение по ID сохраняет обычные правила доступа. Счётчики в API вычисляются
по нескрытым записям, чтобы переключение видимости сразу меняло число элементов.


PostgreSQL принадлежит Go-бэкенду. Единственный источник структуры —
упорядоченные файлы `internal/store/schema/*.sql`. `schema.go` встраивает их в
бинарь и до регистрации HTTP-сервиса выполняет одной транзакцией только части,
которых ещё нет в `dndshare.schema_migration`. PostgreSQL advisory lock не даёт
двум инстансам мигрировать одновременно; checksum запрещает менять уже
применённый SQL. Liquibase и отдельного Kotlin backend в проекте нет.

## Правила

- Все объекты находятся в схеме `dndshare`.
- Новый DDL или data correction добавляется отдельным следующим файлом. Уже
  применённые файлы не редактируются. Идемпотентность остаётся обязательной для
  безопасного восстановления после ручных операций.
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

### Игровые карты

Миграция `150_battle_maps.sql`, код `battle-maps`, добавляет:

- `battle_map`: UUID, владелец, название, документ JSONB, `asset_id`, revision,
  changed_at. Индексы владельца и изображения.
- `session_map`: UUID, FK сессии с каскадным удалением, название, независимый
  документ JSONB, `asset_id`, runtime state JSONB, revision и changed_at.
  Индексы сессии и изображения; UNIQUE(session_id,id).
- `session_map_display`: одна строка на сессию, FK активной сессионной карты,
  visible, камера JSONB и отдельная revision. Составной FK запрещает выбирать
  карту другой сессии. При удалении активной копии одна транзакция сбрасывает
  map_id/visible перед удалением.

Обновления защищены условием `WHERE revision=$expected`; запись увеличивает
revision. Системные пресеты создаются кодом и не требуют seed-строк.
`storage_image` не удаляется сборщиком, пока на неё ссылается библиотека
или сессионная копия. Подробнее: [игровые карты](features/maps.md).

### Пользователи

`users`, `role`, `users_role`, `users_session`. Актуальные роли:
`ADMIN`, `HANDBOOK_ADMIN`. Роли редактора шаблонов нет, потому что шаблоны
находятся в коде. `users.source_version_id` — обязательный FK глобально
выбранной игроком редакции. Система определяется через `source_version → source`
и не дублируется в `users`. Startup migration и trigger назначают DND5e 2014
существующим и новым аккаунтам до первого пользовательского выбора.
`users_session.created_at` ограничивает серверную сессию 30 днями; просроченные
строки удаляются при старте. Смена пароля атомарно отзывает прежние сессии, а
самостоятельная смена создаёт новый token текущему браузеру.

### Персонажи

`char_template` содержит только `id` и `name`. `char` хранит владельца,
template id, `source_version_id`, JSON документа, public/deleted flags,
техническую `version`, timestamps и nullable `icon_image_id → storage_image`.
Иконка является отдельным квадратным представлением персонажа для компактных
списков; основной портрет остаётся в каноническом JSON `values.ava`. Иконку
можно атомарно заменить или снять; отвязанный объект очищается только после
проверки остальных ссылок на `storage_image`.

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
- `spells` — `{schema_version:2,slot_pools,tabs,grants}`;
  `tabs` содержит независимые пользовательские вкладки
  `{key,name,class_item_id,casting_ability,mode,save_bonus,attack_bonus,spells}`.
  Непустой `class_item_id` уникален среди вкладок и связывает повышение уровня
  с item базового класса; `mode` принимает `known`, `prepared` или `spellbook`.
  Обычная запись заклинания имеет `{key,id,prepared}` и принадлежит ровно одной
  вкладке, поэтому один item заклинания можно независимо хранить у нескольких
  классов. `grants` — отдельный readonly-список внешних даров с `source` и
  необязательными `tab_key`, `casting_ability`, `cast_level`, `slotless` и
  `counts_as_known`. `slot_pools {long_rest:[...],short_rest:[...]}` хранит
  общие ячейки по типу восстановления, а не по классу. Количество и расход
  сохраняются без пересчёта при загрузке; повышение уровня прибавляет только
  положительный классовый прирост к текущим значениям. При повышении круга
  Магии договора классовое количество переносится из старого короткого круга
  в новый с сохранением расхода; избыток сверх него остаётся в старом. Миграция
  `117_spell_slot_additions.sql` удаляет устаревший флаг авторасчёта, сохраняя
  все пулы и увеличивая версию изменённых листов;
- `items` — `{equipped,sections}`;
- `money` — `{order,amounts}`.
- `abilities_race`, `abilities_class`, `abilities_feats` — item-reference arrays
  with the available usage counter in `count`; a manual per-character maximum is
  present only when the handbook item enables `manual_size`.
- `class_resource_counts` — available charges keyed by a shared class-resource
  identity. Unlock levels, progression and rest rules remain on type-9 class
  items in `class_resources`; equal keys across multiclass entries are one pool.

Startup data correction переводит прежние значения в этот вид и удаляет старые
ключи. Vue-компоненты знают только этот контракт.

### Справочник

Заклинания типа 5: `damage` и `heal` содержат базовые `dices` и `addon`,
тип роста `scaling`, шаг `scaling_step`, предел `scaling_max_steps` либо явные
пороги `scaling_levels[].level`. `bonus` — постоянная часть формулы; `add_mod`
добавляет заклинательную характеристику один раз. `rolls[]` хранит отдельные
эффекты (`label`, `kind`: damage/heal/effect) с такими же правилами роста.
Миграция 113 расширяет схему этих полей; исправления содержимого выполняются
через MCP. Подробности — [аудит заклинаний](spell-rules-audit.md).

`source` — игровая система, `source_version` — редакция правил.
`content_source` — книга/публикация, а
`content_source_compatibility` хранит прежние метаданные книги. Допуск конкретного
объекта определяется только `item_version_compatibility`; доступность книги
выводится из её фактически размеченных публичных записей.
`content_source.kind` хранит одну каталоговую категорию: `core`, `supplement`,
`setting`, `adventure`, `playtest` или `third_party`. Постоянная SQL-функция
`classify_content_source_kind(code)` является единым правилом для startup-
нормализации и импорта новых источников; неизвестный код получает
`supplement`, пока не будет классифицирован явно.
`item_version_compatibility` хранит явное решение для каждой пары item/редакция.
Отсутствие решения не разрешает новый выбор. Подробнее —
[редакции D&D](features/rules-editions.md).

`item_type` хранит schema fields типа, `item` — контент, `suggest_type/suggest`
— словари. `item_type.parent_type_id` образует иерархию коллекций: «Оружие»,
«Зелья», «Доспехи», «Транспорт» и «Инструменты» являются прямыми
подразделами «Вещей»; тип 16 «Подрасы» является подразделом типа 8 «Расы», а
тип 17 «Подклассы» — подразделом типа 9 «Классы». Корневая коллекция может
включать предметы всех дочерних типов в picker, не смешивая сами справочные
записи. Для происхождения `item.parent_id` нормализует явные schema-ссылки:
`subrace.data.race` ↔ `race.data.subraces[]` и
`subclass.data.class` ↔ `class.data.subclasses[]`; вариант без базовой записи
не проходит trigger-валидацию.
Startup migration `69_origin_catalogs.sql` сохраняет id существующих вариантов,
переносит их из типов 8/9 в 16/17 и ставит trigger, поддерживающие обе стороны
связи при последующих изменениях. Материализованный обратный массив содержит
только item того же владельца, чтобы общая базовая запись не раскрывала id
чужих личных вариантов; read-проекция дополняет его публичными и собственными
вариантами текущего пользователя.
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
`start_level`, `selection_mode`, `level_up_choices`, `known_progression`,
`allowed_schools` and `unrestricted_progression` for class tabs and level-up
spell pickers. Migration 104 adds the full PHB/SRD 2014 Bard known progression
for the seeded class (id 4016): cantrip and spell limits are shared by the
handbook, sheet and level-up rather than hardcoded in the frontend. Existing
character spell lists are not rewritten by this data correction.
Ability choices may combine dictionaries through
`suggest_sources`, require an owned proficiency and exclude an already reached
rank. `display_scaling [{level,label}]` is presentation data resolved against
the owning class level.
В схемах способностей `subrace_ids` ссылается на item типа 16, а
`subclass_ids` — на item типа 17; `race_ids` и `class_ids` продолжают ссылаться
на базовые типы 8 и 9.
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
effect id, regardless of the instance source, rather than `widget_states`, is
the canonical active state.
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
reads the structured rows. Cunning Action omits an own-turn requirement because
that is already the default presentation for bonus actions. Character-created actions are stored separately in
`char.values.actions` and remain editable.
`51_status_effects.sql` creates item type 15 (`Эффекты`) and the generic
`status_effects` link array on abilities, racial abilities, feats and spells.
Catalogue items keep polarity, stacking, duration, concentration, derived
bonuses and defenses. Character `values.states` contains source-owned runtime
instances with bound parameters; legacy suggest-type-9 state ids and active
Rage widget flags are migrated to that format. Rage and Shield of Faith are the
initial automatic consumers, while all former condition suggests are imported
as negative effect items for manual selection.
An instance's `duration` stores `{kind, value?, text?}` independently of the
catalogue: positive integer `value` for rounds/minutes/hours/days, `text` for
custom end conditions, or manual/until_rest/permanent without extra fields.
The source override or catalogue default is copied when the instance is created;
editing its duration does not modify other instances or catalogue data. This
additive instance metadata stays in character JSON and requires no SQL migration.
`110_effect_source_filter.sql` adds read-only filter metadata `effect_source`
for type 15. No category is stored on the effect: basic membership uses standard
effect codes, while spell and magic-item membership follows current visible
`status_effects` links, including after source edits or deletion.
`52_status_effect_levels.sql` adds optional `level` presentation metadata to
effect catalogue items. The live exhaustion value stays in its rules-owned
character field, but the sheet presents it through the same level-aware effect
cell without duplicating rest or exhaustion mechanics.
`53_activity_restrictions.sql` adds the generic `activity_block` derived effect
and configures the active Rage status to block `spellcasting`, allowing sheet
consumers to combine several restriction sources without feature-name checks;
its `concentration` scope ends an active concentration status when applied.
`54_status_effect_catalog.sql` adds the multiline `data.thesis` field, seeds
«Истощение» and «Вдохновение» as system effect items, and attaches their embedded
item icons and covers through `storage_image`. Existing effect descriptions are
converted into a phrase of at most 48 characters as an upgrade fallback and
remain independently editable afterwards. Standard system effects replace that
fallback with concise mechanical bullet points rendered beside the icon.
`55_remove_status_suggest.sql` migrates NPC encounter state ids to effect item
ids, removes the temporary `legacy_suggest_id` metadata, and deletes suggest
type 9 together with its rows. Character and encounter states now resolve only
through item type 15; the old condition suggest catalogue is not retained.
`56_frenzy_action.sql` extends source-owned sheet actions with active-effect
requirements and typed row-menu consequences. `required_status_codes` controls
visibility from the effect catalogue, while `menu_effects` can adjust a bounded
character counter without runtime checks for a feature name or id. Frenzy uses
the contract to expose its bonus-action melee attack only while Rage is active;
its manual consequence adds one exhaustion level, with the rules text preserving
the actual timing: exhaustion is gained when the frenzied Rage ends.
`57_class_action_automation.sql` lets a feature action point to a resource owned
by another feature through `resource_item_id`. Fixed action costs can then be
spent from the row menu, while variable pools stay visible and manually
adjustable. The catalogue publishes unambiguous actions and reactions for the
other classes through this contract, including Bardic Inspiration, Second Wind,
Wild Shape, cleric Channel Divinity options, ki techniques and sorcery-point
features. Complex spell, form, companion and target-transfer systems remain
outside this migration and are tracked in `md/class-automation-audit.md`.
`60_shared_channel_divinity.sql` adds class-owned shared resource pools and
`feature_actions[].resource_pool_key`. Cleric and paladin Channel Divinity use
one `channel_divinity` counter: paladin levels unlock effects but do not add a
charge, while cleric levels 6 and 18 raise the shared maximum. The migration
preserves an existing cleric counter in `class_resource_counts` before retiring
the former feature-owned resource fields.
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
Поле доступно в schema типов 3, 4, 7 и 18; пользовательские способности без цвета
получают стабильный цвет из клиентской палитры.
Section `37_ability_spell_grants.sql` добавляет типам 3, 4 и 7 массив
`granted_spells` с заклинанием, уровнем открытия, заклинательной характеристикой
и флагом применения без ячейки. Он заполняет фиксированные расовые и классовые
источники из PHB; лист сохраняет каждое такое заклинание отдельной записью в
`spells.grants` и использует переопределённую характеристику только для него.
`61_spellbook_tabs.sql` переносит прежний общий список и настройки источников
во вкладки, неоднозначные обычные записи — во вкладку «Без источника», а
внешние дары — в `grants`, после чего runtime старый формат не читает.
`63_spellbook_grant_cleanup.sql` удаляет из вкладок дубли старых feat-даров и
уточняет источник прежних классовых даров после уже применённой миграции 61.
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
Section `111_infernal_legacy_reaction.sql` добавляет системному «Дьявольскому
наследию» реакцию «Адское возмездие» с 3-го уровня через `feature_actions`.
Она использует существующий ресурс `hellish_rebuke`, не меняя сохранённые
заряды персонажей и отдельный ресурс «Тьмы».
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
«Инструменты» наследует визуальную эмблему родительских «Вещей» при создании,
а migration 69 копирует icon/cover базовой расы и класса новым типам 16/17.
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
существ и вещи разрешаются через базовые `item.name_en`; состояния разрешаются
через effect items типа 15, а навыки, свойства оружия и типы урона — через
базовые suggest. Перед удалением прежнего suggest type 9 отдельная миграция
рекурсивно заменяет его rich nodes во всех `item.data` на item nodes эффектов,
сохраняя подпись ссылки. Неизвестные
внутренние ссылки становятся абсолютными нативными ссылками на исходный
справочник; внешний текст и неизвестная HTML-разметка сохраняются. Повторный
запуск не меняет уже мигрированные документы.

Versioned section `70_item_rich_descriptions.sql` заменяет пустые и шаблонные
`data.desc` всех проаудированных базовых вещей типа 2 собственными русскими
описаниями и исправляет таблицу результата «Бутылки ифрита». Сразу после SQL в
той же schema-транзакции Go migration однократно нормализует описания всех
публичных вещей типа 2: буквальные `\\n` становятся абзацами, Markdown-таблицы —
семантическим HTML, формулы кубиков — узлами `dice`, КД/хиты — узлами `stat`, а
однозначно найденные заклинания, существа, состояния и другие вещи — внутренними
узлами `item`. Неразрешённые относительные и внешние `a` разворачиваются в
обычный текст, поэтому описание не сохраняет сломанные или уходящие с сайта
ссылки. Личные записи пользователей migration не изменяет.

Следующая versioned section `71_potion_rich_descriptions.sql` тем же контрактом
актуализирует 26 публичных записей типа 10: лечебные формулы и упоминания хитов
становятся интерактивными узлами, таблицы силы великана и сопротивления —
семантическим HTML, а названия существующих заклинаний и состояний — локальными
ссылками справочника. Seed привязан к id и ожидаемому имени записи, поэтому не
затрагивает пользовательские зелья и не применяет текст к случайно заменённому
объекту.

Для девяти базовых рас startup seed поддерживает два самостоятельных текстовых
поля: `data.short_description` — короткий атмосферный текст карточки без игровой
механики, `data.description` — авторская статья из трёх HTML-абзацев для раскрытого
шага выбора. Механические бонусы остаются в структурированных полях race item и
не дублируются в этих текстах.

Иллюстрации девяти базовых рас и девяти встроенных подрас первоначально
загружаются ручным legacy-синхронизатором по стабильным ключам
`system-race-images/v1/...`. Для каждой
создаётся системная строка `storage_image(type='item_cover')`; базовые расы
связываются с item типа 8, а подрасы — с item типа 16 через
`item.cover_image_id`. Отдельный синхронизатор загружает их
геральдические иконки по ключам `system-race-icons/v1/...`, создаёт
`storage_image(type='item_icon')` и назначает через `item.icon_image_id` с тем
же разделением base/subrace.

Пятнадцать встроенных базовых классов используют параллельный namespace
`system-class-images/v1/*`. Startup seed создаёт системные
`storage_image(type='item_icon')` и назначает их только системным item типа 9,
у которых иконка отсутствует или всё ещё указывает в этот legacy-
namespace; MCP-иконки `system-item-media/v1/*` startup и ручной sync не
перезаписывают. Подклассы типа 17 не затрагиваются. Ручной legacy-синхронизатор
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
`session.status` хранит `active`, `stopped` или `completed`, с SQL CHECK и
значением по умолчанию `stopped`. Миграция 116 добавляет поле существующим
сессиям как `stopped`. Статусы глав и ссылка `current_chapter_id` («Сейчас здесь»)
независимы от статуса сессии; смена статуса не меняет состав участников,
encounter, музыку или таймеры.
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
  доступный item расы (type `8`) и использует `ON DELETE SET NULL`. Nullable
  `bestiary_item_id` таким же образом ссылается на доступное существо бестиария
  (type `6`); runtime проверяет тип и владельца обеих ссылок;
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

`session_event` — хроника осмысленных игровых действий. Обычные события только
дописываются; `item_transfer` и `rps_challenge` обновляют статус при ответе. Автор
хранится в `author_user_id`; API проецирует его логин в `authorName` через
`users`, без отдельного снимка в таблице. `action` содержит готовое краткое описание
действия, а nullable `actor_name` — неизменяемый снимок имени действующего.
`actor_char_id` дополнительно связывает запись с персонажем, если действие
выполнено из его листа. Игрок может указывать только своего подключённого
персонажа, и его имя определяет сервер; мастер — любого участника сессии либо
произвольное существо без `actor_char_id`. Для существа из бестиария nullable
`actor_item_id` сохраняет ссылку на item типа `6`; ссылка используется для
проекции актуальной иконки или обложки, а неизменяемая подпись по-прежнему
берётся из `actor_name`. У событий уровня сессии
`actor_name IS NULL`. Обязательный API-флаг `authorIsSessionOwner` вычисляется
при чтении сравнением автора с владельцем сессии и не принимается от клиента.
`visibility` различает
общие и DM-only записи; `(session_id,client_action_id)` защищает повторную
отправку от дубликатов. Типизированные детали события находятся в `data`, а
выдача идёт по монотонному курсору `id`.

Дневник — отдельная совместно редактируемая модель и не является частью
`char.data` или append-only хроники действий:

- `journal` принадлежит либо одному персонажу (`personal_char_id` и
  `owner_user_id`), либо одной `session_id`. CHECK разделяет эти варианты;
  unique по `personal_char_id` и `session_id` допускают не более одного личного
  дневника у персонажа и одного общего у кампании. Повторное создание личного
  дневника выбирает существующий, сохраняя его название и записи.
  `players_can_edit` (default true) управляется только владельцем сессии и
  ограничивает запись для участников, не меняя чтение или права мастера;
- `character_journal` хранит выбранный персонажем источник. Владелец может
  переключиться между единственным личным дневником этого персонажа и
  дневником действующей сессии, в которой участвует этот персонаж. Выбор
  сессии не меняет `personal_char_id`, поэтому личный источник не теряется;
- `journal_section` задаёт упорядоченный раздел летописи с названием и
  свободной игровой/календарной датой; `journal_entry` хранит типизированную
  запись (`battle/dialog/event/newday/quest/header`), HTML-описание и JSON payload диалога,
  участников боя или задания. Задание хранит `payload.quest` с наградой и
  пунктами `{id,text,done}`. Миграция `82_journal_quests.sql` расширяет CHECK типов,
  не меняя существующие записи или каталог заданий сценария. Миграция
  `84_journal_headers.sql` добавляет тип `header` для заголовков ленты. Тип существующей
  записи неизменяем. `position` задаёт
  порядок вертикальной ленты (UI показывает новые записи сверху). Перестановка
  блокирует дневник и раздел, проверяет ожидаемый полный порядок ID и меняет
  только позиции; содержимое, аудит и сохранённые связи не переписываются;
- `journal_node` хранит координаты записи отдельно от её содержимого.
  `journal_link` хранит направленные связи с необязательной подписью. Составные
  внешние ключи запрещают соединять разные дневники, но допускают связи между
  разделами одного дневника. Самосвязи и дубликаты запрещены ограничениями;
  циклы проверяются на сервере внутри блокировки дневника. `graph_revision`
  увеличивается триггерами при изменении узлов и связей. Удаление записи или
  раздела каскадно удаляет его узлы/связи без пересоединения соседних событий;
- импорт из сценария сохраняет nullable `source_scene_item_id` и независимый
  `source_snapshot`. Удаление исходного блока очищает ссылку, но не уничтожает
  уже опубликованную запись.

Миграция `68_journals.sql` переносит непустой прежний `values.diary` каждого
персонажа в отдельный личный дневник, создаёт привязку и удаляет прежнее поле из
JSON. Пустые старые массивы также удаляются; runtime старый формат не читает.
Миграция `73_personal_character_journal.sql` закрепляет личное владение за
персонажем отдельно от выбранного источника. Она также восстанавливает
проверенную привязку оригинальной Лиссары к полному дневнику; дневник копии
персонажа, разделы и записи остаются неизменными. Неоднозначные старые привязки
останавливают миграцию по ограничениям, а не удаляются или объединяются молча.
Миграция `74_journal_editing.sql` добавляет `players_can_edit` и делает
ограничение порядка записей deferrable; содержимое дневников не изменяется.
Миграция `75_journal_entry_audit.sql` добавляет nullable `changed_by_user_id`.
При создании и редактировании записи автор правки берётся из серверной
аутентификации; `author_user_id` и `created_at` остаются неизменными.
Ответы API записей содержат `createdAt`, `authorName`, `changedAt`,
`changedByUserId`, `changedByName`; имена — текущие логины авторов.
Исторические авторы правок не восстанавливаются догадками (NULL). Изменение
раскладки и связей не переписывает время/автора изменения содержимого.
Миграция `76_journal_graph.sql` создаёт координаты и соединяет записи каждого
раздела в прежнем порядке `position,id`. Текст, payload, ID и аудит записей
не изменяются. Новые записи получают узел автоматически; создание продолжения
и его связей выполняется одной транзакцией. Чтение разделов, записей и графа
использует единый repeatable-read snapshot. Создание, удаление и правки графа
берут блокировку дневника до изменения дочерних строк.
Обновление содержимого сравнивает `changed_at` с `expectedChangedAt` из
редактируемой версии. Проверка выполняется в том же SQL UPDATE, поэтому
параллельная устаревшая правка не изменяет ни содержимое, ни аудит.

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
  nullable `location_id → session_location` и nullable собственным
  `image_id → storage_image`,
  lifecycle-статусом (также `none` по умолчанию), принадлежащий одной главе;
  CHECK требует хотя бы один из двух источников визуала;
  при чтении собственное изображение имеет приоритет, иначе используется
  изображение локации. При удалении локации прямую привязку очищает FK, а
  наследовавшие сценарии перед удалением сохраняют её текущее изображение как
  собственное;
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
- `session.display_code` — постоянный уникальный код трансляции `ABC-123`:
  шесть заглавных ASCII-букв/цифр и дефис посередине. CHECK фиксирует формат,
  UNIQUE исключает совпадения. Миграция 114 назначает коды существующим сессиям;
  генератор использует случайный UUID, создание сессии повторяет вставку при
  коллизии кода. Поиск нормализует регистр. UUID сессии и invite_code независимы.
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
порядок системных обложек отдельно для `story` и `npc`; главы, локации и NPC
хранят единый обязательный `image_id`, а сценарий может вместо собственного
изображения наследовать его по `location_id`. Системные JPEG загружаются под
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

### Retired page reports

Исторические таблицы `error_report`, `error_report_message` и
`error_report_automation_lock` сохранены без изменений. Приложение не читает
и не изменяет их; отправки, очереди и обработки репортов больше нет. Старые
роли `ERROR_REPORT_AUTO_APPROVE` и `ERROR_REPORT_REVIEWER` могут оставаться
в сохранённых назначениях, но больше не предоставляют возможностей. Панель
локальных ошибок консоли доступна только `ADMIN`.

### Jobs

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

### Общая схема способностей

Миграция `72_story_abilities.sql` добавляет `item_type.id=18` («Сюжетные
способности») и задаёт единый `fields` для типов 3, 4 и 18. Trigger
`ability_type_fields` распространяет обновление схемы любого из этих типов
на остальные; `pg_trigger_depth()` ограничивает рекурсию. Существующий
`item.data` не преобразуется: все расширения схемы используют текущие ключи.
В JSON персонажа сюжетные экземпляры находятся в `abilities_story`, с тем же
форматом, что `abilities_race` и `abilities_class`.

Миграция `78_ability_rule_links.sql` добавляет `weapon_damage[].key`, явную
ссылку `sheet_widgets[].weapon_damage_key` и поля источника уровня способности
`level_source`/`level_class_id`. Полные схемы типов 3/4/18 остаются одинаковыми.
Существующие панели получают ссылку на ранее отображавшееся правило;
пользовательские ключи и явно заданные связи сохраняются, конфликты ключей
устраняются. Проверка `TestAbilityRuleLinksMigration` выполняет SQL на отдельной
локальной базе с `DNDSHARE_ABILITY_LINK_TEST_DSN` и сверяет мигрированные схемы
с `resources/items`.

Миграция `81_ability_dependency_editor.sql` дополняет одинаковые схемы способностей
3/4/18 существующим режимом объединённых словарей, целями производных эффектов и
областями бросков. Значения самих способностей не изменяются. Загрузка обложки
через item API создаёт `storage_image` типа `item_cover` с владельцем исходного
объекта и меняет только `item.cover_image_id` под блокировкой строки.

### Миграция 87: инструменты и магическое оружие

`87_master_tools.sql` добавляет `treasure {weight,min_level,max_level}` в схемы
снаряжения 1/2/10/12/13/14/19 и необязательный `weapon` в тип 19. Она заполняет
оружейные основы 41 публичной записи с проверкой ID, типа, владельца и имени,
а также начальный публичный пул сокровищ. Личные записи не включаются в пул
автоматически. Типы, ID, источники и существующий инвентарь не перемещаются.
Дополнительные таблицы не создаются. Экземпляры хранятся в JSON персонажа;
текущий контракт ссылок и состояния описан ниже в миграции 92 и в
[магических предметах](features/magic-items.md).

### Миграция 88: категории и основы магических предметов

`88_magic_equipment_bases.sql` расширяет `type` коллекции 19 категориями вещей
и классифицирует публичный набор. Вместо собственных полей `armor`, `category`,
владения и ограничений схема получает `armor_base` с фиксированной основой либо
списком допустимых записей типа 12, бонусом КД и исключениями. 22 проверенные
записи доспехов/щитов получают основы; личные записи не переписываются.
Выбор доспешной основы хранится в `params.armor_base_item_id`; оружейной —
в `item_id` экземпляра со ссылкой `magic_item_id` после миграции 92. Новых таблиц нет. Обычные доспехи типа 12 продолжают
использовать собственную формулу `data.armor`.

### Экземпляры оружия (миграции 89 и 92)

`89_explicit_inventory_weapons.sql` вводит явное перемещение из меню инвентаря;
`92_weapon_instances.sql` заменяет прежнюю проекцию полноценной записью оружия.
`entry.item_id` — основа типа 1, `entry.magic_item_id` — необязательный источник
типа 19. `params.magic` хранит настройку, заряды и выборы; поля атаки находятся
непосредственно на записи. Место хранения — `values.weapon`, `items.equipped`
или `items.sections[].items`, ровно одна запись на UID.

Миграция переносит ранее включённые магические оружия в `values.weapon`, сохраняет
UID, ссылки эффектов, личные изменения и состояние, раскрывает скрытые параметры
атаки и удаляет старые поля проекции. Остальные вещи остаются в прежних секциях.
Основа становится явной ссылкой и у фиксированных магических оружий. Предмет без
доступной основы сохраняется для выбора игроком. Таблицы и API не меняются.

## Условный урон оружия

Миграция `90_conditional_weapon_damage.sql` дополняет `weapon_damage` во всех
схемах с этой зависимостью полями `condition`, `attack_mode` (пусто или `thrown`)
и `requires_damage_key` (локальный ключ обязательного переключателя).
`dice_count` по-прежнему означает только добавляемые кости, не полный урон.
Миграция задаёт два связанных правила публичному «Дварфийскому метателю» (261),
сохраняя описание, основу и постоянный бонус. Экземпляры персонажей не меняются.

Миграция `91_throw_label.sql` переименовывает переключатель `throw` у публичного
«Дварфийского метателя» в «Метнуть», сохраняя ключ и зависимые правила.

### Миграция 93: действие трезубца

`93_trident_fish_command.sql` задаёт публичному предмету 178 три заряда и
`feature_actions.fish_command`: действие с расходом одного заряда на управление
плавающим зверем. Условие восстановления 1к3 на рассвете хранится в `recharge_note`,
без автоматического восстановления отдыхом. Проверяются ID, тип, имя и отсутствие
владельца; существующие описание, основа и другие действия сохраняются. Данные
экземпляров не меняются; ресурс и действие подключаются общими сборщиками.

### Прогресс обучения

Миграция `96_user_tutorials.sql` добавляет `dndshare.user_tutorial` с PK
`(user_id, flow_id, source_key, device)`, полями `revision`, `status`, `updated_at`
и каскадным удалением вместе с пользователем. Прогресс листа разделён по редакции,
прогресс сессии — по системе и роли. Upsert изменяет только один ключ и не
понижает версию; повторный запуск настраивается удалением выбранного результата.
Подробности: [обучение](features/tutorials.md).


Объявления `go:embed` для механик оружия 99–103 и 105–107 находятся в
`internal/store/schema_weapon_mechanics.go`; единый порядок запуска по-прежнему
задан в `schemaParts` файла `schema.go`. Проверка манифеста читает объявления
из `schema*.go` и сверяет каждую SQL-часть с ровно одной записью runner.


Миграция `106_initial_item_charges.sql` добавляет в схему магических предметов
`initial_charges` и `confirmed_uses`. Публичному предмету 134 задаются начальные
1к8+1 зарядов и подтверждаемое списание после гибели цели. Описание, основа,
бонус и чужие зависимости сохраняются; данные экземпляров не изменяются.
Состояние запаса хранится в `params.magic.max_use`/`remaining`; поиск ссылок
на ресурсы распознаёт `initial_charges` как основной ресурс предмета.


Миграция `107_luck_blade_rules.sql` расширяет схему типа 19: начальные запасы
отдельных ресурсов, условие активности зависимости, ожидание подтверждаемого
применения в рассветах и связь переброса с применением. Публичному Клинку удачи
(171) подключаются два ресурса, бонус спасбросков, удача и желание. Описание,
основа и существующие чужие зависимости сохраняются, экземпляры не меняются.
Состояние хранится в `params.magic.resource_maxima`, `resource_counts` и
`use_cooldowns` по ключам ресурсов/применений. Повторная миграция не дублирует
зависимости; интеграционный тест сверяет итоговую схему с JSON-снимком.

## Оценка поддержки механик предметов

`108_item_automation.sql` добавляет к `item` колонки `automation_status`
(`text` с CHECK пяти значений, default `unreviewed`), `automation_note`
(до 1000 символов) и `requires_player_interaction` (default false).
Это общие метаданные вне JSON `data`; миграция не выставляет оценок по наличию
зависимостей. [Контракт и критерии](features/item-automation.md).

`109_magic_item_automation_audit.sql` заполняет оценки всех 244 публичных
магических предметов с проверкой ID/названия/типа/владельца, MD5 проверенных
данных и отсутствия авторской оценки. Игровые данные не меняются.
[Полный реестр и критерии](magic-item-automation-audit.md).


`112_selected_class_abilities.sql` adds `ability_selection`,
`selection_parent_id`, `selection_requirements` to type 4 and `spell_modifiers`
to types 3/4/7. It changes item-type fields only. Invocation item records are
published through MCP; chosen references remain in `values.abilities_class`.


## Передачи предметов

Миграция `115_item_transfers.sql` создаёт `item_transfer`: сессия, отправитель,
получатель, исходный раздел (`items`/`weapon`/`potions`), полный JSONB-снимок
экземпляра, имена, `pending`/`accepted`/`rejected`, время создания/решения.
`(sender_char_id, client_action_id)` уникален для идемпотентной отправки;
уникальный `event_id` связывает запрос с единственной записью хроники.
Частичные индексы обслуживают очереди ожидающих запросов обоих персонажей.

Транзакция отправки блокирует сессию, листы в порядке ID и членства, извлекает
экземпляр из серверного JSONB, проверяет версию отправителя и создаёт резерв
с событием. Решение блокирует листы в порядке ID, затем запрос, переносит снимок в целевой лист,
повышает его `version` и обновляет статус прежнего `session_event` атомарно.
Завершённые решения не повторяют перенос. У принятого экземпляра новый UID на
основе ID передачи; заряды и кулдауны сохраняются, персональные состояния
настройки/оружия снимаются. Все полные сохранения листа проверяют `version`,
поэтому устаревший клиент не восстанавливает зарезервированный предмет.

Триггеры блокируют удаление членства и soft-delete персонажа/кампании, пока
есть ожидающие передачи. Отдельный SQLSTATE `PIT01` преобразуется API в HTTP 409.
Обычные события хроники дописываются; `item_transfer` и `rps_challenge` — изменяемые записи статуса.

`119_potion_use_requests.sql` добавляет `purpose` (`transfer` по умолчанию либо
`use`). Применение предмета разрешено из `potions`, `items` и `weapon`: резерв хранит снимок одной
дозы, остаток сохраняет место и UID. При принятии меняется статус запроса,
план применения изменяет HP/эффекты без добавления предмета получателю.
Отказ возвращает дозу в неизменённую исходную стопку либо отдельной записью
`returned-use-<id>`, если исходная стопка уже не подходит для объединения.
Идемпотентность, защита членства/удаления и SSE общие с передачами. Порядок
блокировок листы → запрос предотвращает взаимную блокировку решения и повтора
отправки. SQL для существующих механик оружия 93–95 встроен через
`schema_weapon_mechanics.go`; порядок исполнения миграций не меняется.

## Сообщения и партии игроков

Миграция `118_session_interactions.sql` создаёт `session_interaction`, связанную
с хроникой один к одному через PK/FK `event_id`. Сохраняются сессия, персонажи
отправителя/получателя, `kind=chat_message|rps_challenge`, статус, приватные ходы
и `read_at` для сообщения. Индексы поддерживают историю каждой стороны;
частичный уникальный индекс по неупорядоченной паре запрещает два ожидающих
вызова. Check constraints исключают ход у сообщения, одинаковые стороны и
завершённую партию без ответа.

Текст и снимки имён хранятся в `session_event.data`. Первоначальный ход остаётся
только в `session_interaction.sender_choice`, пока получатель не ответит;
после ответа оба хода, победитель и автор решения записываются в прежнее событие
одной транзакцией. Отказы/отзывы не раскрывают ходы. Общая хроника читает только
безопасную проекцию события, не приватные столбцы игры. Авторизация направленных
записей использует связи персонажей в БД. Блокировки персонажей в порядке ID
сериализуют создание/решение с переходами участников; повторный clientActionId
не создаёт второе событие. `read_at` не меняет хронику сообщения.


`120_potion_applications.sql` добавляет `item_transfer.application` и
`application_result` (JSONB) и таблицу `item_application`: `char_id`,
`client_action_id`, `entry_uid`, `option_key`, `result`, `created_at`.
Первичный ключ `(char_id,client_action_id)` обеспечивает повторяемость применения
к себе. Результат и версия/данные листа сохраняются в одной транзакции под
блокировкой персонажа. Для входящего запроса используются прежние блокировки
персонажей и передачи. План фиксируется при резервировании, кости — при принятии.
Миграция также расширяет схемы зелий (`usable`, `status_effects`) и эффектов
(кости к броску, множитель скорости, минимум характеристики). Наполнение
справочника выполняется отдельно через `scripts/potion-rules/apply.py` и MCP.

Миграция 121 (`application_targets`): у `item_transfer` nullable `recipient_char_id` означает адресацию мастеру только для применения; источник `spells` разрешён для эффектов заклинаний. `resolved_target` хранит выбранного игрока или NPC. Новые поля схемы эффектов описывают урон по ходам, цель-оружие, связанный урон и завершение. В JSON боя `effectInstances` содержат экземпляры NPC, `applicationRevision` защищает серверное применение от устаревшего сохранения.

## Настройки сессии

`dndshare.session.settings` — `NOT NULL jsonb`, объект с доменными разделами:

```json
{
  "players": {"seeClass": true, "seeRace": true, "seeHp": false, "openSheets": true},
  "combat": {"autoRollNpcHp": false}
}
```

Миграция `124_session_settings_json.sql` переносит сохранённые настройки
видимости в JSON и удаляет четыре прежние boolean-колонки. Браузерный автобросок
HP не переносится: единое серверное значение изначально false. Обновление
разрешённого поля выполняется через `jsonb_set` и меняет `changed_at`, не затирая
другие поля при параллельных запросах. Новые настройки добавляются в нужный раздел;
типизированный API и список разрешённых путей задают доступные параметры.

## Инвентарь сессии (125)

`session_inventory` хранит UUID экземпляра, `session_id`, `source` (`items`,
`weapon`, `potions`), полный `entry`, `item_name`, `available`, nullable
`client_action_id` и `created_at`. Доступные строки индексированы по сессии.
Удалённые/зарезервированные строки остаются с `available=false`, поэтому
повтор исходного добавления не воскрешает предмет. Уникальность действия —
`(session_id,client_action_id)`. Возврат/приём создаёт новый доступный экземпляр.

`item_transfer.sender_char_id` теперь nullable: NULL означает инвентарь сессии,
допустим только для `purpose=transfer` с персонажем-получателем. NULL у получателя
означает мастера: `transfer` принимается в инвентарь, `use` требует конечную цель.
Для исходящих из инвентаря действует уникальный индекс
`(session_id,client_action_id) WHERE sender_char_id IS NULL`.
Резервирование, приём/возврат, версия листа и статус хроники фиксируются атомарно.
Блокировки идут в порядке персонажей, затем запроса/экземпляра; ограничения
удаления участников с незавершёнными передачами продолжают действовать.

Миграция 126 добавляет `character_concentration` (singleton по char_id, уникальный cast_id,
spell_id, spell_name, started_at) и `concentration_effect` (cast_id, effect_uid,
effect_id, target_char_id либо encounter_id + npc_uid, снимок идентичности target).
Ссылки каскадно удаляются вместе с концентрацией или целью. Само снятие эффектов
выполняется транзакционной операцией приложения, а не удалением строк ссылок.
Миграция 127 добавляет `settings.autoAccept` с независимыми boolean items/potions/spells,
по умолчанию false, сохраняя прочие настройки сессии.

`settings.interactions.items`, `.potions`, `.spells` разрешают соответствующие
новые межперсонажные запросы (включены по умолчанию). Под каждым разрешением
показан его флаг автоподтверждения, только пока действие разрешено. Выключенный
вид нельзя отправить ни из меню, ни прямым API-запросом; сохранённое значение
автоподтверждения не обходит запрет. Применение на себя не запрещается. Уже
ожидающие запросы сохраняют возможность ответа.

### Сотворения заклинаний с несколькими целями (128)

`spell_cast_receipt` хранит `cast_id` UUID (PK), `char_id`, исходный `request` JSONB,
`result` JSONB, общий `healing_roll` JSONB и `created_at`. Удаление персонажа удаляет
receipt. Запись обеспечивает идемпотентность и один бросок лечения на сотворение.
В схему заклинаний добавлен объект `application_targets` с `count` (по умолчанию 1)
и `per_slot` (по умолчанию 0). Настройки конкретных записей меняются через MCP;
план для благословения и множественного лечащего слова — `scripts/spell-targets/plan.json`.

### Источники эффектов (129)

`item.data.application_sources` у типа 15 — массив `{item: {id}, key, target, condition}`;
редактор также допускает числовую ссылку `item`. Миграция один раз переносит текущие
`status_effects`, варианты зелий, связанные эффекты заклинаний и `on_end_effect`.
Дальнейшая поддержка ручная. Обратный поиск и фильтры эффектов используют этот
список и индекс первичного ключа источников. При чтении приватные и удалённые
источники фильтруются, включая их условия.
Эффекты с единственным заклинанием-источником получают тот же `icon_image_id` /
`icon_svg_id`; следствия завершения без собственной иконки получают ID исходного
эффекта. Файлы не дублируются, runtime-наследования нет.

Групповые спасброски хранятся в `session_event.data.savingThrow.results` без
новой таблицы. Обновление исходного события блокируется транзакцией; одна цель
имеет один результат в событии. Такие события включены в mutable `updates`.

Миграция 130 добавляет редакторские поля `heal.apply` и
`application_targets.self_only` для заклинаний.
Поля производных эффектов также дополнены настройкой навыков и формулы КД,
чтобы новые заклинательные эффекты редактировались теми же средствами, что способности.
Параметры эффекта заклинания могут зависеть от круга ячейки или модификатора
заклинателя: значения фиксируются сервером до отправки применения, вместе
с длительностью из `duration_levels`. Смена получателя не пересчитывает их.

### Результаты урона и история NPC

`session_event.data.impacts` хранит фактически применённые результаты по цели; `impactRequests` — отпечатки запросов для повторов. В `session_encounter.data.combatants[].impactHistory` хранится серверная история HP и эффектов до удаления NPC. При копировании она очищается; клиентские сохранения сохраняют серверную историю. Новых таблиц нет. [Подробности](features/session-damage.md).

### Цели атаки (131)

Миграция `131_session_attack_targets.sql` проставляет `data.attackRoll=true`
историческим `dice_roll` с названием «Атака:»/«Переброс атаки:» либо
`weaponUseId` и частью d20, исключая урон. Новые атаки передают флаг явно.
Выбор мастера хранится в `session_event.data.attackTargets`: массив публичных
идентичностей персонажей/NPC без HP и снимков листов. Обновление под блокировкой
события заменяет только этот массив. Дополнительной таблицы не требуется.


`session_encounter.data.sheetInitiativeCursor` stores the acknowledged event id for sheet initiative preparation. It starts at zero for encounters without marked rolls. `combatants[].initiative` is also the prepared value while position is reserve; no separate stat or duplicated column is needed. Projection is driven by session_event JSON `sheetInitiative: true` and participant membership; event payload and cursor survive closing the DM page.


Миграция 132 (`spell-presentation`) заменяет текстовые `item.data.time/range`
у заклинаний типа 5 структурированными объектами и обновляет `item_type.fields`.
Условия реакций выделяются в `time.condition`, неоднозначные/альтернативные
значения сохраняются целиком как `kind: custom, text`. Дальность и размер области
сохраняют единицы (feet/miles). Старые строки runtime больше не читает. Схемы
feature_actions получают тип timed и объект time; существующие действия не меняются.

Миграция 134 (`spell-damage-type-choices`) добавляет `type_choices` в поля
`damage` и `rolls` схемы заклинаний (тип 5). Значение — массив ID типов урона
из словаря 12. Выбор заполняет только нефиксированные составляющие формулы;
записи справочника миграция не меняет. Настройка конкретных заклинаний проводится
через MCP, сверка хранится в отчёте об автоматизации заклинаний.

Миграция 135 (`spell-roll-sequences`) добавляет редактор таблиц определения
типа и условий продолжения атаки в схему заклинаний. Состояние одного
сотворения хранится в `session_event.data.sequence`; `hits[]` содержит
отдельные атаки, результаты, цели и `impacts`. Применение урона принимает
`sequenceIndex`, проверяет готовность попадания и совпадение цели, сохраняет
результат внутри этого попадания. Запросы повторного применения учитываются
на корневом событии вместе с индексом попадания.

Порядок миграций вынесен в `internal/store/schema_parts.go`; runner и
проверка checksum остаются в `schema.go`. Состав и порядок существующих
миграций при разделении не изменены.

## Общая механика применения предметов

Миграция 136 переносит параметры применения в `data.usable`, а накладываемые
эффекты зелий — в `usable.status_effects`. Пассивные эффекты экипировки остаются
в корневом `status_effects`. Возможность доступна вещам, зельям, оружию,
доспехам, транспорту, инструментам и магическим предметам. Одна активация
расходует одну единицу стопки; варианты, лечение, временные хиты, ссылки на
заклинания и длительности используют общий план применения.

`item_application.source` участвует в проверке повторного запроса.
Резерв хранит `_use_origin`: при отказе единица сливается только с неизменённой
исходной стопкой в том же контейнере. После перемещения, редактирования или
исчезновения стопки создаётся отдельная запись с новым UID. Для вещей она
возвращается в рюкзак. У оружия с `magic_item_id` применяется механика
магического предмета, экземпляр и количество берутся из контейнера оружия.

Миграция 137 добавляет редактор `item_creation` заклинаниям и `creation_sources`
физическим предметам. Экземпляры остаются обычными записями инвентаря с
`params.creation`; отдельной таблицы экземпляров не появляется. Уникальность
сотворения обеспечивает существующий `spell_cast_receipt`; UID каждого результата
детерминирован UUID сотворения и номером выходной записи. Время действия
хранится как игровой срок, без фонового таймера по настенным часам.

Миграция 138 закрепляет `reference_shape: "object"` у ссылок применения
(`effect`, `on_end_effect`, `usable.spell`). Редактор сохраняет их как `{id}`,
как требует сервер применения. Уже сохранённые скалярные ссылки этих полей
переводятся в объект по схеме, остальные поля и скалярные ссылки остаются
прежними. Например, `item_creation.outputs.item` хранит числовой ID.

## Редакции D&D: rules-editions и связанные миграции

`137_rules_editions.sql` добавляет редакцию 2024, PHB 2024, явные исходные решения для прежнего
каталога, пояснение совместимости, индексы и происхождение вариантов.
`138_character_edition_validation.sql` добавляет `char.cloned_from_char_id` и проверку новых item-ссылок в trigger
`validate_character_edition`. Миграция `151_character_edition_change.sql` разрешает
смену `source_version_id` только внутри прежней системы. Существующие item-ссылки
сохраняются; новые по-прежнему проходят проверку совместимости и источников.
Операция store блокирует строку, проверяет владельца и версию, увеличивает версию
ровно на один при смене редакции и сохраняет весь `data` без изменений.
`139_session_rules_edition.sql` вводит `session.source_version_id`, назначает прежним DND-сессиям 2014 и
проверяет соответствие системы и редакции. `140_origin_rules_fields.sql` расширяет схемы происхождения,
категорий черт, мастерства оружия, комплектов и прогрессий подготовки.
Обычное наполнение PHB выполняется MCP, отдельно от schema migrations.

Применённые файлы редакций сохраняют исходные имена и checksum. Числовые
префиксы 137/138 совпали при параллельном выпуске: идентификатор runner —
уникальный `schemaParts.name`/`schema_migration.code`, а порядок явно задан
в `schema_parts.go`. Исторические файлы не переименовываются и не выполняются
повторно; следующие миграции продолжают последовательность после 140.

Миграция `armor-minimum` (141) добавляет `armor_minimum` во все существующие
схемы `derived_effects`. Это нижняя граница итогового КД, а не базовая формула
и не прибавка. Данные заклинаний и эффектов заполняются отдельно через MCP.

`effect-application-context` (142) добавляет `status_effects[].apply_on`:
`cast`, `impact`, `any`. `spell-fixed-save-dc` (143) добавляет необязательную
`save_dc` (1–100) в `damage` и `rolls`, а также `rolls[].kind=save` для
самостоятельного объявления спасброска без урона.

`status-repeat-save` (144) добавляет эффектам `repeat_save` с характеристикой,
моментом, необязательной фиксированной Сл и условием. При применении
заклинания Сл источника фиксируется в `params.save_dc`; для этого используется
та же формула с бонусом выбранной вкладки, что и в исходном спасброске.

Миграция `145_spell_chain_limits` расширяет `damage.attack_chain` заклинаний
условием совпадения любой группы костей и лимитом перескоков, растущим от круга.
Это метаданные редактора; данные заклинаний записываются отдельно через MCP.

`146_created_item_expiry` добавляет декларативное последствие окончания срока
созданного предмета. Созданные экземпляры сохраняют его независимо от справочника.

`147_spell_projectile_targets` добавляет в редактор цепочки независимые снаряды
без перескока и разрешение повторных целей. Существующие цепочки сохраняют
прежние ограничения.

`148_spell_temporary_hp` добавляет вид выдачи ХП в формулу `heal` и переименовывает
общий сохранённый бросок `spell_cast_receipt.healing_roll` в `health_roll`.
Одинаковый результат используется и для лечения, и для временных ХП.

`feat-category-filter` (149) включает фильтрацию `item_type(7).fields.category`
и общие подписи четырёх категорий черт. Значения `item.data.category` и механики
записей не изменяются; категория старых черт автоматически не назначается.

`species-presentation` (152) добавляет типам расы/подрасы (8/16) редактируемые
`creature_type` и `size_description`. В `variants` расы добавлены
`size_description`, `benefits: [{text}]` и rich `description`. Миграция меняет
только схему редактора; конкретные записи PHB 2024 обновляются через MCP.

Миграция `153_race_choice_presentation.sql` добавляет `choice_only` в схему
способностей 3/4 и поля `ability_choice_key` / `ability_choice_source` в
`granted_spells` способностей. Второе поле — необязательная ссылка на способность
с сохранённым выбором; без него используется сам источник заклинания. Фиксированное
`ability` имеет приоритет. Характеристика берётся из выбранного suggest-16 ID
(1–6), а уровень открытия — из существующего `level`. Данные итемов обновляются
через MCP, а не этой миграцией.

`154_dragonborn_defenses_spell_fields.sql` восстанавливает `rolls.kind` схемы
заклинаний как select с вариантами damage/heal/effect/save. Миграция 143
обращалась к отсутствующему `options` у прежнего текстового поля и записывала
JSON null; из-за этого обход схемы в загрузчике связанных записей завершался
ошибкой даже при успешном ответе `/items/by-ids`. Историческая миграция неизменна;
исправляется причина в схеме, без сокрытия ошибки в компоненте. Та же миграция
добавляет `damage_type` и `defenses` в схему вариантов расы. Данные происхождений
обновляются через MCP. Регрессионный тест воспроизводит ошибку 143 и проверяет
восстановление поля; браузерная фикстура использует полную схему заклинаний.
