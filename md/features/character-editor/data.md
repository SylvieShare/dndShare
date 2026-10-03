# Документ персонажа и сохранение

Канонический D&D JSON, semantic accessors и синхронизация. Здесь находится основной frontend-контракт документа.

← [Лист персонажа: устройство и интерфейс](../character-editor.md)

## Канонический документ D&D

The current shape under `data.values` is:

- identity: `name`, `race/subrace {id,name}`, `classes
  [{id,name,level,subclass}]`, `ava {url,upload_id?}`;
- level: `lvl {level,exp}`;
- ability: `STR..CHA {value:{base,bonuses},save_up,save_bonuses,
  check_roll_mode?,save_roll_mode?,skills}`; навык может хранить `roll_mode`.
  Отсутствующий режим или `auto` использует эффекты экипировки, остальные
  значения (`normal`, `advantage`, `disadvantage`) являются явным
  переопределением. В заголовке карточки спасбросок отмечен текстом «спас»
  display-шрифтом. Наведение на любую часть строки навыка через 450 мс открывает
  общую подсказку с описанием, раскладкой бонуса (характеристика,
  владение/мастерство, ручные и автоматические источники) и итогом. Подсказка
  плавно проявляется, заголовок отделён от содержимого, а подписи бонусов и их
  значения выровнены справа по стабильной числовой колонке;
- armor: `{bonuses}` хранит только дополнительные ручные бонусы. Базовый КД,
  Ловкость, щит, помеха Скрытности и владение вычисляются из каталожных
  доспехов в `items.equipped` и не копируются в персонажа;
- numeric tile with bonuses: `speed {base,bonuses}` and `initiative
  {base,bonuses,use_dex}`;
- HP: `{current,max:{base,bonuses},temp,ds_success,ds_failure,
  hitDice:[{die,total,used}],history?:[{kind,gain,level?,classId?,className?,classLevel?}]}`;
  history kinds are `level`, `manual` and `untracked`. History is an audit of base
  contributions; current bonuses remain in `max.bonuses`. Missing history means
  no recorded breakdown. Legacy numeric `max` remains read-compatible;
- spellbook: `{schema_version:2,slot_pools,tabs,grants}`. Each tab is
  `{key,name,class_item_id,casting_ability,mode,save_bonus,attack_bonus,spells}`;
  each editable spell is `{key,id,prepared}`. `class_item_id` is unique among
  non-custom tabs. External readonly spells are independent `grants` with a
  structured `source` and optional casting overrides. Slot totals and usage are
  persisted as editable resources, including zero totals and stocks above nine.
  Loading the sheet or changing class data never recalculates them. Level-up adds
  only positive per-circle differences between class progression before and after
  the level, preserving manual totals and spent slots in both pools. Pact Magic
  circle upgrades remove the old class count from the short-rest pool and grant
  the new circle; slots exceeding that count stay on the old circle;
- inventory: `{equipped:[Entry],sections:[{id,name,items:[Entry],slots?:{[uid]:index}}]}`, where an
  owned item entry is `{uid,item_id,count,params,override}`;
- potions: type-10 owned entries inside inventory spaces, without a separate
  value or block; physical tools are type-14 entries in inventory, while tool proficiency remains in
  `proficiencies['Инструменты']` and is not inferred from ownership;
- wallet: `{order:[suggestId],amounts:{[suggestId]:number}}`;
- race/class/feat abilities: arrays of item references/current counters
  `{id,uid?,count,max_use?,resource_counts?,resource_version?,choices?}`.
  `choices` maps each stable handbook choice key to the selected values, for
  example `{style:['defense'],language:[6]}`; selections belong to this owned
  entry rather than to a hidden class/race rule;
  `count` stores the available charges of a single resource; `resource_counts`
  maps stable keys when one ability owns several independent resources.
  `resource_version` marks counters already migrated to the unified contract.
  Fixed and derived maxima remain handbook rules rather than copied character
  data (only `manual_size` stores `max_use` on the entry).
