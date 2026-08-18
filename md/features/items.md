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

- descriptions render through `RichContent`; embedded `dice` nodes may store an
  optional manually entered numeric `average`, rendered inside the roll chip
  before the formula and retained when the node is edited;
- startup migration recursively replaces imported dice widgets and legacy
  tooltips in every item description: resolvable handbook entities become
  `item`/`suggest` nodes, while unresolved source references remain usable as
  native links;
- base PHB weapons, ordinary equipment, feats and race/class abilities receive
  idempotent `item.svg` icons from startup schema; related class mechanics may
  share semantic artwork, while every item still has an explicit
  `icon_svg_id`;
- `ItemIcon.vue` prefers `iconImageUrl`, then the item SVG, and may finally fall
  back to the item-type SVG. Raster item icons are PNG/WebP objects registered
  through `storage_image` and stored in S3;
  Handbook lists/pickers, the global header search, detail presentations and
  modal titles use the same rule instead of inferring art from localized names;
- details open through the handbook `ItemViewModal`/modal stack; `ItemViewModal`
  forwards an optional action slot into the fixed `AppModalFrame` footer, so
  character-specific mutations do not leak into handbook detail renderers;
- field labels and errors use shared form components;
- direct color literals are rejected by `npm run check:colors`.

### Static spell rune art direction

Spell icons form one set of **static magical runes**. They use the same visual
grammar while their center and palette communicate the spell itself.

- Build the icon from one dominant central glyph, an incomplete circular sigil
  and at most four large accents. It must remain distinct at the 48 px
  character-sheet size.
- Use broad flat-cartoon shapes, a thick deep-plum contour, saturated fills and
  restrained soft shading. Avoid realistic painting and micro-detail.
- Center the silhouette in a square with even transparent padding. Nothing may
  be cropped or depend on a visible tile, badge or external frame.
- Do not add text, letters, numbers, tiny inscriptions, detached particle
  clouds, cast shadows, scenery, hands, casters, logos or watermarks.
- Animation is not part of the production contract. A strong static glyph is
  the baseline; motion may be explored later without changing the stored art.

The production asset is a lossless `128×128` RGBA WebP with genuine alpha and
clean antialiased edges. Generate at a larger size, extract the background,
center the opaque bounds with a common safe margin and downsample with a
high-quality filter. Inspect every result at 128, 64 and 48 px. The deploy-only
`cmd/spell-rune-sync` uploads the files from `internal/spellimages` to stable
`system-spell-runes/v1/` S3 keys and registers them in `storage_image`; neither
the main binary nor frontend static assets contain the WebP files.

Use this base prompt for subsequent runes, replacing only the subject and
palette sections:

```text
Use case: stylized-concept
Asset type: transparent static fantasy game UI spell rune
Primary request: <one dominant glyph for the spell inside an incomplete sigil>
Style/medium: polished flat-cartoon game icon; broad clean shapes; thick
  deep-plum contour; restrained soft shading
Composition/framing: centered compact silhouette; even transparent padding;
  excellent readability at 48×48; at most seven major shapes
Color palette: <spell-specific palette>
Constraints: genuine transparent alpha; no checkerboard, frame, badge, square
  tile, scenery, caster, hand, text, logo, watermark, cast shadow, tiny
  particles, inscriptions, painterly texture or micro-detail
```

The initial semantic motifs are:

- **Fireball:** a red-orange central flame inside four plum-and-amber sigil
  segments and four outward energy points.
- **Bless:** an ivory-gold four-point sacred spark with three ascending rays
  and warm-gold sigil segments.
- **Aura of Vitality:** an emerald heart-leaf crossed by a golden pulse, with
  turquoise sigil segments and three life leaves.
- **Circle of Scarlet:** a pale-rose core enclosed by a segmented crimson ring
  and four diamond thorns, without literal blood or gore.
