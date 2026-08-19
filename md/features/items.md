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

Specialized details exist for weapons, spells, enemies, potions, feats, armor
and transport. Their data, UI and art contracts are documented in
`md/features/weapons.md`, `md/features/armor.md` and
`md/features/transport.md`.
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
- `ItemIcon.vue` prefers the item's `iconImageUrl`, then its SVG, and finally
  falls back to the item type's `iconImageUrl`. Raster item icons are PNG/WebP
  objects registered through `storage_image` and stored in S3; collection
  emblems use the same projection contract but point to transparent PNG assets
  embedded under `public/static/handbook-types`;
  Handbook lists/pickers, the global header search, detail presentations and
  modal titles use the same rule instead of inferring art from localized names;
- all handbook object rows share `ObjectListItem.vue`: a 64 px icon well is pinned to
  the left edge, followed by an optional metric such as spell level or monster
  CR, a two-line identity block and trailing metadata. Raster artwork fills the
  icon well on desktop and mobile; compact SVG, collection-emblem, potion-vial and feat-sigil
  fallbacks stay centered in the same geometry;
- handbook search, schema filters and publication-source filters live in the
  fixed control area at the top of the list column, above its independently
  scrolling rows. Text search matches a case-insensitive substring of either
  the Russian name or `nameEn`; publication codes remain in the dedicated
  source filter. Its publications are grouped as core books, official
  supplements, settings, adventures, Unearthed Arcana and third-party
  material; PHB, MM and DMG keep that canonical order inside the core group.
  The main catalogue and item pickers reuse this placement.
  Bestiary schema filters cover creature type, size, environment, legendary
  status, named-NPC status and CR; the finite CR list is stored in schema
  metadata so the filter control is available before any dictionary request.
  Spell filters include the base class items referenced by `classes[].id`;
- details open through the handbook `ItemViewModal`/modal stack; `ItemViewModal`
  uses the lower-level `AppModal` because the shared item header is its only
  header, and forwards an optional action slot into a fixed footer, so
  character-specific mutations do not leak into handbook detail renderers;
- every item detail uses `ItemDetailHeader.vue`. It renders a panoramic
  `coverImageUrl` as full-bleed artwork behind the identity block and actions;
  without a usable cover it keeps the same structure as a compact neutral
  header and uses the compact icon as its image fallback. A loaded cover hides
  the icon instead of duplicating two identity images. The technical item ID is
  rendered as muted metadata at the bottom of the detail content, never on the
  artwork. Cover height is a per-handbook-type presentation profile without a
  shared maximum: the default follows the asset's intrinsic ratio, while a type
  may opt into a minimum height without branching the header;
- bestiary details use a `440px` minimum cover profile. Their identity, source,
  tags, CR/AC/HP/proficiency, speeds and all six ability modifiers are rendered
  in the header summary slot. The cover itself is not dimmed: the title uses a
  compact content-sized scrim and each metadata/stat group owns its translucent
  block. On desktop CR/AC anchor the left edge, HP/proficiency/speeds anchor the
  right edge, a reserved center column exposes the creature, and abilities form
  the bottom strip. At `520px` and below the side groups become two columns and
  abilities use a `3×2` grid. Skills and all later sections remain below the
  artwork;
- weapon details use a `420px` minimum `4:3` cover profile. Damage/category
  tiles anchor the left edge, range/cost/weight tiles anchor the right edge,
  and a bottom translucent rail shows OR-proficiencies and properties. The
  weapon image remains visible in the reserved center column;
- transport details use a `400px` minimum `3:2` cover profile. Category and
  primary movement sit on the left, cost and weight on the right, and the
  movement/capacity/relation rail stays at the bottom. Mount icons are compact
  head portraits facing right; object and vehicle icons use their own full
  silhouette. The full contract is in `md/features/transport.md`;
