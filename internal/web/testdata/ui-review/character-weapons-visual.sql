-- The paired weapon state uses the same non-empty owned data in both clients.
UPDATE dndshare."char" SET data=jsonb_set(jsonb_set(data,
    '{values,weapon}', '[{"uid":"review-staff","item_id":206,"proficient":true,"stat_suggest_id":1,"params":{},"add_attacks":[]},{"uid":"review-magic","item_id":206,"magic_item_id":214,"proficient":true,"stat_suggest_id":1,"params":{"magic":{"remaining":3}},"add_attacks":[]}]'::jsonb),
    '{values,abilities_class}', '[{"id":213,"count":3,"resource_version":1}]'::jsonb)
WHERE template_id=(SELECT id FROM dndshare.char_template WHERE name='DND5');
