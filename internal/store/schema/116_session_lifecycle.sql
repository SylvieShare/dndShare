ALTER TABLE dndshare."session"
    ADD COLUMN status text NOT NULL DEFAULT 'stopped'
    CHECK (status IN ('active', 'stopped', 'completed'));
