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
Снаряжение → Личность → Обзор. The desktop layout has step rail, central content
and live preview; on narrow screens it becomes one column, while the navigation
footer stays pinned to the visible bottom edge. The wizard owns an opaque
`--bg` canvas across its header, work area and footer so the global page grid
does not show through the creation workspace.

Key rules:

- race/class/subrace/subclass are handbook item references;
- all binding fields are arrays of item ids;
- content publication scope is carried through every catalogue query;
- choices granted by a race or class are completed on that source step;
- handbook weapons added on the equipment step are written to the dedicated
  weapon block; other additions and text-only starting rows use the canonical
  sectioned inventory model;
- starting armor and shields are written to `items.equipped` and initialize the
  sheet's structured AC rule, including a medium-armor Dexterity cap;
- descriptions are edited/rendered through the shared rich-description pair;
- feat and item selection uses the handbook `ItemPickerModal`;
- the preview's dice action uses the shared race-aware name generator, preferring
  the selected subrace and avoiding an unchanged consecutive result;
- resets and incomplete-create decisions use shared `ConfirmDialog`;
- the draft persists in `localStorage` and is cleared after successful create.

Race/class tiles include visual artwork and the current step repeats the
selected option's benefits below the choices. Handbook equipment rows can open
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