- shared class resources: `class_resource_counts` maps a stable pool key to its
  available charges. The class catalogue owns unlock levels, maxima and rest
  rules. Contributions with the same key form one pool and use the highest
  class-provided maximum rather than adding together; this implements the
  shared `channel_divinity` counter for cleric/paladin multiclass characters.

There are no `class/subclass` mirrors, scalar level/stat/hit-dice forms, array
spellbook, flat inventory or array wallet.

Автоматические источники преимущества и помехи собираются независимо. Если
хотя бы один источник даёт преимущество и хотя бы один — помеху, они взаимно
отменяются и итоговый режим становится обычным, независимо от количества
источников. Явный режим в редакторе остаётся пользовательским переопределением.
`useCharacterRollEffects` предоставляет единый `register/effects/resolve`
контракт: доспехи являются встроенным источником, а способности, состояния и
предметы могут регистрировать дополнительные эффекты без изменения компонентов
характеристик и инструментов.
Нажатие на число навыка, спасброска или модификатора характеристики открывает
меню броска как на карточке, так и в редакторе, на desktop и mobile. Переключатели
«Помеха» и «Преимущество» расположены в одной строке, как у оружия; ниже —
«Бросить». При каждом открытии меню они заново получают текущий режим с учётом
автоматических эффектов и сохранённого переопределения. Если автоматические
источники взаимно отменяются, отмечены оба переключателя. Оба включённых или
оба выключенных дают обычный бросок. Выбор действует только на подтверждаемый
бросок, не сохраняется в листе и сбрасывается после закрытия меню. Бросок
сохраняет бонусы, цвет, триггеры и корректировки персонажа.

Для инструмента в меню снаряжения доступен бросок с выбором одной из шести
характеристик; владение инструментом автоматически добавляет бонус мастерства,
а режим броска использует те же автоматические эффекты характеристики.

Spell preparation applies only to editable spells of level 1 and higher in a
tab whose mode is `prepared` or `spellbook`. Cantrips never offer preparation
actions, and stale flags on cantrips or `known` tabs are cleared after handbook
details load. The row menu toggles preparation; prepared spells receive compact
accent brackets. Permanently granted archetype/domain spells are not modelled
as a second preparation flag: they live in the readonly grants list.

An ability, class feature or feat may contribute spells through its handbook
`granted_spells` contract. Each source creates its own entry in `spells.grants`,
shown under the slot pools and outside editable tabs. It cannot be reordered,
prepared or deleted. `source` records the feature displayed to the player;
`casting_ability` overrides the linked tab ability for this grant, `slotless`
avoids spending a slot, and `cast_level` fixes a rules-defined cast level.
Removing an automatic source removes only its grant; an independently learned
copy in a tab remains. Creation, level-up, live sheet and print use this model.

`internal/store/schema/61_spellbook_tabs.sql` migrates existing rows before HTTP
start and removes the shared-list/source-settings shape. Components neither
recognize nor write previous spellbook fields.

## Семантические accessors

`settings/dnd/accessors.js` and the VTM accessors define:

- `displayName`, `avatar`, `subtitle`, `level`;
- `hp`, `ac`, `initiativeBonus`, states;
- D&D ability radar;
- `headerTitle`, `listFields`, HP write path.

Consumers pass `{templateId,data}` and resolve the setting. They must not scan
block schema or know storage paths independently.

## Сохранение и синхронизация

Character documents have technical `char.version`. Full updates and data
patches are owner-authorized. Poll/version endpoints detect remote changes;
pending local changes are saved by the editor's serialized save orchestration. Full saves require the loaded technical version and return the next one; stale writes receive HTTP 409. A conflicting draft stays local and shows a message asking the player to copy needed edits before reloading. Dismissing the message does not let polling replace that draft. Transfers flush local changes before mutating inventory and refresh the server document afterward. The
technical revision is unrelated to character level or rules edition.

## Связанные страницы

[Оглавление wiki](../../README.md) · [Лист персонажа: устройство и интерфейс](../character-editor.md) · [API: персонажи](../../api/characters.md) · [БД: персонажи и инвентарь](../../database/characters.md)
