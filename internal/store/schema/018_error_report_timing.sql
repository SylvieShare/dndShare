CREATE TABLE dndshare.error_report_work_interval (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    error_report_id bigint NOT NULL REFERENCES dndshare.error_report(id) ON DELETE CASCADE,
    phase text NOT NULL CHECK (phase IN ('analysis', 'fix', 'test', 'deploy')),
    started_at timestamptz NOT NULL,
    ended_at timestamptz,
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX error_report_work_interval_report_idx
    ON dndshare.error_report_work_interval(error_report_id, id);
CREATE UNIQUE INDEX error_report_work_interval_active_idx
    ON dndshare.error_report_work_interval(error_report_id) WHERE ended_at IS NULL;

CREATE FUNCTION dndshare.close_error_report_work_interval() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'IN_PROGRESS' AND (
        NEW.status <> 'IN_PROGRESS' OR
        NEW.processing_run_id IS DISTINCT FROM OLD.processing_run_id OR
        NOT NEW.approved
    ) THEN
        UPDATE dndshare.error_report_work_interval
        SET ended_at = GREATEST(started_at, LEAST(clock_timestamp(),
            COALESCE(OLD.processing_expires_at, clock_timestamp())))
        WHERE error_report_id = OLD.id AND ended_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER error_report_close_work_interval
AFTER UPDATE OF status, processing_run_id, approved ON dndshare.error_report
FOR EACH ROW EXECUTE FUNCTION dndshare.close_error_report_work_interval();
