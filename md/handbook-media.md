# Изображения справочника

Установка системных изображений, прозрачность иконок и художественные правила для разных типов справочника. Общий стиль и персонажи описаны отдельно.

## Содержание

- [System media workflow](#system-media-workflow)
- [Simplified inventory icon presets](#simplified-inventory-icon-presets)
- [Character-feature media art direction](#character-feature-media-art-direction)
- [Status-effect icon art direction](#status-effect-icon-art-direction)
- [Static spell rune art direction](#static-spell-rune-art-direction)
- [Race icon art direction](#race-icon-art-direction)
- [Class icon art direction](#class-icon-art-direction)
- [Item identity across icon and cover](#item-identity-across-icon-and-cover)
- [Starting-shop gear art direction](#starting-shop-gear-art-direction)
- [Race cover art direction](#race-cover-art-direction)
- [Class cover art direction](#class-cover-art-direction)
- [Background cover art direction](#background-cover-art-direction)
- [Bestiary icon art direction](#bestiary-icon-art-direction)
- [Bestiary cover art direction](#bestiary-cover-art-direction)
- [Item cover art direction](#item-cover-art-direction)

## System media workflow

- Types 2 («Вещи») and 19 («Магические предметы») share a transparent
  `128×128` lossless WebP mystery-cube icon with a question mark, matching their
  common fallback cover. It is the default for simplified character inventory entries without a selected
  preset; item-level raster icons and SVG retain priority.

- Install new system raster media only through MCP
  `handbook_item_set_system_image` or `handbook_item_type_set_system_image`,
  using `slot="icon"` or `slot="cover"` and `preservePrevious=true` when
  replacing an existing asset.
- Icons and covers are independent `item.icon_image_id` and
  `item.cover_image_id` relations backed by `storage_image`; item types may own
  the same independent slots as collection-wide fallbacks. MCP stores their
  content-addressed objects under `system-item-media/v1/` in S3.
- Fifteen system item types own a production fallback cover. Types 1, 6 and 12
  use opaque `1536×1152` JPEG (`4:3`); types 2, 8, 9, 11, 13, 16 and 17 use opaque
  `1536×1024` JPEG (`3:2`); magic items (type 19) also use `3:2` item covers,
  as in the existing sword catalogue. Types 3, 4, 5, 7 and 10 use opaque `1600×640`
  lossy WebP (`5:2`). Item-level artwork always has priority without changing
  the detail layout.
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

## Simplified inventory icon presets

`item_icon_preset` associates a named raster preset with `item_type_id` and a
`storage_image` row. Ten selectable images cover a pouch, scroll, key, gem, clothing,
blade, shield, vial, hammer and amulet. The Items block offers presets for
its root collection and linked child types. Simplified entries save only
`icon_preset_id`; selection is available on creation and editing, with an explicit
«По умолчанию» choice. Handbook entries retain their own media.

An independent type-2 preset with `purpose=empty_cell` shows an open empty pouch
in all empty backpack cells, including read-only sheets and session inventory.
It never appears among item choices. Both image families use genuine alpha,
lossless 128×128 WebP, a compact silhouette and broad flat-cartoon shading.
Selectable icons keep thick deep-plum contours. The empty pouch uses a uniform
neutral-gray palette, charcoal-gray contours and minimal fold shading, displayed
with reduced opacity. Prompts and final hashes: `md/data/inventory-icon-presets.json`.

Publish through MCP `inventory_icon_preset_set_image`. Images are stored under
`system-item-media/v1/inventory-presets/{typeId}/{code}/icon/{sha256}.webp`;
there are no image binaries or startup media uploads in the repository.

## Character-feature media art direction

Racial abilities (type 3), class features (type 4) and feats (type 7) use one
shared media contract. The three categories keep distinct semantic motifs, but
their rendering, dimensions and visual weight remain consistent in the same
handbook list and detail header.

- Store the icon as a lossless `128×128` RGBA WebP with genuine alpha and
  inspect it at the production `64×64` size on a dark surface. Build one compact
  action emblem from one dominant object or sign and no more than two large
  supporting accents. Use the established thick deep-plum contour, broad
  flat-cartoon shapes, saturated restrained fills and two-step shading.
- Class-feature icons describe an action, tool or professional technique;
  racial-ability icons describe a defining inherited or anatomical sign plus
  its effect; feat icons describe a learned technique, discipline or piece of
  equipment. Do not turn any of them into a miniature character scene.
- Related records may share one identical icon only when they express the same
  mechanic and the same symbol remains unambiguous. Every record still receives
  its own cover when that cover is in scope. A shared topic or palette alone is
  not enough to reuse an icon.
- Store the cover as an opaque lossy `1600×640` WebP (`5:2`, quality 88). Show a
  concrete moment in which the ability matters rather than enlarging the icon
  or drawing a generic portrait. The detail header contains only the item name
  and source over its own scrim, so the illustration may use the full canvas:
  do not reserve a blank title zone or an empty lower band. Keep the action
  balanced across the panorama and all defining faces, anatomy, tools and
  effects comfortably inside the outer crop.
- Covers follow the mature detailed fantasy illustration contract in
  [Handbook art style](handbook-art-style.md), anchored to Mounted Combatant:
  natural adult proportions, visible deep-plum linework, broad cel-painted
  planes, minimal material texture and a softer simplified background. The compact flat-cartoon treatment above applies to icons,
  not to cover characters. Inspect existing covers in the same category before
  generating; identify style references separately from identity references.
- The icon and cover share the same mechanic and palette but remain independent
  compositions. Do not include text, readable runes, letters, numbers, frames,
  badges, baked-in UI, logos, watermarks or gore.
- Generate at a larger size, crop and downsample to the exact contracts above,
  then install both slots only through MCP `handbook_item_set_system_image`
  with `preservePrevious=true` when replacing an existing asset.

When the recurring DnD Share mascot appears on a cover, her canonical identity,
costume, emotion range and reusable pose references are defined in
[[mascot](mascot.md)](mascot.md). That character contract overrides generic
character-design choices but does not change the `1600×640` cover geometry,
storage workflow or content restrictions above. Build each scene from the item
mechanic and the canonical mascot reference; do not use another finished cover
as an intermediate character reference. Match the mascot and environment at
the same detail density, and choose an expression specific to the scene instead
of repeating the same neutral or stern face.

## Status-effect icon art direction

Status effects (type 15) use compact object emblems that communicate the active
state before their internal detail is noticed. Positive and negative effects
share one rendering family but keep distinct subjects and palettes.

- Store each icon as a lossless `128×128` RGBA WebP with genuine alpha, centred
  opaque bounds and a common safe margin. Inspect it at the production `64×64`
  size on a dark surface before installation.
- Build the silhouette from one dominant object or sign and at most two broad
  supporting accents. Use the established thick deep-plum contour, broad
  flat-cartoon shapes, saturated restrained fills and two-step shading.
- Prefer a literal mechanic-bearing object: a broad consecrated blade for
  Sacred Weapon and a cracked, nearly empty hourglass for Exhaustion. The icon
  must not depend on a miniature scene or character portrait.
- Do not add a background tile, frame, badge, text, letters, numbers, readable
  runes, logo, watermark, cast shadow, detached particle cloud or micro-detail.
  Empty canvas space must be transparent.
- Generate at a larger size, extract the background, centre and downsample to
  the exact contract, then install through `handbook_item_set_system_image` with
  `slot="icon"`; use `preservePrevious=true` when replacing existing artwork.

## Static spell rune art direction

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

## Race icon art direction

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

## Class icon art direction

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

All 15 base class records and 41 subclass records have dedicated system raster
icons. Class/subclass list rows and origin-relation cards use the shared
`ItemIcon` projection (raster first, then SVG), not a cropped cover. The full
emblem stays visible with `object-fit: contain`, without portrait shading or
an overlaid type badge; covers remain independent detail-header artwork.

Subclass icons follow an **inherited-anchor rule**. When the parent has a strong
carrier shape, every sibling keeps it and replaces the dominant internal sign:
wizard schools share the open spellbook, paladin oaths share the tower shield,
cleric domains share the reliquary sun and druid circles share the antler/leaf
language. Other families inherit the parent's contour weight and palette while
using a new specialization silhouette. A subclass must therefore read as part
of its class family and remain distinguishable from every sibling at `64×64`;
it must not be a simple recolor of the base-class emblem.

## Item identity across icon and cover

For all item covers, use the item's icon as an identity reference, not as a
composition to enlarge one-to-one. The cover may show a more complete object,
more carefully resolved construction, richer material detail and a better
viewing angle. Change the camera, lighting, framing and scene when this improves
readability and presentation.

Keep the same object: preserve its construction, proportions, materials, main
colors, distinctive parts, symbols and ornament motifs. Extra detail should
clarify the existing design or reveal a plausible previously unseen surface;
it must not contradict the icon or replace recognizable details with different
ones. Compare the pair before installation. Greater fidelity and a better angle
are welcome; a redesign into a different object is not. The catalogue facts and
each item type's established aspect ratio, style and UI-safe areas still apply.

## Starting-shop gear art direction

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

## Race cover art direction

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

## Class cover art direction

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
Subclass covers remain independent from their compact icons: an absent cover
uses the type's detail-header fallback and does not hide the subclass emblem.

## Background cover art direction

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

## Bestiary icon art direction

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
alone is not enough reason to split or merge it. Search for a reusable related
mark across every handbook type, not only inside the bestiary; the production
queue may still prioritize bestiary records while reusing an exact semantic
match owned by another category. Covers remain unique to the item and may
communicate mechanics, habitat and rank independently.

## Bestiary cover art direction

Bestiary covers use a taller **4:3** composition because the shared header also
contains the creature's complete combat summary. Newly generated covers are
independent from the compact creature icon; legacy imported artwork occupies
the same cover slot even when its intrinsic aspect ratio differs.

- Store an opaque `1536×1152` JPEG at quality 88, normally no more than 500 KB.
  Do not use alpha for the full-bleed scene.
- Show one main creature unless plurality is essential to the stat block. Keep
  its recognizable silhouette, face and defining anatomy inside the central
  40–50% safe zone. Background and secondary atmosphere may continue into the
  outer sides, but the face, defining anatomy and other recognition-critical
  parts must not enter the side combat-stat columns. Those outer regions must
  remain expendable for narrow-screen `object-fit: cover` crops.
- Use the same polished flat-cartoon fantasy language as the creature icon:
  thick deep-plum contours, broad graphic shapes, restrained two-step shading
  and a controlled jewel-tone palette. Add enough environmental context to
  communicate habitat, but avoid photorealism, painterly noise and micro-detail.
- Do not reserve an empty lower third. Let the creature normally occupy about
  70–85% of the cover height, and allow scenery plus non-critical lower anatomy
  (feet, tail tips or wing edges) to continue behind the translucent ability
  strip. The artwork must remain fully composed down to the bottom edge: only
  the lowest 8–12% may be visually calmer, and it must still contain background,
  ground or secondary silhouette detail rather than empty space. The face and
  recognition-critical anatomy must stay clear of the bottom and side stat
  blocks.
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

## Item cover art direction

General item and spell covers are atmospheric wide illustrations for the shared
detail header, not enlarged icons. The icon remains the compact identity mark;
a cover adds setting, energy and color while preserving readable UI overlay
space. Bestiary covers are the explicit 4:3 exception defined above.

Collection-specific profiles above take priority over the panoramic export
below. Magic items (type 19) use opaque `1536×1024` JPEG covers (`3:2`, quality
88), matching the sword catalogue; keep the same central safe zone and quiet
lower area. «Меч мести» is recorded in
`md/data/magic-items/sword-of-vengeance-media.json` with prompts and media hashes.

- Store an opaque lossy WebP at exactly `1600×640` (5:2), normally no more
  than 350 KB. Do not use alpha for a full-bleed scene.
- Keep the dominant motif inside the central 50–60% safe zone. Both outer
  edges must be expendable so responsive `object-fit: cover; object-position:
  center` crops remain meaningful.
- Use polished stylized fantasy key art: broad graphic painterly shapes,
  confident contours and restrained detail. It should be richer than the rune
  while sharing its palette and semantic motif; avoid photorealism.
- Reserve a calmer, darker lower band for the title and controls. Do not bake
  in text, letters, numbers, logos, watermarks, borders, badges or UI frames.
- Inspect the final asset at 5:2 on desktop and mobile. Only the spell header
  reserves 5:2 before the file loads; other item types use their intrinsic ratio
  unless their own profile declares one. There is no shared maximum height.
  Cover minimum height is configured per handbook type rather than imposed globally.
  The bestiary profile has a `440px` minimum and may grow to fit its combat
  summary through the ability-modifier row; its art remains undimmed while the
  title and summary use local translucent blocks. Detail content remains
  reachable in the vertically scrollable panel. Decorative covers use empty
  alt text because the item name already labels the header.

## Связанные страницы

[Оглавление wiki](README.md) · [Стиль иллюстраций справочника](handbook-art-style.md) · [Маскоты DnD Share](mascot.md) · [Справочные записи: UI и схемы](features/items.md) · [MCP endpoint](features/mcp.md)
