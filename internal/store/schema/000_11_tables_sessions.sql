-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TABLE dndshare.session_encounter (
    id bigint CONSTRAINT encounter_id_not_null NOT NULL,
    session_id bigint CONSTRAINT encounter_session_id_not_null NOT NULL,
    name character varying(255),
    status character varying(32) DEFAULT 'pending'::character varying CONSTRAINT encounter_status_not_null NOT NULL,
    round integer DEFAULT 0 CONSTRAINT encounter_round_not_null NOT NULL,
    data jsonb,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT encounter_created_at_not_null NOT NULL,
    changed_at timestamp with time zone DEFAULT now() CONSTRAINT encounter_changed_at_not_null NOT NULL,
    deleted boolean DEFAULT false CONSTRAINT encounter_deleted_not_null NOT NULL
);

CREATE SEQUENCE dndshare.encounter_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.encounter_id_seq OWNED BY dndshare.session_encounter.id;

CREATE TABLE dndshare.session (
    id bigint NOT NULL,
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    system_id bigint NOT NULL,
    invite_code character varying(16) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    encounter jsonb,
    current_chapter_id bigint,
    display_code text DEFAULT dndshare.generate_display_code() NOT NULL,
    status text DEFAULT 'stopped'::text NOT NULL,
    settings jsonb DEFAULT '{"combat": {"autoRollNpcHp": false}, "players": {"seeHp": false, "seeRace": true, "seeClass": true, "openSheets": true}, "autoAccept": {"items": false, "spells": false, "potions": false}, "karmicDice": {"enabled": false, "separate": false}, "interactions": {"items": true, "spells": true, "potions": true}}'::jsonb NOT NULL,
    source_version_id bigint,
    CONSTRAINT session_display_code_format CHECK ((display_code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$'::text)),
    CONSTRAINT session_settings_object CHECK ((jsonb_typeof(settings) = 'object'::text)),
    CONSTRAINT session_status_check CHECK ((status = ANY (ARRAY['active'::text, 'stopped'::text, 'completed'::text])))
);

CREATE TABLE dndshare.session_arc (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    "order" integer NOT NULL,
    name character varying(160) NOT NULL,
    description text
);

CREATE SEQUENCE dndshare.session_arc_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_arc_id_seq OWNED BY dndshare.session_arc.id;

CREATE TABLE dndshare.session_chapter (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    number text NOT NULL,
    name text NOT NULL,
    arc_id bigint NOT NULL,
    description text,
    status character varying(32) DEFAULT 'none'::character varying NOT NULL,
    image_focal_x double precision DEFAULT 0.5 NOT NULL,
    image_focal_y double precision DEFAULT 0.5 NOT NULL,
    position_x double precision DEFAULT 0 NOT NULL,
    position_y double precision DEFAULT 0 NOT NULL,
    image_id bigint NOT NULL,
    CONSTRAINT session_chapter_status_check CHECK (((status)::text = ANY ((ARRAY['none'::character varying, 'draft'::character varying, 'planned'::character varying, 'ready'::character varying, 'available'::character varying, 'in_progress'::character varying, 'paused'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying, 'cancelled'::character varying])::text[])))
);

CREATE TABLE dndshare.session_chapter_edge (
    id bigint NOT NULL,
    arc_id bigint NOT NULL,
    from_chapter_id bigint NOT NULL,
    to_chapter_id bigint NOT NULL,
    label character varying(240),
    bidirectional boolean DEFAULT false NOT NULL,
    CONSTRAINT session_chapter_edge_not_self CHECK ((from_chapter_id <> to_chapter_id))
);

CREATE SEQUENCE dndshare.session_chapter_edge_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_chapter_edge_id_seq OWNED BY dndshare.session_chapter_edge.id;

CREATE SEQUENCE dndshare.session_chapter_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_chapter_id_seq OWNED BY dndshare.session_chapter.id;

CREATE TABLE dndshare.session_d20_roll (
    session_id bigint NOT NULL,
    request_id uuid NOT NULL,
    user_id bigint NOT NULL,
    request jsonb NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE dndshare.session_entity_relation (
    session_id bigint NOT NULL,
    left_type character varying(16) NOT NULL,
    left_id bigint NOT NULL,
    right_type character varying(16) NOT NULL,
    right_id bigint NOT NULL,
    note character varying(500),
    CONSTRAINT session_entity_relation_left_type_check CHECK (((left_type)::text = ANY ((ARRAY['location'::character varying, 'npc'::character varying, 'material'::character varying, 'quest'::character varying])::text[]))),
    CONSTRAINT session_entity_relation_order_check CHECK ((ROW((left_type)::text, left_id) < ROW((right_type)::text, right_id))),
    CONSTRAINT session_entity_relation_right_type_check CHECK (((right_type)::text = ANY ((ARRAY['location'::character varying, 'npc'::character varying, 'material'::character varying, 'quest'::character varying])::text[])))
);

CREATE TABLE dndshare.session_event (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    author_user_id bigint NOT NULL,
    event_type character varying(32) NOT NULL,
    data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    actor_char_id bigint,
    visibility character varying(16) DEFAULT 'public'::character varying NOT NULL,
    client_action_id uuid,
    actor_name character varying(160),
    action character varying(255) NOT NULL,
    actor_item_id bigint
);

CREATE SEQUENCE dndshare.session_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_event_id_seq OWNED BY dndshare.session_event.id;

CREATE SEQUENCE dndshare.session_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_id_seq OWNED BY dndshare.session.id;

CREATE TABLE dndshare.session_image_catalog (
    image_id bigint NOT NULL,
    catalog_key character varying(64) NOT NULL,
    scope character varying(16) NOT NULL,
    category_key character varying(32) NOT NULL,
    category_label character varying(80) NOT NULL,
    label character varying(80) NOT NULL,
    sort_order integer NOT NULL,
    CONSTRAINT session_image_catalog_scope_check CHECK (((scope)::text = ANY ((ARRAY['story'::character varying, 'npc'::character varying])::text[])))
);

CREATE TABLE dndshare.session_interaction (
    event_id bigint NOT NULL,
    session_id bigint NOT NULL,
    sender_char_id bigint NOT NULL,
    recipient_char_id bigint NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sender_choice text,
    recipient_choice text,
    read_at timestamp with time zone,
    CONSTRAINT session_interaction_check CHECK ((sender_char_id <> recipient_char_id)),
    CONSTRAINT session_interaction_kind_check CHECK ((kind = ANY (ARRAY['chat_message'::text, 'rps_challenge'::text]))),
    CONSTRAINT session_interaction_recipient_choice_check CHECK ((recipient_choice = ANY (ARRAY['rock'::text, 'scissors'::text, 'paper'::text]))),
    CONSTRAINT session_interaction_round_check CHECK ((((kind = 'chat_message'::text) AND (status = 'pending'::text) AND (sender_choice IS NULL) AND (recipient_choice IS NULL)) OR ((kind = 'rps_challenge'::text) AND (((status = ANY (ARRAY['pending'::text, 'declined'::text, 'cancelled'::text])) AND (sender_choice IS NULL) AND (recipient_choice IS NULL)) OR ((status = 'choosing'::text) AND ((sender_choice IS NULL) OR (recipient_choice IS NULL))) OR ((status = 'completed'::text) AND (sender_choice IS NOT NULL) AND (recipient_choice IS NOT NULL)))))),
    CONSTRAINT session_interaction_sender_choice_check CHECK ((sender_choice = ANY (ARRAY['rock'::text, 'scissors'::text, 'paper'::text]))),
    CONSTRAINT session_interaction_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'choosing'::text, 'completed'::text, 'declined'::text, 'cancelled'::text])))
);

