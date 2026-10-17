-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare."char"
    ADD CONSTRAINT char_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.char_template
    ADD CONSTRAINT char_template_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare."char"
    ADD CONSTRAINT char_uuid_key UNIQUE (uuid);

ALTER TABLE ONLY dndshare.character_concentration
    ADD CONSTRAINT character_concentration_cast_id_key UNIQUE (cast_id);

ALTER TABLE ONLY dndshare.character_concentration
    ADD CONSTRAINT character_concentration_pkey PRIMARY KEY (char_id);

ALTER TABLE ONLY dndshare.concentration_effect
    ADD CONSTRAINT concentration_effect_pkey PRIMARY KEY (cast_id, effect_uid);

ALTER TABLE ONLY dndshare.item_application
    ADD CONSTRAINT item_application_pkey PRIMARY KEY (char_id, client_action_id);

ALTER TABLE ONLY dndshare.spell_cast_receipt
    ADD CONSTRAINT spell_cast_receipt_pkey PRIMARY KEY (cast_id);
