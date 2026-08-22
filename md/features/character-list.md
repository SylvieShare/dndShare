# Character list and creation

## Files

- `features/character-list/pages/ViewListCharacters.vue` — grouped list.
- `features/character-list/components/CharBox.vue` — card.
- `features/character-list/pages/ViewCreateCharacter.vue` — full D&D wizard.
- `features/character-list/components/CharacterCreateWizardModal.vue` — the
  same full wizard in a fullscreen session modal.
- `features/character-list/components/CharacterCreateModal.vue` — compact
  embedded creation used from the invitation flow and for systems with simple
  creation.
- `features/character-list/composables/useDndCreateWizard.js` — wizard state
  and orchestration.
- `features/character-list/components/wizard/` — presentation steps and compact
  D&D wizard.
- `features/character-editor/settings/dnd/creation/` — pure assembly/grant
  engine shared by both D&D presentations.

## List contract

`GET /api/chars` returns `chars` and batched `sessionsByChar`. Cards are grouped
by `sourceId/sourceName`, show the concrete rules edition and the most recently
changed session.

The list route remains cached for scroll/transition continuity, but every
reactivation consumes the fresh router prefetch (or refetches directly). A
character created on `/chars/new` therefore appears on return without reloading
the browser.

Card display data comes only from per-setting accessors in
`features/character-editor/settings/index.js`. `CharBox` receives
`displayName/avatar/subtitle/level/abilities` plus the character's independent
`iconImageUrl`; the icon takes priority and the setting avatar is the fallback.
The card does not know JSON paths and does not receive template `pathValues`.
D&D and VTM both have registered accessors.

The D&D card includes `CharStatRadar`; its six scores and suggest metadata also
come from `dndAccessors`. Opening a card seeds `charSeed.js`, so the editor can
render before the network response while preserving the same API-shaped data.

## Creation entry points

From `/chars`, D&D opens the full `/chars/new` page. The session workspace embeds
that same full wizard in `CharacterCreateWizardModal`; successful creation
attaches the character to the current session, refreshes its participant rail
and closes the modal without opening the character sheet or changing the route.
The invitation screen keeps the compact `CharacterCreateModal` based on
`MorphSheet`. For VTM the compact modal calls the registered `createData(name)`.
Each character card can show at most one attached session. Joining another
session requires a warning and confirmed transfer; the previous membership is
then removed by the server.

Both flows resolve `sourceVersionId` from `/api/sources` and send it explicitly
to `POST /api/chars`. The server rejects a missing/unknown version; there is no
default-version fallback.

`/chars/new` is public. An anonymous visitor can complete every wizard step;
authentication is requested only by the final create action, after which the
draft remains in place. Successful creation seeds the character-sheet route
with the returned document so the first render does not wait for a second GET.
The wizard boot data is public as well: `GET /api/templates`, sources, handbook
items and suggests must load without a session.

## Full D&D wizard

The fixed steps are: Версия → Раса → Класс → Предыстория → Характеристики →
Личность. Когда игрок заменяет стартовый комплект начальным богатством,
между Характеристиками и Личностью появляется единственный дополнительный шаг
Магазин; отдельного шага Снаряжение нет. The desktop layout keeps the main step content in
a responsive column capped at 1120px, giving race and class covers a wider media
area. A separate 220px step rail floats directly
to that column's left; there is no permanent right preview. The rail shows the
primary current value for each step (for example,
the chosen race, class/subclass or background) without repeating its mechanical
details. Reset sits in the rail heading opposite “Создание”; the central footer
contains only ordinary step navigation. When at least one required choice is
still missing, a deliberately quiet “Создать неполноценного” action appears below
the step list and opens the shared confirmation before building the partial sheet.
It disappears once every step validates. Because the rail is hidden in the
single-column layout, compact reset and partial-create equivalents remain in the
mobile header and footer. There is no duplicate numeric step counter.
Личность — последний шаг: рядом с созданием доступен необязательный
«Предпросмотр листа». Он собирает текущий черновик тем же `buildPayload`, открывает
настоящий полноэкранный лист с его вкладками в `ownerMode=false` и ничего не
записывает на сервер. Вкладки, броски, подсказки и read-only карточки предметов
остаются доступны, а входы в редакторы и обработчики изменений заблокированы;
отдельного обязательного шага обзора нет.
Neither race nor class repeats a «Результат выбора» block below its controls:
the selected illustrated card already contains the base result and dependent
choices remain visible in their own sections. Ability descriptions remain
available from the illustrated cards on hover. On narrow screens the workspace becomes
one column, while the navigation footer stays pinned to the visible bottom edge.
Only the capped central column owns an opaque `--bg` surface across its header,
work area and footer, with continuous side borders framing it on desktop. The
floating step rail and the space outside that column remain on the global dotted
application canvas.

