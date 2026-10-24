ALTER TABLE dndshare.map_model DROP CONSTRAINT map_model_category_valid;
ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_category_valid CHECK (category IN (
    '', 'floor', 'wall', 'water', 'railway', 'stairs', 'frame', 'bridge', 'passage', 'column', 'object', 'creature-base'
));
