# Database & Migrations

> **Порт на Go.** Бэкенд переписан на Go (`internal/`), см. корневой `CLAUDE.md`. Схема БД теперь
> накатывается идемпотентно на старте из `internal/store/schema.sql` (консолидированное финальное
> состояние прежних миграций; всё в схеме `dndshare`), **Liquibase больше нет**. Ниже — историческое
> описание Spring-версии (для контекста); структура таблиц актуальна.

The backend (`backend/`, Kotlin 2.3 + Spring Boot 4.0, Java 21, Spring Data JDBC,
Jackson 3) owns the PostgreSQL schema.
Schema changes are managed with **Liquibase**. Do not hand-edit the production
schema — write a changeset.

## Single schema: `dndshare`

All tables live in the `dndshare` schema. There used to be a second `base`
schema (auth/logs/jobs); it was consolidated into `dndshare` (see v2 below) and
dropped. **Never create new objects in `base`.**

## Layout

- Config: `spring.liquibase.change-log: classpath:changelog-master.yaml`
  (`backend/src/main/resources/application.yml`). Liquibase runs on app boot.
- **Dependency (Spring Boot 4 gotcha):** the backend depends on
  `org.springframework.boot:spring-boot-starter-liquibase`, **not** raw
  `org.liquibase:liquibase-core`. Spring Boot 4.0 modularized auto-configuration:
  `LiquibaseAutoConfiguration` lives in the separate `spring-boot-liquibase`
  module, pulled in only by that starter. With just `liquibase-core` on the
  classpath, Liquibase **silently does not run** (no log line, no changesets
  applied, no error) — migrations never execute. If a migration "won't apply",
  check the startup log for Liquibase output first; absence = the starter is
  missing.
- Master: `backend/src/main/resources/changelog-master.yaml` — ordered `include`
  list, nothing else.
- Changesets: `backend/src/main/resources/db/changelog/`, **formatted SQL**
  (`--liquibase formatted sql`), split by feature, numeric-prefixed for order.

```
db/changelog/
  v1-baseline/            # snapshot of the schema that already existed in prod
    00-extensions.sql     # schemas + pg_trgm
    01-auth.sql           # users, role, users_role, users_session
    02-logs.sql           # logs
    03-jobs.sql           # job_run
    04-characters.sql     # char_template, template_block_type, char
    05-handbook.sql       # source, svg_storage, storage_image, item(_type), suggest(_type), dictionary_text
    06-music.sql          # music_album/track/tag + link tables
    07-sessions.sql       # session + chapters/scenes/encounters/events/participants/music_state
  v2-schema-consolidation/
    01-move-base-to-dndshare.sql   # ALTER TABLE ... SET SCHEMA, then DROP SCHEMA base
    02-add-indexes.sql             # missing FK-column / hot-query indexes
    03-add-foreign-keys.sql        # FKs that were implied but never declared
  v3-character-creation/
    01-item-parent-id.sql          # item.parent_id (self-FK) for variants/sub-entities
    02-item-types-race-class.sql   # seed item_type 8 (Расы) + 9 (Классы); item-id binding fields on 3/4/5
    03-ability-scaling.sql         # per-level scaling table on race/class abilities (3/4); read last breakpoint ≤ char level
    04-ability-condition.sql       # structured evaluable conditions on abilities (3/4): typed prereq/usage objects
    05-ability-multi-binding.sql   # array binding fields (class_ids/race_ids/…) so one shared feature has several owners
    06-ability-binding-arrays-only.sql # drop single-id binding; arrays-only authoritative 3/4 fields schema
    07-item-type-potion.sql        # seed item_type 10 (Зелья); rendered as vials on the items tab
    08-potion-rarity.sql           # suggest type 23 (Редкость) + rarity field on 10; migrate type-2 potions → 10, derive color
    09-item-svg.sql                # item.svg_id → svg_storage (per-item icon); seed rapier/shortbow/dagger weapon icons
    10-weapon-svgs.sql             # icons for the remaining base weapons (type 1), linked by item id
```

Per-item icons reuse `svg_storage` (the shared SVG-markup table that `item_type.svg_id` already uses): `item.svg_id` references it, and `ItemRepository.getByIds` `LEFT JOIN`s `svg_storage` to return `item.svg` (other item queries leave `svg` null).

