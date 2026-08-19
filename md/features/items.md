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
- all handbook object rows share `ObjectListItem.vue`: a 64 px icon well is pinned to
  the left edge, followed by an optional metric such as spell level or monster
  CR, a two-line identity block and trailing metadata. Raster artwork fills the
  icon well on desktop and mobile; compact SVG/type, potion-vial and feat-sigil
  fallbacks stay centered in the same geometry;
- handbook search, schema filters and publication-source filters live in the
  fixed control area at the top of the list column, above its independently
  scrolling rows. Text search matches a case-insensitive substring of either
  the Russian name or `nameEn`; publication codes remain in the dedicated
  source filter. The main catalogue and item pickers reuse this placement.
  Bestiary schema filters cover creature type, size, environment, legendary
  status, named-NPC status and CR; the finite CR list is stored in schema
  metadata so the filter control is available before any dictionary request;
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
- field labels and errors use shared form components;
- direct color literals are rejected by `npm run check:colors`.

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

The production asset is a lossless `128×128` RGBA WebP with genuine alpha and
clean antialiased edges. Generate at a larger size, extract the background,
center the opaque bounds with a common safe margin and downsample with a
high-quality filter. Inspect every result at 128 and 64 px. The manual
legacy/bootstrap `cmd/spell-rune-sync` can upload the files from
`internal/spellimages` to stable
`system-spell-runes/v1/` S3 keys and registers them in `storage_image`; neither
the main binary nor frontend static assets contain the WebP files.
This manifest remains the bootstrap for its existing set. New system icons are
installed through MCP `handbook_item_set_system_image(slot="icon")`; they use
content-addressed `system-item-media/v1/` keys and do not need to be committed
to the repository.

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

The initial semantic motifs are:

- **Fireball:** a red-orange central flame inside four plum-and-amber sigil
  segments and four outward energy points.
- **Bless:** an ivory-gold four-point sacred spark with three ascending rays
  and warm-gold sigil segments.
- **Aura of Vitality:** an emerald heart-leaf crossed by a golden pulse, with
  turquoise sigil segments and three life leaves.
- **Circle of Scarlet:** a pale-rose core enclosed by a segmented crimson ring
  and four diamond thorns, without literal blood or gore.

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

The production asset is a lossless `128×128` RGBA WebP with the opaque bounds
centered inside a common safe margin. Every file is inspected at both 128 and
64 px on light and dark surfaces. The manual legacy/bootstrap
`cmd/race-icon-sync` verifies the embedded
manifest, uploads all nine base-race and nine subrace busts to stable
`system-race-icons/v1/` keys and assigns them through `item.icon_image_id`.
The larger race illustrations remain independent covers.

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

The production asset is a lossless `128×128` RGBA WebP, inspected at both 128
and 64 px on light and dark surfaces. New class icons are installed through MCP
`handbook_item_set_system_image(slot="icon", preservePrevious=true)`, retaining
the earlier class artwork as a rollback/style-set candidate rather than
shipping another image-sync binary.

The initial semantic motifs are:

- **Bard:** golden lyre with a violet ribbon-like sound accent;
- **Barbarian:** chipped double-headed axe with a crimson war-mark;
- **Fighter:** steel closed helm with one restrained sword accent;
- **Wizard:** open indigo spellbook carrying a cyan arcane star;
- **Druid:** emerald oak leaf beneath a compact antler crown;
- **Cleric:** ivory-gold reliquary sun with a radiant center;
- **Artificer:** brass gear holding a bright blue power crystal;
- **Warlock:** violet occult eye held by an obsidian clawed crescent;
- **Magus:** slender steel sword crossed by a blue-violet spell flare;
- **Monk:** wrapped amber fist enclosed by a simple prayer-bead arc;
- **Paladin:** ivory tower shield bearing a warm golden sun;
- **Rogue:** narrow silver dagger passing through a dark split mask;
- **Ranger:** green longbow with one arrow and a pine-sprig accent;
- **Sorcerer:** crimson innate-magic crystal wrapped in a living flame;
- **Shaman:** turquoise ritual mask with three broad spirit feathers.

