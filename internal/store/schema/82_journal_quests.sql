ALTER TABLE dndshare.journal_entry DROP CONSTRAINT journal_entry_type_check;
ALTER TABLE dndshare.journal_entry ADD CONSTRAINT journal_entry_type_check
    CHECK (entry_type IN ('battle', 'dialog', 'event', 'newday', 'quest'));