Changeset `08-potion-rarity.sql` shows the **type-changing data migration** pattern:
`UPDATE dndshare.item SET type_id = 10, data = data - 'type' WHERE type_id = 2 AND
data->>'type' = 'зелье'` keeps item **ids** (so character inventories, which reference
items by id, keep resolving), then recomputes `item_type.count_items` for both types.
The new suggest dictionary's values are inserted with explicit `(type_id, id)` ids 0–5
that match the legacy integer `data.rarity`, so the rarity values need no remap. A
keyword `CASE` over `data->>'desc'` backfills `data.color`.

## Seed data via changeset (item types)

`item_type` rows (including the per-type `fields` JSON schema) historically lived
in CSV snapshots under `resources/` imported to prod by hand — **not** in
Liquibase. Going forward, seed/alter item types **in a changeset** so it lands on
both prod and fresh dev DBs reproducibly. `v3.../02` is the reference: explicit-id
`INSERT` guarded by a `count(*) = 0` precondition for new types, and
`UPDATE ... SET fields = fields || '[…]'::jsonb` (append only the new fields,
guarded by a `fields @> '[{"key":"…"}]'` containment check) to extend an existing
type's schema idempotently. Keep the matching `resources/items/item_N_shema.json`
file in sync — it is the human-readable source of truth for the type's `fields`.

## `item.parent_id` — generic variant/sub-entity link

`item.parent_id int8 NULL` (self-FK, `ON DELETE SET NULL`, partial index) is the
canonical hierarchy edge between handbook items: **subrace → race**, **subclass →
class**, and any future "variant of" (magic-item variants, monster variants).
Base item ⇔ `parent_id IS NULL`; there is **no separate `kind` discriminator**.
Plumbed through `Item.parentId`, `ItemRepository.create/createBase(..., parentId)`
+ `findChildren(parentId)` + `setParent(id, parentId)`, `GET /api/items/children`,
and the MCP `handbook_item_create/update` `parentId` param.

## Race/Class identity = item-id (not suggest)

Class/race **content** are handbook items (types 9/8). Their **identity** for
binding is the item id. Race/class **abilities** (types 3/4) bind via
`class_id`/`subclass_id` (type 9) and `race_id`/`subrace_id` (type 8) plus
`level` (character level the feature is gained) — stored as plain `int` fields
with an `item_type` hint for a future item-picker field type. **Spells** (type 5)
bind to classes via `classes: [{ id: <classItemId> }]` (`object_array`); the
legacy `classIds` (suggest-id array) is kept until the one-shot
`migrate-spell-classes` admin job (`MigrateSpellClassesJob`) backfills `classes`
by mapping each old suggest id through the class item's `data.suggest_id` bridge.
Run that job **after** class items (type 9) exist for every class a spell
references, or unmapped refs are dropped (the job reports `unmappedClassRefs`).

## Baseline strategy (why it is safe on prod)

The production DB already contained every v1 object. Each baseline changeset is
guarded so it **marks-ran instead of failing** when the object exists:

```sql
--changeset baseline:users
--preconditions onFail:MARK_RAN onError:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT count(*) FROM pg_tables WHERE schemaname = 'base' AND tablename = 'users'
CREATE TABLE base.users ( ... );
```

Result: on prod the baseline is recorded but not executed; on a fresh/dev DB it
actually builds the whole schema. The v2 move changesets are guarded the
opposite way (`expectedResult:1` while still in `base`) so they are idempotent.

## Conventions for new migrations

- Add a **new** formatted-SQL file under `db/changelog/` (feature-named) and a
  new `include` line in `changelog-master.yaml`. Never edit an
  already-applied changeset — Liquibase checksums them.
- One logical change per `--changeset author:id`. Use `IF NOT EXISTS` for
  indexes and a `--precondition-sql-check` on `pg_constraint.conname` for
  constraints to keep reruns idempotent.
- New tables go in `dndshare`. Declare foreign keys explicitly and add an index
  on every FK child column (Postgres does not auto-index them).
- After structural changes, compile the backend (`mvn -pl backend -am compile`).

## Code coupling

Spring Data entities pin the schema via `@Table(schema = "dndshare", ...)`
(`User`, `UserSession`, `LogEntity`); raw SQL in repositories/controllers uses
`dndshare.<table>` literals. If you rename/move a table, update both the
changeset and these references (`AdminPanelController`, `JobRunRepository`,
`UserRoleRepository`, and the `@Table` entities).
