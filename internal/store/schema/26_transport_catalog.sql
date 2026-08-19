-- Transport keeps movement, capacity and future encounter mechanics structured
-- instead of encoding numbers and units in localized display strings.

UPDATE dndshare.item_type
SET fields = '[
  {"key":"desc","name":"Описание","type":"description"},
  {"key":"category","name":"Категория транспорта","type":"select","filter":true,"options":[{"value":"mount","label":"Скакун"},{"value":"tack","label":"Сёдла и упряжь"},{"value":"land_vehicle","label":"Наземный транспорт"},{"value":"water_vehicle","label":"Водный транспорт"}]},
  {"key":"tack_kind","name":"Назначение снаряжения","type":"select","filter":true,"show_on":{"key":"category","value":"tack"},"options":[{"value":"feed","label":"Корм"},{"value":"storage","label":"Перевозка груза"},{"value":"military_saddle","label":"Боевое седло"},{"value":"pack_saddle","label":"Грузовое седло"},{"value":"riding_saddle","label":"Ездовое седло"},{"value":"exotic_saddle","label":"Экзотическое седло"},{"value":"control","label":"Управление скакуном"}]},
  {"key":"creature_item_id","name":"Существо в бестиарии","type":"item","item_type":6,"show_on":{"key":"category","value":"mount"}},
  {"key":"movement","name":"Передвижение","type":"object","fields":[{"key":"value","name":"Скорость","type":"int"},{"key":"unit","name":"Единица","type":"select","options":[{"value":"feet","label":"Футы"},{"value":"miles_per_hour","label":"Мили в час"}]},{"key":"mode","name":"Режим","type":"select","options":[{"value":"ground","label":"По земле"},{"value":"water","label":"По воде"},{"value":"air","label":"По воздуху"}]}]},
  {"key":"propulsion","name":"Способ движения","type":"select","filter":true,"options":[{"value":"self","label":"Собственный ход"},{"value":"drawn","label":"Тяга скакунов"},{"value":"sail","label":"Парус"},{"value":"oar","label":"Вёсла"},{"value":"sail_or_oar","label":"Парус или вёсла"}]},
  {"key":"capacity","name":"Вместимость","type":"object","fields":[{"key":"carrying_lb","name":"Грузоподъёмность, фнт.","type":"int"},{"key":"crew","name":"Экипаж","type":"int"},{"key":"passengers","name":"Пассажиры","type":"int"},{"key":"cargo_lb","name":"Груз, фнт.","type":"int"},{"key":"cargo_tons","name":"Груз, тонн","type":"int"}]},
  {"key":"vehicle_stats","name":"Характеристики объекта","type":"object","fields":[{"key":"ac","name":"Класс доспеха","type":"int"},{"key":"hp","name":"Хиты","type":"int"},{"key":"damage_threshold","name":"Порог урона","type":"int"}]},
  {"key":"rider_stability_advantage","name":"Преимущество для удержания в седле","type":"boolean","show_on":{"key":"tack_kind","value":"military_saddle"}},
  {"key":"for_exotic_mount","name":"Для экзотического скакуна","type":"boolean","show_on":{"key":"tack_kind","value":"exotic_saddle"}},
  {"key":"cost","name":"Стоимость","type":"int_by_suggest","suggest_type_id":17},
  {"key":"weight","name":"Вес, фнт.","type":"int"},
  {"key":"available_in_starting_shop","name":"Доступно в магазине при создании","type":"boolean","filter":true}
]'::jsonb
WHERE id = 13;

