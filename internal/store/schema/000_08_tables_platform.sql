-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TABLE dndshare.dictionary_text (
    id bigint NOT NULL,
    lang text NOT NULL,
    keyset text NOT NULL,
    key text NOT NULL,
    value text NOT NULL
);

CREATE SEQUENCE dndshare.dictionary_text_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.dictionary_text_id_seq OWNED BY dndshare.dictionary_text.id;

CREATE TABLE dndshare.error_report (
    id bigint NOT NULL,
    description text NOT NULL,
    page_url text NOT NULL,
    element jsonb NOT NULL,
    user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    screenshot bytea,
    screenshot_content_type character varying(50),
    approved boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    resolution text,
    resolved_commit_sha character varying(64),
    resolved_at timestamp with time zone,
    viewport_screenshot bytea,
    viewport_screenshot_content_type character varying(50),
    title text,
    serious_change_reason text,
    serious_change_requested_at timestamp with time zone,
    serious_change_approved_at timestamp with time zone,
    serious_change_approved_by_user_id bigint,
    processing_run_id character varying(64),
    processing_started_at timestamp with time zone,
    processing_expires_at timestamp with time zone,
    CONSTRAINT error_report_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'IN_PROGRESS'::character varying, 'RESOLVED'::character varying, 'ARCHIVED'::character varying])::text[])))
);

CREATE TABLE dndshare.error_report_automation_lock (
    id smallint DEFAULT 1 NOT NULL,
    token character varying(64) NOT NULL,
    acquired_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT error_report_automation_lock_singleton CHECK ((id = 1))
);

CREATE SEQUENCE dndshare.error_report_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.error_report_id_seq OWNED BY dndshare.error_report.id;

CREATE TABLE dndshare.error_report_message (
    id bigint NOT NULL,
    error_report_id bigint NOT NULL,
    sender character varying(20) NOT NULL,
    message text NOT NULL,
    admin_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT error_report_message_sender_check CHECK (((sender)::text = ANY ((ARRAY['AI'::character varying, 'ADMIN'::character varying])::text[])))
);

CREATE SEQUENCE dndshare.error_report_message_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.error_report_message_id_seq OWNED BY dndshare.error_report_message.id;

CREATE TABLE dndshare.job_run (
    id bigint NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    status character varying(20) NOT NULL,
    current_value bigint DEFAULT 0 NOT NULL,
    total_value bigint,
    message text,
    error text,
    result jsonb,
    started_by_user_id bigint NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone
);

CREATE SEQUENCE dndshare.job_run_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.job_run_id_seq OWNED BY dndshare.job_run.id;

CREATE TABLE dndshare.logs (
    id bigint NOT NULL,
    path text NOT NULL,
    type text NOT NULL,
    "desc" text NOT NULL,
    trace text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE dndshare.logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.logs_id_seq OWNED BY dndshare.logs.id;

CREATE TABLE dndshare.music_album (
    id bigint NOT NULL,
    owner_user_id bigint,
    name character varying(255) NOT NULL,
    color character varying(16),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    system_key character varying(128),
    author character varying(255),
    source_url character varying(1024),
    license_name character varying(64),
    license_url character varying(1024),
    CONSTRAINT music_album_owner_or_system_check CHECK (((is_system AND (owner_user_id IS NULL) AND (system_key IS NOT NULL)) OR ((NOT is_system) AND (owner_user_id IS NOT NULL) AND (system_key IS NULL))))
);

CREATE SEQUENCE dndshare.music_album_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.music_album_id_seq OWNED BY dndshare.music_album.id;

CREATE TABLE dndshare.music_album_track (
    id bigint NOT NULL,
    album_id bigint NOT NULL,
    track_id bigint NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);

CREATE SEQUENCE dndshare.music_album_track_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.music_album_track_id_seq OWNED BY dndshare.music_album_track.id;

CREATE TABLE dndshare.music_tag (
    id bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    name character varying(64) NOT NULL
);

CREATE SEQUENCE dndshare.music_tag_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.music_tag_id_seq OWNED BY dndshare.music_tag.id;

CREATE TABLE dndshare.music_track (
    id bigint NOT NULL,
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id bigint,
    name character varying(255) NOT NULL,
    file_key character varying(512) NOT NULL,
    file_name character varying(255) NOT NULL,
    duration_sec integer,
    file_size bigint NOT NULL,
    mime_type character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    system_key character varying(128),
    CONSTRAINT music_track_owner_or_system_check CHECK (((is_system AND (owner_user_id IS NULL) AND (system_key IS NOT NULL)) OR ((NOT is_system) AND (owner_user_id IS NOT NULL) AND (system_key IS NULL))))
);

CREATE SEQUENCE dndshare.music_track_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.music_track_id_seq OWNED BY dndshare.music_track.id;

CREATE TABLE dndshare.music_track_tag (
    track_id bigint NOT NULL,
    tag_id bigint NOT NULL
);

CREATE TABLE dndshare.role (
    id bigint NOT NULL,
    name text NOT NULL,
    description text
);

CREATE SEQUENCE dndshare.role_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.role_id_seq OWNED BY dndshare.role.id;

CREATE TABLE dndshare.storage_image (
    id bigint NOT NULL,
    user_id bigint,
    bytes bytea,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    key character varying,
    deleted boolean DEFAULT false NOT NULL,
    url character varying,
    type character varying,
    file_size bigint,
    file_name character varying(255),
    mime_type character varying(128),
    CONSTRAINT storage_image_file_size_check CHECK (((file_size IS NULL) OR (file_size >= 0)))
);

CREATE SEQUENCE dndshare.storage_image_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.storage_image_id_seq OWNED BY dndshare.storage_image.id;

CREATE TABLE dndshare.users_session (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    session uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE dndshare.user_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.user_sessions_id_seq OWNED BY dndshare.users_session.id;

CREATE TABLE dndshare.user_tutorial (
    user_id bigint NOT NULL,
    flow_id text NOT NULL,
    source_key text NOT NULL,
    device text NOT NULL,
    revision integer NOT NULL,
    status text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_tutorial_device_check CHECK ((device = ANY (ARRAY['desktop'::text, 'mobile'::text]))),
    CONSTRAINT user_tutorial_flow_id_check CHECK ((flow_id = ANY (ARRAY['character'::text, 'session-player'::text, 'session-dm'::text]))),
    CONSTRAINT user_tutorial_revision_check CHECK ((revision > 0)),
    CONSTRAINT user_tutorial_source_key_check CHECK ((source_key ~ '^(source:[1-9][0-9]*|edition:[1-9][0-9]*|unassigned)$'::text)),
    CONSTRAINT user_tutorial_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'dismissed'::text])))
);

CREATE TABLE dndshare.users (
    id bigint NOT NULL,
    login text NOT NULL,
    password text NOT NULL,
    email text,
    created_at timestamp without time zone DEFAULT now(),
    source_version_id bigint NOT NULL
);

CREATE SEQUENCE dndshare.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.users_id_seq OWNED BY dndshare.users.id;

CREATE TABLE dndshare.users_role (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    role_id bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE dndshare.users_role_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.users_role_id_seq OWNED BY dndshare.users_role.id;
