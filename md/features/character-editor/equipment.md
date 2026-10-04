# Инвентарь и оружие на листе

Экземпляры вещей, экипировка, вес, оружейные броски и композиция предметных меню.

← [Лист персонажа: устройство и интерфейс](../character-editor.md)

## Содержание

- [Использование расходников](#использование-расходников)
- [Кошелёк](#кошелёк)
- [Пространства инвентаря](#пространства-инвентаря)
- [Инструменты и доспехи](#инструменты-и-доспехи)
- [Формулы оружия](#формулы-оружия)
- [Ресурсы в общем блоке и меню урона](#ресурсы-в-общем-блоке-и-меню-урона)
- [Подготовка бросков оружия](#подготовка-бросков-оружия)
- [Выбор расхода и предпросмотр урона](#выбор-расхода-и-предпросмотр-урона)
- [Сетка инвентаря и меню экземпляра](#сетка-инвентаря-и-меню-экземпляра)
- [Анимации изменений](#анимации-изменений)
- [Иконки и предметные панели](#иконки-и-предметные-панели)
- [Свойства оружия и стоимость экземпляра](#свойства-оружия-и-стоимость-экземпляра)
- [Карточки свойств и зарядов](#карточки-свойств-и-зарядов)

## Использование расходников

В меню зелья первым стоит подменю «Использовать на…». Его пункт «На себя» применяет лечение,
временные хиты и связанные эффекты вместе с расходом одной дозы. Результат
показывается с кубиками и фактической прибавкой хитов. Передача предмета
остаётся отдельной операцией с резервированием всей стопки.
При подключённой сессии это же подменю также показывает мастера и
остальных персонажей с именами и аватарами. Выбор отправляет запрос применения,
сервер резервирует ровно одну дозу. Получатель видит её в «Событиях» и может
«Принять» или отказаться; отправитель — «Отменить применение».
Принятие применяет механику к листу получателя и окончательно расходует дозу,
не добавляя её в инвентарь. До принятия видны формулы, эффекты, длительность и
ручные условия; кости бросаются только при принятии. Вариант зелья выбирает
отправитель до резервирования, если в справочнике задан `usable.choices`.
При отказе доза возвращается в неизменённую исходную стопку; если та перемещена,
изменена, потрачена, заполнена до 999 или сама передаётся, создаётся отдельная
строка с уникальным UID. Потерянный ответ и повторное решение не списывают
или не возвращают дозу дважды. Без сессии подменю содержит только «На себя», в режиме чтения скрыто.

## Кошелёк

`InventoryWallet` в карточке предметов переиспользует `BlockMoney` с режимом
`inline`. `BlockMoneyView` использует embedded-режим общего `MorphTile`,
иконку `Wallet` и одну общую `ActionButton` вокруг иконки и балансов.
Вся область владельца показывает pointer и общую hover/focus-подсветку;
нажатие на монеты или иконку открывает калькулятор. Отдельная поверхность и
заголовок не создаются. Превью морфа неинтерактивно и имеет отступы 16×18 px.
`MoneyMorphPreview` сохраняет ширину строки и внутреннюю геометрию исходной
кнопки, двигая её через `transform` одновременно с раскрытием окна (420 ms)
и возвратом (300 ms). Высота превью фиксирована для этого перехода; отступы
не переключаются скачком. Движение строки запускается вместе с окном, без
задержки фазы появления редактора; закрытие использует обратную траекторию.
`ResizeObserver` источника обновляет геометрию при
изменении суммы, а широкому кошельку выделяется достаточная ширина окна.
Визуальная кнопка превью отключена, скрыта из дерева интерактивных элементов
и сохраняет исходную непрозрачность; `opacity:1` задано непосредственно на
визуальном экземпляре, поэтому стандартное затемнение disabled-кнопки не
затрагивает превью. Доступный статичный контейнер сообщает баланс.
`MoneyBalanceLine` переиспользует вывод валют и анимацию изменений в источнике
и превью. Калькулятор, выбор монеты и обратная связь баланса
остаются в общем компоненте. `InventorySkeleton` описывает загрузку секций
внутри уже существующей карточки, поэтому кошелёк не перемонтируется после
загрузки предметов.

## Пространства инвентаря

`DndItems` uses `lib/itemSection.js` and the handbook item picker. Its «Вещи»
picker follows `item_type.parent_type_id` and therefore searches the root type 2
plus all linked child catalogues. Equipped items are a top-level array;
equipment state is selected through the item menu and does not create a separate visible space. Entry override
is for a custom name/description/count metadata, while referenced item content
comes from handbook. A referenced row prefers `iconImageUrl`, then `svg`, then
the collection image. Weapon, armor and ordinary item rows retain type-specific
content composition; simplified custom inventory cells use the selected `icon_preset_id`, or the root
collection icon by default (the mystery cube for «Вещи»). Creation and editing
allow choosing a named preset from the root collection and its linked types.
Selection survives moving, stacking and transfers; URLs are resolved from the
shared preset catalogue rather than stored in the character. Empty backpack
cells use the separate S3 artwork of an open empty pouch. Inventory icons scale inside
the square bag cells; equipment state is marked by the purple cell frame. Weapon cards use the same 64×64 slot and prefer the
handbook `iconImageUrl`, falling back to the weapon SVG; the rest of the
weapon-specific attack, damage and property composition remains unchanged. A
click on a weapon tile opens its action menu instead of navigating directly
from the name. Attack, damage, critical damage and ability-contributed damage
rolls live only in that menu; the displayed attack and damage values are not
independent click targets. Logical groups use the shared action-menu separator.
Attack, damage, critical damage and feature damage actions use distinct Lucide
icons instead of the generic ellipsis. The source tile stays highlighted while
its menu is open; spell, inventory and potion action menus follow the same
interaction rule. Magic weapons that require attunement show **Настроено** /
**Не настроено** below their name, using the state of that instance. The status
is visible to owners and readers on desktop/mobile; the weapon menu changes it.
Weapons share one **Оружие** tile with row separators and an
owner-only **Добавить оружие** footer. A second **Базовые атаки** tile contains
two always-available rows for Strength-based unarmed and improvised-weapon
attack, damage and critical rolls, also separated by a line.
`share-ui/SectionList` owns the common surface, heading and separators for
weapons, basic attacks and spell levels (including granted spells). Ability
categories and action types use its embedded list inside their existing tiles.
Separators divide menu-trigger roots, so expanded and compact ability rows both
show them correctly. Spell row transitions and weapon/spell sortable containers
are passed through the same component. The weapon table variant remains a table
inside the weapon group.
Unarmed attacks include proficiency and deal `max(0, 1 + Strength modifier)`;
the generic improvised weapon is not proficient and deals `1d4 + Strength`.
The rows reuse the weapon tile geometry and `AttackDamage`: attack is a numeric
bonus without a decorative d20 and damage has no enclosing formula frame. The
unarmed total keeps `1 + Strength modifier = total` in its hover explanation;
zero is valid and the total never becomes negative. Their 64 px illustrations
reuse system artwork from the Unarmed Strike and Club handbook items, so the
sheet does not ship duplicate raster assets or diverge from the weapon art set.
Prominent feature metrics such as Sneak Attack still render their actual system
dice before the flat modifier.
The remaining menu contains handbook description, edit, move-to-inventory and
delete actions according to the viewer's permissions and linked item state.
Every owned inventory item, potion and tool uses `item_id`, an explicit `count` and a
typed `params` object. `params` contains values of the concrete instance and is
not an alternative handbook-data or free-form override store. Item-type
`instanceFields` declares the available parameters. Measured gear such as hemp
and silk rope stores `length_ft` on each reference; its handbook row stores only
measurement kind plus unit cost/weight. Displayed cost and weight scale with the
stored length, and stacks merge only when both `item_id` and canonical `params`
match.

Для упаковок `item.data.purchase_quantity` задаёт количество штук, к которому
относятся каталожные цена и вес. `entry.count` хранит штуки; подсказка рюкзака
показывает цену и вес всей стопки, включая неполную упаковку. Передача предмета
сохраняет это поштучное количество.

## Инструменты и доспехи

Type-14 tool entries stay in the ordinary inventory and have a compact category
line under the name. Their row action menu never changes character proficiency:
ownership and `proficiencies['Инструменты']` are independent, so a character may
know a tool without carrying it and carry one without being proficient. The
handbook detail resolves `required_tool_proficiencies` through suggest type 5
and displays the acceptable concrete/category proficiencies under the cover;
multiple links use OR semantics. Inventory tiles resolve those links against the
character proficiency buckets and show `Владение` only on matching tools and
armor. Weapon tiles use the same resolver for
`required_weapon_proficiencies`; an automatic match also supplies the attack
proficiency bonus. The expanded weapon editor does not expose a separate
proficiency switch: it is determined from the character's proficiencies and
the weapon handbook links. Inventory cells use handbook images scaled within their square slots while
retaining type-specific inner content.

Starting armor is placed directly in the equipped array. Its handbook
`data.armor` rule initializes AC as readonly equipment-derived bonuses; light
and medium armor include Dexterity and medium armor applies `dex_cap`. The
semantic accessor, visible tile and printable sheet all use the same formula.
Long rest restores half the total hit-dice pool automatically and does not ask
the player to allocate recovery manually. Spell save DC and spell attack tiles
expose their formulas as hover titles. Hovering an interactive resource or
spell-slot sphere previews the continuous range affected by a click: a charged
sphere and the charged spheres to its right, or a spent sphere and the spent
spheres to its left. Read-only spheres do not show this interaction preview.

## Формулы оружия

Weapon handbook attacks use canonical `{dice_id,type,count}`. Character-added
attack rows use `{count,dice_id,type_suggest_id}` and are explicitly adapted at
the calculation boundary; this is not a fallback between stored formats.
An empty weapon `stat_suggest_id` is the explicit **Auto** mode: melee weapons
use Strength, ranged weapons use Dexterity, and finesse weapons use the larger
of the current Strength and Dexterity modifiers. The calculation is live, so a
later ability-score change updates attack and damage without rewriting the
weapon entry. A manually selected ability overrides Auto.
Weapon enhancement follows the same owned-instance contract: the explicit
`params.magic_bonus` value supplies the bonus to both attack and damage.
`magic_up` is not read or written.
All `dice_id` values are fixed system strings (`"d4"`…`"d100"`); die visuals
use `SystemDie` and never load suggest type 11. Spell
handbook dice use only `dice_id/type`. Spell class ownership uses item-id
references under `classes`. Compact spell rows show the English name after the
Russian one and start their metadata with verbal/somatic/material components;
concentration and ritual remain title badges instead of being repeated in the
duration text.

## Ресурсы в общем блоке и меню урона

Ресурс магического оружия по умолчанию показывается на оружии, без дублирования
в общем блоке. Так же исключаются ресурсы, представленные в действиях или
виджетах. Если другого отображения нет, ресурс остаётся в общем блоке.
Все полученные из листа ресурсы доступны в редакторе: флажок «Отображать здесь»
переопределяет правило для конкретного персонажа. Настройки сохраняются в
`values.resource_visibility` как `{ [resourceKey]: boolean }`; отсутствие ключа
означает автоматический выбор. Переезд предмета в рюкзак пересчитывает только
автоматическое значение. Собственные ресурсы блока остаются видимыми.

В подменю урона дополнительные свойства отделены от крита, хвата и метания
разделителем. Под ними `DamageFormulaPreview` показывает итог теми же кубиками
`DamageDice` (26 px) внутри компактной рамки. Подменю атаки и урона не содержат
дублирующего заголовка; кнопка броска остаётся внизу. Превью и бросок используют `useWeaponDamageRolls`, включая
тип урона, хват, крит, импровизированное метание и дополнительные кости.
Посох ударов (189) предлагает три ячейки вместо галочки, изначально выбрано 0.
Нажатие выбранной ячейки уменьшает количество до предыдущей; недоступные
заблокированы. Выбор не тратит ресурс. При броске урона количество и текущий
остаток проверяются заново, затем выполняется единое списание конкретного
экземпляра. Крит увеличивает только кости. Цели и действия обучения не меняются.

При последнем заряде предмета с `last_charge` под оружием появляется временный
блок проверки. Он работает также в табличном виде и после переноса в инвентарь.
Бросок доступен владельцу; читатель видит ожидание. При утрате магии блок показывает
результат и подтверждаемую отмену ошибки. У Посоха ударов это к20 и утрата магии
на 1. Состояние хранится на экземпляре; детали — в `magic-items.md`.
Навигация, цели и действия обучения desktop/mobile не изменены; сценарии проверены.

Именованные `weapon_uses` включаются галочкой в подменю атаки оружия. Галочка
показывает дистанцию/расход и не тратит заряд; бросок сохраняет оплату и отдельные
шаги применения на UID. Под оружием и в инвентаре остаются только блоки отдельного
урона, без вложенных рамок и сводки атаки: условия, кнопка слева от формулы,
после броска — выпавшие кубики и «= итог», без отдельной строки «При успехе».

Урон по конечной цели включается галочкой в подменю урона, использует общий
флажок крита и исчезает после броска. Повторной оплаты нет. Крит относится только
к попаданию, а линия доступна и при промахе. Незавершённые шаги переживают
перезагрузку и перемещение предмета. Обычные атаки остаются доступны.
Владелец управляет шагами; читатель наблюдает. Метательное копьё молнии (284)
использует этот интерфейс. Цели обучения не перемещены; desktop/mobile и роли
покрыты прежними сценариями.

В подменю «Бросить на атаку» всех оружий показаны два переключателя в одной
строке: «Помеха» и «Преимущество», разделённые вертикальной чертой. Включение
одного блокирует второй до выключения; при повторном открытии меню оба выключены.
Явный выбор переопределяет режим броска через существующий `resolveRollMode`:
два к20 с меньшим/большим результатом. Когда оба выключены, действует `auto` —
режим определяется эффектами персонажа и владением доспехом. На урон эти галочки
не влияют. Они работают также с метанием, особыми применениями и перебросом
атаки от способности. Рукопашный удар и импровизированное оружие используют
то же подменю. Цели обучения desktop/mobile и ролей не изменились.

Перенос бонуса оружия в защиту (`weapon_bonus_transfer`) выбирается ячейками
в подменю атаки. Это сохранённый выбор количества без ресурса: +N к КД сразу
вычитает N из магического бонуса атаки и урона данного экземпляра. При ненулевом
выборе `WeaponBonusTransferPanel` под оружием показывает КД, оставшийся бонус
и ручной сброс; в режиме чтения кнопки нет. Панель доступна также в инвентаре.
В сумке и при неактивной магии КД не увеличивается. Ячейки переиспользуют
`WeaponResourceAmount` с отдельной подписью единиц бонуса вместо зарядов.
Ход и удержание в руке контролирует игрок, автоматического истечения нет.

Для оружия с `selected_target` общий `SelectedTargetPanel` показывает объявленного
противника, срок в рассветах, состояние гибели/ожидания и владельческие действия.
Выбор относится к одному UID источника. `selectedTargetDamageRules` добавляет
связанный пункт в оба подменю; его выбор хранится на экземпляре. Правила режима
броска подключены к `characterDerivedEffects`; контекст явно отличает оружие от
безоружных ударов/заклинаний. Рассвет обновляет сроки целей вместе с ресурсами
одним patch, даже если заряды не восстанавливаются. Подробнее — в разделе
«Выбранная цель оружия» [магических предметов](../magic-items.md).

Selectable class abilities (including Warlock invocations) are separate type-4
items with `selection_parent_id`. Their parent owns count progression and
replacement limits; automatic class grants exclude these options. Level-up
validates selections against the resulting class level, pact and spell choices.
The ability row menu can fill missing choices on existing sheets. Selected rows
are ordinary class abilities with independent mechanics and preserved resource
state. See [Warlock invocations](../warlock-invocations.md) for storage, UI and
current automation limits.

Линейная прибавка кубиков за круг ячейки находится внутри формулы заклинания:
`текущая формула + [кубики]`. `SpellScalingFormula` использует `DamageDice`;
под пунктирной рамкой — «за круг свыше N-го», при `scaling_step > 1` —
«за каждые K круга свыше N-го». Знака умножения и ячейки в рамке нет.
Бонусная часть уменьшена до 70% размера основных кубиков и заключена в пунктирную
рамку. Она видна, только если в одном из пулов отдыха есть ячейки более высокого
круга (`total > 0`; расход не скрывает обозначение). Особые пояснения усиления за
ячейку подчиняются тому же условию. Названия видов урона под кубиками переносятся
на несколько строк в ограниченной ширине.
Обозначение открывает общее меню строки. Оно также используется у отдельных
эффектов; у врождённых заклинаний с фиксированным кругом его нет. Особые пороги,
пределы, рост количества лучей и усиление заговоров остаются точным текстовым
пояснением. `AttackDamage` предоставляет suffix-слоты для этой композиции.

## Подготовка бросков оружия

`shared/lib/weaponDamageOptions` проверяет граф выбранных добавок к урону,
сбрасывает зависимые переключатели и определяет способ атаки. Сборщик боевых
эффектов добавляет к ключам связей namespace владельца/экземпляра, исключая
смешивание одинаковых правил разных предметов. `DamageRollOptions` показывает
условия и вложенность, передаёт выбор в броски атаки и урона. Расчёт проверяет
выбор повторно; бросок оружия сохраняет характеристику основы, но получает
контекст дальней атаки для эффектов и исключает хват двумя руками.

Адаптер `weaponDamageMenuOptions` передаёт меню готовые подписи, условия,
доступность и `damageParts`. Кости вычисляются в `weaponDamageActionParts`,
из тех же частей строится формула броска; при крите отображаемое количество
меняется вместе с расчётом. `DamageDice` рисует существующие `SystemDie`: в меню
размер 26 px, в карточках дополнительных режимов — 32 px. Новый параметр
`size` по умолчанию равен прежним 42 px и сохраняет размер остальных бросков.

`DamageRollOptions` хранит общий выбор параметров и открывает два штатных
`RowActionSubmenu`: «Бросить на атаку» и «Бросить на урон». `WeaponRollControls`
показывает настройки выбранного броска и кнопку выполнения; `WeaponRollOption`
рисует отдельный переключатель. Переключение подменю не сбрасывает параметры.

В подменю урона есть флажок «Урон бонусным действием» для атаки вторым оружием.
Он доступен лёгкому рукопашному оружию в 2014, любому лёгкому оружию в 2024 и
одноручному рукопашному оружию без свойства «лёгкое» при активном правиле
`two_weapon_non_light` («Мастер парного оружия» 2014, «Амбидекстр» 2024).
Естественное метание сохраняет доступность; импровизированное метание и
двуручное оружие её исключают. Хват двумя руками и флажок взаимно исключаются.
Игрок проверяет первую атаку, другое оружие и доступное бонусное действие;
состояние хода и занятых рук лист не ведёт. Для других источников бонусных атак
(например, магического скимитара скорости) применяются их собственные правила;
этот флажок относится именно к атаке вторым оружием.

`twoWeaponFighting` и `useTwoWeaponFighting` определяют доступность по свойствам
основы, редакции и активным производным эффектам. `useWeaponCalc` при флажке
исключает только положительный модификатор характеристики из урона, сохраняет
отрицательный, магический бонус и прочие прибавки. Эффект
`two_weapon_damage_modifier` сохраняет модификатор ровно один раз: у выбранного
боевого стиля 2014 и черты «Сражение двумя оружиями» 2024. «Мастер парного оружия»
сам по себе модификатор не возвращает. Атака сохраняет обычный бонус попадания.
Крит удваивает кости, но не прибавки. Превью и бросок используют один расчёт;
название и `bonusAction: true` в данных броска отмечают бонусное действие.
Флажок не сохраняется в документе персонажа. Оплаченное особое применение
сохраняет свою формулу и исключает этот флажок; недоступный старый выбор игнорируется.

Правила: [бой двумя оружиями 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat#TwoWeaponFighting),
[лёгкое оружие 2024](https://www.dndbeyond.com/sources/dnd/br-2024/equipment#Light),
[боевой стиль 2024](https://www.dndbeyond.com/sources/dnd/br-2024/feats#TwoWeaponFighting).
Миграция `170_two_weapon_fighting.sql` добавляет виды производных эффектов;
`scripts/sync-two-weapon-fighting.py --apply` подключает шесть проверенных
системных записей через MCP после выпуска схемы, сохраняя остальные поля.

`weaponThrow` добавляет всем оружиям режим «Метнуть» с ключом `weapon:throw`.
Если зависимость уже задаёт метание, используется её ключ и добавочные кости.
Метательное свойство определяется по id 6 или загруженной подписи свойства.
Для неподходящего оружия подготовка броска создаёт временную запись с
Ловкостью и признаком `_improvisedThrow`: 1к4 вместо обычных костей, без
обычного владения, оружейного магического бонуса и ручных дополнительных
атак. Исходная запись не изменяется. Тип урона по умолчанию берётся из основы;
особые владения импровизированным оружием и решения мастера требуют ручного
учёта. Для подходящего оружия сохраняются его кости, характеристика и бонусы.
Режим отключает хват двумя руками и рукопашные эффекты. Импровизированный
предпросмотр показывает замену кости через стрелку, а не добавочные +1к4.

`MagicItemMenuActions` выводит отдельную команду настройки на персонажа для
магических предметов, которым она нужна. Дополнительная форма экземпляра
доступна только для авторских выборов и ручного максимума. `magicItemSettings`
обновляет настройку по UID, не сбрасывая ресурсы, и разрешает только первоначальное
заполнение отсутствующей основы. Выбранная основа не редактируется. Один компонент
используется в инвентаре, карточках оружия и табличном варианте.

## Выбор расхода и предпросмотр урона

`WeaponResourceAmount` — предметный компонент выбора 0…N на основе существующего
`SpellSlotSphere`. `weaponDamageAmounts` масштабирует кости и цену одного правила
по выбранным ячейкам; это преобразование используется и меню, и транзакцией
списания. `DamageFormulaPreview` читает итоговую формулу броска через общий
`parseDiceExpression` и показывает группы типов урона компонентом `DamageDice`
в компактной рамке общего `BaseTile`. Подменю бросков не повторяют название
пункта отдельным заголовком; кнопка запуска остаётся после параметров.
Общий блок ресурсов использует `resourceVisibility`: без сохранённого флага
дубли на оружии, действиях и виджетах скрыты; пользователь может включить их
через редактор. Состояние остатка ресурса при этом хранится единожды в источнике.

`ItemLastChargeCheck` — общий предметный блок для оружия и инвентаря, на основе
`ItemMechanicPanel`, `SystemDie`, `ActionButton` и `ConfirmDialog`. `useLastChargeCheck`
читает актуальный экземпляр по UID, блокирует повторное нажатие и записывает
событие в сохраняемый журнал персонажа через его context. Чистый `itemLastCharge`
отвечает за создание, разрешение и отмену события; `setCharacterResourceAvailable`
вызывает его только при явном `spending=true`. Восстановление и редактирование
остаются обычными изменениями счётчика. `magicItemActive` и адаптер неактивного
инвентаря исключают `params.magic.lost`, включая восстановление на рассвете.
Браузерный сценарий проверки: `npx playwright test --config playwright.weapon-charges.config.js`.

`ItemMechanicPanel` задаёт единую оболочку механик предмета: тип с иконкой и цветом,
заголовок, краткое состояние, содержимое и ряд действий поверх `BaseTile`. Её используют
ресурсы, памятки/проклятия, выбранная цель, подтверждаемые применения, перенос
бонуса, `ItemLastChargeCheck`, `WeaponUsePanel` и справочный `WeaponUseSummary`.
`WeaponUseStep` показывает условия через `MechanicTheses`, кнопку слева от
`DamageFormulaPreview` в режиме `unframed` и результат через `DiceRollResult`.
Каждый отдельный урон имеет одну внешнюю рамку. `DiceRollResult` — композиция
существующих `SystemDie` с выпавшими значениями, знаками и итогом; предназначена
для сохранённого результата внутри механики, без глобального popup и новой
базовой поверхности.
`weaponUsePresentation` собирает одинаковые тезисы области/спасброска для листа
и справочника. Эти компоненты не зависят от ID конкретного предмета.

Чистый `weaponUses` проверяет доступность, создаёт снимок оплаченного применения,
разрешает шаги по ID события и сохраняет их на экземпляре. `useWeaponUses`
получает расчёты обычного оружия от `DndWeapons`, поэтому не дублирует правила
характеристик/бонусов. `useWeaponUseSteps` бросает сохранённые формулы без повторной
оплаты и пишет события через `charCtx`. Оба блокируют повторное нажатие.
Редакторы `WeaponUseEditor`/`WeaponUseStepEditor` управляют зависимыми полями;
`itemResourceOptions` общий для этого редактора и проверки последнего заряда.

`dice.runAction` вызывает необязательный `onReroll` после переброса к20. Особое
применение обновляет по нему сохранённый результат атаки без повторного расхода;
завершённый или заменённый ID применения не изменяется.

`useWeaponDamageRolls` содержит общий расчёт превью/броска урона, вынесенный из
`DndWeapons`. `weaponUseDamageActions` превращает ожидающий шаг попадания в
обычную галочку меню; ключ содержит ID применения и шага. Выбор заменяет базовую
формулу сохранённым уроном этого попадания, затем добавляет другие выбранные
правила. Сама оплаченная добавка не прибавляется второй раз. После броска шаг
разрешается по текущему UID/ID и сохраняется вместе с событием журнала.
Старый ключ, чужой UID и завершённое применение блокируют бросок до списания
ресурсов других галочек. Режимы атаки также используют `WeaponRollOption` вместо
select; одновременно активна одна галочка режима.

`DamageRollOptions` хранит локальный `attackRollMode` (`auto`, `disadvantage`,
`advantage`) и передаёт его в событии атаки. `WeaponRollControls` отображает
две взаимноблокирующие `ToggleSwitch` в одной строке с вертикальным разделителем;
режим по умолчанию — `auto`. `DndWeapons` передаёт ручной выбор общему resolver,
а `useWeaponUses` сохраняет его при запуске особой атаки. Штатный переброс к20
использует тот же режим без повторного расхода. `PresetAttackCard` использует
общие подменю атаки/урона и передаёт параметры атаки без отдельного UI.

`ItemResourcePips` — общий доменный вывод зарядов оружия: используется и
отдельной строкой, и внутри `ConfirmedItemUsePanel`, сохраняя одинаковые
ячейки `SpellSlotSphere`, размеры, доступность и значки восстановления.
`useInitialChargeStocks` объединяет настройку основного/именованных начальных
запасов в окне добавления и параметрах экземпляра. `ItemRuleActivation`
предоставляет единый выбор условий зависимости в редакторе магических предметов.

## Сетка инвентаря и меню экземпляра

`InventoryBagGrid` — доменная композиция `BaseTile`: квадратные ячейки,
пустая сумка и подсветка точной цели. В сессии четыре колонки, в листе режим
`adaptive` подбирает их по доступной ширине с минимальной ячейкой 72 px и зазором
8 px. `ResizeObserver` меняет только число колонок; индексы сохранённых позиций
не меняются. На время drag количество колонок фиксируется.
Под последним рядом с хотя бы одним предметом всегда остаётся один полностью
пустой ряд для добавления и переноса. Пустое пространство показывает один ряд.
Иконка сумки в пустой ячейке имеет `opacity: 0.08` у владельца и в режиме просмотра.
`InventoryBagEmptyCell` использует связанное `RowActionMenu`: при hover/focus
сумка сменяется плюсом, нажатие предлагает справочник и собственный предмет.
В рюкзаках отдельных кнопок добавления нет. Сумка и плюс используют встречный
fade/scale-переход (180/220 ms), без анимации при reduced motion. `InventoryBagItem` использует
`ItemIcon`, количество поверх иконки и клавиатурное открытие меню. Общий
`useSortable` с `layout: grid` отвечает за pointer lifecycle и ghost; это
отдельный режим общего drag API, а не копия обработчиков в приложении.
`SessionInventoryItem` открывает `RowActionMenu` со справкой, передачей и удалением.
Параметр `related` удерживает родительский поповер открытым при действиях в
телепортированном меню.
`RowActionSubmenu` использует `mobileBreakpoint=0` для floating-списка получателей.
`DndItems` собирает все пространства в одном `BaseTile`, включая skeleton.
Между пространствами используется только линия с названием без второго border;
режима списка, счётчика предметов у названия и отдельной видимой области
экипировки нет. Справа в заголовке — Lucide `Weight`, сумма в фунтах и условный
вертикальный
разделитель перед `RemoveButton`. `inventoryEntriesWeight` из `itemSection`
суммирует экономику стопок через `resolveWeaponItem`/`inventoryItemEconomy`,
а состав пространства берётся из `inventorySpaceEntries`, включая надетые вещи.
Пустые пространства показывают ноль; неизвестный вес не входит в сумму.
`useInventoryLayout` управляет только сетками. `inventorySpaces` размещает
надетые экземпляры в
пространствах по `slots`, меняет их состояние через меню и сохраняет статус при
переносе/обмене. `items.equipped` остаётся источником механик; `slots` пространства
могут содержать UID из этой коллекции. Неназначенные надетые вещи занимают первые
свободные ячейки первого пространства. Экипированный статус — доменная рамка
поверх `BaseTile` (`--accent`, 2 px); trigger наследует скругление и остаётся
на месте, пока меню открыто.
`InventoryItemMenuHeader` выводит имя и стандартный `RowActionSeparator` в обоих
инвентарях. Метаданные владения, КД, настройки, срока созданной вещи и панели
магических свойств находятся в меню предмета.
`useInventoryTooltip` готовит название, описание, стоимость и вес для общего
`InventoryItemTooltip` на `ItemTooltip`/`ItemTooltipDetails`. Сессия использует
описание экземпляра либо справочника; лист передаёт уже вычисленное display,
включая вес стопки упрощённого предмета. `ItemInlineFormModal` использует
`FormField`/`FormTextInput type="number" step="any"` для необязательного веса
одной штуки в фунтах. Отрицательный или нечисловой вес блокирует сохранение,
пустое поле удаляет заданный вес, ноль сохраняется. `DndItems` хранит его
в `entry.override.weight` при создании и изменении собственного предмета.
Подсказка привязана к иконке, доступна при hover/focus и скрывается при клике
или начале переноса.

### Анимации изменений

Новый предмет проявляется с небольшим увеличением, а удалённый целиком
сжимается и исчезает за 260 ms. Последний ряд сохраняется на время исчезновения
и до конца активного переноса; визуальная копия не принимает фокус, нажатия или drag.
Изменение количества сохраняет предмет в ячейке: иконка слегка откликается,
рядом с чипом всплывает зелёное «+N» или красное «−N». Изменение модели и
сохранение выполняются сразу. Перенос между ячейками/пространствами и в оружие,
экипировка и resize не считаются созданием или удалением. Начальная загрузка
и обогащение справочных данных не запускают эффекты. Reduced motion отключает
эффекты, а изменение этой настройки отменяет уже запущенные анимации.

## Иконки и предметные панели

`InventoryIconPresetPicker` uses shared `FormField` and `ActionButton` for
named image choices in the simplified item form. Its domain grid is separate
from color presets because it selects a catalogue ID and shows raster artwork.
`inventoryIconPresets` loads one public catalogue shared by the form, inventory,
empty cells and transfer views, deduplicating concurrent requests and offering
retry after failure. Entry presentation resolves `icon_preset_id` only for custom
entries; handbook media retains priority.

`features/items/components/ItemMechanicPanel` задаёт общий визуал всех предметных
панелей под оружием, справочных применений и проклятий: тип/иконка/цвет из
`itemMechanicPresentation`, название, краткое состояние, rich-content/тезисы и
нижний ряд действий. Это доменная композиция `BaseTile`, не новый UI-примитив.
`WeaponNotePanels` используется и в справочнике, и на листе; чистый `weaponNotes`
проверяет условие отдельно для каждого экземпляра. `ItemCostEditor` используется
каталожным и общим редактором; `itemCost` и `useCostFormatter` форматируют точную
цену и диапазон одинаково для всех типов со стоимостью.

Зелья хранятся и показываются обычными ячейками `DndItems`. `DND_POTIONS` и полка
удалены из реестра и обеих раскладок. Создание персонажа пишет их в `items`,
истечение созданных вещей и печать читают тот же инвентарь. Специализированный
перенос из рюкзака остался только для оружия. `UsableItemAction` отправляет
`source=items`; backend маршрутизирует его в `CreateItemUse` с реальным источником,
сохраняя общие настройки разрешений и автоподтверждения расходуемых предметов.

`ItemMechanicPanel` принимает `collapsible` и использует native `details/summary`
внутри `BaseTile`. `WeaponItemMechanics` задаёт контекст `weaponMechanicCollapse`
для своих потомков: начальное состояние закрыто, справочник сохраняет раскрытое
представление. `WeaponLinkedCharges` помещает счётчики в summary-слот конкретных
свойств; его кнопки не раскрывают карточку. `weaponBlockResources` назначает пул
одному связанному блоку. `WeaponUsePanel` сохраняет одну карточку до и после атаки.
`WeaponCard` оставляет внешний `MorphTile` неподвижным, а `RowActionMenu` и press-
анимация принадлежат только основной строке `WeaponCardView`; свойства и разделитель
находятся снаружи trigger.

`InventoryBagItem` owns the inventory-only corner chips: quantity docked to the
bottom right with rounded top-left/bottom-right corners, capabilities docked
bottom left. `InventoryBagGrid` gives every cell a 2px frame in the shared border
color; simplified entries change only its style to dashed. Equipped entries use
the accent color while preserving the solid/dashed style. These
overlays share the cell radius and do not create another action target.
The usable capability chip uses Lucide `Hand`, matching the `use` action in
`RowActionItem` and the item-use submenu in `ItemTransferAction`.
`inventoryCellTraits` uses the existing equipment eligibility and usable-item
contract independently of owner permissions, so character and session inventory
show the same item properties. Keyboard descriptions expose every visible tag
and the full quantity, including when the chip truncates a long number.

## Свойства оружия и стоимость экземпляра

Панели под оружием используют общий `ItemMechanicPanel`: свойство,
проклятие, выбранная цель, применения, перенос в КД, последний заряд и эффекты.
`weapon_notes` показываются по условию конкретного экземпляра; проклятие «Меча
мести» появляется только после настройки и остаётся доступным в меню рюкзака.
Одинаковые правила работают в карточках, таблице и режиме чтения. Текстовые
последствия проклятия учитываются вручную. Контракт — в `magic-items.md`.

Миграция 158 переносит `values.potions` всех персонажей (включая удалённых) в первое
пространство `values.items.sections`, создавая рюкзак при необходимости. UID,
количество, параметры, иконка и личное описание сохраняются; стопки не сливаются.
Пустые ячейки заполняются до расширения сетки, прежние позиции и надетые вещи
сохраняются. Корневое поле удалено и запрещено ограничением БД; версия изменённого
листа увеличивается. Ожидающие передачи/дозы и сохранённые результаты применения
переведены на `source=items`; возврат дозы продолжает исходную стопку.
Отдельного блока зелий нет на desktop/mobile и в печати. Вещи типа 10 доступны
через справочник рюкзака; применение, передача, пополнение и удаление — в меню
обычной ячейки. «Удалить одну» и «Удалить» записывают `item_removed` в хронику
активной сессии вместе с сохранением листа. Запись хранит название и UID экземпляра,
ID справочника при наличии, удалённое количество и остаток; хроника показывает
«Удалено» и переход количества (например, 3 → 2 или 3 → 0). Удаление секции
сохраняет одну запись со списком удалённых стопок и их количеством, включая
надетые вещи; пустая секция не создаёт событие. Удаление не применяет лечение
или эффекты. Между пространствами остаётся только разделитель с названием.

Концентрация: `useSpellConcentration` управляет серверным состоянием и применением
эффектов к себе через общий цикл сохранения/обновления листа. `SpellConcentrationBlock`
стоит первым в магии и использует `HandbookReferenceRows`, без отдельного вида карточек.
`ItemTransferAction` объединяет применение на себя и выбор цели для зелий/заклинаний.
Описание в общем `ItemTooltip` и всплывающих rich-ссылках отображается размером 14px
с интерлиньяжем 1.55, в том числе у характеристик и навыков.

## Карточки свойств и зарядов

Карточки под оружием закрыты при первом показе, в том числе в табличном режиме.
Нажатие на заголовок и Enter/Space плавно раскрывают и сворачивают правила и
действия за 220 мс; стрелка поворачивается вместе с переходом. Повторное нажатие
меняет направление с текущей высоты, после перехода высота снова определяется
содержимым. При `prefers-reduced-motion: reduce` переключение мгновенное. Заряды находятся
справа в заголовке связанного свойства, эффекта либо особого применения; ими можно
управлять при закрытой карточке. Общие описания и отдельная карточка зарядов не
добавляются. Нажатие основной строки анимирует только её: свойства и разделитель
остаются неподвижны.

## Связанные страницы

[Оглавление wiki](../../README.md) · [Лист персонажа: устройство и интерфейс](../character-editor.md) · [API: обмен и общение](../../api/interactions.md) · [БД: персонажи и инвентарь](../../database/characters.md)
