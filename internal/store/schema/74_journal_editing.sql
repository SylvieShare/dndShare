ALTER TABLE dndshare.journal ADD COLUMN players_can_edit boolean NOT NULL DEFAULT true;

-- Permit a complete permutation in one transaction without transient conflicts.
ALTER TABLE dndshare.journal_entry DROP CONSTRAINT journal_entry_position_key;
ALTER TABLE dndshare.journal_entry ADD CONSTRAINT journal_entry_position_key
    UNIQUE (section_id, position) DEFERRABLE INITIALLY IMMEDIATE;
