-- Damage defenses are a shared ability contract. The character sheet merges
-- manual rows with readonly rows contributed by race/class/feat abilities.
WITH addition AS (
    SELECT '{"name":"Защиты","key":"defenses","type":"object_array","fields":[{"name":"Тип урона","key":"damage_type","type":"suggest","suggest_id":12},{"name":"Вид защиты","key":"kind","type":"select","default":"resistance","options":[{"value":"resistance","label":"Сопротивление"},{"value":"immunity","label":"Невосприимчивость"},{"value":"vulnerability","label":"Уязвимость"}]},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb AS field
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || addition.field
FROM addition
WHERE item_type.id IN (3, 4, 7)
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
      WHERE current ->> 'key' = 'defenses'
  );

-- Fixed racial skill proficiencies belong to the race grant, rather than to a
-- text-only ability that has to be interpreted by the create flow.
WITH addition AS (
    SELECT '{"name":"Фиксированные владения навыками","key":"skill_prof","type":"suggest_array","suggest_id":15}'::jsonb AS field
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || addition.field
FROM addition
WHERE item_type.id = 8
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
      WHERE current ->> 'key' = 'skill_prof'
  );

-- The three unconditional PHB racial resistances can immediately use the
-- shared defense block. Dragonborn resistance remains choice-dependent and is
-- deliberately not guessed before Draconic Ancestry is modeled.
WITH defense_rules(name_ru, damage_type) AS (
    VALUES
        ('Адское сопротивление', 5),
        ('Дварфская устойчивость', 4),
        ('Выносливость коренастых', 4)
)
UPDATE dndshare.item item
SET data = jsonb_set(
    COALESCE(item.data, '{}'::jsonb),
    '{defenses}',
    jsonb_build_array(jsonb_build_object('damage_type', defense_rules.damage_type, 'kind', 'resistance')),
    true
)
FROM defense_rules
WHERE item.type_id = 3
  AND item.user_id IS NULL
  AND lower(item.name) = lower(defense_rules.name_ru);

-- Infernal features existed in the catalogue but had no owner and therefore
-- never reached a Tiefling sheet.
UPDATE dndshare.item
SET data = (COALESCE(data, '{}'::jsonb) - 'race_ids' - 'subrace_ids')
    || '{"level":1,"race_ids":[{"id":4322}]}'::jsonb
WHERE type_id = 3
  AND user_id IS NULL
  AND lower(name) IN (lower('Адское сопротивление'), lower('Дьявольское наследие'));

-- Half-Orcs and Tieflings share the ordinary 60-foot Darkvision feature.
UPDATE dndshare.item
SET data = jsonb_set(
    COALESCE(data, '{}'::jsonb),
    '{race_ids}',
    '[{"id":4027},{"id":4028},{"id":4029},{"id":4032},{"id":4321},{"id":4322}]'::jsonb,
    true
)
WHERE type_id = 3
  AND user_id IS NULL
  AND lower(name) = lower('Тёмное зрение');

-- One-time creation choices live on their race/subrace records. Keep the old
-- ability catalogue rows for historical character references, but stop granting
-- them to newly created characters.
UPDATE dndshare.item
SET data = (COALESCE(data, '{}'::jsonb) - 'choice' - 'race_ids' - 'subrace_ids')
WHERE type_id = 3
  AND user_id IS NULL
  AND lower(name) IN (
      lower('Дополнительный язык'),
      lower('Универсальность навыков'),
      lower('Обострённые чувства')
  );

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{lang_choice}', '{"count":1,"from":[]}'::jsonb, true)
WHERE id = 4074 AND type_id = 8 AND user_id IS NULL;

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{skill_choice}', '{"count":2,"from":[]}'::jsonb, true)
WHERE id = 4029 AND type_id = 8 AND user_id IS NULL;

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{skill_prof}', '[10]'::jsonb, true)
WHERE id = 4027 AND type_id = 8 AND user_id IS NULL;

-- Rock Gnome Tinker's Tools proficiency is a fixed subrace grant; the Tinker
-- ability itself remains as the ongoing crafting rule.
UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{tool_prof}', '[311]'::jsonb, true)
WHERE id = 4081 AND type_id = 8 AND user_id IS NULL;

