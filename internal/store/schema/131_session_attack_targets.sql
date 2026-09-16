-- Historical weapon and spell attack events predate the explicit roll marker.
-- Do not classify arbitrary d20 checks or damage rolls as attacks.
UPDATE dndshare.session_event
SET data = data || '{"attackRoll":true}'::jsonb
WHERE event_type = 'dice_roll'
  AND NOT (data ? 'attackRoll')
  AND COALESCE(data->>'damageRoll', 'false') <> 'true'
  AND (action ~* '^(Атака:|Переброс атаки:)' OR data ? 'weaponUseId')
  AND jsonb_path_exists(data, '$.result.parts[*] ? (@.kind == "dice" && @.sides == 20)');
