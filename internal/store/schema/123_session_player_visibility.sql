ALTER TABLE dndshare."session"
    ADD COLUMN players_see_class boolean NOT NULL DEFAULT true,
    ADD COLUMN players_see_race boolean NOT NULL DEFAULT true,
    ADD COLUMN players_see_hp boolean NOT NULL DEFAULT false,
    ADD COLUMN players_open_sheets boolean NOT NULL DEFAULT true;
