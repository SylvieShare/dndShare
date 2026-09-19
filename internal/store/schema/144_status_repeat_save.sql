-- Repeat saves belong to an active effect instance, not a new spell casting.
UPDATE dndshare.item_type SET fields=fields||$field$[
 {"key":"repeat_save","name":"Спасбросок для завершения","type":"object","optional":true,"fields":[
  {"key":"ability","name":"Характеристика","type":"suggest","suggest_id":16},
  {"key":"timing","name":"Когда можно бросить","type":"select","default":"turn_end","options":[
   {"value":"turn_start","label":"В начале хода"},{"value":"turn_end","label":"В конце хода"},
   {"value":"action","label":"Потратить действие"},{"value":"custom","label":"По условию"}]},
  {"key":"dc","name":"Фиксированная сложность","type":"int","optional":true,"min":1,"max":100,
   "hint":"Пустое поле сохраняет Сл заклинателя на экземпляре при наложении. Заполняйте только явную Сл из описания."},
  {"key":"condition","name":"Дополнительное условие","type":"text","optional":true,"hint":"Например, источник страха больше не виден. Игрок подтверждает это перед броском."}
 ]}
 ]$field$::jsonb WHERE id=15;
