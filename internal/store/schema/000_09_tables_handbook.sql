-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TABLE dndshare.content_source (
    id bigint NOT NULL,
    source_id bigint NOT NULL,
    native_source_version_id bigint,
    name character varying NOT NULL,
    code character varying NOT NULL,
    description text,
    kind character varying DEFAULT 'supplement'::character varying NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT content_source_kind_check CHECK (((kind)::text = ANY ((ARRAY['core'::character varying, 'supplement'::character varying, 'setting'::character varying, 'adventure'::character varying, 'playtest'::character varying, 'third_party'::character varying])::text[])))
);

CREATE TABLE dndshare.content_source_compatibility (
    content_source_id bigint NOT NULL,
    source_version_id bigint NOT NULL,
    status character varying NOT NULL,
    CONSTRAINT content_source_compatibility_status_check CHECK (((status)::text = ANY ((ARRAY['native'::character varying, 'compatible'::character varying, 'legacy'::character varying, 'blocked'::character varying])::text[])))
);

CREATE SEQUENCE dndshare.content_source_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.content_source_id_seq OWNED BY dndshare.content_source.id;

CREATE TABLE dndshare.custom_item_source (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE dndshare.custom_item_source_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.custom_item_source_id_seq OWNED BY dndshare.custom_item_source.id;

CREATE TABLE dndshare.item (
    id bigint NOT NULL,
    user_id bigint,
    name character varying NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type_id bigint NOT NULL,
    name_en character varying,
    parent_id bigint,
    icon_svg_id bigint,
    custom_source_id bigint,
    icon_image_id bigint,
    cover_image_id bigint,
    automation_status text DEFAULT 'unreviewed'::text NOT NULL,
    automation_note text DEFAULT ''::text NOT NULL,
    requires_player_interaction boolean DEFAULT false NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    derived_from_item_id bigint,
    derivation_kind text,
    CONSTRAINT item_automation_note_check CHECK ((char_length(automation_note) <= 1000)),
    CONSTRAINT item_automation_status_check CHECK ((automation_status = ANY (ARRAY['unreviewed'::text, 'full'::text, 'partial'::text, 'none'::text, 'not_applicable'::text]))),
    CONSTRAINT item_custom_source_consistency_check CHECK (((user_id IS NULL) = (custom_source_id IS NULL))),
    CONSTRAINT item_derivation_kind_check CHECK ((derivation_kind = ANY (ARRAY['revision'::text, 'adaptation'::text]))),
    CONSTRAINT item_purchase_quantity_positive CHECK (((NOT (data ? 'purchase_quantity'::text)) OR ((data -> 'purchase_quantity'::text) = 'null'::jsonb) OR
CASE
    WHEN (jsonb_typeof((data -> 'purchase_quantity'::text)) = 'number'::text) THEN (((((data ->> 'purchase_quantity'::text))::numeric >= (1)::numeric) AND (((data ->> 'purchase_quantity'::text))::numeric <= (2147483647)::numeric)) AND (((data ->> 'purchase_quantity'::text))::numeric = trunc(((data ->> 'purchase_quantity'::text))::numeric)))
    ELSE false
END)),
    CONSTRAINT item_single_icon_check CHECK ((num_nonnulls(icon_svg_id, icon_image_id) <= 1))
);

CREATE TABLE dndshare.item_content_source (
    item_id bigint NOT NULL,
    content_source_id bigint NOT NULL,
    page integer,
    primary_source boolean DEFAULT false NOT NULL
);

CREATE TABLE dndshare.item_icon_preset (
    id bigint NOT NULL,
    item_type_id bigint NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    purpose character varying(16) DEFAULT 'item'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    image_id bigint NOT NULL,
    CONSTRAINT item_icon_preset_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['item'::character varying, 'empty_cell'::character varying])::text[])))
);

CREATE SEQUENCE dndshare.item_icon_preset_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.item_icon_preset_id_seq OWNED BY dndshare.item_icon_preset.id;

CREATE SEQUENCE dndshare.item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.item_id_seq OWNED BY dndshare.item.id;

