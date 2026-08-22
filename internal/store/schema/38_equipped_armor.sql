-- Armor automation is owned by catalogue items placed in values.items.equipped.
-- Keep only genuinely manual AC bonuses on the character and discard the old
-- duplicated body/shield snapshot produced by character creation.
UPDATE dndshare."char" c
SET data = jsonb_set(
    c.data,
    '{values,armor}',
    jsonb_build_object(
        'bonuses',
        COALESCE((
            SELECT jsonb_agg(bonus ORDER BY ordinal)
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(c.data #> '{values,armor,bonuses}') = 'array'
                    THEN c.data #> '{values,armor,bonuses}' ELSE '[]'::jsonb END
            ) WITH ORDINALITY source(bonus, ordinal)
            WHERE NOT (
                COALESCE(bonus ->> 'readonly', 'false') = 'true'
                AND lower(COALESCE(bonus ->> 'name', bonus ->> 'title', '')) LIKE 'экипировано:%'
            )
        ), '[]'::jsonb)
    ),
    true
)
WHERE jsonb_typeof(c.data #> '{values}') = 'object';

-- Magical armor and shields use the same per-instance bonus contract as
-- magical weapons. The bonus participates in their AC formula.
UPDATE dndshare.item_type
SET instance_fields = '[{"key":"magic_bonus","name":"Магический бонус","type":"int","min":0,"max":3,"default":0,"suffix":"+"}]'::jsonb
WHERE id = 12;
