CREATE TABLE dndshare.spell_cast_receipt (
 cast_id uuid PRIMARY KEY,
 char_id bigint NOT NULL REFERENCES dndshare."char"(id) ON DELETE CASCADE,
 request jsonb NOT NULL,
 result jsonb NOT NULL DEFAULT '{}'::jsonb,
 healing_roll jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
UPDATE dndshare.item_type SET fields=fields||'[{"key":"application_targets","name":"Цели применения","type":"object","fields":[{"key":"count","name":"Максимум целей","type":"int","default":1},{"key":"per_slot","name":"Дополнительных целей за круг выше базового","type":"int","default":0}]}]'::jsonb WHERE id=5;
