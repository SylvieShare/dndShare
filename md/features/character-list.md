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
`displayName/avatar/subtitle/level/abilities`; it does not know JSON paths and
does not receive template `pathValues`. D&D and VTM both have registered
accessors.

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
Снаряжение → Личность → Обзор. The desktop layout keeps the main step content in
a responsive column capped at 1120px, giving race and class covers a wider media
area. A separate 220px step rail floats directly
to that column's left; there is no permanent right preview. The rail shows the
primary current value for each step (for example,
the chosen race, class/subclass or background) without repeating its mechanical
details. The header contains only the workspace title; reset lives in the
central footer beside navigation, and there is no duplicate numeric step counter.
Neither race nor class repeats a «Результат выбора» block below its controls:
the selected illustrated card already contains the base result and dependent
choices remain visible in their own sections. Ability descriptions remain
available from the illustrated cards on hover. On narrow screens the workspace becomes
one column, while the navigation footer stays pinned to the visible bottom edge.
Only the capped central column owns an opaque `--bg` surface across its header,
work area and footer, with continuous side borders framing it on desktop. The
floating step rail and the space outside that column remain on the global dotted
application canvas.

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
Skill choices carried by a racial ability (for example Half-Elf
“Универсальность навыков”) use the same shared skill picker as the class
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
Dependent equipment, skill, feature, archetype and spell choices are announced in
the row but each type is rendered as its own accent-edged section only after selection. The selected
row moves to the top, the other classes leave the list, and the same stable back and
scroll-restoration behaviour as the race step returns to the catalogue. Subclass
tiles follow the same cover-only rule; `iconImageUrl` remains reserved for compact
handbook identity surfaces and never substitutes for a wizard cover.
The selected class is followed by a separate three-paragraph lore article; the
compact card uses `item.data.short_description` and does not repeat mechanics in
that prose. Race and class screens share `IllustratedChoiceStage`, which owns the
display heading, keyed list transition, scroll restoration, detail reveal and the
back action positioned over the selected card image. New systems can reuse this
shell while supplying their own cards and dependent-choice content.

Class starting equipment is resolved against handbook items before rendering.
Fixed grants and every concrete branch use compact item rows that can open the
full handbook card; “any weapon/tool/focus” clauses use the same row inside a
searchable dropdown and persist the selected item id. Weapon rows include their
primary damage die. Groups with exactly two alternatives use a two-column
desktop layout with a single vertical divider and a shield-check marker on the
selected branch; three or more alternatives are separated horizontally, and
the columns collapse to the same horizontal separators on mobile. The group
title continues into a fading rule rather than introducing another nested card.
Concrete item selectors remain visible before branch
selection; choosing an item activates that branch, while switching columns
clears the previous column's concrete picks. Pick-kind labels are carried by the
selector placeholder instead of occupying a separate title column. A class may instead enable
“Закупиться потом в магазине”. This disables both the class kit and background
possessions, rolls the PHB 2014 class-wealth formula and replaces the later
Equipment step with a searchable five-catalogue shop. Its cart compares all
prices in copper, persists the individual dice and purchases in the draft, and
places unspent gp/sp/cp into the created character's wallet.

The background step also works with handbook item references (type 11), not
suggest values. Its catalogue is an exact two-column desktop grid that collapses
to one column at 700px and below. Every card uses only `coverImageUrl`, followed
by the background name, its short handbook description and granted skills; a
missing cover produces a monogram instead of stretching `iconImageUrl`. Selection
uses the shared `IllustratedChoiceStage`: the chosen card expands into a
full-width horizontal row, the other backgrounds leave the catalogue, and a
back action restores the two-column list without changing the content scroll.
The existing skill, tool, language, feature, equipment and money summary appears
below the expanded card. In starting-shop mode the equipment and money rows are
replaced by an explicit note that class wealth owns them. Built-in background covers live in system
`storage_image` rows assigned through the generic `item.cover_image_id` relation.

Key rules:

- race/class/subrace/subclass are handbook item references;
- all binding fields are arrays of item ids;
- content publication scope is carried through every catalogue query;
- choices granted by a race or class are completed on that source step;
- class starting equipment uses handbook ids; text-only rows remain only for
  legacy background sentences in the ready-kit path;
- the starting-shop path is mutually exclusive with class/background equipment,
  and its remaining class wealth is the only starting wallet amount;
- handbook weapons added on the equipment step are written to the dedicated
  weapon block; other additions and text-only starting rows use the canonical
  sectioned inventory model;
- starting armor and shields are written to `items.equipped` and initialize the
  sheet's structured AC rule, including a medium-armor Dexterity cap;
- descriptions are edited/rendered through the shared rich-description pair;
- feat and item selection uses the handbook `ItemPickerModal`;
- the Personality step's dice action uses the shared race-aware name generator,
  preferring the selected subrace and avoiding an unchanged consecutive result;
- the Personality step uses the same fixed 3×3 D&D alignment enum as the sheet;
- classes whose handbook `spellcasting.prepares` flag is enabled create a
  spellbook with preparation mode enabled automatically;
- resets and incomplete-create decisions use shared `ConfirmDialog`;
- the draft persists in `localStorage` and is cleared after successful create.

Race and class rows include visual artwork; the class result block records the
resolved class choices below the controls. Handbook equipment rows can open
their full item card. Skill choices use description tooltips and spell choice
rows omit the school label; their detail action uses a question-mark help icon.
Character name belongs to the Personality step;
age/height/weight fields show race-aware recommendations and the larger
background fields keep enough vertical room for prose. Pressing an unavailable
Next action scrolls to and pulses the first incomplete field.
Subclass UI is present during creation only for classes that actually choose a
subclass at level 1. Later-level archetypes are deliberately not announced or
previewed in the creation wizard; they appear in the level-up flow when needed.

На шаге характеристик смена метода всегда очищает прежнее распределение.
Point-buy подчёркивает остаток бюджета и цену следующего повышения каждой
характеристики; режим броска постоянно показывает пул результатов и кнопку
переброса. Each 4d6 series shows all dice and strikes through its discarded
lowest die. Equal totals remain separate pool entries; assigned values disappear
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
