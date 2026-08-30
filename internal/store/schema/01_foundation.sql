-- Идемпотентная консолидированная схема (финальное состояние прежних Liquibase-миграций
-- v1..v3). Всё живёт в схеме `dndshare`. На существующей проде CREATE ... IF NOT EXISTS и
-- ON CONFLICT DO NOTHING — no-op; на чистой БД создаёт все таблицы, индексы и засевает
-- зарегистрированные системы, шаблоны и справочные строки, которые задавались миграциями
-- (item_type 7..11, suggest_type 23, роли). Базовые справочники item_type 1..6 и часть
-- suggest-типов требуют отдельного импорта каталога и на чистой БД не создаются.

CREATE SCHEMA IF NOT EXISTS dndshare;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS dndshare.schema_migration (
    code       text NOT NULL,
    checksum   text NOT NULL,
    applied_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT schema_migration_pk PRIMARY KEY (code)
);

-- ---------------------------------------------------------------------------
-- Auth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare."role" (
    id          bigserial NOT NULL,
    "name"      text NOT NULL,
    description text NULL,
    CONSTRAINT role_pk PRIMARY KEY (id)
);
INSERT INTO dndshare."role" ("name")
SELECT r FROM (VALUES ('NONE'), ('ADMIN'), ('HANDBOOK_ADMIN'), ('ERROR_REPORT_AUTO_APPROVE'), ('ERROR_REPORT_REVIEWER')) AS v(r)
WHERE NOT EXISTS (SELECT 1 FROM dndshare."role" e WHERE e."name" = v.r);