CREATE TABLE dndshare.item_transfer (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    sender_char_id bigint,
    recipient_char_id bigint,
    client_action_id uuid NOT NULL,
    event_id bigint NOT NULL,
    source text NOT NULL,
    entry jsonb NOT NULL,
    item_name text NOT NULL,
    sender_name text NOT NULL,
    recipient_name text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    purpose text DEFAULT 'transfer'::text NOT NULL,
    application jsonb DEFAULT '{}'::jsonb NOT NULL,
    application_result jsonb DEFAULT '{}'::jsonb NOT NULL,
    resolved_target jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT item_transfer_check CHECK ((sender_char_id <> recipient_char_id)),
    CONSTRAINT item_transfer_inventory_sender CHECK (((sender_char_id IS NOT NULL) OR ((purpose = 'transfer'::text) AND (recipient_char_id IS NOT NULL)))),
    CONSTRAINT item_transfer_purpose_check CHECK ((purpose = ANY (ARRAY['transfer'::text, 'use'::text]))),
    CONSTRAINT item_transfer_source_check CHECK ((source = ANY (ARRAY['items'::text, 'weapon'::text, 'spells'::text]))),
    CONSTRAINT item_transfer_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text]))),
    CONSTRAINT item_transfer_use_source CHECK (((purpose <> 'use'::text) OR (source = ANY (ARRAY['items'::text, 'weapon'::text, 'spells'::text]))))
);

CREATE SEQUENCE dndshare.item_transfer_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.item_transfer_id_seq OWNED BY dndshare.item_transfer.id;

CREATE TABLE dndshare.item_type (
    id bigint CONSTRAINT item_type_id_not_null1 NOT NULL,
    name character varying NOT NULL,
    example jsonb,
    fields jsonb,
    source_id bigint,
    color character varying,
    count_items bigint DEFAULT 0 NOT NULL,
    important boolean DEFAULT false NOT NULL,
    description character varying,
    icon_image_id bigint,
    cover_image_id bigint,
    instance_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    parent_type_id bigint
);

CREATE SEQUENCE dndshare.item_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.item_type_id_seq OWNED BY dndshare.item_type.id;

CREATE TABLE dndshare.item_version_compatibility (
    item_id bigint NOT NULL,
    source_version_id bigint NOT NULL,
    status character varying NOT NULL,
    replaced_by_item_id bigint,
    adapter_code character varying,
    note text DEFAULT ''::text NOT NULL,
    CONSTRAINT item_version_compatibility_status_check CHECK (((status)::text = ANY ((ARRAY['native'::character varying, 'compatible'::character varying, 'legacy'::character varying, 'blocked'::character varying, 'requires_adaptation'::character varying])::text[])))
);

CREATE TABLE dndshare.source (
    id bigint NOT NULL,
    name character varying NOT NULL,
    count_items bigint DEFAULT 0 NOT NULL
);

CREATE SEQUENCE dndshare.source_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.source_id_seq OWNED BY dndshare.source.id;

CREATE TABLE dndshare.source_version (
    id bigint NOT NULL,
    source_id bigint NOT NULL,
    version character varying NOT NULL
);

CREATE SEQUENCE dndshare.source_version_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.source_version_id_seq OWNED BY dndshare.source_version.id;

CREATE SEQUENCE dndshare.suggest_public_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE dndshare.suggest (
    id bigint DEFAULT nextval('dndshare.suggest_public_id_seq'::regclass) NOT NULL,
    user_id bigint,
    type_id bigint NOT NULL,
    value character varying NOT NULL,
    color character varying,
    "desc" character varying,
    code character varying,
    svg_id bigint,
    icon_image_id bigint
);

CREATE SEQUENCE dndshare.suggest_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.suggest_id_seq OWNED BY dndshare.suggest.id;

CREATE TABLE dndshare.suggest_type (
    id bigint CONSTRAINT suggest_type_id_not_null1 NOT NULL,
    name character varying NOT NULL,
    source_id bigint,
    color character varying,
    svg_id bigint,
    count_items bigint DEFAULT 0 NOT NULL
);

CREATE SEQUENCE dndshare.suggest_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.suggest_type_id_seq OWNED BY dndshare.suggest_type.id;

CREATE TABLE dndshare.svg_storage (
    id bigint NOT NULL,
    data text NOT NULL,
    user_id bigint,
    file_size bigint,
    file_name character varying(255),
    mime_type character varying(128),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT svg_storage_file_size_check CHECK (((file_size IS NULL) OR (file_size >= 0)))
);

CREATE SEQUENCE dndshare.svg_storage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.svg_storage_id_seq OWNED BY dndshare.svg_storage.id;
