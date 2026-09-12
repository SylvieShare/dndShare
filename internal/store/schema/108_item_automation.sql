ALTER TABLE dndshare.item
    ADD COLUMN IF NOT EXISTS automation_status text NOT NULL DEFAULT 'unreviewed'
        CHECK (automation_status IN ('unreviewed', 'full', 'partial', 'none', 'not_applicable')),
    ADD COLUMN IF NOT EXISTS automation_note text NOT NULL DEFAULT '' CHECK (char_length(automation_note) <= 1000),
    ADD COLUMN IF NOT EXISTS requires_player_interaction boolean NOT NULL DEFAULT false;
