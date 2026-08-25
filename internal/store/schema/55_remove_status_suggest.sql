-- Conditions are item type 15 now. Migrate the last encounter references before
-- removing the obsolete label-only suggest catalogue.
WITH rewritten AS (
  SELECT encounter.id,
         COALESCE(jsonb_agg(
           CASE
             WHEN jsonb_typeof(combatant.value -> 'states') = 'array' THEN
               jsonb_set(
                 combatant.value,
                 '{states}',
                 COALESCE((
                   SELECT jsonb_agg(to_jsonb(effect.id) ORDER BY state.ordinality)
                   FROM jsonb_array_elements(combatant.value -> 'states') WITH ORDINALITY state(value, ordinality)
                   JOIN dndshare.item effect
                     ON effect.type_id = 15
                    AND effect.data ->> 'legacy_suggest_id' = state.value #>> '{}'
                 ), '[]'::jsonb),
                 true
               )
             ELSE combatant.value
           END
           ORDER BY combatant.ordinality
         ), '[]'::jsonb) AS combatants
  FROM dndshare.session_encounter encounter
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(encounter.data -> 'combatants') = 'array' THEN encounter.data -> 'combatants'
    ELSE '[]'::jsonb
  END) WITH ORDINALITY combatant(value, ordinality)
  WHERE COALESCE(encounter.data ->> 'status_effect_items_version', '0') <> '1'
    AND EXISTS (SELECT 1 FROM dndshare.suggest WHERE type_id = 9)
  GROUP BY encounter.id
)
UPDATE dndshare.session_encounter encounter
SET data = jsonb_set(
  jsonb_set(encounter.data, '{combatants}', rewritten.combatants, true),
  '{status_effect_items_version}',
  '1'::jsonb,
  true
)
FROM rewritten
WHERE encounter.id = rewritten.id;

-- Empty encounters still need the version marker so future item ids are not
-- interpreted as legacy suggest ids.
UPDATE dndshare.session_encounter
SET data = jsonb_set(data, '{status_effect_items_version}', '1'::jsonb, true)
WHERE COALESCE(data ->> 'status_effect_items_version', '0') <> '1';

UPDATE dndshare.item
SET data = data - 'legacy_suggest_id'
WHERE type_id = 15 AND data ? 'legacy_suggest_id';

DELETE FROM dndshare.suggest WHERE type_id = 9;
DELETE FROM dndshare.suggest_type WHERE id = 9;
