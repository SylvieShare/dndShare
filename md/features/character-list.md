# Character list and creation

## Files

- `features/character-list/pages/ViewListCharacters.vue` — grouped list.
- `features/character-list/components/CharBox.vue` — card.
- `features/character-list/pages/ViewCreateCharacter.vue` — full D&D wizard.
- `features/character-list/components/CharacterCreateModal.vue` — compact
  embedded creation used from join/session flows and for systems with simple
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

Card display data comes only from per-setting accessors in
`features/character-editor/settings/index.js`. `CharBox` receives
`displayName/avatar/subtitle/level/abilities`; it does not know JSON paths and
does not receive template `pathValues`. D&D and VTM both have registered
accessors.

The D&D card includes `CharStatRadar`; its six scores and suggest metadata also
come from `dndAccessors`. Opening a card seeds `charSeed.js`, so the editor can
render before the network response while preserving the same API-shaped data.

## Creation entry points

From `/chars`, D&D opens the full `/chars/new` page. From a session/join screen,
`CharacterCreateModal` uses `MorphSheet` and embeds the same D&D rules engine so
the created character can immediately join the session. For VTM the modal calls
the registered `createData(name)`.

Both flows resolve `sourceVersionId` from `/api/sources` and send it explicitly
to `POST /api/chars`. The server rejects a missing/unknown version; there is no
default-version fallback.

## Full D&D wizard

The fixed steps are: Версия → Раса → Класс → Предыстория → Характеристики →
Снаряжение → Личность → Обзор. The desktop layout has step rail, central content
and live preview; on narrow screens it becomes one column, while the navigation
footer stays pinned to the visible bottom edge.

Key rules:

- race/class/subrace/subclass are handbook item references;
- all binding fields are arrays of item ids;
- content publication scope is carried through every catalogue query;
- choices granted by a race or class are completed on that source step;
- equipment uses the same canonical inventory model as the sheet;
- descriptions are edited/rendered through the shared rich-description pair;
- feat and item selection uses the handbook `ItemPickerModal`;
- resets and incomplete-create decisions use shared `ConfirmDialog`;
- the draft persists in `localStorage` and is cleared after successful create.

`buildCharacterData` is the only assembler. It produces current D&D data:
`classes` (without `class/subclass` mirrors), object stats, object speed,
`hp.hitDice`, object spells, sectioned inventory and object money. Creation does
not emit historical variants for older readers.

## Navigation and destructive actions

List ↔ sheet uses router navigation. Clone calls
`POST /api/char/{uuid}/clone`; delete calls `DELETE /api/char/{uuid}` after a
shared confirmation dialog. Feature code must not use browser confirm/prompt or
implement a second card-to-sheet data resolver.