-- Human language and Variant Human skill choices are ordinary race choices.
UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{lang_choice}', '{"count":1,"from":[]}'::jsonb, true)
WHERE id = 4026 AND type_id = 8 AND user_id IS NULL;

WITH rewritten AS (
    SELECT item.id,
           jsonb_agg(
               CASE WHEN variant.value ->> 'value' = 'gifted'
                    THEN variant.value || '{"skill_choice":{"count":1,"from":[]}}'::jsonb
                    ELSE variant.value
               END
               ORDER BY variant.ordinal
           ) AS variants
    FROM dndshare.item item
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(item.data -> 'variants') = 'array' THEN item.data -> 'variants' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS variant(value, ordinal)
    WHERE item.id = 4026 AND item.type_id = 8 AND item.user_id IS NULL
    GROUP BY item.id
)
UPDATE dndshare.item item
SET data = jsonb_set(item.data, '{variants}', rewritten.variants, true)
FROM rewritten
WHERE item.id = rewritten.id;

-- Repair the stale Dwarvish suggest id used by the Dwarf and Half-Elf choice
-- filter. The active dictionary id is 26.
UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{languages}', '[22,26]'::jsonb, true)
WHERE id = 4028 AND type_id = 8 AND user_id IS NULL;

UPDATE dndshare.item
SET data = jsonb_set(
    COALESCE(data, '{}'::jsonb),
    '{lang_choice,from}',
    COALESCE((
        SELECT jsonb_agg(CASE WHEN value = '21'::jsonb THEN '26'::jsonb ELSE value END ORDER BY ordinal)
        FROM jsonb_array_elements(COALESCE(data #> '{lang_choice,from}', '[]'::jsonb)) WITH ORDINALITY AS rows(value, ordinal)
    ), '[]'::jsonb),
    true
)
WHERE id = 4029 AND type_id = 8 AND user_id IS NULL;

-- Elf Weapon Training belongs to High/Wood Elf, not to the base Elf. Add the
-- missing proficiency dictionary values before assigning the exact lists.
INSERT INTO dndshare.suggest (id, type_id, value)
SELECT seed.id, 4, seed.value
FROM (VALUES
    (28::int8, 'Длинные луки'::text),
    (29::int8, 'Короткие луки'::text),
    (30::int8, 'Рапиры'::text)
) AS seed(id, value)
WHERE EXISTS (SELECT 1 FROM dndshare.suggest_type WHERE id = 4)
ON CONFLICT (type_id, id) DO UPDATE SET value = EXCLUDED.value;

UPDATE dndshare.item
SET data = COALESCE(data, '{}'::jsonb) - 'weapon_prof'
WHERE id = 4027 AND type_id = 8 AND user_id IS NULL;

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{weapon_prof}', '[16,17,28,29]'::jsonb, true)
WHERE id IN (4074, 4075) AND type_id = 8 AND user_id IS NULL;

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{weapon_prof}', '[30,17,15]'::jsonb, true)
WHERE id = 4076 AND type_id = 8 AND user_id IS NULL;

-- Menacing is a fixed Intimidation proficiency and does not require a separate
-- consumable or conditional ability row.
UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{skill_prof}', '[18]'::jsonb, true)
WHERE id = 4321 AND type_id = 8 AND user_id IS NULL;

-- Existing canonical sheets receive the two new fixed skill grants without
-- lowering an already selected expertise rank.
UPDATE dndshare."char" character
SET data = jsonb_set(
    character.data,
    '{values,WIS,skills}',
    COALESCE(character.data #> '{values,WIS,skills}', '{}'::jsonb)
      || jsonb_build_object(
          '10',
          COALESCE(character.data #> '{values,WIS,skills,10}', '{}'::jsonb)
            || jsonb_build_object('up', GREATEST(COALESCE((character.data #>> '{values,WIS,skills,10,up}')::int, 0), 1))
      ),
    true
)
WHERE character.data #>> '{values,race,id}' = '4027';

UPDATE dndshare."char" character
SET data = jsonb_set(
    character.data,
    '{values,CHA,skills}',
    COALESCE(character.data #> '{values,CHA,skills}', '{}'::jsonb)
      || jsonb_build_object(
          '18',
          COALESCE(character.data #> '{values,CHA,skills,18}', '{}'::jsonb)
            || jsonb_build_object('up', GREATEST(COALESCE((character.data #>> '{values,CHA,skills,18,up}')::int, 0), 1))
      ),
    true
)
WHERE character.data #>> '{values,race,id}' = '4321';

-- Complete the straightforward PHB racial catalogue gaps. These entries need
-- no new runtime concepts: two are descriptive permissions, while Relentless
-- Endurance uses the existing resource/rest contract.
WITH feature_seed(name_ru, name_en, data) AS (
    VALUES
        (
            'Непоколебимая стойкость',
            'Relentless Endurance',
            '{"desc":"<p>Когда ваши хиты опускаются до 0, но вы не убиты мгновенно, вы можете вместо этого остаться с 1 хитом. Повторно использовать эту способность можно после продолжительного отдыха.</p>","level":1,"race_ids":[{"id":4321}],"max_use":1,"rollback_long_rest":true,"resource_color":"#f87171"}'::jsonb
        ),
        (
            'Свирепые атаки',
            'Savage Attacks',
            '{"desc":"<p>Когда вы совершаете критическое попадание рукопашной атакой оружием, вы можете один раз бросить одну из костей урона оружия и добавить результат к дополнительному урону критического попадания.</p>","level":1,"race_ids":[{"id":4321}]}'::jsonb
        ),
        (
            'Общение с маленькими зверями',
            'Speak with Small Beasts',
            '{"desc":"<p>При помощи звуков и жестов вы можете сообщать простые идеи Маленьким и ещё меньшим зверям.</p>","level":1,"race_ids":[{"id":4032}],"subrace_ids":[{"id":4082}]}'::jsonb
        ),
        (
            'Знание ремесленника',
            'Artificer''s Lore',
            '{"desc":"<p>При проверке Интеллекта (История), связанной с магическим, алхимическим или технологическим предметом, вы добавляете удвоенный бонус мастерства вместо обычного.</p>","level":1,"race_ids":[{"id":4032}],"subrace_ids":[{"id":4081}]}'::jsonb
        )
)
INSERT INTO dndshare.item (name, name_en, type_id, data)
SELECT feature_seed.name_ru, feature_seed.name_en, 3, feature_seed.data
FROM feature_seed
WHERE EXISTS (SELECT 1 FROM dndshare.item_type WHERE id = 3)
  AND NOT EXISTS (
      SELECT 1 FROM dndshare.item current
      WHERE current.type_id = 3
        AND current.user_id IS NULL
        AND lower(current.name) = lower(feature_seed.name_ru)
  );

-- Newly seeded system features belong to the PHB content source.
WITH phb AS (
    SELECT content.id
    FROM dndshare.content_source content
    JOIN dndshare."source" source ON source.id = content.source_id
    WHERE lower(source.name) = 'dnd5e' AND upper(content.code) = 'PHB'
    ORDER BY content.id
    LIMIT 1
), features AS (
    SELECT item.id
    FROM dndshare.item item
    WHERE item.type_id = 3 AND item.user_id IS NULL
      AND lower(item.name) IN (
          lower('Непоколебимая стойкость'),
          lower('Свирепые атаки'),
          lower('Общение с маленькими зверями'),
          lower('Знание ремесленника')
      )
)
INSERT INTO dndshare.item_content_source (item_id, content_source_id, primary_source)
SELECT features.id, phb.id, true
FROM features CROSS JOIN phb
ON CONFLICT (item_id, content_source_id) DO NOTHING;

-- Keep the new entries visually consistent with the existing racial feature
-- catalogue. One svg_storage row is owned by each item, matching the canonical
-- item icon model.
DO $$
DECLARE
    target record;
    saved_svg_id int8;
BEGIN
    FOR target IN
        WITH icons(name_ru, svg) AS (
            VALUES
                ('Непоколебимая стойкость', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3l1 1 1-1a4 4 0 0 1 7 3c0 7-8 12-8 12Z"/><path d="M12 10v7M9 14h6"/></svg>'),
                ('Свирепые атаки', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21 18 3l3 3L8 22l-3-1Z"/><path d="m4 5 4 2M3 10h4M9 2v4"/></svg>'),
                ('Общение с маленькими зверями', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="15" r="4"/><circle cx="5" cy="10" r="2"/><circle cx="10" cy="7" r="2"/><path d="M14 13c3-3 5-2 7 0M16 17h4"/></svg>'),
                ('Знание ремесленника', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="15" r="4"/><path d="M9 9v2M9 19v2M3 15h2M13 15h2M15 3l6 6M14 8l5-5M13 9l2-1 1 2-6 6"/></svg>')
        )
        SELECT item.id, icons.svg
        FROM icons
        JOIN dndshare.item item ON item.type_id = 3 AND item.user_id IS NULL AND lower(item.name) = lower(icons.name_ru)
        WHERE item.icon_svg_id IS NULL AND item.icon_image_id IS NULL
    LOOP
        INSERT INTO dndshare.svg_storage (data) VALUES (target.svg) RETURNING id INTO saved_svg_id;
        UPDATE dndshare.item SET icon_svg_id = saved_svg_id WHERE id = target.id;
    END LOOP;
END
$$;

UPDATE dndshare.item_type item_type
SET count_items = (
    SELECT COUNT(*) FROM dndshare.item item
    WHERE item.type_id = item_type.id AND item.user_id IS NULL
)
WHERE item_type.id = 3;

-- Bring existing characters forward without replacing user-added racial rows.
-- The three retired creation-only entries are removed after their grants have
-- already been copied into skills/languages; newly applicable features append
-- only when absent.
WITH retired AS (
    SELECT item.id
    FROM dndshare.item item
    WHERE item.type_id = 3 AND item.user_id IS NULL
      AND lower(item.name) IN (
          lower('Дополнительный язык'),
          lower('Универсальность навыков'),
          lower('Обострённые чувства')
      )
), feature_bindings AS (
    SELECT item.id AS feature_id, binding.race_id, binding.subrace_id
    FROM dndshare.item item
    JOIN (VALUES
        ('Адское сопротивление'::text, '4322'::text, NULL::text),
        ('Дьявольское наследие', '4322', NULL),
        ('Тёмное зрение', '4322', NULL),
        ('Тёмное зрение', '4321', NULL),
        ('Непоколебимая стойкость', '4321', NULL),
        ('Свирепые атаки', '4321', NULL),
        ('Общение с маленькими зверями', '4032', '4082'),
        ('Знание ремесленника', '4032', '4081')
    ) AS binding(name_ru, race_id, subrace_id)
      ON item.type_id = 3 AND item.user_id IS NULL AND lower(item.name) = lower(binding.name_ru)
), rewritten AS (
    SELECT character.id,
           COALESCE((
               SELECT jsonb_agg(entry.value ORDER BY entry.ordinal)
               FROM jsonb_array_elements(
                   CASE WHEN jsonb_typeof(character.data #> '{values,abilities_race}') = 'array'
                        THEN character.data #> '{values,abilities_race}' ELSE '[]'::jsonb END
               ) WITH ORDINALITY AS entry(value, ordinal)
               WHERE NOT EXISTS (SELECT 1 FROM retired WHERE retired.id::text = entry.value ->> 'id')
           ), '[]'::jsonb)
           || COALESCE((
               SELECT jsonb_agg(jsonb_build_object('id', expected.feature_id) ORDER BY expected.feature_id)
               FROM feature_bindings expected
               WHERE character.data #>> '{values,race,id}' = expected.race_id
                 AND (expected.subrace_id IS NULL OR character.data #>> '{values,subrace,id}' = expected.subrace_id)
                 AND NOT EXISTS (
                     SELECT 1
                     FROM jsonb_array_elements(
                         CASE WHEN jsonb_typeof(character.data #> '{values,abilities_race}') = 'array'
                              THEN character.data #> '{values,abilities_race}' ELSE '[]'::jsonb END
                     ) current
                     WHERE current ->> 'id' = expected.feature_id::text
                 )
           ), '[]'::jsonb) AS abilities
    FROM dndshare."char" character
)
UPDATE dndshare."char" character
SET data = jsonb_set(character.data, '{values,abilities_race}', rewritten.abilities, true)
FROM rewritten
WHERE character.id = rewritten.id
  AND character.data #> '{values,abilities_race}' IS DISTINCT FROM rewritten.abilities;
