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

Startup data correction переводит прежние значения в этот вид и удаляет старые
ключи. Vue-компоненты знают только этот контракт.

## Перенос счётчиков и упаковки

`160_item_purchase_quantity.sql` добавляет полю типа 2 `purchase_quantity`
название «Количество в упаковке» и проверку положительного целого значения
в `item.data`. Цена и вес справочника описывают упаковку; `entry.count`
продолжает хранить поштучное количество.

`161_inventory_counter_migration.sql` переносит только проверенные физические
счётчики `values.counters` в первый рюкзак, заполняя свободные позиции и
сохраняя существующие вещи, экипировку и признак удаления персонажа. При
изменённом названии/максимуме либо появившемся одноимённом справочном стеке
исходная плитка остаётся для проверки. `inventory_counter_migration` хранит
пару `char_id,counter_id`, исходную плитку, созданную запись, раздел и
предыдущую версию. Повторный запуск не создаёт дубликаты. Спорные счётчики
и `values.resources` сохранены; выбранная исключённая копия не переносится.

`162_resolved_inventory_counters.sql` переносит уточнённые бурдюки, общий
остаток пайков и упрощённую деревянную вещь; три явно ненужных счётчика удалены.
Справочный набор артиста раскрывается в компоненты без книжных пяти пайков:
их заменяет остаток плитки. Его рюкзак сохраняет исходные UID и ячейку.
Название и описание упрощённого набора без известного состава указывают, что
пайки учтены отдельно; остальные компоненты не создаются. Журнал дополнен `action`
(`transfer`/`delete`) и снимками `inventory_before`/`inventory_after`.
Удалённые плитки сохранены в журнале, а исключённая копия остаётся без изменений.

`163_remove_inventory_counters.sql` завершает удаление формата:
`values.counters` убрано из всех документов персонажей, включая пустые массивы
и удалённые листы. Оставшееся непустое значение сохранено в существующем журнале
под `counter_id=retired-counters` с путём и исходным значением; предметы при
этом не создаются. Ограничение `character_without_inventory_counters` запрещает
возвращать поле любым способом записи. Версия меняется только у очищенных листов.

## Связанные страницы

[Оглавление wiki](../README.md) · [База данных и миграции](../database.md)