- ordinary type-2 gear marked `available_in_starting_shop=true` uses a portrait
  item-showcase contract when a cover is assigned. The source cover is an opaque
  `1536×1024` JPEG (`3:2`) and fills a `400px` minimum header. Price and weight
  are real translucent UI cards at the quiet lower left and right of the cover
  and are not baked into the illustration or repeated below it. Without an
  assigned cover the item keeps the compact generic header and its ordinary
  metadata section;
- field labels and errors use shared form components;
- direct color literals are rejected by `npm run check:colors`.

### System media workflow

- Install new system raster media only through MCP
  `handbook_item_set_system_image`, using `slot="icon"` or `slot="cover"` and
  `preservePrevious=true` when replacing an existing asset.
- Icons and covers are independent `item.icon_image_id` and
  `item.cover_image_id` relations backed by `storage_image`. MCP stores their
  content-addressed objects under `system-item-media/v1/` in S3.
- Define the image from the item name, structured data, description and
  mechanics first. Before generating or replacing a system icon or cover,
  always open the current or imported cover when one exists and compare it with
  those sources. Treat that review as a required visual audit, not as automatic
  approval of the old art direction: decide case by case which factual traits
  (creature or character count, anatomy, silhouette, equipment and other
  defining features) should remain recognizable, and which incidental choices
  may be redesigned. Use the source cover only for those factual decisions;
  never copy its composition, rendering style or palette by default. When no
  source cover exists, proceed from the structured sources and record that the
  visual audit had no source image.
- Do not commit generated image binaries to the application repository or add
  them to a startup sync command. Existing sync commands and embedded manifests
  are legacy bootstraps only.

### Static spell rune art direction

Spell icons form one set of **static magical runes**. They use the same visual
grammar while their center and palette communicate the spell itself.

- Build the icon from one dominant central glyph, an incomplete circular sigil
  and at most four large accents. It must remain distinct at the 64 px
  character-sheet size.
- Use broad flat-cartoon shapes, a thick deep-plum contour, saturated fills and
  restrained soft shading. Avoid realistic painting and micro-detail.
- Center the silhouette in a square with even transparent padding. Nothing may
  be cropped or depend on a visible tile, badge or external frame.
- Do not add text, letters, numbers, tiny inscriptions, detached particle
  clouds, cast shadows, scenery, hands, casters, logos or watermarks.
- Animation is not part of the production contract. A strong static glyph is
  the baseline; motion may be explored later without changing the stored art.

Store the result as a lossless `128×128` RGBA WebP with genuine alpha and clean
antialiased edges. Generate at a larger size, extract the background, center
the opaque bounds with a common safe margin and downsample with a high-quality
filter. Inspect every result at 128 and 64 px.

Use this base prompt for subsequent runes, replacing only the subject and
palette sections:

```text
Use case: stylized-concept
Asset type: transparent static fantasy game UI spell rune
Primary request: <one dominant glyph for the spell inside an incomplete sigil>
Style/medium: polished flat-cartoon game icon; broad clean shapes; thick
  deep-plum contour; restrained soft shading
Composition/framing: centered compact silhouette; even transparent padding;
  excellent readability at 64×64; at most seven major shapes
Color palette: <spell-specific palette>
Constraints: genuine transparent alpha; no checkerboard, frame, badge, square
  tile, scenery, caster, hand, text, logo, watermark, cast shadow, tiny
  particles, inscriptions, painterly texture or micro-detail
```

### Race icon art direction

Race icons use **heraldic character busts**, not abstract runes and not reduced
versions of the cover portrait. The silhouette should identify the ancestry
before the internal detail is noticed.

- Show only the head and shoulders in side or three-quarter view. Build one
  strong, compact outer contour with a thick deep-plum outline and very few
  internal shapes; the icon must remain readable at 64 px.
- Use polished flat-cartoon rendering, saturated jewel-tone fills and restrained
  two-step shading. Avoid realistic skin texture, painterly backgrounds and
  miniature costume detail.
- Communicate ancestry through anatomy and one large shape: an elf's pointed
  ear, a dwarf's beard and broad shoulders, a tiefling's horns or a
  dragonborn's angular snout. Do not depend on text, scenery, weapons or a
  collection of tiny props.
