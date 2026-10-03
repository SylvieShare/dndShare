# Способности, ресурсы и эффекты

Источники способностей, выборы, защитные и производные эффекты, виджеты и действия листа.

← [Лист персонажа: устройство и интерфейс](../character-editor.md)

## Содержание

- [Выборы способностей](#выборы-способностей)
- [Прогрессия и ресурсы](#прогрессия-и-ресурсы)
- [Защиты, пассивные эффекты и корректировки бросков](#защиты-пассивные-эффекты-и-корректировки-бросков)
- [Производные и активные эффекты](#производные-и-активные-эффекты)
- [Ярость и выдача заклинаний](#ярость-и-выдача-заклинаний)
- [Виджеты механик](#виджеты-механик)
- [Действия и расход ресурсов](#действия-и-расход-ресурсов)
- [Сюжетные способности](#сюжетные-способности)
- [Описание и условия действий](#описание-и-условия-действий)
- [Общие тезисы механик](#общие-тезисы-механик)

## Выборы способностей

Race abilities, class abilities and feats use one `choices` contract when they
are granted. Adding an item from a handbook picker first opens the mandatory
choice dialog and writes the result into the new ability entry only after all
sections are complete. Inline variants, suggest dictionaries and references to
another handbook item type are supported. Character creation and level-up use
the same keys and persistence shape; an item with several choice sections keeps
them independently addressable.
Several dictionaries may be combined into one counted choice with namespaced
values (for example Skilled's skills and tools). A choice may depend on an
earlier choice and derive an immutable item filter from it. Magic Initiate,
Spell Sniper and Ritual Caster therefore ask for a class first and then open a
spell catalogue locked to that class, spell level and spell kind; the selected
class also supplies the granted spell's casting ability.
An item choice may set `grant_spells` and `casting_ability`; selected handbook
spell ids then become read-only external spells with the ability card recorded
as their source. Item filters traverse object arrays (for example
`{"lvl":0,"classes.id":4014}` for a Wizard cantrip). The choice picker sends
these rules as fixed server-side catalogue filters immediately, displays them
as ability-owned filters and does not allow the player to change or reset them.

A character-bound choice may require an existing proficiency and exclude a
target that has already reached a configured rank. Rogue Expertise uses this
contract for proficient skills and thieves' tools. Tool checks resolve the
same proficiency rank as skills, so rank 2 contributes twice the proficiency
bonus and is labelled «Компетентность» in inventory.

Known-spell limits may also be declared by the selected class or subclass.
Arcane Trickster publishes its Wizard list, Intelligence, cantrip/spell table,
allowed schools and the number of school exceptions at each level. The spell
tile shows current totals and preselects available circles and the class list
in the manual spell picker. These filters can be removed, reset or changed;
original options retain a «По умолчанию» label and highlight even when deselected.
Reopening the picker restores defaults from the active spellbook tab. Manual
additions may use another class list or higher circle, but additions that exceed
the known count or current school-exception allowance remain disabled. Mage Hand Legerdemain marks its granted Mage Hand
as counting toward the cantrip limit.

## Прогрессия и ресурсы

Ability items may expose `display_scaling [{level,label}]`. The sheet and print
views resolve the latest row against the owning class level. Without an explicit
label they derive current weapon-damage dice or the scaling value. Sneak Attack
uses its damage formula for the label, widget and class roadmap; it does not
store duplicate level tables.

Race abilities, class abilities and feats remain separate canonical arrays and
use their corresponding handbook item types and independent editors. Desktop
and mobile present the three domains as sections of one visual tile with shared
outer chrome and internal dividers. Their sheet rows render the assigned
`item.svg` in a fixed neutral-gray slot; a missing SVG leaves that slot empty
instead of falling back to the former circle-with-dot marker. Entry names use
the primary text color so they remain visually stronger than muted section
headings.
Character creation and level-up reject a feat whose structured prerequisite is
not met. Manual sheet editing deliberately allows it: the owned entry is marked
«Требования не выполнены», and its bonuses, resources, defenses, passive rules,
derived effects and granted spells are suppressed.

Handbook item types 3, 4, 7 and 18 use `max_use` for a fixed maximum. They also
support formulas based on an ability modifier or owning class level, explicit
`uses` progression, and several independently named counters. An explicit
formula wins over a stale simultaneous `manual_size` flag. Charge pips are
rendered only in the shared resources tile, so spending from there writes the
available value back to the owning ability entry and later stat or level changes
immediately update the displayed maximum.
Sorcery points are not a manual sheet resource: the level-2 «Источник магии»
class feature contributes them with a maximum equal to the Sorcerer class level.
Long rest restores the pool, while Sorcerous Restoration adds four points on a
short rest at Sorcerer level 20.

## Защиты, пассивные эффекты и корректировки бросков

Damage defenses use the same source-adapter pattern. `values.defenses` stores
manual `{damage_type,kind}` rows, where `kind` is `resistance`, `immunity` or
`vulnerability`; ability items may contribute level-gated rows through
`data.defenses`. The sheet and print view merge both sources. Manual rows stay
editable, while contributed rows show their exact ability source and cannot be
changed from the character. Equal rows are collapsed for display, but opposite
effects are intentionally preserved instead of inventing a conflict rule.
Choice-dependent defenses use `choice_defenses`: a rule points to another owned
ability entry and maps its stable choice value to a damage type. Dragonborn
ancestry therefore drives resistance from the single Breath Weapon choice.

`passive_effects` are rendered directly below the race/class/story ability or feat
that owns them. An entry without contextual text remains a compact name-only
row; an entry such as Brave, Fey Ancestry or Sunlight Sensitivity expands only
enough to show its contextual permission, advantage, immunity or limitation.
There is no separate special-properties block and the source name is not
repeated below the same ability.

Ability `roll_triggers` and `critical_damage` are separate shared contracts. A
natural-one reroll appears on the settled dice popup and produces one replacement
result. Weapons expose a critical-damage roll that doubles all attack damage
dice, keeps the flat modifier once and then applies matching ability modifiers
such as Savage Attacks' extra melee weapon die.

Ability `roll_adjustments` is the corresponding contract for automatic,
source-labelled changes to a settled d20. A rule declares its roll scope,
minimum proficiency rank, level gate and adjustment kind. Reliable Talent uses
`minimum_natural` for proficient ability checks: the popup and session log keep
the rolled face visible, show `original → 10` with the feature source and
calculate the total from 10. Plain ability checks, saving throws and checks with
no full proficiency remain unchanged; expertise and proficient tool checks are
eligible.

`weapon_damage` is the shared contract for an ability-owned optional damage
action. It declares the die, a fixed or owner-level-scaled count, eligible weapon
kinds, a stable local key, a toggle label and whether the contributed dice double
on a critical hit. Widgets select a rule by `weapon_damage_key`; reordering
never changes the link. Missing links are reported instead of selecting the first rule.
Ability `level_source` selects character level, a specific `level_class_id`, or
the declared class/subclass bindings. A missing specified class produces level 0
and an unavailable panel; character level is not substituted.
The weapon menu combines selected extras, the critical toggle and the versatile
grip into one damage roll; it does not enumerate combinations as menu actions.
Sneak Attack uses this contract with `ceil(rogue level / 2)d6` and appears only
for finesse or ranged weapons; runtime code does not check its name or item id.
The `once_per_turn` flag is preserved for encounter-aware usage tracking, but a
standalone sheet roll does not silently consume or block it without turn state.

## Производные и активные эффекты

Class, race and feat items may also contribute `derived_effects`. This is the
single source contract for calculated AC formulas and bonuses, speed bonuses,
skill/save proficiencies, visible armor/weapon/tool/language proficiencies,
check/save/weapon-attack bonuses, roll modes and critical thresholds. Every row
keeps its handbook feature as the visible source,
is level-gated by the owning class, may depend on a stored feature choice and is
removed automatically with that feature. The sheet does not copy these values
into hidden character flags. Scaling rows that share a `group` use the highest
currently unlocked value rather than stacking every historical tier.

Unarmored Defense, Draconic Resilience, Fast and Unarmored Movement, Expertise,
Jack of All Trades, Diamond Soul, Slippery Mind, Aura of Protection, the Defense
and Archery fighting styles, Danger Sense, and Champion critical thresholds use
this contract. The same calculations are used by the interactive and print
sheets. Danger Sense therefore marks Dexterity saving throws with its visible
condition, while an activated rule is never applied merely because its feature
is owned.

Active effects use item type 15 (`Эффекты`) as a structured catalogue. Each
catalogue row owns polarity (`positive`, `negative` or `neutral`), colour,
description, optional presentation level, stacking policy, default duration, concentration and optional
`derived_effects`/`defenses`. `values.states` stores only runtime instances:
`uid`, `effect_id`, source identity, bound `params`, duration and concentration.
This keeps a temporary spell or ability effect removable with its source and
allows the same catalogue effect to be added manually from the status block.
Abilities, feats and spells declare zero or more links in `status_effects`;
several links are presented as independent choices. A link may bind the owning
ability's current scaling value into a named effect parameter.

Длительность копируется в каждый экземпляр при наложении: переопределение
источника имеет приоритет перед значением справочника. Последующее изменение
экземпляра не меняет справочник, источник или другие наложения этого эффекта.
На компьютере срок показан под названием с иконкой часов; пункт меню
«Изменить длительность» открывает редактор. На телефоне короткая подпись находится
под иконкой, а редактирование — в окне «Статусы», по строке длительности.
В режиме чтения длительность видна, изменение недоступно.

Поле экземпляра `duration` — объект `{ kind, value?, text? }`: `rounds`,
`minutes`, `hours`, `days` требуют положительного целого `value`; `custom`
хранит свободное условие окончания в `text` (до 200 символов). `manual`,
`until_rest` и `permanent` не требуют дополнительных полей. Редактор показывает
только применимые поля; отмена не сохраняет черновик. Это срок действия,
а не запущенный таймер: отсчёт и снятие остаются ручными.

## Ярость и выдача заклинаний

Rage is the first parameterized ability effect: activating its sheet widget
consumes the ability resource, adds the shared Rage status and applies Strength
check/save advantage, the current Strength-melee damage bonus and physical
damage resistances. The sheet follows the 2014 Rage rule, so ranged attacks made
with Strength do not receive that damage bonus. Rage also publishes a generic
`activity_block` for `spellcasting`; the spells block combines it with equipment
proficiency restrictions in one notice and disables spell use without checking
the Rage name. Its `concentration` scope also removes an active concentration
status when Rage begins. Shield of Faith exposes its linked status in the spell
action menu, adds +2 AC and replaces another concentration status. Removing a source
ability/spell removes statuses created by that source; manually added instances
remain independent. Round countdown and encounter propagation are deliberately
future consumers of the stored duration/source contract, not separate state
formats.

Fixed class-feature spell selections use the existing ability-choice grant
contract. Druid cantrip, Magical Secrets, Spell Mastery and Signature Spells are
therefore selected when the feature is gained and appear as externally granted
read-only spells with their casting ability and source. Item filters traverse
object arrays in the shared add-from-handbook dialog as well as during creation
and level-up.

Feat ability-score bonuses are represented as readonly named bonus rows. The
creation assembler, level-up flow and manual feat editor use the same rule: add
the row when the feat is gained and remove its source-keyed row when that feat
entry is deleted.
The PHB feat catalogue additionally uses this automation for Tough hit points,
Alert initiative, Mobile speed, Resilient saving throws, armor/weapon/language
proficiencies, Lucky/Martial Adept/Magic Initiate resources and all feat choices.
Source-owned armor, weapon and tool proficiencies participate in equipment
proficiency checks as well as the visible proficiency list; they are not copied
into manual tags and stop applying when their source feat is removed or disabled.
Rules that require a target, turn state, reaction or optional attack mode remain
readonly contextual effects on the owning feat instead of being applied to
unrelated rolls.

## Виджеты механик

`sheet_widgets` is an ability-owned contract for prominent class-mechanic cards
in the sheet side column and abilities tabs. A widget may display a fixed or
progression-derived metric, own a persisted toggle, bind to the ability resource,
or add a note to another ability's panel through a shared key. Compact condition
theses are also owned by the widget data rather than its UI component. The
runtime does not check class, feature name or item id. Sneak Attack publishes
its live dice together with eligible-weapon, advantage-or-nearby-enemy,
no-disadvantage and once-per-turn reminders; Rage publishes its current damage
progression and an active toggle. Toggle widgets may reference a linked
`status_effect_key`; their active state then comes from any matching effect in
`values.states` rather than a parallel widget flag or a matching source.
Entering Rage consumes one available use, while leaving it active removes the
matching effect without refunding the use.
Subclass features can contribute `note` widgets with
the same key to extend that panel.

## Действия и расход ресурсов

`feature_actions` is the matching ability-owned contract for the shared
**Действия** block. Class abilities, racial abilities and feats may contribute
an action, bonus action, reaction, free action or special action together with
its rich HTML description, read-only requirements, level gate, priority, optional
ability-resource binding and links to standard combat-action codes from suggest
type 24. Hovering those linked names shows the suggest description. The block
merges source rows with editable custom actions from `values.actions`;
source-provided rows use the ability icon, omit a duplicate textual source label
and cannot be edited on the character. Existing stable row-key order from
`values.action_order` is respected, but row menus do not offer manual reordering. Each group header
is rendered only when it contains actions. The shared block-title pencil opens
one morph editor for the complete block: custom actions are created, edited and
deleted there, while actions contributed by abilities are listed separately as
read-only. Row menus retain direct editing, but group headers have no add
controls. Both the dependency editor and custom-action editor use `InputDescription`.
When collecting actions, `dice` nodes in each description produce `dice_rolls`
for the row menu; identical formula/label pairs are deduplicated. Plain prose and
nodes without dice do not create roll commands. Rolls use the shared dice store
and do not spend a resource. Clicking anywhere on a row with menu commands,
including its description and inline dice, opens that menu; the charge spheres
remain separate controls. Enter or Space on the focused row also opens it.
A row without any available menu action is non-clickable and does not
show hover or press feedback. The block owns one shared tile; rows inside
it have no nested card background. Each row has a left `TileAccentStrip`, using
the same strip as ability-score tiles and the row's action-group color. The strip
touches the left edge of the shared block; headings, icons and text retain their
content inset on desktop, mobile and in the morph preview. A resource bound to a source action is shown
on that action as the same color-coded charge spheres used by the resources
tile: one charge sits 5px under the icon in a floated left column with a 9px
right and 2px bottom margin, while several
charges wrap below the action text. The description flows around the icon and
single charge, returning to the full row width below them. Requirements and
rich-text bullet/numbered lists always start below the icon and charge, from the
left side of the row. Action names use bold 13px text above 12px prose;
the prose size is set on a native wrapper so RichContent's inherited font does
not reset it to the surrounding sheet size. Short- and long-rest recovery icons sit immediately to the right
of the action name, and the bound resource is omitted from the shared resources
tile to avoid a duplicate control.
Relentless Endurance contributes a special action bound to its existing single
long-rest charge. Its summary states the optional effect (stay at 1 HP when
reduced to 0); bullet points state the instant-death exclusion and no action or
reaction cost. The charge and rest icon communicate the use limit and recovery
without a duplicate bullet point. Spending the charge
does not automatically change HP.
Infernal Legacy contributes Hellish Rebuke to Reactions from character level 3.
It binds only the existing `hellish_rebuke` long-rest charge; Darkness remains
in the resources tile. The action description contains an explicit rich dice
formula (3d10 fire, matching the PHB 2014 second-level racial casting) and a Dexterity save.
The Charisma-based DC is a separate thesis, alongside the damage trigger,
60-foot visibility requirement and spell components. The ordinary first-level spell deals 2d10 and gains 1d10 per higher slot;
the racial grant fixes the casting at second level, yielding the same 3d10
in its spell card and reaction description. `scripts/update-infernal-legacy-action.py` applies
the action-text adjustment through MCP without changing the spell grant. Spending the
charge does not automatically resolve damage or track the round's reaction.
The spheres remain owner-interactive and write through the shared resource
source contract without triggering the press
animation or menu of the surrounding action row. Row menus do not offer a
separate resource-spending command. Other consequences
declared by the action also stay in its row menu. Cunning Action is one source row linking Dash,
Disengage and Hide rather than three duplicated rows. The block is available in
the desktop side column and the mobile abilities tab.
Targeted source actions open the domain-neutral character-entry picker before
they spend a resource or create an effect. The picker receives already prepared
rows and can therefore select owned weapons, spells or another character domain
without knowing its storage format. Sacred Weapon uses it to bind a one-minute
status to one weapon `uid`; only that weapon gains the Charisma attack bonus
(minimum +1). Deleting the weapon or moving it to inventory removes the bound
status. The light and magical-weapon clauses remain descriptive because they do
not participate in a sheet calculation.
The same picker is used for feats and abilities and opens above the active morph
editor, so its filters and item selection are never hidden behind the morph.
The list shows count as a badge and has no inline increment/decrement controls.
Clicking an inventory row opens the shared `RowActionMenu`: referenced items can
open their description and add one copy. A stack with more than one copy offers
separate removal of one copy and deletion of the whole entry. Only simplified
rows created without a handbook `item_id` offer metadata editing; inventory
removal is not recorded as item use. Adding a copy publishes `item_added` in an
attached session. A referenced child-type item also offers a move to its specialized
weapon block. Linked weapons can move back to the ordinary inventory; potions
remain in inventory and use the same cell menu. A weapon keeps its magic bonus and weapon-only instance settings in
namespaced instance parameters so moving it to inventory and back is lossless.
Creating a new inventory item or weapon publishes `entry_added`; the
same event covers newly picked potions and spells, feats and class/racial
abilities, including additions granted by level-up. A multi-quantity picker
creates one entry with that count. Potion tiles open the shared `RowActionMenu` with
icon-labelled, accent-colored use, success-colored replenish-by-one and
info-colored view actions; use/replenish publish the same semantic item events,
and use removes the entry at zero. Mobile status actions pass their domain icons for statuses, exhaustion
and inspiration into the shared `RowActionItem`. A custom
inventory entry is edited through the row action menu. Clicking a spell row
opens actions for description, use and delete; deletion no longer occupies the
compact row. Using a cantrip records a slotless `spell_used` event. A leveled
spell spends an available slot at or above the spell level; when an upcast is
possible, `RowActionSubmenu` shows the available slot levels beside the action
menu on desktop or inside its bounded mobile section and records the chosen
level. A spell row renders its transparent raster
`item.iconImageUrl` when assigned; otherwise it retains the school SVG symbol.

## Сюжетные способности

На вкладке способностей desktop и mobile рядом с классовыми и расовыми находится
раздел «Сюжетные», связанный с каталогом 18. `values.abilities_story` хранит тот же
массив экземпляров `{id, uid?, choices?, count?, ...}`, что остальные способности.
Пустой раздел скрыт; в режиме редактирования остаётся компактное действие
«Добавить сюжетную способность», открывающее стандартный picker с созданием.
Наличие записей определяется сохранённым массивом, поэтому ошибка загрузки
каталога не удаляет данные. Редактор и меню записей общие с остальными способностями.

`shared/lib/abilityTypes` задаёт общий список источников способностей. Сюжетные
участвуют в ресурсах и отдыхе, дарованных заклинаниях и выборах, защитах, максимуме
хитов, пассивных и производных эффектах, действиях, корректировках броска и виджетах.
Печатный лист включает их отдельной группой. Без привязки к классу прогрессия
использует общий уровень персонажа; автоматическое получение при повышении уровня
по-прежнему относится только к связанным классовым способностям.

## Описание и условия действий

Карточка действия сначала показывает обычное описание результата, затем —
тезисы условий применения (`requirements`). Описание не делится на предложения
и не превращается в пункты списка. Для действий без условий, например «Хитрого
действия», остаётся только текст с доступными ссылками. Стиль тезисов общий
с панелями способностей. Описание сохраняет прежнюю типографику: Literata,
12 px, цвет `--text-2`, интервал 1.45. Размер и цвет задаются внешней обёртке
`dav-description`, чтобы `RichContent` наследовал их без конфликта стилей.
Единственная ячейка ресурса расположена справа от описания, отдельно от иконки.
Текст обтекает иконку слева и возвращается к левому краю ниже неё; место
под ячейку резервируется только справа от описания.
Тезисы условий ниже сохраняют полную ширину; несколько ячеек остаются под ними.
Навигация и цели desktop/mobile-обучения не меняются.

## Общие тезисы механик

`shared/ui/MechanicTheses.vue` — единый компонент условий действий, условий
эффектов и панелей способностей: 13 px, межстрочный интервал 1.5, цветные маркеры.
`mechanicTheses` оформляет явно переданные тезисы, убирает одинаковые пункты,
сохраняет rich-ссылки и кости. Предложения автоматически не разделяются.
В `DndActionsView` описание выводится отдельно через `DndRichContent`, а
`MechanicTheses` получает только `requirements`; без условий список отсутствует.
Каждая строка действия содержит общий `TileAccentStrip`, как у характеристик:
цвет берётся из `--dav-tone` группы. Группа компенсирует левый padding блока
через `--dav-inset`, поэтому полоса прижата к его внешнему левому краю;
заголовок и содержимое строки сохраняют отступ. Одинаковое представление используется на desktop/mobile
и в morph-превью. `HandbookReferenceRows`
поддерживает две колонки через слоты `info` и `description`; `ItemEffectLinks`
выводит слева применение эффекта, справа его строку и описание.

`StatusRepeatSaveMenu` — общий пункт действий активного эффекта для листа и
НПС. Он использует `D20RollControls` и общий профиль спасброска; `RollOutcomeNote`
показывает одинаковую подпись результата у костей уведомления и хроники.

## Связанные страницы

[Оглавление wiki](../../README.md) · [Лист персонажа: устройство и интерфейс](../character-editor.md) · [Редактор зависимостей способностей](../ability-editor.md) · [БД: механики справочных объектов](../../database/item-mechanics.md)