The personality step is composed as a character portrait rather than a flat form:
the portrait and a deliberately compact secondary icon sit beside identity,
alignment and the complete appearance group; character and story continue in
icon-labelled sections below. Both
images use the shared crop workspace and are stored in the local wizard draft after
upload. The portrait becomes `values.ava`; the square 256×256 icon is submitted as
`iconImageUploadId` and linked to the new character's independent `icon_image_id`.
When no icon is selected, character cards and sessions continue to fall back to the
portrait.

The race step uses full-width illustrated rows. Each built-in race has a consistent
landscape portrait of a male and female character; beside it the row shows a short
mechanics-free portrait from `item.data.short_description`, every base-race grant
and the choices that will follow (for
example a language or feat) without applying any subrace grants. Available subraces
are shown by name in a separate compact chip row instead of the generic
“После выбора: подраса” label. Race abilities are individually hoverable and use
the shared item tooltip for their handbook descriptions. After selection,
the chosen keyed row uses a FLIP layout transition to move from its list position
into the full-width hero above the
expanded `item.data.description`: an original three-paragraph lore article without
repeating ability bonuses, followed by subrace choices, while the
remaining rows disappear. A dedicated “Назад / К выбору расы” action reverses the
morph and returns to the full list without changing the current content scroll.
Skill choices carried by the race record (for example the Half-Elf's two skill
choices) use the same shared skill picker as the class
“Владение навыками” section: checkbox cards show the governing ability and the
live modifier (including proficiency or expertise as soon as it is selected),
enforce the pick limit and expose skill descriptions on hover.
The action floats over the selected illustration and does not occupy a layout row,
so its disappearance cannot displace the returning card even when the scroll is at
the top. The reverse render also restores the captured `.cc-main` scroll position
on Vue's next layout frame, preventing a transient content-height change from
resetting a partially scrolled step. The other rows fade away while the detailed
content rises in after the move; reduced-motion disables the sequence. Race and
subrace cards read only the handbook `coverImageUrl`; the compact icon is never
stretched into their illustration slot, and an item without a cover falls back
to a monogram. Built-in illustrations are not frontend static assets: they live
in system `storage_image` rows assigned through `item.cover_image_id` and arrive
with the ordinary handbook item response.
The nine built-in subraces have matching original paired portraits. Their choice
cards use a 3:2 media treatment in an exact two-column desktop grid, collapsing to
one column on narrow phones. Each card contains its own description below the name
and ability bonus; there is no detached selected-subrace description under the
grid. Selecting one keeps all cards visible and highlights the chosen origin
without expanding it to full width.
Selection retains the regular card surface; only its border, status and shadow
signal selection, so nested fact and subrace chips keep sufficient contrast.
The concise “Раса” label is presented as a display-font page heading with a short
accent rule. After selection, “Выборы расы” is split into lightly framed groups so
ability scores, language, feat and feature choices do not visually merge. Floating
ability-score choices use a stronger six-tile desktop grid (three/two columns at
narrower breakpoints), a prominent completion counter and distinct selected and
locked states.
On phones, choosing a race scrolls the newly revealed lore and dependent choices
into view with a smooth transition instead of leaving them below the viewport.

