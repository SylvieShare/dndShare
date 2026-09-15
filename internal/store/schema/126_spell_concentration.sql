CREATE TABLE dndshare.character_concentration (
 char_id bigint PRIMARY KEY REFERENCES dndshare."char"(id) ON DELETE CASCADE,
 cast_id uuid NOT NULL UNIQUE,
 spell_id bigint NOT NULL REFERENCES dndshare.item(id),
 spell_name text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE dndshare.concentration_effect (
 cast_id uuid NOT NULL REFERENCES dndshare.character_concentration(cast_id) ON DELETE CASCADE,
 effect_uid text NOT NULL,
 effect_id bigint NOT NULL REFERENCES dndshare.item(id),
 target_char_id bigint REFERENCES dndshare."char"(id) ON DELETE CASCADE,
 encounter_id bigint REFERENCES dndshare.session_encounter(id) ON DELETE CASCADE,
 npc_uid text,
 target jsonb NOT NULL,
 PRIMARY KEY(cast_id,effect_uid),
 CHECK ((target_char_id IS NOT NULL AND encounter_id IS NULL AND npc_uid IS NULL)
     OR (target_char_id IS NULL AND encounter_id IS NOT NULL AND npc_uid IS NOT NULL))
);
CREATE INDEX concentration_effect_character ON dndshare.concentration_effect(target_char_id);
CREATE INDEX concentration_effect_encounter ON dndshare.concentration_effect(encounter_id);
