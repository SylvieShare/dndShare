-- Catalogue classification and mandatory equipment bases for magic instances.

UPDATE dndshare.item_type SET fields=(SELECT jsonb_agg(CASE WHEN f->>'key'='type' THEN '{"key": "type", "name": "Вид предмета", "type": "select", "filter": true, "options": [{"value": "чудесный предмет", "label": "Прочие чудесные предметы"}, {"value": "броня", "label": "Доспехи"}, {"value": "щит", "label": "Щиты"}, {"value": "оружие", "label": "Оружие"}, {"value": "боеприпасы", "label": "Боеприпасы"}, {"value": "кольцо", "label": "Кольца"}, {"value": "амулет", "label": "Амулеты и талисманы"}, {"value": "одежда", "label": "Плащи и одеяния"}, {"value": "обувь", "label": "Обувь"}, {"value": "перчатки", "label": "Перчатки и наручи"}, {"value": "головной убор", "label": "Головные уборы и очки"}, {"value": "пояс", "label": "Пояса"}, {"value": "сумка", "label": "Сумки"}, {"value": "жезл", "label": "Жезлы"}, {"value": "посох", "label": "Посохи"}, {"value": "волшебная палочка", "label": "Волшебные палочки"}, {"value": "свиток", "label": "Свитки"}]}'::jsonb ELSE f END ORDER BY ord) FROM jsonb_array_elements(fields) WITH ORDINALITY x(f,ord) WHERE f->>'key' NOT IN ('armor','category','required_armor_proficiency','strength_required','stealth_disadvantage')) || jsonb_build_array('{"key": "armor_base", "name": "Используется как доспех или щит", "type": "object", "optional": true, "hint": "Выберите фиксированную основу или разрешённые варианты. Игрок выбирает основу до добавления экземпляра; КД, владение и ограничения берутся из неё.", "fields": [{"key": "base_item_id", "name": "Фиксированная основа", "type": "item", "item_type": 12, "hint": "Выберите, если предмет всегда имеет один вид: например, кинжал. Пусто — игрок выбирает основу экземпляра."}, {"key": "allowed_base_item_ids", "name": "Допустимые основы на выбор", "type": "item_array", "item_type": 12, "hint": "Пустой список разрешает любой обычный доспех или щит. Чтобы ограничить выбор, перечислите подходящие основы."}, {"key": "magic_bonus", "name": "Бонус к КД", "type": "int", "min": 0, "max": 3, "default": 0, "hint": "Добавляется к КД выбранной основы, когда магические свойства действуют."}, {"key": "bonus_without_attunement", "name": "Бонус действует без настройки", "type": "bool", "hint": "Отметьте только если правило предмета отдельно разрешает этот бонус до настройки."}, {"key": "ignore_strength", "name": "Нет требования Силы", "type": "bool"}, {"key": "ignore_stealth_disadvantage", "name": "Нет помехи Скрытности", "type": "bool"}, {"key": "grants_proficiency", "name": "Владелец считается владеющим этим доспехом", "type": "bool"}]}'::jsonb) WHERE id=19;

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"амулет"') WHERE type_id=19 AND user_id IS NULL AND name ~ '^(Амулет|Талисман|Медальон|Ожерелье|Брошь|Скарабей)';

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"одежда"') WHERE type_id=19 AND user_id IS NULL AND name ~ '^(Плащ|Мантия|Одеяние|Крылья полёта)';

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"обувь"') WHERE type_id=19 AND user_id IS NULL AND name ~ '(Сапоги|сапоги|Тапочки)';

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"перчатки"') WHERE type_id=19 AND user_id IS NULL AND name ~ '^(Перчатки|Рукавицы|Наручи)';

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"головной убор"') WHERE type_id=19 AND user_id IS NULL AND name ~ '^(Шлем|Шляпа|Обруч|Повязка|Очки)';

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"пояс"') WHERE type_id=19 AND user_id IS NULL AND name ~ '^Пояс';

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"сумка"') WHERE type_id=19 AND user_id IS NULL AND name ~ '^(Сумка|Удобный рюкзак)';

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"боеприпасы"') WHERE type_id=19 AND user_id IS NULL AND name ~ '^(Боеприпасы|Стрела убийства)';

