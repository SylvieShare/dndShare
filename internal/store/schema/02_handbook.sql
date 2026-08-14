-- Handbook: sources, svg + image storage, item types, items, suggests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare."source" (
    id          bigserial NOT NULL,
    "name"      varchar NOT NULL,
    count_items int8 DEFAULT 0 NOT NULL,
    CONSTRAINT newtable_pk PRIMARY KEY (id)
);

-- Registered game systems are application data, not deployment-specific seed
-- files. Keep a clean database usable by the same code registry as production.
INSERT INTO dndshare."source" ("name")
SELECT seed.name
FROM (VALUES ('DND5e'), ('Vampire: TM')) AS seed(name)
WHERE NOT EXISTS (
    SELECT 1 FROM dndshare."source" current
    WHERE lower(current.name) = lower(seed.name)
);

CREATE TABLE IF NOT EXISTS dndshare.source_version (
    id        bigserial NOT NULL,
    source_id int8 NOT NULL REFERENCES dndshare."source"(id),
    "version" varchar NOT NULL,
    CONSTRAINT source_version_pk PRIMARY KEY (id),
    CONSTRAINT source_version_source_id_version_key UNIQUE (source_id, "version")
);
CREATE INDEX IF NOT EXISTS idx_source_version_source_id ON dndshare.source_version USING btree (source_id);

INSERT INTO dndshare.source_version (source_id, "version")
SELECT src.id, seed.version
FROM (VALUES ('DND5e', '2014'), ('Vampire: TM', 'V20')) AS seed(source_name, version)
JOIN dndshare."source" src ON lower(src.name) = lower(seed.source_name)
ON CONFLICT (source_id, "version") DO NOTHING;

-- One-time normalization from the old one-version-per-source model.
ALTER TABLE dndshare."source" ADD COLUMN IF NOT EXISTS "version" varchar NULL;
INSERT INTO dndshare.source_version (source_id, "version")
SELECT id, "version"
FROM dndshare."source"
WHERE "version" IS NOT NULL AND btrim("version") <> ''
ON CONFLICT (source_id, "version") DO NOTHING;
ALTER TABLE dndshare."source" DROP COLUMN IF EXISTS "version";

-- Publications / content packs are separate from the game system and its rules
-- edition. A 2014 book can be compatible with a 2024 character, so the native
-- edition is metadata rather than an ownership boundary.
CREATE TABLE IF NOT EXISTS dndshare.content_source (
    id                       bigserial NOT NULL,
    source_id                int8 NOT NULL REFERENCES dndshare."source"(id),
    native_source_version_id int8 NULL REFERENCES dndshare.source_version(id),
    "name"                   varchar NOT NULL,
    code                     varchar NOT NULL,
    description              text NULL,
    kind                     varchar DEFAULT 'addon' NOT NULL,
    is_default               bool DEFAULT false NOT NULL,
    sort_order               int4 DEFAULT 0 NOT NULL,
    CONSTRAINT content_source_pk PRIMARY KEY (id),
    CONSTRAINT content_source_kind_check CHECK (kind IN ('base', 'addon', 'third_party'))
);
-- The same publication code may exist in multiple editions (PHB 2014 and PHB
-- 2024). COALESCE also keeps edition-neutral packs unique within a system.
ALTER TABLE dndshare.content_source DROP CONSTRAINT IF EXISTS content_source_source_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS content_source_system_edition_code_key
    ON dndshare.content_source (source_id, COALESCE(native_source_version_id, 0), code);
