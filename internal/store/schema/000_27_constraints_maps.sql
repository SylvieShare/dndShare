-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.battle_map_model
    ADD CONSTRAINT battle_map_model_pkey PRIMARY KEY (map_id, model_id);

ALTER TABLE ONLY dndshare.battle_map
    ADD CONSTRAINT battle_map_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.battle_map_preview
    ADD CONSTRAINT battle_map_preview_map_id_key UNIQUE (map_id);

ALTER TABLE ONLY dndshare.battle_map_preview
    ADD CONSTRAINT battle_map_preview_object_key_key UNIQUE (object_key);

ALTER TABLE ONLY dndshare.battle_map_preview
    ADD CONSTRAINT battle_map_preview_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.battle_map_preview
    ADD CONSTRAINT battle_map_preview_system_id_key UNIQUE (system_id);

ALTER TABLE ONLY dndshare.map_model_definition
    ADD CONSTRAINT map_model_definition_collection_source_code_source_name_key UNIQUE (collection, source_code, source_name);

ALTER TABLE ONLY dndshare.map_model_definition
    ADD CONSTRAINT map_model_definition_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.map_model
    ADD CONSTRAINT map_model_one_definition UNIQUE (definition_id);

ALTER TABLE ONLY dndshare.map_model
    ADD CONSTRAINT map_model_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.map_model_transition
    ADD CONSTRAINT map_model_transition_from_model_id_to_model_id_action_key UNIQUE (from_model_id, to_model_id, action);

ALTER TABLE ONLY dndshare.map_model_transition
    ADD CONSTRAINT map_model_transition_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_global_map
    ADD CONSTRAINT session_global_map_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_map_display
    ADD CONSTRAINT session_map_display_pkey PRIMARY KEY (session_id);

ALTER TABLE ONLY dndshare.session_map_model
    ADD CONSTRAINT session_map_model_pkey PRIMARY KEY (map_id, model_id);

ALTER TABLE ONLY dndshare.session_map
    ADD CONSTRAINT session_map_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_map
    ADD CONSTRAINT session_map_session_id_id_key UNIQUE (session_id, id);