- Keep related subraces visibly related through proportions and anatomy. Give
  each subrace its own silhouette variation, palette and one major costume or
  hair shape rather than producing simple recolors.
- Do not add a tile, disc, rune ring, frame, shadow, glow, particles, letters,
  numbers, logos or watermarks. Empty canvas space must be genuine alpha.

Store the result as a lossless `128×128` RGBA WebP with the opaque bounds
centered inside a common safe margin. Inspect it at both 128 and 64 px on light
and dark surfaces. Keep larger race illustrations as independent covers.

### Class icon art direction

Class icons use **heraldic profession emblems** rather than character portraits
or miniature scenes. Each emblem communicates the class through one dominant
tool, relic or magical focus, so it remains distinct from race busts and spell
runes while belonging to the same visual family.

- Build one compact centered emblem from one dominant object and no more than
  two large supporting accents. Prefer a readable outer silhouette over literal
  inventory detail; crossed-object bundles and collections of tiny equipment
  are avoided.
- Use the established polished flat-cartoon rendering: a thick deep-plum
  contour, saturated jewel-tone fills, restrained two-step shading and small
  warm highlights. The object may be slightly three-quarter, but must not use
  realistic texture or painterly noise.
- Give every class its own silhouette and primary palette. Repeated motifs such
  as blades or magic must differ structurally: a fighter's closed helm, a
  paladin's tower shield, a magus's spell-charged sword and a rogue's narrow
  dagger cannot be simple recolors.
- Center the opaque bounds inside one common safe margin. Do not add a tile,
  disc, external frame, scenery, character, detached particle cloud, cast
  shadow, text, letters, numbers, logo or watermark. Empty canvas space must be
  genuine alpha.

Store the result as a lossless `128×128` RGBA WebP and inspect it at both 128
and 64 px on light and dark surfaces.

Subclass icons follow an **inherited-anchor rule**. When the parent has a strong
carrier shape, every sibling keeps it and replaces the dominant internal sign:
wizard schools share the open spellbook, paladin oaths share the tower shield,
cleric domains share the reliquary sun and druid circles share the antler/leaf
language. Other families inherit the parent's contour weight and palette while
using a new specialization silhouette. A subclass must therefore read as part
of its class family and remain distinguishable from every sibling at `64×64`;
it must not be a simple recolor of the base-class emblem.

### Starting-shop gear art direction

Mundane purchasable gear uses one object-focused flat-cartoon family. The pilot
system assets are item `349` («Арбалетный болт») and item `384` («Молоток»).

- The icon is a single compact object silhouette on genuine alpha, stored as a
  lossless `128×128` RGBA WebP and checked at `64×64`. Use the established thick
  deep-plum outline, broad shapes, restrained two-step shading and warm material
  highlights. Do not add a tile, frame, floor, hand, text or cast shadow.
- The cover is an opaque `1536×1024` JPEG (`3:2`). Show the complete object in
  the central 55–60% of a subdued workshop or travel context. Keep the lower
  left and right naturally dark and low-detail for the HTML price and weight cards; never
  paint fake panels, badges, gems, labels, numbers or other UI into the image.
- A cover describes the purchased row rather than a generic theme. Ammunition
  may show its sold bundle while retaining one dominant projectile; containers
  and tool kits must keep their factual contents and silhouette recognizable.
- Generate at a larger size, crop to exact `3:2`, and downsample with a
  high-quality filter. Install both slots only through MCP
  `handbook_item_set_system_image`; do not commit image binaries.

### Race cover art direction

Race covers are portrait-oriented detail artwork derived from the same visual
language as the heraldic icons. They are a deliberate `3:2` exception to the
wide `4:1` item-cover contract below: the race header preserves the intrinsic
ratio within its height limit instead of forcing a panoramic crop.

- Store an opaque `1536×1024` JPEG at quality 88 without text, frames, badges,
  logos or watermarks.
