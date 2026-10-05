-- Workmanship belongs to the actual render asset, separately from its footprint.
UPDATE dndshare.map_model SET geometry=geometry || '{"textureDetail":"basic"}'::jsonb;

WITH detailed(code, render_sha) AS (VALUES
 ('UD-006','0f2a6baa2daf1f0718065655487fddd7c0de4d890a29d1a7a797fd63e2d03750'),
 ('UD-009','e96802c3645f03f1454083238ebef6b4eac6bb6c7bbe7cefa478ed2b77fae3c2'),
 ('UD-010','a001a8594d934cd334d4de6f8e84556b256d66faced16eeabbb1a8463a983909')
)
UPDATE dndshare.map_model model
SET geometry=model.geometry || '{"textureDetail":"detailed"}'::jsonb
FROM detailed
WHERE model.collection='ultimate-dungeon' AND model.source_code=detailed.code
 AND model.assets->'render'->>'sha256'=detailed.render_sha;

ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_texture_detail_valid CHECK (
 COALESCE(jsonb_typeof(geometry->'textureDetail')='string'
 AND geometry->>'textureDetail' IN ('basic','detailed'),false)
);
