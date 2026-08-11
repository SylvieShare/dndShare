
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
