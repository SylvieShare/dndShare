CREATE TABLE dndshare.journal (
    id              bigserial NOT NULL,
    uuid            uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id   int8 NULL REFERENCES dndshare.users(id) ON DELETE CASCADE,
    session_id      int8 NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    name            varchar(160) NOT NULL,
    created_at      timestamptz DEFAULT now() NOT NULL,
    changed_at      timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT journal_pk PRIMARY KEY (id),
    CONSTRAINT journal_uuid_key UNIQUE (uuid),
    CONSTRAINT journal_owner_xor_session CHECK ((owner_user_id IS NULL) <> (session_id IS NULL)),
    CONSTRAINT journal_session_key UNIQUE (session_id)
);
CREATE INDEX idx_journal_owner_user_id ON dndshare.journal (owner_user_id, changed_at DESC);

CREATE TABLE dndshare.character_journal (
    char_id      int8 NOT NULL REFERENCES dndshare."char"(id) ON DELETE CASCADE,
    journal_id   int8 NOT NULL REFERENCES dndshare.journal(id) ON DELETE CASCADE,
    linked_at    timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT character_journal_pk PRIMARY KEY (char_id)
);
CREATE INDEX idx_character_journal_journal_id ON dndshare.character_journal (journal_id);

CREATE TABLE dndshare.journal_section (
    id          bigserial NOT NULL,
    journal_id  int8 NOT NULL REFERENCES dndshare.journal(id) ON DELETE CASCADE,
    position    int4 NOT NULL,
    title       varchar(160) NOT NULL DEFAULT '',
    event_date  varchar(32) NOT NULL DEFAULT '',
    created_at  timestamptz DEFAULT now() NOT NULL,
    changed_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT journal_section_pk PRIMARY KEY (id),
    CONSTRAINT journal_section_position_key UNIQUE (journal_id, position)
);
CREATE INDEX idx_journal_section_journal_id ON dndshare.journal_section (journal_id, position);

CREATE TABLE dndshare.journal_entry (
    id                    bigserial NOT NULL,
    section_id            int8 NOT NULL REFERENCES dndshare.journal_section(id) ON DELETE CASCADE,
    author_user_id        int8 NULL REFERENCES dndshare.users(id) ON DELETE SET NULL,
    position              int4 NOT NULL,
    entry_type            varchar(24) NOT NULL,
    title                 varchar(255) NOT NULL DEFAULT '',
    description_html      text NOT NULL DEFAULT '',
    payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
    source_scene_item_id  int8 NULL REFERENCES dndshare.session_scene_item(id) ON DELETE SET NULL,
    source_snapshot       jsonb NULL,
    created_at            timestamptz DEFAULT now() NOT NULL,
    changed_at            timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT journal_entry_pk PRIMARY KEY (id),
    CONSTRAINT journal_entry_type_check CHECK (entry_type IN ('battle', 'dialog', 'event', 'newday')),
    CONSTRAINT journal_entry_position_key UNIQUE (section_id, position)
);
CREATE INDEX idx_journal_entry_section_id ON dndshare.journal_entry (section_id, position);

-- Convert the former character JSON diary once. Each character receives its own
-- personal journal so existing private chronicles never become visible to a party.
DO $$
DECLARE
    character_row record;
    section_row record;
    entry_row record;
    new_journal_id int8;
    new_section_id int8;
    journal_name text;
BEGIN
    FOR character_row IN
        SELECT c.id, c.user_id, c.data::jsonb AS data
        FROM dndshare."char" c
        WHERE jsonb_typeof(c.data::jsonb #> '{values,diary}') = 'array'
          AND jsonb_array_length(c.data::jsonb #> '{values,diary}') > 0
          AND NOT EXISTS (SELECT 1 FROM dndshare.character_journal link WHERE link.char_id = c.id)
    LOOP
        journal_name := left(COALESCE(NULLIF(btrim(character_row.data #>> '{values,name}'), ''), 'Личный дневник'), 160);
        IF journal_name <> 'Личный дневник' THEN
            journal_name := left('Дневник · ' || journal_name, 160);
        END IF;

        INSERT INTO dndshare.journal (owner_user_id, name)
        VALUES (character_row.user_id, journal_name)
        RETURNING id INTO new_journal_id;

        FOR section_row IN
            SELECT value, ordinality
            FROM jsonb_array_elements(character_row.data #> '{values,diary}') WITH ORDINALITY
        LOOP
            INSERT INTO dndshare.journal_section (journal_id, position, title, event_date)
            VALUES (
                new_journal_id,
                section_row.ordinality,
                left(COALESCE(section_row.value->>'title', ''), 160),
                left(COALESCE(section_row.value->>'date', ''), 32)
            ) RETURNING id INTO new_section_id;

            IF jsonb_typeof(section_row.value->'events') = 'array' THEN
                FOR entry_row IN
                    SELECT value, ordinality
                    FROM jsonb_array_elements(section_row.value->'events') WITH ORDINALITY
                LOOP
                    INSERT INTO dndshare.journal_entry (
                        section_id, author_user_id, position, entry_type, title,
                        description_html, payload
                    ) VALUES (
                        new_section_id,
                        character_row.user_id,
                        entry_row.ordinality,
                        CASE WHEN entry_row.value->>'type' IN ('battle', 'dialog', 'event', 'newday')
                            THEN entry_row.value->>'type' ELSE 'event' END,
                        left(COALESCE(entry_row.value->>'title', ''), 255),
                        COALESCE(entry_row.value->>'desc', ''),
                        jsonb_build_object(
                            'dialogue', COALESCE(entry_row.value->'dialogue', '[]'::jsonb),
                            'combatants', COALESCE(entry_row.value->'combatants', '[]'::jsonb)
                        )
                    );
                END LOOP;
            END IF;
        END LOOP;

        INSERT INTO dndshare.character_journal (char_id, journal_id)
        VALUES (character_row.id, new_journal_id);
    END LOOP;

    UPDATE dndshare."char"
    SET data = jsonb_set(
            data::jsonb,
            '{values}',
            COALESCE(data::jsonb->'values', '{}'::jsonb) - 'diary',
            true
        )::json,
        changed_at = now(),
        "version" = "version" + 1
    WHERE data::jsonb #> '{values,diary}' IS NOT NULL;
END $$;
