-- Rename the seeded switch without changing its stable key or dependent rules.
UPDATE dndshare.item SET data=jsonb_set(data, '{weapon_damage}', (
  SELECT jsonb_agg(CASE WHEN rule->>'key'='throw' AND rule->>'attack_mode'='thrown'
    THEN jsonb_set(rule, '{label}', '"Метнуть"'::jsonb) ELSE rule END ORDER BY ord)
  FROM jsonb_array_elements(data->'weapon_damage') WITH ORDINALITY r(rule,ord)
)) WHERE id=261 AND type_id=19 AND user_id IS NULL AND name='Дварфийский метатель'
  AND jsonb_typeof(data->'weapon_damage')='array' AND jsonb_array_length(data->'weapon_damage')>0;