- Choose the character count and broad pose from the ancestry's data and
  defining traits. Render polished flat-cartoon game art with thick deep-plum
  contours, broad shapes and restrained two-step shading. Do not reuse or
  enlarge the square icon itself.
- Keep the character group near the central 55–65% of the canvas, with air
  above and beside the silhouettes. Use a dark plum/navy, low-detail
  background and leave the lower area calmer so the header overlay remains
  readable.
- Let anatomy and one or two large costume shapes communicate the race. Avoid
  photorealistic skin, painterly noise, micro-detail and busy scenery; props
  are acceptable only when they are part of the defining pose.
- Keep subraces visibly related to their base race while varying palette,
  silhouette and one major costume or hair shape.

### Class cover art direction

Class covers use the same `3:2` paired-character format and flat-cartoon visual
language as race covers, while class identity comes from equipment, posture and
one controlled magical effect rather than ancestry.

- Store an opaque `1536×1024` JPEG at quality 88. Keep exactly two adult class
  representatives in the central 55–65% of the canvas, with breathing room and
  a calm dark lower band for the shared header overlay.
- Choose the broad composition and defining equipment from the class data, then
  simplify them into strong silhouettes: a bard's instruments, a fighter's
  shield and polearm, a wizard's book and staff or an artificer's device and
  gauntlet. Avoid dense collections of tiny props.
- Match the race-cover rendering: thick deep-plum contours, broad graphic
  shapes, expressive stylized faces, restrained two-step shading and a dark
  plum/navy atmospheric background. Use a distinct muted jewel-tone palette
  for each class.
- Magic, spirits and energy are secondary framing shapes. They may establish a
  class motif, but must not obscure faces, replace the character silhouette or
  fill the canvas with particles.
- Do not include text, readable runes, letters, numbers, frames, badges, logos,
  watermarks, photorealistic skin, painterly noise, gore or busy scenery.

Installing a class cover does not replace or delete its compact icon.
Subclasses keep the cover-only fallback contract and show a monogram until a
dedicated cover is assigned.

### Background cover art direction

Backgrounds are regular handbook `item` rows (type 11), not suggests. They use
the generic `item.cover_image_id` relation, so adding artwork requires neither a
background-specific column nor a new storage model.

- Store an opaque `1536×1024` (3:2) JPEG at quality 88. The aspect ratio matches
  the half-width cards in the character-creation wizard and remains usable in a
  future shared item header.
- Show exactly one adult character in a three-quarter portrait, occupying about
  55% of the canvas. Communicate the background with one dominant prop and one
  simple environmental cue: a sailor with rope against a moonlit ship, or a
  sage with a quill beside a quiet library window.
- Reuse the race/class flat-cartoon language: thick deep-plum contours, broad
  readable shapes, expressive faces, restrained two-step shading and a calm
  dark plum/navy vignette. Give each background its own muted jewel-tone
  palette.
- Keep the silhouette legible in a half-width card. Avoid crowds, collections
  of tiny props, readable documents, text, frames, badges, logos, watermarks,
  photorealistic texture, gore and busy scenery.

Compact background icons remain an independent optional slot; the wizard never
stretches an icon into a cover.

### Bestiary icon art direction

Bestiary icons are **portrait recognition marks**, not miniature versions of
the cover. For creatures with a recognizable head, the silhouette should work
like the heraldic race icons and identify the creature before its internal
details are noticed.

- Show one head in side or three-quarter view with only a short neck. Do not
  include shoulders, torso, limbs, weapons or scenery. Let defining anatomy —
  horns, ears, jaw, beak, eye stalks or tentacles — shape the outer contour.
- In the left-pinned handbook tile, make portrait marks face right, toward the
  identity text. If an otherwise approved final bitmap faces left, mirror that
  bitmap instead of regenerating and changing its design.
- The rule is semantic rather than literally anatomical: a headless construct,
  ooze, swarm or similarly unusual creature may use its smallest distinctive
  complete form instead. It must still be one compact recognition silhouette,
  not a scene.
