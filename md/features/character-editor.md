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
desktop identity summary keeps the class list on a separate single line below
the name and race; an overlong multiclass label is ellipsized instead of
increasing the sheet width. The active tab still registers its DOM scroller
through `useAppHeaderCollapse` so
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
For an owner, clicking the HP tile opens its vertical editor with a container
morph from the clicked tile. The editor keeps the source tile width instead of
falling back to the narrow no-origin panel width. Maximum HP is stored as
`max {base,bonuses}`: the editor separates its base, read-only racial and other
ability contributions, and editable manual bonuses. Healing, rests, level-up,
print and encounter projections use the resolved total; encounter writes never
overwrite the maximum's source structure.
The desktop skills sidebar groups conditions, exhaustion and heroic inspiration
inside one interactive **Статусы** tile. The tile keeps the rules term
**Состояния** for the condition list itself, summarizes active condition chips,
the non-zero exhaustion level and active inspiration, expands every exhaustion
effect active at the current level, and omits both inactive indicators from the
tile. Exhaustion and inspiration occupy separate summary rows. It
opens one vertical morph editor with direct tabs for all three domains. Clicking
a domain inside the tile opens its corresponding tab. The compact mobile strip
keeps HP at its intrinsic number width and never lets
the HP numbers shrink. Its right side contains a fixed **Статусы** action
button with editors for conditions, exhaustion and heroic inspiration. Active
condition icons, a non-zero exhaustion level and active inspiration stay visible
in a horizontally scrollable summary; the non-zero exhaustion badge opens its
editor directly for an owner. The larger condition icons are frameless
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
- ability: `STR..CHA {value:{base,bonuses},save_up,save_bonuses,
  check_roll_mode?,save_roll_mode?,skills}`; навык может хранить `roll_mode`.
  Отсутствующий режим или `auto` использует эффекты экипировки, остальные
  значения (`normal`, `advantage`, `disadvantage`) являются явным
  переопределением;
- armor: `{bonuses}` хранит только дополнительные ручные бонусы. Базовый КД,
  Ловкость, щит, помеха Скрытности и владение вычисляются из каталожных
  доспехов в `items.equipped` и не копируются в персонажа;
- numeric tile with bonuses: `speed {base,bonuses}` and `initiative
  {base,bonuses,use_dex}`;
- HP: `{current,max:{base,bonuses},temp,ds_success,ds_failure,
  hitDice:[{die,total,used}]}`; legacy numeric `max` remains read-compatible;
- spellbook: `{stat_path,save_bonus,attack_bonus,slots_rest,preparation,
  spells:[{id,prepared,always_prepared?,external_only?,granted_by?,
  casting_ability?,slotless?}],slots:[{level,total,used}]}`;
- inventory: `{equipped:[Entry],sections:[{id,name,items:[Entry]}]}`, where an
  owned item entry is `{uid,item_id,count,params,override}`;
- potions: an independent array of the same owned entries; physical tools are
  type-14 entries in inventory, while tool proficiency remains in
  `proficiencies['Инструменты']` and is not inferred from ownership;
- wallet: `{order:[suggestId],amounts:{[suggestId]:number}}`;
- race/class/feat abilities: arrays of item references/current counters
  `{id,uid?,count,max_use?,resource_counts?,resource_version?,choices?}`.
  `choices` maps each stable handbook choice key to the selected values, for
  example `{style:['defense'],language:[6]}`; selections belong to this owned
  entry rather than to a hidden class/race rule;
  `count` stores the available charges of a single resource; `resource_counts`
  maps stable keys when one ability owns several independent resources.
  `resource_version` marks counters already migrated to the unified contract.
  Fixed and derived maxima remain handbook rules rather than copied character
  data (only `manual_size` stores `max_use` on the entry).

There are no `class/subclass` mirrors, scalar level/stat/hit-dice forms, array
spellbook, flat inventory or array wallet.

