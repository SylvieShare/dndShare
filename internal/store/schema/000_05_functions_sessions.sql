-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE FUNCTION dndshare.generate_display_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
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

CREATE FUNCTION dndshare.guard_pending_item_transfers() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'session_participant' THEN
        PERFORM id FROM dndshare."char" WHERE id = OLD.char_id FOR UPDATE;
        IF EXISTS (SELECT 1 FROM dndshare.item_transfer WHERE status = 'pending'
                   AND (sender_char_id = OLD.char_id OR recipient_char_id = OLD.char_id)) THEN
            RAISE EXCEPTION 'Сначала завершите передачи предметов участника' USING ERRCODE = 'PIT01';
        END IF;
        RETURN OLD;
    END IF;
    IF NEW.deleted AND NOT OLD.deleted THEN
        IF EXISTS (SELECT 1 FROM dndshare.item_transfer WHERE status = 'pending' AND
            ((TG_TABLE_NAME = 'char' AND (sender_char_id = OLD.id OR recipient_char_id = OLD.id))
             OR (TG_TABLE_NAME = 'session' AND session_id = OLD.id))) THEN
            RAISE EXCEPTION 'Сначала завершите передачи предметов' USING ERRCODE = 'PIT01';
        END IF;
    END IF;
    RETURN NEW;
END $$;