- Use a thick continuous deep-plum contour, broad flat-cartoon shapes,
  saturated creature-specific fills and restrained two-step shading. Remove
  realistic surface texture, painterly noise, tiny scales and costume detail.
- Center the opaque bounds in a square with even genuine transparent padding.
  Do not add a tile, disc, rune ring, frame, badge, cast shadow, glow,
  particles, text, logo or watermark.
- Store a lossless `128×128` RGBA PNG or WebP and inspect it at both 128 and
  the production display size of `64×64`. The silhouette, face direction and
  defining anatomy must remain clear at the smaller size.

A creature family may share one identical recognition mark when its variants
have the same defining anatomy. Source duplicates and age or rank variants do
not require separate icons by themselves. Split the family when a variant
changes the outer contour or would be misidentified by the shared mark; color
alone is not enough reason to split or merge it. Covers remain unique to the
item and may communicate mechanics, habitat and rank independently.

### Bestiary cover art direction

Bestiary covers use a taller **4:3** composition because the shared header also
contains the creature's complete combat summary. Newly generated covers are
independent from the compact creature icon; legacy imported artwork occupies
the same cover slot even when its intrinsic aspect ratio differs.

- Store an opaque `1536×1152` JPEG at quality 88, normally no more than 500 KB.
  Do not use alpha for the full-bleed scene.
- Show one main creature unless plurality is essential to the stat block. Keep
  its recognizable silhouette, face and defining anatomy inside the central
  40–50% safe zone; the outer sides must remain expendable for narrow-screen
  `object-fit: cover` crops.
- Use the same polished flat-cartoon fantasy language as the creature icon:
  thick deep-plum contours, broad graphic shapes, restrained two-step shading
  and a controlled jewel-tone palette. Add enough environmental context to
  communicate habitat, but avoid photorealism, painterly noise and micro-detail.
- Preserve meaningful vertical space above and below the creature. Keep the
  areas behind the compact title scrim and translucent combat-stat blocks calm
  enough for readable UI without globally darkening the artwork.
- Do not bake in text, letters, numbers, readable runes, UI, frames, badges,
  logos or watermarks. Avoid gore and keep important anatomy away from every
  edge.
- Inspect at the desktop `440px` minimum header and at a `390px` mobile
  viewport. The mobile layout may crop the outer sides, but the subject and all
  defining features must remain readable between and behind the local blocks.
  Legacy portrait artwork is displayed through an image-driven viewport no
  taller than 1:1; `object-fit: cover` crops its vertical excess. The combat
  summary may still increase the header beyond that preferred image geometry
  rather than being clipped.

### Item cover art direction

General item and spell covers are atmospheric wide illustrations for the shared
detail header, not enlarged icons. The icon remains the compact identity mark;
a cover adds setting, energy and color while preserving readable UI overlay
space. Bestiary covers are the explicit 4:3 exception defined above.

- Store an opaque lossy WebP at exactly `1536×384` (4:1), normally no more
  than 350 KB. Do not use alpha for a full-bleed scene.
- Keep the dominant motif inside the central 50–60% safe zone. Both outer
  edges must be expendable so responsive `object-fit: cover; object-position:
  center` crops remain meaningful.
- Use polished stylized fantasy key art: broad graphic painterly shapes,
  confident contours and restrained detail. It should be richer than the rune
  while sharing its palette and semantic motif; avoid photorealism.
- Reserve a calmer, darker lower band for the title and controls. Do not bake
  in text, letters, numbers, logos, watermarks, borders, badges or UI frames.
- Inspect the final asset at 4:1 on desktop and mobile. Only the spell header
  reserves 4:1 before the file loads; other item types use their intrinsic ratio
  unless their own profile declares one. There is no shared maximum height.
  Cover minimum height is configured per handbook type rather than imposed globally.
  The bestiary profile has a `440px` minimum and may grow to fit its combat
  summary through the ability-modifier row; its art remains undimmed while the
  title and summary use local translucent blocks. Detail content remains
  reachable in the vertically scrollable panel. Decorative covers use empty
  alt text because the item name already labels the header.
