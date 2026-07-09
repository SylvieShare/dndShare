-- Apply the new bestiary schema (item_6_enemy.json) to dndshare.item_type.
-- After running, the previously imported bestiary should be re-imported via the
-- bestiary-import admin job, because the data layout changed (nested
-- identity/combat/stats/saving_throws objects).
UPDATE dndshare.item_type
SET fields = pg_read_file('resources/items/item_6_enemy.json')::jsonb
WHERE id = 6;
-- Fallback (if pg_read_file is unavailable in the target env): paste the
-- contents of resources/items/item_6_enemy.json into the SET expression
-- inline, e.g. SET fields = '[...]'::jsonb.
