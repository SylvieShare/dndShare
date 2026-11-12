CREATE SEQUENCE dndshare.error_report_event_delivery_seq;

CREATE TABLE dndshare.error_report_event (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delivery_id bigint UNIQUE,
    report_id bigint NOT NULL REFERENCES dndshare.error_report(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('created', 'approved', 'answered', 'reopened', 'serious-approved', 'recovered')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX error_report_event_unpublished ON dndshare.error_report_event(id) WHERE delivery_id IS NULL;

CREATE INDEX error_report_event_report_id ON dndshare.error_report_event(report_id);

-- Business transactions only append. The stream publisher assigns delivery IDs
-- to committed rows under its own lock, so late commits cannot be skipped by a
-- consumer cursor and report transactions never wait for the publisher's lock.
CREATE FUNCTION dndshare.emit_error_report_event() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE event_report_id bigint;
BEGIN
    IF TG_TABLE_NAME = 'error_report_message' THEN
        event_report_id := NEW.error_report_id;
    ELSE
        event_report_id := NEW.id;
    END IF;
    INSERT INTO dndshare.error_report_event(report_id, kind) VALUES (event_report_id, TG_ARGV[0]);
    RETURN NEW;
END;
$$;

CREATE TRIGGER error_report_created_event AFTER INSERT ON dndshare.error_report
FOR EACH ROW EXECUTE FUNCTION dndshare.emit_error_report_event('created');

CREATE TRIGGER error_report_approved_event AFTER UPDATE OF approved ON dndshare.error_report
FOR EACH ROW WHEN (NEW.approved AND NOT OLD.approved)
EXECUTE FUNCTION dndshare.emit_error_report_event('approved');

CREATE TRIGGER error_report_reopened_event AFTER UPDATE OF status ON dndshare.error_report
FOR EACH ROW WHEN (NEW.status = 'OPEN' AND OLD.status IN ('RESOLVED', 'ARCHIVED'))
EXECUTE FUNCTION dndshare.emit_error_report_event('reopened');

CREATE TRIGGER error_report_serious_approved_event AFTER UPDATE OF serious_change_approved_at ON dndshare.error_report
FOR EACH ROW WHEN (NEW.serious_change_approved_at IS NOT NULL AND OLD.serious_change_approved_at IS NULL)
EXECUTE FUNCTION dndshare.emit_error_report_event('serious-approved');

CREATE TRIGGER error_report_recovered_event AFTER UPDATE OF status ON dndshare.error_report
FOR EACH ROW WHEN (NEW.status = 'OPEN' AND OLD.status = 'IN_PROGRESS' AND (OLD.processing_expires_at IS NULL OR OLD.processing_expires_at <= CURRENT_TIMESTAMP))
EXECUTE FUNCTION dndshare.emit_error_report_event('recovered');

CREATE TRIGGER error_report_answered_event AFTER INSERT ON dndshare.error_report_message
FOR EACH ROW WHEN (NEW.sender = 'ADMIN')
EXECUTE FUNCTION dndshare.emit_error_report_event('answered');