CREATE INDEX IF NOT EXISTS idx_content_source_source_id ON dndshare.content_source USING btree (source_id, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_content_source_native_version ON dndshare.content_source USING btree (native_source_version_id);

-- Temporary lookup used only while normalizing the former suggest-backed sources.
ALTER TABLE dndshare.content_source ADD COLUMN IF NOT EXISTS legacy_suggest_id int8 NULL;

CREATE TABLE IF NOT EXISTS dndshare.content_source_compatibility (
    content_source_id int8 NOT NULL REFERENCES dndshare.content_source(id) ON DELETE CASCADE,
    source_version_id int8 NOT NULL REFERENCES dndshare.source_version(id) ON DELETE CASCADE,
    status            varchar NOT NULL,
    CONSTRAINT content_source_compatibility_pk PRIMARY KEY (content_source_id, source_version_id),
    CONSTRAINT content_source_compatibility_status_check CHECK (status IN ('native', 'compatible', 'legacy', 'blocked'))
);
CREATE INDEX IF NOT EXISTS idx_content_source_compatibility_version ON dndshare.content_source_compatibility USING btree (source_version_id, status);

CREATE TABLE IF NOT EXISTS dndshare.svg_storage (
    id     bigserial NOT NULL,
    "data" text NOT NULL,
    CONSTRAINT svg_storage_pk PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dndshare.storage_image (
    id         bigserial NOT NULL,
    user_id    int8 NULL REFERENCES dndshare.users(id),
    bytes      bytea NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    "key"      varchar NULL,
    deleted    bool DEFAULT false NOT NULL,
    url        varchar NULL,
    "type"     varchar NULL,
    CONSTRAINT storage_image_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_storage_image_user_id ON dndshare.storage_image USING btree (user_id);

CREATE TABLE IF NOT EXISTS dndshare.item_type (
    id          bigserial NOT NULL,
    "name"      varchar NOT NULL,
    example     jsonb NULL,
    fields      jsonb NULL,
    source_id   int8 NULL REFERENCES dndshare."source"(id),
    svg_id      int8 NULL REFERENCES dndshare.svg_storage(id),
    color       varchar NULL,
    count_items int8 DEFAULT 0 NOT NULL,
    important   bool DEFAULT false NOT NULL,
    description varchar NULL,
    CONSTRAINT item_type_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_item_type_source_id ON dndshare.item_type USING btree (source_id);
CREATE INDEX IF NOT EXISTS idx_item_type_svg_id ON dndshare.item_type USING btree (svg_id);

-- Personal handbook provenance is deliberately separate from both source
-- (game systems) and content_source (published books/content packs). Each user
-- has one default source today; the table can hold additional non-default
-- sources later without changing item identity.
CREATE TABLE IF NOT EXISTS dndshare.custom_item_source (
    id         bigserial NOT NULL,
    user_id    int8 NOT NULL REFERENCES dndshare.users(id),
    "name"     varchar NOT NULL,
    is_default bool DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT custom_item_source_pk PRIMARY KEY (id),
    CONSTRAINT custom_item_source_id_user_key UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS custom_item_source_user_default_key
    ON dndshare.custom_item_source (user_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS idx_custom_item_source_user_id
    ON dndshare.custom_item_source USING btree (user_id, id);

INSERT INTO dndshare.custom_item_source (user_id, "name", is_default)
SELECT u.id, 'Мои материалы', true
FROM dndshare.users u
WHERE NOT EXISTS (
    SELECT 1 FROM dndshare.custom_item_source cis
    WHERE cis.user_id = u.id AND cis.is_default
);

-- Registration happens before the handbook schema is known to users.go. A
-- small database invariant therefore provisions the default source for every
-- future user in the same transaction as the user row.
CREATE OR REPLACE FUNCTION dndshare.create_default_custom_item_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO dndshare.custom_item_source (user_id, "name", is_default)
    VALUES (NEW.id, 'Мои материалы', true)
    ON CONFLICT (user_id) WHERE is_default DO NOTHING;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS users_default_custom_item_source ON dndshare.users;
CREATE TRIGGER users_default_custom_item_source
AFTER INSERT ON dndshare.users
FOR EACH ROW EXECUTE FUNCTION dndshare.create_default_custom_item_source();

CREATE TABLE IF NOT EXISTS dndshare.item (
    id         bigserial NOT NULL,
    user_id    int8 NULL REFERENCES dndshare.users(id),
    "name"     varchar NOT NULL,
    "data"     jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    type_id    int8 NOT NULL REFERENCES dndshare.item_type(id),
    name_en    varchar NULL,
    parent_id  int8 NULL REFERENCES dndshare.item(id) ON DELETE SET NULL,
    icon_svg_id int8 NULL REFERENCES dndshare.svg_storage(id),
    icon_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL,
    custom_source_id int8 NULL,
    CONSTRAINT item_pk PRIMARY KEY (id)
);
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'dndshare' AND table_name = 'item' AND column_name = 'svg_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'dndshare' AND table_name = 'item' AND column_name = 'icon_svg_id'
    ) THEN
        ALTER TABLE dndshare.item RENAME COLUMN svg_id TO icon_svg_id;
    END IF;
END $$;
ALTER TABLE dndshare.item ADD COLUMN IF NOT EXISTS icon_svg_id int8 NULL REFERENCES dndshare.svg_storage(id);
ALTER TABLE dndshare.item ADD COLUMN IF NOT EXISTS icon_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL;
ALTER TABLE dndshare.item ADD COLUMN IF NOT EXISTS custom_source_id int8 NULL;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'item_single_icon_check'
          AND conrelid = 'dndshare.item'::regclass
    ) THEN
        ALTER TABLE dndshare.item
            ADD CONSTRAINT item_single_icon_check
            CHECK (num_nonnulls(icon_svg_id, icon_image_id) <= 1);
    END IF;
END $$;

-- Creature artwork used to be the only item image kept inside rules JSON.
-- Move it to the canonical raster icon relation before runtime reads begin.
-- The imported URL points at the upstream bestiary CDN, so no S3 key exists.
DO $$
DECLARE
    creature record;
    saved_image_id int8;
BEGIN
    FOR creature IN
        SELECT id, user_id, btrim(data ->> 'image_url') AS image_url
        FROM dndshare.item
        WHERE type_id = 6
          AND jsonb_typeof(data -> 'image_url') = 'string'
          AND btrim(data ->> 'image_url') <> ''
        ORDER BY id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM dndshare.item
            WHERE id = creature.id AND icon_image_id IS NOT NULL
        ) THEN
            INSERT INTO dndshare.storage_image (user_id, "key", url, "type")
            VALUES (creature.user_id, NULL, creature.image_url, 'bestiary')
            RETURNING id INTO saved_image_id;

            UPDATE dndshare.item
            SET icon_svg_id = NULL,
                icon_image_id = saved_image_id
            WHERE id = creature.id;
        END IF;
    END LOOP;
END
$$;

UPDATE dndshare.item
SET data = data - 'image_url'
WHERE type_id = 6 AND data ? 'image_url';

UPDATE dndshare.item_type
SET fields = COALESCE((
    SELECT jsonb_agg(field ORDER BY ord)
    FROM jsonb_array_elements(fields) WITH ORDINALITY rows(field, ord)
    WHERE field ->> 'key' <> 'image_url'
), '[]'::jsonb)
WHERE id = 6
  AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(fields) field
      WHERE field ->> 'key' = 'image_url'
  );

-- Existing saved custom items acquire their owner's default source. Runtime
-- only reads the column after this startup migration; legacy JSON aliases are
-- removed rather than supported as fallbacks.
UPDATE dndshare.item i
SET custom_source_id = cis.id,
    data = i.data - 'customSourceId' - 'custom_source_id'
FROM dndshare.custom_item_source cis
WHERE i.user_id = cis.user_id
  AND cis.is_default
  AND (i.custom_source_id IS NULL OR i.data ? 'customSourceId' OR i.data ? 'custom_source_id');
UPDATE dndshare.item
SET data = data - 'customSourceId' - 'custom_source_id'
WHERE user_id IS NULL AND (data ? 'customSourceId' OR data ? 'custom_source_id');

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'item_custom_source_owner_fk'
          AND conrelid = 'dndshare.item'::regclass
    ) THEN
        ALTER TABLE dndshare.item
            ADD CONSTRAINT item_custom_source_owner_fk
            FOREIGN KEY (custom_source_id, user_id)
            REFERENCES dndshare.custom_item_source(id, user_id);
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'item_custom_source_consistency_check'
          AND conrelid = 'dndshare.item'::regclass
    ) THEN
        ALTER TABLE dndshare.item
            ADD CONSTRAINT item_custom_source_consistency_check
            CHECK ((user_id IS NULL) = (custom_source_id IS NULL));
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS item_data_gin_idx ON dndshare.item USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS item_name_trgm_idx ON dndshare.item USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS item_type_id_idx ON dndshare.item USING btree (type_id, name);
CREATE INDEX IF NOT EXISTS item_type_public_name_idx ON dndshare.item USING btree (type_id, name, id) WHERE (user_id IS NULL);
CREATE INDEX IF NOT EXISTS item_type_user_name_idx ON dndshare.item USING btree (type_id, user_id, name, id);
CREATE INDEX IF NOT EXISTS item_parent_id_idx ON dndshare.item USING btree (parent_id) WHERE (parent_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_item_user_id ON dndshare.item USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_item_custom_source_id ON dndshare.item USING btree (custom_source_id);
CREATE INDEX IF NOT EXISTS idx_item_icon_svg_id ON dndshare.item USING btree (icon_svg_id) WHERE icon_svg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_icon_image_id ON dndshare.item USING btree (icon_image_id) WHERE icon_image_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dndshare.item_content_source (
    item_id           int8 NOT NULL REFERENCES dndshare.item(id) ON DELETE CASCADE,
    content_source_id int8 NOT NULL REFERENCES dndshare.content_source(id) ON DELETE CASCADE,
    page              int4 NULL,
    primary_source    bool DEFAULT false NOT NULL,
    CONSTRAINT item_content_source_pk PRIMARY KEY (item_id, content_source_id)
);
CREATE INDEX IF NOT EXISTS idx_item_content_source_source_item ON dndshare.item_content_source USING btree (content_source_id, item_id);

-- Overrides are sparse: normally an item inherits the compatibility of its
-- publication. Rows are needed only for replaced, legacy or adapted options.
CREATE TABLE IF NOT EXISTS dndshare.item_version_compatibility (
    item_id             int8 NOT NULL REFERENCES dndshare.item(id) ON DELETE CASCADE,
    source_version_id   int8 NOT NULL REFERENCES dndshare.source_version(id) ON DELETE CASCADE,
    status              varchar NOT NULL,
    replaced_by_item_id int8 NULL REFERENCES dndshare.item(id) ON DELETE SET NULL,
    adapter_code        varchar NULL,
    CONSTRAINT item_version_compatibility_pk PRIMARY KEY (item_id, source_version_id),
    CONSTRAINT item_version_compatibility_status_check CHECK (status IN ('native', 'compatible', 'legacy', 'blocked', 'requires_adaptation'))
);
CREATE INDEX IF NOT EXISTS idx_item_version_compatibility_version ON dndshare.item_version_compatibility USING btree (source_version_id, status);

CREATE TABLE IF NOT EXISTS dndshare.suggest_type (
    id          bigserial NOT NULL,
    "name"      varchar NOT NULL,
    source_id   int8 NULL REFERENCES dndshare."source"(id),
    color       varchar NULL,
    svg_id      int8 NULL REFERENCES dndshare.svg_storage(id),
    count_items int8 DEFAULT 0 NOT NULL,
    CONSTRAINT suggest_type_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_suggest_type_source_id ON dndshare.suggest_type USING btree (source_id);
CREATE INDEX IF NOT EXISTS idx_suggest_type_svg_id ON dndshare.suggest_type USING btree (svg_id);

CREATE SEQUENCE IF NOT EXISTS dndshare.suggest_public_id_seq;
CREATE TABLE IF NOT EXISTS dndshare.suggest (
    id      int8 DEFAULT nextval('dndshare.suggest_public_id_seq'::regclass) NOT NULL,
    user_id int8 NULL REFERENCES dndshare.users(id),
    type_id int8 NOT NULL REFERENCES dndshare.suggest_type(id),
    value   varchar NOT NULL,
    color   varchar NULL,
    "desc"  varchar NULL,
    code    varchar NULL,
    svg_id  int8 NULL REFERENCES dndshare.svg_storage(id),
    CONSTRAINT suggest_pk PRIMARY KEY (type_id, id)
);
ALTER TABLE dndshare.suggest ALTER COLUMN id
    SET DEFAULT nextval('dndshare.suggest_public_id_seq'::regclass);
SELECT setval(
    'dndshare.suggest_public_id_seq',
    GREATEST(
        COALESCE((SELECT MAX(id) FROM dndshare.suggest), 0),
        (SELECT last_value FROM dndshare.suggest_public_id_seq)
    ),
    true
)
WHERE EXISTS (SELECT 1 FROM dndshare.suggest);
CREATE INDEX IF NOT EXISTS suggest_base_type_value_idx ON dndshare.suggest USING btree (type_id, lower((value)::text), id) WHERE (user_id IS NULL);
CREATE INDEX IF NOT EXISTS suggest_user_type_user_value_idx ON dndshare.suggest USING btree (type_id, user_id, lower((value)::text), id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_suggest_svg_id ON dndshare.suggest USING btree (svg_id);

-- Migrate the old D&D "Источники" suggest catalogue. Only values referenced by
-- actual items are migrated: historical snapshots contain unrelated polluted
-- rows in this suggest type. The old suggest rows remain readable during the
-- rolling migration, but all new code uses content_source.
INSERT INTO dndshare.content_source (
    source_id, native_source_version_id, name, code, description, kind, is_default, sort_order
)
SELECT src.id, sv.id, 'Player''s Handbook', 'PHB',
       'Основная книга правил для создания персонажей D&D пятой редакции.',
       'base', true, 0
FROM dndshare."source" src
LEFT JOIN dndshare.source_version sv ON sv.source_id = src.id AND lower(sv.version) = '2014'
WHERE lower(src.name) = 'dnd5e'
ON CONFLICT DO NOTHING;

INSERT INTO dndshare.content_source (
    source_id, native_source_version_id, name, code, description, kind,
    is_default, sort_order, legacy_suggest_id
)
SELECT DISTINCT
    src.id,
    sv.id,
    CASE upper(sg.value)
      WHEN 'PHB' THEN 'Player''s Handbook'
      WHEN 'XGE' THEN 'Xanathar''s Guide to Everything'
      WHEN 'TCE' THEN 'Tasha''s Cauldron of Everything'
      WHEN 'FTD' THEN 'Fizban''s Treasury of Dragons'
      WHEN 'SCAG' THEN 'Sword Coast Adventurer''s Guide'
      WHEN 'BMT' THEN 'The Book of Many Things'
      WHEN 'IDROTF' THEN 'Icewind Dale: Rime of the Frostmaiden'
      WHEN 'EGTW' THEN 'Explorer''s Guide to Wildemount'
      WHEN 'AI' THEN 'Acquisitions Incorporated'
      WHEN 'LLK' THEN 'Lost Laboratory of Kwalish'
      ELSE sg.value
    END,
    upper(sg.value),
    COALESCE(NULLIF(btrim(sg."desc"), ''),
      CASE upper(sg.value)
        WHEN 'PHB' THEN 'Основная книга правил для создания персонажей D&D пятой редакции.'
        WHEN 'XGE' THEN 'Официальное дополнение с подклассами, заклинаниями, чертами и расширенными правилами.'
        WHEN 'TCE' THEN 'Официальное дополнение с вариантами классов, подклассами, чертами и заклинаниями.'
        WHEN 'FTD' THEN 'Официальное дополнение о драконах с вариантами персонажей, заклинаниями и сокровищами.'
        WHEN 'SCAG' THEN 'Путеводитель по Побережью Мечей с вариантами персонажей и региональным материалом.'
        WHEN 'BMT' THEN 'Официальное дополнение, посвящённое Колоде многих вещей и связанным вариантам персонажей.'
        WHEN 'IDROTF' THEN 'Приключение в Долине Ледяного Ветра с дополнительным игровым материалом.'
        WHEN 'EGTW' THEN 'Сеттинг-путеводитель по Уайлдмаунту с вариантами персонажей и заклинаниями.'
        WHEN 'AI' THEN 'Официальное дополнение для кампаний Acquisitions Incorporated.'
        WHEN 'LLK' THEN 'Приключение Lost Laboratory of Kwalish с дополнительным игровым материалом.'
        ELSE 'Дополнительный источник материалов для D&D пятой редакции.'
      END),
    CASE
      WHEN upper(sg.value) IN ('PHB', 'DMF5E') THEN 'base'
      WHEN upper(sg.value) LIKE 'UA%' THEN 'third_party'
      ELSE 'addon'
    END,
    upper(sg.value) = 'PHB',
    CASE WHEN upper(sg.value) = 'PHB' THEN 0 ELSE 100 END,
    sg.id
FROM dndshare.suggest sg
JOIN dndshare.suggest_type st ON st.id = sg.type_id
JOIN dndshare."source" src ON src.id = st.source_id
LEFT JOIN dndshare.source_version sv ON sv.source_id = src.id AND lower(sv.version) = '2014'
WHERE lower(st.name) = lower('Источники')
  AND EXISTS (
    SELECT 1 FROM dndshare.item i
    WHERE i.data ->> 'sourceId' = sg.id::text
  )
ON CONFLICT DO NOTHING;

-- PHB is seeded above before the legacy catalogue is inspected, so attach its
-- old suggest id separately. Matching the native edition prevents a future
-- PHB 2024 row from being mistaken for the 2014 publication.
UPDATE dndshare.content_source cs
SET legacy_suggest_id = COALESCE(cs.legacy_suggest_id, sg.id),
    description = COALESCE(cs.description, NULLIF(btrim(sg."desc"), ''))
FROM dndshare.suggest sg
JOIN dndshare.suggest_type st ON st.id = sg.type_id
JOIN dndshare."source" src ON src.id = st.source_id
LEFT JOIN dndshare.source_version sv ON sv.source_id = src.id AND lower(sv.version) = '2014'
WHERE lower(st.name) = lower('Источники')
  AND cs.source_id = src.id
  AND cs.native_source_version_id IS NOT DISTINCT FROM sv.id
  AND upper(cs.code) = upper(sg.value)
  AND EXISTS (
    SELECT 1 FROM dndshare.item i
    WHERE i.data ->> 'sourceId' = sg.id::text
  );

-- Native compatibility always exists. When a 2024 edition is added, 2014
-- supplements become compatible by default while the old core PHB is Legacy.
INSERT INTO dndshare.content_source_compatibility (content_source_id, source_version_id, status)
SELECT cs.id, cs.native_source_version_id, 'native'
FROM dndshare.content_source cs
WHERE cs.native_source_version_id IS NOT NULL
ON CONFLICT (content_source_id, source_version_id) DO NOTHING;

INSERT INTO dndshare.content_source_compatibility (content_source_id, source_version_id, status)
SELECT cs.id, target.id,
       CASE WHEN upper(cs.code) = 'PHB' THEN 'legacy' ELSE 'compatible' END
FROM dndshare.content_source cs
JOIN dndshare.source_version native ON native.id = cs.native_source_version_id AND lower(native.version) = '2014'
JOIN dndshare.source_version target ON target.source_id = cs.source_id AND lower(target.version) = '2024'
ON CONFLICT (content_source_id, source_version_id) DO NOTHING;

INSERT INTO dndshare.item_content_source (item_id, content_source_id, page, primary_source)
SELECT i.id, cs.id,
       CASE WHEN (i.data ->> 'source_page') ~ '^[0-9]+$' THEN (i.data ->> 'source_page')::int ELSE NULL END,
       true
FROM dndshare.item i
JOIN dndshare.item_type it ON it.id = i.type_id
JOIN dndshare.content_source cs ON cs.source_id = it.source_id
WHERE cs.legacy_suggest_id IS NOT NULL
  AND i.data ->> 'sourceId' = cs.legacy_suggest_id::text
ON CONFLICT (item_id, content_source_id) DO NOTHING;

-- Existing non-spell D&D catalogues predate source metadata and currently
-- contain the core 2014 roster. Backfill them exactly once; newly created items
-- are assigned explicitly by ItemEditModal and are never guessed on restart.
CREATE TABLE IF NOT EXISTS dndshare.schema_data_migration (
    code       varchar NOT NULL,
    applied_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT schema_data_migration_pk PRIMARY KEY (code)
);
WITH marker AS (
    INSERT INTO dndshare.schema_data_migration (code)
    SELECT 'content-sources-core-2014-v1'
    WHERE EXISTS (
        SELECT 1
        FROM dndshare.content_source cs
        JOIN dndshare."source" src ON src.id = cs.source_id
        WHERE lower(src.name) = 'dnd5e' AND upper(cs.code) = 'PHB'
    )
      AND EXISTS (
        SELECT 1 FROM dndshare.item WHERE type_id IN (1, 2, 3, 4, 7, 8, 9, 10, 11)
    )
    ON CONFLICT (code) DO NOTHING
    RETURNING code
)
INSERT INTO dndshare.item_content_source (item_id, content_source_id, primary_source)
SELECT i.id, cs.id, true
FROM marker
JOIN dndshare."source" src ON lower(src.name) = 'dnd5e'
JOIN dndshare.content_source cs ON cs.source_id = src.id AND upper(cs.code) = 'PHB'
JOIN dndshare.item_type it ON it.source_id = src.id
JOIN dndshare.item i ON i.type_id = it.id AND i.user_id IS NULL
WHERE i.type_id IN (1, 2, 3, 4, 7, 8, 9, 10, 11)
  AND NOT EXISTS (SELECT 1 FROM dndshare.item_content_source existing WHERE existing.item_id = i.id)
ON CONFLICT (item_id, content_source_id) DO NOTHING;

-- Source metadata is now common to every item type and edited through
-- item_content_source, not through spell-specific JSON fields.
UPDATE dndshare.item_type
SET fields = COALESCE((
    SELECT jsonb_agg(field ORDER BY ord)
    FROM jsonb_array_elements(fields) WITH ORDINALITY AS rows(field, ord)
    WHERE field ->> 'key' NOT IN ('sourceId', 'source_kind')
), '[]'::jsonb)
WHERE id = 5
  AND fields IS NOT NULL
  AND jsonb_typeof(fields) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(fields) field
    WHERE field ->> 'key' IN ('sourceId', 'source_kind')
  );

-- All runtime consumers use item_content_source now. Once the links above have
-- been copied, remove the old spell payload, template flag and suggest
-- catalogue so the generic handbook/API cannot expose it again.
UPDATE dndshare.item
SET data = data - 'sourceId' - 'source_kind'
WHERE type_id = 5
  AND (data ? 'sourceId' OR data ? 'source_kind');

DELETE FROM dndshare.suggest
WHERE type_id IN (
    SELECT id FROM dndshare.suggest_type
    WHERE lower(name) = lower('Источники')
);

DELETE FROM dndshare.suggest_type
WHERE lower(name) = lower('Источники');

ALTER TABLE dndshare.content_source DROP COLUMN IF EXISTS legacy_suggest_id;

-- Dice are a finite rules-level catalogue, not user-editable handbook data.
-- Keep their historical numeric ids in item JSON (id == number of sides), but
-- rewrite every nested schema field to the system `dice` type and remove the
-- obsolete suggest catalogue.
CREATE OR REPLACE FUNCTION dndshare.systemize_dice_schema(document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result jsonb;
BEGIN
    IF document IS NULL THEN RETURN NULL; END IF;
    CASE jsonb_typeof(document)
        WHEN 'array' THEN
            SELECT COALESCE(jsonb_agg(dndshare.systemize_dice_schema(value) ORDER BY ord), '[]'::jsonb)
            INTO result
            FROM jsonb_array_elements(document) WITH ORDINALITY rows(value, ord);
        WHEN 'object' THEN
            SELECT COALESCE(jsonb_object_agg(key, dndshare.systemize_dice_schema(value)), '{}'::jsonb)
            INTO result
            FROM jsonb_each(document);
            IF document ->> 'type' IN ('suggest', 'suggest_array')
               AND COALESCE(document ->> 'suggest_id', document ->> 'suggest_type_id') = '11' THEN
                result := (result - 'suggest_id' - 'suggest_type_id' - 'suggestTypeId')
                    || jsonb_build_object('type', CASE WHEN document ->> 'type' = 'suggest_array' THEN 'dice_array' ELSE 'dice' END);
            END IF;
        ELSE result := document;
    END CASE;
    RETURN result;
END;
$$;

UPDATE dndshare.item_type
SET fields = dndshare.systemize_dice_schema(fields)
WHERE fields IS DISTINCT FROM dndshare.systemize_dice_schema(fields);

DROP FUNCTION dndshare.systemize_dice_schema(jsonb);

-- The removed suggest catalogue used sequential ids, not face counts:
-- 1=d4, 2=d6, 3=d8, 4=d10, 5=d12, 6=d20, 7=d100. Persist the canonical
-- system value as a string so it can never be confused with either numbering.
CREATE OR REPLACE FUNCTION dndshare.canonicalize_item_dice(document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result jsonb;
BEGIN
    IF document IS NULL THEN RETURN NULL; END IF;
    CASE jsonb_typeof(document)
        WHEN 'array' THEN
            SELECT COALESCE(jsonb_agg(dndshare.canonicalize_item_dice(value) ORDER BY ord), '[]'::jsonb)
            INTO result
            FROM jsonb_array_elements(document) WITH ORDINALITY rows(value, ord);
        WHEN 'object' THEN
            SELECT COALESCE(jsonb_object_agg(key,
                CASE
                    WHEN key IN ('dice_id', 'hit_die') AND value #>> '{}' IN ('1','2','3','4','5','6','7')
                        THEN to_jsonb(CASE value #>> '{}'
                            WHEN '1' THEN 'd4' WHEN '2' THEN 'd6' WHEN '3' THEN 'd8'
                            WHEN '4' THEN 'd10' WHEN '5' THEN 'd12' WHEN '6' THEN 'd20'
                            WHEN '7' THEN 'd100'
                        END)
                    ELSE dndshare.canonicalize_item_dice(value)
                END
            ), '{}'::jsonb)
            INTO result
            FROM jsonb_each(document);
        ELSE result := document;
    END CASE;
    RETURN result;
END;
$$;

UPDATE dndshare.item
SET data = dndshare.canonicalize_item_dice(data)
WHERE data IS DISTINCT FROM dndshare.canonicalize_item_dice(data);

DROP FUNCTION dndshare.canonicalize_item_dice(jsonb);

DELETE FROM dndshare.suggest WHERE type_id = 11;
DELETE FROM dndshare.suggest_type WHERE id = 11;

-- Canonical handbook JSON. These transforms deliberately end support for the
-- former fields: startup fixes existing rows once, runtime code reads only the
-- current arrays/objects afterwards.
CREATE OR REPLACE FUNCTION dndshare.canonicalize_ability_binding(document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    single_keys text[] := ARRAY['class_id', 'subclass_id', 'race_id', 'subrace_id'];
    array_keys text[] := ARRAY['class_ids', 'subclass_ids', 'race_ids', 'subrace_ids'];
    result jsonb := document;
    owners jsonb;
    owner_id jsonb;
    idx int;
BEGIN
    FOR idx IN 1..array_length(single_keys, 1) LOOP
        IF result ? single_keys[idx] THEN
            owner_id := result -> single_keys[idx];
            owners := CASE
                WHEN jsonb_typeof(result -> array_keys[idx]) = 'array' THEN result -> array_keys[idx]
                ELSE '[]'::jsonb
            END;
            IF owner_id IS NOT NULL AND owner_id <> 'null'::jsonb AND NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(owners) entry WHERE entry -> 'id' = owner_id
            ) THEN
                owners := owners || jsonb_build_array(jsonb_build_object('id', owner_id));
            END IF;
            result := jsonb_set(result, ARRAY[array_keys[idx]], owners, true) - single_keys[idx];
        END IF;
    END LOOP;
    RETURN result;
END;
$$;

UPDATE dndshare.item
SET data = dndshare.canonicalize_ability_binding(data)
WHERE type_id IN (3, 4)
  AND data ?| ARRAY['class_id', 'subclass_id', 'race_id', 'subrace_id'];

DROP FUNCTION dndshare.canonicalize_ability_binding(jsonb);

UPDATE dndshare.item_type
SET fields = COALESCE((
    SELECT jsonb_agg(field ORDER BY ord)
    FROM jsonb_array_elements(fields) WITH ORDINALITY rows(field, ord)
    WHERE field ->> 'key' NOT IN ('class_id', 'subclass_id', 'race_id', 'subrace_id')
), '[]'::jsonb)
WHERE id IN (3, 4) AND jsonb_typeof(fields) = 'array';

UPDATE dndshare.item spell
SET data = jsonb_set(
    spell.data,
    '{classes}',
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', class_item.id) ORDER BY class_item.id)
        FROM jsonb_array_elements_text(spell.data -> 'classIds') old_class(suggest_id)
        JOIN dndshare.item class_item
          ON class_item.type_id = 9
         AND class_item.data ->> 'suggest_id' = old_class.suggest_id
    ), '[]'::jsonb),
    true
)
WHERE spell.type_id = 5
  AND jsonb_typeof(spell.data -> 'classIds') = 'array'
  AND jsonb_typeof(spell.data -> 'classes') IS DISTINCT FROM 'array';

UPDATE dndshare.item
SET data = data - 'classIds'
WHERE type_id = 5 AND data ? 'classIds';

UPDATE dndshare.item_type
SET fields = COALESCE((
    SELECT jsonb_agg(field ORDER BY ord)
    FROM jsonb_array_elements(fields) WITH ORDINALITY rows(field, ord)
    WHERE field ->> 'key' <> 'classIds'
), '[]'::jsonb)
WHERE id = 5 AND jsonb_typeof(fields) = 'array';

UPDATE dndshare.item
SET data = CASE
    WHEN data ? 'description' THEN data - 'desc'
    ELSE (data - 'desc') || jsonb_build_object('description', data -> 'desc')
END
WHERE type_id = 7 AND data ? 'desc';

UPDATE dndshare.item
SET data = CASE
    WHEN data ? 'prereq' THEN data - 'prerequisites'
    ELSE (data - 'prerequisites') || jsonb_build_object('prereq', data -> 'prerequisites')
END
WHERE type_id = 7 AND data ? 'prerequisites';

UPDATE dndshare.item
SET data = CASE
    WHEN jsonb_typeof(data -> 'choices') = 'array' THEN data - 'choice'
    ELSE (data - 'choice') || jsonb_build_object('choices', jsonb_build_array(data -> 'choice'))
END
WHERE type_id = 7 AND data ? 'choice';

CREATE TABLE IF NOT EXISTS dndshare.dictionary_text (
    id     bigserial NOT NULL,
    lang   text NOT NULL,
    keyset text NOT NULL,
    "key"  text NOT NULL,
    value  text NOT NULL
);
