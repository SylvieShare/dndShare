-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.content_source_compatibility
    ADD CONSTRAINT content_source_compatibility_pk PRIMARY KEY (content_source_id, source_version_id);

ALTER TABLE ONLY dndshare.content_source
    ADD CONSTRAINT content_source_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.custom_item_source
    ADD CONSTRAINT custom_item_source_id_user_key UNIQUE (id, user_id);

ALTER TABLE ONLY dndshare.custom_item_source
    ADD CONSTRAINT custom_item_source_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.item_content_source
    ADD CONSTRAINT item_content_source_pk PRIMARY KEY (item_id, content_source_id);

ALTER TABLE ONLY dndshare.item_icon_preset
    ADD CONSTRAINT item_icon_preset_item_type_id_code_key UNIQUE (item_type_id, code);

ALTER TABLE ONLY dndshare.item_icon_preset
    ADD CONSTRAINT item_icon_preset_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.item
    ADD CONSTRAINT item_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.item_transfer
    ADD CONSTRAINT item_transfer_event_id_key UNIQUE (event_id);

ALTER TABLE ONLY dndshare.item_transfer
    ADD CONSTRAINT item_transfer_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.item_transfer
    ADD CONSTRAINT item_transfer_sender_char_id_client_action_id_key UNIQUE (sender_char_id, client_action_id);

ALTER TABLE ONLY dndshare.item_type
    ADD CONSTRAINT item_type_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.item_version_compatibility
    ADD CONSTRAINT item_version_compatibility_pk PRIMARY KEY (item_id, source_version_id);

ALTER TABLE ONLY dndshare.source
    ADD CONSTRAINT newtable_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.source_version
    ADD CONSTRAINT source_version_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.source_version
    ADD CONSTRAINT source_version_source_id_version_key UNIQUE (source_id, version);

ALTER TABLE ONLY dndshare.suggest
    ADD CONSTRAINT suggest_pk PRIMARY KEY (type_id, id);

ALTER TABLE ONLY dndshare.suggest_type
    ADD CONSTRAINT suggest_type_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.svg_storage
    ADD CONSTRAINT svg_storage_pk PRIMARY KEY (id);
