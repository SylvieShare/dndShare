ALTER TABLE dndshare."session"
    ADD COLUMN settings jsonb NOT NULL DEFAULT '{"players":{"seeClass":true,"seeRace":true,"seeHp":false,"openSheets":true},"combat":{"autoRollNpcHp":false}}'::jsonb;

UPDATE dndshare."session"
SET settings = jsonb_build_object(
    'players', jsonb_build_object(
        'seeClass', players_see_class,
        'seeRace', players_see_race,
        'seeHp', players_see_hp,
        'openSheets', players_open_sheets
    ),
    'combat', jsonb_build_object('autoRollNpcHp', false)
);

ALTER TABLE dndshare."session"
    ADD CONSTRAINT session_settings_object CHECK (jsonb_typeof(settings) = 'object'),
    DROP COLUMN players_see_class,
    DROP COLUMN players_see_race,
    DROP COLUMN players_see_hp,
    DROP COLUMN players_open_sheets;
