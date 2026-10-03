# Создание, уровень и отдых

Идентичность, мультиклассирование, создание документа, повышение уровня и восстановление ресурсов.

← [Лист персонажа: устройство и интерфейс](../character-editor.md)

## Идентичность и мультиклассирование

`DndCharIdentity.vue` edits name and race/subrace in the «Персонаж» modal.
Classes are read-only `ObjectListItem` rows with handbook icons, subclass names
and each class's effective level. «Редактировать классы» opens the shared
`DndClassesEditorModal`, also available from the level block through
«Изменить уровни вручную». The manual editor shows a warning recommending the
regular level-up flow: manually changing classes does not replay progression
or adjust previously granted abilities, HP and spells.

Regular level-up uses the shared `AbilityBonusPicker`, also used by racial
bonuses in 2014 creation and background bonuses in 2024. Its ability buttons
show the current and selected resulting scores, disable bonuses exceeding 20
before selection, and prevent choosing more abilities than the ASI mode permits.
The existing choice between +2, +1/+1 and a feat remains unchanged.

The editor keeps a separate draft of classes, subclasses and levels. It allows
replacing, adding and deleting class rows, clearing a subclass, and changing the
level of any class, including a single class. Changing a class clears its former
subclass. At least one selected class is required; duplicates, invalid levels
and a total above 20 block saving. Catalogue load failures keep the draft and
offer retry. Stored references outside the current catalogue scope are preserved.
«Сохранить» applies `classes` and their summed `lvl.level` together through the
sheet's normal save flow, preserving XP. «Отменить», Escape and closing discard
this draft. Saving this separate editor from «Персонаж» applies classes immediately;
the identity form's own save/cancel controls affect only name and race/subrace.

Classes use only `values.classes`; each row carries a subclass and level.
`classEntriesOf` reads this list, `classesLabel` renders it. For an existing single
class, `lvl.level` controls the effective level; manual saving synchronizes both
values, including when multiclass is reduced to one class.
Списки происхождения больше не выводят варианты из базовых каталогов: расы
загружаются из типа 8, подрасы — из типа 16 с фильтром `data.race`; классы — из
типа 9, подклассы — из типа 17 с фильтром `data.class`. Тот же контракт
используют generic-блоки `InputItem` и окно повышения уровня.

Clicking the editable portrait opens actions for upload, crop, clear and a
separate character-icon upload. An icon is uploaded directly without the crop
workspace; PNG/WebP dimensions must not exceed 256×256. It is stored outside
character JSON, while the portrait keeps its existing crop flow and sheet aspect.
The desktop summary prefers that icon and falls back to the portrait; the full
portrait block is rendered in the **Личность** tab.
Character cards and session participants prefer the icon and fall back to the
portrait when it is absent. Drag-and-drop for the portrait enters the same crop
flow instead of bypassing it. Portrait action popovers use a layer above the
fullscreen session sheet. After every owner edit, the browser keeps the
three latest character-data snapshots in per-character local storage. Storage
failures do not interrupt editing or the normal debounced server save. The
sheet does not install a global `Ctrl+Z`/`Cmd+Z` handler; focused text editors
retain browser-native undo.

## Повышение уровня и отдых

`DndLevelUpModal` computes the target class, gained features, subclass choice,
HP gain, ASI/feat, proficiency changes and spell-slot differences. It emits one
map of canonical block updates. `hp.hitDice` pools equal die types and is the
only hit-dice representation.

Static proficiencies declared by a newly selected subclass are applied by the
same data contract as class proficiencies. An archetype such as Assassin
therefore grants its tool proficiencies during level-up without an
archetype-specific branch.
Fixed armor, weapon and tool proficiencies from the multiclass proficiency
table are also merged into the character automatically, without duplicating
proficiencies already present. Grants that require a player choice, such as a
bard's skill or musical instrument, remain an explicit manual reminder.

`lib/levelUp.js`, `lib/hitDice.js`, `lib/rest.js` and
`lib/characterResources.js` are pure and unit-tested.
Spellcasting ability and slot contribution are explicit handbook data
(`spellcasting.ability` and `caster_progression`). Full, half, third and pact
casters are never inferred from a localized name or catalogue id. A subclass
spellcasting ability takes precedence over the base class when the spell block
is created. `characterResources.js` defines the resource-source
contract (`itemIds`, `collect`, `setAvailable`, `restore`). Manual resources and
race/class/feat ability counters implement the same contract; another domain,
such as charged magic items, can join the aggregate by registering another
source adapter without changing the resources or rest blocks. Contributed rows
are visible and usable in the shared resources tile, but read-only in its
editor because their title, maximum and rest rules belong to the source item.
Every read-only editor row uses the stable label `Источник: способности`;
the resource title already carries the exact handbook item name.
Ability rules can derive the maximum from a live ability modifier, a class-level
multiplier or `scaling[].uses`; `use_resources` contributes several independent
rows. Level-gated short-rest recovery and partial recovery use the same source
contract, so the rest action has no class- or feature-specific branches.
Each ability resource owns `resource_color`; nested counters may override it.
Unconfigured custom abilities receive a stable color derived from their item id,
so resources from one domain do not collapse into a single class/race/feat color.
Short/long rest uses this same aggregate contract to update current spell slots,
all matching resources, ability counters and hit-dice pools without scalar
mirrors. Long rest also restores resources marked for short-rest recovery.
Completing either rest publishes one `rest_completed` session event with its
kind and recovery summary when the sheet has an attached session context. Hit-die
rolls remain normal `dice_roll` events; opening or cancelling a rest does not
write history.

