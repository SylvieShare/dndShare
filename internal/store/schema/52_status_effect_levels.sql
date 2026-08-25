-- Optional catalogue level is presentation metadata for tiered effects. It is
-- deliberately stored on the effect item; runtime status instances keep only
-- source/duration parameters as before.
WITH addition(field) AS (
  VALUES ('{"name":"Уровень","key":"level","type":"int"}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
FROM addition
WHERE item_type.id = 15
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'level'
  );
