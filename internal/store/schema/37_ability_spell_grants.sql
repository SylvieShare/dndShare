-- Abilities can grant spells as part of their handbook contract. The spellbook
-- keeps those entries read-only, records their source and may override the
-- casting ability for attacks and saving throw DCs.
WITH addition AS (
    SELECT '{"name":"Дарованные заклинания","key":"granted_spells","type":"object_array","fields":[{"name":"Заклинание","key":"spell","type":"item","item_type":5},{"name":"С уровня","key":"level","type":"int","default":1},{"name":"Заклинательная характеристика","key":"ability","type":"suggest","suggest_id":16},{"name":"Без расхода ячейки","key":"slotless","type":"bool"}]}'::jsonb AS field
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || addition.field
FROM addition
WHERE item_type.id IN (3, 4, 7)
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
      WHERE current ->> 'key' = 'granted_spells'
  );

-- Fixed spell grants found by auditing the built-in racial and class feature
-- catalogue: Drow Magic, Infernal Legacy, Природная иллюзия, Bonus Cantrip:
-- Light, Improved Minor Illusion, Mage Hand Legerdemain, Shadow Arts, Spirit
-- Seeker, Spirit Walker, Undead Thralls, Shapechanger, Thousand Forms,
-- Restorative Reagents, Chemical Mastery and Empty Body.
-- Leveled racial spells and Shadow Arts do not spend ordinary spell slots;
-- their own feature resource/payment remains the usage authority.
WITH grants(item_id, granted_spells) AS (
    VALUES
        (4087, '[{"spell":{"id":511},"level":1,"ability":6},{"spell":{"id":627},"level":3,"ability":6,"slotless":true},{"spell":{"id":833},"level":5,"ability":6,"slotless":true}]'::jsonb),
        (1443, '[{"spell":{"id":537},"level":1,"ability":6},{"spell":{"id":542},"level":3,"ability":6,"slotless":true},{"spell":{"id":833},"level":5,"ability":6,"slotless":true}]'::jsonb),
        (4092, '[{"spell":{"id":498},"level":1,"ability":4}]'::jsonb),
        (4430, '[{"spell":{"id":519},"level":1,"ability":5}]'::jsonb),
        (4307, '[{"spell":{"id":498},"level":2,"ability":4}]'::jsonb),
        (4213, '[{"spell":{"id":468},"level":3,"ability":4}]'::jsonb),
        (4452, '[{"spell":{"id":498},"level":3,"ability":5},{"spell":{"id":833},"level":3,"ability":5,"slotless":true},{"spell":{"id":823},"level":3,"ability":5,"slotless":true},{"spell":{"id":698},"level":3,"ability":5,"slotless":true},{"spell":{"id":828},"level":3,"ability":5,"slotless":true}]'::jsonb),
        (4422, '[{"spell":{"id":728},"level":3,"ability":5,"slotless":true},{"spell":{"id":660},"level":3,"ability":5,"slotless":true}]'::jsonb),
        (4221, '[{"spell":{"id":1164},"level":10,"ability":5,"slotless":true}]'::jsonb),
        (4260, '[{"spell":{"id":864},"level":6,"ability":4}]'::jsonb),
        (4313, '[{"spell":{"id":1067},"level":10,"ability":4,"slotless":true}]'::jsonb),
        (4249, '[{"spell":{"id":815},"level":14,"ability":5,"slotless":true}]'::jsonb),
        (4438, '[{"spell":{"id":753},"level":9,"ability":4,"slotless":true}]'::jsonb),
        (4440, '[{"spell":{"id":1118},"level":15,"ability":4,"slotless":true},{"spell":{"id":1254},"level":15,"ability":4,"slotless":true}]'::jsonb),
        (4446, '[{"spell":{"id":1408},"level":18,"ability":5,"slotless":true}]'::jsonb)
)
UPDATE dndshare.item item
SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{granted_spells}', grants.granted_spells, true)
FROM grants
WHERE item.id = grants.item_id
  AND item.user_id IS NULL
  AND item.type_id IN (3, 4);

-- Light Domain already owns a separate "Bonus Cantrip: Light" feature. Keep
-- Warding Flare's text aligned with that model instead of implying a duplicate
-- spell grant on the resource feature itself.
UPDATE dndshare.item
SET data = jsonb_set(
    data,
    '{desc}',
    to_jsonb(replace(data ->> 'desc', 'Вы изучаете заговор Свет. ', '')),
    true
)
WHERE id = 4317
  AND user_id IS NULL
  AND type_id = 4
  AND data ->> 'desc' LIKE '%Вы изучаете заговор Свет.%';
