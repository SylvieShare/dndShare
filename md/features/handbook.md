# Handbook

Frontend lives in `features/handbook`, item details/editors in
`features/items`, shared API in `shared/api/itemsApi.js`. Backend routes are in
`internal/web/items.go` and `suggests.go`; data access is in `internal/store`.

## Model

- `source` — game system.
- `source_version` — concrete rules edition.
- `content_source` — publication/book.
- `custom_item_source` — user-owned provenance for custom handbook content;
  it is not a game system or publication.
- `item_type` — item category and fields schema.
- `item` — handbook entity.
- `suggest_type/suggest` — dictionaries used by fields.

`item.parentId` is the generic hierarchy edge: subrace→race,
subclass→class and future variants. Items may link to several publications via
`contentSourceIds`. A user item additionally has an explicit `customSourceId`;
the server assigns the owner's default «Мои материалы» source atomically on
creation. The schema allows more non-default personal sources later.

Item icons are metadata outside rules JSON. `item.svg` is the API projection of
`item.icon_svg_id → svg_storage.data`; raster icons use
`item.iconImageId/iconImageUrl` from `item.icon_image_id → storage_image/S3`.
The database allows at most one format. All item reads, including paged lists
and multi-type search, return the assigned projection.
Bestiary artwork follows the same contract: the import job downloads the
upstream file, writes it under the stable `bestiary/v1/<slug>` key in our S3 and
registers that key/URL in a system `storage_image` row. Imported artwork is
served through `cover_image_id`; the compact icon slot is reserved for explicit
portrait marks such as the shared kobold-family icon. External CDN URLs are
never served by the application and artwork is never stored in `item.data`.
The importer also resolves the upstream book code/name to `content_source` and
replaces the creature's `item_content_source` link on every import. Startup SQL
backfills the same relation for creatures imported before this contract, so the
handbook publication filter is server-backed for bestiary entries as well.
Publication identity is the trimmed, uppercase code within one game system and
edition. Startup SQL merges case-only duplicates, preserves their item links and
normalizes the D&D 5e spell/bestiary catalogue to one Russian display name per
known code; `DMG` and `DMF5E` remain separate because they identify different
books. Repeated bestiary imports refresh the display name from upstream metadata.
The manual idempotent `cmd/bestiary-image-sync` migration copies only legacy
bestiary rows without an object key, so later runs are no-ops. If
an upstream file is already unavailable, its dead URL and item association are
removed and the item falls back to the type icon.

Saved user items are backfilled to that source during startup. Personal source
ids are never stored or read in `item.data`, and item/suggest id reads expose
only base rows plus the current user's own rows.

## Publication scope

Character settings store publication selection and whether content with the
edition status `legacy` is shown. Catalogue calls carry `sourceVersionId`,
selected `contentSourceIds` and `allowLegacy`. The word Legacy here describes a
rules-edition content status; it is unrelated to old application data/API.

`GET /api/sources` exposes only `versions[]`; `GET /api/content-sources`
evaluates native/compatible/legacy/blocked status for a target edition.
Глобальный multi-type поиск также передаёт `sourceVersionId`, поэтому исключает
публикации, заблокированные для выбранной редакции.

## Current field contracts

- race/class features bind only with `race_ids`, `subrace_ids`, `class_ids`,
  `subclass_ids` arrays of handbook item ids;
- spells bind through `classes: [{id: classItemId}]`;
- feats use `description`, `prerequisite_groups`, `choices`, repeatable/grant
  metadata;
- `int_by_suggest` stores `{value,suggest_id}`;
- rich descriptions use their single schema key and render through the DnD
  `RichContent` adapter, which resolves dice/item/suggest inline nodes;
- parent/child identity uses item ids, not suggest ids.

Startup SQL converts former single bindings, spell suggest ids, alternate feat
keys and scalar costs before serving traffic. Runtime code does not union old
and new fields, and there are no admin jobs for those migrations.

## UI

