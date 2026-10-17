-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.character_journal
    ADD CONSTRAINT character_journal_char_id_fkey FOREIGN KEY (char_id) REFERENCES dndshare."char"(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.character_journal
    ADD CONSTRAINT character_journal_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES dndshare.journal(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal_entry
    ADD CONSTRAINT journal_entry_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES dndshare.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.journal_entry
    ADD CONSTRAINT journal_entry_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES dndshare.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.journal_entry
    ADD CONSTRAINT journal_entry_section_id_fkey FOREIGN KEY (section_id) REFERENCES dndshare.journal_section(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal_entry
    ADD CONSTRAINT journal_entry_source_scene_item_id_fkey FOREIGN KEY (source_scene_item_id) REFERENCES dndshare.session_scene_item(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.journal_link
    ADD CONSTRAINT journal_link_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES dndshare.journal(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal_link
    ADD CONSTRAINT journal_link_journal_id_from_id_fkey FOREIGN KEY (journal_id, from_id) REFERENCES dndshare.journal_node(journal_id, entry_id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal_link
    ADD CONSTRAINT journal_link_journal_id_to_id_fkey FOREIGN KEY (journal_id, to_id) REFERENCES dndshare.journal_node(journal_id, entry_id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal_node
    ADD CONSTRAINT journal_node_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES dndshare.journal_entry(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal_node
    ADD CONSTRAINT journal_node_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES dndshare.journal(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal
    ADD CONSTRAINT journal_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES dndshare.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal
    ADD CONSTRAINT journal_personal_char_id_fkey FOREIGN KEY (personal_char_id) REFERENCES dndshare."char"(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal_section
    ADD CONSTRAINT journal_section_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES dndshare.journal(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal_section
    ADD CONSTRAINT journal_section_occurrence_id_fkey FOREIGN KEY (occurrence_id) REFERENCES dndshare.session_occurrence(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.journal
    ADD CONSTRAINT journal_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;
