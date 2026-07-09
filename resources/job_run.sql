CREATE TABLE base.job_run (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0,
    total_value BIGINT,
    message TEXT,
    error TEXT,
    result JSONB,
    started_by_user_id BIGINT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX idx_job_run_started_at ON base.job_run (started_at DESC);
CREATE INDEX idx_job_run_status_running ON base.job_run (status) WHERE status = 'RUNNING';
