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
profiles. The mobile D&D stats tab uses a 12px top-level column gap. Tab state
is encoded in the route query. `CharacterTabPane.vue` owns
one tab pane; swipe/drag logic is extracted into composables. On mobile, each
tab owns its nested scroll position and keeps `--bg` as its canvas. Content is
split into semantic `--surface` blocks instead of painting a whole tab: every
weapon is a card; spell parameters, slots and each spell level are separate
cards; inventory sections and utility widgets are separate; the personality
profile declares the `Основное`, `Облик`, `Характер` and `История` tile groups
in `mobile.json`. The mobile skills tab starts with the shared resources block,
followed by proficiencies and character abilities. The character route hides the global app header at the mobile
breakpoint and gives the full viewport to its own toolbar; that toolbar menu has
an explicit **К персонажам** action, including on read-only public sheets. Its
desktop shell also occupies the full viewport because application navigation is
provided by the fixed side rail and does not reserve a top-header offset. Its
active tab still registers its DOM scroller through `useAppHeaderCollapse` so
the compact common strip has one shared scroll/settle observer; regular routes
keep the header in document flow. Completed tab changes are pushed into the
`tab` route query. Browser Back and Forward therefore restore prior tabs (even
after rapid history navigation), while **К персонажам** provides a direct exit
to the character list.
Desktop `LayoutInnerTabs` groups also keep their selected pane in independent,
schema-stable `innerTab-*` query keys. Reload and browser history restore both
the outer character tab and its inner pane; invalid or stale inner indexes fall
back to the first pane. Every weapon and inventory section uses its own shared
desktop/mobile `BaseTile`; fixed equipment utilities and personality groups use independent surfaces,
spell parameters/slots/levels use separate `BaseTile` cards, and diary collections keep
their own cards while notes have a dedicated surface. The desktop character
page uses the same subtle 24px dot pattern as the session chapter canvas on its
global `--bg` backdrop; the central tab remains transparent, and its cards do
not merge back into one large tile. Desktop tab labels share
the same muted, fixed-weight typography so the active, fully rounded 3px underline
changes state without shifting label geometry; the central pane keeps the same explicit right
gutter as the upper character summary. Mobile uses the same outer `tab` route contract.
The sticky mobile tab chrome ends with a narrow static masked blur and subtle
`--scrim` darkening over the scrolling content; only that 18px strip uses
`backdrop-filter`, with a plain dark gradient as the unsupported-browser
fallback.
The character viewport keeps its pre-keyboard height while a rich-text or form
editor is focused. `useCharacterViewport` owns the visual/layout viewport
synchronization and document-scoped focus handling needed by editors teleported
outside the page root.
The desktop skills sidebar groups conditions, exhaustion and heroic inspiration
inside one interactive **Статусы** tile. The tile keeps the rules term
**Состояния** for the condition list itself, summarizes active condition chips,
the non-zero exhaustion level and active inspiration without expanding
exhaustion effects, and omits both inactive indicators from the tile. It
opens one vertical morph editor with direct tabs for all three domains. Clicking
a domain inside the tile opens its corresponding tab. The compact mobile strip
keeps HP at its intrinsic number width and never lets
the HP numbers shrink. Its right side contains a fixed **Статусы** action
button with editors for conditions, exhaustion and heroic inspiration. Active
condition icons, a non-zero exhaustion level and active inspiration stay visible
in a horizontally scrollable summary; the larger condition icons are frameless
and show the condition description on hover. Empty and zero values render no placeholder.
Heroic inspiration is stored as the boolean `values.inspiration`.

## Shared UI requirements

General-purpose labels, text, number, textarea and action rows use
the form primitives exported by `@sylvieshare/share-ui`; rule-specific
calculators, stat controls and file inputs may
own specialized controls. Regular windows use `AppModalFrame`, whose title,
close button and mobile handle remain fixed while the body scrolls. Direct
`AppModal` usage is reserved for specialized fullscreen workspaces. Confirm and one-line prompt use
`ConfirmDialog` and `TextPromptDialog`. Item detail uses
`ItemViewModal`, formatted descriptions use `InputDescription`/`RichContent`,
sortable collections use `useSortable`. Full selection rules are documented in
`md/frontend.md`.

