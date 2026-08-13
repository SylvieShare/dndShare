# Item UI and schemas

`frontend/src/features/items` contains item list/detail presentation and pure
rules helpers. Handbook navigation/data ownership is described in
`md/features/handbook.md`.

## Editing

`ItemEditModal.vue` renders `item_type.fields`. Supported field renderers
include scalar text/number/bool, description, suggest/suggest arrays, system dice,
`int_by_suggest`, object/object arrays and nested blocks. It uses shared form,
modal, select and rich-description components.

`int_by_suggest` has one stored shape: `{value,suggest_id}`. Formatting is
centralized in `lib/useCostFormatter.js`; numbers and strings are not accepted
as alternate cost formats.

## Detail components

Specialized details exist for weapons, spells, enemies, potions and feats.
They receive the same current `item.data` that the editor writes. Generic item
detail handles remaining schema fields.

Canonical examples:

- weapon attacks: `attacks:[{count,dice_id,type}]`;
- spell damage/heal dice: `{dices:[{count,dice_id,type,bonus?}]}`;
- spell class ownership: `classes:[{id}]`;
- feat description/prerequisites/choices: `description`,
  `prerequisite_groups`, `choices`;
- potion rarity is a suggest id and cost is `int_by_suggest`.

`dice_id` is a system-die string (`"d4"`, `"d6"`, `"d8"`, `"d10"`, `"d12"`,
`"d20"` or `"d100"`). Schema fields use `type:"dice"`; there is no dice
suggest catalogue.

Feature code does not try alternative keys such as weapon `add_attacks`, spell
`dice_suggest_id`, feat `desc` or spell `classIds`. Startup migrations fix item
rows before they can be read.

Character-added weapon attack rows use `{count,dice_id,type_suggest_id}`. The
weapon calculation composable adapts those rows explicitly when combining them
with handbook attack rows; it is not a historical-format fallback.

## Pure rules

`lib/featRules.js` evaluates structured feat prerequisites, grants and choices.
It reads only current keys. Unit tests cover requirement groups, repeatable
entries and selected choices.

## Visual conventions

- descriptions render through `RichContent`;
- base PHB weapons, ordinary equipment, feats and race/class abilities receive
  idempotent `item.svg` icons from startup schema; related class mechanics may
  share semantic artwork, while every item still has an explicit `svg_id`;
- `ItemIcon.vue` prefers the item SVG and may fall back to the item-type SVG.
  Handbook lists/pickers, the global header search, detail presentations and
  modal titles use the same rule instead of inferring art from localized names;
- details open through the handbook `ItemViewModal`/modal stack; `ItemViewModal`
  forwards an optional action slot into the fixed `AppModalFrame` footer, so
  character-specific mutations do not leak into handbook detail renderers;
- field labels and errors use shared form components;
- direct color literals are rejected by `npm run check:colors`.