### Race cover art direction

Race covers are portrait-oriented detail artwork derived from the same visual
language as the heraldic icons. They are a deliberate `3:2` exception to the
wide `4:1` item-cover contract below: the race header preserves the intrinsic
ratio within its height limit instead of forcing a panoramic crop.

- Store an opaque `1536×1024` JPEG without text, frames, badges, logos or
  watermarks. The current generated set uses JPEG quality 88.
- Preserve the recognizable ancestry, number of characters and broad pose of
  the corresponding legacy cover, but redraw it as polished flat-cartoon game
  art with thick deep-plum contours, broad shapes and restrained two-step
  shading. Do not reuse or enlarge the square icon itself.
- Keep the character group near the central 55–65% of the canvas, with air
  above and beside the silhouettes. Use a dark plum/navy, low-detail
  background and leave the lower area calmer so the header overlay remains
  readable.
- Let anatomy and one or two large costume shapes communicate the race. Avoid
  photorealistic skin, painterly noise, micro-detail and busy scenery; props
  are acceptable only when they are part of the defining pose.
- Keep subraces visibly related to their base race while varying palette,
  silhouette and one major costume or hair shape.

The complete set contains nine base races and nine subraces. New covers are
installed through MCP `handbook_item_set_system_image(slot="cover",
preservePrevious=true)`. The earlier realistic `system-race-images/v1/`
objects and their active `storage_image` rows are intentionally retained for
rollback or a future selectable style; they are not bundled into the main
application binary.

### Class cover art direction

Class covers use the same `3:2` paired-character format and flat-cartoon visual
language as race covers, while class identity comes from equipment, posture and
one controlled magical effect rather than ancestry.

- Store an opaque `1536×1024` JPEG at quality 88. Keep exactly two adult class
  representatives in the central 55–65% of the canvas, with breathing room and
  a calm dark lower band for the shared header overlay.
- Preserve the broad composition and defining equipment of the corresponding
  legacy class portrait, but simplify them into strong silhouettes: a bard's
  instruments, a fighter's shield and polearm, a wizard's book and staff or an
  artificer's device and gauntlet. Avoid dense collections of tiny props.
- Match the race-cover rendering: thick deep-plum contours, broad graphic
  shapes, expressive stylized faces, restrained two-step shading and a dark
  plum/navy atmospheric background. Use a distinct muted jewel-tone palette
  for each class.
- Magic, spirits and energy are secondary framing shapes. They may establish a
  class motif, but must not obscure faces, replace the character silhouette or
  fill the canvas with particles.
- Do not include text, readable runes, letters, numbers, frames, badges, logos,
  watermarks, photorealistic skin, painterly noise, gore or busy scenery.

The production set covers all fifteen base classes. It is installed through
MCP `handbook_item_set_system_image(slot="cover", preservePrevious=true)` and
uses content-addressed `system-item-media/v1/` objects. Existing realistic
`system-class-images/v1/` rows remain active as rollback candidates, while the
new heraldic `system-item-media/v1/` emblem remains assigned to
`item.icon_image_id`; installing a class cover does not replace or delete that
icon. Subclasses keep the cover-only fallback contract and show a monogram
until a dedicated cover is assigned.

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

The production set covers all thirteen built-in backgrounds. Covers are
installed through MCP
`handbook_item_set_system_image(slot="cover", preservePrevious=true)` and use
content-addressed `system-item-media/v1/` objects. Compact icons remain an
independent optional slot; the wizard never stretches an icon into a cover.

### Bestiary icon art direction

Bestiary icons are **portrait recognition marks**, not miniature versions of
the cover. For creatures with a recognizable head, the silhouette should work
like the heraldic race icons and identify the creature before its internal
details are noticed.

