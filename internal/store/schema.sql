-- Идемпотентная консолидированная схема (финальное состояние прежних Liquibase-миграций
-- v1..v3). Всё живёт в схеме `dndshare`. На существующей проде CREATE ... IF NOT EXISTS и
-- ON CONFLICT DO NOTHING — no-op; на чистой БД создаёт все таблицы, индексы и засевает
-- справочные строки, которые задавались миграциями (item_type 8/9/10, suggest_type 23, роли).
-- Базовые справочники (item types 1..7, часть suggest-типов) исторически заводились только на
-- проде и в миграциях не было — на чистой БД их нет (как и в прежней версии).

CREATE SCHEMA IF NOT EXISTS dndshare;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Auth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare."role" (
    id          bigserial NOT NULL,
    "name"      text NOT NULL,
    description text NULL,
    CONSTRAINT role_pk PRIMARY KEY (id)
);
INSERT INTO dndshare."role" ("name")
SELECT r FROM (VALUES ('NONE'), ('ADMIN'), ('HANDBOOK_ADMIN'), ('TEMPLATE_ADMIN'), ('ERROR_REPORT_AUTO_APPROVE'), ('ERROR_REPORT_REVIEWER')) AS v(r)
WHERE NOT EXISTS (SELECT 1 FROM dndshare."role" e WHERE e."name" = v.r);