Автоматические источники преимущества и помехи собираются независимо. Если
хотя бы один источник даёт преимущество и хотя бы один — помеху, они взаимно
отменяются и итоговый режим становится обычным, независимо от количества
источников. Явный режим в редакторе остаётся пользовательским переопределением.
`useCharacterRollEffects` предоставляет единый `register/effects/resolve`
контракт: доспехи являются встроенным источником, а способности, состояния и
предметы могут регистрировать дополнительные эффекты без изменения компонентов
характеристик и инструментов.
Для инструмента в меню снаряжения доступен бросок с выбором одной из шести
характеристик; владение инструментом автоматически добавляет бонус мастерства,
а режим броска использует те же автоматические эффекты характеристики.

Spell preparation applies only to spells of level 1 and higher. Cantrips never
offer preparation actions, and stale preparation fields on them are cleared
after handbook details load. Owners change regular and permanent preparation
through the spell row action menu; the row has no standalone preparation
checkbox. A prepared spell gets two compact rounded side brackets inset from
the row edges. They occupy reserved horizontal space and therefore shorten the
spell content instead of sitting behind it. Each bracket ends with its rounded
arc, with no extended or fading horizontal arm. Its entire side edge is thicker
than the top and bottom edges, without a separate central stripe. Regular
preparation uses the accent tone; permanent preparation uses a thicker
warning-tone bracket. No botanical background asset is rendered.
`always_prepared` represents an archetype/domain spell learned for good: it
always implies `prepared`, is excluded from the ordinary prepared-spell total,
uses a richer vine print in the warning tone and can be assigned or removed
separately through the same menu. Granted archetype spells receive this status
during creation and level-up.

An ability, class feature or feat may contribute spells through its handbook
`granted_spells` contract. Such a spell is shown in the ordinary spell list but
is read-only while the character owns it only through that external source:
the row cannot be reordered, prepared or deleted. `granted_by` records the
source feature displayed to the player; `casting_ability` overrides the
spellbook-wide ability for that spell's attack bonus and save DC, and is shown
only when an override exists. `slotless` means that use does not spend an
ordinary spell slot. `cast_level` may fix the rules-defined level of that cast,
including damage/healing scaling, independently of the spell's base level.
Removing the source removes an external-only entry, but a
spell that the character also owns normally remains and only loses the source
metadata. Creation, level-up and the live sheet use the same synchronization
rule. The print sheet preserves both provenance and the per-spell casting math.

`internal/store/schema/03_characters.sql` and the later canonical migrations,
including `28_item_instance_params.sql`, migrate existing rows before HTTP start
and remove old keys. Components neither recognize nor write previous shapes.

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

Clicking the editable portrait opens actions for upload, crop, clear and a
separate character-icon upload. An icon is uploaded directly without the crop
workspace; PNG/WebP dimensions must not exceed 256×256. It is stored outside
character JSON, while the portrait keeps its existing crop flow and sheet aspect.
Character cards and session participants prefer the icon and fall back to the
portrait when it is absent. Drag-and-drop for the portrait enters the same crop
flow instead of bypassing it. Portrait action popovers use a layer above the
fullscreen session sheet. After every owner edit, the browser keeps the
three latest character-data snapshots in per-character local storage. Storage
failures do not interrupt editing or the normal debounced server save. The
sheet does not install a global `Ctrl+Z`/`Cmd+Z` handler; focused text editors
retain browser-native undo.

## Level up and rests

`DndLevelUpModal` computes the target class, gained features, subclass choice,
HP gain, ASI/feat, proficiency changes and spell-slot differences. It emits one
map of canonical block updates. `hp.hitDice` pools equal die types and is the
only hit-dice representation.

`lib/levelUp.js`, `lib/hitDice.js`, `lib/rest.js` and
`lib/characterResources.js` are pure and unit-tested.
Spellcasting ability is explicit handbook data (`spellcasting.ability` or
`spellcasting_ability` for later half-caster levels); it is not inferred from a
localized class name. `characterResources.js` defines the resource-source
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

