-- Refuse to discard templates until the explicit offline conversion is complete.
ALTER TABLE dndshare.map_model_definition
    ADD CONSTRAINT light_effects_converted
    CHECK (default_flags = '[]'::jsonb AND default_effects = '[]'::jsonb);
ALTER TABLE dndshare.map_model_definition
    DROP COLUMN default_flags,
    DROP COLUMN default_effects;