UPDATE dndshare.item SET data=jsonb_set(data,'{type}','"щит"') WHERE type_id=19 AND user_id IS NULL AND name ~ '^(Щит|Оживлённый щит)';

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4527, "magic_bonus": 0}'::jsonb) WHERE id=78 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4527, "magic_bonus": 1}'::jsonb) WHERE id=92 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4527, "magic_bonus": 2}'::jsonb) WHERE id=112 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4460, "magic_bonus": 1, "grants_proficiency": true}'::jsonb) WHERE id=113 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4461, "magic_bonus": 1}'::jsonb) WHERE id=114 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4527, "magic_bonus": 0}'::jsonb) WHERE id=117 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4467, "magic_bonus": 0}'::jsonb) WHERE id=155 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4527, "magic_bonus": 0}'::jsonb) WHERE id=170 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4467, "magic_bonus": 0}'::jsonb) WHERE id=187 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4467, "magic_bonus": 1}'::jsonb) WHERE id=262 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4467, "magic_bonus": 0}'::jsonb) WHERE id=289 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4527, "magic_bonus": 3}'::jsonb) WHERE id=304 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4527, "magic_bonus": 0}'::jsonb) WHERE id=332 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4467, "magic_bonus": 2}'::jsonb) WHERE id=338 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4458, "magic_bonus": 1}'::jsonb) WHERE id=339 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=(data - ARRAY['armor','category','required_armor_proficiency','strength_required','stealth_disadvantage']) || jsonb_build_object('armor_base','{"base_item_id": 4457, "magic_bonus": 1}'::jsonb) WHERE id=1423 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=data || jsonb_build_object('armor_base','{"allowed_base_item_ids": [4456, 4457, 4458, 4459, 4460, 4461, 4462, 4463, 4464, 4465, 4466, 4467], "magic_bonus": 0}'::jsonb || jsonb_build_object('magic_bonus',CASE data->>'rarity' WHEN '2' THEN 1 WHEN '3' THEN 2 WHEN '4' THEN 3 ELSE 0 END)) WHERE id=184 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=data || jsonb_build_object('armor_base','{"allowed_base_item_ids": [4456, 4457, 4458, 4459, 4460, 4461, 4462, 4463, 4464, 4465, 4466, 4467], "magic_bonus": 0}'::jsonb || jsonb_build_object('magic_bonus',CASE data->>'rarity' WHEN '2' THEN 1 WHEN '3' THEN 2 WHEN '4' THEN 3 ELSE 0 END)) WHERE id=211 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=data || jsonb_build_object('armor_base','{"allowed_base_item_ids": [4456, 4457, 4458, 4459, 4460, 4461, 4462, 4463, 4464, 4465, 4466, 4467], "magic_bonus": 0}'::jsonb || jsonb_build_object('magic_bonus',CASE data->>'rarity' WHEN '2' THEN 1 WHEN '3' THEN 2 WHEN '4' THEN 3 ELSE 0 END)) WHERE id=266 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=data || jsonb_build_object('armor_base','{"allowed_base_item_ids": [4456, 4457, 4458, 4459, 4460, 4461, 4462, 4463, 4464, 4465, 4466, 4467], "magic_bonus": 0}'::jsonb || jsonb_build_object('magic_bonus',0)) WHERE id=228 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=data || jsonb_build_object('armor_base','{"allowed_base_item_ids": [4460, 4461, 4462, 4463, 4464, 4465, 4466, 4467], "magic_bonus": 0, "ignore_strength": true, "ignore_stealth_disadvantage": true}'::jsonb || jsonb_build_object('magic_bonus',0)) WHERE id=222 AND type_id=19 AND user_id IS NULL;

UPDATE dndshare.item SET data=data || jsonb_build_object('armor_base','{"allowed_base_item_ids": [4460, 4461, 4462, 4463, 4464, 4465, 4466, 4467], "magic_bonus": 0}'::jsonb || jsonb_build_object('magic_bonus',0)) WHERE id=232 AND type_id=19 AND user_id IS NULL;
