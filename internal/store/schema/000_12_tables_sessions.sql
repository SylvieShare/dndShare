-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE SEQUENCE dndshare.session_participant_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_participant_id_seq OWNED BY dndshare.session_participant.id;

CREATE TABLE dndshare.session_presentation_state (
    session_id bigint NOT NULL,
    mode character varying(16) DEFAULT 'idle'::character varying NOT NULL,
    visible boolean DEFAULT false NOT NULL,
    material_id bigint,
    effect character varying(24) DEFAULT 'none'::character varying NOT NULL,
    transition character varying(16) DEFAULT 'fade'::character varying NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    broadcast_music boolean DEFAULT false NOT NULL,
    show_health boolean DEFAULT false NOT NULL,
    show_graveyard boolean DEFAULT false NOT NULL,
    health_display character varying(16) DEFAULT 'numbers'::character varying NOT NULL,
    display_scale smallint DEFAULT 100 NOT NULL,
    CONSTRAINT session_presentation_display_scale_check CHECK (((display_scale >= 75) AND (display_scale <= 125))),
    CONSTRAINT session_presentation_effect_check CHECK (((effect)::text = ANY ((ARRAY['none'::character varying, 'rain'::character varying, 'fog'::character varying, 'embers'::character varying, 'snow'::character varying, 'storm'::character varying])::text[]))),
    CONSTRAINT session_presentation_health_display_check CHECK (((health_display)::text = ANY ((ARRAY['numbers'::character varying, 'words'::character varying])::text[]))),
    CONSTRAINT session_presentation_mode_check CHECK (((mode)::text = ANY ((ARRAY['idle'::character varying, 'material'::character varying, 'combat'::character varying])::text[]))),
    CONSTRAINT session_presentation_transition_check CHECK (((transition)::text = ANY ((ARRAY['cut'::character varying, 'fade'::character varying])::text[])))
);

CREATE TABLE dndshare.session_quest (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    name character varying(160) NOT NULL,
    status character varying(24) DEFAULT 'planned'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    goal text,
    condition_text text,
    reward text,
    consequences text,
    notes text,
    CONSTRAINT session_quest_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'active'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);

CREATE SEQUENCE dndshare.session_quest_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_quest_id_seq OWNED BY dndshare.session_quest.id;

CREATE TABLE dndshare.session_scene (
    id bigint NOT NULL,
    chapter_id bigint NOT NULL,
    name character varying NOT NULL,
    position_x double precision DEFAULT 0 NOT NULL,
    position_y double precision DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'none'::character varying NOT NULL,
    image_id bigint,
    location_id bigint,
    CONSTRAINT session_scene_status_check CHECK (((status)::text = ANY ((ARRAY['none'::character varying, 'draft'::character varying, 'planned'::character varying, 'ready'::character varying, 'available'::character varying, 'in_progress'::character varying, 'paused'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT session_scene_visual_source_check CHECK (((image_id IS NOT NULL) OR (location_id IS NOT NULL)))
);

CREATE TABLE dndshare.session_scene_edge (
    id bigint NOT NULL,
    chapter_id bigint NOT NULL,
    from_scene_id bigint NOT NULL,
    to_scene_id bigint NOT NULL,
    label character varying,
    bidirectional boolean DEFAULT false NOT NULL,
    CONSTRAINT session_scene_edge_not_self CHECK ((from_scene_id <> to_scene_id))
);

CREATE SEQUENCE dndshare.session_scene_edge_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_scene_edge_id_seq OWNED BY dndshare.session_scene_edge.id;

CREATE SEQUENCE dndshare.session_scene_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_scene_id_seq OWNED BY dndshare.session_scene.id;

CREATE TABLE dndshare.session_scene_item (
    id bigint NOT NULL,
    scene_id bigint NOT NULL,
    type text NOT NULL,
    title character varying NOT NULL,
    data jsonb,
    position_x double precision DEFAULT 0 NOT NULL,
    position_y double precision DEFAULT 0 NOT NULL,
    width double precision DEFAULT 300 NOT NULL,
    material_id bigint
);

CREATE TABLE dndshare.session_scene_item_edge (
    id bigint NOT NULL,
    scene_id bigint NOT NULL,
    from_item_id bigint NOT NULL,
    to_item_id bigint NOT NULL,
    label character varying,
    bidirectional boolean DEFAULT false NOT NULL,
    CONSTRAINT session_scene_item_edge_not_self CHECK ((from_item_id <> to_item_id))
);

CREATE SEQUENCE dndshare.session_scene_item_edge_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_scene_item_edge_id_seq OWNED BY dndshare.session_scene_item_edge.id;

CREATE SEQUENCE dndshare.session_scene_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_scene_item_id_seq OWNED BY dndshare.session_scene_item.id;

CREATE TABLE dndshare.session_timer (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    description character varying(160) NOT NULL,
    duration_ms bigint NOT NULL,
    ends_at timestamp with time zone,
    remaining_ms bigint,
    paused boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    broadcast boolean DEFAULT false NOT NULL,
    CONSTRAINT session_timer_duration_check CHECK (((duration_ms >= 1000) AND (duration_ms <= 604800000))),
    CONSTRAINT session_timer_state_check CHECK ((((paused = true) AND (ends_at IS NULL) AND (remaining_ms IS NOT NULL) AND (remaining_ms >= 0)) OR ((paused = false) AND (ends_at IS NOT NULL) AND (remaining_ms IS NULL))))
);

CREATE SEQUENCE dndshare.session_timer_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_timer_id_seq OWNED BY dndshare.session_timer.id;
