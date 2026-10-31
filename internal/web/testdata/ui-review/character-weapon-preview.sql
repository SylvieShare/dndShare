-- A magic weapon with a selected base and structured rules, not a description-only spell.
UPDATE dndshare.item SET name_en='Lightning Staff',cover_image_id=1,data=data ||
'{"type":"оружие","rarity":1,"activation":"equipped","cost":{"suggest_id":1},"dawn_recovery":{"dice":"1d3"},"weapon_notes":[{"key":"rule","kind":"rule","title":"Магическое оружие","description":"<p>Сохраняет свойства выбранной основы.</p>","requirements":["Предмет экипирован"]}]}'::jsonb WHERE id=214;