- Show one head in side or three-quarter view with only a short neck. Do not
  include shoulders, torso, limbs, weapons or scenery. Let defining anatomy —
  horns, ears, jaw, beak, eye stalks or tentacles — shape the outer contour.
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

New generated icons are installed through MCP
`handbook_item_set_system_image(slot="icon", preservePrevious=true)`. **Kobold**
is the first production example of the head-and-short-neck rule; its swept
horns, long reptilian muzzle and cheek frill carry the identity without a body
or weapon. A creature family may deliberately reuse one identical icon across
all mechanical variants while giving every entry a unique cover. All twelve
kobold rows, including alternate-source duplicates, the winged kobold and the
vampire spawn, use the same kobold portrait mark.

The six-row lizardfolk family is the second production example of this rule.
**Lizardfolk**, **Lizardfolk Commoner**, **Lizardfolk Scaleshield**,
**Lizardfolk Shaman**, **Lizardfolk Subchief** and **Lizardfolk Render** share
one olive-green, broad crocodilian head icon. The low swept-back ridge, amber
eye and pale throat distinguish it from the smaller horned kobold mark at
`64×64`.

**Злобоглаз / Beholder** is the production example of the complete-form
exception for unusual anatomy. Its compact wine-purple orb keeps exactly ten
separated eyestalks plus one dominant central eye; the silhouette must remain
distinct from the four-stalk **Наблюдатель / Spectator** at `64×64`.

The five-row cult family uses one hooded human portrait mark: a pointed
burgundy hood, plain antique-gold half-mask and short wrapped neck remain
recognizable at `64×64`. **Cultist**, **Occult Initiate**, **Occult
Extollant**, **Occult Silvertongue** and **Cult Fanatic** deliberately share
this icon while their covers communicate rank and mechanics independently.

Existing imported bestiary artwork is not treated as a compact icon: for every
system creature still using an importer-owned image it is migrated from
`icon_image_id` to `cover_image_id` through MCP
`handbook_bestiary_migrate_icons_to_covers`. The migration reuses the same S3
object, never overwrites an existing cover and clears the old icon relation.
Creatures without imported artwork remain on the item-type fallback. The
kobold, lizardfolk and cult families are unaffected because their intentional
shared icons are generated item icons rather than importer-owned artwork.

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

New generated covers are installed through MCP
`handbook_item_set_system_image(slot="cover", preservePrevious=true)`, which
keeps the previous imported/generated asset available for rollback. **Kobold**
is the first production cover using this `1536×1152` contract. The complete
twelve-row kobold family is the first finished bestiary set: every row keeps
the shared portrait icon and has its own mechanics-specific 4:3 cover.
The lizardfolk family follows the same model across all six rows: commoner,
club-and-spiked-shield warrior, armored scaleshield, swamp-magic shaman,
fang-dagger subchief and hulking render each have a unique scene and silhouette.
All six covers use the `1536×1152` JPEG contract and were installed through
MCP with `preservePrevious=true` so imported predecessors remain recoverable.
The Beholder cover uses the same contract: one complete ten-stalk subject above
an Underdark pit, a restrained central antimagic cone and no more than two eye
rays. Its former imported cover is retained through `preservePrevious=true`.
The five cult-family covers follow the same contract: guard, novice, forbidden
scholar, charismatic leader and fanatic each receive a distinct single-person
scene while retaining the shared hood-and-mask identity. Replaced imported
covers remain recoverable through `preservePrevious=true`.

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

The initial spell covers are **Fireball**, **Bless** and **Aura of Vitality**.
The manual legacy/bootstrap `cmd/item-cover-sync` verifies the embedded
manifest and uploads them to stable
`system-item-covers/v1/spells/` keys and assigns the resulting
`storage_image(type='item_cover')` rows through `item.cover_image_id`.
This manifest remains their reproducible bootstrap. New covers are installed
through MCP `handbook_item_set_system_image(slot="cover")`; the MCP path keeps
the same independent `cover_image_id` model without adding assets to Git.