The class step follows the same selection flow. Base classes are full-width rows
whose illustration reads `coverImageUrl` and falls back to a monogram when no
cover is assigned. A row presents its short handbook description,
hit die, primary abilities, saving throws, proficiencies, level-one features and
available archetype names; feature descriptions use the shared hover tooltip.
Dependent equipment, skill, tool-proficiency, feature, archetype and spell choices are announced in
the row but each type is rendered as its own accent-edged section only after selection. The selected
row moves to the top, the other classes leave the list, and the same stable back and
scroll-restoration behaviour as the race step returns to the catalogue. Archetype
choices use compact dedicated cards rather than class covers: each card reads the
handbook item's `iconImageUrl`/`svg` (with a monogram fallback), shows a shortened
plain-text description and lists only the level-one features, proficiencies and
granted spells owned by that archetype. The selected card keeps its accent surface
and explicit status while the full handbook description remains below the grid.
At every responsive width the workspace keeps its header and footer inside the
viewport and gives vertical scrolling exclusively to `.cc-main`; scroll chaining
to the document is contained. Equipment-column radios occupy their visible label
geometry, so focusing a column title cannot move the document to an off-screen
one-pixel control.
`item.data.tool_prof_choice {count,from}` describes a class-owned choice from
suggest type 5. PHB 2014 bard uses it to require three distinct concrete musical
instruments. The picker deliberately omits skill ability/modifier columns,
persists its IDs in `classToolProficiencyIds`, blocks forward navigation until
all three are chosen and writes their labels to the character's tool proficiency
bucket. The broad `Музыкальные инструменты` category is not granted.
The selected class is followed by a separate three-paragraph lore article; the
compact card uses `item.data.short_description` and does not repeat mechanics in
that prose. Race and class screens share `IllustratedChoiceStage`, which owns the
display heading, keyed list transition, scroll restoration, detail reveal and the
back action positioned over the selected card image. New systems can reuse this
shell while supplying their own cards and dependent-choice content.

Cantrip and first-circle selection uses a dedicated spell tile. It shows the
spell's enlarged handbook icon without a backing disc (or a magic-glyph fallback), name, circle, school, casting
time and range. The tile body changes the selection, while its separate question
button opens the full handbook entry without affecting the chosen spells. Selected
tiles retain their accent state; choices over the current limit remain readable
and keep the handbook action available. Automatically granted archetype spells
use the same tile in a selected read-only state, including their icon and handbook
action. The responsive grid is capped at three tiles per row, then falls back to
two and one so longer spell names retain useful width. Every available option is
rendered directly in its circle section; the creation picker has no search or
client-side filtering. The catalogue request is narrowed server-side to the
selected class and circles zero and one, then follows every API page instead of
silently stopping at the 500-item catalogue boundary. Every non-zero known-spell
or cantrip allowance must be filled exactly before the Class step can advance;
the blocking hint reports the current and required counts. A prepared-spell tier
whose creation allowance is zero remains intentionally optional. Changing class
clears the previous class's spell picks so overlapping spell ids cannot satisfy
the new class accidentally.

Class starting equipment is resolved against handbook items before rendering.
Fixed grants and every concrete branch use item rows that can open the
full handbook card; “any weapon/tool/focus” clauses use the same row inside a
searchable dropdown and persist the selected item id. On the Class step, weapon
rows use a taller presentation with a 64×64 handbook icon; the name, primary
damage die, localized properties, count, price and weight form two readable
columns to its right. The left column pairs the name with damage below it; the
right column pairs the compact count/price/weight group with properties below it.
Every localized property is a separate hover target. When its suggest entry has
a description, hovering that property opens the shared tooltip with the property
name and its own description.
Armor rows on the same Class step use the same taller 64×64-icon layout. The
second line exposes the armor category and AC (or shield bonus); the trailing
Stealth disadvantage marker is rendered only when `stealth_disadvantage` is true.
Other item and tool rows reserve the same 64×64 icon geometry while keeping
their own metadata composition. Groups with exactly two alternatives use a two-column
desktop layout with a single vertical divider and a shield-check marker on the
selected branch; three or more alternatives are separated horizontally, and
the columns collapse to the same horizontal separators on mobile. The group
title continues into a fading rule rather than introducing another nested card.
Items in the active branch retain the shared row's hover-like accent state;
fixed grants use the same treatment because they are selected automatically.
Weapon rows show localized property names on the right. In class alternatives,
the row body selects its branch and a separate question-mark action opens the
handbook card without changing that selection; re-clicking an active branch
does not clear its concrete picker values.
Concrete item selectors remain visible before branch
selection; choosing an item activates that branch, while switching columns
clears the previous column's concrete picks. Pick-kind labels are carried by the
selector placeholder instead of occupying a separate title column. A class may instead enable
“Закупиться потом в магазине”. This disables both the class kit and background
possessions, rolls the PHB 2014 class-wealth formula and replaces the later
Equipment step with a searchable five-catalogue shop. Its cart compares all
prices in copper, persists the individual dice and purchases in the draft, and
places unspent gp/sp/cp into the created character's wallet.
Every granted or purchased owned-item reference carries canonical
`{item_id,count,params}` data through the draft and creation assembler. Concrete
parameters are part of the stack identity: equal rope references of the same
length merge, while different lengths remain separate. Built-in packs grant
50-foot hemp rope and the sailor background grants 50-foot silk rope through
`params.length_ft`; the shared handbook cards themselves have no fixed length.

