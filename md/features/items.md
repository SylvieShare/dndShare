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

### Raster spell icon art direction

Raster spell icons form one set of **painted magical emblems**. The Fireball
icon is the rendering-quality reference: later icons copy its finish, visual
density and readability, not its subject or palette.

- Show one dominant magical subject with at most two or three supporting
  elements. It must remain recognizable at the 48 px character-sheet size.
- Use polished, semi-realistic fantasy painting with tactile energy, strong
  local contrast, saturated color and a bright magical core. Light originates
  inside the spell effect.
- Center the silhouette and use roughly 75–85% of the square canvas, retaining
  clear padding on every side. Nothing may be cropped.
- Do not add a frame, badge, circular plate, square backdrop, scenery, caster,
  hand, text, logo or watermark. A ring is allowed only when it is the spell's
  actual subject.
- Keep external glow compact and let it fade into transparency before the
  canvas edge. Avoid detached edge particles, cast shadows and visual noise.
- The spell effect selects the palette; the shared identity comes from the
  painting technique, internal lighting, silhouette strength and detail
  density. Harmful blood magic should feel dangerous but not graphic or gory.

The production asset is a `128×128` RGBA WebP with transparent corners and
clean antialiased edges without a chroma-key fringe. Generate at a larger
square size, extract the background, then downsample with a high-quality
filter. Inspect the result at 128, 64 and 48 px. Only the final WebP is uploaded
to S3 and registered in `storage_image`; it is not added to frontend static
assets. Generation masters may be retained outside the runtime repository.

Use this base prompt for subsequent icons, replacing only the subject and
palette sections:

```text
Use case: stylized-concept
Asset type: transparent 128×128 fantasy game UI spell icon
Primary request: <one dominant magical emblem for the spell>
Style/medium: polished semi-realistic fantasy painting; match the Fireball
  icon's finish, visual density and small-size readability
Composition/framing: centered strong silhouette; fill 75–85% of the square;
  generous clear padding; nothing cropped; at most 2–3 supporting elements
Lighting/mood: intense internal magical light; compact glow contained before
  the canvas edge
Color palette: <spell-specific palette>
Constraints: perfectly flat removable chroma-key background; no frame, badge,
  plate, scenery, caster, hand, text, logo, watermark, cast shadow or detached
  edge particles; no key color inside the subject
```

The initial semantic motifs are:

- **Fireball:** a dense orange-red sphere of flame with a golden-white core.
- **Bless:** a luminous holy-water drop beneath three small diverging rays or
  blessing marks; gold, warm white and a restrained sky-blue accent.
- **Aura of Vitality:** a bright life-energy core inside one broad aura ring
  with a few rising flows; emerald, turquoise and golden white.
- **Circle of Scarlet:** a blood-red ritual circle emitting a concentrated
  vertical column of necrotic energy; scarlet, crimson, dark red and cold
  white-pink highlights, without literal gore.
