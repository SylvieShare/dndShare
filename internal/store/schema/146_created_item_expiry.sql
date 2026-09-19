UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='item_creation' THEN jsonb_set(f,'{fields}',(SELECT jsonb_agg(
  CASE WHEN c->>'key'='outputs' THEN jsonb_set(c,'{fields}',c->'fields'||$field$[
  {
    "key": "on_expire",
    "name": "После окончания срока",
    "type": "select",
    "optional": true,
    "options": [
      {
        "value": "inert",
        "label": "Остаётся, теряет свойства"
      },
      {
        "value": "vanish",
        "label": "Исчезает"
      }
    ],
    "hint": "Окончание игрового срока отмечает владелец. Исчезновение удаляет оставшееся количество выбранной стопки после подтверждения."
  }
]$field$::jsonb) ELSE c END ORDER BY cn)
 FROM jsonb_array_elements(f->'fields') WITH ORDINALITY q(c,cn))) ELSE f END ORDER BY n)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,n)) WHERE t.id=5;
