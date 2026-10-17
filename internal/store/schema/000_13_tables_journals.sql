-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TABLE dndshare.character_journal (
    char_id bigint NOT NULL,
    journal_id bigint NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE dndshare.journal (
    id bigint NOT NULL,
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id bigint,
    session_id bigint,
    name character varying(160) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    personal_char_id bigint,
    players_can_edit boolean DEFAULT true NOT NULL,
    graph_revision bigint DEFAULT 0 NOT NULL,
    CONSTRAINT journal_owner_xor_session CHECK (((owner_user_id IS NULL) <> (session_id IS NULL))),
    CONSTRAINT journal_personal_character_check CHECK (((owner_user_id IS NULL) = (personal_char_id IS NULL)))
);

CREATE TABLE dndshare.journal_entry (
    id bigint NOT NULL,
    section_id bigint NOT NULL,
    author_user_id bigint,
    "position" integer NOT NULL,
    entry_type character varying(24) NOT NULL,
    title character varying(255) DEFAULT ''::character varying NOT NULL,
    description_html text DEFAULT ''::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_scene_item_id bigint,
    source_snapshot jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by_user_id bigint,
    CONSTRAINT journal_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['battle'::character varying, 'dialog'::character varying, 'event'::character varying, 'newday'::character varying, 'quest'::character varying, 'header'::character varying])::text[])))
);

CREATE SEQUENCE dndshare.journal_entry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.journal_entry_id_seq OWNED BY dndshare.journal_entry.id;

CREATE SEQUENCE dndshare.journal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.journal_id_seq OWNED BY dndshare.journal.id;

CREATE TABLE dndshare.journal_link (
    journal_id bigint NOT NULL,
    from_id bigint NOT NULL,
    to_id bigint NOT NULL,
    label character varying(240) DEFAULT ''::character varying NOT NULL,
    CONSTRAINT journal_link_check CHECK ((from_id <> to_id))
);

CREATE TABLE dndshare.journal_node (
    entry_id bigint NOT NULL,
    journal_id bigint NOT NULL,
    position_x double precision DEFAULT 0 NOT NULL,
    position_y double precision DEFAULT 0 NOT NULL,
    CONSTRAINT journal_node_position_x_check CHECK (((position_x >= ('-1000000'::integer)::double precision) AND (position_x <= (1000000)::double precision))),
    CONSTRAINT journal_node_position_y_check CHECK (((position_y >= ('-1000000'::integer)::double precision) AND (position_y <= (1000000)::double precision)))
);

CREATE TABLE dndshare.journal_section (
    id bigint NOT NULL,
    journal_id bigint NOT NULL,
    "position" integer NOT NULL,
    title character varying(160) DEFAULT ''::character varying NOT NULL,
    event_date character varying(32) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    occurrence_id bigint
);

CREATE SEQUENCE dndshare.journal_section_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.journal_section_id_seq OWNED BY dndshare.journal_section.id;
