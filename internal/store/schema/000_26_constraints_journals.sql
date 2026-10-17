-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.character_journal
    ADD CONSTRAINT character_journal_pk PRIMARY KEY (char_id);

ALTER TABLE ONLY dndshare.journal_entry
    ADD CONSTRAINT journal_entry_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.journal_entry
    ADD CONSTRAINT journal_entry_position_key UNIQUE (section_id, "position") DEFERRABLE;

ALTER TABLE ONLY dndshare.journal_link
    ADD CONSTRAINT journal_link_pkey PRIMARY KEY (from_id, to_id);

ALTER TABLE ONLY dndshare.journal_node
    ADD CONSTRAINT journal_node_journal_id_entry_id_key UNIQUE (journal_id, entry_id);

ALTER TABLE ONLY dndshare.journal_node
    ADD CONSTRAINT journal_node_pkey PRIMARY KEY (entry_id);

ALTER TABLE ONLY dndshare.journal
    ADD CONSTRAINT journal_personal_character_key UNIQUE (personal_char_id);

ALTER TABLE ONLY dndshare.journal
    ADD CONSTRAINT journal_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.journal_section
    ADD CONSTRAINT journal_section_occurrence_id_key UNIQUE (occurrence_id);

ALTER TABLE ONLY dndshare.journal_section
    ADD CONSTRAINT journal_section_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.journal_section
    ADD CONSTRAINT journal_section_position_key UNIQUE (journal_id, "position");

ALTER TABLE ONLY dndshare.journal
    ADD CONSTRAINT journal_session_key UNIQUE (session_id);

ALTER TABLE ONLY dndshare.journal
    ADD CONSTRAINT journal_uuid_key UNIQUE (uuid);
