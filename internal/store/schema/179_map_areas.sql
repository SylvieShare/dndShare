-- Named groups of tile/object UUIDs; visibility is independent of session fog.
UPDATE dndshare.battle_map SET document = document || '{"areas":[]}'::jsonb
WHERE NOT document ? 'areas' OR document->'areas' = 'null'::jsonb;
UPDATE dndshare.session_map SET document = document || '{"areas":[]}'::jsonb
WHERE NOT document ? 'areas' OR document->'areas' = 'null'::jsonb;
