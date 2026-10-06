-- Existing LOD is real geometry and can serve as the initial shadow resource.
-- A dedicated texture-free GLB is attached by a subsequent immutable revision.
UPDATE dndshare.map_model
SET assets = assets || jsonb_build_object('shadow', assets->'lod')
WHERE NOT (assets ? 'shadow');

ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_asset_roles_check CHECK (
    jsonb_typeof(assets) = 'object'
    AND assets ?& ARRAY['render','lod','shadow','preview','source']
    AND assets - ARRAY['render','lod','shadow','preview','source'] = '{}'::jsonb
);
