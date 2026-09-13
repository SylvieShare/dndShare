CREATE TABLE dndshare.item_transfer (
    id bigserial PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES dndshare."session"(id),
    sender_char_id bigint NOT NULL REFERENCES dndshare."char"(id),
    recipient_char_id bigint NOT NULL REFERENCES dndshare."char"(id),
    client_action_id uuid NOT NULL,
    event_id bigint NOT NULL UNIQUE REFERENCES dndshare.session_event(id),
    source text NOT NULL CHECK (source IN ('items', 'weapon', 'potions')),
    entry jsonb NOT NULL,
    item_name text NOT NULL,
    sender_name text NOT NULL,
    recipient_name text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    CHECK (sender_char_id <> recipient_char_id),
    UNIQUE (sender_char_id, client_action_id)
);
CREATE INDEX item_transfer_pending_sender ON dndshare.item_transfer(sender_char_id) WHERE status = 'pending';
CREATE INDEX item_transfer_pending_recipient ON dndshare.item_transfer(recipient_char_id) WHERE status = 'pending';

-- A member or campaign cannot disappear while it holds someone else's item.
CREATE FUNCTION dndshare.guard_pending_item_transfers() RETURNS trigger LANGUAGE plpgsql AS $$
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
CREATE TRIGGER pending_transfer_membership BEFORE DELETE ON dndshare.session_participant
    FOR EACH ROW EXECUTE FUNCTION dndshare.guard_pending_item_transfers();
CREATE TRIGGER pending_transfer_character BEFORE UPDATE OF deleted ON dndshare."char"
    FOR EACH ROW EXECUTE FUNCTION dndshare.guard_pending_item_transfers();
CREATE TRIGGER pending_transfer_session BEFORE UPDATE OF deleted ON dndshare."session"
    FOR EACH ROW EXECUTE FUNCTION dndshare.guard_pending_item_transfers();