CREATE TABLE IF NOT EXISTS dndshare.users (
    id         bigserial NOT NULL,
    login      text NOT NULL,
    "password" text NOT NULL,
    email      text NULL,
    created_at timestamp DEFAULT now() NULL,
    CONSTRAINT users_pk PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_login_uindex ON dndshare.users USING btree (login);

CREATE TABLE IF NOT EXISTS dndshare.users_role (
    id         bigserial NOT NULL,
    user_id    int8 NOT NULL REFERENCES dndshare.users(id),
    role_id    int8 NOT NULL REFERENCES dndshare."role"(id),
    created_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT users_role_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS users_role_user_id_index ON dndshare.users_role USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_users_role_role_id ON dndshare.users_role USING btree (role_id);

DELETE FROM dndshare.users_role ur
USING dndshare."role" r
WHERE ur.role_id = r.id AND r.name = 'TEMPLATE_ADMIN';
DELETE FROM dndshare."role" WHERE name = 'TEMPLATE_ADMIN';

CREATE SEQUENCE IF NOT EXISTS dndshare.user_sessions_id_seq;
CREATE TABLE IF NOT EXISTS dndshare.users_session (
    id         int8 DEFAULT nextval('dndshare.user_sessions_id_seq'::regclass) NOT NULL,
    user_id    int8 NOT NULL REFERENCES dndshare.users(id),
    "session"  uuid NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT user_sessions_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS i_users_session ON dndshare.users_session USING btree (user_id, session);

-- ---------------------------------------------------------------------------
-- Logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.logs (
    id         bigserial NOT NULL,
    "path"     text NOT NULL,
    "type"     text NOT NULL,
    "desc"     text NOT NULL,
    trace      text NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT logs_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON dndshare.logs USING btree (created_at DESC);

-- ---------------------------------------------------------------------------
-- User error reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.error_report (
    id          bigserial NOT NULL,
    title       text NULL,
    description text NOT NULL,
    page_url    text NOT NULL,
    element     jsonb NOT NULL,
    screenshot  bytea NULL,
    screenshot_content_type varchar(50) NULL,
    viewport_screenshot bytea NULL,
    viewport_screenshot_content_type varchar(50) NULL,
    user_id     int8 NULL REFERENCES dndshare.users(id) ON DELETE SET NULL,
    approved    bool DEFAULT false NOT NULL,
    status      varchar(20) DEFAULT 'OPEN' NOT NULL,
    resolution  text NULL,
    resolved_commit_sha varchar(64) NULL,
    resolved_at timestamptz NULL,
    serious_change_reason text NULL,
    serious_change_requested_at timestamptz NULL,
    serious_change_approved_at timestamptz NULL,
    serious_change_approved_by_user_id int8 NULL,
    created_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT error_report_pk PRIMARY KEY (id)
);
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS title text NULL;
ALTER TABLE dndshare.error_report ALTER COLUMN title DROP NOT NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS screenshot bytea NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS screenshot_content_type varchar(50) NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS viewport_screenshot bytea NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS viewport_screenshot_content_type varchar(50) NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS approved bool DEFAULT false NOT NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'OPEN' NOT NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS resolution text NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS resolved_commit_sha varchar(64) NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS serious_change_reason text NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS serious_change_requested_at timestamptz NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS serious_change_approved_at timestamptz NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS serious_change_approved_by_user_id int8 NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS processing_run_id varchar(64) NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS processing_started_at timestamptz NULL;
ALTER TABLE dndshare.error_report ADD COLUMN IF NOT EXISTS processing_expires_at timestamptz NULL;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'error_report_serious_change_approved_by_fk'
          AND conrelid = 'dndshare.error_report'::regclass
    ) THEN
        ALTER TABLE dndshare.error_report
            ADD CONSTRAINT error_report_serious_change_approved_by_fk
            FOREIGN KEY (serious_change_approved_by_user_id)
            REFERENCES dndshare.users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    ALTER TABLE dndshare.error_report DROP CONSTRAINT IF EXISTS error_report_status_check;
    ALTER TABLE dndshare.error_report
        ADD CONSTRAINT error_report_status_check CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED'));
END $$;
CREATE INDEX IF NOT EXISTS idx_error_report_created_at ON dndshare.error_report USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_report_user_id ON dndshare.error_report USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_error_report_approved_created_at ON dndshare.error_report USING btree (created_at DESC) WHERE approved;
CREATE INDEX IF NOT EXISTS idx_error_report_open_approved_created_at
    ON dndshare.error_report USING btree (created_at DESC) WHERE approved AND status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_error_report_resolved_at
    ON dndshare.error_report USING btree (resolved_at) WHERE status = 'RESOLVED';
CREATE INDEX IF NOT EXISTS idx_error_report_processing_expires_at
    ON dndshare.error_report USING btree (processing_expires_at) WHERE status = 'IN_PROGRESS';
CREATE INDEX IF NOT EXISTS idx_error_report_serious_change_approved_by_user_id
    ON dndshare.error_report USING btree (serious_change_approved_by_user_id)
    WHERE serious_change_approved_by_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dndshare.error_report_message (
    id             bigserial NOT NULL,
    error_report_id int8 NOT NULL REFERENCES dndshare.error_report(id) ON DELETE CASCADE,
    sender         varchar(20) NOT NULL,
    message        text NOT NULL,
    admin_user_id  int8 NULL REFERENCES dndshare.users(id) ON DELETE SET NULL,
    created_at     timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT error_report_message_pk PRIMARY KEY (id),
    CONSTRAINT error_report_message_sender_check CHECK (sender IN ('AI', 'ADMIN'))
);
CREATE INDEX IF NOT EXISTS idx_error_report_message_report_id_id
    ON dndshare.error_report_message USING btree (error_report_id, id);

CREATE TABLE IF NOT EXISTS dndshare.error_report_automation_lock (
    id          int2 NOT NULL DEFAULT 1,
    token       varchar(64) NOT NULL,
    acquired_at timestamptz NOT NULL,
    expires_at  timestamptz NOT NULL,
    CONSTRAINT error_report_automation_lock_pk PRIMARY KEY (id),
    CONSTRAINT error_report_automation_lock_singleton CHECK (id = 1)
);

-- ---------------------------------------------------------------------------
-- Admin job runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.job_run (
    id                 bigserial NOT NULL,
    code               varchar(100) NOT NULL,
    "name"             varchar(200) NOT NULL,
    status             varchar(20) NOT NULL,
    current_value      int8 DEFAULT 0 NOT NULL,
    total_value        int8 NULL,
    message            text NULL,
    "error"            text NULL,
    "result"           jsonb NULL,
    started_by_user_id int8 NOT NULL REFERENCES dndshare.users(id),
    started_at         timestamptz DEFAULT now() NOT NULL,
    finished_at        timestamptz NULL,
    CONSTRAINT job_run_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_job_run_started_at ON dndshare.job_run USING btree (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_run_status_running ON dndshare.job_run USING btree (status) WHERE ((status)::text = 'RUNNING'::text);
CREATE INDEX IF NOT EXISTS idx_job_run_started_by_user_id ON dndshare.job_run USING btree (started_by_user_id);

-- ---------------------------------------------------------------------------
