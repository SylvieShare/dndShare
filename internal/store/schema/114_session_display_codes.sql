CREATE FUNCTION dndshare.generate_display_code() RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
    alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    random_value bigint := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 15))::bit(60)::bigint;
    code text := '';
BEGIN
    FOR i IN 1..6 LOOP
        code := code || substr(alphabet, (random_value % 36)::int + 1, 1);
        random_value := random_value / 36;
    END LOOP;
    RETURN substr(code, 1, 3) || '-' || substr(code, 4, 3);
END;
$$;

ALTER TABLE dndshare.session ADD COLUMN display_code text;
ALTER TABLE dndshare.session ADD CONSTRAINT session_display_code_unique UNIQUE (display_code);
ALTER TABLE dndshare.session ADD CONSTRAINT session_display_code_format
    CHECK (display_code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$');

-- Retry collisions while assigning a permanent code to every existing session.
DO $$
DECLARE
    session_id bigint;
BEGIN
    FOR session_id IN SELECT id FROM dndshare.session LOOP
        LOOP
            BEGIN
                UPDATE dndshare.session SET display_code = dndshare.generate_display_code()
                WHERE id = session_id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                NULL;
            END;
        END LOOP;
    END LOOP;
END;
$$;

ALTER TABLE dndshare.session ALTER COLUMN display_code SET NOT NULL;
ALTER TABLE dndshare.session ALTER COLUMN display_code SET DEFAULT dndshare.generate_display_code();
