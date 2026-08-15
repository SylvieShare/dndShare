
-- ---------------------------------------------------------------------------
-- Music library
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.music_album (
    id            bigserial NOT NULL,
    owner_user_id int8 NULL REFERENCES dndshare.users(id),
    "name"        varchar(255) NOT NULL,
    color         varchar(16) NULL,
    is_system     bool DEFAULT false NOT NULL,
    system_key    varchar(128) NULL,
    author        varchar(255) NULL,
    source_url    varchar(1024) NULL,
    license_name  varchar(64) NULL,
    license_url   varchar(1024) NULL,
    created_at    timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT music_album_pkey PRIMARY KEY (id),
    CONSTRAINT music_album_system_key_key UNIQUE (system_key),
    CONSTRAINT music_album_owner_or_system_check CHECK (
        (is_system AND owner_user_id IS NULL AND system_key IS NOT NULL)
        OR (NOT is_system AND owner_user_id IS NOT NULL AND system_key IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS music_album_owner_idx ON dndshare.music_album USING btree (owner_user_id);

ALTER TABLE dndshare.music_album ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE dndshare.music_album ADD COLUMN IF NOT EXISTS is_system bool DEFAULT false NOT NULL;
ALTER TABLE dndshare.music_album ADD COLUMN IF NOT EXISTS system_key varchar(128) NULL;
ALTER TABLE dndshare.music_album ADD COLUMN IF NOT EXISTS author varchar(255) NULL;
ALTER TABLE dndshare.music_album ADD COLUMN IF NOT EXISTS source_url varchar(1024) NULL;
ALTER TABLE dndshare.music_album ADD COLUMN IF NOT EXISTS license_name varchar(64) NULL;
ALTER TABLE dndshare.music_album ADD COLUMN IF NOT EXISTS license_url varchar(1024) NULL;

CREATE TABLE IF NOT EXISTS dndshare.music_track (
    id            bigserial NOT NULL,
    "uuid"        uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id int8 NULL REFERENCES dndshare.users(id),
    "name"        varchar(255) NOT NULL,
    file_key      varchar(512) NOT NULL,
    file_name     varchar(255) NOT NULL,
    duration_sec  int4 NULL,
    file_size     int8 NOT NULL,
    mime_type     varchar(64) NOT NULL,
    is_system     bool DEFAULT false NOT NULL,
    system_key    varchar(128) NULL,
    created_at    timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT music_track_pkey PRIMARY KEY (id),
    CONSTRAINT music_track_uuid_key UNIQUE (uuid),
    CONSTRAINT music_track_system_key_key UNIQUE (system_key),
    CONSTRAINT music_track_owner_or_system_check CHECK (
        (is_system AND owner_user_id IS NULL AND system_key IS NOT NULL)
        OR (NOT is_system AND owner_user_id IS NOT NULL AND system_key IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS music_track_owner_idx ON dndshare.music_track USING btree (owner_user_id);

ALTER TABLE dndshare.music_track ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE dndshare.music_track ADD COLUMN IF NOT EXISTS is_system bool DEFAULT false NOT NULL;
ALTER TABLE dndshare.music_track ADD COLUMN IF NOT EXISTS system_key varchar(128) NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'music_album_system_key_key') THEN
        ALTER TABLE dndshare.music_album ADD CONSTRAINT music_album_system_key_key UNIQUE (system_key);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'music_album_owner_or_system_check') THEN
        ALTER TABLE dndshare.music_album ADD CONSTRAINT music_album_owner_or_system_check CHECK (
            (is_system AND owner_user_id IS NULL AND system_key IS NOT NULL)
            OR (NOT is_system AND owner_user_id IS NOT NULL AND system_key IS NULL)
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'music_track_system_key_key') THEN
        ALTER TABLE dndshare.music_track ADD CONSTRAINT music_track_system_key_key UNIQUE (system_key);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'music_track_owner_or_system_check') THEN
        ALTER TABLE dndshare.music_track ADD CONSTRAINT music_track_owner_or_system_check CHECK (
            (is_system AND owner_user_id IS NULL AND system_key IS NOT NULL)
            OR (NOT is_system AND owner_user_id IS NOT NULL AND system_key IS NULL)
        );
    END IF;
END $$;

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

-- Built-in CC0 albums. Stable file_key values address versioned objects in S3;
-- source provenance and checksums live in internal/systemmusic.
INSERT INTO dndshare.music_album (
    owner_user_id, name, color, is_system, system_key, author,
    source_url, license_name, license_url
) VALUES
    (
        NULL, 'Фэнтези: странствия', '#5cb5e8', true,
        'fantasy-song-pack-v1', 'troubadour',
        'https://opengameart.org/content/fantasy-song-pack-volume-1',
        'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'
    ),
    (
        NULL, 'Таверны и города', '#e89c3c', true,
        'taverns-towns', 'Разные авторы OpenGameArt',
        'https://opengameart.org/',
        'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'
    ),
    (
        NULL, 'Подземелья и атмосфера', '#7c5ce2', true,
        'dungeons-atmosphere', 'Разные авторы OpenGameArt',
        'https://opengameart.org/',
        'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'
    ),
    (
        NULL, 'Бои', '#e85c5c', true,
        'battles', 'Разные авторы OpenGameArt',
        'https://opengameart.org/',
        'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'
    )
ON CONFLICT (system_key) DO UPDATE SET
    owner_user_id = NULL,
    name = EXCLUDED.name,
    color = EXCLUDED.color,
    is_system = true,
    author = EXCLUDED.author,
    source_url = EXCLUDED.source_url,
    license_name = EXCLUDED.license_name,
    license_url = EXCLUDED.license_url;

INSERT INTO dndshare.music_track (
    owner_user_id, name, file_key, file_name, duration_sec, file_size,
    mime_type, is_system, system_key
)
SELECT
    NULL, seed.name, seed.file_key, seed.file_name, seed.duration_sec,
    seed.file_size, seed.mime_type, true, seed.system_key
FROM (VALUES
    ('Back to Nature',             'system-music/v1/back_to_nature.mp3',      'back_to_nature.mp3',      168, 4113223::int8, 'audio/mpeg', 'fantasy-song-pack-v1/back-to-nature'),
    ('Bells of Winter',            'system-music/v1/bells_of_winter.mp3',     'bells_of_winter.mp3',     151, 2829923::int8, 'audio/mpeg', 'fantasy-song-pack-v1/bells-of-winter'),
    ('Fairy Lights',               'system-music/v1/fairy_lights.mp3',        'fairy_lights.mp3',        160, 3800642::int8, 'audio/mpeg', 'fantasy-song-pack-v1/fairy-lights'),
    ('Homestead',                  'system-music/v1/homestead.mp3',           'homestead.mp3',           147, 3293101::int8, 'audio/mpeg', 'fantasy-song-pack-v1/homestead'),
    ('Jaunt',                      'system-music/v1/jaunt.mp3',               'jaunt.mp3',               144, 3049408::int8, 'audio/mpeg', 'fantasy-song-pack-v1/jaunt'),
    ('Snow Day',                   'system-music/v1/snow_day.mp3',            'snow_day.mp3',            147, 3219005::int8, 'audio/mpeg', 'fantasy-song-pack-v1/snow-day'),
    ('Springly Sprigs',            'system-music/v1/springly_sprigs.mp3',     'springly_sprigs.mp3',     142, 3340593::int8, 'audio/mpeg', 'fantasy-song-pack-v1/springly-sprigs'),
    ('Wandering Woodlands',        'system-music/v1/wandering_woodlands.mp3', 'wandering_woodlands.mp3', 168, 3803448::int8, 'audio/mpeg', 'fantasy-song-pack-v1/wandering-woodlands'),
    ('Tavern',                     'system-music/v1/tavern.ogg',               'tavern.ogg',                62, 1034582::int8, 'audio/ogg',  'taverns-towns/tavern'),
    ('The Old Tower Inn',          'system-music/v1/old_tower_inn.mp3',       'old_tower_inn.mp3',        105, 2535801::int8, 'audio/mpeg', 'taverns-towns/old-tower-inn'),
    ('Town',                       'system-music/v1/town.mp3',                'town.mp3',                  64, 1537924::int8, 'audio/mpeg', 'taverns-towns/town'),
    ('Magic Town',                 'system-music/v1/magic_town.mp3',          'magic_town.mp3',            56, 1338809::int8, 'audio/mpeg', 'taverns-towns/magic-town'),
    ('Dungeon Ambience',           'system-music/v1/dungeon_ambience.ogg',    'dungeon_ambience.ogg',     206, 1202848::int8, 'audio/ogg',  'dungeons-atmosphere/dungeon-ambience'),
    ('Forest Ambience',            'system-music/v1/forest_ambience.mp3',     'forest_ambience.mp3',       45, 716670::int8,  'audio/mpeg', 'dungeons-atmosphere/forest-ambience'),
    ('Forgotten Tomb Ambience',    'system-music/v1/forgotten_tombs.mp3',     'forgotten_tombs.mp3',      214, 5140968::int8, 'audio/mpeg', 'dungeons-atmosphere/forgotten-tomb'),
    ('Mystical Place',             'system-music/v1/mystical_place.mp3',      'mystical_place.mp3',        62, 2482804::int8, 'audio/mpeg', 'dungeons-atmosphere/mystical-place'),
    ('Contemplation',              'system-music/v1/contemplation.mp3',       'contemplation.mp3',        120, 2405271::int8, 'audio/mpeg', 'dungeons-atmosphere/contemplation'),
    ('Battle Theme',               'system-music/v1/battle_theme.mp3',        'battle_theme.mp3',         116, 4646747::int8, 'audio/mpeg', 'battles/battle-theme'),
    ('Boss Fight',                 'system-music/v1/boss_fight.mp3',          'boss_fight.mp3',           129, 2068550::int8, 'audio/mpeg', 'battles/boss-fight'),
    ('JRPG Epic Rock Battle',      'system-music/v1/jrpg_battle.mp3',         'jrpg_battle.mp3',          115, 2929387::int8, 'audio/mpeg', 'battles/jrpg-battle'),
    ('Random Battle',              'system-music/v1/random_battle.mp3',       'random_battle.mp3',         37, 879890::int8,  'audio/mpeg', 'battles/random-battle')
) AS seed(name, file_key, file_name, duration_sec, file_size, mime_type, system_key)
ON CONFLICT (system_key) DO UPDATE SET
    owner_user_id = NULL,
    name = EXCLUDED.name,
    file_key = EXCLUDED.file_key,
    file_name = EXCLUDED.file_name,
    duration_sec = EXCLUDED.duration_sec,
    file_size = EXCLUDED.file_size,
    mime_type = EXCLUDED.mime_type,
    is_system = true;

INSERT INTO dndshare.music_album_track (album_id, track_id, position)
SELECT album.id, track.id, seed.position
FROM (VALUES
    ('fantasy-song-pack-v1', 'fantasy-song-pack-v1/back-to-nature', 1),
    ('fantasy-song-pack-v1', 'fantasy-song-pack-v1/bells-of-winter', 2),
    ('fantasy-song-pack-v1', 'fantasy-song-pack-v1/fairy-lights', 3),
    ('fantasy-song-pack-v1', 'fantasy-song-pack-v1/homestead', 4),
    ('fantasy-song-pack-v1', 'fantasy-song-pack-v1/jaunt', 5),
    ('fantasy-song-pack-v1', 'fantasy-song-pack-v1/snow-day', 6),
    ('fantasy-song-pack-v1', 'fantasy-song-pack-v1/springly-sprigs', 7),
    ('fantasy-song-pack-v1', 'fantasy-song-pack-v1/wandering-woodlands', 8),
    ('taverns-towns', 'taverns-towns/tavern', 1),
    ('taverns-towns', 'taverns-towns/old-tower-inn', 2),
    ('taverns-towns', 'taverns-towns/town', 3),
    ('taverns-towns', 'taverns-towns/magic-town', 4),
    ('dungeons-atmosphere', 'dungeons-atmosphere/dungeon-ambience', 1),
    ('dungeons-atmosphere', 'dungeons-atmosphere/forest-ambience', 2),
    ('dungeons-atmosphere', 'dungeons-atmosphere/forgotten-tomb', 3),
    ('dungeons-atmosphere', 'dungeons-atmosphere/mystical-place', 4),
    ('dungeons-atmosphere', 'dungeons-atmosphere/contemplation', 5),
    ('battles', 'battles/battle-theme', 1),
    ('battles', 'battles/boss-fight', 2),
    ('battles', 'battles/jrpg-battle', 3),
    ('battles', 'battles/random-battle', 4)
) AS seed(album_key, track_key, position)
JOIN dndshare.music_album album ON album.system_key = seed.album_key
JOIN dndshare.music_track track ON track.system_key = seed.track_key
ON CONFLICT (album_id, track_id) DO UPDATE SET position = EXCLUDED.position;

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

CREATE TABLE IF NOT EXISTS dndshare.session_arc (
    id          bigserial NOT NULL,
    session_id  int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    "order"     int4 NOT NULL,
    "name"      varchar(160) NOT NULL,
    description text NULL,
    CONSTRAINT session_arc_pk PRIMARY KEY (id),
    CONSTRAINT session_arc_session_order_key UNIQUE (session_id, "order")
);
CREATE INDEX IF NOT EXISTS idx_session_arc_session_id ON dndshare.session_arc USING btree (session_id, "order");

-- Every existing campaign gets a first arc before its chapters become arc-scoped.
INSERT INTO dndshare.session_arc (session_id, "order", "name")
SELECT s.id, 1, 'Основная арка'
FROM dndshare."session" s
WHERE NOT EXISTS (
    SELECT 1 FROM dndshare.session_arc arc WHERE arc.session_id = s.id
);

CREATE TABLE IF NOT EXISTS dndshare.session_chapter (
    id                 bigserial NOT NULL,
    session_id         int8 NOT NULL REFERENCES dndshare."session"(id),
    arc_id             int8 NULL,
    "number"           text NOT NULL,
    "name"             text NOT NULL,
    description        text NULL,
    status             varchar(32) DEFAULT 'planned' NOT NULL,
    image_preset_key   varchar(32) NULL,
    custom_image_id    int8 NULL REFERENCES dndshare.storage_image(id),
    image_focal_x      float8 DEFAULT 0.5 NOT NULL,
    image_focal_y      float8 DEFAULT 0.5 NOT NULL,
    position_x         float8 DEFAULT 0 NOT NULL,
    position_y         float8 DEFAULT 0 NOT NULL,
    CONSTRAINT session_chapter_pk PRIMARY KEY (id)
);

ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS arc_id int8 NULL;
ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS description text NULL;
ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS status varchar(32) DEFAULT 'planned' NOT NULL;
ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS image_preset_key varchar(32) NULL;
ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS custom_image_id int8 NULL REFERENCES dndshare.storage_image(id);
ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS image_focal_x float8 DEFAULT 0.5 NOT NULL;
ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS image_focal_y float8 DEFAULT 0.5 NOT NULL;
ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS position_x float8 DEFAULT 0 NOT NULL;
ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS position_y float8 DEFAULT 0 NOT NULL;
ALTER TABLE dndshare.session_chapter ALTER COLUMN "number" TYPE text USING "number"::text;

UPDATE dndshare.session_chapter chapter
SET arc_id = arc.id,
    position_x = (chapter."number"::float8 - 1) * 300,
    position_y = 80
FROM dndshare.session_arc arc
WHERE chapter.arc_id IS NULL
  AND arc.session_id = chapter.session_id
  AND arc."order" = 1;

ALTER TABLE dndshare.session_chapter ALTER COLUMN arc_id SET NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_chapter_arc_fk') THEN
        ALTER TABLE dndshare.session_chapter
            ADD CONSTRAINT session_chapter_arc_fk FOREIGN KEY (arc_id) REFERENCES dndshare.session_arc(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_chapter_arc_number_key') THEN
        ALTER TABLE dndshare.session_chapter
            ADD CONSTRAINT session_chapter_arc_number_key UNIQUE (arc_id, "number");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_chapter_status_check') THEN
        ALTER TABLE dndshare.session_chapter ADD CONSTRAINT session_chapter_status_check CHECK (
            status IN ('draft', 'planned', 'ready', 'available', 'in_progress',
                       'paused', 'completed', 'failed', 'skipped', 'cancelled')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_chapter_image_source_check') THEN
        ALTER TABLE dndshare.session_chapter ADD CONSTRAINT session_chapter_image_source_check CHECK (
            NOT (image_preset_key IS NOT NULL AND custom_image_id IS NOT NULL)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_chapter_session_id ON dndshare.session_chapter USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_session_chapter_arc_id ON dndshare.session_chapter USING btree (arc_id);

CREATE TABLE IF NOT EXISTS dndshare.session_chapter_edge (
    id              bigserial NOT NULL,
    arc_id          int8 NOT NULL REFERENCES dndshare.session_arc(id) ON DELETE CASCADE,
    from_chapter_id int8 NOT NULL REFERENCES dndshare.session_chapter(id) ON DELETE CASCADE,
    to_chapter_id   int8 NOT NULL REFERENCES dndshare.session_chapter(id) ON DELETE CASCADE,
    label           varchar(240) NULL,
    CONSTRAINT session_chapter_edge_pk PRIMARY KEY (id),
    CONSTRAINT session_chapter_edge_pair_key UNIQUE (from_chapter_id, to_chapter_id),
    CONSTRAINT session_chapter_edge_not_self CHECK (from_chapter_id <> to_chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_session_chapter_edge_arc_id ON dndshare.session_chapter_edge USING btree (arc_id);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_session_chapter_fk') THEN
        ALTER TABLE dndshare."session" ADD CONSTRAINT session_session_chapter_fk FOREIGN KEY (current_chapter_id) REFERENCES dndshare.session_chapter(id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS dndshare.session_scene (
    id         bigserial NOT NULL,
    chapter_id int8 NOT NULL REFERENCES dndshare.session_chapter(id),
    "name"     varchar NOT NULL,
    image_preset_key varchar DEFAULT 'discovery' NOT NULL,
    position_x float8 DEFAULT 0 NOT NULL,
    position_y float8 DEFAULT 0 NOT NULL,
    CONSTRAINT session_scene_pk PRIMARY KEY (id)
);
ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS position_x float8 NULL;
ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS position_y float8 NULL;
ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS image_preset_key varchar NULL;
CREATE INDEX IF NOT EXISTS idx_session_scene_chapter_id ON dndshare.session_scene USING btree (chapter_id);

UPDATE dndshare.session_scene
SET image_preset_key = 'discovery'
WHERE image_preset_key IS NULL
   OR image_preset_key NOT IN (
       'city', 'village', 'camp', 'road', 'forest', 'cave', 'ruins', 'castle',
       'tavern', 'dungeon', 'mountains', 'coast', 'battle', 'investigation',
       'negotiation', 'chase', 'puzzle', 'discovery'
   );
ALTER TABLE dndshare.session_scene ALTER COLUMN image_preset_key SET DEFAULT 'discovery';
ALTER TABLE dndshare.session_scene ALTER COLUMN image_preset_key SET NOT NULL;

-- Existing ordered scene lists become a readable first-pass graph. Coordinates
-- are persisted afterwards and are never derived from ids at runtime.
WITH scene_positions AS (
    SELECT id, row_number() OVER (PARTITION BY chapter_id ORDER BY id) - 1 AS node_index
    FROM dndshare.session_scene
)
UPDATE dndshare.session_scene scene
SET position_x = (scene_positions.node_index % 3) * 292,
    position_y = floor(scene_positions.node_index / 3.0) * 196
FROM scene_positions
WHERE scene.id = scene_positions.id
  AND (scene.position_x IS NULL OR scene.position_y IS NULL);
ALTER TABLE dndshare.session_scene ALTER COLUMN position_x SET DEFAULT 0;
ALTER TABLE dndshare.session_scene ALTER COLUMN position_y SET DEFAULT 0;
ALTER TABLE dndshare.session_scene ALTER COLUMN position_x SET NOT NULL;
ALTER TABLE dndshare.session_scene ALTER COLUMN position_y SET NOT NULL;

CREATE TABLE IF NOT EXISTS dndshare.session_scene_edge (
    id            bigserial NOT NULL,
    chapter_id    int8 NOT NULL REFERENCES dndshare.session_chapter(id) ON DELETE CASCADE,
    from_scene_id int8 NOT NULL REFERENCES dndshare.session_scene(id) ON DELETE CASCADE,
    to_scene_id   int8 NOT NULL REFERENCES dndshare.session_scene(id) ON DELETE CASCADE,
    label         varchar NULL,
    CONSTRAINT session_scene_edge_pk PRIMARY KEY (id),
    CONSTRAINT session_scene_edge_pair_key UNIQUE (from_scene_id, to_scene_id),
    CONSTRAINT session_scene_edge_not_self CHECK (from_scene_id <> to_scene_id)
);
CREATE INDEX IF NOT EXISTS idx_session_scene_edge_chapter_id ON dndshare.session_scene_edge USING btree (chapter_id);

CREATE TABLE IF NOT EXISTS dndshare.session_scene_item (
    id       bigserial NOT NULL,
    scene_id int8 NOT NULL REFERENCES dndshare.session_scene(id),
    "type"   text NOT NULL,
    title    varchar NOT NULL,
    "data"   jsonb NULL,
    position_x float8 DEFAULT 0 NOT NULL,
    position_y float8 DEFAULT 0 NOT NULL,
    width float8 DEFAULT 300 NOT NULL,
    CONSTRAINT session_scene_item_session_pk PRIMARY KEY (id)
);
ALTER TABLE dndshare.session_scene_item ADD COLUMN IF NOT EXISTS position_x float8 NULL;
ALTER TABLE dndshare.session_scene_item ADD COLUMN IF NOT EXISTS position_y float8 NULL;
ALTER TABLE dndshare.session_scene_item ADD COLUMN IF NOT EXISTS width float8 NULL;
ALTER TABLE dndshare.session_scene_item DROP COLUMN IF EXISTS color;
CREATE INDEX IF NOT EXISTS idx_session_scene_item_scene_id ON dndshare.session_scene_item USING btree (scene_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'dndshare'
          AND table_name = 'session_scene_item'
          AND column_name = 'order'
    ) THEN
        EXECUTE $migration$
            WITH item_positions AS (
                SELECT id, row_number() OVER (PARTITION BY scene_id ORDER BY "order", id) - 1 AS node_index
                FROM dndshare.session_scene_item
            )
            UPDATE dndshare.session_scene_item item
            SET position_x = (item_positions.node_index % 3) * 316,
                position_y = floor(item_positions.node_index / 3.0) * 220
            FROM item_positions
            WHERE item.id = item_positions.id
              AND (item.position_x IS NULL OR item.position_y IS NULL)
        $migration$;
        ALTER TABLE dndshare.session_scene_item DROP COLUMN "order";
    END IF;
END $$;
WITH item_positions AS (
    SELECT id, row_number() OVER (PARTITION BY scene_id ORDER BY id) - 1 AS node_index
    FROM dndshare.session_scene_item
)
UPDATE dndshare.session_scene_item item
SET position_x = (item_positions.node_index % 3) * 316,
    position_y = floor(item_positions.node_index / 3.0) * 220
FROM item_positions
WHERE item.id = item_positions.id
  AND (item.position_x IS NULL OR item.position_y IS NULL);
ALTER TABLE dndshare.session_scene_item ALTER COLUMN position_x SET DEFAULT 0;
ALTER TABLE dndshare.session_scene_item ALTER COLUMN position_y SET DEFAULT 0;
ALTER TABLE dndshare.session_scene_item ALTER COLUMN position_x SET NOT NULL;
ALTER TABLE dndshare.session_scene_item ALTER COLUMN position_y SET NOT NULL;
UPDATE dndshare.session_scene_item SET width = 300 WHERE width IS NULL OR width < 220 OR width > 640;
ALTER TABLE dndshare.session_scene_item ALTER COLUMN width SET DEFAULT 300;
ALTER TABLE dndshare.session_scene_item ALTER COLUMN width SET NOT NULL;

CREATE TABLE IF NOT EXISTS dndshare.session_scene_item_edge (
    id           bigserial NOT NULL,
    scene_id     int8 NOT NULL REFERENCES dndshare.session_scene(id) ON DELETE CASCADE,
    from_item_id int8 NOT NULL REFERENCES dndshare.session_scene_item(id) ON DELETE CASCADE,
    to_item_id   int8 NOT NULL REFERENCES dndshare.session_scene_item(id) ON DELETE CASCADE,
    label        varchar NULL,
    CONSTRAINT session_scene_item_edge_pk PRIMARY KEY (id),
    CONSTRAINT session_scene_item_edge_pair_key UNIQUE (from_item_id, to_item_id),
    CONSTRAINT session_scene_item_edge_not_self CHECK (from_item_id <> to_item_id)
);
CREATE INDEX IF NOT EXISTS idx_session_scene_item_edge_scene_id ON dndshare.session_scene_item_edge USING btree (scene_id);

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

-- Encounter combatants now keep only references and combat state. Former NPC
-- snapshots are folded into override once; the duplicated player name is
-- removed because display data always comes from the current character.
WITH normalized AS (
    SELECT encounter.id, COALESCE(jsonb_agg(
        CASE WHEN combatant ->> 'type' = 'npc' THEN
            (combatant - ARRAY['itemRaw', 'itemSvg', 'name', 'ac', 'hpMax', 'cr', 'creatureType'])
            || jsonb_build_object('override', CASE
                WHEN jsonb_typeof(combatant -> 'override') = 'object' THEN combatant -> 'override'
                ELSE jsonb_strip_nulls(jsonb_build_object(
                    'name', combatant -> 'name',
                    'ac', combatant -> 'ac',
                    'hp', combatant -> 'hpMax',
                    'cr', combatant -> 'cr',
                    'creature_type', combatant -> 'creatureType'
                ))
            END)
        WHEN combatant ->> 'type' = 'player' THEN
            combatant - 'name'
        ELSE combatant END
        ORDER BY ord
    ), '[]'::jsonb) AS combatants
    FROM dndshare.session_encounter encounter
    CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN jsonb_typeof(encounter.data -> 'combatants') = 'array' THEN encounter.data -> 'combatants'
        ELSE '[]'::jsonb
    END) WITH ORDINALITY rows(combatant, ord)
    WHERE encounter.data IS NOT NULL
      AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(CASE
          WHEN jsonb_typeof(encounter.data -> 'combatants') = 'array' THEN encounter.data -> 'combatants'
          ELSE '[]'::jsonb
      END) combatant
      WHERE (combatant ->> 'type' = 'npc'
             AND combatant ?| ARRAY['itemRaw', 'itemSvg', 'name', 'ac', 'hpMax', 'cr', 'creatureType'])
         OR (combatant ->> 'type' = 'player' AND combatant ? 'name')
      )
    GROUP BY encounter.id
)
UPDATE dndshare.session_encounter encounter
SET data = jsonb_set(encounter.data, '{combatants}', normalized.combatants, true),
    changed_at = now()
FROM normalized
WHERE encounter.id = normalized.id;

-- Existing encounters predate stable NPC letter markers. Assign A-Z by NPC
-- order once; encounters that already contain marker letters are left intact.
WITH combatant_rows AS (
    SELECT encounter.id,
           combatant,
           ord,
           count(*) FILTER (WHERE combatant ->> 'type' = 'npc') OVER (
               PARTITION BY encounter.id ORDER BY ord
           ) AS npc_ord
    FROM dndshare.session_encounter encounter
    CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN jsonb_typeof(encounter.data -> 'combatants') = 'array' THEN encounter.data -> 'combatants'
        ELSE '[]'::jsonb
    END) WITH ORDINALITY rows(combatant, ord)
    WHERE encounter.data IS NOT NULL
      AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(CASE
              WHEN jsonb_typeof(encounter.data -> 'combatants') = 'array' THEN encounter.data -> 'combatants'
              ELSE '[]'::jsonb
          END) npc
          WHERE npc ->> 'type' = 'npc'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(CASE
              WHEN jsonb_typeof(encounter.data -> 'combatants') = 'array' THEN encounter.data -> 'combatants'
              ELSE '[]'::jsonb
          END) npc
          WHERE npc ->> 'type' = 'npc' AND npc ? 'markerLetter'
      )
), lettered AS (
    SELECT id, jsonb_agg(
        CASE
            WHEN combatant ->> 'type' = 'npc' AND npc_ord <= 26
                THEN combatant || jsonb_build_object('markerLetter', chr(64 + npc_ord::int))
            ELSE combatant
        END
        ORDER BY ord
    ) AS combatants
    FROM combatant_rows
    GROUP BY id
)
UPDATE dndshare.session_encounter encounter
SET data = jsonb_set(encounter.data, '{combatants}', lettered.combatants, true),
    changed_at = now()
FROM lettered
WHERE encounter.id = lettered.id;

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
ALTER TABLE dndshare.session_event
    ADD COLUMN IF NOT EXISTS actor_char_id int8 NULL REFERENCES dndshare."char"(id),
    ADD COLUMN IF NOT EXISTS visibility varchar(16) DEFAULT 'public' NOT NULL,
    ADD COLUMN IF NOT EXISTS client_action_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_session_event_session_id ON dndshare.session_event USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_session_event_author_user_id ON dndshare.session_event USING btree (author_user_id);
CREATE INDEX IF NOT EXISTS idx_session_event_session_cursor ON dndshare.session_event USING btree (session_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_event_client_action
    ON dndshare.session_event USING btree (session_id, client_action_id)
    WHERE client_action_id IS NOT NULL;

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
    color      varchar(7) NULL,
    joined_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_participant_pkey PRIMARY KEY (id),
    CONSTRAINT session_participant_session_id_char_id_key UNIQUE (session_id, char_id)
);
ALTER TABLE dndshare.session_participant ADD COLUMN IF NOT EXISTS color varchar(7) NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_participant_color_check') THEN
        ALTER TABLE dndshare.session_participant ADD CONSTRAINT session_participant_color_check CHECK (
            color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'
        );
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_session_participant_char_id ON dndshare.session_participant USING btree (char_id);
CREATE INDEX IF NOT EXISTS idx_session_participant_user_id ON dndshare.session_participant USING btree (user_id);
