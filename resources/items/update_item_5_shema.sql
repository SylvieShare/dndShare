-- Apply the updated spell schema (item_5_shema.json) to dndshare.item_type.
-- Adds the source_kind enum (база/аддон/3rd) plus the damage scaling fields
-- (save_ability, save_effect, scaling, instances, addon_instances, dice bonus,
-- addon dice) and heal scaling (add_mod, scaling, addon dice).
-- Data is filled by the `spell-damage-enrich` subagent pass (ttg.club), not a job.
UPDATE dndshare.item_type
SET fields = pg_read_file('resources/items/item_5_shema.json')::jsonb
WHERE id = 5;
-- Fallback (if pg_read_file is unavailable in the target env): paste the
-- contents of resources/items/item_5_shema.json into the SET expression
-- inline, e.g. SET fields = '[...]'::jsonb.
