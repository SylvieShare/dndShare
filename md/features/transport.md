# Transport handbook

Transport is item type `13`. The PHB 2014 catalogue contains 26 system rows:
eight mounts, seven pieces of tack, five land vehicles and six water vehicles.
The catalogue is also part of the character-creation starting shop.

## Data contract

All transport keeps the shared `desc`, `cost`, `weight` and
`available_in_starting_shop` fields. Mechanics use structured values rather
than localized display strings:

- `category` is `mount`, `tack`, `land_vehicle` or `water_vehicle`;
- `movement` stores `{value, unit, mode}`, where units are `feet` or
  `miles_per_hour` and modes are `ground`, `water` or `air`;
- `propulsion` is `self`, `drawn`, `sail`, `oar` or `sail_or_oar`;
- `capacity` may contain `carrying_lb`, `crew`, `passengers`, `cargo_lb` and
  `cargo_tons`;
- a mount links to its canonical bestiary record through `creature_item_id`,
  so its stat block is not copied into the transport row;
- tack uses `tack_kind`. Military and exotic saddles additionally expose
  `rider_stability_advantage` and `for_exotic_mount` rule flags;
- optional `vehicle_stats {ac, hp, damage_threshold}` are reserved for sources
  that actually provide vehicle combat rules.

Unknown crew, passenger and combat values stay absent. The startup migration
converts former localized `speed` and `carrying_capacity` values and links all
eight PHB mounts to their bestiary entries. UI code consumes only the current
contract.

## Presentation

Transport has a specialized list row and detail view. The row shows the compact
image, movement or weight metric, category/propulsion subtitle and price. The
detail header uses a `3:2` cover with a `400px` desktop minimum: category and
primary metric sit on the left, cost and weight on the right, while movement,
capacity and the bestiary/tack/propulsion relation form the bottom rail. The
center stays clear for the subject. Description, operating rules and optional
vehicle combat statistics render below the image.

## Image contract

Every system transport row owns a unique icon and cover pair.

- Icons are lossless `128×128` RGBA WebP assets and are checked at the `64px`
  display size. Mount icons are head-and-short-neck portraits in three-quarter
  profile and always look to the right, toward the item text. Tack, vehicles and
  ships use one compact silhouette of the object itself. Empty space is genuine
  alpha; there is no tile, frame, scenery, cast shadow, text or watermark.
- Covers are opaque `1536×1024` JPEG assets (`3:2`). The complete subject is
  centered in a quiet contextual scene, with darker low-detail space at both
  sides for the header stat blocks. Mounts have no rider; vehicles have no
  draft animals or crew; ships have no crew, flags, emblems or text.
- The shared art direction is polished flat-cartoon fantasy handbook art:
  thick deep-plum outlines, broad graphic shapes, jewel-tone accents and
  restrained two-step cel shading. Painterly realism and micro-detail are
  excluded.

Generate at a larger size, trim and center transparent icon bounds with a common
safe margin, then downsample. Install system images only through MCP
`handbook_item_set_system_image`; generated binaries never enter the repository.
