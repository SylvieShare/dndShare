-- Correct known floor tiles with built-in furnishings. This catalogue-only
-- classification does not change geometry, standability or placement points.
UPDATE dndshare.map_model SET geometry = geometry || '{"hasDecor":true}'::jsonb
WHERE tile_type = 'floor' AND (
    (collection = 'ultimate-dungeon' AND source_code IN
        ('UD-031','UD-032','UD-033','UD-066','UD-075','UD-077'))
    OR (collection = 'lost-cave' AND source_code IN
        ('LC-010','LC-011','LC-032','LC-033','LC-066','LC-068','LC-093','LC-094'))
    OR (collection = 'toxic-sewer' AND source_code IN
        ('TS-054','TS-058','TS-079','TS-093','TS-094'))
);