-- Migrate user-created rows too. Runtime deliberately has no legacy fallback.
UPDATE dndshare.item
SET data = (data - 'speed' - 'carrying_capacity')
    || CASE
        WHEN data ? 'movement' THEN '{}'::jsonb
        WHEN COALESCE(data ->> 'speed', '') LIKE '%фт%'
          THEN jsonb_build_object('movement', jsonb_build_object(
            'value', replace(regexp_replace(data ->> 'speed', '[^0-9,.-]', '', 'g'), ',', '.')::numeric,
            'unit', 'feet', 'mode', 'ground'))
        WHEN COALESCE(data ->> 'speed', '') LIKE '%мил%'
          THEN jsonb_build_object('movement', jsonb_build_object(
            'value', replace(regexp_replace(data ->> 'speed', '[^0-9,.-]', '', 'g'), ',', '.')::numeric,
            'unit', 'miles_per_hour', 'mode', 'water'))
        ELSE '{}'::jsonb
      END
    || CASE
        WHEN data ? 'capacity' THEN '{}'::jsonb
        WHEN data ? 'carrying_capacity'
          THEN jsonb_build_object('capacity', jsonb_build_object(
            'carrying_lb', (data ->> 'carrying_capacity')::numeric))
        ELSE '{}'::jsonb
      END
WHERE type_id = 13;

WITH transport(name_en, propulsion, tack_kind, creature_name_en, rider_advantage, exotic_mount) AS (
  VALUES
    ('Warhorse', 'self', NULL, 'Warhorse', false, false),
    ('Camel', 'self', NULL, 'Camel', false, false),
    ('Riding Horse', 'self', NULL, 'Riding Horse', false, false),
    ('Draft Horse', 'self', NULL, 'Draft Horse', false, false),
    ('Mastiff', 'self', NULL, 'Mastiff', false, false),
    ('Donkey or Mule', 'self', NULL, 'Mule', false, false),
    ('Pony', 'self', NULL, 'Pony', false, false),
    ('Elephant', 'self', NULL, 'Elephant', false, false),
    ('Feed (per day)', NULL, 'feed', NULL, false, false),
    ('Saddlebags', NULL, 'storage', NULL, false, false),
    ('Saddle, Military', NULL, 'military_saddle', NULL, true, false),
    ('Saddle, Pack', NULL, 'pack_saddle', NULL, false, false),
    ('Saddle, Riding', NULL, 'riding_saddle', NULL, false, false),
    ('Saddle, Exotic', NULL, 'exotic_saddle', NULL, false, true),
    ('Bit and Bridle', NULL, 'control', NULL, false, false),
    ('Carriage', 'drawn', NULL, NULL, false, false),
    ('Chariot', 'drawn', NULL, NULL, false, false),
    ('Sled', 'drawn', NULL, NULL, false, false),
    ('Cart', 'drawn', NULL, NULL, false, false),
    ('Wagon', 'drawn', NULL, NULL, false, false),
    ('Warship', 'sail', NULL, NULL, false, false),
    ('Galley', 'oar', NULL, NULL, false, false),
    ('Keelboat', 'sail_or_oar', NULL, NULL, false, false),
    ('Longship', 'sail_or_oar', NULL, NULL, false, false),
    ('Sailing Ship', 'sail', NULL, NULL, false, false),
    ('Rowboat', 'oar', NULL, NULL, false, false)
), resolved AS (
  SELECT transport.*, creature.id AS creature_item_id
  FROM transport
  LEFT JOIN dndshare.item creature
    ON creature.user_id IS NULL
   AND creature.type_id = 6
   AND lower(COALESCE(creature.name_en, '')) = lower(transport.creature_name_en)
)
UPDATE dndshare.item item
SET data = jsonb_strip_nulls(item.data || jsonb_build_object(
  'propulsion', resolved.propulsion,
  'tack_kind', resolved.tack_kind,
  'creature_item_id', resolved.creature_item_id,
  'rider_stability_advantage', CASE WHEN resolved.rider_advantage THEN true ELSE NULL END,
  'for_exotic_mount', CASE WHEN resolved.exotic_mount THEN true ELSE NULL END
))
FROM resolved
WHERE item.user_id IS NULL
  AND item.type_id = 13
  AND lower(COALESCE(item.name_en, '')) = lower(resolved.name_en);
