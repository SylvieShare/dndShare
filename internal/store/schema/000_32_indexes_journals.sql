-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE INDEX idx_character_journal_journal_id ON dndshare.character_journal USING btree (journal_id);

CREATE INDEX idx_journal_entry_section_id ON dndshare.journal_entry USING btree (section_id, "position");

CREATE INDEX idx_journal_owner_user_id ON dndshare.journal USING btree (owner_user_id, changed_at DESC);

CREATE INDEX idx_journal_section_journal_id ON dndshare.journal_section USING btree (journal_id, "position");

CREATE INDEX journal_link_target_idx ON dndshare.journal_link USING btree (journal_id, to_id);
