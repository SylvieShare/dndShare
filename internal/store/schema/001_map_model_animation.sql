ALTER TABLE dndshare.map_model_definition
    ADD COLUMN animation_fps integer CHECK (animation_fps BETWEEN 1 AND 60);
