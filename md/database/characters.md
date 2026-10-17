# БД: персонажи и инвентарь

Хранение документа персонажа и журнал переноса физических счётчиков в инвентарь.

← [База данных и миграции](../database.md)

## Персонажи

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

Vue-компоненты читают только этот контракт. Подготовка или преобразование
документов выполняется отдельной операцией с данными; startup создаёт структуру
и не переписывает JSON персонажей.

## Упаковки и текущие ограничения

`item.data.purchase_quantity` задаёт количество в упаковке. CHECK
`item_purchase_quantity_positive` допускает только положительное целое число.
Цена и вес справочника описывают упаковку, а `entry.count` хранит поштучное
количество.

`values.counters` не является частью текущего формата.
`character_without_inventory_counters` запрещает его запись; физические вещи
хранятся в обычных секциях инвентаря, доступные заряды — в полях ресурсов.
Миграции не переносят и не удаляют содержимое листов. Исторические журналы
прежних операций в существующей БД сохраняются, приложение их не изменяет.

## Связанные страницы

[Оглавление wiki](../README.md) · [База данных и миграции](../database.md)
