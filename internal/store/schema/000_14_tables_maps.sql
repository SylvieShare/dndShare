-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TABLE dndshare.battle_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id bigint NOT NULL,
    name character varying(160) NOT NULL,
    document jsonb NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT battle_map_tiles_only CHECK ((((document ->> 'kind'::text) IS NOT NULL) AND ((document ->> 'kind'::text) = 'tiles'::text)))
);

CREATE TABLE dndshare.battle_map_model (
    map_id uuid NOT NULL,
    model_id uuid NOT NULL
);

CREATE TABLE dndshare.battle_map_preview (
    id bigint NOT NULL,
    map_id uuid,
    system_id character varying(80),
    signature character(64) NOT NULL,
    object_key text NOT NULL,
    file_size bigint NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT battle_map_preview_check CHECK (((map_id IS NOT NULL) <> (system_id IS NOT NULL))),
    CONSTRAINT battle_map_preview_file_size_check CHECK ((file_size > 0)),
    CONSTRAINT battle_map_preview_signature_check CHECK ((signature ~ '^[0-9a-f]{64}$'::text))
);

CREATE SEQUENCE dndshare.battle_map_preview_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.battle_map_preview_id_seq OWNED BY dndshare.battle_map_preview.id;

CREATE TABLE dndshare.map_model (
    id uuid NOT NULL,
    collection character varying(80) NOT NULL,
    source_code character varying(80) NOT NULL,
    source_name character varying(255) NOT NULL,
    name character varying(160) NOT NULL,
    tile_type character varying(32) NOT NULL,
    geometry jsonb NOT NULL,
    assets jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    definition_id character varying(512) CONSTRAINT map_model_definition_id_not_null1 NOT NULL,
    CONSTRAINT map_model_asset_roles_check CHECK (((jsonb_typeof(assets) = 'object'::text) AND (assets ?& ARRAY['render'::text, 'lod'::text, 'shadow'::text, 'preview'::text, 'source'::text]) AND ((assets - ARRAY['render'::text, 'lod'::text, 'shadow'::text, 'preview'::text, 'source'::text]) = '{}'::jsonb))),
    CONSTRAINT map_model_mount_depth_check CHECK (((jsonb_typeof((geometry -> 'mountDepth'::text)) = 'number'::text) AND (((geometry ->> 'mountDepth'::text))::numeric >= (0)::numeric) AND (((geometry ->> 'mountDepth'::text))::numeric <= ((geometry ->> 'surfaceHeight'::text))::numeric))),
    CONSTRAINT map_model_placement_offset_valid CHECK (COALESCE(((jsonb_typeof((geometry -> 'placementOffset'::text)) = 'array'::text) AND (jsonb_array_length((geometry -> 'placementOffset'::text)) = 2) AND (jsonb_typeof(((geometry -> 'placementOffset'::text) -> 0)) = 'number'::text) AND (jsonb_typeof(((geometry -> 'placementOffset'::text) -> 1)) = 'number'::text) AND (abs((((geometry -> 'placementOffset'::text) ->> 0))::numeric) <= (8)::numeric) AND (abs((((geometry -> 'placementOffset'::text) ->> 1))::numeric) <= (8)::numeric)), false)),
    CONSTRAINT map_model_surface_metadata_check CHECK (((jsonb_typeof((geometry -> 'hasDecor'::text)) = 'boolean'::text) AND (jsonb_typeof((geometry -> 'canStand'::text)) = 'boolean'::text) AND (jsonb_typeof((geometry -> 'hidden'::text)) = 'boolean'::text) AND (jsonb_typeof((geometry -> 'placementPoints'::text)) = 'array'::text))),
    CONSTRAINT map_model_texture_detail_valid CHECK (COALESCE(((jsonb_typeof((geometry -> 'textureDetail'::text)) = 'string'::text) AND ((geometry ->> 'textureDetail'::text) = ANY (ARRAY['basic'::text, 'detailed'::text]))), false)),
    CONSTRAINT map_model_tile_type_check CHECK (((tile_type)::text = ANY ((ARRAY['floor'::character varying, 'wall-straight'::character varying, 'wall-angle'::character varying, 'wall-tee'::character varying, 'wall-cross'::character varying, 'wall-end'::character varying, 'wall-corner'::character varying, 'wall-diagonal'::character varying, 'stairs'::character varying, 'frame'::character varying, 'bridge'::character varying, 'passage'::character varying, 'column'::character varying, 'object'::character varying])::text[])))
);

CREATE TABLE dndshare.map_model_definition (
    id character varying(512) NOT NULL,
    collection character varying(80) NOT NULL,
    source_code character varying(80) NOT NULL,
    source_name character varying(255) NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    default_lights jsonb DEFAULT '[]'::jsonb NOT NULL,
    code character varying(160) NOT NULL,
    CONSTRAINT map_model_definition_default_lights_check CHECK ((jsonb_typeof(default_lights) = 'array'::text)),
    CONSTRAINT map_model_definition_revision_check CHECK ((revision > 0)),
    CONSTRAINT map_model_group_code_valid CHECK ((((code)::text ~ '^[A-Z]{2,3}-[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (length((code)::text) <= 160)))
);

CREATE TABLE dndshare.map_model_transition (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_model_id character varying(512) NOT NULL,
    to_model_id character varying(512) NOT NULL,
    action character varying(24) NOT NULL,
    CONSTRAINT map_model_transition_action_check CHECK (((action)::text = ANY ((ARRAY['open'::character varying, 'close'::character varying, 'extinguish'::character varying, 'ignite'::character varying, 'empty'::character varying, 'fill'::character varying])::text[]))),
    CONSTRAINT map_model_transition_check CHECK (((from_model_id)::text <> (to_model_id)::text))
);

CREATE TABLE dndshare.session_global_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id bigint NOT NULL,
    name character varying(160) NOT NULL,
    image_id bigint NOT NULL,
    routes jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_global_map_routes_check CHECK ((jsonb_typeof(routes) = 'array'::text))
);

CREATE TABLE dndshare.session_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id bigint NOT NULL,
    name character varying(160) NOT NULL,
    document jsonb NOT NULL,
    state jsonb NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    source jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT session_map_source_check CHECK ((jsonb_typeof(source) = 'object'::text)),
    CONSTRAINT session_map_tiles_only CHECK ((((document ->> 'kind'::text) IS NOT NULL) AND ((document ->> 'kind'::text) = 'tiles'::text)))
);

CREATE TABLE dndshare.session_map_display (
    session_id bigint NOT NULL,
    map_id uuid,
    visible boolean DEFAULT false NOT NULL,
    camera jsonb DEFAULT '{"x": 0, "y": 0, "fit": true, "rotation": 0, "cellPixels": 64}'::jsonb NOT NULL,
    revision bigint DEFAULT 0 NOT NULL
);

CREATE TABLE dndshare.session_map_model (
    map_id uuid NOT NULL,
    model_id uuid NOT NULL
);
