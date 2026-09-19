ALTER TABLE dndshare.spell_cast_receipt RENAME COLUMN healing_roll TO health_roll;
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='heal' THEN jsonb_set(jsonb_set(f,'{name}','"Лечение и временные хиты"'::jsonb),'{fields}',$field$[
  {
    "key": "kind",
    "name": "Результат применения",
    "type": "select",
    "default": "healing",
    "options": [
      {
        "value": "healing",
        "label": "Восстановить хиты"
      },
      {
        "value": "temporary_hp",
        "label": "Выдать временные хиты"
      }
    ],
    "hint": "Временные хиты не восстанавливают обычные и не складываются с уже имеющимися."
  }
]$field$::jsonb||(f->'fields')) ELSE f END ORDER BY n)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,n)) WHERE t.id=5;