The background step also works with handbook item references (type 11), not
suggest values. Its catalogue is an exact two-column desktop grid that collapses
to one column at 700px and below. Every card uses only `coverImageUrl`, followed
by the background name, its short handbook description and granted skills; a
missing cover produces a monogram instead of stretching `iconImageUrl`. Selection
uses the shared `IllustratedChoiceStage`: the chosen card expands into a
full-width horizontal row, the other backgrounds leave the catalogue, and a
back action restores the two-column list without changing the content scroll.
The existing skill, language and feature summary appears below the expanded
card. Starting money uses the shared character-sheet money face inside a
dedicated accent tile: currency name, color and SVG come from suggest type 17,
with a larger amount and coin icon instead of a compact text fact. Every granted
tool and possession is stored on the background as a
canonical handbook item id and rendered through `ItemReferenceRow`; activating
the row opens `ItemViewModal`. Concrete weapons therefore keep their combat
data and use the same roomy 64px-icon weapon row everywhere in the wizard,
including backgrounds and the starting shop. Category choices such as “one
gaming set” or “one musical instrument” are stored as data-driven
`item_choices`. The Background step renders every active choice with the shared
searchable equipment selector and cannot advance until the choice is complete.
The selected handbook item replaces the generic tool row. A choice is shown
exactly once and carries an explicit «Владение», «Предмет» or «Владение +
предмет» badge. Where the background grants a tool proficiency, the character
stores the concrete name (for example, `Кости`) instead of the generic category
(`Игровой набор`). If that option also grants a physical item, it is assembled
as a type-14 entry in the ordinary inventory; ownership and proficiency never
duplicate one another in the UI. Equipment-only choices are omitted when class wealth replaces
starting equipment.

Class equipment, background grants and the starting shop use the same roomy
`ItemReferenceRow` geometry. Long names wrap instead of truncating, vertical
padding stays close to the 64px icon, and the narrow right rail stacks the
handbook-details action, cost and weight from top to bottom. Item categories
change only their inner facts: weapons show damage and properties, armor shows
its AC rules, while ordinary gear keeps its own metadata.