CREATE TABLE IF NOT EXISTS dndshare.users (
    id         bigserial NOT NULL,
    login      text NOT NULL,
    "password" text NOT NULL,
    email      text NULL,
    created_at timestamp DEFAULT now() NULL,
    CONSTRAINT users_pk PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_login_uindex ON dndshare.users USING btree (login);

CREATE TABLE IF NOT EXISTS dndshare.users_role (
    id         bigserial NOT NULL,
    user_id    int8 NOT NULL REFERENCES dndshare.users(id),
    role_id    int8 NOT NULL REFERENCES dndshare."role"(id),
    created_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT users_role_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS users_role_user_id_index ON dndshare.users_role USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_users_role_role_id ON dndshare.users_role USING btree (role_id);

CREATE SEQUENCE IF NOT EXISTS dndshare.user_sessions_id_seq;
CREATE TABLE IF NOT EXISTS dndshare.users_session (
    id         int8 DEFAULT nextval('dndshare.user_sessions_id_seq'::regclass) NOT NULL,
    user_id    int8 NOT NULL REFERENCES dndshare.users(id),
    "session"  uuid NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT user_sessions_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS i_users_session ON dndshare.users_session USING btree (user_id, session);

-- ---------------------------------------------------------------------------
-- Logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.logs (
    id         bigserial NOT NULL,
    "path"     text NOT NULL,
    "type"     text NOT NULL,
    "desc"     text NOT NULL,
    trace      text NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT logs_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON dndshare.logs USING btree (created_at DESC);

-- ---------------------------------------------------------------------------
-- User error reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.error_report (
    id          bigserial NOT NULL,
    title       text NULL,
    description text NOT NULL,
    page_url    text NOT NULL,
    element     jsonb NOT NULL,
    screenshot  bytea NULL,
    screenshot_content_type varchar(50) NULL,
    viewport_screenshot bytea NULL,
    viewport_screenshot_content_type varchar(50) NULL,
    user_id     int8 NULL REFERENCES dndshare.users(id) ON DELETE SET NULL,
    approved    bool DEFAULT false NOT NULL,
    status      varchar(20) DEFAULT 'OPEN' NOT NULL,
    resolution  text NULL,
    resolved_commit_sha varchar(64) NULL,
    resolved_at timestamptz NULL,
    serious_change_reason text NULL,
    serious_change_requested_at timestamptz NULL,
    serious_change_approved_at timestamptz NULL,
    serious_change_approved_by_user_id int8 NULL,
    created_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT error_report_pk PRIMARY KEY (id)
);
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS title text NULL;
ALTER TABLE dndshare.error_report ALTER COLUMN title DROP NOT NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS screenshot bytea NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS screenshot_content_type varchar(50) NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS viewport_screenshot bytea NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS viewport_screenshot_content_type varchar(50) NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS approved bool DEFAULT false NOT NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'OPEN' NOT NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS resolution text NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS resolved_commit_sha varchar(64) NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS serious_change_reason text NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS serious_change_requested_at timestamptz NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS serious_change_approved_at timestamptz NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS serious_change_approved_by_user_id int8 NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS processing_run_id varchar(64) NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS processing_started_at timestamptz NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS processing_expires_at timestamptz NULL;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'error_report_serious_change_approved_by_fk'
          AND conrelid = 'dndshare.error_report'::regclass
    ) THEN
        ALTER TABLE dndshare.error_report
            ADD CONSTRAINT error_report_serious_change_approved_by_fk
            FOREIGN KEY (serious_change_approved_by_user_id)
            REFERENCES dndshare.users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    ALTER TABLE dndshare.error_report DROP CONSTRAINT IF EXISTS error_report_status_check;
    ALTER TABLE dndshare.error_report
        ADD CONSTRAINT error_report_status_check CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED'));
END $$;
CREATE INDEX IF NOT EXISTS idx_error_report_created_at ON dndshare.error_report USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_report_user_id ON dndshare.error_report USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_error_report_approved_created_at ON dndshare.error_report USING btree (created_at DESC) WHERE approved;
CREATE INDEX IF NOT EXISTS idx_error_report_open_approved_created_at
    ON dndshare.error_report USING btree (created_at DESC) WHERE approved AND status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_error_report_resolved_at
    ON dndshare.error_report USING btree (resolved_at) WHERE status = 'RESOLVED';
CREATE INDEX IF NOT EXISTS idx_error_report_processing_expires_at
    ON dndshare.error_report USING btree (processing_expires_at) WHERE status = 'IN_PROGRESS';
CREATE INDEX IF NOT EXISTS idx_error_report_serious_change_approved_by_user_id
    ON dndshare.error_report USING btree (serious_change_approved_by_user_id)
    WHERE serious_change_approved_by_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dndshare.error_report_message (
    id             bigserial NOT NULL,
    error_report_id int8 NOT NULL REFERENCES dndshare.error_report(id) ON DELETE CASCADE,
    sender         varchar(20) NOT NULL,
    message        text NOT NULL,
    admin_user_id  int8 NULL REFERENCES dndshare.users(id) ON DELETE SET NULL,
    created_at     timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT error_report_message_pk PRIMARY KEY (id),
    CONSTRAINT error_report_message_sender_check CHECK (sender IN ('AI', 'ADMIN'))
);
CREATE INDEX IF NOT EXISTS idx_error_report_message_report_id_id
    ON dndshare.error_report_message USING btree (error_report_id, id);

CREATE TABLE IF NOT EXISTS dndshare.error_report_automation_lock (
    id          int2 NOT NULL DEFAULT 1,
    token       varchar(64) NOT NULL,
    acquired_at timestamptz NOT NULL,
    expires_at  timestamptz NOT NULL,
    CONSTRAINT error_report_automation_lock_pk PRIMARY KEY (id),
    CONSTRAINT error_report_automation_lock_singleton CHECK (id = 1)
);

-- ---------------------------------------------------------------------------
-- Admin job runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.job_run (
    id                 bigserial NOT NULL,
    code               varchar(100) NOT NULL,
    "name"             varchar(200) NOT NULL,
    status             varchar(20) NOT NULL,
    current_value      int8 DEFAULT 0 NOT NULL,
    total_value        int8 NULL,
    message            text NULL,
    "error"            text NULL,
    "result"           jsonb NULL,
    started_by_user_id int8 NOT NULL REFERENCES dndshare.users(id),
    started_at         timestamptz DEFAULT now() NOT NULL,
    finished_at        timestamptz NULL,
    CONSTRAINT job_run_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_job_run_started_at ON dndshare.job_run USING btree (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_run_status_running ON dndshare.job_run USING btree (status) WHERE ((status)::text = 'RUNNING'::text);
CREATE INDEX IF NOT EXISTS idx_job_run_started_by_user_id ON dndshare.job_run USING btree (started_by_user_id);

-- ---------------------------------------------------------------------------
-- Handbook: sources, svg + image storage, item types, items, suggests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare."source" (
    id          bigserial NOT NULL,
    "name"      varchar NOT NULL,
    -- Legacy migration source. New code reads editions from source_version.
    "version"   varchar NULL,
    count_items int8 DEFAULT 0 NOT NULL,
    CONSTRAINT newtable_pk PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dndshare.source_version (
    id        bigserial NOT NULL,
    source_id int8 NOT NULL REFERENCES dndshare."source"(id),
    "version" varchar NOT NULL,
    CONSTRAINT source_version_pk PRIMARY KEY (id),
    CONSTRAINT source_version_source_id_version_key UNIQUE (source_id, "version")
);
CREATE INDEX IF NOT EXISTS idx_source_version_source_id ON dndshare.source_version USING btree (source_id);

-- Move the old one-version-per-source model into the edition catalogue. The
-- source.version column stays for a safe rolling migration, but is no longer read.
INSERT INTO dndshare.source_version (source_id, "version")
SELECT id, "version"
FROM dndshare."source"
WHERE "version" IS NOT NULL AND btrim("version") <> ''
ON CONFLICT (source_id, "version") DO NOTHING;

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
    legacy_suggest_id        int8 NULL,
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

CREATE TABLE IF NOT EXISTS dndshare.item (
    id         bigserial NOT NULL,
    user_id    int8 NULL REFERENCES dndshare.users(id),
    "name"     varchar NOT NULL,
    "data"     jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    type_id    int8 NOT NULL REFERENCES dndshare.item_type(id),
    name_en    varchar NULL,
    parent_id  int8 NULL REFERENCES dndshare.item(id) ON DELETE SET NULL,
    svg_id     int8 NULL REFERENCES dndshare.svg_storage(id),
    CONSTRAINT item_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS item_data_gin_idx ON dndshare.item USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS item_name_trgm_idx ON dndshare.item USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS item_type_id_idx ON dndshare.item USING btree (type_id, name);
CREATE INDEX IF NOT EXISTS item_type_public_name_idx ON dndshare.item USING btree (type_id, name, id) WHERE (user_id IS NULL);
CREATE INDEX IF NOT EXISTS item_type_user_name_idx ON dndshare.item USING btree (type_id, user_id, name, id);
CREATE INDEX IF NOT EXISTS item_parent_id_idx ON dndshare.item USING btree (parent_id) WHERE (parent_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_item_user_id ON dndshare.item USING btree (user_id);

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

CREATE TABLE IF NOT EXISTS dndshare.suggest (
    id      int8 NOT NULL,
    user_id int8 NULL REFERENCES dndshare.users(id),
    type_id int8 NOT NULL REFERENCES dndshare.suggest_type(id),
    value   varchar NOT NULL,
    color   varchar NULL,
    "desc"  varchar NULL,
    code    varchar NULL,
    svg_id  int8 NULL REFERENCES dndshare.svg_storage(id),
    CONSTRAINT suggest_pk PRIMARY KEY (type_id, id)
);
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

CREATE TABLE IF NOT EXISTS dndshare.dictionary_text (
    id     bigserial NOT NULL,
    lang   text NOT NULL,
    keyset text NOT NULL,
    "key"  text NOT NULL,
    value  text NOT NULL
);

-- ---------------------------------------------------------------------------
-- Characters and templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.char_template (
    id                   bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name"               varchar NOT NULL,
    "schema"             jsonb NOT NULL,
    create_form          jsonb NULL,
    path_values_for_list jsonb NULL,
    CONSTRAINT char_template_pk PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dndshare.template_block_type (
    "type"          varchar NOT NULL,
    "label"         varchar NOT NULL,
    category        varchar NOT NULL,
    fields          jsonb DEFAULT '[]'::jsonb NOT NULL,
    default_content jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT template_block_type_pkey PRIMARY KEY (type)
);

CREATE TABLE IF NOT EXISTS dndshare."char" (
    id             bigserial NOT NULL,
    "uuid"         uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id        int8 NOT NULL REFERENCES dndshare.users(id),
    template_id    int8 NOT NULL REFERENCES dndshare.char_template(id),
    source_version_id int8 NULL REFERENCES dndshare.source_version(id),
    "data"         jsonb NOT NULL,
    public_visible bool DEFAULT true NOT NULL,
    created_at     timestamptz DEFAULT now() NOT NULL,
    changed_at     timestamptz DEFAULT now() NOT NULL,
    "name"         varchar NULL,
    deleted        bool DEFAULT false NOT NULL,
    death          varchar DEFAULT 'false' NOT NULL,
    "version"      int8 DEFAULT 1 NOT NULL,
    CONSTRAINT char_pk PRIMARY KEY (id),
    CONSTRAINT char_uuid_key UNIQUE (uuid)
);
ALTER TABLE dndshare."char"
    ADD COLUMN IF NOT EXISTS source_version_id int8 NULL REFERENCES dndshare.source_version(id);
CREATE INDEX IF NOT EXISTS idx_char_user_id ON dndshare."char" USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_char_user_changed ON dndshare."char" USING btree (user_id, changed_at DESC) WHERE (deleted = false);
CREATE INDEX IF NOT EXISTS idx_char_template_id ON dndshare."char" USING btree (template_id);
CREATE INDEX IF NOT EXISTS idx_char_source_version_id ON dndshare."char" USING btree (source_version_id);

-- Existing characters predate source_version_id. Backfill the two known
-- template families without touching already classified rows.
UPDATE dndshare."char" c
SET source_version_id = sv.id
FROM dndshare.char_template ct
JOIN dndshare."source" src ON (
    (upper(ct.name) IN ('DND5', 'DND5E') AND lower(src.name) = 'dnd5e')
    OR ((upper(ct.name) LIKE '%VTM%' OR upper(ct.name) LIKE '%VAMPIRE%') AND lower(src.name) = 'vampire: tm')
)
JOIN dndshare.source_version sv ON sv.source_id = src.id AND (
    (upper(ct.name) IN ('DND5', 'DND5E') AND sv.version = '2014')
    OR ((upper(ct.name) LIKE '%VTM%' OR upper(ct.name) LIKE '%VAMPIRE%') AND upper(sv.version) = 'V20')
)
WHERE c.template_id = ct.id AND c.source_version_id IS NULL;

-- ---------------------------------------------------------------------------
-- Music library
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.music_album (
    id            bigserial NOT NULL,
    owner_user_id int8 NOT NULL REFERENCES dndshare.users(id),
    "name"        varchar(255) NOT NULL,
    color         varchar(16) NULL,
    created_at    timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT music_album_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS music_album_owner_idx ON dndshare.music_album USING btree (owner_user_id);

CREATE TABLE IF NOT EXISTS dndshare.music_track (
    id            bigserial NOT NULL,
    "uuid"        uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id int8 NOT NULL REFERENCES dndshare.users(id),
    "name"        varchar(255) NOT NULL,
    file_key      varchar(512) NOT NULL,
    file_name     varchar(255) NOT NULL,
    duration_sec  int4 NULL,
    file_size     int8 NOT NULL,
    mime_type     varchar(64) NOT NULL,
    created_at    timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT music_track_pkey PRIMARY KEY (id),
    CONSTRAINT music_track_uuid_key UNIQUE (uuid)
);
CREATE INDEX IF NOT EXISTS music_track_owner_idx ON dndshare.music_track USING btree (owner_user_id);

CREATE TABLE IF NOT EXISTS dndshare.music_tag (
    id            bigserial NOT NULL,
    owner_user_id int8 NOT NULL REFERENCES dndshare.users(id),
    "name"        varchar(64) NOT NULL,
    CONSTRAINT music_tag_owner_user_id_name_key UNIQUE (owner_user_id, name),
    CONSTRAINT music_tag_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dndshare.music_album_track (
    id       bigserial NOT NULL,
    album_id int8 NOT NULL REFERENCES dndshare.music_album(id) ON DELETE CASCADE,
    track_id int8 NOT NULL REFERENCES dndshare.music_track(id) ON DELETE CASCADE,
    "position" int4 DEFAULT 0 NOT NULL,
    CONSTRAINT music_album_track_album_id_track_id_key UNIQUE (album_id, track_id),
    CONSTRAINT music_album_track_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS music_album_track_album_idx ON dndshare.music_album_track USING btree (album_id, "position");
CREATE INDEX IF NOT EXISTS music_album_track_track_idx ON dndshare.music_album_track USING btree (track_id);

CREATE TABLE IF NOT EXISTS dndshare.music_track_tag (
    track_id int8 NOT NULL REFERENCES dndshare.music_track(id) ON DELETE CASCADE,
    tag_id   int8 NOT NULL REFERENCES dndshare.music_tag(id) ON DELETE CASCADE,
    CONSTRAINT music_track_tag_pkey PRIMARY KEY (track_id, tag_id)
);
CREATE INDEX IF NOT EXISTS music_track_tag_tag_idx ON dndshare.music_track_tag USING btree (tag_id);

-- ---------------------------------------------------------------------------
-- Sessions (session <-> session_chapter form a cyclic FK: the chapter one is
-- added after both tables exist).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare."session" (
    id                 bigserial NOT NULL,
    "uuid"             uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id      int8 NOT NULL REFERENCES dndshare.users(id),
    "name"             varchar(255) NOT NULL,
    description        text NULL,
    system_id          int8 NULL REFERENCES dndshare."source"(id),
    invite_code        varchar(16) NOT NULL,
    status             varchar(32) DEFAULT 'active'::character varying NOT NULL,
    created_at         timestamptz DEFAULT now() NOT NULL,
    changed_at         timestamptz DEFAULT now() NOT NULL,
    deleted            bool DEFAULT false NOT NULL,
    encounter          jsonb NULL,
    current_chapter_id int8 NULL,
    CONSTRAINT session_invite_code_key UNIQUE (invite_code),
    CONSTRAINT session_pkey PRIMARY KEY (id),
    CONSTRAINT session_uuid_key UNIQUE (uuid)
);
CREATE INDEX IF NOT EXISTS idx_session_owner_user_id ON dndshare."session" USING btree (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_session_system_id ON dndshare."session" USING btree (system_id);
CREATE INDEX IF NOT EXISTS idx_session_current_chapter_id ON dndshare."session" USING btree (current_chapter_id);

CREATE TABLE IF NOT EXISTS dndshare.session_chapter (
    id         bigserial NOT NULL,
    session_id int8 NOT NULL REFERENCES dndshare."session"(id),
    "number"   int8 NOT NULL,
    "name"     text NOT NULL,
    CONSTRAINT session_chapter_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_session_chapter_session_id ON dndshare.session_chapter USING btree (session_id);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_session_chapter_fk') THEN
        ALTER TABLE dndshare."session" ADD CONSTRAINT session_session_chapter_fk FOREIGN KEY (current_chapter_id) REFERENCES dndshare.session_chapter(id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS dndshare.session_scene (
    id         bigserial NOT NULL,
    chapter_id int8 NOT NULL REFERENCES dndshare.session_chapter(id),
    "name"     varchar NOT NULL,
    CONSTRAINT session_scene_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_session_scene_chapter_id ON dndshare.session_scene USING btree (chapter_id);

CREATE TABLE IF NOT EXISTS dndshare.session_scene_item (
    id       bigserial NOT NULL,
    scene_id int8 NOT NULL REFERENCES dndshare.session_scene(id),
    "type"   text NOT NULL,
    title    varchar NOT NULL,
    "data"   jsonb NULL,
    color    varchar NULL,
    "order"  int8 NOT NULL,
    CONSTRAINT session_scene_item_session_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_session_scene_item_scene_id ON dndshare.session_scene_item USING btree (scene_id);

CREATE SEQUENCE IF NOT EXISTS dndshare.encounter_id_seq;
CREATE TABLE IF NOT EXISTS dndshare.session_encounter (
    id         int8 DEFAULT nextval('dndshare.encounter_id_seq'::regclass) NOT NULL,
    session_id int8 NOT NULL REFERENCES dndshare."session"(id),
    "name"     varchar(255) NULL,
    status     varchar(32) DEFAULT 'pending'::character varying NOT NULL,
    round      int4 DEFAULT 0 NOT NULL,
    "data"     jsonb NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    deleted    bool DEFAULT false NOT NULL,
    CONSTRAINT encounter_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_session_encounter_session_id ON dndshare.session_encounter USING btree (session_id);

CREATE TABLE IF NOT EXISTS dndshare.session_event (
    id             bigserial NOT NULL,
    session_id     int8 NOT NULL REFERENCES dndshare."session"(id),
    author_user_id int8 NOT NULL REFERENCES dndshare.users(id),
    event_type     varchar(32) NOT NULL,
    title          varchar(255) NULL,
    "content"      text NULL,
    "data"         jsonb NULL,
    created_at     timestamptz DEFAULT now() NOT NULL,
    deleted        bool DEFAULT false NOT NULL,
    CONSTRAINT session_event_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_session_event_session_id ON dndshare.session_event USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_session_event_author_user_id ON dndshare.session_event USING btree (author_user_id);

CREATE TABLE IF NOT EXISTS dndshare.session_music_state (
    id         bigserial NOT NULL,
    session_id int8 NOT NULL REFERENCES dndshare."session"(id),
    "data"     jsonb DEFAULT '{}'::jsonb NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_music_state_pkey PRIMARY KEY (id),
    CONSTRAINT session_music_state_session_id_key UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS dndshare.session_participant (
    id         bigserial NOT NULL,
    session_id int8 NOT NULL REFERENCES dndshare."session"(id),
    char_id    int8 NOT NULL REFERENCES dndshare."char"(id),
    user_id    int8 NOT NULL REFERENCES dndshare.users(id),
    "role"     varchar(32) DEFAULT 'player'::character varying NOT NULL,
    joined_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_participant_pkey PRIMARY KEY (id),
    CONSTRAINT session_participant_session_id_char_id_key UNIQUE (session_id, char_id)
);
CREATE INDEX IF NOT EXISTS idx_session_participant_char_id ON dndshare.session_participant USING btree (char_id);
CREATE INDEX IF NOT EXISTS idx_session_participant_user_id ON dndshare.session_participant USING btree (user_id);

-- ---------------------------------------------------------------------------
-- v3+ seed data (charcreate migrations): item types Черты(7)/Расы(8)/Классы(9)/Зелья(10),
-- suggest type Редкость(23) + значения. ON CONFLICT DO NOTHING → no-op на проде.
-- ---------------------------------------------------------------------------
INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (7, 'Черты', '[]'::jsonb, 1, '#d6a84f', true, 'Особые таланты и обучение персонажей: требования, выборы, бонусы и ограниченные использования.')
ON CONFLICT (id) DO NOTHING;

-- v5 (2026-08-09): структурированная модель черт. Старый тип 7 исторически жил
-- только на проде; добавляем отсутствующие поля по ключу, не затирая возможные
-- дополнительные поля и сами данные существующих черт.
WITH wanted(fields) AS (
    VALUES ('[{"name":"Описание","key":"description","type":"description"},{"name":"Требования","key":"prereq","type":"object","fields":[{"name":"Текст требования","key":"text","type":"text"},{"name":"Минимальные характеристики","key":"min_stats","type":"object_array","fields":[{"name":"Характеристика","key":"ability","type":"suggest","suggest_id":16},{"name":"Минимум","key":"value","type":"int","default":13}]},{"name":"Связь характеристик","key":"min_stats_mode","type":"select","default":"all","options":[{"value":"all","label":"Все условия (И)"},{"value":"any","label":"Любое условие (ИЛИ)"}]},{"name":"Требуется заклинательство","key":"spellcasting","type":"bool"},{"name":"Требуемое владение доспехами","key":"armor_prof","type":"suggest_array","suggest_id":3},{"name":"Минимальный уровень","key":"min_level","type":"int"}]},{"name":"Можно брать повторно","key":"repeatable","type":"bool","default":false,"filter":true},{"name":"Уникальный выбор при повторе","key":"unique_choice_key","type":"text","show_on":{"key":"repeatable","value":true}},{"name":"Выборы при получении","key":"choices","type":"object_array","fields":[{"name":"Ключ","key":"key","type":"text"},{"name":"Подсказка игроку","key":"text","type":"text"},{"name":"Сколько выбрать","key":"count","type":"int","default":1},{"name":"Источник вариантов","key":"source","type":"select","default":"inline","options":[{"value":"inline","label":"Варианты ниже"},{"value":"suggest","label":"Словарь"},{"value":"item","label":"Предметы справочника"}]},{"name":"ID словаря","key":"from_suggest_id","type":"int","show_on":{"key":"source","value":"suggest"}},{"name":"ID типа предметов","key":"from_item_type_id","type":"int","show_on":{"key":"source","value":"item"}},{"name":"Фильтр предметов","key":"item_filter","type":"text","show_on":{"key":"source","value":"item"}},{"name":"Не повторять вариант","key":"unique_across_takes","type":"bool"},{"name":"Варианты","key":"options","type":"object_array","show_on":{"key":"source","value":"inline"},"fields":[{"name":"Значение","key":"value","type":"text"},{"name":"Название","key":"label","type":"text"},{"name":"Описание","key":"desc","type":"text"}]}]},{"name":"Фиксированные бонусы характеристик","key":"asi","type":"object_array","fields":[{"name":"Характеристика","key":"ability","type":"suggest","suggest_id":16},{"name":"Бонус","key":"bonus","type":"int","default":1}]},{"name":"Бонус характеристики на выбор","key":"asi_choice","type":"object","fields":[{"name":"Ключ выбора","key":"choice_key","type":"text","default":"ability"},{"name":"Сколько выбрать","key":"count","type":"int","default":1},{"name":"Бонус","key":"bonus","type":"int","default":1},{"name":"Доступные характеристики","key":"from","type":"suggest_array","suggest_id":16}]},{"name":"Даруемые владения","key":"grants","type":"object","fields":[{"name":"Доспехи","key":"armor_prof","type":"suggest_array","suggest_id":3},{"name":"Оружие","key":"weapon_prof","type":"suggest_array","suggest_id":4},{"name":"Инструменты","key":"tool_prof","type":"suggest_array","suggest_id":5},{"name":"Навыки","key":"skill_prof","type":"suggest_array","suggest_id":15},{"name":"Спасброски","key":"save_prof","type":"suggest_array","suggest_id":16},{"name":"Языки","key":"languages","type":"suggest_array","suggest_id":6}]},{"name":"Максимум использований","key":"max_use","type":"int"},{"name":"Редактируемый максимум","key":"manual_size","type":"bool"},{"name":"Восстановление на коротком отдыхе","key":"rollback_short_rest","type":"bool"},{"name":"Восстановление на длинном отдыхе","key":"rollback_long_rest","type":"bool"},{"name":"Теги","key":"tags","type":"text"},{"name":"Страница источника","key":"source_page","type":"int"}]'::jsonb)
), missing AS (
    SELECT it.id, jsonb_agg(candidate.field ORDER BY candidate.ord) AS fields
    FROM dndshare.item_type it
    CROSS JOIN wanted
    CROSS JOIN LATERAL jsonb_array_elements(wanted.fields) WITH ORDINALITY AS candidate(field, ord)
    WHERE it.id = 7
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(it.fields, '[]'::jsonb)) current
          WHERE current->>'key' = candidate.field->>'key'
      )
    GROUP BY it.id
)
UPDATE dndshare.item_type it
SET fields = COALESCE(it.fields, '[]'::jsonb) || missing.fields,
    color = COALESCE(it.color, '#d6a84f'),
    description = COALESCE(it.description, 'Особые таланты и обучение персонажей: требования, выборы, бонусы и ограниченные использования.')
FROM missing
WHERE it.id = missing.id;

-- Choice-driven grants (e.g. Resilient: the selected ability gets both +1 and
-- saving-throw proficiency) are nested inside the `choices` field, so extend
-- that field separately while preserving any custom choice subfields.
WITH additions(fields) AS (
    VALUES ('[{"name":"Бонус выбранной характеристики","key":"ability_bonus","type":"int"},{"name":"Даруемое владение","key":"grant_proficiency","type":"select","options":[{"value":"","label":"Не применять"},{"value":"armor_prof","label":"Доспех"},{"value":"weapon_prof","label":"Оружие"},{"value":"tool_prof","label":"Инструмент"},{"value":"skill_prof","label":"Навык"},{"value":"save_prof","label":"Спасбросок"},{"value":"languages","label":"Язык"}]},{"name":"Добавить выбранные заклинания","key":"grant_spells","type":"bool"}]'::jsonb)
)
UPDATE dndshare.item_type it
SET fields = (
    SELECT jsonb_agg(
        CASE WHEN field->>'key' = 'choices'
            THEN jsonb_set(field, '{fields}', COALESCE(field->'fields', '[]'::jsonb) || additions.fields)
            ELSE field
        END
        ORDER BY ord
    )
    FROM jsonb_array_elements(it.fields) WITH ORDINALITY AS row_field(field, ord)
    CROSS JOIN additions
)
WHERE it.id = 7
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(it.fields) field WHERE field->>'key' = 'choices')
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(it.fields) field
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field->'fields', '[]'::jsonb)) subfield
      WHERE field->>'key' = 'choices' AND subfield->>'key' = 'ability_bonus'
  );

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (8, 'Расы', '[{"name":"Раса (словарь)","key":"suggest_id","type":"suggest","suggest_id":1},{"name":"Размер","key":"size","type":"text"},{"name":"Скорость","key":"speed","type":"int","default":30},{"name":"Бонусы характеристик","key":"asi","type":"object_array","fields":[{"name":"Характеристика","key":"ability","type":"suggest","suggest_id":16},{"name":"Бонус","key":"bonus","type":"int","default":1}]},{"name":"Плавающий бонус (выбор)","key":"asi_choice","type":"object","fields":[{"name":"Сколько выбрать","key":"count","type":"int","default":2},{"name":"Бонус","key":"bonus","type":"int","default":1}]},{"name":"Выбор навыков","key":"skill_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":2},{"name":"Из навыков (пусто = любые)","key":"from","type":"suggest_array","suggest_id":15}]},{"name":"Выбор языка","key":"lang_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":1},{"name":"Из языков (пусто = любые)","key":"from","type":"suggest_array","suggest_id":6}]},{"name":"Языки","key":"languages","type":"suggest_array","suggest_id":6},{"name":"Владение доспехами","key":"armor_prof","type":"suggest_array","suggest_id":3},{"name":"Владение оружием","key":"weapon_prof","type":"suggest_array","suggest_id":4},{"name":"Владение инструментами","key":"tool_prof","type":"suggest_array","suggest_id":5},{"name":"Описание","key":"description","type":"description"}]'::jsonb, 1, '#5aaf72', true, 'Расы и подрасы персонажей: бонусы характеристик, скорость, размер, языки, владения.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (9, 'Классы', '[{"name":"Класс (словарь)","key":"suggest_id","type":"suggest","suggest_id":2},{"name":"Кость хитов","key":"hit_die","type":"suggest","suggest_id":11},{"name":"Основные характеристики","key":"primary_abilities","type":"suggest_array","suggest_id":16},{"name":"Спасброски","key":"saves","type":"suggest_array","suggest_id":16},{"name":"Владение доспехами","key":"armor_prof","type":"suggest_array","suggest_id":3},{"name":"Владение оружием","key":"weapon_prof","type":"suggest_array","suggest_id":4},{"name":"Владение инструментами","key":"tool_prof","type":"suggest_array","suggest_id":5},{"name":"Выбор навыков","key":"skill_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":2},{"name":"Из навыков","key":"from","type":"suggest_array","suggest_id":15}]},{"name":"Заклинательство","key":"spellcasting","type":"object","fields":[{"name":"Характеристика заклинаний","key":"ability","type":"suggest","suggest_id":16},{"name":"Заговоров на 1 уровне","key":"cantrips_known","type":"int"},{"name":"Заклинаний на 1 уровне","key":"spells_known","type":"int"},{"name":"Подготавливает заклинания","key":"prepares","type":"bool"},{"name":"Примечание","key":"note","type":"description"}]},{"name":"Уровень выбора архетипа","key":"subclass_level","type":"int"},{"name":"Уровни прироста характеристик (ASI)","key":"asi_levels","type":"text"},{"name":"Даруемые заклинания","key":"granted_spells","type":"object_array","fields":[{"name":"Уровень класса","key":"level","type":"int","default":1},{"name":"Заклинание","key":"spell","type":"item","item_type":5},{"name":"Вариант (напр. местность)","key":"option","type":"text"}]},{"name":"Стартовое снаряжение","key":"starting_equipment","type":"description"},{"name":"Описание","key":"description","type":"description"}]'::jsonb, 1, '#7c5cff', true, 'Классы и архетипы персонажей: кость хитов, владения, заклинательство, выбор навыков.')
ON CONFLICT (id) DO NOTHING;

-- v4 (2026-07-19): «Даруемые заклинания» (granted_spells) у типа 9 — заклинания
-- домена/клятвы/круга на архетипах. INSERT выше на проде no-op, поэтому дописываем
-- поле существующему типу идемпотентным UPDATE (только если его ещё нет).
UPDATE dndshare.item_type
SET fields = fields || '[{"name":"Даруемые заклинания","key":"granted_spells","type":"object_array","fields":[{"name":"Уровень класса","key":"level","type":"int","default":1},{"name":"Заклинание","key":"spell","type":"item","item_type":5},{"name":"Вариант (напр. местность)","key":"option","type":"text"}]}]'::jsonb
WHERE id = 9
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key' = 'granted_spells');

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (10, 'Зелья', '[{"name":"Описание","key":"desc","type":"description"},{"name":"Цвет зелья","key":"color","type":"color","default":"#7c5cff"},{"name":"Редкость","key":"rarity","type":"suggest","suggest_id":23,"filter":true},{"name":"Стоимость","key":"cost","type":"int_by_suggest","suggest_type_id":17},{"name":"Вес","key":"weight","type":"int"}]'::jsonb, 1, '#3fb6a8', false, 'Зелья и эликсиры: расходуемые предметы, отображаются колбами в инвентаре персонажа.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (11, 'Предыстории', '[{"name":"Владение навыками","key":"skills","type":"suggest_array","suggest_id":15},{"name":"Языки","key":"languages","type":"suggest_array","suggest_id":6},{"name":"Языки на выбор","key":"lang_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":1}]},{"name":"Владение инструментами","key":"tool_prof","type":"suggest_array","suggest_id":5},{"name":"Черта предыстории","key":"feature","type":"text"},{"name":"Описание черты","key":"feature_desc","type":"description"},{"name":"Стартовое снаряжение","key":"equipment","type":"description"},{"name":"Описание","key":"description","type":"description"}]'::jsonb, 1, '#c98a3a', true, 'Предыстории персонажей: владение навыками, инструменты, языки, черта предыстории и стартовое снаряжение.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.suggest_type (id, name, source_id, color, count_items)
VALUES (23, 'Редкость', 1, '#caa8ff', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.suggest (id, type_id, value, color, code) VALUES
    (0, 23, 'Обычное',      '#9aa0ad', 'common'),
    (1, 23, 'Необычное',    '#4fae6a', 'uncommon'),
    (2, 23, 'Редкое',       '#4f8fe0', 'rare'),
    (3, 23, 'Очень редкое', '#a26cf0', 'very_rare'),
    (4, 23, 'Легендарное',  '#f0b03c', 'legendary'),
    (5, 23, 'Артефакт',     '#e0524e', 'artifact')
ON CONFLICT (type_id, id) DO NOTHING;

-- Сиды вставляют явные id в bigserial-колонки — двигаем последовательности за максимум,
-- иначе nextval рано или поздно выдаст занятый id и вставка упадёт (23505). setval до MAX(id)
-- идемпотентен и безопасен на проде (последовательность уже не ниже максимума).
SELECT setval(pg_get_serial_sequence('dndshare.item_type', 'id'), GREATEST((SELECT MAX(id) FROM dndshare.item_type), 1));
SELECT setval(pg_get_serial_sequence('dndshare.suggest_type', 'id'), GREATEST((SELECT MAX(id) FROM dndshare.suggest_type), 1));
