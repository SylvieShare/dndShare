-- Derived effects may block a named character activity. Consumers combine
-- every matching source into one restriction notice instead of hardcoding
-- feature names in individual sheet blocks.
WITH kind_option AS (
  SELECT '{"value":"activity_block","label":"Запрет действия"}'::jsonb AS value
), rewritten AS (
  SELECT item_type.id,
         jsonb_agg(
           CASE
             WHEN field.value ->> 'key' <> 'derived_effects' THEN field.value
             ELSE jsonb_set(
               field.value,
               '{fields}',
               COALESCE((
                 SELECT jsonb_agg(
                   CASE
                     WHEN nested.value ->> 'key' <> 'kind' THEN nested.value
                     WHEN EXISTS (
                       SELECT 1
                       FROM jsonb_array_elements(COALESCE(nested.value -> 'options', '[]'::jsonb)) current
                       WHERE current ->> 'value' = 'activity_block'
                     ) THEN nested.value
                     ELSE jsonb_set(
                       nested.value,
                       '{options}',
                       COALESCE(nested.value -> 'options', '[]'::jsonb) || jsonb_build_array(kind_option.value),
                       true
                     )
                   END
                   ORDER BY nested.ordinality
                 )
                 FROM jsonb_array_elements(COALESCE(field.value -> 'fields', '[]'::jsonb))
                   WITH ORDINALITY nested(value, ordinality)
               ), '[]'::jsonb),
               true
             )
           END
           ORDER BY field.ordinality
         ) AS fields
  FROM dndshare.item_type item_type
  CROSS JOIN kind_option
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb))
    WITH ORDINALITY field(value, ordinality)
  WHERE item_type.id IN (3, 4, 7, 15)
  GROUP BY item_type.id
)
UPDATE dndshare.item_type item_type
SET fields = rewritten.fields
FROM rewritten
WHERE item_type.id = rewritten.id
  AND item_type.fields IS DISTINCT FROM rewritten.fields;

-- The project uses the 2014 Rage rule: Strength-based melee weapon damage is
-- increased, while spellcasting and concentration are unavailable.
UPDATE dndshare.item effect
SET data = jsonb_set(
  jsonb_set(
    COALESCE(effect.data, '{}'::jsonb),
    '{desc}',
    to_jsonb('Преимущество на проверки и спасброски Силы, бонус к урону рукопашным оружием Силой, сопротивление дробящему, колющему и рубящему урону; нельзя сотворять заклинания или поддерживать концентрацию.'::text),
    true
  ),
  '{derived_effects}',
  COALESCE((
    SELECT jsonb_agg(rule.value ORDER BY rule.ordinality)
      FILTER (WHERE NOT (
        rule.value ->> 'kind' = 'activity_block'
        AND COALESCE(rule.value -> 'scopes', '[]'::jsonb) @> '["spellcasting"]'::jsonb
      ))
    FROM jsonb_array_elements(COALESCE(effect.data -> 'derived_effects', '[]'::jsonb))
      WITH ORDINALITY rule(value, ordinality)
  ), '[]'::jsonb) || '[{"kind":"activity_block","scopes":["spellcasting","concentration"],"label":"Нельзя сотворять заклинания или поддерживать концентрацию."}]'::jsonb,
  true
)
WHERE effect.type_id = 15
  AND effect.user_id IS NULL
  AND effect.data ->> 'code' = 'rage';