CREATE TABLE dndshare.session_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id bigint NOT NULL,
    source text NOT NULL,
    entry jsonb NOT NULL,
    item_name text NOT NULL,
    available boolean DEFAULT true NOT NULL,
    client_action_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    slot integer NOT NULL,
    CONSTRAINT session_inventory_slot_nonnegative CHECK ((slot >= 0)),
    CONSTRAINT session_inventory_source_check CHECK ((source = ANY (ARRAY['items'::text, 'weapon'::text])))
);

CREATE TABLE dndshare.session_karmic_scale (
    session_id bigint NOT NULL,
    actor_key text NOT NULL,
    actor_name text NOT NULL,
    balance numeric(3,1) NOT NULL,
    CONSTRAINT session_karmic_scale_balance_check CHECK (((balance >= ('-6'::integer)::numeric) AND (balance <= (6)::numeric)))
);

CREATE TABLE dndshare.session_location (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    parent_location_id bigint,
    name character varying(160) NOT NULL,
    kind character varying(32) DEFAULT 'other'::character varying NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    image_id bigint,
    CONSTRAINT session_location_kind_check CHECK (((kind)::text = ANY ((ARRAY['region'::character varying, 'settlement'::character varying, 'district'::character varying, 'building'::character varying, 'room'::character varying, 'wilderness'::character varying, 'dungeon'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT session_location_not_own_parent CHECK (((parent_location_id IS NULL) OR (parent_location_id <> id)))
);

CREATE SEQUENCE dndshare.session_location_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_location_id_seq OWNED BY dndshare.session_location.id;

CREATE TABLE dndshare.session_material (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    kind character varying(16) DEFAULT 'image'::character varying NOT NULL,
    name character varying(160) NOT NULL,
    caption text,
    asset_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    content text,
    note_style character varying(24),
    map_data jsonb,
    CONSTRAINT session_material_kind_check CHECK (((kind)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'text'::character varying, 'note'::character varying, 'map'::character varying])::text[]))),
    CONSTRAINT session_material_payload_check CHECK (((((kind)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'map'::character varying])::text[])) AND (asset_id IS NOT NULL) AND (content IS NULL) AND (note_style IS NULL)) OR (((kind)::text = 'text'::text) AND (asset_id IS NULL) AND (content IS NOT NULL) AND (note_style IS NULL)) OR (((kind)::text = 'note'::text) AND (asset_id IS NULL) AND (content IS NOT NULL) AND ((note_style)::text = ANY ((ARRAY['parchment'::character varying, 'letter'::character varying, 'dossier'::character varying, 'arcane'::character varying])::text[])))))
);

