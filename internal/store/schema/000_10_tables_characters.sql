-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TABLE dndshare."char" (
    id bigint NOT NULL,
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id bigint NOT NULL,
    template_id bigint NOT NULL,
    data jsonb NOT NULL,
    public_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    name character varying,
    deleted boolean DEFAULT false NOT NULL,
    death character varying DEFAULT false NOT NULL,
    version bigint DEFAULT 1 NOT NULL,
    source_version_id bigint,
    icon_image_id bigint,
    cloned_from_char_id bigint,
    CONSTRAINT character_potions_in_inventory CHECK ((NOT ((data #> '{values}'::text[]) ? 'potions'::text))),
    CONSTRAINT character_without_inventory_counters CHECK ((NOT (COALESCE((data -> 'values'::text), '{}'::jsonb) ? 'counters'::text)))
);

CREATE SEQUENCE dndshare.char_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE dndshare.char_id_seq OWNED BY dndshare."char".id;

CREATE TABLE dndshare.char_template (
    id bigint CONSTRAINT char_template_id_not_null1 NOT NULL,
    name character varying NOT NULL
);

ALTER TABLE dndshare.char_template ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME dndshare.char_template_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE dndshare.character_concentration (
    char_id bigint NOT NULL,
    cast_id uuid NOT NULL,
    spell_id bigint NOT NULL,
    spell_name text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE dndshare.concentration_effect (
    cast_id uuid NOT NULL,
    effect_uid text NOT NULL,
    effect_id bigint NOT NULL,
    target_char_id bigint,
    encounter_id bigint,
    npc_uid text,
    target jsonb NOT NULL,
    CONSTRAINT concentration_effect_check CHECK ((((target_char_id IS NOT NULL) AND (encounter_id IS NULL) AND (npc_uid IS NULL)) OR ((target_char_id IS NULL) AND (encounter_id IS NOT NULL) AND (npc_uid IS NOT NULL))))
);

CREATE TABLE dndshare.item_application (
    char_id bigint NOT NULL,
    client_action_id uuid NOT NULL,
    entry_uid text NOT NULL,
    option_key text DEFAULT ''::text NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'items'::text NOT NULL
);

CREATE TABLE dndshare.spell_cast_receipt (
    cast_id uuid NOT NULL,
    char_id bigint NOT NULL,
    request jsonb NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    health_roll jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