The experience editor always shows its level-up action. With enough XP it is
accented and opens the normal level-up flow immediately. With insufficient XP it
is muted but clickable: `ConfirmDialog` shows the exact shortfall and target XP
and offers to continue. The confirmed XP top-up stays in the level-up draft;
applying the level-up saves XP and progression together, and cancelling either
dialog changes neither. XP above the required threshold is preserved. At level
20 the action remains visible as the disabled «Максимальный уровень» button.
The total level has no direct numeric input;
manual changes go through the shared class editor and its progression warning.

The level-up dialog is 960 px wide on desktop (twice the standard dialog),
with HP and automatic gains in a side column and abilities, subclass, ASI and
spell choices in the main column. Narrow screens stack these sections. The
footer stays visible with the final apply action. Granted abilities and spells
use `LevelUpItemRow` with the handbook's list renderer and open their full
handbook descriptions. HP uses the shared `MorphTile`, `MultiToggle`, number
field and `SystemDie`: fixed average, an actual roll or a manual final gain
including Constitution. The selected roll mode requires a completed roll;
manual mode does not add Constitution a second time. The minimum gain is 1 HP.
Spell slot gains apply with level-up, without a checkbox. `ClassLevelGains`
shows positive class progression deltas with `SpellSlotSphere` and an explicit
+1 for a single slot. The same deltas are added to saved totals; they are never
computed against the character's current stock. Pact Magic circle changes show
an upgrade: remove up to the previous class count from the old short-rest circle,
then grant that count at the new circle. Spent slots transfer first; excess slots
and their remaining usage stay on the old circle. Existing slots at the new
circle and all long-rest slots are preserved. If the old class slots were manually
reduced or removed, the new circle still receives the class count, with usage
transferred only from slots that existed. Any count increase is added separately.
Starting character creation still grants the selected class's initial slots.

Class spell selection separates new cantrips, new leveled spells and the
existing list. Each addition group spans the main column and contains its
selected/available counter, remaining choices, selected handbook rows and add
action. Groups with no available additions are hidden; completing a group keeps
its selected rows visible for review and cancellation. Cantrips and leveled
spells stay in their own groups instead of a separate combined list below.
The budget fills the handbook's known-spell limit after accounting for
existing class spells and external grants marked `counts_as_known`. An already
overfilled list is preserved and has no new choices. When the handbook lacks a
progression, the UI explicitly says that the count is unspecified; level-one
counts are not treated as limits at later levels. The seeded 2014 Bard has the
complete 1–20 known-spell progression (migration 104), so a complete level-one
list receives one new leveled spell and no cantrips at level two.

For known-spell classes, one existing leveled spell may optionally be replaced
when gaining another level in that casting class. Replacement does not consume
an addition; cantrips do not use this replacement action. The old spell stays
until a replacement is selected, and the replacement can be changed or undone.
New choices can be cancelled independently. A spellbook only gains new entries
according to `level_up_choices` and retains old entries and their preparation;
new book entries start unprepared. Prepared classes can
update multiple spells. Pickers keep the class list, circle, school-exception
and duplicate constraints. Cancelling a picker changes nothing. Loading errors
block applying the draft and offer retry, preventing a failed catalogue request
from clearing the existing spell list. New spells may be chosen later in the
sheet; unfilled addition counters do not block level-up.

## Создание документа

The dedicated D&D wizard and compact session creation both call the pure engine
under `settings/dnd/creation`. `blankValues`, grants, progression, equipment and
`buildCharacterData` are the only producers of new D&D documents. Catalogue
weapons added during creation are emitted into `values.weapon`; potions and
physical tools remain type-10/type-14 entries in inventory together with the
other catalogue additions and text-only starting-equipment rows. Background tool
proficiency is assembled independently into `values.proficiencies`. See
[character-list](../character-list.md) for the UI flow.
Class data may declare `tool_prof_choice {count,from}` with suggest type 5 IDs.
The PHB 2014 bard uses this contract to require three distinct concrete musical
instrument choices on the Class step; it no longer grants the broad
`Музыкальные инструменты` category. The selected suggest labels are written to
`values.proficiencies['Инструменты']` and survive wizard draft persistence.

## Меню отдыха и рассвета

Блок магии наблюдает за сохранёнными `slot_pools`: после отдыха он сразу
синхронизирует отображение и остатки для следующего броска без перезагрузки листа.
Короткий отдых восстанавливает пул `short_rest`, длинный — оба пула.

Одна кнопка «Отдых» открывает короткий отдых, длинный отдых и рассвет.
Иконка луны и подпись стоят в одной строке с выравниванием по вертикальному
центру, без стрелки раскрытия.
Первые два пункта сохраняют прежнее поведение. Рассвет показывает израсходованные
ресурсы с настроенным `dawn_recovery`, включая магические предметы в рюкзаке и
без настройки. Подтверждение восстанавливает каждый экземпляр отдельно, бросает
нужную формулу, ограничивает результат максимумом и сохраняет один patch.
В окне остаются результаты (до → после и выпавшее число); повторное нажатие
в этом окне не бросает кости заново. Отмена до подтверждения ничего не меняет.
Хиты, кости хитов, ячейки заклинаний и ресурсы отдыха рассветом не затрагиваются.

## Связанные страницы

[Оглавление wiki](../../README.md) · [Лист персонажа: устройство и интерфейс](../character-editor.md) · [D&D 2014 и 2024](../rules-editions.md) · [Обучение листу персонажа и сессии](../tutorials.md)