CREATE SEQUENCE dndshare.session_material_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_material_id_seq OWNED BY dndshare.session_material.id;

CREATE TABLE dndshare.session_music_state (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE dndshare.session_music_state_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_music_state_id_seq OWNED BY dndshare.session_music_state.id;

CREATE TABLE dndshare.session_npc (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    name character varying(160) NOT NULL,
    role character varying(160),
    description text,
    color character varying(7) DEFAULT '#7c5cff'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    race_item_id bigint,
    image_focal_x double precision DEFAULT 0.5 NOT NULL,
    image_focal_y double precision DEFAULT 0.5 NOT NULL,
    image_id bigint,
    bestiary_item_id bigint
);

CREATE SEQUENCE dndshare.session_npc_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_npc_id_seq OWNED BY dndshare.session_npc.id;

CREATE TABLE dndshare.session_occurrence (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    number integer NOT NULL,
    name character varying(160) NOT NULL,
    scheduled_on date,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_occurrence_number_check CHECK ((number > 0))
);

CREATE SEQUENCE dndshare.session_occurrence_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.session_occurrence_id_seq OWNED BY dndshare.session_occurrence.id;

CREATE TABLE dndshare.session_participant (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    char_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role character varying(32) DEFAULT 'player'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    color character varying(7),
    sort_order integer NOT NULL,
    CONSTRAINT session_participant_color_check CHECK (((color IS NULL) OR ((color)::text ~ '^#[0-9a-fA-F]{6}$'::text))),
    CONSTRAINT session_participant_sort_order_check CHECK ((sort_order > 0))
);
