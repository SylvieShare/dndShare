# Character editor

Character editor lives in `frontend/src/features/character-editor`. It is a
recursive code-schema renderer shared by supported game systems, not a set of
DB-defined templates.

## Settings registry

`settings/index.js` maps `char_template.name` to:

- render schema/layout;
- semantic accessors;
- source name/version;
- optional simple create payload.

Registered systems are D&D 5e (`DND5`) and VTM V20 (`VTM20`). D&D schema is
assembled by `settings/dnd/schema.js` from `blocks.json`, `desktop.json` and
`mobile.json`; VTM schema is imported as a code resource. Unknown template name
is rejected. DB template schema, create form and path maps do not exist.

## Rendering

`ViewCharacter.vue` owns page orchestration. `useCharacterData` loads the
character, resolves setting schema/accessors, exposes `charCtx`, sessions,
ownership and save state. Header/list/session identity all use the same semantic
accessors; layout JSON does not contain a second title resolver.

`TemplateBlockInner.vue` recursively renders layout nodes and blocks registered
in `blockRegistry.js`. Generic blocks live in `blocks/generic`, D&D blocks in
`blocks/dnd`, VTM blocks in `blocks/vtm`. New blocks are registered once and
receive data by block id.

Desktop and mobile share block definitions but have separate placement
profiles. Tab state is encoded in the route query. `CharacterTabPane.vue` owns
one tab pane; swipe/drag logic is extracted into composables. On mobile, each
tab owns its nested scroll position, that scroller is the sole source for app
header visibility, and the character viewport keeps its pre-keyboard height
while a rich-text or form editor is focused. `useCharacterViewport` owns the
visual/layout viewport synchronization and document-scoped focus handling
needed by editors teleported outside the page root.

## Shared UI requirements

General-purpose labels, text, number, textarea and action rows use
`shared/ui/form`; rule-specific calculators, stat controls and file inputs may
own specialized controls. Complex windows use `AppModal`; confirm and one-line prompt use
`ConfirmDialog` and `TextPromptDialog`. Item detail uses
`ItemViewModal`, formatted descriptions use `InputDescription`/`RichContent`,
sortable collections use `useSortable`. Full selection rules are documented in
`md/frontend.md`.

## Canonical D&D document

The current shape under `data.values` is:

- identity: `name`, `race/subrace {id,name}`, `classes
  [{id,name,level,subclass}]`, `ava {url,upload_id?}`;
- level: `lvl {level,exp}`;
- ability: `STR..CHA {value:{base,bonuses},save_up,save_bonuses,skills}`;
- numeric tile with bonuses: `speed {base,bonuses}` and `initiative
  {base,bonuses,use_dex}`;
- HP: `{current,max,temp,ds_success,ds_failure,hitDice:[{die,total,used}]}`;
- spellbook: `{stat_path,save_bonus,attack_bonus,slots_rest,preparation,
  spells:[{id,prepared}],slots:[{level,total,used}]}`;
- inventory: `{equipped:[Entry],sections:[{id,name,items:[Entry]}]}`;
- wallet: `{order:[suggestId],amounts:{[suggestId]:number}}`;
- race/class/feat abilities: arrays of item references/current counters.

There are no `class/subclass` mirrors, scalar level/stat/hit-dice forms, array
spellbook, flat inventory or array wallet.
`internal/store/schema/03_characters.sql` migrates existing rows before HTTP
start and removes the old keys. Components neither recognize nor write previous
shapes.

## Semantic accessors

`settings/dnd/accessors.js` and the VTM accessors define:

- `displayName`, `avatar`, `subtitle`, `level`;
- `hp`, `ac`, `initiativeBonus`, states;
- D&D ability radar;
- `headerTitle`, `listFields`, HP write path.

Consumers pass `{templateId,data}` and resolve the setting. They must not scan
block schema or know storage paths independently.

## Identity and multiclass

`DndCharIdentity.vue` edits name, avatar, race/subrace and class rows in a
shared modal. Classes use only `values.classes`; each row can carry a subclass
and level. `classEntriesOf` reads this list, `classesLabel` renders it. For a
single class, `lvl.level` controls the effective level; for multiclass the
per-class sum updates `lvl.level`.

## Level up and rests

`DndLevelUpModal` computes the target class, gained features, subclass choice,
HP gain, ASI/feat, proficiency changes and spell-slot differences. It emits one
map of canonical block updates. `hp.hitDice` pools equal die types and is the
only hit-dice representation.

`lib/levelUp.js`, `lib/hitDice.js` and `lib/rest.js` are pure and unit-tested.
Spellcasting ability is explicit handbook data (`spellcasting.ability` or
`spellcasting_ability` for later half-caster levels); it is not inferred from a
localized class name. Short/long rest update current spell slots, ability
counters and hit-dice pools without scalar mirrors.

## Items, weapons and spells

`DndItems` uses `lib/itemSection.js` and the shared item picker. Equipped items
are a top-level array; user sections never double as equipped. Entry override
is for a custom name/description/count metadata, while referenced item content
comes from handbook.

Weapon handbook attacks use canonical `{dice_id,type,count}`. Character-added
attack rows use their documented editor fields and are explicitly adapted at
the calculation boundary; this is not a fallback between stored formats.
Spell handbook dice use only `dice_id/type`. Spell class ownership uses item-id
references under `classes`.

## Rich text

Character notes/personality fields that are descriptions store the HTML emitted
by `InputDescription` and render through `RichContent`. A field has one schema
key; components do not try `desc` and then `description`.

## Saving and synchronization

Character documents have technical `char.version`. Full updates and data
patches are owner-authorized. Poll/version endpoints detect remote changes;
pending local changes are saved by the editor's save orchestration. The
technical revision is unrelated to character level or rules edition.

## Creation

The dedicated D&D wizard and compact session creation both call the pure engine
under `settings/dnd/creation`. `blankValues`, grants, progression, equipment and
`buildCharacterData` are the only producers of new D&D documents. See
`md/features/character-list.md` for the UI flow.

## Tests

Pure mechanics have Vitest coverage next to their modules. Required checks:

```bash
cd frontend
npm test -- --run
npm run build
```
