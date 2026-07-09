ALTER TABLE dndshare.session ADD COLUMN IF NOT EXISTS system_id BIGINT REFERENCES dndshare.source(id);
