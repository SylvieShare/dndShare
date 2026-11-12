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
  переопределением. В заголовке карточки кнопка «Спас» показывает итоговый
  бонус и метку владения при наличии. Наведение на любую часть строки навыка
  через 450 мс открывает подсказку с описанием, раскладкой бонуса (характеристика,
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
источников. Режим можно временно переопределить в меню текущего броска;
редактор характеристики и навыка не сохраняет выбор режима.
У навыка и спасброска оба клиента объединяют число и режим броска общей цветной
подложкой: пометка слева, число в собственной области справа с небольшим внешним
отступом. При наличии режима собственный фон числа прозрачен, включая hover
и открытое меню; видна только общая цветная подложка. Обычные значения сохраняют
свой фон. У основного модификатора число слева, увеличенная пометка справа.
Появление режима не сдвигает числовые значения ни по горизонтали, ни по вертикали.
Пометка показывает два статичных d20 со значениями 1 и 20, размером
RollModeBadgeDie (22), для основного модификатора — RollModeMenuDie (36). Под ними мелкая подпись
«Преимущество» или «Помеха» с ролью RollModeCaption (9/11). Вся группа имеет
мягкую подложку в 12% цвета режима, без рамки. При преимуществе кубики
зелёные и зачёркнут 1; при помехе — красные и зачёркнут 20. Отброшенная кость
приглушена, но значение остаётся читаемым. Подсказка и доступная подпись содержат
название режима и его источник. При взаимной отмене остаётся нейтральное «ОБЫЧ.»
с ролью BadgeCompact (11); двусмысленная пара костей для обычного броска не выводится.
Пометка берёт тот же режим,
с которым открывается меню броска. Обычный бросок без конфликта эффектов
отображается без пометки.

Иконка характеристики использует SVG словаря и цвет самой характеристики.
Если локальная метадата содержит
только svgId, общий SvgIcon лениво запрашивает /api/svg/ID. Запросы одного ID
объединяются; рисунок хранится в памяти и public:svg:ID в IndexedDB/SQLite.
Готовый SVG, пришедший вместе с ID до синхронизации, также сохраняется в этот кеш.
Повторный запуск без сети использует сохранённый рисунок. Пока он загружается,
место сохраняет скелетон; подпись и значение характеристики доступны сразу.
Полученный по ID SVG отображается маской как изображение через временный Blob URL,
без вставки загруженной разметки в DOM; URL освобождается при смене иконки или unmount.

`useCharacterRollEffects` предоставляет единый `register/effects/resolve`
контракт: доспехи являются встроенным источником, а способности, состояния и
предметы могут регистрировать дополнительные эффекты без изменения компонентов
характеристик и инструментов.
Нажатие на число навыка, спасброска или модификатора характеристики открывает
меню броска как на карточке, так и в редакторе. При открытом меню выделяется
только область выбранного числа, а не вся карточка характеристики. Пункт «Изменить» расположен
после сводки и перед секцией «Режим броска»; в режиме чтения его нет.
На вебе и Android «Помеха» и
«Преимущество» показаны двумя карточками на контрастной подложке. Они используют
отдельный RollModeOption с RollModeBadge в варианте large: кости RollModeMenuDie
(36). ChoiceCard использует публичные варианты tinted и centered, минимальную
высоту RollModeCardMinHeight (88) и цветную подпись RollModeOption (16/20)
внутри карточки. Пояснений «Меньший из…» / «Больший из…» нет. Зачёркивание показывает,
какую из двух костей берёт бросок. Выбранная карточка использует насыщенную
цветную заливку и внутреннюю рамку 2px через selectionIndicator="outline";
галочки нет, размеры при выборе не меняются. Нажатие на другую карточку сразу переключает режим. Повторное
нажатие снимает выбор и возвращает обычный бросок. При открытии меню учитываются
текущие автоматические эффекты. Если эффекты взаимно
отменились, меню открывается без выделенной карточки. Ручной выбор действует
на один бросок и сбрасывается при закрытии. Бросок сохраняет бонусы, цвет,
триггеры и корректировки персонажа.

Дополнительные правила броска идут без верхнего разделителя. `RollBonusOptions`
показывает иконку исходного состояния (`source_status.item`) или предмета/способности
(`source_item`), название и формулу бонуса. Вся строка — один `ToggleSwitch block`
с дорожкой справа; клик по имени, иконке, формуле и пробел с клавиатуры переключают
только участие правила в текущем броске. Само состояние не изменяется.
Тумблеры в меню используют `surface="raised"` с тёмной контрастной дорожкой
в выключенном состоянии; для обычных плиток остаётся `surface="base"`.

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

Spellbooks are stored in the current tabs-based contract. Components neither
recognize nor write previous shared-list/source-setting fields. Preparation
of older data is an explicit operation outside structural migrations.

## Семантические accessors

`settings/dnd/accessors.js` and the VTM accessors define:

- `displayName`, `avatar`, `subtitle`, `level`;
- `hp`, `ac`, `initiativeBonus`, states;
- D&D ability radar;
- `headerTitle`, `listFields`, HP write path.

Consumers pass `{templateId,data}` and resolve the setting. They must not scan
block schema or know storage paths independently.

## Сохранение и синхронизация

Лист использует `char.version` и [общую очередь патчей](../../document-sync.md).
Сервер принимает изменённые узлы по стабильным ID и хранит прямые и обратные
изменения персонажа вместе с автором и транзакцией. Ввод сохраняется через
400 мс, HP и состояния — сразу. Потеря ответа повторяет тот же пакет;
независимые изменения объединяются после 409, конфликт одного узла сохраняет
черновик. Закрытие предупреждения не разблокирует конфликт. Явная загрузка с
сервера после подтверждения очищает очередь. Ctrl/Cmd+Z вне текстового поля
отменяет локальное JSON-действие, Ctrl/Cmd+Shift+Z повторяет его.

Готовность сохранения определяется загруженным `serverDocument`, а не только
числом версии: состав сессии может прийти по SSE раньше GET листа с той же
версией. Такая последовательность не блокирует отправку правок владельца или
мастера. Более свежий состав сохраняет приоритет над устаревшим GET; базой
остаётся серверный JSON без добавленных только для отображения пустых полей.
Закрытие листа отправляет оставшуюся очередь после текущего запроса и только
затем останавливает менеджер. При ошибке связи действует тот же повтор пакета.

В контексте сессии общий SSE передаёт состав и хронику; открытый лист получает
свою разрешённую проекцию без отдельного периодического запроса версии.
Передачи и другие предметные команды сначала дожидаются сохранения локальных
правок, затем обновляют серверное состояние. Техническая версия не является
уровнем персонажа или редакцией правил. Отдельного окна истории пока нет.

## Фотографии личности

values.person_photos — список дополнительных фотографий: uid, imageId, url,
name и необязательные thumbnailId/thumbnailUrl. uid стабилен и используется
селектором патчей. imageId ссылается на storage_image; это не ссылка на item.
Миниатюра является производным изображением, а не другим полем описания.

Загрузка использует POST /api/storage/images. Для крупных фотографий клиент
готовит WebP до 4096 px по длинной стороне и отдельную миниатюру до 320 px.
Маленькая фотография может использовать один файл для обоих размеров.
В документ добавляется готовая пара URL; двоичные файлы в JSON не помещаются.
Удаление убирает запись из списка через обычную версионную очередь, не удаляет
общий файл из S3 и поддерживает локальное восстановление/undo документа.

## Связанные страницы

[Оглавление wiki](../../README.md) · [Лист персонажа: устройство и интерфейс](../character-editor.md) · [API: персонажи](../../api/characters.md) · [БД: персонажи и инвентарь](../../database/characters.md)