The level-up editor does not render its level-up action until current XP reaches
the threshold for the next level; direct numeric level editing remains available.

Race abilities, class abilities and feats use one `choices` contract when they
are granted. Adding an item from a handbook picker first opens the mandatory
choice dialog and writes the result into the new ability entry only after all
sections are complete. Inline variants, suggest dictionaries and references to
another handbook item type are supported. Character creation and level-up use
the same keys and persistence shape; an item with several choice sections keeps
them independently addressable.
An item choice may set `grant_spells` and `casting_ability`; selected handbook
spell ids then become read-only external spells with the ability card recorded
as their source. Item filters traverse object arrays (for example
`{"lvl":0,"classes.id":4014}` for a Wizard cantrip).

Race abilities, class abilities and feats remain separate canonical arrays and
use their corresponding handbook item types and independent editors. Desktop
and mobile present the three domains as sections of one visual tile with shared
outer chrome and internal dividers. Their sheet rows render the assigned
`item.svg` in a fixed neutral-gray slot; a missing SVG leaves that slot empty
instead of falling back to the former circle-with-dot marker. Entry names use
the primary text color so they remain visually stronger than muted section
headings.

Handbook item types 3, 4 and 7 use `max_use` for a fixed maximum. They also
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

The read-only **Особые свойства** block sits above defenses and aggregates
`passive_effects` from race/class abilities and feats. It holds contextual
permissions, advantages, immunities and limitations such as Brave, Fey
Ancestry and Sunlight Sensitivity that cannot safely be forced onto every roll
without knowing the originating game effect.

Ability `roll_triggers` and `critical_damage` are separate shared contracts. A
natural-one reroll appears on the settled dice popup and produces one replacement
result. Weapons expose a critical-damage roll that doubles all attack damage
dice, keeps the flat modifier once and then applies matching ability modifiers
such as Savage Attacks' extra melee weapon die.

Class, race and feat items may also contribute `derived_effects`. This is the
single source contract for calculated AC formulas and bonuses, speed bonuses,
skill/save proficiencies, check/save/weapon-attack bonuses, roll modes and
critical thresholds. Every row keeps its handbook feature as the visible source,
is level-gated by the owning class, may depend on a stored feature choice and is
removed automatically with that feature. The sheet does not copy these values
into hidden character flags. Scaling rows that share a `group` use the highest
currently unlocked value rather than stacking every historical tier.

Unarmored Defense, Draconic Resilience, Fast and Unarmored Movement, Expertise,
Jack of All Trades, Diamond Soul, Slippery Mind, Aura of Protection, the Defense
and Archery fighting styles, and Champion critical thresholds use this contract.
The same calculations are used by the interactive and print sheets. Contextual
or activated effects such as Rage and Reckless Attack remain visible in the
read-only special-properties block until an explicit active mode is selected;
they are never applied permanently merely because the feature is owned.

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

## Items, weapons and spells

