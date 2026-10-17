-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.session_encounter
    ADD CONSTRAINT encounter_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_arc
    ADD CONSTRAINT session_arc_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_arc
    ADD CONSTRAINT session_arc_session_order_key UNIQUE (session_id, "order");

ALTER TABLE ONLY dndshare.session_chapter
    ADD CONSTRAINT session_chapter_arc_number_key UNIQUE (arc_id, number);

ALTER TABLE ONLY dndshare.session_chapter_edge
    ADD CONSTRAINT session_chapter_edge_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_chapter
    ADD CONSTRAINT session_chapter_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_d20_roll
    ADD CONSTRAINT session_d20_roll_pkey PRIMARY KEY (session_id, request_id);

ALTER TABLE ONLY dndshare.session
    ADD CONSTRAINT session_display_code_unique UNIQUE (display_code);

ALTER TABLE ONLY dndshare.session_entity_relation
    ADD CONSTRAINT session_entity_relation_pkey PRIMARY KEY (session_id, left_type, left_id, right_type, right_id);

ALTER TABLE ONLY dndshare.session_event
    ADD CONSTRAINT session_event_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_image_catalog
    ADD CONSTRAINT session_image_catalog_key_unique UNIQUE (catalog_key);

ALTER TABLE ONLY dndshare.session_image_catalog
    ADD CONSTRAINT session_image_catalog_pk PRIMARY KEY (image_id);

ALTER TABLE ONLY dndshare.session_interaction
    ADD CONSTRAINT session_interaction_pkey PRIMARY KEY (event_id);

ALTER TABLE ONLY dndshare.session_inventory
    ADD CONSTRAINT session_inventory_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_inventory
    ADD CONSTRAINT session_inventory_session_id_client_action_id_key UNIQUE (session_id, client_action_id);

ALTER TABLE ONLY dndshare.session
    ADD CONSTRAINT session_invite_code_key UNIQUE (invite_code);

ALTER TABLE ONLY dndshare.session_karmic_scale
    ADD CONSTRAINT session_karmic_scale_pkey PRIMARY KEY (session_id, actor_key);

ALTER TABLE ONLY dndshare.session_location
    ADD CONSTRAINT session_location_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_material
    ADD CONSTRAINT session_material_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_music_state
    ADD CONSTRAINT session_music_state_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_music_state
    ADD CONSTRAINT session_music_state_session_id_key UNIQUE (session_id);

ALTER TABLE ONLY dndshare.session_npc
    ADD CONSTRAINT session_npc_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_occurrence
    ADD CONSTRAINT session_occurrence_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_occurrence
    ADD CONSTRAINT session_occurrence_session_id_number_key UNIQUE (session_id, number);

ALTER TABLE ONLY dndshare.session_participant
    ADD CONSTRAINT session_participant_char_id_key UNIQUE (char_id);

ALTER TABLE ONLY dndshare.session_participant
    ADD CONSTRAINT session_participant_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_participant
    ADD CONSTRAINT session_participant_session_id_char_id_key UNIQUE (session_id, char_id);

ALTER TABLE ONLY dndshare.session_participant
    ADD CONSTRAINT session_participant_session_id_sort_order_key UNIQUE (session_id, sort_order);

ALTER TABLE ONLY dndshare.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_presentation_state
    ADD CONSTRAINT session_presentation_state_pk PRIMARY KEY (session_id);

ALTER TABLE ONLY dndshare.session_quest
    ADD CONSTRAINT session_quest_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_scene_edge
    ADD CONSTRAINT session_scene_edge_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_scene_item_edge
    ADD CONSTRAINT session_scene_item_edge_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_scene_item
    ADD CONSTRAINT session_scene_item_session_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_scene
    ADD CONSTRAINT session_scene_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session_timer
    ADD CONSTRAINT session_timer_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.session
    ADD CONSTRAINT session_uuid_key UNIQUE (uuid);
