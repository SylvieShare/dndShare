-- Historical editors were not recorded: leave them unknown rather than
-- attributing other people's edits to the creator.
ALTER TABLE dndshare.journal_entry ADD COLUMN changed_by_user_id int8 NULL
    REFERENCES dndshare.users(id) ON DELETE SET NULL;
