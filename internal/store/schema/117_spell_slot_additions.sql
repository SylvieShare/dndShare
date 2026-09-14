-- Slot pools are persisted resources. Class progression only grants level-up
-- additions; remove the obsolete switch without changing totals or usage.
UPDATE dndshare."char"
SET data = data #- '{values,spells,slots_auto}',
    version = version + 1,
    changed_at = now()
WHERE jsonb_typeof(data #> '{values,spells}') = 'object'
  AND (data #> '{values,spells}') ? 'slots_auto';
