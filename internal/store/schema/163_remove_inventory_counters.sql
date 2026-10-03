-- Current character documents no longer store user-created inventory counter tiles.
-- Preserve any remaining old value in the existing migration journal before removal.
INSERT INTO dndshare.inventory_counter_migration
  (char_id,counter_id,original_counter,created_entry,section_id,previous_version,
   action,inventory_before,inventory_after)
SELECT id,'retired-counters',
  jsonb_build_object('path','values.counters','value',data#>'{values,counters}'),
  'null'::jsonb,COALESCE(data#>>'{values,items,sections,0,id}',''),version,
  'delete',data#>'{values,items}',data#>'{values,items}'
FROM dndshare."char"
WHERE (data->'values') ? 'counters'
  AND data#>'{values,counters}' IS DISTINCT FROM '[]'::jsonb
ON CONFLICT(char_id,counter_id) DO NOTHING;

UPDATE dndshare."char"
SET data=jsonb_set(data,'{values}',(data->'values')-'counters'),
    version=version+1,changed_at=now()
WHERE (data->'values') ? 'counters';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='dndshare."char"'::regclass AND conname='character_without_inventory_counters'
  ) THEN
    ALTER TABLE dndshare."char"
      ADD CONSTRAINT character_without_inventory_counters
      CHECK(NOT (COALESCE(data->'values','{}'::jsonb) ? 'counters'));
  END IF;
END $$;