`ViewHandbook` loads item types and collections. Search/filter happens through
the item API before pagination. The publication filter has its own toolbar
button for every collection, is passed as `contentSourceIds`, and its selected
ids persist in browser local storage. The landing and collection workspace use
an opaque `--bg` canvas so the global page grid does not show through; list
rows use the opaque `--surface` level with distinct active and selected states.
При первом открытии landing выбирает систему и редакцию из глобального игрового
контекста. Переключение на landing локально для справочника: оно сохраняется при
переходе в коллекцию и обратно, передаётся как `sourceVersionId`, но не изменяет
профиль игрока и ссылку «Правила».
Schema filter groups without available
options are not shown. `ItemEditModal` is schema-driven and uses shared form primitives; its
create title uses the current item type name. The spell form also accepts a
transparent PNG/WebP icon on create or edit; upload is committed after the item
has an id. `components/ItemPickerModal.vue`
is the standard server-backed picker used by the character wizard/editor;
`components/ItemViewModal.vue` is the standard detail window. Both belong to
the handbook feature because they compose handbook API, stores and renderers.
The picker reuses `HandbookCollectionBar` and `HandbookItemList`, so it exposes
the same nested schema filters, publication filter and nested grouping controls
as the full collection page. Grouped picker results also load every server page
before client-side grouping.
On phones the picker keeps the result list as its own vertical scroll container,
so list swipes are handled before the surrounding dismissible sheet gesture.
On phone layouts the collection search occupies its own full-width toolbar row,
so grouping and filter controls cannot compress the input. An open item replaces
the collection/search chrome; the common mobile-header back button and a deliberate
right swipe both return to the list through the same query-navigation path. The
handbook has no duplicate back bar inside its content. Vertical scrolling
and gestures started on interactive controls remain untouched.
The outer handbook and centered page wrappers stay transparent so the shared
application canvas dot pattern remains visible around the opaque navigation,
list and detail surfaces. Handbook workspaces fill the available viewport below
the mobile application header; on desktop they extend to the bottom because the
application header is replaced by the sidebar.

Collection search is explicitly labelled as handbook search. Grouping controls
live immediately above the result list, not beside the search field. Enabling a
group loads every server page before grouping so no item disappears at a page
boundary; every group starts collapsed. Missing environment values use the
explicit `Среда не указана` group. Bestiary filters include creature type,
size, alignment and environment; spells can be filtered by class item id.
Creature UI calls CR `Уровень опасности`, explains it for new players and uses
semantic icons for AC, HP, proficiency and each movement type.

Details are specialized by type where useful (weapon, spell, enemy, potion,
feat), otherwise the generic field renderer is used. Item detail modals use
`ItemViewModal` and fixed-chrome `AppModalFrame`; the standalone detail renderer
keeps its own title, while the modal moves that title into the fixed header.
An assigned raster or SVG item icon is shown in list rows, standard pickers,
the global header search and detail/modal headings; raster has priority and the
item-type SVG is only a list fallback. Spell rows on character sheets show the
raster spell icon when assigned and otherwise keep the school symbol.
Spell detail owns its canonical publication label, so the wrapper does not
render a duplicate source chip for spells; other item types retain the wrapper
source chip when no specialized publication label exists.
Feature-specific mutations are passed into the fixed footer through the
`actions` slot. Descriptions use the shared rich renderer.
Bestiary detail sections use the illustrated `DetailSection` heading: a
semantic Lucide icon in a compact accent frame, a high-contrast uppercase label
and a fading divider. Combat actions use the same hierarchy with a restrained
danger/accent tone so the block can be found quickly without competing with
the action cards themselves. Names inside feature/action/reaction cards use a
larger medium-bold UI face, restrained light-gray color and a thin accent marker;
action markers inherit the combat tone while prose remains in the rich-content
typography.

### Related player rules

The public task-oriented player guide is a separate top-level section at
`/rules`, not a handbook child. The two features share only deliberate domain
data: short reusable combat actions live in suggest type 24, and the rules view
filters that dictionary to system-owned canonical codes. See
`md/features/player-rules.md` for the content, search, routing, licensing and
visual contracts.

## Schemas

Human-readable item-type schemas live in `resources/items/item_N_shema.json`.
`internal/store/schema/02_handbook.sql` seeds/extends the corresponding DB
fields idempotently. When changing a field, update both representations and
migrate stored `item.data` before deleting the old key.

Important types include weapons (1), items (2), race/class abilities (3/4),
spells (5), bestiary (6), feats (7), races/classes (8/9), potions (10),
backgrounds (11), armor (12) and transport (13).

Mundane armor and shields belong to type 12 and keep the structured
`armor {ac,use_dex,dex_cap,shield,shield_bonus}` rule consumed by character
creation and the sheet. Type 2 is ordinary adventuring gear, equipment packs
and tools; magical armor remains a magic item rather than being moved by name.
Transport type 13 stores the book's speed/carrying capacity when a meaningful
item weight is not supplied. The PHB 2014 starting-shop catalogue and audit
rules are documented in `md/features/starting-shop.md`.

## MCP

Handbook MCP read/write tools mirror the current HTTP/store model. Create/update
must use current field names and item ids. There are no aliases for historical
field names. See `md/features/mcp.md`.
