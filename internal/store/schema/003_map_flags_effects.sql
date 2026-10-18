ALTER TABLE dndshare.map_model_definition
    ADD COLUMN default_flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(default_flags) = 'array'),
    ADD COLUMN default_effects jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(default_effects) = 'array');
