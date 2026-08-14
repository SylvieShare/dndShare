
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
