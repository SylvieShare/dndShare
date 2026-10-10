-- These three measured walls retain native DB insertion pins.
-- Only matching original sources are classified; files, UUIDs and placements stay unchanged.
UPDATE dndshare.map_model AS model
SET geometry = model.geometry || '{"mountProfile":"db-pins"}'::jsonb
FROM (VALUES
 ('MH-173', '097d7d57809c165631df50637dc904ba38e9c64b710b984fb31c80dd58122b88'),
 ('MH-174', 'f17e86afb92b54ed1701c23784b0f61cefed810180adc4e8738db5759484f41c'),
 ('MH-175', 'f4ca495ea893eea40ea56382d5d69603ce6ad4bbed8b1aa995ff7530a8b7c739')
) AS measured(code, sha)
WHERE model.collection = 'majestic-highlands'
 AND model.source_code = measured.code
 AND model.assets->'source'->>'sha256' = measured.sha;
