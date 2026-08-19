-- The bestiary exposes the novice-facing filters requested by the catalogue UI.
-- Merge presentation metadata by stable field key so the migration is safe for
-- databases whose item_type JSON predates the checked-in resource schemas.
CREATE OR REPLACE FUNCTION dndshare.merge_handbook_filter_metadata(document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_agg(
        CASE
        WHEN section ->> 'key' = 'identity' THEN section || jsonb_build_object(
            'fields', COALESCE((
                SELECT jsonb_agg(
                    CASE
                        WHEN field ->> 'key' IN (
                            'creature_type', 'size', 'environment', 'is_legendary', 'named_npc'
                        ) THEN field || '{"filter":true}'::jsonb
                        -- Existing alignment values are not normalized enough for
                        -- exact matching, so do not expose a misleading filter.
                        WHEN field ->> 'key' = 'alignment'
                            THEN field - 'filter' - 'filter_values'
                        ELSE field
                    END
                    ORDER BY field_ord
                )
                FROM jsonb_array_elements(section -> 'fields') WITH ORDINALITY nested(field, field_ord)
            ), '[]'::jsonb)
        )
        WHEN section ->> 'key' = 'combat' THEN section || jsonb_build_object(
            'fields', COALESCE((
                SELECT jsonb_agg(
                    CASE WHEN field ->> 'key' = 'cr' THEN field || jsonb_build_object(
                        'filter', true,
                        'filter_values', '["0","1/8","1/4","1/2","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","30"]'::jsonb
                    ) ELSE field END
                    ORDER BY field_ord
                )
                FROM jsonb_array_elements(section -> 'fields') WITH ORDINALITY nested(field, field_ord)
            ), '[]'::jsonb)
        )
        ELSE section END
        ORDER BY section_ord
    ) INTO result
    FROM jsonb_array_elements(document) WITH ORDINALITY sections(section, section_ord);
    RETURN result;
END;
$$;

UPDATE dndshare.item_type
SET fields = dndshare.merge_handbook_filter_metadata(fields)
WHERE id = 6 AND jsonb_typeof(fields) = 'array';

DROP FUNCTION dndshare.merge_handbook_filter_metadata(jsonb);

UPDATE dndshare.item_type
SET fields = COALESCE((
    SELECT jsonb_agg(
        CASE WHEN field ->> 'key' = 'classes'
             THEN field || '{"name":"Классы","filter":true,"filter_path":"classes.id","filter_item_type":9}'::jsonb
             ELSE field END
        ORDER BY ord
    )
    FROM jsonb_array_elements(fields) WITH ORDINALITY rows(field, ord)
    WHERE field ->> 'key' <> 'classIds'
), '[]'::jsonb)
WHERE id = 5 AND jsonb_typeof(fields) = 'array';

-- Generic equipment can carry the mechanical armor rule used by the creation
-- wizard and character sheet. Keep it nested so ordinary objects stay simple.
UPDATE dndshare.item_type
SET fields = fields || jsonb_build_array(jsonb_build_object(
    'key', 'armor',
    'name', 'Доспех',
    'type', 'object',
    'fields', jsonb_build_array(
        jsonb_build_object('key', 'ac', 'name', 'Базовый КД', 'type', 'int'),
        jsonb_build_object('key', 'use_dex', 'name', 'Добавлять Ловкость', 'type', 'bool'),
        jsonb_build_object('key', 'dex_cap', 'name', 'Максимум бонуса Ловкости', 'type', 'int'),
        jsonb_build_object('key', 'shield', 'name', 'Это щит', 'type', 'bool'),
        jsonb_build_object('key', 'shield_bonus', 'name', 'Бонус щита', 'type', 'int')
    )
))
WHERE id = 2
  AND jsonb_typeof(fields) = 'array'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) field WHERE field ->> 'key' = 'armor');

-- Backfill the core 2014 armor catalogue. Name fallback remains in the client
-- for text-only starting-equipment rows, but persisted handbook items now own
-- their rule explicitly.
UPDATE dndshare.item
SET data = jsonb_set(data, '{armor}', CASE lower(btrim(name))
    WHEN 'стёганый доспех' THEN '{"ac":11,"use_dex":true}'::jsonb
    WHEN 'стеганый доспех' THEN '{"ac":11,"use_dex":true}'::jsonb
    WHEN 'кожаный доспех' THEN '{"ac":11,"use_dex":true}'::jsonb
    WHEN 'кожаная броня' THEN '{"ac":11,"use_dex":true}'::jsonb
    WHEN 'проклёпанная кожа' THEN '{"ac":12,"use_dex":true}'::jsonb
    WHEN 'проклепанная кожа' THEN '{"ac":12,"use_dex":true}'::jsonb
    WHEN 'шкурный доспех' THEN '{"ac":12,"use_dex":true,"dex_cap":2}'::jsonb
    WHEN 'кольчужная рубаха' THEN '{"ac":13,"use_dex":true,"dex_cap":2}'::jsonb
    WHEN 'чешуйчатый доспех' THEN '{"ac":14,"use_dex":true,"dex_cap":2}'::jsonb
    WHEN 'кираса' THEN '{"ac":14,"use_dex":true,"dex_cap":2}'::jsonb
    WHEN 'полулаты' THEN '{"ac":15,"use_dex":true,"dex_cap":2}'::jsonb
    WHEN 'колечный доспех' THEN '{"ac":14,"use_dex":false}'::jsonb
    WHEN 'кольчуга' THEN '{"ac":16,"use_dex":false}'::jsonb
    WHEN 'наборный доспех' THEN '{"ac":17,"use_dex":false}'::jsonb
    WHEN 'латы' THEN '{"ac":18,"use_dex":false}'::jsonb
    WHEN 'щит' THEN '{"shield":true,"shield_bonus":2}'::jsonb
    WHEN 'деревянный щит' THEN '{"shield":true,"shield_bonus":2}'::jsonb
END, true)
WHERE type_id = 2
  AND NOT (data ? 'armor')
  AND lower(btrim(name)) IN (
    'стёганый доспех','стеганый доспех','кожаный доспех','кожаная броня',
    'проклёпанная кожа','проклепанная кожа','шкурный доспех','кольчужная рубаха',
    'чешуйчатый доспех','кираса','полулаты','колечный доспех','кольчуга',
    'наборный доспех','латы','щит','деревянный щит'
  );

-- Constitution uses a warm brown accent on the character sheet.
UPDATE dndshare.suggest
SET color = '#9A6A43'
WHERE type_id = 16 AND id = 3;