`DndItems` uses `lib/itemSection.js` and the handbook item picker. Its «Вещи»
picker follows `item_type.parent_type_id` and therefore searches the root type 2
plus all linked child catalogues. Equipped items are a top-level array; user
sections never double as equipped. Entry override
is for a custom name/description/count metadata, while referenced item content
comes from handbook. A referenced row prefers `iconImageUrl`, then `svg`, then
the collection image. Weapon, armor and ordinary item rows retain type-specific
content composition; simplified custom inventory rows leave the image slot empty
instead of showing a placeholder. Inventory glyphs are neutral gray, frameless
and use a 64×64 px slot. Weapon cards use the same 64×64 slot and prefer the
handbook `iconImageUrl`, falling back to the weapon SVG; the rest of the
weapon-specific attack, damage and property composition remains unchanged. A
click on a weapon tile opens its action menu instead of navigating directly
from the name. The menu contains handbook description, edit, move-to-inventory
and delete actions according to the viewer's permissions and linked item state.
Every owned inventory item, potion and tool uses `item_id`, an explicit `count` and a
typed `params` object. `params` contains values of the concrete instance and is
not an alternative handbook-data or free-form override store. Item-type
`instanceFields` declares the available parameters. Measured gear such as hemp
and silk rope stores `length_ft` on each reference; its handbook row stores only
measurement kind plus unit cost/weight. Displayed cost and weight scale with the
stored length, and stacks merge only when both `item_id` and canonical `params`
match.
The same picker is used for feats and abilities and opens above the active morph
editor, so its filters and item selection are never hidden behind the morph.
The list shows count as a badge and has no inline increment/decrement controls.
Clicking an inventory row opens the shared `RowActionMenu`: referenced items can
open their description and add one copy. A stack with more than one copy offers
separate removal of one copy and deletion of the whole entry. Only simplified
rows created without a handbook `item_id` offer metadata editing; inventory
removal is not recorded as item use. Adding a copy publishes `item_added` in an
attached session. A referenced child-type item also offers a move to its specialized
weapon or potion block. Potions and linked weapons can move back to the ordinary
inventory. A weapon keeps its magic bonus and weapon-only instance settings in
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
the weapon handbook links. Inventory rows use 64×64 handbook images while
retaining type-specific inner content.

Starting armor is placed directly in the equipped array. Its handbook
`data.armor` rule initializes AC as readonly equipment-derived bonuses; light
and medium armor include Dexterity and medium armor applies `dex_cap`. The
semantic accessor, visible tile and printable sheet all use the same formula.
Long rest restores half the total hit-dice pool automatically and does not ask
the player to allocate recovery manually. Spell save DC and spell attack tiles
expose their formulas as hover titles, and every spell-slot sphere has the same
subtle hover enlargement regardless of spent/read-only state.

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

## Rich text

Character notes/personality fields that are descriptions store the HTML emitted
by `InputDescription` and render through the DnD adapter over `RichContent`.
The toolbar inserts ordinary links plus atomic dice/item/suggest references;
selecting an existing reference offers change/delete actions. A field has one
schema key; components do not try `desc` and then `description`.

`person_alignment` is a fixed nine-value D&D enum rendered by the shared 3×3
alignment popover in both the character sheet and the creation wizard. The
print view renders larger, always-open spell-slot circles and gives inline rich
dice formulas a quieter paper style inside feature and spell descriptions.
Print CSS uses semantic `--font-print-ui`, `--font-print-display` and
`--font-print-prose` stacks. Their current Arial/Georgia values deliberately
preserve pagination; replacing them requires a rendered page-by-page review.

## Saving and synchronization

Character documents have technical `char.version`. Full updates and data
patches are owner-authorized. Poll/version endpoints detect remote changes;
pending local changes are saved by the editor's save orchestration. The
technical revision is unrelated to character level or rules edition.

## Creation

The dedicated D&D wizard and compact session creation both call the pure engine
under `settings/dnd/creation`. `blankValues`, grants, progression, equipment and
`buildCharacterData` are the only producers of new D&D documents. Catalogue
weapons added during creation are emitted into `values.weapon`, potions into
`values.potions`; tools remain type-14 entries in inventory together with the
other catalogue additions and text-only starting-equipment rows. Background tool
proficiency is assembled independently into `values.proficiencies`. See
`md/features/character-list.md` for the UI flow.
Class data may declare `tool_prof_choice {count,from}` with suggest type 5 IDs.
The PHB 2014 bard uses this contract to require three distinct concrete musical
instrument choices on the Class step; it no longer grants the broad
`Музыкальные инструменты` category. The selected suggest labels are written to
`values.proficiencies['Инструменты']` and survive wizard draft persistence.

## Tests

Pure mechanics have Vitest coverage next to their modules. Required checks:

```bash
cd frontend
npm test -- --run
npm run build
```
