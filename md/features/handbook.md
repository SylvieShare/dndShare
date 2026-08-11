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

## Current field contracts

- race/class features bind only with `race_ids`, `subrace_ids`, `class_ids`,
  `subclass_ids` arrays of handbook item ids;
- spells bind through `classes: [{id: classItemId}]`;
- feats use `description`, `prerequisite_groups`, `choices`, repeatable/grant
  metadata;
- `int_by_suggest` stores `{value,suggest_id}`;
- rich descriptions use their single schema key and render through
  `RichContent`;
- parent/child identity uses item ids, not suggest ids.

Startup SQL converts former single bindings, spell suggest ids, alternate feat
keys and scalar costs before serving traffic. Runtime code does not union old
and new fields, and there are no admin jobs for those migrations.

## UI

`ViewHandbook` loads item types and collections. Search/filter happens through
the item API before pagination. The publication filter has its own toolbar
button for every collection, is passed as `contentSourceIds`, and its selected
ids persist in browser local storage. Schema filter groups without available
options are not shown. `ItemEditModal` is schema-driven and uses shared form primitives; its
create title uses the current item type name. `components/ItemPickerModal.vue`
is the standard server-backed picker used by the character wizard/editor;
`components/ItemViewModal.vue` is the standard detail window. Both belong to
the handbook feature because they compose handbook API, stores and renderers.

Details are specialized by type where useful (weapon, spell, enemy, potion,
feat), otherwise the generic field renderer is used. Item detail modals use
`ItemViewModal` and fixed-chrome `AppModalFrame`; the standalone detail renderer
keeps its own title, while the modal moves that title into the fixed header.
Spell detail owns its canonical publication label, so the wrapper does not
render a duplicate source chip for spells; other item types retain the wrapper
source chip when no specialized publication label exists.
Feature-specific mutations are passed into the fixed footer through the
`actions` slot. Descriptions use the shared rich renderer.

## Schemas

Human-readable item-type schemas live in `resources/items/item_N_shema.json`.
`internal/store/schema/02_handbook.sql` seeds/extends the corresponding DB
fields idempotently. When changing a field, update both representations and
migrate stored `item.data` before deleting the old key.

Important types include weapons (1), items (2), race/class abilities (3/4),
spells (5), bestiary (6), feats (7), races/classes (8/9), potions (10) and
backgrounds (11).

## MCP

Handbook MCP read/write tools mirror the current HTTP/store model. Create/update
must use current field names and item ids. There are no aliases for historical
field names. See `md/features/mcp.md`.
