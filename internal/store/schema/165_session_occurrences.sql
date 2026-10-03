-- A campaign contains dated game meetings. Each meeting owns one journal section.
CREATE TABLE dndshare.session_occurrence (
    id bigserial PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    number integer NOT NULL CHECK (number > 0),
    name varchar(160) NOT NULL,
    scheduled_on date,
    changed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, number)
);
CREATE INDEX session_occurrence_schedule ON dndshare.session_occurrence (session_id, scheduled_on, number);
ALTER TABLE dndshare.journal_section ADD COLUMN occurrence_id bigint UNIQUE
    REFERENCES dndshare.session_occurrence(id) ON DELETE CASCADE;

-- Legacy section dates were free text, including fictional calendar dates.
-- Parse only unambiguous real dates; leave other meetings undated and retain
-- the original section fields and all entries for lossless migration.
CREATE FUNCTION pg_temp.occurrence_date(value text) RETURNS date LANGUAGE plpgsql AS $$
DECLARE parsed date;
BEGIN
    IF value ~ '^\d{4}-\d{2}-\d{2}$' THEN
        parsed := value::date;
        IF to_char(parsed, 'YYYY-MM-DD') = value THEN RETURN parsed; END IF;
    ELSIF value ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
        parsed := to_date(value, 'DD.MM.YYYY');
        IF to_char(parsed, 'DD.MM.YYYY') = value THEN RETURN parsed; END IF;
    END IF;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DO $$
DECLARE section record; occurrence bigint;
BEGIN
    FOR section IN
        SELECT js.*, j.session_id,
            row_number() OVER (PARTITION BY j.session_id ORDER BY js.position, js.id)::integer AS meeting_number
        FROM dndshare.journal_section js JOIN dndshare.journal j ON j.id = js.journal_id
        WHERE j.session_id IS NOT NULL
    LOOP
        INSERT INTO dndshare.session_occurrence (session_id, number, name, scheduled_on, changed_at)
        VALUES (section.session_id, section.meeting_number,
            COALESCE(NULLIF(btrim(section.title), ''), 'Сессия ' || section.meeting_number),
            pg_temp.occurrence_date(btrim(section.event_date)), section.changed_at)
        RETURNING id INTO occurrence;
        UPDATE dndshare.journal_section SET occurrence_id = occurrence WHERE id = section.id;
    END LOOP;
END $$;
