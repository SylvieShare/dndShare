ALTER TABLE dndshare.item_transfer ALTER COLUMN recipient_char_id DROP NOT NULL;
ALTER TABLE dndshare.item_transfer DROP CONSTRAINT item_transfer_source_check;
ALTER TABLE dndshare.item_transfer ADD CONSTRAINT item_transfer_source_check CHECK(source IN ('items','weapon','potions','spells'));
ALTER TABLE dndshare.item_transfer DROP CONSTRAINT item_transfer_use_source;
ALTER TABLE dndshare.item_transfer ADD CONSTRAINT item_transfer_use_source CHECK(purpose <> 'use' OR source IN ('potions','spells'));
ALTER TABLE dndshare.item_transfer ADD CONSTRAINT item_transfer_dm_use CHECK(recipient_char_id IS NOT NULL OR purpose='use');
ALTER TABLE dndshare.item_transfer ADD COLUMN resolved_target jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Declarative effect actions and the same weapon-damage blocks used by abilities.
UPDATE dndshare.item_type SET fields=fields || '{"key": "ongoing_damage", "name": "Урон по ходам", "type": "object", "optional": true, "fields": [{"key": "dice_count", "name": "Начальное количество костей", "type": "int"}, {"key": "dice", "name": "Кость урона", "type": "text"}, {"key": "damage_type", "name": "Тип урона", "type": "suggest", "suggest_id": 12}, {"key": "save_ability", "name": "Характеристика спасброска", "type": "suggest", "suggest_id": 16}, {"key": "save_dc", "name": "Сложность", "type": "int"}, {"key": "decrease_on_save", "name": "Уменьшение количества костей при успехе", "type": "int"}]}'::jsonb WHERE id=15 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key'='ongoing_damage');
UPDATE dndshare.item_type SET fields=fields || '{"key": "weapon_target", "name": "Нанесение на оружие", "type": "object", "optional": true, "fields": [{"key": "damage_types", "name": "Допустимые типы урона оружия", "type": "suggest_array", "suggest_id": 12}]}'::jsonb WHERE id=15 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key'='weapon_target');
UPDATE dndshare.item_type SET fields=fields || '{"key": "on_end_effect", "name": "Эффект после завершения", "type": "item", "item_type": 15}'::jsonb WHERE id=15 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key'='on_end_effect');
UPDATE dndshare.item_type SET fields=fields || COALESCE((SELECT f FROM dndshare.item_type t CROSS JOIN LATERAL jsonb_array_elements(t.fields) f WHERE t.id=19 AND f->>'key'='weapon_damage' LIMIT 1),'[]'::jsonb) WHERE id=15 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key'='weapon_damage');

UPDATE dndshare.item_type SET fields=fields || '{"key": "end_on", "name": "Завершить после", "type": "enum_array", "options": [{"value": "attack", "label": "Атаки"}, {"value": "spell_cast", "label": "Сотворения заклинания"}]}'::jsonb WHERE id=15;
UPDATE dndshare.item_type SET fields=(SELECT jsonb_agg(CASE WHEN f->>'key'='weapon_damage' THEN jsonb_set(f,'{fields}',(f->'fields') || '{"key": "sign", "name": "Прибавить или вычесть", "type": "select", "options": [{"value": "+", "label": "Прибавить"}, {"value": "-", "label": "Вычесть"}]}'::jsonb) ELSE f END ORDER BY n) FROM jsonb_array_elements(fields) WITH ORDINALITY t(f,n)) WHERE id=15;
