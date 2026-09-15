ALTER TABLE dndshare."session" ALTER COLUMN settings SET DEFAULT '{"players":{"seeClass":true,"seeRace":true,"seeHp":false,"openSheets":true},"combat":{"autoRollNpcHp":false},"interactions":{"items":true,"potions":true,"spells":true},"autoAccept":{"items":false,"potions":false,"spells":false}}'::jsonb;
UPDATE dndshare."session" SET settings = jsonb_set(settings,'{autoAccept}','{"items":false,"potions":false,"spells":false}'::jsonb);

UPDATE dndshare."session" SET settings=jsonb_set(settings,'{interactions}','{"items":true,"potions":true,"spells":true}'::jsonb);