The PHB 2014 audit identifies mechanical item/tool choices for nine base
backgrounds: Acolyte (holy symbol and devotional text), Charlatan (con prop),
Criminal and Noble (gaming set), Entertainer (musical instrument), Folk Hero
and Guild Artisan (artisan's tools), Outlander (musical instrument), and Soldier
(gaming-set proficiency plus dice/cards equipment). All other base-background
item and tool grants are fixed. The background equipment area separates weapons and other possessions into
independent grids, so a roomy weapon row never stretches an adjacent compact
item. Each grid uses two desktop columns and one mobile column. In starting-shop
mode the equipment rows and money row are
replaced by an explicit note that class wealth owns them. Built-in background covers live in system
`storage_image` rows assigned through the generic `item.cover_image_id` relation.

Key rules:

- race/class/subrace/subclass are handbook item references;
- all binding fields are arrays of item ids;
- content publication scope is carried through every catalogue query;
- choices granted by a race or class are completed on that source step;
- proficiency-bound union choices are restricted to proficiencies already
  selected on the character; Rogue Expertise can therefore choose either a
  proficient skill or thieves' tools during creation;
- class and background starting equipment use handbook ids; the background
  schema stores parameterized `tool_items`, `equipment_items` and
  `starting_coins` directly, while `item_choices` describes concrete selectable
  item ids and the generic grants they replace;
- the starting-shop path is mutually exclusive with class/background equipment,
  and its remaining class wealth is the only starting wallet amount;
- handbook weapons added by the class, background or equipment step are written
  to the dedicated weapon block; other additions use the canonical sectioned
  inventory model;
- starting armor and shields are written to `items.equipped` and initialize the
  sheet's structured AC rule, including a medium-armor Dexterity cap;
- descriptions are edited/rendered through the shared rich-description pair;
- feat and item selection uses the handbook `ItemPickerModal`;
- the Personality step's dice action uses the shared race-aware name generator,
  preferring the selected subrace and avoiding an unchanged consecutive result;
- the Personality step uses the same fixed 3×3 D&D alignment enum as the sheet;
- classes whose handbook `spellcasting.prepares` flag is enabled create a
  spellbook with preparation mode enabled automatically; selected cantrips are
  stored unprepared, selected leveled spells begin prepared, and granted
  archetype/domain spells begin permanently prepared;
- spell-slot progression is read from `caster_progression` on class/subclass
  handbook data rather than inferred from English or localized names;
- fixed racial, class-feature and feat `granted_spells` are added even for a
  non-caster, remain read-only, retain their source and use their configured
  per-spell casting ability and cast level instead of guessing them from the
  class-wide spellcasting settings;
- one-time racial grants live directly on race/subrace data: `lang_choice`,
  `skill_choice`, fixed `skill_prof`, and weapon/tool proficiencies. Textual
  ability cards represent ongoing rules only and are not duplicated on the
  finished sheet;
- resets and incomplete-create decisions use shared `ConfirmDialog`;
- the draft persists in `localStorage` and is cleared after successful create.

Handbook item pickers opened from the character sheet reuse the full collection
controls. Their teleported schema-filter and content-source popovers inherit a
layer just above the picker modal, rather than the global page-popover default,
so both menus remain visible and interactive over fullscreen item search.

Race and class rows include visual artwork; the class result block records the
resolved class choices below the controls. Handbook equipment rows can open
their full item card. Skill choices use description tooltips; spell tiles show
the school label and their detail action uses a question-mark help icon.
Character name belongs to the Personality step;
age/height/weight fields show race-aware recommendations and the larger
background fields keep enough vertical room for prose. Pressing an unavailable
Next action scrolls to and pulses the first incomplete field.
Subclass UI is present during creation only for classes that actually choose a
subclass at level 1. Later-level archetypes are deliberately not announced or
previewed in the creation wizard; they appear in the level-up flow when needed.

На шаге характеристик смена метода всегда очищает прежнее распределение, но
сохраняет сам результат броска в черновике даже без назначенных значений.
Point-buy подчёркивает остаток бюджета и цену следующего повышения каждой
характеристики; режим броска постоянно показывает пул результатов и кнопку
переброса. Шесть характеристик используют единую крупную сетку 3×2 на desktop:
каждая карточка отдельно показывает итог, модификатор, базу, расовый бонус и
контрол текущего метода; ключевые характеристики класса отмечены бейджем.
Иконка и её цвет берутся из suggest-справочника характеристик (type 16), а до
его загрузки используется буквенное сокращение. Не назначенные итог и база
обозначаются приглушённым вопросительным знаком.
Стандартный набор и результаты броска назначаются через общий кастомный picker:
его меню раскрывает значения компактной сеткой и показывает одинаковые
результаты отдельными пунктами с независимыми внутренними ключами, не используя
нативный select.
На средних и мобильных экранах сетка перестраивается в две и одну колонку.
Быстрая сборка показывается только для стандартного набора; в режиме броска её
место в панели занимает кнопка броска. Первый бросок выполняется сразу, а
повторный требует шуточного подтверждения о недостойной героя попытке спорить с
судьбой. Each 4d6 series uses the shared dice-roll animation, shows enlarged d6
faces with their actual values and strikes through its discarded lowest die.
Equal totals remain separate pool entries; assigned values disappear
from other selectors instead of staying disabled. **Быстрая сборка** доступна на mobile и раскладывает стандартный
набор по приоритетам выбранного класса.

`buildCharacterData` is the only assembler. It produces current D&D data:
`classes` (without `class/subclass` mirrors), object stats, object speed,
`hp.hitDice`, object spells, weapon entries, sectioned inventory and object
money. Creation does not emit historical variants for older readers.

## Navigation and destructive actions

List ↔ sheet uses router navigation. Clone calls
`POST /api/char/{uuid}/clone`; delete calls `DELETE /api/char/{uuid}` after a
shared confirmation dialog. Feature code must not use browser confirm/prompt or
implement a second card-to-sheet data resolver.