Spellbook settings use `DndSpellbookSettingsModal`; both character settings
entry points reuse `ContentSourcesModal`. Handbook item viewing and search are
independent `features/handbook` components. Character-specific item actions are
supplied through the detail modal footer instead of being implemented by the
handbook renderer.

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
Completing either rest publishes one `rest_completed` session event with its
kind and recovery summary when the sheet has an attached session context. Hit-die
rolls remain normal `dice_roll` events; opening or cancelling a rest does not
write history.

Race abilities, class abilities and feats remain separate canonical arrays and
use their corresponding handbook item types and independent editors. Desktop
and mobile present the three domains as sections of one visual tile with shared
outer chrome and internal dividers. Their sheet rows render the assigned
`item.svg` in a fixed neutral-gray slot; a missing SVG leaves that slot empty
instead of falling back to the former circle-with-dot marker. Entry names use
the primary text color so they remain visually stronger than muted section
headings.

## Items, weapons and spells

`DndItems` uses `lib/itemSection.js` and the handbook item picker. Equipped items
are a top-level array; user sections never double as equipped. Entry override
is for a custom name/description/count metadata, while referenced item content
comes from handbook. A referenced row renders its handbook `item.svg` when the
item has one. Every row reserves the same icon slot, so names remain aligned
when an icon is absent; simplified custom rows leave that slot empty instead of
showing a placeholder. Inventory glyphs are neutral gray, frameless, have no
background tile and use the available row height for a larger drawing.
The list shows count as a badge and has no inline increment/decrement controls.
Clicking an inventory row opens the shared `RowActionMenu`: referenced items can
open their description, while editable rows offer spend, add, change and delete.
Spend/add changes the stack by one and publishes `item_spent`/`item_added` in an
attached session; editing metadata or deleting an entry does not claim a gameplay
action. Creating a new inventory item or weapon publishes `entry_added`; the
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

Diary sessions animate their disclosure body. Session create/edit forms use a
regular `AppModalFrame`; event create/edit retains the element-origin
`MorphEditorShell` flow. The event clone in that morph keeps the same left
offset and vertical timeline rail through its marker as the expanded diary
card. Counter morph editors update their text fields live and treat Enter as
completion of the current field by removing its focus without closing the
editor.

Окна предметов восстанавливают фокус без прокрутки исходного листа. Общий
`RowActionMenu` раскрывается короткой анимацией из точки trigger с учётом
`prefers-reduced-motion`. Блок зелий отделён нижним отступом, а секция ячеек
заклинаний имеет явный заголовок и на desktop, и на mobile.

Weapon handbook attacks use canonical `{dice_id,type,count}`. Character-added
attack rows use `{count,dice_id,type_suggest_id}` and are explicitly adapted at
the calculation boundary; this is not a fallback between stored formats.
An empty weapon `stat_suggest_id` is the explicit **Auto** mode: melee weapons
use Strength, ranged weapons use Dexterity, and finesse weapons use the larger
of the current Strength and Dexterity modifiers. The calculation is live, so a
later ability-score change updates attack and damage without rewriting the
weapon entry. A manually selected ability overrides Auto.
All `dice_id` values are fixed system strings (`"d4"`…`"d100"`); die visuals
use `SystemDie` and never load suggest type 11. Spell
handbook dice use only `dice_id/type`. Spell class ownership uses item-id
references under `classes`. Compact spell rows show the English name after the
Russian one and start their metadata with verbal/somatic/material components;
concentration and ritual remain title badges instead of being repeated in the
duration text.

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
`buildCharacterData` are the only producers of new D&D documents. Catalogue
weapons added during creation are emitted into `values.weapon`; inventory keeps
the other catalogue additions and text-only starting-equipment rows. See
`md/features/character-list.md` for the UI flow.

## Tests

Pure mechanics have Vitest coverage next to their modules. Required checks:

```bash
cd frontend
npm test -- --run
npm run build
```
